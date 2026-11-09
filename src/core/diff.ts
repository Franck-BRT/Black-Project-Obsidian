// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce qui a changé d'un texte à l'autre, **paragraphe par paragraphe** (séparés par une ligne
 * vide) : gardés, retirés, ajoutés — dans l'ordre du texte. La plus longue suite commune ;
 * au-delà d'une taille, le début et la fin communs gardés, le reste dit remplacé.
 */

export type DiffChange = 'same' | 'removed' | 'added'

export interface DiffPart {
  change: DiffChange
  text: string
}

/** Au-delà (paragraphes avant × après), on ne cherche plus la plus longue suite commune. */
const MAX_CELLS = 4_000_000

const paragraphs = (text: string): string[] =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((each) => each.trim())
    .filter(Boolean)

export function diffParagraphs(before: string, after: string): DiffPart[] {
  const a = paragraphs(before)
  const b = paragraphs(after)
  // Le début et la fin communs : gardés tels quels.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let end = 0
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
  const head = a.slice(0, start).map((text): DiffPart => ({ change: 'same', text }))
  const tail = a.slice(a.length - end).map((text): DiffPart => ({ change: 'same', text }))
  const x = a.slice(start, a.length - end)
  const y = b.slice(start, b.length - end)
  let middle: DiffPart[]
  if (x.length * y.length > MAX_CELLS) {
    middle = [...x.map((text): DiffPart => ({ change: 'removed', text })), ...y.map((text): DiffPart => ({ change: 'added', text }))]
  } else {
    // La plus longue suite commune, de la fin vers le début.
    const width = y.length + 1
    const table = new Uint32Array((x.length + 1) * width)
    for (let i = x.length - 1; i >= 0; i--)
      for (let j = y.length - 1; j >= 0; j--)
        table[i * width + j] = x[i] === y[j] ? table[(i + 1) * width + j + 1]! + 1 : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!)
    middle = []
    let i = 0
    let j = 0
    while (i < x.length && j < y.length) {
      if (x[i] === y[j]) {
        middle.push({ change: 'same', text: x[i]! })
        i++
        j++
      } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) middle.push({ change: 'removed', text: x[i++]! })
      else middle.push({ change: 'added', text: y[j++]! })
    }
    while (i < x.length) middle.push({ change: 'removed', text: x[i++]! })
    while (j < y.length) middle.push({ change: 'added', text: y[j++]! })
  }
  return [...head, ...interleave(middle), ...tail]
}

/** Dans une suite de changements, chaque passage retiré suivi de celui qui le remplace : ils se lisent côte à côte. */
function interleave(parts: readonly DiffPart[]): DiffPart[] {
  const out: DiffPart[] = []
  let removed: DiffPart[] = []
  let added: DiffPart[] = []
  const flush = () => {
    for (let at = 0; at < Math.max(removed.length, added.length); at++) {
      if (removed[at]) out.push(removed[at]!)
      if (added[at]) out.push(added[at]!)
    }
    removed = []
    added = []
  }
  for (const part of parts) {
    if (part.change === 'same') {
      flush()
      out.push(part)
    } else (part.change === 'removed' ? removed : added).push(part)
  }
  flush()
  return out
}
