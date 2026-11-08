// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les workflows système de la bibliothèque : **ranger les pièces importées** et **ranger les
 * fichiers importés** (actifs d'origine, au déclencheur « Fichiers déposés dans
 * l'application »), **repérer les nouvelles versions probables** (actif, une fois par
 * versement), **signaler les fichiers introuvables** (désactivé, chaque lundi à 8 h).
 * Désactivés, ces automatismes ne se font plus ; sans le module Workflows, la bibliothèque
 * les fait elle-même. Un dépôt fait pendant qu'un workflow s'exécute ne bloque rien.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { emitWorkflowEvent, NO_SUBJECT, registerAction, registerTrigger, runDueWorkflows, runOpeningWorkflows, workflowsModule, type Workflow } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
const enc = (text: string) => new TextEncoder().encode(text)
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = MODULES) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false } }
  for (const module of modules) {
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
  const system = (id: string) => (settings.workflows!.workflows as Workflow[]).find((each) => each.system === `sys.bibliotheque.${id}`)!
  const journal = () => (platform.files.has(JOURNAL) ? new TextDecoder().decode(platform.files.get(JOURNAL)) : '')
  const records = () => [...platform.files.keys()].filter((path) => path.startsWith('Bibliothèque/') && path.endsWith('.md') && !path.includes('/_'))
  return { settings, services, system, journal, records }
}

