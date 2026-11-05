// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les pièces d'une analyse comme sources à interroger : le texte extrait de chaque pièce
 * lue (la section « Texte extrait » de sa note), avec son type et sa place (appel d'offres,
 * réponse) — une source est citée par la note de sa pièce, qui mène à l'original.
 */

import { destinationLabel, type Analysis, type PieceRow } from '../notes'
import { listPieces, type Services } from '../service'
import type { LibrarySource } from './retrieval'

/** Le titre de la section du texte extrait, dans les langues où une note de pièce a pu être écrite. */
const TEXT_HEADINGS = ['Texte extrait', 'Extracted text']

const noteName = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')

/** Le texte extrait d'une note de pièce : ce qui suit son titre « Texte extrait », sans les sections tenues par Black Projects. */
export function pieceText(note: string, headings: readonly string[]): string {
  const lines = note.replace(/\r\n?/g, '\n').split('\n')
  const at = lines.findIndex((line) => headings.some((heading) => line.trim() === `## ${heading}`))
  if (at === -1) return ''
  return lines
    .slice(at + 1)
    .join('\n')
    .replace(/<!-- bp:[^>]*:debut[^>]*-->[\s\S]*?<!-- bp:[^>]*:fin -->/g, '')
    .trim()
}

export interface PieceSource extends LibrarySource {
  row: PieceRow
}

/** Les pièces lues d'une analyse, celles de l'appel d'offres d'abord ; `place` n'en garde qu'une sorte. */
export async function pieceSources(services: Services, analysis: Analysis, place?: PieceRow['destination']['place']): Promise<PieceSource[]> {
  const { fs, t } = services
  const out: PieceSource[] = []
  for (const row of await listPieces(services, analysis)) {
    if (place && row.destination.place !== place) continue
    if (row.state !== 'lue' || !(await fs.exists(row.note))) continue
    const text = pieceText(await fs.readText(row.note), [t('ao.piece.text'), ...TEXT_HEADINGS])
    if (!text) continue
    out.push({
      row,
      path: row.note,
      title: noteName(row.note),
      kind: 'document',
      detail: [row.type, destinationLabel(row.destination, t)].filter(Boolean).join(' · '),
      text
    })
  }
  const rank = (source: PieceSource) => (source.row.destination.place === 'appel-d-offres' ? 0 : 1)
  return out.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title))
}
