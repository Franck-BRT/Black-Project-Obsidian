// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import type { ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { typagePiecesModule } from '.'
import { readCustomKeywords } from './custom'
import { applyImport, exportableCodes, exportTypes, moduleValues, parseTypesFile, planImport, type TypesFile } from './exchange'
import { migrateFromAo } from './migrate'

const settings = {
  typesPerso: { PAQ: 'Plan d’assurance qualité', PGE: 'Plan de gestion' },
  motsClesNom: { 'plan qualité': 'PAQ', SPEC: 'CCTP' },
  motsClesTitre: { 'assurance qualité': 'PAQ' },
  typesDesactives: ['PLANNING']
}

describe('export', () => {
  const custom = readCustomKeywords(settings)

  it('propose les types ajoutés et ceux du module que l’utilisateur a modifiés', () => {
    expect(exportableCodes(custom)).toEqual(['CCTP', 'PLANNING', 'PAQ', 'PGE'])
    expect(exportableCodes(readCustomKeywords({}))).toEqual([])
  })

  it('écrit chaque type choisi avec ce qui lui appartient', () => {
    const file = exportTypes(custom, ['PAQ', 'CCTP', 'PLANNING'], '2026-11-05')
    expect(file).toEqual({
      format: 'black-projects/types-de-pieces',
      version: 1,
      exporte: '2026-11-05',
      types: [
        { code: 'CCTP', ajoute: false, desactive: false, motsClesNom: ['SPEC'], motsClesTitre: [] },
        { code: 'PLANNING', ajoute: false, desactive: true, motsClesNom: [], motsClesTitre: [] },
        {
          code: 'PAQ',
          libelle: 'Plan d’assurance qualité',
          ajoute: true,
          desactive: false,
          motsClesNom: ['plan qualité'],
          motsClesTitre: ['assurance qualité']
        }
      ]
    })
  })
})

describe('lecture d’un fichier', () => {
  const valid = JSON.stringify(exportTypes(readCustomKeywords(settings), ['PAQ'], '2026-11-05'))

  it('relit ce qu’il a écrit', () => {
    const parsed = parseTypesFile(valid)
    expect(parsed.ok && parsed.file.types[0]?.code).toBe('PAQ')
  })

  it('dit pourquoi un fichier ne convient pas', () => {
    expect(parseTypesFile('pas du json')).toEqual({ ok: false, errorKey: 'typage-pieces.exchange.error.json' })
    expect(parseTypesFile('{"format":"autre"}')).toEqual({ ok: false, errorKey: 'typage-pieces.exchange.error.format' })
    expect(parseTypesFile('{"format":"black-projects/types-de-pieces","version":9,"types":[]}')).toEqual({
      ok: false,
      errorKey: 'typage-pieces.exchange.error.version'
    })
    expect(parseTypesFile('{"format":"black-projects/types-de-pieces","version":1,"types":[{"x":1}]}')).toEqual({
      ok: false,
      errorKey: 'typage-pieces.exchange.error.empty'
    })
  })

  it('remet en forme les codes, écarte ce qui est mal formé', () => {
    const parsed = parseTypesFile(
      '﻿{"format":"black-projects/types-de-pieces","version":1,"types":[{"code":"paq","libelle":" Plan  qualité ","ajoute":true,"motsClesNom":["a", 3, ""]},{"pas":"de code"}]}'
    )
    expect(parsed.ok && parsed.file.types).toEqual([
      { code: 'PAQ', libelle: 'Plan qualité', ajoute: true, desactive: false, motsClesNom: ['a'], motsClesTitre: [] }
    ])
  })
})

