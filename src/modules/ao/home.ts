// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que l'analyse d'appels d'offres montre dans l'interface : les actions rapides, et une
 * carte par analyse — sa date limite de remise (relevée dans les pièces, jours restants),
 * ses pièces, ses exigences et leur note, et ce qui reste à faire. Sur le tableau de bord
 * (une section) et sur la page **Analyses** (toutes les analyses, en chiffres, avec une
 * recherche et des filtres). Décrit en données (`src/core/views.ts`) : l'interface dessine.
 */

import { parseFrontmatter } from '../../core/frontmatter'
import type { Notifier, Ui } from '../../core/ports'
import { pageWith, type Card, type HomeBlock, type HomeSectionView, type IconName, type ListItem, type PageView, type Stat, type TileBadge, type Tone, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { typeLabel } from '../typage-pieces'
import { assessAll, describeFinding, isWeak, probableDuplicates, QUALITY_AXES, requirementLanguages, requirementPageOf, requirementsAt, type QualityRun } from '../exigences'
import { aiClient } from '../ia'
import { calendarOf, calendarPath, delayLabel, writeCalendar } from './calendar'
import { QUESTIONNAIRE, questionnairePath, questionsFolder, QUESTION_TYPE, QUESTIONNAIRE_TYPE, type QuestionKey } from './ask/dossier'
import { noteBlocks } from '../../core/markdown'
import { readQuestion, readQuestionnaire, type QuestionNote, type QuestionnaireItem, type QuestionSource } from './produced'
import { qualityPath } from './quality'
import { pieceSources, pieceText, type PieceSource } from './ask/sources'
import { destinationLabel, type Analysis, type PieceRow, type ReadingState } from './notes'
import { linkedNote, requirementsFolder } from './requirements'
import { analysisPosition, listAnalyses, listCandidates, listPieces, pieceAt, type Services, type Translate } from './service'
import { candidateCoverage, describeWhere, reportPath, verificationNow } from './verification'

export interface HomeDeps {
  services(): Services
  t: Translate
  ui: Ui
  notifier: Notifier
  /** Lance une commande de l'AO (nouvelle analyse, importer…). */
  run(id: string): Promise<void>
  importInto(analysis: Analysis): Promise<void>
  /** Interroger le dossier ; `preset` : la question (et son mode) déjà écrite, à reposer. */
  ask(analysis: Analysis, preset?: { question: string; mode: 'search' | 'each' }): Promise<void>
  today(): string
  /** Ouvre une page dans l'onglet de Black Projects, quand la plateforme en a un. */
  showPage?(id: string): void
  /**
   * Lance une commande de l'AO sur une analyse ou une pièce précise, sans demander laquelle.
   * `stay` : la note que la commande écrit ne s'ouvre pas — la page qui l'a lancée la montre.
   */
  runFor?(id: string, target: { analysis?: Analysis; note?: string; stay?: boolean; keys?: QuestionKey[] }): Promise<void>
}

/** La fiche d'une analyse : `pageWith(ANALYSIS_PAGE, …)`, le chemin de sa note en paramètre. */
export const ANALYSIS_PAGE = 'ao.fiche'

/** La page de la fiche d'une analyse. */
export const analysisPageOf = (analysis: Analysis): string => pageWith(ANALYSIS_PAGE, encodeURIComponent(analysis.note))

/** La fiche d'un candidat (émetteur) : `candidatePageOf(analyse, nom)`. */
export const CANDIDATE_PAGE = 'ao.candidat'
export const candidatePageOf = (analysis: Analysis, candidate: string): string => pageWith(CANDIDATE_PAGE, `${encodeURIComponent(analysis.note)}&${encodeURIComponent(candidate)}`)

/** La fiche d'une pièce : `piecePageOf(chemin de sa note)`. */
export const PIECE_PAGE = 'ao.piece'
export const piecePageOf = (note: string): string => pageWith(PIECE_PAGE, encodeURIComponent(note))

/** La page d'une note produite par l'analyse (calendrier, vérification, questionnaire…) : `producedPageOf(chemin)`. */
export const PRODUCED_PAGE = 'ao.note'
export const producedPageOf = (note: string): string => pageWith(PRODUCED_PAGE, encodeURIComponent(note))

/** La page d'une question au dossier : `questionPageOf(chemin de sa note)`. */
export const QUESTION_PAGE = 'ao.question'
export const questionPageOf = (note: string): string => pageWith(QUESTION_PAGE, encodeURIComponent(note))

/** La page du questionnaire d'une analyse : `questionnairePageOf(chemin de sa note)`. */
export const QUESTIONNAIRE_PAGE = 'ao.questionnaire'
export const questionnairePageOf = (note: string): string => pageWith(QUESTIONNAIRE_PAGE, encodeURIComponent(note))
/** La page d'un thème du questionnaire : `questionnaireItemPageOf(chemin, thème)`. */
export const QUESTIONNAIRE_ITEM_PAGE = 'ao.questionnaire.theme'
export const questionnaireItemPageOf = (note: string, key: string): string => pageWith(QUESTIONNAIRE_ITEM_PAGE, `${encodeURIComponent(note)}&${encodeURIComponent(key)}`)

/** La page de la qualité des exigences d'une analyse : `qualityPageOf(chemin de son rapport)`. */
export const QUALITY_PAGE = 'ao.qualite'
export const qualityPageOf = (note: string): string => pageWith(QUALITY_PAGE, encodeURIComponent(note))

/** La page de la vérification des exigences d'une analyse : `verificationPageOf(chemin de son rapport)`. */
export const VERIFICATION_PAGE = 'ao.verification'
export const verificationPageOf = (note: string): string => pageWith(VERIFICATION_PAGE, encodeURIComponent(note))

/** La page du calendrier d'une analyse : `calendarPageOf(chemin de sa note)`. */
export const CALENDAR_PAGE = 'ao.calendrier'
export const calendarPageOf = (note: string): string => pageWith(CALENDAR_PAGE, encodeURIComponent(note))

/** La page des analyses. */
export const ANALYSES_PAGE = 'ao.analyses'

/** Ce qu'on compte d'une analyse, pour les chiffres de la page. */
interface Counted {
  card: Card
  due: string
  unread: number
  weak: number
}

const decimal = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/** La carte d'une analyse. */
async function analysisCard(deps: HomeDeps, analysis: Analysis, ai: boolean): Promise<Counted> {
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
      // Avec des pages : celle du calendrier, relevé à l'ouverture ; sinon la note, écrite puis ouverte.
      run: async () => {
        if (deps.showPage) return deps.showPage(calendarPageOf(calendarPath(analysis)))
        const found = await writeCalendar(deps.services(), analysis)
        deps.notifier.notify(t('ao.calendar.done', { dates: found.dates.length, delays: found.delays.length, pieces: found.read }), 6000)
        await deps.ui.openNote(calendarPath(analysis))
      }
    },
    ...(ai ? [{ id: 'ask', label: t('ao.home.ask'), icon: 'chat' as const, run: () => deps.ask(analysis) }] : [])
  ]
  // Les filtres de la page auxquels l'analyse répond.
  const days = due ? Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${deps.today()}T00:00:00Z`)) / 86_400_000) : null
  const tags = [position, ...(days !== null && days >= 0 ? ['a-venir'] : []), ...(days !== null && days >= 0 && days <= 30 ? ['sous-30-jours'] : []), ...(unread ? ['a-lire'] : []), ...(weak ? ['faibles'] : [])]
  return {
    due,
    unread,
    weak,
    card: {
      tags,
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
      // Avec des pages, un clic sur l'analyse ouvre sa fiche ; sinon, sa note.
      open: deps.showPage
        ? { id: 'open', label: t('ao.fiche.open'), tooltip: t('ao.fiche.open.tip'), run: () => deps.showPage?.(analysisPageOf(analysis)) }
        : { id: 'open', label: t('ao.home.open'), tooltip: t('ao.home.open.tip'), run: () => deps.ui.openNote(analysis.note) },
      actions
    }
  }
}

/** Toutes les analyses, en cartes : les échéances à venir d'abord, la plus proche en tête ; puis les autres, par nom. */
async function allCards(deps: HomeDeps, ai: boolean): Promise<Counted[]> {
  const analyses = await listAnalyses(deps.services())
  const cards = await Promise.all(analyses.map((analysis) => analysisCard(deps, analysis, ai)))
  const today = deps.today()
  return cards.sort((a, b) => {
    const rank = (due: string) => (due && due >= today ? 0 : 1)
    return rank(a.due) - rank(b.due) || (a.due && b.due ? a.due.localeCompare(b.due) : 0) || a.card.title.localeCompare(b.card.title)
  })
}

/** Sur quelle analyse ? La seule s'il n'y en a qu'une, sinon celle que l'utilisateur choisit ; aucune : le message. */
async function chooseAnalysisFor(deps: HomeDeps): Promise<Analysis | null> {
  const analyses = await listAnalyses(deps.services())
  if (!analyses.length) {
    deps.notifier.notify(deps.t('ao.none', { folder: deps.services().root }), 8000)
    return null
  }
  if (analyses.length === 1) return analyses[0]!
  const chosen = await deps.ui.pickOption(
    analyses.map((analysis) => ({ value: analysis.note, label: analysis.name, description: analysis.folder })),
    deps.t('ao.pick.analysis')
  )
  return analyses.find((analysis) => analysis.note === chosen) ?? null
}

/**
 * Les raccourcis (tableau de bord, tuiles) qui ont une page : celle de l'analyse choisie —
 * le calendrier, la vérification, la qualité, le questionnaire —, ou « Interroger » qui
 * ouvre la réponse sur sa page. Sans pages chez la plateforme : la commande, comme avant.
 */
function shortcut(deps: HomeDeps, command: string): () => Promise<void> {
  const pageOf: Record<string, (analysis: Analysis) => string> = {
    calendrier: (analysis) => calendarPageOf(calendarPath(analysis)),
    'verifier-exigences': (analysis) => verificationPageOf(reportPath(analysis)),
    'qualite-exigences': (analysis) => qualityPageOf(qualityPath(analysis)),
    questionnaire: (analysis) => questionnairePageOf(questionnairePath(analysis))
  }
  return async () => {
    const page = pageOf[command]
    // Créer une analyse : sa fiche ensuite, et l'import qui suit y revient.
    if (deps.showPage && deps.runFor && command === 'nouvelle-analyse') return deps.runFor(command, { stay: true })
    if (deps.showPage && command === 'importer') {
      const analysis = await chooseAnalysisFor(deps)
      if (analysis) await deps.importInto(analysis)
      return
    }
    if (!deps.showPage || (!page && command !== 'interroger')) return deps.run(command)
    const analysis = await chooseAnalysisFor(deps)
    if (!analysis) return
    if (page) deps.showPage(page(analysis))
    else await deps.ask(analysis)
  }
}

/** Les actions rapides de l'analyse d'appels d'offres. */
function quickActions(deps: HomeDeps, ai: boolean): ViewAction[] {
  const { t } = deps
  return [
    { id: 'new', label: t('ao.command.create'), icon: 'plus', primary: true, run: shortcut(deps, 'nouvelle-analyse') },
    { id: 'import', label: t('ao.home.import'), icon: 'upload', run: shortcut(deps, 'importer') },
    { id: 'calendar', label: t('ao.command.calendar'), icon: 'calendar', run: shortcut(deps, 'calendrier') },
    ...(ai
      ? [
          { id: 'ask', label: t('ao.command.ask'), icon: 'chat' as const, run: shortcut(deps, 'interroger') },
          { id: 'questionnaire', label: t('ao.command.questionnaire'), icon: 'list' as const, run: shortcut(deps, 'questionnaire') }
        ]
      : [])
  ]
}

export async function analysesSection(deps: HomeDeps): Promise<HomeSectionView> {
  const { t } = deps
  const ai = aiClient() !== null
  const cards = await allCards(deps, ai)
  return {
    title: t('ao.home.title'),
    subtitle: t('ao.home.subtitle', { count: cards.length }),
    icon: 'folder',
    blocks: [
      { kind: 'actions', actions: quickActions(deps, ai) },
      cards.length
        ? { kind: 'cards', cards: cards.map((each) => each.card) }
        : { kind: 'message', tone: 'info', text: t('ao.home.empty', { folder: deps.services().root }) }
    ],
    // Sur le tableau de bord : un lien vers la page de toutes les analyses.
    ...(deps.showPage ? { actions: [{ id: 'all', label: t('ao.page.all'), icon: 'chevron' as const, run: () => deps.showPage?.(ANALYSES_PAGE) }] } : {})
  }
}

/**
 * La page **Analyses** : toutes les analyses en chiffres (combien, remises à venir, pièces
 * à lire, exigences faibles), les actions rapides, et une carte par analyse — avec une
 * recherche (nom, acheteur, référence…) et des filtres (position, remise à venir…).
 */
export async function analysesPage(deps: HomeDeps): Promise<PageView> {
  const { t } = deps
  const ai = aiClient() !== null
  const cards = await allCards(deps, ai)
  const soon = cards.filter((each) => each.card.tags?.includes('sous-30-jours')).length
  const unread = cards.reduce((sum, each) => sum + each.unread, 0)
  const weak = cards.reduce((sum, each) => sum + each.weak, 0)
  return {
    subtitle: t('ao.page.subtitle', { folder: deps.services().root }),
    actions: quickActions(deps, ai),
    search: { label: t('ao.page.search'), placeholder: t('ao.page.search.placeholder') },
    filters: [
      { id: 'a-venir', label: t('ao.page.filter.upcoming') },
      { id: 'sous-30-jours', label: t('ao.page.filter.soon') },
      { id: 'a-lire', label: t('ao.page.filter.unread') },
      { id: 'faibles', label: t('ao.page.filter.weak') },
      { id: 'candidat', label: t('ao.home.position.candidat') },
      { id: 'emetteur', label: t('ao.home.position.emetteur') }
    ],
    blocks: cards.length
      ? [
          {
            kind: 'stats',
            stats: [
              { label: t('ao.page.stat.count'), value: String(cards.length), icon: 'folder' },
              { label: t('ao.page.stat.soon'), value: String(soon), icon: 'clock', tone: soon ? 'warning' : 'success', hint: t('ao.page.stat.soon.hint') },
              { label: t('ao.page.stat.unread'), value: String(unread), icon: 'file', tone: unread ? 'warning' : 'success' },
              { label: t('ao.page.stat.weak'), value: String(weak), icon: 'star', tone: weak ? 'warning' : 'success', hint: t('ao.page.stat.weak.hint') }
            ]
          },
          { kind: 'cards', cards: cards.map((each) => each.card) }
        ]
      : [{ kind: 'message', tone: 'info', text: t('ao.home.empty', { folder: deps.services().root }) }]
  }
}

const STATE_TONE: Record<ReadingState, Tone> = { lue: 'success', 'sans-texte': 'warning', image: 'info', 'non-lue': 'warning', illisible: 'danger' }
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const daysUntil = (date: string, today: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)

/** La carte d'une pièce de la fiche. */
function pieceCard(deps: HomeDeps, piece: PieceRow): Card {
  const { t } = deps
  const run = (id: string) => () => deps.runFor?.(id, { note: piece.note }) ?? Promise.resolve()
  return {
    id: piece.note,
    title: baseName(piece.original || piece.note),
    subtitle: `${piece.type} — ${typeLabel(piece.type, t)}`,
    icon: 'file',
    badges: [{ label: t(`ao.state.${piece.state}`), tone: STATE_TONE[piece.state] }],
    ...(piece.characters ? { facts: [{ label: t('ao.fiche.characters'), value: piece.characters.toLocaleString('fr-FR') }] } : {}),
    // Sa fiche, quand la plateforme a des pages ; sinon sa note.
    open: deps.showPage
      ? { id: 'open', label: t('ao.piece.fiche.open'), tooltip: t('ao.piece.fiche.open'), run: () => deps.showPage?.(piecePageOf(piece.note)) }
      : { id: 'open', label: t('ao.fiche.piece.open'), tooltip: t('ao.fiche.piece.open'), run: () => deps.ui.openNote(piece.note) },
    actions: deps.runFor
      ? [
          { id: 'type', label: t('ao.fiche.piece.type'), icon: 'edit', run: run('type-piece') },
          { id: 'move', label: t('ao.fiche.piece.move'), icon: 'flow', run: run('deplacer-piece') },
          ...(piece.state === 'lue' ? [{ id: 'extract', label: t('ao.fiche.piece.extract'), icon: 'list' as const, run: run('extraire-exigences') }] : [])
        ]
      : [],
    tags: [piece.state === 'lue' ? 'lues' : 'a-lire', piece.destination.place === 'appel-d-offres' ? 'appel-d-offres' : 'reponse']
  }
}

/**
 * La **fiche** d'une analyse, en page : en tête, ce qu'on fait sur elle (importer, mettre à
 * jour, calendrier, vérifier, qualité, et avec l'IA interroger, questionnaire, relire) ;
 * ses chiffres (date limite de remise, pièces, exigences, qualité) ; ses pièces par
 * destination, chacune avec ses boutons (type, déplacer, extraire) ; son calendrier ; ses
 * exigences, les plus faibles d'abord ; les notes qu'elle a produites. Plus de « Dans
 * quelle analyse ? » : chaque bouton agit sur celle-ci.
 */
export async function analysisPage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const services = deps.services()
  const back: ViewAction = { id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) }
  const note = param ? decodeURIComponent(param) : ''
  const analysis = (await listAnalyses(services)).find((each) => each.note === note)
  if (!analysis) return { title: t('ao.fiche.missing.title'), back, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.fiche.missing') }] }

  const ai = aiClient() !== null
  const { data } = parseFrontmatter(await services.fs.readText(analysis.note))
  const position = await analysisPosition(services.fs, analysis)
  const pieces = await listPieces(services, analysis)
  const unread = pieces.filter((piece) => piece.state !== 'lue').length
  const requirements = await requirementsAt(requirementsFolder(analysis)).all()
  const runs = assessAll(requirements, requirementLanguages(), 'wording')
  const mean = runs.length ? runs.reduce((sum, each) => sum + each.report.score, 0) / runs.length : null
  const today = deps.today()
  const calendar = calendarOf(await pieceSources(services, analysis, 'appel-d-offres'), Number(today.slice(0, 4)))
  const remises = calendar.dates.filter((date) => date.kind === 'remise').map((date) => date.date)
  const due = remises.find((date) => date >= today) ?? remises.at(-1) ?? ''
  const days = due ? daysUntil(due, today) : null

  const run = (id: string) => () => deps.runFor?.(id, { analysis }) ?? Promise.resolve()
  const actions: ViewAction[] = deps.runFor
    ? [
        { id: 'import', label: t('ao.home.import'), icon: 'upload', primary: pieces.length === 0, run: () => deps.importInto(analysis) },
        // Les fichiers déposés dans les originaux : lus et rangés, la fiche se redessine (sa note ne s'ouvre pas).
        { id: 'update', label: t('ao.fiche.update'), icon: 'refresh', run: () => deps.runFor?.('mettre-a-jour', { analysis, stay: true }) ?? Promise.resolve() },
        // Le calendrier a sa page : relevé à l'ouverture, la note s'écrit de là.
        { id: 'calendar', label: t('ao.home.calendar'), icon: 'calendar', run: deps.showPage ? () => deps.showPage?.(calendarPageOf(calendarPath(analysis))) : run('calendrier') },
        // La vérification a sa page : calculée à l'ouverture, le rapport s'écrit de là.
        { id: 'verify', label: t('ao.tile.verify'), icon: 'check', run: deps.showPage ? () => deps.showPage?.(verificationPageOf(reportPath(analysis))) : run('verifier-exigences') },
        // La qualité a sa page : calculée à l'ouverture, le rapport s'écrit de là.
        { id: 'quality', label: t('ao.tile.quality'), icon: 'star', run: deps.showPage ? () => deps.showPage?.(qualityPageOf(qualityPath(analysis))) : run('qualite-exigences') },
        ...(ai
          ? [
              { id: 'ask', label: t('ao.home.ask'), icon: 'chat' as const, run: () => deps.ask(analysis) },
              // Le questionnaire a sa page : on y remplit les thèmes, on y lit les réponses.
              { id: 'questionnaire', label: t('ao.tile.questionnaire'), icon: 'list' as const, run: deps.showPage ? () => deps.showPage?.(questionnairePageOf(questionnairePath(analysis))) : run('questionnaire') },
              { id: 'review', label: t('ao.tile.review'), icon: 'spark' as const, run: run('relire-exigences-ia') }
            ]
          : []),
        { id: 'note', label: t('ao.home.open.tip'), icon: 'file', run: () => deps.ui.openNote(analysis.note) }
      ]
    : [{ id: 'note', label: t('ao.home.open.tip'), icon: 'file', run: () => deps.ui.openNote(analysis.note) }]

  const stats: Stat[] = [
    days === null
      ? { label: t('ao.calendar.kind.remise'), value: '—', icon: 'clock', hint: t('ao.fiche.noDeadline') }
      : {
          label: t('ao.calendar.kind.remise'),
          value: days >= 0 ? `J-${days}` : t('ao.fiche.past'),
          icon: days >= 0 && days <= 7 ? 'alert' : 'clock',
          tone: days < 0 ? 'neutral' : days <= 7 ? 'danger' : days <= 21 ? 'warning' : 'success',
          hint: new Date(`${due}T12:00:00`).toLocaleDateString(t('ao.fiche.locale'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        },
    { label: t('ao.home.pieces'), value: unread ? t('ao.home.piecesRead', { count: pieces.length, read: pieces.length - unread }) : String(pieces.length), icon: 'file', ...(unread ? { tone: 'warning' as const } : {}) },
    { label: t('ao.home.requirements'), value: String(requirements.length), icon: 'list' },
    { label: t('ao.home.quality'), value: mean === null ? '—' : `${decimal(mean * 100)} %`, icon: 'star', ...(mean === null ? {} : { hint: '★'.repeat(Math.round(mean * 5)) + '☆'.repeat(5 - Math.round(mean * 5)) }) }
  ]

  // Les pièces, par destination : l'appel d'offres, puis la réponse (ou chaque candidat).
  const groups = new Map<string, PieceRow[]>()
  for (const piece of pieces) {
    const label = destinationLabel(piece.destination, t)
    groups.set(label, [...(groups.get(label) ?? []), piece])
  }
  const pieceBlocks: HomeBlock[] = groups.size
    ? [...groups].map(([label, list]) => ({ kind: 'cards', title: t('ao.fiche.pieces', { place: label, count: list.length }), cards: list.map((piece) => pieceCard(deps, piece)) }))
    : [{ kind: 'cards', title: t('ao.fiche.pieces.none.title'), actions: [{ id: 'import', label: t('ao.home.import'), icon: 'upload', primary: true, run: () => deps.importInto(analysis) }], empty: t('ao.fiche.pieces.none'), cards: [] }]

  // L'émetteur : une carte par candidat, qui ouvre sa fiche (sa réponse, sa couverture).
  const candidates = position === 'emetteur' ? await listCandidates(services.fs, analysis) : []
  const candidateBlocks: HomeBlock[] = candidates.length
    ? [
        {
          kind: 'cards',
          title: t('ao.candidat.group', { count: candidates.length }),
          cards: await Promise.all(candidates.map(async (name) => {
            const own = pieces.filter((piece) => piece.destination.place === 'reponse' && piece.destination.candidate === name)
            // Sa couverture des exigences, pour comparer les candidats d'un coup d'œil.
            const rows = await candidateCoverage(services, analysis, name)
            const covered = rows.filter((row) => row.status === 'cited' || row.status === 'addressed').length
            const percent = rows.length ? Math.round((covered / rows.length) * 100) : null
            return {
              id: `candidat-${name}`,
              title: name,
              subtitle: t('ao.candidat.pieces', { count: own.length }),
              icon: 'folder' as const,
              ...(percent === null
                ? {}
                : {
                    badges: [{ label: t('ao.candidat.badge', { percent }), tone: (percent >= 80 ? 'success' : percent >= 50 ? 'warning' : 'danger') as Tone }],
                    facts: [
                      { label: t('ao.candidat.stat.coverage'), value: `${covered} / ${rows.length}` },
                      { label: t('ao.candidat.stat.absent'), value: String(rows.filter((row) => row.status === 'absent').length) }
                    ]
                  }),
              ...(deps.showPage ? { open: { id: 'open', label: t('ao.candidat.open'), tooltip: t('ao.candidat.open'), run: () => deps.showPage?.(candidatePageOf(analysis, name)) } } : {}),
              tags: ['reponse']
            }
          }))
        }
      ]
    : []
  const dates: ListItem[] = calendar.dates.map((date, index) => ({
    id: `date-${index}`,
    title: t(`ao.calendar.kind.${date.kind}`),
    when: date.date,
    detail: `${date.sentence}${date.sources.length ? ` — ${date.sources.map((source) => baseName(source.row.original || source.row.note)).join(', ')}` : ''}`,
    tone: date.kind === 'remise' ? (date.date >= today ? 'warning' : 'neutral') : 'info'
  }))
  const sorted = runs.sort((a, b) => a.report.score - b.report.score).slice(0, 15)
  const reqItems: ListItem[] = sorted.map(({ requirement, report }) => ({
    id: requirement.filePath ?? requirement.id,
    title: requirement.title ? `${requirement.id} — ${requirement.title}` : requirement.id,
    detail: `${'★'.repeat(report.stars)}${'☆'.repeat(5 - report.stars)} · ${(requirement.text[requirement.sourceLang]?.body ?? '').slice(0, 160)}`,
    tone: report.stars < 3 ? 'warning' : 'success',
    // Sa fiche, quand la plateforme a des pages ; sinon sa note.
    ...(requirement.filePath
      ? {
          open: deps.showPage
            ? { id: 'open', label: t('ao.fiche.requirement.card'), run: () => deps.showPage?.(requirementPageOf(requirement.filePath!)) }
            : { id: 'open', label: t('ao.fiche.requirement.open'), run: () => deps.ui.openNote(requirement.filePath!) }
        }
      : {})
  }))
  const asked = `${questionsFolder(analysis)}/`
  const everything = (await services.fs.exists(`${analysis.folder}/Analyse`)) ? await listNotes(services, `${analysis.folder}/Analyse`) : []
  const produced = everything.filter((path) => !path.startsWith(asked))
  // Les questions posées au dossier : la plus récente d'abord, chacune ouvre sa page.
  const questions = (await Promise.all(everything.filter((path) => path.startsWith(asked)).map(async (path) => ({ path, note: readQuestion(await services.fs.readText(path), questionWords(t)) }))))
    .filter((each): each is { path: string; note: QuestionNote } => each.note !== null)
    .sort((a, b) => b.note.date.localeCompare(a.note.date) || b.path.localeCompare(a.path))
  const questionItems: ListItem[] = questions.map(({ path, note }) => {
    const cited = note.sources.filter((source) => source.cited).length
    return {
      id: path,
      title: note.question,
      ...(note.date ? { when: note.date } : {}),
      detail: note.sources.length ? t('ao.question.cited', { cited, count: note.sources.length }) : t('ao.question.noSource'),
      tone: cited ? 'success' : 'warning',
      open: deps.showPage ? { id: 'open', label: t('ao.question.open'), run: () => deps.showPage?.(questionPageOf(path)) } : { id: 'open', label: t('ao.fiche.note.open'), run: () => deps.ui.openNote(path) }
    }
  })
  // Chaque note produite s'ouvre en page, quand la plateforme en a ; sinon dans le coffre.
  const notes: ListItem[] = produced.map((path) => ({
    id: path,
    title: baseName(path).replace(/\.md$/, ''),
    detail: path.slice(analysis.folder.length + 1),
    open: deps.showPage
      ? { id: 'open', label: t('ao.note.page.open'), run: () => deps.showPage?.(path === calendarPath(analysis) ? calendarPageOf(path) : path === questionnairePath(analysis) ? questionnairePageOf(path) : path === qualityPath(analysis) ? qualityPageOf(path) : path === reportPath(analysis) ? verificationPageOf(path) : producedPageOf(path)) }
      : { id: 'open', label: t('ao.fiche.note.open'), run: () => deps.ui.openNote(path) }
  }))

  const buyer = typeof data.acheteur === 'string' ? data.acheteur.trim() : ''
  const reference = typeof data.reference === 'string' ? data.reference.trim() : ''
  return {
    title: analysis.name,
    back,
    subtitle: [t(`ao.home.position.${position}`), buyer, reference].filter(Boolean).join(' · '),
    actions,
    search: { label: t('ao.fiche.search'), placeholder: t('ao.fiche.search.placeholder') },
    filters: [
      { id: 'a-lire', label: t('ao.page.filter.unread') },
      { id: 'appel-d-offres', label: t('ao.place.tender') },
      { id: 'reponse', label: t('ao.place.response') }
    ],
    blocks: [
      { kind: 'stats', stats },
      ...candidateBlocks,
      ...pieceBlocks,
      { kind: 'list', title: t('ao.fiche.calendar', { count: calendar.dates.length }), items: dates, empty: t('ao.fiche.calendar.none') },
      { kind: 'list', title: t('ao.fiche.requirements', { count: requirements.length }), items: reqItems, empty: t('ao.home.noRequirement') },
      { kind: 'list', title: t('ao.fiche.notes'), items: notes, empty: t('ao.fiche.notes.none') },
      ...(questionItems.length || ai ? [{ kind: 'list' as const, title: t('ao.question.list', { count: questionItems.length }), items: questionItems, empty: t('ao.question.none') }] : [])
    ]
  }
}

/** Où une exigence est traitée : la pièce, puis l'endroit — sans redire la pièce quand l'endroit la nomme déjà. */
const placeOf = (piece: string, where: string) => (where.startsWith(piece) ? where : `${piece} — ${where}`)

const COVERAGE_TONE: Record<string, Tone> = { cited: 'success', addressed: 'success', partial: 'warning', absent: 'danger' }
const COVERAGE_RANK: Record<string, number> = { absent: 0, partial: 1, addressed: 2, cited: 3 }

/**
 * La **fiche** d'un candidat (pour l'émetteur) : sa réponse — ses pièces, chacune avec ses
 * boutons —, et la couverture des exigences de l'analyse par elle, maintenant : combien
 * sont citées, traitées, à vérifier, absentes ; les absentes d'abord, chacune avec où elle
 * est traitée et l'extrait ; un clic ouvre la fiche de l'exigence.
 */
export async function candidatePage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const services = deps.services()
  const [rawNote = '', rawName = ''] = (param ?? '').split('&')
  const note = decodeURIComponent(rawNote)
  const name = decodeURIComponent(rawName)
  const analysis = (await listAnalyses(services)).find((each) => each.note === note)
  const missing = (back: ViewAction): PageView => ({ title: t('ao.candidat.missing.title'), back, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.candidat.missing') }] })
  if (!analysis || !name) return missing({ id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) })
  const back: ViewAction = { id: 'back', label: t('ao.piece.fiche.back', { name: analysis.name }), run: () => deps.showPage?.(analysisPageOf(analysis)) }
  const pieces = (await listPieces(services, analysis)).filter((piece) => piece.destination.place === 'reponse' && piece.destination.candidate === name)
  if (!pieces.length && !(await listCandidates(services.fs, analysis)).includes(name)) return missing(back)

  const rows = (await candidateCoverage(services, analysis, name)).sort((a, b) => COVERAGE_RANK[a.status]! - COVERAGE_RANK[b.status]! || a.score - b.score)
  const count = (status: string) => rows.filter((row) => row.status === status).length
  const covered = count('cited') + count('addressed')
  const unread = pieces.filter((piece) => piece.state !== 'lue').length
  const items: ListItem[] = rows.map((row) => ({
    id: row.requirement.filePath ?? row.requirement.id,
    title: row.requirement.title ? `${row.requirement.id} — ${row.requirement.title}` : row.requirement.id,
    when: t(`ao.verif.status.${row.status}`, { score: Math.round(row.score * 100) }),
    detail: row.piece ? `${placeOf(row.piece.replace(/^\[\[[^|\]]*\|?|\]\]$/g, ''), describeWhere(row.where, t))}${row.excerpt ? ` · « ${row.excerpt.slice(0, 160)} »` : ''}` : t('ao.candidat.notFound'),
    tone: COVERAGE_TONE[row.status] ?? 'neutral',
    ...(row.requirement.filePath && deps.showPage ? { open: { id: 'open', label: t('ao.fiche.requirement.card'), run: () => deps.showPage?.(requirementPageOf(row.requirement.filePath!)) } } : {})
  }))
  const percent = rows.length ? Math.round((covered / rows.length) * 100) : null
  return {
    title: name,
    back,
    subtitle: t('ao.candidat.subtitle', { analysis: analysis.name }),
    actions: [
      { id: 'import', label: t('ao.candidat.import'), icon: 'upload', primary: pieces.length === 0, run: () => deps.importInto(analysis) },
      ...(deps.runFor ? [{ id: 'report', label: t('ao.candidat.report'), icon: 'check' as const, run: () => deps.runFor?.('couverture-reponse', { analysis }) ?? Promise.resolve() }] : []),
      ...(deps.showPage ? [{ id: 'analysis', label: t('ao.piece.fiche.analysis'), icon: 'folder' as const, run: () => deps.showPage?.(analysisPageOf(analysis)) }] : [])
    ],
    search: { label: t('ao.candidat.search'), placeholder: t('ao.candidat.search.placeholder') },
    filters: [{ id: 'a-lire', label: t('ao.page.filter.unread') }],
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('ao.candidat.stat.coverage'), value: percent === null ? '—' : `${percent} %`, icon: 'check', tone: percent === null ? 'neutral' : percent >= 80 ? 'success' : percent >= 50 ? 'warning' : 'danger', hint: t('ao.candidat.stat.coverage.hint', { covered, total: rows.length }) },
          { label: t('ao.candidat.stat.partial'), value: String(count('partial')), icon: 'alert', tone: count('partial') ? 'warning' : 'success' },
          { label: t('ao.candidat.stat.absent'), value: String(count('absent')), icon: 'cross', tone: count('absent') ? 'danger' : 'success' },
          { label: t('ao.home.pieces'), value: unread ? t('ao.home.piecesRead', { count: pieces.length, read: pieces.length - unread }) : String(pieces.length), icon: 'file', ...(unread ? { tone: 'warning' as const } : {}) }
        ]
      },
      { kind: 'cards', title: t('ao.candidat.response', { count: pieces.length }), empty: t('ao.candidat.noPiece'), cards: pieces.map((piece) => pieceCard(deps, piece)) },
      { kind: 'list', title: t('ao.candidat.coverage', { count: rows.length }), items, empty: t(pieces.length ? 'ao.verif.couverture.noRequirements' : 'ao.candidat.noPiece') }
    ]
  }
}

const PIECE_PREVIEW = 1500

/**
 * Le texte d'une pièce, lisible tel quel : sans les marques de titres (« ### ») ni la
 * syntaxe des tableaux — une ligne de tableau devient ses cellules, séparées par « — ».
 */
export function readableText(markdown: string): string {
  return markdown
    .split('\n')
    .filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line))
    .map((line) => {
      const heading = /^\s*#{1,6}\s+(.*)$/.exec(line)
      if (heading) return heading[1]!.trim()
      if (/^\s*\|.*\|\s*$/.test(line))
        return line
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(' — ')
      return line
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * La **fiche** d'une pièce, en page : en tête Changer le type, Déplacer, Extraire les
 * exigences, ouvrir sa note, son original et son analyse ; ce qui empêche de la lire, s'il
 * le faut ; ses chiffres (état, type, caractères lus, exigences extraites) ; le début de
 * son texte ; les dates relevées dans elle ; les exigences qui en viennent.
 */
export async function piecePage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const services = deps.services()
  const note = param ? decodeURIComponent(param) : ''
  const info = note ? await pieceAt(services, note) : null
  const row = info ? (await listPieces(services, info.analysis)).find((each) => each.note === note) : undefined
  if (!info || !row) return { title: t('ao.piece.fiche.missing.title'), back: { id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) }, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.piece.fiche.missing') }] }
  const { analysis } = info
  const back: ViewAction = { id: 'back', label: t('ao.piece.fiche.back', { name: analysis.name }), run: () => deps.showPage?.(analysisPageOf(analysis)) }
  const read = row.state === 'lue'
  const text = read ? readableText(pieceText(await services.fs.readText(note), [t('ao.piece.text'), 'Texte extrait', 'Extracted text'])) : ''

  // Une commande sur cette pièce ; si elle a bougé (déplacée), on revient à son analyse.
  const run = (id: string) => async () => {
    await deps.runFor?.(id, { note })
    if (!(await services.fs.exists(note))) deps.showPage?.(analysisPageOf(analysis))
  }
  const original = row.original && (await services.fs.exists(row.original)) ? row.original : ''
  const actions: ViewAction[] = [
    ...(deps.runFor
      ? [
          { id: 'type', label: t('ao.fiche.piece.type'), icon: 'edit' as const, run: run('type-piece') },
          { id: 'move', label: t('ao.fiche.piece.move'), icon: 'flow' as const, run: run('deplacer-piece') },
          ...(read ? [{ id: 'extract', label: t('ao.fiche.piece.extract'), icon: 'list' as const, primary: true, run: run('extraire-exigences') }] : [])
        ]
      : []),
    { id: 'note', label: t('ao.fiche.piece.open'), icon: 'file', run: () => deps.ui.openNote(note) },
    ...(original ? [{ id: 'original', label: t('ao.piece.fiche.original'), icon: 'upload' as const, run: () => deps.ui.openNote(original) }] : []),
    ...(deps.showPage ? [{ id: 'analysis', label: t('ao.piece.fiche.analysis'), icon: 'folder' as const, run: () => deps.showPage?.(analysisPageOf(analysis)) }] : [])
  ]

  // Les exigences extraites de cette pièce : leur origine désigne sa note.
  const requirements = (await requirementsAt(requirementsFolder(analysis)).all()).filter((requirement) => requirement.origin && linkedNote(requirement.origin.piece) === note)
  const runs = assessAll(requirements, requirementLanguages(), 'wording').sort((a, b) => a.report.score - b.report.score)
  const reqItems: ListItem[] = runs.map(({ requirement, report }) => ({
    id: requirement.filePath ?? requirement.id,
    title: requirement.title ? `${requirement.id} — ${requirement.title}` : requirement.id,
    detail: `${'★'.repeat(report.stars)}${'☆'.repeat(5 - report.stars)}${requirement.origin?.locator ? ` · ${requirement.origin.locator}` : ''}`,
    tone: report.stars < 3 ? 'warning' : 'success',
    ...(requirement.filePath
      ? {
          open: deps.showPage
            ? { id: 'open', label: t('ao.fiche.requirement.card'), run: () => deps.showPage?.(requirementPageOf(requirement.filePath!)) }
            : { id: 'open', label: t('ao.fiche.requirement.open'), run: () => deps.ui.openNote(requirement.filePath!) }
        }
      : {})
  }))
  // Les dates relevées dans cette pièce seule.
  const own = (await pieceSources(services, analysis)).filter((source) => source.path === note)
  const calendar = calendarOf(own, Number(deps.today().slice(0, 4)))
  const dates: ListItem[] = [
    ...calendar.dates.map((date, index): ListItem => ({ id: `date-${index}`, title: t(`ao.calendar.kind.${date.kind}`), when: date.date, detail: date.sentence, tone: date.kind === 'remise' ? 'warning' : 'info' })),
    // Les délais (« sous 15 jours après la notification ») : pas de date, mais à tenir.
    ...calendar.delays.map((delay, index): ListItem => ({ id: `delay-${index}`, title: `${t(`ao.calendar.kind.${delay.kind}`)} — ${delayLabel(delay.written)}`, detail: delay.sentence, tone: 'neutral' }))
  ]

  return {
    title: baseName(row.original || note),
    back,
    subtitle: [`${row.type} — ${typeLabel(row.type, t)}`, destinationLabel(row.destination, t), analysis.name].join(' · '),
    actions,
    search: { label: t('ao.piece.fiche.search'), placeholder: t('ao.piece.fiche.search.placeholder') },
    blocks: [
      ...(read ? [] : [{ kind: 'message' as const, tone: STATE_TONE[row.state], text: t(`ao.state.${row.state}.help`) }]),
      {
        kind: 'stats',
        stats: [
          { label: t('ao.piece.fiche.state'), value: t(`ao.state.${row.state}`), icon: read ? 'check' : 'alert', tone: STATE_TONE[row.state] },
          { label: t('ao.piece.fiche.type'), value: row.type, icon: 'list', hint: typeLabel(row.type, t) },
          { label: t('ao.fiche.characters'), value: row.characters ? row.characters.toLocaleString('fr-FR') : '—', icon: 'file' },
          { label: t('ao.home.requirements'), value: String(requirements.length), icon: 'star', hint: t('ao.piece.fiche.extracted') }
        ]
      },
      ...(read
        ? [
            {
              kind: 'cards' as const,
              title: t('ao.piece.text'),
              cards: [{ id: 'text', title: text.length > PIECE_PREVIEW ? t('ao.piece.fiche.preview', { count: PIECE_PREVIEW, total: text.length }) : t('ao.piece.fiche.whole', { total: text.length }), icon: 'file' as const, text: text.length > PIECE_PREVIEW ? `${text.slice(0, PIECE_PREVIEW).trimEnd()}…` : text || t('ao.piece.noText'), wrap: true, actions: [{ id: 'note', label: t('ao.piece.fiche.all'), icon: 'file' as const, run: () => deps.ui.openNote(note) }] }]
            }
          ]
        : []),
      { kind: 'list', title: t('ao.piece.fiche.dates', { count: dates.length }), items: dates, empty: t(read ? 'ao.piece.fiche.dates.none' : 'ao.piece.fiche.unread') },
      { kind: 'list', title: t('ao.piece.fiche.requirements', { count: requirements.length }), items: reqItems, empty: t(read ? 'ao.piece.fiche.requirements.none' : 'ao.piece.fiche.unread') }
    ]
  }
}

/**
 * La **page** d'une note rangée dans le dossier Analyse qui n'a pas de page à elle (une
 * synthèse écrite à la main, par exemple ; le calendrier, la vérification, la qualité, le
 * questionnaire et les questions ont la leur) : son contenu, lisible sans la syntaxe — une
 * section par titre, un tableau en liste, chaque ligne avec son ton (🟩 🟧 🟥) et, si elle
 * a un lien, la fiche qu'il désigne (une pièce, une exigence) ; en tête ouvrir la note dans
 * le coffre, ou son analyse.
 */
export async function producedPage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const services = deps.services()
  const note = param ? decodeURIComponent(param) : ''
  const analysis = note ? (await listAnalyses(services)).find((each) => note.startsWith(`${each.folder}/`)) : undefined
  if (!analysis || !(await services.fs.exists(note)))
    return { title: t('ao.note.page.missing.title'), back: { id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) }, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.note.page.missing') }] }
  const back: ViewAction = { id: 'back', label: t('ao.piece.fiche.back', { name: analysis.name }), run: () => deps.showPage?.(analysisPageOf(analysis)) }

  // Ce qu'ouvre un lien : la fiche d'une pièce ou d'une exigence, l'analyse, sinon la note.
  const pieces = new Set((await listPieces(services, analysis)).map((piece) => piece.note))
  const requirements = `${requirementsFolder(analysis)}/`
  const opener = (target: string): ViewAction | undefined => {
    const path = target.includes('/') ? target : `${analysis.folder}/${target}`
    if (deps.showPage) {
      if (pieces.has(path)) return { id: 'open', label: t('ao.piece.fiche.open'), run: () => deps.showPage?.(piecePageOf(path)) }
      if (path.startsWith(requirements)) return { id: 'open', label: t('ao.fiche.requirement.card'), run: () => deps.showPage?.(requirementPageOf(path)) }
      if (path === analysis.note) return { id: 'open', label: t('ao.piece.fiche.analysis'), run: () => deps.showPage?.(analysisPageOf(analysis)) }
    }
    return { id: 'open', label: t('ao.fiche.note.open'), run: () => deps.ui.openNote(path) }
  }
  const markdown = await services.fs.readText(note)
  // Une question a sa page à elle.
  const type = parseFrontmatter(markdown).data['bp-type']
  if (type === QUESTION_TYPE && readQuestion(markdown, questionWords(t))) return questionPage(deps, param)
  if (type === QUESTIONNAIRE_TYPE && note === questionnairePath(analysis)) return questionnairePage(deps, param)
  if (note === qualityPath(analysis)) return qualityPage(deps, param)
  if (note === calendarPath(analysis)) return calendarPage(deps, param)
  if (note === reportPath(analysis)) return verificationPage(deps, param)
  const blocks = noteBlocks(markdown, opener)
  const heading = /^#\s+(.+)$/m.exec(markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''))?.[1]?.trim()

  const actions: ViewAction[] = [
    { id: 'note', label: t('ao.fiche.note.open'), icon: 'file', run: () => deps.ui.openNote(note) },
    ...(deps.showPage ? [{ id: 'analysis', label: t('ao.piece.fiche.analysis'), icon: 'folder' as const, run: () => deps.showPage?.(analysisPageOf(analysis)) }] : [])
  ]
  return {
    title: heading || baseName(note).replace(/\.md$/, ''),
    back,
    subtitle: [analysis.name, note.slice(analysis.folder.length + 1)].join(' · '),
    actions,
    search: { label: t('ao.note.page.search'), placeholder: t('ao.note.page.search.placeholder') },
    blocks: blocks.length ? blocks : [{ kind: 'message', tone: 'info', text: t('ao.note.page.empty') }]
  }
}

/** Les titres d'une note de question, pour la relire. */
const questionWords = (t: Translate) => ({ answer: t('ao.ask.answer'), sources: t('ao.ask.sources'), notes: t('ao.note.notes'), cited: t('ao.ask.cited') })

/**
 * La **page** d'une question au dossier : la question en titre ; ses chiffres (sources
 * transmises, citées, non citées, extraits ; le mode et la date en sous-titre) ; la réponse, et ce qui doit faire douter (une source
 * citée qui n'existe pas, aucune citée) ; une carte par source — citée ou non, ce que l'IA
 * en a reçu, un clic ouvre la fiche de la pièce ; vos notes. En tête : Reposer la
 * question (la fenêtre, la question déjà écrite), Nouvelle question, la note, l'analyse.
 */
export async function questionPage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const services = deps.services()
  const note = param ? decodeURIComponent(param) : ''
  const analysis = note ? (await listAnalyses(services)).find((each) => note.startsWith(`${each.folder}/`)) : undefined
  const read = analysis && (await services.fs.exists(note)) ? readQuestion(await services.fs.readText(note), questionWords(t)) : null
  if (!analysis || !read)
    return { title: t('ao.question.missing.title'), back: { id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) }, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.question.missing') }] }
  const ai = aiClient() !== null
  const actions: ViewAction[] = [
    ...(ai
      ? [
          { id: 'again', label: t('ao.question.again'), tooltip: t('ao.question.again.tip'), icon: 'refresh' as const, run: () => deps.ask(analysis, { question: read.question, mode: read.mode }) },
          { id: 'ask', label: t('ao.question.new'), icon: 'chat' as const, run: () => deps.ask(analysis) }
        ]
      : []),
    { id: 'note', label: t('ao.fiche.note.open'), icon: 'file', run: () => deps.ui.openNote(note) },
    ...(deps.showPage ? [{ id: 'analysis', label: t('ao.piece.fiche.analysis'), icon: 'folder' as const, run: () => deps.showPage?.(analysisPageOf(analysis)) }] : [])
  ]
  return {
    title: read.question,
    back: { id: 'back', label: t('ao.piece.fiche.back', { name: analysis.name }), run: () => deps.showPage?.(analysisPageOf(analysis)) },
    subtitle: [analysis.name, read.date, t(read.mode === 'each' ? 'ao.ask.mode.each' : 'ao.ask.mode.search')].filter(Boolean).join(' · '),
    actions,
    ...(await answerView(deps, analysis, read))
  }
}

/** Ce qu'on montre d'une réponse de l'IA : une question au dossier, ou un thème du questionnaire. */
interface AnswerShown {
  answer: string[]
  warnings: string[]
  sources: QuestionSource[]
  notes?: string[]
}

/**
 * Le corps commun d'une réponse de l'IA : ses chiffres (sources transmises, citées, non
 * citées, extraits), ses avertissements, le rappel de la vérifier, la réponse, une carte par
 * source — citée ou non, les extraits transmis, un clic ouvre la fiche de la pièce —, avec
 * une recherche et les filtres Citées / Non citées ; et les notes, s'il y en a.
 */
async function answerView(deps: HomeDeps, analysis: Analysis, read: AnswerShown, before: HomeBlock[] = []): Promise<Pick<PageView, 'search' | 'filters' | 'blocks'>> {
  const { t } = deps
  const pieces = new Set((await listPieces(deps.services(), analysis)).map((piece) => piece.note))
  const cited = read.sources.filter((source) => source.cited).length
  const cards: Card[] = read.sources.map((source) => {
    const path = source.link && !source.link.includes('/') ? `${analysis.folder}/${source.link}` : source.link
    const open: ViewAction | undefined = !path
      ? undefined
      : deps.showPage && pieces.has(path)
        ? { id: 'open', label: t('ao.piece.fiche.open'), tooltip: t('ao.piece.fiche.open'), run: () => deps.showPage?.(piecePageOf(path)) }
        : { id: 'open', label: t('ao.fiche.note.open'), tooltip: t('ao.fiche.note.open'), run: () => deps.ui.openNote(path) }
    return {
      id: `source-${source.number}`,
      title: `[${source.number}] ${source.title}`,
      ...(source.detail ? { subtitle: source.detail } : {}),
      icon: 'file' as const,
      badges: [{ label: t(source.cited ? 'ao.question.badge.cited' : 'ao.question.badge.notCited'), tone: source.cited ? ('success' as const) : ('neutral' as const) }],
      ...(source.extracts.length ? { text: source.extracts.map((extract) => `« ${extract} »`).join('\n\n'), wrap: true } : {}),
      ...(open ? { open } : {}),
      tags: [source.cited ? 'citees' : 'non-citees']
    }
  })
  return {
    search: { label: t('ao.question.search'), placeholder: t('ao.question.search.placeholder') },
    filters: [
      { id: 'citees', label: t('ao.question.filter.cited') },
      { id: 'non-citees', label: t('ao.question.filter.notCited') }
    ],
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('ao.question.stat.sources'), value: String(read.sources.length), icon: 'file', hint: t('ao.question.stat.sources.hint') },
          { label: t('ao.question.stat.cited'), value: String(cited), icon: 'check', tone: cited ? 'success' : 'warning' },
          { label: t('ao.question.stat.notCited'), value: String(read.sources.length - cited), icon: 'info' },
          { label: t('ao.question.stat.extracts'), value: String(read.sources.reduce((sum, source) => sum + source.extracts.length, 0)), icon: 'list', hint: t('ao.question.stat.extracts.hint') }
        ]
      },
      ...before,
      ...read.warnings.map((text) => ({ kind: 'message' as const, tone: 'warning' as const, text })),
      { kind: 'message', tone: 'info', text: t('ao.question.check') },
      { kind: 'text', title: t('ao.ask.answer'), paragraphs: read.answer, empty: t('ao.question.noAnswer') },
      { kind: 'cards', title: t('ao.question.sources', { count: read.sources.length }), cards, empty: t('ao.question.noSource') },
      ...(read.notes?.length ? [{ kind: 'text' as const, title: t('ao.question.notes'), paragraphs: read.notes }] : [])
    ]
  }
}

/** Les mots du questionnaire, pour relire sa note : ses six thèmes, « pas encore lancée ». */
const questionnaireWords = (t: Translate) => ({ ...questionWords(t), topics: QUESTIONNAIRE.map((key) => ({ key, title: t(`ao.q.${key}`) })), notRun: t('ao.verif.notRun') })

/**
 * L'état d'un thème du questionnaire : pas posé ; rien dans les pièces (l'IA n'a pas été
 * interrogée) ; une réponse sans source citée (à vérifier) ; répondu, sources citées.
 */
const topicState = (item: QuestionnaireItem) =>
  !item.asked ? 'a-poser' : !item.sources.length ? 'rien' : item.sources.some((source) => source.cited) ? 'repondues' : 'sans-source'
const TOPIC_TONE: Record<string, Tone> = { 'a-poser': 'neutral', rien: 'info', 'sans-source': 'warning', repondues: 'success' }

/** L'analyse d'un chemin de note (le questionnaire), et ce que dit la note — vide si elle n'existe pas encore. */
async function questionnaireOf(deps: HomeDeps, param: string | undefined) {
  const services = deps.services()
  const note = param ? decodeURIComponent(param) : ''
  const analysis = note ? (await listAnalyses(services)).find((each) => questionnairePath(each) === note) : undefined
  if (!analysis) return null
  const markdown = (await services.fs.exists(note)) ? await services.fs.readText(note) : ''
  return { note, analysis, exists: markdown !== '', ...readQuestionnaire(markdown, questionnaireWords(deps.t)) }
}

/** Remplir le questionnaire (tous les thèmes choisis), ou reposer certains thèmes seulement, sans quitter la page. */
const fillQuestionnaire = (deps: HomeDeps, analysis: Analysis, keys?: QuestionKey[]) => () => deps.runFor?.('questionnaire', { analysis, stay: true, ...(keys ? { keys } : {}) }) ?? Promise.resolve()

/**
 * La **page du questionnaire** d'une analyse : ses chiffres (thèmes répondus, sources
 * citées, sans source citée, pas encore posés) ; une carte par thème — la question, le
 * début de la réponse, les sources citées, « Reposer » —, un clic ouvre le thème ; en tête
 * Remplir le questionnaire (choisir les thèmes), la note, l'analyse. Elle s'ouvre aussi
 * avant que la note existe : les six thèmes, pas encore posés.
 */
export async function questionnairePage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const read = await questionnaireOf(deps, param)
  if (!read)
    return { title: t('ao.qn.missing.title'), back: { id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) }, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.qn.missing') }] }
  const { analysis, note, items } = read
  const ai = aiClient() !== null && Boolean(deps.runFor)
  const answered = items.filter((item) => item.asked)
  const cards: Card[] = items.map((item) => {
    const state = topicState(item)
    const cited = item.sources.filter((source) => source.cited).length
    const first = item.answer[0] ?? ''
    return {
      id: item.key,
      title: item.title,
      subtitle: item.asked ? t('ao.qn.asked', { date: item.date }) : t('ao.qn.notAsked'),
      icon: 'chat' as const,
      badges: [{ label: t(`ao.qn.badge.${state}`), tone: TOPIC_TONE[state]! }],
      text: item.asked ? first || t('ao.question.noAnswer') : t(`ao.q.${item.key}.ask`),
      ...(item.sources.length ? { facts: [{ label: t('ao.qn.fact.cited'), value: `${cited} / ${item.sources.length}` }] } : {}),
      ...(deps.showPage ? { open: { id: 'open', label: t('ao.qn.open'), tooltip: t('ao.qn.open'), run: () => deps.showPage?.(questionnaireItemPageOf(note, item.key)) } } : {}),
      ...(ai ? { actions: [{ id: 'again', label: t(item.asked ? 'ao.qn.again' : 'ao.qn.ask'), icon: (item.asked ? 'refresh' : 'chat') as IconName, run: fillQuestionnaire(deps, analysis, [item.key as QuestionKey]) }] } : {}),
      tags: [state]
    }
  })
  const actions: ViewAction[] = [
    ...(ai ? [{ id: 'fill', label: t('ao.qn.fill'), tooltip: t('ao.qn.fill.tip'), icon: 'list' as const, primary: answered.length === 0, run: fillQuestionnaire(deps, analysis) }] : []),
    ...(read.exists ? [{ id: 'note', label: t('ao.fiche.note.open'), icon: 'file' as const, run: () => deps.ui.openNote(note) }] : []),
    ...(deps.showPage ? [{ id: 'analysis', label: t('ao.piece.fiche.analysis'), icon: 'folder' as const, run: () => deps.showPage?.(analysisPageOf(analysis)) }] : [])
  ]
  const sansSource = items.filter((item) => topicState(item) === 'sans-source').length
  return {
    title: t('ao.questionnaire.title', { name: analysis.name }),
    back: { id: 'back', label: t('ao.piece.fiche.back', { name: analysis.name }), run: () => deps.showPage?.(analysisPageOf(analysis)) },
    subtitle: t('ao.qn.subtitle'),
    actions,
    search: { label: t('ao.qn.search'), placeholder: t('ao.qn.search.placeholder') },
    filters: [
      { id: 'repondues', label: t('ao.qn.state.repondues') },
      { id: 'sans-source', label: t('ao.qn.state.sans-source') },
      { id: 'rien', label: t('ao.qn.state.rien') },
      { id: 'a-poser', label: t('ao.qn.state.a-poser') }
    ],
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('ao.qn.stat.answered'), value: `${answered.length} / ${items.length}`, icon: 'check', tone: answered.length === items.length ? 'success' : answered.length ? 'warning' : 'neutral' },
          { label: t('ao.question.stat.cited'), value: String(items.reduce((sum, item) => sum + item.sources.filter((source) => source.cited).length, 0)), icon: 'file' },
          { label: t('ao.qn.state.sans-source'), value: String(sansSource), icon: 'alert', ...(sansSource ? { tone: 'warning' as const } : {}) },
          { label: t('ao.qn.state.rien'), value: String(items.filter((item) => topicState(item) === 'rien').length), icon: 'info', hint: t('ao.qn.stat.rien.hint') },
          { label: t('ao.qn.state.a-poser'), value: String(items.length - answered.length), icon: 'list' }
        ]
      },
      ...(ai ? [] : [{ kind: 'message' as const, tone: 'warning' as const, text: t('ao.qn.noAi') }]),
      { kind: 'message', tone: 'info', text: t('ao.question.check') },
      { kind: 'cards', title: t('ao.qn.topics', { count: items.length }), cards },
      ...(read.notes.length ? [{ kind: 'text' as const, title: t('ao.question.notes'), paragraphs: read.notes }] : [])
    ]
  }
}

/**
 * La **page d'un thème** du questionnaire : le thème en titre, la question posée, et la
 * réponse comme pour une question au dossier (chiffres, réponse, une carte par source) ;
 * en tête Reposer cette question (ce thème seul), le questionnaire, la note.
 */
export async function questionnaireItemPage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const [encoded, key] = (param ?? '').split('&')
  const read = await questionnaireOf(deps, encoded)
  const item = read?.items.find((each) => each.key === (key ? decodeURIComponent(key) : ''))
  if (!read || !item)
    return { title: t('ao.qn.missing.title'), back: { id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) }, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.qn.missing') }] }
  const { analysis, note } = read
  const ai = aiClient() !== null && Boolean(deps.runFor)
  const actions: ViewAction[] = [
    ...(ai ? [{ id: 'again', label: t(item.asked ? 'ao.qn.again.one' : 'ao.qn.ask'), icon: (item.asked ? 'refresh' : 'chat') as IconName, primary: !item.asked, run: fillQuestionnaire(deps, analysis, [item.key as QuestionKey]) }] : []),
    ...(deps.showPage ? [{ id: 'questionnaire', label: t('ao.qn.all'), icon: 'list' as const, run: () => deps.showPage?.(questionnairePageOf(note)) }] : []),
    ...(read.exists ? [{ id: 'note', label: t('ao.fiche.note.open'), icon: 'file' as const, run: () => deps.ui.openNote(note) }] : [])
  ]
  const head = {
    title: item.title,
    back: { id: 'back', label: t('ao.qn.back', { name: analysis.name }), run: () => deps.showPage?.(questionnairePageOf(note)) },
    subtitle: [analysis.name, item.asked ? t('ao.qn.asked', { date: item.date }) : t('ao.qn.notAsked')].join(' · '),
    actions
  }
  const question: HomeBlock = { kind: 'text', title: t('ao.qn.question'), paragraphs: [item.question || t(`ao.q.${item.key}.ask`)] }
  if (!item.asked) return { ...head, blocks: [question, { kind: 'message', tone: 'info', text: t(ai ? 'ao.qn.notAsked.help' : 'ao.qn.noAi') }] }
  return { ...head, ...(await answerView(deps, analysis, item, [question])) }
}

/** La formulation d'une exigence, dans sa langue d'origine. */
const wordingOfRequirement = (run: QualityRun) => run.requirement.text[run.requirement.sourceLang]?.body ?? Object.values(run.requirement.text)[0]?.body ?? run.requirement.title ?? ''
const percent = (value: number) => `${Math.round(value * 100)} %`
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const toneOfScore = (value: number): Tone => (value >= 0.9 ? 'success' : value >= 0.6 ? 'warning' : 'danger')

/**
 * La **page de la qualité** des exigences d'une analyse, calculée à l'ouverture (sur leur
 * seule rédaction, comme le rapport) : ses chiffres (exigences, note moyenne, faibles, non
 * vérifiables, doublons probables) ; une carte par exigence, les plus faibles d'abord —
 * ses étoiles, sa formulation, ce qui lui coûte —, un clic ouvre sa fiche ; puis les
 * défauts les plus fréquents, les doublons probables, chaque axe de la norme, la
 * répartition des notes. En tête : écrire (ou mettre à jour) le rapport sans quitter la page, l'ouvrir,
 * relire avec l'IA, l'analyse.
 */
export async function qualityPage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const services = deps.services()
  const note = param ? decodeURIComponent(param) : ''
  const analysis = note ? (await listAnalyses(services)).find((each) => qualityPath(each) === note) : undefined
  if (!analysis)
    return { title: t('ao.qp.missing.title'), back: { id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) }, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.qp.missing') }] }
  const exists = await services.fs.exists(note)
  const runs = assessAll(await requirementsAt(requirementsFolder(analysis)).all(), requirementLanguages(), 'wording').sort((a, b) => a.report.score - b.report.score || a.requirement.id.localeCompare(b.requirement.id, undefined, { numeric: true }))
  const ai = aiClient() !== null
  const run = (id: string) => () => deps.runFor?.(id, { analysis, stay: true }) ?? Promise.resolve()
  const actions: ViewAction[] = [
    ...(deps.runFor && runs.length ? [{ id: 'report', label: t(exists ? 'ao.qp.report.update' : 'ao.qp.report.write'), tooltip: t('ao.qp.report.tip'), icon: 'refresh' as const, run: run('qualite-exigences') }] : []),
    ...(exists ? [{ id: 'note', label: t('ao.qp.report.open'), icon: 'file' as const, run: () => deps.ui.openNote(note) }] : []),
    ...(deps.runFor && ai && runs.length ? [{ id: 'review', label: t('ao.tile.review'), icon: 'spark' as const, run: () => deps.runFor?.('relire-exigences-ia', { analysis }) ?? Promise.resolve() }] : []),
    ...(deps.showPage ? [{ id: 'analysis', label: t('ao.piece.fiche.analysis'), icon: 'folder' as const, run: () => deps.showPage?.(analysisPageOf(analysis)) }] : [])
  ]
  const head = {
    title: t('ao.quality.title', { name: analysis.name }),
    back: { id: 'back', label: t('ao.piece.fiche.back', { name: analysis.name }), run: () => deps.showPage?.(analysisPageOf(analysis)) },
    subtitle: t('exigences.quality.scope.wording'),
    actions
  }
  if (!runs.length) return { ...head, blocks: [{ kind: 'message', tone: 'info', text: t('ao.qp.none') }] }

  const mean = runs.reduce((sum, each) => sum + each.report.score, 0) / runs.length
  const weak = runs.filter((each) => isWeak(each.report))
  const axisOf = (each: QualityRun, id: string) => each.report.axes.find((axis) => axis.id === id)
  const unverifiable = runs.filter((each) => (axisOf(each, 'verifiable')?.score ?? 1) < 1)
  const pairs = probableDuplicates(runs.map((each) => each.requirement))
  const doubled = new Set(pairs.flatMap((pair) => [pair.a, pair.b]))
  const byId = new Map(runs.map((each) => [each.requirement.id, each]))
  const fiche = (each: QualityRun): ViewAction | undefined =>
    each.requirement.filePath
      ? deps.showPage
        ? { id: 'open', label: t('ao.fiche.requirement.card'), tooltip: t('ao.fiche.requirement.card'), run: () => deps.showPage?.(requirementPageOf(each.requirement.filePath!)) }
        : { id: 'open', label: t('ao.fiche.requirement.open'), tooltip: t('ao.fiche.requirement.open'), run: () => deps.ui.openNote(each.requirement.filePath!) }
      : undefined
  const named = (each: QualityRun) => (each.requirement.title ? `${each.requirement.id} — ${each.requirement.title}` : each.requirement.id)

  // Les notes données seulement : une ligne « 0 exigence » n'apprend rien.
  const distribution: ListItem[] = [5, 4, 3, 2, 1, 0].flatMap((count) => {
    const n = runs.filter((each) => each.report.stars === count).length
    return n ? [{ id: `stars-${count}`, title: '★'.repeat(count) + '☆'.repeat(5 - count), detail: t('ao.qp.count', { count: n }), tone: (count >= 4 ? 'success' : count >= 3 ? 'info' : 'warning') as Tone }] : []
  })
  const axes: ListItem[] = QUALITY_AXES.flatMap((id) => {
    const scores = runs.flatMap((each) => axisOf(each, id)?.score ?? [])
    if (!scores.length) return []
    const value = scores.reduce((a, b) => a + b, 0) / scores.length
    const below = runs.filter((each) => (axisOf(each, id)?.score ?? 1) < 1).length
    return [{ id: `axe-${id}`, title: t(`exigences.axis.${id}`), detail: `${percent(value)}${below ? ` — ${t('ao.qp.axis.below', { count: below })}` : ''}`, tone: toneOfScore(value) }]
  })
  const byRule = new Map<string, QualityRun[]>()
  for (const each of runs) for (const rule of new Set(each.report.findings.map((finding) => finding.rule))) byRule.set(rule, [...(byRule.get(rule) ?? []), each])
  const defects: ListItem[] = [...byRule]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([rule, list]) => ({ id: `defaut-${rule}`, title: capitalized(t(`exigences.rule.${rule}`)), detail: `${t('ao.qp.count', { count: list.length })} — ${list.slice(0, 4).map((each) => each.requirement.id).join(', ')}${list.length > 4 ? '…' : ''}`, tone: 'warning' as const, ...(list.length === 1 && fiche(list[0]!) ? { open: fiche(list[0]!)! } : {}) }))
  const duplicates: ListItem[] = pairs.flatMap((pair) => {
    const a = byId.get(pair.a)
    const b = byId.get(pair.b)
    if (!a || !b) return []
    const open = fiche(a)
    return [{ id: `doublon-${pair.a}-${pair.b}`, title: `${pair.a} ↔ ${pair.b}`, detail: `${t('exigences.quality.likeness')} ${percent(pair.score)} — « ${wordingOfRequirement(a).slice(0, 90)} » / « ${wordingOfRequirement(b).slice(0, 90)} »`, tone: 'warning' as const, ...(open ? { open } : {}) }]
  })
  const cards: Card[] = runs.map((each) => {
    const { report } = each
    const costly = report.axes.filter((axis) => axis.score < 1).sort((a, b) => a.score - b.score).slice(0, 3)
    const findings = report.findings.map((finding) => describeFinding(finding, t))
    const open = fiche(each)
    const tags = [...(isWeak(report) ? ['faibles'] : []), ...((axisOf(each, 'verifiable')?.score ?? 1) < 1 ? ['non-verifiables'] : []), ...(doubled.has(each.requirement.id) ? ['doublons'] : []), ...(report.stars >= 4 ? ['bonnes'] : [])]
    return {
      id: each.requirement.filePath ?? each.requirement.id,
      title: named(each),
      subtitle: findings.length ? capitalized(findings.slice(0, 3).join(' · ')) : t('ao.qp.noFinding'),
      rating: { stars: report.stars, label: t('ao.qp.rating', { percent: percent(report.score) }) },
      icon: 'star' as const,
      badges: [
        ...(isWeak(report) ? [{ label: t('ao.qp.badge.weak'), tone: 'warning' as const }] : []),
        ...((axisOf(each, 'verifiable')?.score ?? 1) < 1 ? [{ label: t('ao.qp.badge.unverifiable'), tone: 'danger' as const }] : []),
        ...(doubled.has(each.requirement.id) ? [{ label: t('ao.qp.badge.duplicate'), tone: 'info' as const }] : [])
      ],
      text: wordingOfRequirement(each),
      ...(costly.length ? { facts: costly.map((axis) => ({ label: t(`exigences.axis.${axis.id}`), value: percent(axis.score) })) } : {}),
      ...(open ? { open } : {}),
      tags
    }
  })
  return {
    ...head,
    search: { label: t('ao.qp.search'), placeholder: t('ao.qp.search.placeholder') },
    filters: [
      { id: 'faibles', label: t('ao.qp.filter.weak') },
      { id: 'non-verifiables', label: t('ao.qp.filter.unverifiable') },
      { id: 'doublons', label: t('ao.qp.filter.duplicates') },
      { id: 'bonnes', label: t('ao.qp.filter.good') }
    ],
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('exigences.quality.count'), value: String(runs.length), icon: 'list' },
          { label: t('exigences.quality.mean'), value: percent(mean), icon: 'star', tone: toneOfScore(mean), hint: '★'.repeat(Math.round(mean * 5)) + '☆'.repeat(5 - Math.round(mean * 5)) },
          { label: t('ao.qp.stat.weak'), value: String(weak.length), icon: 'alert', ...(weak.length ? { tone: 'warning' as const } : {}), hint: t('ao.qp.stat.weak.hint') },
          { label: t('ao.qp.stat.unverifiable'), value: String(unverifiable.length), icon: 'check', ...(unverifiable.length ? { tone: 'danger' as const } : {}) },
          { label: t('exigences.quality.duplicates'), value: String(pairs.length), icon: 'columns', ...(pairs.length ? { tone: 'info' as const } : {}) }
        ]
      },
      ...(exists ? [] : [{ kind: 'message' as const, tone: 'info' as const, text: t('ao.qp.noReport') }]),
      // Les exigences d'abord, les plus faibles en tête : c'est ce qu'on vient reprendre.
      { kind: 'cards', title: t('ao.qp.requirements', { count: runs.length }), cards },
      { kind: 'list', title: t('exigences.quality.defects'), items: defects, empty: t('exigences.quality.noDefect') },
      { kind: 'list', title: t('exigences.quality.duplicates'), items: duplicates, empty: t('exigences.quality.noDuplicate') },
      { kind: 'list', title: t('exigences.quality.axes'), items: axes },
      { kind: 'list', title: t('exigences.quality.distribution'), items: distribution }
    ]
  }
}

/**
 * La **page du calendrier** d'une analyse, relevé à l'ouverture dans les pièces de l'appel
 * d'offres (sans IA, sans rien écrire) : ses chiffres (la date limite de remise et les jours
 * restants, la validité des offres, les dates à venir, les délais) ; « À retenir » ; les
 * dates dans l'ordre, chacune avec sa phrase et sa pièce ; les délais. Un clic ouvre la
 * fiche de la pièce ; les filtres À venir, Passées, Délais. En tête : écrire (ou mettre à
 * jour) la note du calendrier sans quitter la page, l'ouvrir, l'analyse.
 */
export async function calendarPage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const services = deps.services()
  const note = param ? decodeURIComponent(param) : ''
  const analysis = note ? (await listAnalyses(services)).find((each) => calendarPath(each) === note) : undefined
  if (!analysis)
    return { title: t('ao.cp.missing.title'), back: { id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) }, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.cp.missing') }] }
  const exists = await services.fs.exists(note)
  const today = deps.today()
  const calendar = calendarOf(await pieceSources(services, analysis, 'appel-d-offres'), Number(today.slice(0, 4)))
  const longDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(t('ao.fiche.locale'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const relative = (date: string) => {
    const days = daysUntil(date, today)
    return days > 0 ? `J-${days}` : days === 0 ? t('ao.cp.today') : t('ao.fiche.past')
  }
  const sourcesOf = (sources: readonly PieceSource[]) => sources.map((source) => source.title).join(', ')
  const openSource = (sources: readonly PieceSource[]): ViewAction | undefined => {
    const path = sources[0]?.row.note
    if (!path) return undefined
    return deps.showPage ? { id: 'open', label: t('ao.piece.fiche.open'), run: () => deps.showPage?.(piecePageOf(path)) } : { id: 'open', label: t('ao.fiche.note.open'), run: () => deps.ui.openNote(path) }
  }
  const withOpen = (sources: readonly PieceSource[]) => {
    const open = openSource(sources)
    return open ? { open } : {}
  }
  const quoted = (sentence: string) => `« ${sentence.replace(/\s+/g, ' ').trim()} »`
  // Une remise : rouge à une semaine, orange à trois, verte au-delà ; passée, neutre.
  const remiseTone = (until: number): Tone => (until < 0 ? 'neutral' : until <= 7 ? 'danger' : until <= 21 ? 'warning' : 'success')

  const actions: ViewAction[] = [
    ...(deps.runFor ? [{ id: 'write', label: t(exists ? 'ao.cp.write.update' : 'ao.cp.write'), tooltip: t('ao.cp.write.tip'), icon: 'refresh' as const, run: () => deps.runFor?.('calendrier', { analysis, stay: true }) ?? Promise.resolve() }] : []),
    ...(exists ? [{ id: 'note', label: t('ao.fiche.note.open'), icon: 'file' as const, run: () => deps.ui.openNote(note) }] : []),
    ...(deps.showPage ? [{ id: 'analysis', label: t('ao.piece.fiche.analysis'), icon: 'folder' as const, run: () => deps.showPage?.(analysisPageOf(analysis)) }] : [])
  ]
  const head = {
    title: t('ao.calendar.title', { name: analysis.name }),
    back: { id: 'back', label: t('ao.piece.fiche.back', { name: analysis.name }), run: () => deps.showPage?.(analysisPageOf(analysis)) },
    subtitle: t('ao.calendar.intro'),
    actions
  }
  if (!calendar.read) return { ...head, blocks: [{ kind: 'message', tone: 'info', text: t('ao.cp.noPiece') }] }

  // La remise : la prochaine, sinon la dernière passée.
  const remises = calendar.dates.filter((date) => date.kind === 'remise')
  const due = remises.find((date) => date.date >= today) ?? remises.at(-1)
  const days = due ? daysUntil(due.date, today) : null
  const validity = calendar.dates.find((date) => date.kind === 'validite')
  const validityDelay = calendar.delays.find((delay) => delay.kind === 'validite')
  const coming = calendar.dates.filter((date) => date.date >= today)

  const keep: ListItem[] = (['remise', 'validite'] as const).map((kind) => {
    const date = calendar.dates.find((each) => each.kind === kind && (kind !== 'remise' || each === due))
    const delay = calendar.delays.find((each) => each.kind === kind)
    if (date)
      return { id: `retenir-${kind}`, title: t(`ao.calendar.kind.${kind}`), when: date.date, detail: `${longDate(date.date)} (${relative(date.date)}) — ${quoted(date.sentence)} — ${sourcesOf(date.sources)}`, tone: kind === 'remise' ? remiseTone(daysUntil(date.date, today)) : 'info', ...withOpen(date.sources) }
    if (delay) return { id: `retenir-${kind}`, title: t(`ao.calendar.kind.${kind}`), detail: `${delayLabel(delay.written)} — ${quoted(delay.sentence)} — ${sourcesOf(delay.sources)}`, tone: 'info', ...withOpen(delay.sources) }
    return { id: `retenir-${kind}`, title: t(`ao.calendar.kind.${kind}`), detail: t('ao.calendar.notFound'), tone: 'warning' }
  })
  const dates: ListItem[] = calendar.dates.map((date, index) => {
    const past = date.date < today
    const until = daysUntil(date.date, today)
    return {
      id: `date-${index}`,
      title: `${t(`ao.calendar.kind.${date.kind}`)}${date.guessedYear ? ` (${t('ao.calendar.guessed')})` : ''}`,
      when: date.date,
      detail: `${relative(date.date)} — ${quoted(date.sentence)} — ${sourcesOf(date.sources)}`,
      tone: past ? 'neutral' : date.kind === 'remise' ? remiseTone(until) : 'info',
      ...withOpen(date.sources),
      tags: [past ? 'passees' : 'a-venir']
    }
  })
  const delays: ListItem[] = calendar.delays.map((delay, index) => ({
    id: `delai-${index}`,
    title: `${t(`ao.calendar.kind.${delay.kind}`)} — ${delayLabel(delay.written)}`,
    detail: `${quoted(delay.sentence)} — ${sourcesOf(delay.sources)}`,
    tone: 'info',
    ...withOpen(delay.sources),
    tags: ['delais']
  }))
  return {
    ...head,
    search: { label: t('ao.cp.search'), placeholder: t('ao.cp.search.placeholder') },
    filters: [
      { id: 'a-venir', label: t('ao.cp.filter.coming') },
      { id: 'passees', label: t('ao.cp.filter.past') },
      { id: 'delais', label: t('ao.calendar.delays') }
    ],
    blocks: [
      {
        kind: 'stats',
        stats: [
          days === null
            ? { label: t('ao.calendar.kind.remise'), value: '—', icon: 'clock', hint: t('ao.fiche.noDeadline') }
            : { label: t('ao.calendar.kind.remise'), value: days >= 0 ? `J-${days}` : t('ao.fiche.past'), icon: days >= 0 && days <= 7 ? 'alert' : 'clock', tone: remiseTone(days), hint: longDate(due!.date) },
          validity
            ? { label: t('ao.calendar.kind.validite'), value: validity.date, icon: 'calendar' }
            : { label: t('ao.calendar.kind.validite'), value: validityDelay ? delayLabel(validityDelay.written) : '—', icon: 'calendar', ...(validityDelay ? {} : { hint: t('ao.calendar.notFound') }) },
          { label: t('ao.cp.stat.coming'), value: String(coming.length), icon: 'calendar', hint: t('ao.cp.stat.dates', { count: calendar.dates.length }) },
          { label: t('ao.calendar.delays'), value: String(calendar.delays.length), icon: 'clock', hint: t('ao.cp.stat.read', { count: calendar.read }) }
        ]
      },
      ...(calendar.dates.some((date) => date.guessedYear) ? [{ kind: 'message' as const, tone: 'warning' as const, text: t('ao.calendar.guessedWarning') }] : []),
      { kind: 'message', tone: 'info', text: t(exists ? 'ao.cp.live' : 'ao.cp.live.noNote') },
      { kind: 'list', title: t('ao.calendar.keep'), items: keep },
      { kind: 'list', title: t('ao.cp.dates', { count: calendar.dates.length }), items: dates, empty: t('ao.calendar.noDate') },
      { kind: 'list', title: t('ao.cp.delays', { count: calendar.delays.length }), items: delays, empty: t('ao.calendar.noDelay') }
    ]
  }
}

/** Le libellé d'un lien Obsidian (« [[Pièces/RC|RC]] » → « RC ») ; le texte tel quel sinon. */
const linkLabel = (link: string) => /\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/.exec(link)?.[1] ?? link
const COVERAGE_ORDER: Record<string, number> = { absent: 0, partial: 1, addressed: 2, cited: 3 }

/**
 * La **page de la vérification** des exigences d'une analyse, calculée à l'ouverture
 * (`verificationNow` : rien n'est écrit ni proposé) : ses chiffres ; puis les quatre
 * vérifications — ce que chaque pièce de l'appel d'offres porte d'exigences ; les phrases à
 * tournure d'exigence qu'aucune ne reprend ; les incohérences entre pièces ; la couverture
 * des exigences par chaque réponse, les absentes d'abord. Un clic ouvre la fiche de la pièce
 * ou de l'exigence ; un filtre par vérification. En tête : Tout vérifier (le rapport, avec
 * les aperçus d'ajout), Tout extraire, Ajouter des oubliées, le rapport, l'analyse.
 */
export async function verificationPage(deps: HomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const services = deps.services()
  const note = param ? decodeURIComponent(param) : ''
  const analysis = note ? (await listAnalyses(services)).find((each) => reportPath(each) === note) : undefined
  if (!analysis)
    return { title: t('ao.vp.missing.title'), back: { id: 'back', label: t('ao.fiche.back'), run: () => deps.showPage?.(ANALYSES_PAGE) }, blocks: [{ kind: 'message', tone: 'warning', text: t('ao.vp.missing') }] }
  const exists = await services.fs.exists(note)
  const now = await verificationNow(services, analysis)
  const found = now.extraction.reduce((sum, each) => sum + each.found, 0)
  const run = (id: string) => () => deps.runFor?.(id, { analysis, stay: true }) ?? Promise.resolve()
  const actions: ViewAction[] = [
    ...(deps.runFor
      ? [
          { id: 'all', label: t('ao.vp.all'), tooltip: t('ao.vp.all.tip'), icon: 'check' as const, primary: !exists, run: run('verifier-exigences') },
          ...(found ? [{ id: 'extract', label: t('ao.vp.extract'), tooltip: t('ao.vp.extract.tip'), icon: 'list' as const, run: run('extraire-tout') }] : []),
          ...(now.missed.length ? [{ id: 'missed', label: t('ao.vp.missed'), tooltip: t('ao.vp.missed.tip'), icon: 'plus' as const, run: run('exigences-oubliees') }] : [])
        ]
      : []),
    ...(exists ? [{ id: 'note', label: t('ao.qp.report.open'), icon: 'file' as const, run: () => deps.ui.openNote(note) }] : []),
    ...(deps.showPage ? [{ id: 'analysis', label: t('ao.piece.fiche.analysis'), icon: 'folder' as const, run: () => deps.showPage?.(analysisPageOf(analysis)) }] : [])
  ]
  const pieceOpen = (path: string): ViewAction | undefined =>
    path ? (deps.showPage ? { id: 'open', label: t('ao.piece.fiche.open'), run: () => deps.showPage?.(piecePageOf(path)) } : { id: 'open', label: t('ao.fiche.note.open'), run: () => deps.ui.openNote(path) }) : undefined
  const requirementOpen = (path: string | undefined): ViewAction | undefined =>
    path ? (deps.showPage ? { id: 'open', label: t('ao.fiche.requirement.card'), run: () => deps.showPage?.(requirementPageOf(path)) } : { id: 'open', label: t('ao.fiche.requirement.open'), run: () => deps.ui.openNote(path) }) : undefined
  const stored = new Map((await requirementsAt(requirementsFolder(analysis)).all()).map((requirement) => [requirement.id, requirement.filePath]))

  // 1. Ce que chaque pièce de l'appel d'offres porte d'exigences.
  const extraction: ListItem[] = now.extraction.map((each) => {
    const open = pieceOpen(each.note)
    return {
      id: `extraction-${each.note}`,
      title: each.name,
      detail: each.problem ? t(`exigences.import.problem.${each.problem}`, { name: each.name }) : t('ao.vp.extraction.found', { count: each.found }),
      tone: each.problem ? 'warning' : each.found ? 'success' : 'neutral',
      ...(open ? { open } : {}),
      tags: ['extraction']
    }
  })
  // 2. Les phrases qu'aucune exigence ne reprend.
  const missed: ListItem[] = now.missed.map((each, index) => {
    const open = pieceOpen(linkedNote(each.piece))
    return {
      id: `oubliee-${index}`,
      title: each.sentence.length > 200 ? `${each.sentence.slice(0, 199)}…` : each.sentence,
      detail: [placeOf([each.piece, ...each.alsoIn].map(linkLabel).join(', '), describeWhere(each.where, t)), `« ${each.marker} »`].join(' — '),
      tone: 'warning' as const,
      ...(open ? { open } : {}),
      tags: ['oubliees']
    }
  })
  // 3. Les incohérences entre pièces.
  const findings: ListItem[] = now.findings.map((finding, index) => {
    const open = requirementOpen(finding.ids.map((id) => stored.get(id)).find(Boolean)) ?? pieceOpen(finding.pieces.map(linkedNote).find(Boolean) ?? '')
    return {
      id: `coherence-${index}`,
      title: `${t(`ao.verif.finding.${finding.kind}`)} — ${finding.ids.join(', ')}`,
      detail: [finding.pieces.map(linkLabel).join(', '), finding.texts.map((text) => `« ${text.length > 120 ? `${text.slice(0, 119)}…` : text} »`).join(' ≠ ')].filter(Boolean).join(' — '),
      tone: finding.kind === 'divergent' || finding.kind === 'library-differs' ? ('danger' as const) : ('warning' as const),
      ...(open ? { open } : {}),
      tags: ['coherence']
    }
  })
  // 4. La couverture par chaque réponse : les absentes d'abord.
  const coverageBlocks: HomeBlock[] = now.coverage.map(({ candidate, rows }) => {
    const covered = rows.filter((row) => row.status === 'cited' || row.status === 'addressed').length
    const share = rows.length ? Math.round((covered / rows.length) * 100) : 0
    return {
      kind: 'list',
      title: candidate ? t('ao.vp.coverage.candidate', { candidate, percent: share }) : t('ao.vp.coverage.title', { percent: share }),
      items: [...rows]
        .sort((a, b) => (COVERAGE_ORDER[a.status] ?? 0) - (COVERAGE_ORDER[b.status] ?? 0) || a.requirement.id.localeCompare(b.requirement.id, undefined, { numeric: true }))
        .map((row): ListItem => {
          const open = requirementOpen(row.requirement.filePath)
          return {
            id: `couverture-${candidate}-${row.requirement.id}`,
            title: row.requirement.title ? `${row.requirement.id} — ${row.requirement.title}` : row.requirement.id,
            detail: [t(`ao.verif.status.${row.status}`, { score: Math.round(row.score * 100) }), row.piece ? placeOf(linkLabel(row.piece), describeWhere(row.where, t)) : '', row.excerpt ? `« ${row.excerpt.length > 140 ? `${row.excerpt.slice(0, 139)}…` : row.excerpt} »` : ''].filter(Boolean).join(' · '),
            tone: COVERAGE_TONE[row.status] ?? 'neutral',
            ...(open ? { open } : {}),
            tags: ['couverture']
          }
        })
    }
  })
  const shares = now.coverage.map(({ rows }) => (rows.length ? Math.round((rows.filter((row) => row.status === 'cited' || row.status === 'addressed').length / rows.length) * 100) : 0))
  const coverageValue = !shares.length ? '—' : shares.length === 1 ? `${shares[0]} %` : `${Math.min(...shares)}–${Math.max(...shares)} %`
  const worst = shares.length ? Math.min(...shares) : null
  return {
    title: t('ao.vp.page.title', { name: analysis.name }),
    back: { id: 'back', label: t('ao.piece.fiche.back', { name: analysis.name }), run: () => deps.showPage?.(analysisPageOf(analysis)) },
    subtitle: t('ao.vp.subtitle'),
    actions,
    search: { label: t('ao.vp.search'), placeholder: t('ao.vp.search.placeholder') },
    filters: [
      { id: 'extraction', label: t('ao.verif.extraction.title') },
      { id: 'oubliees', label: t('ao.verif.oubliees.title') },
      { id: 'coherence', label: t('ao.verif.coherence.title') },
      { id: 'couverture', label: t('ao.verif.couverture.title') }
    ],
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('ao.vp.stat.found'), value: String(found), icon: 'list', hint: t('ao.vp.stat.found.hint', { pieces: now.extraction.length, stored: now.requirements }) },
          { label: t('ao.verif.oubliees.title'), value: String(now.missed.length), icon: 'alert', ...(now.missed.length ? { tone: 'warning' as const } : {}) },
          { label: t('ao.vp.stat.findings'), value: String(now.findings.length), icon: 'columns', ...(now.findings.length ? { tone: 'danger' as const } : {}) },
          { label: t('ao.vp.stat.coverage'), value: coverageValue, icon: 'check', ...(worst === null ? { hint: t(now.requirements ? 'ao.verif.couverture.noResponse' : 'ao.verif.couverture.noRequirements') } : { tone: worst >= 80 ? ('success' as const) : worst >= 50 ? ('warning' as const) : ('danger' as const) }) }
        ]
      },
      { kind: 'message', tone: 'info', text: t(exists ? 'ao.vp.live' : 'ao.vp.live.noReport') },
      { kind: 'list', title: t('ao.vp.extraction.title', { count: found }), items: extraction, empty: t('ao.verif.noTender') },
      { kind: 'list', title: t('ao.vp.missed.title', { count: now.missed.length }), items: missed, empty: t('ao.verif.oubliees.none') },
      { kind: 'list', title: t('ao.vp.coherence.title', { count: now.findings.length }), items: findings, empty: t('ao.verif.coherence.none') },
      ...(coverageBlocks.length
        ? coverageBlocks
        : [{ kind: 'list' as const, title: `4. ${t('ao.verif.couverture.title')}`, items: [], empty: t(now.requirements ? 'ao.verif.couverture.noResponse' : 'ao.verif.couverture.noRequirements') }])
    ]
  }
}

/** Les notes d'un dossier et de ses sous-dossiers, par ordre alphabétique. */
async function listNotes(services: Services, folder: string): Promise<string[]> {
  const listing = await services.fs.list(folder)
  const nested = await Promise.all(listing.folders.map((each) => listNotes(services, each)))
  return [...listing.files.filter((path) => path.endsWith('.md')), ...nested.flat()].sort((a, b) => a.localeCompare(b))
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
    views.tile({ id, label, icon, color, group, order, byDefault, description, run: shortcut(deps, command) })
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
    ...(deps.showPage ? { page: ANALYSES_PAGE } : {}),
    run: () => openAnalyses(deps),
    badge: () => nextDeadline(deps)
  })
  tile('ao.importer', t('ao.home.import'), 'upload', 'teal', 12, true, 'importer', t('ao.tile.import.desc'))
  tile('ao.calendrier', t('ao.home.calendar'), 'calendar', 'orange', 13, true, 'calendrier', t('ao.tile.calendar.desc'))
  views.tile({ id: 'ao.interroger', label: t('ao.tile.ask'), icon: 'chat', color: 'violet', group, order: 14, byDefault: true, description: t('ao.tile.ask.desc'), run: shortcut(deps, 'interroger'), badge: async () => (ai() ? null : { text: '!', tone: 'warning', label: t('ia.unavailable') }) })
  tile('ao.questionnaire', t('ao.tile.questionnaire'), 'list', 'violet', 15, false, 'questionnaire', t('ao.tile.questionnaire.desc'))
  tile('ao.verifier', t('ao.tile.verify'), 'check', 'green', 16, false, 'verifier-exigences', t('ao.tile.verify.desc'))
  tile('ao.qualite', t('ao.tile.quality'), 'star', 'green', 17, false, 'qualite-exigences', t('ao.tile.quality.desc'))
  tile('ao.relire', t('ao.tile.review'), 'spark', 'violet', 18, false, 'relire-exigences-ia', t('ao.tile.review.desc'))
  views.home({ id: 'ao.analyses', title: t('ao.home.title'), icon: 'folder', order: 10, area: 'main', load: () => analysesSection(deps) })
  views.page({ id: ANALYSES_PAGE, title: t('ao.home.title'), icon: 'folder', load: () => analysesPage(deps) })
  // Les notes d'une analyse qui ont une page : un autre module qui les ouvre (un workflow) ouvre la page.
  if (deps.showPage) views.notePage?.((path) => notePageOf(deps, path))
  views.page({ id: ANALYSIS_PAGE, title: t('ao.fiche.title'), icon: 'folder', parent: ANALYSES_PAGE, load: (param) => analysisPage(deps, param) })
  views.page({ id: PIECE_PAGE, title: t('ao.piece.fiche.title'), icon: 'file', parent: ANALYSES_PAGE, load: (param) => piecePage(deps, param) })
  views.page({ id: CALENDAR_PAGE, title: t('ao.cp.title'), icon: 'calendar', parent: ANALYSES_PAGE, load: (param) => calendarPage(deps, param) })
  views.page({ id: VERIFICATION_PAGE, title: t('ao.vp.title'), icon: 'check', parent: ANALYSES_PAGE, load: (param) => verificationPage(deps, param) })
  views.page({ id: QUALITY_PAGE, title: t('ao.qp.title'), icon: 'star', parent: ANALYSES_PAGE, load: (param) => qualityPage(deps, param) })
  views.page({ id: QUESTIONNAIRE_PAGE, title: t('ao.qn.title'), icon: 'list', parent: ANALYSES_PAGE, load: (param) => questionnairePage(deps, param) })
  views.page({ id: QUESTIONNAIRE_ITEM_PAGE, title: t('ao.qn.title'), icon: 'chat', parent: ANALYSES_PAGE, load: (param) => questionnaireItemPage(deps, param) })
  views.page({ id: QUESTION_PAGE, title: t('ao.question.title'), icon: 'chat', parent: ANALYSES_PAGE, load: (param) => questionPage(deps, param) })
  views.page({ id: PRODUCED_PAGE, title: t('ao.note.page.title'), icon: 'file', parent: ANALYSES_PAGE, load: (param) => producedPage(deps, param) })
  views.page({ id: CANDIDATE_PAGE, title: t('ao.candidat.title'), icon: 'folder', parent: ANALYSES_PAGE, load: (param) => candidatePage(deps, param) })
  views.nav({ id: 'ao.analyses', label: t('ao.home.nav'), icon: 'folder', order: 10, ...(deps.showPage ? { page: ANALYSES_PAGE } : {}), run: () => openAnalyses(deps) })
}

/**
 * La page d'une note d'analyse : la fiche de l'analyse pour sa note ; celle d'une pièce,
 * d'une exigence ; le calendrier, la vérification, la qualité, le questionnaire, une
 * question ; une autre note du dossier Analyse, lisible en page. `null` : pas une note
 * d'analyse.
 */
export async function notePageOf(deps: HomeDeps, path: string): Promise<string | null> {
  const services = deps.services()
  const analysis = (await listAnalyses(services)).find((each) => path === each.note || path.startsWith(`${each.folder}/`))
  if (!analysis) return null
  if (path === analysis.note) return analysisPageOf(analysis)
  if (path === calendarPath(analysis)) return calendarPageOf(path)
  if (path === reportPath(analysis)) return verificationPageOf(path)
  if (path === qualityPath(analysis)) return qualityPageOf(path)
  if (path === questionnairePath(analysis)) return questionnairePageOf(path)
  if (path.startsWith(`${questionsFolder(analysis)}/`)) return questionPageOf(path)
  if (path.startsWith(`${analysis.folder}/Analyse/`) && path.endsWith('.md')) return producedPageOf(path)
  if (path.startsWith(`${requirementsFolder(analysis)}/`) && path.endsWith('.md')) return requirementPageOf(path)
  return (await pieceAt(services, path)) ? piecePageOf(path) : null
}

/** Les analyses : leur page, quand la plateforme en a ; sinon la fenêtre pour en choisir une. */
export async function openAnalyses(deps: HomeDeps): Promise<void> {
  if (deps.showPage) deps.showPage(ANALYSES_PAGE)
  else await pickAnalysis(deps)
}

/** Choisir une analyse et ouvrir sa note ; sans analyse, en créer une. */
async function pickAnalysis(deps: HomeDeps): Promise<void> {
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
