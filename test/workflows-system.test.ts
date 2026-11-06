// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **workflows système** : déclarés par les modules pour leurs automatismes, créés à
 * l'activation (actifs ou non selon ce qui est prévu), mis à jour avec le plugin tant que
 * l'utilisateur ne les a pas modifiés ; modifiables, désactivables, rétablis à l'origine,
 * jamais supprimés ; masqués et sans effet quand leur module est désactivé.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type PageView } from '../src/core/views'
import {
  emitWorkflowEvent,
  forgetDeclarations,
  NO_SUBJECT,
  registerSystemWorkflow,
  registerTrigger,
  runOpeningWorkflows,
  workflowsModule,
  type Workflow
} from '../src/modules/workflows'

const i18n = createI18n('fr')
i18n.register('fr', workflowsModule.texts.fr)
i18n.register('fr', { 'test.name': 'Module d’essai', 'test.sys': 'Prévenir à l’essai' })

/** Un module d'essai : un déclencheur, et un workflow système qui prévient. */
function declare(message = 'Bonjour', enabledByDefault = true) {
  registerTrigger({ id: 'test.arrive', labelKey: 'test.sys', descKey: 'test.sys', fields: [] })
  registerSystemWorkflow({
    id: 'sys.test.prevenir',
    moduleKey: 'test.name',
    enabledByDefault,
    make: (tr) => ({ name: tr('test.sys'), mode: 'auto', trigger: { kind: 'test.arrive' }, conditions: [], actions: [{ kind: 'notifier', fields: { message } }] })
  })
}

async function start(platform: MemoryPlatform, stored: Workflow[] = []) {
  const settings: Record<string, unknown> = { workflows: stored }
  const commands = new Map<string, ModuleCommand>()
  const views = new ViewsRegistry()
  const shown: string[] = []
  const context: ModuleContext = {
    moduleId: 'workflows',
    platform,
    i18n,
    settings: { get: () => settings, save: async (values) => void Object.assign(settings, values), onChange: () => () => {} },
    commands: { register: (command) => void commands.set(command.id, command), run: async (id) => commands.get(id)?.run() },
    views,
    showPage: (id: string) => void shown.push(id)
  }
  await (workflowsModule as BlackModule).activate(context)
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  return { settings, views, shown, run: (id: string) => commands.get(id)!.run(), page, workflows: () => settings.workflows as Workflow[] }
}

const cardsOf = (view: PageView): Card[] => view.blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => forgetDeclarations('sys.test'))
afterEach(async () => {
  await workflowsModule.deactivate?.()
  forgetDeclarations('sys.test')
})

