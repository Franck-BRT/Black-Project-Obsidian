// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les nouveaux workflows système de la lecture de fichiers : **signaler les pièces
 * illisibles** (activé), **signaler les pièces sans texte** (désactivé), à l'import des
 * pièces d'une analyse ; **bilan des formats du coffre, chaque lundi** (désactivé).
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
import { runDueWorkflows, workflowsModule, type Workflow } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
const enc = (text: string) => new TextEncoder().encode(text)
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'

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
  const system = (id: string) => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === `sys.lecture-fichiers.${id}`)!
  const journal = () => (platform.files.has(JOURNAL) ? new TextDecoder().decode(platform.files.get(JOURNAL)) : '')
  // Des pièces déposées dans l'analyse, puis « Mettre à jour l'analyse » : l'évènement « pièces importées ».
  const importInto = async (files: Record<string, Uint8Array>) => {
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence', reference: '' })
    for (const [name, bytes] of Object.entries(files)) await platform.fs.writeBinary(`${analysis.folder}/Pièces/Appel d'offres/Originaux/${name}`, bytes.slice().buffer)
    platform.active = analysis.note
    await commands.get('ao-mettre-a-jour')!.run()
  }
  return { system, journal, importInto }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

const notices = (platform: MemoryPlatform, word: RegExp) => platform.notices.filter((notice) => word.test(notice))

describe('les pièces illisibles et sans texte (workflows système)', () => {
  it('créés : illisibles actif, sans texte et bilan des formats désactivés', async () => {
    const { system } = await start(memoryPlatform())
    expect(system('illisibles')).toMatchObject({ enabled: true, name: 'Signaler les pièces illisibles, à l’import', trigger: { kind: 'ao.pieces-importees' }, conditions: [{ field: 'illisibles', op: 'not-empty' }] })
    expect(system('sans-texte')).toMatchObject({ enabled: false, trigger: { kind: 'ao.pieces-importees' }, conditions: [{ field: 'sanstexte', op: 'not-empty' }] })
    expect(system('bilan-formats')).toMatchObject({ enabled: false, trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' } })
  })

  it('une pièce illisible (un Word abîmé) : nommée, avec que faire ; le journal le garde', async () => {
    const platform = memoryPlatform()
    const { importInto, journal } = await start(platform)
    await importInto({ 'CCTP.md': enc('# CCTP\n\nLe titulaire doit fournir une antenne.'), 'RC.docx': enc('pas un document Word') })
    expect(notices(platform, /illisible/)).toEqual([
      'Station sol — 1 pièce(s) illisible(s) : RC.docx. Le fichier est peut-être abîmé, ou protégé par un mot de passe d’ouverture : demandez-en une version lisible, ou déposez-en une à la main puis « Mettre à jour l’analyse ».'
    ])
    expect(journal()).toMatch(/✅ fait · \*\*Signaler les pièces illisibles, à l’import\*\*/)
  })

  it('toutes lisibles : il ne s’exécute pas', async () => {
    const platform = memoryPlatform()
    const { importInto, journal } = await start(platform)
    await importInto({ 'CCTP.md': enc('# CCTP\n\nTexte.') })
    expect(notices(platform, /illisible/)).toEqual([])
    expect(journal()).not.toContain('Signaler les pièces illisibles')
  })

  it('une pièce sans texte, une fois activé : nommée', async () => {
    const platform = memoryPlatform()
    const { importInto, system } = await start(platform)
    system('sans-texte').enabled = true
    await importInto({ 'Scan.txt': enc('   \n  ') })
    expect(notices(platform, /^Station sol — .*sans texte lisible/)).toEqual([expect.stringMatching(/^Station sol — 1 pièce\(s\) sans texte lisible : Scan\.txt\. Un scan, sans doute/)])
  })
})

describe('le bilan des formats du coffre (workflow système)', () => {
  it('une fois activé : les fichiers par format, les extensions non lues ; les dossiers cachés ignorés', async () => {
    const platform = memoryPlatform()
    const { system } = await start(platform)
    for (const [path, text] of Object.entries({
      'Notes/Réunion.md': '# R',
      'Plans/Plan.pdf': '%PDF',
      'Plans/Photo.png': 'png',
      'Plans/Maquette.dwg': 'dwg',
      'Plans/Ancienne.dwg': 'dwg',
      'Relevés/Mesure.tot': '<x/>',
      'DCE.zip': 'zip',
      '.obsidian/app.json': '{}'
    }))
      await platform.fs.writeText(path, text)
    Object.assign(system('bilan-formats'), { enabled: true, created: '2020-01-01T00:00:00.000Z' })
    await runDueWorkflows()
    const said = notices(platform, /^Coffre :/)
    expect(said).toHaveLength(1)
    expect(said[0]).toMatch(/fichier\(s\) — \d+ note\(s\), \d+ lu\(s\), 1 image\(s\), 1 archive\(s\), 3 non lu\(s\)\. Non lus : \.dwg \(2\), \.tot \(1\)\. Si c’est du texte/)
    expect(said[0]).not.toContain('.json')
  })
})
