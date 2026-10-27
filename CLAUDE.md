# CLAUDE.md — kinou.fr

## Contexte du projet

kinou.fr est le site d'une agence de cinématographes parisienne.
Environ 70 directeurs de la photographie (DPs) référencés.
Stack : HTML/CSS/JS vanilla, zéro framework, données JSON statiques.
Hébergement : Netlify (déploiement automatique sur push GitHub).
Repo : github.com/Kinou-DoP/site

La référence visuelle de départ est le prototype `reference/prototype.html`. Depuis, Gus a demandé
des évolutions (police Satoshi, blanc cassé, en-tête, fonds et survols) : elles sont décrites dans
les règles visuelles ci-dessous et priment sur le prototype.

## ⚠️ Hébergement actuel : GitHub Pages seulement (Netlify bloqué)

Depuis le 21/10/2026 vers 14 h 30, **les crédits Netlify sont épuisés** : plus aucune mise en ligne Netlify n'est
possible. On travaille **uniquement sur GitHub** :
- Site (beta) : **GitHub Pages** https://kinou-dop.github.io/site/ (branche `beta`) — en ligne ~1 min après un push.
- Admin : GitHub Pages https://kinou-dop.github.io/admin/ (branche `beta` du repo admin).
- Données : `data/` de la branche `main` du repo admin, lues par le site via `https://beta--kinou-test.netlify.app/api/data/`.
- Les **fonctions Netlify** (`/api/data`, `/api/dp`, `/api/bundle`, `/api/stills`, `/api/reel`, `/api/refresh`) répondent
  toujours sur `beta--kinou-test.netlify.app`, mais **figées dans leur version du 21/10** (avant le commit 37b726a) :
  toute modification de `netlify/functions/` poussée depuis **n'est pas en ligne**. Le site et l'admin les appellent quand même.
- Donc : ne pas compter sur un changement de `netlify/functions/` pour une fonctionnalité ; passer par le site (app.js),
  l'admin, ou le robot GitHub de l'admin (Actions, gratuit : `tools/fill-home.mjs`, lit Slate directement).
  Slate n'autorise pas la lecture depuis le navigateur (pas de CORS) : l'admin ne peut pas lire Slate lui-même.

Contournements en place (à retirer ou simplifier au retour sur Netlify) :
- Vidéo ajoutée sous un film (`extras`) : `/api/stills` figé ne lit que les images ; l'admin lit alors la page comme une
  bande (`/api/reel`, 1er film : titre, extrait, vignette, **sans `full`**). Le robot GitHub de l'admin ajoute le `full`
  après chaque publication (fiches et accueil). Sans `full`, le site joue l'extrait.
- Film complet des slides de l'accueil : ajouté par le même robot (`/api/reel` figé ne renvoie pas `full`).
- Projet en images seulement (type « illustration » sur Slate) : `/api/dp` figé ne renvoie pas ses images ; le robot GitHub
  de l'admin les lit sur le bundle et les écrit dans `overrides[<id>].images` de la fiche (à chaque publication de la fiche ;
  toutes les fiches au lancement manuel). Le site les affiche en galerie directe (`p.images`, comme `stills`).
- Vignettes : le service d'images Netlify (`/.netlify/images`, `thumb()` dans app.js, `IMG_CDN`) n'est utilisé que sur
  `*.netlify.app` / `kinou.fr` : sur GitHub Pages, les vignettes sont les images Slate d'origine (non réduites).

### À faire au retour sur Netlify (crédits rechargés ou plan payant)
1. Relier Netlify au dépôt **`Kinou-DoP/site`** (le dépôt a été déplacé depuis `kinou-agency/site` : GitHub répond
   « This repository moved » à chaque push ; installer l'appli Netlify sur l'organisation Kinou-DoP si besoin).
2. Remettre en ligne la **beta** (`beta--kinou-test.netlify.app`, branch deploy de `beta`) : les fonctions reprennent alors
   le code du repo — `/api/stills` lit aussi les vidéos (`full`), `/api/dp` les images des projets « illustration »
   (`stills`), `/api/reel` le `full`. Vérifier : `/api/stills?link=https://shots.re/19c405` doit renvoyer `full`.
