# ARCHITECTURE — kinou (vue d'ensemble + site)

Guide pour un développeur qui reprendrait le projet sans nous. Tout est volontairement simple : pages statiques en HTML / CSS /
JavaScript sans framework ni outil de construction, données en fichiers JSON dans GitHub, petites fonctions serverless, robots
GitHub Actions. Pas de base de données, pas de serveur à entretenir.

## 1. Les trois dépôts (organisation GitHub Kinou-DoP)

```
                 ┌──────────────────────────┐   écrit (API GitHub, clé de la personne)   ┌──────────────────────────────┐
  équipe ──────▶ │ admin (public)           │ ─────────────────────────────────────────▶ │ admin / data/ (branche main) │
                 │ interface d'admin        │                                            │ JSON du site + bandes        │
                 │ GitHub Pages (beta)      │ ──── écrit (données internes) ──┐          └──────────────┬───────────────┘
                 └────────────┬─────────────┘                                 ▼                         │ lu par
                              │ lecture de Slate                      ┌──────────────────┐              ▼
                              ▼                                       │ notes (privé)    │   ┌──────────────────────────┐
                 ┌──────────────────────────┐                         │ projets, festivals│   │ site (public)            │
                 │ site / functions/        │                         │ sélections,       │   │ kinou.fr (beta : GitHub  │ ◀── visiteurs
                 │ (Cloudflare Pages)       │                         │ sorties, notes    │   │ Pages + Cloudflare Pages)│
                 └────────────┬─────────────┘                         │ + robots (Actions)│   └────────────┬─────────────┘
                              ▼                                       └──────────────────┘                │ vidéos / images
                        Slate (bundles, vidéos sur CloudFront, images signées) ◀───────────────────────────┘
```

- **site** : le site public (`index.html` + `assets/js/app.js` + `assets/css/main.css`), la page des bandes (`b/index.html`), les
  fonctions Cloudflare (`functions/`), les pages d'aperçu de lien (`<slug>/index.html`). Branche de travail `beta` ; `main` = production.
- **admin** : l'interface (`index.html` + `assets/js/admin.js` + `assets/css/admin.css`, branche `beta`) et **les données du site**
  (`data/`, branche `main`), plus deux robots (`main` : `.github/workflows/`, `tools/`).
- **notes** (privé) : données internes (projets k-recup, festivals, sélections, sorties, notes des fiches, prénoms des clés) et les
  robots qui cherchent sur le web (dates de festivals, prix, sorties, bandes-annonces, infos des films).

Services extérieurs : **GitHub** (code, données, Pages, Actions), **Cloudflare Pages** (copie du site + fonctions), **Slate**
(hébergement des vidéos et images, ~1 400 $/mois ; remplacement étudié dans `notes/etudes/remplacer-slate.md`), **Fontshare**
(police Satoshi), **TMDB** (dates de sortie), **Claude** (robots de recherche, abonnement de Gus). Netlify : ancien hébergeur,
bloqué (crédits épuisés), plus utilisé.

## 2. Le site (`site`)

