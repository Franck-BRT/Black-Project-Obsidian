// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La liste des **émetteurs** — comme les types de pièce : un **code** et un **nom** (et, s'il
 * le faut, d'autres noms, un par ligne). Une bibliothèque de la Bibliothèque (Émetteurs), une
 * note par émetteur. L'émetteur d'un document y est reconnu (son nom ou un autre nom, son
 * code en mot entier, en tête du document) et s'y choisit ; la fiche le dit « ESA — Agence
 * spatiale européenne » ; l'IA reçoit la liste et répond par le code.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem } from '../src/core/views'
import { bibliothequeModule, guessIssuer, knownIssuerCode, pourIntoLibrary, suggestIssuerCode, type KnownIssuer } from '../src/modules/bibliotheque'
import { iaModule, readIssuerAnswer } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule } from '../src/modules/workflows'

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })
const KNOWN: KnownIssuer[] = [
  { code: 'ESA', name: 'Agence spatiale européenne', aliases: ['European Space Agency'] },
  { code: 'DGA', name: 'Direction générale de l’armement', aliases: [] }
]

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = [lectureFichiersModule, bibliothequeModule]) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ia: SERVEUR }
  const views = new ViewsRegistry()
  for (const module of modules) {
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
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const pour = async (name: string, text: string) => (await pourIntoLibrary([{ name, bytes: bytes(text) }], { module: 'bibliotheque', label: '' }))!.added[0]!
  /** Un émetteur de la liste, sa note écrite comme le fait l'application. */
  const addIssuer = (code: string, name: string, aliases: string[] = []) =>
    platform.fs.writeText(`Bibliothèque/Émetteurs/${name}.md`, `---\nbp-type: bibliotheque-emetteur\nnom: ${name}\ncode: ${code}\n---\n\n${aliases.join('\n')}\n`)
  const issuerItem = async (record: string): Promise<ListItem | undefined> => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(record))
    const identity = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.identite')
    const list = identity?.blocks[0]
    return list?.kind === 'list' ? list.items.find((item) => item.id === 'issuer') : undefined
  }
  return { page, pour, addIssuer, issuerItem }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la liste des émetteurs', () => {
  it('une bibliothèque de plus : un code, un nom, d’autres noms ; une note par émetteur ; pas d’exemples', async () => {
    const platform = memoryPlatform()
    const { page } = await start(platform)
    const hub = await page('bibliotheque.accueil').load()
    const cards = hub.blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))
    expect(cards.find((card) => card.title === 'Émetteurs')).toMatchObject({ subtitle: '0 émetteur(s)', icon: 'building' })
    const issuers = await page('bibliotheque.issuers').load()
    expect(issuers.title).toBe('Émetteurs')
    expect(issuers.actions?.map((action) => action.id)).not.toContain('starters')
    platform.forms.push({ code: 'ESA', name: 'Agence spatiale européenne', category: 'Acheteur', description: '', text: 'European Space Agency', favorite: 'false' })
    await issuers.actions!.find((action) => action.id === 'new')!.run()
    const form = platform.asked.at(-1)!
    expect(form.fields.slice(0, 2)).toMatchObject([
      { key: 'code', label: 'Code', required: true },
      { key: 'name', label: 'Nom de l’émetteur', required: true }
    ])
    expect(form.fields.find((field) => field.key === 'text')).toMatchObject({ label: 'Autres noms (un par ligne)', required: false })
    expect(read(platform, 'Bibliothèque/Émetteurs/Agence spatiale européenne.md')).toMatch(/^---\nbp-type: bibliotheque-emetteur\nnom: Agence spatiale européenne\ncode: ESA\ncategorie: Acheteur\n---\n\nEuropean Space Agency\n$/)
    const after = await page('bibliotheque.issuers').load()
    const cardsIn = (blocks: readonly HomeBlock[]): { id: string; title: string }[] =>
      blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : block.kind === 'section' ? cardsIn(block.blocks) : []))
    const card = cardsIn(after.blocks).find((each) => each.id.endsWith('Agence spatiale européenne.md'))
    expect(card?.title).toBe('ESA — Agence spatiale européenne')
  })
})

