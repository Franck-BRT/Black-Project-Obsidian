// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce qu'une analyse d'appel d'offres est dans le coffre : des dossiers et des notes
 * Markdown, lisibles sans Black Projects.
 *
 * ```
 * <dossier des analyses>/<Nom>/
 * ├── <Nom>.md                 la note de l'analyse : position, acheteur, tableau des pièces
 * ├── Pièces/
 * │   ├── Appel d'offres/      le dossier de consultation
 * │   │   ├── Originaux/       les fichiers tels qu'ils ont été reçus (ZIP ouverts)
 * │   │   └── <pièce>.md       une note par pièce : type, état de lecture, texte extrait
 * │   ├── Réponse/             candidat : sa réponse (même forme)
 * │   └── Réponses/<candidat>/ émetteur : la réponse de chaque candidat (même forme)
 * ├── Exigences/               (étape 3)
 * └── Analyse/                 (étapes 5 à 7)
 * ```
 *
 * Jusqu'à la v0.4.0, les pièces étaient directement dans `Pièces/` et `Pièces/Originaux/` :
 * elles y restent lisibles, comptées avec l'appel d'offres.
 */

import { frontmatter } from '../../core/frontmatter'
import { allTypes, NO_CUSTOM_KEYWORDS, typeDisplay, type CustomKeywords } from '../typage-pieces'

export const PIECES = 'Pièces'
export const ORIGINALS = 'Originaux'
export const TENDER = "Appel d'offres"
export const RESPONSE = 'Réponse'
export const RESPONSES = 'Réponses'

/** Où une pièce est rangée : avec l'appel d'offres, ou avec une réponse — celle d'un candidat nommé, pour l'émetteur. */
export type PiecePlace = 'appel-d-offres' | 'reponse'
export interface Destination {
  place: PiecePlace
  /** Le candidat dont c'est la réponse, quand l'analyse est celle de l'émetteur. */
  candidate?: string
}
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

/** Les originaux d'avant la v0.4.1, rangés sans distinction d'appel d'offres et de réponse. */
export function originalsFolder(analysis: Analysis): string {
  return `${analysis.folder}/${PIECES}/${ORIGINALS}`
}

/** Le dossier des notes d'une destination. */
export function placeFolder(analysis: Analysis, destination: Destination): string {
  const pieces = `${analysis.folder}/${PIECES}`
  if (destination.place === 'appel-d-offres') return `${pieces}/${TENDER}`
  return destination.candidate ? `${pieces}/${RESPONSES}/${destination.candidate}` : `${pieces}/${RESPONSE}`
}

/** Le dossier des originaux d'une destination. */
export function placeOriginals(analysis: Analysis, destination: Destination): string {
  return `${placeFolder(analysis, destination)}/${ORIGINALS}`
}

/**
 * La destination d'un fichier rangé dans des originaux, d'après son chemin ; `null` s'il
 * n'est dans aucun. Les originaux d'avant la v0.4.1 comptent avec l'appel d'offres.
 */
export function destinationOf(analysis: Analysis, path: string): Destination | null {
  const pieces = `${analysis.folder}/${PIECES}/`
  if (!path.startsWith(pieces)) return null
  const parts = path.slice(pieces.length).split('/')
  if (parts[0] === ORIGINALS && parts.length > 1) return { place: 'appel-d-offres' }
  if (parts[0] === TENDER && parts[1] === ORIGINALS && parts.length > 2) return { place: 'appel-d-offres' }
  if (parts[0] === RESPONSE && parts[1] === ORIGINALS && parts.length > 2) return { place: 'reponse' }
  if (parts[0] === RESPONSES && parts[2] === ORIGINALS && parts.length > 3) return { place: 'reponse', candidate: parts[1]! }
  return null
}

/** Le nom d'une destination, pour l'utilisateur : « Appel d'offres », « Réponse », « Réponse — Société X ». */
export function destinationLabel(destination: Destination, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (destination.place === 'appel-d-offres') return t('ao.place.tender')
  return destination.candidate ? t('ao.place.responseOf', { candidate: destination.candidate }) : t('ao.place.response')
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
  destination: Destination
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
      place: fields.destination.place,
      ...(fields.destination.candidate ? { candidat: fields.destination.candidate } : {}),
      fichier: `[[${fields.original}]]`,
      format: fields.format,
      lecture: fields.state,
      caracteres: fields.characters,
      importee: fields.imported
    }),
    `# ${name}`,
    '',
    ...callout,
    `> ${t('ao.piece.callout.file')} : ${wikiLink(fields.original, name)} · ${t('ao.piece.callout.analysis')} : ${wikiLink(fields.analysis.note, fields.analysis.name)} · ${destinationLabel(fields.destination, t)}`,
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
  destination: Destination
  original: string
  type: string
  state: ReadingState
  characters: number
}

/**
 * Le tableau des pièces de la note d'analyse, un par destination : l'appel d'offres, puis
 * la réponse (ou chaque candidat, par ordre alphabétique). Les « | » des liens sont
 * échappés pour ne pas couper les cellules.
 */
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
  const key = (destination: Destination) => (destination.place === 'appel-d-offres' ? '' : `~${destination.candidate ?? ''}`)
  const groups = new Map<string, { destination: Destination; rows: PieceRow[] }>()
  for (const row of rows) {
    const group = groups.get(key(row.destination)) ?? { destination: row.destination, rows: [] }
    group.rows.push(row)
    groups.set(key(row.destination), group)
  }
  const read = rows.filter((row) => row.state === 'lue').length
  const out = [t('ao.table.summary', { count: rows.length, read })]
  for (const [, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...group.rows].sort((a, b) => rank(a.type) - rank(b.type) || a.note.localeCompare(b.note))
    out.push(
      '',
      `### ${destinationLabel(group.destination, t)}`,
      '',
      `| ${t('ao.table.piece')} | ${t('ao.table.type')} | ${t('ao.table.reading')} | ${t('ao.table.size')} |`,
      '| --- | --- | --- | --- |',
      ...sorted.map((row) => {
        const name = row.original.slice(row.original.lastIndexOf('/') + 1)
        const link = `[[${row.note.replace(/\.md$/, '')}\\|${name}]]`
        const state = `${READING_MARK[row.state]} ${t(`ao.state.${row.state}`)}`
        const size = row.state === 'lue' ? t('ao.table.characters', { count: row.characters.toLocaleString('fr-FR') }) : '—'
        return `| ${link} | ${row.type} — ${typeDisplay(row.type, t, custom)} | ${state} | ${size} |`
      })
    )
  }
  return out.join('\n')
}
