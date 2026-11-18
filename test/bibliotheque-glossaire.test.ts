// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Le glossaire** : une bibliothèque de termes (un terme, son sigle, sa définition), reliée aux
 * fiches des documents — la fiche d'un document montre les termes qu'il emploie ; la page d'un
 * terme, les documents qui l'emploient ; le circuit peut les relier (un candidat de lien).
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { addStarterEntries, bibliothequeModule, libraryEntries, linkCandidatesFor, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule } from '../src/modules/workflows'

const MODULES: BlackModule[] = [lectureFichiersModule, bibliothequeModule, workflowsModule]
const enc = (text: string) => new TextEncoder().encode(text)

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { workflows: { essentielsSeulement: false }, bibliotheque: { circuit: false } }
  const views = new ViewsRegistry()
  const shown: string[] = []
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: (id: string) => void shown.push(id)
    }
    await module.activate(context)
  }
  const load = (target: string): Promise<PageView> => {
    const [id, param] = target.split('?') as [string, string | undefined]
    return views.pages().find((each) => each.id === id)!.load(param)
  }
  return { load, shown }
}

const sections = (blocks: readonly HomeBlock[]): Extract<HomeBlock, { kind: 'section' }>[] =>
  blocks.flatMap((block) => (block.kind === 'section' ? [block, ...sections(block.blocks)] : []))
