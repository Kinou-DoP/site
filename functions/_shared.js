// Fonctions Cloudflare Pages du site (dossier functions/, essai depuis le 16/11/2026) : remplacent les fonctions Netlify
// (netlify/functions/, coupées depuis le 30/10). La lecture de Slate est celle de netlify/functions/slate.mjs (un seul exemplaire).
export const ADMIN_REPO = "Kinou-DoP/admin";
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
export function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, CORS) });
}
export function preflight(request) { return request.method === "OPTIONS" ? new Response(null, { headers: CORS }) : null; }
// Pour l'admin : réponse JSON, 502 + { error } en cas d'échec (l'admin affiche l'erreur au lieu de passer par le robot GitHub).
export async function answer(request, work) {
  var p = preflight(request); if (p) return p;
  try { return json(await work()); } catch (e) { return json({ error: String((e && e.message) || e) }, 502); }
}
