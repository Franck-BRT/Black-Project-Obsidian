// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le **type de pièce** d'un document de la bibliothèque (son ancienne « catégorie »), dans la
 * liste du module Typage des pièces — ses types, ceux de l'utilisateur, sans les désactivés ;
 * sans ce module, les catégories de la bibliothèque. En deux passes. Sans IA, à son entrée :
 * donné par celui qui dépose (le type d'une pièce), dit par le document (« Type de document
 * : »), ou le nom du fichier et le texte d'accord : sûr. Sinon, à confirmer — celui du nom
 * du fichier reste, celui que le texte suggère est proposé. Puis l'IA (workflow système du
 * module IA, actif) choisit dans la liste, par son code ou son libellé.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock } from '../src/core/views'
import { bibliothequeModule, guessDocCategory, pieceTypeCode, pourIntoLibrary, type PieceTyper } from '../src/modules/bibliotheque'
import { iaModule, readCategoryAnswer } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

/** Les blocs d'une page, ceux de ses sections compris (les messages « à confirmer » y sont regroupés). */
const unfold = (block: HomeBlock): HomeBlock[] => (block.kind === 'section' ? [block, ...block.blocks] : [block])

const ALL = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, workflowsModule, iaModule]
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
  // Sans le module Typage des pièces : les catégories de la bibliothèque.
  it('donné par celui qui dépose, dit par le document, ou le nom et le texte d’accord : sûr', () => {
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

  it('les types d’un autre module : leur liste, leurs mots-clés ; un type écrit par son code ou son libellé', () => {
    const typer: PieceTyper = {
      types: () => [
        { code: 'CCTP', label: 'Cahier des clauses techniques particulières' },
        { code: 'PAQ', label: 'Plan d’assurance qualité' }
      ],
      ofName: (name) => (/paq/i.test(name) ? 'PAQ' : /cctp/i.test(name) ? 'CCTP' : ''),
      ofText: (text) => (/assurance qualité/i.test(text) ? 'PAQ' : '')
    }
    expect(guessDocCategory('Plan d’assurance qualité du projet', 'PAQ v2.pdf', '', typer)).toEqual({ category: 'PAQ', sure: true, probable: '' })
    expect(guessDocCategory('Type de document : Plan d’assurance qualité', 'x.pdf', '', typer)).toEqual({ category: 'PAQ', sure: true, probable: '' })
    expect(guessDocCategory('Plan d’assurance qualité du projet', 'Devis.pdf', '', typer)).toEqual({ category: '', sure: false, probable: 'PAQ' })
    expect(pieceTypeCode('plan d’assurance QUALITE', typer)).toBe('PAQ')
    expect(pieceTypeCode('cctp', typer)).toBe('CCTP')
    expect(pieceTypeCode('Devis', typer)).toBe('')
  })
})

describe('à l’entrée, et sur la fiche', () => {
  it('la liste du module Typage des pièces : sûr, ou à confirmer — « Prendre » le suggéré, « Pas de type de pièce », « Classer… »', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, typagePiecesModule, bibliothequeModule])
    const sure = await pour('CCTP station.txt', COVER)
    expect(sure.category).toBe('CCTP')
    expect(sure.categoryToConfirm).toBeUndefined()
    // « Devis » n'est pas un type de pièce : rien du nom, le texte suggère CCTP.
    const doc = await pour('Devis station.txt', COVER.replace('station sol', 'antenne'))
    expect(doc).toMatchObject({ category: '', categoryToConfirm: true, categoryProbable: 'CCTP' })
    expect(read(platform, doc.record)).toMatch(/\ncategorieAConfirmer: true\ncategorieProbable: CCTP\n/)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const message = fiche.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Type de pièce à confirmer'))
    expect(message).toMatchObject({ tone: 'warning', text: 'Type de pièce à confirmer : le texte du document suggère « CCTP » (lu sans certitude).' })
    expect(message?.kind === 'message' && message.actions!.map((action) => action.label)).toEqual(['Prendre « CCTP »', 'Pas de type de pièce', 'Classer…'])
    expect((await page('bibliotheque.documents').load()).filters?.find((filter) => filter.id === 'categorie-a-confirmer')?.label).toBe('Type de pièce à confirmer')
    await (message?.kind === 'message' ? message.actions![0]!.run() : null)
    expect(platform.notices.at(-1)).toBe('Type de pièce confirmé : « CCTP ».')
    expect(read(platform, doc.record)).toMatch(/\ncategorie: CCTP\n/)
    expect(read(platform, doc.record)).not.toMatch(/categorieAConfirmer/)
    // Sur la fiche : le code et le libellé.
    const again = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const identity = again.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.identite')
    const list = identity?.blocks[0]
    expect(list?.kind === 'list' && list.items.find((item) => item.id === 'category')).toMatchObject({ title: 'Type de pièce', detail: 'CCTP — Cahier des clauses techniques particulières' })
  })

  it('le modifier : une liste — « Aucun », les types du module, celui qu’il a s’il n’y est pas', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, typagePiecesModule, bibliothequeModule])
    const doc = await pour('Devis station.txt', 'Bonjour.')
    // Une ancienne catégorie, hors de la liste.
    await platform.fs.writeText(doc.record, read(platform, doc.record).replace(/\ncategorie: [^\n]*\n/, '\ncategorie: Devis\n'))
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const identity = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.identite')
    const list = identity?.blocks[0]
    const item = list?.kind === 'list' ? list.items.find((each) => each.id === 'category') : undefined
    platform.forms.push({ value: 'RC' })
    await item!.tools![0]!.run()
    const field = platform.asked.at(-1)!.fields[0]!
    expect(field.kind).toBe('choice')
    const labels = field.kind === 'choice' ? field.options.map((option) => option.label) : []
    expect(labels[0]).toBe('— Aucun —')
    expect(labels).toContain('CCTP — Cahier des clauses techniques particulières')
    expect(labels).toContain('RC — Règlement de la consultation')
    expect(labels.at(-1)).toBe('Devis (hors de la liste des types)')
    expect(field).toMatchObject({ value: 'Devis' })
    expect(read(platform, doc.record)).toMatch(/\ncategorie: RC\n/)
    expect(platform.notices.at(-1)).toBe('Type de pièce : RC — Règlement de la consultation.')
    // « Classer… » aussi : une liste.
    platform.forms.push(null)
    await fiche.actions!.find((action) => action.id === 'classify')!.run()
    expect(platform.asked.at(-1)!.fields.find((each) => each.key === 'category')?.kind).toBe('choice')
  })

  it('sans le module Typage des pièces : les catégories de la bibliothèque', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Devis station.txt', COVER.replace('station sol', 'antenne'))
    expect(doc).toMatchObject({ category: 'Devis', categoryToConfirm: true, categoryProbable: 'CCTP' })
  })
})

