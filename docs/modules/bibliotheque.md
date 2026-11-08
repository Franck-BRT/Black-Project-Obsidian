# Module — Bibliothèque de documents (`bibliotheque`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `bibliotheque` |
| Version | 0.2.0 (Black Projects 0.62.0) |
| Requiert | — |
| Utilisé par | [Analyse d'appels d'offres](ao.md) (pièces importées, déposées à la main), [Exigences](exigences.md) (fichier importé), [Typage des pièces](typage-pieces.md) et [Workflows](workflows.md) (fichiers d'échange) |
| Emplacement | `src/modules/bibliotheque/` |
| Interface publique | `src/modules/bibliotheque/index.ts` |

Documentation utilisateur (écrite dans le coffre) : `src/modules/bibliotheque/doc/Bibliothèque.md`.

## Ce qu'il fait

**Tout fichier déposé dans l'application** y est rangé, une fois, avec sa **fiche** —
une note (`bp-type: bibliotheque-document`) — : titre (tiré du nom), famille (extension :
pdf, word, sheet, slides, image, mail, note, other), catégorie (donnée par le module qui
verse — le type d'une pièce —, sinon devinée au nom : `CATEGORIES`), référence, édition,
révision, émetteur, étiquettes, **origines** (module, libellé, lien), empreinte
SHA-256, version précédente (`precedent`) ou probable (`precedentProbable`).

Adapté de la bibliothèque de documents d'un module de gestion de projet existant (sa
« bibliothèque » à l'échelle du coffre : fiche par fichier, empreinte, doublons, versions
détectées au nom, versement) ; le registre de livrables d'un projet (états, visas,
bordereaux) n'est pas repris.

## Verser (`store.ts`, `LibraryStore.pour`)

1. L'empreinte de chaque fichier (`hash.ts`, `crypto.subtle`).
2. **Déjà là** (même chemin, ou même empreinte) : rien n'est copié ; son origine s'ajoute
   (et sa catégorie, si elle était vide). `report.already`.
3. **Nouveau** : venu de l'ordinateur (`bytes`), copié dans `<dossier>/_fichiers/` (nom
   libre : « nom (2).ext ») ; déjà dans le coffre (`path`), laissé à sa place (`copie:
   false`). La fiche : `<dossier>/<titre>.md`.
