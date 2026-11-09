// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **date** d'un document de la bibliothèque, en deux passes. Sans IA, à son entrée : dite
 * par le document avec son mot (« Date : », « Émis le », « Toulouse, le 12 mars 2026 »), ou
 * le nom du fichier et le texte d'accord : sûre. Sinon, à confirmer — avec la première date
 * du début du texte (hors dates limites), ou celle du nom. Puis l'IA (workflow système du
 * module IA, actif) la cherche ; elle doit figurer dans le document.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock } from '../src/core/views'
import { bibliothequeModule, dateFoundIn, docDateLabel, guessDocDate, parseDocDate, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule, readDateAnswer } from '../src/modules/ia'
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
const LETTER = 'Toulouse, le 1er mars 2026\nMadame,\nLa réunion du 12/02/2026 a fixé la suite.'
const NOTE = 'Note sur la station sol\nLa réunion du 12/02/2026 a fixé la suite ; la date limite de remise est le 30/04/2026.'

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
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.ia.date-documents')
  const journal = () => (platform.files.has(JOURNAL) ? read(platform, JOURNAL) : '')
  return { page, pour, system, journal }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la première passe, sans IA', () => {
  it('dite avec son mot, ou le nom du fichier et le texte d’accord : sûre', () => {
    expect(guessDocDate('Rapport\nDate : 12/03/2026\nTexte')).toEqual({ date: '2026-03-12', sure: true })
    expect(guessDocDate(LETTER)).toEqual({ date: '2026-03-01', sure: true })
    expect(guessDocDate('Note\nÉmis le 5 avril 2025')).toEqual({ date: '2025-04-05', sure: true })
    expect(guessDocDate('Issue date: March 12, 2026')).toEqual({ date: '2026-03-12', sure: true })
    expect(guessDocDate('Date d’édition : 2026-03-12')).toEqual({ date: '2026-03-12', sure: true })
    expect(guessDocDate('Le CCTP du 14 février 2026 est remplacé.', 'CCTP_2026-02-14.pdf')).toEqual({ date: '2026-02-14', sure: true })
  })

  it('sinon, la première date du texte (pas une date limite), ou celle du nom : à confirmer ; rien : rien', () => {
    expect(guessDocDate(NOTE)).toEqual({ date: '2026-02-12', sure: false })
    expect(guessDocDate('Date limite de remise des offres : 12/04/2026')).toEqual({ date: '', sure: false })
    expect(guessDocDate('Rapport de mars 2026')).toEqual({ date: '2026-03', sure: false })
    expect(guessDocDate('', 'PV_20260312.pdf')).toEqual({ date: '2026-03-12', sure: false })
    expect(guessDocDate('Version 1.2.3, sans date')).toEqual({ date: '', sure: false })
  })

  it('lire une date écrite à la main ; la dire en mots ; le garde-fou', () => {
    expect(['12 mars 2026', '12/03/2026', '2026-03-12', '1er mars 2026', '03/25/2026', '30/02/2026', 'demain'].map(parseDocDate)).toEqual(['2026-03-12', '2026-03-12', '2026-03-12', '2026-03-01', '2026-03-25', '', ''])
    expect(docDateLabel('2026-03-12')).toBe('12 mars 2026')
    expect(docDateLabel('2026-03')).toBe('mars 2026')
    expect(docDateLabel('2026-03-12', 'en-GB')).toBe('12 March 2026')
    expect(dateFoundIn('2026-02-12', NOTE)).toBe(true)
    expect(dateFoundIn('2026-02', NOTE)).toBe(true)
    expect(dateFoundIn('2026-01-01', NOTE)).toBe(false)
  })
})

