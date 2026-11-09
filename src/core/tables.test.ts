// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { completeTables, markdownTable, tableRows } from './tables'

describe('les tableaux en Markdown', () => {
  it('des lignes de cellules : en-tête, séparation, lignes ; sans ligne ni colonne vides', () => {
    expect(
      markdownTable([
        ['MARCHE ou CONTRAT', '', '', '', 'CLASSIFICATION', '', 'CATEGORIE'],
        ['', '', '', '', '', '', ''],
        ['Marché n° 12', '', 'x', '', 'C2', '', 'Services'],
        ['A | B', '', '', '', 'deux\nlignes']
      ])
    ).toBe(
      [
        '| MARCHE ou CONTRAT |  | CLASSIFICATION | CATEGORIE |',
        '| --- | --- | --- | --- |',
        '| Marché n° 12 | x | C2 | Services |',
        '| A / B |  | deux lignes |  |'
      ].join('\n')
    )
    expect(markdownTable([['', ''], []])).toBe('')
    expect(tableRows([['a'], ['b', 'c']])).toEqual([['a', ''], ['b', 'c']])
  })

  it('dans un texte : les lignes « | … | » sans séparation complétées ; le reste inchangé', () => {
    const text = ['Titre', '', '| MARCHE ou CONTRAT | | | | CLASSIFICATION | | | | CATEGORIE | | | |', '', 'Suite', '', '| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n')
    expect(completeTables(text)).toBe(
      ['Titre', '', '| MARCHE ou CONTRAT | CLASSIFICATION | CATEGORIE |', '| --- | --- | --- |', '', 'Suite', '', '| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n')
    )
    expect(completeTables('Rien | ici')).toBe('Rien | ici')
  })
})
