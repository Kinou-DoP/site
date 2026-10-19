// GET /api/dp/<slug> : clips à jour lus sur le bundle Slate du DP (lien dans data/dps/<slug>.json).
// Réponse gardée 10 min en cache par le CDN de Netlify ; en cas d'erreur, le site garde sa copie.
import { readBundle } from "./slate.mjs";
import { DATA_BASE } from "./config.mjs";

export default async function (req, context) {
  var slug = context.params.slug;
  try {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("slug invalide");
    var r = await fetch(new URL(DATA_BASE + "dps/" + slug + ".json", req.url));
    if (!r.ok) throw new Error("fiche introuvable");
    var dp = await r.json();
    if (!dp.bundle) throw new Error("pas de bundle Slate pour ce DP");
    var data = await readBundle(dp.bundle);
    data.syncedAt = new Date().toISOString();
    return Response.json(data, { headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=600, stale-while-revalidate=86400",
      "Netlify-Cache-Tag": "dp-" + slug // permet à l'admin de vider le cache de ce DP (/api/refresh)
    } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export const config = { path: "/api/dp/:slug" };
