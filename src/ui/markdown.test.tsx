// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le Markdown mis en forme : les blocs, la mise en forme en ligne, et rien d'injecté. */

import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { createI18n } from '../core/i18n'
import { BlockView } from './components'
import { Markdown, parseMarkdown } from './markdown'

const html = (text: string) => renderToString(<Markdown text={text} />)

describe('le Markdown mis en forme', () => {
  it('les blocs : titres, paragraphes, listes (imbriquées, numérotées), citations, code, filets, tableaux', () => {
    expect(parseMarkdown('### Titre\n\nUne ligne\nqui continue.\n\n- un\n  - un bis\n- deux\n\n1. premier\n2) second\n\n> cité\n\n```\ncode\n```\n\n---\n\n| A | B |\n| --- | --- |\n| 1 | 2 |')).toEqual([
      { kind: 'heading', level: 3, text: 'Titre' },
      { kind: 'paragraph', text: 'Une ligne<br>qui continue.' },
      { kind: 'list', ordered: false, items: [{ text: 'un', children: [{ kind: 'list', ordered: false, items: [{ text: 'un bis', children: [] }] }] }, { text: 'deux', children: [] }] },
      { kind: 'list', ordered: true, items: [{ text: 'premier', children: [] }, { text: 'second', children: [] }] },
      { kind: 'quote', children: [{ kind: 'paragraph', text: 'cité' }] },
      { kind: 'code', text: 'code' },
      { kind: 'rule' },
      { kind: 'table', head: ['A', 'B'], rows: [['1', '2']] }
    ])
  })

  it('rendu : les éléments, gras, italique, code ; un lien, son texte', () => {
    const out = html('#### Revues\n\nUne **revue** *par mois*, voir `RC` et [le site](https://exemple.fr).\n\n| Lot | Montant |\n|---|---|\n| 1 | **10 k€** |')
    expect(out).toContain('<h4>Revues</h4>')
    expect(out).toContain('<p>Une <strong>revue</strong> <em>par mois</em>, voir <code>RC</code> et le site.</p>')
    expect(out).toContain('<div class="bp-md-table"><table><thead><tr><th>Lot</th><th>Montant</th></tr></thead><tbody><tr><td>1</td><td><strong>10 k€</strong></td></tr></tbody></table></div>')
    expect(out).not.toContain('href')
  })

  it('rien n’est injecté : une balise inconnue reste du texte ; celles d’une mise en forme deviennent des éléments', () => {
    const out = html('<script>alert(1)</script>\n\n<b>gras</b> et **vrai gras** <img src=x onerror=alert(1)>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script>')
    expect(out).toContain('<strong>gras</strong>')
    expect(out).toContain('<strong>vrai gras</strong>')
    expect(out).not.toContain('<img')
  })

  it('le HTML d’une lecture : <br> (aussi dans un tableau), <sup>, <sub>, <u>, les balises de mise en page retirées, les entités', () => {
    const out = html('Ligne un<br>ligne deux<br/>trois<BR />\n\n| Lot | Détail |\n|---|---|\n| 1 | a<br>b |\n\nm<sup>2</sup>, H<sub>2</sub>O, <u>souligné</u>, <span style="color:red">rouge</span>, <p>para</p> <!-- note -->\n\nA&nbsp;&amp;&nbsp;B &lt;tag&gt; &#9744; &#x2612; &inconnu;')
    expect(out).toContain('<p>Ligne un<br/>ligne deux<br/>trois<br/></p>')
    expect(out).toContain('<td>a<br/>b</td>')
    expect(out).toContain('m<sup>2</sup>, H<sub>2</sub>O, <u>souligné</u>, rouge, para ')
    expect(out).not.toContain('span')
    expect(out).not.toContain('note')
    expect(out).toContain('A\u00a0&amp;\u00a0B &lt;tag> ☐ ☒ &amp;inconnu;')
  })

  it('les symboles LaTeX : hors formule, et une formule qui n’est qu’un symbole — leur caractère ; une vraie formule reste une formule', () => {
    const out = html('\\square Oui \\boxtimes Non ; $\\square$ A $\\boxtimes$ B ; \\(\\checkmark\\) fait ; 20 \\% \\times 3 \\leq 5 ; \\inconnu ; $\\text{Oui}\\ \\square$\n\n$$\\square$$\n\n$x^2$')
    expect(out).toContain('☐ Oui ☒ Non ; ☐ A ☒ B ; ✓ fait ; 20 % × 3 ≤ 5 ; \\inconnu ; Oui ☐')
    expect(out).toContain('<p>☐</p>')
    expect(out).toContain('<span class="bp-math"><code>x^2</code></span>')
  })

  it('les cases d’une liste : ☐ / ☒ ; un tableau HTML : un tableau, ses cellules fusionnées (colspan, rowspan)', () => {
    const out = html('- [ ] à faire\n- [x] fait\n\n<table><tr><th>Lot</th><th>Prix</th><th>Note</th></tr>\n<tr><td colspan="2">Tout<br>compris</td><td>&nbsp;ok</td></tr></table>\nAprès.')
    expect(out).toContain('<li>☐ à faire</li><li>☒ fait</li>')
    expect(out).toContain('<thead><tr><th>Lot</th><th>Prix</th><th>Note</th></tr></thead>')
    expect(out).toContain('<tbody><tr><td colspan="2">Tout<br/>compris</td><td>\u00a0ok</td></tr></tbody>')
    expect(out).toContain('<p>Après.</p>')
    expect(parseMarkdown('<table>\n<tr><td>A</td><td>B</td></tr>\n<tr><td colspan=2>C</td></tr>\n</table>')).toEqual([
      { kind: 'grid', head: 1, rows: [[{ text: 'A' }, { text: 'B' }], [{ text: 'C', columns: 2 }]] }
    ])
  })

  it('un tableau HTML : deux lignes d’en-tête (une cellule sur deux lignes, une sur deux colonnes), une cellule sur deux lignes dans le corps', () => {
    const source = [
      '<table>',
      '<tr><th rowspan="2">Lot</th><th colspan="2">Prix</th></tr>',
      '<tr><th>HT</th><th>TTC</th></tr>',
      '<tr><td rowspan="2">1</td><td>10</td><td>12</td></tr>',
      '<tr><td>20</td><td>24</td></tr>',
      '</table>'
    ].join('\n')
    const [grid] = parseMarkdown(source)
    expect(grid).toMatchObject({ kind: 'grid', head: 2 })
    const out = html(source)
    expect(out).toContain('<thead><tr><th rowspan="2">Lot</th><th colspan="2">Prix</th></tr><tr><th>HT</th><th>TTC</th></tr></thead>')
    expect(out).toContain('<tbody><tr><td rowspan="2">1</td><td>10</td><td>12</td></tr><tr><td>20</td><td>24</td></tr></tbody>')
    // Une première ligne en <td> dont une cellule descend : l'en-tête la suit.
    expect(parseMarkdown('<table><tr><td rowspan="3">A</td><td>B</td></tr><tr><td>C</td></tr><tr><td>D</td></tr><tr><td>E</td><td>F</td></tr></table>')[0]).toMatchObject({ kind: 'grid', head: 3 })
  })

  it('le bloc « markdown » d’une page : mis en forme ; vide, il le dit', () => {
    const t = createI18n('fr').t
    expect(renderToString(<BlockView block={{ kind: 'markdown', text: '- un\n- deux', title: 'Texte' }} t={t} now={new Date()} locale="fr-FR" />)).toContain('<h3 class="bp-block-title">Texte</h3><div class="bp-md"><ul><li>un</li><li>deux</li></ul></div>')
    expect(renderToString(<BlockView block={{ kind: 'markdown', text: '  ', empty: 'Rien.' }} t={t} now={new Date()} locale="fr-FR" />)).toContain('Rien.')
  })

  it('le bloc « diff » : gardés, retirés (barrés), ajoutés — dits aux lecteurs d’écran', () => {
    const t = createI18n('fr').t
    const out = renderToString(
      <BlockView
        block={{ kind: 'diff', parts: [{ change: 'same', text: 'A' }, { change: 'removed', text: 'B' }, { change: 'added', text: 'B2' }], labels: { removed: 'Retiré', added: 'Ajouté' } }}
        t={t}
        now={new Date()}
        locale="fr-FR"
      />
    )
    expect(out).toBe('<div class="bp-diff"><p class="bp-diff-same">A</p><del class="bp-diff-removed" aria-label="Retiré : B">B</del><ins class="bp-diff-added" aria-label="Ajouté : B2">B2</ins></div>')
  })
})

