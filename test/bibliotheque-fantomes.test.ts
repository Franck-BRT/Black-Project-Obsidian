// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **fantômes** de la bibliothèque : déposé soi-même dans un lieu (versé, glissé-déposé),
 * un document qui y est déjà, rangé ailleurs, n'est pas copié une seconde fois ; une fenêtre
 * propose de ne rien faire, ou de placer ici un fantôme — une petite note qui le montre et
 * l'ouvre. C'est un workflow système (« Proposer un fantôme… », actif), modifiable : sans
 * demander, ou désactivé ; sans le module Workflows, la bibliothèque le propose elle-même.
 * Le fantôme suit le document (déplacé, retiré) ; il se retire sans toucher au document.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

/** La liste d'une section repliable de la fiche, par son intitulé. */
const sectionList = (blocks: readonly HomeBlock[], title: string | ((title: string) => boolean)): HomeBlock | undefined => {
  const section = blocks.find((block) => block.kind === 'section' && (typeof title === 'string' ? block.title === title : title(block.title)))
  return section?.kind === 'section' ? section.blocks.find((block) => block.kind === 'list') : undefined
}

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule]
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const cardsIn = (blocks: readonly HomeBlock[]): Card[] => blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : block.kind === 'section' ? cardsIn(block.blocks) : []))
const ghostsOf = (view: PageView) => cardsIn(view.blocks).filter((card) => card.id.startsWith('ghost:'))
const at = (directory: string) => encodeURIComponent(`principale:${directory}`)

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = ALL) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {}
  const views = new ViewsRegistry()
  const shown: string[] = []
  for (const module of modules) {
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
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.bibliotheque.fantome')
  /** Une norme rangée dans « Normes », puis déposée de nouveau à la racine (glissée-déposée). */
  const dropAgain = async (directory = '') => {
    const view = await page('bibliotheque.documents').load(at(directory))
    await view.drop!.run([{ name: 'ECSS-E-ST-10C.pdf', bytes: bytes('ecss') }])
  }
  return { settings, page, shown, system, dropAgain }
}

