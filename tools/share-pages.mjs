// Pages d'aperçu des liens partagés (WhatsApp, iMessage, Slack…) : les robots qui fabriquent les aperçus ne lisent pas le JavaScript
// ni ce qui suit « # ». Pour chaque chef op (et spotlight, fiction, contact), un petit <slug>/index.html avec son nom et sa photo
// (balises Open Graph), qui renvoie aussitôt vers le site (../#<slug>) en JavaScript
// (pas de <meta refresh> : certains robots le suivraient et montreraient l'aperçu de l'accueil). Lancé par .github/workflows/share-pages.yml.
// Données lues dans le dépôt admin public. Sans dépendance npm (Node 20).
import fs from "fs";
var DATA = "https://raw.githubusercontent.com/Kinou-DoP/admin/main/data/";
var SITE = process.env.SITE_URL || "https://kinou-dop.github.io/site/";
var PAGES = { spotlight: "Spotlight", fiction: "Fiction", contact: "Contact" };
async function get(path) { var r = await fetch(DATA + path); if (!r.ok) throw new Error(r.status + " " + path); return r.json(); }
function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function page(slug, title, image, desc) {
  var url = SITE + slug + "/";
  return '<!doctype html>\n<!-- Page d\'aperçu de lien, fabriquée par tools/share-pages.mjs : ne pas modifier à la main. -->\n' +
    '<html lang="fr"><head><meta charset="utf-8">\n<title>' + esc(title) + ' — kinou</title>\n' +
    '<meta property="og:site_name" content="kinou">\n<meta property="og:type" content="website">\n' +
    '<meta property="og:title" content="' + esc(title) + '">\n' + (desc ? '<meta property="og:description" content="' + esc(desc) + '">\n' : "") +
    '<meta property="og:url" content="' + esc(url) + '">\n' +
    (image ? '<meta property="og:image" content="' + esc(image) + '">\n<meta name="twitter:card" content="summary_large_image">\n' : "") +
    '<link rel="canonical" href="' + esc(url) + '">\n' +
    '<script>location.replace("../" + location.search + "#' + slug + '");</script>\n</head><body></body></html>\n';
}
var index = await get("dps/index.json"), made = [];
for (var d of index.dps || []) {
  if (!/^[a-z0-9-]+$/.test(d.slug) || PAGES[d.slug]) continue;
  var fiche = null; try { fiche = await get("dps/" + d.slug + ".json"); } catch (e) {}
  var a = (fiche && fiche.about) || {}, img = "";
  // Photo : le portrait (onglet About) ; sinon la vignette du 1er film FEATURED.
  if (a.img) img = /^https?:/.test(a.img) ? a.img : DATA + "dps/" + a.img;
  else if (fiche && fiche.clips) { var c = fiche.clips.filter(function (x) { return x.featured; }).sort(function (x, y) { return (x.featuredOrder || 0) - (y.featuredOrder || 0); })[0] || fiche.clips[0]; if (c && c.img) img = c.img; }
  fs.mkdirSync(d.slug, { recursive: true });
  fs.writeFileSync(d.slug + "/index.html", page(d.slug, d.name, img, "Cinematographer · kinou"));
  made.push(d.slug);
}
for (var k in PAGES) { fs.mkdirSync(k, { recursive: true }); fs.writeFileSync(k + "/index.html", page(k, PAGES[k], "", "kinou")); made.push(k); }
// Pages d'un chef op retiré de la liste : supprimées (repérées par la mention du générateur).
for (var f of fs.readdirSync(".")) {
  if (made.indexOf(f) > -1 || !fs.existsSync(f + "/index.html")) continue;
  if (fs.readFileSync(f + "/index.html", "utf8").indexOf("fabriquée par tools/share-pages.mjs") > -1) fs.rmSync(f, { recursive: true });
}
console.log(made.length + " pages d'aperçu.");
