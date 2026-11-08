// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le workflow système du typage des pièces : **signaler les pièces sans type reconnu**, à
 * l'import des pièces d'une analyse (activé d'origine). Une pièce classée « Autre » est
 * nommée, avec comment la typer ; toutes typées, il ne s'exécute pas ; un mot-clé ajouté, la
 * pièce est reconnue ; désactivé, rien.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { aoModule, createAnalysis } from '../src/modules/ao'
import { bibliothequeModule } from '../src/modules/bibliotheque'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
const enc = (text: string) => new TextEncoder().encode(text)
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'
const HOW = 'Pour celles-ci : « Changer le type de la pièce ». Pour les suivantes : un mot-clé dans Types de pièces.'

async function start(platform: MemoryPlatform, options: { typage?: Record<string, unknown>; modules?: readonly BlackModule[] } = {}) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false }, 'typage-pieces': options.typage ?? {} }
  const commands = new Map<string, ModuleCommand>()
  for (const module of options.modules ?? MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command) },
      views: new ViewsRegistry(),
      showPage: () => {}
    }
    await module.activate(context)
  }
  const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => '2026-11-06' }
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.typage-pieces.sans-type')
  const journal = () => (platform.files.has(JOURNAL) ? new TextDecoder().decode(platform.files.get(JOURNAL)) : '')
  // Des pièces déposées dans l'analyse, puis « Mettre à jour l'analyse » : l'évènement « pièces importées ».
  const importInto = async (names: string[]) => {
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence', reference: '' })
    for (const name of names) platform.files.set(`${analysis.folder}/Pièces/Appel d'offres/Originaux/${name}`, enc(`# ${name}`))
    platform.active = analysis.note
    await commands.get('ao-mettre-a-jour')!.run()
  }
  return { system, journal, importInto }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

const untyped = (platform: MemoryPlatform) => platform.notices.filter((notice) => notice.includes('sans type reconnu'))

describe('signaler les pièces sans type reconnu (workflow système)', () => {
  it('créé actif, à l’import des pièces, quand il y en a sans type', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Signaler les pièces sans type reconnu, à l’import',
      trigger: { kind: 'ao.pieces-importees' },
      conditions: [{ field: 'nontypees', op: 'not-empty' }],
      actions: [{ kind: 'typage-pieces.sans-type', fields: { pieces: '{nontypees}' } }]
    })
  })

  it('une pièce classée « Autre » : nommée, avec comment la typer ; le journal le garde', async () => {
    const platform = memoryPlatform()
    const { importInto, journal } = await start(platform)
    await importInto(['CCTP.md', 'SPEC_sol_v2.md'])
    expect(untyped(platform)).toEqual([`Station sol — 1 pièce(s) sans type reconnu : SPEC_sol_v2. ${HOW}`])
    expect(journal()).toMatch(/✅ fait · \*\*Signaler les pièces sans type reconnu, à l’import\*\* · sur « Station sol ».*SPEC_sol_v2/)
  })

  it('toutes typées : il ne s’exécute pas', async () => {
    const platform = memoryPlatform()
    const { importInto, journal } = await start(platform)
    await importInto(['CCTP.md', 'RC.md'])
    expect(untyped(platform)).toEqual([])
    expect(journal()).not.toContain('Signaler les pièces sans type reconnu')
  })

  it('un mot-clé ajouté (« spec » → CCTP) : la pièce est reconnue, rien n’est dit', async () => {
    const platform = memoryPlatform()
    const { importInto } = await start(platform, { typage: { motsClesNom: { spec: 'CCTP' } } })
    await importInto(['SPEC_sol_v2.md'])
    expect(untyped(platform)).toEqual([])
  })

  it('désactivé : rien n’est dit', async () => {
    const platform = memoryPlatform()
    const { importInto, system } = await start(platform)
    system()!.enabled = false
    await importInto(['SPEC_sol_v2.md'])
    expect(untyped(platform)).toEqual([])
  })
})
