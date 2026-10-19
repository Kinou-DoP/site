// POST /api/refresh/<slug> : vide le cache des clips d'un DP pour relire Slate tout de suite.
// Réservé aux personnes ayant le droit d'écrire dans le repo admin (token GitHub dans Authorization).
import { ADMIN_REPO, CORS } from "./config.mjs";

function reply(status, body) {
  return Response.json(body, { status: status, headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
}

export default async function (req, context) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "POST attendu" });
  var slug = context.params.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) return reply(400, { error: "slug invalide" });
  var auth = req.headers.get("authorization") || "";
  var gh = await fetch("https://api.github.com/repos/" + ADMIN_REPO, { headers: { Authorization: auth, "User-Agent": "kinou-site" } });
  var repo = gh.ok ? await gh.json() : null;
  if (!repo || !repo.permissions || !repo.permissions.push) return reply(403, { error: "token GitHub refusé" });
  var token = process.env.NETLIFY_PURGE_API_TOKEN;
  if (!token) return reply(500, { error: "purge du cache indisponible (NETLIFY_PURGE_API_TOKEN absent)" });
  var r = await fetch("https://api.netlify.com/api/v1/purge", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ site_id: context.site.id, cache_tags: ["dp-" + slug] })
  });
  if (!r.ok) return reply(502, { error: "purge refusée par Netlify (" + r.status + ")" });
  return reply(200, { ok: true });
}

export const config = { path: "/api/refresh/:slug" };
