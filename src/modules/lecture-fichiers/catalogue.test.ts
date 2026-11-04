// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { availableExtensions, FORMATS_CATALOGUE } from './catalogue'
import { ARCHIVE_EXTENSIONS } from './archive'
import { isReadable, TEXT_EXTENSIONS } from './readers/fileText'

const features = FORMATS_CATALOGUE.sections.flatMap((section) => section.features)

describe('catalogue des formats', () => {
  it('annonce « Lecture intégrée » pour exactement les extensions que le module lit', () => {
    expect([...availableExtensions()].sort()).toEqual([...TEXT_EXTENSIONS, ...ARCHIVE_EXTENSIONS].sort())
  })

  it('n’annonce à venir que des extensions non lues, hormis les cas particuliers du PDF', () => {
    // Un PDF scanné ou protégé par mot de passe reste un .pdf : l’extension est lue, pas
    // encore ce cas-là. Les autres extensions à venir ne sont vraiment pas lues.
    const future = features.filter((feature) => feature.status !== 'available')
    for (const feature of future) {
      const shared = (feature.tags ?? []).filter((tag) => TEXT_EXTENSIONS.has(tag) || ARCHIVE_EXTENSIONS.has(tag))
      if (shared.length > 0) expect(shared).toEqual(['pdf'])
    }
  })

  it('donne une étape du plan à ce qui est en développement', () => {
    for (const feature of features.filter((each) => each.status === 'in-progress')) {
      expect(feature.step, feature.labelKey).toBeTypeOf('number')
    }
  })

  it('compte le PDF à texte natif comme intégré et le PDF scanné comme en développement', () => {
    const byKey = new Map(features.map((feature) => [feature.labelKey, feature]))
    expect(byKey.get('lecture-fichiers.format.pdf-text')?.status).toBe('available')
    expect(byKey.get('lecture-fichiers.format.pdf-scan')?.status).toBe('in-progress')
    expect(isReadable('pdf')).toBe(true)
  })
})
