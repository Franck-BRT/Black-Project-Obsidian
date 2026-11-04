// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { describeEntitlements, entitlementsFor, EVALUATION } from './licence'

const t = (key: string, vars?: Record<string, string>) => (vars ? `${key} ${JSON.stringify(vars)}` : key)

describe('droits d’usage', () => {
  it('la version d’évaluation ouvre tout', () => {
    expect(EVALUATION.allows('ao')).toBe(true)
    expect(EVALUATION.allows('nimporte-quel-module')).toBe(true)
  })

  it('une licence n’ouvre que ses modules, jusqu’à son échéance incluse', () => {
    let today = '2027-06-30'
    const licence = entitlementsFor({ holder: 'CNES', modules: ['ao'], expires: '2027-06-30', today: () => today })
    expect(licence.allows('ao')).toBe(true)
    expect(licence.allows('planning')).toBe(false)
    today = '2027-07-01'
    expect(licence.allows('ao')).toBe(false)
  })

  it('se décrit en une phrase', () => {
    expect(describeEntitlements(EVALUATION, t)).toBe('settings.licence.evaluation')
    const licence = entitlementsFor({ holder: 'CNES', modules: ['ao'] })
    expect(describeEntitlements(licence, t)).toContain('CNES')
    expect(describeEntitlements(licence, t)).toContain('settings.licence.noExpiry')
  })
})
