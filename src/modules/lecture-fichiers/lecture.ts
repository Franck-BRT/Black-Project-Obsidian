// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Lire un fichier du coffre : le service que les autres modules appellent.
 *
 * Il ne lève jamais d'exception pour un fichier qui ne se lit pas : il rend un résultat
 * qui dit pourquoi, pour que l'appelant puisse l'afficher, le ranger dans un état
 * (« scan illisible »…), ou passer au fichier suivant d'un dossier.
 */

import type { FileSystem, VaultPath } from '../../core/ports'
import { currentAliases, resolveExtension } from './aliases'
import { fileText, FileReadError, isReadable, type FileProblem } from './readers/fileText'

/**
 * `extension` est celle du fichier ; `readAs` celle du format avec lequel il a été lu —
 * la même, sauf pour une extension équivalente (`.tot` lu comme `xml`).
 */
export type ReadOutcome =
  | { ok: true; path: VaultPath; extension: string; readAs: string; text: string; ms: number }
  | { ok: false; path: VaultPath; extension: string; readAs: string; problem: FileProblem }

export interface ReadOptions {
  /** Les extensions équivalentes ; par défaut, celles des réglages du module. */
  aliases?: Readonly<Record<string, string>>
  now?: () => number
}

export function extensionOf(path: VaultPath): string {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function nameOf(path: VaultPath): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Le texte d'un fichier du coffre, ou la raison pour laquelle il n'y en a pas. */
export async function readVaultFile(fs: FileSystem, path: VaultPath, options: ReadOptions = {}): Promise<ReadOutcome> {
  const now = options.now ?? Date.now
  const extension = extensionOf(path)
  const readAs = resolveExtension(extension, options.aliases ?? currentAliases())
  if (!isReadable(readAs)) return { ok: false, path, extension, readAs, problem: 'unsupported' }
  const started = now()
  try {
    const bytes = new Uint8Array(await fs.readBinary(path))
    const text = await fileText(readAs, bytes)
    return { ok: true, path, extension, readAs, text, ms: now() - started }
  } catch (error) {
    const problem = error instanceof FileReadError ? error.problem : 'unreadable'
    return { ok: false, path, extension, readAs, problem }
  }
}
