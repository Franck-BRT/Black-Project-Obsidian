# Module — Workflows (`workflows`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `workflows` |
| Version | 0.12.0 (Black Projects 0.62.0) |
| Requiert | — |
| Utilisé par | [Analyse d'appels d'offres](ao.md), [Exigences](exigences.md), [IA](ia.md) : leurs déclencheurs, actions et workflows prêts à l'emploi |
| Emplacement | `src/modules/workflows/` |
| Interface publique | `src/modules/workflows/index.ts` |

Documentation utilisateur (écrite dans le coffre) : `src/modules/workflows/doc/Workflows.md`.

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
chaque mois, à HH:MM) ; actions **Prévenir** (`notifier`), **Écrire une note**
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
| Analyse d'appels d'offres | analyse créée ; pièces importées (fichiers, ZIP, dépôt puis mise à jour) ; exigences extraites (d'une pièce, de toutes, oubliées) | relever le calendrier ; analyser la qualité ; vérifier la cohérence ; vérifier la couverture ; interroger le dossier (IA) ; remplir le questionnaire (IA) | calendrier à l'import ; qualité et cohérence à l'extraction ; questionnaire à l'import du CCAP, RC ou CCTP (demande d'abord) |
| Exigences | exigence créée | analyser la qualité de la bibliothèque ; relire une exigence (IA, sans reformulation appliquée) | qualité chaque lundi à 8 h |
| IA | — | demander à l'IA (consigne, contexte, note facultative) | — |

## L'accueil (v0.2.0)

`home.ts` : la section « Workflows » (actifs sur le total, les cinq dernières exécutions lues dans le journal) et l'entrée de navigation.

## La page « Workflows » (v0.3.0, Black Projects 0.17.0)

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
| Note de l'analyse : le tableau des pièces, à l'import | pièces importées | réécrit le tableau des pièces de la note de l'analyse | actif |
| Note de l'analyse : la liste des exigences, à l'extraction | exigences extraites | réécrit la liste des exigences (analyse, pièces) | actif |
| Relever le calendrier à l'import des pièces | pièces de l'appel d'offres importées | écrit la note Calendrier | actif |
| Contrôler les exigences extraites (qualité et cohérence) | exigences extraites | qualité, puis cohérence entre pièces | actif |
| Rappel des dates limites de remise | chaque jour à 8 h (à l'ouverture si elle est plus tard) | prévient à J-7, J-3, J-1 et le jour même | actif |
| Rappel du réglage du rangement, à l'ouverture | à l'ouverture d'Obsidian | tant qu'aucun type n'est rangé, explique où le régler | actif |
| Questionnaire (IA) à l'import du CCAP, du RC ou du CCTP | ces pièces importées | lance le questionnaire (demande d'abord) | désactivé |
| Vérifier la couverture d'une réponse importée | pièces de réponse importées | couverture de la réponse | désactivé |
| Qualité de la bibliothèque d'exigences, chaque lundi | lundi à 8 h | rapport de qualité de la bibliothèque | désactivé |
| Traduire les nouvelles exigences (IA) | exigence créée | traduit dans les autres langues, « à relire » | désactivé |
| Vérifier la connexion à l'IA, à l'ouverture (v0.60.0) | à l'ouverture d'Obsidian | met à jour la liste des modèles ; dit si le serveur ne répond pas ou si un modèle choisi n'y est plus | actif |

**La bibliothèque de documents, en workflows système (v0.12.0, Black Projects 0.62.0)** :

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Ranger les pièces importées dans la bibliothèque | fichiers déposés dans l'application (par l'analyse) | verse les pièces | actif |
| Ranger les fichiers importés dans la bibliothèque | fichiers déposés (import d'exigences, de types, de workflows) | verse le fichier | actif |
| Repérer les nouvelles versions probables | documents versés (une fois par versement) | marque la version précédente probable | actif |
| Signaler les fichiers introuvables, chaque lundi | lundi à 8 h | dit les documents dont le fichier n'est plus dans le coffre | désactivé |

Le moteur : un évènement émis pendant qu'un workflow s'exécute (par une de ses actions) est
mis à la suite **sans être attendu** — l'attendre de l'intérieur bloquait la file
(`WorkflowEngine.busy`, `workflowRunning()`). Voir [bibliotheque.md](bibliotheque.md).

**La bibliothèque de documents (v0.11.0, Black Projects 0.61.0)** : le fichier d'un import
de workflows réussi est versé dans la [bibliothèque](bibliotheque.md) (catégorie
« Échange »). Nouveau déclencheur d'un autre module : *Bibliothèque : document versé*.

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
