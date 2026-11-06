// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les pages des notes : le premier module qui sait montrer une note donne sa page ; une erreur n'empêche rien. */

import { describe, expect, it } from 'vitest'
import { ViewsRegistry } from './views'

describe('la page d’une note', () => {
  it('le premier module qui la connaît ; un module en erreur est passé ; sinon, pas de page', async () => {
    const views = new ViewsRegistry()
    views.notePage(() => {
      throw new Error('boum')
    })
    views.notePage((path) => (path.startsWith('Exigences/') ? `exigences.fiche?${path}` : null))
    views.notePage(async (path) => (path.endsWith('.md') ? `ao.note?${path}` : null))
    expect(await views.pageForNote('Exigences/REQ-1.md')).toBe('exigences.fiche?Exigences/REQ-1.md')
    expect(await views.pageForNote('Appels/Note.md')).toBe('ao.note?Appels/Note.md')
    expect(await views.pageForNote('image.png')).toBeNull()
  })
})
