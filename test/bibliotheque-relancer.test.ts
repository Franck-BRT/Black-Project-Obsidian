// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Relancer la recherche** d'un champ dans le document, depuis sa fiche (le bouton à côté du
 * crayon) : la première passe, sans IA, le texte relu — trouvé sûrement, il est donné ; sinon,
 * à confirmer, avec ce qui a été lu. Pas sûr : le workflow système du module IA qui le
 * cherche est exécuté pour ce document (avec ses prompt, persona, skill). Ce qui en sort est
 * dit ; l'IA pas demandée (son workflow désactivé, le module absent) aussi.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem } from '../src/core/views'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'
const NOTE = 'Note sur la station sol\nLa réunion du 12/02/2026 a fixé la suite.'

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
  const fields = async (record: string): Promise<ListItem[]> => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(record))
    const identity = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.identite')
    const list = identity?.blocks[0]
    return list?.kind === 'list' ? list.items : []
  }
  /** Le bouton d'un champ : « edit » ou « research ». */
  const tool = async (record: string, id: string, kind: 'edit' | 'research') => (await fields(record)).find((item) => item.id === id)!.tools!.find((each) => each.id === `${kind}-${id}`)!
  const workflows = () => (settings.workflows?.workflows ?? []) as Workflow[]
  const journal = () => (platform.files.has(JOURNAL) ? read(platform, JOURNAL) : '')
  return { pour, fields, tool, workflows, journal }
}

