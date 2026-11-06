// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que les workflows montrent dans l'interface : sur le tableau de bord, combien sont
 * actifs et les dernières exécutions ; sur la page **Workflows**, des chiffres, une carte
 * par workflow (déclencheur, actions, mode, état, dernière exécution, échec récent) avec
 * Modifier, Exécuter, Activer ou Désactiver, et le journal récent — recherche et filtres.
 */

import type { FileSystem } from '../../core/ports'
import type { Badge, Card, HomeSectionView, ListItem, PageView, Tone, ViewsRegistrar } from '../../core/views'
import { journalPath } from './engine'
import type { Workflow } from './model'
import type { Translate } from './registry'

/** La page des workflows. */
export const WORKFLOWS_PAGE = 'workflows.liste'

/** Ce que la page sait faire d'un workflow : la fenêtre de modification, l'exécution, l'activation. */
export interface WorkflowsPageDeps {
  t: Translate
  load(): Workflow[]
  describeTrigger(workflow: Workflow): string
  describeActions(workflow: Workflow): string[]
  stamp(iso: string): string
  edit(id: string): Promise<void>
  runNow(id: string): Promise<void>
  setEnabled(id: string, enabled: boolean): Promise<void>
}

const TONES: Record<string, Tone> = { '✅': 'success', '❌': 'danger', '⏭️': 'neutral', '⛔': 'warning' }

/** Les dernières lignes du journal, comme éléments de liste. */
export function journalItems(journal: string, count: number): Omit<ListItem, 'open'>[] {
  const out: Omit<ListItem, 'open'>[] = []
  for (const line of journal.split('\n')) {
    const found = /^- (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (✅|❌|⏭️|⛔) [^·]+ · \*\*(.+?)\*\*(.*)$/u.exec(line)
    if (!found) continue
    const detail = found[4]!.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, path: string, label?: string) => label ?? path.slice(path.lastIndexOf('/') + 1))
    out.push({ id: `${out.length}`, title: found[3]!, when: found[1]!, tone: TONES[found[2]!] ?? 'neutral', detail: detail.replace(/^ · /, '').trim() })
    if (out.length >= count) break
  }
  return out
}

/** Le journal : son texte, vide s'il n'existe pas encore. */
async function readJournal(deps: { t: Translate; fs: FileSystem; folder(): string }): Promise<string> {
  const path = journalPath(deps.folder(), deps.t)
  return (await deps.fs.exists(path)) ? deps.fs.readText(path) : ''
}

type HomeDeps = { t: Translate; fs: FileSystem; folder(): string; load(): Workflow[]; run(id: string): Promise<void>; openJournal(): Promise<void>; showPage?(id: string): void; page?: WorkflowsPageDeps }

/** Ce que le journal récent dit d'un workflow : sa dernière issue, quand, et combien de lignes. */
interface Logged {
  tone: Tone
  when: string
  count: number
}

