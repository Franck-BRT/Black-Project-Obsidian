// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Le document en cours de traitement dans le circuit** : dit clairement (en tête de sa fiche,
 * l'étape en cours dans son parcours, une pastille dans les listes) ; pour lui, « Arrêter le
 * circuit » à la place de « Continuer le circuit » — il s'arrête avant son étape suivante, la
 * réponse de l'IA en cours est écartée ; la relance à l'ouverture le laisse ; « Continuer le
 * circuit » le reprend.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type ListItem, type PageView } from '../src/core/views'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { runOpeningWorkflows, workflowsIdle, workflowsModule } from '../src/modules/workflows'

const ALL: BlackModule[] = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ia: SERVEUR, bibliotheque: { circuit: true, explorateur: false } }
  const views = new ViewsRegistry()
  for (const module of ALL) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: () => {}
    }
    await module.activate(context)
  }
  // L'IA simulée : l'analyse attend qu'on la libère (le temps de regarder la fiche, et d'arrêter).
  let release: () => void = () => {}
  const held = { on: true }
  const asked: string[] = []
  const original = platform.http.request.bind(platform.http)
  platform.http.request = async (request) => {
    if (!request.url.endsWith('/chat/completions')) return original(request)
    const messages = (JSON.parse(request.body!) as { messages: { role: string; content: string }[] }).messages
    const all = messages.map((message) => message.content).join('\n')
    const user = messages.at(-1)!.content
    if (all.includes('« typePiece »')) {
      asked.push('analyse')
      if (held.on) await new Promise<void>((resolve) => (release = resolve))
      return chat({ typePiece: 'CCTP', emetteur: '', projet: '', confiance: 0.95, raison: 'Un CCTP.' })
    }
    if (all.includes('« dossier »')) {
      asked.push('rangement')
      return chat({ dossier: 'Bibliothèque/Normes', confiance: 0.95, raison: 'Rangé.', alternatives: [] })
    }
    if (all.includes('Tu relis un texte extrait automatiquement')) return chat(user.split('\n\n').slice(1).join('\n\n') || user)
    if (messages[0]!.content.startsWith('Tu identifies la langue')) return chat('fr')
    return chat({ title: '', issuer: '', reference: '', edition: '', revision: '', certain: false, category: '', tags: [], date: '' })
  }
  const load = (target: string): Promise<PageView> => {
    const [id, param] = target.split('?') as [string, string | undefined]
    return views.pages().find((each) => each.id === id)!.load(param)
  }
  return { load, asked, held, release: () => release() }
}

const deep = (blocks: readonly HomeBlock[]): HomeBlock[] => blocks.flatMap((block) => (block.kind === 'section' ? [block, ...deep(block.blocks)] : [block]))
const stepsOf = (view: PageView): ListItem[] =>
  deep(view.blocks)
    .filter((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.parcours')
    .flatMap((section) => section.blocks.flatMap((block) => (block.kind === 'list' ? block.items : [])))
const cardsOf = (view: PageView): Card[] => deep(view.blocks).flatMap((block) => (block.kind === 'cards' ? block.cards : []))

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('le document en cours de traitement dans le circuit', () => {
  it('dit en tête de sa fiche, dans son parcours et dans les listes ; « Arrêter le circuit » l’arrête, la relance à l’ouverture le laisse, « Continuer » le reprend', async () => {
    const platform = memoryPlatform()
    const { load, asked, held, release } = await start(platform)
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    const poured = pourIntoLibrary([{ name: 'Station.txt', bytes: bytes('Le CCTP de la station sol.') }], { module: 'bibliotheque', label: '' })
    for (let i = 0; i < 400 && !asked.includes('analyse'); i++) await tick()
    for (let i = 0; i < 5; i++) await tick()
    const record = 'Bibliothèque/Circuit/À classer/Station.md'
    // La fiche : en tête, ce qu'il fait ; « Arrêter le circuit ».
    let fiche = await load(`bibliotheque.document?${encodeURIComponent(record)}`)
    const banner = fiche.blocks[0] as Extract<HomeBlock, { kind: 'message' }>
    expect(banner).toMatchObject({ kind: 'message', tone: 'info', text: 'En cours de traitement dans le circuit : Analyse — L’IA l’analyse…' })
    expect(banner.actions!.map((action) => [action.id, action.label])).toEqual([['circuit-stop', 'Arrêter le circuit']])
    // Son parcours : l'analyse en cours (bleu, qui tourne), « Arrêter le circuit » sur sa ligne ; pas de « Continuer », pas de relance.
    let lines = stepsOf(fiche)
    expect(lines.find((line) => line.title === 'Analyse')).toMatchObject({ tone: 'info', icon: 'spinner', when: 'En cours…', detail: 'L’IA l’analyse…' })
    expect(lines.find((line) => line.title === 'Analyse')!.actions!.map((action) => action.id)).toEqual(['circuit-stop'])
    expect(lines.flatMap((line) => line.actions ?? []).some((action) => action.id === 'circuit-continue')).toBe(false)
    expect(lines.some((line) => line.tools?.length)).toBe(false)
    // Dans la bibliothèque « Circuit » : sa carte le dit.
    const card = cardsOf(await load(`bibliotheque.documents?${encodeURIComponent('circuit:À classer')}`)).find((each) => each.id === record)
    expect(card).toMatchObject({ icon: 'spinner' })
    expect(card!.badges![0]).toEqual({ label: 'En cours de traitement', tone: 'info' })
    // Arrêter : la réponse de l'IA est écartée, le rangement ne se fait pas.
    await banner.actions![0]!.run()
    expect(platform.notices.at(-1)).toBe('« Station » : le circuit s’arrête (avant son étape suivante).')
    release()
    await poured
    await workflowsIdle()
    for (let i = 0; i < 5; i++) await tick()
    expect(asked).toEqual(['analyse'])
    const note = read(platform, record)
    expect(note).toMatch(/\ncircuit: ingere\n/)
    expect(note).toMatch(/\ncircuit-arrete: true\n/)
    expect(note).not.toMatch(/\ncategorie: CCTP\n/)
    expect(note).toMatch(/· Circuit arrêté à votre demande\n/)
    // Arrêté : dit en tête et sur sa ligne, avec « Continuer le circuit ».
    fiche = await load(`bibliotheque.document?${encodeURIComponent(record)}`)
    expect(fiche.blocks[0]).toMatchObject({ kind: 'message', tone: 'warning', text: 'Circuit arrêté à votre demande. « Continuer le circuit » le reprend là où il en était.', actions: [{ id: 'circuit-continue' }] })
    lines = stepsOf(fiche)
    expect(lines.find((line) => line.title === 'Analyse')).toMatchObject({ tone: 'warning', detail: 'Arrêté à votre demande', actions: [{ id: 'circuit-continue' }] })
    // La relance à l'ouverture le laisse.
    await runOpeningWorkflows()
    await workflowsIdle()
    expect(asked).toEqual(['analyse'])
    // « Continuer le circuit » : il repart, et va au bout.
    held.on = false
    await (fiche.blocks[0] as Extract<HomeBlock, { kind: 'message' }>).actions![0]!.run()
    await workflowsIdle()
    expect(asked).toEqual(['analyse', 'analyse', 'rangement'])
    const filed = read(platform, 'Bibliothèque/Normes/Station.md')
    expect(filed).toMatch(/\ncircuit: range\n/)
    expect(filed).not.toMatch(/circuit-arrete/)
  })
})
