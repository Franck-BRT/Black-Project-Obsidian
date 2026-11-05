// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Trouver les exigences d'un fichier, quel que soit son format — la seule porte d'entrée
 * de l'extraction. Le fichier est lu par le module Lecture de fichiers ; les exigences y
 * sont reconnues par les lecteurs de ce répertoire ; le résultat est toujours le même :
 * des lignes d'import, chacune avec l'endroit où elle a été trouvée.
 */

import {
  isArchive,
  PdfError,
  pdfBlocks,
  readDocx,
  readHtml,
  readMarkdown,
  readPdf,
  readPptx,
  readSpreadsheet,
  resolveExtension
} from '../../lecture-fichiers'
import { parseCsv } from './csv'
import { docxRequirements, startsRequirementRow, type ReqLocation } from './document'
import { readReqif, reqifFromArchive } from './reqif'
import { slideWords, documentWords } from './words'
import { pptxRequirements } from './slides'
import { xlsxTable } from './table'

/** Les extensions dont on sait extraire des exigences. */
export const EXTRACTABLE = ['docx', 'pdf', 'html', 'htm', 'md', 'xlsx', 'xlsm', 'xls', 'csv', 'tsv', 'pptx', 'reqif', 'reqifz'] as const

export interface Extraction {
  /** Les lignes d'import : `id`, `title`, `text.<langue>`, `status`… */
  rows: Record<string, string>[]
  /** Où chaque ligne a été trouvée, dans le même ordre. */
  where: ReqLocation[]
  /** Les en-têtes de colonnes, attributs ou relations qui n'ont pas de place dans une exigence. */
  ignored: string[]
  /** Des valeurs qui ne correspondent à rien de connu (« Vérification : Simulation »), gardées telles quelles. */
  unmatched: string[]
  /** La langue dans laquelle les formulations ont été lues. */
  lang: string
  /** Pourquoi le fichier n'a pas pu être lu, s'il ne l'a pas été : `unsupported`, `encrypted`, `unreadable`. */
  problem?: 'unsupported' | 'encrypted' | 'unreadable'
}

export function canExtract(extension: string): boolean {
  return (EXTRACTABLE as readonly string[]).includes(resolveExtension(extension.toLowerCase()))
}

const empty = (lang: string, problem?: Extraction['problem']): Extraction => ({
  rows: [],
  where: [],
  ignored: [],
  unmatched: [],
  lang,
  ...(problem ? { problem } : {})
})

/**
 * Les exigences d'un fichier. `languages` : les langues de rédaction, la première étant
 * celle dans laquelle on lit un document qui ne dit pas la sienne.
 */
export async function extractRequirements(extension: string, bytes: Uint8Array, languages: readonly string[]): Promise<Extraction> {
  const lang = languages[0] ?? 'fr'
  const words = documentWords(languages)
  const ext = resolveExtension(extension.toLowerCase())
  try {
    switch (ext) {
      case 'docx':
        return fromDocument(await readDocx(bytes))
      case 'pdf': {
        const content = await readPdf(bytes)
        return fromDocument(pdfBlocks(content, { startsRow: startsRequirementRow(words) }))
      }
      case 'html':
      case 'htm':
        return fromDocument(readHtml(new TextDecoder().decode(bytes)))
      case 'md':
        return fromDocument(readMarkdown(new TextDecoder().decode(bytes)).blocks)
      case 'pptx': {
        const read = pptxRequirements(await readPptx(bytes), slideWords(languages), lang)
        return { rows: read.rows, where: read.where, ignored: read.unknown, unmatched: read.unmatched, lang }
      }
      case 'xlsx':
      case 'xlsm':
      case 'xls': {
        const sheets = await readSpreadsheet(bytes)
        const table = xlsxTable(sheets, { ...words, headers: wordingHeaders(words.headers, words.wording, lang) })
        if (!table) return empty(lang)
        const sheet = sheets.find((each) => each.name === table.sheet)
        const header = sheet ? sheet.rows.findIndex((row) => row.some((cell) => cell.trim() !== '')) : 0
        return {
          rows: table.rows,
          where: table.rows.map((_, index) => ({ heading: '', kind: 'sheet', sheet: table.sheet, row: index + 1 + Math.max(0, header) })),
          ignored: table.unknown,
          unmatched: table.unmatched,
          lang
        }
      }
      case 'csv':
      case 'tsv': {
        // Lu comme une feuille de classeur : les en-têtes de tout le monde (« Exigence »,
        // « Priorité »…), pas seulement les noms de colonnes de la bibliothèque.
        const table = xlsxTable([{ name: '', rows: parseCsv(new TextDecoder().decode(bytes)) }], {
          ...words,
          headers: wordingHeaders(words.headers, words.wording, lang)
        })
        if (!table) return empty(lang)
        return {
          rows: table.rows,
          where: table.rows.map((_, index) => ({ heading: '', kind: 'sheet', row: index + 1 })),
          ignored: table.unknown,
          unmatched: table.unmatched,
          lang
        }
      }
      case 'reqif':
      case 'reqifz': {
        const source = ext === 'reqifz' || isArchive(ext) ? await reqifFromArchive(bytes) : new TextDecoder().decode(bytes)
        const read = readReqif(source, lang)
        if (read.error) return empty(lang, 'unreadable')
        // Une exigence créée par un ReqIF est rédigée dans la langue du fichier.
        return {
          rows: read.rows,
          where: read.rows.map((_, index) => ({ heading: '', kind: 'object', index: index + 1 })),
          ignored: [...read.ignored, ...read.ignoredRelations],
          unmatched: [],
          lang: read.lang
        }
      }
      default:
        return empty(lang, 'unsupported')
    }
  } catch (error) {
    if (error instanceof PdfError && /encrypt|password/i.test(error.message)) return empty(lang, 'encrypted')
    return empty(lang, 'unreadable')
  }

  function fromDocument(blocks: Parameters<typeof docxRequirements>[0]): Extraction {
    const read = docxRequirements(blocks, words, lang)
    return { rows: read.rows, where: read.where, ignored: read.unknown, unmatched: read.unmatched, lang }
  }
}

/** Les en-têtes de formulation d'un classeur, rangés sous la langue de lecture. */
function wordingHeaders(headers: Record<string, string>, wording: readonly string[], lang: string): Record<string, string> {
  const out = { ...headers }
  for (const label of wording) out[label.trim().toLowerCase()] = `text.${lang}`
  return out
}
