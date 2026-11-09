// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **relecture du texte extrait par l'IA** : un workflow système (actif), au document versé
 * dont le texte a été extrait, le relit — cohérence, mise en forme, corrections — par
 * morceaux, avec le prompt, le persona, le skill de son étape. Le texte relu est une nouvelle
 * **version du texte** : la première (extraite du fichier) est gardée, on la compare, on peut
 * la remontrer ; l'édition et la révision du document ne changent pas.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { diffParagraphs } from '../src/core/diff'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem } from '../src/core/views'
import { addStarterEntries, bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { iaModule, proofreadChunks, readProofread } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'
const RAW = 'Plan qualité\nRéf. : PQ-07\nÉdition 2\n\nLe pré- sent plan dé crit l’orga nisation.\n\n• Revue de con ception\n• Revue de recette'
const FIXED = '# Plan qualité\n\nRéf. : PQ-07 — Édition 2\n\nLe présent plan décrit l’organisation.\n\n- Revue de conception\n- Revue de recette'

async function start(platform: MemoryPlatform, proofread: (text: string, system: string) => string, ia: Record<string, unknown> = SERVEUR) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ia }
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
  const original = platform.http.request.bind(platform.http)
  const asked: string[] = []
  platform.http.request = async (request) => {
    if (!request.url.endsWith('/chat/completions')) return original(request)
    platform.requests.push(request)
    const messages = (JSON.parse(request.body!) as { messages: { content: string }[] }).messages
    const system = messages[0]!.content
    if (system.startsWith('Tu identifies la langue')) return chat('fr')
    if (system.includes('Tu relis un texte extrait automatiquement')) {
      asked.push(system)
      return chat(proofread(messages.at(-1)!.content, system))
    }
    return chat({ title: '', issuer: '', category: '', date: '', tags: [], reference: '', edition: '', revision: '', certain: false })
  }
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const pour = async (name: string, text: string) => (await pourIntoLibrary([{ name, bytes: bytes(text) }], { module: 'bibliotheque', label: '' }))!.added[0]!
  const workflows = () => (settings.workflows?.workflows ?? []) as Workflow[]
  const journal = () => (platform.files.has(JOURNAL) ? read(platform, JOURNAL) : '')
  const textVersions = async (record: string): Promise<ListItem[]> => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(record))
    const versions = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.versions')
    const list = versions?.blocks.find((block) => block.kind === 'list' && block.title === 'Versions du texte')
    return list?.kind === 'list' ? list.items : []
  }
  return { page, pour, workflows, journal, asked, shown, textVersions }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('comparer, découper, garder', () => {
  it('deux textes, paragraphe par paragraphe : gardés, retirés, ajoutés', () => {
    expect(diffParagraphs('A\n\nB\n\nC', 'A\n\nB2\n\nC\n\nD')).toEqual([
      { change: 'same', text: 'A' },
      { change: 'removed', text: 'B' },
      { change: 'added', text: 'B2' },
      { change: 'same', text: 'C' },
      { change: 'added', text: 'D' }
    ])
    expect(diffParagraphs('', '')).toEqual([])
    // Tout un passage changé : chaque retiré suivi de celui qui le remplace.
    expect(diffParagraphs('X1\n\nX2', 'Y1\n\nY2').map((part) => `${part.change}:${part.text}`)).toEqual(['removed:X1', 'added:Y1', 'removed:X2', 'added:Y2'])
  })

  it('le texte en morceaux, coupés entre deux paragraphes ; une réponse gardée si elle reste le même texte', () => {
    const text = Array.from({ length: 10 }, (_, at) => `${'x'.repeat(900)} ${at}`).join('\n\n')
    const chunks = proofreadChunks(text, 2000)
    expect(chunks).toHaveLength(5)
    expect(chunks.join('\n\n')).toBe(text)
    expect(readProofread('```markdown\nLe présent plan.\n```', 'Le pré- sent plan.')).toBe('Le présent plan.')
    // Un résumé, un ajout : refusés.
    expect(readProofread('Plan.', 'Le présent plan décrit l’organisation qualité du projet.')).toBeNull()
    expect(readProofread('x'.repeat(200), 'x'.repeat(100))).toBeNull()
  })
})

