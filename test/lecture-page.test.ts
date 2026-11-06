// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La tuile **Formats** du module Lecture de fichiers : avec des pages, elle mène à la page
 * du module (ses formats, ce qui est lu, écrit, affiché) et la déclare, pour être marquée
 * « page en cours » ; sans page chez la plateforme, la fenêtre du module, comme avant.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

async function start(withPages: boolean) {
  const i18n = createI18n('fr')
  i18n.register('fr', lectureFichiersModule.texts.fr)
  const views = new ViewsRegistry()
  const shown: string[] = []
  const windows: string[] = []
  let settings: Record<string, unknown> = {}
  const context: ModuleContext = {
    moduleId: 'lecture-fichiers',
    platform: memoryPlatform(),
    i18n,
    settings: { get: () => settings, save: async (values) => void (settings = values), onChange: () => () => {} },
    commands: { register: () => {} },
    views,
    openWindow: () => void windows.push('fenêtre'),
    ...(withPages ? { showPage: (id: string) => void shown.push(id) } : {})
  }
  await (lectureFichiersModule as BlackModule).activate(context)
  return { views, shown, windows }
}

afterEach(async () => {
  await lectureFichiersModule.deactivate?.()
})

describe('la tuile des formats', () => {
  it('avec des pages : la page du module, déclarée par la tuile ; pas la fenêtre', async () => {
    const { views, shown, windows } = await start(true)
    const tile = views.allTiles().find((each) => each.id === 'lecture.formats')!
    expect(tile.page).toBe('core.fonctions?lecture-fichiers')
    await tile.run()
    expect(shown).toEqual(['core.fonctions?lecture-fichiers'])
    expect(windows).toEqual([])
  })

  it('sans page chez la plateforme : la fenêtre du module, comme avant', async () => {
    const { views, shown, windows } = await start(false)
    const tile = views.allTiles().find((each) => each.id === 'lecture.formats')!
    expect(tile.page).toBeUndefined()
    await tile.run()
    expect(windows).toEqual(['fenêtre'])
    expect(shown).toEqual([])
  })
})
