// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **tableaux en Markdown** : des lignes de cellules (lues d'un fichier) écrites comme un
 * tableau que Markdown reconnaît — une ligne d'en-tête, **sa ligne de séparation**
 * (`| --- |`), puis ses lignes, toutes du même nombre de colonnes. Sans la séparation,
 * Obsidian (et la fiche) ne montrent que des barres « | » dans un paragraphe.
 */

const PIPE_ROW = /^\s*\|.*\|\s*$/
const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

/** Une cellule sur une ligne : ses sauts de ligne en espaces, ses « | » en « / ». */
const cleanCell = (text: string): string =>
  text
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\|/g, '/')
    .trim()

/**
 * Les lignes d'un tableau, nettoyées : sans ligne vide, sans colonne vide de bout en bout
 * (les cases fusionnées, les bordures), toutes du même nombre de colonnes.
 */
export function tableRows(rows: readonly (readonly string[])[]): string[][] {
  const kept = rows.map((row) => row.map(cleanCell)).filter((row) => row.some(Boolean))
  const width = Math.max(0, ...kept.map((row) => row.length))
  const full = kept.map((row) => [...row, ...Array<string>(width - row.length).fill('')])
  const used = Array.from({ length: width }, (_, column) => full.some((row) => row[column]))
  return full.map((row) => row.filter((_, column) => used[column]))
}

/** Des lignes de cellules en tableau Markdown : la première en en-tête ; vide : « ». */
export function markdownTable(rows: readonly (readonly string[])[]): string {
  const table = tableRows(rows)
  if (!table.length || !table[0]!.length) return ''
  const line = (row: readonly string[]) => `| ${row.join(' | ')} |`
  return [line(table[0]!), line(table[0]!.map(() => '---')), ...table.slice(1).map(line)].join('\n')
}

/** Les cellules d'une ligne « | a | b | ». */
export function pipeCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

/**
 * Dans un texte, les suites de lignes « | … | » sans ligne de séparation (écrites par une
 * lecture de fichier, ou d'avant) réécrites en tableaux Markdown ; les tableaux déjà
 * complets, et le reste du texte, ne changent pas.
 */
export function completeTables(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let at = 0
  while (at < lines.length) {
    if (!PIPE_ROW.test(lines[at]!) || SEPARATOR.test(lines[at]!)) {
      out.push(lines[at++]!)
      continue
    }
    const start = at
    while (at < lines.length && PIPE_ROW.test(lines[at]!)) at++
    const run = lines.slice(start, at)
    if (run.length > 1 && SEPARATOR.test(run[1]!)) out.push(...run)
    else {
      const table = markdownTable(run.map(pipeCells))
      if (table) out.push(table)
    }
  }
  return out.join('\n')
}

/** Une ligne de séparation d'en-tête de tableau (`| --- | :-: |`) ? */
export const isTableSeparator = (line: string): boolean => SEPARATOR.test(line)

/** Une ligne de tableau (`| … |`) ? */
export const isPipeRow = (line: string): boolean => PIPE_ROW.test(line)

/**
 * Une **cellule fusionnée** d'un tableau lu : où elle commence (sa ligne, sa colonne, comptées
 * dans les lignes du tableau, ses cellules couvertes comprises) et combien de lignes et de
 * colonnes elle couvre. Son texte est celui de sa première cellule ; les autres sont vides.
 */
export interface TableMerge {
  row: number
  column: number
  rows: number
  columns: number
}

/** Le texte d'une cellule en HTML : `<`, `&` échappés ; ses sauts de ligne en `<br>`. */
const htmlCell = (text: string): string =>
  text
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\s*\n\s*/g, '<br>')

/**
 * Des lignes de cellules **avec des cellules fusionnées**, en tableau HTML (`colspan`,
 * `rowspan`) — Markdown n'en a pas ; Obsidian, et la fiche, le montrent. La première ligne en
 * en-tête (`<th>`). Les lignes et les colonnes vides de bout en bout (qu'aucune fusion ne
 * couvre) en sont retirées.
 */
export function mergedTable(rows: readonly (readonly string[])[], merges: readonly TableMerge[]): string {
  const width = Math.max(0, ...rows.map((row) => row.length), ...merges.map((merge) => merge.column + merge.columns))
  const height = Math.max(rows.length, ...merges.map((merge) => merge.row + merge.rows))
  const text = (row: number, column: number): string => rows[row]?.[column]?.trim() ?? ''
  // Une fusion d'une seule cellule n'en est pas une ; celles qui se chevauchent : la première.
  const kept: TableMerge[] = []
  const covered = new Map<string, TableMerge>()
  for (const merge of merges) {
    // Une fusion sans texte : des cellules vides, chacune la sienne (le tableau reste droit).
    if (merge.rows * merge.columns <= 1 || merge.row < 0 || merge.column < 0 || !text(merge.row, merge.column)) continue
    const cells: string[] = []
    for (let row = merge.row; row < merge.row + merge.rows; row++) for (let column = merge.column; column < merge.column + merge.columns; column++) cells.push(`${row}:${column}`)
    if (cells.some((cell) => covered.has(cell))) continue
    kept.push(merge)
    for (const cell of cells) covered.set(cell, merge)
  }
  const usedRow = Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, column) => text(row, column)).some(Boolean))
  const usedColumn = Array.from({ length: width }, (_, column) => Array.from({ length: height }, (_, row) => text(row, column)).some(Boolean))
  // Une ligne (une colonne) vide qu'une fusion traverse reste : sans elle, la fusion se défait.
  for (const merge of kept) {
    for (let row = merge.row; row < merge.row + merge.rows; row++) if (usedRow[merge.row]) usedRow[row] = true
    for (let column = merge.column; column < merge.column + merge.columns; column++) if (usedColumn[merge.column]) usedColumn[column] = true
  }
  const lines: string[] = []
  let first = true
  for (let row = 0; row < height; row++) {
    if (!usedRow[row]) continue
    const cells: string[] = []
    for (let column = 0; column < width; column++) {
      if (!usedColumn[column]) continue
      const merge = covered.get(`${row}:${column}`)
      if (merge && (merge.row !== row || merge.column !== column)) continue
      const tag = first ? 'th' : 'td'
      let attrs = ''
      if (merge) {
        const columns = Array.from({ length: merge.columns }, (_, at) => usedColumn[merge.column + at]).filter(Boolean).length
        const spanned = Array.from({ length: merge.rows }, (_, at) => usedRow[merge.row + at]).filter(Boolean).length
        if (columns > 1) attrs += ` colspan="${columns}"`
        if (spanned > 1) attrs += ` rowspan="${spanned}"`
      }
      cells.push(`<${tag}${attrs}>${htmlCell(text(row, column))}</${tag}>`)
    }
    lines.push(`<tr>${cells.join('')}</tr>`)
    first = false
  }
  return lines.length ? `<table>\n${lines.join('\n')}\n</table>` : ''
}

/** Un tableau lu, écrit pour le texte : en Markdown ; avec des cellules fusionnées, en HTML. */
export function writtenTable(rows: readonly (readonly string[])[], merges: readonly TableMerge[] = []): string {
  return merges.some((merge) => merge.rows * merge.columns > 1) ? mergedTable(rows, merges) : markdownTable(rows)
}
