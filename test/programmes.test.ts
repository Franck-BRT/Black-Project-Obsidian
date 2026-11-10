// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **programmes** : des programmes, leurs projets (les phases de leur type, en étapes),
 * leurs affaires ; les types de projet qu'on dessine ; l'analyse d'un appel d'offres, phase
 * d'un projet que mène le module AO.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { CREATE_IN_PICK, memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type PageView } from '../src/core/views'
import { MODULES } from '../src/modules'
import { aoModule } from '../src/modules/ao'
import { addDays, addParallel, addSpan, addStage, movePhase, PHASE_ICONS, planPhases, programmesModule, remapSpans, removePhase, replanPhases, shortDay, starterTypes, type ProjectPhase, type ProjectType } from '../src/modules/programmes'
import { localToday } from '../src/core/dates'

const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const tr = (key: string) => key

async function start(platform: MemoryPlatform, modules = MODULES) {
  const i18n = createI18n('fr')
  for (const module of modules) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {}
  const views = new ViewsRegistry()
  const shown: string[] = []
  const commands = new Map<string, () => unknown>()
  for (const module of modules) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command.run), run: async (id: string) => void (await commands.get(`${module.id}-${id}`)?.()) },
      views,
      showPage: (id) => void shown.push(id)
    }
    await module.activate(context)
  }
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const load = (target: string): Promise<PageView> => {
    const [id, param] = target.split('?') as [string, string | undefined]
    return page(id).load(param)
  }
  const action = async (view: PageView, id: string) => {
    const found = view.actions?.find((each) => each.id === id) ?? view.blocks.flatMap((block) => (block.kind === 'message' ? (block.actions ?? []) : [])).find((each) => each.id === id)
    expect(found, id).toBeDefined()
    await found!.run()
  }
  const journey = (view: PageView): Extract<HomeBlock, { kind: 'journey' }> => view.blocks.find((block): block is Extract<HomeBlock, { kind: 'journey' }> => block.kind === 'journey' && !block.compact)!
  return { settings, views, shown, load, action, journey, commands }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('les icônes', () => {
  it('une soixantaine d’icônes, chacune nommée en français et en anglais, sans doublon', () => {
    expect(PHASE_ICONS.length).toBeGreaterThanOrEqual(60)
    expect(new Set(PHASE_ICONS).size).toBe(PHASE_ICONS.length)
    for (const texts of [programmesModule.texts.fr, programmesModule.texts.en]) {
      const labels = PHASE_ICONS.map((icon) => texts[`programmes.icon.${icon}`])
      expect(labels.every((label) => !!label)).toBe(true)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })
})

describe('les types de projet, dessinés', () => {
  const simple = (): ProjectType => starterTypes(tr).find((type) => type.id === 'projet-simple')!
  const ids = (type: ProjectType) => type.stages.map((stage) => stage.map((phase) => phase.id))

  it('une phase en parallèle, une étape de plus, déplacer à gauche, à droite, en haut, retirer', () => {
    let type = simple()
    expect(ids(type)).toEqual([['lancement'], ['realisation'], ['recette'], ['cloture']])
    type = addParallel(type, 1, { id: 'achats', name: 'Achats', kind: 'libre', icon: 'chart', color: 'teal' })
    expect(ids(type)).toEqual([['lancement'], ['realisation', 'achats'], ['recette'], ['cloture']])
    type = movePhase(type, 'achats', 'up')
    expect(ids(type)[1]).toEqual(['achats', 'realisation'])
    // À gauche : dans l'étape d'avant ; seule dans la sienne, celle-ci disparaît.
    type = movePhase(type, 'recette', 'left')
    expect(ids(type)).toEqual([['lancement'], ['achats', 'realisation', 'recette'], ['cloture']])
    // À droite de la dernière, quand elle n'est pas seule : une étape à elle.
    type = movePhase(addParallel(type, 2, { id: 'bilan', name: 'Bilan', kind: 'libre', icon: 'star', color: 'rose' }), 'bilan', 'right')
    expect(ids(type)).toEqual([['lancement'], ['achats', 'realisation', 'recette'], ['cloture'], ['bilan']])
    // Seule à la fin : rien ne bouge.
    expect(movePhase(type, 'bilan', 'right')).toBe(type)
    type = addStage(removePhase(type, 'bilan'), { id: 'garantie', name: 'Garantie', kind: 'libre', icon: 'lock', color: 'slate' })
    expect(ids(type)).toEqual([['lancement'], ['achats', 'realisation', 'recette'], ['cloture'], ['garantie']])
  })

  it('jamais réglés : les types de départ, dont la réponse à un appel d’offres et sa phase d’analyse (AO)', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    const types = await load('programmes.types')
    const journeys = types.blocks.filter((block): block is Extract<HomeBlock, { kind: 'journey' }> => block.kind === 'journey')
    expect(journeys.map((block) => block.title)).toEqual(['Réponse à un appel d’offres', 'Projet simple'])
    const ao = journeys[0]!
    expect(ao.stages).toHaveLength(8)
    expect(ao.stages[3]!.phases.map((phase) => phase.label)).toEqual(['Rédaction de l’offre', 'Chiffrage'])
    expect(ao.stages[1]!.phases[0]).toMatchObject({ label: 'Analyse de l’appel d’offres', caption: 'Analyse d’appel d’offres', color: 'indigo' })
  })
})

