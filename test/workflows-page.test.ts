// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La page **Workflows** : l'entrée du menu, la tuile, la commande et le lien du tableau
 * de bord l'ouvrent (plus de liste en fenêtre) ; des chiffres, une carte par workflow —
 * déclencheur, actions, mode, état, échec récent — avec Exécuter, Activer ou Désactiver,
 * et le journal récent. Sans page chez la plateforme, la liste en fenêtre reste.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { forgetDeclarations, workflowsModule, type Workflow } from '../src/modules/workflows'

const workflow = (id: string, name: string, extra: Partial<Workflow> = {}): Workflow => ({
  id,
  name,
  enabled: true,
  mode: 'auto',
  trigger: { kind: 'manuel' },
  conditions: [],
  actions: [{ kind: 'notifier', fields: { message: 'Bonjour' } }],
  created: '2026-11-01T08:00:00.000Z',
  ...extra
})

/** Le journal d'exemple : un échec avec son sujet et sa note, une réussite qui a écrit une note. */
const JOURNAL_LINES = [
  '- 2026-11-05 08:30 · ❌ échec · **Rappel du matin** · sur « Station sol » ([[Appels d’offres/Station sol/Station sol]]) — Étape 1 (Prévenir) a échoué : le serveur ne répond pas',
  '- 2026-11-04 08:30 · ✅ fait · **Rappel du matin** — 1. Prévenir : envoyé ; 2. Créer une note : écrite · [[Black Projects/Rappels/Rappel du 4]]'
]

async function start(platform: MemoryPlatform, withPages: boolean) {
  const i18n = createI18n('fr')
  i18n.register('fr', workflowsModule.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {
    workflows: {
      workflows: [
        workflow('wf-1', 'Rappel du matin', { trigger: { kind: 'planifie', every: 'day', time: '08:30' } }),
        workflow('wf-2', 'Prévenir à la main', { enabled: false, mode: 'ask' })
      ]
    }
  }
  await platform.fs.writeText('Black Projects/Workflows/Journal des workflows.md', `# Journal\n\n${JOURNAL_LINES.join('\n')}\n`)
  const commands = new Map<string, ModuleCommand>()
  const views = new ViewsRegistry()
  const shown: string[] = []
  const noted: string[] = []
  const context: ModuleContext = {
    moduleId: 'workflows',
    platform,
    i18n,
    settings: { get: () => settings.workflows ?? {}, save: async (values) => void (settings.workflows = values), onChange: () => () => {} },
    commands: { register: (command) => void commands.set(command.id, command), run: async (id) => commands.get(id)?.run() },
    views,
    ...(withPages ? { showPage: (id: string) => void shown.push(id), showNote: async (path: string) => void noted.push(path) } : {})
  }
  await (workflowsModule as BlackModule).activate(context)
  // Les workflows d'entretien du module (testés dans workflows-upkeep.test.ts) : écartés, ces tests ne voient que les leurs.
  forgetDeclarations('sys.workflows')
  settings.workflows = { ...settings.workflows, workflows: ((settings.workflows?.workflows ?? []) as Workflow[]).filter((each) => !each.system?.startsWith('sys.workflows.')) }
  return { views, shown, noted, settings, run: (id: string) => commands.get(id)!.run() }
}

// Les cartes, sections repliables comprises (la page des workflows les range par sections).
const cardsIn = (blocks: readonly HomeBlock[]): Card[] => blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : block.kind === 'section' ? cardsIn(block.blocks) : []))
const cardsOf = (view: PageView): Card[] => cardsIn(view.blocks)

afterEach(async () => {
  await workflowsModule.deactivate?.()
})

