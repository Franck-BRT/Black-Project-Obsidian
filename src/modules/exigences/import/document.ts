// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les exigences d'un document — Word, et aussi PDF, HTML ou Markdown, lus par le module
 * Lecture de fichiers dans les mêmes blocs (paragraphes, titres, tableaux).
 *
 * Deux formes, parce que c'est sous ces deux formes qu'elles arrivent :
 *
 * - des **tableaux** dont l'en-tête nomme un identifiant ou une formulation (« Identifiant
 *   | Exigence | Vérification ») — lus comme un classeur ;
 * - des **paragraphes** qui commencent par un identifiant — `EX-SOL-003 — Le système
 *   doit…` dans le texte, ou `REQ-SYS-0001 — Titre` en titre de section.
 *
 * Le reste est de la prose, et la prose est laissée tranquille : deviner quelle phrase est
 * une exigence, c'est ainsi qu'un import en invente.
 *
 * Repris de la version complète de Black Projects (Black Room Technologies), avec un ajout :
 * chaque exigence trouvée garde **où** elle a été trouvée (`where`) — la section, le
 * tableau et sa ligne, ou le paragraphe —, pour la tracer jusqu'à sa pièce.
 */

import type { DocxReadBlock, DocxReadParagraph } from '../../lecture-fichiers'
import type { Requirement } from '../model/requirement'
import { findByName } from '../model/aliases'
import { xlsxTable, type XlsxEnumField, type XlsxVocabulary } from './table'

export interface DocxVocabulary extends XlsxVocabulary {
  /** L'étiquette mise devant la source : « Origine : CDC §4 ». */
  sourceLabels: string[]
  /** Le titre qu'une exportation donne aux exigences sans catégorie. */
  noCategory: string[]
  /** Les en-têtes d'une colonne de formulation, qui ne dit pas sa langue. */
  wording: string[]
  /** Les annotations écrites sous une formulation (traduction en retard…) : du commentaire, pas des mots. */
  isMark: (line: string) => boolean
  /** La langue que nomme une note « affichée à la place d'une traduction manquante ». */
  fallbackLang: (line: string) => string | undefined
}

/** Où une exigence a été trouvée dans son document. */
export interface ReqLocation {
  /** Le dernier titre rencontré avant elle : « Article 2 — Exigences ». */
  heading: string
  kind: 'table' | 'paragraph' | 'sheet' | 'object' | 'slide'
  /** Le numéro du tableau, du paragraphe (dans sa section), de l'objet ou de la diapositive. */
  index?: number
  /** La ligne du tableau ou de la feuille (sans l'en-tête), à partir de 1. */
  row?: number
  /** Le nom de la feuille, pour un classeur. */
  sheet?: string
}

export interface DocxRequirements {
  rows: Record<string, string>[]
  /** Où chaque ligne a été trouvée, dans le même ordre que `rows`. */
  where: ReqLocation[]
  /** En-têtes de tableau qui n'ont pas de place dans une exigence. */
  unknown: string[]
  unmatched: string[]
  /** Combien viennent de tableaux, combien de paragraphes. */
  fromTables: number
  fromText: number
}

// Un identifiant : des lettres, puis des segments, le dernier en chiffres — `REQ-THERM-0001`,
// `SYS-12`, `SRS_042`. En majuscules seulement : un mot suivi d'un nombre n'en est pas un.
const ID = /^\s*[[(]?([A-Z][A-Z0-9]*(?:[-_.][A-Z0-9]+)*[-_.]\d+)[\])]?(?=$|[\s:–—-])\s*(?:[:–—-]\s*)?(.*)$/s

/** Un paragraphe qui commence par un identifiant : l'identifiant, et ce qui suit. */
export function leadingId(text: string): { id: string; rest: string } | null {
  const found = ID.exec(text.replace(/^[•·▪–-]\s+/, ''))
  return found ? { id: found[1]!, rest: found[2]!.trim() } : null
}

/** Les paragraphes séparés par une ligne vide, les éléments d'une même liste l'un sous l'autre. */
function joinBody(body: string[]): string {
  return body
    .map((line, at) => {
      if (at === 0) return line
      const sameList = line.startsWith('- ') && body[at - 1]!.startsWith('- ')
      return `${sameList ? '\n' : '\n\n'}${line}`
    })
    .join('')
    .trim()
}

interface Section {
  row: Record<string, string>
  body: string[]
  /** Les paragraphes suivants en font-ils partie ? Oui sous un titre, non pour une exigence en ligne. */
  open: boolean
  where: ReqLocation
}

/**
 * La ligne de pastilles sous le titre d'une exigence — `Approuvée · Fonctionnelle · Haute ·
 * Essai` — rendue en champs. Chaque mot va au premier champ, dans l'ordre de l'export, qui
 * le connaît ; un mot que personne ne connaît est nommé, pas deviné.
 */
