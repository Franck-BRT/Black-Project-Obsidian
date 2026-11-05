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

Facultatif : `details`, ce qu'une fenêtre montre quand on clique sur le module dans les
réglages — des
sections (une ligne chacune) de fonctions (un bloc chacune), avec un état
`available` (vert), `in-progress` (orange, avec l'étape du plan) ou `planned` (gris).
Le module écrit le contenu, la plateforme le dessine. Exemple : le catalogue des formats
de `lecture-fichiers`. `details` reçoit les réglages du module, pour montrer aussi ce que
l'utilisateur a ajouté.

Une section de `details` peut être de type `reference` : des fiches sans état ni
couleur, hors du résumé, avec des groupes d'étiquettes titrés (`tagGroups`) — c'est ainsi
que la fenêtre **Fonctions** de l'analyse d'appels d'offres montre les types de pièces et
les mots-clés qui les font reconnaître. Une fiche peut porter un interrupteur (`switch`) :
il ajoute son identifiant à une liste des réglages du module, ou l'en retire (exemple :
les types désactivés), et la fiche est alors montrée en retrait (`disabled`).

Facultatif : `settingsFields`, les réglages propres au module, dessinés en tête de sa
fenêtre (celle qu'ouvre `details`).
Deux types : `mapping`, une liste de paires « ceci → cela » avec un formulaire
d'ajout, la valeur choisie dans un menu (exemple : les extensions équivalentes) ou saisie
librement (`valueKind: 'text'`, exemple : les types de pièces personnalisés). Une paire
peut être modifiée (`editable` : un crayon ouvre un formulaire contrôlé comme l'ajout) et
sa suppression confirmée (`describeRemoval`) ; `afterChange` laisse le module ajuster
ses autres réglages (les mots-clés d'un type renommé) ; `text`, un texte comme un dossier
(exemple : le dossier des analyses). Le module dit ce qui est permis
(`normalize`, `validate`, `options`) ; la plateforme dessine et enregistre. Un module
apprend qu'un réglage a changé par `context.settings.onChange`.

Facultatif : `docs`, les pages de documentation du module, écrites dans le coffre par la
commande « Créer ou mettre à jour la documentation ». Leur texte est dans
`src/modules/<id>/doc/*.md`, embarqué dans le plugin au build : la documentation d'un
module se maintient dans son répertoire, avec son code. Gabarits : `{{nom}}` pour une
valeur, `{{link:Chemin|Libellé}}` pour un lien vers une autre page de la documentation.

## Infobulles

Chaque réglage, bouton, état et bloc porte une infobulle (`setTooltip` d'Obsidian), dont
le texte est dans les traductions : `tip.*` pour le cœur, `<id>.….tip.*` pour un module
(par exemple les `tooltipKeys` d'un réglage `mapping`).

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
| `ao` | Analyse d'appels d'offres : analyses, import du dossier, pièces | `lecture-fichiers` |

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
