// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** La date du jour, dans le fuseau de l'utilisateur, au format AAAA-MM-JJ. */
export function localToday(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
