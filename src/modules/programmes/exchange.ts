// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Se passer des types de projet** : un ou tous exportés en un fichier JSON (leurs étapes,
 * phases, phases englobantes, documents attendus, répertoires), importés dans un autre coffre.
 *
 * Le fichier dit ce qu'il porte (`sorte: "types-de-projet"`), le jour de l'export, et les types.
 * À l'import, un type déjà là à l'identique (le même contenu, quel que soit son identifiant)
 * n'est pas ajouté une seconde fois ; un autre qui porte le nom d'un type du coffre est ajouté à
 * côté, sous « <nom> (importé) ». Des fonctions pures : le module écrit, lit et range.
 */

import { freeId, readProjectType, slug, type ProjectType } from './model'

/** La sorte d'un fichier de types de projet. */
export const TYPES_SORT = 'types-de-projet'
export const TYPES_FORMAT = 1
/** Où vont les fichiers exportés. */
export const TYPES_EXCHANGE_FOLDER = 'Échanges/Types de projet'

export interface TypesFile {
  format: number
  sorte: typeof TYPES_SORT
  exporte: string
  types: ProjectType[]
}

/** Le contenu d'un fichier de types (JSON lisible, une fin de ligne). */
export function typesFile(types: readonly ProjectType[], day: string): string {
  const file: TypesFile = { format: TYPES_FORMAT, sorte: TYPES_SORT, exporte: day, types: [...types] }
  return `${JSON.stringify(file, null, 2)}\n`
}

/** Un nom de fichier sans les caractères que les systèmes refusent. */
const clean = (name: string) => name.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim()

/** « Types de projet 2026-11-12.json », ou « Type de projet Réponse à AO 2026-11-12.json ». */
export const typesFileName = (day: string, one?: string): string => (one ? `Type de projet ${clean(one)} ${day}.json` : `Types de projet ${day}.json`)

/**
 * Les types d'un fichier relu : `'unreadable'` si ce n'est pas du JSON, `'other'` si ce n'est pas
 * un fichier de types de projet ; sinon ses types (ceux qu'on ne peut relire, laissés).
 */
export function readTypesFile(text: string): ProjectType[] | 'unreadable' | 'other' {
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return 'unreadable'
  }
  if (!data || typeof data !== 'object' || (data as { sorte?: unknown }).sorte !== TYPES_SORT || !Array.isArray((data as { types?: unknown }).types)) return 'other'
  return ((data as { types: unknown[] }).types).map(readProjectType).filter((type): type is ProjectType => type !== null)
}

/** Ce qui fait un type, hors de son identifiant : deux types au même contenu sont le même. */
const content = (type: ProjectType): string => JSON.stringify({ ...readProjectType(type), id: '' })

/**
 * Des types importés, rangés avec ceux du coffre : déjà là à l'identique, laissés ; sinon
 * ajoutés, sous un identifiant libre, et sous « <nom> (importé) » si le nom est déjà pris.
 */
export function mergeTypes(existing: readonly ProjectType[], incoming: readonly ProjectType[], importedSuffix: string): { types: ProjectType[]; added: ProjectType[]; already: ProjectType[] } {
  const types = [...existing]
  const added: ProjectType[] = []
  const already: ProjectType[] = []
  for (const type of incoming) {
    if (types.some((each) => content(each) === content(type))) {
      already.push(type)
      continue
    }
    let name = type.name
    if (types.some((each) => each.name === name)) {
      name = `${type.name} (${importedSuffix})`
      for (let index = 2; types.some((each) => each.name === name); index++) name = `${type.name} (${importedSuffix} ${index})`
    }
    const ids = types.map((each) => each.id)
    const id = ids.includes(type.id) ? freeId(slug(name), ids) : type.id
    const next = { ...type, id, name }
    types.push(next)
    added.push(next)
  }
  return { types, added, already }
}
