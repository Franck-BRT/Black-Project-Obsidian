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
import { ViewsRegistry, type Card, type ExplorerNode, type HomeBlock, type PageView } from '../src/core/views'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule } from '../src/modules/workflows'

/** Les blocs d'une page, ceux de ses sections compris (les messages « à confirmer » y sont regroupés). */
const unfold = (block: HomeBlock): HomeBlock[] => (block.kind === 'section' ? [block, ...block.blocks] : [block])

/** La liste d'une section repliable de la fiche, par son intitulé. */
const sectionList = (blocks: readonly HomeBlock[], title: string | ((title: string) => boolean)): HomeBlock | undefined => {
  const section = blocks.find((block) => block.kind === 'section' && (typeof title === 'string' ? block.title === title : title(block.title)))
  return section?.kind === 'section' ? section.blocks.find((block) => block.kind === 'list') : undefined
}

const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
const enc = (text: string) => new TextEncoder().encode(text)

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = MODULES) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  // L'affichage en cartes (l'explorateur de fichiers a ses propres essais, plus bas).
  const settings: Record<string, Record<string, unknown>> = { workflows: { essentielsSeulement: false }, ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false }, bibliotheque: { explorateur: false } }
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
  return { views, shown, noted, page, services, settings, run: (id: string) => commands.get(id)!.run() }
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
    expect(report?.added[0]).toMatchObject({ file: 'Dossiers/Note de calcul.md', copied: false, family: 'note', category: '' })
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
    const message = fiche.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.tone === 'warning')
    expect(message).toMatchObject({ text: 'Ce document ressemble à une nouvelle version de « CCTP ind A » (même nom, autre contenu).' })
    await (message as { actions: { id: string; run(): unknown }[] }).actions.find((action) => action.id === 'relate')!.run()
    const after = await page('bibliotheque.document').load(encodeURIComponent(second.record))
    const versions = sectionList(after.blocks, 'Versions')
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
    expect(view.filters?.map((filter) => filter.id)).toEqual(['famille-sheet', 'famille-image', 'langue-a-confirmer', 'identite-a-confirmer', 'titre-a-confirmer', 'emetteur-a-confirmer', 'categorie-a-confirmer', 'etiquettes-a-confirmer', 'date-a-confirmer', 'de-bibliotheque', 'a-jour'])
    const card = cardsOf(view).find((each) => each.title === 'Devis 2026')!
    expect(card.badges?.map((badge) => badge.label)).toEqual(['Tableurs', 'Langue à confirmer'])
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

  it('la fiche : identification, fichier, origines (un clic y mène), « Modifier… », « Retirer » (mis de côté)', async () => {
    const platform = memoryPlatform()
    const { page, noted, shown } = await start(platform)
    const doc = (await pourIntoLibrary([{ name: 'Courrier acheteur.pdf', bytes: enc('c') }], { module: 'ao', label: 'Station sol', link: "Appels d'offres/Station sol/Station sol.md" }))!.added[0]!
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    expect(fiche.title).toBe('Courrier acheteur')
    expect(fiche.actions?.map((action) => action.id)).toEqual(['file', 'classify', 'language', 'version', 'link-document', 'move', 'to-references', 'note', 'aside', 'delete'])
    // Identification (dépliée d'origine : l'essentiel), le fichier, d'où il vient, les versions : des sections repliables, leur en-tête en dit l'essentiel.
    // Ce qui reste à confirmer : ensemble, dans une section dépliée, que l'en-tête résume.
    expect(fiche.blocks.find((block) => block.kind === 'section' && block.id === 'bibliotheque.document.a-confirmer')).toMatchObject({
      title: expect.stringMatching(/^À confirmer \(\d\)$/),
      subtitle: expect.stringContaining('Langue')
    })
    expect(fiche.blocks.find((block) => block.kind === 'section' && block.id === 'bibliotheque.document.a-confirmer')).not.toHaveProperty('collapsed')
    // Une ligne par chose à confirmer : son nom, sa raison en court, ses boutons au bout.
    const confirmSection = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.a-confirmer')!
    const lines = confirmSection.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((item) => item.tone === 'warning' && !!item.actions?.length && !/à confirmer :/.test(item.detail ?? ''))).toBe(true)
    expect(lines.find((item) => item.title === 'Langue')).toBeDefined()
    // Son parcours, hors du circuit : doublons contrôlés, versé directement, son texte, ce qui a été identifié à l'entrée, rangé.
    const parcours = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.parcours')!
    const steps = parcours.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    expect(steps.filter((step) => !step.level).map((step) => [step.title, step.when])).toEqual([
      ['Contrôle des doublons', 'Fait'],
      ['Mise dans « À classer »', 'Sans objet'],
      ['Ingestion', 'Échec'],
      ['Recherche dans le glossaire', 'Sans objet'],
      ['Analyse', 'Fait'],
      ['Analyse des liens', 'Sans objet'],
      ['Création des liens', 'Sans objet'],
      ['Rangement', 'Fait']
    ])
    expect(steps.find((step) => step.title === 'Contrôle des doublons')!.detail).toBe('Aucun doublon : versé une seule fois')
    expect(steps.find((step) => step.title === 'Langue')).toMatchObject({ level: 1, tone: 'warning', when: 'À confirmer' })
    // Ses chiffres (famille, taille, ajouté le), dans le sous-titre ; plus de tuiles.
    expect(fiche.subtitle).toMatch(/ · \d+ o · ajouté le \d{4}-\d{2}-\d{2}$/)
    expect(fiche.blocks.some((block) => block.kind === 'stats')).toBe(false)
    expect(fiche.blocks.flatMap((block) => (block.kind === 'section' && block.id !== 'bibliotheque.document.a-confirmer' ? [[block.id, block.title, block.subtitle ?? '', block.collapsed]] : []))).toEqual([
      // Son parcours, dès sa création (versé hors du circuit, ici), déplié.
      ['bibliotheque.document.parcours', 'Le parcours du document', 'Hors du circuit', false],
      ['bibliotheque.document.identite', 'Identification', '', false],
      ['bibliotheque.document.fichier', 'Le fichier', 'Courrier acheteur.pdf', true],
      ['bibliotheque.document.origines', 'D’où il vient (1)', "Analyse d'appels d'offres — Station sol", true],
      ['bibliotheque.document.versions', 'Versions', 'Aucune autre version reliée.', true],
      // Son texte, transcrit dans la fiche (un faux PDF : illisible, comme le serait une pièce d'analyse).
      ['bibliotheque.document.texte', 'Texte extrait', 'Illisible', true]
    ])
    const origins = sectionList(fiche.blocks, (title) => title.startsWith('D’où il vient'))
    expect(origins?.kind === 'list' && origins.items.map((item) => `${item.title}:${item.detail}`)).toEqual(["Analyse d'appels d'offres:Station sol"])
    await (origins?.kind === 'list' ? origins.items[0]!.open!.run() : null)
    expect(noted).toEqual(["Appels d'offres/Station sol/Station sol.md"])
    platform.forms.push({ title: 'Courrier de l’acheteur', category: 'Courrier', reference: 'CR-12', edition: '1', revision: 'A', issuer: 'Agence', date: '12/03/2026', tags: 'achat, urgent' })
    await fiche.actions!.find((action) => action.id === 'classify')!.run()
    const after = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    expect(after.title).toBe('Courrier de l’acheteur')
    const identity = sectionList(after.blocks, 'Identification')
    expect(identity?.kind === 'list' && identity.items.map((item) => item.detail)).toEqual(['Courrier de l’acheteur', 'À la racine', 'Langue à confirmer', 'CR-12', '1', 'A', '12 mars 2026', 'Courrier — hors de la liste des types de pièce', 'Agence — hors de la liste des entreprises', 'achat, urgent — hors de la liste des étiquettes'])
    expect(read(platform, doc.record)).toMatch(/\ndateDocument: "2026-03-12"\n/)
    await after.actions!.find((action) => action.id === 'aside')!.run()
    expect(platform.confirmed.at(-1)?.title).toBe('Retirer de la bibliothèque ?')
    expect(shown.at(-1)).toBe('bibliotheque.documents?principale%3A')
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
  it('regrouper par origine (d’origine), famille, type de pièce, mois d’ajout, ou aucun ; une section par groupe', async () => {
    const platform = memoryPlatform()
    const { page } = await start(platform)
    await pourIntoLibrary([{ name: 'Devis 2026.xlsx', bytes: enc('x') }, { name: 'CCTP lot 2.pdf', bytes: enc('y') }], { module: 'bibliotheque', label: 'Versé à la main' })
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: enc('z') }], { module: 'exigences', label: 'Import d’exigences (Plan.pdf)' })
    const sections = (view: PageView) => view.blocks.flatMap((block) => (block.kind === 'section' ? [`${block.title} (${block.subtitle})`] : []))
    let view = await page('bibliotheque.documents').load()
    expect(view.layouts).toEqual(['cards', 'list', 'table'])
    expect(view.grouping).toMatchObject({ label: 'Regrouper par', current: 'origine' })
    expect(view.grouping!.options.map((option) => option.label)).toEqual(['Origine', 'Famille', 'Type de pièce', 'Langue', 'Mois d’ajout', 'Répertoire', 'Aucun'])
    expect(sections(view)).toEqual(['Bibliothèque de documents — Versé à la main (2 document(s))', 'Exigences — Import d’exigences (Plan.pdf) (1 document(s))'])
    const regroup = async (id: string) => {
      await view.grouping!.options.find((option) => option.id === id)!.run()
      view = await page('bibliotheque.documents').load()
    }
    await regroup('famille')
    expect(sections(view)).toEqual(['PDF (2 document(s))', 'Tableurs (1 document(s))'])
    await regroup('categorie')
    // Les types de pièce (le module Typage des pièces) : « Devis », « Plan » n'en sont pas.
    expect(sections(view)).toEqual(['CCTP (1 document(s))', 'Sans type de pièce (2 document(s))'])
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
    expect(view.grouping!.options.map((option) => option.label)).toEqual(['Catégorie', 'Favoris', 'Répertoire', 'Aucun'])
    expect(view.blocks.flatMap((block) => (block.kind === 'section' ? [block.title] : []))).toEqual(['Analyse', 'Consultation', 'Contrat', 'Planning'])
    await view.grouping!.options.find((option) => option.id === 'favoris')!.run()
    view = await page('bibliotheque.prompts').load()
    expect(view.blocks.flatMap((block) => (block.kind === 'section' ? [`${block.title} (${block.subtitle})`] : []))).toEqual(['Les autres (7 prompt(s))'])
    await view.grouping!.options.find((option) => option.id === 'categorie')!.run()
  })
})

