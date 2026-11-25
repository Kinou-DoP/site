# Pages et comportements (site)

Note de tâche : à lire seulement quand la tâche touche ce sujet. Règles générales : `CLAUDE.md`.

- **Adresses** : `<racine>/<slug>/[<catégorie>][/feed]`, `spotlight/…`, `fiction/…`, `contact/`, liste des chefs op = `cinematographers/`
  (`LIST`), film ouvert = `<slug>/<onglet>/<titre>` (`pageURL`, `filmURL`, `route`). Tous les liens internes ont leur vraie adresse :
  **Ctrl / Cmd / Maj + clic ou clic molette** = nouvel onglet (`newTab` : le clic n'est pas intercepté ; sur un film : `filmTab`). Les dossiers `<slug>/index.html` sont des **pages d'aperçu de lien** (Open Graph) fabriquées par
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
  nom(s) en grand à droite sur une seule ligne (plus petits s'ils dépassent ; liens vers leur page), liste des sections à gauche
  seulement s'il y a des sections (sinon toute la largeur), sections séparées par un trait et de l'espace (même une section sans nom), grille 1 à 3 colonnes (flex : **dernière ligne incomplète centrée** ; 2 colonnes ≤ 1240px, 1 colonne ≤ 1040px), mise en page **« Plein écran en haut »** (`layout: "bleed"`, `bleed()` : 1er film en grand **sous tout le haut de page, en-tête et nom compris** (`.bleed.top`, 74vh, 68vh sur téléphone, pour voir la grille dessous), extrait qui joue (recadré par `crop` comme les vignettes), en pause au survol d'un autre film ou dans le lecteur, titre + Director / Cinematographer / Production, flèches pour changer de film, clic = lecteur ; aussi dans un onglet de bundle), voile lumineux et fond flouté au survol ; **téléphone** = comme les pages de chef op (`pickFocus`, repris d'app.js) : le film au repère (40 % de la hauteur, 1er film en haut, dernier en bas) joue son extrait avec le fond flouté, perspective (−13 % au plus loin), le grand film du haut joue tant qu'il est au repère,
  recadrage `crop` (extrait toujours, vignette si `t`), extrait choisi `snip` (film complet à partir de `s`) ou mp4 importé `snipVideo` (lu par `/api/media`), crédits « DoP » (cinematographer) puis les autres rôles (`roles`, ex. « Camera operator Nom »), lecteur **repris du site** (verre dépoli `#pglass`, clic dans le vide = fermer, flèches ‹ ›, Échap) avec crédits (cachables), types,
  prix groupés par festival (`awards`), stills (images chargées et affichées dans l'ordre, `orderedLoad`, agrandissement `.plight`) et
  vidéos dessous (`extras`), « See more projects ». Téléchargement si permis : « Download » en haut à droite du lecteur,
  direct par `/api/media?u=…&dl=<titre>` (sans ouvrir d'onglet) ; « Download all » après le nom de la bande = **un fichier zip**
  (`zipAll` : sans compression, ZIP64 au-delà de 4 Go ; Chrome / Edge l'écrivent directement sur le disque, les autres en mémoire
  jusqu'à 1,5 Go, sinon un fichier après l'autre). Expiration : message « plus disponible ». **Bundle** (`bundle: true`) : chaque bande lue avec son propre code, une par onglet à gauche (`showBundle`, `fillMain`, adresse `#<n>` = onglet), noms des chefs op de toutes les bandes, mot de passe demandé dans l'onglet d'une bande protégée. **Film partagé seul** (`single: true`, admin) : le lecteur au centre de la page (`#player.single`, sans croix ni fond flouté), « Download » si permis.
- **`/api/media?u=<vidéo CloudFront Slate>[&dl=nom]`** (`functions/api/media.js`) : depuis le 25/11, lit d'abord la copie sur **notre CloudFront Amazon** (`d3toxii6rvamjf`, même chemin), Slate si absente ; relais limité à ces deux CloudFront et aux mp4 de `data/bibli/vid/` du dépôt admin (servis en video/mp4), avec CORS
  (capture d'une image pour les vignettes des bandes dans l'admin) ou en téléchargement direct.
- **Test de l'hébergement vidéo** (`test-video/`, `noindex`, étude « remplacer Slate ») : le même film lu depuis Slate puis depuis notre
  adresse (champ « Notre adresse » ou `?sema=<url>&napoli=<url>`), l'un après l'autre : démarrage, sauts milieu / fin, coupures et
  avance en mémoire sur 30 s, résumé à copier.
- **Le video club sert partout** (Gus 26/11) : au chargement, `app.js` lit `data/bibli/edits.json` (retouches de la fenêtre d'un film
- **Une seule source** (Gus 25/11) : vignette, extrait, recadrage (`crop { z, x, y, t }` → `zoom`, `zoomPos`, `zoomThumb` ; `null` = aucun), stills et crédits viennent du video club (`edits.json`), par-dessus les pages ; **le titre reste celui de chaque page** (crédits : réal, prod, chefs op, rôles du video club ; lignes en plus de la page) (le titre du video club ne vaut que pour les bandes). `vcOf` accepte aussi la clé d'un import du video club (« i… », « e… ») placé dans une page.
  du video club de l'admin, clé `s<id Slate>`, `VC_P`) ; `vcApply` les applique par-dessus les `overrides` de chaque film des fiches,
  spotlight et fiction : `img` (vignette), `title`, `full`, extrait = `snipVideo` (par `/api/media`) sinon `snip.v` (extrait léger, s'il vient
  du film affiché : `vf`) sinon `video` ; `extras` (stills et vidéos dessous, remplace `stills`) ; crédits refaits si `dir` / `prod` / `dops` /
  `roles` changent (« co-DoP Nom », « DoP Nom » si le chef op de la page a un rôle, puis « Rôle Nom » ; spotlight / fiction : `dps`).
  Accueil : vignette, titre (`film`), film complet. Fichier absent : le site sans retouches. Le recadrage (`crop`) reste celui des pages.
- **Version live** (`live/` → `?live`) : vignettes qui jouent leur extrait en boucle ; toujours le cas sur téléphone (`liveOn`).
