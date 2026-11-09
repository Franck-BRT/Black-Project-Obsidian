// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **pages** des programmes, en graphique : les programmes en tuiles, leurs projets avec
 * leur parcours de phases (des tuiles reliées par des flèches, comme un logigramme), un
 * projet et ses affaires, une phase et ce qu'on y fait ; les types de projet, que l'on
 * dessine phase par phase.
 */

import { pageWith, type Breadcrumb, type Card, type HomeBlock, type JourneyPhase, type JourneyStage, type PageView, type Stat, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { phaseKind, type PhaseContext } from './kinds'
import { FREE_KIND, PHASE_STATUSES, progressOf, stagesOf, type Affaire, type PhaseSpec, type PhaseStatus, type Programme, type Project, type ProjectPhase, type ProjectType } from './model'
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
  editType(id: string): Promise<void>
  copyType(id: string): Promise<void>
  deleteType(id: string): Promise<void>
  editTypePhase(type: string, phase: string): Promise<void>
  addTypePhase(type: string, stage: number | 'new'): Promise<void>
  moveTypePhase(type: string, phase: string, direction: Direction): Promise<void>
  removeTypePhase(type: string, phase: string): Promise<void>
}

/** Le nom d'une sorte de phase. */
export function kindLabel(t: Translate, kind: string): string {
  if (kind === FREE_KIND) return t('programmes.kind.libre')
  return phaseKind(kind)?.label ?? t('programmes.kind.unknown', { kind })
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
          const detail = (await phaseKind(phase.kind)?.detail?.(phase).catch(() => null)) ?? (phase.end ? t('programmes.phase.endOn', { date: phase.end }) : undefined)
          return {
            id: phase.id,
            label: phase.name,
            icon: phase.icon,
            color: phase.color,
            ...(phase.kind !== FREE_KIND ? { caption: kindLabel(t, phase.kind) } : {}),
            ...(detail ? { detail } : {}),
            status: { label: t(`programmes.status.${phase.status}`), tone: STATUS_TONE[phase.status] },
            progress: progressOf(phase.status),
            ...(open && deps.showPage ? { open: { id: 'open', label: t('programmes.phase.open', { name: phase.name }), tooltip: t('programmes.phase.open', { name: phase.name }), run: () => deps.showPage?.(phasePageOf(project.path, phase.id)) } } : {})
          }
        })
      )
    }))
  )
}

