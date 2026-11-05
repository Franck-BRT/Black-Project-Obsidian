// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { sourceLink, type LibrarySource } from './retrieval'

/**
 * A question asked of every document, not of the few that look most like it: each one in
 * the scope read whole by the model, part by part, and what answers the question noted
 * from it — or nothing —; then everything noted handed over together for one complete
 * answer, each thing with the source it came from.
 *
 * It is what a search cannot do: « every work centre in every one of these files » has
 * its answer spread over all of them, in lines that look alike, and a search that keeps
 * the ten best passages keeps ten of the fifty.
 */

export interface EachWords {
  /** The instruction for reading one document. */
  system: string
  /** The question, and the document — or one part of it — to read. */
  user: (question: string, title: string, part: number, parts: number, text: string) => string
  /** What everything noted is, and how to answer from it. */
  intro: (read: number, found: number) => string
  /** Said when nothing was found in any document. */
  none: (read: number) => string
  heading: (index: number, title: string) => string
  /** The instruction for gathering what was noted when it is too long to hand over as it is. */
  merge: string
  /** What the gathered notes are, in the hand-over, when they had to be. */
  merged: string
  /** Said when the reading was stopped part way. */
  partial: (read: number, total: number) => string
}

export interface EachFound {
  source: LibrarySource
  /** What was noted from it, every part together. */
  extract: string
}

export interface EachOptions {
  /** Characters of a document read at once. */
  part: number
  /** Characters of notes handed over as they are; past it, they are gathered first. */
  budget: number
}

export const EACH_DEFAULTS: EachOptions = { part: 20000, budget: 60000 }

/** A text cut into parts of about `size` characters, at a paragraph's end — a line's when a paragraph is longer. */
export function documentParts(text: string, size: number): string[] {
  const clean = text.trim()
  if (!clean) return []
  if (clean.length <= size) return [clean]
  const parts: string[] = []
  let rest = clean
  while (rest.length > size) {
    const window = rest.slice(0, size)
    const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'))
    const at = cut > size / 2 ? cut : size
    parts.push(rest.slice(0, at).trim())
    rest = rest.slice(at).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

/** Whether a reply says the document held nothing to the point. */
export function saysNothing(reply: string): boolean {
  const clean = reply
    .trim()
    .replace(/^[*_`"«»\s]+|[*_`"«».!\s]+$/g, '')
    .toUpperCase()
  return !clean || ['RIEN', 'NONE', 'NOTHING', 'AUCUN', 'NÉANT', 'NEANT'].includes(clean)
}

/**
 * Every source read for a question: each part sent with it, what answers it kept. Stopped
 * between two calls when `stopped` says so, what was read by then kept.
 */
export async function readEach(
  sources: LibrarySource[],
  question: string,
  ask: (system: string, user: string) => Promise<string>,
  words: EachWords,
  options: {
    part: number
    onProgress: (done: number, total: number, title: string) => void
    stopped: () => boolean
  }
): Promise<{ found: EachFound[]; read: number }> {
  const found: EachFound[] = []
  let read = 0
  for (const source of sources) {
    if (options.stopped()) break
    options.onProgress(read, sources.length, source.title)
    const parts = documentParts(source.text, options.part)
    const kept: string[] = []
    for (let at = 0; at < parts.length; at++) {
      if (options.stopped()) break
      const reply = await ask(words.system, words.user(question, source.title, at + 1, parts.length, parts[at]))
      if (!saysNothing(reply)) kept.push(reply.trim())
    }
    read += 1
    if (kept.length) found.push({ source, extract: kept.join('\n') })
  }
  options.onProgress(read, sources.length, '')
  return { found, read }
}

/** Each source with what was noted from it, numbered to be cited by, its link to open it. */
function blocks(found: EachFound[], words: EachWords): string[] {
  return found.map(({ source, extract }, index) =>
    [
      `### ${words.heading(index + 1, source.title)}`,
      [source.detail, sourceLink(source)].filter(Boolean).join(' · '),
      extract
    ].join('\n')
  )
}

/**
 * What was noted, as the model is given it to answer from: as it is when it fits, else
 * gathered first, group by group — each group's notes merged into one list that keeps
 * every item and the number of its source —, the sources then listed with their links.
 */
export async function eachContext(
  outcome: { found: EachFound[]; read: number },
  total: number,
  words: EachWords,
  ask: (system: string, user: string) => Promise<string>,
  budget: number
): Promise<string> {
  const head = [
    outcome.found.length ? words.intro(outcome.read, outcome.found.length) : words.none(outcome.read),
    outcome.read < total ? words.partial(outcome.read, total) : ''
  ]
    .filter(Boolean)
    .join('\n\n')
  if (!outcome.found.length) return head
  const all = blocks(outcome.found, words)
  if (all.join('\n\n').length <= budget) return [head, ...all].join('\n\n')
  // Too long to hand over: merged a group at a time, each group well under the room.
  const groups: string[][] = [[]]
  let size = 0
  for (const block of all) {
    if (size + block.length > budget / 2 && groups[groups.length - 1].length) {
      groups.push([])
      size = 0
    }
    groups[groups.length - 1].push(block)
    size += block.length
  }
  const merged: string[] = []
  for (const group of groups) merged.push((await ask(words.merge, group.join('\n\n'))).trim())
  const listed = outcome.found.map(
    ({ source }, index) => `- ${words.heading(index + 1, source.title)} ${sourceLink(source)}`
  )
  return [head, words.merged, listed.join('\n'), ...merged].join('\n\n')
}