describe('la relecture par l’IA, au versement', () => {
  it('le workflow système : actif, au document versé dont le texte a été extrait', async () => {
    const { workflows } = await start(memoryPlatform(), () => FIXED)
    expect(workflows().find((each) => each.system === 'sys.ia.relire-textes')).toMatchObject({
      enabled: true,
      name: 'Relire avec l’IA le texte extrait d’un document : cohérence, mise en forme, corrections',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'texteextrait', op: 'not-empty', value: '' }],
      actions: [{ kind: 'ia.relire-texte', fields: { fiche: '{fiche}' } }]
    })
  })

  it('relu : une nouvelle version du texte (le texte 1 gardé) ; la fiche montre le texte relu ; édition et révision inchangées', async () => {
    const platform = memoryPlatform()
    const { page, pour, journal, textVersions } = await start(platform, () => FIXED)
    const doc = await pour('Plan qualité.txt', RAW)
    const note = read(platform, doc.record)
    expect(note).toMatch(/\ntexteVersion: 2\n/)
    expect(note).toContain('> [!info] Texte 2, relu par l’IA :')
    expect(note).toContain('- Revue de conception')
    expect(note).not.toContain('Le pré- sent')
    expect(note).toMatch(/\nedition: "2"\n/)
    const folder = `Bibliothèque/_textes/${doc.hash.slice(0, 16)}`
    expect(read(platform, `${folder}/Texte 1.md`)).toMatch(/^---\nbp-type: bibliotheque-texte\ndocument: "\[\[Bibliothèque\/Plan qualité\.md\]\]"\nversion: 1\norigine: extraction\n/)
    expect(read(platform, `${folder}/Texte 1.md`)).toContain('Le pré- sent plan dé crit')
    expect(read(platform, `${folder}/Texte 2.md`)).toMatch(/\nversion: 2\norigine: ia\ndate: "[\d-]+"\nmodele: mistral-small\n/)
    expect(journal()).toContain('« Plan qualité » : texte relu par l’IA — texte 2 (1 morceau(x)) ; celui d’avant est gardé.')
    // La section Versions : les versions du texte, la dernière d'abord.
    const items = await textVersions(doc.record)
    expect(items.map((item) => [item.title, item.tools?.map((tool) => tool.label)])).toEqual([
      ['Texte 2 — relu par l’IA', ['Comparer avec le texte 1', 'Supprimer cette version']],
      ['Texte 1 — extrait du fichier', ['Le montrer sur la fiche', 'Supprimer cette version']]
    ])
    expect(items[0]!.detail).toContain('mistral-small')
    expect(items[0]!.detail).toContain('montré sur la fiche')
    // La section « Texte extrait » dit la version montrée.
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const texte = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.texte')
    expect(texte?.subtitle).toMatch(/^Texte 2 — relu par l’IA · \d+ caractères$/)
  })

  it('comparer : ce qui est retiré, ajouté ; remontrer le texte 1 sur la fiche', async () => {
    const platform = memoryPlatform()
    const { page, pour, shown, textVersions } = await start(platform, () => FIXED)
    const doc = await pour('Plan qualité.txt', RAW)
    const items = await textVersions(doc.record)
    await items[0]!.tools![0]!.run()
    const param = shown.at(-1)!.slice('bibliotheque.comparer?'.length)
    expect(shown.at(-1)!.startsWith('bibliotheque.comparer?')).toBe(true)
    const compare = await page('bibliotheque.comparer').load(param)
    expect(compare.title).toBe('Texte 1 → texte 2')
    const diff = compare.blocks.find((block) => block.kind === 'diff')
    expect(diff?.kind === 'diff' && diff.parts.filter((part) => part.change === 'removed').map((part) => part.text)).toContain('Le pré- sent plan dé crit l’orga nisation.')
    expect(diff?.kind === 'diff' && diff.parts.filter((part) => part.change === 'added').map((part) => part.text)).toContain('Le présent plan décrit l’organisation.')
    await items[1]!.tools![0]!.run()
    const note = read(platform, doc.record)
    expect(note).toMatch(/\ntexteVersion: 1\n/)
    expect(note).toContain('Le pré- sent plan dé crit')
    expect(platform.notices.at(-1)).toBe('Texte 1 — extrait du fichier : montré sur la fiche.')
  })

  it('une réponse qui résume : écartée, aucune version ; le texte extrait reste', async () => {
    const platform = memoryPlatform()
    const { pour, journal, textVersions } = await start(platform, () => 'Un plan.')
    const doc = await pour('Plan qualité.txt', RAW)
    expect(read(platform, doc.record)).not.toMatch(/texteVersion/)
    expect(read(platform, doc.record)).toContain('Le pré- sent plan dé crit')
    expect(await textVersions(doc.record)).toEqual([])
    expect(journal()).toContain('« Plan qualité » : l’IA changeait trop le texte (résumé, ajouts) ; rien n’est gardé de sa relecture.')
  })

  it('le persona de l’étape : ses consignes données à l’IA, et dites dans la version', async () => {
    const platform = memoryPlatform()
    const { pour, workflows, asked } = await start(platform, () => FIXED)
    await addStarterEntries('persona', 'fr')
    const flow = workflows().find((each) => each.system === 'sys.ia.relire-textes')!
    flow.actions[0]!.fields.persona = 'Juriste marchés publics'
    const doc = await pour('Plan qualité.txt', RAW)
    expect(asked.at(-1)).toMatch(/^Tu réponds en tant que « Juriste marchés publics »/)
    const folder = `Bibliothèque/_textes/${doc.hash.slice(0, 16)}`
    expect(read(platform, `${folder}/Texte 2.md`)).toMatch(/\npersona: Juriste marchés publics\n/)
  })

  it('la relecture se dit : son début, puis ce qu’elle a donné (son workflow système ne dit rien d’autre)', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform, () => FIXED)
    await pour('Plan qualité.txt', RAW)
    const start_ = platform.notices.indexOf('« Plan qualité » : relecture du texte par l’IA en cours (1 morceau(x))…')
    expect(start_).toBeGreaterThanOrEqual(0)
    expect(platform.notices.indexOf('« Plan qualité » : texte relu par l’IA — texte 2 (1 morceau(x)) ; celui d’avant est gardé.')).toBeGreaterThan(start_)
  })

  it('sans IA réglée : dit, au versement, que le texte n’est pas relu', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform, () => FIXED, {})
    await pour('Plan qualité.txt', RAW)
    expect(platform.notices).toContain('« Plan qualité » : l’IA n’est pas réglée ; le texte n’est pas relu.')
  })
})

