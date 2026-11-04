<div align="center">

# Black Projects
*by Black Room Technologies*

Analyse d'appels d'offres dans votre coffre Obsidian : pièces du dossier, exigences,
qualité, et un assistant IA local.

</div>

> **Logiciel propriétaire.** Copyright © 2026 Black Room Technologies. Tous droits
> réservés. Voir [LICENSE](LICENSE).

## État

**Version 0.3.0 — étape 2 du [plan d'intégration](docs/plan-integration.md) : le
dossier de consultation.** Créer une analyse d'appel d'offres (candidat ou émetteur),
importer les pièces du dossier — ZIP compris — ou les déposer à la main ; chaque pièce
est lue, typée (RC, CCTP, CCAP, BPU…) et décrite par une note, et la note de l'analyse
tient le tableau des pièces. La documentation s'écrit dans le coffre ; des infobulles
expliquent chaque réglage.

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
