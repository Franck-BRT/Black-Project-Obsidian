// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Programmes, projets, affaires** — et les **types de projet** qui donnent ses phases à un
 * projet.
 *
 * - Un **programme** regroupe des projets (un dossier, sa note).
 * - Un **projet** suit les **phases** de son type, rangées en **étapes** : les phases d'une
 *   même étape vont en parallèle, les étapes se suivent. Une phase a une **sorte** : libre,
 *   ou celle d'un module (l'analyse d'un appel d'offres, par le module AO).
 * - Une **affaire** appartient à un projet ; souvent, un projet est une affaire, mais pas
 *   toujours (il peut en avoir plusieurs, ou aucune).
 *
 * Les phases d'un projet sont **copiées** de son type à sa création : changer le type ensuite
 * ne change pas les projets déjà lancés.
 */

import type { IconName, JourneyProgress, TileColor } from '../../core/views'

export const PROGRAMME_TYPE = 'programme'
export const PROJECT_TYPE = 'projet'
export const AFFAIRE_TYPE = 'affaire'

/** Le dossier des affaires, dans celui d'un projet. */
export const AFFAIRES_FOLDER = 'Affaires'

export const TILE_COLORS: readonly TileColor[] = ['indigo', 'blue', 'teal', 'green', 'orange', 'rose', 'violet', 'slate']

/** Les icônes qu'on peut donner à une phase, à un type de projet, à un programme. */
export const PHASE_ICONS: readonly IconName[] = ['flow', 'search', 'file', 'list', 'chat', 'calendar', 'clock', 'check', 'star', 'spark', 'building', 'book', 'upload', 'edit', 'chart', 'folder', 'tag', 'eye', 'play', 'lock']

/** La sorte d'une phase sans module : on la mène soi-même. */
export const FREE_KIND = 'libre'

/** Une phase d'un type de projet. */
/** Un document qu'une phase attend : son type de pièce (« CCTP »), et un nom s'il en faut un. */
export interface ExpectedDocSpec {
  type: string
  label?: string
}

export interface PhaseSpec {
  id: string
  name: string
  /** `libre`, ou une sorte déclarée par un module (`ao.analyse`). */
  kind: string
  icon: IconName
  color: TileColor
  description?: string
  /** Sa durée prévue, en jours (calendaires). */
  duration?: number
  /** Les documents qu'elle attend (plusieurs, au besoin). */
  documents?: ExpectedDocSpec[]
}

/** Un document attendu par une phase d'un projet : reçu ou non, et où il est. */
export interface ExpectedDoc extends ExpectedDocSpec {
  received?: boolean
  /** Le fichier ou la note qui le porte. */
  link?: string
  /** Le jour où il a été reçu. */
  on?: string
}

/**
 * Une **phase englobante** : elle couvre des étapes qui se suivent (« Avant-vente » : de la
 * veille à la remise de l'offre). `from` et `to` : ses première et dernière étapes, à partir de
 * 0 dans un type, de 1 dans un projet.
 */
export interface SpanSpec {
  id: string
  name: string
  color: TileColor
  from: number
  to: number
  description?: string
}

/** Un **type de projet** : ses phases, en étapes (les phases d'une étape vont en parallèle) ; ses phases englobantes. */
export interface ProjectType {
  id: string
  name: string
  icon: IconName
  color: TileColor
  description?: string
  stages: PhaseSpec[][]
  spans?: SpanSpec[]
}

/** Où en est une phase d'un projet. */
export type PhaseStatus = 'a-venir' | 'en-cours' | 'terminee' | 'sans-objet'
export const PHASE_STATUSES: readonly PhaseStatus[] = ['a-venir', 'en-cours', 'terminee', 'sans-objet']

/** Une phase d'un projet : celle de son type, et où il en est. */
export interface ProjectPhase extends Omit<PhaseSpec, 'documents'> {
  /** Son étape, à partir de 1. */
  stage: number
  status: PhaseStatus
  /** Ses dates réelles : commencée, terminée. */
  start?: string
  end?: string
  /** Ses dates prévues : du démarrage du projet et des durées des phases d'avant, recalées sur ce qui s'est passé. */
  plannedStart?: string
  plannedEnd?: string
  /** Ses dates du planning initial (au démarrage, ou quand une durée change) : le recalage s'y mesure. */
  initialStart?: string
  initialEnd?: string
  /** Ce qui la porte : une note (l'analyse de l'appel d'offres, son chemin). */
  link?: string
  documents?: ExpectedDoc[]
}

