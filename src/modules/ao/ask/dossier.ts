// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Interroger le dossier d'un appel d'offres avec l'IA, en citant ses sources.
 *
 * - **Recherche** (par défaut) : les passages des pièces qui répondent le mieux à la
 *   question sont trouvés par le module, hors ligne (mots de la question, les plus rares
 *   comptant plus ; un article nommé par son numéro donné en entier), numérotés, et seuls
 *   eux sont donnés à l'IA, qui répond en citant leur numéro : [1], [2]…
 * - **Lecture de chaque pièce** : chaque pièce lue en entier, partie par partie, ce qui
 *   répond à la question noté, puis une réponse d'ensemble — plus long, mais rien n'échappe.
 *
 * Aucun passage trouvé : l'IA n'est pas appelée, la réponse le dit. Une question sur les
 * délais reçoit en plus les dates et délais relevés dans les pièces par le module.
 *
 * Chaque question donne une note, `Analyse/Questions/<date> <question>.md` : la question,
 * la réponse, ses sources (liens vers les pièces) et les extraits transmis.
 * Le **questionnaire** pose six questions prêtes à l'emploi et les range dans
 * `Analyse/Questionnaire.md`.
 */

import { frontmatter } from '../../../core/frontmatter'
import type { AiClient, ChatMessage } from '../../ia'
import { asksForDeadlines, deadlinesBlock } from '../deadlines'
import { ANALYSIS, safeName, wikiLink, type Analysis } from '../notes'
import type { Services, Translate } from '../service'
import { eachContext, readEach, type EachWords } from './eachDocument'
import { retrievalContext, retrieve, type FoundSource, type RetrievalWords } from './retrieval'
import type { PieceSource } from './sources'

export type AskMode = 'search' | 'each'

/** Les questions du questionnaire, dans l'ordre où elles sont posées. */
export const QUESTIONNAIRE = ['attribution', 'penalites', 'garanties', 'propriete', 'confidentialite', 'export'] as const
export type QuestionKey = (typeof QUESTIONNAIRE)[number]

export const QUESTION_TYPE = 'ao-question'
export const QUESTIONNAIRE_TYPE = 'ao-questionnaire'

/** Les caractères d'extraits donnés à l'IA pour une question. */
const BUDGET = 24000
/** Les caractères d'une pièce lus d'un coup, en lecture de chaque pièce. */
const PART = 12000

export interface AnswerSource {
  source: PieceSource
  /** Les extraits transmis ; vide en lecture de chaque pièce, où c'est la pièce entière. */
  passages: string[]
  /** Ce que l'IA en a noté, en lecture de chaque pièce. */
  noted?: string
  cited: boolean
}

export interface Answer {
  question: string
  mode: AskMode
  text: string
  /** Numérotées comme l'IA les cite : la première est [1]. */
  sources: AnswerSource[]
  /** Les numéros cités qui ne correspondent à aucune source. */
  unknown: number[]
  /** L'IA n'a pas été appelée : rien dans les pièces ne parle de la question. */
  nothing: boolean
}

export interface Progress {
  (message: string): void
}

/** Les numéros de sources cités dans une réponse : [1], [2][3], [1, 4]. */
export function citedNumbers(text: string): number[] {
  const out = new Set<number>()
  for (const found of text.matchAll(/\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\]/g)) {
    for (const each of found[1]!.split(/[,;]/)) out.add(Number(each.trim()))
  }
  return [...out].sort((a, b) => a - b)
}

/** Les citations [n] d'une réponse devenues des liens vers la pièce : \[[[note|n]]\]. */
export function linkCitations(text: string, sources: readonly AnswerSource[]): string {
  return text.replace(/\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\]/g, (whole, list: string) => {
    const numbers = list.split(/[,;]/).map((each) => Number(each.trim()))
    if (!numbers.every((n) => sources[n - 1])) return whole
    return numbers.map((n) => `\\[${wikiLink(sources[n - 1]!.source.path, String(n))}\\]`).join('')
  })
}

function retrievalWords(t: Translate): RetrievalWords {
  return {
    intro: t('ao.ask.prompt.passages'),
    none: t('ao.ask.prompt.none'),
    heading: (index, title) => t('ao.ask.prompt.source', { index, title })
  }
}

function eachWords(t: Translate): EachWords {
  return {
    system: t('ao.ask.prompt.each.system'),
    user: (question, title, part, parts, text) => t('ao.ask.prompt.each.user', { question, title, part, parts, text }),
    intro: (read, found) => t('ao.ask.prompt.each.intro', { read, found }),
    none: (read) => t('ao.ask.prompt.each.none', { read }),
    heading: (index, title) => t('ao.ask.prompt.source', { index, title }),
    merge: t('ao.ask.prompt.each.merge'),
    merged: t('ao.ask.prompt.each.merged'),
    partial: (read, total) => t('ao.ask.prompt.each.partial', { read, total })
  }
}

