// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Le circuit des documents, version C — les liens** : les candidats trouvés sans IA (les
 * entités connues que le texte cite) ; l'analyse qui choisit parmi eux ; les liens dans la
 * fiche et les rétroliens dans les notes citées (qui suivent le document quand il bouge, et
 * partent quand il est supprimé) ; l'entretien du lundi ; le skill livré mis à jour.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type PageView } from '../src/core/views'
import { bibliothequeModule, candidatePath, findCandidates, libraryEntries, pourIntoLibrary, readAnalysisAnswer, withBacklink, withLinkSection, withoutBacklink } from '../src/modules/bibliotheque'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { programmesModule } from '../src/modules/programmes'
import { runDueWorkflows, workflowsIdle, workflowsModule, type Workflow } from '../src/modules/workflows'

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

const CNES = 'Bibliothèque/Entreprises/Centre national d’études spatiales.md'
const MARIE = 'Bibliothèque/Personnes/Marie Durand.md'
const PROJECT = 'Programmes/Spatial/Station sol/Station sol.md'

/** Une entreprise, une personne, une norme (un document de référence), un projet : les entités connues. */
async function entities(harness: Awaited<ReturnType<typeof start>>, platform: MemoryPlatform): Promise<string> {
  await platform.fs.writeText(CNES, '---\nbp-type: bibliotheque-emetteur\nnom: Centre national d’études spatiales\ncode: CNES\n---\n\n')
  await platform.fs.writeText(MARIE, '---\nbp-type: bibliotheque-personne\nnom: Marie Durand\nentreprise: CNES\n---\n\nSes notes à elle.\n')
  await project(harness, platform)
  const norme = (await harness.pour('ECSS-E-ST-10C.txt', 'ECSS-E-ST-10C — Space engineering, system engineering general requirements.', 'Bibliothèque/Normes')).added[0]!
  return norme.record
}

const CCTP = 'Cahier des clauses techniques de la Station sol, pour le Centre national d’Études spatiales.\nContact : Marie Durand. La norme ECSS-E-ST-10C s’applique.'

