// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **La recherche dans le glossaire, une étape du circuit** : entre l'ingestion et l'analyse, sans
 * IA, les termes du glossaire que le document emploie (le terme, son sigle ou une autre forme) sont
 * reliés à sa fiche, avec un rétrolien dans la note du terme ; l'analyse reçoit leur définition et
 * garde ces liens ; l'étape se lit sur la fiche, et se relance seule.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem, type PageView } from '../src/core/views'
import { addStarterEntries, bibliothequeModule, libraryEntries, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsIdle, workflowsModule } from '../src/modules/workflows'

const ALL: BlackModule[] = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })

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
  // L'IA simulée : elle relit le texte tel quel ; l'analyse et le rangement rendent ce qu'on leur dit.
  const answers = { analyse: () => chat({}), rangement: () => chat({}) }
  const asked: { kind: string; user: string }[] = []
  const original = platform.http.request.bind(platform.http)
  platform.http.request = async (request) => {
    if (!request.url.endsWith('/chat/completions')) return original(request)
    const messages = (JSON.parse(request.body!) as { messages: { role: string; content: string }[] }).messages
    const all = messages.map((message) => message.content).join('\n')
    const user = messages.at(-1)!.content
    if (all.includes('« typePiece »')) {
      asked.push({ kind: 'analyse', user: all })
      return answers.analyse()
    }
    if (all.includes('« dossier »')) return answers.rangement()
    if (all.includes('Tu relis un texte extrait automatiquement')) return chat(user.split('\n\n').slice(1).join('\n\n') || user)
    if (messages[0]!.content.startsWith('Tu identifies la langue')) return chat('fr')
    return chat({ title: '', issuer: '', reference: '', edition: '', revision: '', certain: false, category: '', tags: [], date: '' })
  }
  const load = (target: string): Promise<PageView> => {
    const [id, param] = target.split('?') as [string, string | undefined]
    return views.pages().find((each) => each.id === id)!.load(param)
  }
  const pour = async (name: string, text: string) => (await pourIntoLibrary([{ name, bytes: bytes(text) }], { module: 'bibliotheque', label: '' }))!
  return { load, pour, answers, asked }
}

const deep = (blocks: readonly HomeBlock[]): HomeBlock[] => blocks.flatMap((block) => (block.kind === 'section' ? [block, ...deep(block.blocks)] : [block]))

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la recherche dans le glossaire, dans le circuit', () => {
  it('après l’ingestion : les termes employés reliés à la fiche (rétrolien dans leur note) ; l’analyse reçoit leur définition, et garde ces liens', async () => {
    const platform = memoryPlatform()
    const { load, pour, answers, asked } = await start(platform)
    await addStarterEntries('glossary', 'fr')
    const terms = await libraryEntries('glossary')
    const cctp = terms.find((term) => term.code === 'CCTP')!
    const exigence = terms.find((term) => term.name === 'Exigence')!
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    answers.analyse = () => chat({ typePiece: '', emetteur: '', projet: '', confiance: 0.9, raison: 'Un CCTP.' })
    answers.rangement = () => chat({ dossier: 'Bibliothèque/Normes', confiance: 0.95, raison: 'Rangé.', alternatives: [] })
    await pour('Station.txt', 'Le CCTP de la station sol liste les exigences.')
    await workflowsIdle()
    const record = 'Bibliothèque/Normes/Station.md'
    const note = read(platform, record)
    expect(note).toMatch(/\nglossaire-termes: 2\n/)
    expect(note).toContain(`[[${cctp.path.replace(/\.md$/, '')}|`)
    expect(note).toContain(`[[${exigence.path.replace(/\.md$/, '')}|`)
    expect(note).toContain('Terme du glossaire employé (« exigences »)')
    // Le rétrolien, dans la note du terme.
    expect(read(platform, cctp.path)).toContain('[[Bibliothèque/Normes/Station|Station]]')
    // L'analyse a reçu les termes et leur définition.
    const analysis = asked.find((each) => each.kind === 'analyse')!.user
    expect(analysis).toContain('Les termes du glossaire que le document emploie')
    expect(analysis).toContain(`- ${cctp.code} — ${cctp.name} : ${cctp.description}`)
    // Sur la fiche : l'étape, faite, avec les termes ; sa ligne au journal du circuit.
    const fiche = await load(`bibliotheque.document?${encodeURIComponent(record)}`)
    const parcours = deep(fiche.blocks).find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.parcours')!
    const lines = parcours.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    const titles = lines.filter((line) => !line.level).map((line) => line.title)
    expect(titles.slice(2, 5)).toEqual(['Ingestion', 'Recherche dans le glossaire', 'Analyse'])
    expect(lines.find((line) => line.title === 'Recherche dans le glossaire')).toMatchObject({ tone: 'success', when: 'Fait', detail: '2 terme(s) relié(s) : CCTP — Cahier des clauses techniques particulières, Exigence' })
    expect(note).toMatch(/Recherche dans le glossaire : 2 terme\(s\) relié\(s\) \(CCTP — Cahier des clauses techniques particulières, Exigence\)/)
  })

  it('relancée seule : un terme ajouté depuis est relié, rien n’est doublé', async () => {
    const platform = memoryPlatform()
    const { load, pour, answers } = await start(platform)
    answers.analyse = () => ({ status: 500, text: 'panne' })
    await pour('Revue.txt', 'La revue de conception préliminaire (PDR) du satellite.')
    await workflowsIdle()
    const record = 'Bibliothèque/Circuit/À classer/Revue.md'
    expect(read(platform, record)).toMatch(/\nglossaire-termes: 0\n/)
    const stepsOf = async (): Promise<ListItem[]> => {
      const fiche = await load(`bibliotheque.document?${encodeURIComponent(record)}`)
      const parcours = deep(fiche.blocks).find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.parcours')!
      return parcours.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    }
    let step = (await stepsOf()).find((line) => line.title === 'Recherche dans le glossaire')!
    expect(step).toMatchObject({ tone: 'neutral', detail: 'Aucun terme du glossaire employé' })
    // Un terme ajouté au glossaire, puis l'étape relancée (sans IA) : il est relié.
    const page = await load('bibliotheque.glossaire')
    platform.forms.push({ name: 'Revue de conception préliminaire', code: 'PDR', category: 'Projet', description: 'La revue qui valide la conception préliminaire.', text: '', aliases: '', favorite: 'false' })
    await page.actions!.find((action) => action.id === 'new')!.run()
    expect(step.tools![0]).toMatchObject({ id: 'relancer-glossaire', label: 'Relancer : Recherche dans le glossaire' })
    await step.tools![0]!.run()
    expect(platform.notices.at(-1)).toBe('« Revue » : 1 terme(s) du glossaire trouvé(s), reliés à sa fiche.')
    expect(read(platform, record)).toMatch(/\nglossaire-termes: 1\n/)
    step = (await stepsOf()).find((line) => line.title === 'Recherche dans le glossaire')!
    expect(step).toMatchObject({ tone: 'success', detail: '1 terme(s) relié(s) : PDR — Revue de conception préliminaire' })
    // Relancée encore : rien n'est doublé.
    await step.tools![0]!.run()
    expect(read(platform, record).match(/Revue de conception préliminaire\|/g)).toHaveLength(1)
  })
})
