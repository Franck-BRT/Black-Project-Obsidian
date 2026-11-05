// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { availableExtensions, FORMAT_SECTIONS, formatsCatalogue } from './catalogue'
import { ARCHIVE_EXTENSIONS } from './archive'
import { isReadable, TEXT_EXTENSIONS } from './readers/fileText'

const cards = FORMAT_SECTIONS.flatMap((section) => section.cards)
const readable = (ext: string) => TEXT_EXTENSIONS.has(ext) || ARCHIVE_EXTENSIONS.has(ext)

describe('catalogue des formats', () => {
  it('annonce « lu » pour exactement les extensions que le module lit', () => {
    expect([...availableExtensions()].sort()).toEqual([...TEXT_EXTENSIONS, ...ARCHIVE_EXTENSIONS].sort())
  })

  it('une fiche par extension ; seul le PDF en a plusieurs, une par cas', () => {
    const counts = new Map<string, number>()
    for (const each of cards) counts.set(each.extension, (counts.get(each.extension) ?? 0) + 1)
    expect([...counts].filter(([, count]) => count > 1)).toEqual([['pdf', 4]])
  })

  it('n’annonce à venir que des extensions non lues, hormis les cas particuliers du PDF', () => {
    for (const each of cards.filter((card) => card.status !== 'available')) {
      if (readable(each.extension)) expect(each.extension).toBe('pdf')
    }
  })

  it('donne une étape du plan à ce qui est en développement', () => {
    for (const each of cards.filter((card) => card.status === 'in-progress')) expect(each.step, each.key).toBeTypeOf('number')
  })

  it('compte le PDF à texte natif comme lu et le PDF scanné comme à venir', () => {
    const byKey = new Map(cards.map((each) => [each.key, each]))
    expect(byKey.get('pdf-text')?.status).toBe('available')
    expect(byKey.get('pdf-scan')?.status).toBe('in-progress')
    expect(isReadable('pdf')).toBe(true)
  })

  it('trois fiches par ligne, colorées par leurs constats', () => {
    const details = formatsCatalogue({})
    expect(details.columns).toBe(3)
    expect(details.sections[0]?.features[0]).toMatchObject({ prefix: '.pdf', labelKey: 'lecture-fichiers.format.pdf-text' })
  })
})
