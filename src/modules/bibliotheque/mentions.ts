// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **L'index des mentions** : pour chaque document, ce que son titre et son texte citent d'une
 * source (les termes du glossaire, les personnes…), gardé tant que ni le document ni la source
 * ne changent. La fiche d'un terme (les documents qui l'emploient), celle d'un document (ses
 * termes), celle d'une personne (les documents qui la nomment) ne relisent plus le texte de
 * toute la bibliothèque à chaque fois : seulement celui des documents nouveaux ou changés.
 *
 * L'empreinte d'un document : son fichier (sha256), la version de son texte, sa lecture, son
 * nombre de caractères et son titre. Celle d'une source : ses entrées et leurs noms. L'index vit
 * en mémoire, le temps de la session : il se refait de lui-même à la première demande.
 */

import { findCandidates, type LinkCandidate, type LinkSourceItem } from './links'
import type { LibraryDoc } from './model'

/** Ce qui change quand le texte d'un document change. */
const docStamp = (doc: LibraryDoc): string => [doc.hash, doc.textVersion ?? 0, doc.reading ?? '', doc.characters ?? 0, doc.title].join('|')

/** Ce qui change quand une source change (une entrée ajoutée, retirée, un nom changé). */
const sourceStamp = (items: readonly LinkSourceItem[]): string => items.map((item) => `${item.path}=${item.names.join('/')}`).join('|')

export class MentionIndex {
  private readonly entries = new Map<string, { stamp: string; found: LinkCandidate[] }>()
  /** Combien de textes ont été lus et cherchés (pour les tests et le diagnostic). */
  computed = 0

  constructor(private readonly textOf: (doc: LibraryDoc) => Promise<string>) {}

  /** Ce que le document cite de cette source, dans l'ordre du texte (calculé une fois, puis gardé). */
  async of(source: string, doc: LibraryDoc, items: readonly LinkSourceItem[]): Promise<LinkCandidate[]> {
    if (!items.length) return []
    const key = `${source}|${doc.record}`
    const stamp = `${docStamp(doc)}#${sourceStamp(items)}`
    const known = this.entries.get(key)
    if (known && known.stamp === stamp) return known.found
    const found = findCandidates(await this.textOf(doc), items, doc.record, Number.MAX_SAFE_INTEGER)
    this.computed++
    this.entries.set(key, { stamp, found })
    return found
  }

  /** Oublier les documents qui ne sont plus là (déplacés, retirés). */
  keep(records: ReadonlySet<string>): void {
    for (const key of [...this.entries.keys()]) if (!records.has(key.slice(key.indexOf('|') + 1))) this.entries.delete(key)
  }
}
