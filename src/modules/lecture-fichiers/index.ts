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
import { formatsCatalogue } from './catalogue'
import { lectureEn, lectureFr } from './i18n'
import { nameOf, readVaultFile } from './lecture'
import { fileText as rawFileText, isReadable as rawIsReadable, TEXT_EXTENSIONS } from './readers/fileText'

// ── Interface publique ────────────────────────────────────────────────────────────
export { extensionOf, nameOf, readVaultFile, type ReadOptions, type ReadOutcome } from './lecture'
export { currentAliases, resolveExtension } from './aliases'
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
  options: aliasTargets,
  defaultOption: 'txt',
  normalize: normalizeExtension,
  validate: validateAlias,
  read: readAliases
}

let unsubscribe: (() => void) | null = null

export const lectureFichiersModule: BlackModule = {
  id: LECTURE_FICHIERS,
  nameKey: 'lecture-fichiers.name',
  descriptionKey: 'lecture-fichiers.description',
  version: '0.2.0',
  requires: [],
  texts: { fr: lectureFr, en: lectureEn },
  details: (settings) => formatsCatalogue(readAliases(settings)),
  settingsFields: [aliasesField],
  activate({ platform, i18n, commands, settings }) {
    configureAliases(readAliases(settings.get()))
    unsubscribe = settings.onChange((values) => configureAliases(readAliases(values)))

    // Provisoire : de quoi essayer les lecteurs dans Obsidian avant que l'analyse
    // d'appels d'offres ne s'en serve. À retirer quand l'étape 2 sera livrée.
    commands.register({
      id: 'lire-fichier',
      nameKey: 'lecture-fichiers.command.read',
      async run() {
        const path = await platform.ui.pickFile({
          extensions: readableExtensions(),
          placeholder: i18n.t('lecture-fichiers.pick.placeholder')
        })
        if (path === null) return
        const name = nameOf(path)
        platform.notifier.notify(i18n.t('lecture-fichiers.reading', { name }), 2000)
        const outcome = await readVaultFile(platform.fs, path)
        if (!outcome.ok) {
          platform.notifier.notify(
            i18n.t(`lecture-fichiers.problem.${outcome.problem}`, { name, format: outcome.extension || '—' }),
            8000
          )
          return
        }
        platform.ui.showText({
          title: name,
          subtitle: i18n.t('lecture-fichiers.result.subtitle', {
            format:
              outcome.readAs === outcome.extension
                ? outcome.extension.toUpperCase()
                : i18n.t('lecture-fichiers.result.alias', {
                    format: outcome.extension.toUpperCase(),
                    target: outcome.readAs.toUpperCase()
                  }),
            characters: outcome.text.length.toLocaleString(i18n.language),
            lines: outcome.text.split('\n').length.toLocaleString(i18n.language),
            ms: outcome.ms
          }),
          text: outcome.text
        })
      }
    })
  },
  deactivate() {
    unsubscribe?.()
    unsubscribe = null
    configureAliases({})
  }
}
