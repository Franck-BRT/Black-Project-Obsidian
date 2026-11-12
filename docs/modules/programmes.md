# Module — Programmes (`programmes`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `programmes` |
| Version | 0.10.0 (Black Projects 0.128.0) |
| Emplacement | `src/modules/programmes/` |
| Interface publique | `src/modules/programmes/index.ts` |
| Requiert | — |
| Utilisé par | [Analyse d'appels d'offres](ao.md) (la sorte de phase « Analyse d'appel d'offres ») |

Documentation utilisateur (écrite dans le coffre) : `src/modules/programmes/doc/Programmes.md`.

## Les phases des projets repliées sur les programmes ; se passer des types (v0.10.0, Black Projects 0.128.0)

- Sur **Programmes** et sur la page d'un programme (vue Parcours), le parcours miniature de
  chaque projet est **repliable** (`fold` du bloc `journey`, `id` : `<page>|<chemin du projet>`),
  replié d'origine ; son titre (qui ouvre le projet) et son sous-titre (avancement) restent.
- `exchange.ts` : `typesFile` (JSON `{ format, sorte: 'types-de-projet', exporte, types }`),
  `typesFileName`, `readTypesFile` (`'unreadable'`, `'other'`, ou les types relus par
  `readProjectType`), `mergeTypes` (déjà là au même contenu, identifiant mis à part : laissé ;
  un nom pris : « <nom> (importé) » ; un identifiant pris : un libre).
- Actions : `export-type` (page d'un type), `export-types` et `import-types` (Types de projet) ;
  les fichiers dans `Échanges/Types de projet` (un second export du jour : « (2) »).

## « Ses phases » repliable (v0.9.1, Black Projects 0.127.1)

- Sur la page d'un projet, le parcours (ou les cartes) des phases est dans une section
  `programmes.projet.phases`, **repliée d'origine** (`collapsed: true`) ; son en-tête dit
  l'avancement et la phase en cours (« 0/9 phases · à venir : Veille »). Dépliée ou repliée, le
  choix est retenu comme pour les autres sections (`black-projects.sections-repliees`).

## Les répertoires des documents d'un type ; la vue retenue (v0.9.0, Black Projects 0.127.0)

- `ProjectType.folders` : un arbre de `FolderSpec` (`id`, `name`, `expects` — des codes de types
  de pièce —, `children`) ; l'éditeur de type le décrit (`addFolder`, `updateFolder`,
  `removeFolder`, `findFolder`) ; `flatFolders` le met à plat (chemins, profondeurs).
- À la création d'un projet : copié dans `Project.folders` (`repertoires` dans la note :
  `nom`, `attendus`, `sous`), et créé dans la bibliothèque des documents projet. La page du projet
  recrée ceux qui manquent et dit, répertoire par répertoire, les types attendus reçus ou non (le
  type de pièce des documents : `LibraryDocRef.category`).
- La vue choisie (et tout regroupement) est gardée d'une ouverture à l'autre (`core/grouping` :
  stockage local `black-projects.regroupements`).

## La vue : parcours, cartes, liste, tableau (v0.8.0, Black Projects 0.126.0)

