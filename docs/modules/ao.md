# Module — Analyse d'appels d'offres (`ao`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `ao` |
| Version | 0.3.4 |
| Requiert | [Lecture de fichiers](lecture-fichiers.md) (`lecture-fichiers`) |
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

Les commandes visent l'analyse de la note ouverte, sinon demandent laquelle.

## Dans le coffre

```
<dossier des analyses>/<Nom>/            (« Appels d'offres » par défaut, réglable)
├── <Nom>.md        bp-type: ao-analyse ; position, acheteur, référence, date ;
│                   tableau des pièces entre <!-- bp:pieces:debut --> et <!-- bp:pieces:fin -->
├── Pièces/
│   ├── Originaux/  les fichiers tels que reçus
│   └── <pièce>.md  bp-type: ao-piece ; type, fichier, format, lecture, caracteres,
│                   importee ; texte extrait (titres descendus de deux niveaux)
├── Exigences/      (étape 3)
└── Analyse/        (étapes 5 à 7)
```

- **Noms des notes** : `CCTP.md` ; si une autre pièce porte déjà ce nom dans un autre
  format, `CCTP (pdf).md` ; ensuite des numéros.
- **Doublons** : un fichier identique à un original déjà présent n'est pas réimporté ;
  un fichier différent du même nom devient `RC (2).pdf`.
- **États de lecture** : `lue`, `sans-texte` (scan), `image`, `non-lue` (format non
  lu), `illisible` (abîmé ou mot de passe).
- **Types** (`pieces.ts`) : AVIS, RC, AE, CCAP, CCAG, CCTP, CCTG, BPU, DPGF, DQE,
  MEMOIRE, FORMULAIRE, QR, PLANNING, ANNEXE, AUTRE — devinés par le nom du fichier, puis
  par le titre du texte ; le tableau suit cet ordre.
- **Détection** (v0.3.1) : chaque type a deux listes de mots-clés écrits comme un
  utilisateur les lit (`names` pour le nom du fichier, `titles` pour le début du texte).
  Un mot-clé est cherché comme mot entier, sans accents, casse ni ponctuation ; terminé
  par « … », il vaut aussi pour les mots qui le prolongent. Ces listes sont la source
  unique : la reconnaissance les applique, la fenêtre **Fonctions** (section « Types de
  pièces et leur détection ») et la page de documentation du coffre les affichent telles
  quelles. Pour ajouter un mot-clé du module : l'écrire dans `pieces.ts`, ajouter un cas
  dans `pieces.test.ts`.
- **Types personnalisés** (v0.3.3, `keywords.ts`, réglage `typesPerso`) : code
  (lettres, chiffres, tiret, souligné ; 20 caractères ; mis en majuscules sans accents)
  et libellé (80 caractères). Refusés : code d'un type du module, code déjà ajouté,
  libellé vide. `allTypes()` les place après les types du module et avant AUTRE ; le code
  est leur mot-clé de nom. Ils sont proposés par « Changer le type de la pièce », comme
  cibles des mots-clés personnalisés, et ont leur fiche dans la fenêtre **Fonctions**. Un
  type retiré emporte ses mots-clés (écartés à la relecture) ; les notes de pièces gardent
  le code, montré « (type retiré) » dans le tableau.
- **Modifier, supprimer** (v0.3.4) : crayon et corbeille sur chaque type et chaque
  mot-clé ajoutés. Un code modifié est repris par les mots-clés (`afterTypeChange`) et
  noté dans `typesRenommes` (ancien → nouveau, chaînes suivies) ; dès que le module voit
  ce renommage, `applyRenames` retype les pièces de toutes les analyses et réécrit leurs
  tableaux. La suppression demande confirmation (`describeTypeRemoval` : le type, ses
  mots-clés, les pièces qui le gardent), retire les mots-clés et oublie les renommages qui
  y menaient. Les types du module ne se modifient pas.
- **Mots-clés personnalisés** (v0.3.2, `keywords.ts`) : l'utilisateur ajoute ses paires
  « mot-clé → type » en tête de la fenêtre **Fonctions**, une liste pour le nom du
  fichier (réglage `motsClesNom`), une pour le titre (`motsClesTitre`). Ordre de la
  reconnaissance : mots de l'utilisateur pour le nom, du module pour le nom, de
  l'utilisateur pour le titre, du module pour le titre. Refusés : vide, plus de 60
  caractères, type inconnu ou AUTRE, mot déjà déclaré, mot déjà connu du module pour ce
  type. Ils s'appliquent aux prochains imports, et apparaissent dans les fiches des types
  (« Ajoutés par vous ») et dans la documentation du coffre (« ajouté »).

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `index.ts` | Interface publique, déclaration du module, commandes, réglage du dossier, fenêtre « Fonctions » |
| `service.ts` | Créer, lister, importer, mettre à jour, changer le type — sans fenêtre, testé sur un coffre en mémoire |
| `notes.ts` | Forme des notes et des dossiers ; tableau des pièces |
| `pieces.ts` | Types de pièces, leurs mots-clés, et la reconnaissance |
| `keywords.ts` | Types et mots-clés personnalisés : saisie, validation, lecture des réglages |
| `typesDoc.ts` | Le tableau des types et de leurs mots-clés pour la documentation du coffre |
| `i18n.ts` | Textes, infobulles comprises |
| `doc/` | Page de documentation écrite dans le coffre |

Le module s'appuie sur l'interface publique de `lecture-fichiers` (`readArchive`,
`fileText`, `isReadable`, `isImage`) et sur `core/frontmatter.ts` pour lire et modifier
l'en-tête des notes.

## Tests

- `pieces.test.ts` : reconnaissance des types (noms réels de pièces, titres).
- `service.test.ts` : création, import, ZIP, doublons, mise à jour, changement de type,
  noms des notes, ordre du tableau.
- `test/ao-dce.test.ts` : le dossier d'exemple compressé en ZIP, importé, chaque pièce
  lue et typée.
