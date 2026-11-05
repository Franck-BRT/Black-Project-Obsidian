// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import { typingDetails } from './catalogue'
import { typageFr } from './i18n'
import { keywordTargets, normalizeKeyword, readCustomKeywords, validateKeyword } from './custom'
import { classifyPiece } from './types'
import { typesMarkdown } from './doc'

describe('mots-clés personnalisés : saisie', () => {
  it('nettoie la saisie sans toucher aux accents ni à la casse', () => {
    expect(normalizeKeyword('  Grille   de  prix ')).toBe('Grille de prix')
  })

  it('accepte un mot-clé nouveau vers un type, et refuse le reste', () => {
    expect(validateKeyword('names', 'SPEC', 'CCTP', {})).toBeNull()
    expect(validateKeyword('names', '—', 'CCTP', {})?.key).toBe('typage-pieces.keywords.error.invalid')
    expect(validateKeyword('names', 'x'.repeat(61), 'CCTP', {})?.key).toBe('typage-pieces.keywords.error.invalid')
    expect(validateKeyword('names', 'SPEC', 'AUTRE', {})?.key).toBe('typage-pieces.keywords.error.type')
    expect(validateKeyword('names', 'SPEC', 'XYZ', {})?.key).toBe('typage-pieces.keywords.error.type')
    expect(validateKeyword('names', 'spéc', 'BPU', { SPEC: 'CCTP' })).toEqual({
      key: 'typage-pieces.keywords.error.exists',
      vars: { keyword: 'SPEC', type: 'CCTP' }
    })
    expect(validateKeyword('names', 'cctp', 'CCTP', {})?.key).toBe('typage-pieces.keywords.error.builtIn')
    // Un mot du module pour le titre reste possible pour le nom, et inversement.
    expect(validateKeyword('titles', 'CCTP', 'CCTP', {})).toBeNull()
    expect(keywordTargets()).not.toContain('AUTRE')
  })

  it('relit les réglages en écartant ce qui n’est plus valable', () => {
    expect(
      readCustomKeywords({ motsClesNom: { SPEC: 'CCTP', ' grille  de prix ': 'BPU', x: 'XYZ', y: 3 }, motsClesTitre: ['non'] })
    ).toEqual({ names: { SPEC: 'CCTP', 'grille de prix': 'BPU' }, titles: {}, types: {}, disabled: [], places: {} })
  })
})

describe('mots-clés personnalisés : affichage', () => {
  it('apparaissent dans la fenêtre Fonctions, à part de ceux du module', () => {
    const section = typingDetails({ names: { SPEC: 'CCTP' }, titles: { 'grille tarifaire': 'BPU' }, types: {} }).sections.find(
      (each) => each.titleKey === 'typage-pieces.types.section'
    )
    const groups = (code: string) =>
      Object.fromEntries((section?.features.find((each) => each.prefix === code)?.tagGroups ?? []).map((group) => [group.labelKey, group.tags]))
    expect(groups('CCTP')['typage-pieces.types.addedName']).toEqual(['SPEC'])
    expect(groups('CCTP')['typage-pieces.types.byName']).not.toContain('SPEC')
    expect(groups('BPU')['typage-pieces.types.addedTitle']).toEqual(['grille tarifaire'])
  })

  it('apparaissent dans la documentation, marqués « ajouté »', () => {
    const i18n = createI18n('fr')
    i18n.register('fr', typageFr)
    const table = typesMarkdown(i18n.t.bind(i18n), { names: { SPEC: 'CCTP' }, titles: {}, types: {} })
    expect(table).toContain('`statement of work`, `SPEC` *(ajouté)* |')
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
})
