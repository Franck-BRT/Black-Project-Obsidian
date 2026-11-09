// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { decodeHtml, readHtml } from './htmlRead'

describe('readHtml', () => {
  it('lit titres, paragraphes, listes et tableaux, sans scripts ni styles', () => {
    const blocks = readHtml(
      '<html><head><style>p{}</style><script>alert(1)</script></head><body>' +
        '<h2>Article 4 — Pénalités</h2><p>Une p&eacute;nalit&eacute; de 1&nbsp;% par jour.</p>' +
        '<ul><li>Retard de livraison</li></ul>' +
        '<table><tr><th>Jalon</th><th>Date</th></tr><tr><td>Remise</td><td>15/01/2027</td></tr></table>' +
        '</body></html>'
    )
    const texts = blocks.map((block) => (block.kind === 'table' ? block.rows : `${block.style}:${block.text}`))
    expect(texts).toContainEqual('heading:Article 4 — Pénalités')
    expect(texts).toContainEqual('normal:Une pénalité de 1 % par jour.')
    expect(texts).toContainEqual('list:Retard de livraison')
    expect(texts).toContainEqual([
      ['Jalon', 'Date'],
      ['Remise', '15/01/2027']
    ])
    // L'espace insécable devient une espace simple : la recherche la trouve comme les autres.
    expect(JSON.stringify(blocks)).not.toContain('alert')
  })

  it('une liste dans une liste : un niveau de plus ; une liste numérotée le dit', () => {
    const blocks = readHtml('<ol><li>Préparer<ul><li>Le site</li><li>Les accès<ul><li>Badges</li></ul></li></ul></li><li>Livrer</li></ol>')
    expect(blocks.map((block) => (block.kind === 'p' ? [block.text, block.listLevel ?? 0, block.ordered ?? false] : null))).toEqual([
      ['Préparer', 0, true],
      ['Le site', 1, false],
      ['Les accès', 1, false],
      ['Badges', 2, false],
      ['Livrer', 0, true]
    ])
  })

  it('décode les entités nommées et numériques', () => {
    expect(decodeHtml('&lt;CCTP&gt; &amp; &#233;t&#xE9;')).toBe('<CCTP> & été')
  })
})
