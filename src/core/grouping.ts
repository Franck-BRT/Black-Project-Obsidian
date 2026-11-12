// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Regrouper les cartes d'une page en **sections repliables** (la bibliothèque, les
 * exigences…) : une section par groupe, l'intitulé dit combien. Au-delà de quatre groupes
 * et de douze cartes, elles sont repliées d'origine ; le regroupement choisi est gardé page
 * par page, d'une ouverture à l'autre.
 */

import type { Card, HomeBlock, ViewAction } from './views'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Le groupe d'une carte : sa clé, son intitulé, son rang (les plus petits d'abord, puis par intitulé). */
export interface Group {
  key: string
  title: string
  order?: number
}

/** Où est gardé, d'une session à l'autre, le regroupement (ou la vue) choisi pour chaque page. */
const CHOSEN_KEY = 'black-projects.regroupements'

/** Le regroupement choisi pour chaque page (sinon celui d'origine) : gardé d'une ouverture à l'autre quand on le peut. */
const chosen = new Map<string, string>(
  (() => {
    try {
      const saved: unknown = JSON.parse(globalThis.localStorage?.getItem(CHOSEN_KEY) ?? '{}')
      return saved && typeof saved === 'object' ? Object.entries(saved as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string') : []
    } catch {
      return []
    }
  })()
)

export const groupingOf = (page: string, fallback: string): string => chosen.get(page) ?? fallback
export const setGrouping = (page: string, id: string): void => {
  chosen.set(page, id)
  try {
    globalThis.localStorage?.setItem(CHOSEN_KEY, JSON.stringify(Object.fromEntries(chosen)))
  } catch {
    // Sans stockage (plein, refusé) : le temps de la session.
  }
}

/** Le sélecteur « Regrouper par » d'une page : ses choix (`prefix.id` pour leur libellé). */
export function groupingSelector(page: string, current: string, ids: readonly string[], t: Translate, prefix: string): { label: string; current: string; options: ViewAction[] } {
  return {
    label: t('ui.page.group'),
    current,
    options: ids.map((id) => ({ id, label: t(`${prefix}.${id}`), run: () => setGrouping(page, id) }))
  }
}

/** Des cartes en sections (une par groupe) ; `null` : sans regroupement, un seul bloc de cartes. */
export function grouped<T>(items: readonly T[], cardOf: (item: T) => Card, groupOf: ((item: T) => Group) | null, id: string, count: (n: number) => string): HomeBlock[] {
  if (!groupOf) return [{ kind: 'cards', cards: items.map(cardOf) }]
  const groups = new Map<string, Group & { cards: Card[] }>()
  for (const item of items) {
    const group = groupOf(item)
    const known = groups.get(group.key) ?? { ...group, cards: [] }
    known.cards.push(cardOf(item))
    groups.set(group.key, known)
  }
  const sorted = [...groups.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, 'fr'))
  return sorted.map((group) => ({
    kind: 'section',
    id: `${id}.${group.key}`,
    title: group.title,
    subtitle: count(group.cards.length),
    // Repliées d'origine quand il y en a beaucoup, et de quoi les remplir.
    collapsed: sorted.length > 4 && items.length > 12,
    blocks: [{ kind: 'cards', cards: group.cards }]
  }))
}
