// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le catalogue des formats : ce que le module lit aujourd'hui, et ce qui arrive.
 *
 * C'est ce que les réglages montrent quand on clique sur « Lecture de fichiers », une
 * ligne par famille de documents, un bloc par format. Un test vérifie que les formats
 * marqués « Lecture intégrée » sont exactement ceux que `fileText` lit : la vitrine ne
 * peut pas promettre plus que le code, ni oublier ce qu'il sait faire.
 *
 * Quand un format passe de « en développement » à « intégré », c'est ici qu'on change
 * son état, en même temps qu'on branche son lecteur dans `readers/fileText.ts`.
 */

import type { ModuleDetails, ModuleFeature } from '../../core/modules/module'

const k = (key: string) => `lecture-fichiers.format.${key}`

function format(
  key: string,
  status: ModuleFeature['status'],
  tags: readonly string[],
  extra: { step?: number; note?: boolean } = {}
): ModuleFeature {
  return {
    labelKey: k(key),
    ...(extra.note === false ? {} : { noteKey: k(`${key}.note`) }),
    tags,
    status,
    ...(extra.step === undefined ? {} : { step: extra.step })
  }
}

export const FORMATS_CATALOGUE: ModuleDetails = {
  titleKey: 'lecture-fichiers.details.title',
  introKey: 'lecture-fichiers.details.intro',
  statusKeys: {
    available: 'lecture-fichiers.status.available',
    'in-progress': 'lecture-fichiers.status.in-progress',
    planned: 'lecture-fichiers.status.planned'
  },
  sections: [
    {
      titleKey: k('section.pdf'),
      features: [
        format('pdf-text', 'available', ['pdf']),
        format('pdf-protected', 'available', ['pdf']),
        format('pdf-scan', 'in-progress', ['pdf'], { step: 6 }),
        format('pdf-password', 'planned', ['pdf'])
      ]
    },
    {
      titleKey: k('section.word'),
      features: [
        format('docx', 'available', ['docx']),
        format('doc', 'available', ['doc', 'dot']),
        format('rtf', 'available', ['rtf']),
        format('odt', 'planned', ['odt'])
      ]
    },
    {
      titleKey: k('section.sheets'),
      features: [
        format('xlsx', 'available', ['xlsx', 'xlsm']),
        format('xls', 'available', ['xls']),
        format('ods', 'planned', ['ods'])
      ]
    },
    {
      titleKey: k('section.slides'),
      features: [format('pptx', 'available', ['pptx']), format('ppt', 'planned', ['ppt']), format('odp', 'planned', ['odp'])]
    },
    {
      titleKey: k('section.text'),
      features: [
        format('html', 'available', ['html', 'htm']),
        format('markdown', 'available', ['md']),
        format('plain', 'available', ['txt', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'ics']),
        format('bench', 'available', ['log', 'result', 'err', 'spy'])
      ]
    },
    {
      titleKey: k('section.mail'),
      features: [format('eml', 'available', ['eml']), format('msg', 'planned', ['msg'])]
    },
    {
      titleKey: k('section.images'),
      features: [format('images', 'in-progress', ['png', 'jpg', 'jpeg', 'webp', 'gif'], { step: 6 })]
    },
    {
      titleKey: k('section.exchange'),
      features: [
        format('zip', 'in-progress', ['zip'], { step: 2 }),
        format('reqif', 'in-progress', ['reqif', 'reqifz'], { step: 4 })
      ]
    }
  ]
}

/** Toutes les extensions annoncées « Lecture intégrée ». */
export function availableExtensions(details: ModuleDetails = FORMATS_CATALOGUE): Set<string> {
  return new Set(
    details.sections.flatMap((section) =>
      section.features.filter((feature) => feature.status === 'available').flatMap((feature) => feature.tags ?? [])
    )
  )
}
