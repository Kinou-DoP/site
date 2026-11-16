// GET /api/reel?link=<bande Slate | shots.re> : les 10 premiers films d'une bande, pour l'accueil (admin, jamais mis en cache).
import { readReel } from "../../netlify/functions/slate.mjs";
import { answer } from "../_shared.js";

export function onRequest(context) {
  return answer(context.request, function () { return readReel(new URL(context.request.url).searchParams.get("link"), 10); });
}
