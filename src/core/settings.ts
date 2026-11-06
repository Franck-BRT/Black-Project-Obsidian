// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les réglages communs, et ceux que chaque module range sous son identifiant.
 *
 * Ce qui est lu sur le disque n'est jamais cru sur parole : un fichier écrit par une
 * version plus ancienne, modifié à la main ou à moitié synchronisé doit donner des
 * réglages utilisables, pas une exception au chargement.
 */

import { DEFAULT_APPEARANCE, readAppearance, type Appearance } from './appearance'

export type Language = 'fr' | 'en'

export const LANGUAGES: readonly Language[] = ['fr', 'en']

export interface CoreSettings {
  /** Version du format, pour les migrations à venir. */
  format: 1
  language: Language
  /** Les modules que l'utilisateur a désactivés. Absents : actifs. */
  disabledModules: string[]
  /** Réglages propres à chaque module, rangés sous son identifiant. */
  modules: Record<string, Record<string, unknown>>
  /** Le dossier du coffre où la documentation est créée. */
  docsFolder: string
  /** L'apparence de l'interface : mode, couleurs, lecture, taille, mouvement. */
  appearance: Appearance
  /** Ouvrir l'accueil de Black Projects au démarrage. */
  openHomeAtStart: boolean
  /** Les tuiles de l'accueil, dans l'ordre choisi ; `null` : celles par défaut. */
  homeTiles: string[] | null
}

export const DEFAULT_DOCS_FOLDER = 'Black Projects/Documentation'

export const DEFAULT_SETTINGS: CoreSettings = Object.freeze({
  format: 1 as const,
  language: 'fr' as const,
  disabledModules: [],
  modules: {},
  docsFolder: DEFAULT_DOCS_FOLDER,
  appearance: DEFAULT_APPEARANCE,
  openHomeAtStart: true,
  homeTiles: null
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Des réglages complets et valides, quoi qu'il y ait sur le disque. */
export function readSettings(raw: unknown): CoreSettings {
  const source = isRecord(raw) ? raw : {}

  const language = LANGUAGES.includes(source.language as Language)
    ? (source.language as Language)
    : DEFAULT_SETTINGS.language

  const disabledModules = Array.isArray(source.disabledModules)
    ? [...new Set(source.disabledModules.filter((id): id is string => typeof id === 'string' && id !== ''))]
    : []

  const modules: Record<string, Record<string, unknown>> = {}
  if (isRecord(source.modules)) {
    for (const [id, value] of Object.entries(source.modules)) {
      if (isRecord(value)) modules[id] = { ...value }
    }
  }

  const docsFolder =
    typeof source.docsFolder === 'string' && cleanFolder(source.docsFolder) !== ''
      ? cleanFolder(source.docsFolder)
      : DEFAULT_DOCS_FOLDER

  const appearance = readAppearance(source.appearance)
  const openHomeAtStart = typeof source.openHomeAtStart === 'boolean' ? source.openHomeAtStart : DEFAULT_SETTINGS.openHomeAtStart

  const homeTiles = Array.isArray(source.homeTiles) ? [...new Set(source.homeTiles.filter((id): id is string => typeof id === 'string' && id !== ''))] : null

  return { format: 1, language, disabledModules, modules, docsFolder, appearance, openHomeAtStart, homeTiles }
}

/** Un dossier du coffre tel qu'on le saisit : sans « / » au début ni à la fin, ni doubles. */
export function cleanFolder(folder: string): string {
  return folder
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part !== '' && part !== '.' && part !== '..')
    .join('/')
}

/** Les réglages d'un module, ou un objet vide. */
export function moduleSettings(settings: CoreSettings, moduleId: string): Record<string, unknown> {
  return settings.modules[moduleId] ?? {}
}

/** Active ou désactive un module, sans toucher au reste. */
export function withModuleEnabled(settings: CoreSettings, moduleId: string, enabled: boolean): CoreSettings {
  const disabled = new Set(settings.disabledModules)
  if (enabled) disabled.delete(moduleId)
  else disabled.add(moduleId)
  return { ...settings, disabledModules: [...disabled].sort() }
}
