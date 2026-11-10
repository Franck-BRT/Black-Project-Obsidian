// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La lecture d'un document par l'IA, ses briques sans IA : faut-il l'OCR, une lecture est-elle
 * entière, le nettoyage (en-têtes, pieds de page, numéros de page, lignes coupées, lignes vides),
 * la part des mots retrouvés, le verdict de l'IA, la qualité en pourcentage et en étoiles.
 */

import { describe, expect, it } from 'vitest'
import { blendQuality, cleanPages, coverage, joinPages, needsOcr, qualityLabel, qualityPercent, qualityStars, readsWhole, readVerdict, rejoinLines, stripFurniture, stripLayout, stripPageNumbers, tidyContents } from '../src/modules/ia'

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

  it('un pied de page dont le numéro change et dont l’ordre s’inverse d’une page à l’autre, coupé ou en gras : reconnu, retiré', () => {
    // Tel que la vision l'a écrit, page après page (un article de Techniques de l'Ingénieur).
    const pages = [
      '#### 1. Considérations générales\n\nLe placement fait partie du problème.\n\n© Techniques de l’Ingénieur, traité Informatique industrielle S 7 212 - 1',
      'La fabrication d’un objet est souvent conduite.\n\n***\n\nS 7 212 - 2 © Techniques de l’Ingénieur, traité Informatique industrielle\n\n***\n\n#### 1.2 Résolution',
      'Nous proposons trois méthodes.\n\n© Techniques de l’Ingénieur, traité Informatique industrielle\n\nS 7212 - 3\n\n[Image : Schéma]',
      'Optimisant un critère.\n\nS 7 212 - 4 © Techniques de l’Ingénieur, traité Informatique industrielle',
      'Le placement est une combinaison.\n\n© Techniques de l’Ingénieur, traité Informatique industrielle S 7 212 - 5\n\nS 7 212 - 5',
      'Un état terminal.\n\n**Colonne de droite**\n\n© Techniques de l’Ingénieur, traité Informatique industrielle **S 7 212 - 9**'
    ]
    const { text, removed } = cleanPages(pages)
    expect(text).not.toMatch(/Techniques de l’Ingénieur|S 7 ?212|Colonne de droite|\*\*\*/)
    expect(text).toContain('#### 1.2 Résolution')
    expect(text).toContain('[Image : Schéma]')
    expect(removed.length).toBeGreaterThanOrEqual(2)
  })

  it('ce que la vision ajoute de mise en page, retiré ; une phrase coupée par le changement de page, recollée', () => {
    expect(stripLayout('<div style="column-count: 2;">\n\n<!-- Colonne de droite -->\n\nsoit encore :\n\n### Colonne de gauche\n\nTexte.\n\n</div>\n\n***')).toBe('soit encore :\n\nTexte.')
    expect(joinPages(['L’exploration respecte des critères systé-', 'matiques permettant de choisir.'])).toBe('L’exploration respecte des critères systé-\nmatiques permettant de choisir.')
    expect(rejoinLines(joinPages(['L’exploration respecte des critères systé-', 'matiques permettant de choisir.']))).toBe('L’exploration respecte des critères systématiques permettant de choisir.')
    expect(joinPages(['Une phrase finie.', 'une autre page'])).toBe('Une phrase finie.\n\nune autre page')
  })

  it('un sommaire, lu en tableau (points de conduite, tirets qui répètent la page) ou en lignes : une liste, les sous-parties en retrait', () => {
    const table = [
      '| 1. Considérations générales........................................................... | S 7 212 – 2 |',
      '| --- | --- |',
      '',
      '| 1.1 Problème de placement.............................................................................. | — | 2 |',
      '| --- | --- | --- |',
      '| 1.2 Résolution .................................................................................................... | — | 3 |',
      '| 2. Description des formes irrégulières........................................... | — | 3 |',
      '| 2.2.1 Peignes de contour.......................................... | — | 4 |',
      '| Références bibliographiques......................................................................... | — | 17 |'
    ].join('\n')
    expect(tidyContents(table)).toBe(['- 1. Considérations générales — S 7 212 – 2', '', '  - 1.1 Problème de placement — 2', '  - 1.2 Résolution — 3', '- 2. Description des formes irrégulières — 3', '    - 2.2.1 Peignes de contour — 4', '- Références bibliographiques — 17'].join('\n'))
    // Sans points de conduite, des numéros de partie et le tiret qui répète la page : un sommaire aussi.
    expect(tidyContents('| **1.** **Élaboration du modèle** | S 7 572 – 3 |\n| --- | --- |\n| 1.1 Rôle des éléments | — | 3 |\n| 1.1.1 Exemple d’application | — | 3 |')).toBe('- 1. Élaboration du modèle — S 7 572 – 3\n  - 1.1 Rôle des éléments — 3\n    - 1.1.1 Exemple d’application — 3')
    // En lignes : les points de conduite ôtés.
    expect(tidyContents('1.1 Rôle des éléments de la structure de contrôle .................. — 3')).toBe('1.1 Rôle des éléments de la structure de contrôle — 3')
    // Un tableau ordinaire (des lots, des prix) ne bouge pas.
    const lots = '| Lot | Désignation | Prix |\n| --- | --- | --- |\n| 1 | Terrassement | 10 000 |\n| 2 | Fondations | 20 000 |'
    expect(tidyContents(lots)).toBe(lots)
  })

  it('un sommaire écrit par la vision en liste numérotée, les sous-parties en retrait sans puce : une liste à puces imbriquée', () => {
    // Tel que la vision l'a écrit (un article de Techniques de l'Ingénieur, AG 1 100v2).
    const lines = [
      'Gérant ARISKAN',
      '',
      '1. Méthodologie de la GGR — AG 1 100v2 - 2',
      '    1.1 Notion de risque — 2',
      '    1.2 Concept fondamental de la GGR — 3',
      '2. Risques des principaux processus — 12',
      '    2.10 Autres fonctions — 20',
      'Pour en savoir plus — Doc. AG 1 100v2',
      '',
      'Gérer et agir, c’est prendre des risques — 2 fois plus qu’ailleurs.'
    ].join('\n')
    expect(tidyContents(lines)).toBe(
      [
        'Gérant ARISKAN',
        '',
        '- 1. Méthodologie de la GGR — 2',
        '  - 1.1 Notion de risque — 2',
        '  - 1.2 Concept fondamental de la GGR — 3',
        '- 2. Risques des principaux processus — 12',
        '  - 2.10 Autres fonctions — 20',
        '- Pour en savoir plus — Doc. AG 1 100v2',
        '',
        'Gérer et agir, c’est prendre des risques — 2 fois plus qu’ailleurs.'
      ].join('\n')
    )
    // Lu dans le fichier, en tableau : le numéro dans sa cellule, la référence du document avant la première page.
    const table = '| 1. | Méthodologie de la GGR........................ | AG 1 100v2 | - 2 |\n| --- | --- | --- | --- |\n| 1.1 | Notion de risque.............................. | — | 2 |\n| 2.10 | Autres fonctions .............................. | — | 20 |'
    expect(tidyContents(table)).toBe('- 1. Méthodologie de la GGR — 2\n  - 1.1 Notion de risque — 2\n  - 2.10 Autres fonctions — 20')
    // Deux lignes de texte avec un tiret et un nombre ne font pas un sommaire.
    const text = 'Le budget — 12\nLe délai — 3'
    expect(tidyContents(text)).toBe(text)
  })

  it('les pieds de page d’un article (AG 1 100v2) : référence et page, variantes mises bout à bout, page entière en une cellule — retirés', () => {
    // Ceux que le texte du fichier a fait connaître.
    const known = [
      'Ce document a ete delivre pour le compte de 7200105995 - c.n.e.s. centre spatial de toulouse',
      'Toute reproduction sans autorisation du Centre français d’exploitation du droit de copie',
      'est strictement interdite. – © Editions T.I. AG 1 100v2 – 1',
      'Parution : avril 2013 - Ce document a ete delivre pour le compte de 7200105995'
    ]
    const pages = [
      'La GGR se définit comme une démarche transversale.\n\nAG 1 100v2 – 5\n\nUn exemple simple illustre cette définition.',
      'Les risques se mesurent.\n\nToute reproduction sans autorisation du Centre français d’exploitation du droit de copie est strictement interdite. – © Editions T.I. Parution : avril 2013\n\nAG 1 100v2 – 6',
      `| AG1100v2.fm Page 8 Lundi, 8. avril 2013 10:31 Ce document a ete delivre pour le compte de 7200105995 - c.n.e.s. centre spatial de toulouse ${'Probabilité Intolérable Gérable '.repeat(12)}|\n| --- |\n\nLa cartographie des risques.`,
      'Doc. AG 1 100v2 – 1\n\nPour en savoir plus.',
      'Les ouvrages de référence.\n\nDoc. AG 1 100v2 – 2'
    ]
    const { text } = cleanPages(pages, known)
    expect(text).not.toMatch(/AG 1 100v2|reproduction|Parution|AG1100v2\.fm|\| --- \|/)
    expect(text).toContain('La GGR se définit comme une démarche transversale.')
    expect(text).toContain('Les risques se mesurent.')
    expect(text).toContain('La cartographie des risques.')
    expect(text).toContain('Pour en savoir plus.')
    expect(text).toContain('Les ouvrages de référence.')
    // Une phrase du texte qui reprend quelques-uns de leurs mots reste.
    expect(cleanPages(['La reproduction du centre de copie est autorisée ici.', 'Autre page.'], known).text).toContain('La reproduction du centre de copie est autorisée ici.')
    // « Article 1.2.3 », sur deux pages : du texte, pas un numéro de page.
    expect(cleanPages(['Article 1.2.3\n\nTexte un.', 'Article 4.5.6\n\nTexte deux.']).text).toContain('Article 4.5.6')
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
