// Lecture d'un bundle Slate : liste des showreels (#featured, #categorie…) puis, pour chaque
// showreel, la playlist du lecteur (attribut data-media) et les vignettes signées de la grille.
// Aucune dépendance : fetch natif de Node.

const ORIGIN = "https://kinou.slateapp.com";
const ALIASES = { MUSICVIDEO: "MUSIC VIDEO" };

function decode(s) {
  return s.replace(/&(#x?[0-9a-f]+|quot|amp|lt|gt|apos);/gi, function (m, e) {
    var k = e.toLowerCase();
    if (k === "quot") return '"'; if (k === "amp") return "&"; if (k === "lt") return "<"; if (k === "gt") return ">"; if (k === "apos") return "'";
    return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });
}
async function page(url) {
  var r = await fetch(url);
  if (!r.ok) throw new Error("Slate " + r.status + " " + url);
  return r.text();
}
function catName(title) {
  var t = title.split("#").pop().trim().toUpperCase();
  return ALIASES[t.replace(/\s+/g, "")] || t;
}
function names(m, k) {
  return (m[k] || []).map(function (x) { return String(x.value).trim(); }).filter(Boolean).join(", ");
}
function clip(m, img, cat) {
  var sub = [names(m, "director"), names(m, "production")].filter(Boolean).join("\n");
  var streams = Object.values(m.streams || {}).filter(function (s) { return s.file && s.file.remote_address; });
  streams.sort(function (a, b) { return b.stream_type.y_size - a.stream_type.y_size; });
  var sn = m.snippets && m.snippets.small && m.snippets.small.file;
  var c = { title: String(m.title).trim() };
  if (sub) c.sub = sub;
  if (sn) c.video = sn.remote_address;
  if (streams[0]) c.full = streams[0].file.remote_address;
  if (img) c.img = img;
  c.cat = cat;
  c.slate = m.id;
  return c;
}
function showreel(html) {
  var i = html.indexOf('data-media="');
  if (i < 0) throw new Error("playlist Slate introuvable");
  i += 12;
  var media = JSON.parse(decode(html.slice(i, html.indexOf('"', i))));
  var imgs = html.split('<div class="grid-item fadein').slice(1).map(function (it) {
    var m = it.match(/<img loading="lazy" src="([^"]+)"/);
    return m ? decode(m[1]) : null;
  });
  if (imgs.length !== media.length) throw new Error("grille et playlist Slate ne correspondent pas");
  return media.map(function (m, k) { return { m: m, img: imgs[k] }; });
}

// bundle : "https://kinou.slateapp.com/bundles/<uuid>" -> { categories, clips }
export async function readBundle(bundle) {
  var id = (bundle.match(/\/bundles\/([0-9a-f-]{36})/) || [])[1];
  if (!id) throw new Error("lien de bundle invalide");
  var root = await page(ORIGIN + "/bundles/" + id);
  var reels = [], re = new RegExp('href="/bundles/' + id + '/(\\d+)"[\\s\\S]*?<h2>([\\s\\S]*?)</h2>', "g"), m;
  while ((m = re.exec(root))) reels.push({ n: m[1], title: decode(m[2].trim()) });
  if (!reels.length) throw new Error("aucun showreel dans le bundle");
  var pages = await Promise.all(reels.map(function (r) { return page(ORIGIN + "/bundles/" + id + "/" + r.n).then(showreel); }));
  // L'ordre des onglets suit l'ordre des showreels dans le bundle (FEATURED compris).
  var categories = [], clips = [], byId = {}, featured = [];
  reels.forEach(function (r, k) {
    var cat = catName(r.title);
    if (categories.indexOf(cat) < 0) categories.push(cat);
    if (cat === "FEATURED") { featured = pages[k]; return; }
    // Un film peut figurer dans plusieurs catégories : une entrée par catégorie.
    pages[k].forEach(function (x) {
      if (clips.some(function (c) { return c.slate === x.m.id && c.cat === cat; })) return;
      var c = clip(x.m, x.img, cat);
      clips.push(c); if (!byId[x.m.id]) byId[x.m.id] = c;
    });
  });
  featured.forEach(function (x, k) {
    var c = byId[x.m.id];
    if (!c) clips.push(c = byId[x.m.id] = clip(x.m, x.img, ""));
    c.featured = true; c.featuredOrder = k + 1;
  });
  return { categories: categories, clips: clips };
}
