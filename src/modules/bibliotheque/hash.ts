// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'empreinte d'un fichier : SHA-256 de ses octets, en hexadécimal. Deux fichiers de même
 * empreinte sont le même document, quel que soit leur nom : la bibliothèque ne le range
 * qu'une fois, et note seulement d'où il revient.
 */
export async function fingerprintOf(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
