# CLAUDE.md — site kinou.fr

Site de kinou, agence parisienne de chefs opérateurs (~70 chefs op). HTML / CSS / JS vanilla, **aucune dépendance**, données JSON
lues dans le dépôt `Kinou-DoP/admin`. On parle à Gus en français, en le tutoyant, simplement (il n'est pas développeur).

## Notes par tâche (ne lire que celle de ta tâche, et seulement le passage utile)
- `docs/hebergement.md` : GitHub Pages / Cloudflare, fonctions `functions/`, Slate, vidéos et vignettes chez Amazon, envoi des
  vidéos (`/api/depot`), préchargement des extraits, mise en production.
- `docs/donnees.md` : format des JSON (fiches, `overrides`, accueil, spotlight, fiction, contact, bandes, `edits.json`).
- `docs/pages.md` : adresses, accueil, liste, page d'un chef op, lecteur, spotlight, fiction, contact, bandes `b/`, version live.
- `ARCHITECTURE.md` : carte du code (`app.js` dans l'ordre) et des trois dépôts. `HISTORIQUE.md` : pourquoi c'est comme ça (avant
  de changer un comportement, chercher le mot-clé dedans plutôt que tout lire).
- **À chaque changement** : la note de tâche concernée (le fonctionnement), une ligne datée en bas de `HISTORIQUE.md`,
  `ARCHITECTURE.md` si la structure change ; ce fichier seulement si une règle générale change.

## L'essentiel
- On travaille sur **`beta`** (`git checkout beta` avant tout). `main` = production kinou.fr (encore l'ancien site Squarespace) :
  **jamais de fusion `beta` → `main` sans validation explicite de Gus**.
- Beta en ligne ~1 min après un push : https://kinou-dop.github.io/site/ et https://kinou-4tv.pages.dev/ (fonctions Cloudflare).
  Netlify n'est plus utilisé (bloqué) ; `netlify/functions/slate.mjs` reste la bibliothèque de lecture de Slate.
- À chaque modification de `main.css` ou `app.js` : mettre à jour `?v=` dans `index.html` (date-heure).
- `app.js` (~140 Ko) et `main.css` : **ne jamais les lire en entier** : chercher (grep) puis lire le passage.
- Tester : `python3 -m http.server` puis http://localhost:8000, ordinateur **et** téléphone (Playwright installé ; captures
  seulement pour un vrai contrôle visuel).

## Règles visuelles — à respecter absolument
1. Pas de framework CSS ; tokens globaux en variables `--kinou-*` (`--kinou-bg`, `--kinou-fg`, `--kinou-body`, `--kinou-sans`,
   `--kinou-hero-top`, `--kinou-hero-h`, `--kinou-tabs-top`, `--kinou-zm`) ; variables posées par app.js en nom court (`--h`, `--img`…).
2. Fond noir pur `#000`, texte blanc cassé `#FFFCEB`, textes secondaires en `rgba(255,252,235,…)`.
3. **Satoshi** (Fontshare) partout : 300 pour la liste des chefs op, titres 600 (rendu 700) serrés, étiquettes 11–13px majuscules
   `letter-spacing: .14em`.
4. Grille 3 colonnes 16:9 (gap 6px, 4px sur téléphone) ; feed en 1 colonne.
5. Lecteur plein écran sur verre dépoli (flou 36px, voile noir 62 %), image agrandie sur noir 98 % ; fermeture Échap / croix / clic à côté.
6. Animations existantes seulement (arrivée des films en grandissant 94 % → 100 %, révélation circulaire, morphing du nom avec léger
   flou, onglets en cascade, voile lumineux blanc 10 % au survol, **jamais sur téléphone**) : **ne pas en ajouter sans demande**.
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