describe('la page Workflows', () => {
  it('le menu, la tuile, la commande et le tableau de bord ouvrent la page, plus de liste en fenêtre', async () => {
    const platform = memoryPlatform()
    const lists: string[] = []
    platform.ui.pickFromList = async (view) => void lists.push(view.title) as unknown as null
    const { views, shown, run } = await start(platform, true)
    const nav = views.navEntries().find((entry) => entry.id === 'workflows')!
    const tile = views.allTiles().find((each) => each.id === 'workflows.liste')!
    expect(nav.page).toBe('workflows.liste')
    expect(tile.page).toBe('workflows.liste')
    await nav.run()
    await tile.run()
    await run('liste')
    const section = await views.homeSections()[0]!.load()
    expect(section?.actions?.map((action) => action.label)).toEqual(['Tous les workflows'])
    await section!.actions![0]!.run()
    expect(shown).toEqual(Array(4).fill('workflows.liste'))
    expect(lists).toEqual([])
  })

  it('les chiffres, une carte par workflow avec son échec récent, le journal ; filtres', async () => {
    const { views } = await start(memoryPlatform(), true)
    const view = await views.pages()[0]!.load()
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Workflows=2', 'Actifs=1', 'Exécutions récentes=2', 'Échecs récents=1'])
    const [morning, manual] = cardsOf(view)
    expect(morning!.title).toBe('Rappel du matin')
    expect(morning!.badges?.map((badge) => badge.label)).toEqual(['Actif', 'Tout seul', 'Dernière exécution en échec'])
    expect(morning!.tags).toEqual(['actifs', 'en-echec', 'planifies', 'tout-seuls'])
    expect(morning!.text).toMatch(/^1\. /)
    expect(morning!.actions?.map((action) => action.id)).toEqual(['edit', 'run', 'disable'])
    // Pas encore compté, mais dans le journal : le journal le dit.
    expect(morning!.facts?.map((fact) => fact.value)).toEqual(['2', '2026-11-05 08:30'])
    // Jamais exécuté : rien.
    expect(manual!.facts?.map((fact) => fact.value)).toEqual(['0', '—'])
    expect(manual!.tags).toEqual(['desactives', 'manuels', 'demandent'])
    expect(manual!.actions?.map((action) => action.id)).toEqual(['edit', 'run', 'enable'])
    const journal = view.blocks.find((block) => block.kind === 'list')
    expect(journal?.kind === 'list' && journal.title).toBe('Dernières exécutions')
    expect(journal?.kind === 'list' && journal.items).toHaveLength(2)
    expect(view.filters?.map((filter) => filter.id)).toContain('en-echec')
  })

  it('Activer depuis la carte : le workflow est activé et enregistré', async () => {
    const { views, settings } = await start(memoryPlatform(), true)
    const manual = cardsOf(await views.pages()[0]!.load())[1]!
    await manual.actions!.find((action) => action.id === 'enable')!.run()
    expect((settings.workflows!.workflows as Workflow[]).find((each) => each.id === 'wf-2')!.enabled).toBe(true)
  })

  it('sans page chez la plateforme : la liste en fenêtre, comme avant', async () => {
    const platform = memoryPlatform()
    const lists: string[] = []
    platform.ui.pickFromList = async (view) => {
      lists.push(view.title)
      return null
    }
    const { views } = await start(platform, false)
    expect(views.pages().map((each) => each.id)).toEqual(['workflows.liste', 'workflows.fiche'])
    const nav = views.navEntries().find((entry) => entry.id === 'workflows')!
    expect(nav.page).toBeUndefined()
    await nav.run()
    expect(lists).toHaveLength(1)
  })
})

