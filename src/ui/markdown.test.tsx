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
      { kind: 'paragraph', text: 'Une ligne qui continue.' },
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

  it('rien n’est injecté : une balise reste du texte', () => {
    const out = html('<script>alert(1)</script>\n\n<b>gras</b> et **vrai gras**')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script>')
    expect(out).toContain('<strong>vrai gras</strong>')
  })

  it('le bloc « markdown » d’une page : mis en forme ; vide, il le dit', () => {
    const t = createI18n('fr').t
    expect(renderToString(<BlockView block={{ kind: 'markdown', text: '- un\n- deux', title: 'Texte' }} t={t} now={new Date()} locale="fr-FR" />)).toContain('<h3 class="bp-block-title">Texte</h3><div class="bp-md"><ul><li>un</li><li>deux</li></ul></div>')
    expect(renderToString(<BlockView block={{ kind: 'markdown', text: '  ', empty: 'Rien.' }} t={t} now={new Date()} locale="fr-FR" />)).toContain('Rien.')
  })
})
