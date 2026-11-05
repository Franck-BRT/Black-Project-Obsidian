// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Échanger des types de pièces : exporter un ou plusieurs types dans un fichier, et les
 * importer dans un autre coffre — celui d'un collègue, celui d'un autre projet.
 *
 * Le fichier est du JSON lisible :
 *
 * ```json
 * {
 *   "format": "black-projects/types-de-pieces",
 *   "version": 1,
 *   "exporte": "2026-11-05",
 *   "types": [
 *     { "code": "PAQ", "libelle": "Plan d’assurance qualité", "ajoute": true, "desactive": false,
 *       "motsClesNom": ["plan qualité"], "motsClesTitre": [] },
 *     { "code": "CCTP", "ajoute": false, "desactive": false, "motsClesNom": ["SPEC"], "motsClesTitre": [] }
 *   ]
 * }
 * ```
 *
 * Un type ajouté voyage avec son libellé ; un type du module, avec ce que l'utilisateur
 * lui a donné : ses mots-clés, et s'il est désactivé. À l'import, rien n'est écrasé sans
 * raison : un type ajouté existant prend le libellé du fichier, les mots-clés s'ajoutent
 * à ceux qui sont là, ceux qui feraient doublon sont écartés et comptés.
 */

import {
  DISABLED_KEY,
  NAME_KEYWORDS_KEY,
  normalizeKeyword,
  normalizeLabel,
  normalizeTypeCode,
  readCustomTypes,
  readDisabled,
  readNameKeywords,
  readRenames,
  readTitleKeywords,
  RENAMES_KEY,
  TITLE_KEYWORDS_KEY,
  TYPES_KEY,
  validateKeyword,
  validateType
} from './custom'
import { allTypes, OTHER, PIECE_TYPES, type CustomKeywords } from './types'

export const EXCHANGE_FORMAT = 'black-projects/types-de-pieces'
export const EXCHANGE_VERSION = 1

export interface ExchangedType {
  code: string
  /** Pour un type ajouté : son libellé. */
  libelle?: string
  /** Ajouté par l'utilisateur (sinon : un type du module). */
  ajoute: boolean
  desactive: boolean
  motsClesNom: string[]
  motsClesTitre: string[]
}

export interface TypesFile {
  format: typeof EXCHANGE_FORMAT
  version: number
  exporte: string
  types: ExchangedType[]
}

type Settings = Readonly<Record<string, unknown>>

const isBuiltIn = (code: string) => PIECE_TYPES.some((each) => each.code === code)

/** Les types qui ont quelque chose à exporter : les types ajoutés, et ceux du module que l'utilisateur a modifiés. */
export function exportableCodes(custom: CustomKeywords): string[] {
  const touched = new Set([...Object.values(custom.names), ...Object.values(custom.titles), ...(custom.disabled ?? [])])
  return allTypes(custom)
    .filter((each) => each.code !== OTHER && (each.custom || touched.has(each.code)))
    .map((each) => each.code)
}

/** Le fichier d'échange pour les types choisis. */
export function exportTypes(custom: CustomKeywords, codes: readonly string[], today: string): TypesFile {
  const of = (keywords: Readonly<Record<string, string>>, code: string) =>
    Object.keys(keywords).filter((keyword) => keywords[keyword] === code)
  const types = allTypes(custom)
    .filter((each) => codes.includes(each.code) && each.code !== OTHER)
    .map((each): ExchangedType => ({
      code: each.code,
      ...(each.custom ? { libelle: each.label ?? '' } : {}),
      ajoute: Boolean(each.custom),
      desactive: (custom.disabled ?? []).includes(each.code),
      motsClesNom: of(custom.names, each.code),
      motsClesTitre: of(custom.titles, each.code)
    }))
  return { format: EXCHANGE_FORMAT, version: EXCHANGE_VERSION, exporte: today, types }
}

export function exportFileName(today: string): string {
  return `types-de-pieces-${today}.json`
}

export type ParseResult = { ok: true; file: TypesFile } | { ok: false; errorKey: string }

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string' && each.trim() !== '') : []

