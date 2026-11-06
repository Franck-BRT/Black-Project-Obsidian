// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que fait l'utilisateur : parcourir ses workflows, en créer (de zéro ou d'après un
 * modèle prêt à l'emploi), les modifier — nom, mode, déclencheur, conditions, actions —,
 * les exécuter à la main, les échanger avec d'autres coffres. Tout passe par les fenêtres
 * de la plateforme (listes, formulaires, menus) : le même code dans Obsidian et dans les
 * tests.
 */

import type { FileSystem, FormField, ListRow, ListState, Notifier, Ui } from '../../core/ports'
import { journalPath, type WorkflowEngine } from './engine'
import {
  CONDITION_OPS,
  COMMON_VARS,
  dayOf,
  MANUAL,
  NO_SUBJECT,
  NO_VALUE,
  SCHEDULE,
  SCHEDULE_EVERY,
  newWorkflow,
  workflowId,
  type ConditionOp,
  type ScheduleEvery,
  type Workflow,
  type WorkflowAction,
  type WorkflowCondition,
  type WorkflowTrigger
} from './model'
import { actionSpec, allActions, allTemplates, allTriggers, triggerSpec, type ActionSpec, type Translate } from './registry'
import { exportWorkflows, importWorkflows } from './share'

export interface Session {
  ui: Ui
  notifier: Notifier
  fs: FileSystem
  t: Translate
  engine: WorkflowEngine
  load(): Workflow[]
  save(workflows: Workflow[]): Promise<void>
  folder(): string
  now(): Date
}

// ── Les mots ─────────────────────────────────────────────────────────────────────

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export function describeTrigger(trigger: WorkflowTrigger, t: Translate): string {
  if (trigger.kind === SCHEDULE) {
    const time = trigger.time ?? '08:00'
    switch (trigger.every ?? 'day') {
      case 'weekdays':
        return t('workflows.schedule.weekdays', { time })
      case 'week':
        return t('workflows.schedule.week', { day: t(`workflows.weekday.${trigger.weekday ?? 1}`), time })
      case 'month':
        return t('workflows.schedule.month', { day: trigger.monthDay ?? 1, time })
      default:
        return t('workflows.schedule.day', { time })
    }
  }
  const spec = triggerSpec(trigger.kind)
  return spec ? t(spec.labelKey) : t('workflows.trigger.unknown', { kind: trigger.kind })
}

function fieldLabel(trigger: string, field: string, t: Translate): string {
  const spec = triggerSpec(trigger)?.fields.find((each) => each.key === field)
  return spec ? t(spec.labelKey) : field
}

export function describeCondition(condition: WorkflowCondition, trigger: string, t: Translate, first: boolean): string {
  const join = first ? '' : `${t(`workflows.join.${condition.join ?? 'and'}`)} `
  const value = NO_VALUE.includes(condition.op) ? '' : ` « ${condition.value} »`
  return `${join}${fieldLabel(trigger, condition.field, t)} ${t(`workflows.op.${condition.op}`)}${value}`
}

export function describeAction(action: WorkflowAction, t: Translate): string {
  const spec = actionSpec(action.kind)
  if (!spec) return t('workflows.action.unknown', { kind: action.kind })
  const shown = spec.fields
    .map((field) => action.fields[field.key])
    .filter((value): value is string => !!value?.trim())
    .map((value) => (value.length > 50 ? `${value.slice(0, 49).replace(/\n/g, ' ')}…` : value.replace(/\n/g, ' ')))
  return shown.length ? `${t(spec.labelKey)} — ${shown.join(' · ')}` : t(spec.labelKey)
}