describe('la fiche d’un workflow, en page', () => {
  async function fiche() {
    const platform = memoryPlatform()
    let confirmed = true
    platform.ui.confirm = async () => confirmed
    const run = await start(platform, true)
    // Deux actions et une condition, pour ranger.
    const stored = run.settings.workflows!.workflows as Workflow[]
    stored[0] = { ...stored[0]!, conditions: [{ field: 'type', op: 'is', value: 'CCTP' }], actions: [{ kind: 'notifier', fields: { message: 'Un' } }, { kind: 'notifier', fields: { message: 'Deux' } }] }
    const page = run.views.pages().find((each) => each.id === 'workflows.fiche')!
    return { ...run, page, platform, refuse: () => void (confirmed = false), stored: () => run.settings.workflows!.workflows as Workflow[] }
  }

  it('un clic sur un workflow ouvre sa fiche ; elle dépend de la liste (menu marqué)', async () => {
    const { views, shown, page } = await fiche()
    const card = cardsOf(await views.pages()[0]!.load())[0]!
    await card.open!.run()
    await card.actions!.find((action) => action.id === 'edit')!.run()
    expect(shown).toEqual(['workflows.fiche?wf-1', 'workflows.fiche?wf-1'])
    expect(page.parent).toBe('workflows.liste')
  })

  it('tout d’un coup d’œil : titre, retour, boutons, chiffres, conditions, actions, historique', async () => {
    const { page } = await fiche()
    const view = await page.load('wf-1')
    expect(view.title).toBe('Rappel du matin')
    expect(view.back?.label).toBe('Tous les workflows')
    expect(view.actions?.map((action) => action.id)).toEqual(['run', 'disable', 'general', 'duplicate', 'delete'])
    const groups = view.blocks.filter((block) => block.kind === 'cards')
    expect(groups.map((block) => block.kind === 'cards' && block.title)).toEqual(['Conditions (1)', 'Actions (2), dans l’ordre'])
    const actions = groups[1]!.kind === 'cards' ? groups[1]!.cards : []
    expect(actions.map((card) => card.actions!.map((action) => action.id))).toEqual([
      ['edit', 'down', 'remove'],
      ['edit', 'up', 'remove']
    ])
    const history = view.blocks.find((block) => block.kind === 'list')
    expect(history?.kind === 'list' && history.items.map((item) => item.tone)).toEqual(['danger', 'success'])
  })

  it('chaque bouton fait une chose : descendre, retirer une action, retirer une condition', async () => {
    const { page, stored } = await fiche()
    const groups = (await page.load('wf-1')).blocks.filter((block) => block.kind === 'cards')
    const first = groups[1]!.kind === 'cards' ? groups[1]!.cards[0]! : null
    await first!.actions!.find((action) => action.id === 'down')!.run()
    expect(stored()[0]!.actions.map((action) => action.fields.message)).toEqual(['Deux', 'Un'])
    const again = (await page.load('wf-1')).blocks.filter((block) => block.kind === 'cards')
    await (again[1]!.kind === 'cards' ? again[1]!.cards[1]! : null)!.actions!.find((action) => action.id === 'remove')!.run()
    expect(stored()[0]!.actions.map((action) => action.fields.message)).toEqual(['Deux'])
    await (again[0]!.kind === 'cards' ? again[0]!.cards[0]! : null)!.actions![0]!.run()
    expect(stored()[0]!.conditions).toEqual([])
  })

  it('dupliquer ouvre la copie ; supprimer (confirmé) revient à la liste ; un workflow disparu le dit', async () => {
    const { page, shown, stored, refuse } = await fiche()
    const view = await page.load('wf-1')
    await view.actions!.find((action) => action.id === 'duplicate')!.run()
    expect(stored()).toHaveLength(3)
    expect(shown.at(-1)).toBe(`workflows.fiche?${stored()[2]!.id}`)
    await view.actions!.find((action) => action.id === 'delete')!.run()
    expect(stored().map((each) => each.id)).not.toContain('wf-1')
    expect(shown.at(-1)).toBe('workflows.liste')
    refuse()
    const other = await page.load('wf-2')
    await other.actions!.find((action) => action.id === 'delete')!.run()
    expect(stored().map((each) => each.id)).toContain('wf-2')
    const missing = await page.load('wf-1')
    expect(missing.title).toBe('Workflow introuvable')
    expect(missing.blocks[0]).toMatchObject({ kind: 'message', tone: 'warning' })
  })
})