/** La carte d'un workflow, complétée par ce qu'en dit le journal (un compteur pas encore à jour). */
function workflowCard(deps: WorkflowsPageDeps, workflow: Workflow, logged: Logged | undefined): Card {
  const { t } = deps
  const failed = logged?.tone === 'danger'
  const last = workflow.lastRun ? deps.stamp(workflow.lastRun) : (logged?.when ?? '—')
  const badges: Badge[] = [
    { label: t(workflow.enabled ? 'workflows.state.on' : 'workflows.state.off'), tone: workflow.enabled ? 'success' : 'neutral' },
    { label: t(`workflows.mode.${workflow.mode}`), tone: 'info' },
    ...(failed ? [{ label: t('workflows.page.failed'), tone: 'danger' as const }] : [])
  ]
  const actions = deps.describeActions(workflow)
  return {
    id: workflow.id,
    title: workflow.name,
    subtitle: deps.describeTrigger(workflow),
    icon: 'flow',
    badges,
    text: actions.length ? actions.map((each, index) => `${index + 1}. ${each}`).join(' · ') : t('workflows.edit.actions.none'),
    facts: [
      { label: t('workflows.page.runs'), value: String(Math.max(workflow.runs ?? 0, logged?.count ?? 0)) },
      { label: t('workflows.column.last'), value: last }
    ],
    open: { id: 'edit', label: t('workflows.page.edit'), tooltip: t('workflows.page.edit'), run: () => deps.edit(workflow.id) },
    actions: [
      { id: 'edit', label: t('workflows.page.edit'), icon: 'edit', run: () => deps.edit(workflow.id) },
      { id: 'run', label: t('workflows.page.run'), icon: 'play', run: () => deps.runNow(workflow.id) },
      workflow.enabled
        ? { id: 'disable', label: t('workflows.edit.disable'), icon: 'hide', run: () => deps.setEnabled(workflow.id, false) }
        : { id: 'enable', label: t('workflows.edit.enable'), icon: 'check', run: () => deps.setEnabled(workflow.id, true) }
    ],
    tags: [
      workflow.enabled ? 'actifs' : 'desactives',
      ...(failed ? ['en-echec'] : []),
      ...(workflow.trigger.kind === 'planifie' ? ['planifies'] : workflow.trigger.kind === 'manuel' ? ['manuels'] : ['sur-evenement']),
      workflow.mode === 'auto' ? 'tout-seuls' : 'demandent'
    ]
  }
}

/**
 * La page **Workflows** : combien, combien d'actifs, les exécutions et les échecs récents ;
 * les actions (nouveau, importer, exporter, journal) ; une carte par workflow ; puis les
 * dernières lignes du journal. Recherche (nom, déclencheur, actions) et filtres.
 */
export async function workflowsPage(deps: HomeDeps & { page: WorkflowsPageDeps }): Promise<PageView> {
  const { t } = deps
  const workflows = deps.page.load()
  const recent = journalItems(await readJournal(deps), 20)
  // Ce que le journal dit de chaque workflow : le plus récent est en tête.
  const logged = new Map<string, Logged>()
  for (const item of recent) {
    const known = logged.get(item.title)
    if (known) known.count++
    else logged.set(item.title, { tone: item.tone ?? 'neutral', when: item.when ?? '', count: 1 })
  }
  const failures = recent.filter((item) => item.tone === 'danger').length
  const active = workflows.filter((each) => each.enabled).length
  const journal = { id: 'journal', label: t('workflows.home.journal'), run: deps.openJournal }
  return {
    subtitle: t('workflows.page.subtitle', { active, count: workflows.length }),
    actions: [
      { id: 'new', label: t('workflows.command.new'), icon: 'plus', primary: true, run: () => deps.run('nouveau') },
      { id: 'import', label: t('workflows.list.import'), icon: 'upload', run: () => deps.run('importer') },
      { id: 'export', label: t('workflows.list.export'), icon: 'copy', run: () => deps.run('exporter') },
      { id: 'journal', label: t('workflows.home.journal'), icon: 'book', run: deps.openJournal }
    ],
    search: { label: t('workflows.page.search'), placeholder: t('workflows.page.search.placeholder') },
    filters: [
      { id: 'actifs', label: t('workflows.page.filter.on') },
      { id: 'desactives', label: t('workflows.page.filter.off') },
      { id: 'en-echec', label: t('workflows.page.filter.failed') },
      { id: 'planifies', label: t('workflows.page.filter.scheduled') },
      { id: 'sur-evenement', label: t('workflows.page.filter.event') },
      { id: 'manuels', label: t('workflows.page.filter.manual') },
      { id: 'tout-seuls', label: t('workflows.mode.auto') },
      { id: 'demandent', label: t('workflows.mode.ask') }
    ],
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('workflows.page.stat.count'), value: String(workflows.length), icon: 'flow' },
          { label: t('workflows.page.stat.active'), value: String(active), icon: 'check', tone: active ? 'success' : 'neutral' },
          { label: t('workflows.page.stat.runs'), value: String(recent.length), icon: 'play', hint: t('workflows.page.stat.runs.hint') },
          { label: t('workflows.page.stat.failed'), value: String(failures), icon: 'alert', tone: failures ? 'danger' : 'success', hint: t('workflows.page.stat.runs.hint') }
        ]
      },
      workflows.length
        ? { kind: 'cards', cards: workflows.map((workflow) => workflowCard(deps.page, workflow, logged.get(workflow.name))) }
        : { kind: 'message', tone: 'info', text: t('workflows.list.empty') },
      { kind: 'list', title: t('workflows.page.journal'), items: recent.slice(0, 10).map((item) => ({ ...item, open: journal })), empty: t('workflows.journal.none') }
    ]
  }
}

