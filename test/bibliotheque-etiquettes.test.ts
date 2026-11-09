// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **étiquettes** d'un document de la bibliothèque, en deux passes. Sans IA, à son entrée :
 * dites par le document avec leur mot (« Mots-clés : », « Keywords: », « Étiquettes : ») :
 * sûres, elles sont données. Sinon, à confirmer — avec, proposés, les mots importants qui
 * reviennent le plus au début du texte. Puis l'IA (workflow système du module IA, actif) en
 * donne de 3 à 6, en reprenant de préférence celles déjà en usage ; elle n'invente rien.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock } from '../src/core/views'
import { bibliothequeModule, guessTags, pourIntoLibrary, tagsFoundIn } from '../src/modules/bibliotheque'
import { iaModule, readTagsAnswer } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

/** Les blocs d'une page, ceux de ses sections compris (les messages « à confirmer » y sont regroupés). */
const unfold = (block: HomeBlock): HomeBlock[] => (block.kind === 'section' ? [block, ...block.blocks] : [block])

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'
const TEXT =
  'Rapport de maintenance de l’antenne de la station sol.\nLa maintenance de l’antenne a eu lieu en mars ; la station était arrêtée.\nL’antenne et la station ont été remises en service après la maintenance.'

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = ALL) {
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
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.ia.etiquettes-documents')
  const journal = () => (platform.files.has(JOURNAL) ? read(platform, JOURNAL) : '')
  return { page, pour, system, journal }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la première passe, sans IA', () => {
  it('dites avec leur mot : sûres', () => {
    expect(guessTags('Rapport\nMots-clés : antenne ; station sol, maintenance\nTexte.')).toEqual({ tags: ['antenne', 'station sol', 'maintenance'], sure: true })
    expect(guessTags('Report\nKeywords: ground station, antenna.\n')).toEqual({ tags: ['ground station', 'antenna'], sure: true })
    expect(guessTags('Étiquettes : #achat, #urgent')).toEqual({ tags: ['achat', 'urgent'], sure: true })
  })

  it('sinon, les mots importants qui reviennent le plus : à confirmer ; rien : rien', () => {
    expect(guessTags(TEXT)).toEqual({ tags: ['antenne', 'maintenance', 'station'], sure: false })
    // Des mots longs mais qui ne disent rien du sujet ne sont pas proposés.
    expect(guessTags('Le présent document, le présent document, le présent document.')).toEqual({ tags: [], sure: false })
    expect(guessTags('')).toEqual({ tags: [], sure: false })
  })

  it('le garde-fou : gardées si le document les dit, ou si la bibliothèque les emploie déjà', () => {
    expect(tagsFoundIn(['Antenne', 'station sol', 'météo', 'radar'], TEXT, ['radar'])).toEqual(['Antenne', 'station sol', 'radar'])
    expect(tagsFoundIn(['une étiquette bien trop longue pour en être une'], TEXT, [])).toEqual([])
  })
})

describe('à l’entrée, et sur la fiche', () => {
  it('sûres : données, rien à confirmer', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Rapport.txt', `Rapport de visite\nMots-clés : antenne, station sol\n${TEXT}`)
    expect(doc.tags).toEqual(['antenne', 'station sol'])
    expect(doc.tagsToConfirm).toBeUndefined()
  })

  it('pas sûres : à confirmer — « Prendre ces étiquettes », ou aucune, ou « Classer… »', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Rapport.txt', TEXT)
    expect(doc).toMatchObject({ tags: [], tagsToConfirm: true, tagsProbable: ['antenne', 'maintenance', 'station'] })
    expect(read(platform, doc.record)).toMatch(/\netiquettesAConfirmer: true\n/)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const message = fiche.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Étiquettes à confirmer'))
    expect(message).toMatchObject({ tone: 'warning', text: 'Étiquettes à confirmer : le texte du document suggère « antenne, maintenance, station » (lu sans certitude).' })
    expect(message?.kind === 'message' && message.actions!.map((action) => action.label)).toEqual(['Prendre ces étiquettes', 'Pas d’étiquettes', 'Classer…'])
    expect((await page('bibliotheque.documents').load()).filters?.map((filter) => filter.id)).toContain('etiquettes-a-confirmer')
    await (message?.kind === 'message' ? message.actions![0]!.run() : null)
    expect(platform.notices.at(-1)).toBe('Étiquettes confirmées : antenne, maintenance, station.')
    expect(read(platform, doc.record)).not.toMatch(/etiquettesAConfirmer|etiquettesProbables/)
    // Sans étiquettes proposées : « Pas d'étiquettes » le confirme.
    const other = await pour('Maquette.dwg', 'binaire')
    const view = await page('bibliotheque.document').load(encodeURIComponent(other.record))
    const none = view.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Étiquettes à confirmer'))
    expect(none?.kind === 'message' && none.actions!.map((action) => action.label)).toEqual(['Pas d’étiquettes', 'Classer…'])
    await (none?.kind === 'message' ? none.actions![0]!.run() : null)
    expect(platform.notices.at(-1)).toBe('« Maquette » : sans étiquettes.')
    expect(read(platform, other.record)).not.toMatch(/etiquettesAConfirmer/)
  })
})

