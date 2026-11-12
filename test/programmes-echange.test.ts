// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Se passer des types de projet** : un type, ou tous, exportés en un fichier ; importés dans
 * un autre coffre ; une seconde fois, rien en double ; un type d'un nom déjà pris, ajouté à côté.
 * Sur les pages des programmes, les **phases de chaque projet repliées d'origine**. Et
 * **supprimer** un projet, un programme : leur dossier à la corbeille, après confirmation.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type PageView } from '../src/core/views'
import { programmesModule } from '../src/modules/programmes'

const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const bytes = (text: string) => new TextEncoder().encode(text)

async function vault(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  i18n.register('fr', programmesModule.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {}
  const views = new ViewsRegistry()
  const shown: string[] = []
  const context: ModuleContext = {
    moduleId: programmesModule.id,
    platform,
    i18n,
    settings: { get: () => settings[programmesModule.id] ?? {}, save: async (values) => void (settings[programmesModule.id] = values), onChange: () => () => {} },
    commands: { register: () => {} },
    views,
    showPage: (id) => void shown.push(id)
  }
  await programmesModule.activate(context)
  const load = (target: string): Promise<PageView> => {
    const [id, param] = target.split('?') as [string, string | undefined]
    return views.pages().find((each) => each.id === id)!.load(param)
  }
  const run = async (view: PageView, id: string) => {
    const found = view.actions?.find((action) => action.id === id) ?? view.blocks.flatMap((block) => (block.kind === 'message' ? (block.actions ?? []) : [])).find((action) => action.id === id)
    expect(found, id).toBeDefined()
    await found!.run()
  }
  const typeNames = async () => (await load('programmes.types')).blocks.map((block) => (block.kind === 'journey' ? block.title : ''))
  return { load, run, shown, typeNames, stop: async () => programmesModule.deactivate?.() }
}

/** Le dernier fichier exporté. */
const exported = (platform: MemoryPlatform): { name: string; bytes: Uint8Array } => {
  const path = [...platform.files.keys()].filter((each) => each.startsWith('Échanges/Types de projet/') && each.endsWith('.json')).at(-1)!
  return { name: path.slice(path.lastIndexOf('/') + 1), bytes: platform.files.get(path)! }
}

afterEach(async () => {
  await programmesModule.deactivate?.()
})

describe('se passer des types de projet', () => {
  it('tous exportés en un fichier ; importés ailleurs ; une seconde fois, rien en double ; un nom déjà pris, ajouté à côté', async () => {
    const mine = memoryPlatform()
    const a = await vault(mine)
    // Un type à moi, avec ses répertoires.
    mine.forms.push({ name: 'Étude amont', description: 'Une étude' })
    await a.run(await a.load('programmes.types'), 'new')
    const types = await a.load('programmes.types')
    expect(types.actions?.map((action) => action.id)).toEqual(['new', 'export-types', 'import-types'])
    await a.run(types, 'export-types')
    const file = exported(mine)
    expect(file.name).toMatch(/^Types de projet \d{4}-\d{2}-\d{2}\.json$/)
    expect(mine.notices.at(-1)).toMatch(/^3 type\(s\) de projet exporté\(s\) dans Échanges\/Types de projet\/Types de projet /)
    const data = JSON.parse(new TextDecoder().decode(file.bytes))
    expect(data).toMatchObject({ format: 1, sorte: 'types-de-projet' })
    expect(data.types.map((type: { name: string }) => type.name)).toEqual(['Réponse à un appel d’offres', 'Projet simple', 'Étude amont'])
    // Un seul type, depuis sa page.
    await a.run(await a.load(`programmes.type?${encodeURIComponent('etude-amont')}`), 'export-type')
    const one = exported(mine)
    expect(one.name).toMatch(/^Type de projet Étude amont \d{4}-\d{2}-\d{2}\.json$/)
    expect(JSON.parse(new TextDecoder().decode(one.bytes)).types).toHaveLength(1)
    // Exporté encore le même jour : un autre fichier, pas écrasé.
    await a.run(await a.load('programmes.types'), 'export-types')
    expect(exported(mine).name).toMatch(/^Types de projet \d{4}-\d{2}-\d{2} \(2\)\.json$/)
    await a.stop()

    // Un autre coffre : ses types de départ y sont déjà, « Étude amont » arrive.
    const theirs = memoryPlatform()
    const b = await vault(theirs)
    theirs.choices.push('computer')
    theirs.externalFiles.push([file])
    await b.run(await b.load('programmes.types'), 'import-types')
    expect(theirs.notices.at(-1)).toBe('Types de projet importés : 1 ajouté(s), 2 déjà là.')
    expect(await b.typeNames()).toEqual(['Réponse à un appel d’offres', 'Projet simple', 'Étude amont'])
    expect(b.shown.at(-1)).toBe(`programmes.type?${encodeURIComponent('etude-amont')}`)
    // Une seconde fois : déjà là.
    theirs.choices.push('computer')
    theirs.externalFiles.push([file])
    await b.run(await b.load('programmes.types'), 'import-types')
    expect(theirs.notices.at(-1)).toBe('Types de projet importés : 0 ajouté(s), 3 déjà là.')
    // Un type au nom déjà pris, mais différent : ajouté à côté.
    const changed = JSON.parse(new TextDecoder().decode(one.bytes))
    changed.types[0].description = 'Une autre étude'
    theirs.choices.push('vault')
    theirs.files.set('Reçu/types.json', bytes(JSON.stringify(changed)))
    theirs.nextPick = 'Reçu/types.json'
    await b.run(await b.load('programmes.types'), 'import-types')
    expect(theirs.picks.at(-1)).toMatchObject({ extensions: ['json'] })
    expect(theirs.notices.at(-1)).toBe('Types de projet importés : 1 ajouté(s), 0 déjà là.')
    expect(await b.typeNames()).toEqual(['Réponse à un appel d’offres', 'Projet simple', 'Étude amont', 'Étude amont (importé)'])
    // Pas un fichier de types ; pas du JSON.
    theirs.choices.push('computer')
    theirs.externalFiles.push([{ name: 'x.json', bytes: bytes('{"sorte":"autre"}') }])
    await b.run(await b.load('programmes.types'), 'import-types')
    expect(theirs.notices.at(-1)).toBe('Ce fichier n’est pas un export de types de projet.')
    theirs.choices.push('computer')
    theirs.externalFiles.push([{ name: 'x.json', bytes: bytes('pas du json') }])
    await b.run(await b.load('programmes.types'), 'import-types')
    expect(theirs.notices.at(-1)).toBe('Ce fichier ne peut pas être lu : est-ce bien un fichier .json exporté des types de projet ?')
    expect(read(theirs, 'Reçu/types.json')).toContain('Une autre étude')
  })
})

describe('les phases des projets, sur les pages des programmes', () => {
  it('chaque projet en parcours : ses phases repliées d’origine, retenues page par page ; son titre et son avancement restent', async () => {
    const platform = memoryPlatform()
    const { load, run, shown } = await vault(platform)
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await run(await load('programmes'), 'new')
    const programmePage = shown.at(-1)!
    platform.forms.push({ name: 'Q', programme: 'Programmes/P/P.md', type: 'projet-simple', description: '', affaire: 'false', client: '', reference: '' })
    await run(await load(programmePage), 'project')
    const journeys = (view: PageView) => view.blocks.flatMap((block) => (block.kind === 'section' ? block.blocks : [block])).filter((block): block is Extract<HomeBlock, { kind: 'journey' }> => block.kind === 'journey')
    const [onProgramme] = journeys(await load(programmePage))
    expect(onProgramme).toMatchObject({ title: 'Q', compact: true, fold: { id: 'programmes.programme|Programmes/P/Q/Q.md', collapsed: true } })
    expect(onProgramme!.subtitle).toContain('0/4 phases')
    const [onProgrammes] = journeys(await load('programmes'))
    expect(onProgrammes).toMatchObject({ title: 'Q', fold: { id: 'programmes|Programmes/P/Q/Q.md', collapsed: true } })
  })
})

describe('supprimer un projet, un programme', () => {
  it('un projet : après confirmation, son dossier (note, affaires) à la corbeille ; ses voisins restent ; renoncé, rien ne part', async () => {
    const platform = memoryPlatform()
    const { load, run, shown } = await vault(platform)
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await run(await load('programmes'), 'new')
    const programmePage = shown.at(-1)!
    platform.forms.push({ name: 'Q', programme: 'Programmes/P/P.md', type: 'projet-simple', description: '', affaire: 'true', client: 'CNES', reference: '' })
    await run(await load(programmePage), 'project')
    const projectPage = shown.at(-1)!
    platform.forms.push({ name: 'R', programme: 'Programmes/P/P.md', type: 'projet-simple', description: '', affaire: 'false', client: '', reference: '' })
    await run(await load(programmePage), 'project')
    platform.files.set('Programmes/P/Q/Compte rendu.md', bytes('# Mes notes'))
    const project = await load(projectPage)
    expect(project.actions?.map((action) => action.id)).toEqual(['start', 'affaire', 'note', 'delete'])
    // Renoncé : rien ne part.
    platform.confirmations.push(false)
    await run(project, 'delete')
    expect(platform.confirmed.at(-1)).toMatchObject({ title: 'Supprimer le projet « Q » ?', danger: true })
    expect(platform.confirmed.at(-1)!.message).toContain('Programmes/P/Q')
    expect(platform.confirmed.at(-1)!.message).toContain('ses 1 affaire(s)')
    expect(await platform.fs.exists('Programmes/P/Q/Q.md')).toBe(true)
    // Confirmé : son dossier à la corbeille, et retour au programme.
    platform.confirmations.push(true)
    await run(await load(projectPage), 'delete')
    expect([...platform.files.keys()].filter((path) => path.startsWith('Programmes/P/Q/'))).toEqual([])
    expect(await platform.fs.exists('Programmes/P/Q')).toBe(false)
    expect(await platform.fs.exists('Programmes/P/R/R.md')).toBe(true)
    expect(platform.notices.at(-1)).toBe('Projet « Q » supprimé (à la corbeille du coffre).')
    expect(shown.at(-1)).toBe(programmePage)
    expect((await load(programmePage)).blocks.filter((block) => block.kind === 'journey').map((block) => block.kind === 'journey' && block.title)).toEqual(['R'])
  })

  it('un programme : après confirmation, son dossier, ses projets et leurs affaires à la corbeille ; les autres programmes restent', async () => {
    const platform = memoryPlatform()
    const { load, run, shown } = await vault(platform)
    for (const name of ['P', 'S']) {
      platform.forms.push({ name, code: '', description: '', color: 'indigo', icon: 'folder' })
      await run(await load('programmes'), 'new')
    }
    platform.forms.push({ name: 'Q', programme: 'Programmes/P/P.md', type: 'projet-simple', description: '', affaire: 'true', client: '', reference: '' })
    await run(await load('programmes'), 'project')
    const programmePage = `programmes.programme?${encodeURIComponent('Programmes/P/P.md')}`
    const programme = await load(programmePage)
    expect(programme.actions?.map((action) => action.id)).toEqual(['project', 'edit', 'note', 'delete'])
    platform.confirmations.push(true)
    await run(programme, 'delete')
    expect(platform.confirmed.at(-1)).toMatchObject({ title: 'Supprimer le programme « P » ?', danger: true })
    expect(platform.confirmed.at(-1)!.message).toContain('ses 1 projet(s), leurs 1 affaire(s)')
    expect([...platform.files.keys()].filter((path) => path.startsWith('Programmes/P/'))).toEqual([])
    expect(await platform.fs.exists('Programmes/S/S.md')).toBe(true)
    expect(platform.notices.at(-1)).toBe('Programme « P » supprimé, avec ses 1 projet(s) (à la corbeille du coffre).')
    expect(shown.at(-1)).toBe('programmes')
    const cards = (await load('programmes')).blocks.find((block) => block.kind === 'cards')
    expect(cards?.kind === 'cards' && cards.cards.map((card) => card.title)).toEqual(['S'])
  })

  it('sans corbeille : pas de bouton pour supprimer', async () => {
    const platform = memoryPlatform()
    delete (platform.fs as { trash?: unknown }).trash
    const { load, run, shown } = await vault(platform)
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await run(await load('programmes'), 'new')
    expect((await load(shown.at(-1)!)).actions?.map((action) => action.id)).not.toContain('delete')
  })
})
