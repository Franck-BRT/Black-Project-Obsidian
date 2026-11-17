// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Le circuit des documents, version A** (`docs/architecture/circuit-des-documents.md`) :
 * un skill exécutable (ce qu'il reçoit, ce qu'il rend, son seuil), l'étape « Exécuter un
 * skill » (l'IA décide, l'application exécute), et **À contrôler** — ce que l'IA n'a pas su
 * ranger avec assez de confiance : accepté, rangé ailleurs, ou écarté.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { addStarterEntries, bibliothequeModule, libraryEntries, pourIntoLibrary, readFilingAnswer, readThreshold } from '../src/modules/bibliotheque'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { programmesModule } from '../src/modules/programmes'
import { actionSpec, NO_SUBJECT, workflowsModule } from '../src/modules/workflows'

const ALL: BlackModule[] = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule, programmesModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })
const SKILL_SYSTEM = 'Tu suis la procédure du skill'

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  // La version A : l'étape « Exécuter un skill » seule, le circuit (version B) désactivé.
  const settings: Record<string, Record<string, unknown>> = { ia: SERVEUR, bibliotheque: { circuit: false } }
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
  // L'IA simulée : au skill, la réponse qu'on lui donne (et ce qu'il a reçu est gardé) ; au reste, rien de sûr.
  const asked: { system: string; user: string }[] = []
  let answer: () => { status: number; text: string } = () => chat({})
  const original = platform.http.request.bind(platform.http)
  platform.http.request = async (request) => {
    if (!request.url.endsWith('/chat/completions')) return original(request)
    const messages = (JSON.parse(request.body!) as { messages: { role: string; content: string }[] }).messages
    // Le skill : sa procédure (les consignes de l'étape) est dans la demande.
    if (messages.some((message) => message.content.includes(SKILL_SYSTEM) || message.content.includes('Procédure : range le document.'))) {
      asked.push({ system: messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n'), user: messages.at(-1)!.content })
      return answer()
    }
    if (messages[0]!.content.startsWith('Tu identifies la langue')) return chat('fr')
    return chat({ title: '', issuer: '', reference: '', edition: '', revision: '', certain: false, category: '', tags: [], date: '' })
  }
  const load = (target: string): Promise<PageView> => {
    const [id, param] = target.split('?') as [string, string | undefined]
    return views.pages().find((each) => each.id === id)!.load(param)
  }
  const pour = async (name: string, text: string, folder?: string) => (await pourIntoLibrary([{ name, bytes: bytes(text) }], { module: 'bibliotheque', label: '' }, folder ? { folder } : {}))!.added[0]!
  /** Exécuter l'étape « Exécuter un skill » sur une fiche. */
  const runSkill = async (record: string, skill = 'Ranger un document', seuil = '') => {
    const spec = actionSpec('ia.executer-skill')!
    return spec.run({ fields: { fiche: record, skill, seuil }, subject: NO_SUBJECT, vars: {}, t: i18n.t.bind(i18n), ui: platform.ui, notifier: platform.notifier, guidance: 'Procédure : range le document.' })
  }
  const reply = (content: unknown) => void (answer = () => chat(content))
  const fail = () => void (answer = () => ({ status: 500, text: 'panne' }))
  return { load, pour, runSkill, reply, fail, asked, shown, settings }
}

const deep = (blocks: readonly HomeBlock[]): HomeBlock[] => blocks.flatMap((block) => (block.kind === 'section' ? [block, ...deep(block.blocks)] : [block]))
const cards = (view: PageView): Card[] => deep(view.blocks).flatMap((block) => (block.kind === 'cards' ? block.cards : []))

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('lire la décision de l’IA', () => {
  it('un dossier de la liste (à la casse près), sa confiance (0..1 ou en %), ses alternatives de la liste ; inventé : confiance 0 ; illisible : rien', () => {
    const allowed = ['Bibliothèque', 'Bibliothèque/Normes', 'Bibliothèque/Références']
    expect(readFilingAnswer({ dossier: 'bibliothèque/normes', confiance: 0.92, raison: 'Une norme.', alternatives: ['Bibliothèque/Références', 'Ailleurs', 'Bibliothèque/Normes'] }, allowed)).toEqual({
      folder: 'Bibliothèque/Normes',
      confidence: 0.92,
      reason: 'Une norme.',
      alternatives: ['Bibliothèque/Références']
    })
    expect(readFilingAnswer({ dossier: 'Bibliothèque', confiance: 85, raison: 'x', alternatives: [] }, allowed)?.confidence).toBe(0.85)
    expect(readFilingAnswer({ dossier: 'Bibliothèque/Inventé', confiance: 0.99, raison: 'Sûr.', alternatives: ['Bibliothèque'] }, allowed)).toEqual({ folder: '', confidence: 0, reason: 'Sûr.', alternatives: ['Bibliothèque'] })
    expect(readFilingAnswer('pas un objet', allowed)).toBeNull()
    expect(readFilingAnswer({}, allowed)).toBeNull()
  })

  it('un seuil écrit à la main : « 0,7 », « 0.8 », « 75 % » ; vide ou hors de 0..1 : rien', () => {
    expect(readThreshold('0,7')).toBe(0.7)
    expect(readThreshold('0.8')).toBe(0.8)
    expect(readThreshold('75 %')).toBe(0.75)
    expect(readThreshold('')).toBeNull()
    expect(readThreshold('150')).toBeNull()
    expect(readThreshold('beaucoup')).toBeNull()
  })
})

describe('un skill exécutable', () => {
  it('ce qu’il reçoit, ce qu’il rend, son seuil : dans sa note, sur sa page, et gardés quand on le modifie', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    await addStarterEntries('skill', 'fr')
    const skill = (await libraryEntries('skill')).find((entry) => entry.name === 'Ranger un document')!
    expect(skill).toMatchObject({ context: ['fiche', 'texte', 'dossiers', 'projets', 'repertoires-attendus', 'regles-de-rangement'], output: 'rangement', threshold: 0.7 })
    const page = await load(`bibliotheque.skill?${encodeURIComponent(skill.path)}`)
    const executable = page.blocks.find((block) => block.kind === 'text' && block.title === 'Exécutable')
    expect(executable?.kind === 'text' && executable.paragraphs).toEqual([
      'Il reçoit : Sa fiche, Son texte, Les dossiers où ranger, Les projets en cours, Les répertoires attendus des projets, Les règles de rangement.',
      'Il rend : Une décision de rangement (un dossier, une confiance, une raison).',
      'Seuil de confiance : 70 % — en dessous, le document va dans « À contrôler ».'
    ])
    // Modifié (sa fenêtre) : le texte comme le reste ; seuil changé, un contexte en moins.
    platform.forms.push({ name: 'Ranger un document', category: 'Circuit', description: '', text: 'Range.', favorite: 'false', 'contexte:fiche': 'true', 'contexte:texte': 'false', 'contexte:dossiers': 'true', 'contexte:regles-de-rangement': 'true', sortie: 'rangement', seuil: '80 %' })
    await page.actions!.find((action) => action.id === 'edit')!.run()
    const form = platform.asked.at(-1)!
    expect(form.fields.filter((field) => field.key.startsWith('contexte:')).map((field) => field.label)).toEqual(['Sa fiche', 'Son texte', 'Les types de pièce', 'Les entreprises connues', 'Les liens possibles', 'Les dossiers où ranger', 'Les règles de rangement', 'Les projets en cours', 'Les répertoires attendus des projets'])
    expect(form.fields.find((field) => field.key === 'sortie')).toMatchObject({ kind: 'choice', value: 'rangement' })
    expect(form.fields.find((field) => field.key === 'seuil')).toMatchObject({ value: '0,7' })
    expect((await libraryEntries('skill')).find((entry) => entry.name === 'Ranger un document')).toMatchObject({ context: ['fiche', 'dossiers', 'regles-de-rangement'], output: 'rangement', threshold: 0.8, text: 'Range.' })
  })
})