/** Un moment à l'heure de l'utilisateur : AAAA-MM-JJ HH:MM. */
export function localStamp(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${dayOf(at)} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

// ── La liste ─────────────────────────────────────────────────────────────────────

function rows(workflows: readonly Workflow[], t: Translate): ListRow[] {
  return workflows.map((workflow) => ({
    id: workflow.id,
    cells: {
      name: workflow.name,
      trigger: describeTrigger(workflow.trigger, t),
      actions: workflow.actions.map((action) => actionSpec(action.kind) ? t(actionSpec(action.kind)!.labelKey) : action.kind).join(', ') || '—',
      mode: t(`workflows.mode.${workflow.mode}`),
      state: t(workflow.enabled ? 'workflows.state.on' : 'workflows.state.off'),
      last: workflow.lastRun ? localStamp(new Date(workflow.lastRun)) : '—'
    },
    values: { state: workflow.enabled ? 'on' : 'off' }
  }))
}

export async function browseWorkflows(session: Session): Promise<void> {
  const { ui, t } = session
  let state: ListState | undefined
  for (;;) {
    const workflows = session.load()
    const answer = await ui.pickFromList({
      title: t('workflows.list.title', { count: workflows.length }),
      intro: t('workflows.list.intro'),
      columns: [
        { key: 'name', label: t('workflows.column.name'), width: 'wide' },
        { key: 'trigger', label: t('workflows.column.trigger') },
        { key: 'actions', label: t('workflows.column.actions') },
        { key: 'mode', label: t('workflows.column.mode'), width: 'narrow' },
        { key: 'state', label: t('workflows.column.state'), width: 'narrow' },
        { key: 'last', label: t('workflows.column.last'), width: 'narrow' }
      ],
      rows: rows(workflows, t),
      filters: [
        {
          key: 'state',
          label: t('workflows.column.state'),
          options: [
            { value: 'on', label: t('workflows.state.on') },
            { value: 'off', label: t('workflows.state.off') }
          ]
        }
      ],
      searchPlaceholder: t('workflows.list.search'),
      empty: workflows.length ? t('workflows.list.noMatch') : t('workflows.list.empty'),
      actions: [
        { value: 'new', label: t('workflows.list.new'), cta: true, tooltip: t('workflows.list.new.tip') },
        { value: 'import', label: t('workflows.list.import'), tooltip: t('workflows.list.import.tip') },
        { value: 'export', label: t('workflows.list.export'), tooltip: t('workflows.list.export.tip') },
        { value: 'journal', label: t('workflows.list.journal'), tooltip: t('workflows.list.journal.tip') }
      ],
      ...(state ? { state } : {})
    })
    if (!answer) return
    state = answer.state
    if (answer.kind === 'row') await editWorkflow(session, answer.id)
    else if (answer.value === 'new') await createWorkflow(session)
    else if (answer.value === 'import') await importFromFile(session)
    else if (answer.value === 'export') await exportToFile(session)
    else if (answer.value === 'journal') {
      await openJournal(session)
      return
    }
  }
}

export async function openJournal(session: Session): Promise<void> {
  const path = journalPath(session.folder(), session.t)
  if (!(await session.fs.exists(path))) {
    session.notifier.notify(session.t('workflows.journal.none'), 6000)
    return
  }
  await session.ui.openNote(path)
}

// ── Créer ────────────────────────────────────────────────────────────────────────

async function store(session: Session, workflow: Workflow): Promise<void> {
  const all = session.load()
  const at = all.findIndex((each) => each.id === workflow.id)
  if (at === -1) all.push(workflow)
  else all[at] = workflow
  await session.save(all)
}

/** Un nouveau workflow, de zéro ou d'après un modèle ; rend son identifiant. */
export async function createWorkflow(session: Session, options: { open?: boolean } = {}): Promise<string | null> {
  const { ui, t } = session
  const templates = allTemplates()
  const start = templates.length
    ? await ui.pickOption(
        [
          { value: '', label: t('workflows.new.blank'), description: t('workflows.new.blank.desc') },
          ...templates.map((template) => ({ value: template.id, label: t(template.labelKey), description: t(template.descKey) }))
        ],
        t('workflows.new.pick')
      )
    : ''
  if (start === null) return null
  const now = session.now()
  let workflow: Workflow
  if (start) {
    const made = templates.find((template) => template.id === start)!.make(t, now)
    workflow = { ...made, id: workflowId(now.getTime()), created: now.toISOString() }
  } else {
    const general = await askGeneral(session, newWorkflow(t('workflows.new.name'), now), true)
    if (!general) return null
    workflow = general
  }
  await store(session, workflow)
  session.notifier.notify(t('workflows.new.done', { name: workflow.name }), 6000)
  // La fiche en fenêtre ; depuis l'interface, c'est sa page qui s'ouvre (l'appelant).
  if (options.open !== false) await editWorkflow(session, workflow.id)
  return workflow.id
}

/** Nom, mode, déclencheur (et son heure pour une planification). */
async function askGeneral(session: Session, workflow: Workflow, fresh: boolean): Promise<Workflow | null> {
  const { ui, t } = session
  const triggers = allTriggers()
  const values = await ui.askForm({
    title: t(fresh ? 'workflows.new.title' : 'workflows.general.title'),
    intro: t('workflows.general.intro'),
    fields: [
      { kind: 'text', key: 'name', label: t('workflows.general.name'), value: workflow.name, required: true },
      {
        kind: 'choice',
        key: 'trigger',
        label: t('workflows.general.trigger'),
        tooltip: t('workflows.general.trigger.tip'),
        value: workflow.trigger.kind,
        options: triggers.map((spec) => ({ value: spec.id, label: t(spec.labelKey), description: t(spec.descKey) }))
      },
      {
        kind: 'choice',
        key: 'mode',
        label: t('workflows.general.mode'),
        tooltip: t('workflows.general.mode.tip'),
        value: workflow.mode,
        options: [
          { value: 'ask', label: t('workflows.mode.ask'), description: t('workflows.mode.ask.desc') },
          { value: 'auto', label: t('workflows.mode.auto'), description: t('workflows.mode.auto.desc') }
        ]
      }
    ],
    submit: t(fresh ? 'workflows.new.submit' : 'workflows.save')
  })
  if (!values) return null
  let trigger: WorkflowTrigger = { kind: values.trigger || MANUAL }
  if (trigger.kind === workflow.trigger.kind) trigger = { ...workflow.trigger }
  if (trigger.kind === SCHEDULE) {
    const schedule = await askSchedule(session, trigger)
    if (!schedule) return null
    trigger = schedule
  }
  // Un autre déclencheur : les conditions sur ses champs n'ont plus de sens.
  const conditions = trigger.kind === workflow.trigger.kind ? workflow.conditions : []
  return { ...workflow, name: values.name?.trim() || workflow.name, mode: values.mode === 'auto' ? 'auto' : 'ask', trigger, conditions }
}

async function askSchedule(session: Session, trigger: WorkflowTrigger): Promise<WorkflowTrigger | null> {
  const { ui, t } = session
  const values = await ui.askForm({
    title: t('workflows.schedule.title'),
    intro: t('workflows.schedule.intro'),
    fields: [
      {
        kind: 'choice',
        key: 'every',
        label: t('workflows.schedule.every'),
        value: trigger.every ?? 'week',
        options: SCHEDULE_EVERY.map((every) => ({ value: every, label: t(`workflows.every.${every}`) }))
      },
      { kind: 'text', key: 'time', label: t('workflows.schedule.time'), placeholder: '08:00', value: trigger.time ?? '08:00', required: true },
      {
        kind: 'choice',
        key: 'weekday',
        label: t('workflows.schedule.weekday'),
        description: t('workflows.schedule.weekday.desc'),
        value: String(trigger.weekday ?? 1),
        options: WEEKDAYS.map((day) => ({ value: String(day), label: t(`workflows.weekday.${day}`) }))
      },
      {
        kind: 'text',
        key: 'monthDay',
        label: t('workflows.schedule.monthDay'),
        description: t('workflows.schedule.monthDay.desc'),
        value: String(trigger.monthDay ?? 1)
      }
    ],
    submit: t('workflows.save'),
    validate: (values) => (/^\d{1,2}:\d{2}$/.test((values.time ?? '').trim()) ? null : t('workflows.schedule.badTime'))
  })
  if (!values) return null
  const every = (SCHEDULE_EVERY as readonly string[]).includes(values.every ?? '') ? (values.every as ScheduleEvery) : 'week'
  const monthDay = Math.min(28, Math.max(1, Number.parseInt(values.monthDay ?? '1', 10) || 1))
  return {
    kind: SCHEDULE,
    every,
    time: values.time!.trim().padStart(5, '0'),
    ...(every === 'week' ? { weekday: Number(values.weekday) || 1 } : {}),
    ...(every === 'month' ? { monthDay } : {})
  }
}

// ── Modifier ─────────────────────────────────────────────────────────────────────

/** Activer ou désactiver un workflow (depuis sa carte). */
export async function setEnabled(session: Session, id: string, enabled: boolean): Promise<void> {
  const workflow = session.load().find((each) => each.id === id)
  if (!workflow || workflow.enabled === enabled) return
  await store(session, { ...workflow, enabled })
  session.notifier.notify(session.t(enabled ? 'workflows.page.enabled' : 'workflows.page.disabled', { name: workflow.name }), 4000)
}

export async function editWorkflow(session: Session, id: string): Promise<void> {
  const { ui, t } = session
  for (;;) {
    const workflow = session.load().find((each) => each.id === id)
    if (!workflow) return
    const conditions = workflow.conditions.map((condition, index) => describeCondition(condition, workflow.trigger.kind, t, index === 0))
    const choice = await ui.pickOption(
      [
        { value: 'general', label: t('workflows.edit.general'), description: `${describeTrigger(workflow.trigger, t)} · ${t(`workflows.mode.${workflow.mode}`)}` },
        { value: 'conditions', label: t('workflows.edit.conditions', { count: workflow.conditions.length }), description: conditions.join(' ') || t('workflows.edit.conditions.none') },
        {
          value: 'actions',
          label: t('workflows.edit.actions', { count: workflow.actions.length }),
          description: workflow.actions.map((action, index) => `${index + 1}. ${describeAction(action, t)}`).join(' ; ') || t('workflows.edit.actions.none')
        },
        { value: 'run', label: t('workflows.edit.run'), description: t('workflows.edit.run.desc') },
        { value: 'toggle', label: t(workflow.enabled ? 'workflows.edit.disable' : 'workflows.edit.enable') },
        { value: 'duplicate', label: t('workflows.edit.duplicate') },
        { value: 'delete', label: t('workflows.edit.delete') },
        { value: 'close', label: t('workflows.edit.close') }
      ],
      `${workflow.name} — ${t(workflow.enabled ? 'workflows.state.on' : 'workflows.state.off')}`
    )
    if (choice === null || choice === 'close') return
    if (choice === 'general') await editGeneral(session, id)
    else if (choice === 'conditions') await editConditions(session, workflow)
    else if (choice === 'actions') await editActions(session, workflow)
    else if (choice === 'run') await runByHand(session, workflow)
    else if (choice === 'toggle') await store(session, { ...workflow, enabled: !workflow.enabled })
    else if (choice === 'duplicate') await duplicateWorkflow(session, id)
    else if (choice === 'delete' && (await deleteWorkflow(session, id))) return
  }
}

// ── Les opérations d'une fiche, une à une (la page d'un workflow, et la fiche en fenêtre) ──

const find = (session: Session, id: string) => session.load().find((each) => each.id === id)

/** Nom, mode et déclencheur. */
export async function editGeneral(session: Session, id: string): Promise<void> {
  const workflow = find(session, id)
  if (!workflow) return
  const changed = await askGeneral(session, workflow, false)
  if (changed) await store(session, changed)
}

/** Une copie, nommée « Copie de … » ; rend son identifiant. */
export async function duplicateWorkflow(session: Session, id: string): Promise<string | null> {
  const workflow = find(session, id)
  if (!workflow) return null
  const copy = { ...workflow, id: workflowId(session.now().getTime()), name: session.t('workflows.copyOf', { name: workflow.name }), created: session.now().toISOString(), runs: 0 }
  delete copy.lastRun
  // La copie d'un workflow système est un workflow ordinaire : modifiable, supprimable.
  delete copy.system
  delete copy.base
  await store(session, copy)
  session.notifier.notify(session.t('workflows.duplicated', { name: copy.name }), 5000)
  return copy.id
}

/** Supprimer, après confirmation ; rend vrai s'il l'a été. */
export async function deleteWorkflow(session: Session, id: string): Promise<boolean> {
  const { ui, t, notifier } = session
  const workflow = find(session, id)
  if (!workflow) return false
  // Un workflow système ne se supprime pas : il se désactive, ou se rétablit.
  if (workflow.system) {
    notifier.notify(t('workflows.system.noDelete', { name: workflow.name }), 8000)
    return false
  }
  const sure = await ui.confirm({
    title: t('workflows.delete.title'),
    message: t('workflows.delete.message', { name: workflow.name }),
    confirm: t('workflows.delete.confirm'),
    cancel: t('workflows.cancel'),
    danger: true
  })
  if (!sure) return false
  await session.save(session.load().filter((each) => each.id !== id))
  notifier.notify(t('workflows.deleted', { name: workflow.name }), 5000)
  return true
}

/** Ajouter une condition (sur un champ de ce qui est arrivé). */
export async function addCondition(session: Session, id: string): Promise<void> {
  const { ui, t, notifier } = session
  const current = find(session, id)
  if (!current) return
  const fields = triggerSpec(current.trigger.kind)?.fields ?? []
  if (!fields.length) {
    notifier.notify(t('workflows.conditions.noField'), 8000)
    return
  }
  const form: FormField[] = [
    ...(current.conditions.length
      ? [
          {
            kind: 'choice' as const,
            key: 'join',
            label: t('workflows.conditions.join'),
            value: 'and',
            options: [
              { value: 'and', label: t('workflows.join.and') },
              { value: 'or', label: t('workflows.join.or') }
            ]
          }
        ]
      : []),
    { kind: 'choice', key: 'field', label: t('workflows.conditions.field'), options: fields.map((field) => ({ value: field.key, label: t(field.labelKey) })) },
    { kind: 'choice', key: 'op', label: t('workflows.conditions.op'), value: 'is', options: CONDITION_OPS.map((op) => ({ value: op, label: t(`workflows.op.${op}`) })) },
    { kind: 'text', key: 'value', label: t('workflows.conditions.value'), description: t('workflows.conditions.value.desc'), placeholder: 'CCTP, CCAP' }
  ]
  const values = await ui.askForm({ title: t('workflows.conditions.add'), fields: form, submit: t('workflows.conditions.add.submit') })
  if (!values?.field) return
  const op = (CONDITION_OPS as readonly string[]).includes(values.op ?? '') ? (values.op as ConditionOp) : 'is'
  const condition: WorkflowCondition = { field: values.field, op, value: (values.value ?? '').trim(), ...(values.join === 'or' ? { join: 'or' as const } : {}) }
  await store(session, { ...current, conditions: [...current.conditions, condition] })
}

/** Retirer une condition. */
export async function removeCondition(session: Session, id: string, index: number): Promise<void> {
  const current = find(session, id)
  if (!current?.conditions[index]) return
  await store(session, { ...current, conditions: current.conditions.filter((_, at) => at !== index) })
}

/** Ajouter une action, à la fin. */
export async function addAction(session: Session, id: string): Promise<void> {
  const { ui, t } = session
  const current = find(session, id)
  if (!current) return
  const specs = allActions().filter((spec) => spec.id !== MANUAL)
  const kind = await ui.pickOption(
    specs.map((spec) => ({ value: spec.id, label: `${t(spec.labelKey)}${spec.needsAi ? ` · ${t('workflows.actions.ai')}` : ''}`, description: t(spec.descKey) })),
    t('workflows.actions.pick')
  )
  const spec = kind ? actionSpec(kind) : undefined
  if (!spec) return
  const action = await askActionFields(session, spec, current, current.actions.length)
  if (action) await store(session, { ...current, actions: [...current.actions, action] })
}

/** Modifier ce que reçoit une action. */
export async function editAction(session: Session, id: string, index: number): Promise<void> {
  const current = find(session, id)
  const action = current?.actions[index]
  const spec = action ? actionSpec(action.kind) : undefined
  if (!current || !action || !spec) return
  const changed = await askActionFields(session, spec, current, index, action)
  if (!changed) return
  const actions = [...current.actions]
  actions[index] = changed
  await store(session, { ...current, actions })
}

/** Monter (`-1`) ou descendre (`+1`) une action. */
export async function moveAction(session: Session, id: string, index: number, delta: -1 | 1): Promise<void> {
  const current = find(session, id)
  const other = index + delta
  if (!current?.actions[index] || !current.actions[other]) return
  const actions = [...current.actions]
  ;[actions[index], actions[other]] = [actions[other]!, actions[index]!]
  await store(session, { ...current, actions })
}

/** Retirer une action. */
export async function removeAction(session: Session, id: string, index: number): Promise<void> {
  const current = find(session, id)
  if (!current?.actions[index]) return
  await store(session, { ...current, actions: current.actions.filter((_, at) => at !== index) })
}

async function editConditions(session: Session, workflow: Workflow): Promise<void> {
  const { ui, t } = session
  for (;;) {
    const current = find(session, workflow.id)
    if (!current) return
    const choice = await ui.pickOption(
      [
        ...current.conditions.map((condition, index) => ({
          value: String(index),
          label: describeCondition(condition, current.trigger.kind, t, index === 0),
          description: t('workflows.conditions.remove')
        })),
        { value: 'add', label: t('workflows.conditions.add'), description: t('workflows.conditions.add.desc') },
        { value: 'back', label: t('workflows.back') }
      ],
      t('workflows.conditions.title', { name: current.name })
    )
    if (choice === null || choice === 'back') return
    if (choice === 'add') await addCondition(session, current.id)
    else await removeCondition(session, current.id, Number(choice))
  }
}

/** Les variables qu'une action peut reprendre, à cette place : le sujet, le jour, les étapes d'avant. */
export function availableVariables(workflow: Workflow, before: number): string[] {
  const subject = (triggerSpec(workflow.trigger.kind)?.fields ?? []).map((field) => field.key)
  const steps = workflow.actions
    .slice(0, before)
    .flatMap((action, index) => (actionSpec(action.kind)?.results ?? []).map((result) => `step${index + 1}.${result}`))
  return [...subject, ...COMMON_VARS, ...steps].map((name) => `{${name}}`)
}

async function askActionFields(session: Session, spec: ActionSpec, workflow: Workflow, at: number, current?: WorkflowAction): Promise<WorkflowAction | null> {
  const { ui, t } = session
  const values = await ui.askForm({
    title: t(spec.labelKey),
    intro: [t(spec.descKey), t('workflows.actions.variables', { variables: availableVariables(workflow, at).join(' ') })].join('\n\n'),
    fields: spec.fields.map((field): FormField => {
      const value = current?.fields[field.key] ?? field.defaultValue ?? ''
      const common = {
        key: field.key,
        label: t(field.labelKey),
        ...(field.tooltipKey ? { tooltip: t(field.tooltipKey) } : {})
      }
      if (field.kind === 'choice') {
        return { kind: 'choice', ...common, value, options: (field.options ?? []).map((option) => ({ value: option.value, label: t(option.labelKey) })) }
      }
      return {
        kind: field.kind,
        ...common,
        value,
        ...(field.placeholderKey ? { placeholder: t(field.placeholderKey) } : {}),
        ...(field.required ? { required: true } : {})
      }
    }),
    submit: t('workflows.save')
  })
  if (!values) return null
  return { kind: spec.id, fields: Object.fromEntries(spec.fields.map((field) => [field.key, values[field.key] ?? ''])) }
}

async function editActions(session: Session, workflow: Workflow): Promise<void> {
  const { ui, t } = session
  for (;;) {
    const current = find(session, workflow.id)
    if (!current) return
    const choice = await ui.pickOption(
      [
        ...current.actions.map((action, index) => ({ value: String(index), label: `${index + 1}. ${describeAction(action, t)}` })),
        { value: 'add', label: t('workflows.actions.add'), description: t('workflows.actions.add.desc') },
        { value: 'back', label: t('workflows.back') }
      ],
      t('workflows.actions.title', { name: current.name })
    )
    if (choice === null || choice === 'back') return
    if (choice === 'add') {
      await addAction(session, current.id)
      continue
    }
    const index = Number(choice)
    const action = current.actions[index]!
    const what = await ui.pickOption(
      [
        { value: 'edit', label: t('workflows.actions.edit') },
        ...(index > 0 ? [{ value: 'up', label: t('workflows.actions.up') }] : []),
        ...(index < current.actions.length - 1 ? [{ value: 'down', label: t('workflows.actions.down') }] : []),
        { value: 'remove', label: t('workflows.actions.remove') },
        { value: 'back', label: t('workflows.back') }
      ],
      `${index + 1}. ${describeAction(action, t)}`
    )
    if (what === 'edit') await editAction(session, current.id, index)
    else if (what === 'up') await moveAction(session, current.id, index, -1)
    else if (what === 'down') await moveAction(session, current.id, index, 1)
    else if (what === 'remove') await removeAction(session, current.id, index)
  }
}

// ── Exécuter ─────────────────────────────────────────────────────────────────────

/** À la main : le sujet choisi s'il en faut un, puis l'exécution, sans redemander. */
export async function runByHand(session: Session, workflow: Workflow): Promise<void> {
  const { ui, notifier, t } = session
  if (!workflow.actions.length) {
    notifier.notify(t('workflows.run.empty'), 6000)
    return
  }
  const spec = triggerSpec(workflow.trigger.kind)
  const subject = spec?.pickSubject ? await spec.pickSubject({ ui, notifier }, t) : NO_SUBJECT
  if (!subject) return
  await session.engine.runByHand(workflow, { trigger: workflow.trigger.kind, subject })
}

export async function pickAndRun(session: Session): Promise<void> {
  const { ui, notifier, t } = session
  const workflows = session.load()
  if (!workflows.length) {
    notifier.notify(t('workflows.list.empty'), 8000)
    return
  }
  const id = await ui.pickOption(
    workflows.map((workflow) => ({
      value: workflow.id,
      label: workflow.name,
      description: `${describeTrigger(workflow.trigger, t)} · ${workflow.actions.length} ${t('workflows.column.actions').toLowerCase()}${workflow.enabled ? '' : ` · ${t('workflows.state.off')}`}`
    })),
    t('workflows.run.pick')
  )
  const workflow = workflows.find((each) => each.id === id)
  if (workflow) await runByHand(session, workflow)
}

// ── Échanger ─────────────────────────────────────────────────────────────────────

export async function exportToFile(session: Session): Promise<string | null> {
  const { ui, t, fs, notifier } = session
  const workflows = session.load()
  if (!workflows.length) {
    notifier.notify(t('workflows.list.empty'), 6000)
    return null
  }
  const chosen = await ui.pickMany({
    title: t('workflows.export.title'),
    intro: t('workflows.export.intro'),
    choices: workflows.map((workflow) => ({ value: workflow.id, label: workflow.name, description: describeTrigger(workflow.trigger, t) })),
    submit: t('workflows.export.submit')
  })
  if (!chosen?.length) return null
  const now = session.now()
  const path = `Black Projects/Échanges/${t('workflows.export.file', { date: now.toISOString().slice(0, 10) })}.json`
  await fs.writeText(path, exportWorkflows(workflows.filter((workflow) => chosen.includes(workflow.id)), now))
  notifier.notify(t('workflows.export.done', { count: chosen.length, path }), 10000)
  return path
}

/** Importer des workflows d'un fichier ; rend ceux qui l'ont été (désactivés, à relire). */
export async function importFromFile(session: Session): Promise<Workflow[]> {
  const { ui, t, fs, notifier } = session
  const from = await ui.pickOption(
    [
      { value: 'computer', label: t('workflows.import.computer') },
      { value: 'vault', label: t('workflows.import.vault') }
    ],
    t('workflows.import.from')
  )
  let content: string | null = null
  if (from === 'computer') {
    const [file] = await ui.pickExternalFiles({ accept: ['json'], multiple: false })
    if (file) content = new TextDecoder().decode(file.bytes)
  } else if (from === 'vault') {
    const path = await ui.pickFile({ extensions: ['json'], placeholder: t('workflows.import.vault.pick') })
    if (path) content = await fs.readText(path)
  }
  if (content === null) return []
  const result = importWorkflows(content, { trigger: (id) => !!triggerSpec(id), action: (id) => !!actionSpec(id) }, session.now())
  if (typeof result === 'string') {
    notifier.notify(t(`workflows.import.problem.${result}`), 8000)
    return []
  }
  await session.save([...session.load(), ...result.workflows])
  notifier.notify(
    [t('workflows.import.done', { count: result.workflows.length }), ...(result.skipped ? [t('workflows.import.skipped', { count: result.skipped })] : [])].join(' '),
    10000
  )
  return result.workflows
}
