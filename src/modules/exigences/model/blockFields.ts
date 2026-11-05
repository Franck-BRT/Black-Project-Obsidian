// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les colonnes qu'un bloc `pm-req` peut dessiner — à part, parce que deux choses s'en
 * servent : le lecteur du bloc (ligne `fields:`) et les réglages (la liste par défaut).
 */

export const REQ_BLOCK_FIELDS = ['id', 'title', 'text', 'type', 'status', 'criticality', 'verification', 'rating', 'break'] as const
export type ReqBlockField = (typeof REQ_BLOCK_FIELDS)[number]

/** Pas une colonne : la fin d'une ligne de tête et le début de la suivante. Peut revenir plusieurs fois. */
export const REQ_BLOCK_BREAK = 'break'

/** Y a-t-il au moins une vraie colonne ? Une liste de sauts de ligne est vide. */
export function hasColumn(fields: readonly ReqBlockField[]): boolean {
  return fields.some((field) => field !== REQ_BLOCK_BREAK)
}

export function isReqBlockField(value: unknown): value is ReqBlockField {
  return typeof value === 'string' && REQ_BLOCK_FIELDS.includes(value as ReqBlockField)
}

/**
 * Ce qu'un bloc montre quand on ne lui a rien dit. La note de qualité (`rating`) arrive à
 * l'étape 5 : elle n'y est pas encore ; un bloc qui la demande montre un tiret.
 */
export const DEFAULT_REQ_BLOCK_FIELDS: readonly ReqBlockField[] = ['id', 'text', 'status']

/** Une liste relue rendue sûre : les noms inconnus écartés, chaque colonne une fois (les sauts de ligne autant que voulu). */
export function cleanBlockFields(raw: unknown): ReqBlockField[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<ReqBlockField>()
  const kept: ReqBlockField[] = []
  for (const field of raw.filter(isReqBlockField)) {
    if (field !== REQ_BLOCK_BREAK && seen.has(field)) continue
    seen.add(field)
    kept.push(field)
  }
  return kept
}

/** Les colonnes à dessiner : celles du bloc, sinon celles des réglages, sinon celles par défaut. */
export function resolveBlockFields(asked: ReqBlockField[], configured: unknown): ReqBlockField[] {
  if (hasColumn(asked)) return asked
  const kept = cleanBlockFields(configured)
  return hasColumn(kept) ? kept : [...DEFAULT_REQ_BLOCK_FIELDS]
}
