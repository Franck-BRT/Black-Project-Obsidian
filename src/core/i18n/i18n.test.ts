// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { createI18n } from '.'
import { en } from './en'
import { fr } from './fr'

describe('textes', () => {
  it('le français et l’anglais ont les mêmes clés', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort())
  })

  it('remplace les variables et garde celles qu’on ne lui donne pas', () => {
    const i18n = createI18n('fr')
    i18n.register('fr', { 'x.hello': 'Bonjour {name}, {missing}' })
    expect(i18n.t('x.hello', { name: 'CNES' })).toBe('Bonjour CNES, {missing}')
  })

  it('se rabat sur le français, puis sur la clé', () => {
    const i18n = createI18n('en')
    i18n.register('fr', { 'x.only-fr': 'Seulement en français' })
    expect(i18n.t('x.only-fr')).toBe('Seulement en français')
    expect(i18n.t('x.nowhere')).toBe('x.nowhere')
  })
})
