# Module — Lecture de fichiers (`lecture-fichiers`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `lecture-fichiers` |
| Emplacement | **`src/modules/lecture-fichiers/`** — tout le code de lecture, et rien d'autre |
| Interface publique | `src/modules/lecture-fichiers/index.ts` |
| Guide de maintenance | [`src/modules/lecture-fichiers/README.md`](../../src/modules/lecture-fichiers/README.md) |
| Version | 0.14.2 (Black Projects 0.124.0) |
| Requiert | — |
| Utilisé par | Analyse d'appels d'offres (`ao`) ; tout futur module qui lit des documents |
| Étape | 1 (v0.2.0), devenu module en v0.2.1 |
| Dépendances externes | **aucune** : tout est lu « à la main », avec les seules API du navigateur (`DecompressionStream`, `crypto.subtle`, `TextDecoder`) |

Le module transforme un document en texte que l'outil, puis l'IA, peuvent lire : paragraphes, titres avec leur niveau, listes, et **tableaux gardés en lignes et
colonnes** — c'est là que sont souvent les exigences et les prix.

## Ouvrir une bibliothèque qu'on vous a passée (v0.14.2, Black Projects 0.124.0)

Le module donne à la bibliothèque de quoi ouvrir une archive ZIP (`setArchiveReader`, par
`unzip`) : l'import d'une bibliothèque exportée.

## Un cadre de page n'est pas un tableau (v0.14.1, Black Projects 0.120.0)

Certains PDF (ceux de FrameMaker) tracent le **même cadre de la taille de la page** plusieurs
fois — fond, masque de découpe. Deux cadres qui se recouvrent sur une même ligne étaient lus
comme deux colonnes : la page entière devenait une seule cellule de tableau, ses en-têtes et
pieds de page avec. Deux cellules d'une ligne ne se recouvrent plus : un cadre en double est
ignoré, la page se lit en paragraphes, et les vrais tableaux (cellules côte à côte) restent.

## Les cellules fusionnées (v0.14.0, Black Projects 0.115.0)

Les lecteurs disent les **fusions** d'un tableau (`merges?: TableMerge[]` — ligne, colonne,
nombre de lignes, de colonnes — à côté de `rows`, où les cellules couvertes restent, vides) :
Word (`gridSpan`, `vMerge`), page web (`colspan`, `rowspan` ; une cellule sur plusieurs lignes
ne décale plus les colonnes des suivantes), PowerPoint (`gridSpan`, `rowSpan`), Excel `.xlsx`
(`mergeCells`) et `.xls` (enregistrement `MERGEDCELLS`), comptées dans les lignes gardées (les
lignes vides retirées). Le texte extrait écrit un tableau qui en a en **HTML** (`writtenTable`,
`mergedTable` de `src/core/tables.ts` : `colspan`, `rowspan`, la première ligne en `<th>`, le
texte échappé, ses sauts de ligne en `<br>`) ; sans fusion, en Markdown comme avant. Ceux qui
lisent `rows` (l'import d'exigences) ne changent pas.

## Les équations de Word en LaTeX ; le texte page par page (v0.13.0, Black Projects 0.106.0)

- Les **équations** d'un `.docx` (Office Math, `m:oMath`) s'écrivent en LaTeX
  (`readers/omml.ts`) : `$…$` dans une phrase, `$$…$$` seules (`m:oMathPara`). Fractions,
  puissances et indices, racines, sommes et intégrales, parenthèses, fonctions (`\sin`…),
  accents, limites, matrices, symboles (grec, ≤, ×, ∞…) ; le reste, pour son contenu. Avant,
  leurs caractères étaient mis bout à bout (« r2 »).
- `pdfPageTexts(octets)` : le texte d'un PDF **page par page** — ce qu'on dit à un modèle de
  vision que l'extraction a lu sur la page qu'il regarde.

## Des listes Markdown fidèles (v0.12.0, Black Projects 0.105.0)

- Les éléments d'une liste s'écrivent **l'un sous l'autre** (une seule liste pour Markdown et
  Obsidian ; avant, une ligne vide entre chacun), avec leur **niveau** (quatre espaces par
  niveau) et leur **genre** : `- ` pour une puce, `1. ` pour un numéro (`listItem` de
  `src/core/lists.ts`).
