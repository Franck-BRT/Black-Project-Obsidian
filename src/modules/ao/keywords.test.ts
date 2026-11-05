// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { utf8 } from '../../core/formats/zip'
import { createI18n } from '../../core/i18n'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { aoFeatures } from '.'
import { aoFr } from './i18n'
import { keywordTargets, normalizeKeyword, readCustomKeywords, validateKeyword } from './keywords'
import { classifyPiece } from './pieces'
import { createAnalysis, importFiles } from './service'
import { typesMarkdown } from './typesDoc'

describe('mots-clés personnalisés : saisie', () => {
  it('nettoie la saisie sans toucher aux accents ni à la casse', () => {
    expect(normalizeKeyword('  Grille   de  prix ')).toBe('Grille de prix')
  })

  it('accepte un mot-clé nouveau vers un type, et refuse le reste', () => {
    expect(validateKeyword('names', 'SPEC', 'CCTP', {})).toBeNull()
    expect(validateKeyword('names', '—', 'CCTP', {})?.key).toBe('ao.keywords.error.invalid')
    expect(validateKeyword('names', 'x'.repeat(61), 'CCTP', {})?.key).toBe('ao.keywords.error.invalid')
    expect(validateKeyword('names', 'SPEC', 'AUTRE', {})?.key).toBe('ao.keywords.error.type')
    expect(validateKeyword('names', 'SPEC', 'XYZ', {})?.key).toBe('ao.keywords.error.type')
    expect(validateKeyword('names', 'spéc', 'BPU', { SPEC: 'CCTP' })).toEqual({
      key: 'ao.keywords.error.exists',
      vars: { keyword: 'SPEC', type: 'CCTP' }
    })
    expect(validateKeyword('names', 'cctp', 'CCTP', {})?.key).toBe('ao.keywords.error.builtIn')
    // Un mot du module pour le titre reste possible pour le nom, et inversement.
    expect(validateKeyword('titles', 'CCTP', 'CCTP', {})).toBeNull()
    expect(keywordTargets()).not.toContain('AUTRE')
  })

  it('relit les réglages en écartant ce qui n’est plus valable', () => {
    expect(
      readCustomKeywords({ motsClesNom: { SPEC: 'CCTP', ' grille  de prix ': 'BPU', x: 'XYZ', y: 3 }, motsClesTitre: ['non'] })
    ).toEqual({ names: { SPEC: 'CCTP', 'grille de prix': 'BPU' }, titles: {}, types: {}, disabled: [] })
  })
})

describe('mots-clés personnalisés : reconnaissance', () => {
  const custom = { names: { SPEC: 'CCTP', 'grille de prix': 'BPU' }, titles: { 'dossier technique de référence': 'CCTP' }, types: {} }

  it('reconnaît une pièce par un mot-clé de l’utilisateur', () => {
    expect(classifyPiece('SPEC_sol_v2.pdf', '', custom)).toBe('CCTP')
    expect(classifyPiece('Grille-de-prix.xlsx', '', custom)).toBe('BPU')
    expect(classifyPiece('doc.pdf', 'DOSSIER TECHNIQUE DE RÉFÉRENCE\n\nArticle 1', custom)).toBe('CCTP')
    expect(classifyPiece('SPEC_sol_v2.pdf')).toBe('AUTRE')
  })

  it('fait passer les mots de l’utilisateur avant ceux du module', () => {
    expect(classifyPiece('Annexe SPEC.pdf')).toBe('ANNEXE')
    expect(classifyPiece('Annexe SPEC.pdf', '', custom)).toBe('CCTP')
  })

  it('les applique à l’import', async () => {
    const platform = memoryPlatform()
    const i18n = createI18n('fr')
    i18n.register('fr', aoFr)
    const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: 'AO', today: () => '2026-11-05', keywords: custom }
    const analysis = await createAnalysis(services, 'Essai', { position: 'candidat', buyer: '', reference: '' })
    const report = await importFiles(services, analysis, [{ name: 'SPEC.md', bytes: utf8('# Spécification') }])
    expect(report.imported[0]?.type).toBe('CCTP')
  })
})

describe('mots-clés personnalisés : affichage', () => {
  it('apparaissent dans la fenêtre Fonctions, à part de ceux du module', () => {
    const section = aoFeatures({ names: { SPEC: 'CCTP' }, titles: { 'grille tarifaire': 'BPU' }, types: {} }).sections.find(
      (each) => each.titleKey === 'ao.types.section'
    )
    const groups = (code: string) =>
      Object.fromEntries((section?.features.find((each) => each.prefix === code)?.tagGroups ?? []).map((group) => [group.labelKey, group.tags]))
    expect(groups('CCTP')['ao.types.addedName']).toEqual(['SPEC'])
    expect(groups('CCTP')['ao.types.byName']).not.toContain('SPEC')
    expect(groups('BPU')['ao.types.addedTitle']).toEqual(['grille tarifaire'])
  })

  it('apparaissent dans la documentation, marqués « ajouté »', () => {
    const i18n = createI18n('fr')
    i18n.register('fr', aoFr)
    const table = typesMarkdown(i18n.t.bind(i18n), { names: { SPEC: 'CCTP' }, titles: {}, types: {} })
    expect(table).toContain('`statement of work`, `SPEC` *(ajouté)* |')
  })
})
