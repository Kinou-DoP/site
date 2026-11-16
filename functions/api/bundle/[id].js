// GET /api/bundle/<uuid | code shots.re> : lecture d'un bundle Slate pour l'import dans l'admin (jamais mis en cache).
import { readBundle } from "../../../netlify/functions/slate.mjs";
import { answer } from "../../_shared.js";

export function onRequest(context) {
  return answer(context.request, async function () {
    var id = String(context.params.id || "");
    // Lien court shots.re/<code> : on suit la redirection jusqu'au bundle.
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      if (!/^[A-Za-z0-9]{3,20}$/.test(id)) throw new Error("lien invalide");
      var r = await fetch("https://shots.re/" + id);
      id = (r.url.match(/\/bundles\/([0-9a-f-]{36})/) || [])[1];
      if (!id) throw new Error("ce lien shots.re ne mène pas à un bundle Slate");
    }
    var data = await readBundle(id);
    data.bundle = "https://kinou.slateapp.com/bundles/" + id;
    return data;
  });
}
