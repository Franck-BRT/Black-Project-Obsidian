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
import { ViewsRegistry, type Card, type PageView } from '../src/core/views'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

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
  await platform.fs.writeText('Black Projects/Workflows/Journal des workflows.md', '# Journal\n\n- 2026-11-05 08:30 · ❌ Échec · **Rappel du matin** · le serveur ne répond pas\n- 2026-11-04 08:30 · ✅ Réussi · **Rappel du matin**\n')
  const commands = new Map<string, ModuleCommand>()
  const views = new ViewsRegistry()
  const shown: string[] = []
  const context: ModuleContext = {
    moduleId: 'workflows',
    platform,
    i18n,
    settings: { get: () => settings.workflows ?? {}, save: async (values) => void (settings.workflows = values), onChange: () => () => {} },
    commands: { register: (command) => void commands.set(command.id, command), run: async (id) => commands.get(id)?.run() },
    views,
    ...(withPages ? { showPage: (id: string) => void shown.push(id) } : {})
  }
  await (workflowsModule as BlackModule).activate(context)
  return { views, shown, settings, run: (id: string) => commands.get(id)!.run() }
}

const cardsOf = (view: PageView): Card[] => view.blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))

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
    expect(views.pages()).toHaveLength(1)
    const nav = views.navEntries().find((entry) => entry.id === 'workflows')!
    expect(nav.page).toBeUndefined()
    await nav.run()
    expect(lists).toHaveLength(1)
  })
})
