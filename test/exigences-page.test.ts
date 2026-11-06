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
import { exigencesModule, lastReview, requirementsAt, withReview } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

const MODULES = [lectureFichiersModule, exigencesModule, iaModule]
const text = (body: string) => ({ fr: { body, lang: 'fr', origin: 'human' as const, reviewed: true, by: '', at: '', fromRev: 1 } })

async function start(platform: MemoryPlatform, withPages: boolean, withAi = false) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = withAi ? { ia: { adresse: 'http://ia.exemple/v1', modele: 'mistral' } } : {}
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
    expect(view.filters?.map((filter) => filter.id)).toEqual(['faibles', 'a-revoir', 'critiques', 'brouillons', 'approuvees', 'traductions'])
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
    expect(cards[1]!.open?.label).toBe('Ouvrir la fiche de l’exigence')
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

describe('la fiche d’une exigence, en page', () => {
  async function fiche() {
    const platform = memoryPlatform()
    const run = await start(platform, true)
    const library = requirementsAt('Exigences')
    const all = await library.all()
    const weak = all.find((each) => each.title === 'Journalisation')!
    return { ...run, platform, weak, page: run.views.pages().find((each) => each.id === 'exigences.fiche')! }
  }

  it('un clic sur une exigence ouvre sa fiche ; elle dépend de la bibliothèque', async () => {
    const { views, shown, weak, page } = await fiche()
    const card = cardsOf(await views.pages().find((each) => each.id === 'exigences.bibliotheque')!.load()).find((each) => each.title.endsWith('Journalisation'))!
    await card.open!.run()
    expect(shown.at(-1)).toBe(`exigences.fiche?${encodeURIComponent(weak.filePath!)}`)
    expect(page.parent).toBe('exigences.bibliotheque')
  })

  it('tout d’un coup d’œil : chiffres, formulations par langue, qualité par axe, fiche, liens, historique', async () => {
    const { weak, page } = await fiche()
    const view = await page.load(encodeURIComponent(weak.filePath!))
    expect(view.title).toBe(`${weak.id} — Journalisation`)
    expect(view.back?.label).toBe('Toute la bibliothèque')
    expect(view.actions?.map((action) => action.id)).toEqual(['edit', 'note'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => stat.label)).toEqual(['Qualité de la formulation', 'Type', 'Statut', 'Criticité'])
    const wordings = view.blocks.find((block) => block.kind === 'cards')
    expect(wordings?.kind === 'cards' && wordings.cards.map((card) => `${card.title}:${card.badges![0]!.label}`)).toEqual(['FR:Langue source', 'EN:Traduction absente'])
    expect(wordings?.kind === 'cards' && wordings.cards[0]!).toMatchObject({ text: 'Les accès seront journalisés si possible.', wrap: true })
    const lists = view.blocks.filter((block) => block.kind === 'list')
    expect(lists.map((block) => block.kind === 'list' && block.title)).toEqual(['Qualité, axe par axe : ★★☆☆☆', 'La fiche', 'Liens (0)', 'Historique (0 révision(s))'])
    const axes = lists[0]!.kind === 'list' ? lists[0]!.items : []
    expect(axes.some((axis) => axis.tone !== 'success')).toBe(true)
    // Des mots, pas des codes : « aucune obligation (« doit ») », « formulation EN absente… ».
    const details = axes.map((axis) => axis.detail).join(' · ')
    expect(details).not.toMatch(/no-modal|weak-word|text\.en|\blinks\b|\bowner\b/)
    expect(details).toContain('formulation EN absente, en retard ou à relire')
    expect(details).toContain('aucun lien vers une autre exigence')
  })

  it('la dernière relecture par l’IA, écrite dans la note : son avis, ses constats, ses propositions', async () => {
    const { weak, page, platform } = await fiche()
    expect((await page.load(encodeURIComponent(weak.filePath!))).blocks.some((block) => 'title' in block && block.title?.startsWith('Relecture'))).toBe(false)
    const note = await platform.fs.readText(weak.filePath!)
    const review = ['## Relecture par l’IA — 2026-11-06', '', 'La formulation laisse le titulaire juge de journaliser.', '', '**Constats**', '', '- terme vague (« si possible »)', '', '**Propositions**', '', '- *Non ambiguë* — Retirer « si possible ».', '  > Les accès doivent être journalisés.'].join('\n')
    await platform.fs.writeText(weak.filePath!, withReview(note, review))
    const view = await page.load(encodeURIComponent(weak.filePath!))
    const block = view.blocks.find((each) => each.kind === 'text' && each.title === 'Relecture par l’IA — 2026-11-06')
    expect(block?.kind === 'text' && block.paragraphs).toEqual([
      'La formulation laisse le titulaire juge de journaliser.',
      'Constats',
      '• terme vague (« si possible »)',
      'Propositions',
      '• Non ambiguë — Retirer « si possible ». — Les accès doivent être journalisés.'
    ])
    expect(lastReview(await platform.fs.readText(weak.filePath!))).toEqual({ date: '2026-11-06', assessment: 'La formulation laisse le titulaire juge de journaliser.' })
  })

  it('une exigence disparue : la page le dit', async () => {
    const { page } = await fiche()
    expect((await page.load(encodeURIComponent('Exigences/Disparue.md'))).title).toBe('Exigence introuvable')
  })
})

