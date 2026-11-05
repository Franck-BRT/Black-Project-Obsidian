// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** La page de documentation du module, écrite dans le coffre : le texte de `doc/`, et les formats tels qu'ils sont. */

import { fillTemplate, type DocInput, type DocPage } from '../../core/docs'
import type { FactTone, ModuleDetails } from '../../core/modules/module'
import type { FileDisplay } from '../../core/ports'
import { readAliases } from './aliases'
import { formatsCatalogue } from './catalogue'
import page from './doc/Lecture de fichiers.md'

const MARK: Record<FactTone, string> = { yes: '🟩', partial: '🟧', no: '🟥' }

const cell = (text: string) => text.replace(/\|/g, '/').replace(/\n/g, ' ')

/** Le catalogue en tableaux Markdown, une famille par tableau, une ligne par fiche. */
export function formatsMarkdown(details: ModuleDetails, t: DocInput['t']): string {
  return details.sections
    .map((section) => {
      const columns = (section.features[0]?.facts ?? []).map((fact) => fact.labelKey)
      const rows = section.features.map((feature) => {
        const label = `${feature.prefix ?? ''} — ${t(feature.labelKey, feature.vars)}`
        const look = feature.badge ? `${MARK[feature.badge.tone]} ${t(feature.badge.textKey, feature.badge.vars)}` : ''
        const facts = columns.map((key) => {
          const value = feature.facts?.find((fact) => fact.labelKey === key)?.values[0]
          return value ? ` ${cell(t(value.textKey, value.vars))} |` : ' |'
        })
        const note = feature.noteKey ? t(feature.noteKey, feature.vars) : ''
        return `| ${cell(label)} | ${look} |${facts.join('')} ${cell(note)} |`
      })
      const head = ['Format', 'En résumé', ...columns.map((key) => t(key)), 'Précision']
      return [`### ${t(section.titleKey)}`, '', `| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows].join('\n')
    })
    .join('\n\n')
}

export function lectureDocs(input: DocInput, display?: FileDisplay): DocPage[] {
  const aliases = readAliases(input.settings)
  const declared = Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b))
  const aliasList =
    declared.length === 0 ? '*Aucune pour le moment.*' : declared.map(([from, to]) => `- \`.${from}\` lu comme \`.${to}\``).join('\n')
  return [
    {
      path: 'Modules/Lecture de fichiers.md',
      content: fillTemplate(page, input.folder, {
        formats: formatsMarkdown(formatsCatalogue(aliases, display), input.t),
        aliases: aliasList
      })
    }
  ]
}
