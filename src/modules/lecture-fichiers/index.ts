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
import { modulePageOf } from '../../core/settingsPage'
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
import { setReadability, setTextReader, setTranscriber } from '../bibliotheque'
import { isArchive } from './archive'
import { fileText as rawFileText, FileReadError, isImage, isReadable as rawIsReadable, TEXT_EXTENSIONS } from './readers/fileText'
import { registerLectureWorkflows } from './workflows'

// ── Interface publique ────────────────────────────────────────────────────────────
export { extensionOf, nameOf, readVaultFile, type ReadOptions, type ReadOutcome } from './lecture'
export { currentAliases, resolveExtension } from './aliases'
export { SHOWN_KEY } from './capabilities'
export { SYS_UNREAD, unreadFiles } from './workflows'
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
export { readDocx, type DocxReadBlock, type DocxReadParagraph } from './readers/docxRead'
export { readSpreadsheet } from './readers/xlsRead'
export { type XlsxReadSheet } from './readers/xlsxRead'
export { readPptx, type PptxReadSlide, type PptxReadText } from './readers/pptxRead'
export { PdfError, readPdf, type PdfContent } from './readers/pdfRead'
export { pdfBlocks, readsByStructure } from './readers/pdfText'
export { readHtml } from './readers/htmlRead'
export { readMarkdown } from './readers/markdownRead'
export { unzip, ZipError } from './formats/unzip'
export { childLocal, childrenLocal, localName, parseXml, XmlError, type XmlNode } from './formats/xmlParse'

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
  version: '0.12.0',
  requires: [],
  texts: { fr: lectureFr, en: lectureEn },
  details: (settings) => formatsCatalogue(readAliases(settings), display),
  settingsFields: [aliasesField],
  docs: (input) => lectureDocs(input, display),
  activate({ settings, platform, views, openWindow, showPage, i18n }) {
    display = platform.display
    // L'accueil : une tuile pour les formats — leur page (« Fonctions » du module) quand la
    // plateforme a des pages, marquée « page en cours » quand on y est ; sinon la fenêtre.
    const formats = modulePageOf(LECTURE_FICHIERS)
    const open = showPage ? () => showPage(formats) : openWindow
    if (views && open) {
      views.tile({
        id: 'lecture.formats',
        label: i18n.t('lecture-fichiers.details.title'),
        icon: 'file',
        color: 'slate',
        group: i18n.t('lecture-fichiers.name'),
        description: i18n.t('lecture-fichiers.tile.formats'),
        order: 80,
        ...(showPage ? { page: formats } : {}),
        run: () => open()
      })
    }
    configureAliases(readAliases(settings.get()))
    // Le workflow système : signaler les formats non lus, au dépôt de fichiers.
    registerLectureWorkflows((key, vars) => i18n.t(key, vars), isReadable, () => platform.fs)
    // La bibliothèque dit aux workflows si un fichier versé est lu, et comment.
    setReadability((extension) => {
      const resolved = resolveExtension(extension)
      if (isArchive(resolved)) return 'archive'
      if (isImage(resolved)) return 'image'
      return isReadable(extension) ? 'texte' : 'non-lu'
    })
    // Et son texte, pour deviner sa langue (un fichier non lu, une image, une archive : rien).
    setTextReader(async (name, bytes) => {
      const at = name.lastIndexOf('.')
      const extension = at > name.lastIndexOf('/') ? name.slice(at + 1).toLowerCase() : ''
      const resolved = resolveExtension(extension)
      if (!isReadable(extension) || isImage(resolved) || isArchive(resolved)) return null
      try {
        return await fileText(extension, bytes)
      } catch {
        return null
      }
    })
    // Et sa transcription, écrite dans sa fiche — comme le texte d'une pièce d'analyse.
    setTranscriber(async (name, bytes) => {
      const at = name.lastIndexOf('.')
      const extension = at > name.lastIndexOf('/') ? name.slice(at + 1).toLowerCase() : ''
      const resolved = resolveExtension(extension)
      if (isImage(resolved)) return { state: 'image', text: '' }
      if (!isReadable(extension) || isArchive(resolved)) return { state: 'non-lue', text: '' }
      try {
        return { state: 'lue', text: await fileText(extension, bytes) }
      } catch (error) {
        if (error instanceof FileReadError && error.problem === 'empty') return { state: 'sans-texte', text: '' }
        if (error instanceof FileReadError && error.problem === 'unsupported') return { state: 'non-lue', text: '' }
        return { state: 'illisible', text: '' }
      }
    })
    // Les types que l'utilisateur a choisi d'afficher : la plateforme les montre.
    display?.show(readShown(settings.get()))
    unsubscribe = settings.onChange((values) => {
      configureAliases(readAliases(values))
      display?.show(readShown(values))
    })
  },
  deactivate() {
    setReadability(null)
    setTextReader(null)
    setTranscriber(null)
    unsubscribe?.()
    unsubscribe = null
    configureAliases({})
    display?.show([])
    display = undefined
  }
}
