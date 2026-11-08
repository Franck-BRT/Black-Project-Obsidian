// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le workflow système de la lecture de fichiers : **signaler les formats non lus**, au dépôt
 * de fichiers (activé d'origine). Une extension sans lecteur ni équivalence est dite, avec où
 * déclarer une équivalence ; les images et les archives ne le sont pas ; une extension
 * déclarée équivalente, ou à taire, ne l'est plus ; désactivé, rien. Sans la bibliothèque
 * (son déclencheur), il ne se déclenche pas.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { isReadable, lectureFichiersModule, unreadFiles } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
const enc = (text: string) => new TextEncoder().encode(text)
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'
const HOW = 'Si c’est du texte, déclarez une extension équivalente : Formats de fichiers → Extensions équivalentes.'

async function start(platform: MemoryPlatform, options: { lecture?: Record<string, unknown>; modules?: readonly BlackModule[]; workflows?: Workflow[] } = {}) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false }, 'lecture-fichiers': options.lecture ?? {}, ...(options.workflows ? { workflows: { workflows: options.workflows } } : {}) }
  for (const module of options.modules ?? MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views: new ViewsRegistry(),
      showPage: () => {}
    }
    await module.activate(context)
  }
  const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => '2026-11-06' }
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.lecture-fichiers.formats-non-lus')
  const journal = () => (platform.files.has(JOURNAL) ? new TextDecoder().decode(platform.files.get(JOURNAL)) : '')
  return { services, system, journal }
}

const toTender = async (request: { pending: readonly { path: string }[] }) => ({ places: Object.fromEntries(request.pending.map((piece) => [piece.path, 'appel-d-offres' as const])) })

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('les formats non lus', () => {
  it('ni lecteur, ni équivalence, ni image, ni archive : signalé ; sans extension aussi', () => {
    expect(unreadFiles(['CCTP.pdf', 'Plan.png', 'DCE.zip', 'Releve.tot', 'Maquette.dwg', 'LISEZMOI'], isReadable)).toEqual(['Releve.tot', 'Maquette.dwg', 'LISEZMOI'])
    expect(unreadFiles(['Releve.tot', 'Maquette.dwg'], isReadable, ['.DWG'])).toEqual(['Releve.tot'])
  })
})

describe('signaler les formats non lus (workflow système)', () => {
  it('créé actif, au dépôt de fichiers', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({ enabled: true, name: 'Signaler les formats non lus, au dépôt de fichiers', trigger: { kind: 'bibliotheque.fichiers-deposes' }, actions: [{ kind: 'lecture-fichiers.formats-non-lus' }] })
  })

  it('une pièce dans un format non lu : dite, avec où déclarer une équivalence ; le journal le garde', async () => {
    const platform = memoryPlatform()
    const { services, journal } = await start(platform)
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence', reference: '' })
    await importFiles(services, analysis, [{ name: 'CCTP.md', bytes: enc('# CCTP') }, { name: 'Releve.tot', bytes: enc('<releve/>') }, { name: 'Plan.png', bytes: new Uint8Array([137, 80]) }], toTender)
    expect(platform.notices).toContain(`Station sol — 1 fichier(s) dans un format non lu (.tot) : Releve.tot. ${HOW}`)
    expect(journal()).toMatch(/✅ fait · \*\*Signaler les formats non lus, au dépôt de fichiers\*\* · sur « Station sol ».*Releve\.tot/)
  })

  it('tous lus : rien n’est dit, le journal le garde', async () => {
    const platform = memoryPlatform()
    const { journal } = await start(platform)
    await pourIntoLibrary([{ name: 'Exigences client.csv', bytes: enc('a;b') }], { module: 'exigences', label: 'Import' })
    expect(platform.notices.filter((notice) => notice.includes('non lu'))).toEqual([])
    expect(journal()).toContain('Tous les formats déposés sont lus.')
  })

  it('une extension déclarée équivalente (.tot lu comme du XML) : plus signalée', async () => {
    const platform = memoryPlatform()
    await start(platform, { lecture: { aliases: { tot: 'xml' } } })
    await pourIntoLibrary([{ name: 'Releve.tot', bytes: enc('<releve/>') }], { module: 'exigences', label: 'Import' })
    expect(platform.notices.filter((notice) => notice.includes('non lu'))).toEqual([])
  })

  it('une extension à taire, réglée dans l’action : plus signalée', async () => {
    const platform = memoryPlatform()
    const { system } = await start(platform)
    system()!.actions[0]!.fields.ignorer = 'dwg, tot'
    await pourIntoLibrary([{ name: 'Maquette.dwg', bytes: enc('dwg') }], { module: 'exigences', label: 'Import' })
    expect(platform.notices.filter((notice) => notice.includes('non lu'))).toEqual([])
  })

  it('désactivé : rien n’est dit', async () => {
    const platform = memoryPlatform()
    const { system } = await start(platform)
    system()!.enabled = false
    await pourIntoLibrary([{ name: 'Maquette.dwg', bytes: enc('dwg') }], { module: 'exigences', label: 'Import' })
    expect(platform.notices.filter((notice) => notice.includes('non lu'))).toEqual([])
  })

  it('sans la bibliothèque de documents : son déclencheur n’arrive pas, rien ne casse', async () => {
    const platform = memoryPlatform()
    const { services, system } = await start(platform, { modules: MODULES.filter((module) => module !== bibliothequeModule) })
    expect(system()).toMatchObject({ enabled: true })
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence', reference: '' })
    await importFiles(services, analysis, [{ name: 'Releve.tot', bytes: enc('<releve/>') }], toTender)
    expect(platform.notices.filter((notice) => notice.includes('non lu'))).toEqual([])
  })
})

