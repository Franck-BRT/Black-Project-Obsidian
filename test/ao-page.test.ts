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
import { exigencesModule, requirementsAt } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule } from '../src/modules/workflows'

const MODULES = [lectureFichiersModule, typagePiecesModule, exigencesModule, iaModule, workflowsModule, aoModule]
const TODAY = new Date().toISOString().slice(0, 10)
/** Une date à `days` jours d'aujourd'hui, en toutes lettres (« 12 décembre 2026 »). */
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

async function start(platform: MemoryPlatform, withPages: boolean, ia: Record<string, unknown> = {}) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false }, ia }
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
  const maintenance = await createAnalysis(services, 'Maintenance antennes', { position: 'emetteur', buyer: 'Centre spatial', reference: 'MA-07' })
  return {
    views,
    shown,
    station,
    maintenance,
    run: (id: string) => commands.get(id)!.run(),
    importInto: (markdown: string) => importFiles(services, station, [{ name: 'CCTP.md', bytes: enc(markdown) }]),
    // La réponse d'un candidat, pour l'émetteur.
    respond: (candidate: string, name: string, markdown: string) =>
      importFiles(services, maintenance, [{ name, bytes: enc(markdown) }], async (request) => ({ places: Object.fromEntries(request.pending.map((piece) => [piece.path, 'reponse' as const])), candidate }))
  }
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

describe('la fiche d’un candidat (émetteur), en page', () => {
  async function fiche() {
    const run = await start(memoryPlatform(), true)
    const text = (body: string) => ({ fr: { body, lang: 'fr', origin: 'human' as const, reviewed: true, by: '', at: '', fromRev: 1 } })
    const store = requirementsAt(`${run.maintenance.folder}/Exigences`)
    await store.create({ category: 'MA', title: 'Antenne', text: text('Le titulaire doit fournir une antenne parabolique de 3,7 m de diamètre.') })
    await store.create({ category: 'MA', title: 'Astreinte', text: text('Le titulaire doit assurer une astreinte téléphonique 24 heures sur 24.') })
    await run.respond('Acme', 'Mémoire technique.md', '# Mémoire technique\n\nNous fournissons une antenne parabolique de 3,7 m de diamètre, livrée et posée.\n')
    return run
  }

  it('la fiche de l’analyse montre ses candidats ; un clic ouvre la fiche du candidat', async () => {
    const { views, shown, maintenance } = await fiche()
    const view = await views.pages().find((each) => each.id === 'ao.fiche')!.load(encodeURIComponent(maintenance.note))
    const group = view.blocks.find((block) => block.kind === 'cards' && block.title === 'Candidats (1)')
    const acme = group?.kind === 'cards' ? group.cards[0]! : null
    expect(acme).toMatchObject({ title: 'Acme', subtitle: '1 pièce(s) de réponse', badges: [{ label: 'Couverture 50 %', tone: 'warning' }] })
    await acme!.open!.run()
    expect(shown.at(-1)).toBe(`ao.candidat?${encodeURIComponent(maintenance.note)}&Acme`)
  })

  it('sa réponse, et la couverture des exigences par elle : les absentes d’abord', async () => {
    const { views, maintenance } = await fiche()
    const page = views.pages().find((each) => each.id === 'ao.candidat')!
    expect(page.parent).toBe('ao.analyses')
    const view = await page.load(`${encodeURIComponent(maintenance.note)}&Acme`)
    expect(view.title).toBe('Acme')
    expect(view.back?.label).toBe('L’analyse « Maintenance antennes »')
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Exigences couvertes=50 %', 'À vérifier=0', 'Absentes=1', 'Pièces=1'])
    const response = view.blocks.find((block) => block.kind === 'cards')
    expect(response?.kind === 'cards' && response.cards.map((card) => card.title)).toEqual(['Mémoire technique.md'])
    const coverage = view.blocks.find((block) => block.kind === 'list')
    expect(coverage?.kind === 'list' && coverage.items.map((item) => `${item.title.split(' — ')[1]}:${item.tone}`)).toEqual(['Astreinte:danger', 'Antenne:success'])
  })

  it('un candidat inconnu : la page le dit', async () => {
    const { views, maintenance } = await fiche()
    expect((await views.pages().find((each) => each.id === 'ao.candidat')!.load(`${encodeURIComponent(maintenance.note)}&Inconnu`)).title).toBe('Candidat introuvable')
  })
})