- **Word** (`.docx`) : le niveau (`w:ilvl`) et le genre lus dans `word/numbering.xml`
  (`numFmt` : `bullet` ou un numéro), sinon d'après le style (« List Number 2 ») — champs
  `listLevel` et `ordered` d'un paragraphe. **HTML** : une liste dans un élément, un niveau de
  plus ; `<ol>`, numérotée. **PowerPoint** : `lvl` et `buAutoNum`.
- Les **puces tapées** dans le texte (« • », « ▪ », « – »…, qui ne sont pas des listes pour
  Markdown) deviennent `- ` (`completeLists`) ; dans un élément de liste, elles sont retirées.

## Des tableaux Markdown complets (v0.11.0, Black Projects 0.104.0)

Les tableaux lus (Word, PDF, Excel, PowerPoint, HTML, anciens `.doc` et `.rtf`) s'écrivaient en
lignes `| a | b |` **sans ligne de séparation** : ni Obsidian ni la fiche d'un document ne les
montraient en tableaux — des barres dans un paragraphe. Ils s'écrivent maintenant en tableaux
Markdown complets (`markdownTable` de `src/core/tables.ts`) : la première ligne en en-tête,
`| --- |`, puis les lignes, toutes du même nombre de colonnes ; sans ligne vide ni colonne vide
de bout en bout (cases fusionnées, bordures). Les `.doc` et `.rtf` passent par
`completeTables`. Dans un `.docx`, une case sur plusieurs colonnes (`gridSpan`) est suivie de
cases vides : les colonnes restent alignées.

## Dans Obsidian

**Réglages → Modules → Lecture de fichiers** : l'état du module. Le désactiver désactive
aussi les modules qui en dépendent (l'analyse d'appels d'offres passe à l'état
« Module requis indisponible »).

**Cliquer sur le nom du module**, ou sur le bouton **Formats de fichiers** à droite, ouvre
une fenêtre **Lecture de fichiers — Formats de fichiers** : une ligne par famille (PDF,
traitement de texte, tableurs, présentations, web/texte/données, bancs d'essai,
messagerie, images, archives et échanges), **trois fiches par ligne**, **une fiche par
extension** (v0.4.0 du module) — plusieurs pour une même extension quand ses cas
diffèrent : le PDF a quatre fiches (texte natif, protégé contre la modification, scan,
protégé par mot de passe).

**La tuile, en page (v0.5.0, Black Projects 0.56.0)** : revue du module — il n'a pas de
commande ; sa seule entrée dans l'interface, la tuile `lecture.formats`, ouvrait déjà la
page « Fonctions » du module (`core.fonctions?lecture-fichiers`, par `openWindow`). Avec
des pages (`ModuleContext.showPage`), la tuile l'ouvre maintenant directement et déclare
cette page (`page`), comme les autres tuiles qui mènent à une page ; sans page chez la
plateforme, la fenêtre du module, comme avant. Tests : `test/lecture-page.test.ts`.

### Lu, écrit, affiché

Chaque fiche porte trois constats, **Lu**, **Écrit**, **Affiché**, en pastilles vertes
(oui) ou rouges (non), avec une infobulle :

