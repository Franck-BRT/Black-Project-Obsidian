# Lecture de fichiers — guide de maintenance

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

**Toute modification de la lecture de fichiers se fait dans ce répertoire, et nulle part
ailleurs.** Le reste du code ne connaît que `index.ts` ; `pnpm check:modules` refuse tout
import de l'intérieur de ce répertoire depuis l'extérieur.

Documentation fonctionnelle : [`docs/modules/lecture-fichiers.md`](../../../docs/modules/lecture-fichiers.md).

## Carte du répertoire

| Fichier | Rôle |
| --- | --- |
| `index.ts` | **Interface publique** (ce que les autres modules ont le droit d'utiliser) et déclaration du module |
| `lecture.ts` | `readVaultFile` : lit un fichier du coffre, rend le texte ou la raison de l'échec |
| `aliases.ts` | **Extensions équivalentes** (`.tot` lu comme `.xml`) : validation, lecture des réglages, application à toute lecture |
| `catalogue.ts` | **Catalogue des formats**, ouvert depuis les réglages dans sa propre fenêtre : intégré, en développement (avec l'étape), prévu |
| `i18n.ts` | Textes français et anglais, clés `lecture-fichiers.*` |
| `readers/fileText.ts` | Aiguilleur : extension → lecteur ; liste des extensions lisibles ; mise en Markdown |
| `readers/pdfRead.ts` | PDF : objets, flux, polices, positions du texte |
| `readers/pdfText.ts` | PDF : positions → lignes, paragraphes, titres, tableaux |
| `readers/docxRead.ts` | Word 2007+ |
| `readers/docRead.ts` | Word 97-2003 |
| `readers/rtfRead.ts` | RTF |
| `readers/xlsxRead.ts` | Excel 2007+ |
| `readers/xlsRead.ts` + `xlsCrypt.ts` | Excel 97-2003, et classeurs protégés contre la modification |
| `readers/pptxRead.ts` | PowerPoint 2007+ |
| `readers/htmlRead.ts` | HTML |
| `readers/markdownRead.ts` | Markdown |
| `formats/unzip.ts` | Archives ZIP (Office, ReqIF compressé), avec contrôle CRC |
| `formats/xmlParse.ts` | Analyse XML |
| `formats/cfb.ts` | Fichiers composés d'Office 97-2003 |
| `formats/pdfCrypt.ts` | Déchiffrement des PDF protégés contre la modification |

Dépendances hors du module, toutes dans le cœur : `core/formats/zip` (CRC),
`core/formats/pdfFont` (largeur des caractères), `core/ports` (accès aux fichiers),
`core/modules/module` (contrat). Les tests utilisent aussi `core/writers` pour fabriquer
leurs fichiers.

## Ajouter un format

1. Écrire `readers/<format>Read.ts`, qui rend des `DocxReadBlock[]` (paragraphes et
   tableaux) ou du texte. Aucune dépendance externe : API du navigateur seulement
   (`DecompressionStream`, `crypto.subtle`, `TextDecoder`).
2. Le brancher dans `readers/fileText.ts` : ajouter l'extension à `READABLE_EXTENSIONS`
   et le cas dans `fileText`.
3. Dans `catalogue.ts`, passer le format à `'available'` (ou l'ajouter), avec ses
   libellés dans `i18n.ts` ; le test du catalogue échoue tant que la vitrine et le code
   ne disent pas la même chose.
4. Si d'autres modules en ont besoin directement, l'exporter dans `index.ts`.
5. Tests : `readers/<format>Read.test.ts` ; si possible un fichier produit par l'outil
   d'origine dans `test/fixtures/dce-exemple/`, et un cas dans `test/dce.test.ts`.
6. Mettre à jour le tableau des formats dans `docs/modules/lecture-fichiers.md`.

## Corriger un lecteur

1. Reproduire avec un test qui échoue (un fichier réel anonymisé de préférence).
2. Corriger dans le lecteur concerné.
3. `pnpm run check` : tous les lecteurs ont leurs tests, et `test/dce.test.ts` relit un
   dossier complet.

## Extensions équivalentes

L'utilisateur déclare, dans la fenêtre Formats de fichiers, qu'une extension inconnue est d'un format lu
(`.tot` → `.xml`). `aliases.ts` refuse de redéfinir une extension déjà lue et n'accepte
comme cible qu'un format intégré. Les équivalences sont appliquées par `readVaultFile`,
et par `fileText` / `isReadable` **de l'interface publique** (`index.ts`) ; les fonctions
de même nom dans `readers/fileText.ts` restent brutes, sans équivalences.

## Règles

- Un fichier illisible n'est jamais une exception pour l'appelant : `readVaultFile` rend
  `{ ok: false, problem }` avec `unsupported`, `empty` ou `unreadable`.
- Pas d'import d'Obsidian ni de Node ici : le module doit tourner aussi dans
  l'application de bureau (lint).
- Chaque fichier porte la mention de propriété Black Room (`pnpm check:headers`).
