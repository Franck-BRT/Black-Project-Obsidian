// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Le circuit des documents, version B** : « À classer », l'entrée unique ; le réglage du
 * circuit ; le workflow système qui enchaîne les trois skills livrés — ingérer, analyser,
 * ranger — et ce qui n'est pas sûr dans « À contrôler » ; la relance de ce qui s'est arrêté ;
 * le rappel du lundi.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { bibliothequeModule, libraryEntries, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { programmesModule } from '../src/modules/programmes'
import { actionSpec, NO_SUBJECT, runOpeningWorkflows, workflowsIdle, workflowsModule, type Workflow } from '../src/modules/workflows'

const ALL: BlackModule[] = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule, programmesModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })
const TYPES = [
  {
    id: 'etude',
    name: 'Étude',
    icon: 'flow',
    color: 'teal',
    stages: [[{ id: 'lancement', name: 'Lancement', kind: 'libre', icon: 'play', color: 'teal' }]],
    folders: [{ id: 'offre', name: 'Offre', children: [{ id: 'technique', name: 'Technique', expects: ['CCTP'] }] }]
  }
]

/** L'IA simulée : on dit ce que rendent l'analyse et le rangement ; elle relit le texte tel quel ; le reste : rien de sûr. */
interface Answers {
  analyse: () => { status: number; text: string }
  rangement: () => { status: number; text: string }
}

async function start(platform: MemoryPlatform, circuit: boolean | undefined = true, ia: Record<string, unknown> = SERVEUR) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  // `circuit` absent : le réglage d'origine (activé).
  const settings: Record<string, Record<string, unknown>> = { ia, bibliotheque: circuit === undefined ? {} : { circuit }, programmes: { typesProjet: TYPES } }
  const views = new ViewsRegistry()
  const shown: string[] = []
  for (const module of ALL) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: (id) => void shown.push(id)
    }
    await module.activate(context)
  }
  const answers: Answers = { analyse: () => chat({}), rangement: () => chat({}) }
  const asked: { kind: string; user: string }[] = []
  const original = platform.http.request.bind(platform.http)
  platform.http.request = async (request) => {
    if (!request.url.endsWith('/chat/completions')) return original(request)
    const messages = (JSON.parse(request.body!) as { messages: { role: string; content: string }[] }).messages
    const all = messages.map((message) => message.content).join('\n')
    const user = messages.at(-1)!.content
    if (all.includes('« typePiece »')) {
      asked.push({ kind: 'analyse', user })
      return answers.analyse()
    }
    if (all.includes('« dossier »')) {
      asked.push({ kind: 'rangement', user })
      return answers.rangement()
    }
    if (all.includes('Tu relis un texte extrait automatiquement')) {
      asked.push({ kind: 'relecture', user })
      return chat(user.split('\n\n').slice(1).join('\n\n') || user)
    }
    if (messages[0]!.content.startsWith('Tu identifies la langue')) return chat('fr')
    return chat({ title: '', issuer: '', reference: '', edition: '', revision: '', certain: false, category: '', tags: [], date: '' })
  }
  const load = (target: string): Promise<PageView> => {
    const [id, param] = target.split('?') as [string, string | undefined]
    return views.pages().find((each) => each.id === id)!.load(param)
  }
  const run = async (view: PageView, id: string) => view.actions!.find((action) => action.id === id)!.run()
  const pour = async (name: string, text: string, folder?: string, module = 'bibliotheque') => (await pourIntoLibrary([{ name, bytes: bytes(text) }], { module, label: '' }, folder ? { folder } : {}))!
  const workflows = () => (settings.workflows?.workflows ?? []) as Workflow[]
  return { load, run, pour, answers, asked, shown, settings, workflows, i18n }
}

const deep = (blocks: readonly HomeBlock[]): HomeBlock[] => blocks.flatMap((block) => (block.kind === 'section' ? [block, ...deep(block.blocks)] : [block]))
const cards = (view: PageView): Card[] => deep(view.blocks).flatMap((block) => (block.kind === 'cards' ? block.cards : []))

