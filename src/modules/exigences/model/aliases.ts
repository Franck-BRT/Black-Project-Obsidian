// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les autres noms d'une exigence.
 *
 * Une exigence, plusieurs noms : la bibliothèque la numérote REQ-SYS-0001, le projet qui
 * la livre la cite OMLX-SYS-0001. Pas une copie — juste le jour où elle est faite, fausse
 * dès la révision suivante — ni un renommage : l'identifiant est ce dans quoi tous les
 * liens, compteurs et références sont écrits. Un alias est une porte d'entrée, jamais un
 * endroit où ranger quoi que ce soit.
 *
 * Un nom est unique dans toute la bibliothèque, identifiants et alias confondus : une
 * citation qui mènerait à deux exigences est pire qu'une citation qui échoue.
 */

import type { Requirement } from './requirement'
import { parseReqId } from './reqId'

/**
 * Un alias tel qu'il est rangé : en majuscules comme un identifiant, sans virgule ni
 * point-virgule (un bloc `brt-req` sépare ses identifiants avec).
 */
export function normalizeAlias(raw: string): string {
  return raw.trim().toUpperCase().replace(/[,;]/g, ' ').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/** Un préfixe tel qu'il peut commencer un alias : le nom d'un projet, rendu citable. */
export function aliasPrefix(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Le même identifiant sous un autre préfixe : REQ-SYS-0001 et OMLX donnent OMLX-SYS-0001. */
export function aliasWithPrefix(id: string, prefix: string): string {
  const lead = aliasPrefix(prefix)
  const parsed = parseReqId(id)
  if (!lead || !parsed) return ''
  const rest = id
    .trim()
    .toUpperCase()
    .slice(id.trim().indexOf('-') + 1)
  return `${lead}-${rest}`
}

/** Tous les noms auxquels cette exigence répond, le sien d'abord. */
export function namesOf(requirement: Requirement): string[] {
  return [requirement.id, ...requirement.aliases]
}

/** L'exigence qui répond déjà à un nom, s'il y en a une — identifiants compris. */
export function nameOwner(library: Requirement[], name: string, exceptId = ''): Requirement | null {
  const wanted = normalizeAlias(name)
  if (!wanted) return null
  const skip = exceptId.trim().toUpperCase()
  for (const requirement of library) {
    if (requirement.id.toUpperCase() === skip) continue
    if (namesOf(requirement).some((held) => held.toUpperCase() === wanted)) return requirement
  }
  return null
}

/** L'exigence à laquelle mène un nom cité, par identifiant ou par alias. */
export function findByName(library: Requirement[], name: string): Requirement | null {
  const wanted = name.trim().toUpperCase()
  if (!wanted) return null
  return library.find((requirement) => namesOf(requirement).some((held) => held.toUpperCase() === wanted)) ?? null
}

/** Ajoute un alias ; un alias égal à l'identifiant, ou déjà là, laisse l'exigence inchangée. */
export function addAlias(requirement: Requirement, raw: string): Requirement {
  const alias = normalizeAlias(raw)
  if (!alias || alias === requirement.id.toUpperCase()) return requirement
  if (requirement.aliases.some((held) => held.toUpperCase() === alias)) return requirement
  return { ...requirement, aliases: [...requirement.aliases, alias], updatedAt: new Date().toISOString() }
}

export function removeAlias(requirement: Requirement, raw: string): Requirement {
  const alias = normalizeAlias(raw)
  const aliases = requirement.aliases.filter((held) => held.toUpperCase() !== alias)
  if (aliases.length === requirement.aliases.length) return requirement
  return { ...requirement, aliases, updatedAt: new Date().toISOString() }
}

/** Des alias relus rendus sûrs : normalisés, sans l'identifiant de l'exigence, chacun une fois. */
export function cleanAliases(raw: unknown, id: string): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>([id.trim().toUpperCase()])
  const kept: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const alias = normalizeAlias(entry)
    if (!alias || seen.has(alias)) continue
    seen.add(alias)
    kept.push(alias)
  }
  return kept
}
