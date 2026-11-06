// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Ce que l'interface calcule sans rien dessiner : testé seul. */

import type { IconName, Tone } from '../core/views'

/** L'icône qui accompagne toujours la couleur d'un état. */
export const TONE_ICON: Record<Tone, IconName> = {
  success: 'check',
  warning: 'alert',
  danger: 'cross',
  info: 'info',
  neutral: 'info'
}

const DAY = 86_400_000

const midnight = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())

/** Les jours d'ici une date (AAAA-MM-JJ) ; négatif si elle est passée ; null si ce n'en est pas une. */
export function daysUntil(day: string, today: Date): number | null {
  const found = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!found) return null
  return Math.round((Date.UTC(Number(found[1]), Number(found[2]) - 1, Number(found[3])) - midnight(today)) / DAY)
}

/** L'urgence d'une échéance : passée, dans la semaine, dans les trois semaines, plus tard. */
export function deadlineTone(days: number): Tone {
  if (days < 0) return 'neutral'
  if (days <= 7) return 'danger'
  if (days <= 21) return 'warning'
  return 'success'
}

/** Le moment de la journée, pour saluer. */
export function greetingKey(now: Date): string {
  const hour = now.getHours()
  return hour < 5 ? 'ui.hello.evening' : hour < 12 ? 'ui.hello.morning' : hour < 18 ? 'ui.hello.afternoon' : 'ui.hello.evening'
}

/** Cinq étoiles, pleines puis vides. */
export function starGlyphs(stars: number): string {
  const full = Math.max(0, Math.min(5, Math.round(stars)))
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}
