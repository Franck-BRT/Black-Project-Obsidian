// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **workflows système** : les automatismes de l'application (relever le calendrier à
 * l'import, mettre à jour la note de l'analyse…), écrits en workflows que l'utilisateur
 * voit, modifie ou désactive — mais ne supprime pas.
 *
 * - Créés à la première activation, actifs ou non selon ce que le module a prévu.
 * - Chacun garde l'empreinte de la version d'origine dont il est parti (`base`) : tant
 *   qu'il y ressemble, il n'a pas été modifié, et une nouvelle version du plugin le met à
 *   jour ; modifié, il est laissé tel quel, et la page dit qu'une version d'origine plus
 *   récente existe.
 * - « Rétablir l'original » le remet à la version d'origine du moment.
 * - Celui d'un module désactivé est masqué, et ne s'exécute pas.
 */

import type { SystemWorkflowSpec, Translate } from './registry'
import { systemWorkflowSpec } from './registry'
import type { Workflow } from './model'

type Definition = Pick<Workflow, 'name' | 'mode' | 'trigger' | 'conditions' | 'actions'>

/** L'empreinte de ce qu'un workflow fait : son nom, son mode, son déclencheur, ses conditions, ses actions. */
export function fingerprint(workflow: Definition): string {
  const { name, mode, trigger, conditions, actions } = workflow
  return JSON.stringify({ name, mode, trigger, conditions, actions })
}

const definitionOf = (spec: SystemWorkflowSpec, t: Translate): Definition => {
  const made = spec.make(t)
  return { name: made.name, mode: made.mode, trigger: made.trigger, conditions: made.conditions, actions: made.actions }
}

/**
 * Crée les workflows système qui manquent, et met à jour ceux que l'utilisateur n'a pas
 * modifiés. Rend la liste, et si elle a changé.
 */
export function seedSystem(workflows: readonly Workflow[], specs: readonly SystemWorkflowSpec[], t: Translate, now: Date): { workflows: Workflow[]; changed: boolean } {
  const out = [...workflows]
  let changed = false
  for (const spec of specs) {
    const definition = definitionOf(spec, t)
    const print = fingerprint(definition)
    const at = out.findIndex((each) => each.system === spec.id)
    if (at === -1) {
      out.push({ ...definition, id: spec.id, enabled: spec.enabledByDefault, created: now.toISOString(), system: spec.id, base: print })
      changed = true
      continue
    }
    const current = out[at]!
    // Pas modifié par l'utilisateur, et l'origine a changé : il suit la nouvelle version.
    if (fingerprint(current) === current.base && current.base !== print) {
      out[at] = { ...current, ...definition, base: print }
      changed = true
    }
  }
  return { workflows: out, changed }
}

/** Un workflow système dont le module est désactivé (ou un workflow ordinaire) : peut-il servir ? */
export const usable = (workflow: Workflow): boolean => !workflow.system || !!systemWorkflowSpec(workflow.system)

export type SystemState = 'original' | 'modified' | 'modified-update'

/** Où en est un workflow système : tel qu'à l'origine, modifié, modifié alors qu'une nouvelle origine existe. */
export function systemState(workflow: Workflow, t: Translate): SystemState | null {
  const spec = workflow.system ? systemWorkflowSpec(workflow.system) : undefined
  if (!spec) return null
  const origin = fingerprint(definitionOf(spec, t))
  if (fingerprint(workflow) === origin) return 'original'
  return workflow.base !== origin ? 'modified-update' : 'modified'
}

/** La version d'origine d'un workflow système, telle qu'elle est aujourd'hui. */
export function systemOrigin(workflow: Workflow, t: Translate): Definition | null {
  const spec = workflow.system ? systemWorkflowSpec(workflow.system) : undefined
  return spec ? definitionOf(spec, t) : null
}

/** Le remettre à l'origine : sa définition d'origine, son état (actif ou non) et son compteur gardés. */
export function restoreSystem(workflow: Workflow, t: Translate): Workflow {
  const origin = systemOrigin(workflow, t)
  return origin ? { ...workflow, ...origin, base: fingerprint(origin) } : workflow
}
