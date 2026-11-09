// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le **titre** d'un document de la bibliothèque, en deux passes. Sans IA, à son entrée : dit
 * par le document avec son mot (« Titre : … », « Objet : … ») ou en titre de note (« # … ») :
 * sûr, il remplace celui du nom du fichier. Sinon, le titre reste celui du nom du fichier, à
 * confirmer — avec le titre probable lu au début du texte. Puis l'IA (workflow système du
 * module IA, actif) le tranche ; ses mots doivent être ceux du document.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock } from '../src/core/views'
import { bibliothequeModule, guessTitle, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule, readTitleAnswer } from '../src/modules/ia'
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
const COVER = 'Cahier des clauses techniques particulières de la station sol\nRéf. : CCTP-2026-118\nÉdition 3\nLe présent document décrit la station.'

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
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.ia.titre-documents')
  const journal = () => (platform.files.has(JOURNAL) ? read(platform, JOURNAL) : '')
  return { page, pour, system, journal }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la première passe, sans IA', () => {
  it('dit avec son mot, ou en titre de note : sûr', () => {
    expect(guessTitle('Titre : Plan de management de projet\nRéf. : PMP-01')).toEqual({ title: 'Plan de management de projet', sure: true })
    expect(guessTitle('Objet : Fourniture d’une station sol\n')).toEqual({ title: 'Fourniture d’une station sol', sure: true })
    expect(guessTitle('# Note de la visite du site\n\nTexte.')).toEqual({ title: 'Note de la visite du site', sure: true })
  })

  it('sinon, la première ligne qui a l’air d’un titre : probable ; rien : rien', () => {
    expect(guessTitle(COVER)).toEqual({ title: 'Cahier des clauses techniques particulières de la station sol', sure: false })
    // Une page, une date, une référence ne sont pas des titres.
    expect(guessTitle('Page 1/12\n12/03/2026\nRéf. : ABC-12-X\nRapport de recette des antennes')).toEqual({ title: 'Rapport de recette des antennes', sure: false })
    expect(guessTitle('')).toEqual({ title: '', sure: false })
    // Le nom de l'organisme, en tête de page de garde, est l'émetteur : pas le titre.
    expect(guessTitle('Agence spatiale européenne\nSpécification de la station sol')).toEqual({ title: 'Spécification de la station sol', sure: false })
  })
})

describe('à l’entrée, et sur la fiche', () => {
  it('sûr : il remplace celui du nom du fichier, rien à confirmer', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('pmp_v2.txt', 'Titre : Plan de management de projet\nLe présent plan décrit l’organisation.')
    expect(doc.title).toBe('Plan de management de projet')
    expect(doc.titleToConfirm).toBeUndefined()
    // La fiche garde le nom du fichier : elle ne bouge pas.
    expect(doc.record).toBe('Bibliothèque/pmp v2.md')
  })

  it('pas sûr : celui du nom du fichier, à confirmer — « Prendre » le probable, ou le garder', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('CCTP_v3.txt', COVER)
    expect(doc).toMatchObject({ title: 'CCTP v3', titleToConfirm: true, titleProbable: 'Cahier des clauses techniques particulières de la station sol' })
    expect(read(platform, doc.record)).toMatch(/\ntitreAConfirmer: true\ntitreProbable: Cahier des clauses/)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const message = fiche.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Titre à confirmer'))
    expect(message).toMatchObject({ tone: 'warning', text: expect.stringContaining('« Cahier des clauses techniques particulières de la station sol » (lu sans certitude)') })
    expect(message?.kind === 'message' && message.actions!.map((action) => action.id)).toEqual(['use-title', 'keep-title', 'classify-title'])
    expect((await page('bibliotheque.documents').load()).filters?.map((filter) => filter.id)).toContain('titre-a-confirmer')
    await (message?.kind === 'message' ? message.actions![0]!.run() : null)
    expect(platform.notices.at(-1)).toBe('Titre confirmé : « Cahier des clauses techniques particulières de la station sol ».')
    expect(read(platform, doc.record)).toMatch(/\ntitre: Cahier des clauses techniques particulières de la station sol\n/)
    expect(read(platform, doc.record)).not.toMatch(/titreAConfirmer/)
    // Sans titre probable : « C'est juste » garde celui du nom du fichier.
    const other = await pour('Maquette.dwg', 'binaire')
    const view = await page('bibliotheque.document').load(encodeURIComponent(other.record))
    const keep = view.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Titre à confirmer'))
    expect(keep?.kind === 'message' && keep.actions!.map((action) => action.label)).toEqual(['C’est juste', 'Classer…'])
    await (keep?.kind === 'message' ? keep.actions![0]!.run() : null)
    expect(read(platform, other.record)).not.toMatch(/titreAConfirmer/)
  })
})

describe('la seconde passe, avec l’IA', () => {
  it('lire la réponse : certaine, et faite des mots du document ; sinon rien', () => {
    expect(readTitleAnswer({ title: '« Cahier des clauses techniques particulières »', certain: true }, COVER, 'CCTP_v3.txt')).toBe('Cahier des clauses techniques particulières')
    expect(readTitleAnswer({ title: 'Marché de maintenance aéronautique', certain: true }, COVER, 'CCTP_v3.txt')).toBe('')
    expect(readTitleAnswer({ title: 'Cahier des clauses techniques particulières', certain: false }, COVER, 'CCTP_v3.txt')).toBe('')
    expect(readTitleAnswer('pas du JSON', COVER, 'x.txt')).toBe('')
  })

  it('le workflow système : actif, au document versé dont le titre est à confirmer', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Identifier avec l’IA le titre d’un document, quand la première passe n’est pas sûre',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'titreaconfirmer', op: 'not-empty', value: '' }],
      actions: [{ kind: 'ia.titre-document', fields: { fiche: '{fiche}' } }]
    })
  })

  it('pas sûr sans IA : l’IA le dit — donné, « identifié par l’IA » ; pas certaine : à confirmer', async () => {
    const platform = memoryPlatform()
    const { page, pour, journal } = await start(platform)
    // L'IA est demandée pour chacun de ce qui n'est pas sûr : la langue, la référence et la version, le titre.
    const answer = (request: { body?: string }) => {
      const system = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content
      if (system.startsWith('Tu identifies la langue')) return chat('fr')
      if (system.includes('pour trouver son titre')) return chat({ title: 'Cahier des clauses techniques particulières de la station sol', certain: true })
      return chat({ reference: '', edition: '', revision: '', certain: false })
    }
    const original = platform.http.request.bind(platform.http)
    platform.http.request = async (request) => {
      if (request.url.endsWith('/chat/completions')) {
        platform.requests.push(request)
        return answer(request)
      }
      return original(request)
    }
    const doc = await pour('CCTP_v3.txt', COVER.replace('Réf. : CCTP-2026-118\nÉdition 3\n', ''))
    expect(read(platform, doc.record)).toMatch(/\ntitre: Cahier des clauses techniques particulières de la station sol\n/)
    expect(read(platform, doc.record)).toMatch(/\ntitreIdentifiePar: ia\n/)
    expect(journal()).toContain('Titre identifié par l’IA : « Cahier des clauses techniques particulières de la station sol ».')
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    expect(fiche.blocks.flatMap(unfold).some((block) => block.kind === 'message' && block.text.startsWith('Titre à confirmer'))).toBe(false)
  })
})
