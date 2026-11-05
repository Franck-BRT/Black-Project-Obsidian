// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Une exigence sur le disque : dans l'en-tête de sa note, comme tout ce que Black Projects
 * range, pour qu'elle se cherche, se compare avec git et se relise dans dix ans sans le
 * plugin qui l'a écrite. Les formulations sont dans l'en-tête aussi : une exigence en a
 * plusieurs, et une seule tiendrait dans le corps de la note.
 *
 * Une note d'exigence se reconnaît à la clé `brt-requirement: true`. Les notes de la
 * version complète de Black Projects, marquées de l'ancienne clé (`LEGACY_FRONTMATTER_KEY`),
 * sont lues aussi, et prennent la nouvelle clé quand elles sont réécrites.
 */

import type { Requirement, ReqLink, ReqRevision, ReqText, VerificationMethod } from './requirement'
import { makeRequirement, REQ_LINK_KINDS, VERIFICATION_METHODS } from './requirement'
import { cleanAliases } from './aliases'

export const REQUIREMENT_FRONTMATTER_KEY = 'brt-requirement'
/** L'ancienne clé, lue seulement. */
export const LEGACY_FRONTMATTER_KEY = 'pm-requirement'

/** L'en-tête est-il celui d'une exigence ? */
export function isRequirementFrontmatter(data: Readonly<Record<string, unknown>>): boolean {
  return data[REQUIREMENT_FRONTMATTER_KEY] === true || data[LEGACY_FRONTMATTER_KEY] === true
}

/** Les clés de l'en-tête qui appartiennent à l'exigence ; les autres sont gardées telles quelles. */
export const REQUIREMENT_FRONTMATTER_KEYS: ReadonlySet<string> = new Set([
  REQUIREMENT_FRONTMATTER_KEY,
  LEGACY_FRONTMATTER_KEY,
  'id',
  'title',
  'category',
  'type',
  'status',
  'criticality',
  'verification',
  'source',
  'rationale',
  'owner',
  'tags',
  'aliases',
  'sourceLang',
  'rev',
  'text',
  'links',
  'history',
  'createdAt',
  'updatedAt',
  'origin'
])

function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : fallback
}

function strList(raw: unknown): string[] {
  if (typeof raw === 'string') return raw.trim() ? [raw.trim()] : []
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : []
}

function posInt(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

function readVerification(raw: unknown): VerificationMethod {
  return VERIFICATION_METHODS.includes(raw as VerificationMethod) ? (raw as VerificationMethod) : 'none'
}

/**
 * Une formulation telle qu'elle a été rangée. Une note modifiée à la main peut ne contenir
 * qu'un texte là où le plugin écrit un objet — `en: "The system shall…"` — : c'est ce
 * qu'une personne tape naturellement, et le perdre serait perdre ce qu'elle a écrit.
 */
function readText(raw: unknown, rev: number): ReqText | null {
  if (typeof raw === 'string') {
    return raw.trim() ? { body: raw, fromRev: rev, at: '', by: '', origin: 'human', reviewed: true } : null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as Record<string, unknown>
  const body = str(row.body)
  if (!body.trim()) return null
  return {
    body,
    fromRev: posInt(row.fromRev, rev),
    at: str(row.at),
    by: str(row.by),
    origin: row.origin === 'machine' ? 'machine' : 'human',
    // Seul un `false` explicite rend une formulation non relue : une note qui n'en dit
    // rien a été écrite avant que le champ existe.
    reviewed: row.reviewed !== false
  }
}

function readLinks(raw: unknown): ReqLink[] {
  if (!Array.isArray(raw)) return []
  const out: ReqLink[] = []
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const entry = row as Record<string, unknown>
    const kind = entry.kind
    const to = str(entry.to).trim()
    if (!to || !REQ_LINK_KINDS.includes(kind as ReqLink['kind'])) continue
    out.push({ kind: kind as ReqLink['kind'], to, ...(entry.suspect === true ? { suspect: true } : {}) })
  }
  return out
}

function readHistory(raw: unknown): ReqRevision[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => ({
      rev: posInt(row.rev, 1),
      at: str(row.at),
      by: str(row.by),
      lang: str(row.lang),
      was: str(row.was),
      note: str(row.note)
    }))
}

/** L'exigence décrite par un en-tête. */
export function hydrateRequirement(frontmatter: Record<string, unknown>, filePath: string): Requirement {
  const rev = posInt(frontmatter.rev, 1)
  const text: Record<string, ReqText> = {}
  const rawText = frontmatter.text
  if (typeof rawText === 'object' && rawText !== null) {
    for (const [lang, value] of Object.entries(rawText as Record<string, unknown>)) {
      const held = readText(value, rev)
      if (held) text[lang] = held
    }
  }
  const id = str(frontmatter.id, filePath)
  return makeRequirement({
    id,
    title: str(frontmatter.title),
    category: str(frontmatter.category),
    type: str(frontmatter.type),
    status: str(frontmatter.status),
    criticality: str(frontmatter.criticality),
    verification: readVerification(frontmatter.verification),
    source: str(frontmatter.source),
    rationale: str(frontmatter.rationale),
    owner: str(frontmatter.owner),
    tags: strList(frontmatter.tags),
    // Relus avec les règles qui les écrivent : une note modifiée à la main peut contenir
    // un alias en minuscules, ou l'identifiant lui-même.
    aliases: cleanAliases(frontmatter.aliases, id),
    sourceLang: str(frontmatter.sourceLang, 'fr'),
    rev,
    text,
    links: readLinks(frontmatter.links),
    history: readHistory(frontmatter.history),
    createdAt: str(frontmatter.createdAt),
    updatedAt: str(frontmatter.updatedAt),
    filePath,
    ...readOrigin(frontmatter.origin)
  })
}

function readOrigin(raw: unknown): { origin?: Requirement['origin'] } {
  if (typeof raw !== 'object' || raw === null) return {}
  const row = raw as Record<string, unknown>
  const piece = str(row.piece)
  return piece ? { origin: { piece, locator: str(row.locator) } } : {}
}

/**
 * Ce qui retourne dans l'en-tête. Les champs vides sont omis plutôt qu'écrits à blanc :
 * en ouvrant la note, on voit ce qui a vraiment été rempli.
 */
export function requirementFrontmatter(requirement: Requirement): Record<string, unknown> {
  const fm: Record<string, unknown> = {
    [REQUIREMENT_FRONTMATTER_KEY]: true,
    id: requirement.id,
    title: requirement.title,
    sourceLang: requirement.sourceLang,
    rev: requirement.rev,
    text: Object.fromEntries(
      Object.entries(requirement.text).map(([lang, held]) => [
        lang,
        { body: held.body, fromRev: held.fromRev, at: held.at, by: held.by, origin: held.origin, reviewed: held.reviewed }
      ])
    ),
    createdAt: requirement.createdAt,
    updatedAt: requirement.updatedAt
  }
  for (const key of ['category', 'type', 'status', 'criticality', 'source', 'rationale', 'owner'] as const) {
    if (requirement[key]) fm[key] = requirement[key]
  }
  if (requirement.verification !== 'none') fm.verification = requirement.verification
  if (requirement.tags.length) fm.tags = requirement.tags
  if (requirement.aliases.length) fm.aliases = requirement.aliases
  if (requirement.links.length) fm.links = requirement.links.map((link) => ({ ...link }))
  if (requirement.history.length) fm.history = requirement.history.map((revision) => ({ ...revision }))
  if (requirement.origin) fm.origin = { piece: requirement.origin.piece, locator: requirement.origin.locator }
  return fm
}
