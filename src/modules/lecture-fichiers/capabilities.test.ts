// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les constats des fiches de formats : lu, écrit, affiché. */

import { describe, expect, it } from 'vitest'
import type { FileDisplay } from '../../core/ports'
import { formatFacts } from './capabilities'
import { formatsCatalogue } from './catalogue'

/** Comme Obsidian par défaut : notes, PDF et images ouverts, le reste masqué. */
const obsidianLike: FileDisplay = { kind: (ext) => (['md', 'pdf', 'png', 'jpg'].includes(ext) ? 'opens' : 'hidden') }

const fiche = (label: string, display?: FileDisplay) =>
  formatsCatalogue({ tot: 'xml' }, display)
    .sections.flatMap((section) => section.features)
    .find((feature) => feature.labelKey === label)!

describe('les constats d’une fiche de format', () => {
  it('lu : l’état du lecteur', () => {
    expect(formatFacts(['pdf'], 'available')[0]).toEqual({
      labelKey: 'lecture-fichiers.fact.read',
      values: [{ textKey: 'lecture-fichiers.fact.read.yes', tone: 'yes' }]
    })
    expect(formatFacts(['png'], 'in-progress')[0]?.values[0]?.tone).toBe('partial')
    expect(formatFacts(['odt'], 'planned')[0]?.values[0]?.tone).toBe('no')
  })

  it('écrit : par extension, regroupé quand la fiche mélange', () => {
    const plain = fiche('lecture-fichiers.format.plain').facts!.find((fact) => fact.labelKey === 'lecture-fichiers.fact.write')!
    // Une valeur par sens, ce qui se fait d'abord : « oui » pour .json, « non » pour le reste.
    expect(plain.values).toEqual([
      {
        textKey: 'lecture-fichiers.fact.write.yes',
        tone: 'yes',
        tooltipKey: 'lecture-fichiers.fact.write.json',
        extensions: ['json']
      },
      { textKey: 'lecture-fichiers.fact.write.no', tone: 'no', extensions: ['txt', 'csv', 'tsv', 'xml', 'yaml', 'yml', 'ics'] }
    ])
    const markdown = fiche('lecture-fichiers.format.markdown').facts![1]!
    expect(markdown.values).toEqual([{ textKey: 'lecture-fichiers.fact.write.yes', tone: 'yes', tooltipKey: 'lecture-fichiers.fact.write.md' }])
    const docx = fiche('lecture-fichiers.format.docx').facts![1]!
    expect(docx.values[0]).toMatchObject({ textKey: 'lecture-fichiers.fact.write.in-progress', vars: { step: 7 }, tone: 'partial' })
  })

  it('affiché : selon la plateforme, et omis si elle ne sait pas le dire', () => {
    expect(fiche('lecture-fichiers.format.plain').facts).toHaveLength(2)
    const shown = (label: string) => fiche(label, obsidianLike).facts!.find((fact) => fact.labelKey === 'lecture-fichiers.fact.display')!
    expect(shown('lecture-fichiers.format.pdf-text').values).toEqual([
      { textKey: 'lecture-fichiers.fact.display.opens', tone: 'yes', tooltipKey: 'lecture-fichiers.fact.display.opens.tip' }
    ])
    expect(shown('lecture-fichiers.format.plain').values).toEqual([
      { textKey: 'lecture-fichiers.fact.display.hidden', tone: 'no', tooltipKey: 'lecture-fichiers.fact.display.hidden.tip' }
    ])
    // Les extensions ajoutées par l'utilisateur ont aussi leurs constats.
    expect(shown('lecture-fichiers.alias.label').values[0]?.textKey).toBe('lecture-fichiers.fact.display.hidden')
  })
})
