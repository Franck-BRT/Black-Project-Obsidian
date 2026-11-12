// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Se passer une bibliothèque** : exportée d'un coffre en une archive ZIP, importée dans un
 * autre — ses notes (prompts…), ou ses documents (fiche et fichier). Importée deux fois : rien en
 * double. Une archive d'une autre sorte : refusée, dit pourquoi.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type PageView } from '../src/core/views'
import { addStarterEntries, bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

const MODULES = [lectureFichiersModule, bibliothequeModule]
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))

/** Un coffre, ses modules actifs ; `stop` les arrête (pour passer à un autre coffre). */
async function vault(platform: MemoryPlatform, initial: Record<string, Record<string, unknown>> = {}) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ...initial }
  const views = new ViewsRegistry()
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: () => {}
    }
    await module.activate(context)
  }
  const load = (id: string, param?: string): Promise<PageView> => views.pages().find((each) => each.id === id)!.load(param)
  const run = async (view: PageView, id: string) => view.actions!.find((action) => action.id === id)!.run()
  return { load, run, settings, stop: async () => { for (const module of [...MODULES].reverse()) await module.deactivate?.() } }
}

/** L'archive écrite par le dernier export. */
const exported = (platform: MemoryPlatform): { name: string; bytes: Uint8Array } => {
  const path = [...platform.files.keys()].filter((each) => each.startsWith('Échanges/Bibliothèques/') && each.endsWith('.zip')).at(-1)!
  return { name: path.slice(path.lastIndexOf('/') + 1), bytes: platform.files.get(path)! }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('se passer une bibliothèque', () => {
  it('des prompts : exportés en archive, importés ailleurs ; une seconde fois, rien en double ; dans une bibliothèque d’une autre sorte, refusés', async () => {
    const mine = memoryPlatform()
    const a = await vault(mine)
    await addStarterEntries('prompt', 'fr')
    const prompts = await a.load('bibliotheque.prompts')
    expect(prompts.actions?.map((action) => action.id)).toEqual(expect.arrayContaining(['export-shelf', 'import-shelf']))
    expect(prompts.actions?.map((action) => action.id)).not.toContain('new-shelf')
    await a.run(prompts, 'export-shelf')
    const zip = exported(mine)
    expect(zip.name).toMatch(/^Bibliothèque Prompts \d{4}-\d{2}-\d{2}\.zip$/)
    expect(mine.notices.at(-1)).toMatch(/^7 prompts exporté\(s\) dans Échanges\/Bibliothèques\/Bibliothèque Prompts /)
    await a.stop()

    // Un autre coffre : importé.
    const theirs = memoryPlatform()
    const b = await vault(theirs)
    const empty = await b.load('bibliotheque.prompts')
    theirs.choices.push('computer')
    theirs.externalFiles.push([zip])
    await b.run(empty, 'import-shelf')
    expect(theirs.notices.at(-1)).toBe('Importé de « Prompts » : 7 prompts ajouté(s), 0 déjà là.')
    const names = [...theirs.files.keys()].filter((path) => path.startsWith('Bibliothèque/Prompts/') && path.endsWith('.md'))
    expect(names).toHaveLength(7)
    // Une seconde fois : déjà là.
    theirs.choices.push('computer')
    theirs.externalFiles.push([zip])
    await b.run(await b.load('bibliotheque.prompts'), 'import-shelf')
    expect(theirs.notices.at(-1)).toBe('Importé de « Prompts » : 0 prompts ajouté(s), 7 déjà là.')
    // Dans les personas : ce n'en sont pas.
    theirs.choices.push('computer')
    theirs.externalFiles.push([zip])
    await b.run(await b.load('bibliotheque.personas'), 'import-shelf')
    expect(theirs.notices.at(-1)).toBe('Cette archive est une bibliothèque de prompts : importez-la depuis la page des prompts, pas celle des personas.')
    // Une archive qui n'est pas une bibliothèque.
    theirs.choices.push('computer')
    theirs.externalFiles.push([{ name: 'x.zip', bytes: bytes('pas une archive') }])
    await b.run(await b.load('bibliotheque.prompts'), 'import-shelf')
    expect(theirs.notices.at(-1)).toBe('Cette archive ne peut pas être ouverte : est-ce bien un fichier .zip ?')
  })

  it('des documents : leurs fiches (ce qu’elles disent) et leurs fichiers, dans leurs répertoires ; déjà là : pas de seconde copie', async () => {
    const mine = memoryPlatform()
    const a = await vault(mine)
    await mine.fs.ensureFolder('Bibliothèque/Normes')
    const [norme] = (await pourIntoLibrary([{ name: 'ECSS.pdf', bytes: bytes('ecss') }], { module: 'bibliotheque', label: '' }, { folder: 'Bibliothèque/Normes' }))!.added
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: bytes('plan') }], { module: 'bibliotheque', label: '' })
    // Ce que l'utilisateur a dit de la norme, dans sa fiche.
    mine.files.set(norme!.record, bytes(read(mine, norme!.record).replace('titre: ECSS', 'titre: Norme ECSS-E-ST-10C').replace('reference: ""', 'reference: ECSS-E-ST-10C')))
    await a.run(await a.load('bibliotheque.documents'), 'export-shelf')
    const zip = exported(mine)
    expect(mine.notices.at(-1)).toMatch(/^2 documents exporté\(s\) dans Échanges\/Bibliothèques\/Bibliothèque Documents /)
    // Un répertoire seul s'exporte aussi.
    await a.run(await a.load('bibliotheque.documents', encodeURIComponent('principale:Normes')), 'export-shelf')
    expect(exported(mine).name).toMatch(/^Bibliothèque Documents Normes /)
    await a.stop()

    const theirs = memoryPlatform()
    const b = await vault(theirs)
    // Un des documents y est déjà, ailleurs : il n'est pas copié une seconde fois.
    await pourIntoLibrary([{ name: 'Plan à moi.pdf', bytes: bytes('plan') }], { module: 'bibliotheque', label: '' })
    theirs.choices.push('computer')
    theirs.externalFiles.push([zip])
    await b.run(await b.load('bibliotheque.documents'), 'import-shelf')
    expect(theirs.notices.at(-1)).toBe('Importé de « Documents » : 1 documents ajouté(s), 1 déjà là.')
    const record = read(theirs, 'Bibliothèque/Normes/ECSS.md')
    expect(record).toContain('titre: Norme ECSS-E-ST-10C')
    expect(record).toContain('reference: ECSS-E-ST-10C')
    expect(record).toContain('libelle: "Bibliothèque importée « Documents »"')
    expect([...theirs.files.keys()].filter((path) => path.endsWith('.pdf')).sort()).toEqual(['Bibliothèque/_fichiers/ECSS.pdf', 'Bibliothèque/_fichiers/Plan à moi.pdf'])
  })

  it('toute la bibliothèque d’un coup : chaque bibliothèque de chaque sorte dans une archive ; importée, chacune dans la sienne (créée au besoin) ; une seconde fois, rien de nouveau', async () => {
    const mine = memoryPlatform()
    const a = await vault(mine, { bibliotheque: { bibliotheques: { document: [{ id: 'archives', name: 'Archives', folder: 'Archives' }] } } })
    await addStarterEntries('prompt', 'fr')
    await addStarterEntries('persona', 'fr')
    await pourIntoLibrary([{ name: 'Norme.pdf', bytes: bytes('norme') }], { module: 'bibliotheque', label: '' }, { folder: 'Bibliothèque/Références' })
    await pourIntoLibrary([{ name: 'Vieux plan.pdf', bytes: bytes('vieux') }], { module: 'bibliotheque', label: '' }, { folder: 'Archives' })
    const hub = await a.load('bibliotheque.accueil')
    expect(hub.actions?.map((action) => action.id)).toEqual(['export-all', 'import-all'])
    await a.run(hub, 'export-all')
    const zip = exported(mine)
    expect(zip.name).toMatch(/^Bibliothèque complète \d{4}-\d{2}-\d{2}\.zip$/)
    expect(mine.notices.at(-1)).toMatch(/^Toute la bibliothèque exportée \(2 documents, 7 prompts, \d+ personas\) dans Échanges\/Bibliothèques\/Bibliothèque complète /)
    await a.stop()

    const theirs = memoryPlatform()
    const b = await vault(theirs)
    theirs.choices.push('computer')
    theirs.externalFiles.push([zip])
    await b.run(await b.load('bibliotheque.accueil'), 'import-all')
    expect(theirs.notices.at(-1)).toMatch(/^Bibliothèque « complète » importée : 2 documents, 7 prompts, \d+ personas ajouté\(s\) ; 0 déjà là\.$/)
    // Chacune dans la sienne : les références dans les références ; « Archives », créée.
    expect(read(theirs, 'Bibliothèque/Références/Norme.md')).toContain('bp-type: bibliotheque-document')
    expect(b.settings.bibliotheque?.bibliotheques).toMatchObject({ document: [{ id: 'archives', name: 'Archives' }] })
    expect(await theirs.fs.exists('Bibliothèques/Documents/Archives/Vieux plan.md')).toBe(true)
    expect([...theirs.files.keys()].filter((path) => path.startsWith('Bibliothèque/Prompts/') && path.endsWith('.md'))).toHaveLength(7)
    // Une seconde fois : rien de nouveau.
    theirs.choices.push('computer')
    theirs.externalFiles.push([zip])
    await b.run(await b.load('bibliotheque.accueil'), 'import-all')
    expect(theirs.notices.at(-1)).toMatch(/^Bibliothèque « complète » importée : rien de nouveau ajouté\(s\) ; \d+ déjà là\.$/)
    // Sur la page d'une seule bibliothèque : dit où l'importer.
    theirs.choices.push('computer')
    theirs.externalFiles.push([zip])
    await b.run(await b.load('bibliotheque.prompts'), 'import-shelf')
    expect(theirs.notices.at(-1)).toBe('Cette archive est toute une bibliothèque : importez-la depuis l’accueil de la bibliothèque (« Tout importer… »).')
  })
})
