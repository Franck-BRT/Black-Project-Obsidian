// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La langue d'un document, quand la détection sans IA n'est pas sûre : une étape avec
 * l'IA. Le workflow système « Identifier avec l'IA la langue d'un document… » (actif), au
 * document versé dont la langue est vide, donne à l'IA le début de son texte ; une réponse
 * nette (un des codes) donne la langue, « identifiée par l'IA » ; sinon — l'IA pas sûre, pas
 * réglée, pas de texte — elle reste à confirmer, sans erreur. Une détection sûre ne demande
 * rien à l'IA.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock } from '../src/core/views'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule, readLanguageAnswer } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: string) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) })
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'
const SHORT = 'Rapport de visite du site, avec les remarques du client.'

async function start(platform: MemoryPlatform, ia: Record<string, unknown> = SERVEUR) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ia }
  const views = new ViewsRegistry()
  for (const module of ALL) {
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
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.ia.langue-documents')
  const pour = async (name: string, text: string) => (await pourIntoLibrary([{ name, bytes: bytes(text) }], { module: 'bibliotheque', label: '' }))!.added[0]!
  const journal = () => (platform.files.has(JOURNAL) ? read(platform, JOURNAL) : '')
  return { page, system, pour, journal }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la langue d’un document, avec l’IA quand la détection n’est pas sûre', () => {
  it('lire la réponse de l’IA : un code, seul ; autre chose, rien', () => {
    expect(readLanguageAnswer('fr')).toBe('fr')
    expect(readLanguageAnswer(' « en »\n')).toBe('en')
    expect(readLanguageAnswer('de.')).toBe('de')
    expect(readLanguageAnswer('?')).toBe('')
    expect(readLanguageAnswer('français')).toBe('')
    expect(readLanguageAnswer('Le texte est en français.')).toBe('')
    expect(readLanguageAnswer('ru')).toBe('')
  })

  it('le workflow système : actif, au document versé, si sa langue est vide, l’étape IA', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Identifier avec l’IA la langue d’un document, quand la détection n’est pas sûre',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'langue', op: 'empty', value: '' }],
      actions: [{ kind: 'ia.langue-document', fields: { fiche: '{fiche}' } }]
    })
  })

  it('pas sûre sans IA : l’IA la dit — la langue est donnée, « identifiée par l’IA », plus à confirmer', async () => {
    const platform = memoryPlatform()
    const { page, pour, journal } = await start(platform)
    platform.httpAnswers.push(chat('fr'))
    const before = platform.requests.length
    const doc = await pour('Visite.txt', SHORT)
    // Ce qu'on a demandé : le début du texte, avec la consigne de ne répondre qu'un code.
    const sent = JSON.parse(platform.requests[before]!.body!) as { messages: { role: string; content: string }[]; temperature: number }
    expect(sent.messages[0]!.content).toMatch(/^Tu identifies la langue dans laquelle un texte est écrit\. Réponds uniquement par l’un de ces codes : fr, en, de, es, it, pt, nl/)
    expect(sent.messages[1]!.content).toBe(SHORT)
    expect(sent.temperature).toBe(0)
    expect(read(platform, doc.record)).toMatch(/\nlangue: fr\nlangueIdentifieePar: ia\n/)
    expect(read(platform, doc.record)).not.toMatch(/langueAConfirmer/)
    expect(journal()).toContain('« Visite » : Français, identifiée par l’IA.')
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const identity = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.title === 'Identification')
    const list = identity?.blocks[0]
    expect(list?.kind === 'list' && list.items.find((item) => item.id === 'language')?.detail).toBe('Français (identifiée par l’IA)')
  })

  it('l’IA pas sûre (« ? ») : la langue reste à confirmer, sans erreur', async () => {
    const platform = memoryPlatform()
    const { pour, journal } = await start(platform)
    platform.httpAnswers.push(chat('?'))
    const doc = await pour('Visite.txt', SHORT)
    expect(read(platform, doc.record)).toMatch(/\nlangueAConfirmer: true\n/)
    expect(journal()).toContain('« Visite » : l’IA n’a pas pu trancher ; la langue reste à confirmer.')
  })

  it('une détection sûre sans IA : rien n’est demandé à l’IA', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform)
    const before = platform.requests.length
    await pour(
      'Cahier des charges.txt',
      'Le présent cahier des charges définit les exigences techniques de la station sol. Les offres sont remises dans le délai fixé par le règlement de la consultation, et le titulaire doit fournir les pièces demandées pour chaque lot. Les prix sont fermes et la durée du marché est de quatre ans avec une reconduction.'
    )
    expect(platform.requests.length).toBe(before)
  })

  it('l’IA pas réglée, ou pas de texte lu : la langue reste à confirmer, et c’est dit au journal', async () => {
    const platform = memoryPlatform()
    const { pour, journal } = await start(platform, {})
    await pour('Visite.txt', SHORT)
    expect(journal()).toContain('« Visite » : l’IA n’est pas réglée ; la langue reste à confirmer.')
    await iaModule.deactivate?.()
    await workflowsModule.deactivate?.()
    await bibliothequeModule.deactivate?.()
    await lectureFichiersModule.deactivate?.()
    const other = memoryPlatform()
    const again = await start(other)
    const before = other.requests.length
    const doc = await again.pour('Maquette.dwg', 'binaire')
    expect(other.requests.length).toBe(before)
    expect(read(other, doc.record)).toMatch(/\nlangueAConfirmer: true\n/)
    expect(again.journal()).toContain('« Maquette » : pas de texte lu à donner à l’IA ; la langue reste à confirmer.')
  })
})
