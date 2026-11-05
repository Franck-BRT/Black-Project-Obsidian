// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { utf8 } from '../../core/formats/zip'
import { createI18n } from '../../core/i18n'
import type { ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { aoFeatures, aoModule } from '.'
import { aoFr } from './i18n'
import { afterTypeChange, keywordTargets, readCustomKeywords, readDisabled } from './keywords'
import { classifyPiece } from './pieces'
import { createAnalysis, importFiles, refreshTable } from './service'
import { typesMarkdown } from './typesDoc'

const i18n = createI18n('fr')
i18n.register('fr', aoFr)
const t = i18n.t.bind(i18n)

describe('types désactivés : réglages', () => {
  it('ne gardent que des types qui existent, jamais « autre pièce »', () => {
    expect(readDisabled({ typesDesactives: ['PLANNING', 'AUTRE', 'XYZ', 3, 'PLANNING', 'PAQ'], typesPerso: { PAQ: 'Plan qualité' } })).toEqual([
      'PAQ',
      'PLANNING'
    ])
    expect(readDisabled({})).toEqual([])
  })

  it('suivent le renommage et la suppression d’un type ajouté', () => {
    const renamed = afterTypeChange(
      { kind: 'edit', from: 'PQA', to: 'x', previousFrom: 'PAQ', previousTo: 'x' },
      { typesPerso: { PQA: 'x' }, typesDesactives: ['PAQ', 'PLANNING'] }
    )
    expect(renamed.typesDesactives).toEqual(['PQA', 'PLANNING'])
    const removed = afterTypeChange({ kind: 'remove', from: 'PQA', to: 'x' }, { typesDesactives: ['PQA', 'PLANNING'] })
    expect(removed.typesDesactives).toEqual(['PLANNING'])
  })
})

describe('types désactivés : reconnaissance', () => {
  it('ne sont plus reconnus, ni par leurs mots-clés ni par ceux de l’utilisateur', () => {
    expect(classifyPiece('Planning prévisionnel.xlsx')).toBe('PLANNING')
    const custom = { names: { calendrier: 'PLANNING' }, titles: {}, types: {}, disabled: ['PLANNING'] }
    expect(classifyPiece('Planning prévisionnel.xlsx', '', custom)).toBe('AUTRE')
    expect(classifyPiece('Calendrier.xlsx', '', custom)).toBe('AUTRE')
    // Le type suivant qui correspond prend la place : « Annexe planning » devient une annexe.
    expect(classifyPiece('Annexe planning.pdf', '', custom)).toBe('ANNEXE')
  })

  it('ne sont plus proposés comme cibles des mots-clés', () => {
    expect(keywordTargets({}, ['PLANNING'])).not.toContain('PLANNING')
    expect(keywordTargets({}, [])).toContain('PLANNING')
  })
})

describe('types désactivés : affichage', () => {
  const custom = { names: {}, titles: {}, types: {}, disabled: ['PLANNING'] }

  it('ont un interrupteur sur leur fiche, éteint, et une note qui dit ce que cela fait', () => {
    const section = aoFeatures(custom).sections.find((each) => each.titleKey === 'ao.types.section')
    const planning = section?.features.find((each) => each.prefix === 'PLANNING')
    expect(planning?.disabled).toBe(true)
    expect(planning?.switch).toMatchObject({ settingsKey: 'typesDesactives', id: 'PLANNING' })
    expect(planning?.noteKey).toBe('ao.types.disabledNote')
    expect(section?.features.find((each) => each.prefix === 'RC')?.disabled).toBe(false)
    expect(section?.features.find((each) => each.prefix === 'AUTRE')?.switch).toBeUndefined()
  })

  it('sont marqués dans le tableau des pièces qui les ont gardés, et dans la documentation', async () => {
    const platform = memoryPlatform()
    const services = { fs: platform.fs, t, root: 'AO', today: () => '2026-11-05' }
    const analysis = await createAnalysis(services, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    await importFiles(services, analysis, [{ name: 'Planning.md', bytes: utf8('# Planning') }])
    await refreshTable({ ...services, keywords: custom }, analysis)
    expect(await platform.fs.readText(analysis.note)).toContain('| PLANNING — Planning (désactivé) |')
    expect(typesMarkdown(t, custom)).toContain('| PLANNING *(désactivé)* | Planning |')
  })
})

describe('types désactivés : changer le type d’une pièce', () => {
  it('ne propose plus un type désactivé, sauf s’il est celui de la pièce', async () => {
    const platform = memoryPlatform()
    const stored: Record<string, unknown> = { dossier: 'AO', typesDesactives: ['PLANNING', 'DQE'] }
    const commands: ModuleCommand[] = []
    const context: ModuleContext = {
      moduleId: 'ao',
      platform,
      i18n,
      settings: { get: () => stored, save: async () => {}, onChange: () => () => {} },
      commands: { register: (command) => void commands.push(command) }
    }
    await aoModule.activate(context)
    const services = { fs: platform.fs, t, root: 'AO', today: () => '2026-11-05' }
    const analysis = await createAnalysis(services, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    // Importée avant la désactivation : la pièce est un PLANNING.
    const [piece] = (await importFiles(services, analysis, [{ name: 'Planning.md', bytes: utf8('# Planning') }])).imported
    platform.active = piece!.note
    platform.choices.push(null)
    await commands.find((command) => command.id === 'type-piece')!.run()
    const offered = platform.offered.at(-1)!.map((choice) => choice.value)
    expect(offered).toContain('PLANNING')
    expect(offered).not.toContain('DQE')
    expect(readCustomKeywords(stored).disabled).toEqual(['DQE', 'PLANNING'])
    await aoModule.deactivate?.()
  })
})
