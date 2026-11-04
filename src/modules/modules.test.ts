// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { MODULES } from '.'

describe('catalogue des modules', () => {
  it('les identifiants sont uniques', () => {
    const ids = MODULES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const module of MODULES) {
    describe(module.id, () => {
      it('a ses textes dans les deux langues, avec les mêmes clés', () => {
        expect(Object.keys(module.texts.en).sort()).toEqual(Object.keys(module.texts.fr).sort())
      })

      it('nomme et décrit le module', () => {
        expect(module.texts.fr[module.nameKey]).toBeTruthy()
        expect(module.texts.fr[module.descriptionKey]).toBeTruthy()
      })

      it('préfixe toutes ses clés par son identifiant', () => {
        for (const key of Object.keys(module.texts.fr)) expect(key.startsWith(`${module.id}.`)).toBe(true)
      })

      it('ne requiert que des modules du catalogue', () => {
        for (const required of module.requires) expect(MODULES.some((m) => m.id === required)).toBe(true)
      })
    })
  }
})
