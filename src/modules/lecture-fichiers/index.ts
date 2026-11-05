// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module Lecture de fichiers — et sa **seule porte d'entrée**.
 *
 * Tout ce qui lit un fichier dans Black Projects est dans ce répertoire, et rien d'autre
 * n'y est. Les autres modules n'importent que ce fichier : ce qui est exporté ici est
 * l'interface publique du module ; le reste (`readers/`, `formats/`) est son affaire
 * et peut changer sans toucher à personne. `pnpm check:modules` le vérifie.
 *
 * Voir README.md dans ce répertoire pour la maintenance.
 */

import type { BlackModule, MappingField } from '../../core/modules/module'
import {
  ALIASES_KEY,
  aliasTargets,
  configureAliases,
  currentAliases,
  normalizeExtension,
  readAliases,
  resolveExtension,
  validateAlias
} from './aliases'
import type { FileDisplay } from '../../core/ports'
import { readShown } from './capabilities'
import { formatsCatalogue } from './catalogue'
import { lectureDocs } from './doc'
import { lectureEn, lectureFr } from './i18n'
import { fileText as rawFileText, isReadable as rawIsReadable, TEXT_EXTENSIONS } from './readers/fileText'

// ── Interface publique ────────────────────────────────────────────────────────────
export { extensionOf, nameOf, readVaultFile, type ReadOptions, type ReadOutcome } from './lecture'
export { currentAliases, resolveExtension } from './aliases'
export { SHOWN_KEY } from './capabilities'
export { ARCHIVE_EXTENSIONS, ArchiveError, isArchive, readArchive, type ArchiveEntry } from './archive'
export {
  blocksText,
  FileReadError,
  imageDataUrl,
  isImage,
  plainText,
  READABLE_EXTENSIONS,
  TEXT_EXTENSIONS,
  type FileProblem
} from './readers/fileText'
export { readDocx, type DocxReadBlock } from './readers/docxRead'
export { readSpreadsheet } from './readers/xlsRead'
export { readPptx } from './readers/pptxRead'
export { readPdf } from './readers/pdfRead'
export { pdfBlocks } from './readers/pdfText'
export { readHtml } from './readers/htmlRead'
export { readMarkdown } from './readers/markdownRead'
export { unzip } from './formats/unzip'
export { parseXml, type XmlNode } from './formats/xmlParse'

/**
 * Le texte d'un fichier, d'après son extension et ses octets — en tenant compte des
 * extensions équivalentes déclarées dans les réglages (`.tot` lu comme du XML).
 */
export function fileText(extension: string, bytes: Uint8Array): Promise<string> {
  return rawFileText(resolveExtension(extension), bytes)
}

/** L'extension est-elle lue — par un lecteur intégré ou comme équivalente d'un format lu ? */
export function isReadable(extension: string): boolean {
  return rawIsReadable(resolveExtension(extension))
}

/** Les extensions dont le texte est lu : les formats intégrés et les équivalences déclarées. */
export function readableExtensions(): Set<string> {
  return new Set([...TEXT_EXTENSIONS, ...Object.keys(currentAliases())])
}

// ── Le module ─────────────────────────────────────────────────────────────────────
export const LECTURE_FICHIERS = 'lecture-fichiers'

/** Le réglage « Extensions équivalentes », dessiné par la plateforme. */
const aliasesField: MappingField = {
  kind: 'mapping',
  key: ALIASES_KEY,
  nameKey: 'lecture-fichiers.alias.setting',
  descKey: 'lecture-fichiers.alias.setting.desc',
  placeholderKey: 'lecture-fichiers.alias.placeholder',
  prefix: '.',
  connectorKey: 'lecture-fichiers.alias.connector',
  tooltipKeys: {
    from: 'lecture-fichiers.alias.tip.from',
    to: 'lecture-fichiers.alias.tip.to',
    add: 'lecture-fichiers.alias.tip.add',
    edit: 'lecture-fichiers.alias.tip.edit',
    remove: 'lecture-fichiers.alias.tip.remove'
  },
  options: aliasTargets,
  defaultOption: 'txt',
  normalize: normalizeExtension,
  validate: validateAlias,
  read: readAliases,
  editable: true,
  editTitleKey: 'lecture-fichiers.alias.editTitle',
  fromLabelKey: 'lecture-fichiers.alias.from',
  toLabelKey: 'lecture-fichiers.alias.to'
}

let unsubscribe: (() => void) | null = null
/** Ce que la plateforme montre des fichiers, pour la fenêtre des formats. */
let display: FileDisplay | undefined

export const lectureFichiersModule: BlackModule = {
  id: LECTURE_FICHIERS,
  nameKey: 'lecture-fichiers.name',
  descriptionKey: 'lecture-fichiers.description',
  version: '0.4.0',
  requires: [],
  texts: { fr: lectureFr, en: lectureEn },
  details: (settings) => formatsCatalogue(readAliases(settings), display),
  settingsFields: [aliasesField],
  docs: (input) => lectureDocs(input, display),
  activate({ settings, platform }) {
    display = platform.display
    configureAliases(readAliases(settings.get()))
    // Les types que l'utilisateur a choisi d'afficher : la plateforme les montre.
    display?.show(readShown(settings.get()))
    unsubscribe = settings.onChange((values) => {
      configureAliases(readAliases(values))
      display?.show(readShown(values))
    })
  },
  deactivate() {
    unsubscribe?.()
    unsubscribe = null
    configureAliases({})
    display?.show([])
    display = undefined
  }
}
