// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * The equations of a Word document (Office Math, OMML: `m:oMath`), as LaTeX — the form
 * Markdown, Obsidian and a model all read: fractions, powers and indices, roots, sums and
 * integrals, brackets, functions, accents, limits, matrices. What is not known is read for
 * its content, so nothing written is lost.
 */

import { localName, type XmlNode } from '../formats/xmlParse'

/** Symbols written as themselves in Word, by their LaTeX name. */
const SYMBOLS: Record<string, string> = {
  α: '\\alpha',
  β: '\\beta',
  γ: '\\gamma',
  δ: '\\delta',
  ε: '\\varepsilon',
  ζ: '\\zeta',
  η: '\\eta',
  θ: '\\theta',
  ι: '\\iota',
  κ: '\\kappa',
  λ: '\\lambda',
  μ: '\\mu',
  ν: '\\nu',
  ξ: '\\xi',
  π: '\\pi',
  ρ: '\\rho',
  σ: '\\sigma',
  τ: '\\tau',
  υ: '\\upsilon',
  φ: '\\varphi',
  χ: '\\chi',
  ψ: '\\psi',
  ω: '\\omega',
  Γ: '\\Gamma',
  Δ: '\\Delta',
  Θ: '\\Theta',
  Λ: '\\Lambda',
  Ξ: '\\Xi',
  Π: '\\Pi',
  Σ: '\\Sigma',
  Φ: '\\Phi',
  Ψ: '\\Psi',
  Ω: '\\Omega',
  '≤': '\\le',
  '≥': '\\ge',
  '≠': '\\neq',
  '≈': '\\approx',
  '≡': '\\equiv',
  '∝': '\\propto',
  '×': '\\times',
  '÷': '\\div',
  '±': '\\pm',
  '∓': '\\mp',
  '·': '\\cdot',
  '⋅': '\\cdot',
  '∞': '\\infty',
  '→': '\\to',
  '←': '\\leftarrow',
  '⇒': '\\Rightarrow',
  '⇔': '\\Leftrightarrow',
  '∈': '\\in',
  '∉': '\\notin',
  '⊂': '\\subset',
  '⊆': '\\subseteq',
  '∪': '\\cup',
  '∩': '\\cap',
  '∀': '\\forall',
  '∃': '\\exists',
  '∂': '\\partial',
  '∇': '\\nabla',
  '°': '^\\circ',
  '…': '\\ldots',
  '⋯': '\\cdots',
  '−': '-'
}

const NARY: Record<string, string> = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap' }
const ACCENTS: Record<string, string> = { '̂': '\\hat', '̃': '\\tilde', '̄': '\\bar', '̅': '\\bar', '̇': '\\dot', '̈': '\\ddot', '⃗': '\\vec', '→': '\\vec' }
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'dim', 'arg', 'deg', 'gcd'])
const DELIMITERS: Record<string, string> = { '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|', '⟨': '\\langle', '⟩': '\\rangle', '⌈': '\\lceil', '⌉': '\\rceil', '⌊': '\\lfloor', '⌋': '\\rfloor', '': '.' }

const child = (node: XmlNode | undefined, name: string): XmlNode | undefined => node?.children.find((part) => localName(part) === name)
const children = (node: XmlNode, name: string): XmlNode[] => node.children.filter((part) => localName(part) === name)

/** A property's value: `<m:chr m:val="∑"/>` in its `…Pr`; `undefined` when not set. */
function property(node: XmlNode, pr: string, name: string): string | undefined {
  const found = child(child(node, pr), name)
  return found ? (found.attrs['m:val'] ?? found.attrs.val ?? '') : undefined
}

/** Plain text, its symbols in LaTeX. */
function symbols(text: string): string {
  return [...text].map((char) => (SYMBOLS[char] ? `${SYMBOLS[char]} ` : '{}%#&'.includes(char) ? `\\${char}` : char)).join('')
}

const group = (node: XmlNode | undefined): string => `{${node ? ommlToLatex(node).trim() : ''}}`

