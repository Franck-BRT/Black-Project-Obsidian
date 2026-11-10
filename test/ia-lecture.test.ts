// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La lecture d'un document par l'IA, ses briques sans IA : faut-il l'OCR, une lecture est-elle
 * entière, le nettoyage (en-têtes, pieds de page, numéros de page, lignes coupées, lignes vides),
 * la part des mots retrouvés, le verdict de l'IA, la qualité en pourcentage et en étoiles.
 */

import { describe, expect, it } from 'vitest'
import { blendQuality, cleanPages, coverage, needsOcr, qualityLabel, qualityPercent, qualityStars, readsWhole, readVerdict, rejoinLines, stripFurniture, stripPageNumbers } from '../src/modules/ia'

const page = (number: number, body: string) => [`Société X — Cahier des charges techniques`, `Réf. CCT-2026-014 — édition 2`, '', body, '', `Confidentiel — reproduction interdite`, `Page ${number} sur 3`].join('\n')

describe('la lecture d’un document, sans IA', () => {
  it('une page presque sans texte : l’OCR ; une lecture qui a perdu plus de 30 % des lettres : pas entière', () => {
    expect(needsOcr('# Plan\n\nA1')).toBe(true)
    expect(needsOcr('Le présent cahier des charges décrit les exigences techniques applicables à la station sol et à ses moyens d’essais.')).toBe(false)
    const reference = 'Le titulaire fournit le dossier des ouvrages exécutés, les plans, les notes de calcul et les procès-verbaux d’essais. '.repeat(3)
    expect(readsWhole(reference.slice(0, 120), reference)).toBe(false)
    expect(readsWhole(reference.replace(/,/g, ''), reference)).toBe(true)
    expect(readsWhole('court', 'Une page avec peu de texte.')).toBe(true)
  })

  it('en-têtes et pieds de page répétés retirés (le premier titre gardé) ; le texte des pages, non', () => {
    const pages = [
      page(1, '# Cahier des charges\n\n## 1. Objet\n\nLe présent document décrit la station.\nIl fixe les exigences.\n\nUne ligne de plus.\nEncore une ligne.'),
      page(2, '## 2. Exigences\n\nLa station doit fonctionner 24 h sur 24.\n\nUne ligne de plus.\nEncore une autre ligne.\nEt une dernière.'),
      page(3, '## 3. Essais\n\nLes essais se font en usine.\n\nUne ligne à part.\nTrois lignes encore.\nPour finir.\nVraiment.')
    ]
    const { pages: cleaned, removed } = stripFurniture(pages)
    expect(removed).toEqual(['Société X — Cahier des charges techniques', 'Réf. CCT-2026-014 — édition 2', 'Confidentiel — reproduction interdite', 'Page 1 sur 3'])
    expect(cleaned[0]).toBe('# Cahier des charges\n\n## 1. Objet\n\nLe présent document décrit la station.\nIl fixe les exigences.\n\nUne ligne de plus.\nEncore une ligne.')
    expect(cleaned[1]).toContain('## 2. Exigences')
    expect(cleaned.join('\n')).not.toMatch(/Confidentiel|Page \d sur 3|Société X/)
    // Une ligne de texte qui revient (« Une ligne de plus. ») au milieu des pages, deux fois sur trois : gardée.
    expect(cleaned[1]).toContain('Une ligne de plus.')
    expect(stripFurniture(['# Seul\n\nUne page.'])).toEqual({ pages: ['# Seul\n\nUne page.'], removed: [] })
  })

  it('un numéro de page seul, en haut ou en bas, retiré ; un nombre dans le texte, non', () => {
    expect(stripPageNumbers('- 12 -\n\nLe lot 12 comprend 3 postes.\n\n12\n\n3/19')).toBe('Le lot 12 comprend 3 postes.\n\n12')
    expect(stripPageNumbers('Total\n\n12\n\nau lieu de 14\n\nFin du texte de la page.\n\nVoilà.')).toContain('12')
  })

  it('les lignes coupées au milieu d’une phrase recollées, un mot coupé reformé ; titres, listes, tableaux intacts ; lignes vides en trop ôtées', () => {
    const text = '# Objet\nLe présent docu-\nment décrit la station\nsol et ses moyens.\nUne autre phrase.\n\n\n\n- un point\n- un autre\n\n| A | B |\n| 1 | 2 |\n\nFin de la\nligne.   '
    expect(rejoinLines(text)).toBe('# Objet\nLe présent document décrit la station sol et ses moyens.\nUne autre phrase.\n\n- un point\n- un autre\n\n| A | B |\n| 1 | 2 |\n\nFin de la ligne.')
    expect(rejoinLines('```\ncode\nsuite\n```')).toBe('```\ncode\nsuite\n```')
  })

  it('le nettoyage d’un document lu page par page : tout ensemble', () => {
    const { text } = cleanPages([page(1, 'Le présent document décrit\nla station sol.\n\nUne ligne.\nDeux lignes.\nTrois lignes.'), page(2, 'Elle fonctionne en continu.\n\nUne autre.\nDeux autres.\nTrois autres.'), page(3, 'Les essais\nse font en usine.\n\nFin.\nDeux.\nTrois.')])
    expect(text).toContain('Le présent document décrit la station sol.')
    expect(text).toContain('Les essais se font en usine.')
    expect(text).not.toMatch(/Page \d sur 3|Confidentiel/)
  })

  it('la part des mots retrouvés ; le verdict de l’IA ; la qualité pesée, en étoiles', () => {
    const reference = 'Le titulaire fournit le dossier des ouvrages exécutés avec les plans conformes, les notes de calcul détaillées, les procès-verbaux des essais réalisés en usine et sur site, les fiches techniques des matériels installés et les certificats.'
    expect(coverage(reference, reference)).toBe(1)
    expect(coverage(reference, 'Le titulaire fournit le dossier.')).toBeLessThan(0.3)
    expect(coverage('trop court', 'trop court')).toBeNull()
    expect(readVerdict('```json\n{"score": 87, "problems": ["un tableau décalé", ""]}\n```')).toEqual({ score: 87, problems: ['un tableau décalé'] })
    expect(readVerdict('{"note": 140}')).toEqual({ score: 100, problems: [] })
    expect(readVerdict('pas de JSON')).toBeNull()
    expect(qualityPercent([{ score: 90, weight: 3000 }, { score: 60, weight: 1000 }])).toBe(83)
    expect(qualityPercent([])).toBeNull()
    expect(blendQuality(90, 0.6)).toBe(83)
    expect(blendQuality(90, null)).toBe(90)
    expect([0, 9, 10, 49, 50, 87, 100].map(qualityStars)).toEqual([0, 0, 1, 2, 3, 4, 5])
    expect(qualityLabel(87)).toBe('★★★★☆ 87 %')
  })
})