/** Un programme, un projet « Station sol » d'un type qui attend un CCTP dans Offre › Technique. */
async function project(harness: Awaited<ReturnType<typeof start>>, platform: MemoryPlatform) {
  platform.forms.push({ name: 'Spatial', code: '', description: '', color: 'indigo', icon: 'folder' })
  await harness.run(await harness.load('programmes'), 'new')
  platform.forms.push({ name: 'Station sol', programme: 'Programmes/Spatial/Spatial.md', type: 'etude', description: 'Pour le CNES', affaire: 'false', client: '', reference: '' })
  await harness.run(await harness.load(harness.shown.at(-1)!), 'project')
  // Sa page : ses répertoires attendus, créés dans la bibliothèque.
  await harness.load(harness.shown.at(-1)!)
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('le circuit, activé d’origine', () => {
  it('le réglage jamais touché, une IA réglée : un document versé sans lieu entre dans le circuit', async () => {
    const platform = memoryPlatform()
    const { pour, answers } = await start(platform, undefined)
    answers.analyse = () => ({ status: 500, text: 'panne' })
    const report = await pour('A.txt', 'Un document.')
    expect(report.added[0]!.record).toBe('Bibliothèque/À classer/A.md')
    await workflowsIdle()
    expect(read(platform, 'Bibliothèque/À classer/A.md')).toMatch(/\ncircuit: ingere\n/)
  })

  it('sans IA réglée : le document est versé directement, comme avant (pas de circuit)', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform, undefined, {})
    const report = await pour('A.txt', 'Un document.')
    expect(report.added[0]!.record).toBe('Bibliothèque/A.md')
    await workflowsIdle()
    expect(read(platform, 'Bibliothèque/A.md')).not.toMatch(/\ncircuit:/)
  })
})

describe('« À classer » et le réglage du circuit', () => {
  it('désactivé (d’origine) : versé à la racine comme avant, pas de circuit', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform, false)
    const report = await pour('Note.txt', 'Une note.')
    expect(report.added[0]!.record).toBe('Bibliothèque/Note.md')
    expect(report.added[0]!.circuit).toBeUndefined()
  })

  it('activé : ce que la bibliothèque verse sans lieu (ou à sa racine) entre dans À classer ; dans un répertoire choisi, ou venu d’un autre module : non', async () => {
    const platform = memoryPlatform()
    const { pour, answers } = await start(platform)
    // Le circuit s'arrête à l'analyse (IA en panne) : on voit où le document est entré.
    answers.analyse = () => ({ status: 500, text: 'panne' })
    expect((await pour('A.txt', 'Premier.')).added[0]!.record).toBe('Bibliothèque/À classer/A.md')
    expect((await pour('B.txt', 'Second.', 'Bibliothèque')).added[0]!.record).toBe('Bibliothèque/À classer/B.md')
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    expect((await pour('C.txt', 'Troisième.', 'Bibliothèque/Normes')).added[0]!.record).toBe('Bibliothèque/Normes/C.md')
    expect((await pour('D.txt', 'Quatrième.', undefined, 'ao')).added[0]!.record).toBe('Bibliothèque/D.md')
    expect(read(platform, 'Bibliothèque/À classer/A.md')).toMatch(/\ncircuit: ingere\n/)
    expect(read(platform, 'Bibliothèque/Normes/C.md')).not.toContain('circuit')
  })

  it('l’ancien « À verser » devient « À classer » ; ce qu’on y pose est versé, et les fiches qui y attendent ne sont pas versées de nouveau', async () => {
    const platform = memoryPlatform()
    await platform.fs.ensureFolder('Bibliothèque/À verser')
    await platform.fs.writeBinary('Bibliothèque/À verser/Devis.txt', bytes('Un devis.').slice().buffer)
    const { answers } = await start(platform)
    expect(await platform.fs.exists('Bibliothèque/À verser')).toBe(false)
    expect(await platform.fs.exists('Bibliothèque/À classer/Devis.txt')).toBe(true)
    answers.analyse = () => ({ status: 500, text: 'panne' })
    await runOpeningWorkflows()
    await workflowsIdle()
    expect(await platform.fs.exists('Bibliothèque/À classer/Devis.txt')).toBe(false)
    expect(read(platform, 'Bibliothèque/À classer/Devis.md')).toMatch(/\ncircuit: ingere\n/)
    // À l'ouverture suivante : la fiche reste une fiche (pas un fichier à verser).
    await runOpeningWorkflows()
    await workflowsIdle()
    expect([...platform.files.keys()].filter((path) => path.includes('Devis')).sort()).toEqual(['Bibliothèque/_fichiers/Devis.txt', 'Bibliothèque/À classer/Devis.md'])
  })
})

