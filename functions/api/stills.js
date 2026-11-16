// GET /api/stills?link=<page Slate work | shots.re> : images (ou vidéo) d'une page Slate, pour l'admin (jamais mis en cache).
import { readStills } from "../../netlify/functions/slate.mjs";
import { answer } from "../_shared.js";

export function onRequest(context) {
  return answer(context.request, function () { return readStills(new URL(context.request.url).searchParams.get("link")); });
}