describe('programmes, projets, affaires', () => {
  it('un programme, un projet (les phases de son type), son affaire du même nom ; rangés dans le coffre', async () => {
    const platform = memoryPlatform()
    const { load, action, journey, shown } = await start(platform)
    const home = await load('programmes')
    expect(home.blocks[0]).toMatchObject({ kind: 'message' })
    platform.forms.push({ name: 'Spatial', code: 'SPA', description: 'Le spatial', color: 'violet', icon: 'star' })
    await action(home, 'new')
    expect(shown.at(-1)).toBe(`programmes.programme?${encodeURIComponent('Programmes/Spatial/Spatial.md')}`)
    expect(read(platform, 'Programmes/Spatial/Spatial.md')).toMatch(/^---\nbp-type: programme\ncode: SPA\ncouleur: violet\nicone: star\ndescription: Le spatial\ncreeLe: "[\d-]+"\n---\n\n# Spatial\n/)
    // Un projet, du type « Réponse à un appel d'offres », et son affaire.
    platform.forms.push({ name: 'Station sol', programme: 'Programmes/Spatial/Spatial.md', type: 'reponse-ao', description: '', affaire: 'true', client: 'CNES', reference: 'AO-2026-12' })
    await action(await load(shown.at(-1)!), 'project')
    const projectPath = 'Programmes/Spatial/Station sol/Station sol.md'
    expect(shown.at(-1)).toBe(`programmes.projet?${encodeURIComponent(projectPath)}`)
    const note = read(platform, projectPath)
    expect(note).toMatch(/\nbp-type: projet\nprogramme: "\[\[Programmes\/Spatial\/Spatial\.md\]\]"\ntype: reponse-ao\ntypeNom: Réponse à un appel d’offres\n/)
    expect(note).toContain('- id: analyse-ao\n  nom: Analyse de l’appel d’offres\n  sorte: ao.analyse\n')
    expect(read(platform, 'Programmes/Spatial/Station sol/Affaires/Station sol.md')).toMatch(/\nbp-type: affaire\nprojet: "\[\[Programmes\/Spatial\/Station sol\/Station sol\.md\]\]"\nprogramme: "\[\[Programmes\/Spatial\/Spatial\.md\]\]"\nclient: CNES\nreference: AO-2026-12\nstatut: en-cours\n/)
    // Sa page : le parcours de ses phases, ses affaires.
    const project = await load(shown.at(-1)!)
    expect(project.breadcrumb!.items.map((item) => item.label)).toEqual(['Programmes', 'Spatial', 'Station sol'])
    expect(journey(project).stages.map((stage) => stage.phases.map((phase) => phase.progress))).toEqual([['todo'], ['todo'], ['todo'], ['todo', 'todo'], ['todo'], ['todo'], ['todo'], ['todo']])
    const affaires = project.blocks.find((block) => block.kind === 'section' && block.id === 'programmes.projet.affaires')
    expect(affaires?.kind === 'section' && affaires.blocks[0]?.kind === 'cards' && affaires.blocks[0].cards.map((card) => [card.title, card.subtitle])).toEqual([['Station sol', 'CNES · AO-2026-12']])
    // L'accueil des programmes : la carte du programme, et le projet en miniature.
    const again = await load('programmes')
    expect(again.blocks[0]!.kind === 'cards' && again.blocks[0].cards[0]).toMatchObject({ title: 'Spatial', color: 'violet', icon: 'star', facts: [{ value: '1' }, { value: '1' }, { value: '0' }] })
  })

  it('une phase : la commencer (début aujourd’hui), la terminer (fin aujourd’hui) ; le parcours le montre', async () => {
    const platform = memoryPlatform()
    const { load, action, journey, shown } = await start(platform)
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await action(await load('programmes'), 'new')
    platform.forms.push({ name: 'Projet', programme: 'Programmes/P/P.md', type: 'projet-simple', description: '', affaire: 'false', client: '', reference: '' })
    await action(await load(shown.at(-1)!), 'project')
    const projectPage = shown.at(-1)!
    const tile = journey(await load(projectPage)).stages[0]!.phases[0]!
    await tile.open!.run()
    const phasePage = shown.at(-1)!
    expect(phasePage).toBe(`programmes.phase?${encodeURIComponent('Programmes/P/Projet/Projet.md')}|lancement`)
    let phase = await load(phasePage)
    expect(phase.subtitle).toBe('Phase libre · Étape 1 · À venir')
    await action(phase, 'status-en-cours')
    await action(await load(phasePage), 'status-terminee')
    phase = await load(phasePage)
    expect(phase.blocks.find((block) => block.kind === 'message')).toMatchObject({ tone: 'success' })
    expect(read(platform, 'Programmes/P/Projet/Projet.md')).toMatch(/- id: lancement\n(?:  .*\n)*?  statut: terminee\n(?:  .*\n)*?  debut: "[\d-]+"\n  fin: "[\d-]+"\n/)
    const stages = journey(await load(projectPage)).stages
    expect(stages.map((stage) => stage.phases[0]!.progress)).toEqual(['done', 'todo', 'todo', 'todo'])
    expect(stages[0]!.phases[0]!.status).toEqual({ label: 'Terminée', tone: 'success' })
  })

  it('l’éditeur d’un type : ajouter une phase en parallèle, une étape ; déplacer, retirer — rangé dans les réglages', async () => {
    const platform = memoryPlatform()
    const { load, settings } = await start(platform)
    const editor = () => load(`programmes.type?projet-simple`)
    const drawn = async () => (await editor()).blocks.find((block): block is Extract<HomeBlock, { kind: 'journey' }> => block.kind === 'journey')!
    platform.forms.push({ name: 'Achats', kind: 'libre', icon: 'chart', color: 'teal', description: '' })
    await (await drawn()).stages[1]!.add!.run()
    platform.forms.push({ name: 'Garantie', kind: 'libre', icon: 'lock', color: 'slate', description: 'Un an' })
    await (await drawn()).add!.run()
    let stages = (await drawn()).stages
    expect(stages.map((stage) => stage.phases.map((phase) => phase.label))).toEqual([['Lancement'], ['Réalisation', 'Achats'], ['Recette'], ['Clôture'], ['Garantie']])
    // Ses outils : déplacer à droite, retirer (après confirmation).
    await stages[1]!.phases[1]!.tools!.find((tool) => tool.id === 'right')!.run()
    stages = (await drawn()).stages
    expect(stages[2]!.phases.map((phase) => phase.label)).toEqual(['Recette', 'Achats'])
    await stages[4]!.phases[0]!.tools!.find((tool) => tool.id === 'remove')!.run()
    expect(platform.confirmed.at(-1)!.title).toBe('Retirer la phase « Garantie » ?')
    const stored = (settings.programmes!.typesProjet as ProjectType[]).find((type) => type.id === 'projet-simple')!
    expect(stored.stages.map((stage) => stage.map((phase) => phase.id))).toEqual([['lancement'], ['realisation'], ['recette', 'achats'], ['cloture']])
    // Le premier projet d'un type gardé : changer le type ensuite ne le change pas.
    expect(starterTypes(tr)[1]!.stages).toHaveLength(4)
  })
})

describe('les phases englobantes', () => {
  const simple = (): ProjectType => starterTypes(tr).find((type) => type.id === 'projet-simple')!

  it('elles suivent leurs phases quand les étapes changent : déplacées, disparues', () => {
    const type = addSpan(simple(), { name: 'Démarrage', color: 'teal', from: 0, to: 1 })
    expect(type.spans).toEqual([{ id: 'demarrage', name: 'Démarrage', color: 'teal', from: 0, to: 1 }])
    // Le lancement retiré : la réalisation passe à l'étape 0 — le bandeau ne couvre plus qu'elle.
    expect(remapSpans(type, removePhase(type, 'lancement')).spans).toEqual([{ id: 'demarrage', name: 'Démarrage', color: 'teal', from: 0, to: 0 }])
    // La recette rejoint la réalisation : rien ne change pour le bandeau (étapes 0 et 1).
    expect(remapSpans(type, movePhase(type, 'recette', 'left')).spans![0]).toMatchObject({ from: 0, to: 1 })
    // Une de ses phases mise dans une étape à elle, en tête : il la couvre toujours (étapes 0 à 2).
    const parallel = addParallel(type, 0, { id: 'cadrage', name: 'Cadrage', kind: 'libre', icon: 'flow', color: 'blue' })
    expect(remapSpans(parallel, movePhase(parallel, 'cadrage', 'left')).spans![0]).toMatchObject({ from: 0, to: 2 })
    // Une étape ajoutée en tête par une phase hors du bandeau : il glisse.
    const outside = addSpan(simple(), { name: 'Fin', color: 'rose', from: 2, to: 3 })
    const before = addParallel(outside, 1, { id: 'achats', name: 'Achats', kind: 'libre', icon: 'chart', color: 'teal' })
    expect(remapSpans(before, movePhase(movePhase(before, 'achats', 'left'), 'achats', 'left')).spans![0]).toMatchObject({ from: 3, to: 4 })
    // Toutes ses phases retirées : il disparaît.
    expect(remapSpans(type, removePhase(removePhase(type, 'lancement'), 'realisation')).spans).toBeUndefined()
  })

  it('le type de départ : « Avant-vente » et « Contrat » en bandeaux ; un projet les copie, et dit où elles en sont', async () => {
    const platform = memoryPlatform()
    const { load, action, journey, shown } = await start(platform)
    const types = await load('programmes.types')
    const ao = types.blocks.find((block): block is Extract<HomeBlock, { kind: 'journey' }> => block.kind === 'journey')!
    expect(ao.spans!.map((span) => [span.label, span.from, span.to, span.detail])).toEqual([
      ['Avant-vente', 0, 4, 'étapes 1 à 5'],
      ['Contrat', 5, 7, 'étapes 6 à 8']
    ])
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await action(await load('programmes'), 'new')
    platform.forms.push({ name: 'Q', programme: 'Programmes/P/P.md', type: 'reponse-ao', description: '', affaire: 'false', client: '', reference: '' })
    await action(await load(shown.at(-1)!), 'project')
    const projectPage = shown.at(-1)!
    expect(read(platform, 'Programmes/P/Q/Q.md')).toContain('englobantes:\n- id: avant-vente\n  nom: Avant-vente\n  couleur: indigo\n  de: 1\n  a: 5\n')
    expect(journey(await load(projectPage)).spans!.map((span) => [span.label, span.from, span.to, span.progress, span.detail])).toEqual([
      ['Avant-vente', 0, 4, 'todo', '0/6 phases'],
      ['Contrat', 5, 7, 'todo', '0/3 phases']
    ])
    await action(await load(`programmes.phase?${encodeURIComponent('Programmes/P/Q/Q.md')}|veille`), 'status-terminee')
    expect(journey(await load(projectPage)).spans![0]).toMatchObject({ progress: 'current', detail: '1/6 phases' })
  })

  it('l’éditeur : « Phase englobante » (de l’étape, à l’étape, couleur), la modifier, la retirer', async () => {
    const platform = memoryPlatform()
    const { load, action, settings } = await start(platform)
    const editor = () => load('programmes.type?projet-simple')
    platform.forms.push({ name: 'Livraison', from: '1', to: '2', color: 'orange', description: '' })
    await action(await editor(), 'span')
    expect(platform.asked.at(-1)!.fields.find((field) => field.key === 'from')).toMatchObject({ options: [{ label: 'Étape 1 — Lancement' }, { label: 'Étape 2 — Réalisation' }, { label: 'Étape 3 — Recette' }, { label: 'Étape 4 — Clôture' }] })
    let drawn = (await editor()).blocks.find((block): block is Extract<HomeBlock, { kind: 'journey' }> => block.kind === 'journey')!
    expect(drawn.spans).toMatchObject([{ label: 'Livraison', color: 'orange', from: 1, to: 2, detail: 'étapes 2 à 3' }])
    // À l'envers : refusé.
    await expect(
      (async () => {
        platform.forms.push({ name: 'X', from: '3', to: '1', color: 'orange', description: '' })
        await action(await editor(), 'span')
      })()
    ).rejects.toThrow('La dernière étape vient après la première.')
    platform.forms.push({ name: 'Livraison et recette', from: '1', to: '3', color: 'green', description: '' })
    await drawn.spans![0]!.tools!.find((tool) => tool.id === 'edit')!.run()
    drawn = (await editor()).blocks.find((block): block is Extract<HomeBlock, { kind: 'journey' }> => block.kind === 'journey')!
    expect(drawn.spans).toMatchObject([{ label: 'Livraison et recette', from: 1, to: 3 }])
    await drawn.spans![0]!.tools!.find((tool) => tool.id === 'remove')!.run()
    expect((settings.programmes!.typesProjet as ProjectType[]).find((type) => type.id === 'projet-simple')!.spans).toBeUndefined()
  })
})

describe('le planning : des durées, un démarrage, des dates prévues', () => {
  const phase = (id: string, stage: number, duration?: number, status: ProjectPhase['status'] = 'a-venir'): ProjectPhase => ({ id, name: id, kind: 'libre', icon: 'flow', color: 'indigo', stage, status, ...(duration !== undefined ? { duration } : {}) })

  it('les phases d’une étape commencent ensemble ; la suivante le lendemain de la fin de la plus longue ; sans durée ou sans objet : un jour, sans retarder', () => {
    const planned = planPhases([phase('lancement', 1, 5), phase('realisation', 2, 30), phase('achats', 2, 10), phase('jalon', 3), phase('option', 4, 20, 'sans-objet'), phase('cloture', 5, 3)], '2026-03-02')
    expect(planned.map((each) => [each.id, each.plannedStart, each.plannedEnd])).toEqual([
      ['lancement', '2026-03-02', '2026-03-06'],
      ['realisation', '2026-03-07', '2026-04-05'],
      ['achats', '2026-03-07', '2026-03-16'],
      ['jalon', '2026-04-06', '2026-04-06'],
      ['option', '2026-04-06', '2026-04-06'],
      ['cloture', '2026-04-06', '2026-04-08']
    ])
    expect(planPhases(planned, undefined).every((each) => !each.plannedStart && !each.plannedEnd)).toBe(true)
  })

  it('le recalage : une phase finie tôt avance la suite ; en retard, elle s’étend jusqu’à aujourd’hui ; une phase à venir ne commence pas dans le passé', () => {
    const base = [phase('lancement', 1, 5), phase('realisation', 2, 30), phase('achats', 2, 10), phase('recette', 3, 10)]
    const dates = (list: ProjectPhase[]) => list.map((each) => [each.id, each.plannedStart, each.plannedEnd])
    // Le lancement fini en 3 jours au lieu de 5 : la suite avance de 2 jours.
    const early = base.map((each) => (each.id === 'lancement' ? { ...each, status: 'terminee' as const, start: '2026-03-02', end: '2026-03-04' } : each))
    expect(dates(replanPhases(early, '2026-03-02', '2026-03-05'))).toEqual([
      ['lancement', '2026-03-02', '2026-03-04'],
      ['realisation', '2026-03-05', '2026-04-03'],
      ['achats', '2026-03-05', '2026-03-14'],
      ['recette', '2026-04-04', '2026-04-13']
    ])
    // En cours depuis le 2, pas fini le 12 (prévu le 6) : il s'étend jusqu'au 12, la suite recule.
    const late = base.map((each) => (each.id === 'lancement' ? { ...each, status: 'en-cours' as const, start: '2026-03-02' } : each))
    expect(dates(replanPhases(late, '2026-03-02', '2026-03-12')).slice(0, 2)).toEqual([
      ['lancement', '2026-03-02', '2026-03-12'],
      ['realisation', '2026-03-13', '2026-04-11']
    ])
    // Rien commencé le 10 : le lancement commence aujourd'hui, pas le 2.
    expect(dates(replanPhases(base, '2026-03-02', '2026-03-10'))[0]).toEqual(['lancement', '2026-03-10', '2026-03-14'])
  })

  it('« Démarrer le projet » : le planning initial et les dates prévues ; démarré dans le passé, rien commencé — recalé sur aujourd’hui, en retard ; changer une durée refait le planning', async () => {
    const platform = memoryPlatform()
    const { load, action, journey, shown } = await start(platform)
    const today = localToday()
    const ago = addDays(today, -30)
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await action(await load('programmes'), 'new')
    platform.forms.push({ name: 'Q', programme: 'Programmes/P/P.md', type: 'projet-simple', description: '', affaire: 'false', client: '', reference: '' })
    await action(await load(shown.at(-1)!), 'project')
    const projectPage = shown.at(-1)!
    let project = await load(projectPage)
    expect(project.actions!.find((each) => each.id === 'start')).toMatchObject({ label: 'Démarrer le projet', primary: true })
    expect(project.blocks[0]!.kind === 'stats' && project.blocks[0].stats.map((stat) => [stat.label, stat.value])).toContainEqual(['Démarrage', 'pas démarré'])
    // Démarré il y a 30 jours, rien commencé : tout part d'aujourd'hui (5 + 30 + 10 + 5 jours).
    platform.forms.push({ start: ago })
    await action(project, 'start')
    expect(platform.notices.at(-1)).toBe(`« Q » démarré : fin prévue le ${addDays(today, 49)}.`)
    const note = read(platform, 'Programmes/P/Q/Q.md')
    expect(note).toContain(`\ndemarrage: "${ago}"\n`)
    expect(note).toContain(`- id: lancement\n  nom: Lancement\n  sorte: libre\n  icone: play\n  couleur: teal\n  etape: 1\n  statut: a-venir\n  duree: 5\n  prevuDebut: "${today}"\n  prevuFin: "${addDays(today, 4)}"\n  initialDebut: "${ago}"\n  initialFin: "${addDays(ago, 4)}"\n`)
    project = await load(projectPage)
    expect(project.actions!.find((each) => each.id === 'start')!.label).toBe('Date de démarrage')
    const stats = project.blocks[0]!.kind === 'stats' ? project.blocks[0].stats : []
    expect(stats.find((stat) => stat.label === 'Fin prévue')).toMatchObject({ value: shortDay(addDays(today, 49)), tone: 'danger', hint: `décalée de 30 j (initialement le ${shortDay(addDays(ago, 49))}) · 1 phase(s) en retard` })
    const tiles = journey(project).stages.map((stage) => stage.phases[0]!)
    expect(tiles[0]).toMatchObject({ status: { label: 'En retard', tone: 'danger' }, detail: `prévue du ${shortDay(today)} au ${shortDay(addDays(today, 4))} (+30 j)` })
    // Le lancement commencé il y a 30 jours, toujours en cours : il s'étend jusqu'à aujourd'hui.
    platform.forms.push({ start: ago, end: '', duration: '5' })
    await action(await load(`programmes.phase?${encodeURIComponent('Programmes/P/Q/Q.md')}|lancement`), 'dates')
    await action(await load(`programmes.phase?${encodeURIComponent('Programmes/P/Q/Q.md')}|lancement`), 'status-en-cours')
    const phase1 = await load(`programmes.phase?${encodeURIComponent('Programmes/P/Q/Q.md')}|lancement`)
    expect(phase1.blocks.find((block) => block.kind === 'message')).toMatchObject({ tone: 'danger' })
    expect(read(platform, 'Programmes/P/Q/Q.md')).toContain(`- id: realisation\n  nom: Réalisation\n  sorte: libre\n  icone: edit\n  couleur: blue\n  etape: 2\n  statut: a-venir\n  duree: 30\n  prevuDebut: "${addDays(today, 1)}"\n`)
    // Une durée qui n'en est pas une : refusée.
    platform.forms.push({ start: '', end: '', duration: 'dix' })
    await expect(action(await load(`programmes.phase?${encodeURIComponent('Programmes/P/Q/Q.md')}|lancement`), 'dates')).rejects.toThrow('Une durée est un nombre de jours (0 ou plus).')
  })
})

describe('les documents attendus', () => {
  it('le type : l’interrupteur, puis les types de pièce (plusieurs) ; la tuile le dit', async () => {
    const platform = memoryPlatform()
    const { load, settings } = await start(platform)
    const editor = () => load('programmes.type?projet-simple')
    const drawn = async () => (await editor()).blocks.find((block): block is Extract<HomeBlock, { kind: 'journey' }> => block.kind === 'journey')!
    platform.forms.push({ name: 'Recette', kind: 'libre', icon: 'check', color: 'orange', duration: '10', documents: 'true', description: '' })
    platform.manyAnswers.push(['PV', 'RAPPORT'])
    await (await drawn()).stages[2]!.phases[0]!.open!.run()
    expect(platform.manyAsked.at(-1)!.title).toBe('Les documents attendus par « Recette »')
    const recette = (settings.programmes!.typesProjet as ProjectType[]).find((type) => type.id === 'projet-simple')!.stages[2]![0]!
    expect(recette).toMatchObject({ duration: 10, documents: [{ type: 'PV' }, { type: 'RAPPORT' }] })
    expect((await drawn()).stages[2]!.phases[0]!.detail).toBe('10 j · 2 document(s) attendu(s)')
    // L'interrupteur coupé : plus de documents.
    platform.forms.push({ name: 'Recette', kind: 'libre', icon: 'check', color: 'orange', duration: '10', documents: 'false', description: '' })
    await (await drawn()).stages[2]!.phases[0]!.open!.run()
    expect((settings.programmes!.typesProjet as ProjectType[]).find((type) => type.id === 'projet-simple')!.stages[2]![0]!.documents).toBeUndefined()
  })

  it('un type de document qui manque : « Nouveau type de document » dans la fenêtre — créé (Typage des pièces), coché, attendu', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    const editor = () => load('programmes.type?projet-simple')
    const drawn = async () => (await editor()).blocks.find((block): block is Extract<HomeBlock, { kind: 'journey' }> => block.kind === 'journey')!
    platform.forms.push({ name: 'Recette', kind: 'libre', icon: 'check', color: 'orange', duration: '10', documents: 'true', description: '' }, { code: 'PV', label: 'Procès-verbal de recette' })
    platform.manyAnswers.push(['CCTP', CREATE_IN_PICK])
    await (await drawn()).stages[2]!.phases[0]!.open!.run()
    expect(platform.manyAsked.at(-1)!.create!.label).toBe('Nouveau type de document')
    expect(platform.notices).toContain('« PV — Procès-verbal de recette » ajouté aux types de pièce.')
    const recette = (await drawn()).stages[2]!.phases[0]!
    expect(recette.detail).toBe('10 j · 2 document(s) attendu(s)')
    // Le nouveau type est dans la liste des types de pièce : proposé la fois suivante.
    platform.forms.push({ name: 'Recette', kind: 'libre', icon: 'check', color: 'orange', duration: '10', documents: 'true', description: '' })
    platform.manyAnswers.push(['CCTP', 'PV'])
    await recette.open!.run()
    expect(platform.manyAsked.at(-1)!.choices.map((choice) => choice.label)).toContain('PV — Procès-verbal de recette')
  })

  it('le projet : la phase les liste (attendus, reçus) ; « Reçu », « Relier le fichier », « Documents attendus » pour en ajouter', async () => {
    const platform = memoryPlatform()
    const { load, action, shown } = await start(platform)
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await action(await load('programmes'), 'new')
    platform.forms.push({ name: 'Q', programme: 'Programmes/P/P.md', type: 'reponse-ao', description: '', affaire: 'false', client: '', reference: '' })
    await action(await load(shown.at(-1)!), 'project')
    const phasePage = `programmes.phase?${encodeURIComponent('Programmes/P/Q/Q.md')}|analyse-ao`
    const docs = async () => (await load(phasePage)).blocks.find((block) => block.kind === 'list')
    let list = await docs()
    expect(list?.kind === 'list' && [list.title, list.items.map((item) => [item.title, item.detail, item.tone])]).toEqual([
      'Documents attendus (0/3 reçus)',
      [
        ['RC — Règlement de la consultation', 'Attendu', 'warning'],
        ['CCAP — Cahier des clauses administratives particulières', 'Attendu', 'warning'],
        ['CCTP — Cahier des clauses techniques particulières', 'Attendu', 'warning']
      ]
    ])
    await (list?.kind === 'list' ? list.items[0]!.tools!.find((tool) => tool.id === 'receive')!.run() : null)
    platform.nextPick = 'Dossier/CCTP.pdf'
    list = await docs()
    await (list?.kind === 'list' ? list.items[2]!.tools!.find((tool) => tool.id === 'link')!.run() : null)
    list = await docs()
    expect(list?.kind === 'list' && list.items.map((item) => [item.tone, item.detail?.startsWith('Reçu · le ')])).toEqual([
      ['success', true],
      ['warning', false],
      ['success', true]
    ])
    expect(read(platform, 'Programmes/P/Q/Q.md')).toMatch(/  documents:\n  - type: RC\n    recu: true\n    le: "[\d-]+"\n  - type: CCAP\n  - type: CCTP\n    recu: true\n    lien: "\[\[Dossier\/CCTP\.pdf\]\]"\n/)
    // En ajouter un : « Documents attendus » (ceux d'avant gardés, avec leur état).
    platform.manyAnswers.push(['RC', 'CCAP', 'CCTP', 'DQE'])
    await action(await load(phasePage), 'documents')
    list = await docs()
    expect(list?.kind === 'list' && [list.title, list.items.at(-1)!.title]).toEqual(['Documents attendus (2/4 reçus)', 'DQE — Détail quantitatif estimatif'])
  })
})

