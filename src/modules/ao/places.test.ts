// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Appel d'offres et réponse : où chaque pièce est rangée, la question posée, le déplacement. */

import { afterEach, describe, expect, it } from 'vitest'
import { utf8 } from '../../core/formats/zip'
import { parseFrontmatter } from '../../core/frontmatter'
import { createI18n } from '../../core/i18n'
import type { ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../../core/testing/memoryPlatform'
import { typagePiecesModule } from '../typage-pieces'
import { aoModule } from '.'
import { aoFr } from './i18n'
import { DEFAULT_RANGEMENT, type Place } from './placement'
import { createAnalysis, importFiles, listCandidates, movePiece, updateAnalysis, type PlacementRequest } from './service'

const i18n = createI18n('fr')
i18n.register('fr', aoFr)
i18n.register('fr', typagePiecesModule.texts.fr)
const t = i18n.t.bind(i18n)
const NONE = { names: {}, titles: {}, types: {} }

function setup(rangement?: Record<string, Place>) {
  const platform = memoryPlatform()
  const services = { fs: platform.fs, t, root: 'AO', today: () => '2026-11-05', keywords: NONE, ...(rangement ? { rangement } : {}) }
  return { platform, services }
}

const files = () => [
  { name: 'CCTP.md', bytes: utf8('# CCTP') },
  { name: 'BPU.csv', bytes: utf8('Poste;Prix\n1;10') },
  { name: 'AE.md', bytes: utf8('# Acte d’engagement') }
]

describe('candidat : une réponse, la sienne', () => {
  it('range d’après le type, et demande pour les types qui vont dans les deux', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    const asked: PlacementRequest[] = []
    const report = await importFiles(services, analysis, files(), async (request) => {
      asked.push(request)
      return { places: { 'BPU.csv': 'reponse', 'AE.md': 'appel-d-offres' } }
    })
    expect(asked).toEqual([
      {
        position: 'candidat',
        pending: [
          { path: 'BPU.csv', type: 'BPU' },
          { path: 'AE.md', type: 'AE' }
        ],
        responseCertain: false,
        candidates: []
      }
    ])
    expect(report.imported.map((piece) => [piece.type, piece.destination])).toEqual([
      ['CCTP', { place: 'appel-d-offres' }],
      ['BPU', { place: 'reponse' }],
      ['AE', { place: 'appel-d-offres' }]
    ])
    expect(await platform.fs.exists("AO/Essai/Pièces/Appel d'offres/Originaux/CCTP.md")).toBe(true)
    expect(await platform.fs.exists('AO/Essai/Pièces/Réponse/Originaux/BPU.csv')).toBe(true)
    const bpu = parseFrontmatter(await platform.fs.readText('AO/Essai/Pièces/Réponse/BPU.md')).data
    expect(bpu).toMatchObject({ place: 'reponse', fichier: '[[AO/Essai/Pièces/Réponse/Originaux/BPU.csv]]' })
    expect(bpu.candidat).toBeUndefined()
    // Le tableau, une partie par destination.
    const note = await platform.fs.readText(analysis.note)
    expect(note.indexOf("### Appel d’offres")).toBeGreaterThan(0)
    expect(note.indexOf('### Réponse')).toBeGreaterThan(note.indexOf("### Appel d’offres"))
    expect(note.slice(note.indexOf('### Réponse'))).toContain('BPU.csv]]')
  })

  it('ne pose pas de question quand le type suffit', async () => {
    const { services } = setup()
    const analysis = await createAnalysis(services, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    let asked = false
    await importFiles(services, analysis, [{ name: 'CCTP.md', bytes: utf8('# x') }], async () => {
      asked = true
      return null
    })
    expect(asked).toBe(false)
  })

  it('n’écrit rien si l’utilisateur renonce', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    const report = await importFiles(services, analysis, files(), async () => null)
    expect(report.cancelled).toBe(true)
    expect(report.imported).toEqual([])
    expect([...platform.files.keys()].filter((path) => path.includes('Originaux'))).toEqual([])
  })
})

