# Architecture — les modules

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Un module est une fonction de l'outil : l'analyse d'appels d'offres aujourd'hui, d'autres
demain. Il se déclare au registre et reçoit à son activation tout ce dont il a besoin.

## Le contrat (`src/core/modules/module.ts`)

```ts
export const aoModule: BlackModule = {
  id: 'ao',                       // stable, minuscules ; préfixe de ses clés de texte
  nameKey: 'ao.name',
  descriptionKey: 'ao.description',
  version: '0.1.0',
  requires: [],                   // modules à activer avant celui-ci
  texts: { fr: aoFr, en: aoEn },  // enregistrés même si le module est désactivé
  activate(context) {
    // context.platform  : fichiers, réseau, notifications, fenêtres (choisir un fichier, montrer un texte)
    // context.i18n      : textes
    // context.settings  : réglages du module, rangés sous son identifiant
    // context.commands  : déclarer des commandes
  },
  deactivate() {}                 // facultatif : libérer ce que le module a pris
}
```

Facultatif : `details`, ce que les réglages montrent quand on clique sur le module — des
sections (une ligne chacune) de fonctions (un bloc chacune), avec un état
`available` (vert), `in-progress` (orange, avec l'étape du plan) ou `planned` (gris).
Le module écrit le contenu, la plateforme le dessine. Exemple : le catalogue des formats
de `lecture-fichiers`.

## Le registre (`src/core/modules/registry.ts`)

| État | Signification |
| --- | --- |
| `active` | le module fonctionne |
| `disabled` | désactivé par l'utilisateur dans les réglages |
| `not-licensed` | non couvert par les droits d'usage |
| `missing-dependency` | un module requis est inconnu, inactif, ou pris dans une dépendance circulaire |
| `failed` | erreur à l'activation ; les autres modules se chargent quand même |

Les modules sont activés dans l'ordre de leurs dépendances et désactivés dans l'ordre
inverse.

## Un module est une boîte fermée

Tout le code d'un module est dans `src/modules/<id>/`. De l'extérieur, on n'importe que
`src/modules/<id>/index.ts`, son **interface publique** ; le reste est son affaire et peut
changer sans toucher à personne. Le cœur, lui, ne dépend d'aucun module.
`pnpm check:modules` vérifie ces deux règles import par import.

Un module qui s'appuie sur un autre le déclare dans `requires` : il ne s'active que si
l'autre est actif. Exemple : `ao` requiert `lecture-fichiers`.

| Module | Rôle | Requiert |
| --- | --- | --- |
| `lecture-fichiers` | Lire le texte des documents ; réutilisable par tout module | — |
| `ao` | Analyse d'appels d'offres | `lecture-fichiers` |

## Ajouter un module

1. Créer `src/modules/<id>/index.ts` qui exporte un `BlackModule` et l'interface
   publique du module, `src/modules/<id>/i18n.ts` avec ses textes (toutes clés préfixées
   par `<id>.`), et un `README.md` de maintenance (voir celui de `lecture-fichiers`).
2. L'ajouter au catalogue `src/modules/index.ts`.
3. Mettre la logique dans `src/modules/<id>/` (TypeScript pur) et ses vues Obsidian
   dans `src/obsidian/`.
4. Écrire sa page dans `docs/modules/<id>.md`.

Les tests du catalogue (`src/modules/modules.test.ts`) vérifient les textes dans les
deux langues, les préfixes et les dépendances.