| Constat | D'où il vient |
| --- | --- |
| **Lu par Black Projects** | l'état du lecteur : Oui ; sinon « Non · à venir, étape N » ou « Non · à venir » |
| **Écrit** | `WRITTEN` dans `capabilities.ts` : **Oui** pour `.md` (Black Projects écrit et met à jour ses notes) ; **Export uniquement** (vert, v0.4.8) quand le format est créé par export et jamais modifié ensuite — `.json` (exports de types, par Black Projects), `.pdf` (« Exporter en PDF » d'Obsidian) ; « Non · export à venir, étape 4 » pour `.reqif`, « étape 7 » pour `.docx`, `.xlsx`, `.pptx` (livrables) ; « Non · pas prévu » pour le reste. Les originaux importés sont gardés tels quels : ce n'est pas « écrire » le format |
| **Affiché** | la plateforme (`Platform.display`) : **Oui nativement** si Obsidian l'ouvre lui-même ; **Oui · par un plugin** ; **Oui · par Black Projects** si l'utilisateur l'a affiché (interrupteur) ; **Visible, ouvert à l'extérieur** (orange) si « Détecter toutes les extensions de fichier » est activé ; **Non · masqué** sinon |

Basculer un interrupteur redessine la fenêtre **sans la faire remonter** : la position
de défilement est gardée (v0.4.8).

**La couleur de la fiche** (`cardLook`) : **verte** si les trois sont oui ; **rouge** si
elle n'est ni lue ni écrite — son badge dit alors si c'est à venir (« Ni lu ni écrit · à
venir, étape 7 ») ou pas prévu ; **orange** sinon (« En partie »). Le résumé en tête de
fenêtre compte les fiches par couleur.

### Afficher ou masquer un type dans Obsidian

Les fiches des types qu'Obsidian n'ouvre pas lui-même (ni un de ses plugins) ont un
**interrupteur** : allumé, les fichiers de ce type apparaissent dans l'explorateur de
gauche, et s'ouvrent dans la **visionneuse de Black Projects**, en lecture seule — le
texte tel que ce module le lit, et les boutons « Ouvrir avec l'application de
l'ordinateur » et « Montrer dans le dossier ». Rien n'y est jamais réécrit. Éteint, ils
sont de nouveau masqués. Réglage `extensionsAffichees` du module (liste d'extensions) ;
les extensions équivalentes ajoutées ont aussi leur interrupteur.

Côté plateforme Obsidian (`src/obsidian/platform.ts`, `obsidianDisplay` ;
`src/obsidian/fileViewer.ts`) : chaque extension affichée est déclarée à Obsidian
(`registerExtensions`) pour la vue `black-projects-file`, et retirée
(`viewRegistry.unregisterExtensions`) quand on l'éteint ; les extensions qu'Obsidian
ouvre lui-même sont une liste, complétée par `viewRegistry.isExtensionRegistered` pour
celles d'un plugin ; `showUnsupportedFiles` dit si « Détecter toutes les extensions »
est activé. Ces trois appels ne sont pas dans l'API publique et sont faits prudemment :
sans moyen de retirer une extension, elle reste affichée jusqu'au prochain démarrage.

### Extensions équivalentes

En tête de la fenêtre **Formats de fichiers**, la section **Extensions équivalentes**
permet de lire des fichiers dont l'extension n'est pas connue mais qui sont d'un format
lu : par exemple des fichiers `.tot` qui sont du XML. Saisir l'extension, choisir
« lu comme .xml », **Ajouter** (ou Entrée). Les blocs de la fenêtre se mettent à jour
aussitôt.

- Les fichiers `.tot` sont alors lus partout : par la commande (« TOT lu comme XML »),
  et par tout module qui lit des documents.
- Ils apparaissent dans la fenêtre **Formats de fichiers**, dans une ligne
  « Extensions ajoutées ».
- On ne peut pas redéfinir une extension déjà lue (`.pdf`, `.docx`…), ni viser un
  format non lu ; un message explique pourquoi.
- La corbeille retire une équivalence.

Ce détail vient de `catalogue.ts`. La page **Lecture de fichiers** de la documentation
écrite dans le coffre (`doc/Lecture de fichiers.md`) reprend les mêmes formats en
tableaux, et les équivalences déclarées. Un test garantit que les formats annoncés « Lecture
intégrée » sont exactement ceux que le module lit : la vitrine ne peut ni promettre plus
que le code, ni oublier un format qu'il sait lire.

La commande provisoire « Lire un fichier du coffre », livrée à l'étape 1, a été retirée à
l'étape 2 : la lecture se fait désormais à l'import des pièces d'une analyse d'appel
d'offres.

**Archives** (v0.3.0) : `readArchive` ouvre un ZIP — fichiers avec leur chemin, archive
imbriquée ouverte sur deux niveaux, fichiers parasites écartés (`__MACOSX`, `.DS_Store`,
`Thumbs.db`, fichiers cachés), noms écrits par Windows en page de code 437 relus
correctement.

## Pour les autres modules

```ts
import { readVaultFile } from '../lecture-fichiers'

const outcome = await readVaultFile(context.platform.fs, 'AO/Pièces/CCTP.pdf')
if (outcome.ok) outcome.text        // Markdown : titres, listes, tableaux
else outcome.problem                // 'unsupported' | 'empty' | 'unreadable'
```

`readVaultFile` ne lève jamais d'exception pour un fichier illisible. L'interface publique
expose aussi les lecteurs par format (`readDocx`, `readSpreadsheet`, `readPptx`, `readPdf`
+ `pdfBlocks`, `readHtml`, `readMarkdown`) et `unzip` / `parseXml`, dont l'extraction des
exigences aura besoin.

## Point d'entrée des octets : `fileText(extension, octets)`

Il choisit le bon lecteur et rend du Markdown :

```
## Article 2 — Exigences

| Identifiant | Exigence | Vérification |
| EX-SOL-001 | Le titulaire doit fournir une antenne de 3,7 m de diamètre. | Inspection |
```

Quand il n'y a pas de texte à rendre, il dit pourquoi (`FileReadError`) :

| Raison | Cas |
| --- | --- |
| `unsupported` | format non pris en charge (image, DWG, ZIP…) |
| `empty` | aucun texte : PDF scanné, document vide |
| `unreadable` | fichier abîmé, ou protégé par un mot de passe |

## Formats lus

| Format | Lecteur | Remarques |
| --- | --- | --- |
| PDF | `pdfRead` + `pdfText` | Paragraphes, titres et tableaux reconstitués d'après la page. PDF « protégés contre la modification » ouverts (RC4 40-128 bits, AES 128/256) ; PDF exigeant un mot de passe d'ouverture refusés. |
| Word 2007+ (`.docx`) | `docxRead` | Titres selon les styles, listes, tableaux, contrôles de contenu. |
| Word 97-2003 (`.doc`, `.dot`) | `docRead` | Texte et tableaux, sans mise en forme. Un `.doc` qui est en réalité du RTF, du HTML ou un `.docx` renommé est reconnu à son contenu. |
| RTF | `rtfRead` | Texte et accents selon la page de code. |
| Excel 2007+ (`.xlsx`, `.xlsm`) | `xlsxRead` | Feuille par feuille, valeurs en texte, dates en dates. |
| Excel 97-2003 (`.xls`) | `xlsRead` | Idem ; classeurs protégés contre la modification ouverts ; mot de passe d'ouverture refusé. |
| PowerPoint 2007+ (`.pptx`) | `pptxRead` | Diapositive par diapositive, formes dans l'ordre de lecture, tableaux. |
| HTML | `htmlRead` | Sans scripts ni styles ; l'espace insécable devient une espace simple. |
| Markdown | `markdownRead` | En-tête YAML, titres, listes, tableaux ; le code est ignoré. |
| Texte (`txt`, `csv`, `json`, `xml`, `log`…) | — | UTF-8, sinon page de code Windows. |

## Le workflow système : signaler les formats non lus (v0.6.0, Black Projects 0.63.0)

Le module n'avait aucun automatisme à convertir (il lit quand un autre module le lui
demande). Il en gagne un, écrit en [workflow système](workflows.md) (`workflows.ts`) :

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Signaler les formats non lus, au dépôt de fichiers (`sys.lecture-fichiers.formats-non-lus`) | *Fichiers déposés dans l'application* (de la [bibliothèque](bibliotheque.md)) | `lecture-fichiers.formats-non-lus` : prévient des fichiers dont le format n'est pas lu, et dit où déclarer une extension équivalente | actif |

- `unreadFiles(noms, isReadable, à taire)` (interface publique) : ni lecteur ni
  équivalence (`isReadable`, qui tient compte des extensions équivalentes), ni image
  (montrée, pas lue), ni archive (ouverte) ; un fichier sans extension est signalé.
- L'action : champ `fichiers` (`{fichiers}` d'origine — les noms du dépôt, pris tels
  quels dans la liste du sujet), champ `ignorer` (des extensions à taire : « dwg, exe »).
  Rien de non lu : rien n'est dit, le journal garde « Tous les formats déposés sont lus. ».
