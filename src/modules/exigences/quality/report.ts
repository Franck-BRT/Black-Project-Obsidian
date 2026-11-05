// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'analyse de qualité d'un ensemble d'exigences, en note lisible : combien, la répartition
 * des notes, les défauts les plus fréquents, les doublons probables, les exigences non
 * vérifiables, les plus faibles — puis chacune avec sa note et ses défauts. Hors ligne, sans
 * IA : chaque constat vient d'une règle qu'on peut lire.
 *
 * La même pour la bibliothèque (notée sur la formulation et la fiche) et pour les exigences
 * d'un dossier de consultation (notées sur la seule rédaction).
 */

import type { Requirement } from '../model/requirement'
import { countGaps, coverageOf, COVERAGE_GAPS } from './library'
import { QUALITY_RULES, type QualityFinding, type QualityRule } from './rules'
import { assessRequirement, isWeak, QUALITY_AXES, type QualityReport, type QualityScope } from './score'
import { lexicalPairs, mergePairs, thresholdsFor, type SimilarPair } from './similar'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface QualityRun {
  requirement: Requirement
  report: QualityReport
}

export function stars(count: number): string {
  const n = Math.max(0, Math.min(5, count))
  return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`
}

const wordingOf = (requirement: Requirement): string =>
  requirement.text[requirement.sourceLang]?.body ?? Object.values(requirement.text)[0]?.body ?? requirement.title

const excerpt = (text: string, size = 120) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > size ? `${flat.slice(0, size - 1)}…` : flat
}

/** Une cellule de tableau Markdown : les « | » échappés, sur une ligne. */
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function assessAll(requirements: readonly Requirement[], languages: string[], scope: QualityScope): QualityRun[] {
  return requirements.map((requirement) => ({ requirement, report: assessRequirement(requirement, languages, scope) }))
}

/** Les doublons probables : au moins 60 % des trigrammes en commun. */
export function probableDuplicates(requirements: readonly Requirement[], semantic: SimilarPair[] = []): SimilarPair[] {
  const pairs = mergePairs(
    lexicalPairs(
      requirements.map((requirement) => ({ id: requirement.id, text: wordingOf(requirement) })),
      thresholdsFor('normal').lexical
    ),
    semantic
  )
  return pairs.sort((a, b) => b.score - a.score || a.a.localeCompare(b.a, undefined, { numeric: true }))
}

/** Un défaut en mots : « mot vague (« le cas échéant ») ». */
export function describeFinding(finding: QualityFinding, t: Translate): string {
  const label = t(`exigences.rule.${finding.rule}`)
  // « et/ou » (« et/ou ») ne dit rien de plus : le terme n'est rappelé que s'il apprend quelque chose.
  return finding.term && !label.toLowerCase().includes(finding.term.toLowerCase()) ? `${label} (« ${finding.term} »)` : label
}

export interface QualityNoteOptions {
  t: Translate
  scope: QualityScope
  /** Un lien vers la note de l'exigence. */
  link: (requirement: Requirement) => string
  languages: string[]
  date: string
  /** Les paires proches par le sens, trouvées par le modèle d'embeddings (facultatif). */
  semantic?: SimilarPair[]
}

/** Le contenu de l'analyse, en Markdown (sans en-tête de note). */
export function qualityMarkdown(runs: readonly QualityRun[], options: QualityNoteOptions): string {
  const { t, link } = options
  if (runs.length === 0) return `*${t('exigences.quality.none')}*`
  const requirements = runs.map((run) => run.requirement)
  const mean = runs.reduce((sum, run) => sum + run.report.score, 0) / runs.length
  const weak = runs.filter((run) => isWeak(run.report))
  const out: string[] = []

  // Vue d'ensemble
  out.push(
    `## ${t('exigences.quality.overview')}`,
    '',
    t(options.scope === 'wording' ? 'exigences.quality.scope.wording' : 'exigences.quality.scope.record'),
    '',
    `| ${t('exigences.quality.measure')} | ${t('exigences.quality.value')} |`,
    '| --- | --- |',
    `| ${t('exigences.quality.count')} | ${runs.length} |`,
    `| ${t('exigences.quality.mean')} | ${stars(Math.round(mean * 5))} ${Math.round(mean * 100)} % |`,
    `| ${t('exigences.quality.weak')} | ${weak.length} |`,
    '',
    `### ${t('exigences.quality.distribution')}`,
    '',
    `| ${t('exigences.quality.rating')} | ${t('exigences.quality.requirements')} | |`,
    '| --- | --- | --- |'
  )
  for (let n = 5; n >= 0; n--) {
    const count = runs.filter((run) => run.report.stars === n).length
    out.push(`| ${stars(n)} | ${count} | ${'█'.repeat(Math.round((count / runs.length) * 20))} |`)
  }

  // Les axes de la norme
  out.push('', `### ${t('exigences.quality.axes')}`, '', `| ${t('exigences.quality.axis')} | ${t('exigences.quality.mean')} |`, '| --- | --- |')
  for (const axis of QUALITY_AXES) {
    const scores = runs.flatMap((run) => run.report.axes.filter((each) => each.id === axis).map((each) => each.score))
    if (scores.length === 0) continue
    out.push(`| ${t(`exigences.axis.${axis}`)} | ${Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)} % |`)
  }

  // Défauts les plus fréquents
  const byRule = new Map<QualityRule, QualityRun[]>()
  for (const run of runs) {
    for (const rule of new Set(run.report.findings.map((finding) => finding.rule))) byRule.set(rule, [...(byRule.get(rule) ?? []), run])
  }
  out.push('', `## ${t('exigences.quality.defects')}`, '')
  if (byRule.size === 0) out.push(`*${t('exigences.quality.noDefect')}*`)
  else {
    out.push(`| ${t('exigences.quality.defect')} | ${t('exigences.quality.requirements')} | ${t('exigences.quality.examples')} |`, '| --- | --- | --- |')
    for (const rule of [...QUALITY_RULES].sort((a, b) => (byRule.get(b)?.length ?? 0) - (byRule.get(a)?.length ?? 0))) {
      const list = byRule.get(rule)
      if (!list) continue
      const examples = list.slice(0, 3).map((run) => {
        const term = run.report.findings.find((finding) => finding.rule === rule)?.term
        const said = term && !t(`exigences.rule.${rule}`).toLowerCase().includes(term.toLowerCase())
        return `${link(run.requirement)}${said ? ` (« ${term} »)` : ''}`
      })
      out.push(`| ${t(`exigences.rule.${rule}`)} | ${list.length} | ${cell(examples.join(', '))}${list.length > 3 ? '…' : ''} |`)
    }
  }

  // Doublons probables
  const pairs = probableDuplicates(requirements, options.semantic)
  const byId = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  out.push('', `## ${t('exigences.quality.duplicates')}`, '')
  if (pairs.length === 0) out.push(`*${t('exigences.quality.noDuplicate')}*`)
  else {
    out.push(`| ${t('exigences.quality.first')} | ${t('exigences.quality.second')} | ${t('exigences.quality.likeness')} |`, '| --- | --- | --- |')
    for (const pair of pairs) {
      const a = byId.get(pair.a)
      const b = byId.get(pair.b)
      if (!a || !b) continue
      out.push(`| ${cell(`${link(a)} — ${excerpt(wordingOf(a), 80)}`)} | ${cell(`${link(b)} — ${excerpt(wordingOf(b), 80)}`)} | ${Math.round(pair.score * 100)} %${pair.semantic !== undefined && pair.semantic >= pair.lexical ? ` (${t('exigences.quality.bySense')})` : ''} |`)
    }
  }

  // Non vérifiables
  const unverifiable = runs.filter((run) => (run.report.axes.find((axis) => axis.id === 'verifiable')?.score ?? 1) < 1)
  out.push('', `## ${t('exigences.quality.unverifiable')}`, '')
  if (unverifiable.length === 0) out.push(`*${t('exigences.quality.allVerifiable')}*`)
  else {
    out.push(`| ${t('exigences.quality.requirement')} | ${t('exigences.quality.why')} | ${t('exigences.quality.wording')} |`, '| --- | --- | --- |')
    for (const run of unverifiable) {
      const misses = run.report.axes.find((axis) => axis.id === 'verifiable')?.misses ?? []
      out.push(`| ${cell(link(run.requirement))} | ${misses.map((miss) => t(`exigences.miss.${miss}`)).join(', ')} | ${cell(excerpt(wordingOf(run.requirement)))} |`)
    }
  }

  // Les plus faibles
  out.push('', `## ${t('exigences.quality.weakest')}`, '')
  if (weak.length === 0) out.push(`*${t('exigences.quality.noWeak')}*`)
  else {
    out.push(`| ${t('exigences.quality.requirement')} | ${t('exigences.quality.rating')} | ${t('exigences.quality.findings')} | ${t('exigences.quality.wording')} |`, '| --- | --- | --- | --- |')
    for (const run of [...weak].sort((a, b) => a.report.score - b.report.score)) {
      out.push(
        `| ${cell(link(run.requirement))} | ${stars(run.report.stars)} | ${cell(run.report.findings.map((finding) => describeFinding(finding, t)).join(', ') || '—')} | ${cell(excerpt(wordingOf(run.requirement)))} |`
      )
    }
  }

  // Rattachements (bibliothèque seulement)
  if (options.scope === 'record') {
    const gaps = countGaps(coverageOf({ library: requirements, usage: new Map(), languages: options.languages }))
    out.push('', `## ${t('exigences.quality.gaps')}`, '', `| ${t('exigences.quality.gap')} | ${t('exigences.quality.requirements')} |`, '| --- | --- |')
    // « Citée nulle part » demande de lire tous les documents : ce sera l'étape 7.
    for (const gap of COVERAGE_GAPS.filter((each) => each !== 'uncited')) out.push(`| ${t(`exigences.gap.${gap}`)} | ${gaps[gap]} |`)
  }

  // Toutes
  out.push('', `## ${t('exigences.quality.all')}`, '', `| ${t('exigences.quality.requirement')} | ${t('exigences.quality.rating')} | ${t('exigences.quality.findings')} |`, '| --- | --- | --- |')
  for (const run of runs) {
    out.push(
      `| ${cell(link(run.requirement))} | ${stars(run.report.stars)} ${Math.round(run.report.score * 100)} % | ${cell(run.report.findings.map((finding) => describeFinding(finding, t)).join(', ') || '—')} |`
    )
  }
  return out.join('\n')
}

export const QUALITY_START = '<!-- bp:qualite:debut — tenu à jour par Black Projects ; ne pas modifier entre ces marques -->'
export const QUALITY_END = '<!-- bp:qualite:fin -->'

/** La note d'analyse : remplace la partie tenue à jour, garde ce que l'utilisateur a écrit autour. */
export function withQuality(note: string | null, title: string, intro: string, content: string, notesHeading: string): string {
  const block = `${QUALITY_START}\n${content}\n${QUALITY_END}`
  if (note) {
    const from = note.indexOf(QUALITY_START)
    const to = note.indexOf(QUALITY_END)
    if (from !== -1 && to > from) return note.slice(0, from) + block + note.slice(to + QUALITY_END.length)
  }
  return [`---\nbp-type: qualite-exigences\n---`, `# ${title}`, '', intro, '', block, '', `## ${notesHeading}`, '', ''].join('\n')
}