describe('import', () => {
  const file: TypesFile = {
    format: 'black-projects/types-de-pieces',
    version: 1,
    exporte: '2026-11-04',
    types: [
      { code: 'PAQ', libelle: 'Plan qualité (v2)', ajoute: true, desactive: false, motsClesNom: ['plan qualité', 'PQ'], motsClesTitre: [] },
      { code: 'NTC', libelle: 'Note de calcul', ajoute: true, desactive: false, motsClesNom: ['note de calcul'], motsClesTitre: [] },
      { code: 'CCTP', ajoute: false, desactive: false, motsClesNom: ['SPEC', 'spécification sol'], motsClesTitre: [] },
      { code: 'DQE', ajoute: false, desactive: true, motsClesNom: [], motsClesTitre: [] },
      { code: 'BPU', libelle: 'Mon BPU', ajoute: true, desactive: false, motsClesNom: [], motsClesTitre: [] },
      { code: 'XYZ', ajoute: false, desactive: false, motsClesNom: ['x'], motsClesTitre: [] }
    ]
  }

  it('dit ce que deviendra chaque type', () => {
    expect(planImport(settings, file).map((entry) => [entry.code, entry.kind])).toEqual([
      ['PAQ', 'update'],
      ['NTC', 'new'],
      ['CCTP', 'builtin'],
      ['DQE', 'builtin'],
      ['BPU', 'conflict'],
      ['XYZ', 'unknown']
    ])
  })

  it('ajoute, met à jour, fusionne les mots-clés sans doublon, et écarte le reste', () => {
    const result = applyImport(settings, file, ['PAQ', 'NTC', 'CCTP', 'DQE', 'BPU', 'XYZ'])
    expect(result).toMatchObject({ added: 1, updated: 1, keywordsAdded: 3, keywordsSkipped: 2, skipped: ['BPU', 'XYZ'] })
    const custom = readCustomKeywords(result.settings)
    expect(custom.types).toEqual({ NTC: 'Note de calcul', PAQ: 'Plan qualité (v2)', PGE: 'Plan de gestion' })
    expect(custom.names).toEqual({
      'plan qualité': 'PAQ',
      SPEC: 'CCTP',
      PQ: 'PAQ',
      'note de calcul': 'NTC',
      'spécification sol': 'CCTP'
    })
    expect(custom.disabled).toEqual(['DQE', 'PLANNING'])
  })

  it('n’importe que les types cochés', () => {
    const result = applyImport(settings, file, ['NTC'])
    expect(result.added).toBe(1)
    expect(readCustomKeywords(result.settings).types.PAQ).toBe('Plan d’assurance qualité')
  })
})