const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const toTender = async (request: { pending: readonly { path: string }[] }) => ({ places: Object.fromEntries(request.pending.map((piece) => [piece.path, 'appel-d-offres' as const])) })

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('les workflows système de la bibliothèque', () => {
  it('quatre, créés à l’activation : trois actifs, « fichiers introuvables » désactivé, chaque lundi à 8 h', async () => {
    const { system } = await start(memoryPlatform())
    expect(system('ranger-pieces')).toMatchObject({ enabled: true, name: 'Ranger les pièces importées dans la bibliothèque', trigger: { kind: 'bibliotheque.fichiers-deposes' }, conditions: [{ field: 'origine', op: 'is', value: 'ao' }] })
    expect(system('ranger-fichiers')).toMatchObject({ enabled: true, trigger: { kind: 'bibliotheque.fichiers-deposes' }, conditions: [{ field: 'origine', op: 'is-not', value: 'ao' }] })
    expect(system('nouvelles-versions')).toMatchObject({ enabled: true, trigger: { kind: 'bibliotheque.versement' }, actions: [{ kind: 'bibliotheque.versions' }] })
    expect(system('fichiers-introuvables')).toMatchObject({ enabled: false, trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' } })
  })

  it('les pièces importées : rangées par leur workflow, sans rien dire ; le journal le garde', async () => {
    const platform = memoryPlatform()
    const { services, journal, records } = await start(platform)
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence', reference: '' })
    await importFiles(services, analysis, [{ name: 'CCTP.md', bytes: enc('# CCTP\n\nLe titulaire doit fournir une antenne.') }], toTender)
    expect(records()).toEqual(['Bibliothèque/CCTP.md'])
    expect(journal()).toMatch(/✅ fait · \*\*Ranger les pièces importées dans la bibliothèque\*\* · .*1 document\(s\) rangé\(s\), 0 y étai\(en\)t déjà\./)
    expect(platform.notices.filter((notice) => notice.includes('Ranger'))).toEqual([])
  })

  it('« ranger les pièces » désactivé : les pièces d’une analyse ne sont plus rangées ; les autres fichiers, si', async () => {
    const platform = memoryPlatform()
    const { services, system, records } = await start(platform)
    system('ranger-pieces').enabled = false
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence', reference: '' })
    await importFiles(services, analysis, [{ name: 'CCTP.md', bytes: enc('# CCTP') }], toTender)
    expect(records()).toEqual([])
    expect(await pourIntoLibrary([{ name: 'Exigences client.csv', bytes: enc('a;b') }], { module: 'exigences', label: 'Import' })).toMatchObject({ added: [{ title: 'Exigences client' }] })
    expect(records()).toEqual(['Bibliothèque/Exigences client.md'])
  })

  it('« ranger les fichiers importés » désactivé : un import n’est plus rangé ; ce qu’on verse soi-même, toujours', async () => {
    const platform = memoryPlatform()
    const { system, records } = await start(platform)
    system('ranger-fichiers').enabled = false
    expect(await pourIntoLibrary([{ name: 'Types de pièces.json', bytes: enc('{}') }], { module: 'typage-pieces', label: 'Échange' })).toBeNull()
    expect(records()).toEqual([])
    expect(await pourIntoLibrary([{ name: 'Plan.pdf', bytes: enc('p') }], { module: 'bibliotheque', label: 'Versé à la main' })).toMatchObject({ added: [{ title: 'Plan' }] })
  })

  it('une nouvelle version probable : repérée par son workflow, une fois pour le versement', async () => {
    const platform = memoryPlatform()
    const { journal } = await start(platform)
    const first = (await pourIntoLibrary([{ name: 'CCTP ind A.pdf', bytes: enc('A') }], { module: 'exigences', label: 'Import' }))!.added[0]!
    await pourIntoLibrary([{ name: 'CCTP ind B.pdf', bytes: enc('B') }, { name: 'Plan.pdf', bytes: enc('P') }], { module: 'exigences', label: 'Import' })
    expect(read(platform, 'Bibliothèque/CCTP ind B.md')).toContain(`precedentProbable: "[[${first.record}]]"`)
    expect(journal()).toContain('Nouvelle version probable : CCTP ind B.')
    expect(journal().match(/\*\*Repérer les nouvelles versions probables\*\*/g)).toHaveLength(2)
  })

  it('« nouvelles versions » désactivé : plus de suggestion', async () => {
    const platform = memoryPlatform()
    const { system } = await start(platform)
    system('nouvelles-versions').enabled = false
    await pourIntoLibrary([{ name: 'CCTP ind A.pdf', bytes: enc('A') }], { module: 'bibliotheque', label: 'Versé à la main' })
    const second = (await pourIntoLibrary([{ name: 'CCTP ind B.pdf', bytes: enc('B') }], { module: 'bibliotheque', label: 'Versé à la main' }))!.added[0]!
    expect(second.likelyPrevious).toBeUndefined()
    expect(read(platform, 'Bibliothèque/CCTP ind B.md')).not.toContain('precedentProbable')
  })

  it('une copie prise sous un nom déjà là (« CCTP (2).pdf ») reste reconnue comme une nouvelle version', async () => {
    const platform = memoryPlatform()
    await start(platform)
    const first = (await pourIntoLibrary([{ name: 'CCTP.pdf', bytes: enc('A') }], { module: 'bibliotheque', label: 'Versé à la main' }))!.added[0]!
    const second = (await pourIntoLibrary([{ name: 'CCTP.pdf', bytes: enc('B') }], { module: 'bibliotheque', label: 'Versé à la main' }))!.added[0]!
    expect(second.file).toBe('Bibliothèque/_fichiers/CCTP (2).pdf')
    expect(second.likelyPrevious).toBe(first.record)
  })

  it('les fichiers introuvables, une fois activé : dits et gardés au journal', async () => {
    const platform = memoryPlatform()
    const { system, journal } = await start(platform)
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: enc('p') }, { name: 'Devis.xlsx', bytes: enc('d') }], { module: 'bibliotheque', label: 'Versé à la main' })
    platform.files.delete('Bibliothèque/_fichiers/Plan.pdf')
    Object.assign(system('fichiers-introuvables'), { enabled: true, created: '2020-01-01T00:00:00.000Z' })
    await runDueWorkflows()
    expect(platform.notices.at(-1)).toBe('1 document(s) de la bibliothèque n’ont plus leur fichier : Plan.')
    expect(journal()).toMatch(/Signaler les fichiers introuvables, chaque lundi.*\[\[Bibliothèque\/Plan\]\]/)
  })

  it('désactivé d’origine : la planification ne le lance pas', async () => {
    const platform = memoryPlatform()
    const { system, journal } = await start(platform)
    system('fichiers-introuvables').created = '2020-01-01T00:00:00.000Z'
    await runDueWorkflows()
    expect(journal()).not.toContain('Signaler les fichiers introuvables')
  })

  it('sans le module Workflows : la bibliothèque range et repère elle-même', async () => {
    const platform = memoryPlatform()
    await start(
      platform,
      MODULES.filter((module) => module !== workflowsModule && module !== aoModule)
    )
    const first = (await pourIntoLibrary([{ name: 'CCTP ind A.pdf', bytes: enc('A') }], { module: 'exigences', label: 'Import' }))!.added[0]!
    const second = (await pourIntoLibrary([{ name: 'CCTP ind B.pdf', bytes: enc('B') }], { module: 'exigences', label: 'Import' }))!.added[0]!
    expect(second.likelyPrevious).toBe(first.record)
  })

  it('un dépôt fait pendant qu’un workflow s’exécute : rangé juste après, sans rien bloquer', async () => {
    const platform = memoryPlatform()
    const { settings, records, journal } = await start(platform)
    registerTrigger({ id: 'test.depot', labelKey: 'test', descKey: 'test', fields: [] })
    registerAction({
      id: 'test.deposer',
      labelKey: 'test',
      descKey: 'test',
      fields: [],
      results: [],
      async run() {
        const report = await pourIntoLibrary([{ name: 'Annexe.pdf', bytes: enc('annexe') }], { module: 'exigences', label: 'Import' })
        return { lines: [report === null ? 'déposé' : 'versé'] }
      }
    })
    const workflows = settings.workflows!.workflows as Workflow[]
    workflows.push({ id: 'w-test', name: 'Déposer', enabled: true, mode: 'auto', trigger: { kind: 'test.depot' }, conditions: [], actions: [{ kind: 'test.deposer', fields: {} }], created: '2026-01-01T00:00:00.000Z' })
    await emitWorkflowEvent('test.depot', NO_SUBJECT)
    // Le dépôt, mis à la suite : rangé juste après.
    await vi.waitFor(() => expect(records()).toEqual(['Bibliothèque/Annexe.md']))
    expect(journal()).toMatch(/\*\*Déposer\*\* — 1\. test : déposé/)
    await vi.waitFor(() => expect(journal()).toContain('**Ranger les fichiers importés dans la bibliothèque**'))
  })
})

