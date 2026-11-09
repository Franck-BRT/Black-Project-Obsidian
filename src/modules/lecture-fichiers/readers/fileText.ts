// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { readDocx, type DocxReadBlock } from './docxRead'
import { isCfb } from '../formats/cfb'
import { readDoc } from './docRead'
import { isRtf, readRtf } from './rtfRead'
import { readHtml } from './htmlRead'
import { readPdf, type PdfContent } from './pdfRead'
import { pdfBlocks } from './pdfText'
import { readPptx } from './pptxRead'
import { readSpreadsheet } from './xlsRead'
import { completeLists, listItem } from '../../../core/lists'
import { completeTables, markdownTable } from '../../../core/tables'

/**
 * A file, as text a model can read — the one door every reader is reached through.
 *
 * The readers are the ones the imports already use — PDF, Word, Excel, PowerPoint, HTML —
 * so a planning received as a PDF reads here the way it would read into the library:
 * paragraphs, headings, and tables kept as rows of cells, which is where a planning's
 * dates are. Plain text formats are read as they are.
 *
 * What cannot be read says why, in a word the panel turns into a sentence: a scanned PDF
 * has no text to give, and an image is not something this plugin can read.
 */

/** The extensions read as plain text, as they are — a test bench's `.result`, `.err` and `.spy` among them. */
const PLAIN = new Set([
  'md',
  'txt',
  'csv',
  'tsv',
  'json',
  'xml',
  'yaml',
  'yml',
  'ics',
  'log',
  'eml',
  'result',
  'err',
  'spy'
])

/**
 * Plain text in UTF-8, or else in the Windows code page — what older tools and test
 * benches still write, and what UTF-8 would turn into question marks.
 */
export function plainText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Pictures, read by a model that sees, with the type a data URL gives them. */
const IMAGES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif'
}

/** Every extension a file can be attached with. */
export const READABLE_EXTENSIONS = new Set([
  ...PLAIN,
  'pdf',
  'docx',
  'doc',
  'dot',
  'rtf',
  'xlsx',
  'xlsm',
  'xls',
  'pptx',
  'html',
  'htm',
  ...Object.keys(IMAGES)
])

/** The extensions whose text is read here, pictures aside — they wait for a model that sees. */
export const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([...READABLE_EXTENSIONS].filter((ext) => !(ext in IMAGES)))

/** The extensions read as plain text, as they are. */
export const PLAIN_EXTENSIONS: ReadonlySet<string> = PLAIN

export function isReadable(extension: string): boolean {
  return READABLE_EXTENSIONS.has(extension.toLowerCase())
}

export function isImage(extension: string): boolean {
  return extension.toLowerCase() in IMAGES
}

/** A picture as a data URL, the form a model is handed an image in. */
export function imageDataUrl(extension: string, bytes: Uint8Array): string {
  let binary = ''
  // In slices: a string built from a whole scan in one call overflows the argument list.
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  }
  return `data:${IMAGES[extension.toLowerCase()] ?? 'application/octet-stream'};base64,${btoa(binary)}`
}

/**
 * A PDF's text page by page (one string a page, empty for a page without text): what a
 * model that sees a page is told the extraction read there, to check it against the image.
 */
export async function pdfPageTexts(bytes: Uint8Array): Promise<string[]> {
  const content = await readPdf(bytes)
  return Array.from({ length: content.pages }, (_, at) => {
    const page = at + 1
    const own: PdfContent = { pages: content.pages, problems: content.problems, items: content.items.filter((item) => item.page === page), rects: content.rects.filter((rect) => rect.page === page) }
    return blocksText(pdfBlocks(own)).trim()
  })
}

/** A PDF's text and its number of pages, which together say whether the text is the document. */
export async function readPdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  let content
  try {
    content = await readPdf(bytes)
  } catch {
    throw new FileReadError('unreadable')
  }
  return { text: blocksText(pdfBlocks(content)).replace(/\r\n?/g, '\n').trim(), pages: content.pages }
}

export type FileProblem = 'unsupported' | 'empty' | 'unreadable'

export class FileReadError extends Error {
  constructor(readonly problem: FileProblem) {
    super(problem)
  }
}

