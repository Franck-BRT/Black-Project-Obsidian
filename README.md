<div align="center">

# Black Projects
*by Black Room Technologies*

Analyse d'appels d'offres dans votre coffre Obsidian : pièces du dossier, exigences,
qualité, et un assistant IA local.

</div>

> **Logiciel propriétaire.** Copyright © 2026 Black Room Technologies. Tous droits
> réservés. Voir [LICENSE](LICENSE).

## État

**Version 0.2.3 — étape 1 du [plan d'intégration](docs/plan-integration.md) : la
lecture de fichiers.** Le module *Lecture de fichiers* lit les pièces d'un dossier de
consultation — PDF, Word (`.docx`, `.doc`), RTF, Excel (`.xlsx`, `.xls`), PowerPoint,
HTML, Markdown, texte — sans aucune dépendance externe ; ses réglages montrent les formats
lus et à venir, et une commande provisoire permet de l'essayer dans Obsidian. Le module *Analyse d'appels d'offres* s'en servira à partir
de l'étape 2.

## Documentation

Toute la documentation est dans [`docs/`](docs/00-Présentation.md), lisible directement
dans Obsidian en ouvrant le dossier comme un coffre.

| | |
| --- | --- |
| [Présentation](docs/00-Présentation.md) | Ce qu'est Black Projects, pour qui |
| [Plan d'intégration](docs/plan-integration.md) | Les étapes, dans l'ordre |
| [Architecture](docs/architecture/vue-d-ensemble.md) | Cœur, modules, adaptateurs |
| [Installation](docs/installation/README.md) | Installer le plugin dans un coffre |
| [Développement](docs/developpement/regles.md) | Règles du dépôt, contrôles |

## Développement

Prérequis : Node.js 22 ou plus récent, pnpm 10.

```bash
pnpm install
pnpm run check      # mentions, en-têtes, frontières de modules, types, lint, tests
pnpm run build      # produit main.js
pnpm run dev        # recompile à chaque modification
```

Structure :

```
src/
├── core/       cœur, TypeScript pur, indépendant de la plateforme
├── modules/    un répertoire fermé par module
│   ├── lecture-fichiers/   lecture des documents (voir son README.md)
│   └── ao/                 analyse d'appels d'offres
└── obsidian/   adaptateur Obsidian : point d'entrée, ports, réglages
docs/           documentation
scripts/        contrôles du dépôt
```
