// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce qu'une analyse d'appel d'offres est dans le coffre : des dossiers et des notes
 * Markdown, lisibles sans Black Projects.
 *
 * ```
 * <dossier des analyses>/<Nom>/
 * ├── <Nom>.md               la note de l'analyse : position, acheteur, tableau des pièces
 * ├── Pièces/
 * │   ├── Originaux/         les fichiers tels qu'ils ont été reçus (ZIP ouverts)
 * │   └── <pièce>.md         une note par pièce : type, état de lecture, texte extrait
 * ├── Exigences/             (étape 3)
 * └── Analyse/               (étapes 5 à 7)
 * ```
 */

import { frontmatter } from '../../core/frontmatter'
import { allTypes, NO_CUSTOM_KEYWORDS, typeLabel, type CustomKeywords } from './pieces'

export const PIECES = 'Pièces'
export const ORIGINALS = 'Originaux'
export const REQUIREMENTS = 'Exigences'
export const ANALYSIS = 'Analyse'

export const ANALYSIS_TYPE = 'ao-analyse'
export const PIECE_TYPE = 'ao-piece'

export type Position = 'emetteur' | 'candidat'
export const POSITIONS: readonly Position[] = ['candidat', 'emetteur']

/** L'état de lecture d'une pièce. */
export type ReadingState = 'lue' | 'sans-texte' | 'image' | 'non-lue' | 'illisible'
export const READING_STATES: readonly ReadingState[] = ['lue', 'sans-texte', 'image', 'non-lue', 'illisible']
export const READING_MARK: Record<ReadingState, string> = {
  lue: '🟩',
  'sans-texte': '🟧',
  image: '🟧',
  'non-lue': '⬜',
  illisible: '🟥'
}

export interface Analysis {
  name: string
  /** Le dossier de l'analyse. */
  folder: string
  /** Sa note. */
  note: string
}

/** Un nom utilisable comme nom de dossier et de note : sans les caractères qu'Obsidian refuse. */
export function safeName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+|[.\s]+$/g, '')
    .slice(0, 120)
}

export function analysisAt(root: string, name: string): Analysis {
  const folder = root ? `${root}/${name}` : name
  return { name, folder, note: `${folder}/${name}.md` }
}

export function piecesFolder(analysis: Analysis): string {
  return `${analysis.folder}/${PIECES}`
}

export function originalsFolder(analysis: Analysis): string {
  return `${analysis.folder}/${PIECES}/${ORIGINALS}`
}

/** Un lien vers une note ou un fichier, tel qu'Obsidian l'écrit. */
export function wikiLink(path: string, label?: string): string {
  const target = path.replace(/\.md$/, '')
  return label ? `[[${target}|${label}]]` : `[[${target}]]`
}

/** Le chemin vers lequel pointe un lien `[[…]]`, sans son libellé. */
export function linkTarget(link: string): string {
  const inner = /^\[\[([^\]|]+)(\|[^\]]*)?\]\]$/.exec(link.trim())
  return inner ? inner[1]!.trim() : link.trim()
}

export interface AnalysisFields {
  position: Position
  buyer: string
  reference: string
  created: string
}

export const PIECES_START = '<!-- bp:pieces:debut — tableau tenu à jour par Black Projects ; ne pas modifier entre ces marques -->'
export const PIECES_END = '<!-- bp:pieces:fin -->'

export function analysisNote(analysis: Analysis, fields: AnalysisFields, t: (key: string) => string): string {
  return [
    frontmatter({
      'bp-type': ANALYSIS_TYPE,
      position: fields.position,
      acheteur: fields.buyer,
      reference: fields.reference,
      creee: fields.created
    }),
    `# ${analysis.name}`,
    '',
    `| ${t('ao.note.position')} | ${t(`ao.position.${fields.position}`)} |`,
    '| --- | --- |',
    `| ${t('ao.note.buyer')} | ${fields.buyer || '—'} |`,
    `| ${t('ao.note.reference')} | ${fields.reference || '—'} |`,
    `| ${t('ao.note.created')} | ${fields.created} |`,
    '',
    `## ${t('ao.note.pieces')}`,
    '',
    PIECES_START,
    t('ao.note.noPieces'),
    PIECES_END,
    '',
    `## ${t('ao.note.notes')}`,
    '',
    ''
  ].join('\n')
}

