// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les mots-clés personnalisés : ce que l'utilisateur ajoute à la reconnaissance des types
 * de pièces, pour ses propres dossiers — « SPEC » pour un CCTP, « grille de prix » pour
 * un BPU. Deux listes de paires « mot-clé → type », rangées dans les réglages du module :
 * l'une cherchée dans le nom du fichier, l'autre dans le titre du document.
 */

import type { FieldError } from '../../core/modules/module'
import { fold, OTHER, PIECE_TYPES, type CustomKeywords } from './pieces'

export const NAME_KEYWORDS_KEY = 'motsClesNom'
export const TITLE_KEYWORDS_KEY = 'motsClesTitre'

const MAX_LENGTH = 60

/** Les types qu'un mot-clé peut désigner : tous, sauf « autre pièce ». */
export function keywordTargets(): string[] {
  return PIECE_TYPES.filter((each) => each.code !== OTHER).map((each) => each.code)
}

/** La saisie, espaces superflues retirées ; accents et casse gardés pour l'affichage. */
export function normalizeKeyword(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

/** `null` si le mot-clé est acceptable pour cette liste, sinon pourquoi il ne l'est pas. */
export function validateKeyword(
  where: 'names' | 'titles',
  keyword: string,
  code: string,
  current: Readonly<Record<string, string>>
): FieldError | null {
  const phrase = fold(keyword.replace(/…$/, ''))
  if (!phrase || keyword.length > MAX_LENGTH) return { key: 'ao.keywords.error.invalid', vars: { keyword } }
  const type = PIECE_TYPES.find((each) => each.code === code)
  if (!type || code === OTHER) return { key: 'ao.keywords.error.type', vars: { type: code } }
  const same = Object.keys(current).find((each) => fold(each) === fold(keyword))
  if (same !== undefined) return { key: 'ao.keywords.error.exists', vars: { keyword: same, type: current[same]! } }
  const builtIn = (where === 'names' ? type.names : type.titles).some((each) => fold(each) === fold(keyword))
  if (builtIn) return { key: 'ao.keywords.error.builtIn', vars: { keyword, type: code } }
  return null
}

function readList(where: 'names' | 'titles', raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue
    const keyword = normalizeKeyword(key)
    if (validateKeyword(where, keyword, value, out) === null) out[keyword] = value
  }
  return out
}

export function readNameKeywords(settings: Readonly<Record<string, unknown>>): Record<string, string> {
  return readList('names', settings[NAME_KEYWORDS_KEY])
}

export function readTitleKeywords(settings: Readonly<Record<string, unknown>>): Record<string, string> {
  return readList('titles', settings[TITLE_KEYWORDS_KEY])
}

/** Les mots-clés personnalisés enregistrés, tels que la reconnaissance les emploie. */
export function readCustomKeywords(settings: Readonly<Record<string, unknown>>): CustomKeywords {
  return { names: readNameKeywords(settings), titles: readTitleKeywords(settings) }
}