### Fichiers
| Fichier | Rôle |
|---|---|
| `index.html` | squelette de la page unique (accueil, liste, page d'un chef op, lecteur) ; `?v=` = version des JS / CSS (cache) |
| `assets/js/app.js` | tout le comportement (~1 900 lignes, une IIFE) |
| `assets/css/main.css` | tout le style ; règle `#home {` volontairement ouverte (CSS imbriqué) |
| `b/index.html` | page autonome des bandes envoyées aux producteurs (`b/<code>`, données chiffrées `data/b/`) ; `_redirects` (Cloudflare) réécrit `/b/<code>` |
| `404.html` | renvoie une adresse inconnue vers `<racine>/#<chemin>` (GitHub Pages / Cloudflare) |
| `<slug>/index.html`, `spotlight/`, `fiction/`, `contact/`, `cinematographers/` | pages d'aperçu de lien (Open Graph), **générées** par `tools/share-pages.mjs` et l'admin |
| `live/index.html` | renvoi vers `../?live` (vignettes animées) |
| `functions/` | fonctions Cloudflare Pages : `api/data/[[path]].js`, `api/bundle/[id].js`, `api/stills.js`, `api/reel.js`, `api/media.js` (relais vidéo CloudFront : capture d'image, téléchargement), `api/refresh/`, `_shared.js` |
| `netlify/functions/slate.mjs` | **lecture de Slate** (bundles, pages, bandes : attribut `data-media`, User-Agent obligatoire), utilisée par les fonctions Cloudflare et copiée dans l'admin (`tools/slate.mjs`) ; le reste de `netlify/` n'est plus en ligne |
| `tools/share-pages.mjs` + `.github/workflows/share-pages.yml` | fabrique les pages d'aperçu à chaque push sur `beta` |
| `reference/prototype.html` | prototype d'origine (référence visuelle) |

### `app.js`, dans l'ordre
- **Démarrage et adresses** : `route`, `pageURL`, `parseHash`, `filmURL`, `openFilmLater`, `pushPage` / `restorePage` (historique du
  navigateur), `getJSON` (lecture des JSON : `JSON_BASE` sur Cloudflare, sinon raw GitHub `DATA_BASE`).
- **Accueil** (`initHome`, `next`, `go`, `snippetOf`, `preloadNext`, `playHome`) : slideshow, extrait HD (`start` + `duration`).
- **Liste et roulette** (`initSite`, `showBg`, `showBgVideo`) ; transition liste → page (`startTransform`, `heroBlur`, `openView`).
- **Pages** : `loadDP` (fiche → `WORK[slug]`, `CATS_BY[slug]`, `register` applique les `overrides`), `spotToDP` (spotlight),
  `ficToDP` / `ficStatus` / `ficOut` (fiction : statuts, 9 New releases, sortie à 9 h), `dpByName` / `dpLine` (liens « DoP Nom »).
- **Affichage des films** : `render` / `showTab` / `buildTabs` / `tabsIn` / `marquee` (onglets), `renderShow` (vidéo + stills),
  `renderPhotos` / `openPhoto` (photos), `snip` / `liveThumb` / `slowThumb` (extraits), `pickFocus` (téléphone), `autoFirst`.
- **Lecteur** : `openPlayer`, `fillInfo` / `specOf` (infos et prix), `buildStills` / `orderedLoad` (extras, galeries), `showStill`,
  `stepPlayer`, `closePlayer`, `homeItem` (film de l'accueil complété par les fiches).
- **Images** : `thumb` (vignette réduite quand un service d'images existe), `slateRaw` / `loadImg` (secours si Slate ne sert plus ses images).
- **Contact** : `showContact` / `renderContact`. **Logo** : `logoImg`, `logoShrink` (logo réduit gardé dans le navigateur).

### Fonctions Cloudflare (`functions/`)
- `/api/data/<chemin>` : lit le dernier commit de `main` du dépôt admin (`info/refs`, sans clé, gardé 10 s) puis le fichier sur
  raw.githubusercontent.com : une publication est visible en ~10 s.
- `/api/bundle/<uuid | code shots.re>`, `/api/stills?link=`, `/api/reel?link=` : lecture de Slate pour l'admin (`slate.mjs`).
- `/api/refresh/<slug>` : vérifie la clé GitHub (rien à vider).
- Limites gratuites : 100 000 appels / jour, 10 ms de calcul par appel.

## 3. Tester, mettre en ligne, dépanner
- Tester : `python3 -m http.server` dans le dossier, puis http://localhost:8000 (ordinateur et téléphone ; Playwright pour automatiser).
- Mettre en ligne la beta : push sur `beta` (GitHub Pages et Cloudflare se mettent à jour en ~1 min). Production : fusion `beta` →
  `main` seulement après accord de Gus.
- Après un changement de JS / CSS : changer `?v=` dans `index.html`.
- **Si les vidéos ou images ne s'affichent plus** : c'est presque toujours Slate (panne, ou refus d'une demande sans User-Agent) ;
  les images ont un secours (`slateRaw`). **Si une publication n'apparaît pas** : attendre 10 s (Cloudflare) ou 5 min (GitHub Pages).
  **Si l'import d'un bundle échoue** dans l'admin : l'admin passe par son robot GitHub (onglet Actions du dépôt admin).
- Secrets : aucun dans ce dépôt (public). Les clés sont dans les navigateurs de l'équipe (clés GitHub) et dans les secrets GitHub /
  Cloudflare.