describe('la seconde passe, avec l’IA', () => {
  it('lire la réponse : certaine, et des mots du document ou de la bibliothèque ; sinon rien', () => {
    expect(readTagsAnswer({ tags: ['#Antenne', 'maintenance', 'météo'], certain: true }, TEXT, ['Maintenance'])).toEqual(['antenne', 'Maintenance'])
    expect(readTagsAnswer({ tags: ['radar'], certain: true }, TEXT, ['radar'])).toEqual(['radar'])
    expect(readTagsAnswer({ tags: [], certain: true }, TEXT, [])).toEqual([])
    expect(readTagsAnswer({ tags: ['météo', 'aviation'], certain: true }, TEXT, [])).toBeNull()
    expect(readTagsAnswer({ tags: ['antenne'], certain: false }, TEXT, [])).toBeNull()
    expect(readTagsAnswer('pas du JSON', TEXT, [])).toBeNull()
  })

  it('le workflow système : actif, au document versé dont les étiquettes sont à confirmer', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Donner avec l’IA les étiquettes d’un document, quand la première passe n’est pas sûre',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'etiquettesaconfirmer', op: 'not-empty', value: '' }],
      actions: [{ kind: 'ia.etiquettes-document', fields: { fiche: '{fiche}' } }]
    })
  })

  it('pas sûres sans IA : l’IA les donne, en reprenant celles en usage — « données par l’IA »', async () => {
    const platform = memoryPlatform()
    const { page, pour, journal } = await start(platform)
    let asked = ''
    const original = platform.http.request.bind(platform.http)
    platform.http.request = async (request) => {
      if (!request.url.endsWith('/chat/completions')) return original(request)
      platform.requests.push(request)
      const system = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content
      if (system.startsWith('Tu identifies la langue')) return chat('fr')
      if (system.includes('lui donner de 3 à 6 étiquettes')) {
        asked = system
        return chat({ tags: ['maintenance', 'antenne', 'station sol', 'aviation'], certain: true })
      }
      return chat({ title: '', issuer: '', category: '', reference: '', edition: '', revision: '', certain: false })
    }
    // Une étiquette déjà en usage dans la bibliothèque.
    await pour('Plan.txt', 'Plan de maintenance\nMots-clés : Maintenance\nLe plan des opérations.')
    const doc = await pour('Rapport.txt', TEXT)
    expect(asked).toContain('écrites exactement comme elles : Maintenance.')
    expect(read(platform, doc.record)).toMatch(/\netiquettesIdentifieesPar: ia\n/)
    expect(read(platform, doc.record)).not.toMatch(/etiquettesAConfirmer/)
    expect(journal()).toContain('« Rapport » : étiquettes Maintenance, antenne, station sol, données par l’IA.')
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    expect(fiche.blocks.flatMap(unfold).some((block) => block.kind === 'message' && block.text.startsWith('Étiquettes à confirmer'))).toBe(false)
    const identity = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.identite')
    const list = identity?.blocks[0]
    expect(list?.kind === 'list' && list.items.find((item) => item.id === 'tags')?.detail).toBe('Maintenance, antenne, station sol — données par l’IA')
  })
})
