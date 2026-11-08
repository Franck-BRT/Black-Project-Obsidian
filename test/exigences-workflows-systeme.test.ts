// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les nouveaux workflows système des exigences : **contrôler la qualité des exigences
 * importées** (activé : les faibles, nommées), **traductions à revoir, chaque lundi**
 * (désactivé : absentes, en retard, à relire, comptées), **relire les nouvelles exigences
 * (IA)** (désactivé). Et le déclencheur « Exigences importées ».
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { aoModule } from '../src/modules/ao'
import { bibliothequeModule } from '../src/modules/bibliotheque'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { runDueWorkflows, workflowsModule, type Workflow } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
const enc = (text: string) => new TextEncoder().encode(text)
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = MODULES) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false } }
  const commands = new Map<string, ModuleCommand>()
  for (const module of modules) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command), run: async (id) => commands.get(`${module.id}-${id}`)?.run() },
      views: new ViewsRegistry(),
      showPage: () => {}
    }
    await module.activate(context)
  }
  const system = (id: string) => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === `sys.exigences.${id}`)!
  const journal = () => (platform.files.has(JOURNAL) ? new TextDecoder().decode(platform.files.get(JOURNAL)) : '')
  // Importer des exigences d'un CSV, depuis l'ordinateur.
  const importCsv = async (name: string, rows: string[]) => {
    platform.choices.push('computer')
    platform.externalFiles.push([{ name, bytes: enc(`Exigence;Vérification\n${rows.map((row) => `${row};Essai`).join('\n')}\n`) }])
    platform.forms.push({ category: 'cli' })
    await commands.get('exigences-importer')!.run()
  }
  return { system, journal, importCsv }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

const weakNotices = (platform: MemoryPlatform) => platform.notices.filter((notice) => notice.includes('faible'))

describe('les nouveaux workflows système des exigences', () => {
  it('créés : le contrôle des importées actif ; les traductions du lundi et la relecture IA désactivées', async () => {
    const { system } = await start(memoryPlatform())
    expect(system('controle-import')).toMatchObject({ enabled: true, name: 'Contrôler la qualité des exigences importées', trigger: { kind: 'exigences.importees' }, actions: [{ kind: 'exigences.controle-import' }] })
    expect(system('traductions-hebdo')).toMatchObject({ enabled: false, name: 'Traductions à revoir, chaque lundi', trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' } })
    expect(system('relire-nouvelles')).toMatchObject({ enabled: false, name: 'Relire les nouvelles exigences (IA)', trigger: { kind: 'exigences.creee' }, actions: [{ kind: 'exigences.relire', fields: { exigence: '{chemin}' } }] })
  })

  it('un import avec une exigence faible : nommée, avec ses étoiles ; le journal le garde', async () => {
    const platform = memoryPlatform()
    const { importCsv, journal } = await start(platform)
    await importCsv('Exigences client.csv', ['Le système doit démarrer en 5 s.', 'Le système sera disponible le cas échéant.'])
    const notices = weakNotices(platform)
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatch(/^Import d’exigences \(Exigences client\.csv\) — 1 exigence\(s\) faible\(s\) sur 2 : REQ-CLI-0002 \(★★\) \(moyenne \d+ %\)\. Leur fiche dit ce qui pèche/)
    expect(journal()).toMatch(/✅ fait · \*\*Contrôler la qualité des exigences importées\*\*/)
  })

  it('aucune faible : rien n’est dit, le journal le garde', async () => {
    const platform = memoryPlatform()
    const { importCsv, journal } = await start(platform)
    await importCsv('Exigences.csv', ['Le système doit démarrer en 5 s.'])
    expect(weakNotices(platform)).toEqual([])
    expect(journal()).toMatch(/1 exigence\(s\) contrôlée\(s\), aucune faible \(moyenne \d+ %\)\./)
  })

  it('désactivé : rien n’est dit', async () => {
    const platform = memoryPlatform()
    const { importCsv, system } = await start(platform)
    system('controle-import').enabled = false
    await importCsv('Exigences.csv', ['Le système sera disponible le cas échéant.'])
    expect(weakNotices(platform)).toEqual([])
  })

  it('les traductions à revoir, une fois activé : comptées et dites', async () => {
    const platform = memoryPlatform()
    const { importCsv, system, journal } = await start(platform)
    await importCsv('Exigences.csv', ['Le système doit démarrer en 5 s.', 'Le système doit peser moins de 20 kg.'])
    Object.assign(system('traductions-hebdo'), { enabled: true, created: '2020-01-01T00:00:00.000Z' })
    await runDueWorkflows()
    expect(platform.notices.at(-1)).toBe('Traductions à revoir sur 2 exigence(s) : 2 absente(s), 0 en retard, 0 à relire. Page Exigences → « Traductions à relire ».')
    expect(journal()).toContain('**Traductions à revoir, chaque lundi**')
  })

  it('désactivés d’origine : la planification ne lance pas les traductions', async () => {
    const platform = memoryPlatform()
    const { system, journal } = await start(platform)
    system('traductions-hebdo').created = '2020-01-01T00:00:00.000Z'
    await runDueWorkflows()
    expect(journal()).not.toContain('Traductions à revoir')
  })
})
