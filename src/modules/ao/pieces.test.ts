// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { classifyPiece, fold, PIECE_TYPES } from './pieces'

describe('reconnaissance des pièces', () => {
  it.each([
    ['00_RC_Station_sol.pdf', 'RC'],
    ['Règlement de la consultation.docx', 'RC'],
    ['01 - Acte d’engagement.pdf', 'AE'],
    ['AE_lot1.docx', 'AE'],
    ['02_CCAP.pdf', 'CCAP'],
    ['03_CCTP_v3.docx', 'CCTP'],
    ['Cahier des charges technique.pdf', 'CCTP'],
    ['STB-SOL-001.pdf', 'CCTP'],
    ['Statement of Work.pdf', 'CCTP'],
    ['BPU.xlsx', 'BPU'],
    ['Bordereau des prix unitaires.xls', 'BPU'],
    ['DPGF_lot2.xlsx', 'DPGF'],
    ['DQE.xlsx', 'DQE'],
    ['Cadre de réponse technique.docx', 'MEMOIRE'],
    ['DC1.pdf', 'FORMULAIRE'],
    ['DUME.xml', 'FORMULAIRE'],
    ['Annexe 3 - Plans.pdf', 'ANNEXE'],
    ['Questions-réponses n°2.pdf', 'QR'],
    ['AAPC.pdf', 'AVIS'],
    ['CCAG-FCS.pdf', 'CCAG'],
    ['Planning prévisionnel.xlsx', 'PLANNING'],
    ['photo.jpg', 'AUTRE']
  ])('« %s » est un %s', (name, code) => {
    expect(classifyPiece(name)).toBe(code)
  })

  it('ne se laisse pas tromper par un mot qui contient un code', () => {
    expect(classifyPiece('Procédure.pdf')).toBe('AUTRE')
    expect(classifyPiece('Marché_carte.pdf')).toBe('AUTRE')
  })

  it('lit le titre du texte quand le nom ne dit rien', () => {
    expect(classifyPiece('document_2.pdf', '# CAHIER DES CLAUSES TECHNIQUES PARTICULIÈRES\n\nObjet')).toBe('CCTP')
    expect(classifyPiece('scan.pdf', 'Règlement de la consultation\n\nArticle 1')).toBe('RC')
    expect(classifyPiece('scan.pdf', 'Rien de reconnaissable')).toBe('AUTRE')
  })

  it('donne la priorité au nom sur le texte', () => {
    expect(classifyPiece('BPU.xlsx', 'Cahier des clauses techniques particulières')).toBe('BPU')
  })

  it('a un libellé pour chaque type', () => {
    expect(new Set(PIECE_TYPES.map((each) => each.code)).size).toBe(PIECE_TYPES.length)
    expect(fold('Pièce_n°2 — Acte d’engagement')).toBe('piece n 2 acte d engagement')
  })
})
