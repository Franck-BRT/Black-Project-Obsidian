// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Un workflow : une règle écrite une fois — quand ceci arrive, si cela tient, faire ceci —
 * que Black Projects suit ensuite. À l'import des pièces d'un appel d'offres, relever le
 * calendrier et analyser la qualité ; chaque lundi à 8 h, refaire l'analyse de la
 * bibliothèque. Exécuté seul, ou proposé d'abord, selon ce que l'utilisateur règle ;
 * chaque exécution écrite dans le journal.
 *
 * Ce qui est arrivé est un **sujet** — une analyse, une pièce, une exigence, ou rien pour
 * une exécution planifiée —, connu par ses champs, que les conditions testent et que les
 * textes des actions reprennent en {variables}.
 *
 * Repris de la version complète de Black Projects (le modèle, les conditions, les
 * variables, la planification), rendu ouvert : les déclencheurs et les actions ne sont plus
 * une liste fermée, chaque module déclare les siens (`registry.ts`).
 */

/** Un texte sans accents, en minuscules, pour comparer. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Les déclencheurs propres au module : à la main, et à heure fixe. */
export const MANUAL = 'manuel'
export const SCHEDULE = 'planifie'

export type ScheduleEvery = 'day' | 'weekdays' | 'week' | 'month'
export const SCHEDULE_EVERY: readonly ScheduleEvery[] = ['day', 'weekdays', 'week', 'month']

export interface WorkflowTrigger {
  /** L'identifiant d'un déclencheur déclaré : `manuel`, `planifie`, `ao.pieces-importees`… */
  kind: string
  /** À heure fixe : à quelle fréquence, à quelle heure, quel jour de la semaine (1 lundi … 7 dimanche) ou du mois. */
  every?: ScheduleEvery
  time?: string
  weekday?: number
  monthDay?: number
}

export type ConditionOp = 'is' | 'is-not' | 'contains' | 'not-contains' | 'empty' | 'not-empty' | 'gt' | 'gte' | 'lt' | 'lte'

export const CONDITION_OPS: readonly ConditionOp[] = ['is', 'is-not', 'contains', 'not-contains', 'gt', 'gte', 'lt', 'lte', 'empty', 'not-empty']

/** Les opérateurs sans valeur à donner. */
export const NO_VALUE: readonly ConditionOp[] = ['empty', 'not-empty']

export interface WorkflowCondition {
  /** Le champ du sujet testé : type, place, analyse… */
  field: string
  op: ConditionOp
  value: string
  /** Comment elle se lie à la précédente : « et » (par défaut) lie plus fort que « ou ». */
  join?: 'and' | 'or'
}

export interface WorkflowAction {
  /** L'identifiant d'une action déclarée : `notifier`, `ao.calendrier`… */
  kind: string
  /** Ce qu'elle reçoit — un titre, une analyse, un message —, chaque texte pouvant porter des {variables}. */
  fields: Record<string, string>
}

/** Fait tout de suite, ou proposé d'abord et fait quand l'utilisateur le dit. */
export type WorkflowMode = 'auto' | 'ask'

export interface Workflow {
  id: string
  name: string
  enabled: boolean
  mode: WorkflowMode
  trigger: WorkflowTrigger
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  /** Quand il a été créé (ISO) : une planification compte de là, jamais avant. */
  created: string
  lastRun?: string
  runs?: number
}

/** Ce qui est arrivé, tel qu'un workflow le reçoit. */
export interface Subject {
  /** Ce par quoi on le reconnaît : le chemin d'une note, un identifiant. */
  key: string
  /** Comment il est nommé dans le journal. */
  label: string
  vars: Record<string, string>
  lists: Record<string, string[]>
  /** La note à ouvrir depuis le journal ; vide s'il n'y en a pas. */
  path: string
}

export const NO_SUBJECT: Subject = { key: '', label: '', vars: {}, lists: {}, path: '' }

export interface WorkflowEvent {
  trigger: string
  subject: Subject
}

/** Les variables de tout texte, quel que soit le sujet. */
export const COMMON_VARS = ['today', 'now', 'workflow']

/** Une condition testée sur un sujet : sur la valeur de son champ, ou sur chaque élément de sa liste. */
export function holds(condition: WorkflowCondition, subject: Subject, today = dayOf(new Date())): boolean {
  const list = subject.lists[condition.field]
  const values = list ?? [subject.vars[condition.field] ?? '']
  const filled = values.map((value) => value.trim()).filter(Boolean)
  const wanted = condition.value
    .split(/[,;]/)
    .map((value) => fold(value.trim()))
    .filter(Boolean)
  const same = (value: string): boolean => wanted.includes(fold(value))
  const inside = (value: string): boolean => wanted.some((one) => fold(value).includes(one))
  switch (condition.op) {
    case 'is':
      return filled.some(same)
    case 'is-not':
      return !filled.some(same)
    case 'contains':
      return filled.some(inside)
    case 'not-contains':
      return !filled.some(inside)
    case 'empty':
      return !filled.length
    case 'not-empty':
      return filled.length > 0
    default:
      return filled.some((value) => {
        const order = compareTo(value, condition.value, subject.vars, today)
        if (order === null) return false
        return condition.op === 'gt' ? order > 0 : condition.op === 'gte' ? order >= 0 : condition.op === 'lt' ? order < 0 : order <= 0
      })
  }
}

/**
 * Une valeur face à une borne : en jours quand les deux en sont (« +7 », {today}), en
 * nombres quand les deux en sont (« 1 234,5 »), en mots sinon ; null sans borne.
 */
