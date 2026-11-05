// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Un bloc `pm-req` : des exigences citées dans un document plutôt que copiées.
 *
 * Tout l'intérêt d'une bibliothèque d'exigences, c'est qu'une spécification la cite au
 * lieu d'en garder une copie. Une copie est juste le jour où on la colle et fausse dès la
 * révision suivante, sans que rien ne le montre ; une citation n'est jamais fausse, et
 * peut dire tout haut que ce qu'elle montre a pris du retard.
 *
 * La syntaxe : des lignes `clé: valeur`. Quelqu'un qui écrit de la prose ne doit pas
 * apprendre un langage de requête pour citer six exigences. Le format est celui de la
 * version complète de Black Projects.
 */

import type { Requirement } from './requirement'
import { isStale, isUnreviewedMachine, textOf } from './requirement'
import { isReqBlockField, type ReqBlockField } from './blockFields'
import { namesOf } from './aliases'

export {
  cleanBlockFields,
  DEFAULT_REQ_BLOCK_FIELDS,
  isReqBlockField,
  REQ_BLOCK_FIELDS,
  resolveBlockFields,
  type ReqBlockField
} from './blockFields'

export const REQ_BLOCK_LANGUAGE = 'pm-req'

export interface ReqBlockSpec {
  /** Nommées, dans l'ordre écrit. Vide : « tout ce qui correspond ». */
  ids: string[]
  category: string
  type: string
  status: string
  criticality: string
  tags: string[]
  search: string
  /** La formulation à montrer ; vide : la langue source de chaque exigence. */
  lang: string
  /** Les colonnes, dans l'ordre ; vide : celles des réglages. */
  fields: ReqBlockField[]
  sort: 'id' | 'title' | 'status'
  /** Les clés que le bloc emploie et qui ne veulent rien dire ici, pour le dire plutôt que les ignorer. */
  unknown: string[]
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '')
}

/**
 * Lit le corps du bloc. Souple sur la forme — lignes vides, espaces, listes à virgules ou
 * points-virgules —, strict sur le vocabulaire : une clé inconnue est relevée, parce
 * qu'un `statut:` ignoré en silence, c'est un auteur persuadé d'avoir filtré.
 */
export function parseReqBlock(source: string): ReqBlockSpec {
  const spec: ReqBlockSpec = {
    ids: [],
    category: '',
    type: '',
    status: '',
    criticality: '',
    tags: [],
    search: '',
    lang: '',
    fields: [],
    sort: 'id',
    unknown: []
  }
  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const at = trimmed.indexOf(':')
    // Une ligne nue est un identifiant : citer une exigence est le cas courant.
    if (at === -1) {
      spec.ids.push(...splitList(trimmed))
      continue
    }
    const key = trimmed.slice(0, at).trim().toLowerCase()
    const value = trimmed.slice(at + 1).trim()
    switch (key) {
      case 'id':
      case 'ids':
        spec.ids.push(...splitList(value))
        break
      case 'category':
        spec.category = value
        break
      case 'type':
        spec.type = value
        break
      case 'status':
        spec.status = value
        break
      case 'criticality':
        spec.criticality = value
        break
      case 'tag':
      case 'tags':
        spec.tags = splitList(value)
        break
      case 'search':
        spec.search = value
        break
      case 'lang':
        spec.lang = value.toLowerCase()
        break
      case 'fields':
        spec.fields = splitList(value.toLowerCase()).filter(isReqBlockField)
        break
      case 'sort':
        spec.sort = value === 'title' || value === 'status' ? value : 'id'
        break
      default:
        spec.unknown.push(key)
    }
  }
  return spec
}

/** Le bloc demande-t-il quelque chose ? Un bloc vide tirerait sinon toute la bibliothèque. */
export function isEmptySpec(spec: ReqBlockSpec): boolean {
  return (
    spec.ids.length === 0 &&
    spec.tags.length === 0 &&
    spec.category === '' &&
    spec.type === '' &&
    spec.status === '' &&
    spec.criticality === '' &&
    spec.search === ''
  )
}

