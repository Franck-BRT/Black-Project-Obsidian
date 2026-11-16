// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Supprimer un répertoire** d'une bibliothèque : vide, à la corbeille ; avec des documents,
 * au choix ils remontent d'un cran ou sont retirés (mis de côté, rien n'est effacé). Et, sur la
 * page d'un projet, **supprimer une affaire** et **un répertoire attendu** (qui n'est plus recréé).
 * Et **supprimer un document** (sa fiche et son fichier à la corbeille), **un prompt, un persona**.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { addStarterEntries, bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { programmesModule } from '../src/modules/programmes'

const MODULES = [lectureFichiersModule, bibliothequeModule, programmesModule]
const bytes = (text: string) => new TextEncoder().encode(text)

async function vault(platform: MemoryPlatform, initial: Record<string, Record<string, unknown>> = {}) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ...initial }
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
      showPage: (id) => void shown.push(id)
    }
    await module.activate(context)
  }
  const load = (target: string): Promise<PageView> => {
    const [id, param] = target.split('?') as [string, string | undefined]
    return views.pages().find((each) => each.id === id)!.load(param)
  }
  const run = async (view: PageView, id: string) => {
    const found = view.actions?.find((action) => action.id === id) ?? view.blocks.flatMap((block) => (block.kind === 'message' ? (block.actions ?? []) : [])).find((action) => action.id === id)
    expect(found, id).toBeDefined()
    await found!.run()
  }
  return { load, run, shown, settings }
}

