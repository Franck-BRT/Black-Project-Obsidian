// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que l'IA fait pour une exigence, à la demande, et jamais sans l'accord de l'utilisateur :
 *
 * - **relire** : un avis, les défauts que les règles ne voient pas, et des reformulations
 *   qui relèvent la note — écrits dans la note de l'exigence (section « Relecture par
 *   l'IA ») ; une reformulation choisie devient la formulation, avec une révision ;
 * - **traduire** : dans une des langues de rédaction, marquée « automatique, à relire »,
 *   chiffres et unités comparés à la source.
 */

import { describeAiError, type AiClient } from '../../ia'
import type { Session } from '../flows'
import { acceptText, setText, textOf } from '../model/requirement'
import { describeFinding } from '../quality/report'
import { assessRequirement, type QualityScope } from '../quality/score'
import { deepReview, mergeFindings, type DeepReview } from './reqQualityLlm'
import { improvementPlan } from './reqAdvice'
import { buildTranslationRequest, hasDrifted, quantityDrift, readTranslation } from './translate'

/**
 * Ce qu'a donné une relecture : une reformulation retenue, une relecture écrite dans la
 * note, l'IA sans réponse (déjà dit à l'utilisateur ; une série s'arrête), rien à relire.
 */
export type ReviewOutcome = 'rewritten' | 'reviewed' | 'failed' | 'none'

/** La note visée pour une exigence relue : quatre étoiles. */
const TARGET = 0.8

export const REVIEW_START = '<!-- bp:relecture:debut — écrit par Black Projects -->'
export const REVIEW_END = '<!-- bp:relecture:fin -->'

/** La section « Relecture par l'IA » de la note : remplacée si elle y est, ajoutée sinon. */
/** La dernière relecture par l'IA écrite dans une note : sa section, sans ses marques ; `null` s'il n'y en a pas. */
export function reviewSection(note: string): string | null {
  const from = note.indexOf(REVIEW_START)
  const to = note.indexOf(REVIEW_END)
  return from !== -1 && to > from ? note.slice(from + REVIEW_START.length, to).trim() : null
}