describe('commandes', () => {
  async function setup(initial: Record<string, unknown>) {
    const platform = memoryPlatform()
    let stored = initial
    const commands: ModuleCommand[] = []
    const i18n = createI18n('fr')
    i18n.register('fr', typagePiecesModule.texts.fr)
    const context: ModuleContext = {
      moduleId: 'typage-pieces',
      platform,
      i18n,
      settings: { get: () => stored, save: async (values) => void (stored = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.push(command) }
    }
    await typagePiecesModule.activate(context)
    const run = (id: string) => commands.find((command) => command.id === id)!.run()
    return { platform, run, stored: () => stored }
  }

  it('exporte les types cochés dans le dossier des échanges, puis les réimporte ailleurs', async () => {
    const one = await setup(settings)
    one.platform.manyAnswers.push(['PAQ', 'CCTP'])
    await one.run('exporter-types')
    const path = [...one.platform.files.keys()].find((each) => each.startsWith('Black Projects/Échanges/'))
    expect(path).toMatch(/^Black Projects\/Échanges\/types-de-pieces-\d{4}-\d{2}-\d{2}\.json$/)
    expect(one.platform.notices.at(-1)).toContain('2 type(s) exporté(s)')
    await typagePiecesModule.deactivate?.()

    const two = await setup({})
    two.platform.choices.push('computer')
    two.platform.externalFiles.push([{ name: 'types.json', bytes: one.platform.files.get(path!)! }])
    await two.run('importer-types')
    expect(two.platform.manyAsked.at(-1)?.choices.map((choice) => choice.value)).toEqual(['CCTP', 'PAQ'])
    expect(readCustomKeywords(two.stored()).types).toEqual({ PAQ: 'Plan d’assurance qualité' })
    expect(readCustomKeywords(two.stored()).names).toEqual({ SPEC: 'CCTP', 'plan qualité': 'PAQ' })
    expect(two.platform.notices.at(-1)).toBe('Import : 1 type(s) ajouté(s), 0 mis à jour, 3 mot(s)-clé(s) ajouté(s).')
    await typagePiecesModule.deactivate?.()
  })

  it('dit quand il n’y a rien à exporter, et quand un fichier ne convient pas', async () => {
    const empty = await setup({})
    await empty.run('exporter-types')
    expect(empty.platform.notices.at(-1)).toContain('Rien à exporter')
    empty.platform.choices.push('vault')
    empty.platform.files.set('autre.json', new TextEncoder().encode('{"format":"autre"}'))
    empty.platform.nextPick = 'autre.json'
    await empty.run('importer-types')
    expect(empty.platform.notices.at(-1)).toBe('Ce fichier n’est pas un fichier de types de pièces de Black Projects.')
    await typagePiecesModule.deactivate?.()
  })
})

describe('migration des réglages de la v0.3.5', () => {
  it('déplace les types et mots-clés rangés dans l’analyse d’appels d’offres', () => {
    const before = { ao: { dossier: 'AO', typesPerso: { PAQ: 'x' }, motsClesNom: { SPEC: 'CCTP' }, typesDesactives: ['DQE'] } }
    expect(migrateFromAo(before)).toEqual({
      ao: { dossier: 'AO' },
      'typage-pieces': { typesPerso: { PAQ: 'x' }, motsClesNom: { SPEC: 'CCTP' }, typesDesactives: ['DQE'] }
    })
  })

  it('ne fait rien s’il n’y a rien à déplacer, et n’écrase pas des réglages déjà là', () => {
    expect(migrateFromAo({ ao: { dossier: 'AO' } })).toBeNull()
    expect(migrateFromAo({})).toBeNull()
    expect(migrateFromAo({ ao: { typesPerso: { OLD: 'x' } }, 'typage-pieces': { typesPerso: { NEW: 'y' } } })).toEqual({
      ao: {},
      'typage-pieces': { typesPerso: { NEW: 'y' } }
    })
  })
})

describe('ce que d’autres modules joignent aux types', () => {
  const extras = (code: string): Record<string, unknown> => (code === 'BPU' ? { ao: { rangement: 'reponse' } } : {})

  it('rend exportable un type qu’un module seul connaît, et l’écrit sous l’identifiant du module', () => {
    const custom = readCustomKeywords({})
    expect(exportableCodes(custom)).toEqual([])
    expect(exportableCodes(custom, extras)).toEqual(['BPU'])
    const file = exportTypes(custom, ['BPU'], '2026-11-05', extras)
    expect(file.types).toEqual([
      { code: 'BPU', ajoute: false, desactive: false, motsClesNom: [], motsClesTitre: [], modules: { ao: { rangement: 'reponse' } } }
    ])
  })

  it('se relit, et n’est rendu que pour les types importés', () => {
    const text = JSON.stringify(exportTypes(readCustomKeywords(settings), ['PAQ', 'BPU'], '2026-11-05', extras))
    const parsed = parseTypesFile(text)
    if (!parsed.ok) throw new Error(parsed.errorKey)
    expect(planImport({}, parsed.file).find((entry) => entry.code === 'BPU')?.modules).toEqual({ ao: { rangement: 'reponse' } })
    expect(moduleValues(parsed.file, ['BPU', 'PAQ'])).toEqual({ ao: { BPU: { rangement: 'reponse' } } })
    expect(moduleValues(parsed.file, ['PAQ'])).toEqual({})
    expect(applyImport({}, parsed.file, ['BPU']).imported).toEqual(['BPU'])
  })

  it('un fichier sans « modules » (v0.4.0) reste lisible', () => {
    const parsed = parseTypesFile(
      JSON.stringify({ format: 'black-projects/types-de-pieces', version: 1, types: [{ code: 'CCTP', motsClesNom: ['SPEC'] }] })
    )
    expect(parsed.ok && parsed.file.types[0]?.modules).toBeUndefined()
  })
})