const cardsIn = (blocks: readonly HomeBlock[]): Card[] => blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : block.kind === 'section' ? cardsIn(block.blocks) : []))

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('le glossaire', () => {
  it('une bibliothèque de termes : ses exemples (sigle, définition), sa carte sur l’accueil, sa page', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    const added = await addStarterEntries('glossary', 'fr')
    expect(added).toContain('Cahier des clauses techniques particulières')
    const terms = await libraryEntries('glossary')
    const cctp = terms.find((term) => term.code === 'CCTP')!
    expect(cctp).toMatchObject({ name: 'Cahier des clauses techniques particulières', category: 'Marchés' })
    expect(cctp.path).toMatch(/^Bibliothèque\/Glossaire\//)
    expect(new TextDecoder().decode(platform.files.get(cctp.path))).toMatch(/\nbp-type: bibliotheque-glossaire\n/)
    // L'accueil : sa carte, dans les bibliothèques système.
    const hub = await load('bibliotheque.accueil')
    expect(cardsIn(hub.blocks).find((card) => card.title === 'Glossaire')).toMatchObject({ subtitle: `${terms.length} terme(s)`, icon: 'bulb' })
    // Sa page : un terme par carte, son sigle devant son nom.
    const page = await load('bibliotheque.glossaire')
    expect(cardsIn(page.blocks).map((card) => card.title)).toContain('CCTP — Cahier des clauses techniques particulières')
  })

  it('les liens : la fiche d’un document montre les termes qu’il emploie ; la page d’un terme, les documents qui l’emploient', async () => {
    const platform = memoryPlatform()
    const { load, shown } = await start(platform)
    await addStarterEntries('glossary', 'fr')
    const report = await pourIntoLibrary([{ name: 'Note station.txt', bytes: enc('Le CCTP de la station sol prévoit une recette en usine.') }], { module: 'bibliotheque', label: 'Versé à la main' })
    const record = report!.added[0]!.record
    // La fiche : la section « Glossaire », chaque terme avec sa définition ; un clic ouvre le terme.
    const fiche = await load(`bibliotheque.document?${encodeURIComponent(record)}`)
    const glossary = sections(fiche.blocks).find((section) => section.id === 'bibliotheque.document.glossaire')!
    expect(glossary).toMatchObject({ title: 'Glossaire (2)' })
    const items = glossary.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    expect(items.map((item) => item.title)).toEqual(['CCTP — Cahier des clauses techniques particulières', 'Recette'])
    expect(items[0]!.detail).toMatch(/^Pièce du marché qui décrit le besoin technique/)
    await items[0]!.open!.run()
    expect(shown.at(-1)).toMatch(/^bibliotheque\.terme\?/)
    // La page du terme : les documents qui l'emploient ; un clic ouvre leur fiche.
    const term = await load(shown.at(-1)!)
    const usedSection = sections(term.blocks).find((section) => section.id === 'bibliotheque.terme.documents')!
    expect(usedSection).toMatchObject({ title: 'Documents qui l’emploient (1)', subtitle: '1 cité(s) sans lien' })
    const used = usedSection.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    expect(used.map((item) => [item.title, item.detail])).toEqual([['Note station', 'Documents · Cité (« CCTP »), pas encore relié']])
    await used[0]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent(record)}`)
    // Un terme qu'aucun document n'emploie : dit.
    const bpu = (await libraryEntries('glossary')).find((each) => each.code === 'BPU')!
    const none = await load(`bibliotheque.terme?${encodeURIComponent(bpu.path)}`)
    expect(sections(none.blocks).find((section) => section.id === 'bibliotheque.terme.documents')!.blocks.find((block) => block.kind === 'list')).toMatchObject({ items: [], empty: 'Aucun document de la bibliothèque n’emploie ce terme (ni son sigle, ni une autre forme) pour l’instant.' })
    // Le circuit : un terme cité est un lien possible (l'IA peut l'y relier, avec un rétrolien).
    expect((await linkCandidatesFor(record)).filter((candidate) => candidate.kind === 'Terme du glossaire').map((candidate) => candidate.found)).toEqual(['CCTP', 'Recette'])
  })

  it('les autres formes d’un terme : cherchées comme lui ; dites sur sa page et sa carte', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    await addStarterEntries('glossary', 'fr')
    const exigence = (await libraryEntries('glossary')).find((term) => term.name === 'Exigence')!
    expect(exigence.aliases).toEqual(['exigences'])
    expect(new TextDecoder().decode(platform.files.get(exigence.path))).toMatch(/\nautresFormes:\n- exigences\n/)
    // Un document qui écrit « exigences » : le terme « Exigence » est sur sa fiche.
    const report = await pourIntoLibrary([{ name: 'Revue.txt', bytes: enc('La revue des exigences a eu lieu.') }], { module: 'bibliotheque', label: 'Versé à la main' })
    const fiche = await load(`bibliotheque.document?${encodeURIComponent(report!.added[0]!.record)}`)
    const glossary = sections(fiche.blocks).find((section) => section.id === 'bibliotheque.document.glossaire')!
    expect(glossary.blocks.flatMap((block) => (block.kind === 'list' ? block.items : [])).map((item) => item.title)).toEqual(['Exigence'])
    // Sa page et sa carte disent ses autres formes.
    const term = await load(`bibliotheque.terme?${encodeURIComponent(exigence.path)}`)
    const fields = sections(term.blocks).find((section) => section.id === 'bibliotheque.terme.terme')!.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    expect(fields.find((item) => item.title === 'Autres formes')!.detail).toBe('exigences')
    expect(cardsIn((await load('bibliotheque.glossaire')).blocks).find((card) => card.title === 'Exigence')!.text).toBe('Autres formes : exigences')
  })

  it('« Nouveau terme » : ses autres formes, une par ligne (sans doublon, ni son nom ni son sigle)', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    const page = await load('bibliotheque.glossaire')
    platform.forms.push({ name: 'Plan de management', code: 'PMP', category: 'Projet', description: 'Le plan qui dit comment le projet est conduit.', text: '', aliases: 'plans de management\nPMP\nplan de management du projet\nplans de management', favorite: 'false' })
    await page.actions!.find((action) => action.id === 'new')!.run()
    const created = (await libraryEntries('glossary')).find((term) => term.code === 'PMP')!
    expect(created.aliases).toEqual(['plans de management', 'plan de management du projet'])
  })

  it('la fiche d’un terme : sa définition en tête ; le terme ; les documents reliés ou seulement cités (« Relier ») ; son domaine ; ses notes sans les rétroliens', async () => {
    const platform = memoryPlatform()
    const { load, shown } = await start(platform)
    await addStarterEntries('glossary', 'fr')
    const cctp = (await libraryEntries('glossary')).find((term) => term.code === 'CCTP')!
    const first = (await pourIntoLibrary([{ name: 'Note station.txt', bytes: enc('Le CCTP de la station sol.') }], { module: 'bibliotheque', label: 'Versé à la main' }))!.added[0]!.record
    const second = (await pourIntoLibrary([{ name: 'Revue.txt', bytes: enc('Revue du CCTP.') }], { module: 'bibliotheque', label: 'Versé à la main' }))!.added[0]!.record
    const page = async () => load(`bibliotheque.terme?${encodeURIComponent(cctp.path)}`)
    let term = await page()
    expect(term).toMatchObject({ title: 'CCTP — Cahier des clauses techniques particulières', subtitle: 'Terme du glossaire · Marchés' })
    // Sa définition, en tête.
    expect(term.blocks[0]).toMatchObject({ kind: 'text', title: 'Définition', paragraphs: [cctp.description] })
    // Le terme : son nom, son sigle, son domaine, ses autres formes, où il est rangé.
    const ids = sections(term.blocks).map((section) => section.id)
    expect(ids).toEqual(['bibliotheque.terme.terme', 'bibliotheque.terme.documents', 'bibliotheque.terme.domaine', 'bibliotheque.terme.notes'])
    const fields = sections(term.blocks)[0]!.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    expect(fields.map((item) => [item.title, item.detail])).toEqual([
      ['Terme', 'Cahier des clauses techniques particulières'],
      ['Sigle ou abréviation', 'CCTP'],
      ['Domaine', 'Marchés'],
      ['Autres formes', 'Aucune (un pluriel, une variante : « Modifier » les ajoute)'],
      ['Rangé', 'Glossaire']
    ])
    expect(fields.find((item) => item.title === 'Rangé')!.tools![0]).toMatchObject({ id: 'move' })
    // Les documents : deux qui le citent sans y être reliés — « Tout relier (2) ».
    let documents = sections(term.blocks).find((section) => section.id === 'bibliotheque.terme.documents')!
    expect(documents.blocks[0]).toMatchObject({ kind: 'message', text: '2 document(s) le citent sans y être reliés.', actions: [{ id: 'relier-tous', label: 'Tout relier (2)' }] })
    // « Relier » le premier : il passe en tête, relié ; un rétrolien dans la note du terme.
    const rows = documents.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    await rows.find((item) => item.title === 'Note station')!.actions![0]!.run()
    expect(new TextDecoder().decode(platform.files.get(cctp.path))).toContain('[[Bibliothèque/Note station|Note station]]')
    term = await page()
    documents = sections(term.blocks).find((section) => section.id === 'bibliotheque.terme.documents')!
    expect(documents.subtitle).toBe('1 relié(s) · 1 cité(s) sans lien')
    expect(documents.blocks.flatMap((block) => (block.kind === 'list' ? block.items : [])).map((item) => [item.title, item.tone, item.detail])).toEqual([
      ['Note station', 'success', 'Documents · Relié (lien et rétrolien)'],
      ['Revue', 'neutral', 'Documents · Cité (« CCTP »), pas encore relié']
    ])
    expect(second).toBeTruthy()
    // Son domaine : les autres termes « Marchés » ; un clic ouvre le terme.
    const domain = sections(term.blocks).find((section) => section.id === 'bibliotheque.terme.domaine')!
    expect(domain.title).toMatch(/^Dans le même domaine : Marchés \(\d+\)$/)
    const neighbour = domain.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))[0]!
    await neighbour.open!.run()
    expect(shown.at(-1)).toMatch(/^bibliotheque\.terme\?/)
    // Ses notes : sans la section des rétroliens (montrée au-dessus).
    const notes = sections(term.blocks).find((section) => section.id === 'bibliotheque.terme.notes')!
    expect(JSON.stringify(notes)).not.toContain('Liens (Black Projects)')
    expect(first).toBeTruthy()
  })

  it('l’index : une seconde visite ne relit pas le texte des documents ; un document changé : lui seul relu, et pris en compte', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    await addStarterEntries('glossary', 'fr')
    const records: string[] = []
    for (const [name, text] of [['Note station.txt', 'Le CCTP de la station sol.'], ['Revue.txt', 'Revue du CCTP.'], ['Divers.txt', 'Rien de particulier.']] as const) {
      records.push((await pourIntoLibrary([{ name, bytes: enc(text) }], { module: 'bibliotheque', label: '' }))!.added[0]!.record)
    }
    const cctp = (await libraryEntries('glossary')).find((term) => term.code === 'CCTP')!
    // Combien de fois le texte des documents est lu.
    let reads = 0
    const readText = platform.fs.readText.bind(platform.fs)
    platform.fs.readText = async (path: string) => {
      if (records.includes(path)) reads++
      return readText(path)
    }
    const used = async () => {
      const page = await load(`bibliotheque.terme?${encodeURIComponent(cctp.path)}`)
      return sections(page.blocks).find((section) => section.id === 'bibliotheque.terme.documents')!.blocks.flatMap((block) => (block.kind === 'list' ? block.items : [])).map((item) => item.title)
    }
    expect(await used()).toEqual(['Note station', 'Revue'])
    const first = reads
    reads = 0
    expect(await used()).toEqual(['Note station', 'Revue'])
    // La seconde fois : les fiches parcourues, mais aucun texte relu (une lecture par fiche, pas deux).
    expect(reads).toBe(first - records.length)
    const visit = reads
    // Un document changé (son titre cite le terme) : lui seul relu, et pris en compte.
    const divers = records[2]!
    await platform.fs.writeText(divers, (await readText(divers)).replace(/\ntitre: Divers\n/, '\ntitre: Divers CCTP\n'))
    // (Ce que le module fait de lui-même quand une fiche change : laissé passer avant de compter.)
    await new Promise((resolve) => setTimeout(resolve, 20))
    reads = 0
    expect(await used()).toEqual(['Divers CCTP', 'Note station', 'Revue'])
    expect(reads).toBe(visit + 1)
  })
})
