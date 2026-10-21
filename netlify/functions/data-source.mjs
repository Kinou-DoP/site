// Lecture des fichiers de données (repo Kinou-DoP/admin, dossier data/).
// Avec la clé GITHUB_DATA_TOKEN (lecture seule, réglages Netlify du site) : directement dans GitHub,
// donc une publication de l'admin est visible sans aucune mise en ligne.
// Sans clé : copie publiée sur kinou-admin.netlify.app (ancien fonctionnement).
import { ADMIN_REPO } from "./config.mjs";

const FALLBACK = "https://kinou-admin.netlify.app/data/";

export async function readData(path) {
  var token = process.env.GITHUB_DATA_TOKEN;
  if (token) {
    var url = "https://api.github.com/repos/" + ADMIN_REPO + "/contents/data/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=main";
    var r = await fetch(url, { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github.raw+json", "User-Agent": "kinou-site" } });
    if (r.ok || r.status === 404) { r.source = "github"; return r; }
  }
  var c = await fetch(FALLBACK + path);
  c.source = "copie";
  return c;
}
