// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que l'analyse d'appels d'offres montre sur l'accueil : les actions rapides, et une
 * carte par analyse — sa date limite de remise (relevée dans les pièces, jours restants),
 * ses pièces, ses exigences et leur note, et ce qui reste à faire. Décrit en données
 * (`src/core/views.ts`) : l'interface dessine.
 */

import { parseFrontmatter } from '../../core/frontmatter'
import type { Notifier, Ui } from '../../core/ports'
import type { Card, HomeSectionView, TileBadge, ViewAction, ViewsRegistrar } from '../../core/views'
import { assessAll, requirementLanguages, requirementsAt } from '../exigences'
import { aiClient } from '../ia'
import { calendarOf, calendarPath, writeCalendar } from './calendar'
import { pieceSources } from './ask/sources'
import type { Analysis } from './notes'
import { requirementsFolder } from './requirements'
import { analysisPosition, listAnalyses, listPieces, type Services, type Translate } from './service'

export interface HomeDeps {
  services(): Services
  t: Translate
  ui: Ui
  notifier: Notifier
  /** Lance une commande de l'AO (nouvelle analyse, importer…). */
  run(id: string): Promise<void>
  importInto(analysis: Analysis): Promise<void>
  ask(analysis: Analysis): Promise<void>
  today(): string
}

const decimal = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/** La carte d'une analyse. */
async function analysisCard(deps: HomeDeps, analysis: Analysis, ai: boolean): Promise<{ card: Card; due: string }> {
  const { t } = deps
  const services = deps.services()
  const { data } = parseFrontmatter(await services.fs.readText(analysis.note))
  const position = await analysisPosition(services.fs, analysis)
  const pieces = await listPieces(services, analysis)
  const unread = pieces.filter((piece) => piece.state !== 'lue').length
  const requirements = await requirementsAt(requirementsFolder(analysis)).all()
  const runs = assessAll(requirements, requirementLanguages(), 'wording')
  const mean = runs.length ? runs.reduce((sum, run) => sum + run.report.score, 0) / runs.length : null
  const weak = runs.filter((run) => run.report.stars < 3).length

  // La date limite de remise : la prochaine relevée dans les pièces de l'appel d'offres, sinon la dernière.
  const calendar = calendarOf(await pieceSources(services, analysis, 'appel-d-offres'), Number(deps.today().slice(0, 4)))
  const remises = calendar.dates.filter((date) => date.kind === 'remise').map((date) => date.date)
  const due = remises.find((date) => date >= deps.today()) ?? remises.at(-1) ?? ''

  const buyer = typeof data.acheteur === 'string' ? data.acheteur.trim() : ''
  const badges: Card['badges'] = [{ label: t(`ao.home.position.${position}`), tone: 'info' }]
  if (unread) badges.push({ label: t('ao.home.unread', { count: unread }), tone: 'warning' })
  if (pieces.length && !requirements.length) badges.push({ label: t('ao.home.noRequirement'), tone: 'neutral' })
  if (weak) badges.push({ label: t('ao.home.weak', { count: weak }), tone: 'warning' })
  if (!pieces.length) badges.push({ label: t('ao.home.noPiece'), tone: 'neutral' })

  const actions: ViewAction[] = [
    { id: 'import', label: t('ao.home.import'), icon: 'upload', run: () => deps.importInto(analysis) },
    {
      id: 'calendar',
      label: t('ao.home.calendar'),
      icon: 'calendar',
      run: async () => {
        const found = await writeCalendar(deps.services(), analysis)
        deps.notifier.notify(t('ao.calendar.done', { dates: found.dates.length, delays: found.delays.length, pieces: found.read }), 6000)
        await deps.ui.openNote(calendarPath(analysis))
      }
    },
    ...(ai ? [{ id: 'ask', label: t('ao.home.ask'), icon: 'chat' as const, run: () => deps.ask(analysis) }] : [])
  ]
  return {
    due,
    card: {
      id: analysis.note,
      title: analysis.name,
      subtitle: [buyer, typeof data.reference === 'string' && data.reference.trim() ? data.reference.trim() : ''].filter(Boolean).join(' · ') || undefined,
      icon: 'folder',
      badges,
      ...(due ? { deadline: { date: due, label: t('ao.calendar.kind.remise') } } : {}),
      facts: [
        { label: t('ao.home.pieces'), value: unread ? t('ao.home.piecesRead', { count: pieces.length, read: pieces.length - unread }) : String(pieces.length) },
        { label: t('ao.home.requirements'), value: String(requirements.length) },
        { label: t('ao.home.quality'), value: mean === null ? '—' : `${decimal(mean * 100)} %` }
      ],
      ...(mean !== null ? { rating: { stars: mean * 5, label: t('ao.home.rating') } } : {}),
      open: { id: 'open', label: t('ao.home.open'), tooltip: t('ao.home.open.tip'), run: () => deps.ui.openNote(analysis.note) },
      actions
    }
  }
}

