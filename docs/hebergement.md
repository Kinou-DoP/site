# Hébergement, vidéos, images, fonctions Cloudflare (site)

Note de tâche : à lire seulement quand la tâche touche ce sujet. Règles générales : `CLAUDE.md`.

- On travaille sur **`beta`** (dans une nouvelle session : `git checkout beta` avant tout). `main` = production kinou.fr : **jamais
  de fusion `beta` → `main` sans validation explicite de Gus**.
- La beta est en ligne ~1 min après un push sur **GitHub Pages** (https://kinou-dop.github.io/site/) et sur **Cloudflare Pages**
  (https://kinou-4tv.pages.dev/, projet « kinou » de Gus, branche de production `beta`, sans construction).
- **Netlify est bloqué** (crédits épuisés depuis le 21/10/2026, fonctions en 503 depuis le 30/10) : `netlify/functions/` n'est plus
  en ligne ; `netlify/functions/slate.mjs` reste la **bibliothèque de lecture de Slate** utilisée par les fonctions Cloudflare.
- **Fonctions Cloudflare** (`functions/`) : `/api/data/<chemin>` (fichier du dernier commit de `main` de l'admin, visible en ~10 s),
  `/api/bundle/<id>`, `/api/stills`, `/api/reel` (lecture de Slate pour l'admin), `/api/refresh/<slug>` (vérifie la clé, rien à vider).
  Gratuit : 100 000 appels / jour, 10 ms de calcul par appel (un gros bundle peut échouer : l'admin passe alors par son robot).
- Le site lit ses JSON par `/api/data` sur `*.pages.dev` (`JSON_BASE`, `ON_CF`), sinon sur raw.githubusercontent.com (`DATA_BASE`,
  cache 5 min). Images et CV : toujours sur raw.
- **Slate** héberge les vidéos (CloudFront `d1ko11x0ybxl0h`) et les images (`images.slatecdn.net`, URLs signées). Depuis le 17/11
  Slate refuse les demandes sans User-Agent (`UA` dans `slate.mjs`). Si `images.slatecdn.net` tombe, `slateRaw` / `loadImg` chargent
  l'original sur S3 (adresse en base64 dans l'URL signée). Étude en cours pour remplacer Slate : dépôt notes.
- **À faire pour la mise en production** : brancher kinou.fr sur Cloudflare (DNS chez OVH), vignettes réduites (`IMG_CDN` / `thumb()`
  vers le redimensionnement de Cloudflare), `SITE_URL` de `tools/share-pages.mjs`, mentions légales (hébergeur), puis validation
  de Gus et fusion dans `main`.
- **Vidéos depuis Amazon** (25/11) : tous les fichiers de Slate sont copiés sur notre CloudFront `d3toxii6rvamjf.cloudfront.net`
  (même chemin que `d1ko11x0ybxl0h`). `app.js` et `b/index.html` (et l'admin) changent l'adresse au moment de jouer (setter `src`
  des `<video>`), repli automatique sur Slate si le fichier manque. Les données gardent l'adresse Slate.
- **Vignettes chez nous** (26/11) : le robot « Vignettes réduites » de l'admin (`tools/vignettes.mjs`) fait de chaque image copiée de
  Slate une version WebP de 800 et de 1600 px (`thumbs/<chemin>-<largeur>.webp` sur notre CloudFront) ; `thumb()` retrouve le chemin
  dans l'adresse signée de Slate (`slateRaw`, `ourThumb`) et prend la nôtre ; absente : celle de Slate (`ORIG`, `loadImg`), puis S3.
- **Envoi des vidéos depuis l'admin** (`functions/api/depot.js`, 26/11) : signe les adresses d'envoi en morceaux (S3 multipart :
  `start`, `parts`, `list`, `complete`) vers `kinou-videos/depot/` ; clé Amazon de dépôt seulement (`DEPOT_KEY_ID` / `DEPOT_KEY_SECRET`,
  secrets Cloudflare rangés par Gus) ; réservé aux clés GitHub qui peuvent écrire dans admin. Le robot d'encodage de l'admin range
  ses fichiers sous `nous/<id>/` (version web, vignettes, extraits 720p) ; `/api/media` les accepte ; bandes : extrait léger `snip.v`.
- **Extraits préchargés en fond** (`precharger`, 25/11) : chaque onglet (chef op, spotlight, fiction) télécharge tous ses extraits dans
  l'ordre, 2 à la fois, en priorité basse (`fetch` no-cors → cache du navigateur) ; liste des chefs op : extraits des 3 noms au-dessus et
  en dessous du nom survolé ; accueil : les 2 projets suivants. Rien si « économiseur de données ».
- À chaque modification de `main.css` ou `app.js` : mettre à jour le numéro `?v=` dans `index.html` (date-heure), sinon les
  navigateurs gardent l'ancienne version. Tester en local : `python3 -m http.server` puis http://localhost:8000 (pas en `file://`),
  dans un navigateur, sur ordinateur **et** téléphone (Playwright est installé).
- **Images du video club chez Amazon** (Gus 25/11) : stills, vignettes importées ou capturées, suites d'images partent de l'admin
  directement dans `kinou-videos/depot/<dossier>/<nom>.webp` (`/api/depot` op `img` : adresse d'envoi signée, 15 min ; WebP, cache 1 an),
  servies par notre CloudFront. Les anciennes (`data/bibli/img/` du dépôt admin) sont copiées sous `nous/bibli-img/` par le robot
  « Images du video club » (admin, `main`) ; `app.js` (`ourImg`, `thumb`) et `b/index.html` prennent la copie, GitHub en secours (site).
- **Lecteur ouvert** : préchargements d'extraits arrêtés (repris à la fermeture) ; images en priorité haute (`fetchPriority`), devant
  les vidéos qui passent par le même CloudFront.

