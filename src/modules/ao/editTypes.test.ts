// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { utf8 } from '../../core/formats/zip'
import { createI18n } from '../../core/i18n'
import type { ModuleContext } from '../../core/modules/module'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { aoModule } from '.'
import { aoFr } from './i18n'
import { afterTypeChange, currentCode, describeTypeRemoval, readCustomKeywords, readRenames } from './keywords'
import { applyRenames, createAnalysis, importFiles } from './service'

const i18n = createI18n('fr')
i18n.register('fr', aoFr)
const t = i18n.t.bind(i18n)

const base = {
  typesPerso: { PAQ: 'Plan qualité', PGE: 'Plan de gestion' },
  motsClesNom: { 'plan qualité': 'PAQ', SPEC: 'CCTP' },
  motsClesTitre: { 'assurance qualité': 'PAQ' }
}

describe('modifier un type ajouté', () => {
  it('un nouveau code est repris par les mots-clés, et le renommage est gardé', () => {
    const settings = afterTypeChange(
      { kind: 'edit', from: 'PAQ2', to: 'Plan qualité', previousFrom: 'PAQ', previousTo: 'Plan qualité' },
      { ...base, typesPerso: { PAQ2: 'Plan qualité', PGE: 'Plan de gestion' } }
    )
    expect(settings.motsClesNom).toEqual({ 'plan qualité': 'PAQ2', SPEC: 'CCTP' })
    expect(settings.motsClesTitre).toEqual({ 'assurance qualité': 'PAQ2' })
    expect(readRenames(settings)).toEqual({ PAQ: 'PAQ2' })
    expect(readCustomKeywords(settings).names).toEqual({ 'plan qualité': 'PAQ2', SPEC: 'CCTP' })
  })

  it('un libellé changé ne touche à rien d’autre', () => {
    const settings = afterTypeChange({ kind: 'edit', from: 'PAQ', to: 'Plan d’assurance', previousFrom: 'PAQ', previousTo: 'Plan qualité' }, base)
    expect(settings.motsClesNom).toEqual(base.motsClesNom)
    expect(readRenames(settings)).toEqual({})
  })

  it('des renommages successifs se suivent, et un code recréé redevient le sien', () => {
    let settings: Record<string, unknown> = { ...base }
    settings = afterTypeChange({ kind: 'edit', from: 'PAQ2', to: 'x', previousFrom: 'PAQ', previousTo: 'x' }, settings)
    settings = afterTypeChange({ kind: 'edit', from: 'PAQ3', to: 'x', previousFrom: 'PAQ2', previousTo: 'x' }, settings)
    expect(readRenames(settings)).toEqual({ PAQ: 'PAQ3', PAQ2: 'PAQ3' })
    expect(currentCode('PAQ', readRenames(settings))).toBe('PAQ3')
    settings = afterTypeChange({ kind: 'add', from: 'PAQ', to: 'Nouveau' }, settings)
    expect(readRenames(settings)).toEqual({ PAQ2: 'PAQ3' })
    expect(currentCode('CCTP', readRenames(settings))).toBe('CCTP')
  })
})

describe('supprimer un type ajouté', () => {
  it('retire ses mots-clés, et dit ce que la suppression emporte', () => {
    const settings = afterTypeChange({ kind: 'remove', from: 'PAQ', to: 'Plan qualité' }, { ...base, typesPerso: { PGE: 'Plan de gestion' } })
    expect(settings.motsClesNom).toEqual({ SPEC: 'CCTP' })
    expect(settings.motsClesTitre).toEqual({})
    // Les renommages qui menaient au type supprimé sont oubliés.
    expect(readRenames(afterTypeChange({ kind: 'remove', from: 'PQA', to: 'x' }, { typesRenommes: { PAQ: 'PQA', A: 'B' } }))).toEqual({ A: 'B' })
    const message = describeTypeRemoval('PAQ', 'Plan qualité', base, t)
    expect(message).toContain('Le type PAQ — « Plan qualité » ne sera plus proposé ni reconnu.')
    expect(message).toContain('2 mot(s)-clé(s) personnalisé(s)')
    expect(message).toContain('type retiré')
    expect(describeTypeRemoval('PGE', 'Plan de gestion', base, t)).not.toContain('mot(s)-clé(s)')
  })
})

describe('pièces déjà importées', () => {
  it('prennent le nouveau code d’un type renommé, dans toutes les analyses', async () => {
    const platform = memoryPlatform()
    const keywords = { names: {}, titles: {}, types: { PAQ: 'Plan qualité' } }
    const services = { fs: platform.fs, t, root: 'AO', today: () => '2026-11-05', keywords }
    const one = await createAnalysis(services, 'Un', { position: 'candidat', buyer: '', reference: '' })
    const two = await createAnalysis(services, 'Deux', { position: 'candidat', buyer: '', reference: '' })
    const [a] = (await importFiles(services, one, [{ name: 'PAQ_v1.md', bytes: utf8('# Plan') }])).imported
    await importFiles(services, two, [{ name: 'PAQ_v2.md', bytes: utf8('# Plan') }])
    expect(a?.type).toBe('PAQ')

    const renamed = { ...services, keywords: { ...keywords, types: { PAQ2: 'Plan qualité' } }, renames: { PAQ: 'PAQ2' } }
    expect(await applyRenames(renamed)).toBe(2)
    expect(await platform.fs.readText(a!.note)).toContain('type: PAQ2')
    expect(await platform.fs.readText(one.note)).toContain('| PAQ2 — Plan qualité |')
    expect(await applyRenames(renamed)).toBe(0)
  })

  it('suivent dès que le module voit le renommage dans ses réglages', async () => {
    const platform = memoryPlatform()
    let stored: Record<string, unknown> = { dossier: 'AO', typesPerso: { PAQ: 'Plan qualité' } }
    const listeners: ((values: Record<string, unknown>) => void)[] = []
    const context: ModuleContext = {
      moduleId: 'ao',
      platform,
      i18n,
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
    await aoModule.activate(context)
    const services = { fs: platform.fs, t, root: 'AO', today: () => '2026-11-05', keywords: readCustomKeywords(stored) }
    const analysis = await createAnalysis(services, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    const [piece] = (await importFiles(services, analysis, [{ name: 'PAQ_v1.md', bytes: utf8('# Plan') }])).imported

    await context.settings.save(afterTypeChange(
      { kind: 'edit', from: 'PQA', to: 'Plan qualité', previousFrom: 'PAQ', previousTo: 'Plan qualité' },
      { ...stored, typesPerso: { PQA: 'Plan qualité' } }
    ))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await platform.fs.readText(piece!.note)).toContain('type: PQA')
    expect(platform.notices.at(-1)).toBe('1 pièce(s) déjà importée(s) ont pris le nouveau code.')
    await aoModule.deactivate?.()
    expect(listeners).toHaveLength(0)
  })
})
