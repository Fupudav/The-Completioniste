# The Completioniste

Application statique de suivi de completion des jeux vidéo par saga.

## Structure

- `index.html` : structure HTML et modales.
- `assets/styles/app.css` : styles de l'application.
- `assets/js/app.js` : logique UI, filtres, rendu, sauvegarde locale.
- `assets/data/catalog.js` : catalogue des sagas et jeux.
- `assets/data/hltb-times.js` : temps HowLongToBeat.
- `assets/icons/` : icônes PWA.
- `manifest.webmanifest` : configuration d'installation PWA.
- `service-worker.js` : cache de l'application pour usage hors ligne.

L'application est servie directement par GitHub Pages, sans étape de build.
