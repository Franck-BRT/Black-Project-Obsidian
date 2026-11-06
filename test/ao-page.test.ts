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
    // « Calendrier » ouvre sa page ; on y écrit la note, sans « Dans quelle analyse ? ».
    await view.actions!.find((action) => action.id === 'calendar')!.run()
    const calendarPage = await views.pages().find((each) => each.id === 'ao.calendrier')!.load(encodeURIComponent(`${station.folder}/Analyse/Calendrier.md`))
    await calendarPage.actions!.find((action) => action.id === 'write')!.run()
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
  /**
   * Une note rangée dans Analyse/ qui n'a pas de page à elle (une synthèse écrite à la main) :
   * la page générique d'une note produite. Le calendrier, la vérification, la qualité, le
   * questionnaire et les questions ont chacun la leur.
   */
  async function calendar(withPages = true) {
    const platform = memoryPlatform()
    const opened: string[] = []
    platform.ui.openNote = async (path) => void opened.push(path)
    const run = await start(platform, withPages)
    const rc = `${run.station.folder}/Pièces/Appel d'offres/RC`
    const path = `${run.station.folder}/Analyse/Synthèse.md`
    await platform.fs.writeText(
      path,
      [
        '---',
        'bp-type: ma-synthese',
        '---',
        '',
        '# Synthèse — Station sol',
        '',
        'Ce qu’il faut retenir du dossier, avant la réunion de lancement.',
        '',
        '<!-- bp:synthese:debut -->',
        '## À retenir',
        '',
        `- **Date limite de remise des offres** : dans douze jours — « La date limite de remise des offres est fixée au … » ([[${rc}|RC]])`,
        '- **Validité des offres** : *non trouvé dans les pièces*',
        '',
        '## Dates',
        '',
        '| Date | Nature | Phrase source | Pièce |',
        '| --- | --- | --- | --- |',
        `| 2026-12-12 | Date limite de remise des offres | La date limite de remise des offres est fixée au 12 décembre. | [[${rc}\\|RC]] |`,
        '<!-- bp:synthese:fin -->',
        '',
        '## Délais',
        '',
        '*Aucun délai trouvé dans les pièces.*',
        ''
      ].join('\n')
    )
    const fiche = run.views.pages().find((each) => each.id === 'ao.fiche')!
    const view = await fiche.load(encodeURIComponent(run.station.note))
    const produced = view.blocks.filter((block) => block.kind === 'list')[2]
    const item = produced?.kind === 'list' ? produced.items[0]! : null
    return { ...run, platform, opened, item: item!, path, page: run.views.pages().find((each) => each.id === 'ao.note') }
  }

  it('un clic sur une note produite (fiche de l’analyse) ouvre sa page ; elle dépend des analyses', async () => {
    const { item, shown, path, page } = await calendar()
    expect(item.title).toBe('Synthèse')
    expect(item.open?.label).toBe('Voir la note')
    await item.open!.run()
    expect(shown.at(-1)).toBe(`ao.note?${encodeURIComponent(path)}`)
    expect(page!.parent).toBe('ao.analyses')
  })

  it('une note lisible : sections en listes, sans en-tête ni marques ; un lien ouvre la fiche de la pièce', async () => {
    const { page, path, shown } = await calendar()
    const view = await page!.load(encodeURIComponent(path))
    expect(view.title).toBe('Synthèse — Station sol')
    expect(view.back?.label).toBe('L’analyse « Station sol »')
    expect(view.subtitle).toBe('Station sol · Analyse/Synthèse.md')
    expect(view.actions?.map((action) => action.id)).toEqual(['note', 'analysis'])
    expect(view.search?.label).toBe('Chercher dans la note')
    expect(view.blocks.map((block) => `${block.kind}:${'title' in block ? (block.title ?? '') : ''}`)).toEqual(['text:', 'list:À retenir', 'list:Dates', 'text:Délais'])
    const all = JSON.stringify(view.blocks)
    for (const syntax of ['bp-type', '<!--', '[[', '**', '| ---']) expect(all).not.toContain(syntax)
    const kept = view.blocks[1]!.kind === 'list' ? view.blocks[1]!.items : []
    expect(kept.map((item) => item.title)).toEqual(['Date limite de remise des offres', 'Validité des offres'])
    expect(kept[0]!.detail).toMatch(/« La date limite de remise des offres est fixée au … » \(RC\)$/)
    const row = view.blocks[2]!.kind === 'list' ? view.blocks[2]!.items[0]! : null
    expect(row!.detail).toBe('Date limite de remise des offres — La date limite de remise des offres est fixée au 12 décembre. — RC')
    // Le lien d'une cellule de tableau (« [[…|RC]] », le « | » échappé) mène à la fiche de la pièce.
    await row!.open!.run()
    expect(shown.at(-1)).toMatch(/^ao\.piece\?.*RC\.md$/)
  })

  it('« Ouvrir la note » l’ouvre dans le coffre', async () => {
    const { page, path, opened } = await calendar()
    const view = await page!.load(encodeURIComponent(path))
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
    await item.open!.run()
    expect(opened).toEqual([path])
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

describe('la vérification des exigences, en page', () => {
  /** La station : un CCTP qui porte EX-1 et une phrase en « doit » qu'aucune exigence ne reprend. */
  async function verification() {
    const platform = memoryPlatform()
    const run = await start(platform, true)
    await run.importInto('# CCTP\n\n| Identifiant | Exigence |\n|---|---|\n| EX-1 | Le titulaire doit fournir une antenne de 3,7 m. |\n\nLe titulaire doit assurer la maintenance pendant deux ans.\n')
    const page = run.views.pages().find((each) => each.id === 'ao.verification')!
    const path = (analysis: { folder: string }) => `${analysis.folder}/Analyse/Vérification des exigences.md`
    return { ...run, platform, page, path, fiche: run.views.pages().find((each) => each.id === 'ao.fiche')! }
  }
  const listsOf = (view: PageView) => view.blocks.filter((block) => block.kind === 'list').map((block) => (block.kind === 'list' ? block : null)!)

  it('« Vérifier » sur la fiche ouvre sa page, calculée à l’ouverture, sans rien écrire', async () => {
    const { fiche, station, shown, page, path, platform } = await verification()
    await (await fiche.load(encodeURIComponent(station.note))).actions!.find((action) => action.id === 'verify')!.run()
    expect(shown.at(-1)).toBe(`ao.verification?${encodeURIComponent(path(station))}`)
    expect(page.parent).toBe('ao.analyses')
    const view = await page.load(encodeURIComponent(path(station)))
    expect(platform.files.has(path(station))).toBe(false)
    expect(view.title).toBe('Vérification des exigences — Station sol')
    expect(view.actions?.map((action) => `${action.id}:${action.primary ?? false}`)).toEqual(['all:true', 'extract:false', 'missed:false', 'analysis:false'])
    expect(view.filters?.map((filter) => filter.id)).toEqual(['extraction', 'oubliees', 'coherence', 'couverture'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Exigences dans les pièces=1', 'Exigences oubliées=2', 'Incohérences=0', 'Couverture par la réponse=—'])
    const lists = listsOf(view)
    expect(lists.map((list) => list.title)).toEqual(['1. Extraction (1 exigence(s) dans les pièces)', '2. Exigences oubliées (2)', '3. Cohérence entre pièces (0 constat(s))', '4. Couverture par la réponse'])
    expect(lists[0]!.items.map((item) => `${item.title}:${item.detail}:${item.tone}`)).toEqual(['RC:0 exigence(s) trouvée(s):neutral', 'CCTP:1 exigence(s) trouvée(s):success'])
    expect(lists[1]!.items[1]).toMatchObject({ title: 'Le titulaire doit assurer la maintenance pendant deux ans.', detail: 'CCTP, paragraphe 1 — « doit »', tone: 'warning', tags: ['oubliees'] })
    expect(lists[3]!.empty).toBe('Aucune exigence dans l’analyse : extrayez-les d’abord.')
  })

  it('un clic sur une pièce ou une phrase oubliée ouvre la fiche de la pièce ; un filtre par vérification', async () => {
    const { page, path, station, shown } = await verification()
    const view = await page.load(encodeURIComponent(path(station)))
    await listsOf(view)[1]!.items[1]!.open!.run()
    expect(shown.at(-1)).toMatch(/^ao\.piece\?.*CCTP\.md$/)
    const { filterBlocks } = await import('../src/ui/page')
    const filtered = filterBlocks(view.blocks, '', 'oubliees', 'Rien')
    expect(filtered.hits).toBe(2)
  })

  it('l’émetteur : la couverture par la réponse de chaque candidat, les absentes d’abord ; un clic ouvre la fiche de l’exigence', async () => {
    const run = await verification()
    const text = (body: string) => ({ fr: { body, lang: 'fr', origin: 'human' as const, reviewed: true, by: '', at: '', fromRev: 1 } })
    const store = requirementsAt(`${run.maintenance.folder}/Exigences`)
    await store.create({ category: 'MA', title: 'Antenne', text: text('Le titulaire doit fournir une antenne parabolique de 3,7 m de diamètre.') })
    await store.create({ category: 'MA', title: 'Astreinte', text: text('Le titulaire doit assurer une astreinte téléphonique 24 heures sur 24.') })
    await run.respond('Acme', 'Mémoire technique.md', '# Mémoire technique\n\nNous fournissons une antenne parabolique de 3,7 m de diamètre, livrée et posée.\n')
    const view = await run.page.load(encodeURIComponent(run.path(run.maintenance)))
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.at(-1)).toMatchObject({ value: '50 %', tone: 'warning' })
    const coverage = listsOf(view).at(-1)!
    expect(coverage.title).toBe('4. Couverture par la réponse de Acme : 50 % couvertes')
    expect(coverage.items.map((item) => `${item.title}:${item.tone}`)).toEqual(['REQ-MA-0002 — Astreinte:danger', 'REQ-MA-0001 — Antenne:success'])
    expect(coverage.items[1]!.detail).toMatch(/^Traitée \(\d+ %\) · Mémoire technique, paragraphe 1 · « Nous fournissons/)
    await coverage.items[0]!.open!.run()
    expect(run.shown.at(-1)).toMatch(/^exigences\.fiche\?/)
  })

  it('« Tout vérifier » écrit le rapport sans quitter la page ; la note produite y mène ; hors d’une analyse : la page le dit', async () => {
    const { page, path, maintenance, platform, fiche, shown } = await verification()
    const view = await page.load(encodeURIComponent(path(maintenance)))
    await view.actions!.find((action) => action.id === 'all')!.run()
    expect(platform.files.has(path(maintenance))).toBe(true)
    expect(platform.opened).toEqual([])
    const after = await page.load(encodeURIComponent(path(maintenance)))
    expect(after.actions?.map((action) => `${action.id}:${action.primary ?? false}`)).toEqual(['all:false', 'note:false', 'analysis:false'])
    const produced = (await fiche.load(encodeURIComponent(maintenance.note))).blocks.find((block) => block.kind === 'list' && block.title === 'Ce que l’analyse a produit')
    await (produced?.kind === 'list' ? produced.items : []).find((item) => item.title === 'Vérification des exigences')!.open!.run()
    expect(shown.at(-1)).toBe(`ao.verification?${encodeURIComponent(path(maintenance))}`)
    expect((await page.load(encodeURIComponent('Appels d’offres/X/Analyse/Vérification des exigences.md'))).title).toBe('Vérification introuvable')
  })
})

describe('le calendrier, en page', () => {
  /** La station : le RC fixe la remise à J-12, le CCTP un délai de livraison. */
  async function calendarPage() {
    const platform = memoryPlatform()
    const run = await start(platform, true)
    await run.importInto('# CCTP\n\nLa livraison intervient sous 15 jours après la notification.\n')
    const path = (analysis: { folder: string }) => `${analysis.folder}/Analyse/Calendrier.md`
    return { ...run, platform, path, fiche: run.views.pages().find((each) => each.id === 'ao.fiche')!, page: run.views.pages().find((each) => each.id === 'ao.calendrier')! }
  }
  const listsOf = (view: PageView) => view.blocks.filter((block) => block.kind === 'list').map((block) => (block.kind === 'list' ? block : null)!)

  it('« Calendrier » sur la fiche ouvre sa page, relevée à l’ouverture sans rien écrire', async () => {
    const { fiche, station, shown, page, path, platform } = await calendarPage()
    await (await fiche.load(encodeURIComponent(station.note))).actions!.find((action) => action.id === 'calendar')!.run()
    expect(shown.at(-1)).toBe(`ao.calendrier?${encodeURIComponent(path(station))}`)
    expect(page.parent).toBe('ao.analyses')
    const view = await page.load(encodeURIComponent(path(station)))
    expect(platform.files.has(path(station))).toBe(false)
    expect(view.title).toBe('Calendrier — Station sol')
    expect(view.back?.label).toBe('L’analyse « Station sol »')
    expect(view.actions?.map((action) => `${action.id}:${action.label}`)).toEqual(['write:Écrire le calendrier', 'analysis:Ouvrir l’analyse'])
    expect(view.filters?.map((filter) => filter.id)).toEqual(['a-venir', 'passees', 'delais'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Date limite de remise des offres=J-12', 'Validité des offres=—', 'Dates à venir=1', 'Délais=1'])
    expect(stats?.kind === 'stats' && stats.stats[0]!.tone).toBe('warning')
    const lists = listsOf(view)
    expect(lists.map((list) => list.title)).toEqual(['À retenir', 'Dates (1), dans l’ordre', 'Délais (1)'])
    expect(lists[0]!.items.map((item) => `${item.title}:${item.tone}`)).toEqual(['Date limite de remise des offres:warning', 'Validité des offres:warning'])
    expect(lists[0]!.items[1]!.detail).toBe('non trouvé dans les pièces')
    expect(lists[1]!.items[0]).toMatchObject({ title: 'Date limite de remise des offres', tags: ['a-venir'] })
    expect(lists[1]!.items[0]!.detail).toMatch(/^J-12 — « La date limite de remise des offres est fixée au .* » — RC$/)
    expect(lists[2]!.items[0]).toMatchObject({ title: 'Livraison, recette — sous 15 jours après la notification', tags: ['delais'] })
  })

  it('un clic sur une date ou un délai ouvre la fiche de sa pièce', async () => {
    const { page, path, station, shown } = await calendarPage()
    const lists = listsOf(await page.load(encodeURIComponent(path(station))))
    await lists[1]!.items[0]!.open!.run()
    expect(shown.at(-1)).toMatch(/^ao\.piece\?.*RC\.md$/)
    await lists[2]!.items[0]!.open!.run()
    expect(shown.at(-1)).toMatch(/^ao\.piece\?.*CCTP\.md$/)
  })

  it('« Écrire le calendrier » sans quitter la page ; la note produite « Calendrier » mène à la page', async () => {
    const { page, path, station, platform, fiche, shown } = await calendarPage()
    await (await page.load(encodeURIComponent(path(station)))).actions!.find((action) => action.id === 'write')!.run()
    expect(platform.files.has(path(station))).toBe(true)
    expect(platform.opened).toEqual([])
    const after = await page.load(encodeURIComponent(path(station)))
    expect(after.actions?.map((action) => `${action.id}:${action.label}`)).toEqual(['write:Mettre à jour la note', 'note:Ouvrir la note', 'analysis:Ouvrir l’analyse'])
    const produced = (await fiche.load(encodeURIComponent(station.note))).blocks.find((block) => block.kind === 'list' && block.title === 'Ce que l’analyse a produit')
    await (produced?.kind === 'list' ? produced.items : []).find((item) => item.title === 'Calendrier')!.open!.run()
    expect(shown.at(-1)).toBe(`ao.calendrier?${encodeURIComponent(path(station))}`)
  })

  it('sans pièce lue : la page le dit ; un calendrier hors d’une analyse : la page le dit', async () => {
    const { page, path, maintenance } = await calendarPage()
    const view = await page.load(encodeURIComponent(path(maintenance)))
    expect(view.blocks).toEqual([{ kind: 'message', tone: 'info', text: expect.stringMatching(/^Aucune pièce de l’appel d’offres lue/) }])
    expect((await page.load(encodeURIComponent('Appels d’offres/X/Analyse/Calendrier.md'))).title).toBe('Calendrier introuvable')
  })
})

describe('une note d’analyse ouverte par un autre module (un workflow) : sa page', () => {
  it('l’analyse, une pièce, une exigence, le calendrier, la vérification, la qualité, le questionnaire, une question, une autre note', async () => {
    const run = await start(memoryPlatform(), true)
    const { station } = run
    const text = (body: string) => ({ fr: { body, lang: 'fr', origin: 'human' as const, reviewed: true, by: '', at: '', fromRev: 1 } })
    const requirement = await requirementsAt(`${station.folder}/Exigences`).create({ category: 'SOL', title: 'Antenne', text: text('Le titulaire doit fournir une antenne.') })
    const page = (path: string) => run.views.pageForNote(path)
    const rc = `${station.folder}/Pièces/Appel d'offres/RC.md`
    const enc = encodeURIComponent
    expect(await page(station.note)).toBe(`ao.fiche?${enc(station.note)}`)
    expect(await page(rc)).toBe(`ao.piece?${enc(rc)}`)
    expect(await page(requirement.filePath!)).toBe(`exigences.fiche?${enc(requirement.filePath!)}`)
    for (const [name, id] of [['Calendrier', 'ao.calendrier'], ['Vérification des exigences', 'ao.verification'], ['Qualité des exigences', 'ao.qualite'], ['Questionnaire', 'ao.questionnaire'], ['Questions/2026-11-06 Pénalités', 'ao.question'], ['Synthèse', 'ao.note']] as const) {
      const path = `${station.folder}/Analyse/${name}.md`
      expect(await page(path)).toBe(`${id}?${enc(path)}`)
    }
    // Une note hors des analyses : pas de page, elle s'ouvre telle quelle.
    expect(await page('Black Projects/Rappels/Rappel du 4.md')).toBeNull()
    expect(await page(`${station.folder}/Pièces/Appel d'offres/Inconnue.md`)).toBeNull()
  })
})

describe('les raccourcis du tableau de bord et de l’accueil ouvrent les pages', () => {
  async function dashboard(withPages = true) {
    const platform = memoryPlatform()
    const asked: string[] = []
    let answer: string | null = null
    platform.ui.pickOption = async (options, placeholder) => {
      asked.push(placeholder ?? '')
      return answer ?? options[0]?.value ?? null
    }
    const run = await start(platform, withPages)
    const section = await run.views.homeSections().find((each) => each.id === 'ao.analyses')!.load()
    const quick = section!.blocks.find((block) => block.kind === 'actions')
    const cards = section!.blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))
    return { ...run, platform, asked, choose: (note: string) => void (answer = note), quick: quick?.kind === 'actions' ? quick.actions : [], cards }
  }
  const calendarOf = (analysis: { folder: string }) => `ao.calendrier?${encodeURIComponent(`${analysis.folder}/Analyse/Calendrier.md`)}`

  it('« Calendrier » : « Dans quelle analyse ? » (il y en a deux), puis la page du calendrier ; rien d’écrit ni de note ouverte', async () => {
    const { quick, asked, shown, station, choose, platform } = await dashboard()
    choose(station.note)
    await quick.find((action) => action.id === 'calendar')!.run()
    expect(asked).toEqual(['Dans quelle analyse ?'])
    expect(shown.at(-1)).toBe(calendarOf(station))
    expect(platform.files.has(`${station.folder}/Analyse/Calendrier.md`)).toBe(false)
    expect(platform.opened).toEqual([])
  })

  it('le bouton Calendrier d’une carte : la page de son calendrier, sans rien demander', async () => {
    const { cards, asked, shown, station } = await dashboard()
    const card = cards.find((each) => each.title === 'Station sol')!
    await card.actions!.find((action) => action.id === 'calendar')!.run()
    expect(asked).toEqual([])
    expect(shown.at(-1)).toBe(calendarOf(station))
  })

  it('les tuiles Calendrier, Vérifier, Qualité, Questionnaire : la page de l’analyse choisie', async () => {
    const { views, shown, station, choose } = await dashboard()
    choose(station.note)
    const enc = (name: string) => encodeURIComponent(`${station.folder}/Analyse/${name}.md`)
    for (const [tile, page] of [
      ['ao.calendrier', `ao.calendrier?${enc('Calendrier')}`],
      ['ao.verifier', `ao.verification?${enc('Vérification des exigences')}`],
      ['ao.qualite', `ao.qualite?${enc('Qualité des exigences')}`],
      ['ao.questionnaire', `ao.questionnaire?${enc('Questionnaire')}`]
    ] as const) {
      await views.allTiles().find((each) => each.id === tile)!.run()
      expect(shown.at(-1)).toBe(page)
    }
  })

  it('sans pages chez la plateforme : la carte écrit le calendrier et ouvre sa note, comme avant', async () => {
    const { cards, station, platform } = await dashboard(false)
    await cards.find((each) => each.title === 'Station sol')!.actions!.find((action) => action.id === 'calendar')!.run()
    expect(platform.opened).toEqual([`${station.folder}/Analyse/Calendrier.md`])
  })
})

describe('importer des pièces depuis l’interface : la fiche de l’analyse ensuite', () => {
  async function importing() {
    const platform = memoryPlatform()
    let answer: string | null = null
    platform.ui.pickOption = async (options) => answer ?? options[0]?.value ?? null
    const run = await start(platform, true)
    const cctp = { name: 'CCTP.md', bytes: new TextEncoder().encode('# CCTP\n\nLe titulaire doit fournir une antenne.\n') }
    return { ...run, platform, cctp, choose: (value: string) => void (answer = value) }
  }
  const ficheOf = (analysis: { note: string }) => `ao.fiche?${encodeURIComponent(analysis.note)}`

  it('le bouton de la fiche : les fichiers, puis la fiche de l’analyse, plus sa note', async () => {
    const { views, station, platform, shown, cctp } = await importing()
    platform.externalFiles.push([cctp])
    // Aucun type routé : « Où ranger ces pièces ? » — avec l'appel d'offres.
    platform.forms.push({ p0: 'appel-d-offres' })
    const fiche = await views.pages().find((each) => each.id === 'ao.fiche')!.load(encodeURIComponent(station.note))
    await fiche.actions!.find((action) => action.id === 'import')!.run()
    expect([...platform.files.keys()].some((path) => path.endsWith('/CCTP.md') && path.includes('Pièces'))).toBe(true)
    expect(shown.at(-1)).toBe(ficheOf(station))
    expect(platform.opened).toEqual([])
  })

  it('le raccourci du tableau de bord et la tuile : l’analyse choisie, ses fichiers, puis sa fiche', async () => {
    const { views, station, platform, shown, cctp, choose } = await importing()
    choose(station.note)
    platform.externalFiles.push([cctp])
    platform.forms.push({ p0: 'appel-d-offres' })
    const section = await views.homeSections().find((each) => each.id === 'ao.analyses')!.load()
    const quick = section!.blocks.find((block) => block.kind === 'actions')
    await (quick?.kind === 'actions' ? quick.actions : []).find((action) => action.id === 'import')!.run()
    expect(shown.at(-1)).toBe(ficheOf(station))
    platform.externalFiles.push([{ ...cctp, name: 'CCAP.md' }])
    platform.forms.push({ p0: 'appel-d-offres' })
    await views.allTiles().find((each) => each.id === 'ao.importer')!.run()
    expect(shown.filter((id) => id === ficheOf(station))).toHaveLength(2)
    expect(platform.opened).toEqual([])
  })

  it('« Nouvelle analyse » : sa fiche aussitôt créée, puis l’import qui suit y revient ; la palette ouvre toujours la note', async () => {
    const { views, platform, shown, cctp, choose, run } = await importing()
    platform.forms.push({ name: 'Antennes Sud', position: 'candidat', buyer: '', reference: '' }, { p0: 'appel-d-offres' })
    choose('import')
    platform.externalFiles.push([cctp])
    await views.allTiles().find((each) => each.id === 'ao.nouvelle')!.run()
    const created = `Appels d'offres/Antennes Sud/Antennes Sud.md`
    expect(shown.slice(-2)).toEqual([`ao.fiche?${encodeURIComponent(created)}`, `ao.fiche?${encodeURIComponent(created)}`])
    expect(platform.opened).toEqual([])
    // La palette de commandes : la note de l'analyse, comme avant.
    platform.forms.push({ name: 'Antennes Nord', position: 'candidat', buyer: '', reference: '' })
    choose('later')
    await run('ao-nouvelle-analyse')
    expect(platform.opened).toEqual([`Appels d'offres/Antennes Nord/Antennes Nord.md`])
  })
})

describe('mettre à jour l’analyse depuis sa fiche', () => {
  it('les fichiers déposés dans les originaux sont lus et rangés ; la fiche se redessine, sa note ne s’ouvre pas ; la palette l’ouvre', async () => {
    const platform = memoryPlatform()
    const run = await start(platform, true)
    const { station, views, shown } = run
    const fiche = views.pages().find((each) => each.id === 'ao.fiche')!
    const piecesOf = async () => (await fiche.load(encodeURIComponent(station.note))).blocks.flatMap((block) => (block.kind === 'cards' ? block.cards.map((card) => card.title) : []))
    expect(await piecesOf()).toEqual(['RC.md'])
    // Déposé à la main dans les originaux de l'appel d'offres.
    await platform.fs.writeText(`${station.folder}/Pièces/Appel d'offres/Originaux/CCAP.md`, '# CCAP\n\nPénalités : 500 € par jour de retard.\n')
    await (await fiche.load(encodeURIComponent(station.note))).actions!.find((action) => action.id === 'update')!.run()
    expect(await piecesOf()).toEqual(['RC.md', 'CCAP.md'])
    expect(shown.at(-1)).toBe(`ao.fiche?${encodeURIComponent(station.note)}`)
    expect(platform.opened).toEqual([])
    expect(platform.notices.at(-1)).toMatch(/1 pièce\(s\) importée\(s\)/)
    // La palette de commandes : la note, comme avant.
    platform.active = station.note
    await run.run('ao-mettre-a-jour')
    expect(platform.opened).toEqual([station.note])
  })
})

describe('extraire les exigences depuis l’interface : on reste sur la page', () => {
  it('la fiche de la pièce, puis sa carte sur la fiche de l’analyse : l’aperçu, les exigences rangées, la page se redessine ; la palette ouvre la note', async () => {
    const platform = memoryPlatform()
    const run = await start(platform, true)
    await run.importInto('# CCTP\n\n| Identifiant | Exigence |\n|---|---|\n| EX-1 | Le titulaire doit fournir une antenne de 3,7 m. |\n| EX-2 | Le titulaire doit assurer la maintenance. |\n')
    const fiche = run.views.pages().find((each) => each.id === 'ao.fiche')!
    const cards = (await fiche.load(encodeURIComponent(run.station.note))).blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))
    const cctp = cards.find((card) => card.title === 'CCTP.md')!
    const piece = run.views.pages().find((each) => each.id === 'ao.piece')!
    const requirementsOf = async () => {
      const stats = (await piece.load(encodeURIComponent(cctp.id))).blocks.find((block) => block.kind === 'stats')
      return stats?.kind === 'stats' ? stats.stats.find((stat) => stat.label === 'Exigences')?.value : undefined
    }
    expect(await requirementsOf()).toBe('0')
    await (await piece.load(encodeURIComponent(cctp.id))).actions!.find((action) => action.id === 'extract')!.run()
    expect(await requirementsOf()).toBe('2')
    expect(platform.opened).toEqual([])
    // Depuis la carte de la pièce, sur la fiche de l'analyse : de même, la fiche montre les exigences.
    await cctp.actions!.find((action) => action.id === 'extract')!.run()
    expect(platform.opened).toEqual([])
    const lists = (await fiche.load(encodeURIComponent(run.station.note))).blocks.filter((block) => block.kind === 'list')
    expect(lists.some((block) => block.kind === 'list' && block.title === 'Exigences (2), les plus faibles d’abord')).toBe(true)
    // La palette de commandes, sur la note d'une autre pièce : la note, comme avant.
    await platform.fs.writeText(`${run.station.folder}/Pièces/Appel d'offres/Originaux/Annexe.md`, '# Annexe\n\n| Identifiant | Exigence |\n|---|---|\n| EX-9 | Le titulaire doit fournir un plan. |\n')
    platform.active = run.station.note
    await run.run('ao-mettre-a-jour')
    const annexe = `${run.station.folder}/Pièces/Appel d'offres/Annexe.md`
    platform.active = annexe
    await run.run('ao-extraire-exigences')
    expect(platform.opened.at(-1)).toBe(annexe)
  })
})

describe('déplacer une pièce depuis l’interface', () => {
  it('depuis sa fiche : la fiche suit la pièce à sa nouvelle place ; depuis sa carte : la fiche de l’analyse se redessine ; la palette ouvre la note', async () => {
    const platform = memoryPlatform()
    const run = await start(platform, true)
    const { station, views, shown } = run
    const fiche = views.pages().find((each) => each.id === 'ao.fiche')!
    const piece = views.pages().find((each) => each.id === 'ao.piece')!
    const groups = async () => (await fiche.load(encodeURIComponent(station.note))).blocks.flatMap((block) => (block.kind === 'cards' && block.title ? [`${block.title}:${block.cards.map((card) => card.title).join(',')}`] : []))
    const rc = `${station.folder}/Pièces/Appel d'offres/RC.md`
    // Depuis la fiche de la pièce : avec la réponse.
    platform.choices.push('1')
    await (await piece.load(encodeURIComponent(rc))).actions!.find((action) => action.id === 'move')!.run()
    const moved = decodeURIComponent(shown.at(-1)!.replace(/^ao\.piece\?/, ''))
    expect(shown.at(-1)).toMatch(/^ao\.piece\?/)
    expect(moved).not.toBe(rc)
    expect((await piece.load(encodeURIComponent(moved))).subtitle).toMatch(/· Réponse · Station sol$/)
    expect(platform.opened).toEqual([])
    // « Retour » vers l'ancienne place : la même pièce, là où elle est maintenant.
    expect((await piece.load(encodeURIComponent(rc))).subtitle).toMatch(/· Réponse · Station sol$/)
    // Depuis sa carte, sur la fiche de l'analyse : de retour avec l'appel d'offres, on reste sur la fiche.
    const card = (await fiche.load(encodeURIComponent(station.note))).blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : [])).find((each) => each.title === 'RC.md')!
    const before = shown.length
    platform.choices.push('0')
    await card.actions!.find((action) => action.id === 'move')!.run()
    expect(shown.length).toBe(before)
    expect(await groups()).toEqual(['Appel d’offres (1):RC.md'])
    expect(platform.opened).toEqual([])
    // La palette, sur la note de la pièce : la note déplacée s'ouvre, comme avant.
    platform.active = rc
    platform.choices.push('1')
    await run.run('ao-deplacer-piece')
    expect(platform.opened).toEqual([moved])
  })
})

