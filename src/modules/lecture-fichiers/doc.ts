// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** La page de documentation du module, écrite dans le coffre : le texte de `doc/`, et les formats tels qu'ils sont. */

import { fillTemplate, type DocInput, type DocPage } from '../../core/docs'
import type { FeatureStatus, ModuleDetails } from '../../core/modules/module'
import { readAliases } from './aliases'
import { formatsCatalogue } from './catalogue'
import page from './doc/Lecture de fichiers.md'

const MARK: Record<FeatureStatus, string> = { available: '🟩', 'in-progress': '🟧', planned: '⬜' }

const cell = (text: string) => text.replace(/\|/g, '/').replace(/\n/g, ' ')

/** Le catalogue en tableaux Markdown, une famille par tableau. */
export function formatsMarkdown(details: ModuleDetails, t: DocInput['t']): string {
  const status = (value: FeatureStatus) => t(details.statusKeys?.[value] ?? `module.feature.${value}`)
  return details.sections
    .map((section) => {
      const rows = section.features.map((feature) => {
        const state =
          feature.step !== undefined && feature.status !== 'available'
            ? `${MARK[feature.status]} ${status(feature.status)} · ${t('module.feature.step', { step: feature.step })}`
            : `${MARK[feature.status]} ${status(feature.status)}`
        const tags = (feature.tags ?? []).map((tag) => `\`.${tag}\``).join(' ')
        const note = feature.noteKey ? t(feature.noteKey, feature.vars) : ''
        return `| ${cell(t(feature.labelKey, feature.vars))} | ${tags} | ${state} | ${cell(note)} |`
      })
      return [`### ${t(section.titleKey)}`, '', '| Format | Extensions | État | Précision |', '| --- | --- | --- | --- |', ...rows].join('\n')
    })
    .join('\n\n')
}

export function lectureDocs(input: DocInput): DocPage[] {
  const aliases = readAliases(input.settings)
  const declared = Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b))
  const aliasList =
    declared.length === 0 ? '*Aucune pour le moment.*' : declared.map(([from, to]) => `- \`.${from}\` lu comme \`.${to}\``).join('\n')
  return [
    {
      path: 'Modules/Lecture de fichiers.md',
      content: fillTemplate(page, input.folder, {
        formats: formatsMarkdown(formatsCatalogue(aliases), input.t),
        aliases: aliasList
      })
    }
  ]
}
