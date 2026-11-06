// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La page **IA** : l'entrée du menu, la tuile et le lien du tableau de bord l'ouvrent (plus
 * la fenêtre de réglages d'emblée) ; la connexion en chiffres, une carte par usage — le
 * modèle choisi ou pris à la place — avec « Choisir le modèle » parmi ceux du serveur, et
 * ce qui se sert de l'IA. Sans page chez la plateforme, la fenêtre du module reste.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type PageView } from '../src/core/views'
import { iaModule } from '../src/modules/ia'

const LISTED = ['bge-m3', 'bge-reranker-v2-m3', 'mistral-small-3.2', 'qwen2.5-vl-7b']

async function start(values: Record<string, unknown>, withPages = true) {
  const platform = memoryPlatform()
  const i18n = createI18n('fr')
  i18n.register('fr', iaModule.texts.fr)
  let settings: Record<string, unknown> = values
  const views = new ViewsRegistry()
  const shown: string[] = []
  const windows: string[] = []
  const notices: string[] = []
  const picks: string[][] = []
  let answer: string | null = null
  platform.notifier.notify = (message) => void notices.push(message)
  platform.ui.pickOption = async (options) => {
    picks.push(options.map((option) => option.label))
    return answer
  }
  const context: ModuleContext = {
    moduleId: 'ia',
    platform,
    i18n,
    settings: { get: () => settings, save: async (next) => void (settings = { ...next }), onChange: () => () => {} },
    commands: { register: () => {} },
    views,
    openWindow: () => void windows.push('fenêtre'),
    ...(withPages ? { showPage: (id: string) => void shown.push(id) } : {})
  }
  await (iaModule as BlackModule).activate(context)
  return { platform, views, shown, windows, notices, picks, settings: () => settings, answer: (value: string | null) => void (answer = value) }
}

const cardsOf = (view: PageView): Card[] => view.blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))

afterEach(async () => {
  await iaModule.deactivate?.()
})

