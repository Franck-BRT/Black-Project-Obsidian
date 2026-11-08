// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'entretien des workflows, en workflows système du module Workflows : **signaler les
 * workflows cassés, à l'ouverture** (activé), **bilan des workflows, chaque lundi**
 * (désactivé), **archiver le journal, chaque mois** (désactivé).
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { runOpeningWorkflows, workflowsModule, type Workflow } from '../src/modules/workflows'

const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'

const day = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const line = (offset: number, ok: boolean, name: string) => `- ${day(offset)} 08:30 · ${ok ? '✅ fait' : '❌ échec'} · **${name}** — 1. Prévenir : bonjour`
const journalOf = (lines: string[]) =>
  ['---', 'bp-type: workflows-journal', '---', '', '# Journal des workflows', '', '<!-- bp:journal:debut — tenu à jour par Black Projects -->', ...lines, '<!-- bp:journal:fin -->', ''].join('\n')

const mine = (id: string, name: string, kind: string, actions: string[], enabled = true): Workflow => ({
  id,
  name,
  enabled,
  mode: 'auto',
  trigger: { kind },
  conditions: [],
  actions: actions.map((each) => ({ kind: each, fields: {} })),
  created: '2026-01-01T00:00:00.000Z'
})

async function start(platform: MemoryPlatform, stored: Workflow[] = []) {
  const i18n = createI18n('fr')
  i18n.register('fr', workflowsModule.texts.fr)
  let settings: Record<string, unknown> = { workflows: stored }
  const commands = new Map<string, ModuleCommand>()
  const context: ModuleContext = {
    moduleId: workflowsModule.id,
    platform,
    i18n,
    settings: { get: () => settings, save: async (values) => void (settings = values), onChange: () => () => {} },
    commands: { register: (command) => void commands.set(command.id, command) },
    views: new ViewsRegistry()
  }
  await (workflowsModule as BlackModule).activate(context)
  const workflows = () => settings.workflows as Workflow[]
  const system = (id: string) => workflows().find((each) => each.system === `sys.workflows.${id}`)!
  const runByHand = async (id: string) => {
    platform.choices.push(system(id).id)
    await commands.get('executer')!.run()
  }
  const read = (path: string) => (platform.files.has(path) ? new TextDecoder().decode(platform.files.get(path)) : '')
  return { system, runByHand, read }
}

afterEach(async () => {
  await workflowsModule.deactivate?.()
})

describe('l’entretien des workflows (workflows système)', () => {
  it('créés : les workflows cassés à l’ouverture actif ; le bilan du lundi et l’archive du mois désactivés', async () => {
    const { system } = await start(memoryPlatform())
    expect(system('casses')).toMatchObject({ enabled: true, name: 'Signaler les workflows cassés, à l’ouverture', trigger: { kind: 'ouverture' }, actions: [{ kind: 'workflows.verifier' }] })
    expect(system('bilan-hebdo')).toMatchObject({ enabled: false, trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' }, actions: [{ kind: 'workflows.bilan', fields: { jours: '7' } }] })
    expect(system('archiver-journal')).toMatchObject({ enabled: false, trigger: { kind: 'planifie', every: 'month', monthDay: 1, time: '08:00' }, actions: [{ kind: 'workflows.archiver', fields: { jours: '30' } }] })
  })

  it('à l’ouverture : les workflows actifs au déclencheur ou à l’action inconnus sont dits ; les désactivés, non', async () => {
    const platform = memoryPlatform()
    await start(platform, [
      mine('w1', 'Calendrier à l’import', 'ao.pieces-importees', ['notifier']),
      mine('w2', 'Vérifier l’IA', 'manuel', ['notifier', 'ia.verifier']),
      mine('w3', 'Vieux', 'ao.analyse-creee', ['notifier'], false),
      mine('w4', 'Rappel', 'manuel', ['notifier'])
    ])
    await runOpeningWorkflows()
    expect(platform.notices).toEqual([
      '2 workflow(s) cassé(s) : « Calendrier à l’import » (déclencheur inconnu : ao.pieces-importees) ; « Vérifier l’IA » (action(s) inconnue(s) : ia.verifier). Le module qui les apporte est sans doute désactivé : réactivez-le, ou désactivez ces workflows.'
    ])
  })

  it('rien de cassé : rien n’est dit, le journal le garde', async () => {
    const platform = memoryPlatform()
    const { read } = await start(platform, [mine('w4', 'Rappel', 'manuel', ['notifier'])])
    await runOpeningWorkflows()
    expect(platform.notices).toEqual([])
    expect(read(JOURNAL)).toContain('Tous les workflows actifs peuvent s’exécuter.')
  })

  it('le bilan : les exécutions des 7 derniers jours, les échecs et lesquels', async () => {
    const platform = memoryPlatform()
    platform.files.set(JOURNAL, new TextEncoder().encode(journalOf([line(0, true, 'Rappel'), line(-1, false, 'Rappel du matin'), line(-3, true, 'Rappel'), line(-20, false, 'Ancien')])))
    const { runByHand } = await start(platform)
    await runByHand('bilan-hebdo')
    expect(platform.notices).toContain('Workflows, les 7 derniers jours : 3 exécution(s), 1 échec(s) — « Rappel du matin » (1).')
  })

  it('l’archive : les exécutions de plus de 30 jours quittent le journal pour la note d’archive du mois', async () => {
    const platform = memoryPlatform()
    platform.files.set(JOURNAL, new TextEncoder().encode(journalOf([line(-2, true, 'Récent'), line(-40, true, 'Ancien'), line(-45, false, 'Très ancien')])))
    const { runByHand, read } = await start(platform)
    await runByHand('archiver-journal')
    const archive = read(`Black Projects/Workflows/Journal des workflows — archive ${day(0).slice(0, 7)}.md`)
    expect(archive).toContain('bp-type: workflows-journal-archive')
    expect(archive.indexOf('**Ancien**')).toBeLessThan(archive.indexOf('**Très ancien**'))
    const journal = read(JOURNAL)
    expect(journal).toContain('**Récent**')
    expect(journal).not.toContain('**Ancien**')
    expect(journal).toContain('2 exécution(s) de plus de 30 jours archivée(s).')
  })
})
