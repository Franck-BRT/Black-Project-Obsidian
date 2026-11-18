// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Ne confirmer que ce qu'on change** : dans « Modifier… », seul un champ changé est confirmé —
 * les autres, encore à confirmer, le restent ; dans « À confirmer », le « Modifier… » d'une ligne
 * n'ouvre que ce champ-là.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type PageView } from '../src/core/views'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

const MODULES = [lectureFichiersModule, bibliothequeModule]
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { bibliotheque: { circuit: false, explorateur: false } }
  const views = new ViewsRegistry()
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: () => {}
    }
    await module.activate(context)
  }
  const load = (record: string): Promise<PageView> => views.pages().find((each) => each.id === 'bibliotheque.document')!.load(encodeURIComponent(record))
  return { load }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('ne confirmer que ce qu’on change', () => {
  it('« Modifier… » : le titre seul changé — lui seul confirmé, les autres toujours à confirmer', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    const record = (await pourIntoLibrary([{ name: 'Note.txt', bytes: new TextEncoder().encode('Une note sans grand-chose.') }], { module: 'bibliotheque', label: '' }))!.added[0]!.record
    const before = read(platform, record)
    expect(before).toMatch(/\ntitreAConfirmer: true\n/)
    expect(before).toMatch(/\ndateAConfirmer: true\n/)
    expect(before).toMatch(/\ncategorieAConfirmer: true\n/)
    // La fenêtre, telle qu'elle s'ouvre ; puis ses valeurs, le titre seul changé.
    const fiche = await load(record)
    platform.forms.push(null)
    await fiche.actions!.find((action) => action.id === 'classify')!.run()
    const values = Object.fromEntries(platform.asked.at(-1)!.fields.map((field) => [field.key, 'value' in field ? String(field.value ?? '') : '']))
    platform.forms.push({ ...values, title: 'Note de cadrage' })
    await fiche.actions!.find((action) => action.id === 'classify')!.run()
    const after = read(platform, record)
    expect(after).toMatch(/\ntitre: Note de cadrage\n/)
    expect(after).not.toMatch(/\ntitreAConfirmer: true\n/)
    expect(after).toMatch(/\ndateAConfirmer: true\n/)
    expect(after).toMatch(/\ncategorieAConfirmer: true\n/)
    expect(after).toMatch(/\netiquettesAConfirmer: true\n/)
    expect(after).toMatch(/\nidentiteAConfirmer: true\n/)
  })

  it('« À confirmer » : le « Modifier… » d’une ligne n’ouvre que son champ', async () => {
    const platform = memoryPlatform()
    const { load } = await start(platform)
    const record = (await pourIntoLibrary([{ name: 'Note.txt', bytes: new TextEncoder().encode('Une note sans grand-chose.') }], { module: 'bibliotheque', label: '' }))!.added[0]!.record
    const fiche = await load(record)
    const section = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.a-confirmer')!
    const rows = section.blocks.flatMap((block) => (block.kind === 'list' ? block.items : []))
    const title = rows.find((row) => row.title === 'Titre')!
    platform.forms.push({ value: 'Note de cadrage' })
    await title.actions!.find((action) => action.id === 'classify-title')!.run()
    expect(platform.asked.at(-1)!.fields.map((field) => field.key)).toEqual(['value'])
    const after = read(platform, record)
    expect(after).toMatch(/\ntitre: Note de cadrage\n/)
    expect(after).not.toMatch(/\ntitreAConfirmer: true\n/)
    expect(after).toMatch(/\ndateAConfirmer: true\n/)
  })
})