describe('la page IA', () => {
  it('le menu, la tuile et le tableau de bord ouvrent la page ; « Régler la connexion » la fenêtre', async () => {
    const { views, shown, windows } = await start({ adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small-3.2' })
    const nav = views.navEntries().find((entry) => entry.id === 'ia')!
    const tile = views.allTiles().find((each) => each.id === 'ia.reglages')!
    expect(nav.page).toBe('ia.connexion')
    expect(tile.page).toBe('ia.connexion')
    await nav.run()
    await tile.run()
    const section = await views.homeSections()[0]!.load()
    await section!.actions![0]!.run()
    expect(shown).toEqual(['ia.connexion', 'ia.connexion', 'ia.connexion'])
    expect(windows).toEqual([])
    const view = await views.pages()[0]!.load()
    await view.actions!.find((action) => action.id === 'settings')!.run()
    expect(windows).toEqual(['fenêtre'])
  })

  it('la connexion en chiffres, une carte par usage : choisi, pris à la place, pas utilisé', async () => {
    const { views } = await start({ adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small-3.2', modeleEmbeddings: 'bge-m3', modelesServeur: LISTED })
    const view = await views.pages()[0]!.load()
    expect(view.subtitle).toContain('https://ia.exemple.fr/v1')
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Connexion=Prête', 'Modèles du serveur=4', 'Usages couverts=5 / 6', 'Longueur des réponses=par défaut'])
    const cards = cardsOf(view)
    expect(cards.map((card) => `${card.id}:${card.tags![0]}`)).toEqual(['text:choisis', 'translate:par-defaut', 'embedding:choisis', 'rerank:inutilises', 'ocr:par-defaut', 'vision:par-defaut'])
    expect(cards[1]!.subtitle).toBe('non réglé : mistral-small-3.2 à la place')
    expect(cards[3]!.facts![0]!.value).toBe('1')
    const lists = view.blocks.filter((block) => block.kind === 'list')
    expect(lists.map((block) => block.kind === 'list' && block.title)).toEqual(['Modèles du serveur (4)', 'Ce qui se sert de l’IA'])
    // Les modèles du serveur : pour quoi chacun est choisi, à quoi il convient.
    const models = lists[0]!.kind === 'list' ? lists[0]!.items : []
    expect(models.map((item) => item.title)).toEqual(LISTED)
    expect(models.find((item) => item.title === 'bge-m3')).toMatchObject({ tone: 'success', detail: 'choisi pour : vecteurs' })
    expect(models.find((item) => item.title === 'mistral-small-3.2')!.detail).toMatch(/^choisi pour : analyse ; conviendrait aussi pour : traduction/)
    expect(models.find((item) => item.title === 'bge-reranker-v2-m3')).toMatchObject({ tone: 'neutral', detail: 'convient pour : reranking' })
    const uses = lists[1]
    expect(uses?.kind === 'list' && uses.items.map((item) => item.title)).toContain('Interroger le dossier')
  })

  it('« Choisir le modèle » : les modèles du serveur qui conviennent, puis enregistré ; « Aucun » le retire', async () => {
    const run = await start({ adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small-3.2', modelesServeur: LISTED })
    const rerank = cardsOf(await run.views.pages()[0]!.load()).find((card) => card.id === 'rerank')!
    run.answer('bge-reranker-v2-m3')
    await rerank.actions![0]!.run()
    expect(run.picks[0]).toEqual(['bge-reranker-v2-m3', 'Aucun (par défaut)'])
    expect(run.settings().modeleReranking).toBe('bge-reranker-v2-m3')
    expect(run.notices.at(-1)).toBe('Modèle — reranking : bge-reranker-v2-m3.')
    run.answer('')
    await rerank.actions![0]!.run()
    expect(run.settings().modeleReranking).toBe('')
  })

  it('sans serveur : la page le dit et met « Régler la connexion » en avant ; sans liste, tester d’abord', async () => {
    const run = await start({})
    const view = await run.views.pages()[0]!.load()
    expect(view.blocks[0]).toMatchObject({ kind: 'message', tone: 'warning' })
    expect(view.actions!.find((action) => action.id === 'settings')!.primary).toBe(true)
    await cardsOf(view)[0]!.actions![0]!.run()
    expect(run.picks).toEqual([])
    expect(run.notices.at(-1)).toContain('Testez d’abord la connexion')
  })

  it('sans page chez la plateforme : la fenêtre du module, comme avant', async () => {
    const { views, windows } = await start({}, false)
    expect(views.pages()).toHaveLength(0)
    await views.navEntries().find((entry) => entry.id === 'ia')!.run()
    expect(windows).toEqual(['fenêtre'])
  })
})

describe('tester la connexion, en page', () => {
  const json = (body: unknown) => ({ status: 200, text: JSON.stringify(body) })
  const SETTINGS = { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small-3.2' }
  const page = async (views: ViewsRegistry) => views.pages().find((each) => each.id === 'ia.connexion')!.load()

  it('la tuile « Tester la connexion » : le test, puis la page IA, qui dit ce qu’il a donné et liste les modèles', async () => {
    const { platform, views, shown, windows } = await start(SETTINGS)
    platform.httpAnswers.push(json({ data: LISTED.map((id) => ({ id })) }))
    await views.allTiles().find((each) => each.id === 'ia.tester')!.run()
    expect(shown).toEqual(['ia.connexion'])
    expect(windows).toEqual([])
    const view = await page(views)
    expect(view.blocks[0]).toEqual({ kind: 'message', tone: 'success', text: expect.stringMatching(/^Dernier test \(\d{4}-\d{2}-\d{2} \d{2}:\d{2}\) : connexion réussie — 4 modèle\(s\) sur le serveur ; modèle d’analyse : mistral-small-3\.2\.$/) })
    const models = view.blocks.find((block) => block.kind === 'list' && block.title === 'Modèles du serveur (4)')
    expect(models?.kind === 'list' && models.items).toHaveLength(4)
  })

  it('le serveur ne répond pas : la page le dit, avec la raison', async () => {
    const { platform, views, shown } = await start(SETTINGS)
    platform.httpAnswers.push({ status: 401, text: 'unauthorized' })
    const section = await views.homeSections()[0]!.load()
    await section!.blocks.flatMap((block) => (block.kind === 'actions' ? block.actions : [])).find((action) => action.id === 'test')!.run()
    expect(shown).toEqual(['ia.connexion'])
    const first = (await page(views)).blocks[0]
    expect(first).toMatchObject({ kind: 'message', tone: 'danger', text: expect.stringMatching(/^Dernier test \(.+\) : connexion impossible — /) })
  })

  it('sur la page, « Tester la connexion » : on y reste, le résultat en tête ; sans liste, elle invite à tester', async () => {
    const { platform, views, shown } = await start(SETTINGS)
    const before = await page(views)
    const models = before.blocks.find((block) => block.kind === 'list' && block.title === 'Modèles du serveur (0)')
    expect(models).toMatchObject({ items: [], empty: 'Testez la connexion : la liste des modèles du serveur s’affichera ici.' })
    platform.httpAnswers.push(json({ data: [{ id: 'mistral-small-3.2' }] }))
    await before.actions!.find((action) => action.id === 'test')!.run()
    expect(shown).toEqual([])
    expect((await page(views)).blocks[0]).toMatchObject({ kind: 'message', tone: 'success' })
  })
})
