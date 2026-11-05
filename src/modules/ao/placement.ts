// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Où l'analyse range chaque type de pièce : avec l'appel d'offres, avec la réponse, ou —
 * quand les deux se peuvent — là où l'utilisateur le dit à l'import.
 *
 * C'est un réglage de ce module, pas du typage : le typage dit ce qu'est une pièce ;
 * chaque module qui classe des pièces dit, lui, où il les met. Le module Typage des pièces
 * affiche ce rangement sur la fiche de chaque type, à titre d'information.
 *
 * Réglage `rangement` : code du type → `appel-d-offres`, `reponse` ou `les-deux`. Il est
 * vide au départ : c'est à l'utilisateur de choisir (le module le lui explique à son
 * activation, puis le lui rappelle à l'ouverture tant que la liste est vide — rappel
 * qu'il peut couper). Un type qui n'y figure pas va « dans les deux » : la question est
 * posée à l'import.
 */

import { allTypes, OTHER, type CustomKeywords } from '../typage-pieces'
import type { PiecePlace } from './notes'

export type Place = PiecePlace | 'les-deux'
export const PLACES: readonly Place[] = ['appel-d-offres', 'reponse', 'les-deux']

export const RANGEMENT_KEY = 'rangement'

/** Le module se souvient d'avoir expliqué le rangement à son activation. */
export const WELCOME_KEY = 'accueilVu'
/** Le rappel à l'ouverture, tant qu'aucun type n'est rangé ; coupé par l'utilisateur s'il le veut. */
export const REMINDER_KEY = 'rappelOuverture'

type Settings = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Ce qui est enregistré, nettoyé ; vide si rien ne l'est. */
export function readRangement(settings: Settings): Record<string, Place> {
  const raw = settings[RANGEMENT_KEY]
  if (!isRecord(raw)) return {}
  const out: Record<string, Place> = {}
  for (const [code, place] of Object.entries(raw)) {
    if (code !== OTHER && PLACES.includes(place as Place)) out[code] = place as Place
  }
  return out
}

/** Le rangement, limité aux types qui existent (un type supprimé n'y apparaît plus). */
export function rangementOf(settings: Settings, custom?: CustomKeywords): Record<string, Place> {
  const known = new Set(allTypes(custom).map((each) => each.code))
  return Object.fromEntries(Object.entries(readRangement(settings)).filter(([code]) => known.has(code)))
}

/** Aucun type n'est rangé : toutes les pièces sont demandées à l'import. */
export function rangementEmpty(settings: Settings, custom?: CustomKeywords): boolean {
  return Object.keys(rangementOf(settings, custom)).length === 0
}

/**
 * Faut-il expliquer le rangement à l'ouverture ? `welcome` : la première fois que le
 * module est actif ; `reminder` : ensuite, tant que la liste est vide et que le rappel
 * n'est pas coupé ; `null` : rien à dire.
 */
export function placementMessage(settings: Settings, custom?: CustomKeywords): 'welcome' | 'reminder' | null {
  if (!rangementEmpty(settings, custom)) return null
  if (settings[WELCOME_KEY] !== true) return 'welcome'
  return settings[REMINDER_KEY] === false ? null : 'reminder'
}

/** Où va un type ; « les deux » s'il n'est pas rangé. */
export function placeOf(code: string, rangement: Readonly<Record<string, Place>>): Place {
  return rangement[code] ?? 'les-deux'
}

/** Les colonnes cochées, pour l'écran : `appel-d-offres`, `reponse`, ou les deux. */
export function placeColumns(place: Place): PiecePlace[] {
  return place === 'les-deux' ? ['appel-d-offres', 'reponse'] : [place]
}

/** L'inverse : les colonnes cochées donnent la place ; aucune n'est pas permis. */
export function columnsPlace(columns: readonly string[]): Place | null {
  const tender = columns.includes('appel-d-offres')
  const response = columns.includes('reponse')
  if (tender && response) return 'les-deux'
  if (tender) return 'appel-d-offres'
  if (response) return 'reponse'
  return null
}

/** Les types renommés dans le typage (ancien → nouveau) gardent leur rangement ; `null` si rien ne change. */
export function renameRangement(settings: Settings, renames: Readonly<Record<string, string>>): Record<string, unknown> | null {
  const raw = settings[RANGEMENT_KEY]
  if (!isRecord(raw)) return null
  const next: Record<string, unknown> = { ...raw }
  let changed = false
  for (const [before, after] of Object.entries(renames)) {
    if (before in next && !(after in next)) {
      next[after] = next[before]
      delete next[before]
      changed = true
    }
  }
  return changed ? { ...settings, [RANGEMENT_KEY]: next } : null
}

/**
 * Les réglages de la version 0.4.1, où la place était choisie dans le module de typage
 * (`placesTypes`) : ce que l'utilisateur y avait choisi est repris ici.
 */
export function migratePlaces(
  modules: Readonly<Record<string, Record<string, unknown>>>,
  ao: string,
  typing: string
): Record<string, Record<string, unknown>> | null {
  const typingSettings = modules[typing]
  const old = typingSettings?.placesTypes
  if (!typingSettings || old === undefined) return null
  const aoSettings = modules[ao] ?? {}
  const rest = { ...typingSettings }
  delete rest.placesTypes
  const out: Record<string, Record<string, unknown>> = { ...modules, [typing]: rest }
  if (!isRecord(aoSettings[RANGEMENT_KEY]) && isRecord(old)) {
    const rangement: Record<string, Place> = {}
    for (const [code, place] of Object.entries(old)) {
      if (code !== OTHER && PLACES.includes(place as Place)) rangement[code] = place as Place
    }
    out[ao] = { ...aoSettings, [RANGEMENT_KEY]: rangement }
  }
  return out
}