describe('l’émetteur d’un document, dans la liste', () => {
  it('reconnu : dit avec son mot (un autre nom compris), ou seul de la liste en tête du document — son code', () => {
    expect(guessIssuer('Émetteur : European Space Agency\nTexte', KNOWN)).toEqual({ issuer: 'ESA', sure: true })
    expect(guessIssuer('AGENCE SPATIALE EUROPÉENNE\nCahier des charges', KNOWN)).toEqual({ issuer: 'ESA', sure: true })
    expect(guessIssuer('ESA-ESTEC\nSpécification', KNOWN)).toEqual({ issuer: 'ESA', sure: true })
    // Deux de la liste en tête : le premier, à confirmer ; un code dans un mot : non.
    expect(guessIssuer('Spécification pour la DGA\nAvec l’ESA', KNOWN)).toEqual({ issuer: 'DGA', sure: false })
    expect(guessIssuer('La desa est', KNOWN)).toEqual({ issuer: '', sure: false })
    // Hors de la liste : comme avant.
    expect(guessIssuer('Émetteur : Thales\nTexte', KNOWN)).toEqual({ issuer: 'Thales', sure: true })
    expect(knownIssuerCode('direction generale de l armement', KNOWN)).toBe('DGA')
  })

  it('à l’entrée : son code ; la fiche le dit avec son nom', async () => {
    const platform = memoryPlatform()
    const { pour, addIssuer, issuerItem } = await start(platform)
    await addIssuer('ESA', 'Agence spatiale européenne', ['European Space Agency'])
    const doc = await pour('Spécification.txt', 'European Space Agency\nSpécification de la station sol')
    expect(doc).toMatchObject({ issuer: 'ESA' })
    expect(doc.issuerToConfirm).toBeUndefined()
    expect(read(platform, doc.record)).toMatch(/\nemetteur: ESA\n/)
    expect((await issuerItem(doc.record))?.detail).toBe('ESA — Agence spatiale européenne')
  })

  it('le modifier : une liste — « Aucun », la liste, celui qu’il a s’il n’y est pas, « Ajouter un émetteur… »', async () => {
    const platform = memoryPlatform()
    const { pour, addIssuer, issuerItem } = await start(platform)
    await addIssuer('ESA', 'Agence spatiale européenne')
    await addIssuer('DGA', 'Direction générale de l’armement')
    const doc = await pour('Note.txt', 'Émetteur : Thales Alenia Space\nTexte.')
    expect(doc.issuer).toBe('Thales Alenia Space')
    platform.forms.push({ value: 'DGA' })
    await (await issuerItem(doc.record))!.tools![0]!.run()
    const field = platform.asked.at(-1)!.fields[0]!
    expect(field.kind === 'choice' && field.options.map((option) => option.label)).toEqual([
      '— Aucun —',
      'DGA — Direction générale de l’armement',
      'ESA — Agence spatiale européenne',
      'Thales Alenia Space (hors de la liste des émetteurs)',
      '＋ Ajouter un émetteur à la liste…'
    ])
    expect(read(platform, doc.record)).toMatch(/\nemetteur: DGA\n/)
    expect(platform.notices.at(-1)).toBe('Émetteur : DGA — Direction générale de l’armement.')
  })

  it('« Ajouter un émetteur à la liste… » : sa fenêtre (le nom proposé), puis il devient celui du document', async () => {
    const platform = memoryPlatform()
    const { pour, issuerItem } = await start(platform)
    const doc = await pour('Note.txt', 'Émetteur : Thales Alenia Space\nTexte.')
    const item = await issuerItem(doc.record)
    const field = (await (async () => {
      platform.forms.push(null)
      await item!.tools![0]!.run()
      return platform.asked.at(-1)!.fields[0]!
    })())
    const add = field.kind === 'choice' ? field.options.at(-1)!.value : ''
    platform.forms.push({ value: add })
    platform.forms.push({ code: 'TAS', name: 'Thales Alenia Space', category: '', description: '', text: '', favorite: 'false' })
    await (await issuerItem(doc.record))!.tools![0]!.run()
    expect(platform.asked.at(-1)!.fields.find((each) => each.key === 'name')).toMatchObject({ value: 'Thales Alenia Space' })
    expect(read(platform, 'Bibliothèque/Émetteurs/Thales Alenia Space.md')).toMatch(/\ncode: TAS\n/)
    expect(read(platform, doc.record)).toMatch(/\nemetteur: TAS\n/)
    expect((await issuerItem(doc.record))?.detail).toBe('TAS — Thales Alenia Space')
  })
})

