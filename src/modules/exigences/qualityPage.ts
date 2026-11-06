// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **qualité de la bibliothèque**, en page : calculée à l'ouverture (sur la rédaction et
 * la fiche, comme le rapport), sans rien écrire. Ses chiffres ; une carte par exigence, les
 * plus faibles d'abord — ses étoiles, sa formulation, ce qui lui coûte —, un clic ouvre sa
 * fiche ; puis les défauts les plus fréquents, les doublons probables, chaque axe de la
 * norme, la répartition des notes, les rattachements. En tête : écrire (ou mettre à jour) le
 * rapport sans quitter la page, l'ouvrir, la bibliothèque.
 */

import { localToday } from '../../core/dates'
import type { Card, ListItem, PageView, Tone, ViewAction } from '../../core/views'
import { lastReview } from './ai/actions'
import type { Session } from './flows'
import { COVERAGE_GAPS, coverageOf } from './quality/library'
import { assessAll, describeFinding, probableDuplicates, type QualityRun } from './quality/report'
import { isWeak, QUALITY_AXES } from './quality/score'
import { libraryQualityPath, writeLibraryQuality } from './workflows'

/** La page de la qualité de la bibliothèque. */
export const QUALITY_PAGE = 'exigences.qualite'

const percent = (value: number) => `${Math.round(value * 100)} %`
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const toneOfScore = (value: number): Tone => (value >= 0.9 ? 'success' : value >= 0.6 ? 'warning' : 'danger')
const wordingOf = (run: QualityRun) => run.requirement.text[run.requirement.sourceLang]?.body ?? Object.values(run.requirement.text)[0]?.body ?? run.requirement.title ?? ''

export interface QualityPageDeps {
  session: Session
  showPage: (id: string) => void
  /** La page de la bibliothèque, la fiche d'une exigence. */
  library: string
  requirementPageOf: (path: string) => string
}

