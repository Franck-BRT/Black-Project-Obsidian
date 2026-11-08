# Module — Analyse d'appels d'offres (`ao`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `ao` |
| Version | 0.33.0 (Black Projects 0.66.0) |
| Requiert | [Lecture de fichiers](lecture-fichiers.md) (`lecture-fichiers`), [Typage des pièces](typage-pieces.md) (`typage-pieces`), [Exigences](exigences.md) (`exigences`) |
| S'appuie sur | [IA](ia.md) (`ia`), s'il est actif : questions au dossier, questionnaire, relecture |
| Emplacement | `src/modules/ao/` |
| Interface publique | `src/modules/ao/index.ts` |
| État | Étape 2 livrée : analyses, import du dossier (ZIP compris), typage et notes des pièces |

Documentation utilisateur (écrite dans le coffre) :
`src/modules/ao/doc/Analyse d'appels d'offres.md`.

## Ce que fait le module (étape 2)

| Commande | Rôle |
| --- | --- |
| Nouvelle analyse d'appel d'offres | Formulaire (nom, position candidat / émetteur, acheteur, référence) ; crée le dossier et la note ; propose ensuite d'importer, de déposer, ou plus tard |
| Importer des pièces dans une analyse (ZIP compris) | Fichiers de l'ordinateur ; un ZIP est ouvert (sous-dossiers gardés, archive imbriquée ouverte, fichiers parasites écartés, noms Windows en page 437 relus) |
| Mettre à jour l'analyse (pièces déposées à la main) | Lit les fichiers de `Pièces/Originaux` qui n'ont pas de note ; réécrit le tableau |
| Changer le type de la pièce | Sur la note d'une pièce ; le tableau suit |
| Déplacer la pièce (appel d'offres ↔ réponse) | Sur la note d'une pièce : original et note changent de dossier, place mise à jour, tableau réécrit (v0.4.1) |
| Extraire les exigences de la pièce | Sur la note d'une pièce, ou depuis la note de l'analyse (choix de la pièce) : aperçu, puis import dans `Exigences/` de l'analyse (v0.5.0) |
| Mettre à jour les exigences de l'analyse | Réécrit la liste des exigences de chaque pièce et le tableau « Exigences du dossier » |
| Vérifier les exigences du dossier (les quatre vérifications) | Les quatre commandes suivantes, l'une après l'autre (v0.6.0) |
| Extraire les exigences de toutes les pièces | Toutes les pièces de l'appel d'offres en un aperçu ; la première pièce fait foi pour un identifiant |
| Chercher les exigences oubliées | Phrases à tournure normative non reprises ; proposées à l'ajout, rien de coché d'avance |
| Vérifier la cohérence des exigences entre pièces | Formulations différentes, absente d'une version, doublon, même texte, exigence rangée qui diffère |
| Vérifier la couverture des exigences par la réponse | Citée, traitée (≥ 60 %), à vérifier (35-60 %), absente ; un tableau par candidat pour l'émetteur |
| Analyser la qualité des exigences du dossier | `Analyse/Qualité des exigences.md` : notes sur la seule rédaction, défauts, doublons, non vérifiables (v0.7.0) |

Les commandes visent l'analyse de la note ouverte, sinon demandent laquelle.

## Appel d'offres et réponse (v0.4.1)

Chaque pièce est rangée avec l'**appel d'offres** ou avec la **réponse** — pour
l'émetteur, la réponse d'un candidat nommé. La place vient du **rangement** de son type,
réglé dans ce module (voir plus bas) ; pour « les deux », et pour savoir de
quel candidat est la réponse, `importFiles` reçoit un `PlacementResolver` qui pose la
question **une fois pour tout l'import** (fenêtre « Où ranger ces pièces ? », avec
« Tout mettre dans »). Renoncer annule l'import sans rien écrire. Les fichiers déposés à
la main prennent la place du dossier où ils sont (`destinationOf`). Les analyses d'avant
la v0.4.1 (`Pièces/Originaux`, notes sans `place`) restent lisibles, comptées avec
l'appel d'offres.

## Où vont les types de pièces (v0.4.2)

Réglage `rangement` du module (code du type → `appel-d-offres`, `reponse` ou
`les-deux`), dans la fenêtre du module, sous **Dossier des analyses** :

- **Ajouter un routage…** ouvre une petite fenêtre : le type (parmi ceux qui ne sont pas
  encore dans la liste), un interrupteur **AO** (avec l'appel d'offres) et un
  **Réponse AO** (avec la réponse) ;