describe('le dossier de dépôt et les rappels du lundi (workflows système)', () => {
  it('créés : le dépôt à l’ouverture et chaque jour actifs ; versions à confirmer et documents à classer désactivés', async () => {
    const { system } = await start(memoryPlatform())
    expect(system('depot-ouverture')).toMatchObject({ enabled: true, name: 'Verser le dossier « À verser », à l’ouverture', trigger: { kind: 'ouverture' }, actions: [{ kind: 'bibliotheque.depot' }] })
    expect(system('depot-quotidien')).toMatchObject({ enabled: true, trigger: { kind: 'planifie', every: 'day', time: '08:00' }, actions: [{ kind: 'bibliotheque.depot' }] })
    expect(system('versions-a-confirmer')).toMatchObject({ enabled: false, trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' } })
    expect(system('a-classer')).toMatchObject({ enabled: false, trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' } })
  })

  it('à l’ouverture : le dossier créé s’il manque, rien n’est dit', async () => {
    const platform = memoryPlatform()
    const { journal } = await start(platform)
    await runOpeningWorkflows()
    expect(await platform.fs.exists('Bibliothèque/À verser')).toBe(true)
    expect(platform.notices.filter((notice) => notice.startsWith('Bibliothèque :'))).toEqual([])
    expect(journal()).toContain('Rien dans Bibliothèque/À verser.')
  })

  it('ce qui y est posé entre dans la bibliothèque (rangé dans _fichiers) ; un fichier déjà là part dans _retirés', async () => {
    const platform = memoryPlatform()
    const { records } = await start(platform)
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: enc('plan') }], { module: 'bibliotheque', label: 'Versé à la main' })
    await platform.fs.writeBinary('Bibliothèque/À verser/Devis 2026.xlsx', enc('devis').buffer)
    await platform.fs.writeBinary('Bibliothèque/À verser/Sous-traitant/Rapport.pdf', enc('rapport').buffer)
    await platform.fs.writeBinary('Bibliothèque/À verser/Plan copie.pdf', enc('plan').buffer)
    await runOpeningWorkflows()
    expect(platform.notices).toContain('Bibliothèque : 2 document(s) versé(s) depuis Bibliothèque/À verser. 1 y étai(en)t déjà : mis de côté dans _retirés.')
    expect(records().sort()).toEqual(['Bibliothèque/Devis 2026.md', 'Bibliothèque/Plan.md', 'Bibliothèque/Rapport.md'])
    expect(platform.files.has('Bibliothèque/_fichiers/Devis 2026.xlsx')).toBe(true)
    expect(platform.files.has('Bibliothèque/_fichiers/Rapport.pdf')).toBe(true)
    expect(platform.files.has('Bibliothèque/_retirés/Plan copie.pdf')).toBe(true)
    expect([...platform.files.keys()].some((path) => path.startsWith('Bibliothèque/À verser/') && !path.endsWith('/'))).toBe(false)
    expect(read(platform, 'Bibliothèque/Devis 2026.md')).toMatch(/copie: true/)
    expect(read(platform, 'Bibliothèque/Plan.md')).toContain('Déposé dans « À verser »')
  })

  it('les versions à confirmer, une fois activé : comptées et nommées', async () => {
    const platform = memoryPlatform()
    const { system } = await start(platform)
    await pourIntoLibrary([{ name: 'CCTP ind A.pdf', bytes: enc('A') }], { module: 'bibliotheque', label: 'Versé à la main' })
    await pourIntoLibrary([{ name: 'CCTP ind B.pdf', bytes: enc('B') }], { module: 'bibliotheque', label: 'Versé à la main' })
    Object.assign(system('versions-a-confirmer'), { enabled: true, created: '2020-01-01T00:00:00.000Z' })
    await runDueWorkflows()
    expect(platform.notices).toContain('Bibliothèque : 1 nouvelle(s) version(s) probable(s) à confirmer — CCTP ind B. Sur leur fiche : « Relier comme nouvelle version » ou « Ce n’en est pas une ».')
  })

  it('les documents à classer, une fois activé : comptés et nommés', async () => {
    const platform = memoryPlatform()
    const { system } = await start(platform)
    await pourIntoLibrary([{ name: 'Divers.pdf', bytes: enc('x') }, { name: 'CCTP.pdf', bytes: enc('y') }], { module: 'bibliotheque', label: 'Versé à la main' })
    Object.assign(system('a-classer'), { enabled: true, created: '2020-01-01T00:00:00.000Z' })
    await runDueWorkflows()
    expect(platform.notices).toContain('Bibliothèque : 1 document(s) sans catégorie — Divers. Sur leur fiche : « Classer… ».')
  })
})