/** La norme, versée dans « Normes ». */
async function filedInNormes(platform: MemoryPlatform, page: (id: string) => { load(param?: string): Promise<PageView> }) {
  await platform.fs.ensureFolder('Bibliothèque/Normes')
  const view = await page('bibliotheque.documents').load(at('Normes'))
  await view.drop!.run([{ name: 'ECSS-E-ST-10C.pdf', bytes: bytes('ecss') }])
  expect(await platform.fs.exists('Bibliothèque/Normes/ECSS-E-ST-10C.md')).toBe(true)
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('les fantômes de la bibliothèque', () => {
  it('le workflow système : actif, au déclencheur « document déjà là », il demande d’abord', async () => {
    const platform = memoryPlatform()
    const { system } = await start(platform)
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Proposer un fantôme d’un document déjà dans la bibliothèque',
      trigger: { kind: 'bibliotheque.document-deja-la' },
      actions: [{ kind: 'bibliotheque.fantome', fields: { quoi: 'demander', fiche: '{fiche}', dossier: '{dossier}' } }]
    })
  })

  it('déjà là, ailleurs : une fenêtre — « Ne rien faire » : rien ; « Placer un fantôme ici » : sa note', async () => {
    const platform = memoryPlatform()
    const { page, dropAgain } = await start(platform)
    await filedInNormes(platform, page)
    expect(platform.confirmed).toHaveLength(0)
    // Ne rien faire.
    platform.confirmations.push(false)
    await dropAgain()
    expect(platform.confirmed.at(-1)).toMatchObject({
      title: 'Déjà dans la bibliothèque',
      message: expect.stringMatching(/^« ECSS-E-ST-10C » est déjà dans la bibliothèque, rangé dans « Normes »\. .* dans « Documents »/),
      confirm: 'Placer un fantôme ici',
      cancel: 'Ne rien faire'
    })
    expect(await platform.fs.exists('Bibliothèque/ECSS-E-ST-10C.md')).toBe(false)
    // Placer un fantôme ici (puis le laisser où il est, pas dans les références).
    platform.confirmations.push(true, false)
    await dropAgain()
    expect(read(platform, 'Bibliothèque/ECSS-E-ST-10C.md')).toMatch(
      /^---\nbp-type: bibliotheque-fantome\nde: "\[\[Bibliothèque\/Normes\/ECSS-E-ST-10C\.md\]\]"\ntitre: ECSS-E-ST-10C\nempreinte: "[0-9a-f]{64}"\n---\n\nFantôme : le document \[\[Bibliothèque\/Normes\/ECSS-E-ST-10C\.md\|ECSS-E-ST-10C\]\] est rangé dans « Normes » de la bibliothèque\.\n$/
    )
    expect(platform.notices.at(-2)).toBe('Fantôme de « ECSS-E-ST-10C » placé dans « Documents ».')
    // Une seule fiche : le document n'est pas copié une seconde fois.
    expect([...platform.files.keys()].filter((path) => path.endsWith('.pdf'))).toEqual(['Bibliothèque/_fichiers/ECSS-E-ST-10C.pdf'])
    // Déjà un fantôme ici, ou déposé là où il est rangé : plus de question.
    const asked = platform.confirmed.length
    await dropAgain()
    await dropAgain('Normes')
    expect(platform.confirmed).toHaveLength(asked)
  })

  it('la page : le fantôme parmi les documents du lieu, son icône fantôme ; il ouvre le document, mène à l’original, se retire (le document reste)', async () => {
    const platform = memoryPlatform()
    const { page, shown, dropAgain } = await start(platform)
    await filedInNormes(platform, page)
    platform.confirmations.push(true, false)
    await dropAgain()
    const root = await page('bibliotheque.documents').load()
    // Plus de bloc à part : le fantôme est dans la liste des documents, dans son groupe, l'icône fantôme devant.
    expect(root.blocks.some((block) => block.kind === 'cards' && block.title?.startsWith('Aussi ici'))).toBe(false)
    const [ghost] = ghostsOf(root)
    expect(ghost).toMatchObject({ title: 'ECSS-E-ST-10C', subtitle: 'Rangé dans « Normes »', icon: 'ghost', badges: [{ label: 'PDF' }, { label: 'Norme' }], tags: ['fantomes', 'famille-pdf', 'de-bibliotheque'] })
    expect(root.blocks.find((block) => block.kind === 'stats')).toMatchObject({ stats: expect.arrayContaining([expect.objectContaining({ label: 'Fantômes', value: '1', icon: 'ghost' })]) })
    expect(root.filters?.map((filter) => filter.id)).toContain('fantomes')
    await ghost!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Normes/ECSS-E-ST-10C.md')}`)
    await ghost!.actions!.find((action) => action.id === 'original')!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${at('Normes')}`)
    // Sa fiche dit où il est montré aussi.
    const fiche = await page('bibliotheque.document').load(encodeURIComponent('Bibliothèque/Normes/ECSS-E-ST-10C.md'))
    expect(sectionList(fiche.blocks, (title) => title.startsWith('Montré aussi ailleurs'))).toMatchObject({ items: [{ title: 'À la racine', detail: 'Bibliothèque/ECSS-E-ST-10C.md', icon: 'ghost' }] })
    // L'icône fantôme sur sa fiche : la section, et un chiffre.
    expect(fiche.blocks.find((block) => block.kind === 'section' && block.title.startsWith('Montré aussi ailleurs'))).toMatchObject({ icon: 'ghost' })
    expect(fiche.blocks.find((block) => block.kind === 'stats')).toMatchObject({ stats: expect.arrayContaining([expect.objectContaining({ label: 'Fantômes', value: '1', icon: 'ghost', hint: 'Montré aussi dans : À la racine.' })]) })
    // Retirer le fantôme : mis de côté, le document reste.
    await ghost!.actions!.find((action) => action.id === 'remove-ghost')!.run()
    expect(platform.notices.at(-1)).toBe('Fantôme retiré : le document reste dans la bibliothèque.')
    expect(await platform.fs.exists('Bibliothèque/ECSS-E-ST-10C.md')).toBe(false)
    expect(await platform.fs.exists('Bibliothèque/_retirés/ECSS-E-ST-10C.md')).toBe(true)
    expect(await platform.fs.exists('Bibliothèque/Normes/ECSS-E-ST-10C.md')).toBe(true)
    expect(ghostsOf(await page('bibliotheque.documents').load())).toEqual([])
  })

  it('le fantôme suit le document : déplacé, son lien suit ; arrivé là où est le fantôme, le fantôme part ; retiré, ses fantômes aussi', async () => {
    const platform = memoryPlatform()
    const { page, dropAgain } = await start(platform)
    await filedInNormes(platform, page)
    await platform.fs.ensureFolder('Bibliothèque/Archives')
    platform.confirmations.push(true, false)
    await dropAgain()
    const fiche = async () => page('bibliotheque.document').load(encodeURIComponent((await platform.fs.exists('Bibliothèque/Normes/ECSS-E-ST-10C.md')) ? 'Bibliothèque/Normes/ECSS-E-ST-10C.md' : 'Bibliothèque/Archives/ECSS-E-ST-10C.md'))
    platform.choices.push('Bibliothèque/Archives')
    await (await fiche()).actions!.find((action) => action.id === 'move')!.run()
    expect(read(platform, 'Bibliothèque/ECSS-E-ST-10C.md')).toContain('de: "[[Bibliothèque/Archives/ECSS-E-ST-10C.md]]"')
    expect(ghostsOf(await page('bibliotheque.documents').load())[0]?.subtitle).toBe('Rangé dans « Archives »')
    // Ramené à la racine, là où est son fantôme : le fantôme n'a plus rien à dire.
    platform.choices.push('Bibliothèque')
    await (await fiche()).actions!.find((action) => action.id === 'move')!.run()
    expect(await platform.fs.exists('Bibliothèque/ECSS-E-ST-10C.md')).toBe(true)
    expect(read(platform, 'Bibliothèque/ECSS-E-ST-10C.md')).toMatch(/^---\nbp-type: bibliotheque-document\n/)
    expect(await platform.fs.exists('Bibliothèque/_retirés/ECSS-E-ST-10C.md')).toBe(true)
    // Un nouveau fantôme dans « Normes », puis le document retiré : le fantôme part avec lui.
    platform.confirmations.push(true, false)
    await dropAgain('Normes')
    expect(await platform.fs.exists('Bibliothèque/Normes/ECSS-E-ST-10C.md')).toBe(true)
    const doc = await page('bibliotheque.document').load(encodeURIComponent('Bibliothèque/ECSS-E-ST-10C.md'))
    await doc.actions!.find((action) => action.id === 'aside')!.run()
    expect(await platform.fs.exists('Bibliothèque/Normes/ECSS-E-ST-10C.md')).toBe(false)
  })

  it('le workflow modifié : sans demander, le fantôme est placé ; désactivé, rien n’est proposé', async () => {
    const platform = memoryPlatform()
    const { page, system, dropAgain } = await start(platform)
    await filedInNormes(platform, page)
    system()!.actions[0]!.fields.quoi = 'toujours'
    await dropAgain()
    expect(platform.confirmed).toHaveLength(0)
    expect(await platform.fs.exists('Bibliothèque/ECSS-E-ST-10C.md')).toBe(true)
    system()!.enabled = false
    await dropAgain('Autre')
    expect(platform.confirmed).toHaveLength(0)
    expect(await platform.fs.exists('Bibliothèque/Autre/ECSS-E-ST-10C.md')).toBe(false)
  })

  it('sans le module Workflows : la bibliothèque propose elle-même le fantôme', async () => {
    const platform = memoryPlatform()
    const { page, dropAgain } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    await filedInNormes(platform, page)
    platform.confirmations.push(true, false)
    await dropAgain()
    expect(platform.confirmed.at(-2)?.title).toBe('Déjà dans la bibliothèque')
    expect(await platform.fs.exists('Bibliothèque/ECSS-E-ST-10C.md')).toBe(true)
  })

  it('les dépôts des autres modules (pièces d’une analyse, imports) : rien n’est proposé', async () => {
    const platform = memoryPlatform()
    const { page } = await start(platform)
    await filedInNormes(platform, page)
    await pourIntoLibrary([{ name: 'ECSS-E-ST-10C.pdf', bytes: bytes('ecss') }], { module: 'exigences', label: 'Import' })
    expect(platform.confirmed).toHaveLength(0)
    expect(await platform.fs.exists('Bibliothèque/ECSS-E-ST-10C.md')).toBe(false)
  })
})
