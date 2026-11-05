// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Pour chaque format, trois constats affichés sur sa fiche :
 *
 * - **lu** par Black Projects : l'état de son lecteur (intégré, en développement, prévu) ;
 * - **écrit** par Black Projects : ce que l'application produit elle-même dans ce format
 *   (`WRITTEN`, ci-dessous). Les fichiers importés sont gardés tels quels : ce n'est pas
 *   « écrire » un format ;
 * - **affiché** dans l'application hôte : visible dans la liste des fichiers ou non —
 *   c'est la plateforme qui le dit (`Platform.display`), Obsidian ne montrant pas, par
 *   défaut, les extensions qu'il n'ouvre pas (un export de types en `.json`, par exemple).
 *
 * Quand Black Projects se met à écrire un format, c'est ici qu'on le déclare.
 */

import type { FactValue, FeatureFact, FeatureStatus } from '../../core/modules/module'
import type { DisplayKind, FileDisplay } from '../../core/ports'

const k = (key: string) => `lecture-fichiers.fact.${key}`

export type WriteSupport = { support: 'yes'; whatKey: string } | { support: 'in-progress'; step: number; whatKey: string }

/** Ce que Black Projects écrit, ou écrira, par extension. Ce qui n'y est pas n'est pas écrit. */
export const WRITTEN: Readonly<Record<string, WriteSupport>> = {
  md: { support: 'yes', whatKey: k('write.md') },
  json: { support: 'yes', whatKey: k('write.json') },
  reqif: { support: 'in-progress', step: 4, whatKey: k('write.reqif') },
  docx: { support: 'in-progress', step: 7, whatKey: k('write.deliverables') },
  xlsx: { support: 'in-progress', step: 7, whatKey: k('write.deliverables') },
  pptx: { support: 'in-progress', step: 7, whatKey: k('write.deliverables') }
}

/** Les extensions regroupées par valeur, dans l'ordre de la fiche. */
function grouped(extensions: readonly string[], valueOf: (ext: string) => Omit<FactValue, 'extensions'>): FactValue[] {
  const groups = new Map<string, { value: Omit<FactValue, 'extensions'>; extensions: string[] }>()
  for (const ext of extensions) {
    const value = valueOf(ext)
    const key = JSON.stringify(value)
    const group = groups.get(key) ?? { value, extensions: [] }
    group.extensions.push(ext)
    groups.set(key, group)
  }
  // Une seule valeur pour toute la fiche : pas besoin de rappeler les extensions.
  if (groups.size === 1) return [...groups.values()].map((group) => group.value)
  // Ce qui se fait d'abord (oui, puis en cours), ce qui ne se fait pas ensuite.
  const order: Record<FactValue['tone'], number> = { yes: 0, partial: 1, no: 2 }
  return [...groups.values()]
    .sort((a, b) => order[a.value.tone] - order[b.value.tone])
    .map((group) => ({ ...group.value, extensions: group.extensions }))
}

const READ: Record<FeatureStatus, Omit<FactValue, 'extensions'>> = {
  available: { textKey: k('read.yes'), tone: 'yes' },
  'in-progress': { textKey: k('read.in-progress'), tone: 'partial' },
  planned: { textKey: k('read.planned'), tone: 'no' }
}

function written(ext: string): Omit<FactValue, 'extensions'> {
  const entry = WRITTEN[ext]
  if (!entry) return { textKey: k('write.no'), tone: 'no' }
  if (entry.support === 'yes') return { textKey: k('write.yes'), tone: 'yes', tooltipKey: entry.whatKey }
  return { textKey: k('write.in-progress'), vars: { step: entry.step }, tone: 'partial', tooltipKey: entry.whatKey }
}

const DISPLAYED: Record<DisplayKind, Omit<FactValue, 'extensions'>> = {
  opens: { textKey: k('display.opens'), tone: 'yes', tooltipKey: k('display.opens.tip') },
  listed: { textKey: k('display.listed'), tone: 'partial', tooltipKey: k('display.listed.tip') },
  hidden: { textKey: k('display.hidden'), tone: 'no', tooltipKey: k('display.hidden.tip') }
}

/** Les trois constats d'une fiche de format ; sans `display`, celui de l'affichage est omis. */
export function formatFacts(extensions: readonly string[], status: FeatureStatus, display?: FileDisplay): FeatureFact[] {
  const facts: FeatureFact[] = [
    { labelKey: k('read'), values: [READ[status]] },
    { labelKey: k('write'), values: grouped(extensions, written) }
  ]
  if (display) facts.push({ labelKey: k('display'), values: grouped(extensions, (ext) => DISPLAYED[display.kind(ext)]) })
  return facts
}
