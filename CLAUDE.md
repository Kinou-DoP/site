# CLAUDE.md — site kinou.fr

Site de kinou, agence parisienne de chefs opérateurs (~70 chefs op). HTML / CSS / JS vanilla, **aucune dépendance**, données JSON
lues dans le dépôt `Kinou-DoP/admin`. On parle à Gus en français, en le tutoyant, simplement (il n'est pas développeur).

**À lire aussi** : `ARCHITECTURE.md` (carte du code et des trois dépôts, pour un développeur) ; `HISTORIQUE.md` (pourquoi les choses
sont comme ça : demandes de Gus datées, essais, retours en arrière ; à consulter avant de changer un comportement) ; dans le dépôt
privé `notes` : `FEUILLE-DE-ROUTE.md` (projets, décisions, priorités) et `etudes/remplacer-slate.md` (hébergement des vidéos).
**À chaque changement** : mettre à jour ce fichier (le fonctionnement, sans historique), ajouter une ligne datée en bas de
`HISTORIQUE.md`, et `ARCHITECTURE.md` si la structure change.

## Hébergement, branches, mise en ligne
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
- À chaque modification de `main.css` ou `app.js` : mettre à jour le numéro `?v=` dans `index.html` (date-heure), sinon les
  navigateurs gardent l'ancienne version. Tester en local : `python3 -m http.server` puis http://localhost:8000 (pas en `file://`),
  dans un navigateur, sur ordinateur **et** téléphone (Playwright est installé).

## Données (dépôt admin, `data/` sur `main`, modifiées par l'admin, jamais à la main ici)
- `dps/index.json` : `{ dps: [{ slug, name, img?, hidden?, gender? }] }` (ordre de la liste ; `hidden` = page cachée : absente de la
  liste, adresse sans effet, nom sans lien ; `gender` sert seulement à l'admin).
- `dps/<slug>.json` : `{ slug, name, hue, categories, clips, bundle?, open?, overrides?, showcase?, about, template? }`.
  Clip : `{ title, sub ("Réal\nProd[\nco-DoP Nom]"), video (extrait 10 s sans son), full (film complet 1080p), img (vignette signée),
  cat, featured, featuredOrder, slate (id Slate), stills? }`. Un même film peut être dans plusieurs catégories (une entrée chacune).
- `overrides[<id Slate>]` (corrections de l'admin, appliquées par-dessus le clip, toutes les clés sont copiées) : `title`, `sub`,
  `hidden`, `zoom` / `zoomPos` / `zoomThumb` (recadrage de l'extrait, jamais dans le lecteur), `phoneX` (cadrage téléphone),
  `extras` (sous le film dans le lecteur : `[{ link, title, stills }]` ou `[{ link, title, full, video, img, cols?: { d, m } }]`),
  `stills` + `stillsLink` (ancien format), `images` + `ratios` (projet en images seulement, écrits par le robot de l'admin),
  `types` (types de contenu Slate, robot), `hover` (`{ link, title, video, img? }` : extrait au survol d'un projet en images),
  `info` (`{ year, episodes, runtime, ratio, platforms, camera, lenses, starring, awards, synopsis, synopsisEn }` ; `awardsFrom`,
  `awardsHidden`, `auto`, `autoSrc` ne servent qu'à l'admin).
- `about` : `{ bio, bioEn, cv, instagram, website, links: [{ label, url }], img, pos, zoom, color, og }` (portrait en noir et blanc
  sauf `color`).
- `home.json` : `{ duration, reel, overrides, slides: [{ slate, film, song, legend, video, full, img, dps: [{ name, slug }], start?,
  phoneX?, zoom?, zoomPos?, extras? }] }` (`start` + `full` = « extrait HD » : le film complet lu de `start` pendant `duration`).
- `spotlight.json` : `{ reel, categories, overrides, films, readAt }` ; `fiction.json` : `{ reel, overrides, films, readAt }` avec, par
  film, `status` (new | soon | past), `genre`, `date`, `platforms`, `poster`, `thumbCrop` / `snipCrop` (cadrage cinémascope).
  `films` (`slate, title, sub, video, full, img, cats, artists, images?, ratios?`) écrits par le robot de l'admin.
- `contact.json` : `{ team, address, newsletter, newsletterLabel, social, legal }` ; `site.json` : `{ logo, logoHeight }`.
- `bandes/<code>.json` : bandes envoyées aux producteurs (voir plus bas).
- Convention des bundles Slate d'un chef op : un showreel `#featured` (ordre du FEATURED) puis un showreel par catégorie (`#music video`
  → onglet MUSIC VIDEO) ; ordre des showreels = ordre des onglets. Plusieurs chefs op sur un film : page de celui qui a le plus de
  films, les autres en « co-DoP Nom ».

## Pages et comportements
- **Adresses** : `<racine>/<slug>/[<catégorie>][/feed]`, `spotlight/…`, `fiction/…`, `contact/`, film ouvert = `<slug>/<onglet>/<titre>`
  (`pageURL`, `filmURL`, `route`). Les dossiers `<slug>/index.html` sont des **pages d'aperçu de lien** (Open Graph) fabriquées par
  `tools/share-pages.mjs` (workflow `share-pages.yml` à chaque push sur `beta`) et par l'admin (`sharePage`, contenu identique) :
  ne pas les modifier à la main. `404.html` renvoie les autres adresses vers `<racine>/#<chemin>`.
- **Accueil** : slideshow des 10 films de la bande de l'accueil (arrivée sur un film au hasard), un lien par chef op crédité ; clic =
  le film **complet avec le son** dans le lecteur (infos, prix, stills repris de la fiche / fiction / spotlight du même film).
- **Liste des chefs op** : nom survolé en blanc gras + extrait du 1er film FEATURED en fond ; téléphone en portrait : **roulette**.
- **Page d'un chef op** : nom qui glisse depuis la liste, onglets en cascade, grille 3 colonnes 16:9 ou colonne (`/feed`) ; survol =
  extrait + fond flouté ; sur ordinateur le 1er film est déjà « survolé » à l'arrivée. Téléphone : toujours en colonne, le film au
  repère joue, perspective « roulette », onglets qui défilent en boucle s'ils dépassent. Onglet ABOUT (bio FR / EN, portrait).
  Onglet en **présentation vidéo + stills** si la fiche le demande (`showcase`, `renderShow`). Onglet de **photos** (tous les projets
  en images seulement) : colonnes à la forme de chaque photo (`renderPhotos`).
- **Lecteur** (`openPlayer`) : verre dépoli, film complet, titre et crédits, types (Narrative : types Slate), **infos du film**
  (`fillInfo` : année | épisodes · durée | format | plateformes, STARRING, CAMERA / LENSES, synopsis FR / EN) et **prix** groupés
  par festival (ordinateur : à droite, remontés à la hauteur des crédits ; téléphone / tablette : une colonne), puis `extras` (galeries,
  vidéos en 1 à 3 colonnes). Flèches ‹ › en bas, clavier, Échap ; le bouton retour du téléphone ferme d'abord le lecteur.
- **Spotlight** : page de films de plusieurs chefs op, onglet ALL puis catégories (types de contenu Slate), « DoP Nom » cliquable,
  extraits toujours en boucle. **Fiction** : NEW RELEASES (9 au plus, les plus anciens passent seuls en PAST), COMING SOON (passe seul
  en New release le jour de la sortie dès 9 h, heure de Paris), PAST RELEASES + genres, onglets FEATURE FILMS / SHORT FILMS
  (seulement par adresse) ; vignettes en cinémascope 2,39 (fin de `main.css`), affiche à
  gauche du film dans le lecteur.
- **Contact** : présentation « générique de fin », mentions légales dépliables, fond = film de l'accueil.
- **Bandes envoyées aux producteurs** (`b/index.html`, page indépendante, `noindex`) : adresse **`b/<code>`** (réécrite par `_redirects`
  sur Cloudflare ; `404.html` renvoie vers `b/?<code>` sur GitHub Pages). Lit `data/b/<empreinte>.json` **chiffré** (même calcul que
  `bandSeal` de l'admin : PBKDF2-SHA256 du code → nom du fichier + clé AES-GCM ; mot de passe → clé tirée de code + mot de passe, un
  mauvais mot de passe ne déchiffre rien) ; anciennes bandes en clair `data/bandes/<code>.json`. Mise en page des pages de chef op :
  nom(s) en grand à droite (liens vers leur page), sections à gauche, grille 1 à 3 colonnes, voile lumineux et fond flouté au survol,
  recadrage `crop`, extrait choisi `snip` (film complet à partir de `s`), lecteur avec crédits (cachables), types, prix (`awards`),
  stills / vidéos dessous (`extras`), « See more projects ». Téléchargement si permis : direct par `/api/media?u=…&dl=<titre>` (sans
  ouvrir d'onglet) + « Download all ». Expiration : message « plus disponible ».
- **`/api/media?u=<vidéo CloudFront Slate>[&dl=nom]`** (`functions/api/media.js`) : relais limité à notre CloudFront Slate, avec CORS
  (capture d'une image pour les vignettes des bandes dans l'admin) ou en téléchargement direct.
- **Version live** (`live/` → `?live`) : vignettes qui jouent leur extrait en boucle ; toujours le cas sur téléphone (`liveOn`).

## Règles visuelles — à respecter absolument
1. Pas de framework CSS ; tokens globaux en variables `--kinou-*` (`--kinou-bg`, `--kinou-fg`, `--kinou-body`, `--kinou-sans`,
   `--kinou-hero-top`, `--kinou-hero-h`, `--kinou-tabs-top`, `--kinou-zm`) ; variables posées par app.js en nom court (`--h`, `--img`…).
2. Fond noir pur `#000`, texte blanc cassé `#FFFCEB`, textes secondaires en `rgba(255,252,235,…)`.
3. **Satoshi** (Fontshare) partout : 300 pour la liste des chefs op, titres 600 (rendu 700) serrés, étiquettes 11–13px majuscules
   `letter-spacing: .14em`.
4. Grille 3 colonnes 16:9 (gap 6px, 4px sur téléphone) ; feed en 1 colonne.
5. Lecteur plein écran sur verre dépoli (flou 36px, voile noir 62 %), image agrandie sur noir 98 % ; fermeture Échap / croix / clic à côté.
6. Animations existantes seulement (arrivée des films en grandissant 94 % → 100 %, révélation circulaire, morphing du nom avec léger
   flou, onglets en cascade, voile lumineux blanc 10 % au survol) : **ne pas en ajouter sans demande**.
7. En-tête : logo au centre ; à gauche Instagram, spotlight, fiction, press, contact ; à droite cinematographers ; téléphone (≤ 700px) :
   burger à gauche, logo réduit, « DOP » à droite ; nom du chef op **centré** sur téléphone.
8. Catégorie du film en gris (onglet FEATURED ; Narrative suivie des types Slate) ; jamais « Stills », « Fiction », « Trailer »,
   « Bande-annonce ».
9. Recadrage `zoom` seulement sur l'extrait (et la vignette si `zoomThumb`), jamais dans le lecteur.
10. Fonds : page d'un chef op = film survolé très flouté et assombri, ombre noire sous chaque vignette, coupe nette sous le nom
    (fondu de 4px sur ordinateur) ; portrait About en noir et blanc sauf `about.color`.
11. Dans `main.css`, la règle `#home {` reste ouverte et contient les règles suivantes (CSS imbriqué) jusqu'à une `}` isolée : ne pas
    « corriger ».

## Règles de code
- Lire les fichiers avant de modifier ; ne pas réécrire ce qui marche (sauf bug) ; pas de librairie externe sans accord ;
  ne pas changer le design sans demande ; ne pas renommer les globales `WORK`, `CATS_BY`, `PROJECTS`, `ABOUT`.
- Ne jamais inventer d'URL Slate / CloudFront ; les URLs d'images Slate sont **signées** : les copier telles quelles.
- Les adresses (slugs) ne se changent que dans l'admin.
- Commits en français (« Ajout Prénom Nom », « Fix … ») ; jamais de clé ni de secret (dépôt public) ; pas de pull request sans demande.