Le sélecteur « Vue » (la place du regroupement d'une page) des pages programmes, programme et
projet : `parcours` (d'origine), `cards`, `list`, `table` (`PROGRAMMES_VIEWS`, retenu par page,
`groupingOf`). Hors parcours, les projets (`projectCard`) et les phases (`phaseCard`) sont des
cartes, et la page n'offre que cet affichage (`layouts: [vue]`) : les programmes et les affaires
le suivent.

## Les documents d'un programme, d'un projet (v0.7.0, Black Projects 0.123.0)

- Créés, un programme et un projet ont leur répertoire dans la bibliothèque des documents
  projet (`projectDocumentsFolder`) ; leurs pages, une section **Documents du programme** /
  **du projet** (ouvrir, verser, voir dans la bibliothèque) et la page entière reçoit des fichiers
  glissés-déposés (`dropDocumentsInto`). Ceux du programme : à la racine de son répertoire ;
  ceux du projet : tout son répertoire.

## Les documents de référence (v0.6.0, Black Projects 0.121.0)

- `Programme.references` et `Project.references` : les fiches des documents appelés, écrites en
  liens (`references: ["[[…]]"]`) dans l'en-tête de la note (`readReferences`).
- Le magasin : `setReferences(path, records)` (programme ou projet), `callersOf(record)`,
  `referenceMoved(from, to)`.
- Les pages programme et projet : la section **Documents de référence** (choisir — par
  `chooseReferenceDocuments` de la bibliothèque —, ouvrir la fiche, ne plus l'appeler). Pas
  d'héritage : un projet n'a que les siens.
- Déclaré à la bibliothèque par `registerReferenceCallers` (oublié à la désactivation).

## Plus d'icônes (v0.5.0, Black Projects 0.113.0)

Les programmes, les types de projet et les phases ont **61 icônes** au choix (20 avant) :
équipe, personne, affaire, budget, facture, achats, livraison, colis, archives, signature,
juridique, qualité, récompense, jalon, objectif, idée, présentation, communication, courrier,
téléphone, alerte, lien, accès, formation, maintenance, conception, intégration, essais,
performance, énergie, production, électronique, logiciel, données, serveur, cloud,
international, site, fusée, satellite, environnement. Elles sont dessinées pour Black Projects
(`src/ui/icons.tsx`, `IconName` dans `src/core/views.ts`) ; la liste est **rangée par nom**, et
dans la liste ouverte, **taper les premières lettres** d'un choix y mène (« fu » : Fusée ;
toute liste à aperçus de l'interface).

## Le recalage des dates prévues ; « Phase technique » (v0.4.0, Black Projects 0.112.0)

Les dates prévues d'un projet démarré sont **recalées** à chaque lecture (`replanPhases(phases,
start, today)`, `model.ts`) : une phase terminée garde ses vraies dates (début, fin) ; une phase
en cours va de son début au plus tard de sa fin prévue et d'aujourd'hui ; une phase à venir
commence au plus tôt aujourd'hui ; l'étape suivante commence le lendemain de la fin la plus
tardive. Le calcul pur (`planPhases`) est gardé comme **planning initial** — `initialDebut`,
`initialFin` dans l'en-tête de chaque phase — refait au démarrage, à une durée changée, ou s'il
manque. Le retard (`isLate`) se mesure sur la fin du planning initial ; le décalage
(`slipOf`, `daysBetween`) se lit sur les tuiles (« +5 j »), la page d'une phase (« planning
initial : du … au … ») et la fin prévue du projet (« décalée de 12 j, initialement le … »).

Le champ « Sorte » d'une phase s'appelle **Phase technique** (phase libre, ou celle d'un
module).

## Un nouveau type de document, depuis les documents attendus (v0.3.1, Black Projects 0.111.1)

La fenêtre des documents attendus a un bouton **Nouveau type de document** (le module Typage des
pièces actif) : sa fenêtre (code, libellé) s'ouvre par-dessus ; le type créé rejoint la liste
des types de pièce (`createPieceType` de la bibliothèque), en tête de la fenêtre, coché. Le port
`Ui` : `PickManyView.create` (`{ label, run() }` — le choix créé s'ajoute, coché).

## Le planning ; les documents attendus (v0.3.0, Black Projects 0.111.0)

- **Durées** : une phase d'un type a sa durée prévue (`PhaseSpec.duration`, en jours
  calendaires) ; un projet la copie (`duree`).
- **Démarrage** : « Démarrer le projet » (sa date, `demarrage` dans l'en-tête) ; les **dates
  prévues** de toutes ses phases en découlent (`planPhases`, `prevuDebut` / `prevuFin`,
  recalculées à chaque enregistrement) : les phases d'une étape commencent ensemble ; l'étape
  suivante le lendemain de la fin de la plus longue ; sans durée ou sans objet, un jour sans
  retarder la suite. Changer la durée d'une phase (« Ses dates ») décale les suivantes.
- **Retard** (`isLate`) : la fin prévue passée, la phase ni terminée ni sans objet — sa tuile
  dit « En retard », la page du projet le compte sous la fin prévue.
- **Documents attendus** : dans le type, l'interrupteur « Des documents sont attendus », puis
  les types de pièce (plusieurs ; ceux de la lecture des types de pièces : `libraryPieceTypes`) —
  `PhaseSpec.documents` ; un projet les copie (`documents` : `type`, `recu`, `lien`, `le`). Sur la
  page de la phase : leur liste (attendu, reçu le…), **Reçu** / **Pas encore reçu**, **Relier le
  fichier** (il est alors reçu), **Documents attendus** pour en ajouter ou en retirer ; la tuile
  dit « 1/3 documents ».
- Modifier une phase d'un type la réécrit tout entière (`replacePhase`) : une durée, des
  documents, une description retirés disparaissent.
- Le type de départ « Réponse à un appel d'offres » a des durées et attend des documents
  (analyse : RC, CCAP, CCTP ; rédaction : mémoire ; chiffrage : BPU ; remise : AE).

## Les phases englobantes ; les icônes dans la liste (v0.2.0, Black Projects 0.110.0)

- Un type de projet a des **phases englobantes** (`ProjectType.spans`, `SpanSpec` : `id`,
  `name`, `color`, `from`, `to` — ses première et dernière étapes, à partir de 0), dessinées en
  **bandeaux** au-dessus des étapes qu'elles couvrent (`JourneySpan` du bloc `journey`, sur une
  grille alignée sur les colonnes ; deux qui se chevauchent vont l'une sous l'autre). Le type de
  départ « Réponse à un appel d'offres » en a deux : **Avant-vente** (étapes 1 à 5) et
  **Contrat** (6 à 8).
- Dans l'éditeur : **Phase englobante** (nom, de l'étape, à l'étape, couleur), chaque bandeau se
  modifie ou se retire. Quand les étapes changent (une phase déplacée, une étape ajoutée ou
  disparue), un bandeau suit ses phases (`remapSpans`) ; plus aucune : il disparaît.
- Un projet les copie (`englobantes` dans son en-tête : `id`, `nom`, `couleur`, `de`, `a`, ses
  étapes à partir de 1) ; leur bandeau dit où il en est : « 1/6 phases », terminé quand toutes
  ses phases le sont (ou sans objet), en cours dès que l'une est commencée.
- Les listes **Couleur** et **Icône** : un bouton (le choix et son aperçu) ouvre une liste où
  chaque choix a son icône ou sa couleur à gauche (la liste du navigateur ne sait pas les
  montrer) ; flèches, Entrée, Échap.

## Les couleurs et les icônes se voient ; plus d'« Analyses » au menu (v0.1.1, Black Projects 0.109.1)

- Dans ses fenêtres, les listes **Couleur** et **Icône** montrent à côté celle choisie (la
  couleur en tuile, l'icône) : `Choice.preview` (`{ color?, icon? }`), dessiné par les fenêtres
  du port `Ui`.
- Le menu n'a plus « Analyses » (le module AO ne déclare plus d'entrée) : les analyses sont des
  phases des projets ; leur page reste ouverte par sa tuile, sa commande, et les phases.

## Ce qu'il fait (v0.1.0, Black Projects 0.109.0)

- **Programmes → projets → affaires**, des notes du coffre (`store.ts`) :
  `<dossier>/<Programme>/<Programme>.md` (`bp-type: programme` : `code`, `couleur`, `icone`,
  `description`, `creeLe`) ; `<Programme>/<Projet>/<Projet>.md` (`bp-type: projet` :
  `programme`, `type`, `typeNom`, `couleur`, `icone`, `creeLe`, `phases` — chacune `id`, `nom`,
  `sorte`, `icone`, `couleur`, `etape`, `statut` — `a-venir`, `en-cours`, `terminee`,
  `sans-objet` —, `debut`, `fin`, `lien`) ; `<Projet>/Affaires/<Affaire>.md`
  (`bp-type: affaire` : `projet`, `programme`, `client`, `reference`, `statut` — `en-cours`,
  `gagnee`, `perdue`, `abandonnee` —, `creeLe`). Seul l'en-tête est réécrit ; la suite de la
  note (« Notes ») est à l'utilisateur.
- **Types de projet** (`types.ts`, réglage `typesProjet`) : des étapes de phases
  (`ProjectType.stages: PhaseSpec[][]`) ; jamais réglés, ceux de départ (`starterTypes` :
  « Réponse à un appel d'offres », « Projet simple »). Les fonctions d'édition sont pures :
  `addStage`, `addParallel`, `updatePhase`, `removePhase`, `movePhase` (gauche, droite, haut,
  bas), `newType`, `copyType`. Les phases d'un projet sont **copiées** de son type à sa création.
- **Sortes de phase** (`kinds.ts`) : `registerPhaseKind({ id, label, icon, color, detail?,
  actions, blocks? })` — un module déclare ce que fait une phase de sa sorte (ses boutons, ce
  qu'en dit la tuile, ses blocs sur la page de la phase), reçoit un `PhaseContext` (`project`,
  `phase`, `link(path | null)`, `setStatus`). Sans module, la phase est libre. Le module AO
  déclare `ao.analyse` (`AO_KIND`).
- **Pages** (`home.ts`) : `programmes` (les programmes en cartes colorées, tous les projets en
  parcours miniatures), `programmes.programme`, `programmes.projet` (le parcours de ses phases,
  ses affaires), `programmes.phase` (son état, ses dates, les actions de sa sorte),
  `programmes.types` (les types dessinés) et `programmes.type` (l'éditeur graphique : chaque
  phase a ses outils, « + Phase en parallèle », « + Étape »). Une entrée du menu
  « Programmes » (avant « Analyses ») et deux tuiles.
- Les dessins sont des blocs `journey` du contrat des pages (voir
  [l'interface](../architecture/interface.md)).