/** Les workflows : leur page, quand la plateforme en a ; sinon la liste en fenêtre. */
export async function openWorkflows(showPage: ((id: string) => void) | undefined, browse: () => Promise<void>): Promise<void> {
  if (showPage) showPage(WORKFLOWS_PAGE)
  else await browse()
}

export function registerWorkflowsHome(views: ViewsRegistrar | undefined, deps: HomeDeps): void {
  if (!views) return
  const { t } = deps
  const withPage = deps.showPage && deps.page ? { page: WORKFLOWS_PAGE } : {}
  const open = () => (deps.showPage && deps.page ? deps.showPage(WORKFLOWS_PAGE) : deps.run('liste'))
  views.home({
    id: 'workflows.recent',
    title: t('workflows.home.title'),
    icon: 'flow',
    order: 40,
    area: 'side',
    async load(): Promise<HomeSectionView> {
      const workflows = deps.load()
      const items = journalItems(await readJournal(deps), 5).map((item) => ({ ...item, open: { id: 'journal', label: t('workflows.home.journal'), run: deps.openJournal } }))
      return {
        title: t('workflows.home.title'),
        subtitle: t('workflows.home.subtitle', { active: workflows.filter((each) => each.enabled).length, count: workflows.length }),
        icon: 'flow',
        ...(withPage.page ? { actions: [{ id: 'all', label: t('workflows.home.all'), icon: 'chevron' as const, run: open }] } : {}),
        blocks: [
          { kind: 'list', items, empty: t('workflows.journal.none') },
          {
            kind: 'actions',
            actions: [
              { id: 'new', label: t('workflows.command.new'), icon: 'plus', run: () => deps.run('nouveau') },
              // Avec une page, le lien d'en-tête y mène déjà.
              ...(withPage.page ? [] : [{ id: 'list', label: t('workflows.home.all'), icon: 'flow' as const, run: open }]),
              { id: 'journal', label: t('workflows.home.journal'), icon: 'book', run: deps.openJournal }
            ]
          }
        ]
      }
    }
  })
  if (deps.page) {
    const page = deps.page
    views.page({ id: WORKFLOWS_PAGE, title: t('workflows.page.title'), icon: 'flow', load: () => workflowsPage({ ...deps, page }) })
  }
  views.nav({ id: 'workflows', label: t('workflows.name'), icon: 'flow', order: 30, ...withPage, run: open })
  const group = t('workflows.name')
  views.tile({
    id: 'workflows.liste',
    label: t('workflows.name'),
    icon: 'flow',
    color: 'rose',
    group,
    order: 30,
    byDefault: true,
    description: t('workflows.tile.list.desc'),
    ...withPage,
    run: open,
    async badge() {
      // Un échec parmi les dernières exécutions : à voir.
      const failed = journalItems(await readJournal(deps), 10).filter((item) => item.tone === 'danger').length
      return failed ? { text: String(failed), tone: 'danger', label: t('workflows.tile.failed', { count: failed }) } : null
    }
  })
  views.tile({ id: 'workflows.nouveau', label: t('workflows.command.new'), icon: 'plus', color: 'rose', group, order: 31, description: t('workflows.tile.new.desc'), run: () => deps.run('nouveau') })
  views.tile({ id: 'workflows.journal', label: t('workflows.home.journal'), icon: 'book', color: 'rose', group, order: 32, description: t('workflows.tile.journal.desc'), run: deps.openJournal })
}
