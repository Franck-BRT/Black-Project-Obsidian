<div align="center">

# Black Projects
*by Black Room Technologies*

Analyse d'appels d'offres dans votre coffre Obsidian : pièces du dossier, exigences,
qualité, et un assistant IA local.

</div>

> **Logiciel propriétaire.** Copyright © 2026 Black Room Technologies. Tous droits
> réservés. Voir [LICENSE](LICENSE).

## État

**Version 0.38.0 — étape 6 ter du [plan d'intégration](docs/plan-integration.md) :
l'accueil et l'interface.** L'accueil est une grille de tuiles que chacun compose (avec
leurs pastilles : prochaine remise, exigences faibles…) ; les informations sont dans un
tableau de bord et une barre de gauche que chacun range aussi (Accueil toujours en haut,
Paramètres toujours en bas). Toutes les fenêtres sont redessinées avec les composants de
l'interface : les mêmes thèmes, la même accessibilité, et les mêmes fenêtres pour la
future application de bureau. Un onglet d'accueil moderne (analyses avec leur date limite
de remise, IA, exigences, workflows), des thèmes clair et sombre, des couleurs pour les
daltonismes, une lecture facilitée pour les troubles dys ; l'interface est écrite une
fois (`src/ui`, Preact) pour Obsidian et pour la future application de bureau
([architecture](docs/architecture/interface.md)). Étape 6 bis, les workflows : Quand ceci arrive, si cela tient, faire ceci : relever le calendrier dès que
les pièces sont déposées, analyser la qualité dès que les exigences sont extraites,
interroger le dossier avec l'IA, écrire une note ; seul ou après accord, à heure fixe,
avec un journal ; chaque module y apporte ses déclencheurs et ses actions. Étape 6, l'IA
locale : Le module IA se connecte au **serveur d'IA de l'entreprise** (compatible OpenAI ; la
clé reste dans le trousseau ; un modèle par usage — analyse, traduction, vecteurs,
reranking, lecture OCR, lecture par vision — choisi dans la liste du serveur) : relire une exigence et choisir une reformulation, la
traduire, trouver les doublons par le sens ; **interroger le dossier** d'un appel
d'offres — la réponse cite ses sources, liées aux pièces — et un questionnaire prêt à
l'emploi (critères d'attribution, pénalités, garanties, propriété intellectuelle,
confidentialité, contrôle export) ; et, sans IA, le **calendrier de l'appel d'offres**
(date limite de remise, validité des offres, délais, avec leur phrase). Étape 5 :
l'analyse qualité sans IA. Chaque exigence notée en étoiles selon l'ISO/IEC/IEEE 29148
(défauts de rédaction, doublons probables, exigences non vérifiables), et une note
« Qualité des exigences » pour le dossier et pour la bibliothèque, hors ligne. Étape 4,
l'extraction des exigences : sur la note d'une pièce (le CCTP), « Extraire les
exigences de la pièce » : les tableaux d'exigences et les paragraphes qui commencent par
un identifiant sont reconnus (Word, PDF, HTML, Markdown, Excel, CSV, PowerPoint, ReqIF),
montrés avant d'être importés, et chaque exigence est tracée jusqu'à sa pièce ; quatre
vérifications du dossier (exigences oubliées, cohérence entre pièces, couverture par la
réponse, tout extraire) et une commande qui les enchaîne. Étape 3 :
une bibliothèque d'exigences — une note par exigence, un
identifiant jamais réutilisé, une liste avec filtres et une fiche, et le bloc `brt-req`
qui cite des exigences dans un document au lieu de les recopier. Étape 2, le dossier de
consultation : créer une analyse d'appel d'offres (candidat ou émetteur),
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
pnpm run demo       # l'interface hors d'Obsidian : demo/dist/index.html
```

Structure :

```
src/
├── core/       cœur, TypeScript pur, indépendant de la plateforme
├── ui/         l'interface (Preact), la même dans Obsidian et l'application
├── modules/    un répertoire fermé par module
│   ├── lecture-fichiers/   lecture des documents (voir son README.md)
│   ├── typage-pieces/      reconnaissance du type des pièces (voir son README.md)
│   ├── exigences/          bibliothèque d'exigences, extraction, qualité
│   ├── ia/                 connexion au serveur d'IA de l'entreprise
│   ├── workflows/          automatisation : déclencheurs, conditions, actions
│   └── ao/                 analyse d'appels d'offres
└── obsidian/   adaptateur Obsidian : point d'entrée, ports, réglages
docs/           documentation
scripts/        contrôles du dépôt
```