/** Remplace le tableau des pièces entre ses marques ; l'ajoute en fin de note s'il n'y est pas. */
export function withPiecesTable(note: string, table: string): string {
  const start = note.indexOf(PIECES_START)
  const end = note.indexOf(PIECES_END)
  if (start !== -1 && end > start) return note.slice(0, start + PIECES_START.length) + '\n' + table + '\n' + note.slice(end)
  return `${note.trimEnd()}\n\n${PIECES_START}\n${table}\n${PIECES_END}\n`
}

export interface PieceFields {
  analysis: Analysis
  original: string
  type: string
  format: string
  state: ReadingState
  characters: number
  imported: string
}

/** Les titres du texte extrait, descendus de deux niveaux pour tenir sous « Texte extrait ». */
export function nestHeadings(text: string): string {
  return text.replace(/^(#{1,6}) /gm, (_, hashes: string) => `${'#'.repeat(Math.min(6, hashes.length + 2))} `)
}

export function pieceNote(fields: PieceFields, text: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const name = fields.original.slice(fields.original.lastIndexOf('/') + 1)
  const callout =
    fields.state === 'lue'
      ? [`> [!info] ${t('ao.piece.callout.read', { characters: fields.characters.toLocaleString('fr-FR') })}`]
      : [`> [!warning] ${t(`ao.state.${fields.state}`)}`, `> ${t(`ao.state.${fields.state}.help`)}`]
  return [
    frontmatter({
      'bp-type': PIECE_TYPE,
      analyse: wikiLink(fields.analysis.note),
      type: fields.type,
      fichier: `[[${fields.original}]]`,
      format: fields.format,
      lecture: fields.state,
      caracteres: fields.characters,
      importee: fields.imported
    }),
    `# ${name}`,
    '',
    ...callout,
    `> ${t('ao.piece.callout.file')} : ${wikiLink(fields.original, name)} · ${t('ao.piece.callout.analysis')} : ${wikiLink(fields.analysis.note, fields.analysis.name)}`,
    `> ${t('ao.piece.callout.type')}`,
    '',
    `## ${t('ao.piece.text')}`,
    '',
    fields.state === 'lue' ? nestHeadings(text) : `*${t('ao.piece.noText')}*`,
    ''
  ].join('\n')
}

export interface PieceRow {
  note: string
  original: string
  type: string
  state: ReadingState
  characters: number
}

/** Le tableau des pièces de la note d'analyse ; les « | » des liens échappés pour ne pas couper les cellules. */
export function piecesTable(
  rows: readonly PieceRow[],
  t: (key: string, vars?: Record<string, string | number>) => string,
  custom: CustomKeywords = NO_CUSTOM_KEYWORDS
): string {
  if (rows.length === 0) return t('ao.note.noPieces')
  // Dans l'ordre d'un dossier : avis, RC, AE, CCAP…, les types ajoutés, puis les autres
  // pièces ; un type qui n'existe plus tout à la fin.
  const types = allTypes(custom)
  const rank = (code: string) => {
    const index = types.findIndex((each) => each.code === code)
    return index === -1 ? types.length : index
  }
  const sorted = [...rows].sort((a, b) => rank(a.type) - rank(b.type) || a.note.localeCompare(b.note))
  const header = [
    `| ${t('ao.table.piece')} | ${t('ao.table.type')} | ${t('ao.table.reading')} | ${t('ao.table.size')} |`,
    '| --- | --- | --- | --- |'
  ]
  const lines = sorted.map((row) => {
    const name = row.original.slice(row.original.lastIndexOf('/') + 1)
    const link = `[[${row.note.replace(/\.md$/, '')}\\|${name}]]`
    const state = `${READING_MARK[row.state]} ${t(`ao.state.${row.state}`)}`
    const size = row.state === 'lue' ? t('ao.table.characters', { count: row.characters.toLocaleString('fr-FR') }) : '—'
    return `| ${link} | ${row.type} — ${typeLabel(row.type, custom, t)} | ${state} | ${size} |`
  })
  const read = rows.filter((row) => row.state === 'lue').length
  const summary = t('ao.table.summary', { count: rows.length, read })
  return [summary, '', ...header, ...lines].join('\n')
}
