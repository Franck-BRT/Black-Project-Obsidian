// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Plusieurs bibliothèques, des répertoires et des sous-répertoires — documents, prompts,
 * personas : créer une bibliothèque (son dossier, par défaut ou non), y créer des
 * répertoires, les parcourir (fil d'Ariane, cartes des répertoires), y verser et y créer,
 * déplacer (les liens de versions suivent), regrouper par répertoire, retirer une
 * bibliothèque de la liste (rien n'est effacé) ; ce qui arrive sans lieu précis entre dans
 * la bibliothèque par défaut, à sa racine.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { bibliothequeModule, libraryEntries, pourIntoLibrary } from '../src/modules/bibliotheque'

/** La liste d'une section repliable de la fiche, par son intitulé. */
const sectionList = (blocks: readonly HomeBlock[], title: string | ((title: string) => boolean)): HomeBlock | undefined => {
  const section = blocks.find((block) => block.kind === 'section' && (typeof title === 'string' ? block.title === title : title(block.title)))
  return section?.kind === 'section' ? section.blocks.find((block) => block.kind === 'list') : undefined
}

const cardsIn = (blocks: readonly HomeBlock[]): Card[] => blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : block.kind === 'section' ? cardsIn(block.blocks) : []))
/** Les cartes des documents ou des entrées (pas celles des répertoires). */
const itemsOf = (view: PageView): Card[] => cardsIn(view.blocks).filter((card) => !card.id.startsWith('dir:'))
const directoriesOf = (view: PageView): string[] => cardsIn(view.blocks).filter((card) => card.id.startsWith('dir:')).map((card) => card.title)
const crumbsOf = (view: PageView): string[] => view.breadcrumb?.items.map((item) => item.label) ?? []
const action = (view: PageView, id: string) => view.actions!.find((each) => each.id === id)!
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  i18n.register('fr', bibliothequeModule.texts.fr)
  const settings: Record<string, unknown> = {}
  const views = new ViewsRegistry()
  const shown: string[] = []
  const context: ModuleContext = {
    moduleId: 'bibliotheque',
    platform,
    i18n,
    settings: {
      get: () => settings,
      save: async (values) => {
        for (const key of Object.keys(settings)) delete settings[key]
        Object.assign(settings, values)
      },
      onChange: () => () => {}
    },
    commands: { register: () => {} },
    views,
    showPage: (id: string) => void shown.push(id)
  }
  await (bibliothequeModule as BlackModule).activate(context)
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  /** La page où l'on a été mené en dernier (son identifiant, son paramètre). */
  const current = async (): Promise<PageView> => {
    const last = shown.at(-1)!
    const at = last.indexOf('?')
    return at < 0 ? page(last).load() : page(last.slice(0, at)).load(last.slice(at + 1))
  }
  return { settings, page, shown, current }
}

afterEach(async () => {
  await bibliothequeModule.deactivate?.()
})