describe('un émetteur hors de la liste : l’y ajouter', () => {
  it('un code proposé : les initiales, un sigle déjà écrit, ou les quatre premières lettres', () => {
    expect(suggestIssuerCode('Thales Alenia Space')).toBe('TAS')
    expect(suggestIssuerCode('Direction générale de l’armement')).toBe('DGA')
    expect(suggestIssuerCode('Groupe SNCF')).toBe('SNCF')
    expect(suggestIssuerCode('Airbus')).toBe('AIRB')
    expect(suggestIssuerCode('')).toBe('')
  })

  it('la fiche le dit, et un bouton l’ajoute : son nom et un code proposés ; il devient celui du document, et des autres qui portaient ce nom', async () => {
    const platform = memoryPlatform()
    const { pour, addIssuer, issuerItem } = await start(platform)
    await addIssuer('ESA', 'Agence spatiale européenne')
    const doc = await pour('Note.txt', 'Émetteur : Thales Alenia Space\nTexte.')
    const other = await pour('Autre note.txt', 'Émetteur : THALES ALENIA SPACE\nAutre texte.')
    const known = await pour('Spécification.txt', 'Agence spatiale européenne\nSpécification.')
    const item = await issuerItem(doc.record)
    expect(item?.detail).toBe('Thales Alenia Space — hors de la liste des émetteurs')
    expect(item?.tools?.map((tool) => [tool.id, tool.label, tool.icon])).toEqual([
      ['edit-issuer', 'Modifier : Émetteur', 'edit'],
      ['research-issuer', 'Relancer la recherche dans le document : Émetteur', 'refresh'],
      ['add-issuer', 'Ajouter « Thales Alenia Space » à la liste des émetteurs', 'plus']
    ])
    // Un émetteur de la liste : pas de bouton.
    expect((await issuerItem(known.record))?.tools?.map((tool) => tool.id)).toEqual(['edit-issuer', 'research-issuer'])
    platform.forms.push({ code: 'TAS', name: 'Thales Alenia Space', category: '', description: '', text: '', favorite: 'false' })
    await item!.tools!.find((tool) => tool.id === 'add-issuer')!.run()
    expect(platform.asked.at(-1)!.fields.slice(0, 2)).toMatchObject([
      { key: 'code', value: 'TAS' },
      { key: 'name', value: 'Thales Alenia Space' }
    ])
    expect(read(platform, 'Bibliothèque/Émetteurs/Thales Alenia Space.md')).toMatch(/\ncode: TAS\n/)
    expect(read(platform, doc.record)).toMatch(/\nemetteur: TAS\n/)
    expect(read(platform, other.record)).toMatch(/\nemetteur: TAS\n/)
    expect(platform.notices.at(-1)).toBe('« TAS — Thales Alenia Space » ajouté à la liste des émetteurs ; c’est l’émetteur du document. 1 autre(s) document(s) émis par « Thales Alenia Space » le prennent aussi.')
    const after = await issuerItem(doc.record)
    expect(after?.detail).toBe('TAS — Thales Alenia Space')
    expect(after?.tools?.map((tool) => tool.id)).toEqual(['edit-issuer', 'research-issuer'])
  })

  it('fermer la fenêtre : rien n’est ajouté, rien ne change', async () => {
    const platform = memoryPlatform()
    const { pour, issuerItem } = await start(platform)
    const doc = await pour('Note.txt', 'Émetteur : Thales Alenia Space\nTexte.')
    const before = read(platform, doc.record)
    platform.forms.push(null)
    await (await issuerItem(doc.record))!.tools!.find((tool) => tool.id === 'add-issuer')!.run()
    expect(read(platform, doc.record)).toBe(before)
    expect(platform.files.has('Bibliothèque/Émetteurs/Thales Alenia Space.md')).toBe(false)
  })
})

describe('avec l’IA', () => {
  it('lire la réponse : un émetteur de la liste (code, nom, autre nom) que le document dit — son code', () => {
    const text = 'Spécification émise par la European Space Agency.'
    expect(readIssuerAnswer({ issuer: 'ESA', certain: true }, text, 'x.pdf', KNOWN)).toBe('ESA')
    expect(readIssuerAnswer({ issuer: 'Agence spatiale européenne', certain: true }, text, 'x.pdf', KNOWN)).toBe('ESA')
    expect(readIssuerAnswer({ issuer: 'ESA (Agence spatiale européenne)', certain: true }, text, 'x.pdf', KNOWN)).toBe('ESA')
    // De la liste, mais le document ne le dit pas : rien.
    expect(readIssuerAnswer({ issuer: 'DGA', certain: true }, text, 'x.pdf', KNOWN)).toBeNull()
    // Hors de la liste : comme avant (le document doit le dire).
    expect(readIssuerAnswer({ issuer: 'European Space Agency', certain: true }, text, 'x.pdf', [])).toBe('European Space Agency')
  })

  it('la consigne donne la liste (code (nom)) ; la réponse par le code', async () => {
    const platform = memoryPlatform()
    const { pour, addIssuer } = await start(platform, ALL)
    await addIssuer('ESA', 'Agence spatiale européenne', ['European Space Agency'])
    let asked = ''
    const original = platform.http.request.bind(platform.http)
    platform.http.request = async (request) => {
      if (!request.url.endsWith('/chat/completions')) return original(request)
      platform.requests.push(request)
      const system = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content
      if (system.startsWith('Tu identifies la langue')) return chat('fr')
      if (system.includes('pour trouver son émetteur')) {
        asked = system
        return chat({ issuer: 'ESA', certain: true })
      }
      return chat({ title: '', category: '', date: '', tags: [], reference: '', edition: '', revision: '', certain: false })
    }
    // Plus loin que la page de garde : la première passe ne le voit pas.
    const doc = await pour('Note.txt', `${'Ligne.\n'.repeat(20)}Rédigée pour la European Space Agency.`)
    expect(asked).toContain('Les émetteurs connus (code (nom)) : ESA (Agence spatiale européenne). Si c’est l’un d’eux, réponds par son code.')
    expect(read(platform, doc.record)).toMatch(/\nemetteur: ESA\nemetteurIdentifiePar: ia\n|\nemetteur: ESA\n[^]*emetteurIdentifiePar: ia/)
  })
})
