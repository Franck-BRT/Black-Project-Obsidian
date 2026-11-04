# Plan d'intégration — Black Projects by Black Room Technologies

> Copyright © 2026 Black Room Technologies. Tous droits réservés.
> Document interne — logiciel propriétaire.

## 1. Objectif

Livrer au CNES une première brique de Black Projects, centrée sur **l'analyse
d'appels d'offres**, pour lui donner envie d'aller plus loin. L'outil est un plugin
Obsidian, construit pour accueillir d'autres modules ensuite et pour pouvoir devenir
une application de bureau autonome.

## 2. Décisions prises

| Sujet | Décision |
| --- | --- |
| Dépôt de travail | `Franck-BRT/Black-Project-Obsidian` : seul dépôt où l'on écrit |
| Dépôt source | `Franck-BRT/module-obsidian` : **lecture seule**, jamais modifié |
| Nature | Projet distinct, **pas un fork** : dépôt vierge, sans historique repris |
| Propriété | Code propriété exclusive de Black Room Technologies, licence propriétaire |
| Identifiant du plugin | `black-projects` |
| Nom affiché | Black Projects by Black Room Technologies |
| Premier module | Analyse d'appels d'offres (AO), module interne du plugin |
| Modèle économique | Gratuit pour l'évaluation ; un point d'accroche permet d'activer une licence payante plus tard sans rien refaire |
| Application autonome | Plus tard, avec Tauri (Rust + interface web), **sans embarquer Obsidian** (interdit par ses conditions d'utilisation) |

### Règles de provenance du code

- Seul du code **écrit par Black Room Technologies** est repris de `module-obsidian`.
- Un fichier de `module-obsidian` qui ne vient pas de Black Room n'est **jamais copié** :
  ce qu'il faisait est réécrit. C'est le cas de l'analyseur et du sérialiseur YAML, des
  types globaux, des utilitaires, de l'index du coffre, du point d'entrée, des réglages
  et de la configuration de build.
- Le contrôle `pnpm check:mentions` fait échouer le build si une référence à un projet
  tiers d'origine apparaît dans le dépôt.
- Chaque fichier source porte l'en-tête de copyright Black Room (`pnpm check:headers`).

## 3. Architecture

```
src/
├── core/        TypeScript pur, aucune dépendance à Obsidian ni à Node
│   ├── ports.ts       interfaces : fichiers, réseau, notifications, stockage
│   ├── modules/       registre et contrat des modules
│   ├── licence.ts     droits d'usage (tout ouvert pour l'instant)
│   ├── settings.ts    réglages communs
│   ├── i18n/          traductions
│   └── …              (étapes suivantes) lecteurs, exigences, client IA
├── modules/     la logique des modules, TypeScript pur
│   └── ao/            analyse d'appels d'offres
└── obsidian/    l'adaptateur Obsidian : point d'entrée, ports, vues, réglages
```

- `src/core` et `src/modules` n'importent jamais `obsidian`, `electron` ni de module
  Node : une règle de lint fait échouer le build sinon. C'est ce qui rendra possible
  l'application de bureau, qui fournira ses propres implémentations des ports.
- Le format des données (Markdown + YAML, blocs `pm-req` pour les exigences) reste
  identique à la version complète de Black Projects, pour qu'un client puisse passer de
  l'une à l'autre sans perte.

Détails : [architecture/vue-d-ensemble.md](architecture/vue-d-ensemble.md),
[architecture/modules.md](architecture/modules.md).

## 4. Les étapes, dans l'ordre d'intégration

L'ordre suit les dépendances réelles du code : chaque étape ne s'appuie que sur ce qui
est déjà intégré. Chaque étape livre sa documentation et ses tests en même temps que son
code.

### Étape 0 — Socle du dépôt ✅ *terminée (v0.1.0)*

- Licence propriétaire, en-têtes de copyright
- `manifest.json` : `black-projects`, « Black Projects by Black Room Technologies »
- Chaîne de build réécrite : TypeScript, esbuild, Vitest, ESLint
- Séparation `core` / `modules` / `obsidian`, avec la règle de lint qui l'impose
- Registre de modules ; `isEnabled` passe par les droits de licence (tout ouvert)
- Module AO déclaré, sans fonction encore
- Contrôles : anti-mentions, en-têtes, types, lint, tests
- Squelette de `docs/`

**Jalon :** le plugin se charge dans Obsidian ; ses réglages listent les modules et
l'état de la licence.

### Étape 1 — Lecteurs de documents (`src/core/readers/`)

Repris de `module-obsidian` (code Black Room), dans cet ordre :

1. Briques de base : `unzip`, `zip`, `xmlParse`, `xml`, `cfb`, `pdfCrypt`, `pdfFont`
2. Lecteurs : `docxRead`, `xlsxRead`, `pptxRead`, `pdfRead` + `pdfText`, `docRead`,
   `xlsCrypt`, `xlsRead`, `rtfRead`, `htmlRead`, `markdownRead`
3. Aiguilleur `fileText` (version allégée de `chatFile`, sans lecture des scans ni des mails)

Tests et fichiers d'essai repris. Pas d'interface. ≈ 4 500 lignes.

**Jalon :** tests verts sur un dossier de consultation réel anonymisé.

### Étape 2 — Dossier de consultation (module AO)

- Commande « Nouvelle analyse d'appel d'offres » : dossier `AO/<nom>/` avec `pièces/`,
  `exigences/`, `analyse/`
- Import des pièces par glisser-déposer ou depuis le ZIP du dossier
- Typage des pièces (RC, CCTP, CCAP, AE, BPU, DPGF, annexes), corrigeable
- Une note par pièce : texte extrait, type, état de lecture (lue, scan illisible,
  format inconnu)
- Repris : `libraryDoc` et `docText`, allégés
- Vue « Dossier »

**Jalon de démo n° 1 :** « je dépose le ZIP du dossier, toutes les pièces sont lues ».

### Étape 3 — Socle des exigences (`src/core/requirements/`)

- Repris : `reqId`, `Requirement`, `reqAlias`, `reqYaml`, `reqBlockFields`, `reqBlock`,
  `reqFence`, `reqNote`, `RequirementStore`
- Réécrit : les types globaux, le YAML (fonctions fournies par la plateforme), l'index
  du coffre
- Format `pm-req` identique à la version complète
- Vue « Exigences » simplifiée : liste, filtres, fiche

**Jalon :** créer, modifier et relire une exigence.

### Étape 4 — Extraction des exigences du dossier

- Repris : `reqCsv`, `reqXlsxRead`, `reqDocxRead`, `reqPptxRead`, `reqifRead`, `reqJson`,
  `reqJsonImport`, `ReqPorter`
- Extraction depuis un PDF : logique sortie de la vue des exigences vers un module
- « Extraire les exigences » sur une pièce : aperçu, puis import ; chaque exigence
  garde le lien vers sa pièce et son paragraphe d'origine
- Import ReqIF (échange avec DOORS, courant dans le spatial)

**Jalon de démo n° 2 :** les exigences du CCTP extraites et tracées jusqu'à leur pièce.

### Étape 5 — Analyse qualité sans IA

- Repris : `reqQuality`, `reqScore` (ISO/IEC/IEEE 29148), `reqSimilar` (partie lexicale),
  `ReqCoverage`
- Vue « Analyse du dossier » : nombre d'exigences, répartition des notes, défauts
  les plus fréquents, doublons, exigences non vérifiables

**Jalon de démo n° 3 :** analyse complète hors ligne, sans serveur d'IA.

### Étape 6 — IA locale

- Repris : `llm/protocol`, `llm/client` (types réécrits), `promptTemplate`,
  `reqQualityLlm`, `reqAdvice`, `ReqEmbeddings`, la partie utile de `translate`
- Réglages de connexion : adresse, modèle, clé dans le trousseau d'Obsidian (jamais
  dans le coffre), bouton « Tester la connexion »
