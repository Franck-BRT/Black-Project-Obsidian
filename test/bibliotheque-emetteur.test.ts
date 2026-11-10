// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'**émetteur** d'un document de la bibliothèque, en deux passes. Sans IA, à son entrée :
 * dit avec son mot (« Émetteur : », « Émis par », « Pouvoir adjudicateur : »…) : sûr. Sinon,
 * pas d'émetteur, à confirmer — avec l'émetteur probable lu (« … SAS », « Agence … »). Puis
 * l'IA (workflow système du module IA, actif) le tranche ; il doit figurer dans le document.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock } from '../src/core/views'
import { bibliothequeModule, guessIssuer, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule, readIssuerAnswer } from '../src/modules/ia'
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
const COVER = 'Agence spatiale européenne\nCahier des clauses techniques particulières de la station sol\nLe présent document décrit la station.'

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
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.ia.emetteur-documents')
  const journal = () => (platform.files.has(JOURNAL) ? read(platform, JOURNAL) : '')
  return { page, pour, system, journal }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la première passe, sans IA', () => {
  it('dit avec son mot : sûr', () => {
    expect(guessIssuer('Émetteur : Centre national d’études spatiales\nRéf. : X')).toEqual({ issuer: 'Centre national d’études spatiales', sure: true })
    expect(guessIssuer('Pouvoir adjudicateur : Ville de Toulouse')).toEqual({ issuer: 'Ville de Toulouse', sure: true })
    expect(guessIssuer('Rédigé par Thales Alenia Space\nLe 3 mars')).toEqual({ issuer: 'Thales Alenia Space', sure: true })
    expect(guessIssuer('Issued by: Airbus Defence and Space')).toEqual({ issuer: 'Airbus Defence and Space', sure: true })
  })

  it('sinon, une ligne qui a l’air d’un organisme : probable ; rien : rien', () => {
    expect(guessIssuer(COVER)).toEqual({ issuer: 'Agence spatiale européenne', sure: false })
    expect(guessIssuer('Rapport de recette\nDurand Ingénierie SAS\n12 rue des Lilas')).toEqual({ issuer: 'Durand Ingénierie SAS', sure: false })
    expect(guessIssuer('Rapport de recette des antennes')).toEqual({ issuer: '', sure: false })
  })
})

describe('à l’entrée, et sur la fiche', () => {
  it('sûr : donné, rien à confirmer', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('Note.txt', 'Émetteur : Centre national d’études spatiales\nNote de cadrage.')
    expect(doc.issuer).toBe('Centre national d’études spatiales')
    expect(doc.issuerToConfirm).toBeUndefined()
  })

  it('pas sûr : à confirmer — « Prendre » le probable, « Pas d’émetteur », « Classer… »', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('CCTP.txt', COVER)
    expect(doc).toMatchObject({ issuer: '', issuerToConfirm: true, issuerProbable: 'Agence spatiale européenne' })
    expect(read(platform, doc.record)).toMatch(/\nemetteurAConfirmer: true\nemetteurProbable: Agence spatiale européenne\n/)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const message = fiche.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Entreprise à confirmer'))
    expect(message).toMatchObject({ tone: 'warning', text: 'Entreprise à confirmer : le document semble émis par « Agence spatiale européenne » (lu sans certitude).' })
    expect(message?.kind === 'message' && message.actions!.map((action) => action.label)).toEqual(['Prendre « Agence spatiale européenne »', 'Pas d’entreprise', 'Classer…'])
    expect((await page('bibliotheque.documents').load()).filters?.map((filter) => filter.id)).toContain('emetteur-a-confirmer')
    await (message?.kind === 'message' ? message.actions![0]!.run() : null)
    expect(platform.notices.at(-1)).toBe('Entreprise confirmée : « Agence spatiale européenne ».')
    expect(read(platform, doc.record)).toMatch(/\nemetteur: Agence spatiale européenne\n/)
    expect(read(platform, doc.record)).not.toMatch(/emetteurAConfirmer/)
    // Aucun probable : « Pas d'émetteur » le confirme vide.
    const other = await pour('Plan.txt', 'Rapport de recette des antennes')
    const view = await page('bibliotheque.document').load(encodeURIComponent(other.record))
    const none = view.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Entreprise à confirmer'))
    expect(none?.kind === 'message' && none.actions!.map((action) => action.id)).toEqual(['keep-issuer', 'classify-issuer'])
    await (none?.kind === 'message' ? none.actions![0]!.run() : null)
    expect(platform.notices.at(-1)).toBe('« Plan » : sans entreprise.')
    expect(read(platform, other.record)).not.toMatch(/emetteurAConfirmer/)
  })
})

describe('la seconde passe, avec l’IA', () => {
  it('lire la réponse : certaine et dans le document ; vide et certaine : aucun ; sinon rien', () => {
    expect(readIssuerAnswer({ issuer: '« Agence spatiale européenne »', certain: true }, COVER, 'CCTP.txt')).toBe('Agence spatiale européenne')
    expect(readIssuerAnswer({ issuer: 'ESA', certain: true }, 'Émis pour l’E.S.A.', 'x.txt')).toBe('ESA')
    expect(readIssuerAnswer({ issuer: 'Société Imaginaire SA', certain: true }, COVER, 'CCTP.txt')).toBeNull()
    expect(readIssuerAnswer({ issuer: '', certain: true }, COVER, 'CCTP.txt')).toBe('')
    expect(readIssuerAnswer({ issuer: 'Agence spatiale européenne', certain: false }, COVER, 'CCTP.txt')).toBeNull()
  })

  it('le workflow système : actif, au document versé dont l’émetteur est à confirmer', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Identifier avec l’IA l’entreprise qui émet un document, quand la première passe n’est pas sûre',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'emetteuraconfirmer', op: 'not-empty', value: '' }],
      actions: [{ kind: 'ia.emetteur-document', fields: { fiche: '{fiche}' } }]
    })
  })

  it('pas sûr sans IA : l’IA le dit — donné, « identifié par l’IA »', async () => {
    const platform = memoryPlatform()
    const { pour, journal } = await start(platform)
    const original = platform.http.request.bind(platform.http)
    platform.http.request = async (request) => {
      if (!request.url.endsWith('/chat/completions')) return original(request)
      platform.requests.push(request)
      const system = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content
      if (system.startsWith('Tu identifies la langue')) return chat('fr')
      if (system.includes('pour trouver son émetteur')) return chat({ issuer: 'Agence spatiale européenne', certain: true })
      return chat({ title: '', reference: '', edition: '', revision: '', certain: false })
    }
    const doc = await pour('CCTP.txt', COVER)
    expect(read(platform, doc.record)).toMatch(/\nemetteur: Agence spatiale européenne\n/)
    expect(read(platform, doc.record)).toMatch(/\nemetteurIdentifiePar: ia\n/)
    expect(journal()).toContain('« CCTP » : émis par « Agence spatiale européenne » — entreprise identifiée par l’IA.')
  })
})