/** Les dates et délais relevés dans les pièces, pour une question qui en parle. */
function deadlinesFor(sources: readonly PieceSource[], t: Translate): string {
  return deadlinesBlock(
    sources.map((source) => ({ name: source.title, text: source.text })),
    {
      intro: t('ao.ask.prompt.deadlines'),
      file: (name) => name,
      guessed: t('ao.calendar.guessed'),
      delays: t('ao.ask.prompt.delays'),
      none: t('ao.ask.prompt.noDeadline')
    }
  )
}

async function reply(client: AiClient, t: Translate, context: string, question: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: t('ao.ask.prompt.system') },
    { role: 'user', content: `${context}\n\n## ${t('ao.ask.prompt.question')}\n\n${question}` }
  ]
  return (await client.chat({ messages, temperature: 0.1 })).trim()
}

/**
 * Poser une question aux pièces. `terms` ajoute des mots à la recherche sans changer la
 * question posée à l'IA (le questionnaire s'en sert).
 */
export async function answerQuestion(
  client: AiClient,
  t: Translate,
  sources: readonly PieceSource[],
  question: string,
  mode: AskMode,
  progress: Progress = () => {},
  terms = ''
): Promise<Answer> {
  const deadlines = asksForDeadlines(question) ? `\n\n${deadlinesFor(sources, t)}` : ''
  if (mode === 'each') {
    const ask = async (system: string, user: string) =>
      (
        await client.chat({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          temperature: 0
        })
      ).trim()
    const outcome = await readEach([...sources], question, ask, eachWords(t), {
      part: PART,
      onProgress: (done, total, title) => {
        if (title) progress(t('ao.ask.reading', { done: done + 1, total, title }))
      },
      stopped: () => false
    })
    const found = outcome.found.map(({ source, extract }) => ({ source: source as PieceSource, passages: [], noted: extract, cited: false }))
    if (!found.length) return { question, mode, text: t('ao.ask.nothing'), sources: [], unknown: [], nothing: true }
    const context = await eachContext(outcome, sources.length, eachWords(t), ask, BUDGET * 2)
    return finish(question, mode, await reply(client, t, context + deadlines, question), found)
  }
  const found: FoundSource[] = await rerankFound(
    client,
    question,
    retrieve([...sources], `${question} ${terms}`.trim(), { budget: BUDGET, perSource: 3, maxSources: 8 })
  )
  if (!found.length) return { question, mode, text: t('ao.ask.nothing'), sources: [], unknown: [], nothing: true }
  progress(t('ao.ask.asking', { count: found.length }))
  const text = await reply(client, t, retrievalContext(found, retrievalWords(t)) + deadlines, question)
  return finish(
    question,
    mode,
    text,
    found.map(({ source, passages }) => ({ source: source as PieceSource, passages, cited: false }))
  )
}

/**
 * Les pièces trouvées remises dans l'ordre de pertinence par le modèle de reranking, s'il
 * est réglé : la première citée [1] est alors la plus pertinente. Sans lui, ou s'il
 * échoue, l'ordre de la recherche est gardé — le reranking affine, il ne bloque pas.
 */
export async function rerankFound(client: AiClient, question: string, found: FoundSource[]): Promise<FoundSource[]> {
  if (found.length < 2 || !client.modelFor('rerank')) return found
  try {
    const scores = await client.rerank(
      question,
      found.map(({ source, passages }) => `${source.title}\n${passages.join('\n\n')}`.slice(0, 4000))
    )
    return found
      .map((each, index) => ({ each, score: scores[index] ?? Number.NEGATIVE_INFINITY, index }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ each }) => each)
  } catch {
    return found
  }
}

function finish(question: string, mode: AskMode, text: string, sources: AnswerSource[]): Answer {
  const cited = citedNumbers(text)
  for (const n of cited) if (sources[n - 1]) sources[n - 1]!.cited = true
  return { question, mode, text, sources, unknown: cited.filter((n) => !sources[n - 1]), nothing: false }
}

