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

import type { BlackModule } from '../../core/modules/module'
import { lectureEn, lectureFr } from './i18n'
import { nameOf, readVaultFile } from './lecture'
import { READABLE_EXTENSIONS } from './readers/fileText'

// ── Interface publique ────────────────────────────────────────────────────────────
export { extensionOf, nameOf, readVaultFile, type ReadOutcome } from './lecture'
export {
  blocksText,
  fileText,
  FileReadError,
  imageDataUrl,
  isImage,
  isReadable,
  plainText,
  READABLE_EXTENSIONS,
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

// ── Le module ─────────────────────────────────────────────────────────────────────
export const LECTURE_FICHIERS = 'lecture-fichiers'

export const lectureFichiersModule: BlackModule = {
  id: LECTURE_FICHIERS,
  nameKey: 'lecture-fichiers.name',
  descriptionKey: 'lecture-fichiers.description',
  version: '0.2.0',
  requires: [],
  texts: { fr: lectureFr, en: lectureEn },
  activate({ platform, i18n, commands }) {
    // Provisoire : de quoi essayer les lecteurs dans Obsidian avant que l'analyse
    // d'appels d'offres ne s'en serve. À retirer quand l'étape 2 sera livrée.
    commands.register({
      id: 'lire-fichier',
      nameKey: 'lecture-fichiers.command.read',
      async run() {
        const path = await platform.ui.pickFile({
          extensions: READABLE_EXTENSIONS,
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
            format: outcome.extension.toUpperCase(),
            characters: outcome.text.length.toLocaleString(i18n.language),
            lines: outcome.text.split('\n').length.toLocaleString(i18n.language),
            ms: outcome.ms
          }),
          text: outcome.text
        })
      }
    })
  }
}