describe('à l’entrée, et sur la fiche', () => {
  it('sûre : donnée, rien à confirmer ; dite en mots sur la fiche', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Courrier.txt', LETTER)
    expect(doc.date).toBe('2026-03-01')
    expect(doc.dateToConfirm).toBeUndefined()
    expect(read(platform, doc.record)).toMatch(/\ndateDocument: "2026-03-01"\n/)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const identity = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.identite')
    const list = identity?.blocks[0]
    expect(list?.kind === 'list' && list.items.find((item) => item.id === 'date')).toMatchObject({ title: 'Date du document', detail: '1 mars 2026' })
  })

  it('pas sûre : à confirmer — « Prendre « … » », « Pas de date », « Classer… »', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Note.txt', NOTE)
    expect(doc).toMatchObject({ dateToConfirm: true, dateProbable: '2026-02-12' })
    expect(doc.date).toBeUndefined()
    expect(read(platform, doc.record)).toMatch(/\ndateAConfirmer: true\ndateProbable: "2026-02-12"\n/)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const message = fiche.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Date à confirmer'))
    expect(message).toMatchObject({ tone: 'warning', text: 'Date à confirmer : la date lue au début du document est « 12 février 2026 » (lu sans certitude).' })
    expect(message?.kind === 'message' && message.actions!.map((action) => action.label)).toEqual(['Prendre « 12 février 2026 »', 'Pas de date', 'Classer…'])
    expect((await page('bibliotheque.documents').load()).filters?.map((filter) => filter.id)).toContain('date-a-confirmer')
    await (message?.kind === 'message' ? message.actions![0]!.run() : null)
    expect(platform.notices.at(-1)).toBe('Date confirmée : 12 février 2026.')
    expect(read(platform, doc.record)).toMatch(/\ndateDocument: "2026-02-12"\n/)
    expect(read(platform, doc.record)).not.toMatch(/dateAConfirmer|dateProbable/)
    // Sans date lue : « Pas de date » le confirme.
    const other = await pour('Maquette.dwg', 'binaire')
    const view = await page('bibliotheque.document').load(encodeURIComponent(other.record))
    const none = view.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Date à confirmer'))
    expect(none?.kind === 'message' && none.actions!.map((action) => action.label)).toEqual(['Pas de date', 'Classer…'])
    await (none?.kind === 'message' ? none.actions![0]!.run() : null)
    expect(platform.notices.at(-1)).toBe('« Maquette » : sans date.')
  })

  it('« Classer… » : une date écrite comme on veut ; illisible, celle d’avant reste et c’est dit', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Note.txt', NOTE)
    const classify = async (date: string) => {
      platform.forms.push({ title: 'Note', category: '', reference: '', edition: '', revision: '', issuer: '', date, tags: '' })
      await (await page('bibliotheque.document').load(encodeURIComponent(doc.record))).actions!.find((action) => action.id === 'classify')!.run()
    }
    await classify('3 mars 2026')
    expect(platform.asked.at(-1)!.fields.find((field) => field.key === 'date')).toMatchObject({ label: 'Date du document', value: '' })
    expect(read(platform, doc.record)).toMatch(/\ndateDocument: "2026-03-03"\n/)
    expect(read(platform, doc.record)).not.toMatch(/dateAConfirmer/)
    await classify('bientôt')
    expect(read(platform, doc.record)).toMatch(/\ndateDocument: "2026-03-03"\n/)
    expect(platform.notices.at(-1)).toContain('La date « bientôt » n’a pas pu être lue : celle d’avant reste.')
    await classify('')
    expect(read(platform, doc.record)).not.toMatch(/dateDocument/)
  })
})

describe('la seconde passe, avec l’IA', () => {
  it('lire la réponse : certaine, et dite par le document ; sinon rien', () => {
    expect(readDateAnswer({ date: '2026-02-12', certain: true }, NOTE)).toBe('2026-02-12')
    expect(readDateAnswer({ date: '12 février 2026', certain: true }, NOTE)).toBe('2026-02-12')
    expect(readDateAnswer({ date: '', certain: true }, NOTE)).toBe('')
    expect(readDateAnswer({ date: '2026-06-01', certain: true }, NOTE)).toBeNull()
    expect(readDateAnswer({ date: '2026-02-12', certain: false }, NOTE)).toBeNull()
    expect(readDateAnswer('pas du JSON', NOTE)).toBeNull()
  })

  it('le workflow système : actif, au document versé dont la date est à confirmer', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Identifier avec l’IA la date d’un document, quand la première passe n’est pas sûre',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'dateaconfirmer', op: 'not-empty', value: '' }],
      actions: [{ kind: 'ia.date-document', fields: { fiche: '{fiche}' } }]
    })
  })

  it('pas sûre sans IA : l’IA la trouve — donnée, « identifiée par l’IA »', async () => {
    const platform = memoryPlatform()
    const { page, pour, journal } = await start(platform)
    const original = platform.http.request.bind(platform.http)
    platform.http.request = async (request) => {
      if (!request.url.endsWith('/chat/completions')) return original(request)
      platform.requests.push(request)
      const system = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content
      if (system.startsWith('Tu identifies la langue')) return chat('fr')
      if (system.includes('pour trouver sa date')) return chat({ date: '2026-02-12', certain: true })
      return chat({ title: '', issuer: '', category: '', tags: [], reference: '', edition: '', revision: '', certain: false })
    }
    const doc = await pour('Note.txt', NOTE)
    expect(read(platform, doc.record)).toMatch(/\ndateDocument: "2026-02-12"\n/)
    expect(read(platform, doc.record)).toMatch(/\ndateIdentifieePar: ia\n/)
    expect(journal()).toContain('« Note » : date 12 février 2026, identifiée par l’IA.')
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    expect(fiche.blocks.flatMap(unfold).some((block) => block.kind === 'message' && block.text.startsWith('Date à confirmer'))).toBe(false)
    const identity = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.identite')
    const list = identity?.blocks[0]
    expect(list?.kind === 'list' && list.items.find((item) => item.id === 'date')?.detail).toBe('12 février 2026 — identifiée par l’IA')
  })
})
