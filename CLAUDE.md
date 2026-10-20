# CLAUDE.md — kinou.fr

## Contexte du projet

kinou.fr est le site d'une agence de cinématographes parisienne.
Environ 70 directeurs de la photographie (DPs) référencés.
Stack : HTML/CSS/JS vanilla, zéro framework, données JSON statiques.
Hébergement : Netlify (déploiement automatique sur push GitHub).
Repo : github.com/kinou-agency/site

La référence visuelle de départ est le prototype `reference/prototype.html`. Depuis, Gus a demandé
des évolutions (police Satoshi, blanc cassé, en-tête, fonds et survols) : elles sont décrites dans
les règles visuelles ci-dessous et priment sur le prototype.

## Architecture des données

Les données vivent dans le repo `kinou-agency/admin` (dossier `data/`). Le site officiel **et** la beta
les chargent via `/api/data/<chemin>` (`netlify/functions/data.mjs`), qui les lit **directement dans GitHub**
avec la clé en lecture seule `GITHUB_DATA_TOKEN` (variable d'environnement Netlify du site), cache CDN 5 min
vidé à chaque publication (`/api/refresh`). Sans cette clé : copie publiée sur https://kinou-admin.netlify.app/data/.
Ainsi une publication de l'admin ne déclenche **aucune mise en ligne Netlify** (économie de crédits).
On les modifie avec l'interface d'admin (https://kinou-admin.netlify.app), pas dans ce repo.

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
- Un slug unique, immuable : `prenom-nom-cinematographer` (ex. `lara-perrotte-boucard-cinematographer`)
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
  L'admin lit les images via `/api/stills?link=…` (`netlify/functions/stills.mjs`, `readStills` de `slate.mjs` :
  `data-media` → `images[].image_player_url`, URLs signées copiées telles quelles) et les enregistre dans
  `overrides[<id>].stills` (+ `stillsLink`). Recoller le lien pour reprendre les changements faits sur Slate.

Accueil (`home.json`) : `{ duration, reel, overrides, slides: [{ slate, film, song, legend, video, img, dps: [{ name, slug }] }] }`.
L'admin importe les 10 premiers films d'une bande Slate (`/api/reel?link=…`, `readReel` de `slate.mjs`) ; les chefs op crédités
sont reliés à leur page par leur nom (liste des DPs) ; `overrides` (par id Slate) garde les textes corrigés au rafraîchissement.
Ancien format accepté : `{ dp, slug }` par slide.

Convention des bundles : un showreel `#featured` (ordre du FEATURED) et un showreel par catégorie
(`#automotive`, `#commercial`, `#music video`…). L'ordre des showreels dans le bundle = ordre des onglets.
Le nom de l'onglet est le texte après `#`, en majuscules (`#clips` → CLIPS).
Plusieurs chefs op crédités sur un film : la page est celle du chef op crédité sur le plus de films du bundle
(chaque film compté une fois) ; les autres sont ajoutés en dernière ligne des crédits (« co-DoP Nom »).

## Règles visuelles — à respecter absolument

1. **Pas de framework CSS** — tout en CSS vanilla ; les tokens de design globaux sont des variables `--kinou-*`
   (`--kinou-bg`, `--kinou-fg`, `--kinou-body`, `--kinou-sans`, `--kinou-hero-top`, `--kinou-hero-h`, `--kinou-tabs-top`, `--kinou-zm`).
   Les variables posées par app.js sur les éléments (`--h`, `--img`, `--i`, `--d`, `--near`) gardent leur nom court.
2. **Palette** : fond noir pur (#000), texte blanc cassé `#FFFCEB` (`--kinou-fg`), textes secondaires en `rgba(255,252,235,…)` ; teinte HSL par clip pour les fonds de remplacement.
3. **Typographie** : **Satoshi** (Fontshare) partout — 300 pour la liste des DPs ; titres 600 (rendu en 700), interlettrage serré ; étiquettes 11–13px, `letter-spacing: .14em`, majuscules.
4. **Grille clips** : galerie 3 colonnes 16:9 à toutes les tailles (gap 6px, 4px mobile) ; mode feed en 1 colonne.
5. **Overlay** : plein écran, fond noir 98 %, fermeture sur Escape, croix ou clic hors zone.
6. **Animations** : celles du prototype (révélation circulaire 1,15s, morphing du nom 1000ms, etc.) + le voile
   lumineux au survol d'un film (blanc 20 % en 0,25 s, retour en 1 s). Ne pas en ajouter d'autres sans demande.
8. **En-tête** : logo « kinou » au centre ; à gauche Instagram puis « spotlight » et « fiction » (à venir,
   masqués sous 700px) ; à droite « cinematographers ».
10. **Catégorie du film** (onglet FEATURED seulement, gris, non gras) : en bas à droite au survol (galerie) ; sur téléphone (≤ 700px) les pages de chef op sont
   toujours en feed (pas de choix d'affichage) et la catégorie est en haut à droite de la vignette.
11. **Accueil** : un lien par chef op crédité (« Nom & Nom », « & » fin et plus petit) ; pas de fond coloré de remplacement (noir) ;
   on arrive sur un film au hasard parmi les 10, puis l'ordre de la bande.
12. **Recadrage** : `zoom` (1 à 1,6, réglé dans l'admin, dans `overrides[<id>]` d'une fiche ou d'une slide de l'accueil)
   agrandit au centre l'extrait et sa vignette pour enlever les bandes noires ; jamais dans le lecteur.
9. **Fonds** : liste → nom survolé en blanc et en gras (500), extrait vidéo du 1er film FEATURED du chef op ; page d'un chef op → fond du
   film survolé très flouté et assombri, ombre noire (55 %) derrière chaque vignette ; sous le nom, coupe nette sur toute la largeur (pas de dégradé).
7. **Pas de dépendances npm** pour le repo `site` — HTML/CSS/JS direct.

## Branches et mise en ligne

- `main` = site officiel (kinou.fr). Netlify publie `main` en production.
- `beta` = version de test (branch deploy Netlify : `beta--<site>.netlify.app`).
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
- Les slugs sont immutables — ne pas les renommer
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

Les pages DP ne sont pas des fichiers séparés : `index.html#<slug>` ouvre la page du DP.
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