export async function libraryQualityPage(deps: QualityPageDeps): Promise<PageView> {
  const { session, showPage } = deps
  const { t } = session
  const settings = session.settings()
  const library = await session.store.all()
  const runs = assessAll(library, settings.languages, 'record').sort((a, b) => a.report.score - b.report.score || a.requirement.id.localeCompare(b.requirement.id, undefined, { numeric: true }))
  const reportPath = libraryQualityPath(session)
  // Une note absente peut se lire vide (selon la plateforme) : vide, c'est pas de rapport.
  const exists = ((await session.store.readNote(reportPath).catch(() => '')) ?? '').trim() !== ''
  const actions: ViewAction[] = [
    ...(runs.length
      ? [
          {
            id: 'report',
            label: t(exists ? 'exigences.qp.report.update' : 'exigences.qp.report.write'),
            tooltip: t('exigences.qp.report.tip'),
            icon: 'refresh' as const,
            // Écrit sans quitter la page : le message le dit, la page se redessine.
            run: async () => {
              const report = await writeLibraryQuality(session, localToday())
              session.notifier.notify(`${report.text} ${t('exigences.qp.report.written')}`, 8000)
            }
          }
        ]
      : []),
    ...(exists ? [{ id: 'note', label: t('exigences.qp.report.open'), icon: 'file' as const, run: () => session.ui.openNote(reportPath) }] : []),
    { id: 'library', label: t('exigences.page.all'), icon: 'list', run: () => showPage(deps.library) }
  ]
  const head = {
    back: { id: 'back', label: t('exigences.fiche.back'), run: () => showPage(deps.library) },
    subtitle: t('exigences.quality.scope.record'),
    actions
  }
  if (!runs.length) return { ...head, blocks: [{ kind: 'message', tone: 'info', text: t('exigences.quality.none') }] }

  const mean = runs.reduce((sum, each) => sum + each.report.score, 0) / runs.length
  const weak = runs.filter((each) => isWeak(each.report))
  const axisOf = (each: QualityRun, id: string) => each.report.axes.find((axis) => axis.id === id)
  const unverifiable = runs.filter((each) => (axisOf(each, 'verifiable')?.score ?? 1) < 1)
  const pairs = probableDuplicates(runs.map((each) => each.requirement))
  const doubled = new Set(pairs.flatMap((pair) => [pair.a, pair.b]))
  const byId = new Map(runs.map((each) => [each.requirement.id, each]))
  const fiche = (each: QualityRun): ViewAction | undefined =>
    each.requirement.filePath ? { id: 'open', label: t('exigences.fiche.open'), tooltip: t('exigences.fiche.open'), run: () => showPage(deps.requirementPageOf(each.requirement.filePath!)) } : undefined
  const named = (each: QualityRun) => (each.requirement.title ? `${each.requirement.id} — ${each.requirement.title}` : each.requirement.id)

  // Les notes données seulement : une ligne « 0 exigence » n'apprend rien.
  const distribution: ListItem[] = [5, 4, 3, 2, 1, 0].flatMap((count) => {
    const n = runs.filter((each) => each.report.stars === count).length
    return n ? [{ id: `stars-${count}`, title: '★'.repeat(count) + '☆'.repeat(5 - count), detail: t('exigences.qp.count', { count: n }), tone: (count >= 4 ? 'success' : count >= 3 ? 'info' : 'warning') as Tone }] : []
  })
  const axes: ListItem[] = QUALITY_AXES.flatMap((id) => {
    const scores = runs.flatMap((each) => axisOf(each, id)?.score ?? [])
    if (!scores.length) return []
    const value = scores.reduce((a, b) => a + b, 0) / scores.length
    const below = runs.filter((each) => (axisOf(each, id)?.score ?? 1) < 1).length
    return [{ id: `axe-${id}`, title: t(`exigences.axis.${id}`), detail: `${percent(value)}${below ? ` — ${t('exigences.qp.axis.below', { count: below })}` : ''}`, tone: toneOfScore(value) }]
  })
  const byRule = new Map<string, QualityRun[]>()
  for (const each of runs) for (const rule of new Set(each.report.findings.map((finding) => finding.rule))) byRule.set(rule, [...(byRule.get(rule) ?? []), each])
  const defects: ListItem[] = [...byRule]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([rule, list]) => {
      const open = list.length === 1 ? fiche(list[0]!) : undefined
      return { id: `defaut-${rule}`, title: capitalized(t(`exigences.rule.${rule}`)), detail: `${t('exigences.qp.count', { count: list.length })} — ${list.slice(0, 4).map((each) => each.requirement.id).join(', ')}${list.length > 4 ? '…' : ''}`, tone: 'warning' as const, ...(open ? { open } : {}) }
    })
  const duplicates: ListItem[] = pairs.flatMap((pair) => {
    const a = byId.get(pair.a)
    const b = byId.get(pair.b)
    if (!a || !b) return []
    const open = fiche(a)
    return [{ id: `doublon-${pair.a}-${pair.b}`, title: `${pair.a} ↔ ${pair.b}`, detail: `${t('exigences.quality.likeness')} ${percent(pair.score)} — « ${wordingOf(a).slice(0, 90)} » / « ${wordingOf(b).slice(0, 90)} »`, tone: 'warning' as const, ...(open ? { open } : {}) }]
  })
  // Les rattachements : « citée nulle part » demande de lire tous les documents (étape 7).
  const coverage = coverageOf({ library, usage: new Map(), languages: settings.languages })
  const gaps: ListItem[] = COVERAGE_GAPS.filter((gap) => gap !== 'uncited').map((gap) => {
    const ids = coverage.filter((row) => row.gaps.includes(gap)).map((row) => row.requirement.id)
    return { id: `rattachement-${gap}`, title: t(`exigences.gap.${gap}`), detail: ids.length ? `${t('exigences.qp.count', { count: ids.length })} — ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? '…' : ''}` : t('exigences.qp.count', { count: 0 }), tone: ids.length ? 'warning' : 'success' }
  })
  // Les relectures par l'IA, écrites dans les notes : pour marquer les exigences relues.
  const reviews = new Map(await Promise.all(runs.map(async (each): Promise<[string, ReturnType<typeof lastReview>]> => [each.requirement.id, each.requirement.filePath ? lastReview(await session.store.readNote(each.requirement.filePath).catch(() => '')) : null])))
  const cards: Card[] = runs.map((each) => {
    const { report } = each
    const reviewed = reviews.get(each.requirement.id)
    const costly = report.axes
      .filter((axis) => axis.score < 1)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
    const findings = report.findings.map((finding) => describeFinding(finding, t))
    const open = fiche(each)
    const tags = [...(isWeak(report) ? ['faibles'] : []), ...((axisOf(each, 'verifiable')?.score ?? 1) < 1 ? ['non-verifiables'] : []), ...(doubled.has(each.requirement.id) ? ['doublons'] : []), ...(report.stars >= 4 ? ['bonnes'] : []), ...(reviewed ? ['relues'] : [])]
    return {
      id: each.requirement.filePath ?? each.requirement.id,
      title: named(each),
      subtitle: findings.length ? capitalized(findings.slice(0, 3).join(' · ')) : t('exigences.qp.noFinding'),
      rating: { stars: report.stars, label: t('exigences.qp.rating', { percent: percent(report.score) }) },
      icon: 'star' as const,
      badges: [
        ...(isWeak(report) ? [{ label: t('exigences.qp.badge.weak'), tone: 'warning' as const }] : []),
        ...((axisOf(each, 'verifiable')?.score ?? 1) < 1 ? [{ label: t('exigences.qp.badge.unverifiable'), tone: 'danger' as const }] : []),
        ...(doubled.has(each.requirement.id) ? [{ label: t('exigences.qp.badge.duplicate'), tone: 'info' as const }] : []),
        ...(reviewed ? [{ label: reviewed.date ? t('exigences.qp.badge.reviewed.on', { date: reviewed.date }) : t('exigences.qp.badge.reviewed'), tone: 'success' as const }] : [])
      ],
      text: wordingOf(each),
      ...(costly.length ? { facts: costly.map((axis) => ({ label: t(`exigences.axis.${axis.id}`), value: percent(axis.score) })) } : {}),
      ...(open ? { open } : {}),
      tags
    }
  })
  return {
    ...head,
    search: { label: t('exigences.page.search'), placeholder: t('exigences.qp.search.placeholder') },
    filters: [
      { id: 'faibles', label: t('exigences.page.filter.weak') },
      { id: 'non-verifiables', label: t('exigences.qp.filter.unverifiable') },
      { id: 'doublons', label: t('exigences.quality.duplicates') },
      { id: 'bonnes', label: t('exigences.qp.filter.good') },
      { id: 'relues', label: t('exigences.qp.filter.reviewed') }
    ],
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('exigences.quality.count'), value: String(runs.length), icon: 'list' },
          { label: t('exigences.quality.mean'), value: percent(mean), icon: 'star', tone: toneOfScore(mean), hint: '★'.repeat(Math.round(mean * 5)) + '☆'.repeat(5 - Math.round(mean * 5)) },
          { label: t('exigences.home.weak'), value: String(weak.length), icon: 'alert', ...(weak.length ? { tone: 'warning' as const } : {}), hint: t('exigences.qp.weak.hint') },
          { label: t('exigences.qp.filter.unverifiable'), value: String(unverifiable.length), icon: 'check', ...(unverifiable.length ? { tone: 'danger' as const } : {}) },
          { label: t('exigences.quality.duplicates'), value: String(pairs.length), icon: 'columns', ...(pairs.length ? { tone: 'info' as const } : {}) }
        ]
      },
      { kind: 'message', tone: 'info', text: t(exists ? 'exigences.qp.computed' : 'exigences.qp.noReport') },
      // Les exigences d'abord, les plus faibles en tête : c'est ce qu'on vient reprendre.
      { kind: 'cards', title: t('exigences.qp.requirements', { count: runs.length }), cards },
      { kind: 'list', title: t('exigences.quality.defects'), items: defects, empty: t('exigences.quality.noDefect') },
      { kind: 'list', title: t('exigences.quality.duplicates'), items: duplicates, empty: t('exigences.quality.noDuplicate') },
      { kind: 'list', title: t('exigences.quality.axes'), items: axes },
      { kind: 'list', title: t('exigences.quality.distribution'), items: distribution },
      { kind: 'list', title: t('exigences.quality.gaps'), items: gaps }
    ]
  }
}
