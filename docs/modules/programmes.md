# Module — Programmes (`programmes`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `programmes` |
| Version | 0.1.0 (Black Projects 0.109.0) |
| Emplacement | `src/modules/programmes/` |
| Interface publique | `src/modules/programmes/index.ts` |
| Requiert | — |
| Utilisé par | [Analyse d'appels d'offres](ao.md) (la sorte de phase « Analyse d'appel d'offres ») |

Documentation utilisateur (écrite dans le coffre) : `src/modules/programmes/doc/Programmes.md`.

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
