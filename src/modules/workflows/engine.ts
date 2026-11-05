// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le moteur : un évènement arrive (des pièces importées), les workflows qui y répondent
 * s'exécutent — tout de suite, ou après accord s'ils le demandent —, étape par étape,
 * chaque étape pouvant reprendre les résultats des précédentes ({step1.path}). Une étape
 * qui échoue arrête le workflow. Chaque exécution est écrite dans le journal, une note du
 * coffre. Un workflow qui s'exécute plus de 30 fois en une heure boucle : il est arrêté.
 *
 * Les exécutions passent l'une après l'autre : un workflow dont une action déclenche un
 * évènement voit cet évènement traité après lui, pas au milieu.
 */

import type { FileSystem, Notifier, Ui } from '../../core/ports'
import {
  dayOf,
  expand,
  matches,
  MAX_RUNS_PER_HOUR,
  NO_SUBJECT,
  scheduleDue,
  SCHEDULE,
  stepVariable,
  variablesOf,
  type Workflow,
  type WorkflowEvent
} from './model'
import { actionSpec, triggerSpec, type Translate } from './registry'

export type Outcome = 'done' | 'failed' | 'declined' | 'stopped'

export interface LogEntry {
  at: Date
  workflow: Workflow
  subject: string
  outcome: Outcome
  lines: string[]
  paths: string[]
  subjectPath: string
}

export interface EngineDeps {
  fs: FileSystem
  ui: Ui
  notifier: Notifier
  t: Translate
  now(): Date
  load(): Workflow[]
  save(workflows: Workflow[]): Promise<void>
  /** Le dossier du journal. */
  folder(): string
}

export const JOURNAL_START = '<!-- bp:journal:debut — tenu à jour par Black Projects -->'
export const JOURNAL_END = '<!-- bp:journal:fin -->'
/** Les exécutions gardées dans le journal. */
export const JOURNAL_SIZE = 300

const MARK: Record<Outcome, string> = { done: '✅', failed: '❌', declined: '⏭️', stopped: '⛔' }

const pad = (value: number) => String(value).padStart(2, '0')
const stamp = (at: Date) => `${dayOf(at)} ${pad(at.getHours())}:${pad(at.getMinutes())}`
const link = (path: string) => `[[${path.replace(/\.md$/, '')}]]`

export function journalPath(folder: string, t: Translate): string {
  return `${folder}/${t('workflows.journal.file')}.md`
}

/** Une ligne du journal. */
export function journalLine(entry: LogEntry, t: Translate): string {
  const about = entry.subject ? ` · ${t('workflows.journal.on', { subject: entry.subject })}` : ''
  const from = entry.subjectPath ? ` (${link(entry.subjectPath)})` : ''
  const what = entry.lines.length ? ` — ${entry.lines.join(' ; ')}` : ''
  const wrote = entry.paths.length ? ` · ${entry.paths.map(link).join(', ')}` : ''
  return `- ${stamp(entry.at)} · ${MARK[entry.outcome]} ${t(`workflows.outcome.${entry.outcome}`)} · **${entry.workflow.name}**${about}${from}${what}${wrote}`.replace(/\n/g, ' ')
}

