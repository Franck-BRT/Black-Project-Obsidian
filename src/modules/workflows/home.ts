// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que les workflows montrent dans l'interface : sur le tableau de bord, combien sont
 * actifs et les dernières exécutions ; sur la page **Workflows**, des chiffres, une carte
 * par workflow (déclencheur, actions, mode, état, dernière exécution, échec récent) avec
 * Modifier, Exécuter, Activer ou Désactiver, et le journal récent — recherche et filtres.
 */

import type { FileSystem } from '../../core/ports'
import { pageWith, type Badge, type Card, type HomeBlock, type HomeSectionView, type ListItem, type PageView, type Tone, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { journalPath } from './engine'
import type { Workflow } from './model'
import type { Translate } from './registry'

/** La page des workflows. */
export const WORKFLOWS_PAGE = 'workflows.liste'
/** La fiche d'un workflow : `pageWith(WORKFLOW_PAGE, id)`. */
export const WORKFLOW_PAGE = 'workflows.fiche'
/** Le journal des workflows, en page. */
export const JOURNAL_PAGE = 'workflows.journal'
/** La fiche d'une exécution : `pageWith(RUN_PAGE, ligne du journal encodée)`. */
export const RUN_PAGE = 'workflows.execution'
export const runPageOf = (line: string): string => pageWith(RUN_PAGE, encodeURIComponent(line))

/** Le filtre du journal qui répond à chaque issue. */
const OUTCOME_TAG: Record<Tone, string> = { success: 'reussies', danger: 'echecs', neutral: 'refusees', warning: 'arretees', info: 'autres' }

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
  /** Ce qu'un workflow système est (son module, s'il a été modifié, sa version d'origine) ; `null` pour un workflow ordinaire. */
  system?(workflow: Workflow): SystemInfo | null
  /** La fiche d'un workflow, en page : ce qu'elle sait faire, une opération à la fois. */
  fiche?: WorkflowFicheDeps
}

/** Un workflow système, pour la page : son module, son état, sa version d'origine (décrite). */
export interface SystemInfo {
  moduleName: string
  state: 'original' | 'modified' | 'modified-update'
  origin: { name: string; trigger: string; conditions: string[]; actions: string[] }
}

export interface WorkflowFicheDeps {
  /** Le remettre à sa version d'origine (après confirmation) ; rend vrai s'il l'a été. */
  restore?(id: string): Promise<boolean>
  describeCondition(workflow: Workflow, index: number): string
  /** Le déclencheur a-t-il des champs à tester (sinon, pas de condition possible) ? */
  canCondition(workflow: Workflow): boolean
  editGeneral(id: string): Promise<void>
  addCondition(id: string): Promise<void>
  removeCondition(id: string, index: number): Promise<void>
  addAction(id: string): Promise<void>
  editAction(id: string, index: number): Promise<void>
  moveAction(id: string, index: number, delta: -1 | 1): Promise<void>
  removeAction(id: string, index: number): Promise<void>
  /** Une copie ; rend son identifiant. */
  duplicate(id: string): Promise<string | null>
  /** Supprimer, après confirmation ; rend vrai s'il l'a été. */
  remove(id: string): Promise<boolean>
}

const TONES: Record<string, Tone> = { '✅': 'success', '❌': 'danger', '⏭️': 'neutral', '⛔': 'warning' }

/**
 * Une exécution, telle que le journal l'a écrite (`journalLine`) : quand, son issue, son
 * workflow, son sujet et la note du sujet, ce que chaque étape a fait, les notes écrites.
 */
export interface Run {
  /** La ligne même : ce qui désigne l'exécution (la fiche d'une exécution la retrouve par elle). */
  line: string
  when: string
  tone: Tone
  /** L'issue en mots : « fait », « échec »… */
  outcome: string
  name: string
  /** « sur « Station sol » » ; vide si l'exécution n'avait pas de sujet. */
  subject: string
  /** La note du sujet (une analyse, une exigence) ; vide s'il n'y en a pas. */
  subjectPath: string
  steps: string[]
  /** Les notes que l'exécution a écrites. */
  paths: string[]
}

const asNote = (target: string) => (/\.[a-z0-9]+$/i.test(target) ? target : `${target}.md`)
const linkTarget = (link: string) => asNote((/^\[\[([^\]|]+)/.exec(link.trim())?.[1] ?? '').trim())
/** Un texte de journal lisible : chaque lien [[…]] devient son nom. */
const unlink = (text: string) => text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, path: string, label?: string) => label ?? path.slice(path.lastIndexOf('/') + 1))