export interface Programme {
  /** Sa note. */
  path: string
  folder: string
  name: string
  code: string
  color: TileColor
  icon: IconName
  description: string
  created: string
}

export interface Project {
  path: string
  folder: string
  name: string
  /** La note de son programme. */
  programme: string
  typeId: string
  typeName: string
  color: TileColor
  icon: IconName
  description: string
  created: string
  /** Le jour où il a démarré : les dates prévues de ses phases en découlent. */
  start?: string
  phases: ProjectPhase[]
  /** Ses phases englobantes (leurs étapes à partir de 1). */
  spans: SpanSpec[]
}

export type AffaireStatus = 'en-cours' | 'gagnee' | 'perdue' | 'abandonnee'
export const AFFAIRE_STATUSES: readonly AffaireStatus[] = ['en-cours', 'gagnee', 'perdue', 'abandonnee']

export interface Affaire {
  path: string
  name: string
  /** La note de son projet. */
  project: string
  client: string
  reference: string
  status: AffaireStatus
  created: string
}

/** L'avancement d'une phase, pour la dessiner. */
export function progressOf(status: PhaseStatus): JourneyProgress {
  return status === 'terminee' ? 'done' : status === 'en-cours' ? 'current' : status === 'sans-objet' ? 'skipped' : 'todo'
}

/** Un nom de fichier sûr (un programme, un projet, une affaire). */
export function safeName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Un identifiant tiré d'un nom : « Analyse de l'AO » → `analyse-de-l-ao`. */
export function slug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'phase'
  )
}

/** Un identifiant libre parmi `taken` : `nom`, sinon `nom-2`, `nom-3`… */
export function freeId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let at = 2
  while (used.has(`${base}-${at}`)) at++
  return `${base}-${at}`
}

const asColor = (value: unknown, fallback: TileColor): TileColor => (TILE_COLORS.includes(value as TileColor) ? (value as TileColor) : fallback)
const asIcon = (value: unknown, fallback: IconName): IconName => (typeof value === 'string' && value ? (value as IconName) : fallback)
const plain = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '')

/** Un type de projet relu des réglages ; `null` s'il n'en est pas un. */
export function readProjectType(value: unknown): ProjectType | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const id = plain(data.id)
  const name = plain(data.name)
  if (!id || !name) return null
  const stages = Array.isArray(data.stages)
    ? data.stages
        .map((stage) => (Array.isArray(stage) ? stage.map(readPhaseSpec).filter((phase): phase is PhaseSpec => phase !== null) : []))
        .filter((stage) => stage.length)
    : []
  const spans = Array.isArray(data.spans) ? data.spans.map((span) => readSpan(span, 0, stages.length - 1)).filter((span): span is SpanSpec => span !== null) : []
  return { id, name, icon: asIcon(data.icon, 'flow'), color: asColor(data.color, 'indigo'), ...(plain(data.description) ? { description: plain(data.description) } : {}), stages, ...(spans.length ? { spans } : {}) }
}

/** Une phase englobante relue (`min`, `max` : les étapes possibles) ; `null` si elle n'en est pas une. */
function readSpan(value: unknown, min: number, max: number, keys = { name: 'name', color: 'color', from: 'from', to: 'to' }): SpanSpec | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const id = plain(data.id)
  const name = plain(data[keys.name])
  const from = Number(data[keys.from])
  const to = Number(data[keys.to])
  if (!id || !name || !Number.isInteger(from) || !Number.isInteger(to) || max < min) return null
  const first = Math.min(Math.max(from, min), max)
  const last = Math.min(Math.max(to, first), max)
  return { id, name, color: asColor(data[keys.color], 'slate'), from: first, to: last, ...(plain(data.description) ? { description: plain(data.description) } : {}) }
}

function readPhaseSpec(value: unknown): PhaseSpec | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const id = plain(data.id)
  const name = plain(data.name)
  if (!id || !name) return null
  const duration = Number(data.duration)
  const documents = readDocs(data.documents, 'type')
  return {
    id,
    name,
    kind: plain(data.kind) || FREE_KIND,
    icon: asIcon(data.icon, 'flow'),
    color: asColor(data.color, 'indigo'),
    ...(plain(data.description) ? { description: plain(data.description) } : {}),
    ...(Number.isFinite(duration) && duration >= 0 && data.duration !== undefined && data.duration !== '' ? { duration: Math.round(duration) } : {}),
    ...(documents.length ? { documents } : {})
  }
}

