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
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type PageView } from '../src/core/views'
import { MODULES } from '../src/modules'
import { aoModule } from '../src/modules/ao'
import { addParallel, addStage, movePhase, programmesModule, removePhase, starterTypes, type ProjectType } from '../src/modules/programmes'

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
    expect(read(platform, 'Programmes/P/Projet/Projet.md')).toMatch(/- id: lancement\n(?:  .*\n)*?  statut: terminee\n  debut: "[\d-]+"\n  fin: "[\d-]+"\n/)
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
    expect(aoTile).toMatchObject({ caption: 'Analyse d’appel d’offres', detail: 'pas encore d’analyse' })
    await aoTile.open!.run()
    const phasePage = shown.at(-1)!
    const phase = await load(phasePage)
    expect(phase.actions!.map((each) => each.label)).toEqual(['Créer l’analyse', 'Relier une analyse existante', 'Ses dates'])
    // La fenêtre de l'analyse : le nom du projet proposé ; puis « plus tard » pour l'import.
    platform.forms.push({ name: 'Station sol', position: 'candidat', buyer: 'CNES', reference: '' })
    platform.choices.push('later')
    await action(phase, 'ao.create')
    expect(platform.asked.at(-1)!.fields.find((field) => field.key === 'name')).toMatchObject({ value: 'Station sol' })
    const analysis = `Appels d'offres/Station sol/Station sol.md`
    expect(platform.files.has(analysis)).toBe(true)
    expect(shown.at(-1)).toBe(`ao.fiche?${encodeURIComponent(analysis)}`)
    expect(read(platform, 'Programmes/P/Station sol/Station sol.md')).toMatch(/- id: analyse-ao\n(?:  .*\n)*?  statut: en-cours\n  debut: "[\d-]+"\n  lien: "\[\[Appels d'offres\/Station sol\/Station sol\.md\]\]"\n/)
    const tile = journey(await load(projectPage)).stages[1]!.phases[0]!
    expect(tile).toMatchObject({ detail: 'analyse « Station sol »', progress: 'current' })
    const linked = await load(phasePage)
    expect(linked.actions!.map((each) => each.label)).toEqual(['Ouvrir l’analyse', 'Relier une autre analyse', 'Délier', 'Ses dates'])
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
    expect(phase.actions!.map((each) => each.id)).toEqual(['dates'])
    expect(phase.blocks.at(-1)).toMatchObject({ kind: 'message', tone: 'warning' })
    expect(programmesModule.id).toBe('programmes')
  })
})
