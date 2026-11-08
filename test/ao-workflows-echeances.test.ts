// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Trois nouveaux workflows système de l'analyse d'appels d'offres : **rappel des questions
 * et de la visite** (activé), **rappel de la fin de validité des offres** (désactivé : une
 * fois la remise passée, sa date ou son délai compté depuis la remise), **extraire les
 * exigences du CCTP à l'import** (désactivé : l'aperçu d'extraction s'ouvre).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { aoModule, createAnalysis } from '../src/modules/ao'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))
const MODULES = [lectureFichiersModule, typagePiecesModule, exigencesModule, iaModule, workflowsModule, aoModule]
const ROOT = "Appels d'offres/Station sol"
const TENDER = `${ROOT}/Pièces/Appel d'offres/Originaux`
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'

const shifted = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date
}
const iso = (offset: number) => {
  const date = shifted(offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const written = (offset: number) => {
  const date = shifted(offset)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false } }
  const commands = new Map<string, ModuleCommand>()
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command) }
    }
    await (module as BlackModule).activate(context)
  }
  const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => iso(0) }
  const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence', reference: '' })
  const run = (id: string) => commands.get(id)!.run()
  const system = (id: string) => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === `sys.ao.${id}`)!
  /** Des pièces déposées dans l'analyse, puis « Mettre à jour l'analyse ». */
  const deposit = async (files: Record<string, Uint8Array>) => {
    for (const [name, bytes] of Object.entries(files)) platform.files.set(`${TENDER}/${name}`, bytes)
    platform.active = analysis.note
    await run('ao-mettre-a-jour')
  }
  /** Exécuter un workflow système à la main (la palette). */
  const runByHand = async (id: string) => {
    platform.choices.push(system(id).id)
    await run('workflows-executer')
  }
  const journal = () => (platform.files.has(JOURNAL) ? new TextDecoder().decode(platform.files.get(JOURNAL)) : '')
  return { system, deposit, runByHand, journal }
}

const enc = (text: string) => new TextEncoder().encode(text)

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('les nouveaux workflows système de l’analyse d’appels d’offres', () => {
  it('créés : le rappel des questions et de la visite actif ; la validité et l’extraction désactivées', async () => {
    const { system } = await start(memoryPlatform())
    expect(system('rappel-echeances')).toMatchObject({ enabled: true, name: 'Rappel des questions et de la visite', trigger: { kind: 'planifie', every: 'day', time: '08:00' }, actions: [{ kind: 'ao.rappel-echeances', fields: { jours: '3, 1, 0' } }] })
    expect(system('validite-offres')).toMatchObject({ enabled: false, trigger: { kind: 'planifie', every: 'day', time: '08:00' }, actions: [{ kind: 'ao.validite-offres', fields: { jours: '7, 1' } }] })
    expect(system('extraire-cctp')).toMatchObject({
      enabled: false,
      trigger: { kind: 'ao.pieces-importees' },
      conditions: [{ field: 'types', op: 'contains', value: 'CCTP' }],
      actions: [{ kind: 'ao.extraire', fields: { analyse: '{analyse}', type: 'CCTP' } }]
    })
  })

  it('la date limite des questions à J-3 et la visite à J-1 : rappelées', async () => {
    const platform = memoryPlatform()
    const { deposit, runByHand } = await start(platform)
    await deposit({
      'RC.md': enc(
        `# Règlement de la consultation\n\nLes questions des candidats doivent parvenir au plus tard le ${written(3)}.\n\nUne visite du site est organisée le ${written(1)}.\n\nLa date limite de remise des offres est fixée au ${written(20)}.\n`
      )
    })
    await runByHand('rappel-echeances')
    expect(platform.notices).toContain(`Station sol : Questions des candidats dans 3 jour(s), le ${iso(3)}. Station sol : Visite dans 1 jour(s), le ${iso(1)}.`)
  })

  it('rien dans les jours dits : rien n’est dit, le journal le garde', async () => {
    const platform = memoryPlatform()
    const { deposit, runByHand, journal } = await start(platform)
    await deposit({ 'RC.md': enc(`# RC\n\nUne visite du site est organisée le ${written(9)}.\n`) })
    await runByHand('rappel-echeances')
    expect(platform.notices.some((notice) => /Visite dans/.test(notice))).toBe(false)
    expect(journal()).toContain('Aucune question ni visite à rappeler aujourd’hui.')
  })

  it('la fin de validité : la remise passée, son délai compté depuis la remise', async () => {
    const platform = memoryPlatform()
    const { deposit, runByHand } = await start(platform)
    // Remise il y a 113 jours, validité 120 jours : la fin dans 7 jours.
    await deposit({
      'RC.md': enc(`# RC\n\nLa date limite de remise des offres est fixée au ${written(-113)}.\n\nLe délai de validité des offres est de 120 jours à compter de la date limite de remise des offres.\n`)
    })
    await runByHand('validite-offres')
    expect(platform.notices).toContain(`Station sol : les offres ne sont plus valables dans 7 jour(s), le ${iso(7)}.`)
  })

  it('la fin de validité : avant la remise, rien', async () => {
    const platform = memoryPlatform()
    const { deposit, runByHand, journal } = await start(platform)
    await deposit({ 'RC.md': enc(`# RC\n\nLa date limite de remise des offres est fixée au ${written(10)}.\n\nLe délai de validité des offres est de 120 jours.\n`) })
    await runByHand('validite-offres')
    expect(journal()).toContain('Aucune fin de validité à rappeler aujourd’hui.')
  })

  it('extraire les exigences du CCTP à l’import, une fois activé : l’aperçu, puis les exigences', async () => {
    const platform = memoryPlatform()
    const { system, deposit, journal } = await start(platform)
    system('extraire-cctp').enabled = true
    await deposit({ 'CCTP.docx': new Uint8Array(readFileSync(folder + 'CCTP.docx')) })
    expect(journal()).toMatch(/✅ fait · \*\*Extraire les exigences du CCTP à l’import\*\* · sur « Station sol ».*CCTP : \d+ exigence\(s\)\./)
    // Les workflows des exigences extraites suivent, juste après.
    await vi.waitFor(() => expect(journal()).toContain('**Contrôler les exigences extraites (qualité et cohérence)**'))
    expect([...platform.files.keys()].some((path) => path.startsWith(`${ROOT}/Exigences/`))).toBe(true)
  })

  it('désactivé d’origine : l’import n’extrait rien', async () => {
    const platform = memoryPlatform()
    const { deposit, journal } = await start(platform)
    await deposit({ 'CCTP.docx': new Uint8Array(readFileSync(folder + 'CCTP.docx')) })
    expect(journal()).not.toContain('Extraire les exigences du CCTP')
  })
})
