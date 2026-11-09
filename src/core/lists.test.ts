// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { completeLists, listItem } from './lists'

describe('les listes en Markdown', () => {
  it('un élément : sa puce ou son numéro, son retrait, sans la puce tapée', () => {
    expect(listItem('Revue de conception')).toBe('- Revue de conception')
    expect(listItem('•\tRevue de recette', 1)).toBe('    - Revue de recette')
    expect(listItem('Démarrer', 0, true)).toBe('1. Démarrer')
    expect(listItem('Deux\nlignes', 2, true)).toBe('        1. Deux lignes')
  })

  it('les puces tapées dans un texte : des éléments de liste ; le reste, et le code, inchangés', () => {
    expect(completeLists('Les revues :\n• Conception\n  ▪ Plans\n– Recette\n•\nTexte – suite\n```\n• code\n```')).toBe(
      'Les revues :\n- Conception\n  - Plans\n- Recette\n•\nTexte – suite\n```\n• code\n```'
    )
  })
})
