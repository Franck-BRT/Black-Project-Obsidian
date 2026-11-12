# Architecture — vue d'ensemble

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

## Trois couches

```
┌──────────────────────────────────────────────────────────────┐
│ src/obsidian/   adaptateur Obsidian                          │
│   point d'entrée, réglages, vues, implémentation des ports   │
└───────────────┬──────────────────────────────────────────────┘
                │ fournit les ports, active les modules
┌───────────────▼──────────────────────────────────────────────┐
│ src/ui/         l'interface (Preact), la même dans Obsidian  │
│                 et dans l'application de bureau              │
│                 → voir interface.md                          │
└───────────────┬──────────────────────────────────────────────┘
                │ dessine les descriptions données par
┌───────────────▼──────────────────────────────────────────────┐
│ src/modules/    un répertoire fermé par module :             │
│                 lecture-fichiers, typage-pieces, ao, …       │
└───────────────┬──────────────────────────────────────────────┘
                │ s'appuie sur
┌───────────────▼──────────────────────────────────────────────┐
│ src/core/       cœur : ports, registre de modules, licence,  │
│                 réglages, textes, briques zip/xml, writers ; │
│                 puis exigences, client IA                    │
└──────────────────────────────────────────────────────────────┘
```

**Les règles :**

- Un module est une boîte fermée : hors de `src/modules/<id>/`, on n'importe que son
  `index.ts` ; le cœur n'importe aucun module (`pnpm check:modules`, voir
  [modules](modules.md)).
- `src/core` et `src/modules` n'importent jamais `obsidian`, `electron`,
un module Node, ni l'adaptateur. La règle de lint `no-restricted-imports` le vérifie et
fait échouer `pnpm check`. C'est ce qui permettra à l'[application de
bureau](application-desktop.md) de réutiliser tout le code métier.

## Les ports (`src/core/ports.ts`)

Ce que le cœur attend de la plateforme :

| Port | Rôle | Implémentation Obsidian |
| --- | --- | --- |
| `FileSystem` | lire, écrire, lister les fichiers du coffre ; renommer (les liens suivent) ; tous ses fichiers (`allFiles`, facultatif) ; supprimer un fichier ou un dossier et tout ce qu'il contient (`trash`, facultatif : à la corbeille) ; être prévenu d'un renommage ou d'un déplacement (`onRenamed`, facultatif) | lectures par `app.vault.adapter`, écritures par l'API du coffre (`create`, `modify`…) pour que l'index d'Obsidian suive sur-le-champ ; `renameFile` du gestionnaire de fichiers ; `allFiles` par `vault.getFiles()` ; `trash` par `fileManager.trashFile` (la corbeille choisie dans les réglages du coffre ; un dossier aussi) ; `onRenamed` par `vault.on('rename')` |
| `PageImages` (`pages`, facultatif) | un PDF ouvert (`open`), ses pages dessinées une à une en images (JPEG, deux mille pixels sur leur grand côté) pour un modèle de vision, sans limite de pages | le pdf.js d'Obsidian (`loadPdfJs`), chaque page sur un canevas rendu aussitôt ; la démonstration dessine un aperçu de chaque page |
| `Http` | appels réseau (serveur d'IA) | `requestUrl`, qui passe les restrictions d'origine |
| `Notifier` | messages brefs à l'utilisateur | `Notice` |
| `Ui` | choisir un fichier, une option ou plusieurs (cases à cocher), formulaire, confirmation, fichiers de l'ordinateur, montrer un texte, ouvrir la note voulue, connaître la note ouverte | les fenêtres de `src/ui` (les mêmes que dans l'application de bureau), la liste des fichiers du coffre, `<input type=file>`, `getLeaf().openFile` |
| `SettingsStorage` | réglages du plugin | `loadData` / `saveData` |

Les tests implémentent ces ports en mémoire ; l'application de bureau les implémentera
avec Tauri.

## Le démarrage

1. Lecture des réglages, sans jamais faire confiance au fichier (`readSettings`).
2. Déclaration des modules du catalogue (`src/modules/index.ts`) et de leurs textes.
3. Activation par le [registre](modules.md) : ordre des dépendances, modules désactivés,
   droits de licence, isolation des pannes.
4. Branchement des commandes déclarées par les modules.

## L'en-tête des notes

`src/core/frontmatter.ts` lit et écrit l'en-tête YAML des notes que Black Projects crée
(`clé: valeur` sur une ligne) ; une ligne qu'il ne comprend pas est gardée telle quelle.
Écrit pour Black Projects, sans analyseur YAML externe.

## La documentation dans le coffre

`src/core/docs.ts` assemble l'accueil et la prise en main (`src/core/doc/*.md`) et les
pages des modules (`src/modules/<id>/doc/*.md`), puis les écrit dans le dossier choisi
dans les réglages (par défaut `Black Projects/Documentation`). Chaque page porte
`bp-doc: true` dans son en-tête : elle est remplacée à chaque mise à jour, et une note de
l'utilisateur au même endroit, sans cette marque, n'est jamais écrasée.

## Les données

Markdown + YAML dans le coffre, au format de la version complète de Black Projects sous
des noms Black Room Technologies (blocs `brt-req` pour les exigences) ; les anciens noms
restent lus, pour qu'un client passe de l'une à l'autre sans perte.
