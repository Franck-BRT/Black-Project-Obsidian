// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que les modules déclarent au module Workflows : leurs **déclencheurs** (ce qui peut
 * arriver chez eux : des pièces importées, une exigence créée), leurs **actions** (ce
 * qu'ils savent faire sans fenêtre : relever un calendrier, analyser une qualité) et des
 * **workflows prêts à l'emploi**. Chacun garde ainsi sa logique chez lui ; le module
 * Workflows ne connaît d'eux que ces déclarations.
 *
 * Les déclarations sont faites à l'activation de chaque module, que le module Workflows
 * soit actif ou non : actif, il les propose ; inactif, rien ne s'exécute.
 */

import type { Notifier, Ui } from '../../core/ports'
import type { Subject, Workflow } from './model'

export type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface TriggerSpec {
  /** Unique, préfixé par le module : `ao.pieces-importees`. */
  id: string
  labelKey: string
  descKey: string
  /** Les champs du sujet, testables en condition et repris en {variables} ; chacun avec son libellé. */
  fields: readonly { key: string; labelKey: string }[]
  /** Pour une exécution à la main : faire choisir le sujet (une analyse…) ; absent, aucun sujet. */
  pickSubject?(window: { ui: Ui; notifier: Notifier }, t: Translate): Promise<Subject | null>
}

export interface ActionField {
  key: string
  labelKey: string
  kind: 'text' | 'textarea' | 'choice'
  /** Proposé à la création de l'action : souvent une variable, `{analyse}`. */
  defaultValue?: string
  placeholderKey?: string
  tooltipKey?: string
  required?: boolean
  options?: readonly { value: string; labelKey: string }[]
}

/** Ce qu'une action reçoit pour s'exécuter. */
export interface ActionRun {
  /** Ses champs, les {variables} déjà remplacées. */
  fields: Record<string, string>
  subject: Subject
  /** Toutes les variables : celles du sujet, du jour, des étapes déjà faites. */
  vars: Record<string, string>
  t: Translate
  ui: Ui
  notifier: Notifier
}

/** Ce qu'une action a fait. */
export interface ActionOutcome {
  /** Pour le journal : une phrase ou deux. */
  lines: string[]
  /** Ce qu'elle a écrit ou changé, à ouvrir depuis le journal. */
  paths?: string[]
  /** Ce qu'elle passe aux étapes suivantes : {stepN.path}, {stepN.text}… */
  results?: Record<string, string>
}

export interface ActionSpec {
  /** Unique, préfixé par le module : `ao.calendrier`. */
  id: string
  labelKey: string
  descKey: string
  fields: readonly ActionField[]
  /** Les résultats qu'elle donne aux étapes suivantes : `path`, `link`, `text`… */
  results: readonly string[]
  /** Elle demande l'IA : signalé dans l'éditeur. */
  needsAi?: boolean
  run(run: ActionRun): Promise<ActionOutcome>
}

export interface TemplateSpec {
  id: string
  labelKey: string
  descKey: string
  /** Le workflow à créer, avec ses textes dans la langue de l'utilisateur. */
  make(t: Translate, now: Date): Omit<Workflow, 'id' | 'created'>
}

const triggers = new Map<string, TriggerSpec>()
const actions = new Map<string, ActionSpec>()
const templates = new Map<string, TemplateSpec>()

/** Déclare un déclencheur ; le déclarer à nouveau (une réactivation) le remplace. */
export function registerTrigger(spec: TriggerSpec): void {
  triggers.set(spec.id, spec)
}

export function registerAction(spec: ActionSpec): void {
  actions.set(spec.id, spec)
}

export function registerTemplate(spec: TemplateSpec): void {
  templates.set(spec.id, spec)
}

export const triggerSpec = (id: string): TriggerSpec | undefined => triggers.get(id)
export const actionSpec = (id: string): ActionSpec | undefined => actions.get(id)
export const allTriggers = (): TriggerSpec[] => [...triggers.values()]
export const allActions = (): ActionSpec[] => [...actions.values()]
export const allTemplates = (): TemplateSpec[] => [...templates.values()]

/** Oublie les déclarations d'un module (préfixe), ou toutes : pour les tests. */
export function forgetDeclarations(prefix = ''): void {
  for (const map of [triggers, actions, templates] as Map<string, unknown>[]) {
    for (const id of [...map.keys()]) if (id.startsWith(prefix)) map.delete(id)
  }
}
