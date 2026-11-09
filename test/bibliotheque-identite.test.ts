// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **référence** et la **version** (édition, révision) d'un document de la bibliothèque,
 * en deux passes. La première, sans IA, à son entrée : le début de son texte (« Réf. : … »,
 * « Édition 2 », « Indice B »), sinon le nom de son fichier. Lues dans le texte avec leur
 * mot : sûres. Sinon : à confirmer — et une seconde passe, avec l'IA (workflow système du
 * module IA, actif), les identifie ; ce qu'elle dit doit figurer dans le document.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type PageView } from '../src/core/views'
import { bibliothequeModule, guessIdentity, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule, readIdentityAnswer } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

/** Les blocs d'une page, ceux de ses sections compris (les messages « à confirmer » y sont regroupés). */
const unfold = (block: HomeBlock): HomeBlock[] => (block.kind === 'section' ? [block, ...block.blocks] : [block])

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: 'stop' }] }) })
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'

const COVER = 'SPÉCIFICATION TECHNIQUE\nRéf. : DLA-NM-0000000-01-PSP\nÉdition 2 — Révision 15\nLe présent document décrit la station sol.'
const LOOSE = 'Spécification technique de la station sol, deuxième édition, quinzième révision du document DLA-NM-0000000-01-PSP.'

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = ALL, ia: Record<string, unknown> = SERVEUR) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ia }
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
  const system = () => ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.ia.identite-documents')
  const journal = () => (platform.files.has(JOURNAL) ? read(platform, JOURNAL) : '')
  return { page, pour, system, journal }
}

const identityOf = (view: PageView) => {
  const section = view.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.title === 'Identification')
  const list = section?.blocks[0]
  return list?.kind === 'list' ? Object.fromEntries(list.items.map((item) => [item.id, item.detail])) : {}
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('la première passe, sans IA', () => {
  it('le texte les dit avec leur mot : sûres', () => {
    expect(guessIdentity(COVER, 'Spec.pdf')).toEqual({ reference: 'DLA-NM-0000000-01-PSP', edition: '2', revision: '15', sure: true })
    expect(guessIdentity('Document No. ABC-12-X\nIssue 03 Rev. b', 'x.pdf')).toEqual({ reference: 'ABC-12-X', edition: '3', revision: 'B', sure: true })
    expect(guessIdentity('Référence : CCTP-2026-118\nVersion 2.1', 'x.pdf')).toEqual({ reference: 'CCTP-2026-118', edition: '2', revision: '1', sure: true })
  })

  it('seulement dans le nom du fichier, en partie, ou nulle part : à confirmer', () => {
    expect(guessIdentity('', 'ECSS-E-ST-10C_ed2_rev15.pdf')).toEqual({ reference: 'ECSS-E-ST-10C', edition: '2', revision: '15', sure: false })
    expect(guessIdentity('Réf. : DLA-NM-0000000-01-PSP', 'x.pdf')).toMatchObject({ reference: 'DLA-NM-0000000-01-PSP', edition: '', sure: false })
    expect(guessIdentity(LOOSE, 'Spécification.pdf')).toEqual({ reference: '', edition: '', revision: '', sure: false })
    // Une date n'est pas une référence.
    expect(guessIdentity('Réf. : 12/03/2026\nÉdition 1', 'x.pdf').reference).toBe('')
  })
})

describe('à l’entrée dans la bibliothèque', () => {
  it('sûres : dans la fiche, rien à confirmer, rien demandé à l’IA', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform)
    const before = platform.requests.length
    const doc = await pour('Spécification station sol.txt', COVER)
    expect(doc).toMatchObject({ reference: 'DLA-NM-0000000-01-PSP', edition: '2', revision: '15' })
    expect(doc.identityToConfirm).toBeUndefined()
    // La langue de ce texte court n'est pas sûre : l'IA est demandée pour elle seule.
    const asked = platform.requests.slice(before).map((request) => (JSON.parse(request.body!) as { messages: { content: string }[] }).messages[0]!.content)
    expect(asked.some((content) => content.startsWith('Tu lis le début d’un document pour trouver comment il s’identifie'))).toBe(false)
    expect(identityOf(await page('bibliotheque.document').load(encodeURIComponent(doc.record)))).toMatchObject({ reference: 'DLA-NM-0000000-01-PSP', edition: '2', revision: '15' })
  })

  it('sans IA, du nom du fichier : à confirmer — « C’est juste » les confirme ; « Classer… » aussi', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform, [lectureFichiersModule, bibliothequeModule])
    const doc = await pour('ECSS-E-ST-10C_ed2_rev15.dwg', 'binaire')
    expect(doc).toMatchObject({ reference: 'ECSS-E-ST-10C', edition: '2', revision: '15', identityToConfirm: true })
    expect(read(platform, doc.record)).toMatch(/\nidentiteAConfirmer: true\n/)
    let view = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const message = view.blocks.flatMap(unfold).find((block) => block.kind === 'message' && block.text.startsWith('Référence et version à confirmer'))
    expect(message).toMatchObject({ tone: 'warning', text: expect.stringContaining('(ECSS-E-ST-10C, version 2-15)') })
    expect(identityOf(view).identity).toBe('Référence et version à confirmer')
    expect((await page('bibliotheque.documents').load()).filters?.map((filter) => filter.id)).toContain('identite-a-confirmer')
    await (message?.kind === 'message' ? message.actions!.find((action) => action.id === 'confirm-identity')!.run() : null)
    expect(platform.notices.at(-1)).toBe('« ECSS-E-ST-10C ed2 rev15 » : référence et version confirmées.')
    view = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    expect(view.blocks.flatMap(unfold).some((block) => block.kind === 'message' && block.text.startsWith('Référence et version à confirmer'))).toBe(false)
    expect(read(platform, doc.record)).toMatch(/\nreference: ECSS-E-ST-10C\n/)
    // Classer… : confirmé.
    const other = await pour('Note.txt', 'Rien à dire.')
    expect(other.identityToConfirm).toBe(true)
    platform.forms.push({ title: 'Note', category: '', reference: 'NT-2026-01', edition: '1', revision: '', issuer: '', tags: '' })
    await (await page('bibliotheque.document').load(encodeURIComponent(other.record))).actions!.find((action) => action.id === 'classify')!.run()
    expect(read(platform, other.record)).not.toMatch(/identiteAConfirmer/)
  })
})