describe('changer le type d’une pièce depuis l’interface', () => {
  it('le choix du type, puis la page se redessine (fiche de la pièce, carte sur la fiche de l’analyse) ; aucune note ouverte', async () => {
    const platform = memoryPlatform()
    const run = await start(platform, true)
    const { station, views, shown } = run
    const rc = `${station.folder}/Pièces/Appel d'offres/RC.md`
    const piece = views.pages().find((each) => each.id === 'ao.piece')!
    const before = shown.length
    platform.choices.push('CCTP')
    await (await piece.load(encodeURIComponent(rc))).actions!.find((action) => action.id === 'type')!.run()
    expect((await piece.load(encodeURIComponent(rc))).subtitle).toMatch(/^CCTP — /)
    const fiche = views.pages().find((each) => each.id === 'ao.fiche')!
    const card = (await fiche.load(encodeURIComponent(station.note))).blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : [])).find((each) => each.title === 'RC.md')!
    expect(card.subtitle).toMatch(/^CCTP — /)
    platform.choices.push('RC')
    await card.actions!.find((action) => action.id === 'type')!.run()
    const again = (await fiche.load(encodeURIComponent(station.note))).blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : [])).find((each) => each.title === 'RC.md')!
    expect(again.subtitle).toMatch(/^RC — /)
    expect(shown.length).toBe(before)
    expect(platform.opened).toEqual([])
  })
})
