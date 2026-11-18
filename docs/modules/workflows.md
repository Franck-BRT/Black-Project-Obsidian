# Module — Workflows (`workflows`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `workflows` |
| Version | 0.30.0 (Black Projects 0.162.0) |
| Requiert | — |
| Utilisé par | [Analyse d'appels d'offres](ao.md), [Exigences](exigences.md), [IA](ia.md) : leurs déclencheurs, actions et workflows prêts à l'emploi |
| Emplacement | `src/modules/workflows/` |
| Interface publique | `src/modules/workflows/index.ts` |

Documentation utilisateur (écrite dans le coffre) : `src/modules/workflows/doc/Workflows.md`.


## Valider les échecs (v0.30.0, Black Projects 0.162.0)

- **Valider les échecs**, en tête de la page Workflows et du journal (quand il y a des échecs à
  voir) : les échecs vus et traités ne comptent plus — « Échecs récents », la pastille de la tuile
  Workflows, « Dernière exécution en échec » sur la carte et la fiche du workflow, le filtre « En
  échec ». Ils **restent au journal**, marqués « Échec validé » (plus en rouge) ; le chiffre « Échecs »
  du journal dit « dont n validé(s) ».
- **Valider cet échec**, sur la fiche d'une exécution en échec.
- Un nouvel échec compte de nouveau. Les échecs validés sont gardés dans les réglages du module
  (`echecsValides` : leurs lignes du journal) ; ceux sortis du journal sont oubliés à la validation
  suivante. La note du journal n'est pas modifiée.

## Qui se sert d'une entrée de la bibliothèque (v0.29.0, Black Projects 0.159.0)

- `workflowsUsing(field, name)` : les workflows (utilisables) dont une étape nomme une entrée dans
  un champ (`prompt`, `persona`, `skill`), sans tenir compte des accents ni de la casse — leurs
  étapes, actifs ou non, système ou non. `workflowPageOf(id)` : la page d'un workflow.

## Ce qui s'exécute en ce moment ; arrêter (v0.28.0, Black Projects 0.154.0)

- Le moteur tient la liste des étapes en cours (`RunningStep` : le workflow, son sujet, le rang, la
  sorte et les champs de l'action — aussi pour une action seule, `runActionNow`) : `runningSteps()`,
  et `onRunningChange(listener)` pour être prévenu à chaque étape.
- `stopRunning(subjectPath)` : le workflow de ce sujet s'arrête avant son étape suivante (journal :
  ⛔ « Arrêté à votre demande, avant l'étape n », sans message d'échec) ; `stopRequested(subjectPath)`
  permet à une action en cours de ne pas appliquer ce qu'elle a trouvé. La demande est oubliée
  quand l'exécution finit.

## Ce qu'il fait