describe('les bibliothèques en explorateur de fichiers (le réglage d’origine)', () => {
  const nodeOf = (nodes: readonly ExplorerNode[], label: string): ExplorerNode | undefined => {
    for (const node of nodes) {
      if (node.label === label) return node
      const inside = nodeOf(node.children ?? [], label)
      if (inside) return inside
    }
    return undefined
  }
  const currents = (nodes: readonly ExplorerNode[]): string[] => nodes.flatMap((node) => [...(node.current ? [node.label] : []), ...currents(node.children ?? [])])

  it('une colonne à gauche : l’accueil, les groupes, leurs bibliothèques et leurs répertoires, combien chacun contient ; le lieu montré marqué', async () => {
    const platform = memoryPlatform()
    const { page, shown, settings } = await start(platform)
    settings.bibliotheque = {}
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    await pourIntoLibrary([{ name: 'Devis 2026.xlsx', bytes: enc('x') }, { name: 'CCTP lot 2.pdf', bytes: enc('y') }], { module: 'bibliotheque', label: 'Versé à la main' })
    const view = await page('bibliotheque.documents').load()
    const explorer = view.explorer!
    expect(explorer.label).toBe('Les bibliothèques')
    expect(explorer.nodes.map((node) => node.label)).toEqual(['Bibliothèque', 'Bibliothèques de documents', 'Bibliothèques système IA', 'Bibliothèques système', 'Annuaire'])
    expect(nodeOf(explorer.nodes, 'Bibliothèques de documents')!.children!.map((node) => `${node.label} (${node.count})`)).toEqual(['Documents (2)', 'Documents de référence (0)', 'Documents projet (0)', 'Circuit (0)'])
    expect(nodeOf(explorer.nodes, 'Bibliothèques système IA')!.children!.map((node) => node.label)).toEqual(['Prompts', 'Personas', 'Skills'])
    // Bibliothèques système : les étiquettes, le glossaire, et un accès rapide aux types de document (leur page).
    expect(nodeOf(explorer.nodes, 'Bibliothèques système')!.children!.map((node) => node.label)).toEqual(['Étiquettes', 'Glossaire', 'Types de document'])
    const types = nodeOf(explorer.nodes, 'Types de document')!
    expect(types).toMatchObject({ icon: 'file', count: expect.stringMatching(/^\d+$/) })
    await types.open!.run()
    expect(shown.at(-1)).toBe('core.fonctions?typage-pieces')
    expect(nodeOf(explorer.nodes, 'Documents')!.children!.map((node) => [node.label, node.icon, node.count])).toEqual([['Normes', 'folder', '0']])
    expect(nodeOf(explorer.nodes, 'Circuit')!.children!.map((node) => node.label)).toEqual(['À classer', 'À contrôler'])
    expect(currents(explorer.nodes)).toEqual(['Documents'])
    // Les documents en liste d'abord, sans regroupement ni chiffres (l'arborescence les dit).
    expect(view.layouts).toEqual(['list', 'cards', 'table'])
    expect(view.grouping).toBeDefined()
    expect(view.blocks.some((block) => block.kind === 'stats')).toBe(false)
    // En tête : « Verser » visible ; les actions du lieu (nouveau répertoire, exporter…) dans le menu « … ».
    expect(view.actions!.filter((action) => !action.more).map((action) => action.id)).toEqual(['pour'])
    expect(view.actions!.filter((action) => action.more).map((action) => action.id)).toEqual(expect.arrayContaining(['new-directory', 'new-shelf', 'export-shelf', 'import-shelf']))
    // Un clic sur un répertoire : sa page, lui marqué.
    await nodeOf(explorer.nodes, 'Normes')!.open!.run()
    const normes = await page('bibliotheque.documents').load(shown.at(-1)!.split('?')[1])
    expect(currents(normes.explorer!.nodes)).toEqual(['Normes'])
    // Vide : un message, sans bouton (« Verser des documents » est en tête de page).
    const emptyNote = normes.blocks.find((block) => block.kind === 'message')
    expect(emptyNote).toMatchObject({ kind: 'message', tone: 'info' })
    expect(emptyNote).not.toHaveProperty('actions')
    expect(normes.actions!.find((action) => action.id === 'pour')).toBeDefined()
    // Ailleurs dans la bibliothèque : la fiche d'un document (son lieu), l'accueil, les prompts.
    const doc = cardsOf(view).find((card) => card.title === 'Devis 2026')!
    // Une ligne allégée : une ligne de détails (type de pièce ou famille, ajouté le, taille), pas de boutons,
    // une pastille seulement s'il y a quelque chose à confirmer ; le nom du fichier et l'origine, pour la recherche.
    expect(doc.line).toMatch(/^.+ · \d{4}-\d{2}-\d{2} · 1 o$/)
    expect(doc.actions).toEqual([])
    expect(doc.text).toBe('')
    expect((doc.badges ?? []).every((badge) => badge.tone === 'warning' || badge.tone === 'danger')).toBe(true)
    expect(doc.search).toContain('Devis 2026.xlsx')
    expect(doc.search).toContain('Versé à la main')
    expect(doc.facts!.map((fact) => fact.label)).toEqual(['Type de pièce', 'Ajouté le', 'Taille'])
    await doc.open!.run()
    const fiche = await page('bibliotheque.document').load(shown.at(-1)!.split('?')[1])
    expect(currents(fiche.explorer!.nodes)).toEqual(['Documents'])
    // La fiche : ouvrir, modifier, déplacer, visibles ; le reste dans « … ».
    expect(fiche.actions!.filter((action) => !action.more).map((action) => action.id)).toEqual(['file', 'classify', 'move'])
    expect(fiche.actions!.filter((action) => action.more).map((action) => action.id)).toEqual(['language', 'version', 'link-document', 'to-references', 'note', 'aside', 'delete'])
    expect(currents((await page('bibliotheque.accueil').load()).explorer!.nodes)).toEqual(['Bibliothèque'])
    expect(currents((await page('bibliotheque.prompts').load()).explorer!.nodes)).toEqual(['Prompts'])
    // Le réglage coupé : l'affichage en cartes, comme avant.
    settings.bibliotheque = { explorateur: false }
    const cards = await page('bibliotheque.documents').load()
    expect(cards.explorer).toBeUndefined()
    expect(cards.layouts).toEqual(['cards', 'list', 'table'])
  })
})
