// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que l'utilisateur a réglé, tel qu'il est en vigueur : posé à l'activation du module
 * et à chaque changement de ses réglages, lu par la reconnaissance — y compris quand
 * c'est un autre module qui la demande —, et annoncé à qui veut le suivre (l'analyse
 * d'appels d'offres retype ses pièces quand un code change).
 */

import { readCustomKeywords, readRenames } from './custom'
import { NO_CUSTOM_KEYWORDS, type CustomKeywords } from './types'

export interface TypingState {
  readonly custom: CustomKeywords
  /** Les codes renommés : ancien → nouveau. */
  readonly renames: Readonly<Record<string, string>>
}

let state: TypingState = { custom: NO_CUSTOM_KEYWORDS, renames: {} }
const listeners = new Set<(state: TypingState) => void>()

/** Pose l'état d'après les réglages du module, et prévient ceux qui le suivent. */
export function configureTyping(settings: Readonly<Record<string, unknown>>): void {
  state = { custom: readCustomKeywords(settings), renames: readRenames(settings) }
  for (const listener of listeners) {
    try {
      listener(state)
    } catch (error) {
      console.error('[Black Projects] typage des pièces', error)
    }
  }
}

export function currentTyping(): TypingState {
  return state
}

/** Ce que l'utilisateur a ajouté et désactivé, tel que la reconnaissance l'emploie. */
export function currentCustomization(): CustomKeywords {
  return state.custom
}

/** Suit les changements ; rend de quoi ne plus les suivre. */
export function onTypingChange(listener: (state: TypingState) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
