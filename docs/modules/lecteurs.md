# Cœur — lecteurs de documents

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Emplacement | `src/core/readers/`, `src/core/formats/`, `src/core/writers/` |
| Étape | 1 (v0.2.0) |
| Dépendances externes | **aucune** : tout est lu « à la main », avec les seules API du navigateur (`DecompressionStream`, `crypto.subtle`, `TextDecoder`) |

Les lecteurs transforment une pièce du dossier en texte que l'outil, puis l'IA, peuvent
lire : paragraphes, titres avec leur niveau, listes, et **tableaux gardés en lignes et
colonnes** — c'est là que sont souvent les exigences et les prix.

## Point d'entrée unique : `fileText(extension, octets)`

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

- **Les scans et les images** : il faudra un modèle qui voit. Prévu avec Sidonie si un
  modèle de vision y est disponible.
- **PowerPoint 97-2003** (`.ppt`) et **OpenDocument** (`.odt`, `.ods`).
- Les documents protégés par un **mot de passe d'ouverture**.

Limite connue de `markdownRead` : les lignes d'un paragraphe restent ensemble, comme
elles ont été écrites ; une liste collée à un paragraphe, sans ligne vide, en fait donc
partie.

## Les briques (`src/core/formats/`)

`zip` / `unzip` (archives, avec contrôle CRC), `xmlParse` / `xml`, `cfb` (fichiers
composés d'Office 97-2003), `pdfCrypt` (déchiffrement PDF), `pdfFont` (métriques des
polices standard).

## Les générateurs (`src/core/writers/`)

`docx`, `xlsx`, `pptx` : repris dès cette étape parce que les tests des lecteurs
fabriquent leurs fichiers avec ; ils serviront aux livrables de l'étape 7 (matrice de
conformité, rapport).

## Tests

- Tests unitaires de chaque lecteur, repris avec lui.
- `test/dce.test.ts` : un dossier de consultation fictif (`test/fixtures/dce-exemple/`)
  produit par **d'autres outils que les nôtres** — LibreOffice pour Word, RTF et PDF,
  pandoc pour HTML et PowerPoint — lu pièce par pièce.
