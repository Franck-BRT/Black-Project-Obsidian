// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** L'agencement des tuiles de l'accueil, sans rien dessiner : testé seul. */

import type { TileSpec } from '../core/views'

/**
 * Les tuiles à montrer : celles choisies, dans leur ordre, sans celles dont le module n'est
 * plus actif ; à défaut de choix, celles proposées par défaut.
 */
export function shownTiles(all: readonly TileSpec[], chosen: readonly string[] | null): TileSpec[] {
  if (chosen === null) return all.filter((tile) => tile.byDefault)
  const byId = new Map(all.map((tile) => [tile.id, tile]))
  return chosen.map((id) => byId.get(id)).filter((tile): tile is TileSpec => !!tile)
}

/** Les tuiles qu'on peut encore ajouter, rangées par module. */
export function addableTiles(all: readonly TileSpec[], shown: readonly TileSpec[]): { group: string; tiles: TileSpec[] }[] {
  const on = new Set(shown.map((tile) => tile.id))
  const groups = new Map<string, TileSpec[]>()
  for (const tile of all) {
    if (on.has(tile.id)) continue
    groups.set(tile.group, [...(groups.get(tile.group) ?? []), tile])
  }
  return [...groups].map(([group, tiles]) => ({ group, tiles }))
}

/** Une tuile déplacée d'une place à une autre. */
export function moveTile(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids]
  if (from < 0 || from >= next.length) return next
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!)
  return next
}
