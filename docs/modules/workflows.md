# Module — Workflows (`workflows`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `workflows` |
| Version | 0.2.0 (Black Projects 0.10.0) |
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