describe('la seconde passe, avec l’IA', () => {
  it('lire la réponse : un type de la liste, par son code ou son libellé (à la casse près) ; vide et certaine : aucun ; sinon rien', () => {
    const list = ['CCTP', 'CCAP', 'Devis', 'Acte d’engagement']
    expect(readCategoryAnswer({ category: 'cctp', certain: true }, list)).toBe('CCTP')
    expect(readCategoryAnswer({ category: '« Acte d’engagement »', certain: true }, list)).toBe('Acte d’engagement')
    expect(readCategoryAnswer({ category: 'Spécification', certain: true }, list)).toBeNull()
    expect(readCategoryAnswer({ category: '', certain: true }, list)).toBe('')
    expect(readCategoryAnswer({ category: 'CCTP', certain: false }, list)).toBeNull()
    const types = [{ code: 'CCTP', label: 'Cahier des clauses techniques particulières' }, { code: 'RC', label: 'Règlement de la consultation' }]
    expect(readCategoryAnswer({ category: 'Règlement de la consultation', certain: true }, types)).toBe('RC')
    expect(readCategoryAnswer({ category: 'CCTP (Cahier des clauses techniques particulières)', certain: true }, types)).toBe('CCTP')
    expect(readCategoryAnswer({ category: 'CCTP — Cahier…', certain: true }, types)).toBe('CCTP')
  })

  it('le workflow système : actif, au document versé dont le type de pièce est à confirmer', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Identifier avec l’IA le type de pièce d’un document, quand la première passe n’est pas sûre',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'categorieaconfirmer', op: 'not-empty', value: '' }],
      actions: [{ kind: 'ia.categorie-document', fields: { fiche: '{fiche}' } }]
    })
  })

  it('pas sûr sans IA : l’IA choisit dans la liste des types (code et libellé) — donné, « identifié par l’IA »', async () => {
    const platform = memoryPlatform()
    const { pour, journal } = await start(platform)
    let listed = ''
    const original = platform.http.request.bind(platform.http)
    platform.http.request = async (request) => {
      if (!request.url.endsWith('/chat/completions')) return original(request)
      platform.requests.push(request)
      const system = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content
      if (system.startsWith('Tu identifies la langue')) return chat('fr')
      if (system.includes('de quel type de pièce il est')) {
        listed = system
        return chat({ category: 'Cahier des clauses techniques particulières', certain: true })
      }
      return chat({ title: '', issuer: '', reference: '', edition: '', revision: '', certain: false })
    }
    const doc = await pour('Pièce 3.txt', 'Le présent document décrit la station.')
    expect(listed).toContain('CCTP (Cahier des clauses techniques particulières), ')
    expect(listed).toContain('AUTRE (')
    expect(read(platform, doc.record)).toMatch(/\ncategorie: CCTP\n/)
    expect(read(platform, doc.record)).toMatch(/\ncategorieIdentifieePar: ia\n/)
    expect(journal()).toContain('« Pièce 3 » : CCTP, identifié par l’IA.')
  })
})