describe('émetteur : une réponse par candidat', () => {
  it('range les pièces de réponse dans le dossier du candidat, et le demande même sans pièce ambiguë', async () => {
    const { platform, services } = setup({ ...DEFAULT_RANGEMENT, FORMULAIRE: 'reponse' })
    const analysis = await createAnalysis(services, 'Essai', { position: 'emetteur', buyer: '', reference: '' })
    const asked: PlacementRequest[] = []
    await importFiles(services, analysis, [{ name: 'DC1.md', bytes: utf8('# DC1') }], async (request) => {
      asked.push(request)
      return { places: {}, candidate: 'Société X' }
    })
    expect(asked[0]).toMatchObject({ position: 'emetteur', pending: [], responseCertain: true, candidates: [] })
    const dc1 = parseFrontmatter(await platform.fs.readText('AO/Essai/Pièces/Réponses/Société X/DC1.md')).data
    expect(dc1).toMatchObject({ place: 'reponse', candidat: 'Société X' })
    expect(await listCandidates(platform.fs, analysis)).toEqual(['Société X'])
    expect(await platform.fs.readText(analysis.note)).toContain('### Réponse — Société X')

    await importFiles(services, analysis, [{ name: 'DC2.md', bytes: utf8('# DC2') }], async (request) => {
      asked.push(request)
      return { places: {}, candidate: 'Société Y' }
    })
    expect(asked[1]?.candidates).toEqual(['Société X'])
    expect(await listCandidates(platform.fs, analysis)).toEqual(['Société X', 'Société Y'])
  })
})

describe('fichiers déposés à la main', () => {
  it('sont rangés là où ils ont été déposés', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'Essai', { position: 'emetteur', buyer: '', reference: '' })
    await platform.fs.writeText("AO/Essai/Pièces/Appel d'offres/Originaux/RC.md", '# RC')
    await platform.fs.writeText('AO/Essai/Pièces/Réponses/Société Z/Originaux/BPU.csv', 'a;b')
    await platform.fs.writeText('AO/Essai/Pièces/Originaux/Ancien.md', '# Pièce d’avant la v0.4.1')
    const report = await updateAnalysis(services, analysis)
    expect(Object.fromEntries(report.imported.map((piece) => [piece.original.split('/').pop(), piece.destination]))).toEqual({
      'RC.md': { place: 'appel-d-offres' },
      'BPU.csv': { place: 'reponse', candidate: 'Société Z' },
      'Ancien.md': { place: 'appel-d-offres' }
    })
    expect(await platform.fs.exists('AO/Essai/Pièces/Réponses/Société Z/BPU.md')).toBe(true)
    expect((await updateAnalysis(services, analysis)).imported).toEqual([])
  })
})

describe('déplacer une pièce', () => {
  it('déplace l’original et la note, met la place à jour, et le tableau suit', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'Essai', { position: 'emetteur', buyer: '', reference: '' })
    const [bpu] = (await importFiles(services, analysis, [{ name: 'BPU.csv', bytes: utf8('a;b') }])).imported
    expect(bpu?.destination).toEqual({ place: 'appel-d-offres' })
    const moved = await movePiece(services, bpu!.note, { place: 'reponse', candidate: 'Société X' })
    expect(moved).toBe('AO/Essai/Pièces/Réponses/Société X/BPU.md')
    expect(await platform.fs.exists(bpu!.note)).toBe(false)
    expect(await platform.fs.exists('AO/Essai/Pièces/Réponses/Société X/Originaux/BPU.csv')).toBe(true)
    const content = await platform.fs.readText(moved)
    expect(parseFrontmatter(content).data).toMatchObject({
      place: 'reponse',
      candidat: 'Société X',
      fichier: '[[AO/Essai/Pièces/Réponses/Société X/Originaux/BPU.csv]]'
    })
    expect(content).not.toContain("Appel d'offres/Originaux")
    expect(await platform.fs.readText(analysis.note)).toContain('### Réponse — Société X')

    // Et retour, sans candidat.
    const back = await movePiece(services, moved, { place: 'appel-d-offres' })
    const data = parseFrontmatter(await platform.fs.readText(back)).data
    expect(data.place).toBe('appel-d-offres')
    expect(data.candidat).toBeUndefined()
  })
})

