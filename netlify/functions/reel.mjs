// GET /api/reel?link=<bande Slate | shots.re> : les 10 premiers films d'une bande, pour l'accueil (import admin, jamais mis en cache).
import { readReel } from "./slate.mjs";
import { CORS } from "./config.mjs";

export default async function (req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    var data = await readReel(new URL(req.url).searchParams.get("link"), 10);
    return Response.json(data, { headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502, headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  }
}

export const config = { path: "/api/reel" };
