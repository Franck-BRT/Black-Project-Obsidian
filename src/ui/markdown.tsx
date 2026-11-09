// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Du **Markdown mis en forme** — celui que produit la lecture de fichiers (le texte extrait
 * d'un document) : titres, paragraphes, listes (à puces, numérotées, imbriquées), tableaux,
 * citations, blocs de code, filets ; en ligne, gras, italique, code, liens (leur texte).
 *
 * Volontairement réduit, et sûr : le texte devient des éléments, jamais du HTML injecté (ce
 * qui ressemble à une balise reste du texte) ; un lien n'emmène nulle part, son texte suffit.
 */

import type { ComponentChildren, JSX } from 'preact'
import { isPipeRow, isTableSeparator, pipeCells, tableRows } from '../core/tables'

export type MarkdownNode =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: { text: string; children: MarkdownNode[] }[] }
  | { kind: 'quote'; children: MarkdownNode[] }
  | { kind: 'code'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'rule' }

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const BULLET = /^(\s*)(?:[-*+•▪◦‣]|\d{1,3}[.)])\s+(.*)$/
const ORDERED = /^\s*\d{1,3}[.)]\s+/
const FENCE = /^\s*(```|~~~)/
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())

/** Le texte en blocs. */
export function parseMarkdown(source: string): MarkdownNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const nodes: MarkdownNode[] = []
  let at = 0
  while (at < lines.length) {
    const line = lines[at]!
    if (!line.trim()) {
      at++
      continue
    }
    // Un bloc de code : jusqu'à sa fin.
    if (FENCE.test(line)) {
      const fence = FENCE.exec(line)![1]!
      const body: string[] = []
      at++
      while (at < lines.length && !lines[at]!.trim().startsWith(fence)) body.push(lines[at++]!)
      at++
      nodes.push({ kind: 'code', text: body.join('\n') })
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      nodes.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]! })
      at++
      continue
    }
    if (RULE.test(line)) {
      nodes.push({ kind: 'rule' })
      at++
      continue
    }
    // Un tableau : une ligne d'en-tête, sa ligne de séparation, ses lignes.
    if (line.includes('|') && at + 1 < lines.length && TABLE_SEPARATOR.test(lines[at + 1]!)) {
      const head = cells(line)
      const rows: string[][] = []
      at += 2
      while (at < lines.length && lines[at]!.includes('|') && lines[at]!.trim()) rows.push(cells(lines[at++]!))
      const [first = head, ...rest] = tableRows([head, ...rows])
      nodes.push({ kind: 'table', head: first, rows: rest })
      continue
    }
    // Des lignes « | … | » sans séparation (un texte extrait d'avant) : un tableau aussi, la
    // première ligne en en-tête, sans les colonnes vides.
    if (isPipeRow(line) && !isTableSeparator(line)) {
      const run: string[][] = []
      while (at < lines.length && isPipeRow(lines[at]!) && !isTableSeparator(lines[at]!)) run.push(pipeCells(lines[at++]!))
      const [head, ...rows] = tableRows(run)
      if (head?.length) nodes.push({ kind: 'table', head, rows })
      continue
    }
    // Une citation : ses lignes, sans leur « > », lues comme un texte à part.
    if (/^\s*>/.test(line)) {
      const body: string[] = []
      while (at < lines.length && /^\s*>/.test(lines[at]!)) body.push(lines[at++]!.replace(/^\s*>\s?/, ''))
      nodes.push({ kind: 'quote', children: parseMarkdown(body.join('\n')) })
      continue
    }
    // Une liste : ses éléments ; un élément plus en retrait appartient au précédent.
    if (BULLET.test(line)) {
      const block: string[] = []
      while (at < lines.length && lines[at]!.trim() && (BULLET.test(lines[at]!) || /^\s{2,}\S/.test(lines[at]!))) block.push(lines[at++]!)
      nodes.push(parseList(block))
      continue
    }
    // Un paragraphe : ses lignes jusqu'à une ligne vide, ou un autre bloc.
    const body: string[] = []
    while (
      at < lines.length &&
      lines[at]!.trim() &&
      !HEADING.test(lines[at]!) &&
      !FENCE.test(lines[at]!) &&
      !/^\s*>/.test(lines[at]!) &&
      !(BULLET.test(lines[at]!) && body.length === 0) &&
      !(lines[at]!.includes('|') && at + 1 < lines.length && TABLE_SEPARATOR.test(lines[at + 1]!)) &&
      !(isPipeRow(lines[at]!) && body.length > 0)
    )
      body.push(lines[at++]!.trim())
    if (!body.length) body.push(lines[at++]!.trim())
    nodes.push({ kind: 'paragraph', text: body.join(' ') })
  }
  return nodes
}

function parseList(block: readonly string[]): MarkdownNode {
  const indent = (line: string) => /^(\s*)/.exec(line)![1]!.replace(/\t/g, '  ').length
  const base = indent(block[0]!)
  const items: { text: string; children: MarkdownNode[] }[] = []
  let nested: string[] = []
  const flush = () => {
    if (nested.length && items.length) items.at(-1)!.children.push(...parseMarkdown(nested.map((line) => line.slice(Math.min(indent(line), base + 2))).join('\n')))
    nested = []
  }
  for (const line of block) {
    if (indent(line) <= base && BULLET.test(line)) {
      flush()
      items.push({ text: BULLET.exec(line)![2]!, children: [] })
    } else nested.push(line)
  }
  flush()
  return { kind: 'list', ordered: ORDERED.test(block[0]!), items }
}

/** Le texte d'une ligne mis en forme : **gras**, *italique*, `code`, [lien](…) (son texte). */
export function inline(text: string): ComponentChildren[] {
  const out: ComponentChildren[] = []
  const pattern = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)(?<!\s)\3|`([^`]+)`|!?\[([^\]]+)\]\([^)]*\)/g
  let last = 0
  let key = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) out.push(text.slice(last, match.index))
    if (match[2] !== undefined) out.push(<strong key={key++}>{inline(match[2])}</strong>)
    else if (match[4] !== undefined) out.push(<em key={key++}>{inline(match[4])}</em>)
    else if (match[5] !== undefined) out.push(<code key={key++}>{match[5]}</code>)
    else if (match[6] !== undefined) out.push(match[6])
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function render(nodes: readonly MarkdownNode[]): JSX.Element[] {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case 'heading': {
        const Tag = `h${node.level}` as 'h1'
        return <Tag key={index}>{inline(node.text)}</Tag>
      }
      case 'paragraph':
        return <p key={index}>{inline(node.text)}</p>
      case 'list': {
        const Tag = node.ordered ? 'ol' : 'ul'
        return (
          <Tag key={index}>
            {node.items.map((item, at) => (
              <li key={at}>
                {inline(item.text)}
                {render(item.children)}
              </li>
            ))}
          </Tag>
        )
      }
      case 'quote':
        return <blockquote key={index}>{render(node.children)}</blockquote>
      case 'code':
        return (
          <pre key={index}>
            <code>{node.text}</code>
          </pre>
        )
      case 'table':
        return (
          <div key={index} class="bp-md-table">
            <table>
              <thead>
                <tr>
                  {node.head.map((cell, at) => (
                    <th key={at}>{inline(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {node.rows.map((row, at) => (
                  <tr key={at}>
                    {node.head.map((_, column) => (
                      <td key={column}>{inline(row[column] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'rule':
        return <hr key={index} />
    }
  })
}

/** Du Markdown, mis en forme. */
export function Markdown({ text }: { text: string }) {
  return <div class="bp-md">{render(parseMarkdown(text))}</div>
}
