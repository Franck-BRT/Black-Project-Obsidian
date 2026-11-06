// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La page **Exigences** : l'entrée du menu, la tuile et la commande « Exigences : liste,
 * filtres et fiches » l'ouvrent (plus de fenêtre de liste), elle montre la bibliothèque en
 * chiffres et une carte par exigence, les plus faibles d'abord, chacune avec les filtres
 * auxquels elle répond. Sans page chez la plateforme, on retrouve la liste en fenêtre.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type PageView } from '../src/core/views'
import { exigencesModule, requirementsAt } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

const MODULES = [lectureFichiersModule, exigencesModule, iaModule]
const text = (body: string) => ({ fr: { body, lang: 'fr', origin: 'human' as const, reviewed: true, by: '', at: '', fromRev: 1 } })

async function start(platform: MemoryPlatform, withPages: boolean) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {}
  const commands = new Map<string, ModuleCommand>()
  const views = new ViewsRegistry()
  const shown: string[] = []
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command), run: async (id) => commands.get(`${module.id}-${id}`)?.run() },
      views,
      ...(withPages ? { showPage: (id: string) => void shown.push(id) } : {})
    }
    await (module as BlackModule).activate(context)
  }
  const library = requirementsAt('Exigences')
  await library.create({ category: 'SOL', title: 'Maintien en température', text: text('Le système doit maintenir la soute entre 5 °C et 30 °C.'), type: 'performance', status: 'approved', criticality: 'high', verification: 'test' })
  await library.create({ category: 'SEC', title: 'Journalisation', text: text('Les accès seront journalisés si possible.'), type: 'security', status: 'draft', criticality: 'medium' })
  return { views, shown, run: (id: string) => commands.get(id)!.run() }
}

const cardsOf = (view: PageView): Card[] => view.blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('la page Exigences', () => {
  it('le menu, la tuile, la commande et le tableau de bord ouvrent la page, plus de liste en fenêtre', async () => {
    const platform = memoryPlatform()
    const lists: string[] = []
    platform.ui.pickFromList = async (view) => void lists.push(view.title) as unknown as null
    const { views, shown, run } = await start(platform, true)
    const nav = views.navEntries().find((entry) => entry.id === 'exigences')!
    const tile = views.allTiles().find((each) => each.id === 'exigences.liste')!
    expect(nav.page).toBe('exigences.bibliotheque')
    expect(tile.page).toBe('exigences.bibliotheque')
    await nav.run()
    await tile.run()
    await run('exigences-liste')
    const section = await views.homeSections().find((each) => each.id === 'exigences.library')!.load()
    expect(section?.actions?.map((action) => action.label)).toEqual(['Toute la bibliothèque'])
    await section!.actions![0]!.run()
    expect(shown).toEqual(Array(4).fill('exigences.bibliotheque'))
    expect(lists).toEqual([])
  })

  it('la bibliothèque en chiffres, une carte par exigence, les plus faibles d’abord ; filtres', async () => {
    const { views } = await start(memoryPlatform(), true)
    const page = views.pages().find((each) => each.id === 'exigences.bibliotheque')!
    expect(page.title).toBe('Bibliothèque d’exigences')
    const view = await page.load()
    expect(view.filters?.map((filter) => filter.id)).toEqual(['faibles', 'a-revoir', 'critiques', 'brouillons', 'approuvees'])
    expect(view.actions?.map((action) => action.id)).toEqual(['new', 'import', 'quality'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats[0]!.value).toBe('2')
    const cards = cardsOf(view)
    // « si possible » : une formulation faible, en tête.
    expect(cards.map((card) => card.title)).toEqual(['REQ-SEC-0001 — Journalisation', 'REQ-SOL-0001 — Maintien en température'])
    expect(cards[0]!.text).toBe('Les accès seront journalisés si possible.')
    expect(cards[0]!.tags).toContain('brouillons')
    expect(cards[1]!.tags).toEqual(expect.arrayContaining(['critiques', 'approuvees']))
    expect(cards[1]!.badges?.map((badge) => badge.label)).toEqual(expect.arrayContaining(['Criticité : Haute']))
    expect(cards[1]!.open?.label).toBe('Ouvrir la note')
    expect(cards[1]!.actions?.map((action) => action.id)).toEqual(['edit'])
    // Une traduction absente (anglais) : à revoir, comme dans les chiffres.
    expect(cards[1]!.badges?.map((badge) => badge.label)).toContain('traduction absente : EN')
    expect(cards.every((card) => card.tags?.includes('a-revoir'))).toBe(true)
    expect(stats?.kind === 'stats' && stats.stats[3]!.value).toBe('2')
  })

  it('sans page chez la plateforme : la liste en fenêtre, comme avant', async () => {
    const platform = memoryPlatform()
    const lists: string[] = []
    platform.ui.pickFromList = async (view) => {
      lists.push(view.title)
      return null
    }
    const { views } = await start(platform, false)
    const nav = views.navEntries().find((entry) => entry.id === 'exigences')!
    expect(nav.page).toBeUndefined()
    await nav.run()
    expect(lists).toEqual(['Exigences (2)'])
  })
})
