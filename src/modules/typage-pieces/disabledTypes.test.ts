// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import { typingDetails } from './catalogue'
import { typageFr } from './i18n'
import { afterTypeChange, keywordTargets, readDisabled } from './custom'
import { classifyPiece } from './types'
import { typesMarkdown } from './doc'

const i18n = createI18n('fr')
i18n.register('fr', typageFr)

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
    const section = typingDetails(custom).sections.find((each) => each.titleKey === 'typage-pieces.types.section')
    const planning = section?.features.find((each) => each.prefix === 'PLANNING')
    expect(planning?.disabled).toBe(true)
    expect(planning?.switch).toMatchObject({ settingsKey: 'typesDesactives', id: 'PLANNING' })
    expect(planning?.noteKey).toBe('typage-pieces.types.disabledNote')
    expect(section?.features.find((each) => each.prefix === 'RC')?.disabled).toBe(false)
    expect(section?.features.find((each) => each.prefix === 'AUTRE')?.switch).toBeUndefined()
  })

  it('sont marqués dans la documentation', () => {
    const i18n = createI18n('fr')
    i18n.register('fr', typageFr)
    expect(typesMarkdown(i18n.t.bind(i18n), custom)).toContain('| PLANNING *(désactivé)* | Planning |')
  })
})
