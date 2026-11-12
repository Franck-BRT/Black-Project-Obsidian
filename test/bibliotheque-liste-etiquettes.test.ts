// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La liste des **étiquettes** — un vocabulaire commun, comme les émetteurs : une bibliothèque
 * de la Bibliothèque (Étiquettes), une note par étiquette (son nom, ses autres formes, une par
 * ligne). Les étiquettes d'un document y sont ramenées (« antennes » → « antenne »), y sont
 * reconnues, s'y cochent (le crayon) ; celles qui n'y sont pas sont dites, et un bouton les y
 * ajoute. L'IA reçoit la liste d'abord.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem } from '../src/core/views'
import { bibliothequeModule, canonicalTag, guessTags, pourIntoLibrary, type KnownTag } from '../src/modules/bibliotheque'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule } from '../src/modules/workflows'

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })
const KNOWN: KnownTag[] = [
  { name: 'antenne', aliases: ['antennes', 'antenna'] },
  { name: 'station sol', aliases: [] }
]

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = [lectureFichiersModule, bibliothequeModule]) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ia: SERVEUR }
  const views = new ViewsRegistry()
  for (const module of modules) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: () => {}
    }
    await module.activate(context)
  }
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const pour = async (name: string, text: string) => (await pourIntoLibrary([{ name, bytes: bytes(text) }], { module: 'bibliotheque', label: '' }))!.added[0]!
  /** Une étiquette de la liste, sa note écrite comme le fait l'application. */
  const addTag = (name: string, aliases: string[] = []) =>
    platform.fs.writeText(`Bibliothèque/Étiquettes/${name}.md`, `---\nbp-type: bibliotheque-etiquette\nnom: ${name}\n---\n\n${aliases.join('\n')}\n`)
  const tagsItem = async (record: string): Promise<ListItem | undefined> => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(record))
    const identity = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.identite')
    const list = identity?.blocks[0]
    return list?.kind === 'list' ? list.items.find((item) => item.id === 'tags') : undefined
  }
  return { page, pour, addTag, tagsItem }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la liste des étiquettes', () => {
  it('une bibliothèque de plus : un nom, d’autres formes ; une note par étiquette ; pas d’exemples', async () => {
    const platform = memoryPlatform()
    const { page } = await start(platform)
    const hub = await page('bibliotheque.accueil').load()
    expect(hub.blocks.flatMap((block) => (block.kind === 'section' ? block.blocks : [block])).flatMap((block) => (block.kind === 'cards' ? block.cards : [])).find((card) => card.title === 'Étiquettes')).toMatchObject({ subtitle: '0 étiquette(s)', icon: 'tag' })
    const tags = await page('bibliotheque.tags').load()
    expect(tags.actions?.map((action) => action.id)).not.toContain('starters')
    platform.forms.push({ name: 'antenne', category: '', description: '', text: 'antennes\nantenna', favorite: 'false' })
    await tags.actions!.find((action) => action.id === 'new')!.run()
    const form = platform.asked.at(-1)!
    expect(form.fields[0]).toMatchObject({ key: 'name', label: 'Étiquette', required: true })
    expect(form.fields.find((field) => field.key === 'text')).toMatchObject({ label: 'Autres formes (une par ligne)', required: false })
    expect(read(platform, 'Bibliothèque/Étiquettes/antenne.md')).toBe('---\nbp-type: bibliotheque-etiquette\nnom: antenne\n---\n\nantennes\nantenna\n')
  })

  it('ramenées à la liste, reconnues dans le texte', () => {
    expect(canonicalTag('Antennes', KNOWN)).toBe('antenne')
    expect(canonicalTag('radar', KNOWN)).toBe('radar')
    expect(guessTags('Rapport\nMots-clés : Antennes, Station Sol, radar\n', KNOWN)).toEqual({ tags: ['antenne', 'station sol', 'radar'], sure: true })
    // Sans mots-clés dits : celles de la liste que le texte nomme, proposées.
    expect(guessTags('Les antennes de la station sol ont été révisées.', KNOWN)).toEqual({ tags: ['antenne', 'station sol'], sure: false })
  })
})