describe('la seconde passe, avec l’IA', () => {
  it('lire la réponse : certaine, gardée ; une référence absente du document, écartée', () => {
    expect(readIdentityAnswer({ reference: 'DLA-NM-0000000-01-PSP', edition: 'Édition 02', revision: 'rev. b', certain: true }, LOOSE, 'Spec.pdf')).toEqual({ reference: 'DLA-NM-0000000-01-PSP', edition: '2', revision: 'B' })
    expect(readIdentityAnswer({ reference: 'INVENTEE-12-X', edition: '1', revision: '', certain: true }, LOOSE, 'Spec.pdf')).toEqual({ reference: '', edition: '1', revision: '' })
    expect(readIdentityAnswer({ reference: 'DLA-NM-0000000-01-PSP', edition: '2', revision: '', certain: false }, LOOSE, 'Spec.pdf')).toBeNull()
    expect(readIdentityAnswer('pas du JSON', LOOSE, 'Spec.pdf')).toBeNull()
  })

  it('le workflow système : actif, au document versé dont l’identité est à confirmer', async () => {
    const { system } = await start(memoryPlatform())
    expect(system()).toMatchObject({
      enabled: true,
      name: 'Identifier avec l’IA la référence et la version d’un document, quand la première passe n’est pas sûre',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'identiteaconfirmer', op: 'not-empty', value: '' }],
      actions: [{ kind: 'ia.identite-document', fields: { fiche: '{fiche}' } }]
    })
  })

  it('pas sûres sans IA : l’IA les dit — données, « identifiées par l’IA », plus à confirmer', async () => {
    const platform = memoryPlatform()
    const { page, pour, journal } = await start(platform)
    // L'IA est demandée pour la langue (pas sûre), puis pour la référence et la version.
    platform.httpAnswers.push(chat('fr'), chat({ reference: 'DLA-NM-0000000-01-PSP', edition: '2', revision: '15', certain: true }))
    const before = platform.requests.length
    const doc = await pour('Spécification.txt', LOOSE)
    const sent = platform.requests.slice(before).map((request) => JSON.parse(request.body!) as { messages: { role: string; content: string }[]; temperature: number })
    const identity = sent.find((request) => request.messages[0]!.content.startsWith('Tu lis le début d’un document pour trouver comment il s’identifie'))!
    expect(identity.messages[1]!.content).toBe(`Nom du fichier : Spécification.txt\n\n${LOOSE}`)
    expect(identity.temperature).toBe(0)
    expect(read(platform, doc.record)).toMatch(/\nreference: DLA-NM-0000000-01-PSP\nedition: "?2"?\nrevision: "?15"?\n/)
    expect(read(platform, doc.record)).toMatch(/\nidentiteIdentifieePar: ia\n/)
    expect(read(platform, doc.record)).not.toMatch(/identiteAConfirmer/)
    expect(journal()).toContain('« Spécification » : DLA-NM-0000000-01-PSP, version 2-15, identifiées par l’IA.')
    expect(identityOf(await page('bibliotheque.document').load(encodeURIComponent(doc.record))).identity).toBe('Identifiées par l’IA')
  })

  it('l’IA pas certaine : la première passe reste, à confirmer, sans erreur', async () => {
    const platform = memoryPlatform()
    const { pour, journal } = await start(platform)
    platform.httpAnswers.push(chat('fr'), chat({ reference: '', edition: '', revision: '', certain: false }))
    const doc = await pour('Spécification.txt', LOOSE)
    expect(read(platform, doc.record)).toMatch(/\nidentiteAConfirmer: true\n/)
    expect(journal()).toContain('« Spécification » : l’IA n’a pas pu les lire sûrement ; la référence et la version restent à confirmer.')
  })
})