describe('les commandes', () => {
  async function activate(module: typeof aoModule, platform: MemoryPlatform, stored: Record<string, unknown>) {
    const commands: ModuleCommand[] = []
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => stored, save: async () => {}, onChange: () => () => {} },
      commands: { register: (command) => void commands.push(command) }
    }
    await module.activate(context)
    return (id: string) => commands.find((command) => command.id === id)!.run()
  }

  afterEach(async () => {
    await aoModule.deactivate?.()
    await typagePiecesModule.deactivate?.()
  })

  it('importer : la fenêtre demande où ranger, « Tout mettre dans » vaut pour toutes', async () => {
    const platform = memoryPlatform()
    await activate(typagePiecesModule, platform, {})
    const run = await activate(aoModule, platform, { dossier: 'AO' })
    const { services } = setup()
    services.fs = platform.fs
    const analysis = await createAnalysis({ ...services, keywords: undefined as never }, 'Essai', {
      position: 'candidat',
      buyer: '',
      reference: ''
    })
    platform.active = analysis.note
    platform.externalFiles.push(files())
    platform.forms.push({ all: 'reponse', p0: 'appel-d-offres', p1: 'appel-d-offres' })
    await run('importer')
    const form = platform.asked.at(-1)!
    expect(form.title).toBe('Où ranger ces pièces ?')
    expect(form.fields.map((field) => field.key)).toEqual(['all', 'p0', 'p1'])
    expect(await platform.fs.exists('AO/Essai/Pièces/Réponse/BPU.md')).toBe(true)
    expect(await platform.fs.exists('AO/Essai/Pièces/Réponse/AE.md')).toBe(true)
    expect(platform.notices.at(-1)).toContain('1 avec l’appel d’offres, 2 avec la réponse.')
  })

  it('déplacer : la liste des destinations, puis la pièce déplacée', async () => {
    const platform = memoryPlatform()
    await activate(typagePiecesModule, platform, {})
    const run = await activate(aoModule, platform, { dossier: 'AO' })
    const { services } = setup()
    services.fs = platform.fs
    const analysis = await createAnalysis(services, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    const [cctp] = (await importFiles(services, analysis, [{ name: 'CCTP.md', bytes: utf8('# x') }])).imported
    platform.active = cctp!.note
    platform.choices.push('1')
    await run('deplacer-piece')
    expect(platform.offered.at(-1)!.map((choice) => choice.label)).toEqual(['Appel d’offres', 'Réponse'])
    expect(platform.notices.at(-1)).toBe('Pièce déplacée : Réponse.')
    expect(platform.opened.at(-1)).toBe('AO/Essai/Pièces/Réponse/CCTP.md')
  })
})

describe('le rangement, réglé dans le module', () => {
  it('un type rangé avec la réponse n’est plus demandé ; un type absent de la liste l’est', async () => {
    const { platform, services } = setup({ BPU: 'reponse' })
    const analysis = await createAnalysis(services, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    const asked: PlacementRequest[] = []
    const report = await importFiles(services, analysis, files(), async (request) => {
      asked.push(request)
      return { places: { 'CCTP.md': 'appel-d-offres', 'AE.md': 'reponse' } }
    })
    expect(asked[0]?.pending.map((piece) => piece.type)).toEqual(['CCTP', 'AE'])
    expect(report.imported.map((piece) => [piece.type, piece.destination.place])).toEqual([
      ['CCTP', 'appel-d-offres'],
      ['BPU', 'reponse'],
      ['AE', 'reponse']
    ])
    expect(await platform.fs.exists('AO/Essai/Pièces/Réponse/Originaux/BPU.csv')).toBe(true)
  })
})