describe('les étiquettes d’un document, et la liste', () => {
  it('à l’entrée : celles de la liste que dit le texte, proposées (à confirmer)', async () => {
    const platform = memoryPlatform()
    const { pour, addTag } = await start(platform)
    await addTag('antenne', ['antennes'])
    const doc = await pour('Note.txt', 'Les antennes ont été révisées hier.')
    expect(doc).toMatchObject({ tagsToConfirm: true, tagsProbable: ['antenne'] })
  })

  it('hors de la liste : dit, et un bouton les y ajoute (cochées) ; dans la liste, plus rien à dire', async () => {
    const platform = memoryPlatform()
    const { pour, addTag, tagsItem } = await start(platform)
    await addTag('antenne')
    const doc = await pour('Note.txt', 'Rapport\nMots-clés : antenne, radar, météo\nTexte.')
    const item = await tagsItem(doc.record)
    expect(item?.detail).toBe('antenne, radar, météo — hors de la liste : radar, météo')
    expect(item?.tools?.map((tool) => [tool.id, tool.label, tool.icon])).toContainEqual(['add-tags', 'Ajouter à la liste des étiquettes : radar, météo', 'plus'])
    platform.manyAnswers.push(['radar'])
    await item!.tools!.find((tool) => tool.id === 'add-tags')!.run()
    expect(platform.manyAsked.at(-1)).toMatchObject({ title: 'Ajouter à la liste des étiquettes', choices: [{ value: 'radar' }, { value: 'météo' }] })
    expect(platform.files.has('Bibliothèque/Étiquettes/radar.md')).toBe(true)
    expect(platform.files.has('Bibliothèque/Étiquettes/météo.md')).toBe(false)
    expect(platform.notices.at(-1)).toBe('1 étiquette(s) ajoutée(s) à la liste : radar.')
    expect((await tagsItem(doc.record))?.detail).toBe('antenne, radar, météo — hors de la liste : météo')
  })

  it('le crayon : à cocher dans la liste ; « Autre(s) étiquette(s)… » les écrit, et les ajoute à la liste', async () => {
    const platform = memoryPlatform()
    const { pour, addTag, tagsItem } = await start(platform)
    await addTag('station sol')
    await addTag('antenne', ['antennes'])
    const doc = await pour('Note.txt', 'Rapport\nMots-clés : antennes, vieux mot\nTexte.')
    expect(doc.tags).toEqual(['antenne', 'vieux mot'])
    platform.manyAnswers.push(null)
    await (await tagsItem(doc.record))!.tools![0]!.run()
    const view = platform.manyAsked.at(-1)!
    expect(view.choices.map((choice) => choice.label)).toEqual(['antenne', 'station sol', 'vieux mot (hors de la liste des étiquettes)', '＋ Autre(s) étiquette(s)…'])
    expect(view.choices[0]).toMatchObject({ description: 'antennes' })
    expect(view.selected).toEqual(['antenne', 'vieux mot'])
    // « station sol » cochée, « vieux mot » décochée, et une autre écrite, ajoutée à la liste.
    platform.manyAnswers.push(['antenne', 'station sol', view.choices.at(-1)!.value])
    platform.forms.push({ value: 'Pylône', list: 'true' })
    await (await tagsItem(doc.record))!.tools![0]!.run()
    expect(read(platform, doc.record)).toMatch(/\netiquettes:\n- antenne\n- station sol\n- Pylône\n/)
    expect(platform.files.has('Bibliothèque/Étiquettes/Pylône.md')).toBe(true)
    expect((await tagsItem(doc.record))?.detail).toBe('antenne, station sol, Pylône')
    expect(platform.notices.at(-1)).toBe('Étiquettes : antenne, station sol, Pylône.')
  })
})

describe('avec l’IA', () => {
  it('la liste d’abord, dans la consigne ; une autre forme donnée est ramenée à l’étiquette', async () => {
    const platform = memoryPlatform()
    const { pour, addTag } = await start(platform, ALL)
    await addTag('antenne', ['antennes'])
    let asked = ''
    const original = platform.http.request.bind(platform.http)
    platform.http.request = async (request) => {
      if (!request.url.endsWith('/chat/completions')) return original(request)
      platform.requests.push(request)
      const system = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content
      if (system.startsWith('Tu identifies la langue')) return chat('fr')
      if (system.includes('lui donner de 3 à 6 étiquettes')) {
        asked = system
        return chat({ tags: ['antennes', 'révision'], certain: true })
      }
      return chat({ title: '', issuer: '', category: '', date: '', reference: '', edition: '', revision: '', certain: false })
    }
    const doc = await pour('Note.txt', 'La révision des antennes est faite.')
    expect(asked).toContain('écrites exactement comme elles : antenne.')
    expect(read(platform, doc.record)).toMatch(/\netiquettes:\n- antenne\n- révision\n/)
  })
})
