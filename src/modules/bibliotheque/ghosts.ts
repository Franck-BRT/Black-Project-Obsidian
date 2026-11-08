// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **fantômes** : un document de la bibliothèque montré dans un dossier où il n'est pas
 * rangé.
 *
 * Un document n'est gardé qu'une fois. Versé de nouveau ailleurs — le même fichier, à son
 * empreinte —, il n'est pas copié : on peut laisser là un fantôme, une petite note qui dit
 * que le document existe et où il est, et qui l'ouvre. Le fantôme nomme son document par un
 * lien (`de`), suivi quand la fiche est déplacée, et par son empreinte, qui le retrouve si
 * le lien s'est perdu.
 */

import { toYaml } from '../../core/yaml'
import { unlink } from './model'

export const GHOST_TYPE = 'bibliotheque-fantome'

export interface LibraryGhost {
  /** Sa note. */
  path: string
  /** La fiche du document qu'il montre, telle que son lien la nomme. */
  of: string
  hash: string
  title: string
  /** Où est sa note (calculé au parcours) : la bibliothèque, le répertoire. */
  shelf?: string
  directory?: string
}

/** La note d'un fantôme : ce qu'il montre, puis une ligne qui dit où est le document. */
export function ghostContent(doc: { record: string; title: string; hash: string }, line: (link: string) => string): string {
  const data = { 'bp-type': GHOST_TYPE, de: `[[${doc.record}]]`, titre: doc.title, empreinte: doc.hash }
  const link = `[[${doc.record}|${doc.title.replace(/[[\]|]/g, ' ')}]]`
  return `---\n${toYaml(data)}\n---\n\n${line(link)}\n`
}

/** Un fantôme relu de sa note ; `null` si ce n'en est pas un. */
export function readGhost(path: string, data: Record<string, unknown> | null): LibraryGhost | null {
  if (!data || data['bp-type'] !== GHOST_TYPE) return null
  const of = unlink(data.de)
  const record = of && !of.endsWith('.md') ? `${of}.md` : of
  return { path, of: record, hash: typeof data.empreinte === 'string' ? data.empreinte : '', title: typeof data.titre === 'string' ? data.titre : '' }
}

/** Le document qu'un fantôme montre : par son lien tant qu'il mène à un document, sinon par l'empreinte. */
export function ghostTarget<T extends { record: string; hash: string }>(ghost: Pick<LibraryGhost, 'of' | 'hash'>, docs: readonly T[]): T | undefined {
  return docs.find((doc) => doc.record === ghost.of) ?? (ghost.hash ? docs.find((doc) => doc.hash === ghost.hash) : undefined)
}
