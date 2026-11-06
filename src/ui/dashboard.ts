// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le rangement du tableau de bord, sans rien dessiner : testé seul. Chaque opération rend
 * un nouveau rangement complet, que l'hôte garde tel quel.
 */

import type { DashboardLayout, HomeSection } from '../core/views'

export type Column = 'main' | 'side'

/** Le rangement par défaut : chaque section dans sa colonne, dans l'ordre des modules. */
export function defaultLayout(all: readonly HomeSection[]): DashboardLayout {
  return {
    main: all.filter((section) => section.area === 'main').map((section) => section.id),
    side: all.filter((section) => section.area === 'side').map((section) => section.id),
    hidden: [],
    collapsed: []
  }
}

/**
 * Le rangement à montrer : celui de l'utilisateur, sans les sections dont le module n'est
 * plus actif, et avec celles qu'il n'a jamais vues (un module activé depuis) à la fin de
 * leur colonne par défaut.
 */
export function arrange(all: readonly HomeSection[], saved: DashboardLayout | null): DashboardLayout {
  if (!saved) return defaultLayout(all)
  const exists = new Set(all.map((section) => section.id))
  const keep = (ids: readonly string[]) => ids.filter((id) => exists.has(id))
  const known = new Set([...saved.main, ...saved.side, ...saved.hidden])
  const fresh = (column: Column) => all.filter((section) => section.area === column && !known.has(section.id)).map((section) => section.id)
  return {
    main: [...keep(saved.main), ...fresh('main')],
    side: [...keep(saved.side), ...fresh('side')],
    hidden: keep(saved.hidden),
    collapsed: keep(saved.collapsed)
  }
}

/** La colonne d'une section montrée ; masquée : `null`. */
export function columnOf(layout: DashboardLayout, id: string): Column | null {
  if (layout.main.includes(id)) return 'main'
  if (layout.side.includes(id)) return 'side'
  return null
}

function without(layout: DashboardLayout, id: string): DashboardLayout {
  return { ...layout, main: layout.main.filter((each) => each !== id), side: layout.side.filter((each) => each !== id), hidden: layout.hidden.filter((each) => each !== id) }
}

/** Monter (`-1`) ou descendre (`+1`) une section dans sa colonne. */
export function moveSection(layout: DashboardLayout, id: string, delta: -1 | 1): DashboardLayout {
  const column = columnOf(layout, id)
  if (!column) return layout
  const ids = [...layout[column]]
  const from = ids.indexOf(id)
  const to = from + delta
  if (to < 0 || to >= ids.length) return layout
  ids.splice(from, 1)
  ids.splice(to, 0, id)
  return { ...layout, [column]: ids }
}

/**
 * Placer une section dans une colonne, avant `before` (ou à la fin) : glisser-déposer,
 * ou passer d'une colonne à l'autre.
 */
export function placeSection(layout: DashboardLayout, id: string, column: Column, before?: string): DashboardLayout {
  if (id === before) return layout
  const rest = without(layout, id)
  const ids = [...rest[column]]
  const at = before ? ids.indexOf(before) : -1
  ids.splice(at < 0 ? ids.length : at, 0, id)
  return { ...rest, [column]: ids }
}

/** Passer une section dans l'autre colonne, à la même hauteur si possible. */
export function switchColumn(layout: DashboardLayout, id: string): DashboardLayout {
  const column = columnOf(layout, id)
  if (!column) return layout
  const other: Column = column === 'main' ? 'side' : 'main'
  const index = layout[column].indexOf(id)
  return placeSection(layout, id, other, layout[other][index])
}

/** Masquer une section : elle passe dans « Sections masquées ». */
export function hideSection(layout: DashboardLayout, id: string): DashboardLayout {
  if (!columnOf(layout, id)) return layout
  return { ...without(layout, id), hidden: [...layout.hidden, id] }
}

/** Réafficher une section, à la fin de sa colonne par défaut. */
export function showSection(layout: DashboardLayout, section: HomeSection): DashboardLayout {
  return placeSection(layout, section.id, section.area)
}

/** Réduire une section à son titre, ou la déplier. */
export function toggleCollapsed(layout: DashboardLayout, id: string): DashboardLayout {
  const collapsed = layout.collapsed.includes(id) ? layout.collapsed.filter((each) => each !== id) : [...layout.collapsed, id]
  return { ...layout, collapsed }
}
