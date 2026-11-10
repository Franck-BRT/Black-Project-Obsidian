// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Du **Markdown mis en forme** — celui que produit la lecture de fichiers (le texte extrait
 * d'un document) : titres, paragraphes, listes (à puces, numérotées, imbriquées), tableaux,
 * citations, blocs de code, filets, **formules mathématiques** (LaTeX : `$…$` dans une phrase,
 * `$$…$$` seules) ; en ligne, gras, italique, code, liens (leur texte). Les formules sont
 * dessinées par la plateforme qui sait le faire (le MathJax d'Obsidian, `setMathRenderer`) ;
 * sans elle, leur LaTeX est montré tel quel, à part. Une formule qui n'est qu'un symbole
 * (`$\square$`), et les symboles LaTeX écrits hors formule (`\boxtimes Non`), deviennent leur
 * caractère (☐, ☒).
 *
 * Ce qu'une lecture (l'IA, la vision) écrit en HTML est compris : `<br>` (un retour à la ligne),
 * `<sup>`, `<sub>`, `<b>`, `<i>`, `<u>`, `<s>`, `<mark>`, les tableaux `<table>`, les entités
 * (`&nbsp;`, `&amp;`…) ; les balises de mise en page (`<span>`, `<div>`, `<p>`…), retirées, leur
 * texte gardé. Les cases `- [ ]` / `- [x]` d'une liste : ☐ / ☒.
 *
 * Volontairement réduit, et sûr : le texte devient des éléments, jamais du HTML injecté (une
 * balise inconnue — `<script>` — reste du texte) ; un lien n'emmène nulle part, son texte suffit.
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

/** Les symboles LaTeX qu'un texte extrait emploie (cases à cocher, flèches, lettres grecques…). */
const SYMBOLS: Readonly<Record<string, string>> = {
  square: '☐', Box: '☐', Square: '☐', boxtimes: '☒', XBox: '☒', CheckedBox: '☑', boxtimesl: '☒', checkbox: '☐', checkedbox: '☑',
  boxplus: '⊞', boxdot: '⊡', boxminus: '⊟', blacksquare: '■', rule: '■', checkmark: '✓', ballotx: '✗', Circle: '○', CIRCLE: '●',
  times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', bullet: '•', circ: '∘', degree: '°', textdegree: '°',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', sim: '∼', simeq: '≃', equiv: '≡', propto: '∝', infty: '∞',
  rightarrow: '→', to: '→', leftarrow: '←', gets: '←', Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', Leftrightarrow: '⇔', implies: '⇒', iff: '⇔',
  uparrow: '↑', downarrow: '↓', mapsto: '↦', longrightarrow: '⟶', ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮',
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', Theta: 'Θ',
  kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', Pi: 'Π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', varphi: 'φ', Phi: 'Φ',
  chi: 'χ', psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω', partial: '∂', nabla: '∇', sum: '∑', prod: '∏', int: '∫',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', cup: '∪', cap: '∩', forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨',
  emptyset: '∅', varnothing: '∅', star: '⋆', ast: '∗', diamond: '⋄', triangle: '△', bigcirc: '◯', perp: '⊥', parallel: '∥', angle: '∠',
  euro: '€', texteuro: '€', copyright: '©', textregistered: '®', texttrademark: '™', S: '§', P: '¶', dagger: '†', ddagger: '‡', prime: '′',
  quad: ' ', qquad: '  ', textbackslash: '\\', lbrace: '{', rbrace: '}', langle: '⟨', rangle: '⟩', vert: '|', mid: '|'
}

/** `\square` → ☐ : les symboles connus ; `\text{…}` → son texte. Le reste, tel quel. */
function symbols(text: string): string {
  if (!text.includes('\\')) return text
  return text
    .replace(/\\(?:text|textrm|textbf|textit|mathrm|mathbf|mathit|operatorname|mbox)\{([^{}]*)\}/g, '$1')
    .replace(/\\([a-zA-Z]+)(?![a-zA-Z])/g, (whole, name: string) => SYMBOLS[name] ?? whole)
}

/** Une formule faite de symboles et de texte (`\square`, `\boxtimes\ Non`) : son texte ; sinon `null`. */
export function plainMath(tex: string): string | null {
  const text = symbols(tex.replace(/\\[,;:! ]/g, ' ')).replace(/\s+/g, ' ').trim()
  return /[\\^_{}]/.test(text) ? null : text
}

const ENTITIES: Readonly<Record<string, string>> = { nbsp: '\u00a0', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»', euro: '€', deg: '°', times: '×', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', middot: '·', bull: '•', copy: '©', reg: '®', sect: '§', check: '✓', square: '☐' }

/** `&nbsp;`, `&amp;`, `&#9744;`… : leur caractère. */
function entities(text: string): string {
  if (!text.includes('&')) return text
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? whole
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
  })
}

/** Du texte, tel qu'on le lit : ses symboles et ses entités en caractères. */
const plain = (text: string): string => entities(symbols(text))