/** La dernière relecture d'une note, en bref : sa date et l'avis de l'IA ; `null` s'il n'y en a pas. */
export function lastReview(note: string): { date: string; assessment: string } | null {
  const section = reviewSection(note)
  if (!section) return null
  const date = /^#+[^\n]*?(\d{4}-\d{2}-\d{2})/m.exec(section)?.[1] ?? ''
  const assessment = section.replace(/^#+[^\n]*\n+/, '').split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  return { date, assessment }
}

export function withReview(note: string, content: string): string {
  const block = `${REVIEW_START}\n${content}\n${REVIEW_END}`
  const from = note.indexOf(REVIEW_START)
  const to = note.indexOf(REVIEW_END)
  if (from !== -1 && to > from) return note.slice(0, from) + block + note.slice(to + REVIEW_END.length)
  return `${note.trimEnd()}\n\n${block}\n`
}

function reviewMarkdown(review: DeepReview, merged: ReturnType<typeof mergeFindings>, session: Session, date: string): string {
  const { t } = session
  return [
    `## ${t('exigences.ai.review.title', { date })}`,
    '',
    review.assessment.trim(),
    '',
    `**${t('exigences.ai.review.findings')}**`,
    '',
    ...(merged.length
      ? merged.map((finding) => `- ${describeFinding(finding, t)}${finding.fromModel ? ` — *${t('exigences.ai.review.byModel')}*${finding.message ? ` : ${finding.message}` : ''}` : ''}`)
      : [`- ${t('exigences.ai.review.noFinding')}`]),
    '',
    `**${t('exigences.ai.review.proposals')}**`,
    '',
    ...(review.proposals.length
      ? review.proposals.map(
          (proposal) =>
            `- *${t(`exigences.axis.${proposal.axis}`)}* — ${proposal.action}${proposal.rewrite ? `\n  > ${proposal.rewrite.replace(/\n/g, '\n  > ')}` : ''}`
        )
      : [`- ${t('exigences.ai.review.noProposal')}`])
  ].join('\n')
}

export interface ReviewOptions {
  /** `wording` pour les exigences d'un acheteur, notées sur leur seule rédaction. */
  scope?: QualityScope
  /** Proposer de retenir une reformulation ; non pour une exigence qu'on ne réécrit pas soi-même. */
  offerRewrite?: boolean
  /** Ne rien dire tant que tout va bien : une relecture en série a son propre résumé. */
  quiet?: boolean
}

/** Relire une exigence. */
export async function reviewRequirement(
  session: Session,
  client: AiClient,
  path: string,
  date: string,
  options: ReviewOptions = {}
): Promise<ReviewOutcome> {
  const { store, ui, notifier, t } = session
  const requirement = await store.load(path)
  if (!requirement) {
    notifier.notify(t('exigences.notRequirement'), 6000)
    return 'none'
  }
  const lang = requirement.sourceLang
  const body = textOf(requirement, lang)?.body ?? ''
  if (!body.trim()) {
    notifier.notify(t('exigences.ai.noWording'), 6000)
    return 'none'
  }
  const quality = assessRequirement(requirement, session.settings().languages, options.scope ?? 'record')
  const plan = improvementPlan(quality, TARGET, 3)
  if (!options.quiet) notifier.notify(t('exigences.ai.review.running', { id: requirement.id }), 4000)
  let review: DeepReview
  try {
    review = await deepReview(client, body, {
      lang,
      title: requirement.title,
      weak: plan.improvements.map((improvement) => ({ axis: improvement.axis, misses: improvement.misses, gain: improvement.gain })),
      score: Math.round(quality.score * 100),
      target: Math.round(TARGET * 100),
      count: 3
    })
  } catch (error) {
    notifier.notify(t('exigences.ai.failed', { reason: describeAiError(error, t) }), 12000)
    return 'failed'
  }
  const merged = mergeFindings(quality.findings, review.findings)
  // La relecture est gardée dans la note, qu'une reformulation soit retenue ou non.
  await store.writeNote(path, withReview(await store.readNote(path), reviewMarkdown(review, merged, session, date)))

  const rewrites = review.proposals.filter((proposal) => proposal.rewrite?.trim())
  if (options.offerRewrite === false) return 'reviewed'
  if (rewrites.length === 0) {
    if (!options.quiet) notifier.notify(t('exigences.ai.review.done', { id: requirement.id, count: merged.length }), 8000)
    return 'reviewed'
  }
  const chosen = await ui.pickOption(
    [
      ...rewrites.map((proposal, index) => ({
        value: String(index),
        label: proposal.rewrite!.trim(),
        description: `${t(`exigences.axis.${proposal.axis}`)} — ${proposal.action}`
      })),
      { value: 'keep', label: t('exigences.ai.review.keep'), description: t('exigences.ai.review.keep.desc') }
    ],
    t('exigences.ai.review.pick', { id: requirement.id })
  )
  if (chosen === null || chosen === 'keep') return 'reviewed'
  const rewrite = rewrites[Number(chosen)]!.rewrite!.trim()
  // Écrite par la machine, acceptée par une personne : la révision le dit.
  const saved = await store.save(path, (current) => acceptText(setText(current, lang, rewrite, 'IA', 'machine'), lang, ''))
  if (saved) notifier.notify(t('exigences.edit.done', { id: saved.requirement.id, rev: saved.requirement.rev }), 6000)
  return 'rewritten'
}

/** Traduire une exigence dans une des langues de rédaction ; la traduction est marquée à relire. */
export async function translateRequirement(session: Session, client: AiClient, path: string): Promise<boolean> {
  const { store, ui, notifier, t } = session
  const requirement = await store.load(path)
  if (!requirement) {
    notifier.notify(t('exigences.notRequirement'), 6000)
    return false
  }
  const source = textOf(requirement, requirement.sourceLang)?.body ?? ''
  if (!source.trim()) {
    notifier.notify(t('exigences.ai.noWording'), 6000)
    return false
  }
  const targets = session.settings().languages.filter((lang) => lang !== requirement.sourceLang)
  if (targets.length === 0) {
    notifier.notify(t('exigences.ai.translate.noTarget'), 8000)
    return false
  }
  const lang =
    targets.length === 1
      ? targets[0]!
      : await ui.pickOption(
          targets.map((each) => ({
            value: each,
            label: each.toUpperCase(),
            ...(textOf(requirement, each) ? { description: t('exigences.ai.translate.exists') } : {})
          })),
          t('exigences.ai.translate.pick', { id: requirement.id })
        )
  if (!lang) return false
  notifier.notify(t('exigences.ai.translate.running', { id: requirement.id, lang: lang.toUpperCase() }), 4000)
  let text: string
  let notes: string
  try {
    const request = buildTranslationRequest(client.modelFor('translate'), source, requirement.sourceLang, lang, { title: requirement.title })
    const reply = readTranslation(await client.chatJson<unknown>(request))
    text = reply.text
    notes = reply.notes
  } catch (error) {
    notifier.notify(t('exigences.ai.failed', { reason: describeAiError(error, t) }), 12000)
    return false
  }
  await store.save(path, (current) => setText(current, lang, text, 'IA', 'machine'))
  const drift = quantityDrift(source, text)
  notifier.notify(
    [
      t('exigences.ai.translate.done', { id: requirement.id, lang: lang.toUpperCase() }),
      ...(hasDrifted(drift) ? [t('exigences.ai.translate.drift', { missing: drift.missing.join(', ') || '—', added: drift.added.join(', ') || '—' })] : []),
      ...(notes.trim() ? [t('exigences.ai.translate.notes', { notes: notes.trim() })] : [])
    ].join(' '),
    hasDrifted(drift) ? 15000 : 8000
  )
  return true
}
