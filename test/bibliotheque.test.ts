// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **bibliothèque de documents** : tout fichier déposé y est rangé, une fois, avec sa
 * fiche. Venu de l'ordinateur : copié ; déjà dans le coffre : laissé à sa place. Un même
 * fichier n'y entre qu'une fois (ses origines s'ajoutent) ; une nouvelle version est
 * reconnue à son nom, à relier. La page, la fiche, classer, retirer ; et ce que versent
 * l'analyse d'appels d'offres et l'import d'exigences.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
const enc = (text: string) => new TextEncoder().encode(text)

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = MODULES) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false } }
  const commands = new Map<string, ModuleCommand>()
  const views = new ViewsRegistry()
  const shown: string[] = []
  const noted: string[] = []
  for (const module of modules) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command), run: async (id) => commands.get(`${module.id}-${id}`)?.run() },
      views,
      showPage: (id: string) => void shown.push(id),
      showNote: async (path: string) => void noted.push(path)
    }
    await module.activate(context)
  }
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => '2026-11-06' }
  return { views, shown, noted, page, services, run: (id: string) => commands.get(id)!.run() }
}

// Les cartes, sections repliables comprises (les pages de la bibliothèque les regroupent).
const cardsIn = (blocks: readonly HomeBlock[]): Card[] => blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : block.kind === 'section' ? cardsIn(block.blocks) : []))
const cardsOf = (view: PageView): Card[] => cardsIn(view.blocks)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('verser dans la bibliothèque', () => {
  it('venu de l’ordinateur : copié dans _fichiers, une fiche avec son titre, sa famille, sa catégorie devinée, son origine', async () => {
    const platform = memoryPlatform()
    await start(platform)
    const report = await pourIntoLibrary([{ name: 'CCTP_lot_2.pdf', bytes: enc('%PDF cctp') }], { module: 'bibliotheque', label: 'Versé à la main' })
    expect(report?.added).toHaveLength(1)
    const doc = report!.added[0]!
    expect(doc).toMatchObject({ title: 'CCTP lot 2', family: 'pdf', category: 'CCTP', file: 'Bibliothèque/_fichiers/CCTP_lot_2.pdf', copied: true, record: 'Bibliothèque/CCTP lot 2.md' })
    expect(read(platform, 'Bibliothèque/_fichiers/CCTP_lot_2.pdf')).toBe('%PDF cctp')
    const note = read(platform, doc.record)
    expect(note).toContain('bp-type: bibliotheque-document')
    expect(note).toMatch(/sha256: [0-9a-f]{64}/)
    expect(note).toContain('## Notes')
  })

  it('le même fichier (mêmes octets, autre nom) n’entre qu’une fois : ses origines s’ajoutent', async () => {
    const platform = memoryPlatform()
    await start(platform)
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: enc('même contenu') }], { module: 'bibliotheque', label: 'Versé à la main' })
    const again = await pourIntoLibrary([{ name: 'Plan copie.pdf', bytes: enc('même contenu') }], { module: 'exigences', label: 'Import d’exigences (Plan copie.pdf)' })
    expect(again?.added).toEqual([])
    expect(again?.already[0]?.origins.map((origin) => origin.module)).toEqual(['bibliotheque', 'exigences'])
    expect([...platform.files.keys()].filter((path) => path.startsWith('Bibliothèque/_fichiers/'))).toEqual(['Bibliothèque/_fichiers/Plan.pdf'])
  })

  it('déjà dans le coffre : laissé à sa place, la fiche le désigne', async () => {
    const platform = memoryPlatform()
    await start(platform)
    await platform.fs.writeText('Dossiers/Note de calcul.md', '# Calcul')
    const report = await pourIntoLibrary([{ name: 'Note de calcul.md', path: 'Dossiers/Note de calcul.md' }], { module: 'bibliotheque', label: 'Versé à la main' })
    expect(report?.added[0]).toMatchObject({ file: 'Dossiers/Note de calcul.md', copied: false, family: 'note', category: 'Note de calcul' })
    expect([...platform.files.keys()].some((path) => path.startsWith('Bibliothèque/_fichiers/'))).toBe(false)
  })

  it('sans le module actif : rien', async () => {
    const platform = memoryPlatform()
    await start(platform, [lectureFichiersModule])
    expect(await pourIntoLibrary([{ name: 'a.pdf', bytes: enc('a') }], { module: 'x', label: '' })).toBeNull()
  })
})

