// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Les skills exécutables** (le circuit des documents, voir
 * `docs/architecture/circuit-des-documents.md`) : un skill dit, dans son en-tête, le
 * **contexte** qu'il reçoit (la fiche, le texte, les dossiers possibles…) et la **sortie**
 * qu'il rend (une décision de forme fixée), avec un **seuil** de confiance.
 *
 * L'IA décide, l'application exécute : la réponse de l'IA est relue ici, et tout ce qui
 * n'est pas sûr (illisible, hors forme, un dossier qui n'existe pas) vaut confiance 0.
 * Des fonctions pures.
 */

/** Ce qu'un skill peut recevoir, livré par la bibliothèque (d'autres modules en ajoutent). */
export const SKILL_CONTEXTS = ['fiche', 'texte', 'dossiers', 'regles-de-rangement'] as const

/** Ce qu'un skill peut rendre : rien (une réponse libre), ou une décision de forme fixée. */
export const SKILL_OUTPUTS = ['rangement'] as const
export type SkillOutput = (typeof SKILL_OUTPUTS)[number]

/** Le seuil de confiance par défaut : en dessous, la décision n'est pas appliquée, elle est soumise. */
export const DEFAULT_THRESHOLD = 0.7

/** Un seuil écrit à la main : « 0,7 », « 0.7 », « 70 », « 70 % » ; hors de 0..1 ou illisible : `null`. */
export function readThreshold(value: unknown): number | null {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : ''
  const cleaned = raw.trim().replace('%', '').replace(',', '.').trim()
  if (!cleaned) return null
  const number = Number(cleaned)
  if (!Number.isFinite(number)) return null
  const ratio = number > 1 ? number / 100 : number
  return ratio >= 0 && ratio <= 1 ? Math.round(ratio * 100) / 100 : null
}

/** Un seuil en mots : « 70 % ». */
export const thresholdLabel = (value: number): string => `${Math.round(value * 100)} %`

/** Une confiance rendue par l'IA : 0..1, ou en pourcentage (0..100) ; autre chose : 0. */
export function readConfidence(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.').replace('%', '').trim()) : NaN
  if (!Number.isFinite(number) || number < 0) return 0
  const ratio = number > 1 ? number / 100 : number
  return ratio > 1 ? 0 : Math.round(ratio * 100) / 100
}

/** La décision de rangement d'un document. */
export interface FilingDecision {
  /** Le dossier choisi (un de ceux proposés) ; vide : aucun de ceux proposés. */
  folder: string
  confidence: number
  reason: string
  /** D'autres dossiers possibles, parmi ceux proposés, du plus au moins probable. */
  alternatives: string[]
}

/** La forme de la réponse de rangement, demandée à l'IA. */
export const FILING_SCHEMA = {
  name: 'rangement',
  schema: {
    type: 'object',
    properties: {
      dossier: { type: 'string' },
      confiance: { type: 'number' },
      raison: { type: 'string' },
      alternatives: { type: 'array', items: { type: 'string' } }
    },
    required: ['dossier', 'confiance', 'raison', 'alternatives'],
    additionalProperties: false
  }
}

const trimFolder = (value: string): string => value.trim().replace(/^\/+|\/+$/g, '')

/**
 * Relire la réponse de rangement : `null` si elle est illisible (pas un objet, pas de dossier
 * ni de raison) ; un dossier qui n'est pas parmi ceux proposés est écarté (confiance 0).
 */
export function readFilingAnswer(answer: unknown, allowed: readonly string[]): FilingDecision | null {
  if (typeof answer !== 'object' || answer === null) return null
  const data = answer as Record<string, unknown>
  const wanted = typeof data.dossier === 'string' ? trimFolder(data.dossier) : ''
  const reason = typeof data.raison === 'string' ? data.raison.trim() : ''
  if (!wanted && !reason) return null
  const known = new Map(allowed.map((folder) => [trimFolder(folder).toLowerCase(), trimFolder(folder)]))
  const folder = known.get(wanted.toLowerCase()) ?? ''
  const alternatives = (Array.isArray(data.alternatives) ? data.alternatives : [])
    .map((each) => (typeof each === 'string' ? known.get(trimFolder(each).toLowerCase()) : undefined))
    .filter((each): each is string => !!each && each !== folder)
  return { folder, confidence: folder ? readConfidence(data.confiance) : 0, reason, alternatives: [...new Set(alternatives)] }
}