/**
 * Rows of cells as a Markdown table a model reads, and Obsidian shows as a table: the first
 * row its header, then the separator line, then the rows — empty rows and columns left out.
 */
const rowsText = (rows: string[][]): string => markdownTable(rows)

/**
 * Paragraphs and tables, as Markdown: a heading keeps its level, a list item its bullet (or
 * its number) and its depth — the items of one list one under the other, so Markdown, and
 * Obsidian, see one list.
 */
export function blocksText(blocks: DocxReadBlock[]): string {
  const out: string[] = []
  let inList = false
  for (const block of blocks) {
    if (block.kind === 'table') {
      const table = rowsText(block.rows)
      if (table) out.push(table)
      inList = false
      continue
    }
    const text = block.text.trim()
    if (!text) continue
    if (block.style === 'list') {
      const item = listItem(text, block.listLevel ?? 0, block.ordered ?? false)
      if (inList) out[out.length - 1] += `\n${item}`
      else out.push(item)
      inList = true
      continue
    }
    inList = false
    if (block.style === 'title') out.push(`# ${text}`)
    else if (block.style === 'heading') out.push(`${'#'.repeat(Math.min(6, (block.level ?? 1) + 1))} ${text}`)
    else out.push(completeLists(text))
  }
  return out.join('\n\n')
}

/**
 * A Word document of before 2007, by what it really is rather than by its name: the
 * binary format of Word 97–2003 (and 6 and 95), RTF — which many `.doc` are —, a newer
 * document renamed, a web page saved as a document, or plain text.
 */
async function oldWordText(bytes: Uint8Array): Promise<string> {
  // Their tables come as rows of cells, one a line: made Markdown tables.
  if (isCfb(bytes)) return completeLists(completeTables(readDoc(bytes)))
  if (isRtf(bytes)) return completeLists(completeTables(readRtf(bytes)))
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return blocksText(await readDocx(bytes))
  const text = plainText(bytes)
  return /^\s*</.test(text) && /<(html|body|p|div)\b/i.test(text) ? blocksText(readHtml(text)) : text
}

/**
 * The file's text. Throws a `FileReadError` saying why when there is none to give: the
 * format is not one of these, the file holds no text (a scanned PDF), or it does not read.
 */
export async function fileText(extension: string, bytes: Uint8Array): Promise<string> {
  const ext = extension.toLowerCase()
  let text: string
  try {
    if (PLAIN.has(ext)) text = plainText(bytes)
    else if (ext === 'html' || ext === 'htm') text = blocksText(readHtml(plainText(bytes)))
    else if (ext === 'pdf') text = blocksText(pdfBlocks(await readPdf(bytes)))
    else if (ext === 'docx') text = blocksText(await readDocx(bytes))
    else if (ext === 'doc' || ext === 'dot' || ext === 'rtf') text = await oldWordText(bytes)
    else if (ext === 'xlsx' || ext === 'xlsm' || ext === 'xls') {
      text = (await readSpreadsheet(bytes))
        .filter((sheet) => sheet.rows.length)
        .map((sheet) => `## ${sheet.name}\n\n${rowsText(sheet.rows)}`)
        .join('\n\n')
    } else if (ext === 'pptx') {
      text = (await readPptx(bytes))
        .map((slide, at) => {
          const shapes = [...slide.shapes].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))
          const parts = shapes.map((shape) =>
            shape.kind === 'table'
              ? rowsText(shape.rows)
              : shape.paragraphs
                  .map((paragraph) => (paragraph.bullet ? listItem(paragraph.text, paragraph.level ?? 0, paragraph.ordered ?? false) : paragraph.text))
                  .filter((line) => line.trim())
                  .join('\n')
          )
          return [`## ${at + 1}`, ...parts.filter(Boolean)].join('\n\n')
        })
        .join('\n\n')
    } else throw new FileReadError('unsupported')
  } catch (error) {
    if (error instanceof FileReadError) throw error
    throw new FileReadError('unreadable')
  }
  text = text.replace(/\r\n?/g, '\n').trim()
  if (!text.replace(/^#+ \d*$/gm, '').trim()) throw new FileReadError('empty')
  return text
}
