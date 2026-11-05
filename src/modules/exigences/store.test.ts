// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les notes d'exigences : créer, relire, modifier, renommer, marquer les liens — sur un coffre en mémoire. */

import { describe, expect, it } from 'vitest'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { addLink, makeReqText, setText } from './model/requirement'
import { allocateReqId, counterPast, readReqSettings, type ReqSettings } from './settings'
import { RequirementExists, RequirementStore } from './store'

function setup(stored: Record<string, unknown> = {}) {
  const platform = memoryPlatform()
  let settings: Record<string, unknown> = stored
  const store = new RequirementStore({
    fs: platform.fs,
    yaml: platform.yaml,
    settings: (): ReqSettings => readReqSettings(settings),
    saveCounters: async (counters) => void (settings = { ...settings, compteurs: counters })
  })
  return { platform, store, settings: () => settings }
}

const text = (body: string) => ({ fr: makeReqText({ body }) })

describe('les identifiants', () => {
  it('suivent le plus haut jamais donné, pas ce qui reste', () => {
    const scheme = { prefix: 'REQ', width: 4 }
    expect(allocateReqId(scheme, 'sys', ['REQ-SYS-0001', 'REQ-SYS-0002'], {})).toEqual({ id: 'REQ-SYS-0003', counters: { SYS: 3 } })
    expect(allocateReqId(scheme, 'SYS', ['REQ-SYS-0001'], { SYS: 41 }).id).toBe('REQ-SYS-0042')
    expect(counterPast(scheme, { SYS: 2 }, 'REQ-SYS-0010')).toEqual({ SYS: 10 })
    expect(counterPast(scheme, { SYS: 2 }, 'FOU-SYS-0099')).toEqual({ SYS: 2 })
  })

  it('les réglages : préfixe, chiffres, langues, nettoyés', () => {
    expect(readReqSettings({ prefixe: 'bp-x', chiffres: '3', langues: 'EN; fr', dossier: '/Exig/' })).toMatchObject({
      folder: 'Exig',
      scheme: { prefix: 'BPX', width: 3 },
      languages: ['en', 'fr']
    })
    expect(readReqSettings({})).toMatchObject({ folder: 'Exigences', scheme: { prefix: 'REQ', width: 4 }, languages: ['fr', 'en'] })
  })
})

