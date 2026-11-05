// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les réglages du module Exigences, et l'attribution des identifiants.
 *
 * Les compteurs gardent le plus haut numéro jamais donné par catégorie : la bibliothèque
 * ne dit que ce qui existe encore, et une exigence supprimée ne doit jamais céder son
 * identifiant à la suivante — tout document qui la citait citerait autre chose.
 */

import { cleanFolder } from '../../core/settings'
import { cleanBlockFields, type ReqBlockField } from './model/blockFields'
import { DEFAULT_ID_SCHEME, formatReqId, idCategory, nextReqId, parseReqId, type IdScheme } from './model/reqId'

export const FOLDER_KEY = 'dossier'
export const PREFIX_KEY = 'prefixe'
export const WIDTH_KEY = 'chiffres'
export const LANGUAGES_KEY = 'langues'
export const COUNTERS_KEY = 'compteurs'
export const BLOCK_FIELDS_KEY = 'colonnesBloc'

export const DEFAULT_FOLDER = 'Exigences'
export const DEFAULT_LANGUAGES = ['fr', 'en']

export interface ReqSettings {
  /** Où les exigences sont écrites, et cherchées. */
  folder: string
  scheme: IdScheme
  /** Les langues de rédaction ; la première est celle des nouvelles exigences. */
  languages: string[]
  counters: Record<string, number>
  blockFields: ReqBlockField[]
}

type Settings = Readonly<Record<string, unknown>>

/** Un préfixe d'identifiant : majuscules et chiffres, REQ par défaut. */
export function cleanPrefix(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/** Le nombre de chiffres, entre 2 et 8 ; vide si la saisie n'en est pas un. */
export function cleanWidth(raw: string): string {
  const value = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(value) ? String(Math.min(8, Math.max(2, value))) : ''
}

/** Des codes de langue, en minuscules, chacun une fois : « FR, en ; de » donne « fr, en, de ». */
export function cleanLanguages(raw: string): string {
  const seen = new Set<string>()
  for (const piece of raw.split(/[\s,;]+/)) {
    const code = piece.trim().toLowerCase().replace(/[^a-z-]/g, '')
    if (code) seen.add(code)
  }
  return [...seen].join(', ')
}

export function readReqSettings(settings: Settings): ReqSettings {
  const text = (key: string) => (typeof settings[key] === 'string' ? (settings[key] as string) : '')
  const width = Number.parseInt(cleanWidth(text(WIDTH_KEY)), 10)
  const languages = cleanLanguages(text(LANGUAGES_KEY))
  const rawCounters = settings[COUNTERS_KEY]
  const counters: Record<string, number> = {}
  if (typeof rawCounters === 'object' && rawCounters !== null && !Array.isArray(rawCounters)) {
    for (const [category, value] of Object.entries(rawCounters as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) counters[category] = Math.floor(value)
    }
  }
  return {
    folder: cleanFolder(text(FOLDER_KEY)) || DEFAULT_FOLDER,
    scheme: {
      prefix: cleanPrefix(text(PREFIX_KEY)) || DEFAULT_ID_SCHEME.prefix,
      width: Number.isFinite(width) ? width : DEFAULT_ID_SCHEME.width
    },
    languages: languages ? languages.split(', ') : [...DEFAULT_LANGUAGES],
    counters,
    blockFields: cleanBlockFields(settings[BLOCK_FIELDS_KEY])
  }
}

/**
 * Le prochain identifiant libre, et le compteur à retenir ensuite. Deux sources : la
 * bibliothèque dit ce qui existe, le compteur ce qui a jamais existé. Le plus haut des
 * deux l'emporte : un REQ-SYS-0042 supprimé ne revient jamais, et une bibliothèque
 * importée dans un coffre neuf, aux compteurs vides, reçoit des numéros au-dessus des siens.
 */
export function allocateReqId(
  scheme: IdScheme,
  category: string,
  liveIds: Iterable<string>,
  counters: Record<string, number>
): { id: string; counters: Record<string, number> } {
  const key = idCategory(category)
  const fromLibrary = parseReqId(nextReqId(scheme, key, liveIds))?.number ?? 1
  const fromCounter = (counters[key] ?? 0) + 1
  const number = Math.max(fromLibrary, fromCounter)
  return { id: formatReqId(scheme, key, number), counters: { ...counters, [key]: number } }
}

/**
 * Les compteurs relevés au-delà d'un identifiant venu d'ailleurs — seulement pour notre
 * préfixe : un fichier numéroté selon le schéma d'un autre n'a pas à pousser nos numéros.
 */
export function counterPast(scheme: IdScheme, counters: Record<string, number>, id: string): Record<string, number> {
  const parsed = parseReqId(id)
  if (!parsed || parsed.prefix !== scheme.prefix.toUpperCase()) return counters
  const held = counters[parsed.category] ?? 0
  return parsed.number > held ? { ...counters, [parsed.category]: parsed.number } : counters
}
