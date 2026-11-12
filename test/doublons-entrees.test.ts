// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Un fichier n'entre qu'une fois**, quel que soit le chemin par lequel il arrive — glissé
 * dans la bibliothèque, importé dans une analyse d'appel d'offres, importé comme exigences —
 * et où qu'il soit déjà rangé : la bibliothèque principale, les documents de référence, une
 * bibliothèque ajoutée. Une fiche sans empreinte est reconnue aussi.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { aoModule, createAnalysis, importFiles, updateAnalysis } from '../src/modules/ao'
import { bibliothequeModule, findInLibrary, pourIntoLibrary } from '../src/modules/bibliotheque'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
const enc = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const NORME = enc('Exigence;Vérification\nLe système doit démarrer en 5 s.;Essai\n')
const toTender = async (request: { pending: { path: string }[] }) => ({ places: Object.fromEntries(request.pending.map((piece) => [piece.path, 'appel-d-offres' as const])) })

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {
    ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false },
    // Une bibliothèque de documents ajoutée, hors du dossier de la principale.
    bibliotheque: { bibliotheques: { document: [{ id: 'archives', name: 'Archives', folder: 'Archives' }] } }
  }
  const commands = new Map<string, ModuleCommand>()
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command), run: async (id) => commands.get(`${module.id}-${id}`)?.run() },
      views: new ViewsRegistry(),
      showPage: () => {},
      showNote: async () => {}
    }
    await module.activate(context)
  }
  const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => '2026-11-12' }
  return { services, run: (id: string) => commands.get(id)!.run() }
}