Automatiser : *quand ceci arrive, si cela tient, faire ceci*. Un workflow a un
**déclencheur**, des **conditions** sur ce qui est arrivé (le *sujet*), des **actions** à
la suite, et un **mode** (« tout seul » ou « demander d'abord »). Chaque exécution est
écrite dans le **journal** (`Black Projects/Workflows/Journal des workflows.md`, dossier
réglable), la plus récente en tête, 300 gardées.

| Commande | Rôle |
| --- | --- |
| Workflows : liste et modification | la liste (filtre actif/désactivé, recherche) ; une ligne ouvre la fiche : nom, mode et déclencheur ; conditions ; actions (ajouter, modifier, monter, descendre, retirer) ; exécuter maintenant ; activer/désactiver ; dupliquer ; supprimer |
| Nouveau workflow | de zéro, ou d'après un workflow prêt à l'emploi déclaré par un module |
| Exécuter un workflow | à la main ; le sujet est demandé par le déclencheur (`pickSubject`) s'il en faut un |
| Journal des workflows | ouvre le journal |
| Exporter / Importer des workflows | JSON (`format: black-projects-workflows`) ; à l'import, chaque partie est vérifiée, ce qui est inconnu laissé de côté et compté, chaque workflow repris **désactivé** |

## Un module ouvert

Le module ne connaît d'avance que ce qu'il fait lui-même : déclencheurs **À la main**
(`manuel`) et **À heure fixe** (`planifie` : chaque jour, jours ouvrés, chaque semaine,
chaque mois, à HH:MM ; **et à l'ouverture d'Obsidian**, en option depuis 0.25.0) ; actions **Prévenir** (`notifier`), **Écrire une note**
(`creer-note`), **Ajouter à une note** (`ajouter-note`). Le reste est **déclaré par les
modules** à leur activation, par l'interface publique :

| Fonction | Rôle |
| --- | --- |
| `registerTrigger(spec)` | un déclencheur : `id` préfixé (`ao.pieces-importees`), libellés, les **champs** du sujet (testables en condition, repris en `{variables}`), et `pickSubject` pour une exécution à la main |
| `registerAction(spec)` | une action : ses champs (`text`, `textarea`, `choice`, valeur par défaut souvent `{analyse}`, obligatoires), les **résultats** qu'elle passe aux étapes suivantes (`path`, `link`, `text`…), `needsAi`, et `run` |
| `registerTemplate(spec)` | un workflow prêt à l'emploi, proposé à la création |
| `emitWorkflowEvent(id, sujet)` | ce qui vient d'arriver ; sans le module actif, ne fait rien ; ne lève jamais |
| `runDueWorkflows()` | les workflows planifiés dont l'heure est venue (la minuterie le fait chaque minute) |

Les déclarations vivent dans `registry.ts`, au niveau du module JavaScript : elles sont
faites que le module Workflows soit actif ou non, et un module qui les fait n'a pas besoin
de lui pour fonctionner.

### Ce que les modules déclarent aujourd'hui

| Module | Déclencheurs | Actions | Prêts à l'emploi |
| --- | --- | --- | --- |
| Analyse d'appels d'offres | analyse créée ; pièces importées (fichiers, ZIP, dépôt puis mise à jour) ; exigences extraites (d'une pièce, de toutes, oubliées) ; analyse mise à jour (l'un ou l'autre, 0.136.12) | relever le calendrier ; analyser la qualité ; vérifier la cohérence ; vérifier la couverture ; interroger le dossier (IA) ; remplir le questionnaire (IA) | calendrier à l'import ; qualité et cohérence à l'extraction ; questionnaire à l'import du CCAP, RC ou CCTP (demande d'abord) |
| Exigences | exigence créée | analyser la qualité de la bibliothèque ; relire une exigence (IA, sans reformulation appliquée) | qualité chaque lundi à 8 h |
| IA | — | demander à l'IA (consigne, contexte, note facultative) | — |

## L'accueil (v0.2.0)

`home.ts` : la section « Workflows » (actifs sur le total, les cinq dernières exécutions lues dans le journal) et l'entrée de navigation.

## La page « Workflows » (v0.3.0, Black Projects 0.17.0)

**En sections repliables (v0.14.0, Black Projects 0.72.0)** : `workflowSections` range les
cartes en [sections repliables](../architecture/interface.md) — d'abord **Workflows
système** (ouverte), une sous-section par module (le nom du module qui le déclare,
`SystemInfo.moduleName` ; repliées d'origine), puis **Mes workflows** (ouverte ; ceux du
dernier import en tête). L'intitulé de chacune dit combien, combien d'actifs, combien en
échec (« 11 workflow(s), 7 actif(s) · 1 en échec »). Une recherche ou un filtre ouvre les
sections qui ont un résultat et masque les autres.

**Vues et regroupements (v0.15.0, Black Projects 0.73.0)** : trois vues (`layouts` :
cartes, liste, tableau — colonnes *Exécutions*, *Dernière exécution*) et « Regrouper
par » : **Module** (d'origine, ci-dessus), **Déclencheur** (une section par déclencheur
d'évènement, puis *Planifiés*, puis *À la main* ; repliées au-delà de quatre), **État**
(*En échec*, *Actifs*, *Désactivés*), **Aucun** (toutes les cartes). Le regroupement vaut
le temps de la session (`setWorkflowsGrouping`).

**Le logigramme (v0.16.0, Black Projects 0.76.0)** : sur la fiche d'un workflow, une
section repliable *Logigramme* (ouverte) — `workflowFlowchart` : **Quand** (le déclencheur ;
désactivé, il le dit), **Si** (les conditions, avec leurs liaisons ; *Non : rien ne se
passe*), **Demander d'abord** (s'il le demande ; *Non : refusé, noté au journal*), une
forme par **étape**, **Fin** (*Le journal garde l'exécution*). Un clic sur le début ouvre
« Nom, mode et déclencheur » ; sur une étape, sa modification ; sans étape, « Ajouter une
action ».

`home.ts` déclare la **page** `workflows.liste` (`views.page`, voir
[l'interface](../architecture/interface.md#les-pages-des-modules-v0150)) : les chiffres
(workflows, actifs, exécutions et échecs parmi les 20 dernières lignes du journal), les
actions (nouveau, importer, exporter, journal), une carte par workflow — déclencheur,
actions (`Card.text`), mode, état, exécutions et dernière exécution (le compteur du
workflow, complété par le journal), échec récent — avec **Modifier** (`editWorkflow`),
**Exécuter** (`runByHand`), **Activer**/**Désactiver** (`setEnabled`), puis les dernières
lignes du journal (une liste titrée). Filtres (`tags`) : `actifs`, `desactives`,
`en-echec`, `planifies`, `sur-evenement`, `manuels`, `tout-seuls`, `demandent`. L'entrée,
la tuile, la commande `liste` et le lien « Tous les workflows » du tableau de bord
l'ouvrent par `context.showPage` ; sans page chez la plateforme, la liste en fenêtre reste.
Tests : `test/workflows-page.test.ts`.

**La fiche en page (Black Projects 0.19.0)** : `workflows.fiche?<id>` (`pageWith`), page qui
dépend de la liste (`parent`). Titre : le nom du workflow ; « ← Tous les workflows » ; en
tête Exécuter, Activer/Désactiver, Nom, mode et déclencheur, Dupliquer (ouvre la copie),
Supprimer (confirmé, revient à la liste) ; les chiffres ; les conditions et les actions en
groupes de cartes titrés, chaque carte avec ses boutons ; l'historique du workflow. Les
opérations sont une à une dans `flows.ts` (`editGeneral`, `addCondition`,
`removeCondition`, `addAction`, `editAction`, `moveAction`, `removeAction`,
`duplicateWorkflow`, `deleteWorkflow`) ; la fiche en fenêtre (`editWorkflow`, sans page
chez la plateforme) s'en sert aussi. Un workflow disparu : la page le dit.

**Le journal en page (Black Projects 0.25.0)** : `workflows.journal` (`parent` : la liste)
lit le journal (`journalItems`, 500 lignes au plus) : les chiffres par issue, une liste par
jour (l'heure en face de chaque exécution), chaque ligne avec son filtre (`ListItem.tags` :
`reussies`, `echecs`, `refusees`, `arretees`). Un clic sur une ligne — ici, sur la page
Workflows, dans la section du tableau de bord — ouvre la fiche du workflow qu'elle nomme
(`journalOpen`) ; un workflow supprimé depuis : la note du journal. La tuile Journal,
l'action « Journal », l'historique d'une fiche et la commande `journal` ouvrent la page.

**La fiche d'une exécution (Black Projects 0.26.0)** : `workflows.execution?<ligne encodée>`
(`parent` : la liste). Le journal est relu en exécutions (`journalRuns`, l'inverse de
`journalLine`) : quand, issue, workflow, sujet et note du sujet, étapes, notes écrites.
La ligne même désigne l'exécution ; sortie du journal (il n'en garde que 300), la page le
dit. Un clic sur une exécution — journal, page Workflows, historique d'une fiche, tableau
de bord — ouvre cette fiche ; elle mène à la fiche du workflow.

**Le sujet et les notes écrites, en page (Black Projects 0.36.0)** : la fiche d'une
exécution ouvre son sujet (« Ouvrir le sujet ») et les notes écrites par
`ModuleContext.showNote` : la page qu'un module déclare pour cette note
(`views.notePage`) — l'analyse ouvre sa fiche, « Calendrier » la page du calendrier, une
exigence de la bibliothèque sa fiche —, sinon la note dans le coffre. Les workflows ne
connaissent pas ces pages : chaque module dit lesquelles de ses notes en ont une.

**Créer et exécuter, en page (v0.8.0, Black Projects 0.53.0)** : « Nouveau workflow »
de la liste, du tableau de bord et de la tuile passe par `HomeDeps.create`
(`createWorkflow(session, { open: false })`, sans la fenêtre de la fiche), puis
`workflows.fiche?<id>`. « Exécuter » (carte, fiche, « Exécuter de nouveau ») : `runNow`
lit la dernière ligne du journal pour ce workflow (`lastRunLine`) avant et après
`runByHand` ; une nouvelle ligne, et sa fiche s'ouvre (`runPageOf`). Rien d'exécuté
(aucune action, sujet non choisi) : on reste où l'on est. Depuis la palette, ou sans
page : la fenêtre et les messages, comme avant.

**Importer, en page (v0.9.0, Black Projects 0.58.0)** : `importFromFile` rend les
workflows importés (toujours désactivés, `share.ts`). « Importer » de la page passe par
`HomeDeps.imports.run` : un seul importé, sa fiche (`workflows.fiche?<id>`) ; plusieurs,
la liste. Les identifiants du dernier import (`imports.last()`, gardés tant que le module
est actif) mettent ces workflows en tête de la liste, avec « Importé — désactivé, à
relire » (« Importé » une fois activé), le tag `importes` et son filtre ; un message en
tête de la liste compte ceux qui restent désactivés ; leur fiche le rappelle. Depuis la
palette, le message seul, comme avant.

## Les workflows système (v0.10.0, Black Projects 0.59.0)

Les automatismes de l'application sont des **workflows système** (`system.ts`) :

- un module les déclare par `registerSystemWorkflow({ id: 'sys.<module>.<nom>',
  moduleKey, enabledByDefault, make(t) })` (`registry.ts`) ; le module Workflows les crée
  à son activation (`seedSystem`), et ceux déclarés après (un module activé plus tard) par
  `whenSystemDeclared` ;
- chacun porte `system` (son identifiant) et `base` : l'empreinte (`fingerprint` : nom,
  mode, déclencheur, conditions, actions) de la version d'origine dont il est parti. Pas
  modifié (`fingerprint === base`), il suit une nouvelle version du plugin ; modifié, il est
  gardé, et `systemState` dit `modified` ou `modified-update` (une origine plus récente) ;
  `restoreSystem` le remet à l'origine (son état actif et ses compteurs gardés) ;
- jamais supprimé (`deleteWorkflow` refuse ; pas de « Supprimer » sur la fiche) ;
  dupliqué, il devient ordinaire (sans `system` ni `base`) ; exporté aussi ;
- `usable` : celui d'un module désactivé (sa déclaration absente) est masqué des pages et
  ne s'exécute pas, mais reste dans les réglages ;
- un succès d'un workflow système ne prévient pas (le journal le garde) ;
- nouveau déclencheur `ouverture` (`OPENING`) : émis à la première minuterie (l'interface
  prête), une fois par session ; `runOpeningWorkflows` pour les tests ;
- `systemWorkflowsActive()`, `systemWorkflowManages(id)` : un module sait si un
  automatisme est confié à son workflow système (présent, activé ou non) — il ne le fait
  plus lui-même ;
- la page : badge « Système » (et « Modifié »), filtre `systeme` (liste et journal) ; la
  fiche : un message (module, état), « La version d'origine » quand il est modifié,
  « Rétablir l'original » (confirmé).

Les modèles prêts à l'emploi de l'AO et des exigences sont devenus des workflows système.

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Note de l'analyse : le tableau des pièces et la liste des exigences, à chaque mise à jour | analyse mise à jour (pièces importées, exigences extraites) | réécrit le tableau des pièces, puis la liste des exigences de la note de l'analyse | actif |
| Relever le calendrier à l'import des pièces | pièces de l'appel d'offres importées | écrit la note Calendrier | actif |
| Contrôler les exigences extraites (qualité et cohérence) | exigences extraites | qualité, puis cohérence entre pièces | actif |
| Rappels des appels d'offres, chaque jour | chaque jour à 8 h (à l'ouverture si elle est plus tard) | une étape par échéance : dates limites de remise (J-7, J-3, J-1, le jour même), questions et visite (J-3, J-1, le jour même), fin de validité des offres (J-7, J-1) | actif |
| Rappel du réglage du rangement, à l'ouverture | à l'ouverture d'Obsidian | tant qu'aucun type n'est rangé, explique où le régler | actif |
| Questionnaire (IA) à l'import du CCAP, du RC ou du CCTP | ces pièces importées | lance le questionnaire (demande d'abord) | désactivé |
| Vérifier la couverture d'une réponse importée | pièces de réponse importées | couverture de la réponse | désactivé |
| Extraire les exigences du CCTP à l'import | un CCTP importé | l'aperçu d'extraction, puis les exigences | désactivé |
| Signaler les workflows cassés, à l'ouverture | à l'ouverture d'Obsidian | dit les workflows actifs au déclencheur ou à l'action d'un module désactivé | actif |
| Bilans du lundi : les formats des fichiers du coffre, les workflows | lundi à 8 h | deux étapes : les fichiers du coffre par format et les extensions non lues ; les exécutions de workflows des 7 derniers jours, les échecs et lesquels | désactivé |
| Archiver le journal des workflows, chaque mois | le 1er du mois à 8 h | les exécutions de plus de 30 jours dans une note d'archive | désactivé |
| Rappels des exigences, chaque lundi | lundi à 8 h | le rapport de qualité de la bibliothèque, puis les traductions absentes, en retard ou à relire — une étape chacun | désactivé |
| Traduire les nouvelles exigences (IA) | exigence créée | traduit dans les autres langues, « à relire » | désactivé |
| Contrôler la qualité des exigences importées | exigences importées | nomme les faibles (moins de 3 étoiles) | actif |
| Relire les nouvelles exigences (IA) | exigence créée | relecture par l'IA, écrite dans la note | désactivé |
| Vérifier l'IA à l'ouverture : la connexion, les nouveaux modèles, la vitesse du serveur | à l'ouverture d'Obsidian | trois étapes : met à jour la liste des modèles (dit si le serveur ne répond pas ou si un modèle choisi n'y est plus) ; nomme les nouveaux modèles ; prévient si l'IA met plus de 5 s à répondre | actif |

**La bibliothèque de documents, en workflows système (v0.12.0, Black Projects 0.62.0)** :

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Ranger les fichiers et pièces importés dans la bibliothèque | fichiers déposés dans l'application (pièces d'analyse, import d'exigences, de types, de workflows) | verse le dépôt | actif |
| Repérer les nouvelles versions probables | documents versés (une fois par versement) | marque la version précédente probable | actif |
| Rappels de la bibliothèque, chaque lundi (0.136.5 : les cinq rappels du lundi fondus) | lundi à 8 h | documents à contrôler, versions et langues à confirmer, documents sans type de pièce, fichiers introuvables, entretien des liens (0.137.0) — une étape chacun | actif |
| Verser le dossier « À classer », à l'ouverture et chaque jour (0.136.11 : les deux fondus) | chaque jour à 8 h, et à l'ouverture d'Obsidian | ce qui y est posé entre dans la bibliothèque | actif |

**L'entretien des workflows (v0.13.0, Black Projects 0.67.0)** : le module n'avait pas
d'automatisme à convertir — ce qu'il fait seul est le moteur (le journal tenu à 300
exécutions, le garde-fou d'une boucle, le message d'un échec, la création des workflows
système), qu'un workflow ne peut pas piloter. Il gagne trois workflows système
(`upkeep.ts`) :

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Signaler les workflows cassés, à l'ouverture (`sys.workflows.casses`) | à l'ouverture d'Obsidian | `workflows.verifier` : les workflows actifs (et utilisables) dont le déclencheur ou une action n'est déclaré par aucun module actif (`brokenParts`) ; aucun : rien n'est dit. Depuis la v0.17.0, un workflow **système** dont le déclencheur vient d'un module inactif n'est pas dit cassé : il dort, et se réveille avec le module | actif |
| Bilan des workflows, chaque lundi (`sys.workflows.bilan-hebdo` ; depuis 0.24.0, une étape de `sys.lecture-fichiers.bilans-lundi`) | lundi à 8 h | `workflows.bilan` (champ « jours », `7`) : d'après le journal (`journalRuns`), combien d'exécutions, d'échecs, et lesquels | désactivé |
| Archiver le journal des workflows, chaque mois (`sys.workflows.archiver-journal`) | le 1er du mois à 8 h | `workflows.archiver` (champ « jours », `30`) : les lignes plus anciennes quittent le journal pour `Journal des workflows — archive AAAA-MM.md` (`bp-type: workflows-journal-archive`), la plus récente en tête | désactivé |

Les tests des autres fonctions du module écartent ces trois-là
(`forgetDeclarations('sys.workflows')`) ; ils sont testés dans
`test/workflows-upkeep.test.ts`.

**La lecture de fichiers (Black Projects 0.63.0)** : *Signaler les formats non lus, au
dépôt de fichiers* (déclencheur : fichiers déposés dans l'application ; actif) — voir
[lecture-fichiers.md](lecture-fichiers.md). Depuis Black Projects 0.71.0 : *Signaler les
pièces illisibles, à l'import* (actif), *Signaler les pièces sans texte (scans)* et *Bilan
des formats du coffre, chaque lundi* (désactivés). Depuis Black Projects 0.136.8, les pièces
illisibles, sans texte et sans type reconnu : un seul workflow de l'analyse d'appels d'offres,
*Signaler les pièces à problème, à l'import*.

**Le typage des pièces (Black Projects 0.64.0)** : *Signaler les pièces sans type
reconnu, à l'import* (déclencheur : pièces importées, `nontypees` non vide ; actif) — voir
[typage-pieces.md](typage-pieces.md).

Le moteur : un évènement émis pendant qu'un workflow s'exécute (par une de ses actions) est
mis à la suite **sans être attendu** — l'attendre de l'intérieur bloquait la file
(`WorkflowEngine.busy`, `workflowRunning()`). Voir [bibliotheque.md](bibliotheque.md).

**La bibliothèque de documents (v0.11.0, Black Projects 0.61.0)** : le fichier d'un import
de workflows réussi est versé dans la [bibliothèque](bibliotheque.md) (catégorie
« Échange »). Nouveau déclencheur d'un autre module : *Bibliothèque : document versé*.

## Les étapes qui demandent l'IA (v0.18.0, Black Projects 0.86.0)

Toute action déclarée `needsAi` reçoit, à sa déclaration (`registerAction`), trois champs :
**Prompt**, **Persona**, **Skill** (`AI_FIELD_KEYS`) — ceux qu'elle n'a pas déjà
(`aiAdded`) ; les siens (« Demander à l'IA », « Interroger le dossier » ont déjà prompt et
persona) gardent leur sens. Leurs listes viennent de la bibliothèque : un champ a une
`source` (`bibliotheque.prompt`, `.persona`, `.skill`), déclarée par
`registerFieldSource` ; la fenêtre de l'étape en fait une liste, « — Aucun — » d'abord, un
nom disparu gardé (« (pas dans la bibliothèque) »). À l'exécution, le moteur demande au
module IA (`registerAiGuidance`) les consignes des noms choisis (`guidanceFor`) : le
persona (le rôle, en tête), le skill (« Applique ce savoir-faire… »), le prompt (« Consigne
supplémentaire… ») ; l'action les reçoit (`ActionRun.guidance`) et les donne à l'IA
(`AiClient.withInstructions`, après le rôle). Un nom absent de la bibliothèque : l'étape
échoue, le journal le dit.

Le **logigramme** : une étape d'IA est `ai` — fond turquoise, « Étape n · IA », l'icône
étincelle, et ce qu'on a choisi (« Persona : … · Skill : … ») ; une légende le dit dès
qu'il y en a une. Les étapes sans IA : fond gris.

## Relancer un workflow système pour un sujet (v0.19.0, Black Projects 0.93.0)

`runSystemWorkflow(id, trigger, subject)` : refaire, pour un sujet (un document), ce qu'un
workflow système fait à son évènement — présent, activé, son déclencheur et ses conditions
remplies, il est exécuté (`WorkflowEngine.emitTo`, à la suite des autres) et écrit au
journal ; rend s'il l'a été. La bibliothèque s'en sert pour **relancer la recherche** d'un
champ avec l'IA, depuis la fiche d'un document.

## Supprimer depuis la carte (v0.20.0, Black Projects 0.133.0)

- La carte d'un workflow, sur la page « Workflows », a l'action `delete` (« Supprimer… ») :
  `WorkflowFicheDeps.remove`, la confirmation de `deleteWorkflow`. Pas pour un workflow système
  (il se désactive, ou se rétablit sur sa fiche).

## Une action seule, hors d'un workflow (v0.27.0, Black Projects 0.150.0)

- `runActionNow(kind, fields, subject?)` (`WorkflowEngine.runAction`) : exécute une action seule — ses
  champs donnés, les autres à leur valeur d'origine, ses consignes d'IA comme dans un workflow ; rien au
  journal, une erreur levée. La bibliothèque s'en sert pour relancer une étape du circuit d'un document.
## Devenu essentiel après coup (v0.26.0, Black Projects 0.136.13)

- `Workflow.essential` : un workflow système essentiel dont l'état d'origine a été appliqué.
  `seedSystem` : un workflow déjà enregistré, dont la déclaration devient `essential` (une
  nouvelle version) alors que le choix d'origine était déjà appliqué, est **activé une fois**
  (quand seuls les essentiels le sont) et marqué ; désactivé ensuite par l'utilisateur, il le
  reste. Premier usage : la note de l'analyse d'appels d'offres (`sys.ao.note-analyse`).

## À heure fixe, et à l'ouverture (v0.25.0, Black Projects 0.136.11)

- `WorkflowTrigger.atOpening` (déclencheur *À heure fixe*) : aussi à l'ouverture d'Obsidian.
  `matches` : un workflow planifié `atOpening` répond à l'évènement `ouverture`. Après une
  exécution à l'ouverture, `scheduleDue` ne le relance pas avant le prochain moment demandé (sa
  dernière exécution est plus récente). Dans la fenêtre *À heure fixe* : l'interrupteur « Aussi à
  l'ouverture d'Obsidian » ; dit « Chaque jour à 08:00, et à l'ouverture d'Obsidian »
  (`workflows.schedule.andOpening`) ; repris à l'export/import (`share.ts`).
- Premier usage : « Verser le dossier « À classer », à l'ouverture et chaque jour »
  (`sys.bibliotheque.depot`), qui remplace les deux workflows d'avant (voir
  [bibliothèque](bibliotheque.md)).

## Le bilan du lundi, une étape des bilans de la lecture de fichiers (v0.24.0, Black Projects 0.136.10)

- `sys.workflows.bilan-hebdo` n'est plus déclaré par l'entretien (`upkeep.ts`) : son action
  `workflows.bilan` est la seconde étape de « Bilans du lundi : les formats des fichiers du coffre,
  les workflows » (`sys.lecture-fichiers.bilans-lundi`, déclaré par la [lecture de
  fichiers](lecture-fichiers.md), qui le remplace — `replaces`).

## Un workflow système qui en remplace d'autres (v0.23.0, Black Projects 0.136.3)

- `SystemWorkflowSpec.replaces` : les workflows système qu'il remplace (deux fusionnés en un).
  `seedSystem` les retire des workflows enregistrés — ils ne servent plus. Premier usage : « Ranger
  les pièces importées » fondu dans « Ranger les fichiers et pièces importés » (bibliothèque).

## D'origine, seuls les essentiels (v0.22.0, Black Projects 0.136.0)

- Réglage `essentielsSeulement` (« D'origine, seuls les workflows essentiels sont actifs »,
  **oui** par défaut) : un workflow système est actif d'origine s'il est prévu actif par son
  module **et** marqué `essential: true` (`SystemWorkflowSpec`) — `enabledOf(spec, defaults)`.
  Réglage désactivé : ce que chaque module prévoit (`enabledByDefault`), comme avant.
- Les essentiels (et, depuis 0.136.13, `sys.ao.note-analyse`, la note de l'analyse) : le **circuit des documents** (`sys.ia.circuit`,
  `sys.bibliotheque.relancer-circuit`, `sys.bibliotheque.rappel-a-controler`), ce sans quoi rien
  n'entre dans la bibliothèque (`sys.bibliotheque.ranger-fichiers`, avec `rappels-lundi`,
  `depot` — à l'ouverture et chaque jour, depuis 0.136.11) et `sys.workflows.casses` (on voit ce qui casse). Les 41
  autres sont désactivés ; on les active un par un, sur la page Workflows.
- Chaque workflow système garde le choix d'origine qui a fixé son état (`Workflow.defaults` :
  `essentiels` | `complet`). `seedSystem(…, defaults)` : différent (un coffre d'avant, sans
  marque, ou le réglage changé — `settings.onChange` relance le semis), l'état est remis à la
  nouvelle origine, **une fois** ; ce que l'utilisateur change ensuite est gardé.

## Attendre la file (v0.21.0, Black Projects 0.135.0)

- `workflowsIdle()` : attendre que la file soit passée, ce qui s'y ajoute en route compris
  (`WorkflowEngine.idle`) — pour les tests et la démonstration.
- (`systemWorkflowEnabled`, ajouté en 0.21.0, retiré en 0.21.1 : le circuit des documents n'en a
  plus besoin — les workflows de relecture l'écartent eux-mêmes.)

## Le moteur (`engine.ts`)

- **Évènement** : les workflows actifs du même déclencheur dont les conditions tiennent
  s'exécutent, **l'un après l'autre** (une file : un évènement déclenché par une action
  est traité après le workflow en cours).
- **Demander d'abord** : une confirmation dit le déclencheur, le sujet et les étapes ;
  refusé, l'exécution est journalisée « refusé ».
- **Étapes** : champs avec leurs `{variables}` remplacées (sujet, `{today}`, `{today+7}`,
  `{now}`, `{workflow}`, résultats des étapes précédentes `{stepN.résultat}`) ; un champ
  obligatoire vide, une action inconnue (module absent) ou une erreur arrête le workflow,
  dit à l'utilisateur et journalisé.
- **Garde-fou** : plus de 30 exécutions d'un workflow en une heure (hors exécutions à la
  main) : arrêté, journalisé, l'utilisateur prévenu.
- **Planification** : vérifiée à l'ouverture puis toutes les minutes (`ModuleContext.timers`,
  nouveau dans le cœur) ; un moment manqué est rattrapé une fois.

## Organisation du code

| Fichier | Rôle | Origine |
| --- | --- | --- |
| `model.ts` | workflow, conditions (`holds`, `conditionsHold`, `compareTo`), variables (`expand`, `resolveDay`, `variablesOf`), planification (`lastSlot`, `scheduleDue`) | repris de la version complète, déclencheurs et actions ouverts |
| `registry.ts` | les déclarations des modules | nouveau |
| `engine.ts` | exécution, demande d'accord, étapes et résultats, garde-fou, journal | réécrit d'après `WorkflowRunner` |
| `builtins.ts` | à la main, à heure fixe ; prévenir, écrire une note, ajouter à une note | nouveau |
| `share.ts` | export et import JSON, vérifiés | repris (`workflowShare`) |
| `flows.ts` | liste, création (modèles), fiche, conditions, actions, exécution, échange | nouveau, sur les fenêtres de la plateforme |
| `index.ts`, `i18n.ts`, `doc/Workflows.md` | module, textes, page du coffre | nouveau |

Pas repris (à venir) : « attendre » (reprendre plus tard), « pour chaque », l'envoi de
courriels, les déclencheurs propres aux projets de la version complète (tickets,
changements, anomalies).

## Tests

- `model.test.ts` : conditions, nombres, jours relatifs, « et » / « ou », planification,
  variables.
- `workflows.test.ts` : création et exécution depuis la fiche ; demander d'abord (refusé,
  accepté) ; résultats d'étape en étape ; échec ; champ vide et action inconnue ; boucle
  arrêtée ; planification une fois ; conditions dans la fiche ; export et import.
- `test/ao-workflows.test.ts` : sur le dossier d'exemple, les workflows prêts à l'emploi
  de l'AO (calendrier au dépôt du RC et du CCTP, qualité et cohérence à l'extraction), et
  un workflow écrit à la main qui interroge le dossier avec l'IA (serveur simulé) et note
  la réponse.
