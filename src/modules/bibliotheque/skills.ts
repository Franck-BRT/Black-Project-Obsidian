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

import { candidatePath } from './links'
import type { EntityProposal } from './model'

/** Ce qu'un skill peut recevoir, livré par la bibliothèque (d'autres modules en ajoutent). */
export const SKILL_CONTEXTS = ['fiche', 'texte', 'types-de-piece', 'emetteurs', 'candidats', 'dossiers', 'regles-de-rangement'] as const

/**
 * Ce qu'un skill peut rendre : rien (une réponse libre), ou une décision de forme fixée —
 * l'**ingestion** (le texte relu : sa procédure guide la relecture), l'**analyse** (type de
 * pièce, émetteur, projet), le **rangement** (un dossier).
 */
export const SKILL_OUTPUTS = ['ingestion', 'analyse', 'rangement'] as const
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

/** Ce que l'analyse d'un document établit. */
export interface AnalysisDecision {
  /** Un type de pièce de la liste (son code) ; vide : aucun de la liste. */
  category: string
  /** Un émetteur de la liste (son code) ; vide : aucun de la liste. */
  issuer: string
  /** La note du projet concerné (un chemin), vide : aucun. */
  project: string
  /** Ses liens : parmi les candidats seulement (les autres écartés), chacun avec sa raison. */
  links: { path: string; why: string }[]
  /** Les entreprises et personnes citées que la bibliothèque ne connaît pas : proposées, jamais créées seules. */
  proposals: EntityProposal[]
  confidence: number
  reason: string
}

/** La forme de la réponse d'analyse, demandée à l'IA. */
export const ANALYSIS_SCHEMA = {
  name: 'analyse',
  schema: {
    type: 'object',
    properties: {
      typePiece: { type: 'string' },
      emetteur: { type: 'string' },
      projet: { type: 'string' },
      liens: {
        type: 'array',
        items: { type: 'object', properties: { vers: { type: 'string' }, pourquoi: { type: 'string' } }, required: ['vers', 'pourquoi'], additionalProperties: false }
      },
      nouveaux: {
        type: 'array',
        items: {
          type: 'object',
          properties: { sorte: { type: 'string', enum: ['entreprise', 'personne'] }, nom: { type: 'string' }, code: { type: 'string' }, entreprise: { type: 'string' }, pourquoi: { type: 'string' } },
          required: ['sorte', 'nom', 'code', 'entreprise', 'pourquoi'],
          additionalProperties: false
        }
      },
      confiance: { type: 'number' },
      raison: { type: 'string' }
    },
    required: ['typePiece', 'emetteur', 'projet', 'liens', 'nouveaux', 'confiance', 'raison'],
    additionalProperties: false
  }
}

const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[«»"“”]/g, '')
    .trim()

/**
 * Relire la réponse d'analyse : un type de pièce de la liste (par son code ou son libellé,
 * « CCTP — Cahier… » aussi), un émetteur de la liste (code, nom ou autre nom), le chemin d'un
 * projet tel quel (l'application vérifie qu'il existe), les liens parmi les candidats (par leur
 * chemin ou leur nom ; les autres écartés). Ce qui n'est pas de la liste est laissé vide.
 * `null` : illisible.
 */
export function readAnalysisAnswer(
  answer: unknown,
  lists: {
    types: readonly { code: string; label: string }[]
    issuers: readonly { code: string; name: string; aliases: readonly string[] }[]
    candidates?: readonly { path: string; label: string }[]
    /** Les personnes connues (leur nom) : une proposée qui en est une est écartée. */
    persons?: readonly string[]
  }
): AnalysisDecision | null {
  if (typeof answer !== 'object' || answer === null) return null
  const data = answer as Record<string, unknown>
  const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
  const said = { type: text(data.typePiece), issuer: text(data.emetteur), project: text(data.projet), reason: text(data.raison) }
  if (!said.type && !said.issuer && !said.project && !said.reason) return null
  const head = (value: string) => fold(value.split(/\s+[—–(-]\s*/)[0] ?? value)
  const type = said.type ? lists.types.find((each) => [each.code, each.label].some((name) => fold(name) === fold(said.type) || fold(name) === head(said.type))) : undefined
  const issuer = said.issuer ? lists.issuers.find((each) => [each.code, each.name, ...each.aliases].some((name) => fold(name) === fold(said.issuer) || fold(name) === head(said.issuer))) : undefined
  const links: { path: string; why: string }[] = []
  for (const raw of Array.isArray(data.liens) ? data.liens : []) {
    const item = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const path = candidatePath(text(item.vers), lists.candidates ?? [])
    if (path && !links.some((each) => each.path === path)) links.push({ path, why: text(item.pourquoi) })
  }
  // Les inconnues proposées : ni une entreprise, ni une personne connues ; une fois chacune.
  const proposals: EntityProposal[] = []
  const knownIssuer = (name: string) => lists.issuers.some((each) => [each.code, each.name, ...each.aliases].some((known) => fold(known) === fold(name)))
  const knownPerson = (name: string) => (lists.persons ?? []).some((known) => fold(known) === fold(name))
  for (const raw of Array.isArray(data.nouveaux) ? data.nouveaux : []) {
    const item = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const kind = item.sorte === 'personne' ? ('person' as const) : item.sorte === 'entreprise' ? ('issuer' as const) : null
    const name = text(item.nom)
    const code = text(item.code)
    if (!kind || !name) continue
    if (kind === 'issuer' ? knownIssuer(name) || (!!code && knownIssuer(code)) : knownPerson(name)) continue
    if (proposals.some((each) => each.kind === kind && fold(each.name) === fold(name))) continue
    proposals.push({ kind, name, ...(kind === 'issuer' && code ? { code } : {}), ...(kind === 'person' && text(item.entreprise) ? { company: text(item.entreprise) } : {}), why: text(item.pourquoi) })
  }
  return {
    category: type?.code ?? '',
    issuer: issuer?.code ?? '',
    project: said.project.replace(/^\[\[|\]\]$/g, '').trim(),
    links,
    proposals,
    confidence: readConfidence(data.confiance),
    reason: said.reason
  }
}