describe('une note produite par l’analyse, en page', () => {
  async function calendar(withPages = true) {
    const platform = memoryPlatform()
    const opened: string[] = []
    platform.ui.openNote = async (path) => void opened.push(path)
    const run = await start(platform, withPages)
    const fiche = run.views.pages().find((each) => each.id === 'ao.fiche')!
    await (await fiche.load(encodeURIComponent(run.station.note))).actions!.find((action) => action.id === 'calendar')!.run()
    const view = await fiche.load(encodeURIComponent(run.station.note))
    const produced = view.blocks.filter((block) => block.kind === 'list')[2]
    const item = produced?.kind === 'list' ? produced.items[0]! : null
    return { ...run, platform, opened, item: item!, path: `${run.station.folder}/Analyse/Calendrier.md`, page: run.views.pages().find((each) => each.id === 'ao.note') }
  }

  it('un clic sur une note produite (fiche de l’analyse) ouvre sa page ; elle dépend des analyses', async () => {
    const { item, shown, path, page } = await calendar()
    expect(item.open?.label).toBe('Voir la note')
    await item.open!.run()
    expect(shown.at(-1)).toBe(`ao.note?${encodeURIComponent(path)}`)
    expect(page!.parent).toBe('ao.analyses')
  })

  it('le calendrier, lisible : sections en listes, sans en-tête ni marques ; un lien ouvre la fiche de la pièce', async () => {
    const { page, path, shown } = await calendar()
    const view = await page!.load(encodeURIComponent(path))
    expect(view.title).toBe('Calendrier — Station sol')
    expect(view.back?.label).toBe('L’analyse « Station sol »')
    expect(view.subtitle).toBe('Station sol · Analyse/Calendrier.md')
    expect(view.actions?.map((action) => action.id)).toEqual(['update', 'note', 'analysis'])
    expect(view.search?.label).toBe('Chercher dans la note')
    expect(view.blocks.map((block) => `${block.kind}:${'title' in block ? (block.title ?? '') : ''}`)).toEqual(['text:', 'list:À retenir', 'list:Dates', 'text:Délais'])
    const all = JSON.stringify(view.blocks)
    for (const syntax of ['bp-type', '<!--', '[[', '**', '| ---']) expect(all).not.toContain(syntax)
    const kept = view.blocks[1]!.kind === 'list' ? view.blocks[1]!.items : []
    expect(kept.map((item) => item.title)).toEqual(['Date limite de remise des offres', 'Validité des offres'])
    expect(kept[0]!.detail).toMatch(/« La date limite de remise des offres est fixée au .* » \(RC\)$/)
    const row = view.blocks[2]!.kind === 'list' ? view.blocks[2]!.items[0]! : null
    expect(row!.detail).toMatch(/^Date limite de remise des offres — La date limite .* — RC$/)
    // Le lien d'une cellule de tableau (« [[…|RC]] », le « | » échappé) mène à la fiche de la pièce.
    await row!.open!.run()
    expect(shown.at(-1)).toMatch(/^ao\.piece\?.*RC\.md$/)
  })

  it('« Mettre à jour » relance ce qui écrit la note ; « Ouvrir la note » l’ouvre dans le coffre', async () => {
    const { page, path, platform, opened } = await calendar()
    const written = new TextDecoder().decode(platform.files.get(path))
    await platform.fs.writeText(path, written.replace(/## Dates[\s\S]*?(<!-- bp:calendrier:fin)/, '$1'))
    expect((await page!.load(encodeURIComponent(path))).blocks.some((block) => block.kind === 'list' && block.title === 'Dates')).toBe(false)
    const view = await page!.load(encodeURIComponent(path))
    const before = opened.length
    await view.actions!.find((action) => action.id === 'update')!.run()
    expect((await page!.load(encodeURIComponent(path))).blocks.some((block) => block.kind === 'list' && block.title === 'Dates')).toBe(true)
    // Relancée depuis sa page, la commande ne quitte pas la page pour la note.
    expect(opened.length).toBe(before)
    await view.actions!.find((action) => action.id === 'note')!.run()
    expect(opened.at(-1)).toBe(path)
  })

  it('une question : paragraphes, encadré, sources avec leurs passages, ton des marques ; la recherche porte sur tout', async () => {
    const { page, platform, station } = await calendar()
    const path = `${station.folder}/Analyse/Questions/2026-11-06 Pénalités.md`
    await platform.fs.writeText(
      path,
      [
        '---',
        'bp-type: ao-question',
        '---',
        '',
        '# Quelles pénalités ?',
        '',
        '## Réponse',
        '',
        'Les pénalités de retard sont de **1/1000** par jour',
        'calendaire [1].',
        '',
        '> [!warning] La source [3] n’existe pas.',
        '',
        '### Sources',
        '',
        `1. [[${station.folder}/Pièces/Appel d'offres/RC|RC]] — article 7`,
        '   > [!quote]- 1 passage',
        '   > Le titulaire encourt une pénalité.',
        '',
        '---',
        '',
        '| Point | État |',
        '| --- | --- |',
        '| Plafond | 🟥 absent |',
        '| Taux | ✅ trouvé |',
        '',
        '## Notes',
        ''
      ].join('\n')
    )
    const view = await page!.load(encodeURIComponent(path))
    expect(view.title).toBe('Quelles pénalités ?')
    expect(view.actions?.map((action) => action.id)).toEqual(['note', 'analysis'])
    expect(view.blocks[0]).toEqual({ kind: 'text', title: 'Réponse', paragraphs: ['Les pénalités de retard sont de 1/1000 par jour calendaire [1].'] })
    expect(view.blocks[1]).toEqual({ kind: 'message', tone: 'warning', text: 'La source [3] n’existe pas.' })
    const sources = view.blocks[2]!.kind === 'list' ? view.blocks[2]! : null
    expect(sources?.title).toBe('Sources')
    expect(sources?.items[0]).toMatchObject({ title: 'RC — article 7', detail: 'Le titulaire encourt une pénalité.' })
    expect(sources?.items[0]!.open?.label).toBe('Ouvrir la fiche de la pièce')
    // Un tableau sans titre à lui reprend celui de sa section : il reste dans un cadre.
    expect(view.blocks[3]).toMatchObject({ kind: 'list', title: 'Sources' })
    const table = view.blocks[3]!.kind === 'list' ? view.blocks[3]!.items : []
    expect(table.map((item) => `${item.title}:${item.detail}:${item.tone}`)).toEqual(['Plafond:absent:danger', 'Taux:trouvé:success'])
  })

  it('sans page chez la plateforme : la note s’ouvre dans le coffre ; une note disparue : la page le dit', async () => {
    const { item, opened, path, views } = await calendar(false)
    // Le calendrier écrit s'est ouvert une fois ; le clic sur la note l'ouvre encore, dans le coffre.
    await item.open!.run()
    expect(opened).toEqual([path, path])
    expect(views.pages().find((each) => each.id === 'ao.note')).toBeDefined()
    const { page } = await calendar()
    expect((await page!.load(encodeURIComponent('Appels d’offres/X/Analyse/Disparue.md'))).title).toBe('Note introuvable')
  })
})

describe('une question au dossier, en page', () => {
  const chat = (content: string) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) })
  const QUESTION = 'Quelle est la date limite de remise des offres ?'

  /** Interroger depuis la fiche de l'analyse : la réponse de l'IA (simulée) cite le RC. */
  async function asked(withPages = true) {
    const platform = memoryPlatform()
    const run = await start(platform, withPages, { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' })
    const fiche = run.views.pages().find((each) => each.id === 'ao.fiche')!
    platform.forms.push({ question: QUESTION, mode: 'search' })
    platform.httpAnswers.push(chat('Les offres sont à remettre dans 12 jours, selon le règlement [1].'))
    await (await fiche.load(encodeURIComponent(run.station.note))).actions!.find((action) => action.id === 'ask')!.run()
    const path = [...platform.files.keys()].find((each) => each.includes('/Analyse/Questions/'))!
    return { ...run, platform, fiche, path, page: run.views.pages().find((each) => each.id === 'ao.question')! }
  }

  it('« Interroger » depuis l’interface : la réponse s’ouvre sur sa page, plus dans la note', async () => {
    const { shown, path, platform, page } = await asked()
    expect(shown.at(-1)).toBe(`ao.question?${encodeURIComponent(path)}`)
    expect(platform.opened).toEqual([])
    expect(page.parent).toBe('ao.analyses')
  })

  it('la question en titre, ses chiffres, la réponse, une carte par source qui ouvre la fiche de la pièce', async () => {
    const { page, path, shown } = await asked()
    const view = await page.load(encodeURIComponent(path))
    expect(view.title).toBe(QUESTION)
    expect(view.back?.label).toBe('L’analyse « Station sol »')
    expect(view.subtitle).toBe(`Station sol · ${TODAY} · Recherche dans les pièces`)
    expect(view.actions?.map((action) => action.id)).toEqual(['again', 'ask', 'note', 'analysis'])
    expect(view.filters?.map((filter) => filter.id)).toEqual(['citees', 'non-citees'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Sources transmises=1', 'Citées dans la réponse=1', 'Transmises, non citées=0', 'Extraits transmis=1'])
    expect(view.blocks.find((block) => block.kind === 'text')).toEqual({ kind: 'text', title: 'Réponse', paragraphs: ['Les offres sont à remettre dans 12 jours, selon le règlement [1].'], empty: 'Pas de réponse dans la note.' })
    const sources = view.blocks.find((block) => block.kind === 'cards')
    const rc = sources?.kind === 'cards' ? sources.cards[0]! : null
    expect(sources?.kind === 'cards' && sources.title).toBe('Sources (1)')
    expect(rc).toMatchObject({ title: '[1] RC', badges: [{ label: 'Citée', tone: 'success' }], tags: ['citees'] })
    expect(rc!.text).toContain('La date limite de remise des offres est fixée au')
    await rc!.open!.run()
    expect(shown.at(-1)).toMatch(/^ao\.piece\?.*RC\.md$/)
  })

  it('la fiche de l’analyse liste les questions posées ; la note produite d’une question mène à sa page', async () => {
    const { fiche, station, path, shown, views } = await asked()
    const view = await fiche.load(encodeURIComponent(station.note))
    const lists = view.blocks.filter((block) => block.kind === 'list')
    const produced = lists.find((block) => block.kind === 'list' && block.title === 'Ce que l’analyse a produit')
    expect(produced?.kind === 'list' && produced.items).toEqual([])
    const questions = lists.find((block) => block.kind === 'list' && block.title === 'Questions au dossier (1)')
    const item = questions?.kind === 'list' ? questions.items[0]! : null
    expect(item).toMatchObject({ title: QUESTION, when: TODAY, detail: '1 source(s) citée(s) sur 1', tone: 'success' })
    await item!.open!.run()
    expect(shown.at(-1)).toBe(`ao.question?${encodeURIComponent(path)}`)
    const produite = await views.pages().find((each) => each.id === 'ao.note')!.load(encodeURIComponent(path))
    expect(produite.title).toBe(QUESTION)
  })

  it('« Reposer la question » : la fenêtre, la question déjà écrite ; la nouvelle réponse dans une nouvelle note', async () => {
    const { page, path, platform, shown } = await asked()
    const view = await page.load(encodeURIComponent(path))
    platform.forms.push({ question: QUESTION, mode: 'each' })
    platform.httpAnswers.push(chat('Rien de plus.'), chat('Dans 12 jours [1].'))
    await view.actions!.find((action) => action.id === 'again')!.run()
    const form = platform.asked.at(-1)!
    expect(form.fields.find((field) => field.key === 'question')).toMatchObject({ value: QUESTION })
    expect(form.fields.find((field) => field.key === 'mode')).toMatchObject({ value: 'search' })
    const notes = [...platform.files.keys()].filter((each) => each.includes('/Analyse/Questions/'))
    expect(notes).toHaveLength(2)
    expect(shown.at(-1)).toBe(`ao.question?${encodeURIComponent(notes.find((each) => each !== path)!)}`)
  })

  it('sans page chez la plateforme : la note de la réponse s’ouvre ; une question disparue : la page le dit', async () => {
    const { platform, path } = await asked(false)
    expect(platform.opened).toEqual([path])
    const { page } = await asked()
    expect((await page.load(encodeURIComponent('Appels d’offres/X/Analyse/Questions/x.md'))).title).toBe('Question introuvable')
  })
})

describe('le questionnaire, en page', () => {
  const chat = (content: string) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) })

  async function questionnaire(ia: Record<string, unknown> = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }) {
    const platform = memoryPlatform()
    const run = await start(platform, true, ia)
    const fiche = run.views.pages().find((each) => each.id === 'ao.fiche')!
    const path = `${run.station.folder}/Analyse/Questionnaire.md`
    return {
      ...run,
      platform,
      fiche,
      path,
      page: run.views.pages().find((each) => each.id === 'ao.questionnaire')!,
      theme: run.views.pages().find((each) => each.id === 'ao.questionnaire.theme')!
    }
  }

  /** Remplir deux thèmes : les critères d'attribution (le RC cité), les pénalités (rien dans les pièces : l'IA n'est pas appelée). */
  async function filled() {
    const run = await questionnaire()
    run.platform.manyAnswers.push(['attribution', 'penalites'])
    run.platform.httpAnswers.push(chat('Les offres sont jugées selon le règlement de la consultation [1].'))
    const view = await run.page.load(encodeURIComponent(run.path))
    await view.actions!.find((action) => action.id === 'fill')!.run()
    return run
  }

  it('« Questionnaire » sur la fiche ouvre sa page : les six thèmes, pas encore posés', async () => {
    const { fiche, station, shown, page, path } = await questionnaire()
    await (await fiche.load(encodeURIComponent(station.note))).actions!.find((action) => action.id === 'questionnaire')!.run()
    expect(shown.at(-1)).toBe(`ao.questionnaire?${encodeURIComponent(path)}`)
    expect(page.parent).toBe('ao.analyses')
    const view = await page.load(encodeURIComponent(path))
    expect(view.title).toBe('Questionnaire — Station sol')
    expect(view.back?.label).toBe('L’analyse « Station sol »')
    expect(view.actions?.map((action) => `${action.id}:${action.primary ?? false}`)).toEqual(['fill:true', 'analysis:false'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Thèmes posés=0 / 6', 'Citées dans la réponse=0', 'Sans source citée=0', 'Rien dans les pièces=0', 'Pas encore posées=6'])
    const cards = cardsOf(view)
    expect(cards.map((card) => card.title)).toEqual(['Critères d’attribution', 'Pénalités', 'Garanties', 'Propriété intellectuelle', 'Confidentialité', 'Contrôle export'])
    expect(cards[0]).toMatchObject({ subtitle: 'Pas encore posée', badges: [{ label: 'Pas encore posée', tone: 'neutral' }], tags: ['a-poser'] })
    expect(cards[0]!.text).toMatch(/^Quels sont les critères d’attribution/)
    expect(cards[0]!.actions?.map((action) => action.label)).toEqual(['Poser la question'])
  })

  it('« Remplir le questionnaire » : les thèmes choisis, sans quitter la page ; chacun dit s’il a une source citée', async () => {
    const { page, path, platform, fiche, station, shown } = await filled()
    expect(platform.opened).toEqual([])
    expect(platform.requests).toHaveLength(1)
    const view = await page.load(encodeURIComponent(path))
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Thèmes posés=2 / 6', 'Citées dans la réponse=1', 'Sans source citée=0', 'Rien dans les pièces=1', 'Pas encore posées=4'])
    const cards = cardsOf(view)
    expect(cards.map((card) => card.tags![0])).toEqual(['repondues', 'rien', 'a-poser', 'a-poser', 'a-poser', 'a-poser'])
    expect(cards[0]).toMatchObject({ subtitle: `Posée le ${TODAY}`, text: 'Les offres sont jugées selon le règlement de la consultation [1].', badges: [{ label: 'Répondue', tone: 'success' }] })
    expect(cards[0]!.facts).toEqual([{ label: 'Sources citées', value: '1 / 1' }])
    expect(view.actions?.map((action) => action.id)).toEqual(['fill', 'note', 'analysis'])
    // La note du questionnaire, dans « Ce que l'analyse a produit », mène à cette page.
    const analysis = await fiche.load(encodeURIComponent(station.note))
    const produced = analysis.blocks.find((block) => block.kind === 'list' && block.title === 'Ce que l’analyse a produit')
    await (produced?.kind === 'list' ? produced.items : []).find((item) => item.title === 'Questionnaire')!.open!.run()
    expect(shown.at(-1)).toBe(`ao.questionnaire?${encodeURIComponent(path)}`)
  })

  it('un thème : la question posée, la réponse, une carte par source ; « Reposer cette question » ne pose que lui', async () => {
    const { page, theme, path, platform, shown } = await filled()
    await cardsOf(await page.load(encodeURIComponent(path)))[0]!.open!.run()
    expect(shown.at(-1)).toBe(`ao.questionnaire.theme?${encodeURIComponent(path)}&attribution`)
    expect(theme.parent).toBe('ao.analyses')
    const view = await theme.load(`${encodeURIComponent(path)}&attribution`)
    expect(view.title).toBe('Critères d’attribution')
    expect(view.back?.label).toBe('Le questionnaire de « Station sol »')
    expect(view.subtitle).toBe(`Station sol · Posée le ${TODAY}`)
    expect(view.actions?.map((action) => action.id)).toEqual(['again', 'questionnaire', 'note'])
    const texts = view.blocks.filter((block) => block.kind === 'text')
    expect(texts.map((block) => block.kind === 'text' && block.title)).toEqual(['La question posée', 'Réponse'])
    expect(texts[0]!.kind === 'text' && texts[0]!.paragraphs[0]).toMatch(/^Quels sont les critères d’attribution/)
    const sources = view.blocks.find((block) => block.kind === 'cards')
    expect(sources?.kind === 'cards' && sources.cards.map((card) => `${card.title}:${card.tags![0]}`)).toEqual(['[1] RC:citees'])
    const asked = platform.manyAsked.length
    // Reposée, la réponse ne cite plus rien : le thème est « Sans source citée », la page avertit.
    platform.httpAnswers.push(chat('Selon le règlement, de nouveau.'))
    await view.actions!.find((action) => action.id === 'again')!.run()
    expect(platform.manyAsked.length).toBe(asked)
    const again = await theme.load(`${encodeURIComponent(path)}&attribution`)
    const answer = again.blocks.filter((block) => block.kind === 'text')[1]
    expect(answer?.kind === 'text' && answer.paragraphs).toEqual(['Selon le règlement, de nouveau.'])
    expect(again.blocks.some((block) => block.kind === 'message' && block.tone === 'warning' && block.text.startsWith('La réponse ne cite aucune source'))).toBe(true)
    const cards = cardsOf(await page.load(encodeURIComponent(path)))
    expect(cards[0]).toMatchObject({ tags: ['sans-source'], badges: [{ label: 'Sans source citée', tone: 'warning' }] })
    // Les pénalités, elles, n'ont pas bougé.
    expect(cards[1]!.tags).toEqual(['rien'])
  })

  it('sans IA : la page le dit, rien à remplir ; un thème inconnu : la page le dit', async () => {
    const { page, theme, path } = await questionnaire({})
    const view = await page.load(encodeURIComponent(path))
    expect(view.actions?.map((action) => action.id)).toEqual(['analysis'])
    expect(view.blocks.some((block) => block.kind === 'message' && block.text.startsWith('L’IA n’est pas réglée'))).toBe(true)
    expect(cardsOf(view)[0]!.actions).toBeUndefined()
    expect((await theme.load(`${encodeURIComponent(path)}&inconnu`)).title).toBe('Questionnaire introuvable')
    expect((await page.load(encodeURIComponent('Appels d’offres/X/Analyse/Questionnaire.md'))).title).toBe('Questionnaire introuvable')
  })
})

describe('la qualité des exigences, en page', () => {
  async function quality(withRequirements = true) {
    const platform = memoryPlatform()
    const run = await start(platform, true)
    if (withRequirements) {
      const text = (body: string) => ({ fr: { body, lang: 'fr', origin: 'human' as const, reviewed: true, by: '', at: '', fromRev: 1 } })
      const store = requirementsAt(`${run.station.folder}/Exigences`)
      await store.create({ category: 'SOL', title: 'Antenne', text: text('Le titulaire doit fournir une antenne de 3,7 m de diamètre.'), verification: 'inspection' })
      await store.create({ category: 'SOL', title: 'Disponibilité', text: text('Le système sera disponible le cas échéant.') })
      await store.create({ category: 'SOL', title: 'Antenne bis', text: text('Le titulaire doit fournir une antenne de 3,7 m de diamètre sur le site.'), verification: 'inspection' })
    }
    const path = `${run.station.folder}/Analyse/Qualité des exigences.md`
    return { ...run, platform, path, fiche: run.views.pages().find((each) => each.id === 'ao.fiche')!, page: run.views.pages().find((each) => each.id === 'ao.qualite')! }
  }

  it('« Qualité du dossier » sur la fiche ouvre sa page, calculée à l’ouverture', async () => {
    const { fiche, station, shown, path, page } = await quality()
    await (await fiche.load(encodeURIComponent(station.note))).actions!.find((action) => action.id === 'quality')!.run()
    expect(shown.at(-1)).toBe(`ao.qualite?${encodeURIComponent(path)}`)
    expect(page.parent).toBe('ao.analyses')
    const view = await page.load(encodeURIComponent(path))
    expect(view.title).toBe('Qualité des exigences — Station sol')
    expect(view.back?.label).toBe('L’analyse « Station sol »')
    expect(view.actions?.map((action) => `${action.id}:${action.label}`)).toEqual(['report:Écrire le rapport', 'analysis:Ouvrir l’analyse'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Exigences=3', 'Note moyenne=80 %', 'Faibles=1', 'Non vérifiables=1', 'Doublons probables=1'])
    const lists = view.blocks.filter((block) => block.kind === 'list')
    // Les exigences d'abord (les cartes), puis ce qui les résume.
    expect(view.blocks.map((block) => block.kind)).toEqual(['stats', 'message', 'cards', 'list', 'list', 'list', 'list'])
    expect(lists.map((block) => block.kind === 'list' && block.title)).toEqual(['Défauts les plus fréquents', 'Doublons probables', 'Par axe de la norme', 'Répartition des notes'])
    const defects = lists[0]!.kind === 'list' ? lists[0]!.items : []
    expect(defects.map((item) => item.title)).toEqual(['Aucune obligation (« doit »)', 'Terme vague'])
    const pair = lists[1]!.kind === 'list' ? lists[1]!.items[0]! : null
    expect(pair?.title).toBe('REQ-SOL-0001 ↔ REQ-SOL-0003')
    // La répartition : seulement les notes données.
    expect(lists[3]!.kind === 'list' && lists[3]!.items.map((item) => `${item.title}=${item.detail}`)).toEqual(['★★★★★=2 exigence(s)', '★★☆☆☆=1 exigence(s)'])
  })

  it('une carte par exigence, les plus faibles d’abord : étoiles, défauts, ce qui lui coûte ; un clic ouvre sa fiche', async () => {
    const { page, path, shown } = await quality()
    const view = await page.load(encodeURIComponent(path))
    expect(view.filters?.map((filter) => filter.id)).toEqual(['faibles', 'non-verifiables', 'doublons', 'bonnes'])
    const cards = cardsOf(view)
    expect(cards.map((card) => `${card.title}:${card.tags!.join('+')}`)).toEqual(['REQ-SOL-0002 — Disponibilité:faibles+non-verifiables', 'REQ-SOL-0001 — Antenne:doublons+bonnes', 'REQ-SOL-0003 — Antenne bis:doublons+bonnes'])
    expect(cards[0]).toMatchObject({
      subtitle: 'Aucune obligation (« doit ») · terme vague (« le cas échéant »)',
      rating: { stars: 2, label: 'Note : 40 %' },
      badges: [{ label: 'Faible' }, { label: 'Non vérifiable' }],
      text: 'Le système sera disponible le cas échéant.'
    })
    expect(cards[0]!.facts?.map((fact) => fact.label)).toEqual(['Unique (une seule obligation)', 'Non ambiguë', 'Vérifiable'])
    expect(cards[1]!.subtitle).toBe('Aucun défaut de rédaction relevé')
    await cards[0]!.open!.run()
    expect(shown.at(-1)).toMatch(/^exigences\.fiche\?/)
  })

  it('« Écrire le rapport » sans quitter la page ; la note produite « Qualité des exigences » mène à la page', async () => {
    const { page, path, platform, fiche, station, shown } = await quality()
    const view = await page.load(encodeURIComponent(path))
    expect(view.blocks.some((block) => block.kind === 'message' && block.text.startsWith('Calculée à l’ouverture'))).toBe(true)
    await view.actions!.find((action) => action.id === 'report')!.run()
    expect(platform.files.has(path)).toBe(true)
    expect(platform.opened).toEqual([])
    const after = await page.load(encodeURIComponent(path))
    expect(after.actions?.map((action) => `${action.id}:${action.label}`)).toEqual(['report:Mettre à jour le rapport', 'note:Ouvrir le rapport', 'analysis:Ouvrir l’analyse'])
    expect(after.blocks.some((block) => block.kind === 'message')).toBe(false)
    const produced = (await fiche.load(encodeURIComponent(station.note))).blocks.find((block) => block.kind === 'list' && block.title === 'Ce que l’analyse a produit')
    await (produced?.kind === 'list' ? produced.items : []).find((item) => item.title === 'Qualité des exigences')!.open!.run()
    expect(shown.at(-1)).toBe(`ao.qualite?${encodeURIComponent(path)}`)
  })

  it('sans exigence : la page le dit ; un rapport hors d’une analyse : la page le dit', async () => {
    const { page, path } = await quality(false)
    const view = await page.load(encodeURIComponent(path))
    expect(view.actions?.map((action) => action.id)).toEqual(['analysis'])
    expect(view.blocks).toEqual([{ kind: 'message', tone: 'info', text: expect.stringMatching(/^Aucune exigence dans cette analyse/) }])
    expect((await page.load(encodeURIComponent('Appels d’offres/X/Analyse/Qualité des exigences.md'))).title).toBe('Qualité introuvable')
  })
})