- Le message : « Station sol — 1 fichier(s) dans un format non lu (.tot) : Releve.tot. Si
  c'est du texte, déclarez une extension équivalente : Formats de fichiers → Extensions
  équivalentes. »
- Le déclencheur est celui de la bibliothèque de documents : sans elle (ou sans le module
  Workflows), ce workflow ne se déclenche pas. Ce que l'on verse soi-même dans la
  bibliothèque ne passe pas par lui.

## Trois nouveaux workflows système (v0.7.0, Black Projects 0.71.0)

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Signaler les pièces illisibles, à l'import (`sys.lecture-fichiers.illisibles`) | *Pièces importées*, `illisibles` non vide | `lecture-fichiers.illisibles` : nomme les pièces illisibles (fichier abîmé, protégé par un mot de passe d'ouverture), et que faire | actif |
| Signaler les pièces sans texte (scans), à l'import (`sys.lecture-fichiers.sans-texte`) | *Pièces importées*, `sanstexte` non vide | `lecture-fichiers.sans-texte` : nomme les pièces sans texte lisible, que l'extraction et l'IA ne voient pas | désactivé |
| Bilan des formats du coffre, chaque lundi (`sys.lecture-fichiers.bilan-formats`) | lundi à 8 h | `lecture-fichiers.bilan-formats` (`formatsOf`) : les fichiers du coffre, sans ses dossiers cachés, par format — notes, lus, images, archives, non lus — et les extensions non lues (champ « ignorer ») | désactivé |

