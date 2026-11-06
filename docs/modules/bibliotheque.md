# Module — Bibliothèque de documents (`bibliotheque`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `bibliotheque` |
| Version | 0.1.0 (Black Projects 0.61.0) |
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
`null` ; ne lève pas. Chaque document ajouté émet le déclencheur de workflow
`bibliotheque.document-verse` (titre, famille, catégorie, fichier, origine).

**Qui verse** :

| Module | Quand | Fichiers | Origine |
| --- | --- | --- | --- |
| Analyse d'appels d'offres | `importFiles` (pièces, archives ouvertes) ; `updateAnalysis` (déposées à la main) | en place (les originaux de l'analyse), catégorie = type de pièce | l'analyse (lien : sa note) |
| Exigences | import réussi d'un fichier | copié (ordinateur) ou en place (coffre) | « Import d'exigences (nom) » |
| Typage des pièces | import de types réussi | idem, catégorie « Échange » | « Import de types de pièces » |
| Workflows | import de workflows réussi | idem, catégorie « Échange » | « Import de workflows » |
| Bibliothèque | « Verser des documents » | ordinateur (plusieurs, copiés) ou coffre (en place) | « Versé à la main » |

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