describe('extraire de nouveau, relire avec l’IA', () => {
  const textSection = async (page: (id: string) => { load(param: string): Promise<{ blocks: HomeBlock[] }> }, record: string) => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(record))
    const texte = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.texte')
    const message = texte!.blocks[0]!
    return message.kind === 'message' ? message.actions ?? [] : []
  }

  it('le texte extrait de nouveau : une version de plus, aussitôt relue par l’IA', async () => {
    const platform = memoryPlatform()
    const { page, pour, textVersions, asked } = await start(platform, () => FIXED)
    const doc = await pour('Plan qualité.txt', RAW)
    expect(asked).toHaveLength(1)
    await (await textSection(page, doc.record)).find((action) => action.id === 'extract')!.run()
    expect(asked).toHaveLength(2)
    expect((await textVersions(doc.record)).map((item) => item.title)).toEqual(['Texte 4 — relu par l’IA', 'Texte 3 — extrait du fichier', 'Texte 2 — relu par l’IA', 'Texte 1 — extrait du fichier'])
    expect(read(platform, doc.record)).toMatch(/\ntexteVersion: 4\n/)
    expect(platform.notices).toContain('« Plan qualité » : texte relu par l’IA — texte 4 (1 morceau(x)) ; celui d’avant est gardé.')
  })

  it('extrait de nouveau, la relecture désactivée : une version de plus, sans IA', async () => {
    const platform = memoryPlatform()
    const { page, pour, textVersions, asked, workflows } = await start(platform, () => FIXED)
    const doc = await pour('Plan qualité.txt', RAW)
    workflows().find((each) => each.system === 'sys.ia.relire-textes')!.enabled = false
    await (await textSection(page, doc.record)).find((action) => action.id === 'extract')!.run()
    expect(asked).toHaveLength(1)
    expect((await textVersions(doc.record)).map((item) => item.title)).toEqual(['Texte 3 — extrait du fichier', 'Texte 2 — relu par l’IA', 'Texte 1 — extrait du fichier'])
    expect(read(platform, doc.record)).toMatch(/\ntexteVersion: 3\n/)
  })

  it('« Relire avec l’IA » sur la fiche : relance la relecture ; désactivée, le dit', async () => {
    const platform = memoryPlatform()
    let answer = FIXED
    const { page, pour, textVersions, workflows } = await start(platform, () => answer)
    const doc = await pour('Plan qualité.txt', RAW)
    const actions = await textSection(page, doc.record)
    expect(actions.map((action) => action.label)).toEqual(['Extraire de nouveau', 'Relire avec l’IA', 'Ouvrir sa note'])
    answer = FIXED.replace('organisation', 'organisation qualité')
    await actions.find((action) => action.id === 'proofread')!.run()
    expect((await textVersions(doc.record)).map((item) => item.title)[0]).toBe('Texte 3 — relu par l’IA')
    workflows().find((each) => each.system === 'sys.ia.relire-textes')!.enabled = false
    await actions.find((action) => action.id === 'proofread')!.run()
    expect(platform.notices.at(-1)).toBe('La relecture par l’IA n’a pas été lancée : son workflow système « Relire le texte extrait avec l’IA » est désactivé, ou le module Workflows n’est pas actif.')
  })
})

