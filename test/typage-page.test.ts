// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La tuile **Types de pièces** du module Typage des pièces : avec des pages, elle mène à la
 * page du module (les types, leurs mots-clés, importer et exporter) et la déclare ; sans
 * page chez la plateforme, la fenêtre du module, comme avant.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { typagePiecesModule } from '../src/modules/typage-pieces'

async function start(withPages: boolean) {
  const i18n = createI18n('fr')
  i18n.register('fr', typagePiecesModule.texts.fr)
  const views = new ViewsRegistry()
  const shown: string[] = []
  const windows: string[] = []
  let settings: Record<string, unknown> = {}
  const context: ModuleContext = {
    moduleId: 'typage-pieces',
    platform: memoryPlatform(),
    i18n,
    settings: { get: () => settings, save: async (values) => void (settings = values), onChange: () => () => {} },
    commands: { register: () => {} },
    views,
    openWindow: () => void windows.push('fenêtre'),
    ...(withPages ? { showPage: (id: string) => void shown.push(id) } : {})
  }
  await (typagePiecesModule as BlackModule).activate(context)
  return { views, shown, windows }
}

afterEach(async () => {
  await typagePiecesModule.deactivate?.()
})

describe('la tuile des types de pièces', () => {
  it('avec des pages : la page du module, déclarée par la tuile ; pas la fenêtre', async () => {
    const { views, shown, windows } = await start(true)
    const tile = views.allTiles().find((each) => each.id === 'typage.types')!
    expect(tile.page).toBe('core.fonctions?typage-pieces')
    await tile.run()
    expect(shown).toEqual(['core.fonctions?typage-pieces'])
    expect(windows).toEqual([])
  })

  it('sans page chez la plateforme : la fenêtre du module, comme avant', async () => {
    const { views, shown, windows } = await start(false)
    const tile = views.allTiles().find((each) => each.id === 'typage.types')!
    expect(tile.page).toBeUndefined()
    await tile.run()
    expect(windows).toEqual(['fenêtre'])
    expect(shown).toEqual([])
  })
})
