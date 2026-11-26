# Format des données (dépôt admin, data/ sur main) (site)

Note de tâche : à lire seulement quand la tâche touche ce sujet. Règles générales : `CLAUDE.md`.

- `dps/index.json` : `{ dps: [{ slug, name, img?, hidden?, gender? }] }` (ordre de la liste ; `hidden` = page cachée : absente de la
  liste et de la roulette, nom sans lien, mais **son adresse ouvre la page** (« Voir sur le site » de l'admin ; lien invisible `li.off`) ; `gender` sert seulement à l'admin).
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
  phoneX?, zoom?, zoomPos?, extras? }] }` (`start` + `full` = « extrait HD » : le film complet lu de `start` pendant `duration`). `parts?` : `[{ s, d, x }]` = montage de l'extrait HD (blocs lus l'un après l'autre, Σ`d` = `duration`, `x` = cadrage téléphone du bloc en %) ; `start` = `parts[0].s`.
- `source.json` : `{ video: "nous" | "slate", at, by }` (admin, liste des chefs op) : « slate » = vidéos et images lues chez Slate (secours en cas de panne chez nous) ; absent = chez nous. Lu par `app.js` (`kinouSource`) et par l'admin.
- `spotlight.json` : `{ reel, categories, overrides, films, readAt }` ; `fiction.json` : `{ reel, overrides, films, readAt }` avec, par
  film, `status` (new | soon | past), `genre`, `date`, `platforms`, `poster`, `thumbCrop` / `snipCrop` (cadrage cinémascope).
  `films` (`slate, title, sub, video, full, img, cats, artists, images?, ratios?`) écrits par le robot de l'admin.
- `contact.json` : `{ team, address, newsletter, newsletterLabel, social, legal }` ; `site.json` : `{ logo, logoHeight }`.
- `bandes/<code>.json` : bandes envoyées aux producteurs (voir plus bas).
- Convention des bundles Slate d'un chef op : un showreel `#featured` (ordre du FEATURED) puis un showreel par catégorie (`#music video`
  → onglet MUSIC VIDEO) ; ordre des showreels = ordre des onglets. Plusieurs chefs op sur un film : page de celui qui a le plus de
  films, les autres en « co-DoP Nom ».

## Recadrage et ordre des stills (video club, 26/11)
- `edits.json` : `images` (ordre des images d'un projet en images, remplace `images` / `stills` de la page), `scrop` = `{ l, t, w, h, ar, per? }`
  (rectangle en fraction de l'image, `ar` = forme du cadre ; `per[adresse]` = recadrage propre à une image) commun aux images du projet ;
  `extras[i].crop` = même chose pour un groupe de stills sous un film. Ancien format `{ ar, z, x, y }` encore lu. Sur le site : `vcApply` →
  `p.images`, `p.scrop` ; `buildStills` (`button.cr > i`, variables `--sar --bsz --bpos`) et la visionneuse (`.plcr`). La page des bandes (`b/index.html`) le reprend aussi (`cropOf`, `.plcr`).
- `extras[i].hide` = lieux où la ligne est masquée (`club`, `fiction`, `spotlight`, adresse d'un chef op) : `vcApply` la retire quand `d.slug` y figure. Lignes `auto: true` = vidéos importées avec celle-ci.
- Vidéos importées ensemble : `grp` / `gi` dans `library.json` ; `vcGroup` (app.js) ajoute les autres du lot sous chaque vidéo (lignes `auto`, la ligne `self` n'est jamais montrée). `ipos` / `ihide` (edits.json) = place et masquage des images d'un projet parmi les lignes sous le film.
- `client` + `cshow` (edits.json) : titre affiché « Client | Titre » (`dtitle`) sur le site (cartes, lecteur) et dans les bandes ; l'adresse d'un film garde le titre seul. `snip.parts` = montage de l'extrait (blocs bout à bout, joués via `snip.v`).
- Client : `meta.json` (`films[<id Slate>].client`, robot) ou `client` dans `edits.json` ; affiché « Client | Titre » sauf `cshow: false`.

