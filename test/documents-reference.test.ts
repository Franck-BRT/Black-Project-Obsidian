// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **documents de référence** : une bibliothèque à part (normes, procédures, guides) que
 * les programmes et les projets appellent ; la fiche d'un document dit qui l'appelle ; un
 * document versé de nouveau ailleurs peut y être rangé.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { CREATE_IN_PICK, memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem, type PageView } from '../src/core/views'
import { MODULES } from '../src/modules'
import { pourIntoLibrary, referenceDocuments } from '../src/modules/bibliotheque'
import { programmesStore, starterTypes } from '../src/modules/programmes'

const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const bytes = (text: string) => new TextEncoder().encode(text)
const REFS = 'Bibliothèque/Références'

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {}
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
  return { settings, shown, load }
}

/** Une section d'une page, par son identifiant. */
const section = (view: PageView, id: string): Extract<HomeBlock, { kind: 'section' }> | undefined =>
  view.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === id)
const itemsOf = (block: Extract<HomeBlock, { kind: 'section' }> | undefined): ListItem[] => block?.blocks.flatMap((each) => (each.kind === 'list' ? each.items : [])) ?? []
const sectionAction = (block: Extract<HomeBlock, { kind: 'section' }> | undefined, id: string) =>
  block?.blocks.flatMap((each) => (each.kind === 'message' ? (each.actions ?? []) : [])).find((action) => action.id === id)