/** Le fichier lu et vérifié ; un type mal formé est écarté, pas le fichier entier. */
export function parseTypesFile(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return { ok: false, errorKey: 'typage-pieces.exchange.error.json' }
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== EXCHANGE_FORMAT) {
    return { ok: false, errorKey: 'typage-pieces.exchange.error.format' }
  }
  const file = raw as { version?: unknown; exporte?: unknown; types?: unknown }
  if (typeof file.version !== 'number' || file.version > EXCHANGE_VERSION) {
    return { ok: false, errorKey: 'typage-pieces.exchange.error.version' }
  }
  const types: ExchangedType[] = []
  for (const entry of Array.isArray(file.types) ? file.types : []) {
    if (typeof entry !== 'object' || entry === null) continue
    const each = entry as Record<string, unknown>
    if (typeof each.code !== 'string') continue
    const code = normalizeTypeCode(each.code)
    if (!code) continue
    types.push({
      code,
      ...(typeof each.libelle === 'string' ? { libelle: normalizeLabel(each.libelle) } : {}),
      ajoute: each.ajoute === true,
      desactive: each.desactive === true,
      motsClesNom: strings(each.motsClesNom),
      motsClesTitre: strings(each.motsClesTitre)
    })
  }
  if (types.length === 0) return { ok: false, errorKey: 'typage-pieces.exchange.error.empty' }
  return { ok: true, file: { format: EXCHANGE_FORMAT, version: file.version, exporte: String(file.exporte ?? ''), types } }
}

/** Ce qu'un type du fichier deviendra à l'import. */
export type PlanKind = 'new' | 'update' | 'builtin' | 'conflict' | 'unknown'

export interface PlanEntry {
  code: string
  kind: PlanKind
  /** Le libellé du fichier (type ajouté) ; vide pour un type du module. */
  label: string
  keywords: number
  desactive: boolean
}

export function planImport(settings: Settings, file: TypesFile): PlanEntry[] {
  const types = readCustomTypes(settings)
  return file.types.map((entry) => {
    const keywords = entry.motsClesNom.length + entry.motsClesTitre.length
    const base = { code: entry.code, label: entry.libelle ?? '', keywords, desactive: entry.desactive }
    if (entry.ajoute) {
      if (isBuiltIn(entry.code)) return { ...base, kind: 'conflict' }
      if (validateType(entry.code, entry.libelle ?? '', {}) !== null) return { ...base, kind: 'unknown' }
      return { ...base, kind: types[entry.code] !== undefined ? 'update' : 'new' }
    }
    if (isBuiltIn(entry.code) && entry.code !== OTHER) return { ...base, kind: 'builtin' }
    if (types[entry.code] !== undefined) return { ...base, kind: 'update' }
    return { ...base, kind: 'unknown' }
  })
}

/** Ce qui est importable : ni conflit ni type inconnu. */
export function importable(entry: PlanEntry): boolean {
  return entry.kind === 'new' || entry.kind === 'update' || entry.kind === 'builtin'
}

export interface ImportResult {
  settings: Record<string, unknown>
  added: number
  updated: number
  keywordsAdded: number
  keywordsSkipped: number
  skipped: string[]
}

/** Les réglages du module après l'import des types choisis, et ce qui s'est passé. */
export function applyImport(settings: Settings, file: TypesFile, codes: readonly string[]): ImportResult {
  const plan = new Map(planImport(settings, file).map((entry) => [entry.code, entry]))
  const types = readCustomTypes(settings)
  const names = readNameKeywords(settings)
  const titles = readTitleKeywords(settings)
  const disabled = new Set(readDisabled(settings))
  const renames = readRenames(settings)
  const result: ImportResult = { settings: {}, added: 0, updated: 0, keywordsAdded: 0, keywordsSkipped: 0, skipped: [] }

  for (const entry of file.types) {
    if (!codes.includes(entry.code)) continue
    const step = plan.get(entry.code)
    if (!step || !importable(step)) {
      result.skipped.push(entry.code)
      continue
    }
    if (entry.ajoute) {
      if (types[entry.code] === undefined) result.added++
      else result.updated++
      types[entry.code] = entry.libelle ?? entry.code
      // Le code redevient le sien : un ancien renommage depuis ce code est oublié.
      delete renames[entry.code]
    }
    if (entry.desactive) disabled.add(entry.code)
    else disabled.delete(entry.code)
    for (const [list, where, words] of [
      [names, 'names', entry.motsClesNom],
      [titles, 'titles', entry.motsClesTitre]
    ] as const) {
      for (const word of words) {
        const keyword = normalizeKeyword(word)
        if (validateKeyword(where, keyword, entry.code, list, types) === null) {
          list[keyword] = entry.code
          result.keywordsAdded++
        } else result.keywordsSkipped++
      }
    }
  }

  result.settings = {
    ...settings,
    [TYPES_KEY]: types,
    [NAME_KEYWORDS_KEY]: names,
    [TITLE_KEYWORDS_KEY]: titles,
    [DISABLED_KEY]: [...disabled].sort(),
    [RENAMES_KEY]: renames
  }
  return result
}
