// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les vérifications des exigences, sans coffre : oubliées, cohérence, couverture. */

import { describe, expect, it } from 'vitest'
import { addAlias } from '../model/aliases'
import { makeRequirement, setText, type Requirement } from '../model/requirement'
import { coherence, coverage, missedRequirements, type PieceRequirements } from './checks'
import { keywords, normativeMarker, overlap, sentences } from './text'

const req = (id: string, body: string, over: Partial<Requirement> = {}) =>
  setText(makeRequirement({ id, sourceLang: 'fr', filePath: `Exigences/${id}.md`, ...over }), 'fr', body, '')
const passage = (text: string, index = 1) => ({ text, where: { heading: 'Article 3', kind: 'paragraph' as const, index } })

describe('les mots', () => {
  it('repère les tournures normatives, en français et en anglais', () => {
    expect(normativeMarker('Le titulaire doit fournir une antenne.')).toBe('doit')
    expect(normativeMarker('Les livrables devront être remis en PDF.')).toBe('devront')
    expect(normativeMarker('Le prestataire est tenu de prévenir.')).toBe('est tenu de')
    expect(normativeMarker('The system shall start.')).toBe('shall')
    expect(normativeMarker('La livraison intervient sous 15 jours.')).toBeNull()
  })

  it('coupe en phrases, et compare par les mots porteurs de sens', () => {
    expect(sentences('Le système doit démarrer. Il doit aussi s’arrêter ; sans délai.')).toEqual([
      'Le système doit démarrer.',
      // Une suite en minuscules après un point-virgule reste dans la même phrase.
      'Il doit aussi s’arrêter ; sans délai.'
    ])
    expect([...keywords('Le titulaire doit fournir une antenne de 3,7 m.')]).toEqual(['titulaire', 'fournir', 'antenne', '3,7'])
    expect(overlap(keywords('antenne de 3,7 m'), keywords('Nous fournissons une antenne de 3,7 m'))).toBe(1)
  })
})

describe('les exigences oubliées', () => {
  it('relève les phrases normatives qu’aucune exigence ne reprend, une fois chacune', () => {
    const library = [req('EX-SOL-001', 'Le titulaire doit fournir une antenne de 3,7 m de diamètre.')]
    const documents = [
      {
        piece: 'CCTP (docx)',
        passages: [
          passage('EX-SOL-001 | Le titulaire doit fournir une antenne de 3,7 m de diamètre.'),
          passage('Le titulaire devra assurer une formation de deux jours aux opérateurs. La livraison intervient sous 15 jours.', 2),
          passage('Il doit.', 3)
        ]
      },
      { piece: 'CCTP (pdf)', passages: [passage('Le titulaire devra assurer une formation de deux jours aux opérateurs.')] }
    ]
    const missed = missedRequirements(documents, library)
    expect(missed).toEqual([
      {
        sentence: 'Le titulaire devra assurer une formation de deux jours aux opérateurs.',
        marker: 'devra',
        piece: 'CCTP (docx)',
        where: { heading: 'Article 3', kind: 'paragraph', index: 2 },
        alsoIn: ['CCTP (pdf)']
      }
    ])
  })
})

describe('la cohérence entre pièces', () => {
  const piece = (name: string, rows: Record<string, string>[], type = 'CCTP'): PieceRequirements => ({
    piece: name,
    type,
    rows,
    where: rows.map(() => ({ heading: '', kind: 'paragraph' as const }))
  })

  it('formulations différentes, absente d’une version, doublon, même texte, exigence rangée qui diffère', () => {
    const findings = coherence(
      [
        piece('CCTP (docx)', [
          { id: 'EX-1', 'text.fr': 'Le système doit démarrer en 5 s.' },
          { id: 'EX-2', 'text.fr': 'La station doit être disponible.' },
          { id: 'EX-2', 'text.fr': 'La station doit être disponible.' },
          { id: 'EX-9', 'text.fr': 'La  station doit être DISPONIBLE.' }
        ]),
        piece('CCTP (pdf)', [{ id: 'EX-1', 'text.fr': 'Le système doit démarrer en 10 s.' }])
      ],
      [req('EX-2', 'La station doit être disponible 99 % du temps.')]
    )
    expect(findings.map((finding) => [finding.kind, finding.ids.join(','), finding.pieces.join(',')])).toEqual([
      ['duplicate', 'EX-2', 'CCTP (docx)'],
      ['divergent', 'EX-1', 'CCTP (docx),CCTP (pdf)'],
      ['missing', 'EX-2', 'CCTP (pdf)'],
      ['missing', 'EX-9', 'CCTP (pdf)'],
      ['same-text', 'EX-2,EX-9', 'CCTP (docx)'],
      ['library-differs', 'EX-2', 'CCTP (docx)']
    ])
  })

  it('rien à dire sur des pièces cohérentes', () => {
    const rows = [{ id: 'EX-1', 'text.fr': 'Le système doit démarrer.' }]
    expect(coherence([piece('A', rows), piece('B', rows)], [req('EX-1', 'Le système doit démarrer.')])).toEqual([])
  })
})

describe('la couverture par la réponse', () => {
  it('citée par son nom (alias compris), traitée, à vérifier, absente', () => {
    const library = [
      addAlias(req('EX-SOL-001', 'Le titulaire doit fournir une antenne de 3,7 m de diamètre.'), 'OMLX-1'),
      req('EX-SOL-002', 'La station doit recevoir en bande S avec un débit de 2 Mbit/s.'),
      req('EX-SOL-003', 'Le système doit être disponible 99,5 % du temps, hors maintenance.'),
      req('EX-SOL-004', 'Le titulaire doit former les opérateurs pendant deux jours.')
    ]
    const response = [
      {
        piece: 'Mémoire',
        passages: [
          passage('Conformément à OMLX-1, nous livrons notre antenne.'),
          passage('Notre station reçoit en bande S, débit 2 Mbit/s garanti.', 2),
          passage('La station est disponible, hors maintenance.', 3)
        ]
      }
    ]
    expect(coverage(library, response).map((row) => [row.requirement.id, row.status, row.where?.index ?? null])).toEqual([
      ['EX-SOL-001', 'cited', 1],
      ['EX-SOL-002', 'addressed', 2],
      ['EX-SOL-003', 'partial', 3],
      ['EX-SOL-004', 'absent', null]
    ])
  })
})