- la liste dépliable **Types rangés (n)** commence par l'explication des deux colonnes,
  puis montre chaque type **sur une seule ligne** (libellé coupé par « … » si besoin,
  entier en infobulle) avec ses deux interrupteurs (au moins un allumé ; les deux : la
  question est posée à l'import) et une corbeille qui le retire de la liste (v0.4.3).

**Au départ, la liste est vide** (v0.4.4) : c'est à l'utilisateur de choisir. Un type
absent de la liste, et AUTRE, sont demandés à l'import ; sur la fiche du type, dans le
typage, l'information dit « pas encore rangé — demandé à l'import ».

### Le message à l'activation, et le rappel à l'ouverture (v0.4.4)

`explainPlacement(context)`, lancé à l'activation sans la bloquer, tant que la liste est
vide (`placementMessage`) :

- **première activation** (`accueilVu` absent) : la fenêtre « Analyse d'appels
  d'offres : où ranger les pièces ? » explique quoi faire ; boutons **Plus tard** et
  **Régler maintenant** (ouvre la fenêtre du module) ; `accueilVu` passe à `true` ;
- **ouvertures suivantes** : « Rappel : aucun type de pièce rangé », avec la case **Ne
  plus me le rappeler à l'ouverture** ; cochée, `rappelOuverture` passe à `false`.
  L'interrupteur **Rappel à l'ouverture** de la fenêtre du module le rétablit.

Rien ne s'affiche dès qu'un type est rangé. Le message passe par le port `ui.inform`
(fenêtre `MessageModal`, montrée quand l'espace de travail est prêt) ; « Régler
maintenant » par `context.openWindow()` ; l'interrupteur est un champ `boolean` du
contrat de module.

Le rangement suit le **renommage** d'un type dans le typage (`renameRangement`) ; un
type supprimé disparaît de la liste. Sur la fiche de chaque type, dans la fenêtre
**Types de pièces**, le module affiche à titre d'information où il le range
(`annotateTypes` du module de typage).

Le réglage générique qui dessine cela est un champ `toggles` du contrat de module
(`TogglesField` : colonnes, `read`, `candidates`, `write`), dessiné par
`src/obsidian/moduleDetailsModal.ts` ; le formulaire d'ajout utilise le nouveau champ
`toggle` de `askForm`.

Le rangement **voyage avec les types exportés** (v0.4.5) : le module s'inscrit auprès du
typage (`extendTypeExchange`) ; chaque type rangé porte dans le fichier
`"modules": { "ao": { "rangement": "reponse" } }`, affiché « va dans : Réponse AO » dans
les listes d'export et d'import ; à l'import, le rangement des types importés est repris
(ceux déjà rangés ici prennent la valeur du fichier, les autres restent).

Reprise de la v0.4.1 (`migratePlaces`) : `typage-pieces.placesTypes` devient
`ao.rangement` (seulement les choix de l'utilisateur) et quitte les réglages du typage.

## Les exigences du dossier (v0.5.0, étape 4)

`requirements.ts` : l'extraction (`extractRequirements`), l'aperçu et l'écriture
(`previewImport`) sont ceux du module [Exigences](exigences.md) ; l'AO choisit où elles
vont et les trace.

- **Où** : `requirementsAt('<analyse>/Exigences')` — un magasin d'exigences limité au
  dossier de l'analyse : le plan d'import ne voit que les exigences de cette analyse (deux
  appels d'offres peuvent avoir chacun leur `EX-SOL-001`), et les identifiants attribués
  passent par les compteurs de la bibliothèque.
- **Identifiants** : ceux du dossier sont gardés (`EX-SOL-001`) ; sans identifiant, la
  catégorie est le type de la pièce (`REQ-CCTP-0001`) ; un identifiant d'un autre format
  devient un alias.
- **Trace** : `origin.piece` = lien vers la note de la pièce, `origin.locator` = l'endroit
  (« Article 2 — Exigences, tableau 1, ligne 2 »). La note de la pièce reçoit la liste de
  ses exigences avant son texte ; la note de l'analyse, le tableau « Exigences du
  dossier » avant la section Notes — tous deux entre `<!-- bp:exigences:debut -->` et
  `<!-- bp:exigences:fin -->`, réécrits à chaque extraction.

## Vérifier les exigences (v0.6.0)

`verification.ts` : les quatre vérifications et le rapport ; les calculs eux-mêmes sont
ceux du module Exigences (`check/`), sans IA. Le rapport est la note
`<analyse>/Analyse/Vérification des exigences.md` (`bp-type: ao-verification`) : un
résumé (entre `<!-- bp:verif:resume:… -->`, d'après les champs `extraction`, `oubliees`,
`coherence`, `couverture` de son en-tête, datés), puis une section par vérification
(`<!-- bp:verif:<clé>:debut -->` / `fin`), puis Notes. Pièces de l'appel d'offres : celles
dont la place est `appel-d-offres` ; de la réponse : `reponse` (par candidat pour
l'émetteur).

## Calendrier et IA (v0.8.0, étape 6)

| Commande | Ce qu'elle fait | IA |
| --- | --- | --- |
| Calendrier de l'appel d'offres | dans les pièces de l'appel d'offres, les dates (`findDates`) et les délais (`findDelays`, « sous 15 jours », « fixé à 120 jours »…), chacun avec sa phrase et sa pièce, reconnus par leur nature (`kindOf` : remise, validité, questions, visite, pénalités, livraison, démarrage, notification, autre) ; « À retenir » : la date limite de remise et la validité des offres. Note `Analyse/Calendrier.md` | non |
| Interroger le dossier (IA) | une question ; **recherche** (par défaut) : les passages des pièces lues qui y répondent le mieux (BM25 sur les mots de la question, article nommé donné en entier — `ask/retrieval.ts`), numérotés `Source [n]`, seuls donnés au modèle, qui cite `[n]` ; **lecture de chaque pièce** : chaque pièce lue partie par partie, ce qui répond relevé, puis une réponse d'ensemble (`ask/eachDocument.ts`). Rien trouvé : le modèle n'est pas appelé. Une question de délais reçoit aussi les dates relevées. Note `Analyse/Questions/<date> <question>.md` : la question, la réponse (chaque `[n]` devient un lien vers la pièce), les sources (citée / non citée) et les extraits transmis ; une citation sans source est signalée | oui |
| Questionnaire du dossier (IA) | six questions prêtes (critères d'attribution, pénalités, garanties, propriété intellectuelle, confidentialité, contrôle export), cochées ; chacune posée en recherche, avec des mots de recherche en plus (`ao.q.<clé>.terms`) ; `Analyse/Questionnaire.md`, une section par question entre `<!-- bp:questionnaire:<clé>:debut -->` / `fin`, écrite après chaque question | oui |
| Relire les exigences du dossier avec l'IA | les exigences de l'analyse, les plus faibles cochées d'avance (moins de trois étoiles ; à défaut, celles qui ne sont pas parfaites) ; chacune relue par `reviewRequirement` du module Exigences (portée `wording`), la relecture dans sa note. Émetteur : une reformulation peut être retenue ; candidat : la formulation de l'acheteur n'est jamais changée | oui |

Les sources sont les **notes des pièces** lues (section « Texte extrait », sans les
sections tenues par Black Projects) : une citation mène à la note, qui mène à l'original.

## Workflows (v0.9.0)

`workflows.ts` déclare au module [Workflows](workflows.md) trois déclencheurs (analyse
créée, pièces importées, exigences extraites — signalés par `index.ts` après création,
import, mise à jour, extraction d'une pièce ou vérifications qui ajoutent des
exigences), six actions sans fenêtre (calendrier, qualité, cohérence, couverture,
interroger le dossier et questionnaire avec l'IA ; chacune vise l'analyse nommée,
`{analyse}` par défaut) et trois workflows prêts à l'emploi.

## L'accueil (v0.10.0)

`home.ts` décrit la section « Analyses d'appels d'offres » de l'[accueil](../architecture/interface.md) : les actions rapides, et une carte par analyse — date limite de remise (relevée dans les pièces de l'appel d'offres, la prochaine, sinon la dernière), pièces et non lues, exigences, qualité moyenne (portée `wording`), badges de ce qui reste à faire ; « Ouvrir », « Importer des pièces », « Calendrier », « Interroger » (si l'IA est réglée). Navigation « Analyses ».

## La page « Analyses » (v0.15.0)

`home.ts` déclare aussi la **page** `ao.analyses` (`views.page`, voir
[l'interface](../architecture/interface.md#les-pages-des-modules-v0150)) : les chiffres
(analyses, remises sous 30 jours, pièces à lire, exigences faibles), les actions rapides,
une carte par analyse (la même que sur le tableau de bord, avec ses `tags` : position,
`a-venir`, `sous-30-jours`, `a-lire`, `faibles`), une recherche et des filtres. L'entrée
« Analyses », la tuile « Analyses », la commande `analyses` (« Ouvrir les analyses
d'appels d'offres ») et le lien « Toutes les analyses » de la section du tableau de bord
l'ouvrent par `context.showPage`. Sans page chez la plateforme (`showPage` absent), on
retrouve la fenêtre pour choisir une analyse. Tests : `test/ao-page.test.ts`.

## La fiche d'une analyse (v0.12.0, Black Projects 0.20.0)

`home.ts` déclare la page `ao.fiche?<note encodée>` (`analysisPageOf`, `parent` : la liste) :
le titre (le nom), « ← Toutes les analyses », en tête les actions (importer, mettre à jour,
calendrier, vérifier, qualité ; avec l'IA interroger, questionnaire, relire ; la note), les
chiffres (remise en jours restants, pièces, exigences, qualité), les pièces en groupes de
cartes par destination (type, état, caractères ; Changer le type, Déplacer, Extraire les
exigences), le calendrier, les exigences les plus faibles d'abord (15 au plus) et les notes
du dossier `Analyse/`. Recherche et filtres (`a-lire`, `appel-d-offres`, `reponse`). Les
boutons lancent les commandes habituelles **sur cette analyse ou cette pièce**
(`HomeDeps.runFor` : `index.ts` pose la cible le temps de la commande — `chooseAnalysis`
et les commandes de pièce la prennent avant la note ouverte). La carte d'une analyse
(liste, tableau de bord) ouvre la fiche quand la plateforme a des pages, sa note sinon.
Tests : `test/ao-page.test.ts`.

## La fiche d'une pièce (v0.13.0, Black Projects 0.23.0)

`home.ts` déclare la page `ao.piece?<note encodée>` (`piecePageOf`, `parent` : les
analyses) : le nom du fichier d'origine en titre, « type — libellé · destination · analyse »,
en tête Changer le type, Déplacer (si la pièce a bougé, retour à son analyse), Extraire les
exigences (pièce lue), sa note, son fichier d'origine, son analyse ; l'aide de son état
quand elle n'est pas lue ; les chiffres ; le début du texte (`readableText` : sans titres
« ### » ni syntaxe de tableau, 1 500 caractères au plus) ; les dates et délais relevés dans
elle seule (`calendarOf` sur sa source) ; les exigences dont l'origine la désigne
(`linkedNote`). La carte d'une pièce, sur la fiche de l'analyse, ouvre sa fiche.

## La fiche d'un candidat (v0.14.0, Black Projects 0.24.0)

Pour l'émetteur, la fiche d'une analyse montre une carte par candidat (`listCandidates`)
avec sa couverture ; la page `ao.candidat?<note encodée>&<nom encodé>`
(`candidatePageOf`, `parent` : les analyses) montre sa réponse (les cartes de ses pièces)
et la couverture des exigences par elle, calculée à l'affichage sans rien écrire
(`candidateCoverage`, `verification.ts` : les pièces de réponse de ce candidat seulement) :
le pourcentage citées ou traitées, à vérifier, absentes ; la liste, les absentes d'abord,
avec l'endroit (`describeWhere`) et l'extrait. « Écrire le rapport de couverture » lance
`couverture-reponse` sur l'analyse. La démonstration a deux candidats (Acme Spatial,
Orbital Services).

**Le rapport de couverture sans quitter la fiche (v0.29.0, Black Projects 0.54.0)** :
« Écrire le rapport de couverture » lance `couverture-reponse` avec `stay` — le rapport
de vérification est écrit, sa note ne s'ouvre plus, la fiche se redessine (« Mettre à
jour le rapport de couverture » une fois écrit) ; le message ajoute « Le rapport de
vérification de l'analyse est à jour » (comme pour toutes les vérifications lancées de
l'interface). « Ouvrir la vérification » mène à sa page. Revue du module à cette
occasion : chaque action lancée de l'interface finit maintenant sur une page ; seules les
commandes de la palette ouvrent encore des notes, comme avant.

## Les workflows système (v0.30.0, Black Projects 0.59.0)

Les automatismes de l'AO sont des workflows système (`workflows.ts`, `registerSystemWorkflow`),
avec de nouvelles actions : `ao.note-pieces` (`refreshTable`), `ao.note-exigences`
(`refreshRequirements`), `ao.rappel-remises` (champ « jours », `7, 3, 1, 0` : les analyses
dont la remise — `calendarOf` — tombe à autant de jours), `ao.rappel-rangement`
(`explainPlacement(context, 'reminder')`). `Services.noteByWorkflow` : quand le module
Workflows a le workflow système de la note (`systemWorkflowManages`), l'import, la mise à
jour et l'extraction ne réécrivent plus la note eux-mêmes — le workflow le fait à
l'évènement, ou pas s'il est désactivé. Le rappel du rangement à l'activation n'a plus lieu
quand le module Workflows est actif (l'accueil, une fois, reste). Les trois modèles prêts à
l'emploi (calendrier, contrôle, questionnaire) sont devenus des workflows système, avec la
couverture d'une réponse importée et le rappel des remises.

**La bibliothèque de documents (v0.31.0, Black Projects 0.61.0)** : `importFiles` et
`updateAnalysis` versent chaque pièce dans la [bibliothèque](bibliotheque.md)
(`pourIntoLibrary`, en place : les originaux de l'analyse ; catégorie : le type de pièce ;
origine : l'analyse et sa note). Sans le module Bibliothèque, rien.

**Trois nouveaux workflows système (v0.33.0, Black Projects 0.66.0)**. Ce qui reste en dur,
volontairement : le message d'accueil à la première activation (avant que les workflows
n'existent) et le retypage des pièces quand un type est renommé (la cohérence des
données).

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Rappel des questions et de la visite (`sys.ao.rappel-echeances`) | chaque jour à 8 h | `ao.rappel-echeances` (champ « jours », `3, 1, 0`) : la date limite des questions et la visite de site (`calendarOf`, natures `questions`, `visite`) qui tombent à autant de jours | actif |
| Rappel de la fin de validité des offres (`sys.ao.validite-offres`) | chaque jour à 8 h | `ao.validite-offres` (champ « jours », `7, 1`) : une fois la remise passée, la fin de validité (`validityEnd` : sa date, sinon son délai — jours, semaines, mois — compté depuis la remise) | désactivé |
| Extraire les exigences du CCTP à l'import (`sys.ao.extraire-cctp`) | pièces importées, `types` contient CCTP | `ao.extraire` (champs `analyse`, `type`) : pour les pièces de l'import de ce type, l'aperçu d'extraction (`extractFromPiece`), puis `emitExtracted` — les workflows des exigences extraites passent après | désactivé |

## Une note produite, en page (v0.15.0, Black Projects 0.27.0)

Sur la fiche d'une analyse, « Ce que l'analyse a produit » liste les notes du dossier
`Analyse/` ; un clic ouvre la page `ao.note?<chemin encodé>` (`producedPageOf`, `parent` :
les analyses ; sans pages chez la plateforme, la note dans le coffre). `noteBlocks`
(`src/core/markdown.ts` depuis Black Projects 0.35.0, la documentation s'en sert aussi) lit le Markdown en blocs : sans l'en-tête ni les marques `<!-- bp:… -->` ;
le `#` est le titre de la page ; chaque `##` / `###` l'intitulé du bloc qui suit ; un
tableau devient une liste (la première cellule en titre, les autres en détail, « — »
écartés) ; une liste à puces, une liste (« **Libellé** : suite » : le libellé en titre) ;
une puce ou un passage cité en retrait complète l'élément du dessus ; un encadré
`> [!warning]` devient un message ; un paragraphe, un bloc `text` (nouveau bloc du cœur,
cherché comme les listes). Les marques 🟩 ✅ / 🟧 ⚠️ / 🟥 ❌ donnent le ton de la ligne et
disparaissent ; liens, gras, italique, code sont lus sans leur syntaxe. Le premier lien
d'une ligne dit ce qu'elle ouvre : la fiche de la pièce, de l'exigence, de l'analyse, sinon
la note. En tête : **Ouvrir la note** ; **Ouvrir l'analyse**. Une note disparue : la page
le dit. Depuis Black Projects 0.32.0, chaque note écrite par Black Projects a sa page à
elle (calendrier, vérification, qualité, questionnaire, questions) : cette page générique
ne sert plus qu'aux autres notes rangées dans `Analyse/` (une synthèse écrite à la main),
et son « Mettre à jour » a disparu avec elles.

## Une question au dossier, en page (v0.16.0, Black Projects 0.28.0)

La fiche d'une analyse liste « Questions au dossier (n) » — les notes de
`Analyse/Questions/`, la plus récente d'abord : la question en titre, la date, « k
source(s) citée(s) sur n » (vert si au moins une citée, orange sinon) ; elles ne sont plus
dans « Ce que l'analyse a produit ». Un clic ouvre `ao.question?<chemin encodé>`
(`questionPageOf`, `parent` : les analyses ; la page `ao.note` d'une question y renvoie).
`readQuestion` (`produced.ts`) relit la note : la question (l'encadré `[!question]`), le mode
et la date (l'en-tête), la réponse et ses avertissements, les sources (`1. [[pièce|titre]] —
endroit — *citée*` et leurs extraits `   > …`), les notes de l'utilisateur. La page : la
question en titre, « analyse · date · mode » ; les chiffres (sources transmises, citées,
non citées, extraits) ; le rappel de vérifier ; la réponse (les citations `\[[[…|1]]\]`
lues « [1] ») ; une carte par source — « [n] titre », l'endroit, Citée / Non citée, les
extraits entre guillemets, un clic ouvre la fiche de la pièce — filtres Citées / Non
citées ; vos notes. En tête, avec l'IA : **Reposer la question** (la fenêtre d'« Interroger »,
la question et le mode déjà remplis ; la réponse va dans une nouvelle note) et **Nouvelle
question** ; puis la note, l'analyse. `HomeDeps.ask(analysis, preset?)` : depuis
l'interface, la réponse s'ouvre sur sa page (`askAnalysis(…, preset, show)`) ; la commande
de la palette ouvre toujours la note. La démonstration a une question posée (les
pénalités, Station sol) et un serveur d'IA simulé qui répond en citant le premier extrait.

## Le questionnaire, en page (v0.17.0, Black Projects 0.29.0)

« Questionnaire », sur la fiche d'une analyse (quand la plateforme a des pages), ouvre
`ao.questionnaire?<chemin encodé de Analyse/Questionnaire.md>` (`questionnairePageOf`,
`parent` : les analyses) — aussi la note « Questionnaire » de « Ce que l'analyse a
produit », et la page `ao.note` de cette note. La page s'ouvre avant que la note existe.
`readQuestionnaire` (`produced.ts`) relit la note : pour chacun des six thèmes
(`QUESTIONNAIRE`, titres `ao.q.<clé>`), posé ou non, la date et la question (« *Posée le
… :* … »), la réponse, ses avertissements et ses sources (« ### Sources », lues comme
pour une question : `sourcesOf`) ; les notes de l'utilisateur. Un thème est **répondu**
(une source citée), **sans source citée** (l'IA a répondu sans citer : à vérifier),
**rien dans les pièces** (aucun passage : l'IA n'a pas été interrogée) ou **pas encore
posé**. La page : les chiffres (thèmes posés, citées, sans source citée, rien dans les
pièces, pas encore posés), filtres par état, une carte par thème (la question si pas
posée, sinon le début de la réponse ; sources citées ; **Reposer** / **Poser la
question**) ; en tête **Remplir le questionnaire** (le choix des thèmes, comme la
commande), la note, l'analyse. Un thème : `ao.questionnaire.theme?<chemin>&<clé>`
(`questionnaireItemPageOf`) — la question posée, puis le même corps que la page d'une
question (`answerView` : chiffres, réponse, une carte par source) ; **Reposer cette
question**, **Tout le questionnaire**, la note. Reposer et remplir passent par
`runFor('questionnaire', { analysis, stay: true, keys? })` : `keys` pose ces thèmes sans
la fenêtre de choix ; la note n'est pas ouverte, la page se redessine. Les extraits
transmis sont lus sans les titres de la pièce (« ### CCAP »).

## La qualité des exigences, en page (v0.18.0, Black Projects 0.30.0)

« Qualité du dossier », sur la fiche d'une analyse (quand la plateforme a des pages),
ouvre `ao.qualite?<chemin encodé de Analyse/Qualité des exigences.md>` (`qualityPageOf`,
`parent` : les analyses) — aussi la note « Qualité des exigences » de « Ce que l'analyse a
produit », et la page `ao.note` de cette note. Rien n'est relu dans le rapport : la page
est **calculée à l'ouverture** sur les exigences de l'analyse (`assessAll(…, 'wording')`,
comme le rapport : la seule rédaction, l'acheteur l'a écrite). Elle montre les chiffres
(exigences, note moyenne, faibles, non vérifiables, doublons probables) ; une carte par
exigence, la plus faible d'abord (ses défauts `describeFinding` en sous-titre, ses
étoiles `rating`, sa formulation, les axes qui lui coûtent, badges Faible / Non
vérifiable / Doublon probable ; un clic ouvre sa fiche) avec les filtres Faibles, Non
vérifiables, Doublons probables, Bonnes ; puis les défauts les plus fréquents, les
doublons probables (`probableDuplicates`, par la lettre : les doublons par le sens, qui
demandent l'IA, restent au rapport), chaque axe de la norme et la répartition des notes
(les notes données seulement). En tête : **Écrire le rapport** / **Mettre à jour le
rapport** (`runFor('qualite-exigences', { analysis, stay: true })` : la note n'est pas
ouverte), **Ouvrir le rapport** s'il existe, **Relire (IA)**, l'analyse. Sans exigence :
un message dit comment en avoir.

## La vérification des exigences, en page (v0.19.0, Black Projects 0.31.0)

« Vérifier », sur la fiche d'une analyse (quand la plateforme a des pages), ouvre
`ao.verification?<chemin encodé de Analyse/Vérification des exigences.md>`
(`verificationPageOf`, `parent` : les analyses) — aussi la note « Vérification des
exigences » de « Ce que l'analyse a produit », et la page `ao.note` de cette note. La page
est **calculée à l'ouverture** par `verificationNow` (`verification.ts`), qui ne propose
ni n'écrit rien et ne lit qu'une fois les pièces de l'appel d'offres : ce que chaque pièce
porte d'exigences (ou ce qui empêche de les extraire), les phrases à tournure d'exigence
qu'aucune ne reprend (`missedRequirements`), les constats de cohérence (`coherence`), la
couverture des exigences par chaque réponse (`coverage`, une par candidat pour
l'émetteur). Elle montre les chiffres (exigences dans les pièces, oubliées, incohérences,
couverture — l'écart entre candidats s'il y en a plusieurs), puis une liste par
vérification, numérotée comme le rapport, chaque élément avec son filtre (Extraction,
Exigences oubliées, Cohérence, Couverture) : un clic ouvre la fiche de la pièce ou de
l'exigence ; la couverture, les absentes d'abord. En tête : **Tout vérifier**
(`verifier-exigences`, mis en avant tant qu'il n'y a pas de rapport), **Tout extraire**
(s'il y a des exigences dans les pièces), **Ajouter des oubliées** (s'il y en a), le
rapport, l'analyse — tous par `runFor(…, { analysis, stay: true })` : les aperçus d'ajout
s'ouvrent, la note n'est pas ouverte, la page se redessine.

## Le calendrier, en page (v0.20.0, Black Projects 0.32.0)

« Calendrier », sur la fiche d'une analyse (quand la plateforme a des pages), ouvre
`ao.calendrier?<chemin encodé de Analyse/Calendrier.md>` (`calendarPageOf`, `parent` : les
analyses) — aussi la note « Calendrier » de « Ce que l'analyse a produit », et la page
`ao.note` de cette note. La page est **relevée à l'ouverture** (`calendarOf` sur les pièces
lues de l'appel d'offres, sans IA, sans rien écrire) : les chiffres (la date limite de
remise et ses jours restants — la prochaine, sinon la dernière passée —, la validité des
offres, les dates à venir, les délais) ; l'avertissement des années supposées s'il le
faut ; « À retenir » (la remise, la validité, ou « non trouvé ») ; les dates dans l'ordre,
chacune avec « J-n », sa phrase et ses pièces ; les délais. Une remise est rouge à une
semaine, orange à trois, verte au-delà, partout pareil. Un clic ouvre la fiche de la
première pièce qui la porte ; filtres À venir, Passées, Délais. En tête : **Écrire le
calendrier** / **Mettre à jour la note** (`runFor('calendrier', { analysis, stay: true })` :
la note n'est pas ouverte), **Ouvrir la note** si elle existe, l'analyse. Sans pièce lue :
un message dit d'importer le dossier.

## Les notes d'une analyse ouvertes par un autre module (v0.21.0, Black Projects 0.36.0)

`notePageOf` (`home.ts`), déclaré par `views.notePage` quand la plateforme a des pages :
la note de l'analyse → sa fiche ; une pièce → sa fiche ; une exigence de l'analyse → sa
fiche ; `Analyse/Calendrier.md`, `Vérification des exigences.md`, `Qualité des
exigences.md`, `Questionnaire.md` → leur page ; `Analyse/Questions/…` → la page de la
question ; une autre note du dossier Analyse → la page générique ; sinon rien (la note
s'ouvre). Un workflow qui a écrit le calendrier d'une analyse y mène ainsi, sans connaître
le module.

## Les raccourcis du tableau de bord en page (v0.22.0, Black Projects 0.37.0)

Quand la plateforme a des pages, les raccourcis ouvrent la page de l'analyse plutôt que la
commande (qui écrivait la note puis l'ouvrait) — `shortcut(deps, commande)` : sur le tableau
de bord, **Calendrier**, **Interroger**, **Questionnaire** ; sur l'accueil, les tuiles
Calendrier, Interroger, Questionnaire, Vérifier, Qualité. L'analyse : la seule s'il n'y en
a qu'une, sinon « Dans quelle analyse ? » (`chooseAnalysisFor`) ; aucune : le message.
Puis la page du calendrier, de la vérification, de la qualité, du questionnaire, ou
« Interroger » (la réponse sur sa page). Le bouton **Calendrier** d'une carte d'analyse
ouvre la page de son calendrier, sans rien demander. Sans pages : les commandes, comme
avant. Le bouton du rangement des types s'appelle **Ajouter un routage…**, et sa fenêtre
se valide par **Ajouter un routage** (`TogglesField.addSubmitKey`).

## Importer des pièces depuis l'interface (v0.23.0, Black Projects 0.38.0)

Lancé depuis l'interface — le bouton de la fiche d'une analyse ou d'un candidat, d'une carte
du tableau de bord, le raccourci et la tuile **Importer des pièces** (`shortcut`, l'analyse
choisie s'il y en a plusieurs) —, un import se termine sur la **fiche de l'analyse**, dans
l'onglet, au lieu d'ouvrir sa note (`importInto(…, show)`). Le choix des fichiers et « Où
ranger ces pièces ? » restent des fenêtres. **Nouvelle analyse** (tuile, raccourci, page des
analyses : `runFor('nouvelle-analyse', { stay: true })`) ouvre la fiche de l'analyse créée,
et l'import qui suit y revient. La palette de commandes ouvre toujours la note.

**Mettre à jour l'analyse** depuis sa fiche (v0.24.0, Black Projects 0.39.0) :
`runFor('mettre-a-jour', { analysis, stay: true })` — les fichiers déposés à la main dans
les originaux sont lus et rangés, le compte rendu s'affiche, et la fiche se redessine avec
les nouvelles pièces ; sa note ne s'ouvre pas. Depuis la palette, la note, comme avant.

**Extraire les exigences** depuis l'interface (v0.25.0, Black Projects 0.40.0) : la fiche
d'une pièce et sa carte sur la fiche de l'analyse lancent `extraire-exigences` avec
`stay` — l'aperçu s'ouvre, les exigences acceptées sont rangées, puis la page d'où l'on
vient se redessine (le nombre d'exigences de la pièce, la liste de l'analyse) ; la note de
la pièce ne s'ouvre plus. Depuis la palette, la note, comme avant.

**Déplacer une pièce** depuis l'interface (v0.26.0, Black Projects 0.41.0) : la commande
reçoit `stay` et `moved` (la suite, une fois la pièce déplacée) — depuis la fiche de la
pièce, la fiche suit la pièce à sa nouvelle place ; depuis sa carte sur la fiche de
l'analyse, la fiche se redessine (la pièce sous sa nouvelle destination). Sa note ne
s'ouvre plus ; depuis la palette, comme avant. La fiche d'une pièce qui n'est plus à
cette place (« Retour » vers l'ancienne) montre la même pièce — même nom, même analyse —
là où elle est maintenant.

**Changer le type, puis le routage** (v0.27.0, Black Projects 0.42.0) : après « Changer le
type », si le routage du nouveau type (`placeOf(type, rangementOf(…))`) met la pièce
ailleurs que là où elle est — et n'est pas « les deux » —, la commande propose de la
déplacer : « Déplacer avec Réponse » (ou l'appel d'offres) ; pour l'émetteur vers la
réponse, « Déplacer avec la réponse de X » par candidat, ou un nouveau candidat ; ou « La
laisser avec … » (le routage du type ne change pas). Déplacée depuis sa fiche, la fiche
suit la pièce ; depuis sa carte, la fiche de l'analyse se redessine (`moved`, comme
« Déplacer »). Aucune question si le type n'est pas routé ou l'est déjà là où est la pièce.

**Relire les exigences** depuis l'interface (v0.28.0, Black Projects 0.43.0) : « Relire
(IA) » de la fiche de l'analyse, de la page Qualité ou de la tuile (`stay`) : le choix des
exigences, la relecture de chacune, puis la **page Qualité**, où chaque exigence relue
porte « Relue (IA) le … » (`lastReview` du module Exigences) et répond au filtre « Relues
(IA) » ; un clic ouvre sa fiche, qui montre la relecture. Depuis la palette, le message
seul, comme avant.

## Dans le coffre

```
<dossier des analyses>/<Nom>/            (« Appels d'offres » par défaut, réglable)
├── <Nom>.md        bp-type: ao-analyse ; position, acheteur, référence, date ;
│                   tableau des pièces (une partie par destination) entre
│                   <!-- bp:pieces:debut --> et <!-- bp:pieces:fin -->
│                   ; exigences du dossier (bp:exigences)
├── Pièces/
│   ├── Appel d'offres/
│   │   ├── Originaux/  les fichiers tels que reçus
│   │   └── <pièce>.md  bp-type: ao-piece ; type, place, [candidat], fichier, format,
│   │                   lecture, caracteres, importee ; texte extrait
│   ├── Réponse/              candidat (même forme)
│   └── Réponses/<candidat>/  émetteur (même forme)
├── Exigences/      une note par exigence extraite (étape 4) : <identifiant>.md
└── Analyse/        Vérification des exigences.md (v0.6.0), Qualité des exigences.md
                    (v0.7.0), Calendrier.md, Questionnaire.md, Questions/ (v0.8.0)
```

- **Noms des notes** : `CCTP.md` ; si une autre pièce porte déjà ce nom dans un autre
  format, `CCTP (pdf).md` ; ensuite des numéros.
- **Doublons** : un fichier identique à un original déjà présent n'est pas réimporté ;
  un fichier différent du même nom devient `RC (2).pdf`.
- **États de lecture** : `lue`, `sans-texte` (scan), `image`, `non-lue` (format non
  lu), `illisible` (abîmé ou mot de passe).
- **Types de pièces** : reconnus par le module [Typage des pièces](typage-pieces.md)
  (`typage-pieces`), qui tient aussi les types et mots-clés de l'utilisateur, les types
  désactivés et l'échange de types. L'AO s'en sert par son interface publique
  (`classifyPiece`, `typeDisplay`, `allTypes`…) et suit ses renommages
  (`onTypingChange` → `applyRenames`). Jusqu'à la v0.3.5, tout cela était dans l'AO.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `index.ts` | Interface publique, déclaration du module, commandes, réglage du dossier, fenêtre « Fonctions » |
| `service.ts` | Créer, lister, importer, mettre à jour, changer le type — sans fenêtre, testé sur un coffre en mémoire |
| `notes.ts` | Forme des notes et des dossiers ; tableau des pièces |
| `requirements.ts` | Extraire les exigences d'une pièce ; listes d'exigences des notes de pièce et d'analyse |
| `verification.ts` | Les quatre vérifications et le rapport « Vérification des exigences » |
| `quality.ts` | L'analyse de qualité des exigences de l'analyse (étape 5) ; doublons par le sens avec l'IA |
| `deadlines.ts` | Dates et délais d'un texte, avec leur phrase (repris de la version complète) |
| `calendar.ts` | Le calendrier de l'appel d'offres (étape 6) |
| `ask/retrieval.ts`, `ask/eachDocument.ts` | Trouver les passages qui répondent ; lire chaque pièce (repris : `libraryRetrieval`, `eachDocument`) |
| `ask/sources.ts` | Les pièces lues comme sources |
| `ask/dossier.ts` | Interroger le dossier, la note d'une question, le questionnaire |
| `review.ts` | Relire les exigences du dossier avec l'IA |
| `i18n.ts` | Textes, infobulles comprises |
| `doc/` | Page de documentation écrite dans le coffre |

Le module s'appuie sur l'interface publique de `lecture-fichiers` (`readArchive`,
`fileText`, `isReadable`, `isImage`) et sur `core/frontmatter.ts` pour lire et modifier
l'en-tête des notes.

## Tests

- `typing.test.ts` : le typage vu de l'AO (import, tableau, types désactivés, retypage
  après renommage, changement de type).
- `service.test.ts` : création, import, ZIP, doublons, mise à jour, changement de type,
  noms des notes, ordre du tableau.
- `test/ao-dce.test.ts` : le dossier d'exemple compressé en ZIP, importé, chaque pièce
  lue et typée.
- `step6.test.ts`, `deadlines.test.ts`, `ask/*.test.ts` : calendrier, questions citées,
  questionnaire, relecture (étape 6).
- `test/ao-ia.test.ts` : **jalon n° 4** sur le dossier d'exemple, serveur simulé.

- `test/ao-workflows-echeances.test.ts` : les trois nouveaux workflows système (créés,
  questions à J-3 et visite à J-1, rien dans les jours dits, fin de validité comptée
  depuis la remise, rien avant la remise, extraction du CCTP à l'import, désactivé).

**Pièces sans type reconnu (Black Projects 0.64.0)** : le déclencheur *Pièces importées*
donne aussi `nontypees` (« Pièces sans type reconnu » : celles classées « Autre »), que lit
le workflow système du [typage des pièces](typage-pieces.md).
