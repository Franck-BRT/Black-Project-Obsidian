# Règles de développement

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

## Dépôts

- On écrit **uniquement** dans `Black-Project-Obsidian`.
- `module-obsidian` est en **lecture seule** : on y lit le code à reprendre, on n'y
  écrit jamais.

## Reprise de code

- Seul du code **écrit par Black Room Technologies** est repris de `module-obsidian`.
  Avant de reprendre un fichier, vérifier qu'il n'existait pas avant la séparation du
  projet d'origine : s'il en vient, on **réécrit** ce qu'il fait, on ne le copie pas.
- Un fichier repris reçoit l'en-tête de propriété, et ses dépendances vers la
  plateforme passent par les ports.
- Ses tests sont repris avec lui.

## Contrôles (`pnpm run check`)

| Contrôle | Vérifie |
| --- | --- |
| `check:mentions` | aucune référence à un projet tiers d'origine ni au nom d'un serveur d'IA propre à un client, dans aucun fichier |
| `check:headers` | la mention de propriété en tête de chaque fichier source |
| `check:modules` | hors d'un module, on n'importe que son `index.ts` ; le cœur n'importe aucun module |
| `check:types` | TypeScript strict |
| `check:lint` | ESLint, dont l'interdiction d'importer la plateforme dans `core` et `modules` |
| `test` | Vitest |

## En-tête de chaque fichier source

```ts
// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.
```

## Documentation

Deux documentations, à tenir à jour avec le code :

- **Pour l'utilisateur, dans son coffre** : `src/core/doc/*.md` (accueil, prise en main)
  et `src/modules/<id>/doc/*.md` (une page par module), écrites par la commande « Créer
  ou mettre à jour la documentation ». Un test vérifie qu'aucun gabarit ni clé de texte
  n'y reste.
- **Pour le projet, dans `docs/`** : plan, architecture, page technique de chaque module,
  guide, cahiers de recette, règles.

Chaque étape livre les deux avec son code. Tout nouveau réglage, bouton ou état reçoit
son infobulle.