L'analyse d'appels d'offres donne au déclencheur *Pièces importées* deux nouvelles listes :
`illisibles` et `sanstexte` (le nom du fichier de chaque pièce dans cet état).
Tests : `test/lecture-workflows-ao.test.ts`.

## Lisible ou non, pour les workflows de la bibliothèque (v0.8.0, Black Projects 0.80.0)

À son activation, le module dit à la [bibliothèque](bibliotheque.md) comment un fichier est
lu (`setReadability`) : `archive`, `image`, `texte` (un lecteur, ou une extension
équivalente), sinon `non-lu` ; à sa désactivation, plus rien. Les workflows y trouvent
`{extension}`, `{lisible}` et `{lecture}` (*document versé*), `{extensions}` et
`{nonlisibles}` (*fichiers déposés*).

## Le texte des documents versés, pour leur langue (v0.9.0, Black Projects 0.82.0)

À son activation, le module donne aussi à la [bibliothèque](bibliotheque.md) de quoi lire
le texte d'un fichier versé (`setTextReader` : `fileText`, extensions équivalentes
comprises ; une image, une archive, un format non lu : `null`) ; elle en devine la langue.

## Ce qui n'est pas lu (aujourd'hui)

- **Les scans et les images** : il faudra un modèle qui voit. Prévu avec le serveur d'IA
  de l'entreprise si un modèle de vision y est disponible.
- **PowerPoint 97-2003** (`.ppt`) et **OpenDocument** (`.odt`, `.ods`).
- Les documents protégés par un **mot de passe d'ouverture**.

Limite connue de `markdownRead` : les lignes d'un paragraphe restent ensemble, comme
elles ont été écrites ; une liste collée à un paragraphe, sans ligne vide, en fait donc
partie.

## La transcription des documents de la bibliothèque (v0.10.0, Black Projects 0.100.0)

À son activation, le module donne à la [bibliothèque](bibliotheque.md) de quoi transcrire un
fichier versé (`setTranscriber`) : son texte, ou pourquoi il n'y en a pas — `image`,
`non-lue` (format non lu, archive), `sans-texte` (un scan, un document vide), `illisible` —,
comme la lecture des pièces d'une analyse. Désactivé, il la retire.

## Organisation

```
src/modules/lecture-fichiers/
├── README.md        guide de maintenance
├── index.ts         interface publique + déclaration du module
├── lecture.ts       readVaultFile : lire un fichier du coffre
├── i18n.ts          textes
├── readers/         un lecteur par format, et fileText qui les aiguille
└── formats/         briques propres à la lecture : unzip, xmlParse, cfb, pdfCrypt
```

Restent dans le cœur (`src/core/formats/`) les briques partagées avec l'écriture :
`zip` (et son CRC), `xml` (échappement), `pdfFont` (métriques des polices standard).

## Les générateurs (`src/core/writers/`) — hors du module

`docx`, `xlsx`, `pptx` : repris dès cette étape parce que les tests des lecteurs
fabriquent leurs fichiers avec ; ils serviront aux livrables de l'étape 7 (matrice de
conformité, rapport).

## Tests

- `test/lecture-workflows.test.ts` : le workflow système (créé actif, une pièce `.tot`
  signalée, tout lu, extension équivalente, extension à taire, désactivé, sans la
  bibliothèque) et `unreadFiles`.

- Tests unitaires de chaque lecteur, repris avec lui.
- `lecture.test.ts` : `readVaultFile` et la commande, sur une plateforme en mémoire.
- `test/dce.test.ts` : un dossier de consultation fictif (`test/fixtures/dce-exemple/`)
  produit par **d'autres outils que les nôtres** — LibreOffice pour Word, RTF et PDF,
  pandoc pour HTML et PowerPoint — lu pièce par pièce.
