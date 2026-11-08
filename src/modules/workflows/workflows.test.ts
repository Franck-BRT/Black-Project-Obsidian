// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le module Workflows : créer, exécuter, demander d'abord, enchaîner, échouer, boucler, planifier, échanger. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import type { ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../../core/testing/memoryPlatform'
import { emitWorkflowEvent, registerAction, registerTrigger, runDueWorkflows, workflowsModule, WORKFLOWS_KEY, type Subject, type Workflow } from '.'
import { forgetDeclarations } from './registry'

const i18n = createI18n('fr')
i18n.register('fr', workflowsModule.texts.fr)

async function activate(platform: MemoryPlatform, initial: Record<string, unknown> = {}) {
  let stored = initial
  const commands: ModuleCommand[] = []
  const context: ModuleContext = {
    moduleId: workflowsModule.id,
    platform,
    i18n,
    settings: { get: () => stored, save: async (values) => void (stored = values), onChange: () => () => {} },
    commands: { register: (command) => void commands.push(command) }
  }
  await workflowsModule.activate(context)
  // Les workflows d'entretien du module (testés dans workflows-upkeep.test.ts) : écartés, ces tests ne voient que les leurs.
  forgetDeclarations('sys.workflows')
  stored = { ...stored, [WORKFLOWS_KEY]: ((stored[WORKFLOWS_KEY] ?? []) as Workflow[]).filter((each) => !each.system?.startsWith('sys.workflows.')) }
  return {
    run: (id: string) => commands.find((command) => command.id === id)!.run(),
    workflows: () => (stored[WORKFLOWS_KEY] ?? []) as Workflow[],
    set: (workflows: Workflow[]) => void (stored = { ...stored, [WORKFLOWS_KEY]: workflows })
  }
}

const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'

const subject: Subject = { key: 'A', label: 'Station sol', path: 'AO/Station sol/Station sol.md', vars: { analyse: 'Station sol' }, lists: { types: ['CCTP'] } }

const rule = (over: Partial<Workflow>): Workflow => ({
  id: 'wf-1',
  name: 'Règle',
  enabled: true,
  mode: 'auto',
  trigger: { kind: 'test.evenement' },
  conditions: [],
  actions: [],
  created: '2026-01-01T00:00:00.000Z',
  ...over
})

let calls: string[] = []

beforeEach(() => {
  calls = []
  registerTrigger({ id: 'test.evenement', labelKey: 'test', descKey: 'test', fields: [{ key: 'types', labelKey: 'types' }] })
  registerAction({
    id: 'test.resumer',
    labelKey: 'Résumer',
    descKey: 'Résumer',
    fields: [{ key: 'quoi', labelKey: 'quoi', kind: 'text', required: true, defaultValue: '{analyse}' }],
    results: ['text'],
    async run({ fields }) {
      calls.push(`resumer:${fields.quoi}`)
      return { lines: ['résumé'], results: { text: `résumé de ${fields.quoi}` } }
    }
  })
  registerAction({
    id: 'test.casser',
    labelKey: 'Casser',
    descKey: 'Casser',
    fields: [],
    results: [],
    async run() {
      calls.push('casser')
      throw new Error('serveur absent')
    }
  })
})

afterEach(async () => {
  await workflowsModule.deactivate?.()
  forgetDeclarations('test.')
})

describe('créer et exécuter à la main', () => {
  it('« Nouveau workflow » : nom et déclencheur, une action « Écrire une note », exécutée depuis sa fiche', async () => {
    const platform = memoryPlatform()
    const wf = await activate(platform)
    // Aucun modèle déclaré par un module : directement le formulaire.
    platform.forms.push({ name: 'Point du jour', trigger: 'manuel', mode: 'auto' })
    // Fiche : Actions → Ajouter → Écrire une note → (formulaire) → Retour → Exécuter → Fermer.
    platform.choices.push('actions', 'add', 'creer-note', 'back', 'run', 'close')
    platform.forms.push({ chemin: 'Notes/{workflow}', contenu: 'Bonjour, nous sommes le {today}.' })
    await wf.run('nouveau')
    const [workflow] = wf.workflows()
    expect(workflow).toMatchObject({ name: 'Point du jour', mode: 'auto', trigger: { kind: 'manuel' }, runs: 1 })
    expect(workflow!.actions).toEqual([{ kind: 'creer-note', fields: { chemin: 'Notes/{workflow}', contenu: 'Bonjour, nous sommes le {today}.' } }])
    expect(read(platform, 'Notes/Point du jour.md')).toMatch(/^Bonjour, nous sommes le \d{4}-\d{2}-\d{2}\./)
    // La fenêtre de l'action rappelait les variables utilisables.
    expect(platform.asked.at(-1)!.intro).toContain('{today}')
    const journal = read(platform, JOURNAL)
    expect(journal).toContain('✅ fait · **Point du jour**')
    expect(journal).toContain('[[Notes/Point du jour]]')
    expect(platform.notices.at(-1)).toBe('Workflow « Point du jour » exécuté (1 étape(s)).')
  })
})

