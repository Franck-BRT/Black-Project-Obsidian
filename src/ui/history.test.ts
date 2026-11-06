// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { back, HISTORY_LIMIT, leave, type Visit } from './history'

const visit = (page: string, title = page): Visit => ({ page, title })

describe('l’historique de navigation', () => {
  it('chaque page quittée y entre avec son titre ; pas la même page deux fois de suite', () => {
    let trail = leave([], null, 'home')
    expect(trail).toEqual([])
    trail = leave(trail, visit('home', 'Accueil'), 'ao.analyses')
    trail = leave(trail, visit('ao.analyses', 'Analyses'), 'ao.fiche?a')
    trail = leave(trail, visit('ao.fiche?a', 'Station sol'), 'ao.fiche?a')
    expect(trail.map((each) => each.title)).toEqual(['Accueil', 'Analyses'])
  })

  it('« Retour » ramène à la dernière page et la retire ; rien avant : rien', () => {
    const trail = [visit('home', 'Accueil'), visit('ao.fiche?a', 'Station sol')]
    expect(back(trail)).toEqual({ to: visit('ao.fiche?a', 'Station sol'), trail: [visit('home', 'Accueil')] })
    expect(back([])).toBeNull()
  })

  it('au plus trente pages retenues, les plus anciennes s’effacent', () => {
    let trail: Visit[] = []
    for (let index = 0; index < HISTORY_LIMIT + 5; index++) trail = leave(trail, visit(`p${index}`), `p${index + 1}`)
    expect(trail).toHaveLength(HISTORY_LIMIT)
    expect(trail[0]!.page).toBe('p5')
  })
})
