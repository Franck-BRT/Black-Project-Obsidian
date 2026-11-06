// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'historique de navigation de l'onglet, sans rien dessiner : testé seul. Chaque page
 * quittée y entre avec son titre ; « Retour » ramène à la dernière et la retire — comme
 * le bouton « précédent » d'un navigateur, d'où qu'on soit venu (menu, tuile, carte,
 * lien, commande).
 */

export interface Visit {
  /** La page, telle que l'interface la connaît : « home », « ao.fiche?… ». */
  page: string
  /** Son titre au moment où on l'a quittée : « Station sol de télémesure ». */
  title: string
}

/** Au plus autant de pages retenues : au-delà, les plus anciennes s'effacent. */
export const HISTORY_LIMIT = 30

/** On quitte `from` pour `to` : `from` entre dans l'historique (pas si c'est la même page). */
export function leave(trail: readonly Visit[], from: Visit | null, to: string): Visit[] {
  if (!from || from.page === to) return [...trail]
  return [...trail, from].slice(-HISTORY_LIMIT)
}

/** La page où « Retour » ramène, et l'historique une fois revenu ; `null` : rien avant. */
export function back(trail: readonly Visit[]): { to: Visit; trail: Visit[] } | null {
  const to = trail.at(-1)
  return to ? { to, trail: trail.slice(0, -1) } : null
}
