// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { buildXlsx } from '../../core/writers/xlsx'
import { extensionOf, readVaultFile } from '.'

describe('readVaultFile', () => {
  it('rend le texte d’un fichier du coffre, et le temps mis à le lire', async () => {
    const platform = memoryPlatform({ 'AO/RC.md': '# Règlement\n\nRemise le 15 janvier 2027.' })
    let clock = 1000
    const outcome = await readVaultFile(platform.fs, 'AO/RC.md', { now: () => (clock += 5) })
    expect(outcome).toEqual({
      ok: true,
      path: 'AO/RC.md',
      extension: 'md',
      readAs: 'md',
      text: '# Règlement\n\nRemise le 15 janvier 2027.',
      ms: 5
    })
  })

  it('lit un classeur Excel', async () => {
    const workbook = buildXlsx([{ name: 'BPU', columns: [{ label: 'Poste', width: 8 }], rows: [['Antenne']] }])
    const platform = memoryPlatform({ 'BPU.xlsx': workbook })
    const outcome = await readVaultFile(platform.fs, 'BPU.xlsx')
    expect(outcome.ok && outcome.text).toBe('## BPU\n\n| Poste |\n| Antenne |')
  })

  it('dit pourquoi un fichier ne se lit pas, sans lever d’exception', async () => {
    const platform = memoryPlatform({ 'plan.dwg': 'x', 'vide.txt': '  ', 'faux.pdf': 'pas un PDF' })
    expect(await readVaultFile(platform.fs, 'plan.dwg')).toMatchObject({ ok: false, problem: 'unsupported' })
    expect(await readVaultFile(platform.fs, 'vide.txt')).toMatchObject({ ok: false, problem: 'empty' })
    expect(await readVaultFile(platform.fs, 'faux.pdf')).toMatchObject({ ok: false, problem: 'unreadable' })
    expect(await readVaultFile(platform.fs, 'absent.pdf')).toMatchObject({ ok: false, problem: 'unreadable' })
  })

  it('tire l’extension du nom, en minuscules', () => {
    expect(extensionOf('AO/Pièces/CCTP.PDF')).toBe('pdf')
    expect(extensionOf('AO/.cache/sans-extension')).toBe('')
    expect(extensionOf('archive.tar.gz')).toBe('gz')
  })
})