/** Les fiches de documents du coffre (toutes bibliothèques), et les fichiers d'un nom. */
const records = (platform: MemoryPlatform) => [...platform.files.keys()].filter((path) => path.endsWith('.md') && read(platform, path).includes('bp-type: bibliotheque-document'))
const copies = (platform: MemoryPlatform, extension: string) => [...platform.files.keys()].filter((path) => path.endsWith(extension))

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('un fichier n’entre qu’une fois, par où qu’il arrive', () => {
  for (const [where, folder] of [
    ['les documents de référence', 'Bibliothèque/Références'],
    ['la bibliothèque principale', 'Bibliothèque'],
    ['une bibliothèque ajoutée', 'Archives']
  ] as const) {
    it(`déjà dans ${where} : ni glissé, ni importé dans une analyse, ni importé comme exigences, il n’est copié une seconde fois`, async () => {
      const platform = memoryPlatform()
      const { services, run } = await start(platform)
      const first = (await pourIntoLibrary([{ name: 'Norme.csv', bytes: NORME }], { module: 'bibliotheque', label: '' }, { folder }))!.added[0]!
      expect(first.record).toBe(`${folder}/Norme.md`)
      expect(await findInLibrary(NORME)).toMatchObject({ record: first.record, file: first.file })
      // Glissé de nouveau dans la bibliothèque (ailleurs, sous un autre nom) : déjà là.
      const again = (await pourIntoLibrary([{ name: 'Copie de la norme.csv', bytes: NORME }], { module: 'bibliotheque', label: '' }))!
      expect(again.added).toEqual([])
      expect(again.already.map((doc) => doc.record)).toEqual([first.record])
      // Importé dans une analyse : pas de copie dans ses originaux ; la pièce montre le fichier de la bibliothèque.
      const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: '', reference: '' })
      const report = await importFiles(services, analysis, [{ name: 'Exigences client.csv', bytes: NORME }], toTender)
      expect(report.inLibrary).toEqual([{ name: 'Exigences client.csv', title: 'Norme', place: expect.any(String) }])
      expect(report.imported).toHaveLength(1)
      expect(read(platform, report.imported[0]!.note)).toContain(`fichier: "[[${first.file}]]"`)
      // Importé de nouveau dans la même analyse : rien de plus.
      expect((await importFiles(services, analysis, [{ name: 'Exigences client.csv', bytes: NORME }], toTender)).duplicates).toEqual(['Exigences client.csv'])
      // Importé comme exigences, de l'ordinateur : déjà là.
      platform.choices.push('computer')
      platform.externalFiles.push([{ name: 'Exigences.csv', bytes: NORME }])
      platform.forms.push({ category: 'cli' })
      await run('exigences-importer')
      // Une seule fiche, un seul fichier ; les origines s'ajoutent.
      expect(records(platform)).toEqual([first.record])
      expect(copies(platform, '.csv')).toEqual([first.file])
      const record = read(platform, first.record)
      expect(record).toContain('- module: ao\n  libelle: Station sol')
      expect(record).toContain('- module: exigences\n  libelle: Import d’exigences (Exigences.csv)')
    })
  }

  it('une fiche sans empreinte (écrite à la main) : reconnue à son fichier ; son empreinte, gardée', async () => {
    const platform = memoryPlatform()
    await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    await platform.fs.writeBinary('Bibliothèque/Normes/Norme.csv', NORME.slice().buffer)
    await platform.fs.writeText('Bibliothèque/Normes/Norme.md', '---\nbp-type: bibliotheque-document\ntitre: Norme\nfichier: "[[Bibliothèque/Normes/Norme.csv]]"\n---\n\n# Norme\n')
    const report = (await pourIntoLibrary([{ name: 'Norme (2).csv', bytes: NORME }], { module: 'bibliotheque', label: '' }))!
    expect(report.added).toEqual([])
    expect(report.already.map((doc) => doc.record)).toEqual(['Bibliothèque/Normes/Norme.md'])
    expect(read(platform, 'Bibliothèque/Normes/Norme.md')).toMatch(/\nsha256: "[0-9a-f]{64}"\n/)
  })

  it('déposé à la main dans les originaux d’une analyse, déjà dans la bibliothèque : pas de doublon sur le disque — le fichier déposé part, la pièce montre celui de la bibliothèque', async () => {
    const platform = memoryPlatform()
    const { services } = await start(platform)
    const first = (await pourIntoLibrary([{ name: 'Norme.csv', bytes: NORME }], { module: 'bibliotheque', label: '' }, { folder: 'Bibliothèque/Références' }))!.added[0]!
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: '', reference: '' })
    const dropped = `${analysis.folder}/Pièces/Appel d'offres/Originaux/Exigences client.csv`
    await platform.fs.ensureFolder(dropped.slice(0, dropped.lastIndexOf('/')))
    await platform.fs.writeBinary(dropped, NORME.slice().buffer)
    const report = await updateAnalysis(services, analysis)
    expect(report.inLibrary).toEqual([{ name: 'Exigences client.csv', title: 'Norme', place: expect.any(String) }])
    expect(await platform.fs.exists(dropped)).toBe(false)
    expect(read(platform, report.imported[0]!.note)).toContain(`fichier: "[[${first.file}]]"`)
    expect(copies(platform, '.csv')).toEqual([first.file])
    // Déposé encore une fois au même endroit : la pièce est déjà là — le fichier part, rien de plus.
    await platform.fs.writeBinary(dropped, NORME.slice().buffer)
    const again = await updateAnalysis(services, analysis)
    expect(again.imported).toEqual([])
    expect(again.duplicates).toEqual(['Exigences client.csv'])
    expect(await platform.fs.exists(dropped)).toBe(false)
    expect(records(platform)).toEqual([first.record])
  })

  it('sans corbeille (une plateforme qui n’en a pas) : le fichier déposé en double est mis de côté dans l’analyse, hors des originaux', async () => {
    const platform = memoryPlatform()
    delete (platform.fs as { trash?: unknown }).trash
    const { services } = await start(platform)
    await pourIntoLibrary([{ name: 'Norme.csv', bytes: NORME }], { module: 'bibliotheque', label: '' })
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: '', reference: '' })
    const dropped = `${analysis.folder}/Pièces/Appel d'offres/Originaux/Norme.csv`
    await platform.fs.ensureFolder(dropped.slice(0, dropped.lastIndexOf('/')))
    await platform.fs.writeBinary(dropped, NORME.slice().buffer)
    await updateAnalysis(services, analysis)
    expect(await platform.fs.exists(dropped)).toBe(false)
    expect(await platform.fs.exists(`${analysis.folder}/Pièces/_retirés/Norme.csv`)).toBe(true)
    // Mis de côté, il n'est plus une pièce : rien de plus à la mise à jour suivante.
    expect((await updateAnalysis(services, analysis)).imported).toEqual([])
  })
})
