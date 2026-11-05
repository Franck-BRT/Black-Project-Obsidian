// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le typage des pièces vu de l'analyse d'appels d'offres : ce que l'utilisateur règle dans
 * le module Typage des pièces s'applique à l'import, au tableau, au changement de type, et
 * un type renommé là-bas retype les pièces ici.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { utf8 } from '../../core/formats/zip'
import { createI18n } from '../../core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../../core/testing/memoryPlatform'
import { typagePiecesModule } from '../typage-pieces'
import { aoModule } from '.'
import { aoFr } from './i18n'
import { applyRenames, createAnalysis, importFiles, refreshTable, setPieceType } from './service'

const i18n = createI18n('fr')
i18n.register('fr', aoFr)
i18n.register('fr', typagePiecesModule.texts.fr)
const t = i18n.t.bind(i18n)

/** Un module activé sur un coffre en mémoire, avec ses réglages et ses commandes. */
function activate(module: BlackModule, platform: MemoryPlatform, initial: Record<string, unknown>) {
  let stored = initial
  const listeners: ((values: Record<string, unknown>) => void)[] = []
  const commands: ModuleCommand[] = []
  const context: ModuleContext = {
    moduleId: module.id,
    platform,
    i18n,
    settings: {
      get: () => stored,
      save: async (values) => {
        stored = values
        for (const listener of listeners) listener(values)
      },
      onChange: (listener) => {
        listeners.push(listener)
        return () => listeners.splice(listeners.indexOf(listener), 1)
      }
    },
    commands: { register: (command) => void commands.push(command) }
  }
  return { context, commands, ready: module.activate(context) }
}

afterEach(async () => {
  await aoModule.deactivate?.()
  await typagePiecesModule.deactivate?.()
})

const services = (platform: MemoryPlatform, extra: Record<string, unknown> = {}) => ({
  fs: platform.fs,
  t,
  root: 'AO',
  today: () => '2026-11-05',
  ...extra
})

describe('ce qui est réglé dans le typage s’applique à l’import', () => {
  it('mots-clés et types de l’utilisateur, donnés explicitement', async () => {
    const platform = memoryPlatform()
    const keywords = { names: { SPEC: 'CCTP' }, titles: {}, types: { PAQ: 'Plan d’assurance qualité' } }
    const s = services(platform, { keywords })
    const analysis = await createAnalysis(s, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    const report = await importFiles(s, analysis, [
      { name: 'SPEC.md', bytes: utf8('# Spécification') },
      { name: 'PAQ_v2.md', bytes: utf8('# Plan') },
      { name: 'Note.md', bytes: utf8('# Note') }
    ])
    expect(report.imported.map((piece) => piece.type)).toEqual(['CCTP', 'PAQ', 'AUTRE'])
    await setPieceType(s, report.imported[2]!.note, 'PAQ')
    expect((await platform.fs.readText(analysis.note)).match(/\| PAQ — Plan d’assurance qualité \|/g)).toHaveLength(2)
    // Le type retiré, les pièces le gardent, signalé.
    await refreshTable({ ...s, keywords: { names: {}, titles: {}, types: {} } }, analysis)
    expect(await platform.fs.readText(analysis.note)).toContain('| PAQ — PAQ (type retiré) |')
  })

  it('par défaut, ce qui est en vigueur dans le module Typage des pièces', async () => {
    const platform = memoryPlatform()
    await activate(typagePiecesModule, platform, { typesPerso: { PAQ: 'Plan qualité' }, motsClesNom: { SPEC: 'CCTP' } }).ready
    const s = services(platform)
    const analysis = await createAnalysis(s, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    const report = await importFiles(s, analysis, [
      { name: 'SPEC.md', bytes: utf8('# x') },
      { name: 'PAQ.md', bytes: utf8('# x') }
    ])
    expect(report.imported.map((piece) => piece.type)).toEqual(['CCTP', 'PAQ'])
  })
})

describe('types désactivés', () => {
  it('sont marqués dans le tableau des pièces qui les ont gardés', async () => {
    const platform = memoryPlatform()
    const s = services(platform, { keywords: { names: {}, titles: {}, types: {} } })
    const analysis = await createAnalysis(s, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    await importFiles(s, analysis, [{ name: 'Planning.md', bytes: utf8('# Planning') }])
    await refreshTable({ ...s, keywords: { names: {}, titles: {}, types: {}, disabled: ['PLANNING'] } }, analysis)
    expect(await platform.fs.readText(analysis.note)).toContain('| PLANNING — Planning (désactivé) |')
  })

  it('ne sont plus proposés par « Changer le type de la pièce », sauf s’ils sont celui de la pièce', async () => {
    const platform = memoryPlatform()
    const s = services(platform)
    const analysis = await createAnalysis(s, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    // Importée avant la désactivation : la pièce est un PLANNING.
    const [piece] = (await importFiles(s, analysis, [{ name: 'Planning.md', bytes: utf8('# Planning') }])).imported
    await activate(typagePiecesModule, platform, { typesDesactives: ['PLANNING', 'DQE'] }).ready
    const ao = activate(aoModule, platform, { dossier: 'AO' })
    await ao.ready
    platform.active = piece!.note
    platform.choices.push(null)
    await ao.commands.find((command) => command.id === 'type-piece')!.run()
    const offered = platform.offered.at(-1)!.map((choice) => choice.value)
    expect(offered).toContain('PLANNING')
    expect(offered).not.toContain('DQE')
  })
})

describe('types renommés', () => {
  it('les pièces prennent le nouveau code, dans toutes les analyses', async () => {
    const platform = memoryPlatform()
    const keywords = { names: {}, titles: {}, types: { PAQ: 'Plan qualité' } }
    const s = services(platform, { keywords })
    const one = await createAnalysis(s, 'Un', { position: 'candidat', buyer: '', reference: '' })
    const two = await createAnalysis(s, 'Deux', { position: 'candidat', buyer: '', reference: '' })
    const [a] = (await importFiles(s, one, [{ name: 'PAQ_v1.md', bytes: utf8('# Plan') }])).imported
    await importFiles(s, two, [{ name: 'PAQ_v2.md', bytes: utf8('# Plan') }])
    const renamed = { ...s, keywords: { ...keywords, types: { PAQ2: 'Plan qualité' } }, renames: { PAQ: 'PAQ2' } }
    expect(await applyRenames(renamed)).toBe(2)
    expect(await platform.fs.readText(a!.note)).toContain('type: PAQ2')
    expect(await platform.fs.readText(one.note)).toContain('| PAQ2 — Plan qualité |')
    expect(await applyRenames(renamed)).toBe(0)
  })

  it('dès que le module Typage des pièces enregistre le renommage', async () => {
    const platform = memoryPlatform()
    const typing = activate(typagePiecesModule, platform, { typesPerso: { PAQ: 'Plan qualité' } })
    await typing.ready
    await activate(aoModule, platform, { dossier: 'AO' }).ready
    const s = services(platform)
    const analysis = await createAnalysis(s, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    const [piece] = (await importFiles(s, analysis, [{ name: 'PAQ_v1.md', bytes: utf8('# Plan') }])).imported
    expect(piece?.type).toBe('PAQ')

    await typing.context.settings.save({ typesPerso: { PQA: 'Plan qualité' }, typesRenommes: { PAQ: 'PQA' } })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await platform.fs.readText(piece!.note)).toContain('type: PQA')
    expect(platform.notices.at(-1)).toBe('1 pièce(s) déjà importée(s) ont pris le nouveau code.')
  })
})