describe('les workflows système', () => {
  it('créés à l’activation, actifs ou non selon ce qui est prévu ; un module qui en déclare après les crée aussi', async () => {
    declare()
    const { workflows } = await start(memoryPlatform())
    expect(workflows()).toMatchObject([{ id: 'sys.test.prevenir', system: 'sys.test.prevenir', name: 'Prévenir à l’essai', enabled: true }])
    expect(workflows()[0]!.base).toBeTruthy()
    // Déclaré après l'activation (un module activé plus tard) : créé aussitôt.
    registerSystemWorkflow({ id: 'sys.test.autre', moduleKey: 'test.name', enabledByDefault: false, make: () => ({ name: 'Autre', mode: 'ask', trigger: { kind: 'manuel' }, conditions: [], actions: [] }) })
    await flush()
    expect(workflows().map((each) => `${each.id}:${each.enabled}`)).toEqual(['sys.test.prevenir:true', 'sys.test.autre:false'])
  })

  it('pas modifié : il suit la nouvelle version du plugin ; modifié : il est gardé, et la page le dit', async () => {
    declare('Bonjour')
    const run = await start(memoryPlatform())
    declare('Bonjour à tous')
    await flush()
    expect(run.workflows()[0]!.actions[0]!.fields.message).toBe('Bonjour à tous')
    // L'utilisateur le modifie ; puis une nouvelle version arrive : la sienne reste.
    run.settings.workflows = run.workflows().map((each) => ({ ...each, actions: [{ kind: 'notifier', fields: { message: 'Salut' } }] }))
    declare('Bonjour, version 3')
    await flush()
    expect(run.workflows()[0]!.actions[0]!.fields.message).toBe('Salut')
    const fiche = await run.page('workflows.fiche').load('sys.test.prevenir')
    expect(fiche.blocks[0]).toMatchObject({ kind: 'message', tone: 'warning', text: expect.stringMatching(/^Workflow système du module Module d’essai.*une version d’origine plus récente/) })
    const origin = fiche.blocks.find((block) => block.kind === 'list' && block.title === 'La version d’origine')
    expect(origin?.kind === 'list' && origin.items.some((item) => item.detail?.endsWith('Bonjour, version 3'))).toBe(true)
    expect(fiche.actions?.map((action) => action.id)).toEqual(['run', 'disable', 'general', 'duplicate', 'restore'])
  })

  it('« Rétablir l’original » (confirmé) : la version d’origine revient, son état reste ; jamais « Supprimer »', async () => {
    declare('Bonjour')
    const platform = memoryPlatform()
    const run = await start(platform)
    run.settings.workflows = run.workflows().map((each) => ({ ...each, enabled: false, name: 'Mon rappel' }))
    const fiche = await run.page('workflows.fiche').load('sys.test.prevenir')
    expect(fiche.actions?.some((action) => action.id === 'delete')).toBe(false)
    await fiche.actions!.find((action) => action.id === 'restore')!.run()
    expect(platform.confirmed.at(-1)?.title).toBe('Rétablir l’original ?')
    expect(run.workflows()[0]).toMatchObject({ name: 'Prévenir à l’essai', enabled: false })
    const after = await run.page('workflows.fiche').load('sys.test.prevenir')
    expect(after.actions?.map((action) => action.id)).toEqual(['run', 'enable', 'general', 'duplicate'])
    expect(after.blocks.find((block) => block.kind === 'list' && block.title === 'La version d’origine')).toBeUndefined()
  })

  it('dupliquer donne un workflow ordinaire ; exporter ne garde pas la marque « système »', async () => {
    declare()
    const platform = memoryPlatform()
    const run = await start(platform)
    const fiche = await run.page('workflows.fiche').load('sys.test.prevenir')
    await fiche.actions!.find((action) => action.id === 'duplicate')!.run()
    const copy = run.workflows().at(-1)!
    expect(copy.system).toBeUndefined()
    expect(copy.base).toBeUndefined()
    expect((await run.page('workflows.fiche').load(copy.id)).actions?.some((action) => action.id === 'delete')).toBe(true)
    platform.manyAnswers.push(['sys.test.prevenir'])
    await run.run('exporter')
    const exported = [...platform.files.entries()].find(([path]) => path.endsWith('.json'))!
    expect(new TextDecoder().decode(exported[1])).not.toMatch(/"system"|"base"/)
  })

  it('la liste : badge « Système », « Modifié » s’il l’est, un filtre ; un succès ne prévient pas, le journal le garde', async () => {
    declare('Bonjour')
    const platform = memoryPlatform()
    const run = await start(platform)
    const list = await run.page('workflows.liste').load()
    expect(list.filters?.map((filter) => filter.id)).toContain('systeme')
    const card = cardsOf(list)[0]!
    expect(card.badges?.map((badge) => badge.label)).toContain('Système')
    expect(card.tags).toContain('systeme')
    await emitWorkflowEvent('test.arrive', NO_SUBJECT)
    // L'action prévient (« Bonjour ») ; le workflow, lui, ne dit pas « exécuté ».
    expect(platform.notices).toEqual(['Bonjour'])
    const journal = await run.page('workflows.journal').load()
    expect(journal.filters?.map((filter) => filter.id)).toContain('systeme')
  })

  it('le module qui le déclare désactivé : masqué, et sans effet', async () => {
    declare()
    const platform = memoryPlatform()
    const run = await start(platform)
    forgetDeclarations('sys.test')
    expect(cardsOf(await run.page('workflows.liste').load())).toEqual([])
    registerTrigger({ id: 'test.arrive', labelKey: 'test.sys', descKey: 'test.sys', fields: [] })
    await emitWorkflowEvent('test.arrive', NO_SUBJECT)
    expect(platform.notices).toEqual([])
    // Gardé dans les réglages : il revient avec son module, tel que l'utilisateur l'a laissé.
    expect(run.workflows()).toHaveLength(1)
  })

  it('« À l’ouverture d’Obsidian » : un déclencheur, une fois par session', async () => {
    registerSystemWorkflow({ id: 'sys.test.ouverture', moduleKey: 'test.name', enabledByDefault: true, make: () => ({ name: 'Bonjour à l’ouverture', mode: 'auto', trigger: { kind: 'ouverture' }, conditions: [], actions: [{ kind: 'notifier', fields: { message: 'Ouvert' } }] }) })
    const platform = memoryPlatform()
    await start(platform)
    await runOpeningWorkflows()
    expect(platform.notices).toEqual(['Ouvert'])
  })
})
