// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** La page de documentation du module, écrite dans le coffre : le texte de `doc/`, et les formats tels qu'ils sont. */

import { fillTemplate, type DocInput, type DocPage } from '../../core/docs'
import type { FeatureFact, FeatureStatus, ModuleDetails } from '../../core/modules/module'
import type { FileDisplay } from '../../core/ports'
import { readAliases } from './aliases'
import { formatsCatalogue } from './catalogue'
import page from './doc/Lecture de fichiers.md'

const MARK: Record<FeatureStatus, string> = { available: '🟩', 'in-progress': '🟧', planned: '⬜' }

const cell = (text: string) => text.replace(/\|/g, '/').replace(/\n/g, ' ')

/** L'état de lecture est déjà dans la colonne « État » : les autres constats ont la leur. */
const READ_FACT = 'lecture-fichiers.fact.read'

function factText(fact: FeatureFact | undefined, t: DocInput['t']): string {
  if (!fact) return ''
  return fact.values
    .map((value) => `${t(value.textKey, value.vars)}${value.extensions?.length ? ` (${value.extensions.map((ext) => `.${ext}`).join(', ')})` : ''}`)
    .join(' · ')
}

/** Le catalogue en tableaux Markdown, une famille par tableau. */
export function formatsMarkdown(details: ModuleDetails, t: DocInput['t']): string {
  const status = (value: FeatureStatus) => t(details.statusKeys?.[value] ?? `module.feature.${value}`)
  return details.sections
    .map((section) => {
      const columns = (section.features[0]?.facts ?? []).map((fact) => fact.labelKey).filter((key) => key !== READ_FACT)
      const rows = section.features.map((feature) => {
        const state =
          feature.step !== undefined && feature.status !== 'available'
            ? `${MARK[feature.status]} ${status(feature.status)} · ${t('module.feature.step', { step: feature.step })}`
            : `${MARK[feature.status]} ${status(feature.status)}`
        const tags = (feature.tags ?? []).map((tag) => `\`.${tag}\``).join(' ')
        const note = feature.noteKey ? t(feature.noteKey, feature.vars) : ''
        const facts = columns.map((key) => ` ${cell(factText(feature.facts?.find((fact) => fact.labelKey === key), t))} |`).join('')
        return `| ${cell(t(feature.labelKey, feature.vars))} | ${tags} | ${state} |${facts} ${cell(note)} |`
      })
      const head = ['Format', 'Extensions', 'État', ...columns.map((key) => t(key)), 'Précision']
      return [
        `### ${t(section.titleKey)}`,
        '',
        `| ${head.join(' | ')} |`,
        `| ${head.map(() => '---').join(' | ')} |`,
        ...rows
      ].join('\n')
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