const quote = (text: string, size = 700) => {
  const flat = text.trim()
  const short = flat.length > size ? `${flat.slice(0, size - 1)}…` : flat
  return short
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

/** La réponse et ses sources, en Markdown (le corps d'une note, ou une section du questionnaire). */
export function answerMarkdown(answer: Answer, t: Translate, level = 2): string {
  const h = '#'.repeat(level)
  const lines = [linkCitations(answer.text, answer.sources), '']
  if (answer.unknown.length) lines.push(`> [!warning] ${t('ao.ask.unknown', { numbers: answer.unknown.map((n) => `[${n}]`).join(', ') })}`, '')
  if (answer.nothing) return lines.join('\n').trimEnd()
  if (!answer.sources.some((source) => source.cited)) lines.push(`> [!warning] ${t('ao.ask.uncited')}`, '')
  lines.push(`${h} ${t('ao.ask.sources')}`, '')
  answer.sources.forEach((each, index) => {
    lines.push(
      `${index + 1}. ${wikiLink(each.source.path, each.source.title)} — ${each.source.detail} — *${t(each.cited ? 'ao.ask.cited' : 'ao.ask.notCited')}*`
    )
    const extracts = each.noted ? [each.noted] : each.passages
    if (extracts.length) {
      lines.push(`   > [!quote]- ${t(each.noted ? 'ao.ask.noted' : 'ao.ask.passages', { count: extracts.length })}`)
      for (const extract of extracts) lines.push(quote(extract).replace(/^/gm, '   > '), '   >')
      lines.pop()
    }
  })
  return lines.join('\n').trimEnd()
}

export function questionsFolder(analysis: Analysis): string {
  return `${analysis.folder}/${ANALYSIS}/Questions`
}

/** Écrit la note d'une question ; rend son chemin (jamais une note existante écrasée). */
export async function writeQuestionNote(services: Services, analysis: Analysis, answer: Answer): Promise<string> {
  const { fs, t } = services
  const folder = questionsFolder(analysis)
  const base = `${services.today()} ${safeName(answer.question).slice(0, 70).replace(/[\s-]+$/, '')}`
  let path = `${folder}/${base}.md`
  for (let n = 2; await fs.exists(path); n++) path = `${folder}/${base} (${n}).md`
  const note = [
    frontmatter({
      'bp-type': QUESTION_TYPE,
      analyse: wikiLink(analysis.note),
      date: services.today(),
      mode: answer.mode === 'each' ? 'lecture' : 'recherche',
      sources: answer.sources.length
    }),
    `# ${t('ao.ask.note.title', { name: analysis.name })}`,
    '',
    `> [!question] ${answer.question.replace(/\n/g, '\n> ')}`,
    `> *${t(answer.mode === 'each' ? 'ao.ask.mode.each' : 'ao.ask.mode.search')} — ${t('ao.ask.check')}*`,
    '',
    `## ${t('ao.ask.answer')}`,
    '',
    answerMarkdown(answer, t),
    '',
    `## ${t('ao.note.notes')}`,
    '',
    ''
  ].join('\n')
  await fs.writeText(path, note)
  return path
}

// ── Le questionnaire ─────────────────────────────────────────────────────────────

export function questionnairePath(analysis: Analysis): string {
  return `${analysis.folder}/${ANALYSIS}/Questionnaire.md`
}

const start = (key: string) => `<!-- bp:questionnaire:${key}:debut — tenu à jour par Black Projects -->`
const end = (key: string) => `<!-- bp:questionnaire:${key}:fin -->`

function questionnaireSkeleton(analysis: Analysis, t: Translate): string {
  return [
    frontmatter({ 'bp-type': QUESTIONNAIRE_TYPE, analyse: wikiLink(analysis.note) }),
    `# ${t('ao.questionnaire.title', { name: analysis.name })}`,
    '',
    t('ao.questionnaire.intro'),
    '',
    ...QUESTIONNAIRE.flatMap((key) => [`## ${t(`ao.q.${key}`)}`, '', start(key), `*${t('ao.verif.notRun')}*`, end(key), '']),
    `## ${t('ao.note.notes')}`,
    '',
    ''
  ].join('\n')
}

function withMarked(note: string, key: string, content: string): string {
  const from = note.indexOf(start(key))
  const to = note.indexOf(end(key))
  if (from === -1 || to < from) return `${note.trimEnd()}\n\n${start(key)}\n${content}\n${end(key)}\n`
  return `${note.slice(0, from + start(key).length)}\n${content}\n${note.slice(to)}`
}

/** Pose les questions choisies (toutes par défaut) et met leurs réponses dans le questionnaire. */
export async function runQuestionnaire(
  services: Services,
  client: AiClient,
  analysis: Analysis,
  sources: readonly PieceSource[],
  keys: readonly QuestionKey[] = QUESTIONNAIRE,
  progress: Progress = () => {}
): Promise<{ path: string; answers: Answer[] }> {
  const { fs, t } = services
  const path = questionnairePath(analysis)
  let note = (await fs.exists(path)) ? await fs.readText(path) : questionnaireSkeleton(analysis, t)
  const answers: Answer[] = []
  for (const [index, key] of keys.entries()) {
    progress(t('ao.questionnaire.progress', { index: index + 1, total: keys.length, question: t(`ao.q.${key}`) }))
    const answer = await answerQuestion(client, t, sources, t(`ao.q.${key}.ask`), 'search', () => {}, t(`ao.q.${key}.terms`))
    answers.push(answer)
    const content = [`*${t('ao.questionnaire.asked', { date: services.today() })}* ${t(`ao.q.${key}.ask`)}`, '', answerMarkdown(answer, t, 3)].join('\n')
    note = withMarked(note, key, content)
    // Écrit après chaque question : une coupure en route garde ce qui a été répondu.
    await fs.writeText(path, note)
  }
  return { path, answers }
}
