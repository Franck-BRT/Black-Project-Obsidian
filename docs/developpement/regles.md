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
| `check:mentions` | aucune référence à un projet tiers d'origine, dans aucun fichier |
| `check:headers` | la mention de propriété en tête de chaque fichier source |
| `check:types` | TypeScript strict |
| `check:lint` | ESLint, dont l'interdiction d'importer la plateforme dans `core` et `modules` |
| `test` | Vitest |

## En-tête de chaque fichier source

```ts
// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.
```

## Documentation

Chaque étape livre sa documentation avec son code : page du module dans
`docs/modules/`, chapitre du guide utilisateur, cahier de recette.
