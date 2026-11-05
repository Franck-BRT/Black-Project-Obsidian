// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Jusqu'à la version 0.3.5, les types et les mots-clés de l'utilisateur étaient rangés
 * dans les réglages de l'analyse d'appels d'offres. Depuis que le typage est un module,
 * ils sont dans les siens : on les y déplace au premier chargement, une fois, sans rien
 * perdre — et sans rien toucher si le module a déjà ses propres réglages.
 */

import { DISABLED_KEY, NAME_KEYWORDS_KEY, RENAMES_KEY, TITLE_KEYWORDS_KEY, TYPES_KEY } from './custom'

const MOVED = [TYPES_KEY, NAME_KEYWORDS_KEY, TITLE_KEYWORDS_KEY, DISABLED_KEY, RENAMES_KEY]
const FROM = 'ao'
const TO = 'typage-pieces'

export function migrateFromAo(
  modules: Readonly<Record<string, Record<string, unknown>>>
): Record<string, Record<string, unknown>> | null {
  const old = modules[FROM] ?? {}
  const present = MOVED.filter((key) => key in old)
  if (present.length === 0) return null
  const mine = modules[TO] ?? {}
  const ao = { ...old }
  for (const key of present) delete ao[key]
  // Le module a déjà ses réglages : ceux de l'ancienne place sont seulement retirés.
  if (MOVED.some((key) => key in mine)) return { ...modules, [FROM]: ao }
  const moved: Record<string, unknown> = { ...mine }
  for (const key of present) moved[key] = old[key]
  return { ...modules, [FROM]: ao, [TO]: moved }
}