describe('les workflows savent l’extension d’un fichier ajouté, et s’il est lisible', () => {
  const workflow = (id: string, trigger: string, field: string, message: string): Workflow => ({
    id,
    name: id,
    enabled: true,
    mode: 'auto',
    trigger: { kind: trigger },
    conditions: field ? [{ field, op: 'is', value: 'non' }] : [],
    actions: [{ kind: 'notifier', fields: { message } }],
    created: '2026-11-01T00:00:00'
  })

  it('« document versé » : {extension}, {lisible}, {lecture} — une condition sur « lisible »', async () => {
    const platform = memoryPlatform()
    await start(platform, { workflows: [workflow('wf-illisible', 'bibliotheque.document-verse', 'lisible', 'Ajouté : {fichier} — .{extension}, lisible : {lisible} ({lecture})')] })
    await pourIntoLibrary(
      [
        { name: 'CCTP.pdf', bytes: enc('cctp') },
        { name: 'Maquette.dwg', bytes: enc('dwg') },
        { name: 'Plan.png', bytes: enc('png') },
        { name: 'DCE.zip', bytes: enc('zip') }
      ],
      { module: 'bibliotheque', label: '' }
    )
    const said = platform.notices.filter((notice) => notice.startsWith('Ajouté'))
    expect(said).toEqual([
      'Ajouté : Bibliothèque/_fichiers/Maquette.dwg — .dwg, lisible : non (format non lu)',
      'Ajouté : Bibliothèque/_fichiers/Plan.png — .png, lisible : non (image : montrée, son texte n’est pas lu)',
      'Ajouté : Bibliothèque/_fichiers/DCE.zip — .zip, lisible : non (archive : ouverte, ses fichiers lus un à un)'
    ])
  })

  it('une extension déclarée équivalente (.tot lu comme du XML) : lisible', async () => {
    const platform = memoryPlatform()
    await start(platform, { lecture: { aliases: { tot: 'xml' } }, workflows: [workflow('wf-tous', 'bibliotheque.document-verse', '', '{extension} : {lisible}')] })
    await pourIntoLibrary([{ name: 'Releve.tot', bytes: enc('<a/>') }], { module: 'bibliotheque', label: '' })
    expect(platform.notices).toContain('tot : oui')
  })

  it('« fichiers déposés » (par n’importe quel module) : {extensions} et {nonlisibles}', async () => {
    const platform = memoryPlatform()
    await start(platform, { workflows: [workflow('wf-depot', 'bibliotheque.fichiers-deposes', '', 'Déposés : {extensions} — non lisibles : {nonlisibles}')] })
    await pourIntoLibrary([{ name: 'Exigences.xlsx', bytes: enc('x') }, { name: 'Maquette.DWG', bytes: enc('d') }, { name: 'Annexe.xlsx', bytes: enc('y') }], { module: 'exigences', label: 'Import' })
    expect(platform.notices).toContain('Déposés : xlsx, dwg — non lisibles : Maquette.DWG')
  })

  it('sans la lecture de fichiers : rien n’est lu, et c’est dit', async () => {
    const platform = memoryPlatform()
    await start(platform, { modules: MODULES.filter((module) => module !== lectureFichiersModule), workflows: [workflow('wf-off', 'bibliotheque.document-verse', '', '{extension} : {lisible} ({lecture})')] })
    await pourIntoLibrary([{ name: 'CCTP.pdf', bytes: enc('cctp') }], { module: 'bibliotheque', label: '' })
    expect(platform.notices).toContain('pdf : non (non lu : la lecture de fichiers est désactivée)')
  })
})