/** Une exigence citée, et le nom sous lequel le document l'a citée (un alias, peut-être). */
export interface ReqBlockRow {
  requirement: Requirement
  citedAs: string
}

export interface ReqBlockResult {
  rows: ReqBlockRow[]
  /** Les identifiants nommés que la bibliothèque ne contient pas. Nommés, jamais avalés. */
  missing: string[]
}

function matchesSearch(requirement: Requirement, needle: string): boolean {
  const q = needle.toLowerCase()
  return (
    namesOf(requirement).some((name) => name.toLowerCase().includes(q)) ||
    requirement.title.toLowerCase().includes(q) ||
    Object.values(requirement.text).some((held) => held.body.toLowerCase().includes(q))
  )
}

/**
 * Ce que donne le bloc. Les identifiants sortent dans l'ordre écrit — une spécification
 * cite dans un ordre choisi ; le reste est une sélection, triée. Un identifiant qui ne
 * correspond à rien est signalé : une exigence supprimée sous un document doit se voir
 * comme un trou, pas comme un document qui a raccourci sans bruit.
 */
export function selectRequirements(spec: ReqBlockSpec, library: Requirement[]): ReqBlockResult {
  if (spec.ids.length) {
    // Tous les noms à la fois, alias compris : un document écrit dans la numérotation d'un
    // projet se résout sans renuméroter la bibliothèque.
    const byName = new Map<string, Requirement>()
    for (const requirement of library) {
      for (const name of namesOf(requirement)) {
        const key = name.toUpperCase()
        if (!byName.has(key)) byName.set(key, requirement)
      }
    }
    const rows: ReqBlockRow[] = []
    const missing: string[] = []
    for (const id of spec.ids) {
      const found = byName.get(id.toUpperCase())
      if (found) rows.push({ requirement: found, citedAs: id.toUpperCase() })
      else missing.push(id)
    }
    return { rows, missing }
  }

  const matched = library.filter(
    (requirement) =>
      (spec.category === '' || requirement.category === spec.category) &&
      (spec.type === '' || requirement.type === spec.type) &&
      (spec.status === '' || requirement.status === spec.status) &&
      (spec.criticality === '' || requirement.criticality === spec.criticality) &&
      (spec.tags.length === 0 || spec.tags.every((tag) => requirement.tags.includes(tag))) &&
      (spec.search === '' || matchesSearch(requirement, spec.search))
  )
  const key = (requirement: Requirement): string =>
    spec.sort === 'title' ? requirement.title || requirement.id : spec.sort === 'status' ? requirement.status : ''
  matched.sort((a, b) => {
    const primary = key(a).localeCompare(key(b), undefined, { numeric: true, sensitivity: 'base' })
    // Toujours l'identifiant pour départager : un document regénéré deux fois se lit pareil.
    return primary !== 0 ? primary : a.id.localeCompare(b.id, undefined, { numeric: true })
  })
  return { rows: matched.map((requirement) => ({ requirement, citedAs: requirement.id })), missing: [] }
}

export interface QuotedWording {
  lang: string
  body: string
  /** La formulation demandée n'existait pas : c'est la langue source qui la remplace. */
  fallback: boolean
  stale: boolean
  unreviewed: boolean
}

/**
 * La formulation qu'un bloc montre, et ce qui ne va pas avec elle : une spécification qui
 * cite une traduction en retard sur sa source, c'est exactement l'échec que cette
 * bibliothèque existe pour empêcher — l'état voyage avec les mots.
 */
export function quotedWording(requirement: Requirement, lang: string): QuotedWording | null {
  const wanted = lang || requirement.sourceLang
  const held = textOf(requirement, wanted)
  if (held) {
    return {
      lang: wanted,
      body: held.body,
      fallback: false,
      stale: isStale(requirement, wanted),
      unreviewed: isUnreviewedMachine(requirement, wanted)
    }
  }
  const source = textOf(requirement, requirement.sourceLang)
  if (!source) return null
  return {
    lang: requirement.sourceLang,
    body: source.body,
    fallback: true,
    stale: false,
    unreviewed: isUnreviewedMachine(requirement, requirement.sourceLang)
  }
}