- Calendrier de l'AO (`deadlines`) : date limite de remise, validité de l'offre, délais,
  avec la phrase source
- « Interroger le dossier » (`libraryRetrieval`, `eachDocument`) avec un questionnaire
  prêt à l'emploi : critères d'attribution, pénalités, garanties, propriété
  intellectuelle, confidentialité, contrôle export

**Jalon de démo n° 4 :** l'IA relit, conseille et répond en citant ses sources.

### Étape 7 — Livrables

- Repris : générateurs `xlsx` et `docx`, `reqXlsx`, `reqDocx`
- Matrice de conformité (Excel), rapport d'analyse (Word)
- Fiche de synthèse, adaptée de `visaSheet` — son contenu dépend de la question
  ouverte « émetteur ou répondant »
- Registre des risques de l'AO (`risk`)
- Comparaison de deux versions du dossier, avis rectificatif (`reqDiff`)

**Jalon :** version 1.0 de la démo CNES.

### Étape 8 — Recette et livraison

- Cahier de recette dans `docs/recette/`
- Script de packaging : ZIP `main.js`, `manifest.json`, `styles.css`
- **Coffre préconfiguré** : plugin installé, réglages, documentation, exemple de
  dossier d'AO ; l'utilisateur installe Obsidian lui-même depuis obsidian.md
- Guide d'installation hors ligne (réseau restreint)

### Étape 9 — Black Projects Desktop (plus tard)

- Application Tauri : le cœur TypeScript tourne dans l'interface web, Rust prend en
  charge les fichiers, l'indexation, la licence, l'installeur et les mises à jour signées
- Un adaptateur `desktop/` implémente les mêmes ports que l'adaptateur Obsidian
- Même format de données : un dossier s'ouvre dans les deux
- À réécrire : éditeur Markdown (CodeMirror), arborescence, onglets, recherche

Détails : [architecture/application-desktop.md](architecture/application-desktop.md).

## 5. Hors périmètre de la démo CNES

Gantt, tableau, Kanban, messagerie (SMTP, IMAP, relances), workflows, budget, réserves,
anomalies, DM/PM et CLM, agenda, rapport hebdomadaire, chat complet, recherche
sémantique sur tout le coffre, lecture des scans par IA, démonstration.

Ce sont des modules futurs. Point de vigilance : le tableau, le Kanban, une grande
partie du Gantt, le planificateur et le stockage des projets de `module-obsidian` ne
sont pas du code Black Room : ils devront être **réécrits**, pas repris.

## 6. Volume

≈ 15 000 lignes reprises sur ≈ 175 000 dans `module-obsidian` (≈ 9 %), plus ≈ 2 000
lignes écrites pour le socle, les vues et les réglages.

## 7. Questions ouvertes

1. **Émetteur ou répondant ?** Le CNES analyse-t-il son propre dossier avant
   publication, ou évalue-t-il des offres reçues ? Nécessaire avant l'étape 7.
2. **Serveur d'IA interne compatible OpenAI ?** Nécessaire avant l'étape 6 ; sans lui,
   la démo s'arrête à l'étape 5 plus l'étape 7.
3. **Texte de la licence** à faire valider par un juriste (voir
   [architecture/propriete-et-licences.md](architecture/propriete-et-licences.md)).