describe('le journal, en page', () => {
  it('les chiffres, jour par jour ; un clic sur une exécution ouvre sa fiche', async () => {
    const { views, shown } = await start(memoryPlatform(), true)
    const page = views.pages().find((each) => each.id === 'workflows.journal')!
    expect(page.parent).toBe('workflows.liste')
    const view = await page.load()
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Exécutions=2', 'Réussies=1', 'Échecs=1', 'Refusées ou arrêtées=0'])
    const days = view.blocks.filter((block) => block.kind === 'list')
    expect(days.map((block) => block.kind === 'list' && block.title)).toEqual(['jeudi 5 novembre 2026', 'mercredi 4 novembre 2026'])
    const failed = days[0]!.kind === 'list' ? days[0]!.items[0]! : null
    expect(failed).toMatchObject({ title: 'Rappel du matin', when: '08:30', tone: 'danger', tags: ['echecs'] })
    await failed!.open!.run()
    expect(shown.at(-1)).toBe(`workflows.execution?${encodeURIComponent(JOURNAL_LINES[0])}`)
    expect(view.filters?.map((filter) => filter.id)).toEqual(['reussies', 'echecs', 'refusees', 'arretees'])
  })

  it('la tuile, le tableau de bord et la commande mènent au journal en page', async () => {
    const { views, shown, run } = await start(memoryPlatform(), true)
    const tile = views.allTiles().find((each) => each.id === 'workflows.journal')!
    expect(tile.page).toBe('workflows.journal')
    await tile.run()
    await run('journal')
    const section = await views.homeSections()[0]!.load()
    const items = section!.blocks.find((block) => block.kind === 'list')
    await (items?.kind === 'list' ? items.items[0]! : null)!.open!.run()
    expect(shown).toEqual(['workflows.journal', 'workflows.journal', `workflows.execution?${encodeURIComponent(JOURNAL_LINES[0])}`])
  })
})

describe('la fiche d’une exécution, en page', () => {
  it('issue, heure, sujet, étapes (l’échec en rouge), notes écrites, autres exécutions', async () => {
    const { views, shown } = await start(memoryPlatform(), true)
    const page = views.pages().find((each) => each.id === 'workflows.execution')!
    expect(page.parent).toBe('workflows.liste')
    const failed = await page.load(encodeURIComponent(JOURNAL_LINES[0]!))
    expect(failed.title).toBe('Rappel du matin — 2026-11-05 08:30')
    expect(failed.subtitle).toBe('sur « Station sol » · 2026-11-05 08:30')
    expect(failed.actions?.map((action) => action.id)).toEqual(['workflow', 'again', 'subject', 'journal'])
    expect(failed.actions?.find((action) => action.id === 'again')?.primary).toBe(true)
    const stats = failed.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Issue=Échec', 'Heure=08:30', 'Étapes=1', 'Notes écrites=0'])
    const [steps, , others] = failed.blocks.filter((block) => block.kind === 'list')
    expect(steps?.kind === 'list' && steps.items.map((item) => item.tone)).toEqual(['danger'])
    expect(others?.kind === 'list' && others.items.map((item) => item.title)).toEqual(['fait — sans sujet'])
    await failed.actions!.find((action) => action.id === 'workflow')!.run()
    expect(shown.at(-1)).toBe('workflows.fiche?wf-1')
    const done = await page.load(encodeURIComponent(JOURNAL_LINES[1]!))
    const lists = done.blocks.filter((block) => block.kind === 'list')
    expect(lists[0]!.kind === 'list' && lists[0]!.items.map((item) => `${item.when}:${item.title}:${item.tone}`)).toEqual(['étape 1:Prévenir : envoyé:success', 'étape 2:Créer une note : écrite:success'])
    expect(lists[1]!.kind === 'list' && lists[1]!.items.map((item) => item.detail)).toEqual(['Black Projects/Rappels/Rappel du 4.md'])
  })

  it('son sujet et les notes qu’elle a écrites s’ouvrent par la plateforme : leur page quand un module en a une', async () => {
    const platform = memoryPlatform()
    const { views, noted } = await start(platform, true)
    const page = views.pages().find((each) => each.id === 'workflows.execution')!
    const failed = await page.load(encodeURIComponent(JOURNAL_LINES[0]!))
    const subject = failed.actions!.find((action) => action.id === 'subject')!
    expect(subject.label).toBe('Ouvrir le sujet')
    await subject.run()
    const done = await page.load(encodeURIComponent(JOURNAL_LINES[1]!))
    const written = done.blocks.filter((block) => block.kind === 'list')[1]
    await (written?.kind === 'list' ? written.items[0]! : null)!.open!.run()
    expect(noted).toEqual([expect.stringMatching(/Station sol/), 'Black Projects/Rappels/Rappel du 4.md'])
    expect(platform.opened).toEqual([])
  })

  it('une exécution sortie du journal : la page le dit', async () => {
    const { views } = await start(memoryPlatform(), true)
    expect((await views.pages().find((each) => each.id === 'workflows.execution')!.load(encodeURIComponent('- disparue'))).title).toBe('Exécution introuvable')
  })
})

