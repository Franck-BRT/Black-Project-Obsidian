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