describe('les versions', () => {
  it('même nom, marques de version ôtées, autre contenu : version probable ; relier, puis le plus ancien est remplacé', async () => {
    const platform = memoryPlatform()
    const { page } = await start(platform)
    const first = (await pourIntoLibrary([{ name: 'CCTP ind A.pdf', bytes: enc('A') }], { module: 'bibliotheque', label: 'Versé à la main' }))!.added[0]!
    const second = (await pourIntoLibrary([{ name: 'CCTP ind B.pdf', bytes: enc('B') }], { module: 'bibliotheque', label: 'Versé à la main' }))!.added[0]!
    expect(second.likelyPrevious).toBe(first.record)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(second.record))
    const message = fiche.blocks.find((block) => block.kind === 'message' && block.tone === 'warning')
    expect(message).toMatchObject({ text: 'Ce document ressemble à une nouvelle version de « CCTP ind A » (même nom, autre contenu).' })
    await (message as { actions: { id: string; run(): unknown }[] }).actions.find((action) => action.id === 'relate')!.run()
    const after = await page('bibliotheque.document').load(encodeURIComponent(second.record))
    const versions = after.blocks.find((block) => block.kind === 'list' && block.title === 'Versions')
    expect(versions?.kind === 'list' && versions.items.map((item) => item.title)).toEqual(['CCTP ind A'])
    const library = await page('bibliotheque.documents').load()
    const older = cardsOf(library).find((card) => card.id === first.record)!
    expect(older.badges?.map((badge) => badge.label)).toContain('Remplacé par une version plus récente')
    expect(older.tags).not.toContain('a-jour')
    expect(cardsOf(library).find((card) => card.id === second.record)!.tags).toContain('a-jour')
  })
})

describe('les versions, dans un même versement', () => {
  it('deux fichiers du même nom versés ensemble (deux formats) ne sont pas pris pour deux versions', async () => {
    const platform = memoryPlatform()
    await start(platform)
    const report = await pourIntoLibrary([{ name: 'BPU.xls', bytes: enc('ancien format') }, { name: 'BPU.xlsx', bytes: enc('nouveau format') }], { module: 'bibliotheque', label: 'Versé à la main' })
    expect(report?.added.map((doc) => doc.likelyPrevious)).toEqual([undefined, undefined])
  })
})