describe('supprimer une version du texte', () => {
  const tool = (item: ListItem, id: string) => item.tools!.find((each) => each.id.startsWith(id))!

  it('une version que la fiche ne montre pas : sa note supprimée, après confirmation ; la fiche ne change pas', async () => {
    const platform = memoryPlatform()
    const { pour, textVersions } = await start(platform, () => FIXED)
    const doc = await pour('Plan qualité.txt', RAW)
    const folder = `Bibliothèque/_textes/${doc.hash.slice(0, 16)}`
    // Refusée : rien ne change.
    platform.confirmations.push(false)
    await tool((await textVersions(doc.record))[1]!, 'delete').run()
    expect(platform.files.has(`${folder}/Texte 1.md`)).toBe(true)
    platform.confirmations.push(true)
    await tool((await textVersions(doc.record))[1]!, 'delete').run()
    expect(platform.confirmed.at(-1)).toMatchObject({ title: 'Supprimer « Texte 1 — extrait du fichier » ?', confirm: 'Supprimer', danger: true })
    expect(platform.files.has(`${folder}/Texte 1.md`)).toBe(false)
    expect(platform.notices.at(-1)).toBe('Texte 1 — extrait du fichier : supprimé, avec sa note.')
    const items = await textVersions(doc.record)
    // Le texte 2, sans précédente : plus rien à comparer.
    expect(items.map((item) => [item.title, item.tools?.map((each) => each.label)])).toEqual([['Texte 2 — relu par l’IA', ['Supprimer cette version']]])
    expect(read(platform, doc.record)).toMatch(/\ntexteVersion: 2\n/)
  })

  it('celle que montre la fiche : la dernière qui reste la remplace ; une précédente supprimée, on compare à celle d’avant', async () => {
    const platform = memoryPlatform()
    const { page, pour, textVersions } = await start(platform, () => FIXED)
    const doc = await pour('Plan qualité.txt', RAW)
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const texte = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.texte')
    await (texte!.blocks[0]!.kind === 'message' ? texte!.blocks[0]!.actions!.find((action) => action.id === 'extract')!.run() : null)
    // Texte 4 (relu), 3 (extrait), 2 (relu), 1 (extrait) ; on supprime le 3, puis le 4, montré.
    platform.confirmations.push(true, true)
    await tool((await textVersions(doc.record)).find((item) => item.title.startsWith('Texte 3'))!, 'delete').run()
    expect((await textVersions(doc.record))[0]!.tools!.map((each) => each.label)).toEqual(['Comparer avec le texte 2', 'Supprimer cette version'])
    await tool((await textVersions(doc.record))[0]!, 'delete').run()
    expect(platform.confirmed.at(-1)!.message).toContain('C’est la version que montre la fiche')
    expect(platform.notices.at(-1)).toBe('Texte 4 — relu par l’IA : supprimé, avec sa note ; la fiche montre maintenant Texte 2 — relu par l’IA.')
    expect((await textVersions(doc.record)).map((item) => item.title)).toEqual(['Texte 2 — relu par l’IA', 'Texte 1 — extrait du fichier'])
    expect(read(platform, doc.record)).toMatch(/\ntexteVersion: 2\n/)
    expect(read(platform, doc.record)).toContain('> [!info] Texte 2, relu par l’IA :')
  })

  it('la dernière qui reste : la fiche garde son texte, sans version', async () => {
    const platform = memoryPlatform()
    const { pour, textVersions } = await start(platform, () => FIXED)
    const doc = await pour('Plan qualité.txt', RAW)
    platform.confirmations.push(true, true)
    await tool((await textVersions(doc.record))[1]!, 'delete').run()
    await tool((await textVersions(doc.record))[0]!, 'delete').run()
    expect(await textVersions(doc.record)).toEqual([])
    const note = read(platform, doc.record)
    expect(note).not.toMatch(/texteVersion/)
    expect(note).toContain('- Revue de conception')
    expect(note).toContain('> [!info] Document lu :')
  })
})
