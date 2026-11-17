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
    const used = term.blocks.find((block): block is Extract<HomeBlock, { kind: 'list' }> => block.kind === 'list' && (block.title ?? '').startsWith('Documents qui l’emploient'))!
    expect(used.title).toBe('Documents qui l’emploient (1)')
    expect(used.items.map((item) => item.title)).toEqual(['Note station'])
    await used.items[0]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent(record)}`)
    // Un terme qu'aucun document n'emploie : dit.
    const bpu = (await libraryEntries('glossary')).find((each) => each.code === 'BPU')!
    const none = await load(`bibliotheque.terme?${encodeURIComponent(bpu.path)}`)
    expect(none.blocks.find((block) => block.kind === 'list' && (block.title ?? '').startsWith('Documents qui'))).toMatchObject({ items: [], empty: 'Aucun document de la bibliothèque n’emploie ce terme (ni son sigle, ni une autre forme) pour l’instant.' })
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
    expect(term.subtitle).toContain('Autres formes : exigences')
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
})