/** Un tableau HTML (`<table>…</table>`) : ses lignes et leurs cellules (une fusionnée : répétée vide). */
function htmlTable(source: string): string[][] {
  const rows: string[][] = []
  for (const row of source.matchAll(/<tr\b[^>]*>([\s\S]*?)(?=<tr\b|<\/table>|$)/gi)) {
    const cells: string[] = []
    for (const cell of row[1]!.matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)(?=<t[dh]\b|<\/tr>|$)/gi)) {
      const text = cell[3]!.replace(/<\/t[dh]>\s*$/i, '').replace(/\s*\n\s*/g, ' ').trim()
      cells.push(text)
      const span = Number(/colspan\s*=\s*["']?(\d+)/i.exec(cell[2]!)?.[1] ?? 1)
      for (let more = 1; more < Math.min(span, 50); more++) cells.push('')
    }
    if (cells.length) rows.push(cells)
  }
  return rows
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
    // Un tableau HTML (celui qu'écrit une lecture par la vision) : jusqu'à sa fin.
    if (/^\s*<table\b/i.test(line)) {
      const body: string[] = []
      while (at < lines.length) {
        body.push(lines[at]!)
        if (/<\/table>/i.test(lines[at++]!)) break
      }
      const [head, ...rows] = htmlTable(body.join('\n'))
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
      !/^\s*<table\b/i.test(lines[at]!) &&
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

/** Les balises HTML comprises, en éléments (rien n'est injecté : on crée l'élément). */
const HTML_TAGS: Readonly<Record<string, 'strong' | 'em' | 'sup' | 'sub' | 'u' | 's' | 'mark' | 'small'>> = {
  b: 'strong', strong: 'strong', i: 'em', em: 'em', sup: 'sup', sub: 'sub', u: 'u', ins: 'u', s: 's', del: 's', strike: 's', mark: 'mark', small: 'small'
}

/** Les balises de mise en page : retirées, leur texte gardé. */
const LAYOUT_TAGS = 'span|div|p|font|center|a|big|abbr|label|section|article|header|footer|tbody|thead|tfoot|caption|colgroup|col|figure|figcaption|nobr|wbr'

/**
 * Le texte d'une ligne mis en forme : **gras**, *italique*, `code`, [lien](…) (son texte), les
 * formules, les balises HTML comprises (`<br>`, `<sup>`…), les échappements (`\*`).
 */
export function inline(text: string): ComponentChildren[] {
  const out: ComponentChildren[] = []
  // Une formule d'abord : ses « _ » et « * » ne sont pas de l'italique. `$` collé à son texte des
  // deux côtés, pas suivi d'un chiffre (« 10 $ et 20 $ » reste du texte) ; ou `\( … \)`.
  const pattern = new RegExp(
    [
      /\$(?![\s$])(?<dollar>[^$\n]+?)(?<![\s\\])\$(?!\d)/.source,
      /\\\((?<paren>.+?)\\\)/.source,
      /(?<bmark>\*\*|__)(?<bold>.+?)\k<bmark>/.source,
      /(?<imark>\*|_)(?!\s)(?<italic>.+?)(?<!\s)\k<imark>/.source,
      /`(?<code>[^`]+)`/.source,
      /!?\[(?<link>[^\]]+)\]\([^)]*\)/.source,
      /(?<br><br\s*\/?>)/.source,
      /<(?<tag>b|strong|i|em|sup|sub|u|ins|s|del|strike|mark|small)>(?<tagged>.*?)<\/\k<tag>>/.source,
      `(?<layout><\\/?(?:${LAYOUT_TAGS})\\b[^>]*>|<!--.*?-->|<\\|[^|>\\n]{0,40}\\|>)`,
      /\\(?<escaped>[!-/:-@[-`{-~])/.source
    ].join('|'),
    'gi'
  )
  let last = 0
  let key = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const found = match.groups!
    if (match.index > last) out.push(plain(text.slice(last, match.index)))
    if (found.dollar !== undefined || found.paren !== undefined) {
      const tex = (found.dollar ?? found.paren)!.trim()
      const simple = plainMath(tex)
      out.push(simple !== null ? simple : <MathView key={key++} tex={tex} display={false} />)
    } else if (found.bold !== undefined) out.push(<strong key={key++}>{inline(found.bold)}</strong>)
    else if (found.italic !== undefined) out.push(<em key={key++}>{inline(found.italic)}</em>)
    else if (found.code !== undefined) out.push(<code key={key++}>{found.code}</code>)
    else if (found.link !== undefined) out.push(plain(found.link))
    else if (found.br !== undefined) out.push(<br key={key++} />)
    else if (found.tag !== undefined) {
      const Tag = HTML_TAGS[found.tag.toLowerCase()]!
      out.push(<Tag key={key++}>{inline(found.tagged!)}</Tag>)
    } else if (found.escaped !== undefined) out.push(found.escaped)
    // Une balise de mise en page, un commentaire : rien.
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(plain(text.slice(last)))
  return out
}

/** Une case à cocher en tête d'un élément de liste (`[ ]`, `[x]`) : ☐ / ☒. */
const checkbox = (text: string): string => text.replace(/^\[([ xX])\]\s+/, (_, mark: string) => (mark === ' ' ? '☐ ' : '☒ '))

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
                {inline(checkbox(item.text))}
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
      case 'math': {
        const simple = plainMath(node.text)
        return simple !== null ? <p key={index}>{simple}</p> : <MathView key={index} tex={node.text} display={true} />
      }
    }
  })
}

/** Du Markdown, mis en forme. */
export function Markdown({ text }: { text: string }) {
  return <div class="bp-md">{render(parseMarkdown(text))}</div>
}
