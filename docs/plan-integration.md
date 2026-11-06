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
| Position d'analyse | **Les deux** : émetteur (relire son propre dossier avant publication) et répondant / évaluateur (analyser un dossier reçu, ou une offre face au dossier) |
| Serveur d'IA | Celui de l'entreprise qui utilise Black Projects, **compatible OpenAI** ; aucun serveur n'est nommé dans le logiciel : chaque entreprise règle le sien |

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
│   └── …              (étapes suivantes) exigences, client IA
├── modules/     la logique des modules, TypeScript pur, un répertoire fermé par module
│   ├── lecture-fichiers/  lire PDF, Word, Excel, PowerPoint… (réutilisable)
│   ├── typage-pieces/     reconnaître le type des pièces (réutilisable)
│   └── ao/            analyse d'appels d'offres
└── obsidian/    l'adaptateur Obsidian : point d'entrée, ports, vues, réglages
```

- Un module est une boîte fermée : hors de son répertoire, on n'importe que son
  `index.ts`. Le cœur ne dépend d'aucun module (`pnpm check:modules`).
- `src/core` et `src/modules` n'importent jamais `obsidian`, `electron` ni de module
  Node : une règle de lint fait échouer le build sinon. C'est ce qui rendra possible
  l'application de bureau, qui fournira ses propres implémentations des ports.
- Le format des données (Markdown + YAML, blocs `brt-req` pour les exigences) reprend
  celui de la version complète de Black Projects, sous des noms Black Room Technologies ;
  les anciens noms de la version complète restent lus, pour qu'un client passe de l'une
  à l'autre sans perte.

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

### Étape 1 — Lecteurs de documents (module `lecture-fichiers`) ✅ *terminée (v0.2.6)*

Repris de `module-obsidian` (code Black Room), dans cet ordre :

1. Briques de base : `unzip`, `zip`, `xmlParse`, `xml`, `cfb`, `pdfCrypt`, `pdfFont`
2. Lecteurs : `docxRead`, `xlsxRead`, `pptxRead`, `pdfRead` + `pdfText`, `docRead`,
   `xlsCrypt`, `xlsRead`, `rtfRead`, `htmlRead`, `markdownRead`
3. Aiguilleur `fileText` (version allégée de `chatFile`, sans lecture des scans ni des mails)

Tests et fichiers d'essai repris. Pas d'interface. ≈ 4 500 lignes.

Réalisé, puis réorganisé en v0.2.1 en un **module « Lecture de fichiers »**
(`lecture-fichiers`), visible dans les réglages et réutilisable par tout module : tout le
code de lecture est dans `src/modules/lecture-fichiers/`, et les autres modules n'en
connaissent que l'interface publique (`index.ts`), ce que `pnpm check:modules` vérifie.
Les générateurs `docx`, `xlsx`, `pptx` sont dans `src/core/writers/` (avancés de
l'étape 7 : les tests des lecteurs fabriquent leurs fichiers avec). Commande provisoire
« Lire un fichier du coffre » pour essayer dans Obsidian. En v0.2.3, un clic sur le
module dans les réglages ouvre une fenêtre avec le catalogue des formats : intégrés (vert), en
développement avec leur étape (orange), prévus (gris). En v0.2.4-0.2.5, des **extensions
équivalentes** déclarées en tête de cette fenêtre (`.tot` lu comme `.xml`). En v0.2.6,
des **infobulles** partout, et la **documentation écrite dans le coffre** de
l'utilisateur (accueil, prise en main, une page par module, dont le texte vit dans le
répertoire de chaque module). Doc :
[modules/lecture-fichiers.md](modules/lecture-fichiers.md).

**Jalon :** tests verts sur un dossier de consultation fictif produit par LibreOffice
et pandoc (`test/dce.test.ts`) ; à refaire sur un dossier réel anonymisé du CNES.

### Étape 2 — Dossier de consultation (module AO) ✅ *terminée (v0.4.8)*

- Retrait de la commande provisoire « Lire un fichier du coffre »
- Commande « Nouvelle analyse d'appel d'offres » : formulaire (nom, position candidat /
  émetteur, acheteur, référence) ; dossier `<dossier des analyses>/<nom>/` (« Appels
  d'offres » par défaut, réglable) avec `Pièces/Originaux/`, `Exigences/`, `Analyse/`
- Import des pièces depuis l'ordinateur, ou du ZIP du dossier (ouvert par le module
  Lecture de fichiers : sous-dossiers, archive imbriquée, noms Windows) ; dépôt à la main
  dans `Pièces/Originaux` puis « Mettre à jour l'analyse »
- Typage des pièces (AVIS, RC, AE, CCAP, CCAG, CCTP, CCTG, BPU, DPGF, DQE, mémoire,
  formulaires, questions-réponses, planning, annexes), par le nom puis par le titre ;
  commande « Changer le type de la pièce »
- Une note par pièce : type, état de lecture (lue, sans texte, image, format non lu,
  illisible), texte extrait
- La note de l'analyse, avec le tableau des pièces tenu à jour, à la place d'une vue
  dédiée : lisible dans Obsidian comme dans la future application de bureau
- Fenêtre « Fonctions » du module (fait / en développement, par étape) et réglage du
  dossier des analyses ; en v0.3.1, la section « Types de pièces et leur détection » :
  chaque type avec les mots-clés cherchés dans le nom et dans le titre, tirés de la liste
  même que la reconnaissance applique ; en v0.3.2, les **mots-clés personnalisés** de
  l'utilisateur (nom du fichier, titre du document), cherchés avant ceux du module ; en
  v0.3.3, les **types de pièces personnalisés** (code et libellé) ; en v0.3.4, leur
  modification (code repris par les mots-clés et les pièces) et leur suppression confirmée ;
  en v0.3.5, la **désactivation** de n'importe quel type, du module ou ajouté
- v0.4.0 : le typage des pièces devient un **module à part** (`typage-pieces`), avec sa
  fenêtre **Types de pièces** et l'**import / export** d'un ou plusieurs types dans un
  fichier JSON ; les réglages de la v0.3.5 sont déplacés au premier chargement
- v0.4.1 : chaque pièce est rangée avec l'**appel d'offres** ou avec la **réponse** (une
  par candidat pour l'émetteur), d'après la place de son type (« Va dans ») ; la
  question est posée à l'import quand le type va dans les deux ; commande « Déplacer la
  pièce »
- v0.4.2 : « où va chaque type » se règle dans le module AO (bouton d'ajout, liste
  dépliable à interrupteurs) ; le typage ne fait plus que l'afficher sur ses fiches, à
  titre d'information — d'autres modules pourront classer les pièces ailleurs
- v0.4.3 : colonnes « AO » et « Réponse AO », explication en haut de la liste, un type
  par ligne
- v0.4.4 : aucun type rangé au départ, l'utilisateur choisit ; message à l'activation
  du module, rappel à l'ouverture tant que la liste est vide (désactivable)
- v0.4.5 : le rangement voyage avec les types exportés et importés (données jointes
  par le module AO au fichier d'échange du typage)
- v0.4.6 : la fenêtre **Formats de fichiers** dit, pour chaque format, s'il est lu par
  Black Projects, écrit par Black Projects, et affiché dans Obsidian (les `.json`
  d'export ne le sont pas par défaut, et le message d'export le dit)
- v0.4.7 : une fiche par extension, trois par ligne, colorée d'après ces constats
  (verte, orange, rouge avec ce qui est à venir) ; un interrupteur par type pour
  l'afficher dans Obsidian, ouvert par la visionneuse de Black Projects
- v0.4.8 : constats « Lu, Écrit, Affiché » ; un export compte pour l'écriture (« Export
  uniquement » : JSON, PDF) ; « Oui nativement » ; la fenêtre ne remonte plus quand on
  bascule un interrupteur
- Doc : [modules/ao.md](modules/ao.md) ; recette : [recette/etape-2.md](recette/etape-2.md)

**Jalon de démo n° 1 :** « je dépose le ZIP du dossier, toutes les pièces sont lues »
— vérifié sur le dossier d'exemple (`test/ao-dce.test.ts`).

### Étape 3 — Socle des exigences (module `exigences`) ✅ *terminée (v0.5.0)*

- Un **module à part** (`src/modules/exigences/`), comme la lecture de fichiers et le
  typage des pièces, plutôt qu'un morceau du cœur : l'analyse d'appels d'offres s'en
  servira à l'étape 4, d'autres modules ensuite
- Repris : `reqId`, `Requirement`, `reqAlias`, `reqYaml`, `reqBlockFields`, `reqBlock`,
  `reqFence`, `reqNote`, et leurs tests (134)
- Réécrit : `RequirementStore` sur les ports (fichiers, YAML lu par la plateforme), les
  réglages et l'attribution des identifiants, la recherche des exigences (le dossier des
  exigences, sous-dossiers compris)
- Format de la version complète, sous les noms `brt-requirement` / `brt-req` (v0.5.1) ;
  les anciens noms `pm-requirement` / `pm-req` restent lus
- Fenêtre « Exigences » simplifiée : liste, recherche, filtres, fiche ; commandes
  « Nouvelle exigence », « Modifier l'exigence » ; bloc `brt-req` dessiné dans les notes
- Cœur : écriture YAML, `ui.pickFromList`, champ `textarea`, blocs de code des modules
- v0.5.1 : le bloc s'appelle `brt-req` et la clé d'en-tête `brt-requirement`
- Doc : [modules/exigences.md](modules/exigences.md) ; recette :
  [recette/etape-3.md](recette/etape-3.md)

**Jalon :** créer, modifier et relire une exigence — vérifié (`flows.test.ts`).

### Étape 4 — Extraction des exigences du dossier ✅ *terminée (v0.6.0)*

- Repris dans le module `exigences` (`import/`) : `reqCsv` (plan d'import), `reqXlsxRead`
  (tableaux), `reqDocxRead` (documents : Word, et PDF, HTML, Markdown par les mêmes
  blocs), `reqPptxRead`, `reqifRead` (ReqIF et ReqIFz), le rédacteur ReqIF (pour les
  essais aller-retour), et leurs tests ; `ReqPorter` réécrit sur le magasin du module
- Ajout : chaque exigence trouvée garde **où** — section, tableau et ligne, paragraphe,
  feuille, objet ReqIF, diapositive — et l'exigence importée son **origine** (pièce ou
  fichier, et endroit), dans l'en-tête de sa note (`origin`) et en tête de son corps
- L'extraction depuis un PDF est sortie de la vue des exigences : `extractRequirements`
  lit tout format par le module Lecture de fichiers
- Module AO : « Extraire les exigences de la pièce » (aperçu, puis import dans le dossier
  `Exigences` de l'analyse ; les identifiants du dossier sont gardés), la liste des
  exigences dans la note de chaque pièce et le tableau « Exigences du dossier » dans la
  note de l'analyse ; « Mettre à jour les exigences de l'analyse »
- Module Exigences : « Importer des exigences d'un fichier » (ReqIF de DOORS compris) ;
  un identifiant d'un autre format devient un alias
- Pas repris : `reqJson` / `reqJsonImport` (sauvegarde de la bibliothèque en JSON), sans
  usage pour l'analyse d'un dossier
- Doc : [modules/exigences.md](modules/exigences.md), [modules/ao.md](modules/ao.md) ;
  recette : [recette/etape-4.md](recette/etape-4.md)

- v0.6.1 : **vérifier les exigences du dossier** — quatre commandes (tout extraire,
  exigences oubliées, cohérence entre pièces, couverture par la réponse) et une qui les
  enchaîne ; un rapport dans l'analyse. Sans IA : la couverture est une estimation par
  les mots, que l'IA affinera avec la matrice de conformité (étape 7)

**Jalon de démo n° 2 :** les exigences du CCTP extraites et tracées jusqu'à leur pièce —
vérifié sur le dossier d'exemple, en Word, PDF et Markdown (`test/dce-exigences.test.ts`,
`test/ao-exigences.test.ts`).

### Étape 5 — Analyse qualité sans IA ✅ *terminée (v0.7.0)*

- Repris dans le module `exigences` (`quality/`) : `reqQuality` (règles de rédaction FR/EN),
  `reqScore` (six axes ISO/IEC/IEEE 29148, étoiles), `reqSimilar` (doublons par les
  lettres ; la partie par le sens est venue à l'étape 6), `ReqCoverage` (rattachements) — et
  leurs tests (81)
- Ajout : une note **sur la seule rédaction** (`wording`) pour les exigences d'un
  dossier, qui n'ont ni responsable, ni fiche, ni liens chez nous ; une phrase sans
  obligation y a deux étoiles au plus
- Vue « Analyse du dossier » : la note `Analyse/Qualité des exigences` de l'analyse
  (commande « Analyser la qualité des exigences du dossier ») — nombre d'exigences,
  répartition des notes, moyenne par axe, défauts les plus fréquents, doublons probables,
  exigences non vérifiables, les plus faibles, chacune ; la même pour la bibliothèque
  (rattachements en plus)
- La note dans la liste (colonne et filtre), la fiche, et la colonne `rating` des blocs
  `brt-req`
- Doc : [modules/exigences.md](modules/exigences.md), [modules/ao.md](modules/ao.md) ;
  recette : [recette/etape-5.md](recette/etape-5.md)

**Jalon de démo n° 3 :** analyse complète hors ligne, sans serveur d'IA — vérifié sur le
CCTP d'exemple (`test/ao-qualite.test.ts`).

### Étape 6 — IA locale ✅ *terminée (v0.8.0)*

- Nouveau module **`ia`** : repris `llm/protocol` (et ses tests), `llm/client` réécrit
  sur le port `Http` (types de la version complète) ; les autres modules s'en servent
  s'il est actif (`aiClient()`), sinon le disent
- Repris dans le module `exigences` (`ai/`) : `promptTemplate`, `reqQualityLlm` (la
  classe de relecture réécrite en fonctions `deepReview` / `reviewWording`), `reqAdvice`,
  la partie utile de `translate` (garde des chiffres et unités), `ReqEmbeddings`
  (`semanticDuplicates`) — et leurs tests
- Réglages de connexion au **serveur d'IA de l'entreprise** : adresse, modèle (choisi par « Tester la
  connexion » parmi ceux du serveur), modèle d'embeddings facultatif, longueur des
  réponses ; la **clé dans le trousseau d'Obsidian** (nouveau port `SecretStore`, champ
  de réglage `secret`), jamais dans le coffre ; tout serveur compatible OpenAI reste
  utilisable
- Exigences : « Relire l'exigence avec l'IA » (avis, défauts que les règles ne voient
  pas, reformulations par axe faible ; la relecture dans la note, une reformulation
  retenue seulement si on la choisit) et « Traduire l'exigence avec l'IA » (marquée à
  relire, chiffres comparés) ; aussi dans le menu de la liste
- Qualité (bibliothèque et dossier) : les **doublons par le sens** avec un modèle
  d'embeddings
- AO : **Calendrier de l'appel d'offres** (`deadlines`, sans IA) — date limite de
  remise, validité des offres, délais, livraisons, chacun avec sa phrase source et sa
  pièce (`Analyse/Calendrier.md`)
- AO : **Interroger le dossier** (`libraryRetrieval`, `eachDocument`) — recherche des
  passages ou lecture de chaque pièce ; réponse qui cite ses sources `[n]`, liées aux
  pièces ; rien trouvé, l'IA n'est pas appelée (`Analyse/Questions/`) ; et le
  **questionnaire** prêt à l'emploi : critères d'attribution, pénalités, garanties,
  propriété intellectuelle, confidentialité, contrôle export (`Analyse/Questionnaire.md`)
- AO : **Relire les exigences du dossier avec l'IA** — les plus faibles cochées ; côté
  candidat, la formulation de l'acheteur n'est jamais changée
- Doc : [modules/ia.md](modules/ia.md), [modules/exigences.md](modules/exigences.md),
  [modules/ao.md](modules/ao.md) ; recette : [recette/etape-6.md](recette/etape-6.md)

- v0.8.1 : **un modèle par usage**, comme dans la version complète — analyse,
  traduction, vecteurs, reranking (les passages trouvés remis dans l'ordre avant la
  réponse), lecture OCR et lecture par vision (pour l'étape 7) ; chacun choisi dans la
  liste des modèles du serveur, filtrée selon l'usage

**Jalon de démo n° 4 :** l'IA relit, conseille et répond en citant ses sources — vérifié
sur le dossier d'exemple avec un serveur simulé (`test/ao-ia.test.ts`).

### Étape 6 bis — Workflows ✅ *terminée (v0.9.0)*

- Nouveau module **`workflows`** : repris de la version complète le modèle (conditions,
  variables, jours relatifs, planification) et l'échange JSON ; le moteur réécrit ; les
  déclencheurs et les actions **ouverts aux modules** (`registerTrigger`,
  `registerAction`, `registerTemplate`, `emitWorkflowEvent`)
- Déclencheurs à la main et à heure fixe ; AO : analyse créée, pièces importées,
  exigences extraites ; Exigences : exigence créée
- Actions : prévenir, écrire une note, ajouter à une note ; AO : calendrier, qualité,
  cohérence, couverture, interroger le dossier (IA), questionnaire (IA) ; Exigences :
  qualité de la bibliothèque, relecture (IA) ; IA : demander à l'IA
- Mode « demander d'abord » ou « tout seul », résultats passés d'étape en étape
  (`{step1.link}`), journal dans le coffre, garde-fou contre les boucles, workflows prêts
  à l'emploi, export et import
- Cœur : `ModuleContext.timers` (minuterie des workflows planifiés)
- Doc : [modules/workflows.md](modules/workflows.md) ; recette :
  [recette/etape-6-workflows.md](recette/etape-6-workflows.md)

**Jalon :** le dossier se traite seul — calendrier relevé dès le dépôt des pièces,
qualité analysée dès l'extraction des exigences (`test/ao-workflows.test.ts`).

### Étape 6 ter — Accueil et interface ✅ *terminée (v0.10.0)*

- **Architecture de l'interface** ([architecture/interface.md](architecture/interface.md)) :
  `src/ui/` en Preact, la même dans Obsidian et dans l'application de bureau ; les modules
  décrivent ce qu'ils montrent en données (`src/core/views.ts`), l'interface dessine ; les
  frontières vérifiées par `check:modules` et ESLint
- **Page d'accueil** : un onglet « Black Projects » (icône, commande, ouverture au
  démarrage) ; actions rapides et une carte par analyse — date limite de remise en jours
  restants, pièces, exigences, qualité, ce qui reste à faire ; l'IA et un modèle par
  usage ; la bibliothèque d'exigences en chiffres ; les dernières exécutions des
  workflows ; rafraîchie quand le coffre change
- **Thèmes** : clair, sombre, automatique ; couleurs pour les daltonismes (rouge-vert,
  bleu-jaune, monochrome) ; lecture facilitée pour les troubles dys ; taille du texte ;
  mouvement réduit — contraste AA vérifié pour chaque palette
- **Démonstration hors d'Obsidian** (`pnpm run demo`) : la même interface, les vrais
  modules, un coffre en mémoire
- Recette : [recette/etape-6-interface.md](recette/etape-6-interface.md)
- v0.11.0 : **toutes les fenêtres redessinées** avec les composants de `src/ui` — choix,
  formulaires, confirmations, cases à cocher, messages, listes, textes, et la fenêtre
  « Fonctions » de chaque module ; plus aucune fenêtre propre à Obsidian, mêmes thèmes et
  même accessibilité partout (focus gardé, clavier, erreurs annoncées)
- v0.12.0 : **accueil à tuiles** modifiable par l'utilisateur (ajouter, retirer, déplacer
  à la souris ou au clavier ; pastilles : prochaine remise, exigences faibles, échecs de
  workflows, IA pas réglée) ; les informations passent dans une page **Tableau de bord**
- v0.12.1 : correctif d'affichage dans Obsidian — les styles des boutons d'Obsidian ne
  déforment plus les tuiles, la navigation ni les boutons de l'interface
- v0.13.0 : **tableau de bord rangé par l'utilisateur** — réduire une section, la masquer,
  la déplacer (glisser-déposer ou boutons, d'une colonne à l'autre) ; rangement gardé
- v0.13.1 : la navigation de gauche reste en place quand la page défile
- v0.13.2 : un même écart entre les blocs de chaque section du tableau de bord
- v0.14.0 : **barre de gauche rangée par l'utilisateur** — Accueil toujours en haut,
  Paramètres toujours en bas ; entre les deux, déplacer, retirer, ajouter toute fonction
- v0.14.1 : « Modifier le menu » en bas, sous la séparation, juste au-dessus de Paramètres
- v0.15.0 : **pages des modules** — « Analyses » ouvre une page (chiffres, cartes,
  recherche, filtres) au lieu d'une fenêtre de choix
- v0.16.0 : la page **Exigences** (la bibliothèque en chiffres, une carte par exigence,
  recherche et filtres) au lieu de la liste en fenêtre
- v0.17.0 : la page **Workflows** (chiffres, une carte par workflow avec Exécuter et
  Activer/Désactiver, le journal récent) au lieu de la liste en fenêtre
- v0.18.0 : la page **IA** (la connexion en chiffres, une carte par usage avec « Choisir le
  modèle », ce qui se sert de l'IA) ; les réglages restent dans la fenêtre du module
- v0.19.0 : la **fiche d'un workflow en page** (conditions et actions en cartes, chaque
  bouton une opération) au lieu d'une suite de fenêtres ; pages à paramètre
- v0.20.0 : la **fiche d'une analyse en page** (pièces, calendrier, exigences, ce qu'elle a
  produit ; chaque bouton agit sur elle, sans « Dans quelle analyse ? »)
- v0.21.0 : la **fiche d'une exigence en page** (formulations par langue, qualité axe par
  axe en mots, fiche, liens, historique), depuis la bibliothèque ou une analyse
- v0.22.0 : un vrai **retour à la page précédente** (bouton, Alt + ←, souris)
- v0.23.0 : la **fiche d'une pièce en page** (texte lisible, dates et délais, exigences
  extraites, chaque bouton agit sur elle)
- v0.24.0 : la **fiche d'un candidat en page** (émetteur : sa réponse et la couverture des
  exigences par elle, les absentes d'abord)
- v0.25.0 : le **journal des workflows en page** ; un clic sur une exécution ouvre la fiche
  du workflow
- v0.26.0 : la **fiche d'une exécution** (issue, sujet, étapes, notes écrites, autres
  exécutions) ; un clic sur une exécution y mène
- v0.27.0 : une **note produite en page** (calendrier, vérification, qualité,
  questionnaire, question) : lisible sans la syntaxe, les liens vers les fiches, « Mettre
  à jour » sans quitter la page ; le bloc `text` du cœur
- v0.28.0 : une **question au dossier en page** (la réponse, une carte par source citée ou
  non avec ses extraits, « Reposer la question ») ; « Interroger » depuis l'interface y
  mène
- v0.29.0 : le **questionnaire en page** (une carte par thème et son état, « Remplir le
  questionnaire », « Reposer » un thème seul) et la page d'un thème (sa réponse, ses
  sources)
- v0.30.0 : la **qualité des exigences en page**, calculée à l'ouverture (une carte par
  exigence, la plus faible d'abord ; défauts, doublons, axes) ; « Écrire le rapport »
- v0.31.0 : la **vérification des exigences en page**, calculée à l'ouverture (extraction,
  oubliées, cohérence, couverture par candidat) ; « Tout vérifier », « Tout extraire »,
  « Ajouter des oubliées » sans quitter la page
- v0.32.0 : le **calendrier en page**, relevé à l'ouverture (la remise et ses jours
  restants, « À retenir », les dates dans l'ordre, les délais) ; « Écrire le calendrier » ;
  la page générique d'une note produite ne sert plus qu'aux notes sans page à elles
- v0.33.0 : les **paramètres en page** dans l'onglet (`src/core/settingsPage.ts`) : la
  langue, l'accueil au démarrage, la documentation, la licence, l'apparence, une carte par
  module (état, « Fonctions », Activer / Désactiver) ; l'onglet d'Obsidian reste
- v0.34.0 : les **fonctions d'un module en page** dans l'onglet (le contenu de sa fenêtre :
  ses réglages, ce qu'il sait faire) ; les liens des modules et la page Paramètres y
  mènent
- v0.35.0 : la **documentation en page** dans l'onglet (sommaire, chaque page lisible,
  liens entre pages, précédente / suivante) sans l'écrire d'abord ; le lecteur Markdown
  passe dans le cœur (`src/core/markdown.ts`) : blocs de code, phrase et liste dans un
  cadre, puces de texte
- v0.36.0 : depuis le journal des workflows, la fiche d'une exécution ouvre son **sujet** et
  ses **notes écrites en page** (la fiche de l'analyse, le calendrier, une exigence) :
  `views.notePage` et `ModuleContext.showNote`
- v0.37.0 : les **raccourcis du tableau de bord** (Calendrier, Interroger, Questionnaire,
  et les tuiles Vérifier, Qualité) ouvrent les pages ; « Ajouter un routage… » pour le
  rangement des types de pièces
- v0.38.0 : **importer des pièces** depuis l'interface se termine sur la fiche de l'analyse
  (plus sa note) ; « Nouvelle analyse » ouvre la fiche de l'analyse créée
- v0.39.0 : **mettre à jour l'analyse** depuis sa fiche : les fichiers déposés sont lus et
  rangés, la fiche se redessine (plus sa note)
- v0.40.0 : **extraire les exigences** depuis la fiche d'une pièce (ou sa carte) : l'aperçu,
  puis la page se redessine (plus la note de la pièce)
- v0.41.0 : **déplacer une pièce** depuis l'interface : la fiche suit la pièce (ou celle de
  l'analyse se redessine), plus sa note
- v0.42.0 : **changer le type** d'une pièce propose de la déplacer selon le routage du
  nouveau type (ou de la laisser)
- v0.43.0 : **relire les exigences** : la page Qualité ensuite, les relues marquées ; la
  relecture se lit sur la fiche de l'exigence
- v0.44.0 : **traduire les exigences** : la fiche ensuite, où la traduction se lit (chiffres
  qui diffèrent, note de l'IA) et se valide ; en série depuis la bibliothèque, filtre
  « Traductions à relire »
- v0.45.0 : **importer des exigences** : la page de l'import ensuite (« Importées de … » :
  créées, mises à jour, non importées, d'où chacune vient), retrouvée depuis la fiche

### Étape 7 — Livrables

- Repris : générateurs `xlsx` et `docx`, `reqXlsx`, `reqDocx`
- Reporté de l'étape 6 : la couverture des exigences par la réponse affinée par l'IA
  (pour la matrice) ; la lecture des scans et des images par le modèle de vision du
  serveur d'IA
- Matrice de conformité (Excel), rapport d'analyse (Word)
- Deux modes d'analyse, choisis à la création de l'analyse :
  - **émetteur** : relecture de son propre dossier avant publication — qualité des
    exigences, cohérence entre pièces (CCTP, CCAP, RC, BPU), clauses manquantes,
    ambiguïtés qui feraient poser des questions aux candidats ;
  - **répondant / évaluateur** : analyse d'un dossier reçu (go / no go, risques,
    exigences à satisfaire) et d'une offre face au dossier — matrice de conformité,
    fiche d'analyse adaptée de `visaSheet`, avis motivé
- Fiche de synthèse propre à chaque mode
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

1. **Texte de la licence** à faire valider par un juriste (voir
   [architecture/propriete-et-licences.md](architecture/propriete-et-licences.md)).
2. **Accès au serveur d'IA du client** pour les essais : adresse, modèles disponibles (texte,
   embeddings, vision), et conditions d'accès depuis le poste de démonstration.

Tranchées : position d'analyse (les deux), serveur d'IA (celui du client, compatible OpenAI, jamais nommé dans le logiciel).
