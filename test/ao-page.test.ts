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
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command), run: async (id) => commands.get(`${module.id}-${id}`)?.run() },
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
  return { views, shown, station, run: (id: string) => commands.get(id)!.run(), importInto: (markdown: string) => importFiles(services, station, [{ name: 'CCTP.md', bytes: enc(markdown) }]) }
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

describe('la fiche d’une analyse, en page', () => {
  it('un clic sur une analyse ouvre sa fiche ; elle dépend de la liste', async () => {
    const { views, shown, station } = await start(memoryPlatform(), true)
    const card = cardsOf(await views.pages().find((each) => each.id === 'ao.analyses')!.load()).find((each) => each.title === 'Station sol')!
    await card.open!.run()
    expect(shown).toEqual([`ao.fiche?${encodeURIComponent(station.note)}`])
    expect(views.pages().find((each) => each.id === 'ao.fiche')!.parent).toBe('ao.analyses')
  })

  it('tout d’un coup d’œil : chiffres, pièces par destination, calendrier, exigences, notes produites', async () => {
    const { views, station } = await start(memoryPlatform(), true)
    const view = await views.pages().find((each) => each.id === 'ao.fiche')!.load(encodeURIComponent(station.note))
    expect(view.title).toBe('Station sol')
    expect(view.back?.label).toBe('Toutes les analyses')
    expect(view.subtitle).toBe('Candidat · Agence spatiale · AO-118')
    expect(view.actions?.map((action) => action.id)).toEqual(['import', 'update', 'calendar', 'verify', 'quality', 'note'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => stat.value)).toEqual(['J-12', '1', '0', '—'])
    const pieces = view.blocks.find((block) => block.kind === 'cards')
    expect(pieces?.kind === 'cards' && pieces.title).toBe('Appel d’offres (1)')
    const rc = pieces?.kind === 'cards' ? pieces.cards[0]! : null
    expect(rc!.title).toBe('RC.md')
    expect(rc!.actions?.map((action) => action.id)).toEqual(['type', 'move', 'extract'])
    expect(rc!.tags).toEqual(['lues', 'appel-d-offres'])
    const lists = view.blocks.filter((block) => block.kind === 'list')
    expect(lists.map((block) => block.kind === 'list' && block.title)).toEqual(['Calendrier (1 date(s))', 'Exigences (0), les plus faibles d’abord', 'Ce que l’analyse a produit'])
    expect(lists[0]!.kind === 'list' && lists[0]!.items[0]!.title).toBe('Date limite de remise des offres')
  })

  it('chaque bouton agit sur cette analyse, sans demander laquelle', async () => {
    const platform = memoryPlatform()
    const asked: string[] = []
    platform.ui.pickOption = async (options, placeholder) => {
      asked.push(placeholder ?? '')
      return options[0]?.value ?? null
    }
    const { views, station } = await start(platform, true)
    const page = views.pages().find((each) => each.id === 'ao.fiche')!
    const view = await page.load(encodeURIComponent(station.note))
    await view.actions!.find((action) => action.id === 'calendar')!.run()
    expect(platform.files.has(`${station.folder}/Analyse/Calendrier.md`)).toBe(true)
    expect(asked).not.toContain('Dans quelle analyse ?')
    // Le calendrier écrit : il apparaît dans ce que l'analyse a produit.
    const again = await page.load(encodeURIComponent(station.note))
    const produced = again.blocks.filter((block) => block.kind === 'list')[2]
    expect(produced?.kind === 'list' && produced.items.map((item) => item.title)).toEqual(['Calendrier'])
  })

  it('une analyse disparue : la page le dit', async () => {
    const { views } = await start(memoryPlatform(), true)
    const view = await views.pages().find((each) => each.id === 'ao.fiche')!.load(encodeURIComponent('Appels d’offres/Disparue/Disparue.md'))
    expect(view.title).toBe('Analyse introuvable')
  })
})

describe('la fiche d’une pièce, en page', () => {
  async function fiche() {
    const run = await start(memoryPlatform(), true)
    const analysis = await run.views.pages().find((each) => each.id === 'ao.fiche')!.load(encodeURIComponent(run.station.note))
    const pieces = analysis.blocks.find((block) => block.kind === 'cards')
    const rc = pieces?.kind === 'cards' ? pieces.cards[0]! : null
    return { ...run, rc: rc!, page: run.views.pages().find((each) => each.id === 'ao.piece')! }
  }

  it('un clic sur une pièce (fiche de l’analyse) ouvre sa fiche ; elle dépend des analyses', async () => {
    const { rc, shown, page } = await fiche()
    await rc.open!.run()
    expect(shown.at(-1)).toBe(`ao.piece?${encodeURIComponent(rc.id)}`)
    expect(page.parent).toBe('ao.analyses')
  })

  it('tout d’un coup d’œil : chiffres, début du texte, dates relevées, exigences extraites', async () => {
    const { rc, page } = await fiche()
    const view = await page.load(encodeURIComponent(rc.id))
    expect(view.title).toBe('RC.md')
    expect(view.back?.label).toBe('L’analyse « Station sol »')
    expect(view.subtitle).toMatch(/^RC — .* · Appel d’offres · Station sol$/)
    expect(view.actions?.map((action) => action.id)).toEqual(['type', 'move', 'extract', 'note', 'original', 'analysis'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => stat.label)).toEqual(['Lecture', 'Type', 'Caractères lus', 'Exigences'])
    const text = view.blocks.find((block) => block.kind === 'cards')
    expect(text?.kind === 'cards' && text.cards[0]!.text).toContain('La date limite de remise des offres')
    const lists = view.blocks.filter((block) => block.kind === 'list')
    expect(lists.map((block) => block.kind === 'list' && block.items.length)).toEqual([1, 0])
  })

  it('une pièce disparue : la page le dit', async () => {
    const { page } = await fiche()
    expect((await page.load(encodeURIComponent('Appels d’offres/X/Pièces/x.md'))).title).toBe('Pièce introuvable')
  })
})

describe('le texte d’une pièce, lisible', () => {
  it('sans « ### » ni syntaxe de tableau ; une ligne de tableau devient ses cellules ; les délais relevés', async () => {
    const run = await start(memoryPlatform(), true)
    const md = '### CCTP\n\n| Identifiant | Exigence |\n|---|---|\n| EX-1 | Le titulaire doit fournir une antenne. |\n\nLa livraison intervient sous 15 jours après la notification.\n'
    await run.importInto(md)
    const analysis = await run.views.pages().find((each) => each.id === 'ao.fiche')!.load(encodeURIComponent(run.station.note))
    const cards = analysis.blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))
    const cctp = cards.find((card) => card.title === 'CCTP.md')!
    const view = await run.views.pages().find((each) => each.id === 'ao.piece')!.load(encodeURIComponent(cctp.id))
    const text = view.blocks.find((block) => block.kind === 'cards')
    expect(text?.kind === 'cards' && text.cards[0]!.text).toBe('CCTP\n\nIdentifiant — Exigence\nEX-1 — Le titulaire doit fournir une antenne.\n\nLa livraison intervient sous 15 jours après la notification.')
    expect(text?.kind === 'cards' && text.cards[0]!.title).toMatch(/^Le texte \(\d+ caractères\)$/)
    const dates = view.blocks.find((block) => block.kind === 'list')
    expect(dates?.kind === 'list' && dates.items.map((item) => item.title)).toEqual(['Livraison, recette — sous 15 jours après la notification'])
  })
})
