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

      it('a tous les textes de son détail, dans les deux langues', () => {
        const details = module.details?.({})
        if (!details) return
        const keys = [
          details.titleKey,
          ...(details.introKey ? [details.introKey] : []),
          ...Object.values(details.statusKeys ?? {}),
          ...details.sections.flatMap((section) => [
            section.titleKey,
            ...(section.introKey ? [section.introKey] : []),
            ...section.features.flatMap((feature) => [
              feature.labelKey,
              ...(feature.noteKey ? [feature.noteKey] : []),
              ...(feature.tagGroups ?? []).map((group) => group.labelKey)
            ])
          ])
        ]
        for (const key of keys) {
          expect(module.texts.fr[key], key).toBeTruthy()
          expect(module.texts.en[key], key).toBeTruthy()
        }
      })

      it('ne requiert que des modules du catalogue', () => {
        for (const required of module.requires) expect(MODULES.some((m) => m.id === required)).toBe(true)
      })
    })
  }
})
