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

// ── Les annotations des autres modules ────────────────────────────────────────────
// Ce que d'autres modules disent d'un type, affiché sur sa fiche à titre d'information :
// l'analyse d'appels d'offres dit où elle range ses pièces ; d'autres modules pourront
// dire où ils classent les leurs. Le typage n'en fait rien d'autre que les montrer.

export interface TypeAnnotation {
  /** Le titre de la ligne : « Analyse d'appels d'offres — va dans ». */
  readonly labelKey: string
  /** Ce qu'elle dit, déjà mis en mots par le module : « L'appel d'offres », « La réponse ». */
  readonly tags: readonly string[]
}

export type TypeAnnotator = (code: string) => TypeAnnotation | null

const annotators = new Map<string, TypeAnnotator>()

/** Ajoute une ligne d'information aux fiches des types ; rend de quoi la retirer. */
export function annotateTypes(id: string, annotator: TypeAnnotator): () => void {
  annotators.set(id, annotator)
  return () => {
    if (annotators.get(id) === annotator) annotators.delete(id)
  }
}

/** Ce que les autres modules disent d'un type. */
export function typeAnnotations(code: string): TypeAnnotation[] {
  const out: TypeAnnotation[] = []
  for (const annotator of annotators.values()) {
    try {
      const annotation = annotator(code)
      if (annotation) out.push(annotation)
    } catch (error) {
      console.error('[Black Projects] annotation des types', error)
    }
  }
  return out
}

// ── Ce que d'autres modules font voyager avec les types ───────────────────────────
// À l'export, un module peut joindre à chaque type ce qu'il en sait (l'analyse d'appels
// d'offres : où elle le range) ; à l'import, il reprend ce que le fichier en dit. Le
// typage écrit et relit ces données sans les comprendre, sous l'identifiant du module :
// `"modules": { "ao": { "rangement": "reponse" } }`.

export interface TypeExchangeExtension {
  /** Le nom de ce qui voyage, pour les messages : « rangement (Analyse d'appels d'offres) ». */
  readonly nameKey: string
  /** Ce que le module joint à ce type ; `undefined` : rien. */
  exportType(code: string): unknown
  /** En quelques mots, pour les listes d'export et d'import : « AO : Réponse AO » ; `null` si la valeur ne convient pas. */
  describe(value: unknown): string | null
  /** Reprend ce que le fichier dit des types importés (code → valeur) ; rend combien de types ont été repris. */
  importTypes(values: Readonly<Record<string, unknown>>): Promise<number>
}

const extensions = new Map<string, TypeExchangeExtension>()

/** Joint des données d'un module aux types échangés ; rend de quoi le retirer. */
export function extendTypeExchange(id: string, extension: TypeExchangeExtension): () => void {
  extensions.set(id, extension)
  return () => {
    if (extensions.get(id) === extension) extensions.delete(id)
  }
}

/** Les modules qui joignent des données aux types échangés, par identifiant. */
export function typeExchangeExtensions(): ReadonlyMap<string, TypeExchangeExtension> {
  return extensions
}
