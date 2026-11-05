// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les valeurs proposées pour le type, le statut, la criticité et la vérification d'une
 * exigence. Rangées par identifiant (`functional`, `draft`…), comme dans la version
 * complète de Black Projects ; affichées par leur libellé. Une valeur inconnue — une note
 * modifiée à la main — est montrée telle quelle, jamais perdue.
 */

import type { Choice } from '../../core/ports'
import { VERIFICATION_METHODS } from './model/requirement'

export const REQ_TYPES = ['functional', 'performance', 'interface', 'operational', 'constraint', 'safety'] as const
export const REQ_STATUSES = ['draft', 'proposed', 'approved', 'implemented', 'verified', 'rejected', 'obsolete'] as const
export const REQ_CRITICALITIES = ['high', 'medium', 'low'] as const

export type Vocabulary = 'type' | 'status' | 'criticality' | 'verification'

export const VOCABULARIES: Readonly<Record<Vocabulary, readonly string[]>> = {
  type: REQ_TYPES,
  status: REQ_STATUSES,
  criticality: REQ_CRITICALITIES,
  verification: VERIFICATION_METHODS
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Le libellé d'une valeur ; une valeur inconnue telle quelle, une valeur vide en tiret. */
export function vocabularyLabel(kind: Vocabulary, value: string, t: Translate): string {
  if (!value) return '—'
  return VOCABULARIES[kind].includes(value) ? t(`exigences.${kind}.${value}`) : value
}

/** Les choix d'un menu ; `empty` ajoute « — » en tête ; une valeur inconnue déjà rangée est gardée. */
export function vocabularyChoices(kind: Vocabulary, t: Translate, options: { empty?: boolean; current?: string } = {}): Choice[] {
  const choices: Choice[] = VOCABULARIES[kind].map((value) => ({ value, label: t(`exigences.${kind}.${value}`) }))
  if (options.current && !VOCABULARIES[kind].includes(options.current)) {
    choices.push({ value: options.current, label: options.current })
  }
  return options.empty ? [{ value: '', label: '—' }, ...choices] : choices
}
