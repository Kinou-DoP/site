// POST /api/depot : envoi d'une vidéo depuis l'ordinateur (video club de l'admin) directement chez Amazon (Gus 26/11).
// Le fichier ne passe pas par ici : la fonction signe seulement les adresses d'envoi (« URL pré-signées ») et le navigateur envoie
// les morceaux (16 Mo) tout droit dans le compartiment kinou-videos (CORS du compartiment : PUT depuis kinou-dop.github.io).
// Clé Amazon : DEPOT_KEY_ID / DEPOT_KEY_SECRET, secrets Cloudflare rangés par Gus (jamais dans le code) ; utilisateur
// kinou-depot-admin, droits : déposer dans depot/ seulement (ni lire, ni effacer). Réservé aux personnes qui peuvent écrire dans le
// dépôt admin (leur clé GitHub, vérifiée à chaque appel). Le robot d'encodage (dépôt admin, sans clé) lit ensuite depot/.
// Corps JSON { op, … } :
//   start    { name, size }                  → { key, uploadId }  (envoi en morceaux créé ; 10 Go au plus)
//   parts    { key, uploadId, numbers: [n] }  → { urls: { n: url } } (adresses d'envoi des morceaux, valables 6 h)
//   list     { key, uploadId }                → { parts: [{ n, etag, size }] } (reprise après une coupure)
//   complete { key, uploadId, parts: [{ n, etag }] } → { key }
//   img      { key: "depot/<dossier>/<nom>.webp|jpg|png" } → { url } (Gus 25/11 : stills, vignettes, images importées) : adresse
//            d'envoi d'une image en une fois (PUT, 15 min, 20 Mo au plus côté admin) ; le dossier est tiré au hasard par l'admin, qui
//            connaît ainsi tout de suite l'adresse définitive (notre CloudFront + key). Content-Type et Cache-Control envoyés par l'admin.
import { ADMIN_REPO, json, preflight } from "../_shared.js";

const BUCKET = "kinou-videos", REGION = "eu-north-1", HOST = BUCKET + ".s3." + REGION + ".amazonaws.com", MAX = 10 * 1024 ** 3;
const KEY = /^depot\/[a-z0-9]{8,40}\/[\w.-]{1,120}$/;
const te = new TextEncoder();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? te.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(msg)));
}
async function signer(env) {
  const id = env.DEPOT_KEY_ID, secret = env.DEPOT_KEY_SECRET;
  if (!id || !secret) throw new Error("clé de dépôt absente (secrets Cloudflare DEPOT_KEY_ID / DEPOT_KEY_SECRET)");
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), day = now.slice(0, 8);
  const scope = day + "/" + REGION + "/s3/aws4_request";
  let k = await hmac("AWS4" + secret, day); k = await hmac(k, REGION); k = await hmac(k, "s3"); k = await hmac(k, "aws4_request");
  // Adresse pré-signée (signature dans l'adresse, contenu non signé) : servie au navigateur ou appelée d'ici.
  return async function presign(method, key, query, expires) {
    const q = Object.assign({}, query, { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": id + "/" + scope, "X-Amz-Date": now,
      "X-Amz-Expires": String(expires || 600), "X-Amz-SignedHeaders": "host" });
    const cq = Object.keys(q).sort().map((n) => enc(n) + "=" + enc(q[n])).join("&");
    const path = "/" + key.split("/").map(enc).join("/");
    const creq = [method, path, cq, "host:" + HOST + "\n", "host", "UNSIGNED-PAYLOAD"].join("\n");
    const sts = ["AWS4-HMAC-SHA256", now, scope, hex(await crypto.subtle.digest("SHA-256", te.encode(creq)))].join("\n");
    return "https://" + HOST + path + "?" + cq + "&X-Amz-Signature=" + hex(await hmac(k, sts));
  };
}
const tag = (xml, t) => (xml.match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1];
async function s3(url, method, body) {
  const r = await fetch(url, { method, body });
  const t = await r.text();
  if (!r.ok || /<Error>/.test(t)) throw new Error("Amazon : " + (tag(t, "Code") || r.status) + (tag(t, "Message") ? " (" + tag(t, "Message") + ")" : ""));
  return t;
}
function safeName(n) {
  const s = String(n || "video").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "");
  return (s || "video").slice(-120);
}
function rand(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((x) => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join(""); }

export async function onRequest({ request, env }) {
  const p = preflight(request); if (p) return p;
  if (request.method !== "POST") return json({ error: "POST attendu" }, 405);
  const gh = await fetch("https://api.github.com/repos/" + ADMIN_REPO, { headers: { Authorization: request.headers.get("authorization") || "", "User-Agent": "kinou-site" } });
  const repo = gh.ok ? await gh.json() : null;
  if (!repo || !repo.permissions || !repo.permissions.push) return json({ error: "clé GitHub refusée (droit d'écriture sur admin nécessaire)" }, 403);
  let b; try { b = await request.json(); } catch (e) { return json({ error: "JSON attendu" }, 400); }
  try {
    const presign = await signer(env);
    if (b.op === "start") {
      if (!(b.size > 0) || b.size > MAX) return json({ error: "taille refusée (10 Go au plus)" }, 400);
      const key = "depot/" + rand(20) + "/" + safeName(b.name);
      const t = await s3(await presign("POST", key, { uploads: "" }), "POST");
      return json({ key, uploadId: tag(t, "UploadId") });
    }
    if (b.op === "img") {
      if (!KEY.test(b.key || "") || !/\.(webp|jpe?g|png)$/i.test(b.key)) return json({ error: "image refusée" }, 400);
      return json({ url: await presign("PUT", b.key, {}, 900) });
    }
    if (!KEY.test(b.key || "") || !b.uploadId) return json({ error: "envoi inconnu" }, 400);
    if (b.op === "parts") {
      const urls = {};
      for (const n of (b.numbers || []).slice(0, 100)) {
        if (!(n >= 1 && n <= 10000)) continue;
        urls[n] = await presign("PUT", b.key, { partNumber: String(n), uploadId: b.uploadId }, 21600);
      }
      return json({ urls });
    }
    if (b.op === "list") {
      const t = await s3(await presign("GET", b.key, { uploadId: b.uploadId }), "GET");
      const parts = [...t.matchAll(/<Part>([\s\S]*?)<\/Part>/g)].map((m) => ({ n: +tag(m[1], "PartNumber"), etag: tag(m[1], "ETag"), size: +tag(m[1], "Size") }));
      return json({ parts });
    }
    if (b.op === "complete") {
      const parts = (b.parts || []).slice().sort((x, y) => x.n - y.n);
      if (!parts.length) return json({ error: "aucun morceau" }, 400);
      const xml = "<CompleteMultipartUpload>" + parts.map((x) => "<Part><PartNumber>" + (+x.n) + "</PartNumber><ETag>" +
        String(x.etag || "").replace(/[<>&]/g, "") + "</ETag></Part>").join("") + "</CompleteMultipartUpload>";
      await s3(await presign("POST", b.key, { uploadId: b.uploadId }), "POST", xml);
      return json({ key: b.key });
    }
    return json({ error: "op inconnue" }, 400);
  } catch (e) { return json({ error: String((e && e.message) || e) }, 502); }
}
