// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les extensions équivalentes : des fichiers dont l'extension n'est pas connue, mais que
 * l'utilisateur sait être d'un format lu. Un `.tot` qui est du XML, un `.res` qui est du
 * texte, un `.spec` qui est du Markdown : on les déclare dans les réglages, et ils sont
 * lus avec le lecteur du format qu'ils sont vraiment.
 *
 * Deux règles :
 *
 * - **On ne redéfinit pas un format déjà lu.** Déclarer `.pdf` comme du texte casserait
 *   la lecture de tous les PDF ; la saisie est refusée.
 * - **La cible est un format lu par un lecteur intégré**, jamais une autre extension
 *   ajoutée : pas de chaîne `.a → .b → .xml` à démêler.
 *
 * Les équivalences sont gardées dans les réglages du module (`aliases`), et appliquées
 * partout où le module lit un fichier : la commande, `readVaultFile`, `fileText` et
 * `isReadable` de l'interface publique.
 */

import type { FieldError } from '../../core/modules/module'
import { READABLE_EXTENSIONS, TEXT_EXTENSIONS } from './readers/fileText'

/** La clé, dans les réglages du module. */
export const ALIASES_KEY = 'aliases'

const EXTENSION = /^[a-z0-9][a-z0-9_-]{0,15}$/

/** « .TOT », « tot », «  *.tot » → « tot ». */
export function normalizeExtension(input: string): string {
  return input.trim().toLowerCase().replace(/^\*?\./, '')
}

/** Les formats qu'une extension ajoutée peut prendre pour modèle, dans l'ordre alphabétique. */
export function aliasTargets(): string[] {
  return [...TEXT_EXTENSIONS].sort()
}

/** `null` si l'équivalence est acceptable, sinon pourquoi elle ne l'est pas. */
export function validateAlias(from: string, to: string, current: Readonly<Record<string, string>>): FieldError | null {
  if (!EXTENSION.test(from)) return { key: 'lecture-fichiers.alias.error.invalid', vars: { from } }
  if (READABLE_EXTENSIONS.has(from)) return { key: 'lecture-fichiers.alias.error.native', vars: { from } }
  if (!TEXT_EXTENSIONS.has(to)) return { key: 'lecture-fichiers.alias.error.target', vars: { to } }
  if (current[from] !== undefined) return { key: 'lecture-fichiers.alias.error.exists', vars: { from, to: current[from] } }
  return null
}

/** Les équivalences enregistrées ; celles qui ne sont plus valables sont écartées. */
export function readAliases(settings: Readonly<Record<string, unknown>>): Record<string, string> {
  const raw = settings[ALIASES_KEY]
  const out: Record<string, string> = {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue
    const from = normalizeExtension(key)
    if (validateAlias(from, value, out) === null) out[from] = value
  }
  return out
}

// ── Les équivalences en vigueur ──────────────────────────────────────────────────
// Posées à l'activation du module et à chaque changement de ses réglages ; lues par
// tout ce qui lit un fichier, y compris quand c'est un autre module qui le demande.

let active: Readonly<Record<string, string>> = {}

export function configureAliases(aliases: Readonly<Record<string, string>>): void {
  active = { ...aliases }
}

export function currentAliases(): Readonly<Record<string, string>> {
  return active
}

/** L'extension du format à lire : celle du fichier, ou celle dont elle est l'équivalente. */
export function resolveExtension(extension: string, aliases: Readonly<Record<string, string>> = active): string {
  const ext = extension.toLowerCase()
  return aliases[ext] ?? ext
}
