# site
Site statique Kinou

- `index.html` : structure ; `assets/css/main.css` : styles ; `assets/js/app.js` : logique.
- Données : écrites par l'admin (https://kinou-admin.netlify.app) dans le repo `Kinou-DoP/admin`, lues par le site
  via `/api/data` directement dans GitHub (variable Netlify secrète `GITHUB_DATA_TOKEN`, lecture seule).
  Clips synchronisés depuis Slate par `netlify/functions/`.
- Test en local : `python3 -m http.server` puis http://localhost:8000 (fetch ne marche pas en `file://` ;
  la fonction Slate n'existe pas en local, le site utilise alors la copie enregistrée dans la fiche).
- Référence visuelle : `reference/prototype.html`.
- Branches : `main` = site officiel, `beta` = test (https://beta--kinou-test.netlify.app).

## À faire plus tard

### Site
- **Téléphone en paysage et tablette** : mise en page dédiée à faire.
- **Vraies adresses de pages (référencement Google)** : remplacer `kinou.fr/#slug` par des adresses réelles
  (`kinou.fr/<adresse>/`), Google ignorant ce qui suit le `#`. Les anciennes adresses n'ont pas de logique
  commune : chacune sera saisie à la main dans l'admin. Ajouter aussi un titre et une description par page.
- **Vignettes plus légères** : passer les images Slate par Netlify Image CDN (≈ 30× plus légères),
  avec préchauffage du cache après chaque synchronisation.
- **Préchauffage de l'API Slate** après chaque déploiement (le premier appel après un déploiement
  peut échouer ou être lent ; le site affiche alors la copie de secours).
- **Onglet ouvert par défaut** quand `#featured` n'est pas le premier showreel du bundle : aujourd'hui
  FEATURED reste ouvert par défaut ; à décider.
- **Photos de survol de la liste** (`images/<slug>.jpg`) : aujourd'hui fonds colorés provisoires.
- **Les ~73 autres DPs** à ajouter (un bundle Slate chacun, selon la convention du CLAUDE.md).
- **Lara Perrotte Boucard** : brancher la synchronisation Slate quand son bundle suit la convention
  (`#featured`, `#narrative`, `#commercial` à créer, `#music video`, `#fashion`, `#comedy`) et reprendre
  en corrections les titres retouchés (ex. « Stings - Energy Drink », « Louis Vuitton - FLIGHT MODE… »).
- **Badge « Powered by Netlify »** sur le site officiel : vérifier après un nouveau déploiement ;
  s'il reste, c'est lié au plan gratuit (plan payant ou autre hébergeur).
- **Crédits Netlify avant kinou.fr** : faire tourner le site une semaine avec un peu de trafic, puis lire le détail
  de consommation (Netlify → Check credit usage). Leviers si c'est juste : vignettes en 600 px au lieu de 800,
  cache navigateur plus long ; en dernier recours, Cloudflare Pages (trafic gratuit illimité).
- **Nom de domaine** : brancher kinou.fr sur `main` quand la beta est validée.

### Admin (à faire après le 18 novembre, pour ne pas consommer de crédits avant)
- Le préchauffage des vignettes de l'admin demande la taille 800 px (`w=800&q=75`) ; le site choisit maintenant la
  taille selon l'écran (`w=600` à `1200`, multiples de 200, `q=80`). Aligner `warmThumbs` dans `admin/assets/js/admin.js`
  (préchauffer les tailles courantes : 600 et 1000).

### GitHub
- **Organisation GitHub `Kinou-DoP`** (oct. 2026) : les dépôts site, admin et app y ont été déplacés depuis le compte
  personnel `kinou-agency` (resté le compte de Gus, propriétaire de l'organisation). Chacun a son propre compte GitHub,
  invité dans l'organisation, et crée ses tokens « fine-grained » avec Resource owner = Kinou-DoP.
- **Collègues** : un compte GitHub chacun (créé par Gus si besoin) et leur propre token pour l'admin.
- **Mini-applis des collègues** : pas de compte GitHub pour eux ; la clé GitHub reste côté serveur (Netlify),
  accès par mot de passe ou code personnel.

### Admin
Première version en ligne (https://kinou-admin.netlify.app) ; sa liste « à faire » est dans le README du repo `admin`.
