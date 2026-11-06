// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le rangement de la barre de gauche, sans rien dessiner : testé seul.
 *
 * Accueil (toujours en haut) et Paramètres (toujours en bas) n'en font pas partie. Entre
 * les deux : les entrées proposées par défaut (le tableau de bord, celles des modules), et
 * toutes les fonctions que les modules proposent en tuiles, que l'utilisateur peut ajouter.
 */

import type { IconName, NavEntry, NavLayout, TileSpec } from '../core/views'

export interface MenuItem {
  id: string
  label: string
  icon: IconName
  /** Le module qui la propose, pour la liste des entrées à ajouter. */
  group: string
  /** Présente tant que l'utilisateur ne l'a pas retirée. */
  byDefault: boolean
  run(): void | Promise<void>
}

/** Le préfixe d'une entrée tirée d'une tuile : les identifiants des deux ne se mêlent pas. */
export const TILE_PREFIX = 'tuile:'

const same = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0

/**
 * Tout ce qui peut aller dans le menu : les entrées de navigation (par défaut), puis les
 * tuiles qui ne font pas double emploi avec elles ni avec les entrées fixes (`pinned` :
 * les libellés d'Accueil et de Paramètres).
 */
export function menuCatalog(entries: readonly NavEntry[], tiles: readonly TileSpec[], defaultGroup: string, pinned: readonly string[]): MenuItem[] {
  const fixed = entries.filter((entry) => !pinned.some((label) => same(label, entry.label)))
  const items: MenuItem[] = fixed.map((entry) => ({ id: entry.id, label: entry.label, icon: entry.icon, group: defaultGroup, byDefault: true, run: entry.run }))
  const labels = [...pinned, ...fixed.map((entry) => entry.label)]
  for (const tile of tiles) {
    if (labels.some((label) => same(label, tile.label))) continue
    labels.push(tile.label)
    items.push({ id: `${TILE_PREFIX}${tile.id}`, label: tile.label, icon: tile.icon, group: tile.group, byDefault: false, run: tile.run })
  }
  return items
}

/**
 * Les entrées montrées, dans l'ordre : celles choisies (sans celles dont le module n'est
 * plus actif), puis les entrées par défaut jamais vues (un module activé depuis).
 */
export function shownMenu(items: readonly MenuItem[], saved: NavLayout | null): string[] {
  const exists = new Set(items.map((item) => item.id))
  if (!saved) return items.filter((item) => item.byDefault).map((item) => item.id)
  const known = new Set([...saved.shown, ...saved.hidden])
  return [...saved.shown.filter((id) => exists.has(id)), ...items.filter((item) => item.byDefault && !known.has(item.id)).map((item) => item.id)]
}

/** Ce qu'on peut ajouter au menu, rangé par module (l'ordre du catalogue). */
export function addableMenu(items: readonly MenuItem[], shown: readonly string[]): { group: string; items: MenuItem[] }[] {
  const on = new Set(shown)
  const groups = new Map<string, MenuItem[]>()
  for (const item of items) if (!on.has(item.id)) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  return [...groups].map(([group, list]) => ({ group, items: list }))
}

/**
 * Le rangement à garder : les entrées montrées, et les entrées par défaut retirées — y
 * compris celles d'un module désactivé pour l'instant (`previous`), qui ne reviendront pas
 * d'elles-mêmes quand il sera réactivé.
 */
export function menuLayout(items: readonly MenuItem[], shown: readonly string[], previous: NavLayout | null = null): NavLayout {
  const on = new Set(shown)
  const hidden = [...(previous?.hidden ?? []), ...items.filter((item) => item.byDefault).map((item) => item.id)].filter((id) => !on.has(id))
  return { shown: [...shown], hidden: [...new Set(hidden)] }
}
