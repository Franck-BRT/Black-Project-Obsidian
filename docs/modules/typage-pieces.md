# Module — Typage des pièces (`typage-pieces`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `typage-pieces` |
| Version | 0.4.1 |
| Emplacement | `src/modules/typage-pieces/` |
| Interface publique | `src/modules/typage-pieces/index.ts` |
| Guide de maintenance | [`src/modules/typage-pieces/README.md`](../../src/modules/typage-pieces/README.md) |
| Requiert | — |
| Utilisé par | Analyse d'appels d'offres (`ao`) |

Documentation utilisateur (écrite dans le coffre) : `src/modules/typage-pieces/doc/Typage des pièces.md`.

Sorti du module AO en v0.4.0 : la reconnaissance des types de pièces est désormais un
module à part, réutilisable, avec sa ligne dans les réglages et sa fenêtre **Types de
pièces**.

## Ce qu'il fait

- **Reconnaître** le type d'un document d'après le nom du fichier, puis le titre du
  texte : 16 types fournis (AVIS, RC, AE, CCAP, CCAG, CCTP, CCTG, BPU, DPGF, DQE, MEMOIRE,
  FORMULAIRE, QR, PLANNING, ANNEXE, AUTRE), décrits par des mots-clés lisibles qui sont la
  source unique de la reconnaissance.
- **Personnaliser** : types de l'utilisateur (code, libellé ; crayon, corbeille), mots-clés
  de l'utilisateur (nom du fichier, titre du document ; cherchés avant ceux du module),
  types désactivés (interrupteur sur chaque fiche).
- **Échanger** : exporter un ou plusieurs types dans un fichier JSON, et les importer dans
  un autre coffre.

## La place des types (v0.4.1)

Chaque type a une place — `appel-d-offres`, `reponse` ou `les-deux` — qui dit où
l'analyse d'appels d'offres range ses pièces ; « les deux » fait poser la question à
l'import. Valeurs par défaut : avis, RC, CCAP, CCAG, CCTP, CCTG, questions-réponses avec
l'appel d'offres ; AE, BPU, DPGF, DQE, mémoire, formulaires, planning, annexe, autre et
les types ajoutés dans les deux. Réglage `placesTypes` (code → place), menu **Va dans**
sur chaque fiche ; exporté et importé avec les types ; suit le renommage et la
suppression d'un type ajouté. API : `typePlace(code)`.

## La fenêtre « Types de pièces »

Dans l'ordre : **Échanger des types** (Importer…, Exporter…), **Dossier des échanges**,
**Types de pièces personnalisés**, les deux listes de **mots-clés personnalisés**, puis la
section **Types de pièces et leur détection** (une fiche par type, avec son
interrupteur).

## L'échange de types

Commandes « Exporter des types de pièces » et « Importer des types de pièces », aussi en
boutons dans la fenêtre.

- **Export** : une liste à cocher des types qui ont quelque chose à exporter — les types
  ajoutés, et ceux du module que l'utilisateur a modifiés (mots-clés, désactivation). Le
  fichier `types-de-pieces-AAAA-MM-JJ.json` est écrit dans le dossier des échanges
  (`Black Projects/Échanges` par défaut, réglable) ; un second export le même jour
  devient `types-de-pieces-AAAA-MM-JJ (2).json`.
- **Import** : un fichier de l'ordinateur ou du coffre. Chaque type du fichier est classé
  — nouveau type, type existant mis à jour, mots-clés et état d'un type du module, ou non
  importable (code qui est un type du module, type mal formé) — et proposé dans une liste
  à cocher. Les mots-clés s'ajoutent à ceux de l'utilisateur ; ceux qui feraient doublon
  sont écartés et comptés.

Format (`exchange.ts`) :

```json
{
  "format": "black-projects/types-de-pieces",
  "version": 1,
  "exporte": "2026-11-05",
  "types": [
    { "code": "PAQ", "libelle": "Plan d’assurance qualité", "ajoute": true, "desactive": false,
      "motsClesNom": ["plan qualité"], "motsClesTitre": [] },
    { "code": "CCTP", "ajoute": false, "desactive": false, "motsClesNom": ["SPEC"], "motsClesTitre": [] }
  ]
}
```

## Pour les autres modules

```ts
import { classifyPiece, typeLabel, typeDisplay, allTypes, onTypingChange } from '../typage-pieces'

classifyPiece('03_CCTP_v3.pdf', texte)   // 'CCTP', avec ce que l'utilisateur a réglé
typeDisplay('PLANNING', t)               // 'Planning (désactivé)' si désactivé
onTypingChange((state) => …)             // suivre les renommages, par exemple
```

L'analyse d'appels d'offres suit `onTypingChange` : quand un code de type est renommé,
elle retype aussitôt les pièces de toutes ses analyses.

## Réglages (`modules['typage-pieces']`)

| Clé | Contenu |
| --- | --- |
| `typesPerso` | code → libellé |
| `motsClesNom`, `motsClesTitre` | mot-clé → code |
| `typesDesactives` | codes |
| `typesRenommes` | ancien code → nouveau |
| `placesTypes` | code → place (appel-d-offres, reponse, les-deux) |
| `dossierEchanges` | dossier des exports |

Jusqu'à la v0.3.5, ces réglages étaient rangés sous `modules.ao` ; `migrate.ts` les
déplace au premier chargement (crochet `migrateSettings` du contrat de module).

## Tests

`types.test.ts` (reconnaissance), `custom.test.ts`, `customTypes.test.ts`,
`editTypes.test.ts`, `disabledTypes.test.ts`, `exchange.test.ts` (import, export,
commandes, migration) ; côté AO, `src/modules/ao/typing.test.ts`.