export class WorkflowEngine {
  /** Les heures des dernières exécutions de chaque workflow, pour arrêter une boucle. */
  private readonly recent = new Map<string, number[]>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly deps: EngineDeps) {}

  /** Un évènement : les workflows qui y répondent s'exécutent, à la suite. */
  emit(event: WorkflowEvent): Promise<void> {
    const run = this.queue.then(async () => {
      const today = dayOf(this.deps.now())
      for (const workflow of this.deps.load().filter((each) => matches(each, event, today))) await this.execute(workflow, event, false)
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Les workflows planifiés dont l'heure est venue. */
  tick(): Promise<void> {
    const run = this.queue.then(async () => {
      const now = this.deps.now()
      for (const workflow of this.deps.load().filter((each) => scheduleDue(each, now))) {
        await this.execute(workflow, { trigger: SCHEDULE, subject: NO_SUBJECT }, false)
      }
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  /** À la main : le sujet choisi (ou aucun), sans redemander l'accord. */
  runByHand(workflow: Workflow, event: WorkflowEvent): Promise<Outcome> {
    const run = this.queue.then(() => this.execute(workflow, event, true))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async execute(workflow: Workflow, event: WorkflowEvent, byHand: boolean): Promise<Outcome> {
    const { t, ui, notifier } = this.deps
    const now = this.deps.now()
    const subject = event.subject
    const entry = (outcome: Outcome, lines: string[], paths: string[] = []): LogEntry => ({
      at: now,
      workflow,
      subject: subject.label,
      outcome,
      lines,
      paths,
      subjectPath: subject.path
    })

    // Une boucle : arrêtée, et dite.
    const hour = now.getTime() - 3600_000
    const times = (this.recent.get(workflow.id) ?? []).filter((time) => time > hour)
    if (!byHand && times.length >= MAX_RUNS_PER_HOUR) {
      await this.finish(workflow, entry('stopped', [t('workflows.stopped', { count: MAX_RUNS_PER_HOUR })]), false)
      notifier.notify(t('workflows.stopped.notice', { name: workflow.name }), 12000)
      return 'stopped'
    }
    this.recent.set(workflow.id, [...times, now.getTime()])

    // Demander d'abord.
    if (workflow.mode === 'ask' && !byHand) {
      const agreed = await ui.confirm({
        title: t('workflows.ask.title', { name: workflow.name }),
        message: [
          subject.label ? t('workflows.ask.subject', { subject: subject.label, trigger: this.triggerLabel(workflow.trigger.kind) }) : t('workflows.ask.noSubject'),
          ...workflow.actions.map((action, index) => `${index + 1}. ${this.actionLabel(action.kind)}`)
        ].join('\n'),
        confirm: t('workflows.ask.run'),
        cancel: t('workflows.ask.skip')
      })
      if (!agreed) {
        await this.finish(workflow, entry('declined', []), true)
        return 'declined'
      }
    }

    const vars = variablesOf(subject, workflow, now)
    const lines: string[] = []
    const paths: string[] = []
    for (const [index, action] of workflow.actions.entries()) {
      const step = index + 1
      const spec = actionSpec(action.kind)
      if (!spec) {
        lines.push(t('workflows.step.unknown', { step, kind: action.kind }))
        return this.failed(workflow, entry('failed', lines, paths))
      }
      const fields = Object.fromEntries(spec.fields.map((field) => [field.key, expand(action.fields[field.key] ?? field.defaultValue ?? '', vars).trim()]))
      const missing = spec.fields.find((field) => field.required && !fields[field.key])
      if (missing) {
        lines.push(t('workflows.step.missing', { step, action: t(spec.labelKey), field: t(missing.labelKey) }))
        return this.failed(workflow, entry('failed', lines, paths))
      }
      try {
        const outcome = await spec.run({ fields, subject, vars, t, ui, notifier })
        lines.push(`${step}. ${t(spec.labelKey)} : ${outcome.lines.join(' ') || t('workflows.step.done')}`)
        paths.push(...(outcome.paths ?? []))
        for (const [name, value] of Object.entries(outcome.results ?? {})) vars[stepVariable(step, name)] = value
      } catch (error) {
        lines.push(t('workflows.step.failed', { step, action: t(spec.labelKey), reason: error instanceof Error ? error.message : String(error) }))
        return this.failed(workflow, entry('failed', lines, paths))
      }
    }
    await this.finish(workflow, entry('done', lines, [...new Set(paths)]), true)
    if (workflow.mode === 'auto' || byHand) notifier.notify(t('workflows.done.notice', { name: workflow.name, count: workflow.actions.length }), 6000)
    return 'done'
  }

  private async failed(workflow: Workflow, logged: LogEntry): Promise<Outcome> {
    await this.finish(workflow, logged, true)
    this.deps.notifier.notify(this.deps.t('workflows.failed.notice', { name: workflow.name, reason: logged.lines.at(-1) ?? '' }), 12000)
    return 'failed'
  }

  /** Le journal, et le compte des exécutions du workflow. */
  private async finish(workflow: Workflow, logged: LogEntry, counted: boolean): Promise<void> {
    await this.writeJournal(logged)
    if (!counted) return
    const all = this.deps.load()
    const at = all.findIndex((each) => each.id === workflow.id)
    if (at === -1) return
    all[at] = { ...all[at]!, lastRun: logged.at.toISOString(), runs: (all[at]!.runs ?? 0) + 1 }
    await this.deps.save(all)
  }

  private async writeJournal(logged: LogEntry): Promise<void> {
    const { fs, t } = this.deps
    const path = journalPath(this.deps.folder(), t)
    const line = journalLine(logged, t)
    let note = (await fs.exists(path)) ? await fs.readText(path) : ''
    if (!note.includes(JOURNAL_START) || !note.includes(JOURNAL_END)) {
      note = ['---', 'bp-type: workflows-journal', '---', '', `# ${t('workflows.journal.title')}`, '', t('workflows.journal.intro'), '', JOURNAL_START, JOURNAL_END, ''].join('\n')
    }
    const from = note.indexOf(JOURNAL_START) + JOURNAL_START.length
    const to = note.indexOf(JOURNAL_END)
    const kept = note
      .slice(from, to)
      .split('\n')
      .filter((each) => each.startsWith('- '))
      .slice(0, JOURNAL_SIZE - 1)
    await fs.writeText(path, `${note.slice(0, from)}\n${[line, ...kept].join('\n')}\n${note.slice(to)}`)
  }

  private triggerLabel(kind: string): string {
    const spec = triggerSpec(kind)
    return spec ? this.deps.t(spec.labelKey) : kind
  }

  private actionLabel(kind: string): string {
    const spec = actionSpec(kind)
    return spec ? this.deps.t(spec.labelKey) : kind
  }
}
