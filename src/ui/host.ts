// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que l'hôte (Obsidian aujourd'hui, l'application de bureau demain) donne à
 * l'interface. Rien d'autre ne passe : l'interface ne connaît ni l'API d'Obsidian, ni
 * Tauri, ni les modules.
 */

import type { Appearance } from '../core/appearance'
import type { HomeSection, NavEntry } from '../core/views'

export type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface AppHost {
  t: Translate
  /** La langue des dates : « fr-FR », « en-GB ». */
  locale: string
  version: string
  /** Les sections de l'accueil déclarées par les modules actifs. */
  sections(): HomeSection[]
  /** Les entrées de navigation déclarées par les modules actifs. */
  nav(): NavEntry[]
  appearance(): Appearance
  saveAppearance(appearance: Appearance): Promise<void>
  /** Le thème de l'hôte est-il sombre (pour le mode « auto ») ? */
  hostIsDark(): boolean
  /** Prévient quand le thème de l'hôte change ; rend de quoi se désabonner. */
  onHostThemeChange?(listener: () => void): () => void
  now(): Date
}
