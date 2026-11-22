// GET /api/media?u=<vidéo sur le CloudFront de Slate>[&dl=<nom du fichier>] (Gus 22/11)
// - sans dl : la vidéo relue avec l'autorisation CORS, pour que l'admin puisse en capturer une image (vignette d'une bande) ;
// - avec dl : téléchargement direct (Content-Disposition: attachment) depuis la page d'une bande, sans ouvrir d'onglet.
// Seules les vidéos de notre CloudFront Slate sont acceptées (pas un relais ouvert). Les demandes partielles (Range) sont transmises.
const OK = /^https:\/\/d1ko11x0ybxl0h\.cloudfront\.net\/kinou\/production\/[\w\/.%-]+\.(mp4|mov|m4v)$/i;
// Extraits importés dans la bibliothèque de l'admin (mp4 déposés dans le dépôt admin) : raw.githubusercontent les sert sans le bon
// type de fichier ; relus ici en video/mp4 pour que tous les navigateurs les jouent.
const OWN = /^https:\/\/raw\.githubusercontent\.com\/Kinou-DoP\/admin\/main\/data\/bibli\/vid\/[\w-]+\.mp4$/;
export async function onRequest({ request }) {
  const q = new URL(request.url).searchParams, u = q.get("u") || "", dl = q.get("dl");
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Range", "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!OK.test(u) && !OWN.test(u)) return new Response("adresse refusée", { status: 400, headers: cors });
  const h = {}, range = request.headers.get("Range");
  if (range) h.Range = range;
  const r = await fetch(u, { headers: h, method: request.method === "HEAD" ? "HEAD" : "GET" });
  const out = new Headers(cors);
  ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"].forEach(function (k) { const v = r.headers.get(k); if (v) out.set(k, v); });
  out.set("Cache-Control", "public, max-age=86400");
  if (OWN.test(u)) out.set("Content-Type", "video/mp4");
  if (dl) {
    const name = String(dl).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "video";
    const file = /\.\w{2,4}$/.test(name) ? name : name + ".mp4";
    out.set("Content-Disposition", "attachment; filename=\"" + file.replace(/[^\x20-\x7e]/g, "_") + "\"; filename*=UTF-8''" + encodeURIComponent(file));
  }
  return new Response(r.body, { status: r.status, headers: out });
}
