// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Vérifier les exigences d'un dossier, sans IA :
 *
 * - **oubliées** : les phrases des documents qui ont la tournure d'une exigence (« doit »,
 *   « shall »…) mais qu'aucune exigence de la bibliothèque ne reprend ;
 * - **cohérence** : un même identifiant écrit différemment d'une pièce à l'autre, présent
 *   dans une version d'un document et pas dans l'autre, en double, ou un même texte sous
 *   deux identifiants ; une exigence rangée qui ne dit plus ce que dit sa pièce ;
 * - **couverture** : pour chaque exigence, l'endroit de la réponse qui la cite ou la
 *   traite — ou son absence.
 *
 * Fonctions pures : le module qui les appelle lit les documents et écrit le rapport.
 */

import { namesOf } from '../model/aliases'
import type { Requirement } from '../model/requirement'
import type { ReqLocation } from '../import/document'
import type { Passage } from './passages'
import { keywords, normalizeText, normativeMarker, overlap, sameWording, sentences } from './text'

/** Un document lu : sa pièce (un lien, ou un nom) et ses passages. */
export interface ReadDocument {
  piece: string
  passages: readonly Passage[]
}

const wordingOf = (requirement: Requirement): string =>
  requirement.text[requirement.sourceLang]?.body ?? Object.values(requirement.text)[0]?.body ?? requirement.title

