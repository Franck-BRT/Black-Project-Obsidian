// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Du **Markdown mis en forme** — celui que produit la lecture de fichiers (le texte extrait
 * d'un document) : titres, paragraphes, listes (à puces, numérotées, imbriquées), tableaux,
 * citations, blocs de code, filets, **formules mathématiques** (LaTeX : `$…$` dans une phrase,
 * `$$…$$` seules) ; en ligne, gras, italique, code, liens (leur texte). Les formules sont
 * dessinées par la plateforme qui sait le faire (le MathJax d'Obsidian, `setMathRenderer`) ;
 * sans elle, leur LaTeX est montré tel quel, à part.
 *
 * Volontairement réduit, et sûr : le texte devient des éléments, jamais du HTML injecté (ce
 * qui ressemble à une balise reste du texte) ; un lien n'emmène nulle part, son texte suffit.
 */

import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { isPipeRow, isTableSeparator, pipeCells, tableRows } from '../core/tables'

export type MarkdownNode =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; start?: number; items: { text: string; children: MarkdownNode[] }[] }
  | { kind: 'quote'; children: MarkdownNode[] }
  | { kind: 'code'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'rule' }
  | { kind: 'math'; text: string }

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const BULLET = /^(\s*)(?:[-*+•▪◦‣]|\d{1,3}[.)])\s+(.*)$/
const ORDERED = /^\s*\d{1,3}[.)]\s+/
const FENCE = /^\s*(```|~~~)/
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

/** Une formule seule sur ses lignes : `$$ … $$` ou `\\[ … \\]`. */
const MATH_OPEN = /^\s*(\$\$|\\\[)/
const MATH_CLOSE: Record<string, RegExp> = { $$: /\$\$\s*$/, '\\[': /\\\]\s*$/ }

/** Qui dessine une formule (LaTeX) ; `display` : seule sur sa ligne. Sans lui, son texte. */
type MathRenderer = (tex: string, display: boolean) => HTMLElement | null
let mathRenderer: MathRenderer | null = null

/** Pour la plateforme : dessiner les formules (Obsidian : `renderMath`) ; `null` : plus personne. */
export function setMathRenderer(renderer: MathRenderer | null): void {
  mathRenderer = renderer
}

/** Une formule : dessinée par la plateforme, sinon son LaTeX, à part. */
function MathView({ tex, display }: { tex: string; display: boolean }) {
  const host = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = host.current
    if (!element || !mathRenderer) return
    const drawn = mathRenderer(tex, display)
    if (!drawn) return
    element.replaceChildren(drawn)
  }, [tex, display])
  return display ? (
    <div ref={host as never} class="bp-math bp-math-display">
      <code>{tex}</code>
    </div>
  ) : (
    <span ref={host as never} class="bp-math">
      <code>{tex}</code>
    </span>
  )
}

/** Le retrait d'une ligne (une tabulation : deux espaces). */
const indent = (line: string): number => /^(\s*)/.exec(line)![1]!.replace(/\t/g, '  ').length

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
    // Une formule seule : jusqu'à sa fermeture (sur la même ligne, ou plus bas).
    const math = MATH_OPEN.exec(line)
    if (math) {
      const close = MATH_CLOSE[math[1]!]!
      const rest = line.slice(line.indexOf(math[1]!) + math[1]!.length)
      const body: string[] = []
      if (close.test(rest)) body.push(rest.replace(close, ''))
      else {
        body.push(rest)
        at++
        while (at < lines.length && !close.test(lines[at]!)) body.push(lines[at++]!)
        if (at < lines.length) body.push(lines[at]!.replace(close, ''))
      }
      at++
      nodes.push({ kind: 'math', text: body.join('\n').trim() })
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
    // Des lignes vides entre ses éléments (une liste « aérée ») ne la coupent pas ; une puce
    // devenue numéro (ou l'inverse), au même niveau, en commence une autre.
    if (BULLET.test(line)) {
      const base = indent(line)
      const ordered = ORDERED.test(line)
      const block: string[] = []
      while (at < lines.length) {
        const current = lines[at]!
        if (!current.trim()) {
          let next = at + 1
          while (next < lines.length && !lines[next]!.trim()) next++
          const following = lines[next]
          const goesOn =
            following !== undefined &&
            (indent(following) > base + 1 || (BULLET.test(following) && indent(following) === base && ORDERED.test(following) === ordered))
          if (!goesOn) break
          at = next
          continue
        }
        const item = BULLET.test(current)
        if (item && indent(current) <= base && block.length && (indent(current) < base || ORDERED.test(current) !== ordered)) break
        if (!item && !/^\s{2,}\S/.test(current)) break
        block.push(current)
        at++
      }
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
      !MATH_OPEN.test(lines[at]!) &&
      // Une puce coupe un paragraphe (comme dans Obsidian) ; un numéro, s'il commence à 1.
      !(BULLET.test(lines[at]!) && (body.length === 0 || !ORDERED.test(lines[at]!) || /^\s*1[.)]\s/.test(lines[at]!))) &&
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
  const ordered = ORDERED.test(block[0]!)
  // Une liste numérotée qui ne commence pas à 1 (« 3. ») le garde.
  const start = ordered ? Number(/^\s*(\d+)/.exec(block[0]!)![1]) : 1
  return { kind: 'list', ordered, ...(start !== 1 ? { start } : {}), items }
}

/** Le texte d'une ligne mis en forme : **gras**, *italique*, `code`, [lien](…) (son texte). */
export function inline(text: string): ComponentChildren[] {
  const out: ComponentChildren[] = []
  // Une formule d'abord : ses « _ » et « * » ne sont pas de l'italique. `$` collé à son texte des
  // deux côtés, pas suivi d'un chiffre (« 10 $ et 20 $ » reste du texte) ; ou `\( … \)`.
  const pattern = /\$(?![\s$])([^$\n]+?)(?<![\s\\])\$(?!\d)|\\\((.+?)\\\)|(\*\*|__)(.+?)\3|(\*|_)(?!\s)(.+?)(?<!\s)\5|`([^`]+)`|!?\[([^\]]+)\]\([^)]*\)/g
  let last = 0
  let key = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) out.push(text.slice(last, match.index))
    if (match[1] !== undefined || match[2] !== undefined) out.push(<MathView key={key++} tex={(match[1] ?? match[2])!.trim()} display={false} />)
    else if (match[4] !== undefined) out.push(<strong key={key++}>{inline(match[4])}</strong>)
    else if (match[6] !== undefined) out.push(<em key={key++}>{inline(match[6])}</em>)
    else if (match[7] !== undefined) out.push(<code key={key++}>{match[7]}</code>)
    else if (match[8] !== undefined) out.push(match[8])
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
          <Tag key={index} {...(node.start !== undefined ? { start: node.start } : {})}>
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
      case 'math':
        return <MathView key={index} tex={node.text} display={true} />
    }
  })
}

/** Du Markdown, mis en forme. */
export function Markdown({ text }: { text: string }) {
  return <div class="bp-md">{render(parseMarkdown(text))}</div>
}