export function readMeta(line: string, vocabulary: DocxVocabulary, row: Record<string, string>, unmatched: Set<string>): void {
  const order: XlsxEnumField[] = ['status', 'type', 'criticality', 'verification']
  const valueOf = (field: XlsxEnumField, bit: string): string | undefined =>
    vocabulary.values[field][bit.toLowerCase()] ?? Object.values(vocabulary.values[field]).find((value) => value === bit)
  let from = 0
  for (const bit of line
    .split('·')
    .map((piece) => piece.trim())
    .filter(Boolean)) {
    const at = order.findIndex((field, index) => index >= from && valueOf(field, bit) !== undefined)
    if (at === -1) {
      unmatched.add(bit)
      continue
    }
    row[order[at]!] ??= valueOf(order[at]!, bit) ?? bit
    from = at + 1
  }
}

function sourceOf(line: string, vocabulary: DocxVocabulary): string | undefined {
  for (const label of vocabulary.sourceLabels) {
    const found = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.*)$`, 'is').exec(line.trim())
    if (found) return found[1]!.trim()
  }
  return undefined
}

/** Un titre de catégorie est un code court, comme ceux de la bibliothèque ; « 1 Introduction » n'en est pas un. */
function categoryOf(heading: string, vocabulary: DocxVocabulary): string | undefined {
  const text = heading.trim()
  if (vocabulary.noCategory.some((label) => label.toLowerCase() === text.toLowerCase())) return ''
  return /^[A-Z][A-Z0-9_]{1,15}$/.test(text) ? text : undefined
}

/** Une cellule de formulation : les annotations dessous retirées, et la langue qu'une note de repli nomme. */
function cleanWording(cell: string, vocabulary: DocxVocabulary): { body: string; lang?: string } {
  const lines = cell.split('\n')
  let lang: string | undefined
  while (lines.length > 1) {
    const last = lines[lines.length - 1]!.trim()
    const pieces = last.split(' · ').map((piece) => piece.trim())
    if (!pieces.every((piece) => vocabulary.isMark(piece))) break
    for (const piece of pieces) lang ??= vocabulary.fallbackLang(piece)
    lines.pop()
  }
  const body = lines.join('\n').trim()
  return lang === undefined ? { body: body === '—' ? '' : body } : { body: body === '—' ? '' : body, lang }
}

/** Les lignes d'exigences d'un tableau, chacune avec son numéro de ligne (sans l'en-tête). */
function tableRows(
  rows: string[][],
  vocabulary: DocxVocabulary,
  lang: string,
  unknown: Set<string>,
  unmatched: Set<string>
): { row: Record<string, string>; line: number }[] {
  // La colonne de formulation ne dit pas sa langue : c'est celle dans laquelle le document est lu.
  const headers = { ...vocabulary.headers }
  for (const label of vocabulary.wording) headers[label.trim().toLowerCase()] = `text.${lang}`
  const table = xlsxTable([{ name: '', rows }], { ...vocabulary, headers })
  if (!table) return []
  for (const header of table.unknown) unknown.add(header)
  for (const value of table.unmatched) unmatched.add(value)
  return table.rows.flatMap((row, index) => {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(row)) {
      if (!key.startsWith('text.')) {
        out[key] = value
        continue
      }
      const cleaned = cleanWording(value, vocabulary)
      if (cleaned.body) out[`text.${cleaned.lang ?? key.slice(5)}`] = cleaned.body
    }
    // Une ligne qui ne nomme aucune exigence et ne dit rien — un total, une remarque — est
    // au document, pas à la bibliothèque. Celle qui nomme une exigence reste, pour être
    // montrée refusée si elle n'a rien à écrire.
    const named = leadingId(out.id ?? '')
    const says = Object.keys(out).some((key) => key.startsWith('text.')) || out.title
    return says || (named && named.rest === '') ? [{ row: out, line: index + 1 }] : []
  })
}

/** Les exigences d'un document, lues dans la langue `lang` quand il ne dit pas la sienne. */
export function docxRequirements(blocks: DocxReadBlock[], vocabulary: DocxVocabulary, lang: string): DocxRequirements {
  const unknown = new Set<string>()
  const unmatched = new Set<string>()
  const rows: Record<string, string>[] = []
  const where: ReqLocation[] = []
  let fromTables = 0
  let fromText = 0
  let category: string | undefined
  let section: Section | null = null
  let heading = ''
  let tables = 0
  let paragraphs = 0

  const close = (): void => {
    if (!section) return
    const text = joinBody(section.body)
    if (text) section.row[`text.${lang}`] = text
    if (section.row.id && (text || section.row.title)) {
      rows.push(section.row)
      where.push(section.where)
      fromText += 1
    }
    section = null
  }

  const paragraph = (block: DocxReadParagraph): void => {
    const text = block.text.trim()
    const isHeading = block.style === 'heading' || block.style === 'title'
    if (!isHeading && text) paragraphs += 1
    // Pas d'une note d'export : « REQ-X-0404 : introuvable » nomme une exigence absente, pas à créer.
    const found = block.style === 'meta' ? null : leadingId(text)
    if (found && found.id) {
      close()
      const row: Record<string, string> = { id: found.id }
      if (category !== undefined) row.category = category
      if (isHeading) {
        if (found.rest) row.title = found.rest
        section = { row, body: [], open: true, where: { heading: text, kind: 'paragraph' } }
      } else if (found.rest) {
        // En ligne : le paragraphe est l'exigence, le suivant non.
        section = { row, body: [found.rest], open: false, where: { heading, kind: 'paragraph', index: paragraphs } }
      } else section = { row, body: [], open: true, where: { heading, kind: 'paragraph', index: paragraphs } }
      return
    }
    if (isHeading) {
      close()
      heading = text
      paragraphs = 0
      // Seul un titre de premier niveau peut être une catégorie, et seulement s'il en a l'air.
      if (block.style === 'heading' && block.level === 1) category = categoryOf(text, vocabulary)
      return
    }
    if (!section || !section.open || !text) return
    const current: Section = section
    if (text === '—') return
    if (block.style === 'meta') {
      const source = sourceOf(text, vocabulary)
      if (source !== undefined) current.row.source ??= source
      else if (!current.body.length) readMeta(text, vocabulary, current.row, unmatched)
      return
    }
    if (block.style === 'quote') {
      current.row.rationale = current.row.rationale ? `${current.row.rationale}\n\n${text}` : text
      return
    }
    current.body.push(block.style === 'list' ? `- ${text.replace(/^[•·▪]\s*/, '')}` : text)
  }

  for (const block of blocks) {
    if (block.kind === 'table') {
      close()
      tables += 1
      const read = tableRows(block.rows, vocabulary, lang, unknown, unmatched)
      for (const { row, line } of read) {
        rows.push(row)
        where.push({ heading, kind: 'table', index: tables, row: line })
      }
      fromTables += read.length
    } else paragraph(block)
  }
  close()
  return { rows, where, unknown: [...unknown], unmatched: [...unmatched], fromTables, fromText }
}

/**
 * Une formulation identique, mot pour mot, à une que la bibliothèque a déjà, rangée sous
 * cette langue-là : un document ne dit pas la langue de chaque formulation.
 */
export function settleLanguages(rows: Record<string, string>[], library: Requirement[]): Record<string, string>[] {
  return rows.map((row) => {
    const held = row.id ? findByName(library, row.id) : null
    if (!held) return row
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(row)) {
      const lang = key.startsWith('text.') ? key.slice(5) : ''
      const same =
        lang && held.text[lang]?.body !== value
          ? Object.entries(held.text).find(([other, text]) => other !== lang && text.body === value)
          : undefined
      const target = same && row[`text.${same[0]}`] === undefined ? `text.${same[0]}` : key
      out[target] = value
    }
    return out
  })
}

/**
 * Une formulation qui ne diffère de celle tenue que par ses retours à la ligne, prise pour
 * celle tenue : un PDF dessine des lignes sans dire pourquoi chacune s'arrête.
 */
export function settleSpacing(rows: Record<string, string>[], library: Requirement[]): Record<string, string>[] {
  const flat = (text: string): string => text.replace(/\s+/g, ' ').trim()
  return rows.map((row) => {
    const held = row.id ? findByName(library, row.id) : null
    if (!held) return row
    const out: Record<string, string> = { ...row }
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith('text.')) {
        const body = held.text[key.slice(5)]?.body
        if (body !== undefined && flat(body) === flat(value)) out[key] = body
      } else if (key === 'rationale' && flat(held.rationale) === flat(value)) out[key] = held.rationale
    }
    return out
  })
}

/**
 * Une ligne de tableau commence-t-elle une exigence ? Oui quand la colonne d'identifiant en
 * contient un entier — pour un PDF, où une ligne coupée par un saut de page continue sous
 * l'en-tête répété.
 */
export function startsRequirementRow(vocabulary: DocxVocabulary): (header: string[], cells: string[]) => boolean {
  return (header, cells) => {
    const at = header.findIndex((name) => {
      const key = name.trim().toLowerCase()
      return key === 'id' || vocabulary.headers[key] === 'id'
    })
    if (at === -1) return cells[0] !== ''
    const found = leadingId(cells[at] ?? '')
    return found !== null && found.rest === ''
  }
}