/** Les exécutions du journal, la plus récente en tête (le journal l'est déjà). */
export function journalRuns(journal: string, count: number): Run[] {
  const out: Run[] = []
  for (const line of journal.split('\n')) {
    const found = /^- (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (✅|❌|⏭️|⛔) ([^·]+) · \*\*(.+?)\*\*(.*)$/u.exec(line)
    if (!found) continue
    let rest = found[5]!
    // À la fin, les notes écrites : « · [[a]], [[b]] ».
    const wrote = /\s·\s((?:\[\[[^\]]+\]\](?:,\s*)?)+)\s*$/.exec(rest)
    const paths = wrote ? (wrote[1]!.match(/\[\[[^\]]+\]\]/g) ?? []).map(linkTarget) : []
    if (wrote) rest = rest.slice(0, wrote.index)
    // Puis ce que chaque étape a fait : « — 1. … ; 2. … ».
    const dash = rest.indexOf(' — ')
    const steps = dash >= 0 ? rest.slice(dash + 3).split(' ; ').map((step) => unlink(step).trim()).filter(Boolean) : []
    if (dash >= 0) rest = rest.slice(0, dash)
    // Puis la note du sujet : « ([[…]]) ».
    const from = /\s\((\[\[[^\]]+\]\])\)\s*$/.exec(rest)
    const subjectPath = from ? linkTarget(from[1]!) : ''
    if (from) rest = rest.slice(0, from.index)
    out.push({ line, when: found[1]!, tone: TONES[found[2]!] ?? 'neutral', outcome: found[3]!.trim(), name: found[4]!, subject: rest.replace(/^\s·\s/, '').trim(), subjectPath, steps, paths })
    if (out.length >= count) break
  }
  return out
}

