// POST /api/refresh/<slug> : sur Cloudflare, rien à vider (/api/data lit toujours le dernier commit) ; gardé pour l'admin,
// qui l'appelle après chaque publication. Réservé aux personnes qui peuvent écrire dans le dépôt admin (clé GitHub).
import { ADMIN_REPO, json, preflight } from "../../_shared.js";

export async function onRequest(context) {
  var p = preflight(context.request); if (p) return p;
  if (context.request.method !== "POST") return json({ error: "POST attendu" }, 405);
  var gh = await fetch("https://api.github.com/repos/" + ADMIN_REPO, { headers: { Authorization: context.request.headers.get("authorization") || "", "User-Agent": "kinou-site" } });
  var repo = gh.ok ? await gh.json() : null;
  if (!repo || !repo.permissions || !repo.permissions.push) return json({ error: "token GitHub refusé" }, 403);
  return json({ ok: true });
}
