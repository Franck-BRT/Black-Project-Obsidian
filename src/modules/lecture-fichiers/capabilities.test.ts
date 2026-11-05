// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les constats des fiches de formats — lu, écrit, affiché —, leur couleur, et l'interrupteur d'affichage. */

import { describe, expect, it } from 'vitest'
import type { ModuleFeature } from '../../core/modules/module'
import type { DisplayKind, FileDisplay } from '../../core/ports'
import { cardFacts, readShown, SHOWN_KEY } from './capabilities'
import { formatsCatalogue } from './catalogue'

/** Comme Obsidian par défaut : notes, PDF et images ouverts ; le reste masqué, sauf ce que l'utilisateur affiche. */
function obsidianLike(shown: string[] = []): FileDisplay {
  const native = ['md', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']
  return {
    kind: (ext): DisplayKind => (native.includes(ext) ? 'native' : shown.includes(ext) ? 'viewer' : 'hidden'),
    canShow: (ext) => !native.includes(ext),
    show: () => {}
  }
}

const card = (label: string, display?: FileDisplay, aliases: Record<string, string> = {}): ModuleFeature =>
  formatsCatalogue(aliases, display)
    .sections.flatMap((section) => section.features)
    .find((feature) => feature.labelKey === label)!

const texts = (feature: ModuleFeature) => feature.facts!.map((fact) => fact.values[0]!.textKey.replace('lecture-fichiers.fact.', ''))

describe('les constats d’une fiche', () => {
  it('lu, écrit : oui en vert, non en rouge, avec ce qui est à venir', () => {
    expect(texts(card('lecture-fichiers.format.markdown'))).toEqual(['yes', 'yes'])
    expect(texts(card('lecture-fichiers.format.txt'))).toEqual(['yes', 'no.never'])
    expect(texts(card('lecture-fichiers.format.docx'))).toEqual(['yes', 'write.exportComing'])
    expect(texts(card('lecture-fichiers.format.png'))).toEqual(['no.step', 'no.never'])
    expect(texts(card('lecture-fichiers.format.odt'))).toEqual(['no.coming', 'no.never'])
    const docx = card('lecture-fichiers.format.docx').facts![1]!.values[0]!
    expect(docx).toMatchObject({ tone: 'no', vars: { step: 7 }, tooltipKey: 'lecture-fichiers.fact.write.deliverables' })
  })

  it('un export compte pour l’écriture : « Export uniquement », en vert', () => {
    for (const label of ['lecture-fichiers.format.json', 'lecture-fichiers.format.pdf-text', 'lecture-fichiers.format.pdf-scan']) {
      expect(card(label).facts![1]!.values[0], label).toMatchObject({ textKey: 'lecture-fichiers.fact.write.export', tone: 'yes' })
    }
    expect(card('lecture-fichiers.format.pdf-text').facts![1]!.values[0]?.tooltipKey).toBe('lecture-fichiers.fact.write.pdf')
  })

  it('affiché : selon la plateforme, et omis si elle ne sait pas le dire', () => {
    expect(card('lecture-fichiers.format.json').facts).toHaveLength(2)
    expect(cardFacts('pdf', 'available', undefined, obsidianLike())[2]?.values[0]?.textKey).toBe('lecture-fichiers.fact.display.native')
    expect(cardFacts('json', 'available', undefined, obsidianLike())[2]?.values[0]?.textKey).toBe('lecture-fichiers.fact.display.hidden')
    expect(cardFacts('json', 'available', undefined, obsidianLike(['json']))[2]?.values[0]).toMatchObject({
      textKey: 'lecture-fichiers.fact.display.viewer',
      tone: 'yes'
    })
  })
})

describe('la couleur et le badge d’une fiche', () => {
  const look = (label: string, display = obsidianLike()) => {
    const feature = card(label, display)
    return [feature.tone, feature.badge?.textKey.replace('lecture-fichiers.badge.', ''), feature.badge?.vars?.step]
  }

  it('verte quand les trois sont oui', () => {
    expect(look('lecture-fichiers.format.markdown')).toEqual(['yes', 'yes', undefined])
    expect(look('lecture-fichiers.format.pdf-text')).toEqual(['yes', 'yes', undefined])
    expect(look('lecture-fichiers.format.json', obsidianLike(['json']))).toEqual(['yes', 'yes', undefined])
  })

  it('orange quand lu ou écrit, mais pas les trois', () => {
    expect(look('lecture-fichiers.format.json')).toEqual(['partial', 'partial', undefined])
    expect(look('lecture-fichiers.format.pdf-scan')).toEqual(['partial', 'partial', undefined])
    expect(look('lecture-fichiers.format.docx')).toEqual(['partial', 'partial', undefined])
  })

  it('rouge quand ni lu ni écrit, en disant si c’est à venir', () => {
    expect(look('lecture-fichiers.format.png')).toEqual(['no', 'step', 7])
    expect(look('lecture-fichiers.format.reqif')).toEqual(['no', 'step', 4])
    expect(look('lecture-fichiers.format.odt')).toEqual(['no', 'coming', undefined])
  })
})

describe('l’interrupteur d’affichage', () => {
  it('sur les fiches des types que la plateforme n’ouvre pas elle-même', () => {
    expect(card('lecture-fichiers.format.json', obsidianLike()).switch).toEqual({
      settingsKey: SHOWN_KEY,
      id: 'json',
      listed: 'on',
      tooltipKeys: { on: 'lecture-fichiers.show.on', off: 'lecture-fichiers.show.off' }
    })
    expect(card('lecture-fichiers.format.pdf-text', obsidianLike()).switch).toBeUndefined()
    expect(card('lecture-fichiers.format.json').switch).toBeUndefined()
    // Une extension équivalente ajoutée par l'utilisateur a aussi le sien.
    expect(card('lecture-fichiers.alias.label', obsidianLike(), { tot: 'xml' }).switch?.id).toBe('tot')
  })

  it('le réglage : une liste d’extensions, nettoyée', () => {
    expect(readShown({ [SHOWN_KEY]: ['json', 'csv', 'json', 3, ''] })).toEqual(['csv', 'json'])
    expect(readShown({})).toEqual([])
  })
})