describe('le workflow système « Circuit des documents »', () => {
  it('déclaré après les passes de l’IA ; ses trois skills, livrés et ajoutés dès l’activation', async () => {
    const platform = memoryPlatform()
    const { workflows, pour, answers } = await start(platform)
    const ids = workflows().map((workflow) => workflow.system).filter((id): id is string => !!id)
    expect(ids.indexOf('sys.ia.circuit')).toBeGreaterThan(ids.indexOf('sys.ia.emetteur-documents'))
    expect(workflows().find((workflow) => workflow.system === 'sys.ia.circuit')).toMatchObject({
      enabled: true,
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'circuitencours', op: 'not-empty', value: '' }],
      actions: [
        { kind: 'ia.executer-skill', fields: { skill: 'Ingérer un document' } },
        { kind: 'ia.executer-skill', fields: { skill: 'Analyser un document' } },
        { kind: 'ia.executer-skill', fields: { skill: 'Ranger un document' } }
      ]
    })
    expect(workflows().find((workflow) => workflow.system === 'sys.bibliotheque.relancer-circuit')).toMatchObject({ enabled: true, trigger: { kind: 'ouverture' } })
    expect(workflows().find((workflow) => workflow.system === 'sys.bibliotheque.rappels-lundi')).toMatchObject({ enabled: true, actions: [{ kind: 'bibliotheque.rappel-a-controler' }, {}, {}, {}, {}] })
    // Ses trois skills : dans la bibliothèque des skills dès l'activation (son workflow les nomme).
    expect((await libraryEntries('skill')).map((entry) => entry.name).sort()).toEqual(['Analyser un document', 'Ingérer un document', 'Ranger un document'])
    answers.analyse = () => ({ status: 500, text: 'panne' })
    await pour('A.txt', 'Un document.')
    expect((await libraryEntries('skill')).map((entry) => entry.name).sort()).toEqual(['Analyser un document', 'Ingérer un document', 'Ranger un document'])
  })

  it('de bout en bout : ingéré (relu), analysé (type de pièce, projet reconnu), rangé dans le répertoire attendu — l’historique sur la fiche', async () => {
    const platform = memoryPlatform()
    const harness = await start(platform)
    await project(harness, platform)
    const { pour, answers, asked } = harness
    answers.analyse = () => chat({ typePiece: 'CCTP', emetteur: '', projet: 'Programmes/Spatial/Station sol/Station sol.md', confiance: 0.86, raison: 'Le CCTP de la Station sol.' })
    answers.rangement = () => chat({ dossier: 'Bibliothèque/Projets/Spatial/Station sol/Offre/Technique', confiance: 0.92, raison: 'Répertoire attendu pour un CCTP.', alternatives: [] })
    const report = await pour('Pièce 3.txt', 'Cahier des clauses techniques particulières de la Station sol.\nLe titulaire doit livrer l’antenne.')
    expect(report.added[0]!.record).toBe('Bibliothèque/À classer/Pièce 3.md')
    const filed = 'Bibliothèque/Projets/Spatial/Station sol/Offre/Technique/Pièce 3.md'
    const record = read(platform, filed)
    expect(record).toMatch(/\ncategorie: CCTP\n/)
    expect(record).toMatch(/\ncircuit: range\n/)
    expect(record).toMatch(/\ncircuit-projet: "\[\[Programmes\/Spatial\/Station sol\/Station sol\.md\]\]"\n/)
    expect(record).toMatch(/· Ingérer un document — ingéré : /)
    expect(record).toMatch(/· Analyser un document — type de pièce CCTP, projet Station sol · confiance 86 %\n/)
    expect(record).toMatch(/· Ranger un document — rangé dans .*Technique \(confiance 92 %\)\n/)
    // Ce que l'analyse et le rangement ont reçu : les projets, et le répertoire proposé d'office.
    expect(asked.map((each) => each.kind)).toEqual(['relecture', 'analyse', 'rangement'])
    const analysis = asked.find((each) => each.kind === 'analyse')!.user
    expect(analysis).toContain('- Programmes/Spatial/Station sol/Station sol.md — Station sol (programme Spatial, type Étude)')
    expect(analysis).toContain('## Les types de pièce\n\nRéponds avec l’un de ces codes (avant le tiret) :\n- CCTP\n')
    const filing = asked.find((each) => each.kind === 'rangement')!.user
    expect(filing).toContain('★ Les répertoires du projet Station sol : — le projet reconnu pour ce document')
    expect(filing).toContain('  - Bibliothèque/Projets/Spatial/Station sol/Offre/Technique — attend CCTP ← proposé d’office : attend ce type de pièce (CCTP)')
    expect(filing).toContain('- Projet reconnu : Programmes/Spatial/Station sol/Station sol.md')
  })

  it('pas sûr au rangement : À contrôler ; l’analyse peu sûre ne change pas la fiche', async () => {
    const platform = memoryPlatform()
    const { pour, answers, load } = await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    answers.analyse = () => chat({ typePiece: 'CCAP', emetteur: '', projet: '', confiance: 0.4, raison: 'Peut-être un CCAP.' })
    answers.rangement = () => chat({ dossier: 'Bibliothèque/Normes', confiance: 0.5, raison: 'Hésitation.', alternatives: ['Bibliothèque'] })
    await pour('Note.txt', 'Une note qui hésite.')
    const record = read(platform, 'Bibliothèque/À contrôler/Note.md')
    expect(record).not.toMatch(/\ncategorie: CCAP\n/)
    expect(record).toMatch(/· Analyser un document — rien de sûr à donner · confiance 40 % — pas assez sûr pour changer la fiche \(seuil 70 %\)\n/)
    expect(record).toMatch(/\ncircuit: a-controler\n/)
    expect(cards(await load('bibliotheque.a-controler')).map((card) => card.title)).toEqual(['Note'])
  })

  it('arrêté en route (IA en panne) : « En cours » le montre, la page des documents aussi ; à l’ouverture, il reprend là où il en était', async () => {
    const platform = memoryPlatform()
    const { pour, answers, load, asked } = await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    answers.analyse = () => ({ status: 500, text: 'panne' })
    await pour('Norme.txt', 'ECSS-E-ST-10C.')
    expect(read(platform, 'Bibliothèque/À classer/Norme.md')).toMatch(/\ncircuit: ingere\n/)
    const library = await load('bibliotheque.documents')
    expect(library.blocks[0]).toMatchObject({ kind: 'message', tone: 'info', text: '1 document(s) en cours dans le circuit (à classer, à analyser, à ranger).' })
    const control = await load('bibliotheque.a-controler')
    const section = deep(control.blocks).find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.circuit.en-cours')!
    expect(section).toMatchObject({ title: 'En cours dans le circuit', subtitle: '1 document(s)' })
    expect(cards(control).find((card) => card.title === 'Norme')).toMatchObject({ subtitle: 'Ingéré, à analyser' })
    // L'IA revient : à l'ouverture, il reprend — sans relire son texte une seconde fois.
    const relectures = asked.filter((each) => each.kind === 'relecture').length
    answers.analyse = () => chat({ typePiece: '', emetteur: '', projet: '', confiance: 0.9, raison: 'Une norme.' })
    answers.rangement = () => chat({ dossier: 'Bibliothèque/Normes', confiance: 0.95, raison: 'Une norme.', alternatives: [] })
    await runOpeningWorkflows()
    // La relance passe à la suite des workflows de l'ouverture : on attend que la file soit passée.
    await workflowsIdle()
    expect(read(platform, 'Bibliothèque/Normes/Norme.md')).toMatch(/\ncircuit: range\n/)
    expect(asked.filter((each) => each.kind === 'relecture').length).toBe(relectures)
  })

  it('le rappel du lundi : les documents à contrôler, s’il y en a', async () => {
    const platform = memoryPlatform()
    const { pour, answers, i18n } = await start(platform)
    const remind = actionSpec('bibliotheque.rappel-a-controler')!
    const runIt = () => remind.run({ fields: {}, subject: NO_SUBJECT, vars: {}, t: i18n.t.bind(i18n), ui: platform.ui, notifier: platform.notifier })
    expect((await runIt()).lines).toEqual(['Rien à contrôler.'])
    answers.analyse = () => chat({ typePiece: '', emetteur: '', projet: '', confiance: 0.2, raison: '?' })
    answers.rangement = () => chat('illisible')
    await pour('X.txt', 'Un document.')
    expect((await runIt()).lines).toEqual(['1 document(s) à contrôler : X.'])
    expect(platform.notices.at(-1)).toBe('1 document(s) à contrôler : X.')
  })
})