/** An OMML element, and what it holds, in LaTeX. */
export function ommlToLatex(node: XmlNode): string {
  const name = localName(node)
  switch (name) {
    case 't':
      return symbols(node.text)
    case 'f':
      return property(node, 'fPr', 'type') === 'lin' ? `${group(child(node, 'num'))}/${group(child(node, 'den'))}` : `\\frac${group(child(node, 'num'))}${group(child(node, 'den'))}`
    case 'sSup':
      return `${group(child(node, 'e'))}^${group(child(node, 'sup'))}`
    case 'sSub':
      return `${group(child(node, 'e'))}_${group(child(node, 'sub'))}`
    case 'sSubSup':
      return `${group(child(node, 'e'))}_${group(child(node, 'sub'))}^${group(child(node, 'sup'))}`
    case 'sPre':
      return `{}_${group(child(node, 'sub'))}^${group(child(node, 'sup'))}${group(child(node, 'e'))}`
    case 'rad': {
      const degree = child(node, 'deg')
      const shown = degree ? ommlToLatex(degree).trim() : ''
      return `\\sqrt${shown ? `[${shown}]` : ''}${group(child(node, 'e'))}`
    }
    case 'nary': {
      const chr = property(node, 'naryPr', 'chr') || '∫'
      const sub = child(node, 'sub')
      const sup = child(node, 'sup')
      const below = sub && ommlToLatex(sub).trim() ? `_${group(sub)}` : ''
      const above = sup && ommlToLatex(sup).trim() ? `^${group(sup)}` : ''
      const body = child(node, 'e')
      return `${NARY[chr] ?? symbols(chr)}${below}${above} ${body ? ommlToLatex(body).trim() : ''}`
    }
    case 'd': {
      const open = property(node, 'dPr', 'begChr') ?? '('
      const close = property(node, 'dPr', 'endChr') ?? ')'
      const separator = property(node, 'dPr', 'sepChr') ?? '|'
      const inside = children(node, 'e')
        .map((part) => ommlToLatex(part).trim())
        .join(separator === '|' ? ' \\mid ' : ` ${symbols(separator)} `)
      return `\\left${DELIMITERS[open] ?? symbols(open)} ${inside} \\right${DELIMITERS[close] ?? symbols(close)}`
    }
    case 'func': {
      const named = child(node, 'fName')
      const fname = named ? ommlToLatex(named).trim() : ''
      return `${FUNCTIONS.has(fname) ? `\\${fname}` : `\\operatorname{${fname}}`}${group(child(node, 'e'))}`
    }
    case 'acc':
      return `${ACCENTS[property(node, 'accPr', 'chr') ?? '̂'] ?? '\\hat'}${group(child(node, 'e'))}`
    case 'bar':
      return `${property(node, 'barPr', 'pos') === 'top' ? '\\overline' : '\\underline'}${group(child(node, 'e'))}`
    case 'limLow':
    case 'limUpp': {
      const base = child(node, 'e')
      const text = base ? ommlToLatex(base).trim() : ''
      return `${FUNCTIONS.has(text) ? `\\${text}` : `{${text}}`}${name === 'limLow' ? '_' : '^'}${group(child(node, 'lim'))}`
    }
    case 'm':
      return `\\begin{matrix} ${children(node, 'mr')
        .map((row) =>
          children(row, 'e')
            .map((cell) => ommlToLatex(cell).trim())
            .join(' & ')
        )
        .join(' \\\\ ')} \\end{matrix}`
    case 'eqArr':
      return `\\begin{aligned} ${children(node, 'e')
        .map((line) => ommlToLatex(line).trim())
        .join(' \\\\ ')} \\end{aligned}`
    default:
      // Properties (`…Pr`) are not written; anything else, for what it holds.
      if (name.endsWith('Pr')) return ''
      return node.children.map(ommlToLatex).join('')
  }
}

/** An equation in the text (`m:oMath`) as `$…$`; one set on its own (`m:oMathPara`) as `$$…$$`. */
export function equationText(node: XmlNode): string {
  const display = localName(node) === 'oMathPara'
  const latex = (
    display
      ? children(node, 'oMath')
          .map((part) => ommlToLatex(part).trim())
          .join(' \\\\ ')
      : ommlToLatex(node).trim()
  )
    .replace(/\s+/g, ' ')
    .trim()
  if (!latex) return ''
  return display ? `$$${latex}$$` : `$${latex}$`
}