/** Des documents attendus relus (`type` : la clé de leur type de pièce). */
function readDocs(value: unknown, typeKey: string): ExpectedDoc[] {
  if (!Array.isArray(value)) return []
  return value
    .map((each): ExpectedDoc | null => {
      if (typeof each === 'string') return each.trim() ? { type: each.trim() } : null
      if (!each || typeof each !== 'object') return null
      const data = each as Record<string, unknown>
      const type = plain(data[typeKey])
      if (!type) return null
      return {
        type,
        ...(plain(data.label ?? data.nom) ? { label: plain(data.label ?? data.nom) } : {}),
        ...(data.received === true || data.recu === true ? { received: true } : {}),
        ...(unlink(data.link ?? data.lien) ? { link: unlink(data.link ?? data.lien) } : {}),
        ...(plain(data.on ?? data.le) ? { on: plain(data.on ?? data.le) } : {})
      }
    })
    .filter((doc): doc is ExpectedDoc => doc !== null)
}

/** Le lien wiki d'une note : `[[Programmes/X/X.md]]`. */
export const link = (path: string): string => `[[${path}]]`
/** Le chemin d'un lien wiki (ou le texte tel quel). */
export const unlink = (value: unknown): string => (typeof value === 'string' ? value.replace(/^\[\[|\]\]$/g, '').split('|')[0]!.trim() : '')

export const folderOf = (path: string): string => path.slice(0, path.lastIndexOf('/'))
export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')

/** Un programme relu de sa note. */
export function readProgramme(path: string, data: Record<string, unknown>): Programme {
  return {
    path,
    folder: folderOf(path),
    name: baseName(path),
    code: plain(data.code),
    color: asColor(data.couleur, 'indigo'),
    icon: asIcon(data.icone, 'folder'),
    description: plain(data.description),
    created: plain(data.creeLe)
  }
}

export function programmeData(programme: Pick<Programme, 'code' | 'color' | 'icon' | 'description' | 'created'>): Record<string, unknown> {
  return {
    'bp-type': PROGRAMME_TYPE,
    ...(programme.code ? { code: programme.code } : {}),
    couleur: programme.color,
    icone: programme.icon,
    ...(programme.description ? { description: programme.description } : {}),
    creeLe: programme.created
  }
}

/** Un projet relu de sa note. */
export function readProject(path: string, data: Record<string, unknown>): Project {
  const phases = Array.isArray(data.phases)
    ? data.phases
        .map((value): ProjectPhase | null => {
          const spec = readPhaseSpec({ ...(value as Record<string, unknown>), name: (value as Record<string, unknown>)?.nom, kind: (value as Record<string, unknown>)?.sorte, icon: (value as Record<string, unknown>)?.icone, color: (value as Record<string, unknown>)?.couleur, duration: (value as Record<string, unknown>)?.duree, documents: undefined })
          if (!spec) return null
          const raw = value as Record<string, unknown>
          const status = PHASE_STATUSES.includes(raw.statut as PhaseStatus) ? (raw.statut as PhaseStatus) : 'a-venir'
          return {
            ...spec,
            stage: Math.max(1, Number(raw.etape) || 1),
            status,
            ...(plain(raw.debut) ? { start: plain(raw.debut) } : {}),
            ...(plain(raw.fin) ? { end: plain(raw.fin) } : {}),
            ...(plain(raw.prevuDebut) ? { plannedStart: plain(raw.prevuDebut) } : {}),
            ...(plain(raw.prevuFin) ? { plannedEnd: plain(raw.prevuFin) } : {}),
            ...(plain(raw.initialDebut) ? { initialStart: plain(raw.initialDebut) } : {}),
            ...(plain(raw.initialFin) ? { initialEnd: plain(raw.initialFin) } : {}),
            ...(unlink(raw.lien) ? { link: unlink(raw.lien) } : {}),
            ...((docs) => (docs.length ? { documents: docs } : {}))(readDocs(raw.documents, 'type'))
          }
        })
        .filter((phase): phase is ProjectPhase => phase !== null)
    : []
  const last = Math.max(1, ...phases.map((phase) => phase.stage))
  const spans = Array.isArray(data.englobantes) ? data.englobantes.map((span) => readSpan(span, 1, last, { name: 'nom', color: 'couleur', from: 'de', to: 'a' })).filter((span): span is SpanSpec => span !== null) : []
  return {
    path,
    folder: folderOf(path),
    name: baseName(path),
    programme: unlink(data.programme),
    typeId: plain(data.type),
    typeName: plain(data.typeNom),
    color: asColor(data.couleur, 'indigo'),
    icon: asIcon(data.icone, 'flow'),
    description: plain(data.description),
    created: plain(data.creeLe),
    ...(plain(data.demarrage) ? { start: plain(data.demarrage) } : {}),
    phases,
    spans
  }
}