/** Une réponse de serveur compatible OpenAI dont le message est `content`. */
const chat = (content: unknown) => ({
  status: 200,
  text: JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: 'stop' }] })
})

describe('traduire les exigences, en page', () => {
  async function withAi() {
    const platform = memoryPlatform()
    const run = await start(platform, true, true)
    const all = await requirementsAt('Exigences').all()
    const hot = all.find((each) => each.title === 'Maintien en température')!
    const fiche = run.views.pages().find((each) => each.id === 'exigences.fiche')!
    const library = run.views.pages().find((each) => each.id === 'exigences.bibliotheque')!
    return { ...run, platform, hot, fiche, library }
  }
  const wording = (view: PageView, lang: string) => cardsOf(view).find((card) => card.id === `text-${lang}`)!

  it('la carte d’une langue traduit vers elle, sans la redemander ; la fiche montre la traduction, ses chiffres, la note de l’IA', async () => {
    const { platform, hot, fiche } = await withAi()
    const param = encodeURIComponent(hot.filePath!)
    const before = wording(await fiche.load(param), 'en')
    expect(before.actions?.map((action) => action.id)).toEqual(['translate'])
    platform.httpAnswers.push(chat({ text: 'The system shall keep the hold between 5 °C and 35 °C.', notes: '« soute » rendu par « hold ».' }))
    await before.actions![0]!.run()
    expect(platform.offered).toEqual([])
    expect(platform.opened).toEqual([])
    const card = wording(await fiche.load(param), 'en')
    expect(card.text).toBe('The system shall keep the hold between 5 °C and 35 °C.')
    expect(card.badges?.map((badge) => badge.label)).toEqual(['Chiffres ou unités différents', 'traduction automatique à relire'])
    expect(card.facts).toEqual([
      { label: 'Chiffres ou unités différents', value: 'absents : 30 ; ajoutés : 35', tone: 'warning' },
      { label: expect.stringMatching(/^Note de l’IA \(\d{4}-\d{2}-\d{2}\)$/), value: '« soute » rendu par « hold ».' }
    ])
    expect(card.actions?.map((action) => action.id)).toEqual(['accept', 'translate'])
    // La note de l'IA est écrite dans la note de l'exigence, comme la relecture.
    expect(await platform.fs.readText(hot.filePath!)).toContain('« soute » rendu par « hold ».')
  })

  it('« Valider la traduction » : elle n’est plus à relire, la fiche le dit', async () => {
    const { platform, hot, fiche, library } = await withAi()
    const param = encodeURIComponent(hot.filePath!)
    platform.httpAnswers.push(chat({ text: 'The system shall keep the hold between 5 °C and 30 °C.', notes: '' }))
    await wording(await fiche.load(param), 'en').actions![0]!.run()
    expect(cardsOf(await library.load()).find((card) => card.id === hot.filePath)!.tags).toContain('traductions')
    const accept = wording(await fiche.load(param), 'en').actions!.find((action) => action.id === 'accept')!
    expect(accept.label).toBe('Valider la traduction')
    await accept.run()
    expect(platform.notices.at(-1)).toBe(`${hot.id} : traduction EN validée.`)
    const card = wording(await fiche.load(param), 'en')
    expect(card.badges?.map((badge) => badge.label)).toEqual(['À jour'])
    expect(card.subtitle).toMatch(/^Traduite par la machine \(IA\), validée le /)
    expect(card.actions).toEqual([])
    expect(cardsOf(await library.load()).find((card) => card.id === hot.filePath)!.tags).not.toContain('traductions')
  })

  it('« Traduire (IA) » d’une exigence de la bibliothèque mène à sa fiche', async () => {
    const { platform, hot, shown, library } = await withAi()
    const card = cardsOf(await library.load()).find((each) => each.id === hot.filePath)!
    platform.httpAnswers.push(chat({ text: 'The system shall keep the hold between 5 °C and 30 °C.', notes: '' }))
    await card.actions!.find((action) => action.id === 'translate')!.run()
    expect(shown.at(-1)).toBe(`exigences.fiche?${encodeURIComponent(hot.filePath!)}`)
    expect(platform.opened).toEqual([])
  })

  it('traduire des exigences en série depuis la bibliothèque : les absentes cochées, un résumé, le filtre « Traductions à relire »', async () => {
    const { platform, library } = await withAi()
    const view = await library.load()
    expect(view.filters?.map((filter) => filter.id)).toContain('traductions')
    const action = view.actions!.find((each) => each.id === 'translate')!
    platform.httpAnswers.push(chat({ text: 'Access shall be logged if possible.', notes: '' }), chat({ text: 'The system shall keep the hold between 5 °C and 35 °C.', notes: '' }))
    await action.run()
    const asked = platform.manyAsked.at(-1)!
    expect(asked.title).toBe('Traduire en EN avec l’IA')
    expect(asked.choices.map((choice) => choice.description)).toEqual(['traduction absente', 'traduction absente'])
    expect(asked.selected).toHaveLength(2)
    expect(platform.notices.at(-1)).toBe('2 exigence(s) traduite(s) en EN, à relire puis valider sur leur fiche (filtre « Traductions à relire »). Chiffres ou unités différents de la source dans 1 : leur fiche le montre.')
    expect(cardsOf(await library.load()).every((card) => card.tags?.includes('traductions'))).toBe(true)
    expect(platform.opened).toEqual([])
  })

  it('sans IA : pas de « Traduire (IA) » sur la bibliothèque', async () => {
    const { views } = await start(memoryPlatform(), true)
    const view = await views.pages().find((each) => each.id === 'exigences.bibliotheque')!.load()
    expect(view.actions?.map((action) => action.id)).toEqual(['new', 'import', 'quality'])
  })
})

