// GET /api/bundle/<uuid | code shots.re> : lecture d'un bundle Slate pour l'import dans l'admin (jamais mis en cache).
import { readBundle } from "./slate.mjs";
import { CORS } from "./config.mjs";

export default async function (req, context) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    var id = context.params.id;
    // Lien court shots.re/<code> : on suit la redirection jusqu'au bundle.
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      if (!/^[A-Za-z0-9]{3,20}$/.test(id)) throw new Error("lien invalide");
      var r = await fetch("https://shots.re/" + id);
      id = (r.url.match(/\/bundles\/([0-9a-f-]{36})/) || [])[1];
      if (!id) throw new Error("ce lien shots.re ne mène pas à un bundle Slate");
    }
    var data = await readBundle(id);
    data.bundle = "https://kinou.slateapp.com/bundles/" + id;
    return Response.json(data, { headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502, headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
  }
}

export const config = { path: "/api/bundle/:id" };
