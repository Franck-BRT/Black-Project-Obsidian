// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ouvrir une archive : le ZIP d'un dossier de consultation, tel qu'un acheteur le publie.
 *
 * Les fichiers de l'archive, avec leur chemin dedans, sans ce qui n'est pas une pièce : les
 * dossiers, les fichiers cachés, ce que macOS (`__MACOSX/`, `.DS_Store`) et Windows
 * (`Thumbs.db`, `desktop.ini`) y laissent. Une archive dans l'archive est ouverte à son
 * tour, sur deux niveaux : les dossiers par lot arrivent souvent ainsi.
 */

import { unzip, ZipError } from './formats/unzip'

export const ARCHIVE_EXTENSIONS: ReadonlySet<string> = new Set(['zip'])

export interface ArchiveEntry {
  /** Le chemin dans l'archive, avec des « / » ; celui d'une archive imbriquée la préfixe. */
  path: string
  bytes: Uint8Array
}

export class ArchiveError extends Error {}

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)|(^|\/)\._/i

function isHidden(path: string): boolean {
  return path.split('/').some((part) => part.startsWith('.') && part !== '.' && part !== '..')
}

export function isArchive(extension: string): boolean {
  return ARCHIVE_EXTENSIONS.has(extension.toLowerCase())
}

/** Les fichiers d'une archive ZIP. Lève `ArchiveError` si elle est abîmée ou n'en est pas une. */
export async function readArchive(bytes: Uint8Array, depth = 2): Promise<ArchiveEntry[]> {
  let entries
  try {
    entries = await unzip(bytes)
  } catch (error) {
    throw new ArchiveError(error instanceof ZipError ? error.message : String(error))
  }
  const out: ArchiveEntry[] = []
  for (const entry of entries) {
    const path = entry.name.replace(/\\/g, '/').replace(/^\/+/, '')
    if (JUNK.test(path) || isHidden(path)) continue
    if (depth > 1 && path.toLowerCase().endsWith('.zip')) {
      try {
        const inner = await readArchive(entry.data, depth - 1)
        const prefix = path.slice(0, -4)
        out.push(...inner.map((each) => ({ path: `${prefix}/${each.path}`, bytes: each.bytes })))
        continue
      } catch {
        // Une archive imbriquée illisible reste un fichier comme un autre.
      }
    }
    out.push({ path, bytes: entry.data })
  }
  return out
}
