// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les textes de l'interface, par langue.
 *
 * Le cœur apporte les siens ; chaque module ajoute les siens à son activation, sous des
 * clés qu'il préfixe par son identifiant (`ao.…`). Une clé absente dans la langue
 * choisie est cherchée en français, la langue de référence ; absente partout, c'est la
 * clé elle-même qui s'affiche — visible, donc corrigée, plutôt qu'une chaîne vide.
 */

import type { Language } from '../settings'
import { en } from './en'
import { fr } from './fr'

export type Dictionary = Readonly<Record<string, string>>

export type Vars = Readonly<Record<string, string | number>>

export interface I18n {
  readonly language: Language
  t(key: string, vars?: Vars): string
  /** Ajoute des textes ; une clé déjà connue est remplacée. */
  register(language: Language, dictionary: Dictionary): void
}

const REFERENCE: Language = 'fr'

function interpolate(text: string, vars: Vars | undefined): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

export function createI18n(language: Language): I18n {
  const tables: Record<Language, Record<string, string>> = {
    fr: { ...fr },
    en: { ...en }
  }
  return {
    language,
    t(key, vars) {
      const text = tables[language][key] ?? tables[REFERENCE][key] ?? key
      return interpolate(text, vars)
    },
    register(lang, dictionary) {
      Object.assign(tables[lang], dictionary)
    }
  }
}
