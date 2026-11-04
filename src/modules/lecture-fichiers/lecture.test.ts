// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import type { ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { buildXlsx } from '../../core/writers/xlsx'
import { extensionOf, lectureFichiersModule, readVaultFile } from '.'

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

describe('commande « Lire un fichier du coffre »', () => {
  async function command(platform = memoryPlatform()) {
    const commands: ModuleCommand[] = []
    const i18n = createI18n('fr')
    i18n.register('fr', lectureFichiersModule.texts.fr)
    const context: ModuleContext = {
      moduleId: lectureFichiersModule.id,
      platform,
      i18n,
      settings: { get: () => ({}), save: async () => {}, onChange: () => () => {} },
      commands: { register: (each) => void commands.push(each) }
    }
    await lectureFichiersModule.activate(context)
    const read = commands.find((each) => each.id === 'lire-fichier')
    if (!read) throw new Error('commande absente')
    return { platform, read }
  }

  it('fait choisir un fichier lisible, puis montre son texte', async () => {
    const { platform, read } = await command(memoryPlatform({ 'AO/CCTP.md': '# CCTP\n\nEX-1 — Le titulaire doit.' }))
    platform.nextPick = 'AO/CCTP.md'
    await read.run()
    expect([...(platform.picks[0]?.extensions ?? [])]).toContain('pdf')
    expect(platform.shown).toHaveLength(1)
    expect(platform.shown[0]).toMatchObject({ title: 'CCTP.md', text: '# CCTP\n\nEX-1 — Le titulaire doit.' })
    expect(platform.shown[0]?.subtitle).toMatch(/^MD · 33 caractères · 3 lignes · lu en \d+ ms$/)
  })

  it('ne fait rien si l’on renonce', async () => {
    const { platform, read } = await command()
    platform.nextPick = null
    await read.run()
    expect(platform.shown).toEqual([])
    expect(platform.notices).toEqual([])
  })

  it('dit pourquoi un fichier ne se lit pas', async () => {
    const { platform, read } = await command(memoryPlatform({ 'scan.pdf': 'pas un PDF' }))
    platform.nextPick = 'scan.pdf'
    await read.run()
    expect(platform.shown).toEqual([])
    expect(platform.notices.at(-1)).toBe('« scan.pdf » n’a pas pu être lu : fichier abîmé, ou protégé par un mot de passe.')
  })
})