describe('les liens : fonctions pures', () => {
  const items = [
    { path: 'E/CNES.md', label: 'CNES — Centre national d’études spatiales', kind: 'Entreprise', names: ['CNES', 'Centre national d’études spatiales'] },
    { path: 'P/Marie Durand.md', label: 'Marie Durand', kind: 'Personne', names: ['Marie Durand'] },
    { path: 'D/Norme.md', label: 'ECSS-E-ST-10C', kind: 'Document', names: ['ECSS-E-ST-10C'] },
    { path: 'D/Moi.md', label: 'Moi', kind: 'Document', names: ['Station sol'] },
    { path: 'X/AO.md', label: 'AO', kind: 'Projet', names: ['AO'] }
  ]

  it('les candidats : un nom cité (mot entier, sans accents ni majuscules), dans l’ordre du texte ; ni soi-même, ni un nom trop court', () => {
    const found = findCandidates('La Station sol (AO) : norme ECSS-E-ST-10C ; contact marie durand, du CENTRE NATIONAL D’ETUDES SPATIALES.', items, 'D/Moi.md')
    expect(found.map((each) => [each.path, each.found])).toEqual([
      ['D/Norme.md', 'ECSS-E-ST-10C'],
      ['P/Marie Durand.md', 'Marie Durand'],
      ['E/CNES.md', 'Centre national d’études spatiales']
    ])
    expect(findCandidates('Marie Durandeau, cnesium', items, '')).toEqual([])
  })

  it('le lien rendu par l’IA : par son chemin (avec ou sans .md, entre crochets), ou son nom ; inventé : rien', () => {
    const candidates = [{ path: 'E/CNES.md', label: 'CNES — Centre national' }]
    expect(candidatePath('E/CNES', candidates)).toBe('E/CNES.md')
    expect(candidatePath('[[E/CNES.md]]', candidates)).toBe('E/CNES.md')
    expect(candidatePath('cnes — centre national', candidates)).toBe('E/CNES.md')
    expect(candidatePath('E/Autre.md', candidates)).toBeNull()
  })

  it('la section Liens de la fiche : avant le texte extrait, remplacée, retirée ; les rétroliens : une section réservée, à la fin', () => {
    const body = '\n# Doc\n\n## Notes\n\n<!-- bp:texte:debut — texte extrait du fichier, tenu à jour par Black Projects ; ne pas modifier entre ces marques -->\ntexte\n'
    const once = withLinkSection(body, 'Liens', ['[[E/CNES|CNES]] — l’émetteur'])
    expect(once).toMatch(/## Notes\n\n## Liens\n\n- \[\[E\/CNES\|CNES\]\] — l’émetteur\n\n<!-- bp:texte:debut/)
    expect(withLinkSection(once, 'Liens', ['[[P/Marie|Marie]]'])).not.toContain('CNES')
    expect(withLinkSection(once, 'Liens', [])).not.toContain('## Liens')
    const note = '---\nnom: CNES\n---\n\nMes notes.\n'
    const a = withBacklink(note, 'Liens (Black Projects)', 'D/A.md', '2026-11-17 · [[D/A|A]] — cité')
    expect(a).toBe('---\nnom: CNES\n---\n\nMes notes.\n\n## Liens (Black Projects)\n\n- 2026-11-17 · [[D/A|A]] — cité\n')
    const ab = withBacklink(withBacklink(a, 'Liens (Black Projects)', 'D/B.md', '2026-11-17 · [[D/B|B]] — aussi'), 'Liens (Black Projects)', 'D/A.md', '2026-11-18 · [[D/A|A]] — revu')
    expect(ab).toContain('- 2026-11-18 · [[D/A|A]] — revu\n- 2026-11-17 · [[D/B|B]] — aussi')
    expect(withoutBacklink(withoutBacklink(ab, 'Liens (Black Projects)', 'D/A.md'), 'Liens (Black Projects)', 'D/B.md')).toBe('---\nnom: CNES\n---\n\nMes notes.\n')
  })

  it('la réponse d’analyse : ses liens parmi les candidats seulement', () => {
    const decision = readAnalysisAnswer(
      { typePiece: '', emetteur: '', projet: '', liens: [{ vers: 'E/CNES', pourquoi: 'l’émetteur' }, { vers: 'Z/Inventé.md', pourquoi: '?' }, { vers: 'E/CNES.md', pourquoi: 'doublon' }], confiance: 0.9, raison: 'r' },
      { types: [], issuers: [], candidates: [{ path: 'E/CNES.md', label: 'CNES' }] }
    )
    expect(decision!.links).toEqual([{ path: 'E/CNES.md', why: 'l’émetteur' }])
  })
})

describe('le circuit, version C : les liens', () => {
  it('l’analyse choisit parmi les candidats : les liens dans la fiche, un rétrolien dans chaque note citée — qui suit le document quand il bouge', async () => {
    const platform = memoryPlatform()
    const harness = await start(platform)
    const norme = await entities(harness, platform)
    const { pour, answers, asked, load } = harness
    answers.analyse = () =>
      chat({
        typePiece: 'CCTP',
        emetteur: '',
        projet: PROJECT,
        liens: [
          { vers: CNES, pourquoi: 'le client' },
          { vers: MARIE, pourquoi: 'le contact' },
          { vers: norme, pourquoi: 'la norme qui s’applique' },
          { vers: 'Bibliothèque/Inventé.md', pourquoi: 'inventé' }
        ],
        confiance: 0.9,
        raison: 'Le CCTP de la Station sol.'
      })
    answers.rangement = () => chat({ dossier: '', confiance: 0.2, raison: 'Je ne sais pas.', alternatives: [] })
    await pour('CCTP.txt', CCTP)
    await workflowsIdle()
    // Ce que l'analyse a reçu : les liens possibles, trouvés sans IA.
    const analysis = asked.find((each) => each.kind === 'analyse')!.user
    expect(analysis).toContain('## Les liens possibles')
    expect(analysis).toContain(`- ${PROJECT} — Projet : Spatial › Station sol (« Station sol »)`)
    expect(analysis).toContain(`- ${CNES} — Entreprise : CNES — Centre national d’études spatiales (« Centre national d’études spatiales »)`)
    expect(analysis).toContain(`- ${MARIE} — Personne : Marie Durand (« Marie Durand »)`)
    expect(analysis).toContain(`- ${norme} — Document : ECSS-E-ST-10C`)
    // Rangé dans À contrôler (pas sûr) : les liens écrits avant ont suivi.
    const record = 'Bibliothèque/À contrôler/CCTP.md'
    const note = read(platform, record)
    expect(note).toMatch(/· Analyser un document — projet Station sol, 4 lien\(s\) · confiance 90 %/)
    expect(note).not.toContain('Inventé')
    expect(note).toContain(`## Liens\n\n- [[${CNES.replace('.md', '')}|Centre national d’études spatiales]] — le client\n- [[${MARIE.replace('.md', '')}|Marie Durand]] — le contact\n`)
    for (const cited of [CNES, MARIE, norme, PROJECT]) expect(read(platform, cited)).toMatch(/\n## Liens \(Black Projects\)\n\n- \d{4}-\d{2}-\d{2} · \[\[Bibliothèque\/À contrôler\/CCTP\|CCTP\]\] — /)
    expect(read(platform, MARIE)).toContain('Ses notes à elle.')
    // La fiche du document : sa section Liens.
    const page = await load(`bibliotheque.document?${encodeURIComponent(record)}`)
    const section = deep(page.blocks).find((block) => block.kind === 'section' && block.id?.endsWith('liens'))
    expect(section).toMatchObject({ title: 'Liens (4)' })
  })

  it('pas assez sûre : aucun lien écrit', async () => {
    const platform = memoryPlatform()
    const harness = await start(platform)
    await entities(harness, platform)
    harness.answers.analyse = () => chat({ typePiece: '', emetteur: '', projet: '', liens: [{ vers: CNES, pourquoi: 'le client' }], confiance: 0.4, raison: 'Je doute.' })
    harness.answers.rangement = () => chat({ dossier: '', confiance: 0.2, raison: '—', alternatives: [] })
    await harness.pour('CCTP.txt', CCTP)
    await workflowsIdle()
    expect(read(platform, 'Bibliothèque/À contrôler/CCTP.md')).not.toMatch(/\nliens:/)
    expect(read(platform, CNES)).not.toContain('Liens (Black Projects)')
  })

  it('l’entretien du lundi : un lien vers une note disparue retiré, un rétrolien effacé à la main rétabli ; supprimé, le document retire ses rétroliens', async () => {
    const platform = memoryPlatform()
    const harness = await start(platform)
    await entities(harness, platform)
    harness.answers.analyse = () => chat({ typePiece: '', emetteur: '', projet: '', liens: [{ vers: CNES, pourquoi: 'le client' }, { vers: MARIE, pourquoi: 'le contact' }], confiance: 0.9, raison: 'r' })
    harness.answers.rangement = () => chat({ dossier: '', confiance: 0.2, raison: '—', alternatives: [] })
    await harness.pour('CCTP.txt', CCTP)
    await workflowsIdle()
    const record = 'Bibliothèque/À contrôler/CCTP.md'
    platform.files.delete(MARIE)
    await platform.fs.writeText(CNES, '---\nbp-type: bibliotheque-emetteur\nnom: Centre national d’études spatiales\ncode: CNES\n---\n\n')
    const monday = (harness.workflows() as Workflow[]).find((each) => each.system === 'sys.bibliotheque.rappels-lundi')!
    Object.assign(monday, { enabled: true, created: '2020-01-01T00:00:00.000Z' })
    await runDueWorkflows()
    expect(platform.notices).toContain('Bibliothèque : 1 lien(s) vers des notes disparues retiré(s), 1 rétrolien(s) rétabli(s).')
    const note = read(platform, record)
    expect(note).not.toContain('[[Bibliothèque/Personnes/Marie Durand')
    expect(note).toContain('[[Bibliothèque/Entreprises/Centre national d’études spatiales|Centre national d’études spatiales]] — le client')
    expect(read(platform, CNES)).toContain('[[Bibliothèque/À contrôler/CCTP|CCTP]] — le client')
    // Supprimé : son rétrolien part de la note de l'entreprise.
    await harness.run(await harness.load(`bibliotheque.document?${encodeURIComponent(record)}`), 'delete')
    expect(read(platform, CNES)).not.toContain('Liens (Black Projects)')
  })

  it('le skill « Analyser un document » livré : il reçoit les liens possibles ; celui d’avant, resté tel quel, est mis à jour — modifié, il est gardé', async () => {
    const platform = memoryPlatform()
    await start(platform)
    const skill = (await libraryEntries('skill')).find((entry) => entry.name === 'Analyser un document')!
    expect(skill.context).toContain('candidats')
    expect(skill.text).toContain('4. Ses **liens**')
    for (const module of [...ALL].reverse()) await module.deactivate?.()
    // Celui d'avant (version B), tel quel : remis à jour à l'activation suivante.
    const before = read(platform, skill.path).replace(/\ncontexte:\n(- .*\n)+/, '\ncontexte:\n- fiche\n- texte\n- types-de-piece\n- emetteurs\n- projets\n')
    const oldText = before.replace(/Tu analyses[\s\S]*$/, '') + [
      'Tu analyses un document qui entre dans la bibliothèque. Lis sa fiche et le début de son texte, puis :',
      '1. Son **type de pièce** : un code de la liste des types de pièce (CCTP, CCAP…), sinon vide.',
      '2. Son **émetteur** : une entreprise de la liste (son code), sinon vide.',
      '3. Le **projet** qu’il concerne : le chemin exact d’un projet de la liste (son nom, son client, sa référence apparaissent dans le document), sinon vide.',
      '4. Ta **confiance**, de 0 à 1, et ta **raison** en une phrase.',
      'N’invente rien : ce qui n’est pas dans les listes reste vide.'
    ].join('\n') + '\n'
    await platform.fs.writeText(skill.path, oldText)
    await start(platform)
    let again = (await libraryEntries('skill')).find((entry) => entry.name === 'Analyser un document')!
    expect(again.context).toContain('candidats')
    expect(again.text).toContain('4. Ses **liens**')
    for (const module of [...ALL].reverse()) await module.deactivate?.()
    // Modifié par l'utilisateur : gardé.
    await platform.fs.writeText(skill.path, read(platform, skill.path).replace(/Tu analyses[\s\S]*$/, 'Ma propre méthode.\n'))
    await start(platform)
    again = (await libraryEntries('skill')).find((entry) => entry.name === 'Analyser un document')!
    expect(again.text).toBe('Ma propre méthode.')
  })
})