4. **Version probable** : même famille, autre empreinte, même clé de nom
   (`versionKey` : les marques « ind B », « rev 2 », « v3 », « ed 1 », « issue 02 »
   ôtées) — le plus récent ; pas parmi ceux du même versement (deux formats d'un
   document). Noté `precedentProbable`, à confirmer depuis la fiche (« Relier comme
   nouvelle version » / « Ce n'en est pas une »).

`pourIntoLibrary(items, origine, options)` (interface publique) : sans le module actif,
`null` ; ne lève pas. Chaque versement qui fait entrer des documents émet
`bibliotheque.versement` (une fois, pour tous), puis chaque document ajouté
`bibliotheque.document-verse` (titre, famille, catégorie, fichier, origine).

Une copie faite sous un nom déjà pris (« CCTP (2).pdf ») garde la clé de version de son
nom (le « (2) » ôté) : elle reste reconnue comme nouvelle version (v0.2.0).

**Qui verse** :

| Module | Quand | Fichiers | Origine |
| --- | --- | --- | --- |
| Analyse d'appels d'offres | `importFiles` (pièces, archives ouvertes) ; `updateAnalysis` (déposées à la main) | en place (les originaux de l'analyse), catégorie = type de pièce | l'analyse (lien : sa note) |
| Exigences | import réussi d'un fichier | copié (ordinateur) ou en place (coffre) | « Import d'exigences (nom) » |
| Typage des pièces | import de types réussi | idem, catégorie « Échange » | « Import de types de pièces » |
| Workflows | import de workflows réussi | idem, catégorie « Échange » | « Import de workflows » |
| Bibliothèque | « Verser des documents » | ordinateur (plusieurs, copiés) ou coffre (en place) | « Versé à la main » |

## Les workflows système (v0.2.0, Black Projects 0.62.0)

Les automatismes de la bibliothèque sont des [workflows système](workflows.md)
(`workflows.ts`) — modifiables, désactivables, pas supprimables :

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Ranger les pièces importées dans la bibliothèque (`sys.bibliotheque.ranger-pieces`) | fichiers déposés dans l'application, `origine` est `ao` | `bibliotheque.verser` : verse le dépôt | actif |
| Ranger les fichiers importés dans la bibliothèque (`sys.bibliotheque.ranger-fichiers`) | fichiers déposés, `origine` n'est pas `ao` (exigences, typage-pieces, workflows) | `bibliotheque.verser` | actif |
| Repérer les nouvelles versions probables (`sys.bibliotheque.nouvelles-versions`) | documents versés (une fois par versement) | `bibliotheque.versions` : `markLikelyVersions` sur les fiches du versement | actif |
| Signaler les fichiers introuvables, chaque lundi (`sys.bibliotheque.fichiers-introuvables`) | chaque lundi à 8 h | `bibliotheque.introuvables` : `missingFiles`, prévient s'il en manque, le journal garde les fiches | désactivé |

**Le dépôt** : le module Workflows actif (`systemWorkflowManages` d'un des deux « Ranger »),
`pourIntoLibrary` d'un autre module que la bibliothèque ne verse pas lui-même : il garde
les fichiers sous un identifiant (`holdDeposit` ; leurs octets ne voyagent pas dans les
variables ; vingt dépôts en attente au plus) et émet `bibliotheque.fichiers-deposes`
(variables `origine` — le module —, `libelle`, `fichiers`, `nombre`, `depot`). L'action
`bibliotheque.verser` (champ `depot`, `{depot}` d'origine) prend le dépôt, une fois, et le
verse. Le déposant attend la fin du workflow, puis annonce les documents versés ; déposé
pendant qu'un workflow s'exécute (`workflowRunning`), le dépôt passe après lui, sans être
attendu, et c'est l'action qui les annonce. Workflow désactivé : les fichiers ne sont pas
rangés (`null`). « Verser des documents », depuis la bibliothèque, y entre toujours.

**Les versions** : `systemWorkflowManages(SYS_VERSIONS)`, `pour` ne repère plus les
versions à l'entrée (`detectVersions: false`) ; le workflow le fait au versement annoncé,
et les fiches du rapport sont relues (« Verser des documents » dit toujours qu'une nouvelle
version est probable). Désactivé : plus de suggestion.

Sans le module Workflows, la bibliothèque range et repère elle-même, comme en 0.1.0.

## Retirer

`setAside` : la fiche (et le fichier, s'il avait été copié) déplacée dans
`<dossier>/_retirés/` — rien n'est effacé (le port `FileSystem` n'efface pas) ; un
fichier resté à sa place n'est pas touché ; les liens de version vers elle sont défaits.

## Interface (`home.ts`)

- **Tableau de bord** : section « Bibliothèque » — combien, les cinq derniers, les versions
  à relier, « Verser des documents ».
- **Page** `bibliotheque.documents` (menu « Bibliothèque », tuile) : chiffres (documents,
  taille, ajoutés cette semaine, versions à relier), une carte par document (le plus
  récent d'abord : famille, catégorie, référence et version, « Nouvelle version
  probable », « Remplacé… », « Fichier introuvable » ; ses origines), recherche, filtres
  (famille, origine, dernières versions, versions à relier, introuvables).
- **Fiche** `bibliotheque.document?<fiche>` : Ouvrir le fichier, Classer… (formulaire),
  Nouvelle version de…, Ouvrir sa note, Retirer de la bibliothèque (confirmé) ; les
  messages (version probable, remplacé, fichier introuvable) ; chiffres ; Identification,
  Le fichier, D'où il vient (un clic : `showNote`, la page du module quand il en a une),
  Versions (précédentes, suivantes).
- Commandes : *Bibliothèque de documents*, *Verser des documents dans la bibliothèque*.

## Réglages

`dossier` (par défaut `Bibliothèque`).

## Tests

`test/bibliotheque.test.ts` : verser (copié, en place, doublons, module inactif), versions
(probable, relier, remplacé, même versement), page et fiche (menu, chiffres, filtres,
verser, classer, origines, retirer), ce que versent l'analyse et l'import d'exigences.
`test/bibliotheque-workflows.test.ts` : les quatre workflows système (créés, actifs ou
non), les pièces et les imports rangés par leur workflow, chacun désactivé, les versions
repérées une fois par versement, la copie « (2) », les fichiers introuvables, sans le
module Workflows, un dépôt fait pendant qu'un workflow s'exécute.
