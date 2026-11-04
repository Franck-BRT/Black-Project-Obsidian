// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que l'utilisateur ajoute à la reconnaissance des pièces, pour ses propres dossiers :
 *
 * - des **types de pièces** (« PAQ — Plan d'assurance qualité ») : un code et un libellé ;
 * - des **mots-clés** (« SPEC » pour un CCTP, « grille de prix » pour un BPU) : deux
 *   listes de paires « mot-clé → type », l'une cherchée dans le nom du fichier, l'autre
 *   dans le titre du document.
 *
 * Le tout est rangé dans les réglages du module, et relu sans jamais lui faire confiance :
 * un mot-clé vers un type qui n'existe plus est écarté.
 */

import type { FieldError } from '../../core/modules/module'
import { allTypes, fold, OTHER, PIECE_TYPES, type CustomKeywords } from './pieces'

export const TYPES_KEY = 'typesPerso'
export const NAME_KEYWORDS_KEY = 'motsClesNom'
export const TITLE_KEYWORDS_KEY = 'motsClesTitre'

const MAX_KEYWORD = 60
const MAX_LABEL = 80
const CODE = /^[A-Z0-9][A-Z0-9_-]{0,19}$/

type Settings = Readonly<Record<string, unknown>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ── Les types ajoutés ───────────────────────────────────────────────────────────

/** « pag », « P.A.Q. », «  plan qualité » → « PAG », « PAQ », « PLAN-QUALITE ». */
export function normalizeTypeCode(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\./g, '')
    .replace(/\s+/g, '-')
}

export function normalizeLabel(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

/** `null` si le type peut être ajouté, sinon pourquoi il ne le peut pas. */
export function validateType(code: string, label: string, current: Readonly<Record<string, string>>): FieldError | null {
  if (!CODE.test(code)) return { key: 'ao.types.custom.error.code', vars: { code } }
  if (PIECE_TYPES.some((each) => each.code === code)) return { key: 'ao.types.custom.error.builtIn', vars: { code } }
  if (current[code] !== undefined) return { key: 'ao.types.custom.error.exists', vars: { code, label: current[code]! } }
  if (!label || label.length > MAX_LABEL) return { key: 'ao.types.custom.error.label', vars: { code } }
  return null
}

/** Les types ajoutés, relus des réglages ; ceux qui ne sont plus valables sont écartés. */
export function readCustomTypes(settings: Settings): Record<string, string> {
  const raw = settings[TYPES_KEY]
  const out: Record<string, string> = {}
  if (!isRecord(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue
    const code = normalizeTypeCode(key)
    const label = normalizeLabel(value)
    if (validateType(code, label, out) === null) out[code] = label
  }
  return out
}

// ── Les mots-clés ajoutés ───────────────────────────────────────────────────────

/** Les types qu'un mot-clé peut désigner : tous, ajoutés compris, sauf « autre pièce ». */
export function keywordTargets(types: Readonly<Record<string, string>> = {}): string[] {
  return allTypes({ names: {}, titles: {}, types })
    .filter((each) => each.code !== OTHER)
    .map((each) => each.code)
}

/** La saisie, espaces superflues retirées ; accents et casse gardés pour l'affichage. */
export function normalizeKeyword(input: string): string {
  return normalizeLabel(input)
}

/** `null` si le mot-clé est acceptable pour cette liste, sinon pourquoi il ne l'est pas. */
export function validateKeyword(
  where: 'names' | 'titles',
  keyword: string,
  code: string,
  current: Readonly<Record<string, string>>,
  types: Readonly<Record<string, string>> = {}
): FieldError | null {
  const phrase = fold(keyword.replace(/…$/, ''))
  if (!phrase || keyword.length > MAX_KEYWORD) return { key: 'ao.keywords.error.invalid', vars: { keyword } }
  const type = allTypes({ names: {}, titles: {}, types }).find((each) => each.code === code)
  if (!type || code === OTHER) return { key: 'ao.keywords.error.type', vars: { type: code } }
  const same = Object.keys(current).find((each) => fold(each) === fold(keyword))
  if (same !== undefined) return { key: 'ao.keywords.error.exists', vars: { keyword: same, type: current[same]! } }
  const builtIn = (where === 'names' ? type.names : type.titles).some((each) => fold(each) === fold(keyword))
  if (builtIn) return { key: 'ao.keywords.error.builtIn', vars: { keyword, type: code } }
  return null
}

function readList(where: 'names' | 'titles', raw: unknown, types: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isRecord(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue
    const keyword = normalizeKeyword(key)
    if (validateKeyword(where, keyword, value, out, types) === null) out[keyword] = value
  }
  return out
}

export function readNameKeywords(settings: Settings): Record<string, string> {
  return readList('names', settings[NAME_KEYWORDS_KEY], readCustomTypes(settings))
}

export function readTitleKeywords(settings: Settings): Record<string, string> {
  return readList('titles', settings[TITLE_KEYWORDS_KEY], readCustomTypes(settings))
}

/** Ce que l'utilisateur a ajouté, tel que la reconnaissance l'emploie. */
export function readCustomKeywords(settings: Settings): CustomKeywords {
  return { names: readNameKeywords(settings), titles: readTitleKeywords(settings), types: readCustomTypes(settings) }
}
