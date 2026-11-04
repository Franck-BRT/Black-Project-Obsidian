// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { createI18n } from '../i18n'
import { entitlementsFor, EVALUATION } from '../licence'
import type { Platform } from '../ports'
import type { BlackModule, ModuleContext } from './module'
import { ModuleRegistry } from './registry'

const platform = {} as Platform

function module(id: string, requires: string[] = [], activate?: () => void): BlackModule & { log: string[] } {
  const log: string[] = []
  return {
    id,
    nameKey: `${id}.name`,
    descriptionKey: `${id}.description`,
    version: '1.0.0',
    requires,
    texts: { fr: {}, en: {} },
    log,
    activate() {
      log.push('activate')
      activate?.()
    },
    deactivate() {
      log.push('deactivate')
    }
  }
}

function context(m: BlackModule): ModuleContext {
  return {
    moduleId: m.id,
    platform,
    i18n: createI18n('fr'),
    settings: { get: () => ({}), save: async () => {} },
    commands: { register: () => {} }
  }
}

function options(overrides: Partial<Parameters<ModuleRegistry['activateAll']>[0]> = {}) {
  return { disabled: [], entitlements: EVALUATION, contextFor: context, ...overrides }
}

describe('ModuleRegistry', () => {
  it('active un module requis avant celui qui le requiert, quel que soit l’ordre de déclaration', async () => {
    const registry = new ModuleRegistry()
    const order: string[] = []
    registry.register(module('conformite', ['ao'], () => order.push('conformite')))
    registry.register(module('ao', [], () => order.push('ao')))
    await registry.activateAll(options())
    expect(order).toEqual(['ao', 'conformite'])
    expect(registry.isActive('ao')).toBe(true)
    expect(registry.isActive('conformite')).toBe(true)
  })

  it('n’active pas un module désactivé, ni ceux qui en dépendent', async () => {
    const registry = new ModuleRegistry()
    registry.register(module('ao'))
    registry.register(module('conformite', ['ao']))
    await registry.activateAll(options({ disabled: ['ao'] }))
    expect(registry.status('ao')?.state).toBe('disabled')
    expect(registry.status('conformite')).toMatchObject({ state: 'missing-dependency', missing: ['ao'] })
  })

  it('n’active pas un module que la licence ne couvre pas', async () => {
    const registry = new ModuleRegistry()
    registry.register(module('ao'))
    registry.register(module('planning'))
    await registry.activateAll(options({ entitlements: entitlementsFor({ holder: 'CNES', modules: ['ao'] }) }))
    expect(registry.status('ao')?.state).toBe('active')
    expect(registry.status('planning')?.state).toBe('not-licensed')
  })

  it('signale un module requis inconnu', async () => {
    const registry = new ModuleRegistry()
    registry.register(module('conformite', ['inexistant']))
    await registry.activateAll(options())
    expect(registry.status('conformite')).toMatchObject({ state: 'missing-dependency', missing: ['inexistant'] })
  })

  it('isole un module en panne : les autres se chargent et l’erreur est gardée', async () => {
    const registry = new ModuleRegistry()
    const errors: string[] = []
    registry.register(
      module('casse', [], () => {
        throw new Error('boum')
      })
    )
    registry.register(module('ao'))
    registry.register(module('suite', ['casse']))
    await registry.activateAll(options({ onError: (m) => errors.push(m.id) }))
    expect(registry.status('casse')).toMatchObject({ state: 'failed', error: 'boum' })
    expect(registry.status('ao')?.state).toBe('active')
    expect(registry.status('suite')).toMatchObject({ state: 'missing-dependency', missing: ['casse'] })
    expect(errors).toEqual(['casse'])
  })

  it('n’active aucun module pris dans une dépendance circulaire', async () => {
    const registry = new ModuleRegistry()
    registry.register(module('a', ['b']))
    registry.register(module('b', ['a']))
    registry.register(module('c'))
    await registry.activateAll(options())
    expect(registry.status('a')).toMatchObject({ state: 'missing-dependency', missing: ['b'] })
    expect(registry.status('b')).toMatchObject({ state: 'missing-dependency', missing: ['a'] })
    expect(registry.status('c')?.state).toBe('active')
  })

  it('refuse un identifiant déjà déclaré ou mal formé', () => {
    const registry = new ModuleRegistry()
    registry.register(module('ao'))
    expect(() => registry.register(module('ao'))).toThrow(/déjà déclaré/)
    expect(() => registry.register(module('Mauvais Id'))).toThrow(/invalide/)
  })

  it('désactive dans l’ordre inverse de l’activation', async () => {
    const registry = new ModuleRegistry()
    const a = module('ao')
    const b = module('conformite', ['ao'])
    registry.register(b)
    registry.register(a)
    const order: string[] = []
    a.deactivate = () => void order.push('ao')
    b.deactivate = () => void order.push('conformite')
    await registry.activateAll(options())
    await registry.deactivateAll()
    expect(order).toEqual(['conformite', 'ao'])
    expect(registry.status('ao')?.state).toBe('pending')
  })
})
