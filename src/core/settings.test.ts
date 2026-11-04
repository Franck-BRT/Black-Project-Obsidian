// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, moduleSettings, readSettings, withModuleEnabled } from './settings'

describe('réglages', () => {
  it('donne les réglages par défaut quand rien n’est enregistré', () => {
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(readSettings('n’importe quoi')).toEqual(DEFAULT_SETTINGS)
  })

  it('écarte ce qui est invalide sans perdre le reste', () => {
    const settings = readSettings({
      language: 'de',
      disabledModules: ['ao', 3, '', 'ao'],
      modules: { ao: { dossier: 'AO' }, casse: 'pas un objet' }
    })
    expect(settings.language).toBe('fr')
    expect(settings.disabledModules).toEqual(['ao'])
    expect(settings.modules).toEqual({ ao: { dossier: 'AO' } })
  })

  it('garde une langue connue', () => {
    expect(readSettings({ language: 'en' }).language).toBe('en')
  })

  it('active et désactive un module', () => {
    const off = withModuleEnabled(DEFAULT_SETTINGS, 'ao', false)
    expect(off.disabledModules).toEqual(['ao'])
    expect(withModuleEnabled(off, 'ao', true).disabledModules).toEqual([])
  })

  it('rend un objet vide pour un module sans réglages', () => {
    expect(moduleSettings(DEFAULT_SETTINGS, 'ao')).toEqual({})
  })
})
