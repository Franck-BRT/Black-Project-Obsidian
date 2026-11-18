// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * « Où enregistrer l'export ? » : la fenêtre propose le dossier et le nom habituels ; on
 * peut les changer ; un fichier déjà là n'est jamais écrasé ; renoncer n'écrit rien.
 */

import { describe, expect, it } from 'vitest'
import { askExportPath, cleanExportFolder, exportPathProblem } from '../src/core/exportPath'
import { createI18n } from '../src/core/i18n'
import { ACCEPT_FORM, memoryPlatform } from '../src/core/testing/memoryPlatform'

const i18n = createI18n('fr')
const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
const place = { folder: 'Black Projects/Échanges', name: 'Workflows 2026-11-18', extension: 'json' }

describe('où enregistrer un export', () => {
  it('propose le dossier et le nom habituels ; validés tels quels, c’est le chemin d’avant', async () => {
    const platform = memoryPlatform()
    platform.forms.push(ACCEPT_FORM)
    expect(await askExportPath({ ui: platform.ui, fs: platform.fs, t }, place)).toBe('Black Projects/Échanges/Workflows 2026-11-18.json')
    const form = platform.asked.at(-1)!
    expect(form.title).toBe('Où enregistrer l’export ?')
    expect(form.submit).toBe('Exporter')
    expect(form.fields.map((field) => `${field.key}=${'value' in field ? field.value : ''}`)).toEqual(['folder=Black Projects/Échanges', 'name=Workflows 2026-11-18'])
  })

  it('un autre dossier (créé), un autre nom (l’extension tapée gardée une fois) ; déjà là : « (2) »', async () => {
    const platform = memoryPlatform()
    platform.forms.push({ folder: ' /Partage/ Équipe / ', name: 'Mes workflows.JSON' })
    expect(await askExportPath({ ui: platform.ui, fs: platform.fs, t }, place)).toBe('Partage/Équipe/Mes workflows.json')
    await platform.fs.writeText('Partage/Équipe/Mes workflows.json', '{}')
    platform.forms.push({ folder: 'Partage/Équipe', name: 'Mes workflows' })
    expect(await askExportPath({ ui: platform.ui, fs: platform.fs, t }, place)).toBe('Partage/Équipe/Mes workflows (2).json')
    // Vide : à la racine du coffre.
    platform.forms.push({ folder: '', name: 'À la racine' })
    expect(await askExportPath({ ui: platform.ui, fs: platform.fs, t }, place)).toBe('À la racine.json')
  })

  it('renoncer : rien ; un nom ou un dossier impossibles sont refusés, avec la raison', async () => {
    const platform = memoryPlatform()
    expect(await askExportPath({ ui: platform.ui, fs: platform.fs, t }, place)).toBeNull()
    expect(exportPathProblem(t, 'a/../b', 'x')).toBe('Le dossier ne peut pas contenir « . » ni « .. ».')
    expect(exportPathProblem(t, 'a', '  ')).toBe('Donnez un nom au fichier.')
    expect(exportPathProblem(t, 'a', 'x/y')).toMatch(/^Le nom ne peut pas contenir/)
    expect(exportPathProblem(t, 'Partage', 'Workflows')).toBeNull()
    expect(cleanExportFolder('//a\\b/ c //')).toBe('a/b/c')
  })
})
