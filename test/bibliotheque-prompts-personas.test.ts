// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/// <reference types="node" />

/**
 * Les bibliothèques de **prompts** et de **personas**, séparées, dans le module
 * Bibliothèque : une note par entrée (son dossier, son en-tête), la page d'accueil de la
 * bibliothèque, leurs pages et fiches, les exemples ajoutés à la demande ; et ce qu'elles
 * apportent à l'IA — interroger le dossier avec un prompt et un persona, « Demander à
 * l'IA » par leur nom, relire les exigences dans le rôle d'un persona.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'
import { bibliothequeModule, findLibraryEntry, libraryEntries, pourIntoLibrary } from '../src/modules/bibliotheque'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))
const MODULES = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const chat = (content: unknown) => ({
  status: 200,
  text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] })
})

async function start(platform: MemoryPlatform, options: { ia?: Record<string, unknown>; tender?: boolean } = {}) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false }, ia: options.ia ?? {} }
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
      showPage: (id: string) => void shown.push(id)
    }
    await (module as BlackModule).activate(context)
  }
  const run = (id: string) => commands.get(id)!.run()
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  let analysis: Awaited<ReturnType<typeof createAnalysis>> | null = null
  if (options.tender) {
    const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => '2026-11-05' }
    analysis = await createAnalysis(services, 'Station sol', { position: 'emetteur', buyer: 'CNES', reference: '' })
    const report = await importFiles(services, analysis, [
      { name: 'CCTP.docx', bytes: new Uint8Array(readFileSync(folder + 'CCTP.docx')) },
      { name: 'RC.html', bytes: new Uint8Array(readFileSync(folder + 'RC.html')) }
    ])
    platform.active = report.imported.find((piece) => piece.note.includes('CCTP'))!.note
    await run('ao-extraire-exigences')
    platform.active = analysis.note
  }
  // Les exemples, comme depuis les pages : « Ajouter les exemples ».
  const addStarters = async (kind: 'prompt' | 'persona') => {
    const view = await page(`bibliotheque.${kind}s`).load()
    await view.actions!.find((action) => action.id === 'starters')!.run()
  }
  return { settings, views, shown, run, page, addStarters, analysis }
}

// Les cartes, sections repliables comprises (les pages de la bibliothèque les regroupent).
const cardsIn = (blocks: readonly HomeBlock[]): Card[] => blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : block.kind === 'section' ? cardsIn(block.blocks) : []))
const cardsOf = (view: PageView): Card[] => cardsIn(view.blocks)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('les bibliothèques de prompts et de personas', () => {
  it('l’accueil de la bibliothèque mène aux trois : documents, prompts, personas', async () => {
    const platform = memoryPlatform()
    const { page, views, shown } = await start(platform)
    await pourIntoLibrary([{ name: 'Plan.pdf', bytes: new TextEncoder().encode('p') }], { module: 'bibliotheque', label: 'Versé à la main' })
    const hub = await page('bibliotheque.accueil').load()
    const stats = hub.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Documents=1', 'Prompts=0', 'Personas=0', 'Skills=0', 'Émetteurs=0'])
    const cards = cardsOf(hub)
    expect(cards.map((card) => card.title)).toEqual(['Documents', 'Prompts', 'Personas', 'Skills', 'Émetteurs'])
    await cards[2]!.open!.run()
    expect(shown.at(-1)).toBe('bibliotheque.personas')
    expect(views.allTiles().map((tile) => tile.id)).toEqual(expect.arrayContaining(['bibliotheque.prompts', 'bibliotheque.personas']))
    // Le dossier des prompts et des personas n'est pas parcouru comme des documents.
    await (await page('bibliotheque.prompts').load()).actions!.find((action) => action.id === 'starters')!.run()
    expect(cardsOf(await page('bibliotheque.documents').load())).toHaveLength(1)
  })

  it('vides : un message, « Nouveau » et « Ajouter les exemples » ; les exemples écrits une seule fois', async () => {
    const platform = memoryPlatform()
    const { page, addStarters } = await start(platform)
    const empty = await page('bibliotheque.prompts').load()
    expect(empty.breadcrumb?.items.map((item) => item.label)).toEqual(['Bibliothèque', 'Prompts'])
    expect(empty.blocks[0]).toMatchObject({ kind: 'message', tone: 'info' })
    expect(empty.actions?.map((action) => action.id)).toEqual(['new', 'starters', 'new-directory', 'new-shelf'])
    await addStarters('prompt')
    expect(platform.notices.at(-1)).toMatch(/^7 prompt\(s\) ajouté\(s\) : Pénalités, Critères d’attribution/)
    await addStarters('prompt')
    expect(platform.notices.at(-1)).toBe('Les exemples sont déjà tous là.')
    await addStarters('persona')
    expect(read(platform, 'Bibliothèque/Personas/Juriste marchés publics.md')).toMatch(/^---\nbp-type: bibliotheque-persona\nnom: Juriste marchés publics\ncategorie: Juridique\n/)
    expect((await libraryEntries('persona')).map((each) => each.name)).toContain('Contrôleur technique')
  })

  it('la page : favoris d’abord, filtres par catégorie ; la fiche : son texte, Modifier (renommée), Favori, Retirer', async () => {
    const platform = memoryPlatform()
    const { page, addStarters, shown } = await start(platform)
    await addStarters('prompt')
    let view = await page('bibliotheque.prompts').load()
    const risks = cardsOf(view).find((card) => card.title === 'Risques du marché')!
    await risks.actions!.find((action) => action.id === 'favorite')!.run()
    view = await page('bibliotheque.prompts').load()
    expect(cardsOf(view)[0]).toMatchObject({ title: 'Risques du marché', badges: [{ label: 'Favori' }, { label: 'Analyse' }], tags: ['favoris', 'categorie-analyse'] })
    expect(view.filters?.map((filter) => filter.id)).toEqual(['favoris', 'categorie-analyse', 'categorie-consultation', 'categorie-contrat', 'categorie-planning'])
    const fiche = await page('bibliotheque.prompt').load(encodeURIComponent('Bibliothèque/Prompts/Pénalités.md'))
    expect(fiche.title).toBe('Pénalités')
    expect(fiche.blocks.find((block) => block.kind === 'text' && block.title === 'La question')).toMatchObject({ paragraphs: [expect.stringMatching(/^Quelles pénalités le dossier prévoit-il/)] })
    // Modifier : le nom change, la note est renommée, la fiche suit.
    platform.forms.push({ name: 'Pénalités et plafonds', category: 'Contrat', description: '', text: 'Quelles pénalités, et leur plafond ?', favorite: 'true' })
    await fiche.actions!.find((action) => action.id === 'edit')!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.prompt?${encodeURIComponent('Bibliothèque/Prompts/Pénalités et plafonds.md')}`)
    expect(await findLibraryEntry('prompt', 'penalites et plafonds')).toMatchObject({ favorite: true, text: 'Quelles pénalités, et leur plafond ?' })
    // Retirer (confirmé) : mis de côté, rien d'effacé.
    const again = await page('bibliotheque.prompt').load(encodeURIComponent('Bibliothèque/Prompts/Pénalités et plafonds.md'))
    await again.actions!.find((action) => action.id === 'aside')!.run()
    expect(platform.files.has('Bibliothèque/Prompts/_retirés/Pénalités et plafonds.md')).toBe(true)
    expect(shown.at(-1)).toBe('bibliotheque.prompts?principale%3A')
    expect((await libraryEntries('prompt')).map((each) => each.name)).not.toContain('Pénalités et plafonds')
  })

  it('nouveau persona, par la commande : sa fenêtre, sa note, sa fiche', async () => {
    const platform = memoryPlatform()
    const { run, shown } = await start(platform)
    platform.forms.push({ name: 'Acheteur public', category: 'Juridique', description: 'Voir le dossier côté acheteur', text: 'Tu es acheteur public.', favorite: 'false' })
    await run('bibliotheque-nouveau-persona')
    expect(read(platform, 'Bibliothèque/Personas/Acheteur public.md')).toBe('---\nbp-type: bibliotheque-persona\nnom: Acheteur public\ncategorie: Juridique\ndescription: Voir le dossier côté acheteur\n---\n\nTu es acheteur public.\n')
    expect(shown.at(-1)).toBe(`bibliotheque.persona?${encodeURIComponent('Bibliothèque/Personas/Acheteur public.md')}`)
  })
})

describe('les prompts et les personas au service de l’IA', () => {
  it('interroger le dossier : un prompt choisi, un persona ; l’IA répond dans son rôle, la note le dit', async () => {
    const platform = memoryPlatform()
    const { run, addStarters } = await start(platform, { ia: SERVEUR, tender: true })
    await addStarters('prompt')
    await addStarters('persona')
    platform.choices.push('Bibliothèque/Prompts/Critères d’attribution.md')
    platform.forms.push({ question: 'Quels sont les critères d’attribution et leur pondération ?', mode: 'search', persona: 'Bibliothèque/Personas/Juriste marchés publics.md' })
    platform.httpAnswers.push(chat('Valeur technique 60 % et prix 40 % [1].'))
    const before = platform.requests.length
    await run('ao-interroger')
    // Le prompt choisi : sa question en tête du formulaire ; « Écrire ma question » d'abord dans la liste.
    expect(platform.offered.at(-1)![0]).toMatchObject({ value: '', label: 'Écrire ma question' })
    expect(platform.asked.at(-1)!.fields[0]).toMatchObject({ key: 'question', value: expect.stringMatching(/^Quels sont les critères d’attribution/) })
    const sent = JSON.parse(platform.requests[before]!.body!) as { messages: { role: string; content: string }[] }
    expect(sent.messages[0]!.role).toBe('system')
    expect(sent.messages[0]!.content).toMatch(/^Tu réponds en tant que « Juriste marchés publics »\. Garde ce rôle pour toute la réponse\.\n\nTu es juriste spécialisé dans la commande publique/)
    const note = await platform.fs.readText(platform.opened.at(-1)!)
    expect(note).toContain('persona: Juriste marchés publics')
    expect(note).toContain('en tant que « Juriste marchés publics »')
  })

  it('« Demander à l’IA » (workflow) : un prompt et un persona nommés ; un nom inconnu, un échec qui le dit', async () => {
    const platform = memoryPlatform()
    const { settings, run, addStarters } = await start(platform, { ia: SERVEUR })
    await addStarters('prompt')
    await addStarters('persona')
    const workflows = settings.workflows!.workflows as Workflow[]
    workflows.push({
      id: 'w-ask',
      name: 'Risques',
      enabled: true,
      mode: 'auto',
      trigger: { kind: 'manuel' },
      conditions: [],
      actions: [{ kind: 'ia.demander', fields: { prompt: 'risques du marche', persona: 'Ingénieur d’affaires', contexte: 'Le dossier : une station sol.' } }],
      created: '2026-01-01T00:00:00.000Z'
    })
    platform.httpAnswers.push(chat('Trois risques.'))
    platform.choices.push('w-ask')
    const before = platform.requests.length
    await run('workflows-executer')
    const sent = JSON.parse(platform.requests[before]!.body!) as { messages: { role: string; content: string }[] }
    expect(sent.messages[0]!.content).toMatch(/^Tu réponds en tant que « Ingénieur d’affaires »/)
    expect(sent.messages[1]!.content).toMatch(/^Relève les principaux risques de ce marché[\s\S]*\n\nLe dossier : une station sol\.$/)
    // Un persona qui n'existe pas : le workflow échoue et le dit.
    workflows.find((each) => each.id === 'w-ask')!.actions[0]!.fields.persona = 'Astronaute'
    platform.choices.push('w-ask')
    await run('workflows-executer')
    expect(platform.notices.at(-1)).toMatch(/Aucun persona « Astronaute » dans la bibliothèque/)
  })

  it('relire les exigences du dossier : un persona choisi une fois pour la série ; « Sans persona » : comme avant', async () => {
    const platform = memoryPlatform()
    const { run, addStarters } = await start(platform, { ia: SERVEUR, tender: true })
    await addStarters('persona')
    const review = chat({ assessment: 'Ambigu.', findings: [], proposals: [{ axis: 'unambiguous', action: 'Retirer « le cas échéant ».', rewrite: 'Le système doit être disponible 99,5 % du temps.' }] })
    platform.httpAnswers.push(review)
    platform.choices.push('Bibliothèque/Personas/Contrôleur technique.md', '0')
    const before = platform.requests.length
    await run('ao-relire-exigences-ia')
    expect(platform.offered.find((choices) => choices[0]?.label === 'Sans persona')).toBeTruthy()
    const sent = JSON.parse(platform.requests[before]!.body!) as { messages: { role: string; content: string }[] }
    expect(sent.messages[0]!.content).toMatch(/^Tu réponds en tant que « Contrôleur technique »/)
    // Sans persona : le message système est celui d'avant.
    platform.httpAnswers.push(review)
    platform.choices.push('', '0')
    const second = platform.requests.length
    await run('ao-relire-exigences-ia')
    expect(JSON.parse(platform.requests[second]!.body!).messages[0].content).not.toMatch(/Tu réponds en tant que/)
  })
})