export function compareTo(value: string, bound: string, vars: Record<string, string>, today: string): number | null {
  const raw = bound.trim()
  if (!raw) return null
  const day = resolveDay(raw, vars, today)
  const valueDay = /^\d{4}-\d{2}-\d{2}/.exec(value.trim())?.[0]
  if (day && valueDay) return valueDay < day ? -1 : valueDay > day ? 1 : 0
  const figure = (text: string): number | null => {
    const compact = text.replace(/[\s  %]/g, '').replace(',', '.')
    return /^-?\d+(\.\d+)?$/.test(compact) ? Number(compact) : null
  }
  const x = figure(value)
  const y = figure(expand(raw, vars))
  if (x !== null && y !== null) return x - y
  return fold(value).localeCompare(fold(expand(raw, vars)))
}

/** Les conditions liées par « et » toutes, dans au moins un des groupes que « ou » sépare ; aucune : vrai. */
export function conditionsHold(conditions: readonly WorkflowCondition[], subject: Subject, today = dayOf(new Date())): boolean {
  if (!conditions.length) return true
  const groups: WorkflowCondition[][] = [[]]
  for (const [at, condition] of conditions.entries()) {
    if (at > 0 && condition.join === 'or') groups.push([])
    groups[groups.length - 1]!.push(condition)
  }
  return groups.some((group) => group.every((condition) => holds(condition, subject, today)))
}

/** Un workflow répond-il à un évènement : actif, du même déclencheur, ses conditions tenues. */
export function matches(workflow: Workflow, event: WorkflowEvent, today = dayOf(new Date())): boolean {
  if (!workflow.enabled || workflow.trigger.kind !== event.trigger) return false
  return conditionsHold(workflow.conditions, event.subject, today)
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** Un jour, AAAA-MM-JJ, à l'heure de l'utilisateur. */
export function dayOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Le dernier moment demandé par une planification, au plus tard maintenant ; null hors planification. */
export function lastSlot(trigger: WorkflowTrigger, now: Date): Date | null {
  if (trigger.kind !== SCHEDULE) return null
  const [hours, minutes] = (/^(\d{1,2}):(\d{2})$/.exec(trigger.time ?? '') ?? ['', '8', '00']).slice(1).map(Number)
  const every = trigger.every ?? 'day'
  for (let back = 0; back <= 62; back++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, hours, minutes)
    if (at > now) continue
    const weekday = ((at.getDay() + 6) % 7) + 1
    if (every === 'weekdays' && weekday > 5) continue
    if (every === 'week' && weekday !== (trigger.weekday ?? 1)) continue
    if (every === 'month' && at.getDate() !== Math.min(trigger.monthDay ?? 1, 28)) continue
    return at
  }
  return null
}

/**
 * Un workflow planifié est-il à exécuter : un moment demandé est venu depuis sa dernière
 * exécution — ou depuis sa création, jamais avant. Manqué pendant qu'Obsidian était fermé,
 * il s'exécute une fois à l'ouverture, pas une fois par moment manqué.
 */
export function scheduleDue(workflow: Workflow, now: Date): boolean {
  if (!workflow.enabled) return false
  const slot = lastSlot(workflow.trigger, now)
  if (!slot) return false
  return slot > new Date(workflow.lastRun ?? workflow.created)
}

/** Un texte avec ses {variables} remplacées ; une variable inconnue reste telle qu'écrite. {today+7} : un jour déplacé. */
export function expand(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([\p{L}\p{N}_.-]+?)([+-]\d+)?\}/gu, (whole, name: string, shift: string | undefined) => {
    const value = vars[name]
    if (value === undefined) return whole
    if (shift && /^\d{4}-\d{2}-\d{2}$/.test(value)) return addDays(value, Number(shift))
    return value
  })
}

/** Un jour tel qu'une action le reçoit : une date, « +7 », une variable ; '' si ce n'en est pas un. */
export function resolveDay(raw: string, vars: Record<string, string>, today: string): string {
  const value = expand(raw.trim(), vars).trim()
  if (!value) return ''
  const shift = /^([+-])\s*(\d+)\s*(j|d|jours?|days?)?$/i.exec(value)
  if (shift) return addDays(today, Number(shift[2]) * (shift[1] === '-' ? -1 : 1))
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

/** Les variables des textes : celles du sujet, et celles de toute exécution. */
export function variablesOf(subject: Subject, workflow: Workflow, now: Date): Record<string, string> {
  return {
    ...Object.fromEntries(Object.entries(subject.lists).map(([name, list]) => [name, list.join(', ')])),
    ...subject.vars,
    today: dayOf(now),
    now: `${dayOf(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    workflow: workflow.name
  }
}

/** Le résultat d'une étape comme variable : {step1.path}. Les étapes comptent à partir de un. */
export function stepVariable(step: number, result: string): string {
  return `step${step}.${result}`
}

/** Les étapes dont un texte reprend les résultats ({step2.text} : l'étape 2), une fois chacune. */
export function stepsReferred(text: string): number[] {
  return [...new Set([...text.matchAll(/\{step(\d+)\.[a-z]+\}/g)].map((match) => Number(match[1])))]
}

/** Exécutions d'un même workflow permises en une heure : au-delà, quelque chose boucle, il s'arrête. */
export const MAX_RUNS_PER_HOUR = 30

export function workflowId(now = Date.now()): string {
  return `wf-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Un workflow comme on le commence : actif, demandé avant d'agir, lancé à la main, sans action. */
export function newWorkflow(name: string, now = new Date()): Workflow {
  return { id: workflowId(now.getTime()), name, enabled: true, mode: 'ask', trigger: { kind: MANUAL }, conditions: [], actions: [], created: now.toISOString() }
}