/** Une norme versée dans les documents de référence (glissée sur leur page). */
async function pourReference(load: (target: string) => Promise<PageView>, name = 'ECSS-E-ST-10C.pdf', text = 'ecss') {
  const view = await load(`bibliotheque.documents?${encodeURIComponent('references:')}`)
  await view.drop!.run([{ name, bytes: bytes(text) }])
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('les documents de référence', () => {
  it('une bibliothèque à part, toujours là : sa carte sur l’accueil, sa page, son dossier ; un document qu’on y verse est marqué ★', async () => {
    const platform = memoryPlatform()
    const { load, shown } = await start(platform)
    const hub = await load('bibliotheque.accueil')
    const cards = hub.blocks.flatMap((block) => (block.kind === 'section' ? block.blocks : [block])).flatMap((block) => (block.kind === 'cards' ? block.cards : []))
    expect(cards.map((card) => card.title).slice(0, 2)).toEqual(['Documents', 'Documents de référence'])
    const refsCard = cards.find((card) => card.id === 'references')!
    expect(refsCard).toMatchObject({ subtitle: '0 document(s)', icon: 'star' })
    await refsCard.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${encodeURIComponent('references:')}`)
    const page = await load(shown.at(-1)!)
    expect(page.title).toBe('Documents de référence')
    // Elle ne se retire pas.
    expect(page.actions?.map((action) => action.id)).not.toContain('remove-shelf')
    await pourReference(load)
    expect(await platform.fs.exists(`${REFS}/ECSS-E-ST-10C.md`)).toBe(true)
    expect(await referenceDocuments()).toMatchObject([{ record: `${REFS}/ECSS-E-ST-10C.md`, title: 'ECSS-E-ST-10C', reference: true }])
    const fiche = await load(`bibliotheque.document?${encodeURIComponent(`${REFS}/ECSS-E-ST-10C.md`)}`)
    expect(fiche.subtitle).toMatch(/^★ Document de référence · /)
    expect(fiche.actions?.map((action) => action.id)).not.toContain('to-references')
    expect(section(fiche, 'bibliotheque.document.appels')).toMatchObject({ title: 'Appelé par (0)', subtitle: 'Aucun programme ni projet ne l’appelle encore.' })
    // La bibliothèque principale ne parcourt pas son dossier : le document n'y est pas deux fois.
    const hubAfter = await load('bibliotheque.accueil')
    const counts = hubAfter.blocks.flatMap((block) => (block.kind === 'section' ? block.blocks : [block])).flatMap((block) => (block.kind === 'cards' ? block.cards : [])).map((card) => `${card.title}=${card.subtitle}`)
    expect(counts.slice(0, 2)).toEqual(['Documents=0 document(s)', 'Documents de référence=1 document(s)'])
  })

  it('un programme, un projet les appellent : choisis (ou versés d’ici), écrits en liens dans leur note ; la fiche dit qui l’appelle', async () => {
    const platform = memoryPlatform()
    const { load, shown } = await start(platform)
    await pourReference(load)
    await pourReference(load, 'Procédure qualité.pdf', 'pq')
    const store = programmesStore()!
    const programme = await store.createProgramme('Spatial', { code: 'SP', color: 'indigo', icon: 'rocket', description: '' })
    const [type] = starterTypes((key) => key)
    const project = await store.createProject(programme, 'Station sol', type!)
    // Le programme : la section, vide, propose de choisir.
    let view = await load(`programmes.programme?${encodeURIComponent(programme.path)}`)
    let refs = section(view, 'programmes.programme.references')
    expect(refs).toMatchObject({ title: 'Documents de référence', subtitle: '0 document(s)' })
    platform.manyAnswers.push([`${REFS}/ECSS-E-ST-10C.md`])
    await sectionAction(refs, 'choose-references')!.run()
    expect(platform.manyAsked.at(-1)).toMatchObject({ title: 'Documents de référence de « Spatial »', selected: [] })
    expect(platform.manyAsked.at(-1)!.choices.map((choice) => choice.label)).toEqual(['ECSS-E-ST-10C', 'Procédure qualité'])
    expect(read(platform, programme.path)).toMatch(/\nreferences:\n\s*- "\[\[Bibliothèque\/Références\/ECSS-E-ST-10C\.md\]\]"\n/)
    view = await load(`programmes.programme?${encodeURIComponent(programme.path)}`)
    refs = section(view, 'programmes.programme.references')
    expect(itemsOf(refs).map((item) => item.title)).toEqual(['ECSS-E-ST-10C'])
    // Le projet : le sien, plus un versé depuis la fenêtre même (pas d'héritage du programme).
    view = await load(`programmes.projet?${encodeURIComponent(project.path)}`)
    refs = section(view, 'programmes.projet.references')
    expect(itemsOf(refs)).toEqual([])
    platform.manyAnswers.push([`${REFS}/ECSS-E-ST-10C.md`, CREATE_IN_PICK])
    platform.externalFiles.push([{ name: 'Guide essais.pdf', bytes: bytes('ge') }])
    platform.choices.push('computer')
    await sectionAction(refs, 'choose-references')!.run()
    expect(await platform.fs.exists(`${REFS}/Guide essais.md`)).toBe(true)
    view = await load(`programmes.projet?${encodeURIComponent(project.path)}`)
    refs = section(view, 'programmes.projet.references')
    expect(itemsOf(refs).map((item) => item.title)).toEqual(['ECSS-E-ST-10C', 'Guide essais'])
    await itemsOf(refs)[0]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent(`${REFS}/ECSS-E-ST-10C.md`)}`)
    // La fiche : appelé par le programme et le projet ; un clic y mène.
    const fiche = await load(shown.at(-1)!)
    const callers = section(fiche, 'bibliotheque.document.appels')
    expect(callers?.title).toBe('Appelé par (2)')
    expect(itemsOf(callers).map((item) => `${item.title} — ${item.detail}`)).toEqual(['Spatial — Programme', `Station sol — Projet · ${type!.name}`])
    await itemsOf(callers)[1]!.open!.run()
    expect(shown.at(-1)).toBe(`programmes.projet?${encodeURIComponent(project.path)}`)
    // Ne plus l'appeler : retiré de la note, le document reste.
    await itemsOf(refs)[0]!.tools![0]!.run()
    expect(read(platform, project.path)).not.toContain('ECSS-E-ST-10C')
    expect(await platform.fs.exists(`${REFS}/ECSS-E-ST-10C.md`)).toBe(true)
  })

  it('une fiche rangée ailleurs : les programmes et les projets qui l’appelaient suivent ; retirée de la bibliothèque, dit tel', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    await pourReference(load)
    const store = programmesStore()!
    const programme = await store.createProgramme('Spatial', { code: '', color: 'indigo', icon: 'rocket', description: '' })
    await store.setReferences(programme.path, [`${REFS}/ECSS-E-ST-10C.md`])
    await platform.fs.ensureFolder(`${REFS}/Normes`)
    platform.choices.push(`${REFS}/Normes`)
    const fiche = await load(`bibliotheque.document?${encodeURIComponent(`${REFS}/ECSS-E-ST-10C.md`)}`)
    await fiche.actions!.find((action) => action.id === 'move')!.run()
    expect((await store.programme(programme.path))!.references).toEqual([`${REFS}/Normes/ECSS-E-ST-10C.md`])
    // Mis de côté : la section du programme dit qu'il n'est plus là.
    const moved = await load(`bibliotheque.document?${encodeURIComponent(`${REFS}/Normes/ECSS-E-ST-10C.md`)}`)
    await moved.actions!.find((action) => action.id === 'aside')!.run()
    const view = await load(`programmes.programme?${encodeURIComponent(programme.path)}`)
    expect(itemsOf(section(view, 'programmes.programme.references'))).toMatchObject([{ title: 'ECSS-E-ST-10C', detail: 'N’est plus dans la bibliothèque (retiré, ou sa fiche supprimée).', tone: 'warning' }])
  })

  it('« Ranger dans les références » sur la fiche : la fiche y va, un fantôme reste à sa place', async () => {
    const platform = memoryPlatform()
    const { load, shown } = await start(platform)
    const doc = (await pourIntoLibrary([{ name: 'Guide.pdf', bytes: bytes('g') }], { module: 'bibliotheque', label: '' }))!.added[0]!
    expect(doc.record).toBe('Bibliothèque/Guide.md')
    const fiche = await load(`bibliotheque.document?${encodeURIComponent(doc.record)}`)
    await fiche.actions!.find((action) => action.id === 'to-references')!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent(`${REFS}/Guide.md`)}`)
    expect(read(platform, 'Bibliothèque/Guide.md')).toMatch(/^---\nbp-type: bibliotheque-fantome\nde: "\[\[Bibliothèque\/Références\/Guide\.md\]\]"/)
    expect(platform.notices).toContain('« Guide » est rangé dans « Documents de référence » ; un fantôme reste à son ancienne place.')
  })

  it('un document déjà rangé, versé ailleurs : le fantôme, puis « le ranger dans les références ? » ; versé dans les références même : proposé d’abord', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    await platform.fs.ensureFolder('Bibliothèque/Lots')
    const at = (directory: string) => `bibliotheque.documents?${encodeURIComponent(`principale:${directory}`)}`
    await (await load(at('Normes'))).drop!.run([{ name: 'ECSS.pdf', bytes: bytes('e') }])
    // Versé dans « Lots » : un fantôme (oui), puis les références (oui).
    platform.confirmations.push(true, true)
    await (await load(at('Lots'))).drop!.run([{ name: 'ECSS.pdf', bytes: bytes('e') }])
    expect(platform.confirmed.map((each) => each.title)).toEqual(['Déjà dans la bibliothèque', 'Un document de référence ?'])
    expect(platform.confirmed.at(-1)!.message).toBe('« ECSS » est rangé dans « Normes », et montré maintenant aussi dans « Lots » : commun à plusieurs dossiers, le ranger dans les documents de référence (« Documents de référence ») ? Un fantôme restera dans « Normes ».')
    expect(await platform.fs.exists(`${REFS}/ECSS.md`)).toBe(true)
    expect(read(platform, 'Bibliothèque/Normes/ECSS.md')).toContain('bp-type: bibliotheque-fantome')
    expect(read(platform, 'Bibliothèque/Lots/ECSS.md')).toContain(`de: "[[${REFS}/ECSS.md]]"`)
    // Un autre, déjà rangé, versé dans les références : y ranger d'abord (oui) — pas de fantôme dans les références.
    await (await load(at('Normes'))).drop!.run([{ name: 'Plan.pdf', bytes: bytes('p') }])
    platform.confirmations.push(true)
    await pourReference(load, 'Plan.pdf', 'p')
    expect(platform.confirmed.at(-1)!.message).toBe('« Plan » est déjà dans la bibliothèque, rangé dans « Normes ». Le ranger dans « Documents de référence », parmi les documents de référence ? Un fantôme restera dans « Normes ».')
    expect(read(platform, `${REFS}/Plan.md`)).toMatch(/^---\nbp-type: bibliotheque-document\n/)
    expect(read(platform, 'Bibliothèque/Normes/Plan.md')).toContain('bp-type: bibliotheque-fantome')
  })

  it('déplacé vers les documents de référence (« Déplacer… » ou « Ranger dans les références ») : un fantôme à sa place est proposé — accepté, il y est ; refusé, rien', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    await platform.fs.ensureFolder(`${REFS}/Normes`)
    const at = `bibliotheque.documents?${encodeURIComponent('principale:Normes')}`
    await (await load(at)).drop!.run([{ name: 'ECSS.pdf', bytes: bytes('e') }, { name: 'Guide.pdf', bytes: bytes('g') }])
    // « Déplacer… » vers un répertoire des références : la question, acceptée.
    platform.choices.push(`${REFS}/Normes`)
    platform.confirmations.push(true)
    await (await load(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Normes/ECSS.md')}`)).actions!.find((action) => action.id === 'move')!.run()
    expect(platform.confirmed.at(-1)).toMatchObject({
      title: 'Un fantôme à sa place ?',
      message: '« ECSS » est maintenant rangé dans « Documents de référence › Normes ». Laisser un fantôme dans « Normes », là où il était — une petite note qui le montre encore là, et l’ouvre ?',
      confirm: 'Laisser un fantôme',
      cancel: 'Pas de fantôme'
    })
    expect(read(platform, `${REFS}/Normes/ECSS.md`)).toMatch(/^---\nbp-type: bibliotheque-document\n/)
    expect(read(platform, 'Bibliothèque/Normes/ECSS.md')).toContain(`de: "[[${REFS}/Normes/ECSS.md]]"`)
    expect(platform.notices.at(-1)).toBe('« ECSS » est rangé dans « Documents de référence › Normes » ; un fantôme reste à son ancienne place.')
    // « Ranger dans les références », refusé : pas de fantôme.
    platform.confirmations.push(false)
    await (await load(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Normes/Guide.md')}`)).actions!.find((action) => action.id === 'to-references')!.run()
    expect(await platform.fs.exists(`${REFS}/Guide.md`)).toBe(true)
    expect(await platform.fs.exists('Bibliothèque/Normes/Guide.md')).toBe(false)
    expect(platform.notices.at(-1)).toBe('« Guide » est rangé dans « Documents de référence ».')
    // Déplacé ailleurs que dans les références : pas de question.
    const asked = platform.confirmed.length
    await platform.fs.ensureFolder('Bibliothèque/Archives')
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: bytes('p') }], { module: 'bibliotheque', label: '' })
    platform.choices.push('Bibliothèque/Archives')
    await (await load(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Plan.md')}`)).actions!.find((action) => action.id === 'move')!.run()
    expect(platform.confirmed).toHaveLength(asked)
  })

  it('déplacé depuis l’explorateur d’Obsidian dans les documents de référence : le fantôme proposé aussi, les appels suivent ; une seule question par un déplacement de l’application', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    await (await load(`bibliotheque.documents?${encodeURIComponent('principale:Normes')}`)).drop!.run([{ name: 'ECSS.pdf', bytes: bytes('e') }, { name: 'Guide.pdf', bytes: bytes('g') }])
    const store = programmesStore()!
    const programme = await store.createProgramme('Spatial', { code: '', color: 'indigo', icon: 'rocket', description: '' })
    await store.setReferences(programme.path, ['Bibliothèque/Normes/ECSS.md'])
    // Glissée dans l'explorateur : la fiche arrive dans les références, la question vient.
    const asked = platform.confirmed.length
    platform.confirmations.push(true)
    await platform.fs.rename('Bibliothèque/Normes/ECSS.md', `${REFS}/ECSS.md`)
    expect(platform.confirmed).toHaveLength(asked + 1)
    expect(platform.confirmed.at(-1)).toMatchObject({ title: 'Un fantôme à sa place ?', message: expect.stringMatching(/^« ECSS » est maintenant rangé dans « Documents de référence »\. Laisser un fantôme dans « Normes »/) })
    expect(read(platform, 'Bibliothèque/Normes/ECSS.md')).toContain(`de: "[[${REFS}/ECSS.md]]"`)
    expect(platform.notices.at(-1)).toBe('Fantôme de « ECSS » laissé dans « Normes ».')
    expect((await store.programme(programme.path))!.references).toEqual([`${REFS}/ECSS.md`])
    // Refusé : pas de fantôme.
    platform.confirmations.push(false)
    await platform.fs.rename('Bibliothèque/Normes/Guide.md', `${REFS}/Guide.md`)
    expect(await platform.fs.exists('Bibliothèque/Normes/Guide.md')).toBe(false)
    // Déplacé à l'intérieur des références, ou ailleurs, ou une autre note : pas de question.
    const now = platform.confirmed.length
    await platform.fs.ensureFolder(`${REFS}/Normes`)
    await platform.fs.rename(`${REFS}/Guide.md`, `${REFS}/Normes/Guide.md`)
    await platform.fs.writeText('Bibliothèque/Notes.md', '# Une note')
    await platform.fs.rename('Bibliothèque/Notes.md', `${REFS}/Notes.md`)
    expect(platform.confirmed).toHaveLength(now)
    // « Ranger dans les références » depuis l'application : une seule question (le renommage qu'elle fait ne compte pas).
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: bytes('p') }], { module: 'bibliotheque', label: '' })
    const before = platform.confirmed.length
    platform.confirmations.push(true)
    await (await load(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Plan.md')}`)).actions!.find((action) => action.id === 'to-references')!.run()
    expect(platform.confirmed).toHaveLength(before + 1)
  })

  it('les documents projet : une bibliothèque à part, un répertoire par programme puis par projet ; la page du projet les montre et les reçoit glissés', async () => {
    const platform = memoryPlatform()
    const { load, shown } = await start(platform)
    const store = programmesStore()!
    const programme = await store.createProgramme('Spatial', { code: '', color: 'indigo', icon: 'rocket', description: '' })
    const [type] = starterTypes((key) => key)
    const project = await store.createProject(programme, 'Station sol', type!)
    // La page du projet : sa section, son répertoire créé.
    let view = await load(`programmes.projet?${encodeURIComponent(project.path)}`)
    let docs = section(view, 'programmes.projet.documents')
    expect(docs).toMatchObject({ title: 'Documents du projet', subtitle: '0 document(s)' })
    expect(await platform.fs.exists('Bibliothèque/Projets/Spatial/Station sol')).toBe(true)
    expect(view.drop?.label).toBe('Déposer dans les documents de « Station sol »')
    // Des fichiers glissés sur la page : versés dans son répertoire.
    await view.drop!.run([{ name: 'Planning.pdf', bytes: bytes('pl') }])
    expect(await platform.fs.exists('Bibliothèque/Projets/Spatial/Station sol/Planning.md')).toBe(true)
    view = await load(`programmes.projet?${encodeURIComponent(project.path)}`)
    docs = section(view, 'programmes.projet.documents')
    expect(itemsOf(docs).map((item) => item.title)).toEqual(['Planning'])
    await itemsOf(docs)[0]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Projets/Spatial/Station sol/Planning.md')}`)
    await sectionAction(docs, 'library-folder')!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${encodeURIComponent('projets:Spatial/Station sol')}`)
    expect((await load(shown.at(-1)!)).title).toBe('Station sol')
    // Le programme : les siens, pas ceux de ses projets.
    const programmeView = await load(`programmes.programme?${encodeURIComponent(programme.path)}`)
    expect(section(programmeView, 'programmes.programme.documents')).toMatchObject({ title: 'Documents du programme', subtitle: '0 document(s)' })
    await programmeView.drop!.run([{ name: 'Charte.pdf', bytes: bytes('ch') }])
    expect(itemsOf(section(await load(`programmes.programme?${encodeURIComponent(programme.path)}`), 'programmes.programme.documents')).map((item) => item.title)).toEqual(['Charte'])
    // L'accueil de la bibliothèque : sa carte, ses documents comptés à part.
    const hub = await load('bibliotheque.accueil')
    const cards = hub.blocks.flatMap((block) => (block.kind === 'section' ? block.blocks : [block])).flatMap((block) => (block.kind === 'cards' ? block.cards : []))
    expect(cards.filter((card) => card.id === 'documents' || card.id === 'projects').map((card) => `${card.title}=${card.subtitle}`)).toEqual(['Documents=0 document(s)', 'Documents projet=2 document(s)'])
    // Elle ne se retire pas.
    expect((await load(`bibliotheque.documents?${encodeURIComponent('projets:')}`)).actions?.map((action) => action.id)).not.toContain('remove-shelf')
  })

  it('l’accueil de la bibliothèque : chaque groupe crée une bibliothèque de ses sortes — créée, elle s’ouvre, et l’accueil la montre', async () => {
    const platform = memoryPlatform()
    const { load, shown } = await start(platform)
    const hub = await load('bibliotheque.accueil')
    const create = hub.blocks.flatMap((block) => (block.kind === 'section' ? block.blocks : [])).flatMap((block) => (block.kind === 'cards' ? (block.actions ?? []) : [])).find((action) => action.id === 'new-shelf-document')!
    platform.forms.push({ name: 'Archives', folder: '', default: 'false' })
    await create.run()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${encodeURIComponent('archives:')}`)
    const again = await load('bibliotheque.accueil')
    const titles = again.blocks.flatMap((block) => (block.kind === 'section' ? block.blocks : [])).flatMap((block) => (block.kind === 'cards' ? block.cards : [])).map((card) => card.title)
    expect(titles).toContain('Archives')
  })

  it('« Déplacer vers une bibliothèque… » : toutes les bibliothèques de documents, celles créées par l’utilisateur comprises, et leurs répertoires', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    const hub = await load('bibliotheque.accueil')
    const create = hub.blocks.flatMap((block) => (block.kind === 'section' ? block.blocks : [])).flatMap((block) => (block.kind === 'cards' ? (block.actions ?? []) : [])).find((action) => action.id === 'new-shelf-document')!
    platform.forms.push({ name: 'Archives', folder: '', default: 'false' })
    await create.run()
    await platform.fs.ensureFolder('Bibliothèques/Documents/Archives/2025')
    await platform.fs.ensureFolder('Bibliothèque/Projets/Spatial/Station sol')
    const doc = (await pourIntoLibrary([{ name: 'Plan.pdf', bytes: bytes('p') }], { module: 'bibliotheque', label: '' }))!.added[0]!
    const fiche = await load(`bibliotheque.document?${encodeURIComponent(doc.record)}`)
    const move = fiche.actions!.find((action) => action.id === 'move')!
    expect(move.label).toBe('Déplacer vers une bibliothèque…')
    platform.choices.push('Bibliothèques/Documents/Archives/2025')
    await move.run()
    expect(platform.offered.at(-1)!.map((each) => each.label)).toEqual([
      'Documents de référence',
      'Documents projet',
      'Documents projet › Spatial',
      'Documents projet › Spatial › Station sol',
      'Archives',
      'Archives › 2025'
    ])
    expect(await platform.fs.exists('Bibliothèques/Documents/Archives/2025/Plan.md')).toBe(true)
  })

  it('les répertoires d’un type de projet : décrits dans l’éditeur (sous-répertoires, types attendus) ; créés avec chaque projet dans les documents projet ; la page du projet dit ce qui manque', async () => {
    const platform = memoryPlatform()
    const { load, shown } = await start(platform)
    const typePage = () => load('programmes.type?projet-simple')
    const folders = async () => section(await typePage(), 'programmes.type.folders')
    expect(await folders()).toMatchObject({ title: 'Répertoires des documents', subtitle: '0 répertoire(s)' })
    platform.forms.push({ name: 'Offre' })
    await sectionAction(await folders(), 'add-folder')!.run()
    platform.forms.push({ name: 'Technique' })
    await itemsOf(await folders())[0]!.tools!.find((tool) => tool.id === 'sub-offre')!.run()
    platform.manyAnswers.push(['CCTP'])
    await itemsOf(await folders())[1]!.tools!.find((tool) => tool.id === 'expects-technique')!.run()
    expect(itemsOf(await folders()).map((item) => [item.title, item.detail])).toEqual([
      ['Offre', 'Aucun type de document attendu'],
      ['Offre › Technique', expect.stringMatching(/^Attendus : CCTP/)]
    ])
    // Un projet de ce type : ses répertoires, créés dans la bibliothèque des documents projet.
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await (await load('programmes')).actions!.find((action) => action.id === 'new')!.run()
    platform.forms.push({ name: 'Q', programme: 'Programmes/P/P.md', type: 'projet-simple', description: '', affaire: 'false', client: '', reference: '' })
    await (await load(shown.at(-1)!)).actions!.find((action) => action.id === 'project')!.run()
    const projectPage = shown.at(-1)!
    expect(await platform.fs.exists('Bibliothèque/Projets/P/Q/Offre/Technique')).toBe(true)
    expect(read(platform, 'Programmes/P/Q/Q.md')).toContain('repertoires:\n- id: offre\n  nom: Offre\n  sous:\n  - id: technique\n    nom: Technique\n    attendus:\n    - CCTP\n')
    // La page du projet : le CCTP attendu dans « Offre › Technique », manquant.
    const expected = async () => (section(await load(projectPage), 'programmes.projet.documents')?.blocks ?? []).find((block): block is Extract<HomeBlock, { kind: 'list' }> => block.kind === 'list' && block.title === 'Répertoires attendus')!
    let rows = (await expected()).items
    expect(rows.map((item) => [item.title, item.tone])).toEqual([['Offre', 'neutral'], ['Offre › Technique', 'warning']])
    expect(rows[1]!.detail).toMatch(/^CCTP.* : manquant · 0 document\(s\)$/)
    // Le CCTP versé dans son répertoire : reçu.
    await pourIntoLibrary([{ name: 'CCTP antenne.pdf', bytes: bytes('cctp'), category: 'CCTP' }], { module: 'bibliotheque', label: '' }, { folder: 'Bibliothèque/Projets/P/Q/Offre/Technique' })
    rows = (await expected()).items
    expect(rows[1]).toMatchObject({ tone: 'success', detail: expect.stringMatching(/^CCTP.* ✓ · 1 document\(s\)$/) })
    expect(section(await load(projectPage), 'programmes.projet.documents')!.subtitle).toBe('1 document(s) · 1/1 répertoire(s) complet(s)')
    await rows[1]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.documents?${encodeURIComponent('projets:P/Q/Offre/Technique')}`)
    // Retiré du type : les projets déjà créés gardent les leurs.
    await itemsOf(await folders())[0]!.tools!.find((tool) => tool.id === 'remove-offre')!.run()
    expect(itemsOf(await folders())).toEqual([])
    expect((await expected()).items).toHaveLength(2)
  })
})
