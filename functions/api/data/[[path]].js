// GET /api/data/<chemin> : fichiers de données publiés par l'admin (dépôt Kinou-DoP/admin, data/ de la branche main).
// Toujours à jour : on lit l'identifiant du dernier commit de main (git, sans clé ni quota de l'API GitHub, gardé 10 s),
// puis le fichier de CE commit sur raw.githubusercontent.com (adresse figée, jamais périmée). Plus d'attente de 5 min
// après une publication. En cas de souci : le fichier de main (cache de GitHub, jusqu'à 5 min).
import { ADMIN_REPO, CORS, preflight } from "../../_shared.js";

var TYPES = { json: "application/json; charset=utf-8", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };
var RAW = "https://raw.githubusercontent.com/" + ADMIN_REPO + "/";

async function cached(key, ttl, make) {
  var cache = null; try { cache = caches.default; } catch (e) {}
  var req = new Request("https://kinou-cache.invalid/" + key);
  if (cache) { try { var hit = await cache.match(req); if (hit) return hit.text(); } catch (e) {} }
  var v = await make();
  if (cache && v) { try { await cache.put(req, new Response(v, { headers: { "Cache-Control": "max-age=" + ttl } })); } catch (e) {} }
  return v;
}
async function mainSha() {
  return cached("sha-main", 10, async function () {
    var r = await fetch("https://github.com/" + ADMIN_REPO + ".git/info/refs?service=git-upload-pack", { headers: { "User-Agent": "git/2.40 kinou-site" } });
    if (!r.ok) return "";
    var m = /([0-9a-f]{40}) refs\/heads\/main\b/.exec(await r.text());
    return m ? m[1] : "";
  });
}

export async function onRequest(context) {
  var p = preflight(context.request); if (p) return p;
  var path = decodeURIComponent(new URL(context.request.url).pathname.replace(/^\/api\/data\//, ""));
  var ext = ((path.match(/\.([a-z0-9]+)$/i) || [])[1] || "").toLowerCase();
  if (!/^[\w.\/-]+$/.test(path) || path.indexOf("..") > -1 || !TYPES[ext]) return new Response("Introuvable", { status: 404, headers: CORS });
  var sha = "";
  try { sha = await mainSha(); } catch (e) {}
  var r = null;
  if (sha) { try { r = await fetch(RAW + sha + "/data/" + path, { cf: { cacheTtl: 86400, cacheEverything: true } }); } catch (e) { r = null; } }
  if (!r || (!r.ok && r.status !== 404)) r = await fetch(RAW + "main/data/" + path);
  if (!r.ok) return new Response("Introuvable", { status: r.status === 404 ? 404 : 502, headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  var headers = Object.assign({ "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=10", "X-Kinou-Commit": sha || "main" }, CORS);
  if (ext === "pdf") headers["Content-Disposition"] = "attachment; filename=\"" + path.split("/").pop() + "\"";
  return new Response(r.body, { headers: headers });
}
