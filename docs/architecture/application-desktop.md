# Application de bureau (étape 9, plus tard)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

## Pourquoi ne pas embarquer Obsidian

Les conditions d'utilisation d'Obsidian interdisent de le redistribuer (« distribute or
share the Services or Software ») et d'en faire une œuvre dérivée. Une application qui
l'embarquerait n'est donc pas possible.

## Ce qui est prévu : Black Projects Desktop, avec Tauri

```
                ┌───────────────────────────────────┐
                │ src/core + src/modules            │
                │ TypeScript pur, sans Obsidian     │
                └───────────────┬───────────────────┘
               ┌────────────────┴────────────────┐
               ▼                                 ▼
     src/obsidian/ (aujourd'hui)       desktop/ (plus tard)
     plugin Obsidian                   Tauri : Rust + interface web
```

- Le cœur TypeScript tourne tel quel dans l'interface web de Tauri.
- Rust prend en charge ce qui y gagne : fichiers, indexation de gros dossiers, licence,
  installeur signé, mises à jour.
- L'adaptateur `desktop/` implémente les mêmes [ports](vue-d-ensemble.md#les-ports-srccoreportsts).
- Même format de données : un dossier s'ouvre dans Obsidian comme dans l'application.
- À écrire : éditeur Markdown (CodeMirror), arborescence, onglets, recherche.

## En attendant : le coffre préconfiguré (étape 8)

Un ZIP contenant un coffre où le plugin est déjà installé et réglé, avec la
documentation et un exemple de dossier. L'utilisateur installe Obsidian lui-même depuis
obsidian.md, ouvre le coffre, et c'est prêt.