describe('les tableaux sans ligne de séparation', () => {
  it('des lignes « | … | » : un tableau, la première en en-tête, sans les colonnes vides', () => {
    expect(parseMarkdown('Avant\n| MARCHE ou CONTRAT | | | | CLASSIFICATION | | | | CATEGORIE | | | |\n| M-12 | | | | C2 | | | | Services | | | |\n\nAprès')).toEqual([
      { kind: 'paragraph', text: 'Avant' },
      { kind: 'table', head: ['MARCHE ou CONTRAT', 'CLASSIFICATION', 'CATEGORIE'], rows: [['M-12', 'C2', 'Services']] },
      { kind: 'paragraph', text: 'Après' }
    ])
    // Un tableau complet : ses colonnes vides de bout en bout retirées aussi.
    expect(parseMarkdown('| a | | b |\n| --- | --- | --- |\n| 1 | | 2 |')).toEqual([{ kind: 'table', head: ['a', 'b'], rows: [['1', '2']] }])
  })
})

describe('les listes aérées, numérotées', () => {
  it('des lignes vides entre ses éléments ne coupent pas une liste ; une numérotée garde son début', () => {
    expect(parseMarkdown('- a\n\n- b\n\n    - b1\n\n- c\n\nFin')).toEqual([
      { kind: 'list', ordered: false, items: [{ text: 'a', children: [] }, { text: 'b', children: [{ kind: 'list', ordered: false, items: [{ text: 'b1', children: [] }] }] }, { text: 'c', children: [] }] },
      { kind: 'paragraph', text: 'Fin' }
    ])
    expect(parseMarkdown('3. trois\n4. quatre\n- puce')).toEqual([
      { kind: 'list', ordered: true, start: 3, items: [{ text: 'trois', children: [] }, { text: 'quatre', children: [] }] },
      { kind: 'list', ordered: false, items: [{ text: 'puce', children: [] }] }
    ])
  })
})

