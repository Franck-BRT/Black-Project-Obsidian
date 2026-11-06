// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Des workflows sortis d'un coffre et repris dans un autre — celui d'un collègue, d'un
 * autre service — : écrits en JSON qui dit ce qu'il est, relus avec soin, chaque partie
 * vérifiée ; ce que cette version ne connaît pas est laissé de côté et dit ; chaque
 * workflow repris est **désactivé**, à relire avant qu'il ne s'exécute. Repris de la
 * version complète, sur les déclarations des modules.
 */

import { CONDITION_OPS, SCHEDULE_EVERY, workflowId, type Workflow, type WorkflowAction, type WorkflowCondition, type WorkflowTrigger } from './model'

export const EXPORT_FORMAT = 'black-projects-workflows'

/** Les workflows en fichier, sans ce que seul ce coffre en sait (dernière exécution, compte). */
export function exportWorkflows(workflows: readonly Workflow[], at = new Date()): string {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: 1,
      exported: at.toISOString(),
      // Un workflow système exporté devient, ailleurs, un workflow ordinaire.
      workflows: workflows.map(({ lastRun: _lastRun, runs: _runs, system: _system, base: _base, ...kept }) => kept)
    },
    null,
    2
  )
}

export type ImportProblem = 'unreadable' | 'format' | 'empty'

export interface ImportResult {
  workflows: Workflow[]
  /** Déclencheurs, actions ou conditions inconnus, laissés de côté. */
  skipped: number
}

const text = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '')
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export interface Known {
  trigger(id: string): boolean
  action(id: string): boolean
}

function readTrigger(raw: unknown, known: Known): WorkflowTrigger | null {
  if (!isObject(raw) || !known.trigger(text(raw.kind))) return null
  const trigger: WorkflowTrigger = { kind: text(raw.kind) }
  if ((SCHEDULE_EVERY as readonly string[]).includes(text(raw.every))) trigger.every = text(raw.every) as WorkflowTrigger['every']
  if (/^\d{1,2}:\d{2}$/.test(text(raw.time))) trigger.time = text(raw.time)
  for (const key of ['weekday', 'monthDay'] as const) {
    const number = Number(raw[key])
    if (raw[key] !== undefined && Number.isFinite(number)) trigger[key] = number
  }
  return trigger
}

function readCondition(raw: unknown): WorkflowCondition | null {
  if (!isObject(raw) || !text(raw.field) || !(CONDITION_OPS as readonly string[]).includes(text(raw.op))) return null
  return {
    field: text(raw.field),
    op: text(raw.op) as WorkflowCondition['op'],
    value: text(raw.value),
    ...(raw.join === 'or' ? { join: 'or' as const } : {})
  }
}

function readAction(raw: unknown, known: Known): WorkflowAction | null {
  if (!isObject(raw) || !known.action(text(raw.kind))) return null
  const fields: Record<string, string> = {}
  if (isObject(raw.fields)) for (const [key, value] of Object.entries(raw.fields)) fields[key] = text(value)
  return { kind: text(raw.kind), fields }
}

/** Lit un fichier de workflows ; rend ce qui ne va pas plutôt que de lever. */
export function importWorkflows(content: string, known: Known, now = new Date()): ImportResult | ImportProblem {
  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    return 'unreadable'
  }
  if (!isObject(data) || data.format !== EXPORT_FORMAT || !Array.isArray(data.workflows)) return 'format'
  let skipped = 0
  const workflows: Workflow[] = []
  for (const [index, raw] of data.workflows.entries()) {
    if (!isObject(raw) || !text(raw.name)) {
      skipped++
      continue
    }
    const trigger = readTrigger(raw.trigger, known)
    if (!trigger) {
      skipped++
      continue
    }
    const conditions = (Array.isArray(raw.conditions) ? raw.conditions : []).map(readCondition)
    const actions = (Array.isArray(raw.actions) ? raw.actions : []).map((each) => readAction(each, known))
    skipped += conditions.filter((each) => !each).length + actions.filter((each) => !each).length
    workflows.push({
      id: workflowId(now.getTime() + index),
      name: text(raw.name),
      enabled: false,
      mode: raw.mode === 'auto' ? 'auto' : 'ask',
      trigger,
      conditions: conditions.filter((each): each is WorkflowCondition => !!each),
      actions: actions.filter((each): each is WorkflowAction => !!each),
      created: now.toISOString()
    })
  }
  return workflows.length ? { workflows, skipped } : 'empty'
}
