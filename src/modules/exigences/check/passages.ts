// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Un document en **passages** : chaque paragraphe, chaque ligne de tableau, avec l'endroit
 * où il se trouve (« Article 2 — Exigences, paragraphe 3 », « tableau 1, ligne 2 »). C'est
 * sur ces passages que travaillent les vérifications : chercher les phrases qui
 * ressemblent à des exigences, retrouver où une réponse traite une exigence.
 */

import {
  pdfBlocks,
  readDocx,
  readHtml,
  readMarkdown,
  readPdf,
  readPptx,
  readSpreadsheet,
  resolveExtension,
  type DocxReadBlock
} from '../../lecture-fichiers'
import type { ReqLocation } from '../import/document'
import { slideBlocks } from '../import/slides'

export interface Passage {
  text: string
  where: ReqLocation
}

/** Les formats dont on sait tirer des passages. */
export const PASSAGE_FORMATS = ['docx', 'pdf', 'html', 'htm', 'md', 'pptx', 'xlsx', 'xlsm', 'xls', 'txt'] as const

export function hasPassages(extension: string): boolean {
  return (PASSAGE_FORMATS as readonly string[]).includes(resolveExtension(extension.toLowerCase()))
}

/** Les passages de blocs de document : un par paragraphe (hors titres), un par ligne de tableau. */
export function blockPassages(blocks: readonly DocxReadBlock[]): Passage[] {
  const out: Passage[] = []
  let heading = ''
  let paragraphs = 0
  let tables = 0
  for (const block of blocks) {
    if (block.kind === 'table') {
      tables += 1
      block.rows.forEach((row, index) => {
        const text = row.map((cell) => cell.trim()).filter(Boolean).join(' | ')
        // La première ligne est souvent l'en-tête : gardée, elle ne ressemble à rien d'utile.
        if (text) out.push({ text, where: { heading, kind: 'table', index: tables, row: index } })
      })
      continue
    }
    const text = block.text.trim()
    if (!text) continue
    if (block.style === 'heading' || block.style === 'title') {
      heading = text
      paragraphs = 0
      continue
    }
    paragraphs += 1
    out.push({ text, where: { heading, kind: 'paragraph', index: paragraphs } })
  }
  return out
}

/** Les passages d'un fichier ; `null` si son format ne s'y prête pas ou s'il ne se lit pas. */
export async function documentPassages(extension: string, bytes: Uint8Array): Promise<Passage[] | null> {
  const ext = resolveExtension(extension.toLowerCase())
  try {
    switch (ext) {
      case 'docx':
        return blockPassages(await readDocx(bytes))
      case 'pdf':
        return blockPassages(pdfBlocks(await readPdf(bytes)))
      case 'html':
      case 'htm':
        return blockPassages(readHtml(new TextDecoder().decode(bytes)))
      case 'md':
        return blockPassages(readMarkdown(new TextDecoder().decode(bytes)).blocks)
      case 'pptx': {
        const slides = await readPptx(bytes)
        const out: Passage[] = []
        slides.forEach((slide, index) => {
          for (const passage of blockPassages(slideBlocks(slide))) {
            out.push({ text: passage.text, where: { heading: passage.where.heading, kind: 'slide', index: index + 1 } })
          }
        })
        return out
      }
      case 'xlsx':
      case 'xlsm':
      case 'xls': {
        const out: Passage[] = []
        for (const sheet of await readSpreadsheet(bytes)) {
          sheet.rows.forEach((row, index) => {
            const text = row.map((cell) => cell.trim()).filter(Boolean).join(' | ')
            if (text) out.push({ text, where: { heading: '', kind: 'sheet', sheet: sheet.name, row: index + 1 } })
          })
        }
        return out
      }
      case 'txt':
        return new TextDecoder()
          .decode(bytes)
          .split(/\n\s*\n/)
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text, index) => ({ text, where: { heading: '', kind: 'paragraph', index: index + 1 } }))
      default:
        return null
    }
  } catch {
    return null
  }
}
