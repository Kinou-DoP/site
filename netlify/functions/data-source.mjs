// Lecture des fichiers de données (repo Kinou-DoP/admin, dossier data/).
// Avec la clé GITHUB_DATA_TOKEN (lecture seule, réglages Netlify du site) : directement dans GitHub,
// donc une publication de l'admin est visible sans aucune mise en ligne.
// Sans clé (ou en cas d'échec) : le même fichier, lu sans clé dans le dépôt admin (public), branche main.
import { ADMIN_REPO } from "./config.mjs";

const FALLBACK = "https://raw.githubusercontent.com/" + ADMIN_REPO + "/main/data/";

export async function readData(path) {
  var token = process.env.GITHUB_DATA_TOKEN;
  if (token) {
    var url = "https://api.github.com/repos/" + ADMIN_REPO + "/contents/data/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=main";
    var r = await fetch(url, { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github.raw+json", "User-Agent": "kinou-site" } });
    if (r.ok) { r.source = "github"; return r; }
    // 404 : fichier absent… ou clé qui ne voit plus le repo (ex. repo déplacé) : on tente la copie de secours.
    if (r.status === 404) {
      var f = await fetch(FALLBACK + path);
      if (f.ok) { f.source = "copie"; return f; }
      r.source = "github"; return r;
    }
  }
  var c = await fetch(FALLBACK + path);
  c.source = "copie";
  return c;
}
