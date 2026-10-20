// GET /api/data/<chemin> : fichiers de données du site (fiches JSON, portraits, CV) lus dans le repo admin.
// Cache CDN 5 min (vidé à chaque publication de l'admin via /api/refresh) ; CV servis en téléchargement.
import { readData } from "./data-source.mjs";
import { CORS } from "./config.mjs";

var TYPES = { json: "application/json; charset=utf-8", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };

export default async function (req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  var path = decodeURIComponent(new URL(req.url).pathname.replace(/^\/api\/data\//, ""));
  var ext = (path.match(/\.([a-z0-9]+)$/i) || [])[1];
  if (!/^[\w.\/-]+$/.test(path) || path.indexOf("..") > -1 || !TYPES[(ext || "").toLowerCase()]) {
    return new Response("Introuvable", { status: 404, headers: CORS });
  }
  var r = await readData(path);
  if (!r.ok) return new Response("Introuvable", { status: r.status === 404 ? 404 : 502, headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  var headers = Object.assign({
    "Content-Type": TYPES[ext.toLowerCase()],
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=86400",
    "Netlify-Cache-Tag": "data"
  }, CORS);
  if (ext.toLowerCase() === "pdf") headers["Content-Disposition"] = "attachment; filename=\"" + path.split("/").pop() + "\"";
  return new Response(await r.arrayBuffer(), { headers: headers });
}

export const config = { path: "/api/data/*" };
