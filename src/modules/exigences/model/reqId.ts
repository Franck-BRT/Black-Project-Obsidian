// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les identifiants d'exigences.
 *
 * L'identifiant, c'est l'exigence. Un document le cite, un essai le vérifie, et chacune
 * de ces références survit à la formulation. Aussi un identifiant est attribué une fois
 * et **jamais réutilisé** : redonner REQ-SYS-0042 à une nouvelle exigence après la
 * suppression de l'ancienne redirigerait sans bruit toutes les références qui la
 * nommaient. Le numéro suivant part donc du plus haut qui ait jamais existé, pas d'un
 * compte de ce qui reste.
 */

const PATTERN = /^([A-Z][A-Z0-9]*)-([A-Z0-9]+)-(\d+)$/

export interface ParsedReqId {
  prefix: string
  category: string
  number: number
}

export function parseReqId(id: string): ParsedReqId | null {
  const match = PATTERN.exec(id.trim().toUpperCase())
  if (!match) return null
  return { prefix: match[1]!, category: match[2]!, number: Number(match[3]) }
}

export function isReqId(id: string): boolean {
  return parseReqId(id) !== null
}

/**
 * Une catégorie telle qu'elle figure dans un identifiant : en majuscules, sans
 * séparateur. Ce que l'utilisateur tape — « Système de vol », « sys/vol » — doit pouvoir
 * tenir entre deux tirets et se relire.
 */
export function idCategory(raw: string): string {
  const cleaned = raw
    .normalize('NFD')
    // Les accents tombent : SYSTÈME et SYSTEME ne doivent pas faire deux catégories, et un
    // identifiant se dit et se tape plus souvent qu'il ne se copie.
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
  return cleaned || 'GEN'
}

export interface IdScheme {
  prefix: string
  /** Le nombre de chiffres du numéro. L'élargir plus tard ne casse rien. */
  width: number
}

export const DEFAULT_ID_SCHEME: IdScheme = { prefix: 'REQ', width: 4 }

export function formatReqId(scheme: IdScheme, category: string, number: number): string {
  return `${scheme.prefix}-${idCategory(category)}-${String(number).padStart(scheme.width, '0')}`
}

/**
 * Le prochain identifiant libre d'une catégorie. `taken` : tous les identifiants vus, y
 * compris ceux d'exigences disparues — le plus haut l'emporte, un 42 supprimé ne revient
 * pas. Un numéro plus large que le schéma est respecté, pas tronqué.
 */
export function nextReqId(scheme: IdScheme, category: string, taken: Iterable<string>): string {
  const wanted = idCategory(category)
  let highest = 0
  for (const id of taken) {
    const parsed = parseReqId(id)
    if (parsed === null) continue
    if (parsed.prefix !== scheme.prefix.toUpperCase() || parsed.category !== wanted) continue
    if (parsed.number > highest) highest = parsed.number
  }
  return formatReqId(scheme, wanted, highest + 1)
}

/**
 * Les catégories sous lesquelles la bibliothèque numérote déjà : proposées à la création,
 * pour qu'on n'ait pas SYS et SYSTEME, deux compteurs pour une même famille. Tirées des
 * identifiants et des compteurs — une catégorie dont la dernière exigence a été supprimée
 * reste proposée. Seulement celles de notre préfixe.
 */
export function knownCategories(
  scheme: IdScheme,
  ids: Iterable<string>,
  counters: Record<string, number> = {}
): string[] {
  const seen = new Set(Object.keys(counters))
  for (const id of ids) {
    const parsed = parseReqId(id)
    if (parsed && parsed.prefix === scheme.prefix.toUpperCase()) seen.add(parsed.category)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/** Le nom de fichier d'une exigence : l'identifiant d'abord, pour qu'un dossier se trie comme un registre. */
export function reqFileName(id: string, title: string): string {
  const clean = title
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean ? `${id} ${clean}` : id
}