const deep = (blocks: readonly HomeBlock[]): HomeBlock[] => blocks.flatMap((block) => (block.kind === 'section' ? [block, ...deep(block.blocks)] : [block]))
const cards = (view: PageView): Card[] => deep(view.blocks).flatMap((block) => (block.kind === 'cards' ? block.cards : []))
const directoryCard = (view: PageView, folder: string) => cards(view).find((card) => card.id === `dir:${folder}`)
const files = (platform: MemoryPlatform, prefix: string) => [...platform.files.keys()].filter((path) => path.startsWith(prefix)).sort()

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('supprimer un répertoire de la bibliothèque', () => {
  it('vide : après confirmation, à la corbeille ; renoncé, il reste', async () => {
    const platform = memoryPlatform()
    const { load } = await vault(platform)
    await platform.fs.ensureFolder('Bibliothèque/Brouillons')
    const remove = directoryCard(await load('bibliotheque.documents'), 'Bibliothèque/Brouillons')!.actions!.find((action) => action.id === 'remove-directory')!
    platform.confirmations.push(false)
    await remove.run()
    expect(platform.confirmed.at(-1)).toMatchObject({ title: 'Supprimer le répertoire « Brouillons » ?', danger: true })
    expect(await platform.fs.exists('Bibliothèque/Brouillons')).toBe(true)
    platform.confirmations.push(true)
    await remove.run()
    expect(await platform.fs.exists('Bibliothèque/Brouillons')).toBe(false)
    expect(platform.notices.at(-1)).toBe('Répertoire « Brouillons » supprimé (à la corbeille du coffre).')
  })

  it('avec des documents : ils remontent d’un cran (ceux des sous-répertoires aussi), avec les autres fichiers ; le répertoire part', async () => {
    const platform = memoryPlatform()
    const { load, run, shown } = await vault(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes/ECSS')
    await pourIntoLibrary([{ name: 'ECSS-E-10.pdf', bytes: bytes('ecss') }], { module: 'bibliotheque', label: '' }, { folder: 'Bibliothèque/Normes' })
    await pourIntoLibrary([{ name: 'ECSS-Q-80.pdf', bytes: bytes('q80') }], { module: 'bibliotheque', label: '' }, { folder: 'Bibliothèque/Normes/ECSS' })
    platform.files.set('Bibliothèque/Normes/Mes notes.md', bytes('# À moi'))
    // Depuis la page du répertoire lui-même.
    const page = await load(`bibliotheque.documents?${encodeURIComponent('principale:Normes')}`)
    expect(page.actions?.map((action) => action.id)).toContain('remove-directory')
    platform.choices.push('keep')
    await run(page, 'remove-directory')
    expect(platform.offered.at(-1)!.map((option) => option.label)).toEqual(['Les remonter dans Documents', 'Retirer aussi ses documents'])
    expect(platform.notices.at(-1)).toBe('Répertoire « Normes » supprimé ; ses 2 documents remontés dans Documents.')
    expect(await platform.fs.exists('Bibliothèque/Normes')).toBe(false)
    expect(files(platform, 'Bibliothèque/').filter((path) => path.endsWith('.md') && !path.startsWith('Bibliothèque/Skills/'))).toEqual(['Bibliothèque/ECSS-E-10.md', 'Bibliothèque/ECSS-Q-80.md', 'Bibliothèque/Mes notes.md'])
    // Leurs fichiers n'ont pas bougé.
    expect(files(platform, 'Bibliothèque/_fichiers/')).toEqual(['Bibliothèque/_fichiers/ECSS-E-10.pdf', 'Bibliothèque/_fichiers/ECSS-Q-80.pdf'])
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${encodeURIComponent('principale:')}`)
  })

  it('avec des documents : retirés (mis de côté, rien n’est effacé) ; renoncé, rien ne change', async () => {
    const platform = memoryPlatform()
    const { load } = await vault(platform)
    await platform.fs.ensureFolder('Bibliothèque/Vieux')
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: bytes('plan') }], { module: 'bibliotheque', label: '' }, { folder: 'Bibliothèque/Vieux' })
    const remove = () => directoryCard(cardsPage, 'Bibliothèque/Vieux')!.actions!.find((action) => action.id === 'remove-directory')!.run()
    let cardsPage = await load('bibliotheque.documents')
    platform.choices.push(null as unknown as string)
    await remove()
    expect(await platform.fs.exists('Bibliothèque/Vieux/Plan.md')).toBe(true)
    cardsPage = await load('bibliotheque.documents')
    platform.choices.push('aside')
    await remove()
    expect(await platform.fs.exists('Bibliothèque/Vieux')).toBe(false)
    expect(files(platform, 'Bibliothèque/_retirés/')).toEqual(['Bibliothèque/_retirés/Plan.md', 'Bibliothèque/_retirés/Plan.pdf'])
    expect(platform.notices.at(-1)).toBe('Répertoire « Vieux » supprimé ; ses 1 documents retirés (dans les retirés de la bibliothèque).')
  })

  it('sans corbeille : pas de bouton', async () => {
    const platform = memoryPlatform()
    delete (platform.fs as { trash?: unknown }).trash
    const { load } = await vault(platform)
    await platform.fs.ensureFolder('Bibliothèque/Brouillons')
    expect(directoryCard(await load('bibliotheque.documents'), 'Bibliothèque/Brouillons')!.actions!.map((action) => action.id)).toEqual(['see'])
  })
})

describe('sur la page d’un projet : supprimer une affaire, un répertoire attendu', () => {
  async function project(platform: MemoryPlatform) {
    const types = [{ id: 'etude', name: 'Étude', icon: 'flow', color: 'teal', stages: [[{ id: 'lancement', name: 'Lancement', kind: 'libre', icon: 'play', color: 'teal' }]], folders: [{ id: 'offre', name: 'Offre', children: [{ id: 'technique', name: 'Technique', expects: ['CCTP'] }] }, { id: 'admin', name: 'Administratif' }] }]
    const harness = await vault(platform, { programmes: { typesProjet: types } })
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await harness.run(await harness.load('programmes'), 'new')
    platform.forms.push({ name: 'Q', programme: 'Programmes/P/P.md', type: 'etude', description: '', affaire: 'true', client: 'CNES', reference: '' })
    await harness.run(await harness.load(harness.shown.at(-1)!), 'project')
    return { ...harness, page: harness.shown.at(-1)! }
  }
  const expected = (view: PageView) => deep(view.blocks).find((block): block is Extract<HomeBlock, { kind: 'list' }> => block.kind === 'list' && block.title === 'Répertoires attendus')

  it('une affaire : après confirmation, sa note à la corbeille ; le projet reste', async () => {
    const platform = memoryPlatform()
    const { load, page } = await project(platform)
    const affaire = cards(await load(page)).find((card) => card.title === 'Q')!
    expect(affaire.actions!.map((action) => action.id)).toEqual(['status', 'delete'])
    platform.confirmations.push(true)
    await affaire.actions!.find((action) => action.id === 'delete')!.run()
    expect(platform.confirmed.at(-1)).toMatchObject({ title: 'Supprimer l’affaire « Q » ?', danger: true })
    expect(await platform.fs.exists('Programmes/P/Q/Affaires/Q.md')).toBe(false)
    expect(await platform.fs.exists('Programmes/P/Q/Q.md')).toBe(true)
    expect(platform.notices.at(-1)).toBe('Affaire « Q » supprimée (à la corbeille du coffre).')
    expect(cards(await load(page)).some((card) => card.title === 'Q' && card.actions?.some((action) => action.id === 'status'))).toBe(false)
  })

  it('un répertoire attendu : supprimé de la bibliothèque (ses sous-répertoires aussi), le projet ne l’attend plus — il n’est pas recréé', async () => {
    const platform = memoryPlatform()
    const { load, page } = await project(platform)
    const before = expected(await load(page))!
    expect(before.items.map((item) => item.title)).toEqual(['Offre', 'Offre › Technique', 'Administratif'])
    expect(await platform.fs.exists('Bibliothèque/Projets/P/Q/Offre/Technique')).toBe(true)
    platform.confirmations.push(true)
    await before.items[0]!.tools!.find((tool) => tool.id === 'remove-folder')!.run()
    expect(await platform.fs.exists('Bibliothèque/Projets/P/Q/Offre')).toBe(false)
    const after = expected(await load(page))!
    expect(after.items.map((item) => item.title)).toEqual(['Administratif'])
    // Rechargée : toujours pas recréé.
    expect(await platform.fs.exists('Bibliothèque/Projets/P/Q/Offre')).toBe(false)
    expect(new TextDecoder().decode(platform.files.get('Programmes/P/Q/Q.md'))).not.toContain('Offre')
  })
})

describe('supprimer un document de la bibliothèque', () => {
  it('depuis sa fiche : après confirmation, sa fiche et son fichier à la corbeille ; qui le donnait pour version précédente perd ce lien ; renoncé, rien ne part', async () => {
    const platform = memoryPlatform()
    const { load, run, shown } = await vault(platform)
    const [plan] = (await pourIntoLibrary([{ name: 'Plan.pdf', bytes: bytes('plan v1') }], { module: 'ao', label: 'Station sol' }))!.added
    const [suite] = (await pourIntoLibrary([{ name: 'Plan v2.pdf', bytes: bytes('plan v2') }], { module: 'bibliotheque', label: '' }))!.added
    platform.files.set(suite!.record, bytes(new TextDecoder().decode(platform.files.get(suite!.record)).replace('\n---\n', `\nprecedent: "[[${plan!.record}]]"\n---\n`)))
    const fiche = await load(`bibliotheque.document?${encodeURIComponent(plan!.record)}`)
    expect(fiche.actions?.map((action) => action.id).slice(-2)).toEqual(['aside', 'delete'])
    platform.confirmations.push(false)
    await run(fiche, 'delete')
    expect(platform.confirmed.at(-1)).toMatchObject({ title: 'Supprimer « Plan » ?', danger: true })
    // Il sert à une analyse : la question le dit.
    expect(platform.confirmed.at(-1)!.message).toContain('Station sol')
    expect(await platform.fs.exists(plan!.record)).toBe(true)
    platform.confirmations.push(true)
    await run(await load(`bibliotheque.document?${encodeURIComponent(plan!.record)}`), 'delete')
    expect(await platform.fs.exists(plan!.record)).toBe(false)
    expect(await platform.fs.exists(plan!.file)).toBe(false)
    expect(platform.notices.at(-1)).toBe('« Plan » supprimé (à la corbeille du coffre).')
    expect(shown.at(-1)).toMatch(/^bibliotheque\.documents/)
    expect(new TextDecoder().decode(platform.files.get(suite!.record))).not.toContain('precedent:')
    expect(await platform.fs.exists(suite!.file)).toBe(true)
  })

  it('depuis sa carte, dans la liste des documents', async () => {
    const platform = memoryPlatform()
    const { load } = await vault(platform)
    const [doc] = (await pourIntoLibrary([{ name: 'Note.pdf', bytes: bytes('note') }], { module: 'bibliotheque', label: '' }))!.added
    const card = cards(await load('bibliotheque.documents')).find((each) => each.id === doc!.record)!
    expect(card.actions!.map((action) => action.id)).toEqual(['file', 'delete'])
    platform.confirmations.push(true)
    await card.actions!.find((action) => action.id === 'delete')!.run()
    expect(await platform.fs.exists(doc!.record)).toBe(false)
    expect(cards(await load('bibliotheque.documents')).some((each) => each.id === doc!.record)).toBe(false)
  })

  it('sans corbeille : seulement « Retirer »', async () => {
    const platform = memoryPlatform()
    delete (platform.fs as { trash?: unknown }).trash
    const { load } = await vault(platform)
    const [doc] = (await pourIntoLibrary([{ name: 'Note.pdf', bytes: bytes('note') }], { module: 'bibliotheque', label: '' }))!.added
    expect((await load(`bibliotheque.document?${encodeURIComponent(doc!.record)}`)).actions?.map((action) => action.id)).not.toContain('delete')
  })
})

describe('supprimer un prompt, un persona', () => {
  for (const [kind, page] of [['prompt', 'bibliotheque.prompts'], ['persona', 'bibliotheque.personas'], ['skill', 'bibliotheque.skills']] as const) {
    it(`un ${kind} : depuis sa page, après confirmation, sa note à la corbeille ; depuis sa carte aussi ; renoncé, il reste`, async () => {
      const platform = memoryPlatform()
      const { load, run, shown } = await vault(platform)
      await addStarterEntries(kind, 'fr')
      const [first, second] = cards(await load(page))
      await first!.open!.run()
      const one = await load(shown.at(-1)!)
      expect(one.actions?.map((action) => action.id).slice(-2)).toEqual(['aside', 'delete'])
      platform.confirmations.push(false)
      await run(one, 'delete')
      expect(platform.confirmed.at(-1)).toMatchObject({ title: `Supprimer « ${first!.title} » ?`, danger: true })
      expect(await platform.fs.exists(first!.id)).toBe(true)
      platform.confirmations.push(true)
      await run(one, 'delete')
      expect(await platform.fs.exists(first!.id)).toBe(false)
      expect(platform.notices.at(-1)).toBe(`« ${first!.title} » supprimé (à la corbeille du coffre).`)
      expect(shown.at(-1)!.split('?')[0]).toBe(page)
      // Depuis sa carte.
      const card = cards(await load(page)).find((each) => each.title === second!.title)!
      expect(card.actions!.map((action) => action.id)).toEqual(['favorite', 'delete'])
      platform.confirmations.push(true)
      await card.actions!.find((action) => action.id === 'delete')!.run()
      expect(cards(await load(page)).map((each) => each.title)).not.toContain(second!.title)
    })
  }
})