/** Les dernières lignes du journal, comme éléments de liste. */
export function journalItems(journal: string, count: number): (Omit<ListItem, 'open'> & { line: string })[] {
  return journalRuns(journal, count).map((run, index) => {
    const detail = [run.subject, run.steps.join(' ; '), run.paths.length ? run.paths.map((path) => path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')).join(', ') : ''].filter(Boolean).join(' — ')
    return { id: `${index}`, title: run.name, when: run.when, tone: run.tone, detail, line: run.line }
  })
}

/** Le journal : son texte, vide s'il n'existe pas encore. */
async function readJournal(deps: { t: Translate; fs: FileSystem; folder(): string }): Promise<string> {
  const path = journalPath(deps.folder(), deps.t)
  return (await deps.fs.exists(path)) ? deps.fs.readText(path) : ''
}

/**
 * Un clic sur une ligne du journal : la fiche de cette exécution, quand la plateforme a
 * des pages ; sinon la note du journal.
 */
function runOpen(deps: HomeDeps, line: string) {
  return deps.showPage && deps.page
    ? { id: 'run', label: deps.t('workflows.run.open'), run: () => deps.showPage?.(runPageOf(line)) }
    : { id: 'journal', label: deps.t('workflows.home.journal'), run: deps.openJournal }
}

/** Le journal : en page quand la plateforme en a ; sinon sa note. */
function openJournalPage(deps: HomeDeps): () => Promise<void> | void {
  return deps.showPage && deps.page ? () => deps.showPage?.(JOURNAL_PAGE) : deps.openJournal
}

type HomeDeps = {
  t: Translate
  fs: FileSystem
  folder(): string
  load(): Workflow[]
  run(id: string): Promise<void>
  openJournal(): Promise<void>
  openNote(path: string): Promise<void>
  showPage?(id: string): void
  page?: WorkflowsPageDeps
  /** Un nouveau workflow, sans la fenêtre de sa fiche ; rend son identifiant. */
  create?(): Promise<string | null>
  /** Importer des workflows depuis l'interface (puis les montrer), et ceux du dernier import. */
  imports?: { run(): Promise<void>; last(): readonly string[] }
}

/** La dernière ligne du journal d'un workflow (son nom), pour retrouver l'exécution qu'on vient de lancer. */
export async function lastRunLine(deps: { t: Translate; fs: FileSystem; folder(): string }, name: string): Promise<string | null> {
  return journalItems(await readJournal(deps), 50).find((item) => item.title === name)?.line ?? null
}

/** « Nouveau workflow » depuis l'interface : avec des pages, sa fiche en page ensuite ; sinon la commande (la fenêtre). */
function newWorkflow(deps: HomeDeps): () => Promise<void> {
  return async () => {
    if (!deps.showPage || !deps.page?.fiche || !deps.create) return deps.run('nouveau')
    const id = await deps.create()
    if (id) deps.showPage(pageWith(WORKFLOW_PAGE, id))
  }
}

/** Ce que le journal récent dit d'un workflow : sa dernière issue, quand, et combien de lignes. */
interface Logged {
  tone: Tone
  when: string
  count: number
}

/** La carte d'un workflow, complétée par ce qu'en dit le journal (un compteur pas encore à jour). */
function workflowCard(deps: WorkflowsPageDeps, workflow: Workflow, logged: Logged | undefined, imported = false): Card {
  const { t } = deps
  const system = deps.system?.(workflow) ?? null
  const failed = logged?.tone === 'danger'
  const last = workflow.lastRun ? deps.stamp(workflow.lastRun) : (logged?.when ?? '—')
  const badges: Badge[] = [
    { label: t(workflow.enabled ? 'workflows.state.on' : 'workflows.state.off'), tone: workflow.enabled ? 'success' : 'neutral' },
    { label: t(`workflows.mode.${workflow.mode}`), tone: 'info' },
    ...(failed ? [{ label: t('workflows.page.failed'), tone: 'danger' as const }] : []),
    // Importé tout juste : désactivé, à relire avant de l'activer.
    ...(imported ? [{ label: t(workflow.enabled ? 'workflows.page.imported' : 'workflows.page.imported.off'), tone: 'info' as const }] : []),
    // Système : un automatisme de l'application ; modifié, il le dit.
    ...(system ? [{ label: t('workflows.system.badge'), tone: 'info' as const }, ...(system.state !== 'original' ? [{ label: t('workflows.system.modified'), tone: 'warning' as const }] : [])] : [])
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
      workflow.mode === 'auto' ? 'tout-seuls' : 'demandent',
      ...(imported ? ['importes'] : []),
      ...(system ? ['systeme'] : [])
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
  // Ceux du dernier import (en tête), et combien attendent encore d'être relus puis activés.
  const imported = new Set((deps.imports?.last() ?? []).filter((id) => workflows.some((each) => each.id === id)))
  const waiting = workflows.filter((each) => imported.has(each.id) && !each.enabled).length
  return {
    subtitle: t('workflows.page.subtitle', { active, count: workflows.length }),
    actions: [
      { id: 'new', label: t('workflows.command.new'), icon: 'plus', primary: true, run: newWorkflow(deps) },
      { id: 'import', label: t('workflows.list.import'), icon: 'upload', run: () => (deps.showPage && deps.imports ? deps.imports.run() : deps.run('importer')) },
      { id: 'export', label: t('workflows.list.export'), icon: 'copy', run: () => deps.run('exporter') },
      { id: 'journal', label: t('workflows.home.journal'), icon: 'book', run: openJournalPage(deps) }
    ],
    search: { label: t('workflows.page.search'), placeholder: t('workflows.page.search.placeholder') },
    // Trois vues pour les cartes, et quatre façons de les regrouper.
    layouts: ['cards', 'list', 'table'],
    grouping: {
      label: t('workflows.page.group'),
      current: grouping,
      options: GROUPINGS.map((id) => ({ id, label: t(`workflows.page.group.${id}`), icon: GROUPING_ICON[id], run: () => void (grouping = id) }))
    },
    filters: [
      { id: 'actifs', label: t('workflows.page.filter.on') },
      { id: 'desactives', label: t('workflows.page.filter.off') },
      { id: 'en-echec', label: t('workflows.page.filter.failed') },
      { id: 'planifies', label: t('workflows.page.filter.scheduled') },
      { id: 'sur-evenement', label: t('workflows.page.filter.event') },
      { id: 'manuels', label: t('workflows.page.filter.manual') },
      { id: 'tout-seuls', label: t('workflows.mode.auto') },
      { id: 'demandent', label: t('workflows.mode.ask') },
      ...(imported.size ? [{ id: 'importes', label: t('workflows.page.filter.imported') }] : []),
      ...(workflows.some((each) => each.system) ? [{ id: 'systeme', label: t('workflows.system.filter') }] : [])
    ],
    blocks: [
      ...(waiting ? [{ kind: 'message' as const, tone: 'info' as const, text: t('workflows.page.imported.message', { count: waiting }) }] : []),
      {
        kind: 'stats',
        stats: [
          { label: t('workflows.page.stat.count'), value: String(workflows.length), icon: 'flow' },
          { label: t('workflows.page.stat.active'), value: String(active), icon: 'check', tone: active ? 'success' : 'neutral' },
          { label: t('workflows.page.stat.runs'), value: String(recent.length), icon: 'play', hint: t('workflows.page.stat.runs.hint') },
          { label: t('workflows.page.stat.failed'), value: String(failures), icon: 'alert', tone: failures ? 'danger' : 'success', hint: t('workflows.page.stat.runs.hint') }
        ]
      },
      ...workflowSections(deps, workflows, imported, logged, grouping),
      { kind: 'list', title: t('workflows.page.journal'), items: recent.slice(0, 10).map((item) => ({ ...item, open: runOpen(deps, item.line) })), empty: t('workflows.journal.none') }
    ]
  }
}

/** Comment la page range les workflows : par module (d'origine), par déclencheur, par état, ou pas du tout. */
export type Grouping = 'module' | 'declencheur' | 'etat' | 'aucun'
export const GROUPINGS: readonly Grouping[] = ['module', 'declencheur', 'etat', 'aucun']
const GROUPING_ICON = { module: 'grid', declencheur: 'flow', etat: 'check', aucun: 'list' } as const
/** Le regroupement choisi, le temps de la session. */
let grouping: Grouping = 'module'
export const setWorkflowsGrouping = (next: Grouping): void => void (grouping = next)

/**
 * Les workflows en sections repliables : d'abord **les workflows système**, une
 * sous-section par module (repliées d'origine : leur intitulé dit combien, combien
 * d'actifs, combien en échec) ; puis **mes workflows** (ceux du dernier import en tête).
 */
function workflowSections(deps: HomeDeps & { page: WorkflowsPageDeps }, workflows: readonly Workflow[], imported: ReadonlySet<string>, logged: ReadonlyMap<string, Logged>, by: Grouping = 'module'): HomeBlock[] {
  const { t } = deps
  if (!workflows.length) return [{ kind: 'message', tone: 'info', text: t('workflows.list.empty') }]
  const cardOf = (workflow: Workflow) => workflowCard(deps.page, workflow, logged.get(workflow.name), imported.has(workflow.id))
  const summary = (cards: readonly Card[]) => {
    const failed = cards.filter((card) => card.tags?.includes('en-echec')).length
    return [t('workflows.page.section.count', { count: cards.length, active: cards.filter((card) => card.tags?.includes('actifs')).length }), ...(failed ? [t('workflows.page.section.failed', { count: failed })] : [])].join(' · ')
  }
  const ordered = [...workflows].sort((a, b) => Number(imported.has(b.id)) - Number(imported.has(a.id)) || a.name.localeCompare(b.name, 'fr'))
  // Sans regroupement : toutes les cartes, celles du dernier import en tête.
  if (by === 'aucun') return [{ kind: 'cards', cards: ordered.map(cardOf) }]
  // Par déclencheur (les planifiés ensemble), ou par état : une section par groupe, ouvertes.
  if (by === 'declencheur' || by === 'etat') {
    const groups = new Map<string, { title: string; order: number; cards: Card[] }>()
    for (const workflow of ordered) {
      const card = cardOf(workflow)
      const [key, title, order] =
        by === 'declencheur'
          ? workflow.trigger.kind === 'planifie'
            ? ['planifie', t('workflows.page.group.scheduled'), 1]
            : workflow.trigger.kind === 'manuel'
              ? ['manuel', t('workflows.page.group.manual'), 2]
              : [workflow.trigger.kind, deps.page.describeTrigger({ ...workflow, conditions: [] }), 0]
          : card.tags?.includes('en-echec')
            ? ['en-echec', t('workflows.page.group.failed'), 0]
            : workflow.enabled
              ? ['actifs', t('workflows.page.group.on'), 1]
              : ['desactives', t('workflows.page.group.off'), 2]
      const group = groups.get(key) ?? { title, order, cards: [] }
      group.cards.push(card)
      groups.set(key, group)
    }
    return [...groups]
      .sort((a, b) => a[1].order - b[1].order || a[1].title.localeCompare(b[1].title, 'fr'))
      .map(([key, group]) => ({ kind: 'section' as const, id: `workflows.${by}.${key}`, title: group.title, subtitle: summary(group.cards), collapsed: by === 'declencheur' && groups.size > 4, blocks: [{ kind: 'cards' as const, cards: group.cards }] }))
  }
  const system = workflows.filter((workflow) => workflow.system)
  const mine = workflows.filter((workflow) => !workflow.system)
  const blocks: HomeBlock[] = []
  if (system.length) {
    // Par module : le nom du module qui le déclare (sinon « Autres »).
    const byModule = new Map<string, Workflow[]>()
    for (const workflow of system) {
      const name = deps.page.system?.(workflow)?.moduleName || t('workflows.page.section.other')
      byModule.set(name, [...(byModule.get(name) ?? []), workflow])
    }
    const groups = [...byModule].sort((a, b) => a[0].localeCompare(b[0], 'fr'))
    const allCards = system.map(cardOf)
    blocks.push({
      kind: 'section',
      id: 'workflows.systeme',
      title: t('workflows.page.section.system'),
      subtitle: summary(allCards),
      icon: 'lock',
      blocks: groups.map(([name, list]) => {
        const cards = list.map(cardOf)
        return { kind: 'section', id: `workflows.systeme.${name}`, title: name, subtitle: summary(cards), collapsed: true, blocks: [{ kind: 'cards', cards }] }
      })
    })
  }
  const myCards = [...mine].sort((a, b) => Number(imported.has(b.id)) - Number(imported.has(a.id))).map(cardOf)
  blocks.push({
    kind: 'section',
    id: 'workflows.miens',
    title: t('workflows.page.section.mine'),
    subtitle: myCards.length ? summary(myCards) : t('workflows.page.section.mine.none'),
    icon: 'flow',
    blocks: [myCards.length ? { kind: 'cards', cards: myCards } : { kind: 'message', tone: 'info', text: t('workflows.page.section.mine.empty') }]
  })
  return blocks
}

/**
 * La **fiche** d'un workflow, en page : en tête, Exécuter, Activer ou Désactiver, « Nom,
 * mode et déclencheur », Dupliquer, Supprimer ; ses chiffres ; ses conditions et ses
 * actions, chacune avec ses boutons (modifier, monter, descendre, retirer) ; et ses
 * dernières exécutions. Plus de suite de fenêtres : tout se voit, chaque bouton fait une chose.
 */
export async function workflowPage(deps: HomeDeps & { page: WorkflowsPageDeps & { fiche: WorkflowFicheDeps } }, id: string | undefined): Promise<PageView> {
  const { t } = deps
  const { page } = deps
  const fiche = page.fiche
  const back: ViewAction = { id: 'back', label: t('workflows.page.back'), run: () => deps.showPage?.(WORKFLOWS_PAGE) }
  const workflow = page.load().find((each) => each.id === id)
  if (!workflow) return { title: t('workflows.page.missing.title'), back, blocks: [{ kind: 'message', tone: 'warning', text: t('workflows.page.missing') }] }
  const system = page.system?.(workflow) ?? null
  const history = journalItems(await readJournal(deps), 200).filter((item) => item.title === workflow.name)
  const last = workflow.lastRun ? page.stamp(workflow.lastRun) : (history[0]?.when ?? '—')
  const failed = history[0]?.tone === 'danger'
  const count = workflow.actions.length
  return {
    title: workflow.name,
    back,
    subtitle: t('workflows.page.fiche.subtitle', { trigger: page.describeTrigger(workflow) }),
    actions: [
      { id: 'run', label: t('workflows.page.run'), icon: 'play', primary: true, run: () => page.runNow(workflow.id) },
      workflow.enabled
        ? { id: 'disable', label: t('workflows.edit.disable'), icon: 'hide', run: () => page.setEnabled(workflow.id, false) }
        : { id: 'enable', label: t('workflows.edit.enable'), icon: 'check', run: () => page.setEnabled(workflow.id, true) },
      { id: 'general', label: t('workflows.edit.general'), icon: 'edit', run: () => fiche.editGeneral(workflow.id) },
      {
        id: 'duplicate',
        label: t('workflows.edit.duplicate'),
        icon: 'copy',
        run: async () => {
          const copy = await fiche.duplicate(workflow.id)
          if (copy) deps.showPage?.(pageWith(WORKFLOW_PAGE, copy))
        }
      },
      // Un workflow système ne se supprime pas ; modifié, il se rétablit.
      ...(system
        ? system.state !== 'original' && fiche.restore
          ? [{ id: 'restore', label: t('workflows.system.restore'), tooltip: t('workflows.system.restore.tip'), icon: 'refresh' as const, run: async () => void (await fiche.restore!(workflow.id)) }]
          : []
        : [
            {
              id: 'delete',
              label: t('workflows.edit.delete'),
              icon: 'trash' as const,
              run: async () => {
                if (await fiche.remove(workflow.id)) deps.showPage?.(WORKFLOWS_PAGE)
              }
            }
          ])
    ],
    blocks: [
      ...(system
        ? [
            {
              kind: 'message' as const,
              tone: system.state === 'modified-update' ? ('warning' as const) : ('info' as const),
              text: [t('workflows.system.intro', { module: system.moduleName }), ...(system.state === 'modified' ? [t('workflows.system.state.modified')] : system.state === 'modified-update' ? [t('workflows.system.state.update')] : [])].join(' ')
            }
          ]
        : []),
      // Importé, donc désactivé : à relire avant de l'activer.
      ...(!workflow.enabled && deps.imports?.last().includes(workflow.id) ? [{ kind: 'message' as const, tone: 'info' as const, text: t('workflows.page.imported.fiche') }] : []),
      {
        kind: 'stats',
        stats: [
          { label: t('workflows.column.state'), value: t(workflow.enabled ? 'workflows.state.on' : 'workflows.state.off'), icon: workflow.enabled ? 'check' : 'hide', tone: workflow.enabled ? 'success' : 'neutral' },
          { label: t('workflows.column.mode'), value: t(`workflows.mode.${workflow.mode}`), icon: 'flow', hint: t(`workflows.mode.${workflow.mode}.desc`) },
          { label: t('workflows.page.runs'), value: String(Math.max(workflow.runs ?? 0, history.length)), icon: 'play' },
          { label: t('workflows.column.last'), value: last, icon: 'clock', ...(failed ? { tone: 'danger' as const, hint: t('workflows.page.failed') } : {}) }
        ]
      },
      {
        kind: 'cards',
        title: t('workflows.page.fiche.conditions', { count: workflow.conditions.length }),
        actions: fiche.canCondition(workflow) ? [{ id: 'add-condition', label: t('workflows.conditions.add'), icon: 'plus', run: () => fiche.addCondition(workflow.id) }] : [],
        empty: t(fiche.canCondition(workflow) ? 'workflows.edit.conditions.none' : 'workflows.conditions.noField'),
        cards: workflow.conditions.map((_, index) => ({
          id: `condition-${index}`,
          title: fiche.describeCondition(workflow, index),
          icon: 'check',
          actions: [{ id: 'remove', label: t('workflows.actions.remove'), icon: 'trash', run: () => fiche.removeCondition(workflow.id, index) }]
        }))
      },
      {
        kind: 'cards',
        title: t('workflows.page.fiche.actions', { count }),
        actions: [{ id: 'add-action', label: t('workflows.actions.add'), icon: 'plus', primary: count === 0, run: () => fiche.addAction(workflow.id) }],
        empty: t('workflows.edit.actions.none'),
        cards: page.describeActions(workflow).map((label, index) => ({
          id: `action-${index}`,
          title: `${index + 1}. ${label}`,
          icon: 'play',
          actions: [
            { id: 'edit', label: t('workflows.actions.edit'), icon: 'edit', run: () => fiche.editAction(workflow.id, index) },
            ...(index > 0 ? [{ id: 'up', label: t('workflows.actions.up'), icon: 'up' as const, run: () => fiche.moveAction(workflow.id, index, -1) }] : []),
            ...(index < count - 1 ? [{ id: 'down', label: t('workflows.actions.down'), icon: 'down' as const, run: () => fiche.moveAction(workflow.id, index, 1) }] : []),
            { id: 'remove', label: t('workflows.actions.remove'), icon: 'trash', run: () => fiche.removeAction(workflow.id, index) }
          ]
        }))
      },
      // Modifié : la version d'origine, pour comparer avant de rétablir.
      ...(system && system.state !== 'original'
        ? [
            {
              kind: 'list' as const,
              title: t('workflows.system.origin'),
              items: [
                { id: 'origin-name', title: t('workflows.general.name'), detail: system.origin.name },
                { id: 'origin-trigger', title: t('workflows.column.trigger'), detail: system.origin.trigger },
                ...system.origin.conditions.map((condition, index) => ({ id: `origin-condition-${index}`, title: t('workflows.system.origin.condition'), detail: condition })),
                ...system.origin.actions.map((action, index) => ({ id: `origin-action-${index}`, title: `${index + 1}.`, detail: action }))
              ]
            }
          ]
        : []),
      { kind: 'list', title: t('workflows.page.fiche.history'), items: history.slice(0, 10).map((item) => ({ ...item, open: runOpen(deps, item.line) })), empty: t('workflows.page.fiche.never') }
    ]
  }
}

/**
 * Le **journal**, en page : combien d'exécutions, réussies, en échec, refusées ou
 * arrêtées ; puis chaque exécution, jour par jour, la plus récente en tête — un clic ouvre
 * la fiche du workflow. Recherche (workflow, sujet, message) et filtres par issue.
 */
export async function journalPage(deps: HomeDeps): Promise<PageView> {
  const { t } = deps
  const items = journalItems(await readJournal(deps), 500)
  // Les exécutions des workflows système (par leur nom), pour les filtrer.
  const systemNames = new Set(deps.load().filter((each) => each.system).map((each) => each.name))
  const count = (tone: Tone) => items.filter((item) => item.tone === tone).length
  // Jour par jour : une liste par date, la plus récente en tête (le journal l'est déjà).
  const days = new Map<string, ListItem[]>()
  for (const item of items) {
    const day = (item.when ?? '').slice(0, 10)
    days.set(day, [...(days.get(day) ?? []), { ...item, when: (item.when ?? '').slice(11), open: runOpen(deps, item.line), tags: [OUTCOME_TAG[item.tone ?? 'neutral'], ...(systemNames.has(item.title) ? ['systeme'] : [])] }])
  }
  const dayTitle = (day: string) => {
    const date = new Date(`${day}T12:00:00`)
    return Number.isNaN(date.getTime()) ? day || '—' : date.toLocaleDateString(t('workflows.journal.locale'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  return {
    subtitle: t('workflows.journal.subtitle', { count: items.length }),
    actions: [
      { id: 'note', label: t('workflows.journal.note'), icon: 'book', run: deps.openJournal },
      ...(deps.showPage ? [{ id: 'all', label: t('workflows.home.all'), icon: 'flow' as const, run: () => deps.showPage?.(WORKFLOWS_PAGE) }] : [])
    ],
    search: { label: t('workflows.journal.search'), placeholder: t('workflows.journal.search.placeholder') },
    filters: [
      { id: 'reussies', label: t('workflows.journal.filter.done') },
      { id: 'echecs', label: t('workflows.journal.filter.failed') },
      { id: 'refusees', label: t('workflows.journal.filter.declined') },
      { id: 'arretees', label: t('workflows.journal.filter.stopped') },
      ...(systemNames.size ? [{ id: 'systeme', label: t('workflows.system.filter') }] : [])
    ],
    blocks: items.length
      ? [
          {
            kind: 'stats',
            stats: [
              { label: t('workflows.journal.stat.runs'), value: String(items.length), icon: 'play' },
              { label: t('workflows.journal.filter.done'), value: String(count('success')), icon: 'check', tone: 'success' },
              { label: t('workflows.journal.filter.failed'), value: String(count('danger')), icon: 'alert', tone: count('danger') ? 'danger' : 'success' },
              { label: t('workflows.journal.stat.other'), value: String(count('neutral') + count('warning')), icon: 'hide', hint: t('workflows.journal.stat.other.hint') }
            ]
          },
          ...[...days].map(([day, list]): HomeBlock => ({ kind: 'list', title: dayTitle(day), items: list }))
        ]
      : [{ kind: 'message', tone: 'info', text: t('workflows.journal.none') }]
  }
}

/**
 * La **fiche** d'une exécution : son issue et quand, son workflow, son sujet (« sur « Station
 * sol » ») ; ce que chaque étape a fait (une étape en échec, en rouge) ; les notes qu'elle a
 * écrites ; les autres exécutions du même workflow. En tête : la fiche du workflow, le
 * relancer, ouvrir la note du sujet, le journal.
 */
export async function runPage(deps: HomeDeps & { page: WorkflowsPageDeps }, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const line = param ? decodeURIComponent(param) : ''
  const runs = journalRuns(await readJournal(deps), 500)
  const run = runs.find((each) => each.line === line)
  const back: ViewAction = { id: 'back', label: t('workflows.journal.title'), run: () => deps.showPage?.(JOURNAL_PAGE) }
  if (!run) return { title: t('workflows.run.missing.title'), back, blocks: [{ kind: 'message', tone: 'warning', text: t('workflows.run.missing') }] }
  const workflow = deps.page.load().find((each) => each.name === run.name)
  const failed = (step: string) => /a échoué|failed|manque|missing|inconnue|unknown/i.test(step)
  const stepItems: ListItem[] = run.steps.map((step, index) => ({ id: `step-${index}`, title: step.replace(/^\d+\.\s*/, ''), when: t('workflows.run.step', { step: index + 1 }), tone: failed(step) ? 'danger' : 'success' }))
  const noteItems: ListItem[] = run.paths.map((path) => ({ id: path, title: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), detail: path, open: { id: 'open', label: t('workflows.run.note'), run: () => deps.openNote(path) } }))
  const others: ListItem[] = runs
    .filter((each) => each.name === run.name && each.line !== run.line)
    .slice(0, 10)
    .map((each, index) => ({ id: `other-${index}`, title: `${each.outcome} — ${each.subject || t('workflows.run.noSubject')}`, when: each.when, tone: each.tone, open: runOpen(deps, each.line) }))
  return {
    title: t('workflows.run.title', { name: run.name, when: run.when }),
    back,
    subtitle: [run.subject, run.when].filter(Boolean).join(' · '),
    actions: [
      ...(workflow && deps.showPage ? [{ id: 'workflow', label: t('workflows.run.workflow'), icon: 'flow' as const, run: () => deps.showPage?.(pageWith(WORKFLOW_PAGE, workflow.id)) }] : []),
      ...(workflow ? [{ id: 'again', label: t('workflows.run.again'), icon: 'play' as const, primary: run.tone === 'danger', run: () => deps.page.runNow(workflow.id) }] : []),
      ...(run.subjectPath ? [{ id: 'subject', label: t('workflows.run.subject'), icon: 'file' as const, run: () => deps.openNote(run.subjectPath) }] : []),
      { id: 'journal', label: t('workflows.journal.note'), icon: 'book', run: deps.openJournal }
    ],
    blocks: [
      ...(workflow ? [] : [{ kind: 'message' as const, tone: 'info' as const, text: t('workflows.run.deleted') }]),
      {
        kind: 'stats',
        stats: [
          { label: t('workflows.run.outcome'), value: run.outcome.charAt(0).toUpperCase() + run.outcome.slice(1), icon: run.tone === 'success' ? 'check' : run.tone === 'danger' ? 'alert' : 'hide', tone: run.tone },
          { label: t('workflows.run.when'), value: run.when.slice(11), icon: 'clock', hint: run.when.slice(0, 10) },
          { label: t('workflows.run.steps'), value: String(run.steps.length), icon: 'flow' },
          { label: t('workflows.run.notes'), value: String(run.paths.length), icon: 'file' }
        ]
      },
      { kind: 'list', title: t('workflows.run.stepsTitle', { count: run.steps.length }), items: stepItems, empty: t('workflows.run.stepsNone') },
      { kind: 'list', title: t('workflows.run.notesTitle', { count: run.paths.length }), items: noteItems, empty: t('workflows.run.notesNone') },
      { kind: 'list', title: t('workflows.run.others', { name: run.name }), items: others, empty: t('workflows.run.othersNone') }
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
      const items = journalItems(await readJournal(deps), 5).map((item) => ({ ...item, open: runOpen(deps, item.line) }))
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
              { id: 'new', label: t('workflows.command.new'), icon: 'plus', run: newWorkflow(deps) },
              // Avec une page, le lien d'en-tête y mène déjà.
              ...(withPage.page ? [] : [{ id: 'list', label: t('workflows.home.all'), icon: 'flow' as const, run: open }]),
              { id: 'journal', label: t('workflows.home.journal'), icon: 'book', run: openJournalPage(deps) }
            ]
          }
        ]
      }
    }
  })
  if (deps.page) {
    const page = deps.page
    views.page({ id: WORKFLOWS_PAGE, title: t('workflows.page.title'), icon: 'flow', load: () => workflowsPage({ ...deps, page }) })
    if (deps.showPage) {
      views.page({ id: JOURNAL_PAGE, title: t('workflows.journal.title'), icon: 'book', parent: WORKFLOWS_PAGE, load: () => journalPage(deps) })
      views.page({ id: RUN_PAGE, title: t('workflows.run.page'), icon: 'play', parent: WORKFLOWS_PAGE, load: (param) => runPage({ ...deps, page }, param) })
    }
    const fiche = page.fiche
    if (fiche) views.page({ id: WORKFLOW_PAGE, title: t('workflows.page.fiche.title'), icon: 'flow', parent: WORKFLOWS_PAGE, load: (id) => workflowPage({ ...deps, page: { ...page, fiche } }, id) })
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
  views.tile({ id: 'workflows.nouveau', label: t('workflows.command.new'), icon: 'plus', color: 'rose', group, order: 31, description: t('workflows.tile.new.desc'), run: newWorkflow(deps) })
  views.tile({ id: 'workflows.journal', label: t('workflows.home.journal'), icon: 'book', color: 'rose', group, order: 32, description: t('workflows.tile.journal.desc'), ...(deps.showPage && deps.page ? { page: JOURNAL_PAGE } : {}), run: openJournalPage(deps) })
}