export async function analysesSection(deps: HomeDeps): Promise<HomeSectionView> {
  const { t } = deps
  const ai = aiClient() !== null
  const analyses = await listAnalyses(deps.services())
  const cards = await Promise.all(analyses.map((analysis) => analysisCard(deps, analysis, ai)))
  // Les échéances à venir d'abord, la plus proche en tête ; puis les autres, par nom.
  const today = deps.today()
  cards.sort((a, b) => {
    const rank = (due: string) => (due && due >= today ? 0 : 1)
    return rank(a.due) - rank(b.due) || (a.due && b.due ? a.due.localeCompare(b.due) : 0) || a.card.title.localeCompare(b.card.title)
  })
  const quick: ViewAction[] = [
    { id: 'new', label: t('ao.command.create'), icon: 'plus', primary: true, run: () => deps.run('nouvelle-analyse') },
    { id: 'import', label: t('ao.home.import'), icon: 'upload', run: () => deps.run('importer') },
    { id: 'calendar', label: t('ao.command.calendar'), icon: 'calendar', run: () => deps.run('calendrier') },
    ...(ai
      ? [
          { id: 'ask', label: t('ao.command.ask'), icon: 'chat' as const, run: () => deps.run('interroger') },
          { id: 'questionnaire', label: t('ao.command.questionnaire'), icon: 'list' as const, run: () => deps.run('questionnaire') }
        ]
      : [])
  ]
  return {
    title: t('ao.home.title'),
    subtitle: t('ao.home.subtitle', { count: analyses.length }),
    icon: 'folder',
    blocks: [
      { kind: 'actions', actions: quick },
      analyses.length
        ? { kind: 'cards', cards: cards.map((each) => each.card) }
        : { kind: 'message', tone: 'info', text: t('ao.home.empty', { folder: deps.services().root }) }
    ]
  }
}

/** La prochaine date limite de remise, toutes analyses confondues : « J-5 » sur la tuile. */
async function nextDeadline(deps: HomeDeps): Promise<TileBadge | null> {
  const today = deps.today()
  let best: { due: string; name: string } | null = null
  for (const analysis of await listAnalyses(deps.services())) {
    const calendar = calendarOf(await pieceSources(deps.services(), analysis, 'appel-d-offres'), Number(today.slice(0, 4)))
    const due = calendar.dates.filter((date) => date.kind === 'remise' && date.date >= today).map((date) => date.date)[0]
    if (due && (!best || due < best.due)) best = { due, name: analysis.name }
  }
  if (!best) return null
  const days = Math.round((Date.parse(`${best.due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  return {
    text: `J-${days}`,
    tone: days <= 7 ? 'danger' : days <= 21 ? 'warning' : 'info',
    label: deps.t('ao.tile.next', { name: best.name, date: best.due, days })
  }
}

export function registerAoHome(views: ViewsRegistrar | undefined, deps: HomeDeps): void {
  if (!views) return
  const { t } = deps
  const group = t('ao.name')
  const ai = () => aiClient() !== null
  const tile = (id: string, label: string, icon: Parameters<ViewsRegistrar['tile']>[0]['icon'], color: Parameters<ViewsRegistrar['tile']>[0]['color'], order: number, byDefault: boolean, command: string, description: string) =>
    views.tile({ id, label, icon, color, group, order, byDefault, description, run: () => deps.run(command) })
  tile('ao.nouvelle', t('ao.tile.new'), 'plus', 'indigo', 10, true, 'nouvelle-analyse', t('ao.tile.new.desc'))
  views.tile({
    id: 'ao.analyses',
    label: t('ao.home.nav'),
    icon: 'folder',
    color: 'blue',
    group,
    order: 11,
    byDefault: true,
    description: t('ao.tile.analyses.desc'),
    run: () => openAnalysis(deps),
    badge: () => nextDeadline(deps)
  })
  tile('ao.importer', t('ao.home.import'), 'upload', 'teal', 12, true, 'importer', t('ao.tile.import.desc'))
  tile('ao.calendrier', t('ao.home.calendar'), 'calendar', 'orange', 13, true, 'calendrier', t('ao.tile.calendar.desc'))
  views.tile({ id: 'ao.interroger', label: t('ao.tile.ask'), icon: 'chat', color: 'violet', group, order: 14, byDefault: true, description: t('ao.tile.ask.desc'), run: () => deps.run('interroger'), badge: async () => (ai() ? null : { text: '!', tone: 'warning', label: t('ia.unavailable') }) })
  tile('ao.questionnaire', t('ao.tile.questionnaire'), 'list', 'violet', 15, false, 'questionnaire', t('ao.tile.questionnaire.desc'))
  tile('ao.verifier', t('ao.tile.verify'), 'check', 'green', 16, false, 'verifier-exigences', t('ao.tile.verify.desc'))
  tile('ao.qualite', t('ao.tile.quality'), 'star', 'green', 17, false, 'qualite-exigences', t('ao.tile.quality.desc'))
  tile('ao.relire', t('ao.tile.review'), 'spark', 'violet', 18, false, 'relire-exigences-ia', t('ao.tile.review.desc'))
  views.home({ id: 'ao.analyses', title: t('ao.home.title'), icon: 'folder', order: 10, area: 'main', load: () => analysesSection(deps) })
  views.nav({ id: 'ao.analyses', label: t('ao.home.nav'), icon: 'folder', order: 10, run: () => openAnalysis(deps) })
}

/** Choisir une analyse et ouvrir sa note ; sans analyse, en créer une. */
async function openAnalysis(deps: HomeDeps): Promise<void> {
  const analyses = await listAnalyses(deps.services())
  if (!analyses.length) {
    await deps.run('nouvelle-analyse')
    return
  }
  const chosen = await deps.ui.pickOption(
    analyses.map((analysis) => ({ value: analysis.note, label: analysis.name, description: analysis.folder })),
    deps.t('ao.pick.analysis')
  )
  if (chosen) await deps.ui.openNote(chosen)
}
