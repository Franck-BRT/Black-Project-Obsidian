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
import { fileText, FileReadError, isReadable, type FileProblem } from './readers/fileText'

export type ReadOutcome =
  | { ok: true; path: VaultPath; extension: string; text: string; ms: number }
  | { ok: false; path: VaultPath; extension: string; problem: FileProblem }

export function extensionOf(path: VaultPath): string {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function nameOf(path: VaultPath): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Le texte d'un fichier du coffre, ou la raison pour laquelle il n'y en a pas. */
export async function readVaultFile(fs: FileSystem, path: VaultPath, now: () => number = Date.now): Promise<ReadOutcome> {
  const extension = extensionOf(path)
  if (!isReadable(extension)) return { ok: false, path, extension, problem: 'unsupported' }
  const started = now()
  try {
    const bytes = new Uint8Array(await fs.readBinary(path))
    const text = await fileText(extension, bytes)
    return { ok: true, path, extension, text, ms: now() - started }
  } catch (error) {
    const problem = error instanceof FileReadError ? error.problem : 'unreadable'
    return { ok: false, path, extension, problem }
  }
}
