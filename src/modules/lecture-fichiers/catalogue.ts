// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le catalogue des formats : ce que le module lit aujourd'hui, et ce qui arrive.
 *
 * C'est ce que montre la fenêtre « Formats de fichiers » : une ligne par famille de
 * documents, **une fiche par extension** — et plusieurs fiches pour une même extension
 * quand ses cas diffèrent (un PDF à texte natif se lit, un PDF scanné pas encore). Un test
 * vérifie que les extensions marquées « intégrées » sont exactement celles que `fileText`
 * lit : la vitrine ne peut pas promettre plus que le code, ni oublier ce qu'il sait faire.
 *
 * Quand un format passe de « en développement » à « intégré », c'est ici qu'on change
 * son état, en même temps qu'on branche son lecteur dans `readers/fileText.ts`.
 */

import type { FeatureStatus, ModuleDetails, ModuleFeature } from '../../core/modules/module'
import type { FileDisplay } from '../../core/ports'
import { cardFacts, cardLook, SHOWN_KEY } from './capabilities'

const k = (key: string) => `lecture-fichiers.format.${key}`

/** Une fiche : une extension, un cas, son état de lecture. */
export interface FormatCard {
  readonly extension: string
  /** La clé de son libellé (et de sa précision, `<clé>.note`). */
  readonly key: string
  readonly status: FeatureStatus
  readonly step?: number
  /** Une précision partagée par plusieurs fiches (les images). */
  readonly noteKey?: string
}

export interface FormatSection {
  readonly titleKey: string
  readonly cards: readonly FormatCard[]
}

const card = (extension: string, key: string, status: FeatureStatus, extra: { step?: number; noteKey?: string } = {}): FormatCard => ({
  extension,
  key,
  status,
  ...extra
})

const image = (extension: string, key: string) => card(extension, key, 'in-progress', { step: 7, noteKey: k('image.note') })

export const FORMAT_SECTIONS: readonly FormatSection[] = [
  {
    titleKey: k('section.pdf'),
    cards: [
      card('pdf', 'pdf-text', 'available'),
      card('pdf', 'pdf-protected', 'available'),
      card('pdf', 'pdf-scan', 'in-progress', { step: 7 }),
      card('pdf', 'pdf-password', 'planned')
    ]
  },
  {
    titleKey: k('section.word'),
    cards: [
      card('docx', 'docx', 'available'),
      card('doc', 'doc', 'available'),
      card('dot', 'dot', 'available'),
      card('rtf', 'rtf', 'available'),
      card('odt', 'odt', 'planned')
    ]
  },
  {
    titleKey: k('section.sheets'),
    cards: [
      card('xlsx', 'xlsx', 'available'),
      card('xlsm', 'xlsm', 'available'),
      card('xls', 'xls', 'available'),
      card('ods', 'ods', 'planned')
    ]
  },
  {
    titleKey: k('section.slides'),
    cards: [card('pptx', 'pptx', 'available'), card('ppt', 'ppt', 'planned'), card('odp', 'odp', 'planned')]
  },
  {
    titleKey: k('section.text'),
    cards: [
      card('md', 'markdown', 'available'),
      card('html', 'html', 'available'),
      card('htm', 'htm', 'available'),
      card('txt', 'txt', 'available'),
      card('csv', 'csv', 'available'),
      card('tsv', 'tsv', 'available'),
      card('json', 'json', 'available'),
      card('xml', 'xml', 'available'),
      card('yaml', 'yaml', 'available'),
      card('yml', 'yml', 'available'),
      card('ics', 'ics', 'available')
    ]
  },
  {
    titleKey: k('section.bench'),
    cards: [
      card('log', 'log', 'available'),
      card('result', 'result', 'available'),
      card('err', 'err', 'available'),
      card('spy', 'spy', 'available')
    ]
  },
  {
    titleKey: k('section.mail'),
    cards: [card('eml', 'eml', 'available'), card('msg', 'msg', 'planned')]
  },
  {
    titleKey: k('section.images'),
    cards: [image('png', 'png'), image('jpg', 'jpg'), image('jpeg', 'jpeg'), image('webp', 'webp'), image('gif', 'gif')]
  },
  {
    titleKey: k('section.exchange'),
    cards: [
      card('zip', 'zip', 'available'),
      card('reqif', 'reqif', 'in-progress', { step: 4 }),
      card('reqifz', 'reqifz', 'in-progress', { step: 4 })
    ]
  }
]

/** Une fiche telle que la fenêtre la dessine : ses trois constats, sa couleur, et l'interrupteur d'affichage. */
function feature(
  base: Pick<ModuleFeature, 'labelKey' | 'noteKey' | 'vars'>,
  extension: string,
  status: FeatureStatus,
  step: number | undefined,
  display: FileDisplay | undefined
): ModuleFeature {
  const facts = cardFacts(extension, status, step, display)
  return {
    ...base,
    prefix: `.${extension}`,
    status,
    ...(step === undefined ? {} : { step }),
    facts,
    ...cardLook(facts, extension, status, step),
    ...(display?.canShow(extension)
      ? {
          switch: {
            settingsKey: SHOWN_KEY,
            id: extension,
            listed: 'on' as const,
            tooltipKeys: { on: 'lecture-fichiers.show.on', off: 'lecture-fichiers.show.off' }
          }
        }
      : {})
  }
}

/**
 * Le catalogue tel que la fenêtre le montre : une fiche par extension, avec ce que
 * Black Projects en lit et en écrit et ce que la plateforme en affiche (`display`), puis
 * une ligne « Extensions ajoutées » avec les équivalences déclarées par l'utilisateur.
 */
export function formatsCatalogue(aliases: Readonly<Record<string, string>>, display?: FileDisplay): ModuleDetails {
  const added = Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b))
  const sections = FORMAT_SECTIONS.map((section) => ({
    titleKey: section.titleKey,
    features: section.cards.map((each) =>
      feature(
        { labelKey: k(each.key), noteKey: each.noteKey ?? k(`${each.key}.note`) },
        each.extension,
        each.status,
        each.step,
        display
      )
    )
  }))
  if (added.length > 0) {
    sections.push({
      titleKey: 'lecture-fichiers.alias.section',
      features: added.map(([from, to]) =>
        feature(
          { labelKey: 'lecture-fichiers.alias.label', noteKey: 'lecture-fichiers.alias.note', vars: { from, to } },
          from,
          'available',
          undefined,
          display
        )
      )
    })
  }
  return {
    titleKey: 'lecture-fichiers.details.title',
    introKey: 'lecture-fichiers.details.intro',
    columns: 3,
    toneKeys: {
      yes: { label: 'lecture-fichiers.tone.yes', tip: 'lecture-fichiers.tone.yes.tip' },
      partial: { label: 'lecture-fichiers.tone.partial', tip: 'lecture-fichiers.tone.partial.tip' },
      no: { label: 'lecture-fichiers.tone.no', tip: 'lecture-fichiers.tone.no.tip' }
    },
    sections
  }
}

/** Toutes les extensions annoncées « lecture intégrée » par le module lui-même : textes et archives. */
export function availableExtensions(sections: readonly FormatSection[] = FORMAT_SECTIONS): Set<string> {
  return new Set(
    sections.flatMap((section) => section.cards.filter((each) => each.status === 'available').map((each) => each.extension))
  )
}