describe('la page Bibliothèque et la fiche d’un document', () => {
  it('le menu, la tuile, le tableau de bord ; les chiffres, une carte par document, les filtres', async () => {
    const platform = memoryPlatform()
    const { views, page, shown } = await start(platform)
    await pourIntoLibrary([{ name: 'Devis 2026.xlsx', bytes: enc('x') }, { name: 'Photo chantier.jpg', bytes: enc('y') }], { module: 'bibliotheque', label: 'Versé à la main' })
    const nav = views.navEntries().find((entry) => entry.id === 'bibliotheque')!
    // Le menu mène à l'accueil de la bibliothèque (documents, prompts, personas) ; la page des documents en dépend.
    expect(nav.page).toBe('bibliotheque.accueil')
    await nav.run()
    expect(shown).toEqual(['bibliotheque.accueil'])
    expect(views.pages().find((each) => each.id === 'bibliotheque.documents')!.parent).toBe('bibliotheque.accueil')
    const view = await page('bibliotheque.documents').load()
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}:${stat.value}`)).toEqual(['Documents:2', 'Taille:2 o', 'Ajoutés cette semaine:2', 'Versions à relier:0'])
    expect(view.filters?.map((filter) => filter.id)).toEqual(['famille-sheet', 'famille-image', 'de-bibliotheque', 'a-jour'])
    const card = cardsOf(view).find((each) => each.title === 'Devis 2026')!
    expect(card.badges?.map((badge) => badge.label)).toEqual(['Tableurs', 'Devis'])
    expect(card.text).toBe('Bibliothèque de documents — Versé à la main')
    const section = await views.homeSections().find((each) => each.id === 'bibliotheque.home')!.load()
    expect(section?.subtitle).toBe('2 document(s)')
  })

  it('« Verser des documents » de la page : un seul, sa fiche ensuite', async () => {
    const platform = memoryPlatform()
    const { page, shown } = await start(platform)
    platform.choices.push('computer')
    platform.externalFiles.push([{ name: 'Rapport final.docx', bytes: enc('r') }])
    await (await page('bibliotheque.documents').load()).actions!.find((action) => action.id === 'pour')!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Rapport final.md')}`)
    expect(platform.notices.at(-1)).toBe('1 document(s) versé(s) dans la bibliothèque, 0 y étai(en)t déjà.')
  })

  it('la fiche : identification, fichier, origines (un clic y mène), « Classer… », « Retirer » (mis de côté)', async () => {
    const platform = memoryPlatform()
    const { page, noted, shown } = await start(platform)
    const doc = (await pourIntoLibrary([{ name: 'Courrier acheteur.pdf', bytes: enc('c') }], { module: 'ao', label: 'Station sol', link: "Appels d'offres/Station sol/Station sol.md" }))!.added[0]!
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    expect(fiche.title).toBe('Courrier acheteur')
    expect(fiche.actions?.map((action) => action.id)).toEqual(['file', 'classify', 'version', 'note', 'aside'])
    const origins = fiche.blocks.find((block) => block.kind === 'list' && block.title?.startsWith('D’où il vient'))
    expect(origins?.kind === 'list' && origins.items.map((item) => `${item.title}:${item.detail}`)).toEqual(["Analyse d'appels d'offres:Station sol"])
    await (origins?.kind === 'list' ? origins.items[0]!.open!.run() : null)
    expect(noted).toEqual(["Appels d'offres/Station sol/Station sol.md"])
    platform.forms.push({ title: 'Courrier de l’acheteur', category: 'Courrier', reference: 'CR-12', edition: '1', revision: 'A', issuer: 'Agence', tags: 'achat, urgent' })
    await fiche.actions!.find((action) => action.id === 'classify')!.run()
    const after = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    expect(after.title).toBe('Courrier de l’acheteur')
    const identity = after.blocks.find((block) => block.kind === 'list' && block.title === 'Identification')
    expect(identity?.kind === 'list' && identity.items.map((item) => item.detail)).toEqual(['Courrier de l’acheteur', 'CR-12', '1', 'A', 'Courrier', 'Agence', 'achat, urgent'])
    await after.actions!.find((action) => action.id === 'aside')!.run()
    expect(platform.confirmed.at(-1)?.title).toBe('Retirer de la bibliothèque ?')
    expect(shown.at(-1)).toBe('bibliotheque.documents')
    expect(platform.files.has('Bibliothèque/_retirés/Courrier acheteur.md')).toBe(true)
    expect(platform.files.has('Bibliothèque/_retirés/Courrier acheteur.pdf')).toBe(true)
    expect(cardsOf(await page('bibliotheque.documents').load())).toEqual([])
  })
})

