// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import type { ModuleContext } from '../../core/modules/module'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { aliasTargets, configureAliases, normalizeExtension, readAliases, resolveExtension, validateAlias } from './aliases'
import { formatsCatalogue } from './catalogue'
import { fileText, isReadable, lectureFichiersModule, readableExtensions, readVaultFile } from '.'

const TOT = '<?xml version="1.0"?><essai><mesure nom="T3">25,4</mesure></essai>'

afterEach(() => configureAliases({}))

describe('extensions équivalentes', () => {
  it('nettoie la saisie', () => {
    expect(normalizeExtension(' .TOT ')).toBe('tot')
    expect(normalizeExtension('*.tot')).toBe('tot')
    expect(normalizeExtension('tot')).toBe('tot')
  })

  it('accepte une extension inconnue vers un format lu', () => {
    expect(validateAlias('tot', 'xml', {})).toBeNull()
    expect(aliasTargets()).toContain('xml')
    expect(aliasTargets()).toContain('pdf')
    expect(aliasTargets()).not.toContain('png')
  })

  it('refuse de redéfinir un format déjà lu, une cible non lue, un doublon ou une saisie invalide', () => {
    expect(validateAlias('pdf', 'txt', {})?.key).toBe('lecture-fichiers.alias.error.native')
    expect(validateAlias('png', 'txt', {})?.key).toBe('lecture-fichiers.alias.error.native')
    expect(validateAlias('tot', 'dwg', {})?.key).toBe('lecture-fichiers.alias.error.target')
    expect(validateAlias('tot', 'xml', { tot: 'txt' })).toEqual({
      key: 'lecture-fichiers.alias.error.exists',
      vars: { from: 'tot', to: 'txt' }
    })
    expect(validateAlias('', 'xml', {})?.key).toBe('lecture-fichiers.alias.error.invalid')
    expect(validateAlias('a b', 'xml', {})?.key).toBe('lecture-fichiers.alias.error.invalid')
  })

  it('relit les réglages en écartant ce qui n’est plus valable', () => {
    expect(readAliases({ aliases: { tot: 'xml', '.RES': 'txt', pdf: 'txt', x: 'dwg', y: 3 } })).toEqual({
      tot: 'xml',
      res: 'txt'
    })
    expect(readAliases({})).toEqual({})
    expect(readAliases({ aliases: ['tot'] })).toEqual({})
  })

  it('lit un .tot comme du XML, partout où le module lit', async () => {
    const platform = memoryPlatform({ 'Essais/banc.tot': TOT })
    expect(await readVaultFile(platform.fs, 'Essais/banc.tot')).toMatchObject({ ok: false, problem: 'unsupported' })
    expect(isReadable('tot')).toBe(false)

    configureAliases({ tot: 'xml' })
    expect(resolveExtension('TOT')).toBe('xml')
    expect(isReadable('tot')).toBe(true)
    expect(readableExtensions().has('tot')).toBe(true)
    expect(await readVaultFile(platform.fs, 'Essais/banc.tot')).toMatchObject({
      ok: true,
      extension: 'tot',
      readAs: 'xml',
      text: TOT
    })
    expect(await fileText('tot', new TextEncoder().encode(TOT))).toBe(TOT)
  })

  it('montre les extensions ajoutées dans le catalogue des formats', () => {
    const catalogue = formatsCatalogue({ tot: 'xml' })
    const added = catalogue.sections.at(-1)
    expect(added?.titleKey).toBe('lecture-fichiers.alias.section')
    expect(added?.features).toEqual([
      expect.objectContaining({ tags: ['tot'], status: 'available', vars: { from: 'tot', to: 'xml' } })
    ])
    expect(formatsCatalogue({}).sections.some((section) => section.titleKey === 'lecture-fichiers.alias.section')).toBe(
      false
    )
  })
})

describe('le module et ses réglages', () => {
  it('applique les équivalences enregistrées, puis celles qui changent', async () => {
    let stored: Record<string, unknown> = { aliases: { tot: 'xml' } }
    const listeners: ((values: Record<string, unknown>) => void)[] = []
    const platform = memoryPlatform({ 'banc.tot': TOT, 'banc.res': 'Résultat : conforme' })
    const context: ModuleContext = {
      moduleId: lectureFichiersModule.id,
      platform,
      i18n: createI18n('fr'),
      settings: {
        get: () => stored,
        save: async (values) => {
          stored = values
          for (const listener of listeners) listener(values)
        },
        onChange: (listener) => {
          listeners.push(listener)
          return () => listeners.splice(listeners.indexOf(listener), 1)
        }
      },
      commands: { register: () => {} }
    }
    context.i18n.register('fr', lectureFichiersModule.texts.fr)
    await lectureFichiersModule.activate(context)
    expect(isReadable('tot')).toBe(true)
    expect(isReadable('res')).toBe(false)

    await context.settings.save({ aliases: { tot: 'xml', res: 'txt' } })
    expect(isReadable('res')).toBe(true)

    expect(await readVaultFile(platform.fs, 'banc.res')).toMatchObject({ ok: true, readAs: 'txt' })

    await lectureFichiersModule.deactivate?.()
    expect(isReadable('tot')).toBe(false)
    expect(listeners).toHaveLength(0)
  })
})
