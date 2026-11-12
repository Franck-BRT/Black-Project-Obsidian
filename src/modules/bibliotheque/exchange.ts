// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Se passer une bibliothèque** : l'exporter en une archive ZIP, l'importer chez un autre.
 *
 * L'archive garde les répertoires tels quels, et dit ce qu'elle porte dans
 * `black-projects-bibliotheque.json` (la sorte, le nom, le jour de l'export) :
 * - une bibliothèque de prompts, de personas, de skills, d'étiquettes, d'entreprises ou de
 *   personnes : ses notes ;
 * - une bibliothèque de documents : la fiche de chaque document, et son fichier (rangés dans
 *   `_fichiers/`, sous le chemin de la fiche).
 *
 * À l'import, une note déjà là à l'identique n'est pas réécrite ; différente, la nouvelle est
 * gardée à côté. Un document passe par le versement de la bibliothèque : déjà là (mêmes octets,
 * dans n'importe quelle bibliothèque), il n'est pas copié une seconde fois ; nouveau, sa fiche
 * reprend ce que disait celle de l'archive (titre, type, référence, édition…).
 */

import type { FileSystem } from '../../core/ports'
import { utf8, zip, type ZipEntry } from '../../core/formats/zip'
import type { ShelfKind } from './shelves'

/** Le nom de la note qui dit ce que porte l'archive. */
export const MANIFEST = 'black-projects-bibliotheque.json'
/** Le dossier de l'archive où sont les fichiers des documents. */
export const ARCHIVE_FILES = '_fichiers'
export const EXCHANGE_FORMAT = 1

/** La sorte d'une archive de **toute** la bibliothèque (chaque bibliothèque, sous `<sorte>/<bibliothèque>/`). */
export const WHOLE = 'tout'

/** Une bibliothèque, dans l'archive de toute la bibliothèque : où sont ses fichiers, ce qu'elle est. */
export interface WholePart {
  prefixe: string
  sorte: ShelfKind
  id: string
  nom: string
  documents?: { fiche: string; fichier: string }[]
}

export interface Manifest {
  format: number
  sorte: ShelfKind | typeof WHOLE
  nom: string
  exporte: string
  /** Les documents : la fiche, et le fichier dans l'archive. */
  documents?: { fiche: string; fichier: string }[]
  /** Toute la bibliothèque : chacune de ses bibliothèques. */
  bibliotheques?: WholePart[]
}

/** Le manifeste relu ; `null` si l'archive n'en a pas, ou pas un lisible. */
export function readManifest(entries: readonly { path: string; bytes: Uint8Array }[]): Manifest | null {
  const found = entries.find((entry) => entry.path === MANIFEST || entry.path.endsWith(`/${MANIFEST}`))
  if (!found) return null
  try {
    const data = JSON.parse(new TextDecoder().decode(found.bytes)) as Partial<Manifest>
    if (typeof data.sorte !== 'string' || typeof data.nom !== 'string') return null
    const documents = (list: unknown): { fiche: string; fichier: string }[] =>
      Array.isArray(list) ? list.filter((each): each is { fiche: string; fichier: string } => !!each && typeof each.fiche === 'string' && typeof each.fichier === 'string') : []
    return {
      format: Number(data.format) || 1,
      sorte: data.sorte,
      nom: data.nom,
      exporte: typeof data.exporte === 'string' ? data.exporte : '',
      ...(Array.isArray(data.documents) ? { documents: documents(data.documents) } : {}),
      ...(Array.isArray(data.bibliotheques)
        ? {
            bibliotheques: data.bibliotheques
              .filter((part): part is WholePart => !!part && typeof part.prefixe === 'string' && typeof part.sorte === 'string' && typeof part.id === 'string' && typeof part.nom === 'string')
              .map((part) => ({ prefixe: part.prefixe, sorte: part.sorte, id: part.id, nom: part.nom, ...(part.documents ? { documents: documents(part.documents) } : {}) }))
          }
        : {})
    }
  } catch {
    return null
  }
}

/** Les notes d'un dossier, sous-dossiers compris (sauf ceux en `_` ou `.` : fichiers, retirés), en chemins relatifs. */
export async function notesUnder(fs: FileSystem, folder: string): Promise<string[]> {
  if (!(await fs.exists(folder))) return []
  const out: string[] = []
  const walk = async (current: string): Promise<void> => {
    const listing = await fs.list(current)
    for (const file of listing.files) if (file.endsWith('.md')) out.push(file.slice(folder.length + 1))
    for (const sub of listing.folders) {
      const name = sub.slice(sub.lastIndexOf('/') + 1)
      if (!name.startsWith('_') && !name.startsWith('.')) await walk(sub)
    }
  }
  await walk(folder)
  return out.sort()
}

/** L'archive d'une bibliothèque : ses entrées et son manifeste. */
export function archive(manifest: Manifest, entries: readonly ZipEntry[], at: Date): Uint8Array {
  return zip([{ name: MANIFEST, data: utf8(`${JSON.stringify(manifest, null, 2)}\n`) }, ...entries], at)
}

/** Un nom de fichier d'archive : « Bibliothèque Normes 2026-11-12.zip ». */
export const archiveName = (name: string, day: string): string => `Bibliothèque ${name.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim()} ${day}.zip`
