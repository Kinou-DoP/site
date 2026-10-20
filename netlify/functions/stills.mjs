// GET /api/stills?link=<page Slate work | shots.re> : images d'une galerie de stills, pour l'import dans l'admin (jamais mis en cache).
import { readStills } from "./slate.mjs";
import { CORS } from "./config.mjs";

export default async function (req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    var data = await readStills(new URL(req.url).searchParams.get("link"));
    return Response.json(data, { headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502, headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  }
}

export const config = { path: "/api/stills" };