/** Le texte cite-t-il ce nom (identifiant ou alias), comme un mot entier ? */
function cites(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}($|[^A-Za-z0-9_-])`, 'i').test(text)
}

// ── Les exigences oubliées ─────────────────────────────────────────────────────────

export interface Missed {
  sentence: string
  /** La tournure qui l'a fait relever : « doit », « shall »… */
  marker: string
  piece: string
  where: ReqLocation
  /** Les autres pièces où la même phrase figure (une autre version du même document). */
  alsoIn: string[]
}

/** Une phrase est-elle déjà reprise par une exigence ? Par son nom, ou par ses mots. */
function covered(sentence: string, library: readonly { names: string[]; words: Set<string>; flat: string }[]): boolean {
  const words = keywords(sentence)
  const flat = normalizeText(sentence)
  return library.some(
    (entry) =>
      entry.names.some((name) => cites(sentence, name)) ||
      (flat.length > 0 && (entry.flat.includes(flat) || flat.includes(entry.flat))) ||
      overlap(words, entry.words) >= 0.7
  )
}

/** Les phrases qui ont la tournure d'une exigence et qu'aucune exigence ne reprend, une fois chacune. */
export function missedRequirements(documents: readonly ReadDocument[], library: readonly Requirement[]): Missed[] {
  const known = library.map((requirement) => {
    const wording = wordingOf(requirement)
    return { names: namesOf(requirement), words: keywords(wording), flat: normalizeText(wording) }
  })
  const found = new Map<string, Missed>()
  for (const document of documents) {
    for (const passage of document.passages) {
      for (const sentence of sentences(passage.text)) {
        const marker = normativeMarker(sentence)
        // Trop courte pour être une exigence (« Il doit. »), ou déjà reprise.
        if (!marker || sentence.length < 25 || covered(sentence, known)) continue
        const key = normalizeText(sentence)
        const held = found.get(key)
        if (held) {
          if (held.piece !== document.piece && !held.alsoIn.includes(document.piece)) held.alsoIn.push(document.piece)
          continue
        }
        found.set(key, { sentence, marker, piece: document.piece, where: passage.where, alsoIn: [] })
      }
    }
  }
  return [...found.values()]
}

// ── La cohérence entre pièces ──────────────────────────────────────────────────────

/** Ce qu'une pièce dit de ses exigences : ses lignes d'import, lues sans rien écrire. */
export interface PieceRequirements {
  piece: string
  /** Le type de la pièce : deux pièces du même type sont deux versions d'un même document. */
  type: string
  rows: readonly Record<string, string>[]
  where: readonly ReqLocation[]
}

export type FindingKind = 'divergent' | 'missing' | 'duplicate' | 'same-text' | 'library-differs'

export interface Finding {
  kind: FindingKind
  /** L'identifiant concerné (ou les identifiants, pour un même texte). */
  ids: string[]
  /** Les pièces concernées. */
  pieces: string[]
  /** Les formulations en cause, pour les montrer. */
  texts: string[]
}

const rowWording = (row: Record<string, string>): string =>
  Object.entries(row).find(([key]) => key.startsWith('text.'))?.[1] ?? row.title ?? ''

/** Les incohérences entre les pièces, et entre les pièces et les exigences rangées. */
export function coherence(pieces: readonly PieceRequirements[], library: readonly Requirement[]): Finding[] {
  const findings: Finding[] = []
  const byId = new Map<string, { piece: string; type: string; text: string }[]>()

  for (const piece of pieces) {
    const seen = new Map<string, number>()
    for (const row of piece.rows) {
      const id = (row.id ?? '').trim().toUpperCase()
      if (!id) continue
      seen.set(id, (seen.get(id) ?? 0) + 1)
      byId.set(id, [...(byId.get(id) ?? []), { piece: piece.piece, type: piece.type, text: rowWording(row) }])
    }
    for (const [id, count] of seen) {
      if (count > 1) {
        findings.push({
          kind: 'duplicate',
          ids: [id],
          pieces: [piece.piece],
          texts: piece.rows.filter((row) => (row.id ?? '').trim().toUpperCase() === id).map(rowWording)
        })
      }
    }
  }

  // Un même identifiant écrit différemment d'une pièce à l'autre.
  for (const [id, occurrences] of byId) {
    const distinct: { piece: string; text: string }[] = []
    for (const occurrence of occurrences) {
      if (!distinct.some((each) => sameWording(each.text, occurrence.text))) distinct.push(occurrence)
    }
    if (distinct.length > 1) {
      findings.push({
        kind: 'divergent',
        ids: [id],
        pieces: [...new Set(occurrences.map((each) => each.piece))],
        texts: distinct.map((each) => each.text)
      })
    }
  }

  // Présent dans une version d'un document et pas dans une autre (pièces du même type).
  const byType = new Map<string, PieceRequirements[]>()
  for (const piece of pieces) byType.set(piece.type, [...(byType.get(piece.type) ?? []), piece])
  for (const versions of byType.values()) {
    if (versions.length < 2) continue
    const idsOf = (piece: PieceRequirements) => new Set(piece.rows.map((row) => (row.id ?? '').trim().toUpperCase()).filter(Boolean))
    const all = new Set(versions.flatMap((piece) => [...idsOf(piece)]))
    for (const id of all) {
      const without = versions.filter((piece) => !idsOf(piece).has(id))
      if (without.length > 0) {
        findings.push({ kind: 'missing', ids: [id], pieces: without.map((piece) => piece.piece), texts: [] })
      }
    }
  }

  // Un même texte sous des identifiants différents.
  const byText = new Map<string, Set<string>>()
  for (const [id, occurrences] of byId) {
    for (const occurrence of occurrences) {
      const key = normalizeText(occurrence.text)
      if (!key) continue
      byText.set(key, new Set([...(byText.get(key) ?? []), id]))
    }
  }
  for (const [key, ids] of byText) {
    if (ids.size < 2) continue
    const pieces2 = [...ids].flatMap((id) => (byId.get(id) ?? []).map((each) => each.piece))
    const text = [...ids].map((id) => byId.get(id)?.find((each) => normalizeText(each.text) === key)?.text ?? '')[0] ?? ''
    findings.push({ kind: 'same-text', ids: [...ids].sort(), pieces: [...new Set(pieces2)], texts: [text] })
  }

  // Une exigence rangée qui ne dit plus ce que dit sa pièce.
  for (const requirement of library) {
    const occurrences = byId.get(requirement.id.toUpperCase())
    if (!occurrences?.length) continue
    const stored = wordingOf(requirement)
    if (occurrences.some((each) => sameWording(each.text, stored))) continue
    findings.push({
      kind: 'library-differs',
      ids: [requirement.id],
      pieces: [...new Set(occurrences.map((each) => each.piece))],
      texts: [stored, occurrences[0]!.text]
    })
  }
  return findings
}

// ── La couverture par la réponse ───────────────────────────────────────────────────

export type CoverageStatus = 'cited' | 'addressed' | 'partial' | 'absent'

export interface Coverage {
  requirement: Requirement
  status: CoverageStatus
  /** La part des mots de l'exigence retrouvés dans le passage (0 à 1). */
  score: number
  piece?: string
  where?: ReqLocation
  excerpt?: string
}

/** Seuils : au moins 60 % des mots de l'exigence, traitée ; au moins 35 %, à vérifier. */
export const ADDRESSED = 0.6
export const PARTIAL = 0.35

/**
 * Pour chaque exigence, le meilleur endroit de la réponse : un passage qui la **cite**
 * (son identifiant ou un alias), sinon celui qui reprend le plus de ses mots.
 */
export function coverage(requirements: readonly Requirement[], response: readonly ReadDocument[]): Coverage[] {
  const passages = response.flatMap((document) =>
    document.passages.map((passage) => ({ piece: document.piece, passage, words: keywords(passage.text) }))
  )
  return requirements.map((requirement) => {
    const names = namesOf(requirement)
    const citing = passages.find((each) => names.some((name) => cites(each.passage.text, name)))
    if (citing) {
      return { requirement, status: 'cited', score: 1, piece: citing.piece, where: citing.passage.where, excerpt: citing.passage.text }
    }
    const words = keywords(wordingOf(requirement))
    let best: (typeof passages)[number] | undefined
    let score = 0
    for (const each of passages) {
      const value = overlap(words, each.words)
      if (value > score) {
        score = value
        best = each
      }
    }
    const status: CoverageStatus = score >= ADDRESSED ? 'addressed' : score >= PARTIAL ? 'partial' : 'absent'
    return best && status !== 'absent'
      ? { requirement, status, score, piece: best.piece, where: best.passage.where, excerpt: best.passage.text }
      : { requirement, status, score }
  })
}
