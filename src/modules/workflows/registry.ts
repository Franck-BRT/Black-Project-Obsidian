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
  /**
   * Ses choix viennent d'une liste déclarée par un module (`registerFieldSource`) : les
   * prompts, les personas, les skills de la bibliothèque. Montré comme une liste, avec
   * « Aucun » ; vide : rien de choisi.
   */
  source?: string
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
  /**
   * Pour une action qui demande l'IA : les consignes tirées de la bibliothèque — le persona,
   * le skill, le prompt choisis dans l'étape (ceux que l'action ne lit pas elle-même) —, à
   * donner à l'IA avant sa demande. Vide : aucune.
   */
  guidance?: string
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
  /** Elle demande l'IA : signalé dans l'éditeur, en couleur dans le logigramme, et ses champs Prompt, Persona, Skill ajoutés. */
  needsAi?: boolean
  /** Posé à la déclaration : les champs de l'IA ajoutés (que l'action ne lit pas elle-même ; ils passent par `guidance`). */
  aiAdded?: readonly string[]
  run(run: ActionRun): Promise<ActionOutcome>
}

export interface TemplateSpec {
  id: string
  labelKey: string
  descKey: string
  /** Le workflow à créer, avec ses textes dans la langue de l'utilisateur. */
  make(t: Translate, now: Date): Omit<Workflow, 'id' | 'created'>
}

/**
 * Un **workflow système** : un automatisme de l'application, écrit en workflow pour que
 * l'utilisateur le voie, le règle ou le coupe. Le module Workflows le crée à la première
 * activation, le garde à jour tant que l'utilisateur ne l'a pas modifié, et ne le laisse
 * pas supprimer.
 */
export interface SystemWorkflowSpec {
  /** Stable, « sys. » puis le module : `sys.ao.calendrier-import`. */
  id: string
  /** Le nom du module qui le déclare (sa clé), pour la page. */
  moduleKey: string
  /** Actif à sa création. */
  enabledByDefault: boolean
  make(t: Translate): Omit<Workflow, 'id' | 'created' | 'enabled' | 'system' | 'base' | 'lastRun' | 'runs'>
}

const triggers = new Map<string, TriggerSpec>()
const actions = new Map<string, ActionSpec>()
const templates = new Map<string, TemplateSpec>()
const systems = new Map<string, SystemWorkflowSpec>()
/** Prévenu de chaque workflow système déclaré : le module Workflows, quand il est actif. */
let onSystem: ((spec: SystemWorkflowSpec) => void) | null = null

/** Déclare un déclencheur ; le déclarer à nouveau (une réactivation) le remplace. */
export function registerTrigger(spec: TriggerSpec): void {
  triggers.set(spec.id, spec)
}

/**
 * Les champs de toute action qui demande l'IA : un **prompt**, un **persona**, un **skill**
 * de la bibliothèque, choisis par leur nom. Ceux qu'elle n'a pas déjà sont ajoutés ; leurs
 * consignes lui arrivent par `guidance`.
 */
export const AI_FIELD_KEYS = ['prompt', 'persona', 'skill'] as const
const aiField = (key: (typeof AI_FIELD_KEYS)[number]): ActionField => ({
  key,
  labelKey: `workflows.ai.field.${key}`,
  kind: 'text',
  tooltipKey: `workflows.ai.field.${key}.tip`,
  source: `bibliotheque.${key}`
})

export function registerAction(spec: ActionSpec): void {
  if (!spec.needsAi) {
    actions.set(spec.id, spec)
    return
  }
  // Ses propres champs prompt, persona : leur liste vient aussi de la bibliothèque.
  const own = spec.fields.map((field) => ((AI_FIELD_KEYS as readonly string[]).includes(field.key) && !field.source ? { ...field, source: `bibliotheque.${field.key}` } : field))
  const added = AI_FIELD_KEYS.filter((key) => !spec.fields.some((field) => field.key === key))
  actions.set(spec.id, { ...spec, fields: [...own, ...added.map(aiField)], aiAdded: added })
}

/** Les listes de choix des champs (`ActionField.source`) : les prompts, personas, skills de la bibliothèque. */
export interface SourceOption {
  value: string
  label: string
  description?: string
}
const sources = new Map<string, () => Promise<SourceOption[]>>()
export function registerFieldSource(id: string, list: () => Promise<SourceOption[]>): void {
  sources.set(id, list)
}
export async function fieldSourceOptions(id: string): Promise<SourceOption[] | null> {
  const list = sources.get(id)
  return list ? list() : null
}

/** Les consignes de l'IA tirées des noms choisis (le module IA, qui lit la bibliothèque) ; `null` : personne pour les lire. */
let aiGuidance: ((chosen: Readonly<Record<string, string>>) => Promise<string>) | null = null
export function registerAiGuidance(resolve: ((chosen: Readonly<Record<string, string>>) => Promise<string>) | null): void {
  aiGuidance = resolve
}
export async function guidanceFor(chosen: Readonly<Record<string, string>>): Promise<string> {
  return aiGuidance && Object.values(chosen).some((value) => value.trim()) ? aiGuidance(chosen) : ''
}

export function registerTemplate(spec: TemplateSpec): void {
  templates.set(spec.id, spec)
}

/** Déclare un workflow système ; le module Workflows, s'il est actif, le crée ou le met à jour. */
export function registerSystemWorkflow(spec: SystemWorkflowSpec): void {
  systems.set(spec.id, spec)
  onSystem?.(spec)
}

/** Être prévenu des workflows système déclarés (le module Workflows) ; `null` : ne plus l'être. */
export function whenSystemDeclared(listener: ((spec: SystemWorkflowSpec) => void) | null): void {
  onSystem = listener
}

export const systemWorkflowSpec = (id: string): SystemWorkflowSpec | undefined => systems.get(id)
export const allSystemWorkflows = (): SystemWorkflowSpec[] => [...systems.values()]

export const triggerSpec = (id: string): TriggerSpec | undefined => triggers.get(id)
export const actionSpec = (id: string): ActionSpec | undefined => actions.get(id)
export const allTriggers = (): TriggerSpec[] => [...triggers.values()]
export const allActions = (): ActionSpec[] => [...actions.values()]
export const allTemplates = (): TemplateSpec[] => [...templates.values()]

/** Oublie les déclarations d'un module (préfixe), ou toutes : pour les tests. */
export function forgetDeclarations(prefix = ''): void {
  for (const map of [triggers, actions, templates, systems] as Map<string, unknown>[]) {
    for (const id of [...map.keys()]) if (id.startsWith(prefix)) map.delete(id)
  }
}