export function projectData(project: Omit<Project, 'path' | 'folder' | 'name'>): Record<string, unknown> {
  return {
    'bp-type': PROJECT_TYPE,
    programme: link(project.programme),
    type: project.typeId,
    typeNom: project.typeName,
    couleur: project.color,
    icone: project.icon,
    ...(project.description ? { description: project.description } : {}),
    creeLe: project.created,
    ...(project.start ? { demarrage: project.start } : {}),
    phases: project.phases.map((phase) => ({
      id: phase.id,
      nom: phase.name,
      sorte: phase.kind,
      icone: phase.icon,
      couleur: phase.color,
      etape: phase.stage,
      statut: phase.status,
      ...(phase.duration !== undefined ? { duree: phase.duration } : {}),
      ...(phase.plannedStart ? { prevuDebut: phase.plannedStart } : {}),
      ...(phase.plannedEnd ? { prevuFin: phase.plannedEnd } : {}),
      ...(phase.initialStart ? { initialDebut: phase.initialStart } : {}),
      ...(phase.initialEnd ? { initialFin: phase.initialEnd } : {}),
      ...(phase.start ? { debut: phase.start } : {}),
      ...(phase.end ? { fin: phase.end } : {}),
      ...(phase.link ? { lien: link(phase.link) } : {}),
      ...(phase.documents?.length ? { documents: phase.documents.map((doc) => ({ type: doc.type, ...(doc.label ? { nom: doc.label } : {}), ...(doc.received ? { recu: true } : {}), ...(doc.link ? { lien: link(doc.link) } : {}), ...(doc.on ? { le: doc.on } : {}) })) } : {}),
      ...(phase.description ? { description: phase.description } : {})
    })),
    ...(project.spans.length ? { englobantes: project.spans.map((span) => ({ id: span.id, nom: span.name, couleur: span.color, de: span.from, a: span.to, ...(span.description ? { description: span.description } : {}) })) } : {})
  }
}

/** Les phases d'un projet, par étape (la première d'abord). */
export function stagesOf(phases: readonly ProjectPhase[]): ProjectPhase[][] {
  const stages = new Map<number, ProjectPhase[]>()
  for (const phase of phases) stages.set(phase.stage, [...(stages.get(phase.stage) ?? []), phase])
  return [...stages.entries()].sort(([a], [b]) => a - b).map(([, list]) => list)
}

/** Les phases englobantes d'un type, copiées pour un nouveau projet (leurs étapes à partir de 1). */
export function spansFromType(type: ProjectType): SpanSpec[] {
  return (type.spans ?? []).map((span) => ({ ...span, from: span.from + 1, to: span.to + 1 }))
}

/** Les phases d'un type, copiées pour un nouveau projet : toutes à venir. */
export function phasesFromType(type: ProjectType): ProjectPhase[] {
  return type.stages.flatMap((stage, at) => stage.map((phase) => ({ ...phase, stage: at + 1, status: 'a-venir' as PhaseStatus, ...(phase.documents ? { documents: phase.documents.map((doc) => ({ ...doc })) } : {}) })))
}

/** Un jour plus `days` jours (AAAA-MM-JJ). */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Les **dates prévues** des phases d'un projet, de son démarrage : les phases d'une étape
 * commencent ensemble, le jour où l'étape commence, et durent leur durée (une durée de 5 jours
 * finit le 5e jour) ; l'étape suivante commence le lendemain de la fin de la plus longue. Une
 * phase sans durée, ou sans objet, tient en un jour sans retarder la suite. Sans démarrage :
 * aucune date prévue.
 */
