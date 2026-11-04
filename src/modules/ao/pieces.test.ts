// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { classifyPiece, fold, keywordIn, PIECE_TYPES } from './pieces'

describe('reconnaissance des pièces', () => {
  it.each([
    ['00_RC_Station_sol.pdf', 'RC'],
    ['Règlement de la consultation.docx', 'RC'],
    ['01 - Acte d’engagement.pdf', 'AE'],
    ['AE_lot1.docx', 'AE'],
    ['ATTRI1 - Acte d’engagement.pdf', 'AE'],
    ['Annexes techniques.pdf', 'ANNEXE'],
    ['Q-R_2.pdf', 'QR'],
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

  it('cherche un mot-clé comme mot entier, ou comme début de mot s’il finit par « … »', () => {
    expect(keywordIn('RC', fold('00_RC_v2'))).toBe(true)
    expect(keywordIn('RC', fold('Marche'))).toBe(false)
    expect(keywordIn('annexe…', fold('Annexes 1 à 3'))).toBe(true)
    expect(keywordIn('annexe', fold('Annexes 1 à 3'))).toBe(false)
    expect(keywordIn('acte d’engagement', fold("Acte d'engagement"))).toBe(true)
    expect(keywordIn('Q/R', fold('Q R 2'))).toBe(true)
  })

  it('n’a que des mots-clés qui se trouvent eux-mêmes : la liste affichée est bien celle qui est cherchée', () => {
    for (const each of PIECE_TYPES) {
      for (const keyword of [...each.names, ...each.titles]) {
        expect(keywordIn(keyword, fold(keyword.replace(/…$/, ''))), `${each.code} : ${keyword}`).toBe(true)
      }
    }
  })
})

describe('types de pièces dans la fenêtre « Fonctions »', async () => {
  const { AO_FEATURES } = await import('.')
  const section = AO_FEATURES.sections.find((each) => each.titleKey === 'ao.types.section')

  it('montre un bloc de référence par type, dans l’ordre où ils sont essayés, avec leurs mots-clés', () => {
    expect(section?.kind).toBe('reference')
    expect(section?.features.map((feature) => feature.prefix)).toEqual(PIECE_TYPES.map((each) => each.code))
    const cctp = section?.features.find((feature) => feature.prefix === 'CCTP')
    expect(cctp?.tagGroups?.[0]?.tags).toContain('STB')
    expect(cctp?.tagGroups?.[1]?.tags).toContain('cahier des charges')
  })
})
