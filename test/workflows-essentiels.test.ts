// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **D'origine, seuls les workflows essentiels sont actifs** (le réglage du module Workflows,
 * oui par défaut) : les workflows système sont créés désactivés, sauf les essentiels ; un
 * coffre existant y est ramené une fois ; le réglage changé, l'état suit la nouvelle origine
 * — une fois, ce que l'utilisateur change ensuite est gardé.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { aoModule } from '../src/modules/ao'
import { bibliothequeModule } from '../src/modules/bibliotheque'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { forgetDeclarations, registerSystemWorkflow, registerTrigger, workflowsModule, type Workflow } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]

const i18n = createI18n('fr')
i18n.register('fr', workflowsModule.texts.fr)
i18n.register('fr', { 'test.name': 'Module d’essai', 'test.sys': 'Essai' })

function declare() {
  registerTrigger({ id: 'test.arrive', labelKey: 'test.sys', descKey: 'test.sys', fields: [] })
  const spec = (id: string, enabledByDefault: boolean, essential: boolean) =>
    registerSystemWorkflow({
      id: `sys.test.${id}`,
      moduleKey: 'test.name',
      enabledByDefault,
      ...(essential ? { essential: true } : {}),
      make: () => ({ name: id, mode: 'auto', trigger: { kind: 'test.arrive' }, conditions: [], actions: [{ kind: 'notifier', fields: { message: id } }] })
    })
  spec('essentiel', true, true)
  spec('ordinaire', true, false)
  spec('inactif', false, false)
}

async function start(settings: Record<string, unknown>) {
  const listeners: ((values: Readonly<Record<string, unknown>>) => void)[] = []
  const context: ModuleContext = {
    moduleId: 'workflows',
    platform: memoryPlatform(),
    i18n,
    settings: {
      get: () => settings,
      save: async (values) => void Object.assign(settings, values),
      onChange: (listener) => {
        listeners.push(listener)
        return () => {}
      }
    },
    commands: { register: () => {}, run: async () => {} },
    views: new ViewsRegistry()
  }
  await (workflowsModule as BlackModule).activate(context)
  const state = () =>
    Object.fromEntries((settings.workflows as Workflow[]).filter((each) => each.system?.startsWith('sys.test.') || each.system === 'sys.workflows.casses' || each.system === 'sys.workflows.bilan-hebdo').map((each) => [each.id, each.enabled]))
  const change = async (values: Record<string, unknown>) => {
    Object.assign(settings, values)
    listeners.forEach((listener) => listener(settings))
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return { state, change }
}

beforeEach(() => forgetDeclarations('sys.test'))
afterEach(async () => {
  await workflowsModule.deactivate?.()
  forgetDeclarations('sys.test')
})

describe('d’origine, seuls les workflows essentiels sont actifs', () => {
  it('par défaut : les essentiels actifs (dont le signalement des workflows cassés), les autres désactivés', async () => {
    declare()
    const { state } = await start({})
    expect(state()).toEqual({ 'sys.workflows.casses': true, 'sys.workflows.bilan-hebdo': false, 'sys.test.essentiel': true, 'sys.test.ordinaire': false, 'sys.test.inactif': false })
  })

  it('un coffre existant (créé avant ce réglage) est ramené aux essentiels, une fois', async () => {
    declare()
    const settings: Record<string, unknown> = { essentielsSeulement: false }
    const before = await start(settings)
    expect(before.state()['sys.test.ordinaire']).toBe(true)
    await workflowsModule.deactivate?.()
    // Le coffre d'avant : pas de marque d'origine sur ses workflows système.
    settings.workflows = (settings.workflows as Workflow[]).map((each) => {
      const copy = { ...each }
      delete copy.defaults
      return copy
    })
    delete settings.essentielsSeulement
    const after = await start(settings)
    expect(after.state()).toMatchObject({ 'sys.test.essentiel': true, 'sys.test.ordinaire': false })
    // Réactivé à la main : gardé aux activations suivantes.
    settings.workflows = (settings.workflows as Workflow[]).map((each) => (each.id === 'sys.test.ordinaire' ? { ...each, enabled: true } : each))
    await workflowsModule.deactivate?.()
    const again = await start(settings)
    expect(again.state()['sys.test.ordinaire']).toBe(true)
  })

  it('le réglage désactivé : chaque module active ce qu’il prévoit ; réactivé : retour aux essentiels', async () => {
    declare()
    const settings: Record<string, unknown> = {}
    const { state, change } = await start(settings)
    await change({ essentielsSeulement: false })
    expect(state()).toMatchObject({ 'sys.test.essentiel': true, 'sys.test.ordinaire': true, 'sys.test.inactif': false })
    await change({ essentielsSeulement: true })
    expect(state()).toMatchObject({ 'sys.test.essentiel': true, 'sys.test.ordinaire': false, 'sys.test.inactif': false })
  })

  it('les essentiels déclarés : le circuit des documents, l’entrée dans la bibliothèque, les workflows cassés', async () => {
    const platform = memoryPlatform()
    const i18n2 = createI18n('fr')
    for (const module of MODULES) i18n2.register('fr', module.texts.fr)
    const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false } }
    for (const module of MODULES) {
      const context: ModuleContext = {
        moduleId: module.id,
        platform,
        i18n: i18n2,
        settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
        commands: { register: () => {} },
        views: new ViewsRegistry(),
        showPage: () => {}
      }
      await module.activate(context)
    }
    const active = (settings.workflows!.workflows as Workflow[]).filter((each) => each.system && each.enabled).map((each) => each.system)
    for (const module of [...MODULES].reverse()) await module.deactivate?.()
    expect(active.sort()).toEqual(
      [
        'sys.bibliotheque.depot-ouverture',
        'sys.bibliotheque.depot-quotidien',
        'sys.bibliotheque.rappel-a-controler',
        'sys.bibliotheque.ranger-fichiers',
        'sys.bibliotheque.relancer-circuit',
        'sys.ia.circuit',
        'sys.workflows.casses'
      ].sort()
    )
  })
})