describe('importer des exigences, en page', () => {
  const csv = 'Exigence;Vérification;Priorité\nLe système doit démarrer en 5 s.;Essai;Haute\nLe système doit tenir 10 ans.;Analyse;Moyenne\n'
  const pick = (platform: MemoryPlatform, content = csv, name = 'Exigences client.csv') => {
    platform.choices.push('computer')
    platform.externalFiles.push([{ name, bytes: new TextEncoder().encode(content) }])
    platform.forms.push({ category: 'cli' })
  }
  const importParam = (piece: string) => `exigences.import?${encodeURIComponent(piece)}`

  it('« Importer » de la bibliothèque finit sur la page de l’import : ses chiffres, une carte par exigence créée, d’où elle vient', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    const library = await views.pages().find((each) => each.id === 'exigences.bibliotheque')!.load()
    pick(platform)
    await library.actions!.find((action) => action.id === 'import')!.run()
    expect(shown.at(-1)).toBe(importParam('Exigences client.csv'))
    expect(platform.notices.at(-1)).toBe('Exigences client.csv : 2 exigence(s) créée(s), 0 mise(s) à jour.')
    expect(platform.opened).toEqual([])
    const page = views.pages().find((each) => each.id === 'exigences.import')!
    expect(page.parent).toBe('exigences.bibliotheque')
    const view = await page.load(encodeURIComponent('Exigences client.csv'))
    expect(view.title).toBe('Importées de Exigences client.csv')
    expect(view.back?.label).toBe('Toute la bibliothèque')
    expect(view.actions?.map((action) => action.id)).toEqual(['again', 'library'])
    expect(view.filters?.map((filter) => filter.id)).toEqual(['creees', 'mises-a-jour', 'faibles', 'a-revoir'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}:${stat.value}`)).toEqual(['Venues de ce fichier:2', 'Créées:2', 'Mises à jour:0', 'Faibles:0'])
    const cards = cardsOf(view)
    expect(cards.map((card) => card.title)).toEqual(['REQ-CLI-0001', 'REQ-CLI-0002'])
    expect(cards[0]!.badges?.slice(0, 2).map((badge) => badge.label)).toEqual(['Créée par l’import', 'ligne 1'])
    expect(cards[0]!.tags).toContain('creees')
    // Un clic ouvre la fiche, comme dans la bibliothèque.
    await cards[0]!.open!.run()
    expect(shown.at(-1)).toBe(`exigences.fiche?${encodeURIComponent('Exigences/REQ-CLI-0001.md')}`)
  })

  it('le même fichier, modifié : les exigences mises à jour marquées ; ce qui n’a pas pu l’être est dit', async () => {
    const platform = memoryPlatform()
    const { views } = await start(platform, true)
    const tile = views.allTiles().find((each) => each.id === 'exigences.importer')!
    pick(platform)
    await tile.run()
    pick(platform, 'Identifiant;Exigence\nREQ-CLI-0001;Le système doit démarrer en 3 s.\n')
    await tile.run()
    const view = await views.pages().find((each) => each.id === 'exigences.import')!.load(encodeURIComponent('Exigences client.csv'))
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.slice(1, 3).map((stat) => `${stat.label}:${stat.value}`)).toEqual(['Créées:0', 'Mises à jour:1'])
    const cards = cardsOf(view)
    expect(cards.map((card) => `${card.title}:${card.badges![0]!.label}`)).toEqual(['REQ-CLI-0001:Mise à jour par l’import', 'REQ-CLI-0002:ligne 2'])
  })

  it('depuis la palette : le message seul ; la fiche d’une exigence importée mène à la page de son fichier', async () => {
    const platform = memoryPlatform()
    const { views, shown, run } = await start(platform, true)
    pick(platform)
    await run('exigences-importer')
    expect(shown).toEqual([])
    expect(platform.notices.at(-1)).toBe('Exigences client.csv : 2 exigence(s) créée(s), 0 mise(s) à jour.')
    const fiche = await views.pages().find((each) => each.id === 'exigences.fiche')!.load(encodeURIComponent('Exigences/REQ-CLI-0002.md'))
    const origin = fiche.blocks.flatMap((block) => (block.kind === 'list' ? block.items : [])).find((item) => item.id === 'origin')!
    expect(origin.open?.label).toBe('Toutes les exigences de ce fichier')
    await origin.open!.run()
    expect(shown.at(-1)).toBe(importParam('Exigences client.csv'))
  })

  it('un fichier du coffre : la page porte son nom ; un fichier dont rien ne vient le dit', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    await platform.fs.writeBinary('Reçus/Exigences client.csv', new TextEncoder().encode(csv).buffer as ArrayBuffer)
    platform.choices.push('vault')
    platform.nextPick = 'Reçus/Exigences client.csv'
    platform.forms.push({ category: 'cli' })
    await views.allTiles().find((each) => each.id === 'exigences.importer')!.run()
    expect(shown.at(-1)).toBe(importParam('[[Reçus/Exigences client.csv|Exigences client.csv]]'))
    const page = views.pages().find((each) => each.id === 'exigences.import')!
    expect((await page.load(encodeURIComponent('[[Reçus/Exigences client.csv|Exigences client.csv]]'))).title).toBe('Importées de Exigences client.csv')
    const empty = await page.load(encodeURIComponent('[[Ailleurs/Autre.xlsx]]'))
    expect(empty.title).toBe('Importées de Autre.xlsx')
    expect(empty.blocks).toEqual([{ kind: 'message', tone: 'info', text: 'Aucune exigence de la bibliothèque ne vient de Autre.xlsx.' }])
  })

  it('sans page chez la plateforme : la tuile importe, le message seul', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, false)
    pick(platform)
    await views.allTiles().find((each) => each.id === 'exigences.importer')!.run()
    expect(shown).toEqual([])
    expect(platform.notices.at(-1)).toBe('Exigences client.csv : 2 exigence(s) créée(s), 0 mise(s) à jour.')
  })
})

describe('analyser la qualité, en page', () => {
  const REPORT = 'Exigences/Qualité des exigences.md'

  it('« Analyser la qualité » de la bibliothèque, la tuile et le tableau de bord ouvrent la page ; rien n’est écrit ni ouvert', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    const library = await views.pages().find((each) => each.id === 'exigences.bibliotheque')!.load()
    await library.actions!.find((action) => action.id === 'quality')!.run()
    const tile = views.allTiles().find((each) => each.id === 'exigences.qualite')!
    expect(tile.page).toBe('exigences.qualite')
    await tile.run()
    const section = await views.homeSections().find((each) => each.id === 'exigences.library')!.load()
    const blocks = section!.blocks.flatMap((block) => (block.kind === 'actions' ? block.actions : []))
    await blocks.find((action) => action.id === 'quality')!.run()
    expect(shown).toEqual(Array(3).fill('exigences.qualite'))
    expect(await platform.fs.exists(REPORT)).toBe(false)
    expect(platform.opened).toEqual([])
  })

  it('la page : ses chiffres, une carte par exigence (les plus faibles d’abord), les défauts, les axes, les rattachements', async () => {
    const { views, shown } = await start(memoryPlatform(), true)
    const page = views.pages().find((each) => each.id === 'exigences.qualite')!
    expect(page.title).toBe('Qualité des exigences')
    expect(page.parent).toBe('exigences.bibliotheque')
    const view = await page.load()
    expect(view.back?.label).toBe('Toute la bibliothèque')
    expect(view.actions?.map((action) => `${action.id}:${action.label}`)).toEqual(['report:Écrire le rapport', 'library:Toute la bibliothèque'])
    expect(view.filters?.map((filter) => filter.id)).toEqual(['faibles', 'non-verifiables', 'doublons', 'bonnes', 'relues'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => stat.label)).toEqual(['Exigences', 'Note moyenne', 'Faibles', 'Non vérifiables', 'Doublons probables'])
    expect(stats?.kind === 'stats' && stats.stats[0]!.value).toBe('2')
    const cards = cardsOf(view)
    expect(cards.map((card) => card.title)).toEqual(['REQ-SEC-0001 — Journalisation', 'REQ-SOL-0001 — Maintien en température'])
    expect(cards[0]!.subtitle).toMatch(/si possible/)
    expect(cards[0]!.tags).toContain('faibles')
    await cards[0]!.open!.run()
    expect(shown.at(-1)).toMatch(/^exigences\.fiche\?/)
    const lists = view.blocks.filter((block) => block.kind === 'list').map((block) => block.kind === 'list' && block.title)
    expect(lists).toEqual(['Défauts les plus fréquents', 'Doublons probables', 'Par axe de la norme', 'Répartition des notes', 'Rattachements'])
    expect(view.blocks.find((block) => block.kind === 'message')).toMatchObject({ tone: 'info', text: expect.stringContaining('rien n’est écrit') })
  })

  it('« Écrire le rapport » : la note écrite sans quitter la page ; puis « Ouvrir le rapport »', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    const page = views.pages().find((each) => each.id === 'exigences.qualite')!
    await (await page.load()).actions!.find((action) => action.id === 'report')!.run()
    expect(await platform.fs.exists(REPORT)).toBe(true)
    expect(platform.notices.at(-1)).toMatch(/^Qualité des exigences : 2 exigence\(s\).*Le rapport est écrit dans la bibliothèque\.$/)
    expect(platform.opened).toEqual([])
    expect(shown).toEqual([])
    const after = await page.load()
    expect(after.actions?.map((action) => `${action.id}:${action.label}`)).toEqual(['report:Mettre à jour le rapport', 'note:Ouvrir le rapport', 'library:Toute la bibliothèque'])
    await after.actions!.find((action) => action.id === 'note')!.run()
    expect(platform.opened).toEqual([REPORT])
    // Une note vide (une plateforme qui lit vide une note absente) n'est pas un rapport.
    await platform.fs.writeText(REPORT, '')
    expect((await page.load()).actions?.map((action) => action.id)).toEqual(['report', 'library'])
    // Le rapport, ouvert par un autre module : la page de la qualité, pas une fiche introuvable.
    expect(await views.pageForNote(REPORT)).toBe('exigences.qualite')
  })

  it('depuis la palette, ou sans page chez la plateforme : le rapport écrit et ouvert, comme avant', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform, true)
    await run('exigences-qualite')
    expect(platform.opened).toEqual([REPORT])
    const other = memoryPlatform()
    const { views } = await start(other, false)
    await views.allTiles().find((each) => each.id === 'exigences.qualite')!.run()
    expect(other.opened).toEqual([REPORT])
  })
})

describe('nouvelle exigence, en page', () => {
  const form = (title: string) => ({ category: 'gen', title, text: 'Le système doit redémarrer en moins de 2 min.', type: 'performance', status: 'draft', criticality: 'medium', verification: 'test', source: '', rationale: '' })

  it('la bibliothèque, le tableau de bord et la tuile : la fiche de l’exigence créée, pas sa note', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    const library = await views.pages().find((each) => each.id === 'exigences.bibliotheque')!.load()
    platform.forms.push(form('Redémarrage'))
    await library.actions!.find((action) => action.id === 'new')!.run()
    expect(shown.at(-1)).toBe(`exigences.fiche?${encodeURIComponent('Exigences/REQ-GEN-0001 Redémarrage.md')}`)
    expect(platform.notices.at(-1)).toBe('Exigence REQ-GEN-0001 créée.')
    const section = await views.homeSections().find((each) => each.id === 'exigences.library')!.load()
    platform.forms.push(form('Reprise'))
    await section!.blocks.flatMap((block) => (block.kind === 'actions' ? block.actions : [])).find((action) => action.id === 'new')!.run()
    expect(shown.at(-1)).toBe(`exigences.fiche?${encodeURIComponent('Exigences/REQ-GEN-0002 Reprise.md')}`)
    platform.forms.push(form('Arrêt'))
    await views.allTiles().find((each) => each.id === 'exigences.nouvelle')!.run()
    expect(shown.at(-1)).toBe(`exigences.fiche?${encodeURIComponent('Exigences/REQ-GEN-0003 Arrêt.md')}`)
    expect(platform.opened).toEqual([])
    // La fiche est celle de l'exigence créée.
    const fiche = await views.pages().find((each) => each.id === 'exigences.fiche')!.load(encodeURIComponent('Exigences/REQ-GEN-0003 Arrêt.md'))
    expect(fiche.title).toBe('REQ-GEN-0003 — Arrêt')
  })

  it('le formulaire abandonné : on reste où l’on est', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    await views.allTiles().find((each) => each.id === 'exigences.nouvelle')!.run()
    expect(shown).toEqual([])
    expect(platform.opened).toEqual([])
  })

  it('depuis la palette, ou sans page chez la plateforme : la note, comme avant', async () => {
    const platform = memoryPlatform()
    const { run, shown } = await start(platform, true)
    platform.forms.push(form('Redémarrage'))
    await run('exigences-nouvelle')
    expect(platform.opened).toEqual(['Exigences/REQ-GEN-0001 Redémarrage.md'])
    expect(shown).toEqual([])
    const other = memoryPlatform()
    const { views } = await start(other, false)
    other.forms.push(form('Reprise'))
    await views.allTiles().find((each) => each.id === 'exigences.nouvelle')!.run()
    expect(other.opened).toEqual(['Exigences/REQ-GEN-0001 Reprise.md'])
  })
})

describe('modifier la fiche, en page', () => {
  const edit = (title: string, text: string) => ({ title, text, type: 'security', status: 'proposed', criticality: 'high', verification: 'inspection', source: 'CCTP § 3', rationale: 'Traçabilité des accès.', owner: 'Équipe sol', tags: '', aliases: '' })

  it('sur la fiche : la fiche modifiée, redessinée ; un titre modifié renomme la note, la fiche la suit', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    const weak = (await requirementsAt('Exigences').all()).find((each) => each.title === 'Journalisation')!
    const page = views.pages().find((each) => each.id === 'exigences.fiche')!
    const fiche = await page.load(encodeURIComponent(weak.filePath!))
    platform.forms.push(edit('Journalisation', 'Les accès doivent être journalisés.'))
    await fiche.actions!.find((action) => action.id === 'edit')!.run()
    // Même titre, même note : la page se redessine, sans aller ailleurs.
    expect(shown).toEqual([])
    expect(platform.notices.at(-1)).toBe(`Exigence ${weak.id} enregistrée (révision 2).`)
    const after = await page.load(encodeURIComponent(weak.filePath!))
    expect(cardsOf(after).find((card) => card.id === 'text-fr')!.text).toBe('Les accès doivent être journalisés.')
    platform.forms.push(edit('Journal des accès', 'Les accès doivent être journalisés.'))
    await after.actions!.find((action) => action.id === 'edit')!.run()
    const renamed = `Exigences/${weak.id} Journal des accès.md`
    expect(shown.at(-1)).toBe(`exigences.fiche?${encodeURIComponent(renamed)}`)
    expect(platform.opened).toEqual([])
  })

  it('« Retour » vers l’ancien nom d’une exigence renommée : sa fiche, pas « introuvable »', async () => {
    const platform = memoryPlatform()
    const { views } = await start(platform, true)
    const weak = (await requirementsAt('Exigences').all()).find((each) => each.title === 'Journalisation')!
    const page = views.pages().find((each) => each.id === 'exigences.fiche')!
    platform.forms.push(edit('Journal des accès', 'Les accès doivent être journalisés.'))
    await (await page.load(encodeURIComponent(weak.filePath!))).actions!.find((action) => action.id === 'edit')!.run()
    const old = await page.load(encodeURIComponent(weak.filePath!))
    expect(old.title).toBe(`${weak.id} — Journal des accès`)
    expect(old.actions?.map((action) => action.id)).toEqual(['edit', 'note'])
  })

  it('« Modifier » d’une carte de la bibliothèque mène à la fiche modifiée', async () => {
    const platform = memoryPlatform()
    const { views, shown } = await start(platform, true)
    const weak = (await requirementsAt('Exigences').all()).find((each) => each.title === 'Journalisation')!
    const card = cardsOf(await views.pages().find((each) => each.id === 'exigences.bibliotheque')!.load()).find((each) => each.id === weak.filePath)!
    platform.forms.push(edit('Journal des accès', 'Les accès doivent être journalisés.'))
    await card.actions!.find((action) => action.id === 'edit')!.run()
    expect(shown.at(-1)).toBe(`exigences.fiche?${encodeURIComponent(`Exigences/${weak.id} Journal des accès.md`)}`)
  })

  it('le formulaire abandonné : rien ne bouge ; depuis la palette, la note renommée s’ouvre, comme avant', async () => {
    const platform = memoryPlatform()
    const { views, shown, run } = await start(platform, true)
    const weak = (await requirementsAt('Exigences').all()).find((each) => each.title === 'Journalisation')!
    const card = cardsOf(await views.pages().find((each) => each.id === 'exigences.bibliotheque')!.load()).find((each) => each.id === weak.filePath)!
    await card.actions!.find((action) => action.id === 'edit')!.run()
    expect(shown).toEqual([])
    platform.active = weak.filePath!
    platform.forms.push(edit('Journal des accès', 'Les accès doivent être journalisés.'))
    await run('exigences-modifier')
    expect(platform.opened).toEqual([`Exigences/${weak.id} Journal des accès.md`])
    expect(shown).toEqual([])
  })
})