describe('une liste juste après une phrase', () => {
  it('coupe le paragraphe (comme dans Obsidian) ; « 2026. » au fil d’une phrase, non', () => {
    expect(parseMarkdown('Les revues :\n- Conception\n- Recette\nEn 2025, puis\n2026. Fin')).toEqual([
      { kind: 'paragraph', text: 'Les revues :' },
      { kind: 'list', ordered: false, items: [{ text: 'Conception', children: [] }, { text: 'Recette', children: [] }] },
      { kind: 'paragraph', text: 'En 2025, puis<br>2026. Fin' }
    ])
  })
})

describe('les formules mathématiques', () => {
  it('$$…$$ seule (sur une ligne ou plusieurs), \\[…\\] : un bloc ; elle coupe un paragraphe', () => {
    expect(parseMarkdown('Soit :\n$$\n\\frac{a}{b}\n$$\nDonc $$x = 1$$ ici\n\\[ E = mc^2 \\]')).toEqual([
      { kind: 'paragraph', text: 'Soit :' },
      { kind: 'math', text: '\\frac{a}{b}' },
      { kind: 'paragraph', text: 'Donc $$x = 1$$ ici' },
      { kind: 'math', text: 'E = mc^2' }
    ])
  })

  it('en ligne : $…$ et \\(…\\), sans italique dedans ; « 10 $ et 20 $ » reste du texte ; sans moteur, le LaTeX à part', () => {
    const html = renderToString(<Markdown text={'L’aire $\\pi r_1^2$, soit \\(a_b\\) ; prix : 10 $ et 20 $.\n\n$$\\sum_{i=1}^{n} x_i$$'} />)
    expect(html).toContain('<span class="bp-math"><code>\\pi r_1^2</code></span>')
    expect(html).toContain('<span class="bp-math"><code>a_b</code></span>')
    expect(html).toContain('prix : 10 $ et 20 $.')
    expect(html).toContain('<div class="bp-math bp-math-display"><code>\\sum_{i=1}^{n} x_i</code></div>')
    expect(html).not.toContain('<em>')
  })
})


describe('les retours à la ligne, comme dans Obsidian', () => {
  it('un retour à la ligne dans un paragraphe en est un ; les lignes en retrait sous un élément de liste aussi', () => {
    const html = renderToString(<Markdown text={'1. Méthodologie — 2\n    1.1 Notion de risque — 2\n    1.2 Concept — 3\n2. Risques — 12'} />)
    expect(html).toContain('1.1 Notion de risque — 2<br/>1.2 Concept — 3')
    expect(parseMarkdown('Ligne un\nligne deux')).toEqual([{ kind: 'paragraph', text: 'Ligne un<br>ligne deux' }])
  })
})
