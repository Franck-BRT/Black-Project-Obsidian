// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **pages** des programmes, en graphique : les programmes en tuiles, leurs projets avec
 * leur parcours de phases (des tuiles reliées par des flèches, comme un logigramme), un
 * projet et ses affaires, une phase et ce qu'on y fait ; les types de projet, que l'on
 * dessine phase par phase.
 */

import { groupingOf, setGrouping } from '../../core/grouping'
import { pageWith, type Breadcrumb, type Card, type HomeBlock, type JourneyPhase, type JourneySpan, type JourneyStage, type ListItem, type PageView, type Stat, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { phaseKind, type PhaseContext } from './kinds'
import { daysBetween, flatFolders, FREE_KIND, isLate, PHASE_STATUSES, slipOf, progressOf, stagesOf, type Affaire, type FolderSpec, type PhaseSpec, type PhaseStatus, type Programme, type Project, type ProjectPhase, type ProjectType } from './model'
import type { ProgrammeStore } from './store'
import type { Direction } from './types'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const PROGRAMMES_PAGE = 'programmes'
export const PROGRAMME_PAGE = 'programmes.programme'
export const PROJECT_PAGE = 'programmes.projet'
export const PHASE_PAGE = 'programmes.phase'
export const TYPES_PAGE = 'programmes.types'
export const TYPE_PAGE = 'programmes.type'

export const programmePageOf = (path: string): string => pageWith(PROGRAMME_PAGE, encodeURIComponent(path))
export const projectPageOf = (path: string): string => pageWith(PROJECT_PAGE, encodeURIComponent(path))
export const phasePageOf = (path: string, id: string): string => pageWith(PHASE_PAGE, `${encodeURIComponent(path)}|${encodeURIComponent(id)}`)
export const typePageOf = (id: string): string => pageWith(TYPE_PAGE, encodeURIComponent(id))

export interface HomeDeps {
  t: Translate
  store: ProgrammeStore
  types(): ProjectType[]
  showPage?(id: string): void
  openNote(path: string): Promise<void>
  newProgramme(): Promise<void>
  editProgramme(path: string): Promise<void>
  newProject(programme?: string, type?: string): Promise<void>
  newAffaire(project: string): Promise<void>
  chooseAffaireStatus(path: string): Promise<void>
  setPhaseStatus(project: string, phase: string, status: PhaseStatus): Promise<void>
  editPhaseDates(project: string, phase: string): Promise<void>
  phaseContext(project: Project, phase: ProjectPhase): PhaseContext
  newType(): Promise<void>
  /** Exporter un type de projet (ou tous, sans `id`) dans un fichier, à se passer. */
  exportTypes?(id?: string): Promise<void>
  /** Importer des types de projet d'un fichier. */
  importTypes?(): Promise<void>
  editType(id: string): Promise<void>
  copyType(id: string): Promise<void>
  deleteType(id: string): Promise<void>
  editTypePhase(type: string, phase: string): Promise<void>
  addTypePhase(type: string, stage: number | 'new'): Promise<void>
  moveTypePhase(type: string, phase: string, direction: Direction): Promise<void>
  removeTypePhase(type: string, phase: string): Promise<void>
  addTypeSpan(type: string): Promise<void>
  /** Aujourd'hui (AAAA-MM-JJ) : une phase dont la fin prévue est passée est en retard. */
  today(): string
  /** Un type de pièce en mots : « CCTP — Cahier des clauses techniques particulières ». */
  docLabel(type: string): string
  /** Démarrer le projet (sa date) : les dates prévues de ses phases en découlent. */
  startProject(project: string): Promise<void>
  /** Les documents qu'une phase d'un projet attend : les choisir. */
  chooseDocuments(project: string, phase: string): Promise<void>
  /** Un document attendu : reçu, ou plus. */
  setDocument(project: string, phase: string, index: number, received: boolean): Promise<void>
  /** Un document attendu : relier le fichier qui le porte (il est alors reçu). */
  linkDocument(project: string, phase: string, index: number): Promise<void>
  editTypeSpan(type: string, span: string): Promise<void>
  removeTypeSpan(type: string, span: string): Promise<void>
  /**
   * Les documents d'un programme (`project` absent) ou d'un projet, dans la bibliothèque des
   * documents projet : leur dossier (créé s'il manque), les documents, la page du dossier ; `null`
   * sans la bibliothèque.
   */
  projectDocuments?(programme: string, project?: string): Promise<{ folder: string; docs: { record: string; title: string; detail: string; category: string }[]; page: string | null } | null>
  /** La page d'un dossier de la bibliothèque (un répertoire d'un projet) ; `null` hors d'elle. */
  folderPage?(folder: string): string | null
  /** Verser des documents dans un dossier (le choix des fichiers). */
  pourProjectDocuments?(folder: string): Promise<void>
  /** Verser des fichiers glissés sur la page dans un dossier. */
  dropProjectDocuments?(folder: string, files: readonly { name: string; bytes: Uint8Array }[]): Promise<void>
  /** Les répertoires des documents d'un type : en ajouter un (à la racine, ou dans un autre), le renommer, dire ce qu'on y attend, le retirer. */
  addTypeFolder?(type: string, parent: string | null): Promise<void>
  renameTypeFolder?(type: string, folder: string): Promise<void>
  chooseFolderExpects?(type: string, folder: string): Promise<void>
  removeTypeFolder?(type: string, folder: string): Promise<void>
  /** Créer les répertoires d'un projet qui manquent (ses chemins sous son répertoire). */
  ensureProjectFolders?(folder: string, paths: readonly string[]): Promise<void>
  /** La bibliothèque est-elle là (sans elle, pas de documents de référence) ? */
  referencesAvailable?(): boolean
  /** Un document de la bibliothèque, par sa fiche ; `null` s'il n'y est plus (ou sans la bibliothèque). */
  referenceDoc?(record: string): Promise<{ title: string; detail: string; reference: boolean } | null>
  /** Choisir les documents de référence d'un programme ou d'un projet (sa note). */
  chooseReferences?(path: string): Promise<void>
  /** Ne plus appeler un document de référence. */
  removeReference?(path: string, record: string): Promise<void>
  /** Ouvrir la fiche d'un document de la bibliothèque. */
  showReference?(record: string): void
}

/** Le nom d'une sorte de phase. */
export function kindLabel(t: Translate, kind: string): string {
  if (kind === FREE_KIND) return t('programmes.kind.libre')
  return phaseKind(kind)?.label ?? t('programmes.kind.unknown', { kind })
}

/** Le glissement depuis le planning initial, en quelques mots : « (+3 j) », « (−2 j) » ; aucun : rien. */
function slipText(t: Translate, days: number): string {
  return days ? ` ${t(days > 0 ? 'programmes.slip.later' : 'programmes.slip.earlier', { days: Math.abs(days) })}` : ''
}

/** Un jour en court : « 12/03 » (l'année, si ce n'est pas celle d'aujourd'hui). */
export function shortDay(day: string, year = new Date().getFullYear()): string {
  const [y = '', m = '', d = ''] = day.split('-')
  return Number(y) === year ? `${d}/${m}` : `${d}/${m}/${y}`
}

const STATUS_TONE: Record<PhaseStatus, 'neutral' | 'info' | 'success' | 'warning'> = { 'a-venir': 'neutral', 'en-cours': 'info', terminee: 'success', 'sans-objet': 'warning' }

/** Où en est un projet : ses phases terminées (ou sans objet) sur toutes, celles en cours. */
export function advance(project: Project): { done: number; total: number; current: ProjectPhase[] } {
  const total = project.phases.length
  const done = project.phases.filter((phase) => phase.status === 'terminee' || phase.status === 'sans-objet').length
  return { done, total, current: project.phases.filter((phase) => phase.status === 'en-cours') }
}

/** Le parcours d'un projet : ses étapes, ses phases en tuiles, leur état. */
async function projectStages(deps: HomeDeps, project: Project, open: boolean): Promise<JourneyStage[]> {
  const { t } = deps
  return Promise.all(
    stagesOf(project.phases).map(async (stage, at) => ({
      id: `etape-${at + 1}`,
      caption: t('programmes.stage', { number: at + 1 }),
      phases: await Promise.all(
        stage.map(async (phase): Promise<JourneyPhase> => {
          const late = isLate(phase, deps.today())
          const docs = phase.documents ?? []
          const detail = [
            (await phaseKind(phase.kind)?.detail?.(phase).catch(() => null)) ?? (phase.end ? t('programmes.phase.endOn', { date: shortDay(phase.end) }) : ''),
            phase.plannedStart && phase.status !== 'terminee' ? t('programmes.phase.planned', { from: shortDay(phase.plannedStart), to: shortDay(phase.plannedEnd ?? phase.plannedStart) }) + slipText(t, slipOf(phase)) : '',
            docs.length ? t('programmes.docs.count', { received: docs.filter((doc) => doc.received).length, total: docs.length }) : ''
          ]
            .filter(Boolean)
            .join(' · ')
          return {
            id: phase.id,
            label: phase.name,
            icon: phase.icon,
            color: phase.color,
            ...(phase.kind !== FREE_KIND ? { caption: kindLabel(t, phase.kind) } : {}),
            ...(detail ? { detail } : {}),
            status: late ? { label: t('programmes.status.late'), tone: 'danger' as const } : { label: t(`programmes.status.${phase.status}`), tone: STATUS_TONE[phase.status] },
            progress: progressOf(phase.status),
            ...(open && deps.showPage ? { open: { id: 'open', label: t('programmes.phase.open', { name: phase.name }), tooltip: t('programmes.phase.open', { name: phase.name }), run: () => deps.showPage?.(phasePageOf(project.path, phase.id)) } } : {})
          }
        })
      )
    }))
  )
}

/**
 * Les phases englobantes d'un projet, en bandeaux : leurs étapes (rangées comme celles du
 * parcours) ; terminées quand toutes leurs phases le sont (ou sans objet), en cours quand
 * l'une l'est ou qu'elles sont commencées.
 */
function projectSpans(deps: HomeDeps, project: Project): JourneySpan[] {
  const { t } = deps
  const numbers = [...new Set(project.phases.map((phase) => phase.stage))].sort((a, b) => a - b)
  const rank = (stage: number) => {
    const at = numbers.findIndex((each) => each >= stage)
    return at < 0 ? numbers.length - 1 : at
  }
  return project.spans.map((span) => {
    const covered = project.phases.filter((phase) => phase.stage >= span.from && phase.stage <= span.to)
    const done = covered.filter((phase) => phase.status === 'terminee' || phase.status === 'sans-objet').length
    const progress = covered.length && done === covered.length ? 'done' : covered.some((phase) => phase.status === 'en-cours') || done ? 'current' : 'todo'
    return { id: span.id, label: span.name, color: span.color, from: rank(span.from), to: rank(span.to), detail: t('programmes.project.advance', { done, total: covered.length }), progress }
  })
}

/** Les phases englobantes d'un type, en bandeaux ; dans l'éditeur, de quoi les modifier ou les retirer. */
function typeSpans(deps: HomeDeps, type: ProjectType, editing: boolean): JourneySpan[] {
  const { t } = deps
  return (type.spans ?? []).map((span) => ({
    id: span.id,
    label: span.name,
    color: span.color,
    from: span.from,
    to: span.to,
    detail: span.from === span.to ? t('programmes.span.oneStage', { from: span.from + 1 }) : t('programmes.span.stages', { from: span.from + 1, to: span.to + 1 }),
    ...(editing
      ? {
          open: { id: 'edit', label: t('programmes.span.edit'), tooltip: t('programmes.span.edit'), run: () => deps.editTypeSpan(type.id, span.id) },
          tools: [
            { id: 'edit', label: t('programmes.span.edit'), icon: 'edit' as const, run: () => deps.editTypeSpan(type.id, span.id) },
            { id: 'remove', label: t('programmes.span.remove'), icon: 'trash' as const, run: () => deps.removeTypeSpan(type.id, span.id) }
          ]
        }
      : {})
  }))
}

/**
 * Un projet en parcours miniature, son titre ouvre sa page ; ses phases repliées d'origine (son
 * en-tête dit l'avancement), ce que l'utilisateur en fait retenu page par page.
 */
async function projectJourney(deps: HomeDeps, project: Project, page: string, programme?: Programme): Promise<HomeBlock> {
  const compact = true
  const { t } = deps
  const { done, total, current } = advance(project)
  const affaires = (await deps.store.affaires(project)).length
  return {
    kind: 'journey',
    title: project.name,
    label: t('programmes.project.journey', { name: project.name }),
    subtitle: [programme?.name, project.typeName, t('programmes.project.advance', { done, total }), t('programmes.project.affaires', { count: affaires }), current.length ? t('programmes.project.current', { names: current.map((phase) => phase.name).join(', ') }) : ''].filter(Boolean).join(' · '),
    ...(done === total && total ? { badge: { label: t('programmes.project.finished'), tone: 'success' as const } } : {}),
    stages: await projectStages(deps, project, !compact),
    spans: projectSpans(deps, project),
    compact,
    fold: { id: `${page}|${project.path}`, collapsed: true },
    ...(deps.showPage ? { open: { id: 'open', label: t('programmes.project.open'), run: () => deps.showPage?.(projectPageOf(project.path)) } } : {})
  }
}

// ── La vue d'une page : parcours, cartes, liste, tableau ─────────────────────────

/**
 * Comment une page montre ses projets (ou les phases d'un projet) : en **parcours** (les phases
 * en tuiles reliées par des flèches), en **cartes**, en **liste** (une ligne chacun) ou en
 * **tableau** (une colonne par fait). Choisie page par page, retenue d'une ouverture à l'autre.
 */
export type ProgrammesView = 'parcours' | 'cards' | 'list' | 'table'
export const PROGRAMMES_VIEWS: readonly ProgrammesView[] = ['parcours', 'cards', 'list', 'table']

const viewKey = (page: string) => `${page}#vue`
const viewOf = (page: string): ProgrammesView => {
  const chosen = groupingOf(viewKey(page), 'parcours')
  return (PROGRAMMES_VIEWS as readonly string[]).includes(chosen) ? (chosen as ProgrammesView) : 'parcours'
}

/** Le sélecteur « Vue » d'une page, et l'affichage de ses cartes qui en découle. */
function viewChoice(deps: HomeDeps, page: string): { view: ProgrammesView; grouping: NonNullable<PageView['grouping']>; layouts: PageView['layouts'] } {
  const { t } = deps
  const view = viewOf(page)
  return {
    view,
    grouping: { label: t('programmes.view.label'), current: view, options: PROGRAMMES_VIEWS.map((id) => ({ id, label: t(`programmes.view.${id}`), icon: VIEW_ICON[id], run: () => setGrouping(viewKey(page), id) })) },
    // En parcours, les cartes (programmes, affaires) en grille ; sinon, comme la vue choisie.
    layouts: [view === 'parcours' ? 'cards' : view]
  }
}

const VIEW_ICON: Record<ProgrammesView, 'flow' | 'grid' | 'list' | 'columns'> = { parcours: 'flow', cards: 'grid', list: 'list', table: 'columns' }

/** Un projet en carte (vues cartes, liste, tableau) : son avancement, ses phases en cours, ses dates. */
async function projectCard(deps: HomeDeps, project: Project, programme?: Programme): Promise<Card> {
  const { t } = deps
  const { done, total, current } = advance(project)
  const affaires = (await deps.store.affaires(project)).length
  const late = project.phases.filter((phase) => isLate(phase, deps.today())).length
  const ends = project.phases.map((phase) => phase.plannedEnd).filter((day): day is string => !!day).sort()
  const next = project.phases.find((phase) => phase.status === 'a-venir')
  return {
    id: project.path,
    title: project.name,
    subtitle: [programme?.name, project.typeName].filter(Boolean).join(' · '),
    icon: project.icon,
    color: project.color,
    badges: [
      ...(done === total && total ? [{ label: t('programmes.project.finished'), tone: 'success' as const }] : []),
      ...(late ? [{ label: t('programmes.project.lateHint', { count: late }), tone: 'danger' as const }] : []),
      ...(!project.start ? [{ label: t('programmes.project.notStarted'), tone: 'neutral' as const }] : [])
    ],
    ...(project.description ? { text: project.description } : {}),
    facts: [
      { label: t('programmes.project.advanceLabel'), value: t('programmes.project.advance', { done, total }) },
      { label: t('programmes.project.currentLabel'), value: current.map((phase) => phase.name).join(', ') || (next ? t('programmes.project.next', { name: next.name }) : '—') },
      { label: t('programmes.project.startLabel'), value: project.start ? shortDay(project.start) : '—' },
      { label: t('programmes.project.endLabel'), value: ends.length ? shortDay(ends.at(-1)!) : '—' },
      { label: t('programmes.fact.affaires'), value: String(affaires) }
    ],
    ...(deps.showPage ? { open: { id: 'open', label: t('programmes.project.open'), run: () => deps.showPage?.(projectPageOf(project.path)) } } : {}),
    tags: [`projet-${project.typeId}`]
  }
}

/** Une phase d'un projet en carte : son état, ses dates prévues (et réelles), ses documents attendus. */
function phaseCard(deps: HomeDeps, project: Project, phase: ProjectPhase): Card {
  const { t } = deps
  const late = isLate(phase, deps.today())
  const docs = phase.documents ?? []
  return {
    id: `${project.path}#${phase.id}`,
    title: phase.name,
    subtitle: [t('programmes.view.stage', { stage: phase.stage }), kindLabel(t, phase.kind)].join(' · '),
    icon: phase.icon,
    color: phase.color,
    badges: [late ? { label: t('programmes.status.late'), tone: 'danger' as const } : { label: t(`programmes.status.${phase.status}`), tone: STATUS_TONE[phase.status] }],
    ...(phase.description ? { text: phase.description } : {}),
    facts: [
      { label: t('programmes.view.plannedStart'), value: phase.plannedStart ? shortDay(phase.plannedStart) : '—' },
      { label: t('programmes.view.plannedEnd'), value: phase.plannedEnd ? `${shortDay(phase.plannedEnd)}${slipText(t, slipOf(phase))}` : '—' },
      { label: t('programmes.view.done'), value: phase.end ? shortDay(phase.end) : '—' },
      { label: t('programmes.view.documents'), value: docs.length ? `${docs.filter((doc) => doc.received).length}/${docs.length}` : '—' }
    ],
    ...(deps.showPage ? { open: { id: 'open', label: t('programmes.phase.open', { name: phase.name }), run: () => deps.showPage?.(phasePageOf(project.path, phase.id)) } } : {}),
    tags: [`etat-${late ? 'retard' : phase.status}`]
  }
}

// ── Les programmes ─────────────────────────────────────────────────────────────────

async function programmesPage(deps: HomeDeps): Promise<PageView> {
  const { t, store } = deps
  const programmes = await store.programmes()
  const projectsOf = new Map<string, Project[]>()
  for (const programme of programmes) projectsOf.set(programme.path, await store.projects(programme))
  const cards: Card[] = await Promise.all(
    programmes.map(async (programme): Promise<Card> => {
      const projects = projectsOf.get(programme.path) ?? []
      const affaires = (await Promise.all(projects.map((project) => store.affaires(project)))).flat()
      const running = projects.filter((project) => advance(project).current.length).length
      return {
        id: programme.path,
        title: programme.name,
        ...(programme.code ? { subtitle: programme.code } : {}),
        icon: programme.icon,
        color: programme.color,
        ...(programme.description ? { text: programme.description } : {}),
        facts: [
          { label: t('programmes.fact.projects'), value: String(projects.length) },
          { label: t('programmes.fact.affaires'), value: String(affaires.length) },
          { label: t('programmes.fact.running'), value: String(running) }
        ],
        ...(deps.showPage ? { open: { id: 'open', label: t('programmes.programme.open'), run: () => deps.showPage?.(programmePageOf(programme.path)) } } : {})
      }
    })
  )
  const choice = viewChoice(deps, PROGRAMMES_PAGE)
  // Les projets : en parcours, ou en cartes (liste, tableau).
  const journeys: HomeBlock[] = []
  const projectCards: Card[] = []
  for (const programme of programmes)
    for (const project of projectsOf.get(programme.path) ?? []) {
      if (choice.view === 'parcours') journeys.push(await projectJourney(deps, project, PROGRAMMES_PAGE, programme))
      else projectCards.push(await projectCard(deps, project, programme))
    }
  const projectBlocks: HomeBlock[] = choice.view === 'parcours' ? journeys : projectCards.length ? [{ kind: 'cards', cards: projectCards }] : []
  const projectCount = journeys.length + projectCards.length
  return {
    subtitle: t('programmes.page.subtitle', { folder: store.root }),
    grouping: choice.grouping,
    layouts: choice.layouts,
    actions: [
      { id: 'new', label: t('programmes.programme.new'), icon: 'plus', primary: true, run: () => deps.newProgramme() },
      { id: 'project', label: t('programmes.project.new'), icon: 'flow', run: () => deps.newProject() },
      ...(deps.showPage ? [{ id: 'types', label: t('programmes.types.title'), tooltip: t('programmes.types.tip'), icon: 'grid' as const, run: () => deps.showPage?.(TYPES_PAGE) }] : [])
    ],
    blocks: programmes.length
      ? [
          { kind: 'cards', title: t('programmes.page.programmes'), cards },
          ...(projectCount ? [{ kind: 'section' as const, id: 'programmes.projets', title: t('programmes.page.projects'), subtitle: t('programmes.page.projects.count', { count: projectCount }), icon: 'flow' as const, blocks: projectBlocks }] : [])
        ]
      : [{ kind: 'message', tone: 'info', text: t('programmes.page.empty'), actions: [{ id: 'first', label: t('programmes.programme.new'), icon: 'plus', primary: true, run: () => deps.newProgramme() }] }],
    search: { label: t('programmes.page.search') }
  }
}

function crumbs(deps: HomeDeps, items: { label: string; page?: string }[]): Breadcrumb {
  const { t } = deps
  const step = (id: string, label: string, page?: string) => ({ id, label, ...(page && deps.showPage ? { run: () => deps.showPage?.(page) } : {}) })
  return { label: t('programmes.crumbs'), items: [step('programmes', t('programmes.nav'), PROGRAMMES_PAGE), ...items.map((item, at) => step(`niveau-${at}`, item.label, item.page))] }
}

async function programmePage(deps: HomeDeps, param?: string): Promise<PageView> {
  const { t, store } = deps
  const programme = param ? await store.programme(decodeURIComponent(param)) : null
  if (!programme) return { blocks: [{ kind: 'message', tone: 'warning', text: t('programmes.programme.missing') }] }
  const projects = await store.projects(programme)
  const affaires = (await Promise.all(projects.map((project) => store.affaires(project)))).flat()
  const stats: Stat[] = [
    { label: t('programmes.fact.projects'), value: String(projects.length), icon: 'flow' },
    { label: t('programmes.fact.affaires'), value: String(affaires.length), icon: 'building' },
    { label: t('programmes.fact.running'), value: String(projects.filter((project) => advance(project).current.length).length), icon: 'play' }
  ]
  const choice = viewChoice(deps, PROGRAMME_PAGE)
  // Ses projets : en parcours, ou en cartes (liste, tableau).
  const journeys: HomeBlock[] = []
  if (choice.view === 'parcours') for (const project of projects) journeys.push(await projectJourney(deps, project, PROGRAMME_PAGE))
  else if (projects.length) journeys.push({ kind: 'cards', title: t('programmes.fact.projects'), cards: await Promise.all(projects.map((project) => projectCard(deps, project))) })
  const documents = await documentsSection(deps, programme.name)
  return {
    title: programme.name,
    grouping: choice.grouping,
    layouts: choice.layouts,
    ...(documents.drop ? { drop: documents.drop } : {}),
    breadcrumb: crumbs(deps, [{ label: programme.name }]),
    subtitle: [programme.code, programme.description].filter(Boolean).join(' · '),
    actions: [
      { id: 'project', label: t('programmes.project.new'), icon: 'plus', primary: true, run: () => deps.newProject(programme.path) },
      { id: 'edit', label: t('programmes.programme.edit'), icon: 'edit', run: () => deps.editProgramme(programme.path) },
      { id: 'note', label: t('programmes.note'), icon: 'book', run: () => deps.openNote(programme.path) }
    ],
    blocks: [
      { kind: 'stats', stats },
      ...(journeys.length ? journeys : [{ kind: 'message' as const, tone: 'info' as const, text: t('programmes.programme.empty'), actions: [{ id: 'first', label: t('programmes.project.new'), icon: 'plus' as const, primary: true, run: () => deps.newProject(programme.path) }] }]),
      ...documents.blocks,
      ...(await referencesSection(deps, programme, 'programme'))
    ]
  }
}

/**
 * Les **documents de référence** d'un programme ou d'un projet : ceux qu'il appelle, rangés
 * dans la bibliothèque des documents de référence ; les choisir, en retirer un, ouvrir sa fiche.
 * Rien sans la bibliothèque.
 */
async function referencesSection(deps: HomeDeps, owner: { path: string; references: readonly string[] }, kind: 'programme' | 'projet'): Promise<HomeBlock[]> {
  const { t } = deps
  if (!deps.referenceDoc || !deps.chooseReferences || deps.referencesAvailable?.() === false) return []
  const items: ListItem[] = []
  for (const record of owner.references) {
    const doc = await deps.referenceDoc(record)
    const name = record.slice(record.lastIndexOf('/') + 1).replace(/\.md$/, '')
    items.push({
      id: record,
      title: doc?.title ?? name,
      detail: doc ? [doc.detail, doc.reference ? '' : t('programmes.refs.outside')].filter(Boolean).join(' · ') || t('programmes.refs.noDetail') : t('programmes.refs.gone'),
      ...(doc ? {} : { tone: 'warning' as const }),
      ...(doc && deps.showReference ? { open: { id: 'open', label: t('programmes.refs.open'), run: () => deps.showReference!(record) } } : {}),
      ...(deps.removeReference ? { tools: [{ id: `remove-${record}`, label: t('programmes.refs.remove'), icon: 'cross' as const, run: () => deps.removeReference!(owner.path, record) }] } : {})
    })
  }
  const choose: ViewAction = { id: 'choose-references', label: t('programmes.refs.choose'), tooltip: t(`programmes.refs.choose.${kind}.tip`), icon: 'star', run: () => deps.chooseReferences!(owner.path) }
  return [
    {
      kind: 'section',
      id: `programmes.${kind}.references`,
      title: t('programmes.refs.title'),
      subtitle: t('programmes.refs.count', { count: items.length }),
      icon: 'star',
      blocks: [
        { kind: 'message', tone: 'info', text: t(items.length ? `programmes.refs.intro.${kind}` : `programmes.refs.none.${kind}`), actions: [{ ...choose, ...(items.length ? {} : { primary: true }) }] },
        ...(items.length ? [{ kind: 'list' as const, items }] : [])
      ]
    }
  ]
}

/**
 * Les **documents** d'un programme ou d'un projet, rangés dans la bibliothèque des documents
 * projet (un répertoire par programme, puis par projet) : les ouvrir, en verser ; la page entière
 * les reçoit aussi glissés-déposés. Rien sans la bibliothèque.
 */
async function documentsSection(
  deps: HomeDeps,
  programme: string,
  project?: string,
  folders: readonly FolderSpec[] = []
): Promise<{ blocks: HomeBlock[]; drop?: { label: string; hint: string; run(files: readonly { name: string; bytes: Uint8Array }[]): Promise<void> } }> {
  const { t } = deps
  if (!deps.projectDocuments || deps.referencesAvailable?.() === false) return { blocks: [] }
  const found = await deps.projectDocuments(programme, project)
  if (!found) return { blocks: [] }
  const kind = project ? 'projet' : 'programme'
  const items: ListItem[] = found.docs.map((doc) => ({
    id: doc.record,
    title: doc.title,
    ...(doc.detail ? { detail: doc.detail } : {}),
    ...(deps.showReference ? { open: { id: 'open', label: t('programmes.refs.open'), run: () => deps.showReference!(doc.record) } } : {})
  }))
  const actions: ViewAction[] = [
    ...(deps.pourProjectDocuments ? [{ id: 'pour-documents', label: t('programmes.docs.pour'), icon: 'upload' as const, ...(items.length ? {} : { primary: true }), run: () => deps.pourProjectDocuments!(found.folder) }] : []),
    ...(found.page ? [{ id: 'library-folder', label: t('programmes.docs.inLibrary'), tooltip: t('programmes.docs.inLibrary.tip', { folder: found.folder }), icon: 'book' as const, run: () => deps.showPage?.(found.page!) }] : [])
  ]
  const where = project ?? programme
  // Ses répertoires attendus (de son type) : créés s'ils manquent ; dans chacun, ce qu'on attend, et ce qui y est.
  const flat = flatFolders(folders)
  if (flat.length) await deps.ensureProjectFolders?.(found.folder, flat.map((each) => each.path))
  const expected: ListItem[] = flat.map((each) => {
    const here = `${found.folder}/${each.path}`
    const inside = found.docs.filter((doc) => doc.record.slice(0, doc.record.lastIndexOf('/')) === here)
    const wanted = each.expects ?? []
    const has = (code: string) => inside.some((doc) => doc.category.toLowerCase() === code.toLowerCase())
    const missing = wanted.filter((code) => !has(code))
    const page = deps.folderPage?.(here)
    return {
      id: `folder:${each.id}`,
      title: each.path.split('/').join(' › '),
      detail: [
        ...wanted.map((code) => t(has(code) ? 'programmes.folders.got' : 'programmes.folders.missing', { type: deps.docLabel(code) })),
        t('programmes.refs.count', { count: inside.length })
      ].join(' · '),
      icon: 'folder' as const,
      tone: wanted.length ? (missing.length ? ('warning' as const) : ('success' as const)) : ('neutral' as const),
      ...(page && deps.showPage ? { open: { id: 'open', label: t('programmes.docs.inLibrary'), run: () => deps.showPage!(page) } } : {})
    }
  })
  const awaited = flat.reduce((sum, each) => sum + (each.expects?.length ?? 0), 0)
  const received = expected.filter((item) => item.tone === 'success').length
  return {
    blocks: [
      {
        kind: 'section',
        id: `programmes.${kind}.documents`,
        title: t(`programmes.docs.title.${kind}`),
        subtitle: [t('programmes.refs.count', { count: items.length }), ...(awaited ? [t('programmes.folders.complete', { done: received, total: expected.filter((item) => item.tone !== 'neutral').length })] : [])].join(' · '),
        icon: 'file',
        blocks: [
          { kind: 'message', tone: 'info', text: t(items.length ? `programmes.docs.intro.${kind}` : `programmes.docs.none.${kind}`, { folder: found.folder }), actions },
          ...(expected.length ? [{ kind: 'list' as const, title: t('programmes.folders.expected'), items: expected }] : []),
          ...(items.length ? [expected.length ? { kind: 'list' as const, title: t('programmes.folders.all'), items } : { kind: 'list' as const, items }] : [])
        ]
      }
    ],
    ...(deps.dropProjectDocuments ? { drop: { label: t('programmes.docs.drop', { name: where }), hint: t('programmes.docs.drop.hint'), run: (files) => deps.dropProjectDocuments!(found.folder, files) } } : {})
  }
}

// ── Un projet ───────────────────────────────────────────────────────────────────────

const AFFAIRE_TONE: Record<Affaire['status'], 'info' | 'success' | 'danger' | 'neutral'> = { 'en-cours': 'info', gagnee: 'success', perdue: 'danger', abandonnee: 'neutral' }

async function projectPage(deps: HomeDeps, param?: string): Promise<PageView> {
  const { t, store } = deps
  const project = param ? await store.project(decodeURIComponent(param)) : null
  if (!project) return { blocks: [{ kind: 'message', tone: 'warning', text: t('programmes.project.missing') }] }
  const programme = await store.programme(project.programme)
  const affaires = await store.affaires(project)
  const { done, total, current } = advance(project)
  const next = project.phases.find((phase) => phase.status === 'a-venir')
  const ends = project.phases.map((phase) => phase.plannedEnd).filter((day): day is string => !!day).sort()
  const initialEnds = project.phases.map((phase) => phase.initialEnd).filter((day): day is string => !!day).sort()
  const projectSlip = ends.length && initialEnds.length ? daysBetween(initialEnds.at(-1)!, ends.at(-1)!) : 0
  const late = project.phases.filter((phase) => isLate(phase, deps.today()))
  const stats: Stat[] = [
    { label: t('programmes.project.advanceLabel'), value: t('programmes.project.advance', { done, total }), icon: 'check', ...(done === total && total ? { tone: 'success' as const } : {}) },
    { label: t('programmes.project.currentLabel'), value: current.map((phase) => phase.name).join(', ') || (next ? t('programmes.project.next', { name: next.name }) : '—'), icon: 'play' },
    { label: t('programmes.project.startLabel'), value: project.start ? shortDay(project.start) : t('programmes.project.notStarted'), icon: 'calendar' },
    {
      label: t('programmes.project.endLabel'),
      value: ends.length ? shortDay(ends.at(-1)!) : '—',
      icon: 'clock',
      ...(late.length || projectSlip
        ? {
            ...(late.length || projectSlip > 0 ? { tone: (late.length ? 'danger' : 'warning') as 'danger' | 'warning' } : { tone: 'success' as const }),
            hint: [projectSlip ? t(projectSlip > 0 ? 'programmes.project.slipLater' : 'programmes.project.slipEarlier', { days: Math.abs(projectSlip), date: shortDay(initialEnds.at(-1)!) }) : '', late.length ? t('programmes.project.lateHint', { count: late.length }) : ''].filter(Boolean).join(' · ')
          }
        : {})
    },
    { label: t('programmes.fact.affaires'), value: String(affaires.length), icon: 'building' }
  ]
  const affaireCards: Card[] = affaires.map((affaire) => ({
    id: affaire.path,
    title: affaire.name,
    icon: 'building',
    color: project.color,
    ...([affaire.client, affaire.reference].filter(Boolean).length ? { subtitle: [affaire.client, affaire.reference].filter(Boolean).join(' · ') } : {}),
    badges: [{ label: t(`programmes.affaire.status.${affaire.status}`), tone: AFFAIRE_TONE[affaire.status] }],
    open: { id: 'open', label: t('programmes.affaire.open'), run: () => deps.openNote(affaire.path) },
    actions: [{ id: 'status', label: t('programmes.affaire.setStatus'), icon: 'edit', run: () => deps.chooseAffaireStatus(affaire.path) }]
  }))
  const documents = await documentsSection(deps, programme?.name ?? '—', project.name, project.folders)
  const choice = viewChoice(deps, PROJECT_PAGE)
  // Ses phases : en parcours, ou en cartes (liste, tableau), étape après étape — dans une section
  // repliée d'origine (pour la lisibilité) ; son en-tête dit l'avancement et la phase en cours.
  const phasesShown: HomeBlock =
    choice.view === 'parcours'
      ? { kind: 'journey', label: t('programmes.project.journey', { name: project.name }), stages: await projectStages(deps, project, true), spans: projectSpans(deps, project), legend: t('programmes.project.legend') }
      : { kind: 'cards', cards: [...project.phases].sort((a, b) => a.stage - b.stage).map((phase) => phaseCard(deps, project, phase)) }
  const phases: HomeBlock = {
    kind: 'section',
    id: 'programmes.projet.phases',
    title: t('programmes.project.phases'),
    subtitle: [t('programmes.project.advance', { done, total }), current.map((phase) => phase.name).join(', ') || (next ? t('programmes.project.next', { name: next.name }) : '')].filter(Boolean).join(' · '),
    icon: 'flow',
    collapsed: true,
    blocks: [phasesShown]
  }
  return {
    title: project.name,
    grouping: choice.grouping,
    layouts: choice.layouts,
    ...(documents.drop ? { drop: documents.drop } : {}),
    breadcrumb: crumbs(deps, [{ label: programme?.name ?? '—', ...(programme ? { page: programmePageOf(programme.path) } : {}) }, { label: project.name }]),
    subtitle: [project.typeName, project.description].filter(Boolean).join(' · '),
    actions: [
      { id: 'start', label: t(project.start ? 'programmes.project.restart' : 'programmes.project.start'), tooltip: t('programmes.project.start.tip'), icon: 'calendar', ...(project.start ? {} : { primary: true }), run: () => deps.startProject(project.path) },
      { id: 'affaire', label: t('programmes.affaire.new'), icon: 'plus', ...(project.start ? { primary: true } : {}), run: () => deps.newAffaire(project.path) },
      { id: 'note', label: t('programmes.note'), icon: 'book', run: () => deps.openNote(project.path) }
    ],
    blocks: [
      { kind: 'stats', stats },
      phases,
      {
        kind: 'section',
        id: 'programmes.projet.affaires',
        title: t('programmes.project.affairesTitle'),
        subtitle: t('programmes.project.affaires', { count: affaires.length }),
        icon: 'building',
        blocks: affaireCards.length ? [{ kind: 'cards', cards: affaireCards }] : [{ kind: 'message', tone: 'info', text: t('programmes.affaire.none'), actions: [{ id: 'first', label: t('programmes.affaire.new'), icon: 'plus', run: () => deps.newAffaire(project.path) }] }]
      },
      ...documents.blocks,
      ...(await referencesSection(deps, project, 'projet'))
    ]
  }
}

// ── Une phase ───────────────────────────────────────────────────────────────────────

async function phasePage(deps: HomeDeps, param?: string): Promise<PageView> {
  const { t, store } = deps
  const [rawPath = '', rawId = ''] = (param ?? '').split('|')
  const project = await store.project(decodeURIComponent(rawPath))
  const phase = project?.phases.find((each) => each.id === decodeURIComponent(rawId))
  if (!project || !phase) return { blocks: [{ kind: 'message', tone: 'warning', text: t('programmes.phase.missing') }] }
  const programme = await store.programme(project.programme)
  const kind = phaseKind(phase.kind)
  const context = deps.phaseContext(project, phase)
  const statusActions: ViewAction[] = PHASE_STATUSES.map((status) => ({
    id: `status-${status}`,
    label: t(`programmes.status.set.${status}`),
    icon: status === 'terminee' ? 'check' : status === 'en-cours' ? 'play' : status === 'sans-objet' ? 'cross' : 'clock',
    ...(status === phase.status ? { disabled: true, tooltip: t('programmes.status.already') } : {}),
    run: () => deps.setPhaseStatus(project.path, phase.id, status)
  }))
  const late = isLate(phase, deps.today())
  const dates = [
    phase.plannedStart ? t('programmes.phase.plannedLong', { from: shortDay(phase.plannedStart), to: shortDay(phase.plannedEnd ?? phase.plannedStart) }) : project.start ? '' : t('programmes.phase.notPlanned'),
    phase.initialStart && slipOf(phase) ? t('programmes.phase.initial', { from: shortDay(phase.initialStart), to: shortDay(phase.initialEnd ?? phase.initialStart) }) + slipText(t, slipOf(phase)) : '',
    phase.duration !== undefined ? t('programmes.phase.duration', { days: phase.duration }) : '',
    phase.start ? t('programmes.phase.startOn', { date: shortDay(phase.start) }) : '',
    phase.end ? t('programmes.phase.endOn', { date: shortDay(phase.end) }) : '',
    late ? t('programmes.phase.lateSays') : ''
  ]
    .filter(Boolean)
    .join(' · ')
  const docs = phase.documents ?? []
  const docItems: ListItem[] = docs.map((doc, index) => ({
    id: `doc-${index}`,
    title: [deps.docLabel(doc.type), doc.label].filter(Boolean).join(' — '),
    detail: doc.received ? [t('programmes.docs.received'), doc.on ? t('programmes.docs.receivedOn', { date: shortDay(doc.on) }) : '', doc.link ? doc.link.slice(doc.link.lastIndexOf('/') + 1) : ''].filter(Boolean).join(' · ') : t('programmes.docs.expected'),
    tone: doc.received ? ('success' as const) : ('warning' as const),
    ...(doc.link ? { open: { id: 'open', label: t('programmes.docs.open'), run: () => deps.openNote(doc.link!) } } : {}),
    tools: [
      doc.received
        ? { id: 'unreceive', label: t('programmes.docs.unreceive'), icon: 'cross' as const, run: () => deps.setDocument(project.path, phase.id, index, false) }
        : { id: 'receive', label: t('programmes.docs.receive'), icon: 'check' as const, run: () => deps.setDocument(project.path, phase.id, index, true) },
      { id: 'link', label: t('programmes.docs.link'), icon: 'file' as const, run: () => deps.linkDocument(project.path, phase.id, index) }
    ]
  }))
  return {
    title: phase.name,
    breadcrumb: crumbs(deps, [{ label: programme?.name ?? '—', ...(programme ? { page: programmePageOf(programme.path) } : {}) }, { label: project.name, page: projectPageOf(project.path) }, { label: phase.name }]),
    subtitle: [kindLabel(t, phase.kind), t('programmes.stage', { number: phase.stage }), t(`programmes.status.${phase.status}`)].join(' · '),
    actions: [
      ...(kind ? kind.actions(context) : []),
      { id: 'dates', label: t('programmes.phase.dates'), icon: 'calendar', run: () => deps.editPhaseDates(project.path, phase.id) },
      { id: 'documents', label: t('programmes.docs.choose'), tooltip: t('programmes.docs.choose.tip'), icon: 'file', run: () => deps.chooseDocuments(project.path, phase.id) }
    ],
    blocks: [
      { kind: 'journey', label: t('programmes.project.journey', { name: project.name }), title: project.name, stages: (await projectStages(deps, project, true)).map((stage) => ({ ...stage, phases: stage.phases.map((each) => (each.id === phase.id ? { ...each, progress: each.progress === 'done' ? 'done' : ('current' as const) } : { ...each, progress: each.progress === 'current' ? ('todo' as const) : each.progress })) })), compact: true, ...(deps.showPage ? { open: { id: 'open', label: t('programmes.project.open'), run: () => deps.showPage?.(projectPageOf(project.path)) } } : {}) },
      { kind: 'message', tone: late ? 'danger' : STATUS_TONE[phase.status] === 'neutral' ? 'info' : STATUS_TONE[phase.status], text: [t(`programmes.status.says.${phase.status}`), dates, phase.description ?? ''].filter(Boolean).join(' — '), actions: statusActions },
      ...(docs.length ? [{ kind: 'list' as const, title: t('programmes.docs.title', { received: docs.filter((doc) => doc.received).length, total: docs.length }), items: docItems }] : []),
      ...(kind?.blocks ? await kind.blocks(context) : []),
      ...(phase.kind === FREE_KIND ? [] : kind ? [] : [{ kind: 'message' as const, tone: 'warning' as const, text: t('programmes.kind.off', { kind: phase.kind }) }])
    ]
  }
}

// ── Les types de projet ─────────────────────────────────────────────────────────────

function typeStages(deps: HomeDeps, type: ProjectType, editing: boolean): JourneyStage[] {
  const { t } = deps
  const last = type.stages.length - 1
  return type.stages.map((stage, at) => ({
    id: `etape-${at + 1}`,
    caption: t('programmes.stage', { number: at + 1 }),
    phases: stage.map((phase: PhaseSpec, row): JourneyPhase => {
      const alone = stage.length === 1
      const tools: ViewAction[] = editing
        ? [
            { id: 'edit', label: t('programmes.type.phase.edit'), icon: 'edit', run: () => deps.editTypePhase(type.id, phase.id) },
            ...(at > 0 || !alone ? [{ id: 'left', label: t('programmes.type.phase.left'), icon: 'back' as const, run: () => deps.moveTypePhase(type.id, phase.id, 'left') }] : []),
            ...(at < last || !alone ? [{ id: 'right', label: t('programmes.type.phase.right'), icon: 'chevron' as const, run: () => deps.moveTypePhase(type.id, phase.id, 'right') }] : []),
            ...(row > 0 ? [{ id: 'up', label: t('programmes.type.phase.up'), icon: 'up' as const, run: () => deps.moveTypePhase(type.id, phase.id, 'up') }] : []),
            ...(row < stage.length - 1 ? [{ id: 'down', label: t('programmes.type.phase.down'), icon: 'down' as const, run: () => deps.moveTypePhase(type.id, phase.id, 'down') }] : []),
            ...(type.stages.flat().length > 1 ? [{ id: 'remove', label: t('programmes.type.phase.remove'), icon: 'trash' as const, run: () => deps.removeTypePhase(type.id, phase.id) }] : [])
          ]
        : []
      return {
        id: phase.id,
        label: phase.name,
        icon: phase.icon,
        color: phase.color,
        ...(phase.kind !== FREE_KIND ? { caption: kindLabel(t, phase.kind) } : {}),
        ...((detail) => (detail ? { detail } : {}))(
          [phase.duration !== undefined ? t('programmes.phase.durationShort', { days: phase.duration }) : '', phase.documents?.length ? t('programmes.docs.expectedCount', { count: phase.documents.length }) : '', phase.description ?? ''].filter(Boolean).join(' · ')
        ),
        ...(editing ? { open: { id: 'edit', label: t('programmes.type.phase.edit'), tooltip: t('programmes.type.phase.edit'), run: () => deps.editTypePhase(type.id, phase.id) }, tools } : {})
      }
    }),
    ...(editing ? { add: { id: `add-${at}`, label: t('programmes.type.addParallel'), tooltip: t('programmes.type.addParallel.tip'), run: () => deps.addTypePhase(type.id, at) } } : {})
  }))
}

function typesPage(deps: HomeDeps): PageView {
  const { t } = deps
  const types = deps.types()
  return {
    title: t('programmes.types.title'),
    breadcrumb: crumbs(deps, [{ label: t('programmes.types.title') }]),
    subtitle: t('programmes.types.subtitle'),
    actions: [
      { id: 'new', label: t('programmes.type.new'), icon: 'plus', primary: true, run: () => deps.newType() },
      ...(deps.exportTypes ? [{ id: 'export-types', label: t('programmes.types.export'), tooltip: t('programmes.types.export.tip'), icon: 'archive' as const, run: () => deps.exportTypes!() }] : []),
      ...(deps.importTypes ? [{ id: 'import-types', label: t('programmes.types.import'), tooltip: t('programmes.types.import.tip'), icon: 'upload' as const, run: () => deps.importTypes!() }] : [])
    ],
    blocks: types.length
      ? types.map((type) => ({
          kind: 'journey' as const,
          title: type.name,
          label: t('programmes.type.journey', { name: type.name }),
          subtitle: [type.description, t('programmes.type.count', { stages: type.stages.length, phases: type.stages.flat().length })].filter(Boolean).join(' · '),
          stages: typeStages(deps, type, false),
          spans: typeSpans(deps, type, false),
          ...(deps.showPage ? { open: { id: 'open', label: t('programmes.type.open'), run: () => deps.showPage?.(typePageOf(type.id)) } } : {})
        }))
      : [{ kind: 'message', tone: 'info', text: t('programmes.types.empty') }]
  }
}

function typePage(deps: HomeDeps, param?: string): PageView {
  const { t } = deps
  const type = deps.types().find((each) => each.id === decodeURIComponent(param ?? ''))
  if (!type) return { blocks: [{ kind: 'message', tone: 'warning', text: t('programmes.type.missing') }] }
  return {
    title: type.name,
    breadcrumb: crumbs(deps, [{ label: t('programmes.types.title'), page: TYPES_PAGE }, { label: type.name }]),
    subtitle: [type.description, t('programmes.type.count', { stages: type.stages.length, phases: type.stages.flat().length })].filter(Boolean).join(' · '),
    actions: [
      { id: 'project', label: t('programmes.type.newProject'), icon: 'plus', primary: true, run: () => deps.newProject(undefined, type.id) },
      { id: 'span', label: t('programmes.span.add'), tooltip: t('programmes.span.add.tip'), icon: 'columns', run: () => deps.addTypeSpan(type.id) },
      { id: 'edit', label: t('programmes.type.edit'), icon: 'edit', run: () => deps.editType(type.id) },
      { id: 'copy', label: t('programmes.type.copy'), icon: 'copy', run: () => deps.copyType(type.id) },
      ...(deps.exportTypes ? [{ id: 'export-type', label: t('programmes.type.export'), tooltip: t('programmes.type.export.tip'), icon: 'archive' as const, run: () => deps.exportTypes!(type.id) }] : []),
      { id: 'delete', label: t('programmes.type.delete'), icon: 'trash', run: () => deps.deleteType(type.id) }
    ],
    blocks: [
      { kind: 'message', tone: 'info', text: t('programmes.type.help') },
      {
        kind: 'journey',
        label: t('programmes.type.journey', { name: type.name }),
        stages: typeStages(deps, type, true),
        spans: typeSpans(deps, type, true),
        add: { id: 'stage', label: t('programmes.type.addStage'), tooltip: t('programmes.type.addStage.tip'), run: () => deps.addTypePhase(type.id, 'new') }
      },
      ...typeFoldersSection(deps, type)
    ]
  }
}

/**
 * Les **répertoires des documents** d'un type de projet : l'arborescence que chaque projet de ce
 * type aura dans la bibliothèque des documents projet, et ce qu'on attend dans chaque répertoire.
 */
function typeFoldersSection(deps: HomeDeps, type: ProjectType): HomeBlock[] {
  const { t } = deps
  if (!deps.addTypeFolder) return []
  const flat = flatFolders(type.folders ?? [])
  const items: ListItem[] = flat.map((folder) => ({
    id: folder.id,
    title: folder.path.split('/').join(' › '),
    detail: folder.expects?.length ? t('programmes.folders.expects', { types: folder.expects.map((code) => deps.docLabel(code)).join(', ') }) : t('programmes.folders.noExpect'),
    icon: 'folder' as const,
    tools: [
      ...(deps.chooseFolderExpects ? [{ id: `expects-${folder.id}`, label: t('programmes.folders.chooseExpects'), icon: 'file' as const, run: () => deps.chooseFolderExpects!(type.id, folder.id) }] : []),
      { id: `sub-${folder.id}`, label: t('programmes.folders.addSub', { name: folder.name }), icon: 'plus' as const, run: () => deps.addTypeFolder!(type.id, folder.id) },
      ...(deps.renameTypeFolder ? [{ id: `rename-${folder.id}`, label: t('programmes.folders.rename'), icon: 'edit' as const, run: () => deps.renameTypeFolder!(type.id, folder.id) }] : []),
      ...(deps.removeTypeFolder ? [{ id: `remove-${folder.id}`, label: t('programmes.folders.remove'), icon: 'trash' as const, run: () => deps.removeTypeFolder!(type.id, folder.id) }] : [])
    ]
  }))
  return [
    {
      kind: 'section',
      id: 'programmes.type.folders',
      title: t('programmes.folders.title'),
      subtitle: t('programmes.folders.count', { count: flat.length }),
      icon: 'folder',
      blocks: [
        { kind: 'message', tone: 'info', text: t(flat.length ? 'programmes.folders.intro' : 'programmes.folders.none'), actions: [{ id: 'add-folder', label: t('programmes.folders.add'), icon: 'plus', ...(flat.length ? {} : { primary: true }), run: () => deps.addTypeFolder!(type.id, null) }] },
        ...(items.length ? [{ kind: 'list' as const, items }] : [])
      ]
    }
  ]
}

export function registerProgrammesHome(views: ViewsRegistrar, deps: HomeDeps): void {
  const { t } = deps
  const show = (page: string) => deps.showPage?.(page)
  views.page({ id: PROGRAMMES_PAGE, title: t('programmes.nav'), icon: 'grid', load: () => programmesPage(deps) })
  views.page({ id: PROGRAMME_PAGE, title: t('programmes.programme.title'), icon: 'folder', parent: PROGRAMMES_PAGE, load: (param) => programmePage(deps, param) })
  views.page({ id: PROJECT_PAGE, title: t('programmes.project.title'), icon: 'flow', parent: PROGRAMMES_PAGE, load: (param) => projectPage(deps, param) })
  views.page({ id: PHASE_PAGE, title: t('programmes.phase.title'), icon: 'flow', parent: PROGRAMMES_PAGE, load: (param) => phasePage(deps, param) })
  views.page({ id: TYPES_PAGE, title: t('programmes.types.title'), icon: 'grid', parent: PROGRAMMES_PAGE, load: async () => typesPage(deps) })
  views.page({ id: TYPE_PAGE, title: t('programmes.type.title'), icon: 'grid', parent: PROGRAMMES_PAGE, load: async (param) => typePage(deps, param) })
  views.nav({ id: 'programmes', label: t('programmes.nav'), icon: 'grid', order: 5, page: PROGRAMMES_PAGE, run: () => show(PROGRAMMES_PAGE) })
  views.tile({
    id: 'programmes',
    label: t('programmes.nav'),
    icon: 'grid',
    color: 'indigo',
    group: t('programmes.name'),
    order: 5,
    byDefault: true,
    description: t('programmes.tile.desc'),
    page: PROGRAMMES_PAGE,
    run: () => show(PROGRAMMES_PAGE)
  })
  views.tile({ id: 'programmes.types', label: t('programmes.types.title'), icon: 'flow', color: 'violet', group: t('programmes.name'), order: 6, description: t('programmes.types.tip'), page: TYPES_PAGE, run: () => show(TYPES_PAGE) })
}
