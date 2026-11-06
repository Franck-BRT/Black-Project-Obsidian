// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La page **Analyses** : l'entrée du menu et la tuile l'ouvrent (plus de fenêtre pour
 * choisir une analyse), elle montre toutes les analyses en chiffres et en cartes, et
 * chaque carte répond aux filtres qui la concernent. Sans page chez la plateforme, on
 * retrouve la fenêtre de choix.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type PageView } from '../src/core/views'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, exigencesModule, iaModule, workflowsModule, aoModule]
const TODAY = new Date().toISOString().slice(0, 10)
/** Une date à `days` jours d'aujourd'hui, en toutes lettres (« 12 décembre 2026 »). */
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

async function start(platform: MemoryPlatform, withPages: boolean) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false } }
  const commands = new Map<string, ModuleCommand>()
  const views = new ViewsRegistry()
  const shown: string[] = []
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command) },
      views,
      ...(withPages ? { showPage: (id: string) => void shown.push(id) } : {})
    }
    await (module as BlackModule).activate(context)
  }
  const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => TODAY }
  const enc = (text: string) => new TextEncoder().encode(text)
  const station = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence spatiale', reference: 'AO-118' })
  await importFiles(services, station, [{ name: 'RC.md', bytes: enc(`# Règlement de la consultation\n\nLa date limite de remise des offres est fixée au ${inDays(12)}.\n`) }])
  await createAnalysis(services, 'Maintenance antennes', { position: 'emetteur', buyer: 'Centre spatial', reference: 'MA-07' })
  return { views, shown, run: (id: string) => commands.get(id)!.run() }
}

const cardsOf = (view: PageView): Card[] => view.blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('la page Analyses', () => {
  it('le menu, la tuile et la commande ouvrent la page, plus de fenêtre de choix', async () => {
    const platform = memoryPlatform()
    const asked: string[] = []
    platform.ui.pickOption = async () => void asked.push('fenêtre') as unknown as null
    const { views, shown, run } = await start(platform, true)
    const nav = views.navEntries().find((entry) => entry.id === 'ao.analyses')!
    const tile = views.allTiles().find((each) => each.id === 'ao.analyses')!
    expect(nav.page).toBe('ao.analyses')
    expect(tile.page).toBe('ao.analyses')
    await nav.run()
    await tile.run()
    await run('ao-analyses')
    expect(shown).toEqual(['ao.analyses', 'ao.analyses', 'ao.analyses'])
    expect(asked).toEqual([])
    // Le tableau de bord mène aussi à la page.
    const section = await views.homeSections().find((each) => each.id === 'ao.analyses')!.load()
    expect(section?.actions?.map((action) => action.label)).toEqual(['Toutes les analyses'])
  })

  it('toutes les analyses en chiffres et en cartes, la remise la plus proche en tête ; recherche et filtres', async () => {
    const { views } = await start(memoryPlatform(), true)
    const page = views.pages().find((each) => each.id === 'ao.analyses')!
    expect(page.title).toBe('Analyses d’appels d’offres')
    const view = await page.load()
    expect(view.search?.label).toBe('Chercher une analyse')
    expect(view.filters?.map((filter) => filter.id)).toEqual(['a-venir', 'sous-30-jours', 'a-lire', 'faibles', 'candidat', 'emetteur'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Analyses=2', 'Remises sous 30 jours=1', 'Pièces à lire=0', 'Exigences faibles=0'])
    const cards = cardsOf(view)
    expect(cards.map((card) => card.title)).toEqual(['Station sol', 'Maintenance antennes'])
    expect(cards[0]!.tags).toEqual(['candidat', 'a-venir', 'sous-30-jours'])
    expect(cards[1]!.tags).toEqual(['emetteur'])
    expect(view.actions?.[0]).toMatchObject({ label: "Nouvelle analyse d'appel d'offres", primary: true })
  })

  it('sans page chez la plateforme : la fenêtre pour choisir une analyse, comme avant', async () => {
    const platform = memoryPlatform()
    const asked: string[] = []
    platform.ui.pickOption = async (options) => {
      asked.push(...options.map((option) => option.label))
      return null
    }
    const { views } = await start(platform, false)
    const nav = views.navEntries().find((entry) => entry.id === 'ao.analyses')!
    expect(nav.page).toBeUndefined()
    await nav.run()
    expect(asked.sort()).toEqual(['Maintenance antennes', 'Station sol'])
  })
})
