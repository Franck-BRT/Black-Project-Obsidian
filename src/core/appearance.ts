// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'apparence de l'interface, choisie par l'utilisateur et la même partout (Obsidian,
 * application de bureau). Quatre réglages qui se combinent :
 *
 * - **mode** : clair, sombre, ou celui de l'hôte (le thème d'Obsidian, celui du système) ;
 * - **couleurs** : standard, ou une palette pour les daltonismes — rouge-vert
 *   (deutéranopie, protanopie, les plus fréquents), bleu-jaune (tritanopie), ou monochrome
 *   (achromatopsie). Une couleur ne porte jamais seule une information : chaque état a
 *   aussi son icône et son mot ;
 * - **lecture** : standard, ou facilitée pour les troubles dys — police lisible (celles
 *   pour la dyslexie si elles sont installées), texte plus grand, interlettrage et
 *   interligne élargis, fond crème sans blanc pur, pas d'italique ni de texte justifié,
 *   lignes courtes ;
 * - **taille** du texte : normale, grande, très grande.
 *
 * Et le mouvement : les animations sont coupées si l'utilisateur le demande ou si son
 * système le demande.
 */

export type AppearanceMode = 'auto' | 'light' | 'dark'
export type ColorVision = 'standard' | 'red-green' | 'blue-yellow' | 'mono'
export type ReadingMode = 'standard' | 'dys'
export type TextSize = 'normal' | 'large' | 'larger'
export type Motion = 'auto' | 'reduced'

export interface Appearance {
  mode: AppearanceMode
  vision: ColorVision
  reading: ReadingMode
  size: TextSize
  motion: Motion
}

export const APPEARANCE_MODES: readonly AppearanceMode[] = ['auto', 'light', 'dark']
export const COLOR_VISIONS: readonly ColorVision[] = ['standard', 'red-green', 'blue-yellow', 'mono']
export const READING_MODES: readonly ReadingMode[] = ['standard', 'dys']
export const TEXT_SIZES: readonly TextSize[] = ['normal', 'large', 'larger']
export const MOTIONS: readonly Motion[] = ['auto', 'reduced']

export const DEFAULT_APPEARANCE: Appearance = Object.freeze({ mode: 'auto', vision: 'standard', reading: 'standard', size: 'normal', motion: 'auto' })

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

/** Une apparence complète et valide, quoi qu'il y ait sur le disque. */
export function readAppearance(raw: unknown): Appearance {
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    mode: pick(source.mode, APPEARANCE_MODES, DEFAULT_APPEARANCE.mode),
    vision: pick(source.vision, COLOR_VISIONS, DEFAULT_APPEARANCE.vision),
    reading: pick(source.reading, READING_MODES, DEFAULT_APPEARANCE.reading),
    size: pick(source.size, TEXT_SIZES, DEFAULT_APPEARANCE.size),
    motion: pick(source.motion, MOTIONS, DEFAULT_APPEARANCE.motion)
  }
}

/** Le mode effectivement montré : « auto » suit l'hôte. */
export function resolvedMode(appearance: Appearance, hostIsDark: boolean): 'light' | 'dark' {
  return appearance.mode === 'auto' ? (hostIsDark ? 'dark' : 'light') : appearance.mode
}