describe('créer, relire, modifier', () => {
  it('crée la note, retient le compteur, et la relit à l’identique', async () => {
    const { platform, store, settings } = setup()
    const created = await store.create({ category: 'Système', title: 'Maintien en température', text: text('Le système doit…') })
    expect(created.id).toBe('REQ-SYSTEME-0001')
    expect(created.filePath).toBe('Exigences/REQ-SYSTEME-0001 Maintien en température.md')
    expect(settings().compteurs).toEqual({ SYSTEME: 1 })
    const content = await platform.fs.readText(created.filePath!)
    expect(content).toContain('pm-requirement: true')
    expect(content).toContain('# REQ-SYSTEME-0001 — Maintien en température\n\n## FR\n\nLe système doit…')
    const again = await store.load(created.filePath!)
    expect(again).toMatchObject({ id: created.id, title: created.title, sourceLang: 'fr', rev: 1 })
    expect(again?.text.fr?.body).toBe('Le système doit…')
    expect((await store.all()).map((each) => each.id)).toEqual(['REQ-SYSTEME-0001'])
  })

  it('ne réutilise jamais un numéro, même après suppression', async () => {
    const { platform, store } = setup()
    const first = await store.create({ category: 'SYS', title: 'Un', text: text('a') })
    platform.files.delete(first.filePath!)
    const second = await store.create({ category: 'SYS', title: 'Deux', text: text('b') })
    expect(second.id).toBe('REQ-SYS-0002')
  })

  it('garde un identifiant apporté, et pousse le compteur au-delà', async () => {
    const { store, settings } = setup()
    const brought = await store.create({ id: 'REQ-SYS-0040', category: 'SYS', title: 'Importée', text: text('x') })
    expect(brought.id).toBe('REQ-SYS-0040')
    expect(settings().compteurs).toEqual({ SYS: 40 })
    expect((await store.create({ category: 'SYS', title: 'Suivante', text: text('y') })).id).toBe('REQ-SYS-0041')
  })

  it('refuse d’écraser une note qui existe', async () => {
    const { platform, store } = setup()
    await platform.fs.writeText('Exigences/REQ-SYS-0001 Doublon.md', '# déjà là')
    await expect(store.create({ category: 'SYS', title: 'Doublon', text: text('x') })).rejects.toBeInstanceOf(RequirementExists)
  })

  it('modifier la formulation crée une révision, renomme la note, garde ce que l’utilisateur a écrit', async () => {
    const { platform, store } = setup()
    const created = await store.create({ category: 'SYS', title: 'Ancien titre', text: text('Version 1') })
    const path = created.filePath!
    // L'utilisateur ajoute une clé à lui et un paragraphe sous les sections générées.
    const original = await platform.fs.readText(path)
    await platform.fs.writeText(path, original.replace('---\n\n#', 'projet: Alpha\n---\n\n#') + '\nMa remarque.\n')
    const saved = await store.save(path, (requirement) => ({ ...setText(requirement, 'fr', 'Version 2', 'moi'), title: 'Nouveau titre' }))
    expect(saved?.path).toBe('Exigences/REQ-SYS-0001 Nouveau titre.md')
    expect(saved?.requirement.rev).toBe(2)
    expect(await platform.fs.exists(path)).toBe(false)
    const content = await platform.fs.readText(saved!.path)
    expect(content).toContain('projet: Alpha')
    expect(content).toContain('Ma remarque.')
    expect(content.match(/# REQ-SYS-0001/g)).toHaveLength(1)
    const reread = await store.load(saved!.path)
    expect(reread?.history).toMatchObject([{ rev: 2, lang: 'fr', was: 'Version 1', by: 'moi' }])
  })

  it('une exigence inchangée n’est pas réécrite', async () => {
    const { platform, store } = setup()
    const created = await store.create({ category: 'SYS', title: 'Stable', text: text('x') })
    const before = await platform.fs.readText(created.filePath!)
    await store.save(created.filePath!, (requirement) => requirement)
    expect(await platform.fs.readText(created.filePath!)).toBe(before)
  })

  it('marque « à revoir » les liens des exigences qui s’appuient sur celle qui change', async () => {
    const { store } = setup()
    const parent = await store.create({ category: 'SYS', title: 'Parent', text: text('p1') })
    const child = await store.create({ category: 'SYS', title: 'Enfant', text: text('c') })
    await store.save(child.filePath!, (requirement) => addLink(requirement, 'derives-from', parent.id))
    await store.save(parent.filePath!, (requirement) => setText(requirement, 'fr', 'p2', ''))
    const reread = await store.load(child.filePath!)
    expect(reread?.links).toEqual([{ kind: 'derives-from', to: parent.id, suspect: true }])
  })

  it('relit une note écrite à la main, et ignore les notes qui ne sont pas des exigences', async () => {
    const { platform, store } = setup()
    await platform.fs.writeText(
      'Exigences/Sous-dossier/REQ-SOL-0007.md',
      '---\npm-requirement: true\nid: REQ-SOL-0007\ntitle: Écrite à la main\ntext:\n  fr: Le segment sol doit…\n  en: The ground segment shall…\nstatus: approved\n---\n'
    )
    await platform.fs.writeText('Exigences/Autre.md', '# Pas une exigence')
    const all = await store.all()
    expect(all.map((each) => each.id)).toEqual(['REQ-SOL-0007'])
    expect(all[0]).toMatchObject({ title: 'Écrite à la main', status: 'approved' })
    expect(all[0]?.text.en?.body).toBe('The ground segment shall…')
  })
})