export function planPhases(phases: readonly ProjectPhase[], start: string | undefined): ProjectPhase[] {
  if (!start)
    return phases.map((phase) => {
      const unplanned = { ...phase }
      delete unplanned.plannedStart
      delete unplanned.plannedEnd
      delete unplanned.initialStart
      delete unplanned.initialEnd
      return unplanned
    })
  const out = new Map<string, ProjectPhase>()
  let day = start
  for (const stage of stagesOf(phases)) {
    let longest = 0
    for (const phase of stage) {
      const days = phase.status === 'sans-objet' ? 0 : Math.max(0, phase.duration ?? 0)
      longest = Math.max(longest, days)
      out.set(phase.id, { ...phase, plannedStart: day, plannedEnd: addDays(day, Math.max(0, days - 1)) })
    }
    if (longest > 0) day = addDays(day, longest)
  }
  return phases.map((phase) => out.get(phase.id) ?? phase)
}

const later = (a: string, b: string): string => (a > b ? a : b)

/** Le nombre de jours de `from` à `to` (négatif si `to` vient avant). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/**
 * Les dates prévues **recalées** sur ce qui s'est passé, au jour `today` :
 *
 * - une phase **terminée** va de son début réel à sa fin réelle (finie tôt : la suite avance ;
 *   tard : elle recule) ;
 * - une phase **en cours** part de son début réel ; en retard, elle s'étend jusqu'à aujourd'hui ;
 * - une phase **à venir** ne commence pas dans le passé : au plus tôt aujourd'hui ;
 * - **sans objet** : un jour, sans retarder la suite.
 *
 * L'étape suivante commence le lendemain de la fin la plus tardive de l'étape. Sans démarrage :
 * aucune date prévue.
 */
export function replanPhases(phases: readonly ProjectPhase[], start: string | undefined, today: string): ProjectPhase[] {
  if (!start) return planPhases(phases, undefined)
  const out = new Map<string, ProjectPhase>()
  let day = start
  for (const stage of stagesOf(phases)) {
    const stageStart = day
    let next: string | null = null
    for (const phase of stage) {
      const days = Math.max(0, phase.duration ?? 0)
      const span = (from: string) => addDays(from, Math.max(0, days - 1))
      let from = stageStart
      let to = stageStart
      if (phase.status === 'terminee') {
        from = phase.start ?? stageStart
        to = phase.end ?? span(from)
      } else if (phase.status === 'en-cours') {
        from = phase.start ?? stageStart
        to = later(span(from), today)
      } else if (phase.status === 'a-venir') {
        from = later(stageStart, today)
        to = span(from)
      }
      out.set(phase.id, { ...phase, plannedStart: from, plannedEnd: to })
      // Ce qui occupe l'étape : une durée, ou une phase menée (commencée, terminée).
      if (phase.status !== 'sans-objet' && (days > 0 || phase.status !== 'a-venir')) next = next ? later(next, addDays(to, 1)) : addDays(to, 1)
    }
    if (next) day = next
  }
  return phases.map((phase) => out.get(phase.id) ?? phase)
}

/** Une phase en retard : la fin de son planning initial passée, et pas terminée (ni sans objet). */
export const isLate = (phase: ProjectPhase, today: string): boolean => {
  const due = phase.initialEnd ?? phase.plannedEnd
  return !!due && due < today && phase.status !== 'terminee' && phase.status !== 'sans-objet'
}

/** De combien de jours ses dates prévues ont glissé depuis le planning initial (0 : aucun). */
export const slipOf = (phase: ProjectPhase): number => (phase.plannedEnd && phase.initialEnd ? daysBetween(phase.initialEnd, phase.plannedEnd) : 0)

/** Une affaire relue de sa note. */
export function readAffaire(path: string, data: Record<string, unknown>): Affaire {
  return {
    path,
    name: baseName(path),
    project: unlink(data.projet),
    client: plain(data.client),
    reference: plain(data.reference),
    status: AFFAIRE_STATUSES.includes(data.statut as AffaireStatus) ? (data.statut as AffaireStatus) : 'en-cours',
    created: plain(data.creeLe)
  }
}

export function affaireData(affaire: Omit<Affaire, 'path' | 'name'> & { programme: string }): Record<string, unknown> {
  return {
    'bp-type': AFFAIRE_TYPE,
    projet: link(affaire.project),
    programme: link(affaire.programme),
    ...(affaire.client ? { client: affaire.client } : {}),
    ...(affaire.reference ? { reference: affaire.reference } : {}),
    statut: affaire.status,
    creeLe: affaire.created
  }
}
