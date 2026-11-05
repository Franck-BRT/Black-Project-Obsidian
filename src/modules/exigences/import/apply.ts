// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Écrire un import : le plan a été calculé, montré et accepté ailleurs ; ici, on écrit,
 * dans l'ordre montré, ce qui a été accepté — et rien de plus. Faire en silence plus que
 * ce qui a été montré, c'est ainsi qu'un import perd la confiance de quelqu'un.
 *
 * Repris de la version complète de Black Projects (`ReqPorter`), réécrit sur le magasin
 * de ce module, avec la trace de la pièce d'origine.
 */

import { cleanAliases, findByName, normalizeAlias } from '../model/aliases'
import { addLink, makeRequirement, setText, type ReqOrigin, type Requirement } from '../model/requirement'
import { isReqId } from '../model/reqId'
import type { RequirementStore } from '../store'
import type { CsvPlanRow, CsvValues } from './csv'

export interface ImportOutcome {
  created: Requirement[]
  updated: Requirement[]
  /** Les identifiants (ou titres) qui n'ont pas pu être écrits. */
  failed: string[]
}

/** Les champs d'une ligne posés sur une exigence ; les champs absents restent ce qu'ils étaient. */
export function applyValues(requirement: Requirement, values: CsvValues, by: string): Requirement {
  let next: Requirement = {
    ...requirement,
    ...(values.title === undefined ? {} : { title: values.title }),
    ...(values.category === undefined ? {} : { category: values.category }),
    ...(values.type === undefined ? {} : { type: values.type }),
    ...(values.status === undefined ? {} : { status: values.status }),
    ...(values.criticality === undefined ? {} : { criticality: values.criticality }),
    ...(values.verification === undefined ? {} : { verification: values.verification }),
    ...(values.source === undefined ? {} : { source: values.source }),
    ...(values.rationale === undefined ? {} : { rationale: values.rationale }),
    ...(values.owner === undefined ? {} : { owner: values.owner }),
    ...(values.tags === undefined ? {} : { tags: values.tags }),
    ...(values.aliases === undefined ? {} : { aliases: cleanAliases(values.aliases, requirement.id) }),
    ...(values.sourceLang === undefined ? {} : { sourceLang: values.sourceLang })
  }
  // Par setText, jamais par affectation : une formulation importée fait une révision et met
  // les traductions en retard, comme une formulation tapée. Et seulement là où les mots
  // diffèrent : une formulation revenue telle qu'elle est partie n'est pas nouvelle.
  for (const [lang, body] of Object.entries(values.text)) {
    if (next.text[lang]?.body !== body) next = setText(next, lang, body, by)
  }
  for (const link of values.links ?? []) next = addLink(next, link.kind, link.to)
  return next
}

export interface ApplyOptions {
  /** Les lignes du plan acceptées, par leur position. */
  chosen: ReadonlySet<number>
  by: string
  /** La langue des exigences créées qui ne disent pas la leur. */
  lang: string
  /** La catégorie des exigences créées sans catégorie (pour attribuer leur identifiant). */
  category: string
  /** La catégorie d'une ligne créée sans catégorie, quand elle dépend de la ligne (sa pièce). */
  categoryOf?: (index: number) => string
  /** D'où vient chaque ligne, par sa position. */
  origin?: (index: number) => ReqOrigin | undefined
}

/** Écrit les lignes acceptées d'un plan ; les lignes refusées ou inchangées sont passées. */
export async function applyPlan(store: RequirementStore, plan: readonly CsvPlanRow[], options: ApplyOptions): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { created: [], updated: [], failed: [] }
  const library = await store.all()
  for (const [index, row] of plan.entries()) {
    if (!options.chosen.has(index) || row.action === 'invalid' || row.action === 'unchanged') continue
    const origin = options.origin?.(index)
    try {
      if (row.action === 'create') {
        // Un identifiant apporté au format de la bibliothèque est gardé ; un autre
        // (« SYS-12 ») ne peut pas l'être : un identifiant est attribué, et celui du
        // document devient un alias, pour que le document se cite toujours.
        const kept = row.id && isReqId(row.id) ? row.id.toUpperCase() : ''
        const alias = row.id && !kept ? normalizeAlias(row.id) : ''
        const seed = applyValues(makeRequirement({ sourceLang: row.values.sourceLang ?? options.lang }), row.values, options.by)
        const created = await store.create({
          ...seed,
          ...(kept ? { id: kept } : { id: undefined }),
          category: row.values.category || options.categoryOf?.(index) || options.category,
          aliases: alias ? [...new Set([...seed.aliases, alias])] : seed.aliases,
          ...(origin ? { origin } : {})
        })
        outcome.created.push(created)
      } else {
        const existing = findByName(library, row.id)
        if (!existing?.filePath) {
          outcome.failed.push(row.id)
          continue
        }
        const saved = await store.save(existing.filePath, (current) => {
          const next = applyValues(current, row.values, options.by)
          return origin ? { ...next, origin } : next
        })
        if (saved) outcome.updated.push(saved.requirement)
        else outcome.failed.push(row.id)
      }
    } catch {
      outcome.failed.push(row.id || row.title)
    }
  }
  return outcome
}