describe('exécuter et créer un workflow, en page', () => {
  it('« Exécuter » sur la fiche : l’exécution faite, sa page — ce qu’elle a fait', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    const fiche = await views.pages().find((each) => each.id === 'workflows.fiche')!.load('wf-1')
    await fiche.actions!.find((action) => action.id === 'run')!.run()
    expect(platform.notices).toContain('Bonjour')
    const last = shown.at(-1)!
    expect(last).toMatch(/^workflows\.execution\?/)
    const run = await views.pages().find((each) => each.id === 'workflows.execution')!.load(last.slice(last.indexOf('?') + 1))
    expect(run.title).toMatch(/^Rappel du matin — \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(platform.opened).toEqual([])
  })

  it('« Exécuter » sur la carte de la liste et « Relancer » d’une exécution : la page de la nouvelle', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    const card = cardsOf(await views.pages().find((each) => each.id === 'workflows.liste')!.load()).find((each) => each.title === 'Rappel du matin')!
    await card.actions!.find((action) => action.id === 'run')!.run()
    const first = shown.at(-1)!
    expect(first).toMatch(/^workflows\.execution\?/)
    const runPage = views.pages().find((each) => each.id === 'workflows.execution')!
    const again = (await runPage.load(first.slice(first.indexOf('?') + 1))).actions!.find((action) => action.id === 'again')!
    await again.run()
    expect(shown.at(-1)).toMatch(/^workflows\.execution\?/)
  })

  it('un workflow sans action : rien n’est exécuté, on reste sur la fiche', async () => {
    const platform = memoryPlatform()
    const { views, shown, settings } = await start(platform, true)
    ;(settings.workflows!.workflows as Workflow[])[0]!.actions = []
    await (await views.pages().find((each) => each.id === 'workflows.fiche')!.load('wf-1')).actions!.find((action) => action.id === 'run')!.run()
    expect(shown).toEqual([])
  })

  it('« Nouveau workflow » de la liste, du tableau de bord ou de la tuile : sa fiche en page, pas la fenêtre', async () => {
    const platform = memoryPlatform()
    const { views, shown, settings } = await start(platform, true)
    const lists = platform.lists.length
    const offered = () => platform.offered.length
    platform.forms.push({ name: 'Mon workflow', trigger: 'manuel', mode: 'auto' })
    await (await views.pages().find((each) => each.id === 'workflows.liste')!.load()).actions!.find((action) => action.id === 'new')!.run()
    const created = (settings.workflows!.workflows as Workflow[]).find((each) => each.name === 'Mon workflow')!
    expect(shown.at(-1)).toBe(`workflows.fiche?${created.id}`)
    expect(platform.lists.length).toBe(lists)
    const before = offered()
    platform.forms.push({ name: 'Autre', trigger: 'manuel', mode: 'auto' })
    await views.allTiles().find((each) => each.id === 'workflows.nouveau')!.run()
    // Le formulaire seul : pas la fenêtre de la fiche (ses choix).
    expect(platform.offered.length - before).toBe(0)
    expect(shown.at(-1)).toMatch(/^workflows\.fiche\?/)
  })

  it('depuis la palette : la fiche en fenêtre, comme avant ; abandonné : rien', async () => {
    const platform = memoryPlatform()
    const { run, shown } = await start(platform, true)
    platform.forms.push({ name: 'Mon workflow', trigger: 'manuel', mode: 'auto' })
    const before = platform.offered.length
    await run('nouveau')
    expect(shown).toEqual([])
    // La fiche en fenêtre : ses choix sont proposés.
    expect(platform.offered.length - before).toBeGreaterThan(0)
  })
})