describe('l’analyse d’un appel d’offres, phase d’un projet', () => {
  it('« Créer l’analyse » depuis la phase : l’analyse du module AO, reliée ; la phase commence ; sa tuile la nomme', async () => {
    const platform = memoryPlatform()
    const { load, action, journey, shown } = await start(platform)
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await action(await load('programmes'), 'new')
    platform.forms.push({ name: 'Station sol', programme: 'Programmes/P/P.md', type: 'reponse-ao', description: '', affaire: 'true', client: '', reference: '' })
    await action(await load(shown.at(-1)!), 'project')
    const projectPage = shown.at(-1)!
    const aoTile = journey(await load(projectPage)).stages[1]!.phases[0]!
    expect(aoTile).toMatchObject({ caption: 'Analyse d’appel d’offres', detail: 'pas encore d’analyse · 0/3 documents' })
    await aoTile.open!.run()
    const phasePage = shown.at(-1)!
    const phase = await load(phasePage)
    expect(phase.actions!.map((each) => each.label)).toEqual(['Créer l’analyse', 'Relier une analyse existante', 'Ses dates', 'Documents attendus'])
    // La fenêtre de l'analyse : le nom du projet proposé ; puis « plus tard » pour l'import.
    platform.forms.push({ name: 'Station sol', position: 'candidat', buyer: 'CNES', reference: '' })
    platform.choices.push('later')
    await action(phase, 'ao.create')
    expect(platform.asked.at(-1)!.fields.find((field) => field.key === 'name')).toMatchObject({ value: 'Station sol' })
    const analysis = `Appels d'offres/Station sol/Station sol.md`
    expect(platform.files.has(analysis)).toBe(true)
    expect(shown.at(-1)).toBe(`ao.fiche?${encodeURIComponent(analysis)}`)
    expect(read(platform, 'Programmes/P/Station sol/Station sol.md')).toMatch(/- id: analyse-ao\n(?:  .*\n)*?  statut: en-cours\n(?:  .*\n)*?  debut: "[\d-]+"\n  lien: "\[\[Appels d'offres\/Station sol\/Station sol\.md\]\]"\n/)
    const tile = journey(await load(projectPage)).stages[1]!.phases[0]!
    expect(tile).toMatchObject({ detail: 'analyse « Station sol » · 0/3 documents', progress: 'current' })
    const linked = await load(phasePage)
    expect(linked.actions!.map((each) => each.label)).toEqual(['Ouvrir l’analyse', 'Relier une autre analyse', 'Délier', 'Ses dates', 'Documents attendus'])
    expect(linked.blocks.find((block) => block.kind === 'cards')).toMatchObject({ cards: [{ title: 'Station sol', facts: [{ label: 'Pièces', value: '0' }] }] })
  })

  it('sans le module AO : la phase reste, son état et ses dates ; la page le dit', async () => {
    const platform = memoryPlatform()
    const { load, action, shown } = await start(platform, MODULES.filter((module) => module !== aoModule))
    platform.forms.push({ name: 'P', code: '', description: '', color: 'indigo', icon: 'folder' })
    await action(await load('programmes'), 'new')
    platform.forms.push({ name: 'X', programme: 'Programmes/P/P.md', type: 'reponse-ao', description: '', affaire: 'false', client: '', reference: '' })
    await action(await load(shown.at(-1)!), 'project')
    const phase = await load(`programmes.phase?${encodeURIComponent('Programmes/P/X/X.md')}|analyse-ao`)
    expect(phase.actions!.map((each) => each.id)).toEqual(['dates', 'documents'])
    expect(phase.blocks.at(-1)).toMatchObject({ kind: 'message', tone: 'warning' })
    expect(programmesModule.id).toBe('programmes')
  })
})
