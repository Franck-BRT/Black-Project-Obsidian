# Module — Analyse d'appels d'offres (`ao`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `ao` |
| Version | 0.4.3 |
| Requiert | [Lecture de fichiers](lecture-fichiers.md) (`lecture-fichiers`), [Typage des pièces](typage-pieces.md) (`typage-pieces`) |
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

- **Ajouter un type…** ouvre une petite fenêtre : le type (parmi ceux qui ne sont pas
  encore dans la liste), un interrupteur **AO** (avec l'appel d'offres) et un
  **Réponse AO** (avec la réponse) ;
- la liste dépliable **Types rangés (n)** commence par l'explication des deux colonnes,
  puis montre chaque type **sur une seule ligne** (libellé coupé par « … » si besoin,
  entier en infobulle) avec ses deux interrupteurs (au moins un allumé ; les deux : la
  question est posée à l'import) et une corbeille qui le retire de la liste (v0.4.3).

Rangement de départ (`DEFAULT_RANGEMENT`, `placement.ts`) : avis, RC, CCAP, CCAG, CCTP, CCTG,
questions-réponses avec l'appel d'offres ; les autres types du module dans les deux. Un
type absent de la liste — un type ajouté par l'utilisateur, par exemple — et AUTRE sont
toujours demandés. Une fois modifié, le rangement enregistré fait foi.

Le rangement suit le **renommage** d'un type dans le typage (`renameRangement`) ; un
type supprimé disparaît de la liste. Sur la fiche de chaque type, dans la fenêtre
**Types de pièces**, le module affiche à titre d'information où il le range
(`annotateTypes` du module de typage).

Le réglage générique qui dessine cela est un champ `toggles` du contrat de module
(`TogglesField` : colonnes, `read`, `candidates`, `write`), dessiné par
`src/obsidian/moduleDetailsModal.ts` ; le formulaire d'ajout utilise le nouveau champ
`toggle` de `askForm`.

Reprise de la v0.4.1 (`migratePlaces`) : `typage-pieces.placesTypes` devient
`ao.rangement` (par-dessus le rangement de départ) et quitte les réglages du typage.

## Dans le coffre

```
<dossier des analyses>/<Nom>/            (« Appels d'offres » par défaut, réglable)
├── <Nom>.md        bp-type: ao-analyse ; position, acheteur, référence, date ;
│                   tableau des pièces (une partie par destination) entre
│                   <!-- bp:pieces:debut --> et <!-- bp:pieces:fin -->
├── Pièces/
│   ├── Appel d'offres/
│   │   ├── Originaux/  les fichiers tels que reçus
│   │   └── <pièce>.md  bp-type: ao-piece ; type, place, [candidat], fichier, format,
│   │                   lecture, caracteres, importee ; texte extrait
│   ├── Réponse/              candidat (même forme)
│   └── Réponses/<candidat>/  émetteur (même forme)
├── Exigences/      (étape 3)
└── Analyse/        (étapes 5 à 7)
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
