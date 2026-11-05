// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import { typingDetails } from './catalogue'
import { typageFr } from './i18n'
import { keywordTargets, normalizeTypeCode, readCustomKeywords, readCustomTypes, validateKeyword, validateType } from './custom'
import { allTypes, classifyPiece, typeLabel } from './types'
import { typesMarkdown } from './doc'

const i18n = createI18n('fr')
i18n.register('fr', typageFr)
const t = i18n.t.bind(i18n)

describe('types personnalisés : saisie', () => {
  it('met le code en forme', () => {
    expect(normalizeTypeCode(' paq ')).toBe('PAQ')
    expect(normalizeTypeCode('P.A.Q.')).toBe('PAQ')
    expect(normalizeTypeCode('plan qualité')).toBe('PLAN-QUALITE')
  })

  it('accepte un nouveau type, et refuse le reste', () => {
    expect(validateType('PAQ', 'Plan d’assurance qualité', {})).toBeNull()
    expect(validateType('', 'Libellé', {})?.key).toBe('typage-pieces.types.custom.error.code')
    expect(validateType('A'.repeat(21), 'Libellé', {})?.key).toBe('typage-pieces.types.custom.error.code')
    expect(validateType('CCTP', 'Autre chose', {})?.key).toBe('typage-pieces.types.custom.error.builtIn')
    expect(validateType('AUTRE', 'Autre chose', {})?.key).toBe('typage-pieces.types.custom.error.builtIn')
    expect(validateType('PAQ', 'Encore', { PAQ: 'Plan qualité' })?.key).toBe('typage-pieces.types.custom.error.exists')
    expect(validateType('PAQ', '', {})?.key).toBe('typage-pieces.types.custom.error.label')
  })

  it('relit les réglages en écartant ce qui n’est plus valable', () => {
    expect(readCustomTypes({ typesPerso: { paq: ' Plan  qualité ', CCTP: 'x', NUL: '', X: 3 } })).toEqual({ PAQ: 'Plan qualité' })
  })
})

describe('types personnalisés : reconnaissance et mots-clés', () => {
  const custom = { names: { 'plan qualité': 'PAQ' }, titles: {}, types: { PAQ: 'Plan d’assurance qualité' } }

  it('s’ajoutent après les types du module, avant « autre pièce »', () => {
    const codes = allTypes(custom).map((each) => each.code)
    expect(codes.at(-1)).toBe('AUTRE')
    expect(codes.at(-2)).toBe('PAQ')
    expect(keywordTargets(custom.types)).toContain('PAQ')
    expect(keywordTargets(custom.types)).not.toContain('AUTRE')
  })

  it('reconnaissent un fichier par leur code, et par les mots-clés qui les désignent', () => {
    expect(classifyPiece('PAQ_v2.pdf', '', custom)).toBe('PAQ')
    expect(classifyPiece('Plan qualité lot 1.pdf', '', custom)).toBe('PAQ')
    expect(classifyPiece('PAQ_v2.pdf')).toBe('AUTRE')
  })

  it('peuvent être visés par un mot-clé, et ses mots-clés disparaissent avec eux', () => {
    expect(validateKeyword('names', 'plan qualité', 'PAQ', {}, custom.types)).toBeNull()
    expect(validateKeyword('names', 'plan qualité', 'PAQ', {}, {})?.key).toBe('typage-pieces.keywords.error.type')
    expect(validateKeyword('names', 'paq', 'PAQ', {}, custom.types)?.key).toBe('typage-pieces.keywords.error.builtIn')
    const settings = { typesPerso: { PAQ: 'Plan qualité' }, motsClesNom: { 'plan qualité': 'PAQ', SPEC: 'CCTP' } }
    expect(readCustomKeywords(settings).names).toEqual({ 'plan qualité': 'PAQ', SPEC: 'CCTP' })
    expect(readCustomKeywords({ ...settings, typesPerso: {} }).names).toEqual({ SPEC: 'CCTP' })
  })

  it('ont leur libellé ; un type retiré est signalé', () => {
    expect(typeLabel('PAQ', custom, t)).toBe('Plan d’assurance qualité')
    expect(typeLabel('CCTP', custom, t)).toBe('Cahier des clauses techniques particulières')
    expect(typeLabel('PAQ', { names: {}, titles: {}, types: {} }, t)).toBe('PAQ (type retiré)')
  })
})

describe('types personnalisés : affichage', () => {
  const custom = { names: { 'plan qualité': 'PAQ' }, titles: {}, types: { PAQ: 'Plan d’assurance qualité' } }

  it('ont leur fiche dans la fenêtre Fonctions', () => {
    const section = typingDetails(custom).sections.find((each) => each.titleKey === 'typage-pieces.types.section')
    const paq = section?.features.find((each) => each.prefix === 'PAQ')
    expect(t(paq!.labelKey, paq!.vars)).toBe('Plan d’assurance qualité')
    expect(paq?.noteKey).toBe('typage-pieces.types.customNote')
    expect(paq?.tagGroups?.[0]?.tags).toEqual(['PAQ'])
    expect(paq?.tagGroups?.[2]?.tags).toEqual(['plan qualité'])
    expect(section?.features.at(-1)?.prefix).toBe('AUTRE')
  })

  it('apparaissent dans la documentation, marqués « ajouté »', () => {
    expect(typesMarkdown(t, custom)).toContain('| PAQ *(ajouté)* | Plan d’assurance qualité | `PAQ`, `plan qualité` *(ajouté)* | — |')
  })
})
