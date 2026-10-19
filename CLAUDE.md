# CLAUDE.md — kinou.fr

## Contexte du projet

kinou.fr est le site d'une agence de cinématographes parisienne.
Environ 70 directeurs de la photographie (DPs) référencés.
Stack : HTML/CSS/JS vanilla, zéro framework, données JSON statiques.
Hébergement : Netlify (déploiement automatique sur push GitHub).
Repo : github.com/kinou-agency/site

La référence visuelle est le prototype `reference/prototype.html` : le site
refactorisé doit rester visuellement identique à ce fichier.

## Architecture des données

Les données vivent dans des fichiers JSON chargés via `fetch()`.
Pour l'instant ils sont dans ce repo (`data/`) ; ils migreront plus tard vers
le repo `admin` (même format, seule la constante `DATA_BASE` de `app.js` changera).

```
data/
├── home.json              # slideshow de l'accueil (PROJECTS) + durée
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
- `stills` : galerie lightbox (optionnelle), ouverte depuis le lecteur.
- `about.img` : chemin relatif au dossier `data/dps/`.
- Exception de mise en page = ajouter `"template": "special"` dans le JSON.

### Synchronisation Slate en temps réel
Une fiche peut contenir `"bundle": "https://kinou.slateapp.com/bundles/<uuid>"`. Le site lit alors ses clips
via la fonction Netlify `/api/dp/<slug>` (`netlify/functions/dp.mjs` + `slate.mjs`), qui lit le bundle Slate
(cache CDN 10 min). `categories` et `clips` de la fiche ne servent plus que de copie de secours
(API en erreur ou > 2,5 s). Champs propres à ces fiches :
- `open` : id Slate du clip présélectionné depuis l'accueil.
- `overrides` : corrections par id Slate, appliquées par-dessus Slate, ex. `{"10903": {"title": "…"}, "534": {"hidden": true}}`.

Convention des bundles : un showreel `#featured` (ordre du FEATURED) et un showreel par catégorie
(`#automotive`, `#commercial`, `#music video`…). L'ordre des showreels dans le bundle = ordre des onglets.
Le nom de l'onglet est le texte après `#`, en majuscules (`#clips` → CLIPS).

## Règles visuelles — à respecter absolument

1. **Pas de framework CSS** — tout en CSS vanilla ; les tokens de design globaux sont des variables `--kinou-*`
   (`--kinou-bg`, `--kinou-fg`, `--kinou-body`, `--kinou-sans`, `--kinou-hero-top`, `--kinou-hero-h`, `--kinou-tabs-top`, `--kinou-zm`).
   Les variables posées par app.js sur les éléments (`--h`, `--img`, `--i`, `--d`, `--near`) gardent leur nom court.
2. **Palette** : fond noir pur (#000), texte blanc pur (#fff), textes secondaires en blanc transparent ; teinte HSL par clip pour les fonds de remplacement.
3. **Typographie** : Helvetica Neue 300 pour la liste des DPs ; titres en `--kinou-sans` (SF Pro Display / Inter) 600, interlettrage serré ; étiquettes 11–13px, 600, `letter-spacing: .14em`, majuscules.
4. **Grille clips** : galerie 3 colonnes 16:9 à toutes les tailles (gap 6px, 4px mobile) ; mode feed en 1 colonne.
5. **Overlay** : plein écran, fond noir 98 %, fermeture sur Escape, croix ou clic hors zone.
6. **Animations** : celles du prototype, ni plus ni moins (révélation circulaire 1,15s, morphing du nom 1000ms, etc.). Ne pas en ajouter.
7. **Pas de dépendances npm** pour le repo `site` — HTML/CSS/JS direct.

## Branches et mise en ligne

- `main` = site officiel (kinou.fr). Netlify publie `main` en production.
- `beta` = version de test (branch deploy Netlify : `beta--<site>.netlify.app`).
- On travaille et on pousse sur `beta` (ou une branche de travail fusionnée dans `beta`).
- On ne fusionne `beta` dans `main` qu'après validation explicite de Gus.

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
├── data/               # JSON (transitoire, migrera vers le repo admin)
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
- L'ordre FEATURED de Neel Potgieter cite « Derichebourg », absent de ses clips (7 featured).
- La slide d'accueil de Neel n'a pas de clip `open`.

---

**Note** : le CLAUDE.md du repo `admin` aura des instructions supplémentaires
sur l'API GitHub (lecture/écriture des JSON) et les tokens.
