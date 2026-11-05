// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import { typageFr } from './i18n'
import { afterTypeChange, currentCode, describeTypeRemoval, readCustomKeywords, readRenames } from './custom'

const i18n = createI18n('fr')
i18n.register('fr', typageFr)
const t = i18n.t.bind(i18n)

const base = {
  typesPerso: { PAQ: 'Plan qualité', PGE: 'Plan de gestion' },
  motsClesNom: { 'plan qualité': 'PAQ', SPEC: 'CCTP' },
  motsClesTitre: { 'assurance qualité': 'PAQ' }
}

describe('modifier un type ajouté', () => {
  it('un nouveau code est repris par les mots-clés, et le renommage est gardé', () => {
    const settings = afterTypeChange(
      { kind: 'edit', from: 'PAQ2', to: 'Plan qualité', previousFrom: 'PAQ', previousTo: 'Plan qualité' },
      { ...base, typesPerso: { PAQ2: 'Plan qualité', PGE: 'Plan de gestion' } }
    )
    expect(settings.motsClesNom).toEqual({ 'plan qualité': 'PAQ2', SPEC: 'CCTP' })
    expect(settings.motsClesTitre).toEqual({ 'assurance qualité': 'PAQ2' })
    expect(readRenames(settings)).toEqual({ PAQ: 'PAQ2' })
    expect(readCustomKeywords(settings).names).toEqual({ 'plan qualité': 'PAQ2', SPEC: 'CCTP' })
  })

  it('un libellé changé ne touche à rien d’autre', () => {
    const settings = afterTypeChange({ kind: 'edit', from: 'PAQ', to: 'Plan d’assurance', previousFrom: 'PAQ', previousTo: 'Plan qualité' }, base)
    expect(settings.motsClesNom).toEqual(base.motsClesNom)
    expect(readRenames(settings)).toEqual({})
  })

  it('des renommages successifs se suivent, et un code recréé redevient le sien', () => {
    let settings: Record<string, unknown> = { ...base }
    settings = afterTypeChange({ kind: 'edit', from: 'PAQ2', to: 'x', previousFrom: 'PAQ', previousTo: 'x' }, settings)
    settings = afterTypeChange({ kind: 'edit', from: 'PAQ3', to: 'x', previousFrom: 'PAQ2', previousTo: 'x' }, settings)
    expect(readRenames(settings)).toEqual({ PAQ: 'PAQ3', PAQ2: 'PAQ3' })
    expect(currentCode('PAQ', readRenames(settings))).toBe('PAQ3')
    settings = afterTypeChange({ kind: 'add', from: 'PAQ', to: 'Nouveau' }, settings)
    expect(readRenames(settings)).toEqual({ PAQ2: 'PAQ3' })
    expect(currentCode('CCTP', readRenames(settings))).toBe('CCTP')
  })
})

describe('supprimer un type ajouté', () => {
  it('retire ses mots-clés, et dit ce que la suppression emporte', () => {
    const settings = afterTypeChange({ kind: 'remove', from: 'PAQ', to: 'Plan qualité' }, { ...base, typesPerso: { PGE: 'Plan de gestion' } })
    expect(settings.motsClesNom).toEqual({ SPEC: 'CCTP' })
    expect(settings.motsClesTitre).toEqual({})
    // Les renommages qui menaient au type supprimé sont oubliés.
    expect(readRenames(afterTypeChange({ kind: 'remove', from: 'PQA', to: 'x' }, { typesRenommes: { PAQ: 'PQA', A: 'B' } }))).toEqual({ A: 'B' })
    const message = describeTypeRemoval('PAQ', 'Plan qualité', base, t)
    expect(message).toContain('Le type PAQ — « Plan qualité » ne sera plus proposé ni reconnu.')
    expect(message).toContain('2 mot(s)-clé(s) personnalisé(s)')
    expect(message).toContain('type retiré')
    expect(describeTypeRemoval('PGE', 'Plan de gestion', base, t)).not.toContain('mot(s)-clé(s)')
  })
})

