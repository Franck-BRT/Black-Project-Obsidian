# Typage des pièces — guide de maintenance

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

**Toute modification du typage des pièces se fait dans ce répertoire.** Les autres
modules n'en connaissent que `index.ts` (`pnpm check:modules`).

| Fichier | Rôle |
| --- | --- |
| `index.ts` | Interface publique, déclaration du module, réglages, commandes d'import et d'export |
| `types.ts` | Les types du module, leurs mots-clés, la reconnaissance (`classifyPiece`) |
| `custom.ts` | Ce que l'utilisateur ajoute : types, mots-clés, désactivations, renommages — saisie, contrôle, relecture des réglages |
| `state.ts` | L'état en vigueur, lu par la reconnaissance et suivi par l'analyse d'appels d'offres |
| `workflows.ts` | Le **workflow système** « Signaler les pièces sans type reconnu, à l'import » et son action |
| `catalogue.ts` | La fenêtre « Types de pièces » : une fiche par type |
| `exchange.ts` | Import et export d'un fichier de types (JSON) |
| `migrate.ts` | Déplace les réglages rangés dans l'analyse d'appels d'offres jusqu'à la v0.3.5 |
| `doc.ts`, `doc/` | Page de documentation écrite dans le coffre, tableau des types |
| `i18n.ts` | Textes, clés `typage-pieces.*` |

## Ajouter un type ou un mot-clé du module

Dans `types.ts`, `PIECE_TYPES` : les mots-clés sont écrits comme un utilisateur les lit,
et c'est d'eux que la reconnaissance est tirée ; la fenêtre et la documentation les
affichent tels quels. Ajouter un cas dans `types.test.ts`.

## Le format d'échange

`exchange.ts` : `format` = `black-projects/types-de-pieces`, `version` = 1. Une version
plus récente est refusée avec un message ; augmenter `EXCHANGE_VERSION` si le format
change, et savoir lire les anciennes versions.
