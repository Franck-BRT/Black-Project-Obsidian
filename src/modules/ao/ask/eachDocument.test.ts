// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { documentParts, eachContext, readEach, saysNothing, type EachWords } from './eachDocument'
import type { LibrarySource } from './retrieval'

const words: EachWords = {
  system: 'SYSTEM',
  user: (question, title, part, parts, text) => `${question}|${title}|${part}/${parts}|${text}`,
  intro: (read, found) => `INTRO ${read} ${found}`,
  none: (read) => `NONE ${read}`,
  heading: (index, title) => `[${index}] ${title}`,
  merge: 'MERGE',
  merged: 'MERGED',
  partial: (read, total) => `PARTIAL ${read}/${total}`
}

const source = (title: string, text: string): LibrarySource => ({
  path: `Lib/${title}.xlsx`,
  title,
  kind: 'document',
  detail: '',
  text
})

/** A model that notes the work centres it is shown — « CC-… » —, or nothing. */
const model = async (_system: string, user: string): Promise<string> => {
  const found = user.match(/CC-\d+/g)
  return found ? found.map((one) => `- ${one}`).join('\n') : 'RIEN'
}

describe('documentParts', () => {
  it('keeps a short text whole, and cuts a long one at line ends', () => {
    expect(documentParts('  court  ', 100)).toEqual(['court'])
    expect(documentParts('', 100)).toEqual([])
    const lines = Array.from({ length: 30 }, (_, at) => `ligne ${at}`).join('\n')
    const parts = documentParts(lines, 60)
    expect(parts.length).toBeGreaterThan(3)
    expect(parts.every((part) => part.length <= 60)).toBe(true)
    expect(parts.join('\n')).toBe(lines)
  })
})

describe('saysNothing', () => {
  it('reads « nothing » however it is dressed', () => {
    for (const reply of ['RIEN', 'Rien.', '**RIEN**', ' none ', 'NOTHING', '']) expect(saysNothing(reply)).toBe(true)
    expect(saysNothing('- CC-12 Usinage')).toBe(false)
  })
})

describe('readEach', () => {
  const sources = [
    source('Industriel A', 'Centre de charge CC-10 Usinage\nCentre de charge CC-11 Peinture'),
    source('Industriel B', 'Aucun centre ici'),
    source('Industriel C', `${'x'.repeat(50)}\nCC-12 Montage\n${'y'.repeat(50)}\nCC-13 Contrôle`)
  ]

  it('reads every source, every part, and keeps what answers', async () => {
    const progress: string[] = []
    const outcome = await readEach(sources, 'Quels centres de charge ?', model, words, {
      part: 60,
      onProgress: (done, total, title) => progress.push(`${done}/${total} ${title}`),
      stopped: () => false
    })
    expect(outcome.read).toBe(3)
    expect(outcome.found.map((one) => one.source.title)).toEqual(['Industriel A', 'Industriel C'])
    expect(outcome.found[0].extract).toBe('- CC-10\n- CC-11')
    // The third read in parts, each part's notes kept.
    expect(outcome.found[1].extract).toContain('CC-12')
    expect(outcome.found[1].extract).toContain('CC-13')
    expect(progress).toEqual(['0/3 Industriel A', '1/3 Industriel B', '2/3 Industriel C', '3/3 '])
  })

  it('stops between two documents when asked, what was read kept', async () => {
    let calls = 0
    const outcome = await readEach(
      sources,
      'Quels centres ?',
      async (system, user) => {
        calls += 1
        return model(system, user)
      },
      words,
      { part: 1000, onProgress: () => {}, stopped: () => calls >= 1 }
    )
    expect(outcome.read).toBe(1)
    expect(outcome.found).toHaveLength(1)
  })
})

describe('eachContext', () => {
  const found = [
    { source: source('A', ''), extract: '- CC-10' },
    { source: source('B', ''), extract: '- CC-11' }
  ]

  it('hands every source over with its notes and its link when it fits', async () => {
    const text = await eachContext({ found, read: 5 }, 5, words, async () => 'unused', 10_000)
    expect(text).toContain('INTRO 5 2')
    expect(text).toContain('### [1] A')
    expect(text).toContain('[[Lib/A.xlsx|A]]')
    expect(text).toContain('- CC-11')
    expect(text).not.toContain('PARTIAL')
  })

  it('says when the pass was stopped, and when nothing was found', async () => {
    expect(await eachContext({ found, read: 2 }, 5, words, async () => '', 10_000)).toContain('PARTIAL 2/5')
    expect(await eachContext({ found: [], read: 4 }, 4, words, async () => '', 10_000)).toBe('NONE 4')
  })

  it('merges the notes group by group when they are too long, the sources still listed', async () => {
    const merged: string[] = []
    const text = await eachContext(
      { found, read: 2 },
      2,
      words,
      async (system, user) => {
        merged.push(system)
        return `fusion de ${user.length} caractères`
      },
      40
    )
    expect(merged.every((one) => one === 'MERGE')).toBe(true)
    expect(merged.length).toBeGreaterThan(0)
    expect(text).toContain('MERGED')
    expect(text).toContain('- [1] A [[Lib/A.xlsx|A]]')
    expect(text).toContain('fusion de')
  })
})
