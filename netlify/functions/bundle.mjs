// GET /api/bundle/<uuid> : lecture d'un bundle Slate pour l'import dans l'admin (jamais mis en cache).
import { readBundle } from "./slate.mjs";
import { CORS } from "./config.mjs";

export default async function (req, context) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    var data = await readBundle(context.params.id);
    return Response.json(data, { headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502, headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  }
}

export const config = { path: "/api/bundle/:id" };