describe('l’étape « Exécuter un skill » : l’IA décide, l’application exécute', () => {
  it('sûre : rangé dans le dossier choisi, l’état et l’historique sur la fiche ; ce que le skill a reçu : sa fiche, son texte, les dossiers (pas À contrôler), les règles', async () => {
    const platform = memoryPlatform()
    const { pour, runSkill, reply, asked } = await start(platform)
    await addStarterEntries('skill', 'fr')
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    await platform.fs.ensureFolder('Bibliothèque/Circuit/À contrôler')
    platform.files.set('Bibliothèque/Règles de rangement.md', bytes('# Règles\n\nLes normes vont dans Normes.\n'))
    const doc = await pour('ECSS-E-ST-10C.txt', 'ECSS-E-ST-10C — Space engineering, system engineering general requirements.')
    reply({ dossier: 'Bibliothèque/Normes', confiance: 0.93, raison: 'Une norme ECSS.', alternatives: ['Bibliothèque'] })
    const outcome = await runSkill(doc.record)
    expect(outcome.results).toMatchObject({ decision: 'range', confiance: '0.93', fiche: 'Bibliothèque/Normes/ECSS-E-ST-10C.md' })
    expect(outcome.lines[0]).toBe('« ECSS-E-ST-10C » rangé dans Normes (confiance 93 %).')
    const record = read(platform, 'Bibliothèque/Normes/ECSS-E-ST-10C.md')
    expect(record).toMatch(/\ncircuit: range\ncircuit-confiance: 0\.93\n/)
    expect(record).toMatch(/\n## Circuit\n\n- \d{4}-\d{2}-\d{2} \d{2}:\d{2} · Ranger un document — rangé dans Normes \(confiance 93 %\)\n/)
    // Ce que l'IA a reçu.
    const sent = asked.at(-1)!
    expect(sent.system).toContain('Procédure : range le document.')
    expect(sent.user).toContain('Le document : « ECSS-E-ST-10C ».')
    expect(sent.user).toContain('## Sa fiche\n\n- Titre : ECSS-E-ST-10C\n- Fichier : ECSS-E-ST-10C.txt\n- Rangé aujourd’hui : Documents')
    expect(sent.user).toContain('## Son texte\n\nECSS-E-ST-10C — Space engineering')
    expect(sent.user).toContain('- Bibliothèque/Normes — Documents › Normes')
    expect(sent.user).not.toContain('À contrôler')
    expect(sent.user).toContain('## Les règles de rangement\n\n# Règles\n\nLes normes vont dans Normes.')
  })

  it('pas assez sûre : dans À contrôler, avec la raison, la proposition, les alternatives ; la page le montre ; « Accepter » le range', async () => {
    const platform = memoryPlatform()
    const { load, pour, runSkill, reply, shown } = await start(platform)
    await addStarterEntries('skill', 'fr')
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    await platform.fs.ensureFolder('Bibliothèque/Offres')
    const doc = await pour('Note.txt', 'Une note sur la station.')
    reply({ dossier: 'Bibliothèque/Offres', confiance: 0.55, raison: 'Parle d’une offre, sans certitude.', alternatives: ['Bibliothèque/Normes'] })
    const outcome = await runSkill(doc.record)
    expect(outcome.results).toMatchObject({ decision: 'a-controler', fiche: 'Bibliothèque/Circuit/À contrôler/Note.md' })
    expect(outcome.lines).toEqual(['« Note » : pas assez sûr (confiance 55 %, seuil 70 %) — à contrôler.', 'Seuil : 70 %.'])
    expect(read(platform, 'Bibliothèque/Circuit/À contrôler/Note.md')).toMatch(
      /\ncircuit: a-controler\ncircuit-raison: "Parle d’une offre, sans certitude\."\ncircuit-proposition: Bibliothèque\/Offres\ncircuit-confiance: 0\.55\ncircuit-alternatives:\n- Bibliothèque\/Normes\n/
    )
    // La page des documents le signale ; À contrôler n'y est pas une carte de répertoire.
    const library = await load('bibliotheque.documents')
    expect(library.blocks[0]).toMatchObject({ kind: 'message', tone: 'warning', text: '1 document(s) à contrôler : l’IA n’a pas su les ranger avec assez de confiance.' })
    expect(cards(library).map((card) => card.title)).not.toContain('À contrôler')
    // La page À contrôler.
    const control = await load('bibliotheque.a-controler')
    const card = cards(control)[0]!
    expect(card).toMatchObject({ title: 'Note', subtitle: 'Proposé : Offres (55 %)', text: 'Parle d’une offre, sans certitude.', badges: [{ label: 'Confiance 55 %', tone: 'warning' }] })
    expect(card.actions!.map((action) => action.id)).toEqual(['control-accept', 'control-elsewhere', 'control-discard', 'circuit-continue'])
    // Sur sa fiche aussi.
    const fiche = await load(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Circuit/À contrôler/Note.md')}`)
    expect(fiche.blocks[0]).toMatchObject({ kind: 'message', tone: 'warning', text: 'À contrôler — Proposé : Offres (55 %) — Parle d’une offre, sans certitude.' })
    await (fiche.blocks[0]!.kind === 'message' ? fiche.blocks[0]!.actions![0]!.run() : null)
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent('Bibliothèque/Offres/Note.md')}`)
    const filed = read(platform, 'Bibliothèque/Offres/Note.md')
    expect(filed).toMatch(/\ncircuit: range\n/)
    expect(filed).not.toContain('circuit-raison')
    expect(filed).toMatch(/· Contrôlé — proposition acceptée : rangé dans Offres\n/)
    expect(platform.notices.at(-1)).toBe('« Note » rangé dans Offres.')
    expect(cards(await load('bibliotheque.a-controler'))).toEqual([])
  })

  it('illisible, ou un dossier inventé : à contrôler, confiance 0 ; « Choisir ailleurs » (les propositions de l’IA d’abord) ; « Écarter » le met de côté', async () => {
    const platform = memoryPlatform()
    const { load, pour, runSkill, reply } = await start(platform)
    await addStarterEntries('skill', 'fr')
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    const a = await pour('A.txt', 'Premier document.')
    reply('Je pense que c’est une norme.')
    expect((await runSkill(a.record)).results).toMatchObject({ decision: 'a-controler', confiance: '0' })
    expect(read(platform, 'Bibliothèque/Circuit/À contrôler/A.md')).toMatch(/\ncircuit-raison: "?La réponse de l’IA était illisible\."?\ncircuit-confiance: 0\n/)
    const b = await pour('B.txt', 'Second document.')
    reply({ dossier: 'Bibliothèque/Inventé', confiance: 0.99, raison: 'Évident.', alternatives: ['Bibliothèque/Normes'] })
    await runSkill(b.record)
    expect(read(platform, 'Bibliothèque/Circuit/À contrôler/B.md')).toMatch(/\ncircuit-raison: "?Aucun des dossiers proposés — Évident\."?\ncircuit-confiance: 0\ncircuit-alternatives:\n- Bibliothèque\/Normes\n/)
    const control = cards(await load('bibliotheque.a-controler'))
    expect(control.map((card) => [card.title, card.subtitle])).toEqual([
      ['A', 'Aucune proposition'],
      ['B', 'Aucune proposition']
    ])
    expect(control[0]!.actions!.map((action) => action.id)).toEqual(['control-elsewhere', 'control-discard', 'circuit-continue'])
    // Choisir ailleurs : l'alternative de l'IA d'abord.
    platform.choices.push('Bibliothèque/Normes')
    await control[1]!.actions!.find((action) => action.id === 'control-elsewhere')!.run()
    expect(platform.offered.at(-1)![0]).toMatchObject({ value: 'Bibliothèque/Normes', description: 'Proposé par l’IA' })
    expect(read(platform, 'Bibliothèque/Normes/B.md')).toMatch(/· Contrôlé — rangé par l’utilisateur dans Normes\n/)
    // Écarter : mis de côté.
    await control[0]!.actions!.find((action) => action.id === 'control-discard')!.run()
    expect(read(platform, 'Bibliothèque/_retirés/A.md')).toMatch(/\ncircuit: ecarte\n/)
    expect(cards(await load('bibliotheque.a-controler'))).toEqual([])
  })

  it('le seuil de l’étape remplace celui du skill ; l’IA en panne : l’étape échoue, le document ne bouge pas', async () => {
    const platform = memoryPlatform()
    const { pour, runSkill, reply, fail } = await start(platform)
    await addStarterEntries('skill', 'fr')
    await platform.fs.ensureFolder('Bibliothèque/Normes')
    const doc = await pour('C.txt', 'Un document.')
    reply({ dossier: 'Bibliothèque/Normes', confiance: 0.8, raison: 'Plutôt une norme.', alternatives: [] })
    expect((await runSkill(doc.record, 'Ranger un document', '90 %')).results).toMatchObject({ decision: 'a-controler' })
    fail()
    await expect(runSkill('Bibliothèque/Circuit/À contrôler/C.md')).rejects.toThrow()
    expect(await platform.fs.exists('Bibliothèque/Circuit/À contrôler/C.md')).toBe(true)
  })

  it('un skill sans sortie : une réponse libre, rien ne bouge ; un document déjà à contrôler compte pour les doublons', async () => {
    const platform = memoryPlatform()
    const { pour, runSkill, reply } = await start(platform)
    await addStarterEntries('skill', 'fr')
    const doc = await pour('D.txt', 'Un document à résumer.')
    reply('Un résumé en une phrase.')
    const outcome = await runSkill(doc.record, 'Répondre en tableau')
    expect(outcome.results).toMatchObject({ text: 'Un résumé en une phrase.', decision: '' })
    expect(await platform.fs.exists(doc.record)).toBe(true)
    // À contrôler, puis versé de nouveau : déjà là.
    reply('illisible')
    await runSkill(doc.record)
    const again = (await pourIntoLibrary([{ name: 'D bis.txt', bytes: bytes('Un document à résumer.') }], { module: 'bibliotheque', label: '' }))!
    expect(again.added).toEqual([])
    expect(again.already.map((each) => each.record)).toEqual(['Bibliothèque/Circuit/À contrôler/D.md'])
  })
})
