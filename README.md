# The Completioniste

Application statique de suivi de completion des jeux vidéo par saga.

## Structure

- `index.html` : structure HTML et modales.
- `assets/styles/app.css` : styles de l'application.
- `assets/js/app.js` : point d'entrée et orchestration.
- `assets/js/` : modules par responsabilité (`state`, `catalog`, `filters`, `render`, `templates`, `dialogs`, `stats`, `diagnostics`, `pwa`).
- `assets/data/catalog.js` : catalogue des sagas et jeux en module ES.
- `assets/data/hltb-times.js` : temps HowLongToBeat en module ES.
- `assets/icons/` : icônes PWA.
- `manifest.webmanifest` : configuration d'installation PWA.
- `service-worker.js` : cache de l'application pour usage hors ligne.
- `tests/` : tests Node natifs.
- `.github/workflows/ci.yml` : checks automatisés.

L'application est servie directement par GitHub Pages, sans étape de build.

## Capacités techniques

- État utilisateur versionné avec migrations (`STATE_VERSION`).
- Sauvegardes locales datées, automatiques et manuelles.
- Diagnostic du catalogue : HLTB manquants, doublons, entrées incohérentes.
- Tests automatisés et CI GitHub Actions.

## Commandes

- `npm test` : exécute les tests unitaires.
- `npm run check` : vérifie la syntaxe JS et lance les tests.