/** L'IA : chaque consigne a sa réponse ; ce qui n'est pas prévu, une réponse « pas certaine ». */
function answering(platform: MemoryPlatform, answers: (system: string) => unknown) {
  const original = platform.http.request.bind(platform.http)
  platform.http.request = async (request) => {
    if (!request.url.endsWith('/chat/completions')) return original(request)
    platform.requests.push(request)
    const system = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content
    const answer = answers(system)
    return chat(answer ?? { title: '', issuer: '', category: '', date: '', tags: [], reference: '', edition: '', revision: '', certain: false })
  }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('relancer la recherche d’un champ, sans IA', () => {
  it('trouvé sûrement : donné, confirmé, et c’est dit', async () => {
    const platform = memoryPlatform()
    const { pour, tool } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Plan.txt', 'Titre : Plan de management\nRéf. : PMP-01\nÉdition 2\nDate : 12/03/2026\nLe plan.')
    // Changé à la main, puis relancé : ce que dit le document revient.
    platform.forms.push({ value: 'Autre titre' })
    await (await tool(doc.record, 'title', 'edit')).run()
    expect(read(platform, doc.record)).toMatch(/\ntitre: Autre titre\n/)
    await (await tool(doc.record, 'title', 'research')).run()
    expect(read(platform, doc.record)).toMatch(/\ntitre: Plan de management\n/)
    expect(platform.notices.at(-1)).toBe('Titre : trouvé dans le document — Plan de management.')
    platform.forms.push({ value: '2020-01-01' })
    await (await tool(doc.record, 'date', 'edit')).run()
    await (await tool(doc.record, 'date', 'research')).run()
    expect(read(platform, doc.record)).toMatch(/\ndateDocument: "2026-03-12"\n/)
    expect(platform.notices.at(-1)).toBe('Date du document : trouvé dans le document — 12 mars 2026.')
  })

  it('la référence, l’édition, la révision : relancées ensemble', async () => {
    const platform = memoryPlatform()
    const { pour, tool } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Plan.txt', 'Plan de management\nRéf. : PMP-01\nÉdition 2\nLe plan.')
    platform.forms.push({ value: 'X-9' })
    await (await tool(doc.record, 'reference', 'edit')).run()
    await (await tool(doc.record, 'edition', 'research')).run()
    expect(read(platform, doc.record)).toMatch(/\nreference: PMP-01\nedition: "2"\n/)
    expect(platform.notices.at(-1)).toBe('Référence et version : trouvé dans le document — PMP-01, version 2.')
  })

  it('pas sûr : à confirmer, avec ce qui a été lu ; sans le module IA, c’est dit', async () => {
    const platform = memoryPlatform()
    const { pour, tool } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Note.txt', NOTE)
    platform.forms.push({ value: 'Compte rendu' })
    await (await tool(doc.record, 'title', 'edit')).run()
    expect(read(platform, doc.record)).not.toMatch(/titreAConfirmer/)
    await (await tool(doc.record, 'title', 'research')).run()
    expect(read(platform, doc.record)).toMatch(/\ntitre: Compte rendu\n/)
    expect(read(platform, doc.record)).toMatch(/\ntitreAConfirmer: true\ntitreProbable: Note sur la station sol\n/)
    expect(platform.notices.at(-1)).toBe(
      'Titre : pas trouvé sûrement ; « Note sur la station sol » proposé, à confirmer. L’IA n’a pas été demandée (le module IA, ou le module Workflows, n’est pas actif).'
    )
    await (await tool(doc.record, 'issuer', 'research')).run()
    expect(platform.notices.at(-1)).toMatch(/^Émetteur : pas trouvé sûrement ; à confirmer\./)
  })
})

describe('relancer la recherche d’un champ, avec l’IA', () => {
  it('pas sûr sans IA : le workflow système de ce champ, pour ce document — identifié par l’IA', async () => {
    const platform = memoryPlatform()
    const { pour, tool, journal } = await start(platform)
    answering(platform, (system) => (system.startsWith('Tu identifies la langue') ? 'fr' : undefined))
    const doc = await pour('Note.txt', NOTE)
    expect(read(platform, doc.record)).toMatch(/\nemetteurAConfirmer: true\n/)
    const before = platform.requests.length
    // L'IA, cette fois, le trouve.
    answering(platform, (system) => (system.includes('qui a émis') || system.includes('émetteur') ? { issuer: 'station sol', certain: true } : undefined))
    await (await tool(doc.record, 'issuer', 'research')).run()
    // Une seule demande : celle de l'émetteur (pas les autres champs).
    expect(platform.requests.length - before).toBe(1)
    expect(read(platform, doc.record)).toMatch(/\nemetteur: station sol\n/)
    expect(read(platform, doc.record)).toMatch(/\nemetteurIdentifiePar: ia\n/)
    expect(platform.notices.at(-1)).toBe('Émetteur : identifié par l’IA — station sol.')
    expect(journal().split('\n').filter((line) => line.includes('Identifier avec l’IA l’émetteur'))).toHaveLength(2)
  })

  it('trouvé sûrement sans IA : l’IA n’est pas demandée', async () => {
    const platform = memoryPlatform()
    const { pour, tool } = await start(platform)
    answering(platform, () => undefined)
    const doc = await pour('Plan.txt', 'Titre : Plan de management\nLe plan.')
    const before = platform.requests.length
    await (await tool(doc.record, 'title', 'research')).run()
    expect(platform.requests.length).toBe(before)
    expect(platform.notices.at(-1)).toBe('Titre : trouvé dans le document — Plan de management.')
  })

  it('son workflow système désactivé : l’IA n’est pas demandée, et c’est dit', async () => {
    const platform = memoryPlatform()
    const { pour, tool, workflows } = await start(platform)
    answering(platform, () => undefined)
    const doc = await pour('Note.txt', NOTE)
    workflows().find((each) => each.system === 'sys.ia.date-documents')!.enabled = false
    const before = platform.requests.length
    await (await tool(doc.record, 'date', 'research')).run()
    expect(platform.requests.length).toBe(before)
    expect(platform.notices.at(-1)).toBe('Date du document : pas trouvé sûrement ; « 12 février 2026 » proposé, à confirmer. L’IA n’a pas été demandée : son workflow système est désactivé.')
  })
})