describe('plusieurs bibliothèques, des répertoires', () => {
  it('une nouvelle bibliothèque de documents : son dossier, par défaut ; ce qui arrive sans lieu y entre, à sa racine', async () => {
    const platform = memoryPlatform()
    const { settings, page, shown, current } = await start(platform)
    let view = await page('bibliotheque.documents').load()
    expect(crumbsOf(view)).toEqual(['Bibliothèque', 'Documents'])
    expect(view.actions?.map((each) => each.id)).toEqual(['pour', 'new-directory', 'new-shelf', 'export-shelf', 'import-shelf'])
    // Nom, dossier proposé d'après le nom, par défaut.
    platform.forms.push({ name: 'Normes', folder: '', default: 'true' })
    await action(view, 'new-shelf').run()
    expect(platform.notices.at(-1)).toBe('Bibliothèque « Normes » créée, dans Bibliothèques/Documents/Normes.')
    expect(settings.bibliotheques).toEqual({ document: [{ id: 'normes', name: 'Normes', folder: 'Bibliothèques/Documents/Normes' }] })
    expect(settings.bibliothequesParDefaut).toEqual({ document: 'normes' })
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${encodeURIComponent('normes:')}`)
    view = await current()
    expect(view.title).toBe('Normes')
    expect(view.subtitle).toMatch(/Bibliothèques\/Documents\/Normes.* · la bibliothèque par défaut$/)
    // Un dépôt d'un autre module, sans lieu : dans la bibliothèque par défaut.
    const report = await pourIntoLibrary([{ name: 'ECSS-E-ST-10C.pdf', bytes: bytes('ecss') }], { module: 'ao', label: 'Station sol' })
    expect(report?.added[0]).toMatchObject({ record: 'Bibliothèques/Documents/Normes/ECSS-E-ST-10C.md', file: 'Bibliothèques/Documents/Normes/_fichiers/ECSS-E-ST-10C.pdf' })
    expect(itemsOf(await current()).map((card) => card.title)).toEqual(['ECSS-E-ST-10C'])
    // La principale ne la montre pas.
    expect(itemsOf(await page('bibliotheque.documents').load(encodeURIComponent('principale:')))).toEqual([])
    // Le même dossier, ou un dossier dedans : refusés.
    platform.forms.push({ name: 'Encore', folder: 'Bibliothèques/Documents/Normes/Sous', default: 'false' })
    await action(view, 'new-shelf').run()
    expect(platform.notices.at(-1)).toMatch(/^Le dossier « Bibliothèques\/Documents\/Normes\/Sous » est déjà celui d’une bibliothèque, ou il est dans/)
  })

  it('des répertoires et des sous-répertoires : le fil d’Ariane, une carte par répertoire, y verser, remonter', async () => {
    const platform = memoryPlatform()
    const { page, shown, current } = await start(platform)
    const root = await page('bibliotheque.documents').load()
    platform.forms.push({ name: 'Normes' })
    await action(root, 'new-directory').run()
    expect(platform.files.has('Bibliothèque/Normes') || (await platform.fs.exists('Bibliothèque/Normes'))).toBe(true)
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${encodeURIComponent('principale:Normes')}`)
    let view = await current()
    expect(crumbsOf(view)).toEqual(['Bibliothèque', 'Documents', 'Normes'])
    platform.forms.push({ name: 'ECSS' })
    await action(view, 'new-directory').run()
    view = await current()
    expect(crumbsOf(view)).toEqual(['Bibliothèque', 'Documents', 'Normes', 'ECSS'])
    // Verser ici : la fiche dans le répertoire, le fichier avec ceux de la bibliothèque.
    platform.choices.push('computer')
    platform.externalFiles.push([{ name: 'ECSS-Q-ST-80C.pdf', bytes: bytes('q80') }])
    await action(view, 'pour').run()
    expect(await platform.fs.exists('Bibliothèque/Normes/ECSS/ECSS-Q-ST-80C.md')).toBe(true)
    expect(await platform.fs.exists('Bibliothèque/_fichiers/ECSS-Q-ST-80C.pdf')).toBe(true)
    // La racine : la carte du répertoire (combien dessous), pas le document.
    const top = await page('bibliotheque.documents').load()
    expect(directoriesOf(top)).toEqual(['Normes'])
    expect(cardsIn(top.blocks).find((card) => card.title === 'Normes')?.subtitle).toBe('1 document(s)')
    expect(itemsOf(top)).toEqual([])
    // Remonter, et le fil d'Ariane mène où il dit.
    const ecss = await page('bibliotheque.documents').load(encodeURIComponent('principale:Normes/ECSS'))
    expect(itemsOf(ecss).map((card) => card.title)).toEqual(['ECSS-Q-ST-80C'])
    await ecss.back!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${encodeURIComponent('principale:Normes')}`)
    const crumbs = ecss.breadcrumb!
    await crumbs.items[1]!.run!()
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${encodeURIComponent('principale:')}`)
    expect(crumbs.items.at(-1)!.label).toBe('ECSS')
  })

  it('glisser-déposer : sur la page, versés là où l’on est ; sur la carte d’un répertoire, dans ce répertoire', async () => {
    const platform = memoryPlatform()
    const { page } = await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    const root = await page('bibliotheque.documents').load()
    expect(root.drop).toMatchObject({ label: 'Déposer pour verser dans « Documents »', hint: expect.stringMatching(/^Ou glissez-déposez des fichiers/) })
    await root.drop!.run([{ name: 'Plan.pdf', bytes: bytes('plan') }])
    expect(await platform.fs.exists('Bibliothèque/Plan.md')).toBe(true)
    expect(platform.notices.at(-1)).toMatch(/^1 document\(s\) versé\(s\) dans la bibliothèque, 0/)
    const card = cardsIn(root.blocks).find((each) => each.title === 'Normes')!
    expect(card.drop?.label).toBe('Déposer pour verser dans « Normes »')
    await card.drop!.run([{ name: 'ECSS.pdf', bytes: bytes('ecss') }, { name: 'Plan.pdf', bytes: bytes('plan') }])
    expect(await platform.fs.exists('Bibliothèque/Normes/ECSS.md')).toBe(true)
    // Déjà là (même empreinte) : pas une seconde fois — un fantôme, si on l'accepte (ici, oui).
    expect(read(platform, 'Bibliothèque/Normes/Plan.md')).toMatch(/^---\nbp-type: bibliotheque-fantome\n/)
    const inside = await page('bibliotheque.documents').load(encodeURIComponent('principale:Normes'))
    expect(inside.drop?.label).toBe('Déposer pour verser dans « Normes »')
    // Les prompts et les personas n'en prennent pas.
    expect((await page('bibliotheque.prompts').load()).drop).toBeUndefined()
  })

  it('regrouper par répertoire : tout ce qui est dessous, une section par répertoire', async () => {
    const platform = memoryPlatform()
    const { page } = await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes/ECSS')
    await pourIntoLibrary([{ name: 'Ici.pdf', bytes: bytes('a') }], { module: 'bibliotheque', label: '' })
    await pourIntoLibrary([{ name: 'Norme.pdf', bytes: bytes('b') }], { module: 'bibliotheque', label: '' }, { folder: 'Bibliothèque/Normes' })
    await pourIntoLibrary([{ name: 'Profonde.pdf', bytes: bytes('c') }], { module: 'bibliotheque', label: '' }, { folder: 'Bibliothèque/Normes/ECSS' })
    let view = await page('bibliotheque.documents').load()
    expect(itemsOf(view).map((card) => card.title)).toEqual(['Ici'])
    await view.grouping!.options.find((option) => option.id === 'repertoire')!.run()
    view = await page('bibliotheque.documents').load()
    expect(view.blocks.flatMap((block) => (block.kind === 'section' ? [block.title] : []))).toEqual(['Ici', 'Normes', 'Normes › ECSS'])
    expect(itemsOf(view)).toHaveLength(3)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent('Bibliothèque/Normes/ECSS/Profonde.md'))
    const identity = sectionList(fiche.blocks, 'Identification')
    expect(identity?.kind === 'list' && identity.items.find((item) => item.id === 'place')?.detail).toBe('Normes › ECSS')
    // Revenir au regroupement d'origine, pour les autres tests.
    await view.grouping!.options.find((option) => option.id === 'origine')!.run()
  })

  it('déplacer un document : sa fiche change de répertoire, son fichier reste, les liens de versions suivent', async () => {
    const platform = memoryPlatform()
    const { page, shown } = await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Archives')
    const first = (await pourIntoLibrary([{ name: 'CCTP v1.pdf', bytes: bytes('v1') }], { module: 'bibliotheque', label: '' }))!.added[0]!
    const second = (await pourIntoLibrary([{ name: 'CCTP v2.pdf', bytes: bytes('v2') }], { module: 'bibliotheque', label: '' }))!.added[0]!
    await (await page('bibliotheque.document').load(encodeURIComponent(second.record))).actions!.find((each) => each.id === 'move')
    // Relier v2 à v1, puis déplacer v1.
    platform.choices.push(first.record)
    await (await page('bibliotheque.document').load(encodeURIComponent(second.record))).actions!.find((each) => each.id === 'version')!.run()
    platform.choices.push('Bibliothèque/Archives')
    await (await page('bibliotheque.document').load(encodeURIComponent(first.record))).actions!.find((each) => each.id === 'move')!.run()
    // Les lieux offerts : la racine n'y est pas (il y est déjà) ; les documents de référence, si.
    expect(platform.offered.at(-1)!.map((each) => each.label)).toEqual(['Documents › Archives', 'Documents de référence', 'Documents projet'])
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Archives/CCTP v1.md')}`)
    expect(await platform.fs.exists(first.record)).toBe(false)
    expect(await platform.fs.exists(first.file)).toBe(true)
    const v2 = await page('bibliotheque.document').load(encodeURIComponent(second.record))
    const versions = sectionList(v2.blocks, 'Versions')
    expect(versions?.kind === 'list' && versions.items.map((item) => item.id)).toEqual([`avant-Bibliothèque/Archives/CCTP v1.md`])
  })

  it('prompts et personas : une autre bibliothèque, des répertoires, y créer, déplacer ; l’accueil montre chaque bibliothèque', async () => {
    const platform = memoryPlatform()
    const { settings, page, shown, current } = await start(platform)
    // Les prompts : on n'en crée plus d'autre bibliothèque ; une qui existe déjà (d'une version d'avant) reste montrée et servie.
    const prompts = await page('bibliotheque.prompts').load()
    expect(prompts.actions?.map((each) => each.id)).not.toContain('new-shelf')
    settings.bibliotheques = { prompt: [{ id: 'relecture', name: 'Relecture', folder: 'Prompts de relecture' }] }
    await platform.fs.ensureFolder('Prompts de relecture')
    shown.push(`bibliotheque.prompts?${encodeURIComponent('relecture:')}`)
    let view = await current()
    expect(crumbsOf(view)).toEqual(['Bibliothèque', 'Relecture'])
    platform.forms.push({ name: 'Technique' })
    await action(view, 'new-directory').run()
    view = await current()
    platform.forms.push({ name: 'Cohérence', category: '', description: '', text: 'Les pièces se contredisent-elles ?', favorite: 'false' })
    await action(view, 'new').run()
    expect(await platform.fs.exists('Prompts de relecture/Technique/Cohérence.md')).toBe(true)
    expect(shown.at(-1)).toBe(`bibliotheque.prompt?${encodeURIComponent('Prompts de relecture/Technique/Cohérence.md')}`)
    // Toujours trouvé par son nom, où qu'il soit rangé.
    expect((await libraryEntries('prompt')).map((each) => each.name)).toEqual(['Cohérence'])
    // Déplacer : vers la principale.
    const fiche = await current()
    expect(fiche.blocks.find((block) => block.kind === 'text' && block.title === 'Où il sert')).toMatchObject({ paragraphs: [expect.stringMatching(/^Rangé : Relecture › Technique\./), expect.any(String)] })
    platform.choices.push('Bibliothèque/Prompts')
    await fiche.actions!.find((each) => each.id === 'move')!.run()
    expect(await platform.fs.exists('Bibliothèque/Prompts/Cohérence.md')).toBe(true)
    // L'accueil : une section par groupe, dedans les bibliothèques de chaque sorte, une carte chacune.
    const hub = await page('bibliotheque.accueil').load()
    const sections = hub.blocks.flatMap((block) => (block.kind === 'section' ? [block.title] : []))
    expect(sections).toEqual(['Bibliothèques de documents', 'Bibliothèques système IA', 'Bibliothèques système', 'Annuaire'])
    const ia = hub.blocks.find((block) => block.kind === 'section' && block.id === 'bibliotheque.hub.groupe.ia')
    expect(ia?.kind === 'section' && ia.blocks.map((block) => (block.kind === 'cards' ? block.title : ''))).toEqual(['Prompts · 2 bibliothèque(s)', 'Personas · 1 bibliothèque(s)', 'Skills · 1 bibliothèque(s)'])
    expect(cardsIn(hub.blocks).filter((card) => card.id.startsWith('prompt:')).map((card) => [card.title, card.subtitle])).toEqual([
      ['Prompts', '1 prompt(s)'],
      ['Relecture', '0 prompt(s)']
    ])
    // Par défaut, puis retirée de la liste : son dossier reste ; la principale redevient par défaut.
    view = await page('bibliotheque.prompts').load(encodeURIComponent('relecture:'))
    await action(view, 'default-shelf').run()
    expect(settings.bibliothequesParDefaut).toEqual({ prompt: 'relecture' })
    view = await page('bibliotheque.prompts').load(encodeURIComponent('relecture:'))
    expect(view.actions?.map((each) => each.id)).not.toContain('default-shelf')
    await action(view, 'remove-shelf').run()
    expect(platform.notices.at(-1)).toBe('« Relecture » retirée de la liste. Son dossier Prompts de relecture est intact.')
    expect(settings.bibliothequesParDefaut).toEqual({})
    expect(await platform.fs.exists('Prompts de relecture/Technique')).toBe(true)
    expect((await page('bibliotheque.prompts').load()).actions?.map((each) => each.id)).toEqual(['new', 'starters', 'new-directory', 'export-shelf', 'import-shelf'])
  })
})
