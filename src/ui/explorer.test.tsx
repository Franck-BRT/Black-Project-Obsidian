// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { createI18n } from '../core/i18n'
import type { Explorer } from '../core/views'
import { ExplorerTree } from './explorer'

describe('l’arborescence d’une page (un explorateur de fichiers)', () => {
  const i18n = createI18n('fr')
  const t = i18n.t.bind(i18n)
  const explorer: Explorer = {
    label: 'Les bibliothèques',
    nodes: [
      { id: 'hub', label: 'Bibliothèque', icon: 'home', open: { id: 'open', label: 'Bibliothèque', run: () => undefined } },
      {
        id: 'groupe.documents',
        label: 'Bibliothèques de documents',
        icon: 'book',
        expanded: true,
        children: [
          {
            id: 'document:principale',
            label: 'Documents',
            icon: 'book',
            count: '7',
            open: { id: 'open', label: 'Ouvrir', run: () => undefined },
            children: [{ id: 'document:principale:Normes', label: 'Normes', icon: 'folder', count: '2', current: true, open: { id: 'open', label: 'Ouvrir', run: () => undefined } }]
          },
          { id: 'document:references', label: 'Documents de référence', icon: 'star', count: '0', open: { id: 'open', label: 'Ouvrir', run: () => undefined }, children: [{ id: 'document:references:Guides', label: 'Guides', icon: 'folder', count: '0' }] }
        ]
      }
    ]
  }

  it('un arbre : chaque nœud son nom et son nombre ; le lieu montré marqué, le chemin qui y mène déplié, le reste replié', () => {
    const html = renderToString(<ExplorerTree explorer={explorer} t={t} />)
    expect(html).toContain('<nav class="bp-explorer" aria-label="Les bibliothèques"><ul role="tree"')
    // Un groupe : un intitulé, pas un lien.
    expect(html).toMatch(/<span class="bp-explorer-open is-heading">.*?Bibliothèques de documents/)
    // Le lieu montré : marqué ; Documents, qui y mène, déplié.
    expect(html).toMatch(/<div class="bp-explorer-row is-current"[^>]*>.*?aria-current="page"[^>]*>.*?Normes<\/span><span class="bp-explorer-count">2<\/span>/)
    expect(html).toMatch(/<li role="treeitem" aria-expanded="true" aria-selected="false" aria-label="Documents \(7\)">/)
    // Les documents de référence : repliés, leurs répertoires pas montrés.
    expect(html).toMatch(/<li role="treeitem" aria-expanded="false" aria-selected="false" aria-label="Documents de référence \(0\)">/)
    expect(html).not.toContain('Guides')
    expect(html).toContain('aria-label="Déplier « Documents de référence »"')
  })
})