describe('importer des workflows, en page', () => {
  /** Exporter des workflows (par la commande), et rendre le chemin du fichier écrit. */
  async function exported(platform: MemoryPlatform, run: (id: string) => unknown, ids: string[]): Promise<string> {
    platform.manyAnswers.push(ids)
    await run('exporter')
    return [...platform.files.keys()].find((path) => path.startsWith('Black Projects/Échanges/') && path.endsWith('.json'))!
  }

  it('un workflow importé : sa fiche ensuite, qui dit qu’il est désactivé et à relire ; la liste le marque', async () => {
    const platform = memoryPlatform()
    const { views, shown, run, settings } = await start(platform, true)
    const path = await exported(platform, run, ['wf-1'])
    platform.choices.push('vault')
    platform.nextPick = path
    await (await views.pages().find((each) => each.id === 'workflows.liste')!.load()).actions!.find((action) => action.id === 'import')!.run()
    const all = settings.workflows!.workflows as Workflow[]
    const copy = all.at(-1)!
    expect(copy.enabled).toBe(false)
    expect(shown.at(-1)).toBe(`workflows.fiche?${copy.id}`)
    const fiche = await views.pages().find((each) => each.id === 'workflows.fiche')!.load(copy.id)
    expect(fiche.blocks[0]).toMatchObject({ kind: 'message', tone: 'info', text: expect.stringMatching(/^Importé, et donc désactivé/) })
    const list = await views.pages().find((each) => each.id === 'workflows.liste')!.load()
    expect(list.filters?.map((filter) => filter.id)).toContain('importes')
    expect(list.blocks[0]).toMatchObject({ kind: 'message', text: expect.stringMatching(/^1 workflow\(s\) importé\(s\) attendent/) })
    const first = cardsOf(list)[0]!
    expect(first.id).toBe(copy.id)
    expect(first.badges?.map((badge) => badge.label)).toContain('Importé — désactivé, à relire')
    expect(first.tags).toContain('importes')
    // Activé : plus de message en tête de la liste, la carte reste « Importé ».
    await first.actions!.find((action) => action.id === 'enable')!.run()
    const after = await views.pages().find((each) => each.id === 'workflows.liste')!.load()
    expect(after.blocks[0]!.kind).toBe('stats')
    expect(cardsOf(after)[0]!.badges?.map((badge) => badge.label)).toContain('Importé')
  })

  it('plusieurs workflows importés : la liste, eux en tête ; depuis la palette, le message seul', async () => {
    const platform = memoryPlatform()
    const { views, shown, run } = await start(platform, true)
    const path = await exported(platform, run, ['wf-1', 'wf-2'])
    platform.choices.push('vault')
    platform.nextPick = path
    await (await views.pages().find((each) => each.id === 'workflows.liste')!.load()).actions!.find((action) => action.id === 'import')!.run()
    expect(shown.at(-1)).toBe('workflows.liste')
    const cards = cardsOf(await views.pages().find((each) => each.id === 'workflows.liste')!.load())
    expect(cards.slice(0, 2).every((card) => card.tags?.includes('importes'))).toBe(true)
    shown.length = 0
    platform.choices.push('vault')
    platform.nextPick = path
    await run('importer')
    expect(shown).toEqual([])
    expect(platform.notices.at(-1)).toMatch(/^2 workflow/)
  })
})

describe('la page Workflows, en sections repliables', () => {
  it('d’abord les workflows système, une sous-section par module (repliée), puis mes workflows', async () => {
    const platform = memoryPlatform()
    const { views } = await start(platform, true)
    const view = await views.pages()[0]!.load()
    const sections = view.blocks.filter((block) => block.kind === 'section')
    expect(sections.map((block) => block.kind === 'section' && block.id)).toEqual(['workflows.miens'])
    const mine = sections[0]!
    expect(mine).toMatchObject({ kind: 'section', title: 'Mes workflows', subtitle: '2 workflow(s), 1 actif(s) · 1 en échec' })
  })
})