/** Un projet en parcours miniature, son titre ouvre sa page. */
async function projectJourney(deps: HomeDeps, project: Project, compact: boolean, programme?: Programme): Promise<HomeBlock> {
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
    compact,
    ...(deps.showPage ? { open: { id: 'open', label: t('programmes.project.open'), run: () => deps.showPage?.(projectPageOf(project.path)) } } : {})
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
  const journeys: HomeBlock[] = []
  for (const programme of programmes) for (const project of projectsOf.get(programme.path) ?? []) journeys.push(await projectJourney(deps, project, true, programme))
  return {
    subtitle: t('programmes.page.subtitle', { folder: store.root }),
    actions: [
      { id: 'new', label: t('programmes.programme.new'), icon: 'plus', primary: true, run: () => deps.newProgramme() },
      { id: 'project', label: t('programmes.project.new'), icon: 'flow', run: () => deps.newProject() },
      ...(deps.showPage ? [{ id: 'types', label: t('programmes.types.title'), tooltip: t('programmes.types.tip'), icon: 'grid' as const, run: () => deps.showPage?.(TYPES_PAGE) }] : [])
    ],
    blocks: programmes.length
      ? [
          { kind: 'cards', title: t('programmes.page.programmes'), cards },
          ...(journeys.length ? [{ kind: 'section' as const, id: 'programmes.projets', title: t('programmes.page.projects'), subtitle: t('programmes.page.projects.count', { count: journeys.length }), icon: 'flow' as const, blocks: journeys }] : [])
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
  const journeys: HomeBlock[] = []
  for (const project of projects) journeys.push(await projectJourney(deps, project, true))
  return {
    title: programme.name,
    breadcrumb: crumbs(deps, [{ label: programme.name }]),
    subtitle: [programme.code, programme.description].filter(Boolean).join(' · '),
    actions: [
      { id: 'project', label: t('programmes.project.new'), icon: 'plus', primary: true, run: () => deps.newProject(programme.path) },
      { id: 'edit', label: t('programmes.programme.edit'), icon: 'edit', run: () => deps.editProgramme(programme.path) },
      { id: 'note', label: t('programmes.note'), icon: 'book', run: () => deps.openNote(programme.path) }
    ],
    blocks: [
      { kind: 'stats', stats },
      ...(journeys.length ? journeys : [{ kind: 'message' as const, tone: 'info' as const, text: t('programmes.programme.empty'), actions: [{ id: 'first', label: t('programmes.project.new'), icon: 'plus' as const, primary: true, run: () => deps.newProject(programme.path) }] }])
    ]
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
  const stats: Stat[] = [
    { label: t('programmes.project.type'), value: project.typeName || '—', icon: 'grid' },
    { label: t('programmes.project.advanceLabel'), value: t('programmes.project.advance', { done, total }), icon: 'check', ...(done === total && total ? { tone: 'success' as const } : {}) },
    { label: t('programmes.project.currentLabel'), value: current.map((phase) => phase.name).join(', ') || (next ? t('programmes.project.next', { name: next.name }) : '—'), icon: 'play' },
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
  return {
    title: project.name,
    breadcrumb: crumbs(deps, [{ label: programme?.name ?? '—', ...(programme ? { page: programmePageOf(programme.path) } : {}) }, { label: project.name }]),
    subtitle: [project.typeName, project.description].filter(Boolean).join(' · '),
    actions: [
      { id: 'affaire', label: t('programmes.affaire.new'), icon: 'plus', primary: true, run: () => deps.newAffaire(project.path) },
      { id: 'note', label: t('programmes.note'), icon: 'book', run: () => deps.openNote(project.path) }
    ],
    blocks: [
      { kind: 'stats', stats },
      { kind: 'journey', title: t('programmes.project.phases'), label: t('programmes.project.journey', { name: project.name }), stages: await projectStages(deps, project, true), legend: t('programmes.project.legend') },
      {
        kind: 'section',
        id: 'programmes.projet.affaires',
        title: t('programmes.project.affairesTitle'),
        subtitle: t('programmes.project.affaires', { count: affaires.length }),
        icon: 'building',
        blocks: affaireCards.length ? [{ kind: 'cards', cards: affaireCards }] : [{ kind: 'message', tone: 'info', text: t('programmes.affaire.none'), actions: [{ id: 'first', label: t('programmes.affaire.new'), icon: 'plus', run: () => deps.newAffaire(project.path) }] }]
      }
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
  const dates = [phase.start ? t('programmes.phase.startOn', { date: phase.start }) : '', phase.end ? t('programmes.phase.endOn', { date: phase.end }) : ''].filter(Boolean).join(' · ')
  return {
    title: phase.name,
    breadcrumb: crumbs(deps, [{ label: programme?.name ?? '—', ...(programme ? { page: programmePageOf(programme.path) } : {}) }, { label: project.name, page: projectPageOf(project.path) }, { label: phase.name }]),
    subtitle: [kindLabel(t, phase.kind), t('programmes.stage', { number: phase.stage }), t(`programmes.status.${phase.status}`)].join(' · '),
    actions: [...(kind ? kind.actions(context) : []), { id: 'dates', label: t('programmes.phase.dates'), icon: 'calendar', run: () => deps.editPhaseDates(project.path, phase.id) }],
    blocks: [
      { kind: 'journey', label: t('programmes.project.journey', { name: project.name }), title: project.name, stages: (await projectStages(deps, project, true)).map((stage) => ({ ...stage, phases: stage.phases.map((each) => (each.id === phase.id ? { ...each, progress: each.progress === 'done' ? 'done' : ('current' as const) } : { ...each, progress: each.progress === 'current' ? ('todo' as const) : each.progress })) })), compact: true, ...(deps.showPage ? { open: { id: 'open', label: t('programmes.project.open'), run: () => deps.showPage?.(projectPageOf(project.path)) } } : {}) },
      { kind: 'message', tone: STATUS_TONE[phase.status] === 'neutral' ? 'info' : STATUS_TONE[phase.status], text: [t(`programmes.status.says.${phase.status}`), dates, phase.description ?? ''].filter(Boolean).join(' — '), actions: statusActions },
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
        ...(phase.description ? { detail: phase.description } : {}),
        progress: 'current',
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
    actions: [{ id: 'new', label: t('programmes.type.new'), icon: 'plus', primary: true, run: () => deps.newType() }],
    blocks: types.length
      ? types.map((type) => ({
          kind: 'journey' as const,
          title: type.name,
          label: t('programmes.type.journey', { name: type.name }),
          subtitle: [type.description, t('programmes.type.count', { stages: type.stages.length, phases: type.stages.flat().length })].filter(Boolean).join(' · '),
          stages: typeStages(deps, type, false),
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
      { id: 'edit', label: t('programmes.type.edit'), icon: 'edit', run: () => deps.editType(type.id) },
      { id: 'copy', label: t('programmes.type.copy'), icon: 'copy', run: () => deps.copyType(type.id) },
      { id: 'delete', label: t('programmes.type.delete'), icon: 'trash', run: () => deps.deleteType(type.id) }
    ],
    blocks: [
      { kind: 'message', tone: 'info', text: t('programmes.type.help') },
      {
        kind: 'journey',
        label: t('programmes.type.journey', { name: type.name }),
        stages: typeStages(deps, type, true),
        add: { id: 'stage', label: t('programmes.type.addStage'), tooltip: t('programmes.type.addStage.tip'), run: () => deps.addTypePhase(type.id, 'new') }
      }
    ]
  }
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