3. **Compression des vignettes** : servir le site depuis Netlify (ou étendre `IMG_CDN` à l'adresse utilisée) pour que
   `thumb()` passe par `/.netlify/images` (WebP réduit) ; l'admin « chauffe » déjà ces vignettes (`warmThumbs`).
4. Décider où vit le site : GitHub Pages (actuel) ou Netlify ; mettre à jour `DATA_BASE`, `IMG_CDN` (app.js) et `SITE`
   (admin.js) en conséquence ; le contournement `/api/reel` de l'admin (`importStills`) peut rester (sans effet).
5. **Photos (catégorie de photos, projets en images)** : rien d'obligatoire. Le robot GitHub tourne indépendamment de Netlify
   et continue d'écrire `overrides[<id>].images` + `ratios` ; le site les préfère (`photosOf`) aux `stills` que `/api/dp`
   renverra à nouveau. Option (pour ne plus dépendre du robot) : faire calculer les proportions par `readBundle`
   (`slate.mjs`, même lecture des 64 premiers Ko que `ratiosOf` dans `admin/tools/fill-home.mjs`) → `ratios` sur le clip,
   et faire préférer `stills` + `ratios` du bundle (toujours à jour) aux `images` du robot. Sans `ratios`, le site mesure
   les photos lui-même avant de les placer (≤ 4 s, toutes les photos de l'onglet chargées d'un coup) : ça marche, en plus lent.
6. **Mentions légales** (admin → contact → « Mentions légales », `legal` de `data/contact.json`) : vérifier qu'elles sont à jour,
   surtout la rubrique « Hébergement » (aujourd'hui GitHub, Inc. / GitHub Pages) → mettre Netlify, Inc. si le site y est servi
   (et kinou.fr), et la rubrique « Cookies » si on ajoute une mesure d'audience.
7. Puis seulement, après validation de Gus : fusion `beta` → `main` (production kinou.fr, ≈ 15 crédits par mise en ligne).

## Architecture des données

Les données vivent dans le repo `Kinou-DoP/admin` (dossier `data/`). Le site officiel **et** la beta
les chargent via `/api/data/<chemin>` (`netlify/functions/data.mjs`), qui les lit **directement dans GitHub**
avec la clé en lecture seule `GITHUB_DATA_TOKEN` (variable d'environnement Netlify du site), cache CDN 5 min
vidé à chaque publication (`/api/refresh`). Sans cette clé (ou si GitHub refuse) : le même fichier lu sans clé
(dépôt admin public, `raw.githubusercontent.com/Kinou-DoP/admin/main/data/`).
Les tokens GitHub (organisation Kinou-DoP) sont créés sans expiration.
Ainsi une publication de l'admin ne déclenche **aucune mise en ligne Netlify** (économie de crédits).
On les modifie avec l'interface d'admin (https://kinou-dop.github.io/admin/, GitHub Pages), pas dans ce repo.

```
data/
├── home.json              # slideshow de l'accueil (PROJECTS) + durée ; importé d'une bande Slate dans l'admin
├── site.json              # réglages (logo image : { logo: "brand/logo.png", logoHeight: 36 }) ; le site réduit le logo
│                          # (8 × la hauteur affichée) et le garde dans le navigateur (localStorage « kinou-logo »)
└── dps/
    ├── index.json         # liste ordonnée des DPs : [{ slug, name, img? }]
    ├── <slug>.json        # une fiche par DP (clips + about)
    └── img/               # portraits ABOUT
```

Chaque DP a :
- Un slug unique (adresse de la page, comme sur kinou.fr) : `prenom-nom-cinematographer` (ex. `lara-perrotte-boucard-cinematographer`)
- Une liste de clips avec catégories (chargée dans `WORK[slug]`)
- Un ordre d'affichage des catégories (chargé dans `CATS_BY[slug]`)

Fiche d'un DP (`data/dps/<slug>.json`) :
```json
{
  "slug": "lara-perrotte-boucard-cinematographer",
  "name": "Lara Perrotte Boucard",
  "hue": 210,
  "categories": ["FEATURED", "MUSIC VIDEO", "FASHION"],
  "clips": [
    {
      "title": "Titre du projet",
      "sub": "Réalisateur\nProduction",
      "video": "https://d1ko11x0ybxl0h.cloudfront.net/kinou/production/clips/{id}/{uuid}.mp4",
      "full": "https://d1ko11x0ybxl0h.cloudfront.net/kinou/production/clips/{uuid}-0x1080.5000.mp4",
      "img": "https://images.slatecdn.net/{path}",
      "cat": "MUSIC VIDEO",
      "featured": true,
      "featuredOrder": 1,
      "open": true,
      "stills": ["url1", "url2"],
      "slate": 10716
    }
  ],
  "about": { "bio": ["…"], "bioEn": ["…"], "cv": "", "instagram": "", "website": "", "img": "img/<slug>.webp", "pos": "center 30%", "shade": "…" }
}
```
- `video` : extrait d'aperçu Slate (10 s, sans son) — slideshow et survol des vignettes.
- `full` : film complet Slate (1080p, avec son) — joué dans le lecteur. Sans `full`, le lecteur joue `video`.
- `slate` : identifiant du clip dans Slate (traçabilité).
- `hue` : teinte de base (0–360) des fonds de remplacement ; la teinte de chaque clip vaut `(index * 47 + hue) % 360` (ou `h` si fourni sur le clip).
- `featured` / `featuredOrder` : clip du showreel FEATURED et son rang.
- `open` : clip présélectionné quand on arrive sur la page depuis l'accueil.
- `stills` : galerie de stills (optionnelle), affichée sous le film dans le lecteur (3 colonnes, 2 sur téléphone), agrandie au clic.
  Projet en images seulement (type « illustration » sur Slate, sans vidéo) : ses images deviennent `stills` à la lecture du bundle
  (pas encore en ligne : fonctions Netlify figées ; en attendant, le robot de l'admin les met dans `overrides[<id>].images`) ;
  le lecteur n'a pas de grande image (`.nostage`) : la galerie directement sous le titre et les crédits.
- `hover` (dans `overrides[<id>]` d'un projet en stills, case « Extrait vidéo au survol » de l'admin) : `{ link, title, video, img? }`,
  extrait d'une autre vidéo Slate (court métrage qu'on ne peut pas montrer en entier, sans bande-annonce) ; `register()` le
  met dans `p.video` avec `p.nosnip` : il joue au survol (et au repère sur téléphone), jamais dans le lecteur (galerie au clic).
- `extras` (dans `overrides[<id>]` d'une fiche ou dans une slide de l'accueil) : ce qui s'affiche sous le film dans le lecteur,
  dans l'ordre de l'admin : `[{ link, title, stills: [...] } | { link, title, full, video, img }]` — galeries (3 colonnes, 2 sur
  téléphone) et vidéos à la taille du film (montée en fondu comme les stills ; une seule vidéo joue à la fois).
  Remplace l'ancien `stills` + `stillsLink` des overrides (toujours lu s'il n'y a pas d'`extras`).
- **Catégorie de photos** (ex. showreel `#photography` du bundle contenant la page Slate « illustration » des photos,
  `kinou.slateapp.com/work/<…>-photography`) : quand tous les projets d'un onglet (hors FEATURED) sont en images seulement,
  `renderPhotos` les affiche en colonnes (3, 2 sur téléphone), chaque photo à son ratio d'origine (jamais recadrée), montée en
  fondu, clic = photo en grand (`openPhoto`, sans le lecteur ; flèches = toutes les photos de l'onglet). Plusieurs séries :
  titre au-dessus de chacune. Images : `overrides[<id>].images` (robot, après « Relire le bundle » + Publier), proportions
  `overrides[<id>].ratios` (largeur/hauteur, robot) : colonnes remplies en JS dans l'ordre (colonne la moins haute), chaque case
  a déjà la forme de sa photo → rien ne bouge au chargement (avant, colonnes CSS = photos qui sautaient). Sans `ratios` : le site
  lit la taille des photos avant de les placer (≤ 4 s).
- `about.img` : chemin relatif au dossier `data/dps/`.
- Exception de mise en page = ajouter `"template": "special"` dans le JSON.

### Synchronisation Slate en temps réel
Une fiche peut contenir `"bundle": "https://kinou.slateapp.com/bundles/<uuid>"`. Le site lit alors ses clips
via la fonction Netlify `/api/dp/<slug>` (`netlify/functions/dp.mjs` + `slate.mjs`), qui lit le bundle Slate
(cache CDN 10 min). `categories` et `clips` de la fiche ne servent plus que de copie de secours
(API en erreur ou > 2,5 s). Un même film peut figurer dans plusieurs catégories (une entrée par catégorie). Champs propres à ces fiches :
- `open` : id Slate du clip présélectionné depuis l'accueil.
- `overrides` : corrections par id Slate, appliquées par-dessus Slate, ex. `{"10903": {"title": "…"}, "534": {"hidden": true}}`.
- Stills d'un film : dans l'admin, sous le film, lien d'une page Slate `https://kinou.slateapp.com/work/<adresse>` (ou shots.re).
  Une page Slate de vidéo est aussi acceptée (→ `full`, `video`, `img`) : vidéo de plus sous le film (`extras`).
  L'admin lit les images via `/api/stills?link=…` (`netlify/functions/stills.mjs`, `readStills` de `slate.mjs` :
  `data-media` → `images[].image_player_url`, URLs signées copiées telles quelles) et les enregistre dans
  `overrides[<id>].stills` (+ `stillsLink`). Recoller le lien pour reprendre les changements faits sur Slate.

Accueil (`home.json`) : `{ duration, reel, overrides, slides: [{ slate, film, song, legend, video, full, img, dps: [{ name, slug }], start?, phoneX?, zoom?, zoomPos? }] }`.
L'admin importe les 10 premiers films d'une bande Slate (`/api/reel?link=…`, `readReel` de `slate.mjs`) ; les chefs op crédités
sont reliés à leur page par leur nom (liste des DPs) ; `overrides` (par id Slate) garde les textes corrigés au rafraîchissement.
Ancien format accepté : `{ dp, slug }` par slide.

Convention des bundles : un showreel `#featured` (ordre du FEATURED) et un showreel par catégorie
(`#automotive`, `#commercial`, `#music video`…). L'ordre des showreels dans le bundle = ordre des onglets.
Le nom de l'onglet est le texte après `#`, en majuscules (`#clips` → CLIPS).
Plusieurs chefs op crédités sur un film : la page est celle du chef op crédité sur le plus de films du bundle
(chaque film compté une fois) ; les autres sont ajoutés en dernière ligne des crédits (« co-DoP Nom »).

### Spotlight (`data/spotlight.json`, rubrique « spotlight » de l'admin, adresse `#spotlight`)
`{ reel, categories: ["COMMERCIAL", "MUSIC VIDEO", "ART VIDEO"], overrides, films, readAt, readError? }`. Une bande Slate
(films de plusieurs chefs op) lue **en entier par le robot GitHub de l'admin** (`films` : `slate, title, sub, video, full, img,
cats` = types de contenu Slate, `artists`, et pour un projet en images `images` + `ratios`) — les fonctions Netlify figées n'en
lisent que 10, sans catégories. Le site (`spotToDP` dans app.js) en fait une page comme celle d'un chef op (`slug` « spotlight ») :
onglet ALL (= FEATURED interne, libellé par `catLabel`, tous les films dans l'ordre de la bande, arrivée par défaut) puis un
onglet par catégorie (un film va dans chaque catégorie dont le nom figure dans ses types de contenu Slate, « Art Film » comptant comme ART VIDEO ; sans catégorie
reconnue : seulement dans ALL) ; chefs op crédités en dernière ligne des crédits (« DoP Nom », noms en blanc cassé = liens vers leur page, reliés par le nom à la liste
sans accents ni « , AFC », `dpByName` / `dpLine` / `toDP` ; vignette et lecteur ; le bouton retour revient au spotlight) ; pas d'onglet ABOUT ;
`overrides` de l'admin comme une fiche (titres, masquer, recadrage, stills et vidéos sous le film…).
Ouverture : lien « spotlight » de l'en-tête et du menu du téléphone (`openSpot`, le mot devient le titre) ou `#spotlight[/cat]`.
`body.spot` : sur ordinateur, titre « Spotlight » **à gauche** (pages de chef op : à droite), onglets **en ligne au-dessus** des films (grille sur toute la largeur), pas de choix grille /
colonne ; extraits **toujours en boucle** (`liveOn`), sur ordinateur comme sur téléphone.

### Fiction (`data/fiction.json`, rubrique « fiction » de l'admin, adresse `#fiction`)
`{ reel, overrides, films, readAt, readAsk }` : comme le spotlight (bande Slate lue en entier par le robot GitHub, `films`), mais
les onglets se règlent **à la main** dans l'admin, film par film (`overrides[<id>]`) : `status` `new` | `soon` | `past` (défaut past),
`genre` (FEATURE FILM, SERIES, DOCUMENTARY, SHORT FILM ; films sortis), `date` (AAAA-MM-JJ), `poster` (affiche déposée dans l'admin →
`data/fiction/<id>-<horodatage>.webp`, lue via `DATA_BASE`). `ficToDP` (app.js) : NEW RELEASES = FEATURED interne (`catLabel`),
COMING SOON, PAST RELEASES (tous les films sortis) ; les genres (`.sub`) n'apparaissent, plus petits, à la suite des onglets que
quand PAST RELEASES ou un genre est ouvert (`.cats.past`) ; genres sans film absents. Date de sortie : carré blanc « 16 oct. » sur la
vignette au survol (`.cdate`, toujours visible sur écran tactile), seulement dans NEW RELEASES et COMING SOON
(posée sur la carte, pas sur la vignette qui s'agrandit au survol). COMING SOON : films dans l'ordre inverse de la bande (prochaine sortie en premier). Chefs op crédités :
« DoP Nom » cliquable comme au spotlight (`MULTI` = pages de plusieurs chefs op). Pas d'extraits en boucle (comportement normal).
Lecteur : avec affiche (`#player.has-poster`), affiche à gauche du film à la même hauteur (6fr / 16fr), stills dessous ; sans
affiche, comme ailleurs ; téléphone : affiche en petit (92px) à gauche des crédits (`.pposter-s`). Première version calquée sur
l'ancien site Squarespace (Gus 27/10) ; idées à essayer ensuite : affiches en vignettes, petite affiche au survol.

### Contact (`data/contact.json`, page « contact » de l'admin, adresse `#contact`)
`{ team: [{ role, name, email, phone }], address: [lignes], newsletter, newsletterLabel, social: { instagram, vimeo, imdb, facebook }, legal }`.
Ouverte comme le spotlight (`openPage`, `PAGES`, `from: "spot"`, le mot « contact » de l'en-tête devient le titre, à gauche sur
ordinateur ; `body.cpage`, pas d'onglets, `--kinou-zm` plus court). `showContact` / `renderContact` dans app.js, dans `.work`
(`contact-mode` : films, onglets et About cachés ; films de la page d'avant vidés). Présentation « générique de fin » : rôle à
droite d'un axe central (petites capitales grises, écrit sur chaque ligne, même identique à celui du dessus : Gus 27/10), prénom en grand à gauche,
e-mail (`mailto:`) et téléphone (`tel:`) dessous ; lignes qui montent l'une après l'autre (`rise`) ; noms toujours en blanc
(pas d'estompage au survol : Gus 27/10). Puis adresse (lien vers Google Maps), « [ Subscribe to the newsletter ] »
(texte `newsletterLabel` ; crochets qui s'écartent au survol), réseaux remplis, « Mentions légales » tout en bas en tout petit (9px ;
texte déplié sur place, si `legal` ; paragraphes séparés par une ligne vide, une ligne seule courte sans « : », point ni chiffre = titre).
Fond flouté (`showProj`, comme une page de chef op) : depuis l'accueil, le film en cours, là où il en était (`HomeAPI.current`,
passage HD compris) ; sinon un film de l'accueil au hasard. Téléphone : une colonne centrée.

## Règles visuelles — à respecter absolument

1. **Pas de framework CSS** — tout en CSS vanilla ; les tokens de design globaux sont des variables `--kinou-*`
   (`--kinou-bg`, `--kinou-fg`, `--kinou-body`, `--kinou-sans`, `--kinou-hero-top`, `--kinou-hero-h`, `--kinou-tabs-top`, `--kinou-zm`).
   Les variables posées par app.js sur les éléments (`--h`, `--img`, `--i`, `--d`, `--near`) gardent leur nom court.
2. **Palette** : fond noir pur (#000), texte blanc cassé `#FFFCEB` (`--kinou-fg`), textes secondaires en `rgba(255,252,235,…)` ; teinte HSL par clip pour les fonds de remplacement.
3. **Typographie** : **Satoshi** (Fontshare) partout — 300 pour la liste des DPs ; titres 600 (rendu en 700), interlettrage serré ; étiquettes 11–13px, `letter-spacing: .14em`, majuscules.
4. **Grille clips** : galerie 3 colonnes 16:9 à toutes les tailles (gap 6px, 4px mobile) ; mode feed en 1 colonne.
5. **Overlay** : plein écran, fermeture sur Escape, croix ou clic hors zone ; lecteur sur fond « verre dépoli »
   (page floutée 36px, voile noir 62 %), image agrandie sur fond noir 98 %.
6. **Animations** : celles du prototype (révélation circulaire 1,15s, morphing du nom 1000ms — les onglets apparaissent juste
   après, `view.t0` + `ANIM` → `transitionDelay` de `.cats`, etc.) + le voile
   lumineux au survol d'un film (blanc 10 % depuis le 23/10, avant 15 % ; montée rapide, retour en 1 s). Ne pas en ajouter d'autres sans demande.
8. **En-tête** : logo « kinou » au centre ; à gauche Instagram puis « spotlight », « fiction », « press » (à venir), « contact »,
   masqués sous 700px (dans le menu du téléphone) ; à droite « cinematographers ».
10. **Catégorie du film** (onglet FEATURED seulement, gris, non gras) : en bas à droite au survol (galerie) ; sur téléphone (≤ 700px) les pages de chef op sont
   toujours en feed (pas de choix d'affichage) et la catégorie est en haut à droite de la vignette.
11. **Accueil** : un lien par chef op crédité (« Nom & Nom », « & » fin et plus petit ; plusieurs chefs op = noms plus petits) ; pas de fond coloré de remplacement (noir) ;
   on arrive sur un film au hasard parmi les 10, puis l'ordre de la bande.
   Extrait HD (admin) : si la slide a `start` (secondes) et `full`, l'accueil lit le film complet de `start` pendant
   `duration` (sans le son), au lieu de l'extrait Slate ; le suivant se précharge ; film illisible → extrait Slate.
   `phoneX` de la slide = cadrage horizontal sur téléphone (`--pp`, object-position), comme le fond de la liste.
12. **Recadrage** : `zoom` (1 à 2,5, réglé dans l'admin, dans `overrides[<id>]` d'une fiche ou d'une slide de l'accueil)
   agrandit l'extrait pour enlever les bandes noires, vers la position `zoomPos` ("X% Y%", absent = centre ; cadre rouge
   déplacé dans l'admin → `--zp` = transform-origin / background-position) ; la vignette aussi si `zoomThumb` (case dans l'admin) ;
   jamais dans le lecteur.
13. **Téléphone** (≤ 700px) : en-tête = burger à gauche (volet flou sur la moitié de l'écran : spotlight, fiction, instagram,
   contact), logo réduit (texte « kinou » sans logo image : 28px), « DOP » en gras à droite (au lieu de « cinematographers », même hauteur que le logo), les trois centrés sur la même ligne ;
   écart identique (≈ 15px depuis le 23/10, avant ≈ 10–14px) entre nom, onglets et bande ;
   **ESSAI en cours (22/10)** : nom du chef op (`.hero`) **centré** sur téléphone. Ancienne position, à remettre si Gus revient
   en arrière : collé à droite comme sur ordinateur (`right: 32px`, 24px sous 560px, `text-align: right`) — il suffit de
   supprimer la ligne `.hero { left: 0; right: 0; text-align: center; }` (marquée « ESSAI ») dans `main.css` ;
   accueil : glisser gauche/droite ou haut/bas = projet suivant/précédent ; page d'un chef op : la zone qui défile
   commence sous la bande (`.work { top: var(--kinou-zm) }`), le film au milieu de l'écran (40 %) joue comme au survol,
   les onglets qui dépassent défilent lentement en boucle (une copie des onglets, `aria-hidden`, ajoutée par `marquee` ;
   retirée et recalculée à chaque passage et au redimensionnement : sinon onglets en double après rotation de l'écran).
   Petit espace sous le dernier film (6vh) : en bas de page le repère descend vers le dernier film (comme en haut vers le 1er),
   qui peut donc être sélectionné ; voile lumineux sur le film sélectionné ;
   perspective (« roulette ») : les films loin du repère rapetissent (au plus -13 %, propriété `scale` posée par `pickFocus`
   dès l'affichage puis au défilement ; pas `transform`, que l'animation d'arrivée écraserait).
15. **Roulette des chefs op** (téléphone en portrait, remplace la liste) : noms en boucle, le nom au repère (38 %)
   grand (26px) et blanc, les autres plus petits et estompés ; élan au doigt, arrivée calculée pile sur un nom ;
   le nom au centre affiche en fond l'extrait de son 1er film FEATURED (cadrage horizontal sur téléphone : `phoneX` de
   l'admin → `--pp` = object-position de `#bgvid`) ; toucher un nom l'amène au centre, toucher
   le nom au centre ouvre sa page. Commence sous l'en-tête (coupe nette). Arrivée sur la liste : un nom au hasard au centre.
16. **Historique** : accueil, liste et page d'un chef op sont des entrées d'historique (`pushPage`) : le bouton retour
   revient à la page précédente (le nom repart à sa place) ; lecteur et image agrandie se ferment d'abord.
17. **Accueil → lecteur** : clic sur la vidéo = le film **complet avec le son** dans le lecteur (jamais l'extrait ; flèches = films
   de l'accueil) ; film complet et stills de la slide (`full`, importé avec la bande), sinon ceux du même film (id Slate)
   dans la fiche du chef op. Zone de l'en-tête (90 px du haut) exclue ; boutons de l'en-tête avec zone de clic agrandie.
   Sous le film : nom du ou des chefs op en blanc (liens vers leur page). Pendant une vidéo, fond noir (pas la vignette).
14. **Lecteur** : flèches ‹ › tout en bas de l'écran (films de l'onglet affiché, aussi au clavier) ; images agrandies : flèches en bas, glisser,
   pavé tactile ; le bouton retour du téléphone ferme l'image puis le lecteur (`history.pushState`).
9. **Fonds** : liste → nom survolé en blanc et en gras (700), extrait vidéo du 1er film FEATURED du chef op ; page d'un chef op → fond du
   film survolé très flouté et assombri, ombre noire (55 %) derrière chaque vignette (extrait des vignettes débordant de 1px : sinon liseré clair de la vignette sur le bord) ; sous le nom, coupe nette sur toute la largeur (pas de dégradé ; sur ordinateur, juste un fondu de 4px depuis le 26/10).
   Sur ordinateur, en arrivant sur un onglet (page d'un chef op ou changement d'onglet), le 1er film est déjà « survolé »
   (extrait + fond flou, `autoFirst`) ; dès qu'on survole un film, fonctionnement normal (`dropAuto`). Pas si on arrive
   de l'accueil sur un film présélectionné (`selCard`).
   Portrait de l'onglet About : toujours en noir et blanc (`filter: grayscale(1)` sur `#aboutbg`).
   Cadrage : `about.pos` (background-position) ; zoom `about.zoom` = `transform: scale` avec `transform-origin` = pos.
7. **Pas de dépendances npm** pour le repo `site` — HTML/CSS/JS direct.

## À faire (noté par Gus)
- **Téléphone en paysage et tablette** : mise en page dédiée à prévoir (aujourd'hui : roulette en portrait seulement,
  sinon la mise en page ordinateur ou téléphone selon la largeur).
- Vignettes animées (extrait en boucle à la place de l'image) : essayé le 22/10/2026, Gus préfère les vignettes fixes
  sur le site normal. **Version « live »** (23/10) : https://kinou-dop.github.io/site/live (simple renvoi `live/index.html`
  → `../?live`, garde le `#slug`) = le même site avec toutes les vignettes qui jouent leur extrait en boucle (`LIVE`,
  `liveThumb` dans app.js, seulement les vignettes à l'écran). Un seul site : ne rien dupliquer, ne pas modifier `live/`.
  **Sur téléphone (≤ 700px), c'est toujours le cas** (24/10, `liveOn()` = `?live` ou téléphone) ; l'ordinateur garde les
  vignettes fixes (extrait au survol).

## Branches et mise en ligne

- `main` = site officiel (kinou.fr). Netlify publie `main` en production (aujourd'hui bloqué : voir plus haut).
- `beta` = version de test : GitHub Pages https://kinou-dop.github.io/site/ (et, quand Netlify marchait,
  branch deploy `beta--kinou-test.netlify.app`, figé depuis le 21/10).
- On travaille et on pousse sur `beta` (ou une branche de travail fusionnée dans `beta`).
- On ne fusionne `beta` dans `main` qu'après validation explicite de Gus.
- Pour l'instant seule la beta compte : le site `main` (kinou-test.netlify.app) n'est pas suivi et peut ne plus
  savoir lire les données publiées par l'admin (ex. nouveau format de `home.json`) ; pas de compatibilité à maintenir.

### Crédits Netlify (plan gratuit : 300 crédits / mois)
- Chaque mise en ligne d'un site **de production** coûte environ 15 crédits : chaque push sur `main` du site,
  et chaque push sur `main` du repo `admin` qui touche autre chose que `data/`.
- Les déploiements de la beta (branch deploys) ne coûtent rien d'après le plan gratuit (« unlimited deploy previews »).
- Les publications de l'admin (commits dans `admin/data/`) **ne déclenchent pas de mise en ligne** (règle `ignore`
  du `netlify.toml` de l'admin) : le site lit ces données dans GitHub via `/api/data`.
- Donc : travailler sur `beta`, regrouper les changements avant de fusionner dans `main`, et regrouper les
  modifications du code de l'admin en un minimum de pushs.

## Règles de code

- Toujours lire les fichiers existants avant de modifier
- Ne jamais inventer d'URLs CloudFront ou Slate — elles viennent des bundles Slate réels
- Les URLs d'images Slate (`images.slatecdn.net/<signature>/<options>/<source>`) sont signées :
  les copier telles quelles depuis le bundle, sans changer taille, options ni source (sinon erreur 403)
- Les slugs ne se renomment que dans l'admin (champ « Adresse de la page »), pour reprendre les adresses de kinou.fr
- Commit atomique par DP ajouté ou fonctionnalité implémentée
- Message de commit en français : "Ajout [Prénom Nom]" ou "Fix [description]"

## URLs de référence

- CDN vidéo : `https://d1ko11x0ybxl0h.cloudfront.net/kinou/production/clips/{id}/{uuid}.mp4`
- Images Slate : `https://images.slatecdn.net/` (pas de CORS, accès libre)
- Bundles Slate : `https://kinou.slateapp.com/bundles/{uuid}` (HTML public)
- Embed Slate : `https://kinou.slateapp.com/embed/clip/{embedId}?autoplay=1`

## Source des données d'un nouveau DP

Pour ajouter un DP, aller chercher son bundle Slate :
1. URL du bundle : trouvée via shots.re/{code} ou directement sur kinou.slateapp.com
2. Fetcher les sous-pages /0, /1, /2… pour avoir tous les clips
3. Extraire depuis la playlist du lecteur (attribut `data-media` de chaque page) : title, director/production (→ sub),
   snippets.small (→ video), le stream 1080 (→ full), id (→ slate) ; et l'image signée de la grille (→ img).
   Télécharger les pages avec `curl --compressed` (sinon la page est tronquée).
4. Identifier les clips "featured" avec le client ou son beau-frère
5. Créer `data/dps/<slug>.json` et ajouter le DP dans `data/dps/index.json`

## Structure du repo `site`

```
site/
├── index.html          # structure HTML seule (accueil + liste + page DP), aucune donnée en dur
├── assets/
│   ├── css/main.css    # tout le CSS
│   └── js/app.js       # chargement JSON + logique + template unique des pages DP
├── netlify/functions/  # API : /api/data (données), /api/dp (clips Slate), /api/bundle + /api/stills + /api/reel (import admin), /api/refresh
├── reference/
│   └── prototype.html  # prototype d'origine, référence visuelle
├── CLAUDE.md
└── README.md
```

À chaque modification de `main.css` ou `app.js`, mettre à jour le numéro `?v=` dans `index.html` (date-heure) :
sinon les navigateurs (cache de 10 min de GitHub Pages, Safari surtout) gardent l'ancienne version.

**Adresses des pages (27/10)** : `<racine>/<slug>/` (comme kinou.fr), `<racine>/<slug>/<categorie>` ouvre directement un onglet
(ex. `…/lara-perrotte-boucard-cinematographer/fashion`, `…/music-video`, `…/about`), `/feed` à la fin = une colonne ; idem
`spotlight/`, `fiction/`, `contact/`. Écrites par `pageURL` (app.js, `ROOT` = dossier de app.js), lues par `route()` ; changer
d'onglet met l'adresse à jour (`replaceState`, sans étape de plus pour le bouton retour). Les anciennes adresses `#<slug>…`
marchent toujours et sont réécrites. Le site reste une seule page : `<slug>/index.html` est une **page d'aperçu de lien**
(nom + photo du chef op en balises Open Graph, pour WhatsApp, iMessage, Slack… qui ne lisent ni le JavaScript ni le « # »),
qui renvoie en JavaScript vers `../#<slug>` ; fabriquée par `tools/share-pages.mjs` (photo = portrait About, sinon vignette du
1er film FEATURED ; spotlight / fiction / contact : leur nom), lancé par `.github/workflows/share-pages.yml` à chaque push sur
`beta` (ou à la main, onglet Actions) ; **et écrite par l'admin à chaque publication d'une fiche** (`sharePage` dans admin.js, même
contenu : garder les deux identiques ; clé GitHub de la personne avec accès en écriture au dépôt site). Pas de passage régulier
(il faudrait le workflow sur `main` : écarté, Gus 27/10). En attendant un aperçu, l'adresse d'un chef op marche quand même. Ne pas modifier ces dossiers à la main. Adresse sans page (onglet, chef op pas encore
généré) : `404.html` renvoie vers `<racine>/#<chemin>` (sur `*.github.io`, la racine = 1er dossier). Accueil : titre « kinou »
(`<title>` + og:title) ; titre de l'onglet du navigateur = « Nom — kinou » sur une page.
Au retour sur Netlify : `SITE_URL` du générateur (adresse publique, ex. https://kinou.fr/), et la règle de racine de `404.html`
(sur Netlify, `_redirects` peut remplacer 404.html). Les portraits sont en WebP (og:image) : bien lu par iMessage, WhatsApp
récent, Facebook ; si un service ne l'affiche pas, faire produire un JPEG au générateur.
Boutons grille / colonne (`.modes`) : sur ordinateur (> 900px) dans le bandeau, au-dessus de la coupe, alignés sur la grille
(les films commencent juste sous le bandeau ; catégories de gauche alignées sur le haut des films) ; 701–900px : au-dessus des films.
Sur ordinateur (> 900px), `placeModes` les sort de `.work` (dans `body`) : le haut de `.work` a un fondu très court (4px,
`mask-image`, demande de Gus 26/10 : l'ombre des vignettes n'est plus coupée net) qui les effacerait sinon.
Affichage (ordinateur) dans l'adresse : `/feed` à la fin = une colonne (`#<slug>/feed`, `#<slug>/fashion/feed`) ; rien
(ou `/grid`) = grille. Les boutons grille / colonne mettent l'adresse à jour ; sur téléphone, toujours une colonne (`wantMode`).
Ordinateur : la molette au-dessus du bandeau (nom, en-tête, onglets qui ne défilent pas) fait défiler les films (`wheel` → `work.scrollBy`).
Pour tester en local, servir le dossier (fetch ne marche pas en `file://`) :
`python3 -m http.server` puis http://localhost:8000.

## Ce que Claude NE doit PAS faire

- Modifier le design sans que ce soit demandé explicitement
- Ajouter des librairies externes sans accord
- Réécrire du code existant qui fonctionne (sauf bug avéré)
- Inventer des données de clips (toujours vérifier sur le bundle Slate réel)
- Changer les noms de variables globales (WORK, CATS_BY, PROJECTS, ABOUT)

## Particularités connues du prototype (conservées volontairement)

- Dans `main.css`, la règle `#home {` n'est pas refermée tout de suite : les règles
  suivantes (`.slide`, `.info`, `.name`…) y sont imbriquées (CSS nesting natif) jusqu'à
  une `}` isolée. Ne pas « corriger » : cela changerait la spécificité.

---

**Note** : le CLAUDE.md du repo `admin` aura des instructions supplémentaires
sur l'API GitHub (lecture/écriture des JSON) et les tokens.
