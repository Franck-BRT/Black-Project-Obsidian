# Module — Lecture de fichiers (`lecture-fichiers`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `lecture-fichiers` |
| Emplacement | **`src/modules/lecture-fichiers/`** — tout le code de lecture, et rien d'autre |
| Interface publique | `src/modules/lecture-fichiers/index.ts` |
| Guide de maintenance | [`src/modules/lecture-fichiers/README.md`](../../src/modules/lecture-fichiers/README.md) |
| Requiert | — |
| Utilisé par | Analyse d'appels d'offres (`ao`) ; tout futur module qui lit des documents |
| Étape | 1 (v0.2.0), devenu module en v0.2.1 |
| Dépendances externes | **aucune** : tout est lu « à la main », avec les seules API du navigateur (`DecompressionStream`, `crypto.subtle`, `TextDecoder`) |

Le module transforme un document en texte que l'outil, puis l'IA, peuvent lire : paragraphes, titres avec leur niveau, listes, et **tableaux gardés en lignes et
colonnes** — c'est là que sont souvent les exigences et les prix.

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

## Ce qui n'est pas lu (aujourd'hui)

- **Les scans et les images** : il faudra un modèle qui voit. Prévu avec le serveur d'IA
  de l'entreprise si un modèle de vision y est disponible.
- **PowerPoint 97-2003** (`.ppt`) et **OpenDocument** (`.odt`, `.ods`).
- Les documents protégés par un **mot de passe d'ouverture**.

Limite connue de `markdownRead` : les lignes d'un paragraphe restent ensemble, comme
elles ont été écrites ; une liste collée à un paragraphe, sans ligne vide, en fait donc
partie.

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

- Tests unitaires de chaque lecteur, repris avec lui.
- `lecture.test.ts` : `readVaultFile` et la commande, sur une plateforme en mémoire.
- `test/dce.test.ts` : un dossier de consultation fictif (`test/fixtures/dce-exemple/`)
  produit par **d'autres outils que les nôtres** — LibreOffice pour Word, RTF et PDF,
  pandoc pour HTML et PowerPoint — lu pièce par pièce.