describe('un évènement', () => {
  it('« demander d’abord » : refusé, rien n’est fait ; accepté, les étapes s’enchaînent avec leurs résultats', async () => {
    const platform = memoryPlatform()
    const wf = await activate(platform)
    wf.set([
      rule({
        mode: 'ask',
        actions: [
          { kind: 'test.resumer', fields: { quoi: '{analyse} ({types})' } },
          { kind: 'notifier', fields: { message: 'Fait : {step1.text}' } }
        ]
      })
    ])
    platform.confirmations.push(false)
    await emitWorkflowEvent('test.evenement', subject)
    expect(platform.confirmed.at(-1)!.message).toContain('1. Résumer')
    expect(calls).toEqual([])
    expect(read(platform, JOURNAL)).toContain('⏭️ refusé · **Règle** · sur « Station sol » ([[AO/Station sol/Station sol]])')

    platform.confirmations.push(true)
    await emitWorkflowEvent('test.evenement', subject)
    expect(calls).toEqual(['resumer:Station sol (CCTP)'])
    expect(platform.notices).toContain('Fait : résumé de Station sol (CCTP)')
    expect(wf.workflows()[0]!.runs).toBe(2)
  })

  it('les conditions filtrent ; un autre déclencheur ne fait rien', async () => {
    const platform = memoryPlatform()
    const wf = await activate(platform)
    wf.set([rule({ conditions: [{ field: 'types', op: 'is', value: 'BPU' }], actions: [{ kind: 'test.resumer', fields: {} }] })])
    await emitWorkflowEvent('test.evenement', subject)
    await emitWorkflowEvent('autre', subject)
    expect(calls).toEqual([])
  })

  it('une étape qui échoue arrête le workflow, dit pourquoi', async () => {
    const platform = memoryPlatform()
    const wf = await activate(platform)
    wf.set([rule({ actions: [{ kind: 'test.casser', fields: {} }, { kind: 'test.resumer', fields: {} }] })])
    await emitWorkflowEvent('test.evenement', subject)
    expect(calls).toEqual(['casser'])
    expect(platform.notices.at(-1)).toBe('Workflow « Règle » en échec : Étape 1 (Casser) a échoué : serveur absent')
    expect(read(platform, JOURNAL)).toContain('❌ échec')
  })

  it('un champ obligatoire vide, ou une action d’un module absent : échec clair', async () => {
    const platform = memoryPlatform()
    const wf = await activate(platform)
    wf.set([
      rule({ id: 'a', name: 'Vide', actions: [{ kind: 'test.resumer', fields: { quoi: '{inconnu-vide}' } }] }),
      rule({ id: 'b', name: 'Absente', actions: [{ kind: 'module.absent', fields: {} }] })
    ])
    await emitWorkflowEvent('test.evenement', { ...subject, vars: { 'inconnu-vide': '' } })
    const journal = read(platform, JOURNAL)
    expect(journal).toContain('Étape 1 (Résumer) : « quoi » est vide.')
    expect(journal).toContain('Étape 1 : action inconnue (module.absent)')
  })

  it('un workflow qui boucle est arrêté', async () => {
    const platform = memoryPlatform()
    const wf = await activate(platform)
    wf.set([rule({ actions: [{ kind: 'test.resumer', fields: {} }] })])
    for (let i = 0; i < 31; i++) await emitWorkflowEvent('test.evenement', subject)
    expect(calls).toHaveLength(30)
    expect(platform.notices.at(-1)).toBe('Workflow « Règle » arrêté : il s’exécutait en boucle. Voir le journal.')
    expect(read(platform, JOURNAL)).toContain('⛔ arrêté')
  })

  it('sans le module actif, signaler ne fait rien', async () => {
    await emitWorkflowEvent('test.evenement', subject)
    expect(calls).toEqual([])
  })
})

describe('à heure fixe', () => {
  it('exécuté quand l’heure est venue, une fois', async () => {
    const platform = memoryPlatform()
    const wf = await activate(platform)
    wf.set([rule({ trigger: { kind: 'planifie', every: 'day', time: '00:00' }, actions: [{ kind: 'test.resumer', fields: { quoi: 'le jour' } }] })])
    await runDueWorkflows()
    await runDueWorkflows()
    expect(calls).toEqual(['resumer:le jour'])
  })
})

describe('les conditions dans la fiche', () => {
  it('ajouter une condition, puis la retirer', async () => {
    const platform = memoryPlatform()
    const wf = await activate(platform)
    wf.set([rule({})])
    platform.listAnswers.push({ kind: 'row', id: 'wf-1', state: { search: '', filters: {} } })
    platform.choices.push('conditions', 'add', 'back', 'close')
    platform.forms.push({ field: 'types', op: 'is', value: 'CCTP, CCAP' })
    await wf.run('liste')
    expect(wf.workflows()[0]!.conditions).toEqual([{ field: 'types', op: 'is', value: 'CCTP, CCAP' }])
    // La fiche résume la condition.
    expect(platform.offered.at(-1)!.find((choice) => choice.value === 'conditions')!.description).toBe('types est « CCTP, CCAP »')
  })
})

describe('l’échange', () => {
  it('exporter puis importer : repris désactivés, ce qui est inconnu laissé de côté', async () => {
    const platform = memoryPlatform()
    const wf = await activate(platform)
    wf.set([rule({ actions: [{ kind: 'test.resumer', fields: {} }, { kind: 'module.absent', fields: {} }], runs: 3, lastRun: '2026-02-01T00:00:00Z' })])
    await wf.run('exporter')
    const path = [...platform.files.keys()].find((key) => key.startsWith('Black Projects/Échanges/Workflows'))!
    const exported = JSON.parse(read(platform, path)) as { workflows: Record<string, unknown>[] }
    expect(exported.workflows[0]).not.toHaveProperty('runs')
    platform.choices.push('vault')
    platform.nextPick = path
    await wf.run('importer')
    const [, imported] = wf.workflows()
    expect(imported).toMatchObject({ name: 'Règle', enabled: false, actions: [{ kind: 'test.resumer' }] })
    expect(platform.notices.at(-1)).toBe('1 workflow(s) importé(s), désactivés : relisez-les avant de les activer. 1 élément(s) inconnu(s) de cette version laissé(s) de côté.')
  })
})
