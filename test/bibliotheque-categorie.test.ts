// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **catégorie** d'un document de la bibliothèque, en deux passes. Sans IA, à son entrée :
 * donnée par celui qui dépose (le type d'une pièce), dite par le document (« Type de
 * document : »), ou le nom du fichier et le texte d'accord : sûre. Sinon, à confirmer — celle
 * du nom du fichier reste, celle que le texte suggère est proposée. Puis l'IA (workflow
 * système du module IA, actif) choisit dans la liste des catégories connues.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock } from '../src/core/views'
import { bibliothequeModule, guessDocCategory, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule, readCategoryAnswer } from '../src/modules/ia'
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
const COVER = 'Cahier des clauses techniques particulières de la station sol\nLe présent document décrit les clauses techniques du marché.'

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
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.ia.categorie-documents')
  const journal = () => (platform.files.has(JOURNAL) ? read(platform, JOURNAL) : '')
  return { page, pour, system, journal }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la première passe, sans IA', () => {
  it('donnée par celui qui dépose, dite par le document, ou le nom et le texte d’accord : sûre', () => {
    expect(guessDocCategory('', 'Pièce 3.pdf', 'CCAP')).toEqual({ category: 'CCAP', sure: true, probable: '' })
    expect(guessDocCategory('Type de document : Bordereau des prix unitaires\n…', 'x.pdf')).toEqual({ category: 'BPU', sure: true, probable: '' })
    expect(guessDocCategory(COVER, 'CCTP station.pdf')).toEqual({ category: 'CCTP', sure: true, probable: '' })
  })

  it('sinon : à confirmer — le nom du fichier seul, le texte seul, ou en désaccord', () => {
    expect(guessDocCategory('Bonjour.', 'CCTP station.pdf')).toEqual({ category: 'CCTP', sure: false, probable: '' })
    expect(guessDocCategory(COVER, 'Pièce 3.pdf')).toEqual({ category: '', sure: false, probable: 'CCTP' })
    expect(guessDocCategory(COVER, 'Devis station.pdf')).toEqual({ category: 'Devis', sure: false, probable: 'CCTP' })
    expect(guessDocCategory('Bonjour.', 'Pièce 3.pdf')).toEqual({ category: '', sure: false, probable: '' })
  })
})

describe('à l’entrée, et sur la fiche', () => {
  it('sûre : rien à confirmer ; à confirmer : « Prendre » la suggérée, ou garder, ou « Classer… »', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const sure = await pour('CCTP station.txt', COVER)
    expect(sure.category).toBe('CCTP')
    expect(sure.categoryToConfirm).toBeUndefined()
    const doc = await pour('Devis station.txt', COVER.replace('station sol', 'antenne'))
    expect(doc).toMatchObject({ category: 'Devis', categoryToConfirm: true, categoryProbable: 'CCTP' })
    expect(read(platform, doc.record)).toMatch(/\ncategorieAConfirmer: true\ncategorieProbable: CCTP\n/)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const message = fiche.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Catégorie à confirmer'))
    expect(message).toMatchObject({ tone: 'warning', text: 'Catégorie à confirmer : le texte du document suggère « CCTP » ; sa catégorie actuelle, « Devis », vient du nom du fichier.' })
    expect(message?.kind === 'message' && message.actions!.map((action) => action.label)).toEqual(['Prendre « CCTP »', 'Garder la catégorie actuelle', 'Classer…'])
    expect((await page('bibliotheque.documents').load()).filters?.map((filter) => filter.id)).toContain('categorie-a-confirmer')
    await (message?.kind === 'message' ? message.actions![0]!.run() : null)
    expect(platform.notices.at(-1)).toBe('Catégorie confirmée : « CCTP ».')
    expect(read(platform, doc.record)).toMatch(/\ncategorie: CCTP\n/)
    expect(read(platform, doc.record)).not.toMatch(/categorieAConfirmer/)
    // Rien de dit : « Pas de catégorie ».
    const other = await pour('Pièce 3.txt', 'Bonjour.')
    const view = await page('bibliotheque.document').load(encodeURIComponent(other.record))
    const none = view.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Catégorie à confirmer'))
    expect(none?.kind === 'message' && none.actions!.map((action) => action.label)).toEqual(['Pas de catégorie', 'Classer…'])
  })
})

describe('la seconde passe, avec l’IA', () => {
  it('lire la réponse : une catégorie de la liste (à la casse près) ; vide et certaine : aucune ; sinon rien', () => {
    const list = ['CCTP', 'CCAP', 'Devis', 'Acte d’engagement']
    expect(readCategoryAnswer({ category: 'cctp', certain: true }, list)).toBe('CCTP')
    expect(readCategoryAnswer({ category: '« Acte d’engagement »', certain: true }, list)).toBe('Acte d’engagement')
    expect(readCategoryAnswer({ category: 'Spécification', certain: true }, list)).toBeNull()
    expect(readCategoryAnswer({ category: '', certain: true }, list)).toBe('')
    expect(readCategoryAnswer({ category: 'CCTP', certain: false }, list)).toBeNull()
  })

  it('le workflow système : actif, au document versé dont la catégorie est à confirmer', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Identifier avec l’IA la catégorie d’un document, quand la première passe n’est pas sûre',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'categorieaconfirmer', op: 'not-empty', value: '' }],
      actions: [{ kind: 'ia.categorie-document', fields: { fiche: '{fiche}' } }]
    })
  })

  it('pas sûre sans IA : l’IA choisit dans la liste — donnée, « identifiée par l’IA »', async () => {
    const platform = memoryPlatform()
    const { pour, journal } = await start(platform)
    let listed = ''
    const original = platform.http.request.bind(platform.http)
    platform.http.request = async (request) => {
      if (!request.url.endsWith('/chat/completions')) return original(request)
      platform.requests.push(request)
      const system = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content
      if (system.startsWith('Tu identifies la langue')) return chat('fr')
      if (system.includes('de quelle sorte il est')) {
        listed = system
        return chat({ category: 'CCTP', certain: true })
      }
      return chat({ title: '', issuer: '', reference: '', edition: '', revision: '', certain: false })
    }
    const doc = await pour('Pièce 3.txt', COVER)
    expect(listed).toContain('CCTP, CCAP, RC, BPU')
    expect(read(platform, doc.record)).toMatch(/\ncategorie: CCTP\n/)
    expect(read(platform, doc.record)).toMatch(/\ncategorieIdentifieePar: ia\n/)
    expect(journal()).toContain('« Pièce 3 » : CCTP, identifiée par l’IA.')
  })
})