describe('ce que les modules versent', () => {
  it('les pièces importées dans une analyse : dans la bibliothèque, laissées à leur place, le type de pièce pour catégorie', async () => {
    const platform = memoryPlatform()
    const { page, services } = await start(platform)
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence', reference: '' })
    await importFiles(services, analysis, [{ name: 'CCTP.md', bytes: enc('# Cahier des clauses techniques particulières\n\nLe titulaire doit fournir une antenne.') }], async (request) => ({ places: Object.fromEntries(request.pending.map((piece) => [piece.path, 'appel-d-offres' as const])) }))
    const cards = cardsOf(await page('bibliotheque.documents').load())
    expect(cards).toHaveLength(1)
    expect(cards[0]!.text).toBe("Analyse d'appels d'offres — Station sol")
    expect(cards[0]!.badges?.map((badge) => badge.label)).toContain('CCTP')
    // Le fichier en sous-titre ; la taille, la date d'ajout, la version en faits (les colonnes du tableau).
    expect(cards[0]!.subtitle).toBe('CCTP.md')
    expect(cards[0]!.facts?.map((fact) => fact.label)).toEqual(['Taille', 'Ajouté le', 'Version'])
    expect([...platform.files.keys()].some((path) => path.startsWith('Bibliothèque/_fichiers/'))).toBe(false)
  })

  it('le fichier d’où l’on importe des exigences : copié dans la bibliothèque', async () => {
    const platform = memoryPlatform()
    const { page, run } = await start(platform)
    platform.choices.push('computer')
    platform.externalFiles.push([{ name: 'Exigences client.csv', bytes: enc('Exigence;Vérification\nLe système doit démarrer en 5 s.;Essai\n') }])
    platform.forms.push({ category: 'cli' })
    await run('exigences-importer')
    const cards = cardsOf(await page('bibliotheque.documents').load())
    expect(cards.map((card) => `${card.title}:${card.text}`)).toEqual(['Exigences client:Exigences — Import d’exigences (Exigences client.csv)'])
    expect(platform.files.has('Bibliothèque/_fichiers/Exigences client.csv')).toBe(true)
  })
})

describe('la page des documents : vues et regroupements', () => {
  it('regrouper par origine (d’origine), famille, catégorie, mois d’ajout, ou aucun ; une section par groupe', async () => {
    const platform = memoryPlatform()
    const { page } = await start(platform)
    await pourIntoLibrary([{ name: 'Devis 2026.xlsx', bytes: enc('x') }, { name: 'CCTP lot 2.pdf', bytes: enc('y') }], { module: 'bibliotheque', label: 'Versé à la main' })
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: enc('z') }], { module: 'exigences', label: 'Import d’exigences (Plan.pdf)' })
    const sections = (view: PageView) => view.blocks.flatMap((block) => (block.kind === 'section' ? [`${block.title} (${block.subtitle})`] : []))
    let view = await page('bibliotheque.documents').load()
    expect(view.layouts).toEqual(['cards', 'list', 'table'])
    expect(view.grouping).toMatchObject({ label: 'Regrouper par', current: 'origine' })
    expect(view.grouping!.options.map((option) => option.label)).toEqual(['Origine', 'Famille', 'Catégorie', 'Mois d’ajout', 'Aucun'])
    expect(sections(view)).toEqual(['Bibliothèque de documents — Versé à la main (2 document(s))', 'Exigences — Import d’exigences (Plan.pdf) (1 document(s))'])
    const regroup = async (id: string) => {
      await view.grouping!.options.find((option) => option.id === id)!.run()
      view = await page('bibliotheque.documents').load()
    }
    await regroup('famille')
    expect(sections(view)).toEqual(['PDF (2 document(s))', 'Tableurs (1 document(s))'])
    await regroup('categorie')
    expect(sections(view)).toEqual(['CCTP (1 document(s))', 'Devis (1 document(s))', 'Plan (1 document(s))'])
    await regroup('mois')
    expect(sections(view)).toHaveLength(1)
    await regroup('aucun')
    expect(sections(view)).toEqual([])
    expect(cardsOf(view)).toHaveLength(3)
    await regroup('origine')
  })

  it('prompts et personas : regrouper par catégorie (d’origine), favoris, ou aucun', async () => {
    const platform = memoryPlatform()
    const { page } = await start(platform)
    let view = await page('bibliotheque.prompts').load()
    await view.actions!.find((action) => action.id === 'starters')!.run()
    view = await page('bibliotheque.prompts').load()
    expect(view.grouping!.options.map((option) => option.label)).toEqual(['Catégorie', 'Favoris', 'Aucun'])
    expect(view.blocks.flatMap((block) => (block.kind === 'section' ? [block.title] : []))).toEqual(['Analyse', 'Consultation', 'Contrat', 'Planning'])
    await view.grouping!.options.find((option) => option.id === 'favoris')!.run()
    view = await page('bibliotheque.prompts').load()
    expect(view.blocks.flatMap((block) => (block.kind === 'section' ? [`${block.title} (${block.subtitle})`] : []))).toEqual(['Les autres (7 prompt(s))'])
    await view.grouping!.options.find((option) => option.id === 'categorie')!.run()
  })
})
