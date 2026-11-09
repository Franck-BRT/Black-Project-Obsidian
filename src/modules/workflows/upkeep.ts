// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'entretien des workflows, écrit en workflows système — le moteur lui-même (le journal,
 * le garde-fou des boucles, la création des workflows système) reste du code : un workflow
 * ne pilote pas ce qui l'exécute.
 *
 * - **Signaler les workflows cassés, à l'ouverture** (activé) : ceux qui attendent un
 *   déclencheur, ou demandent une action, qu'aucun module actif n'apporte ;
 * - **Bilan des workflows, chaque lundi** (désactivé) : les exécutions des sept derniers
 *   jours, les échecs et lesquels ;
 * - **Archiver le journal des workflows, chaque mois** (désactivé) : les exécutions de plus
 *   de 30 jours rangées dans une note d'archive, au lieu d'être perdues au-delà de 300.
 */

import type { FileSystem } from '../../core/ports'
import { JOURNAL_END, JOURNAL_START, journalPath } from './engine'
import { journalRuns } from './home'
import { dayOf, OPENING, SCHEDULE, type Workflow, type WorkflowAction, type WorkflowTrigger } from './model'
import { actionSpec, registerAction, registerSystemWorkflow, triggerSpec, type ActionOutcome, type Translate } from './registry'
import { usable } from './system'

export interface UpkeepDeps {
  fs: FileSystem
  t: Translate
  folder(): string
  load(): Workflow[]
  now(): Date
}

/** Ce qui manque à un workflow pour s'exécuter : son déclencheur, ses actions inconnus. */
export function brokenParts(workflow: Workflow): { trigger?: string; actions: string[] } {
  return {
    ...(triggerSpec(workflow.trigger.kind) ? {} : { trigger: workflow.trigger.kind }),
    actions: [...new Set(workflow.actions.map((action) => action.kind).filter((kind) => !actionSpec(kind)))]
  }
}

const shiftDay = (day: string, days: number): string => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** La note d'archive du journal, pour un mois (AAAA-MM). */
export const archivePath = (folder: string, t: Translate, month: string): string => `${folder}/${t('workflows.archive.file', { month })}.md`

export function registerUpkeep(deps: UpkeepDeps): void {
  const { t } = deps
  const readJournal = async (): Promise<string> => {
    const path = journalPath(deps.folder(), t)
    return (await deps.fs.exists(path)) ? deps.fs.readText(path) : ''
  }

  registerAction({
    id: 'workflows.verifier',
    labelKey: 'workflows.upkeep.action.check',
    descKey: 'workflows.upkeep.action.check.desc',
    fields: [],
    results: ['text'],
    async run({ notifier }) {
      const broken = deps
        .load()
        // Un workflow système dont le déclencheur vient d'un module inactif n'est pas cassé : il dort (« Identifier la langue
        // avec l'IA » sans la bibliothèque) ; il se réveille avec le module.
        .filter((workflow) => workflow.enabled && usable(workflow) && !(workflow.system && !triggerSpec(workflow.trigger.kind)))
        .flatMap((workflow) => {
          const parts = brokenParts(workflow)
          if (!parts.trigger && !parts.actions.length) return []
          const why = [
            ...(parts.trigger ? [t('workflows.upkeep.check.trigger', { kind: parts.trigger })] : []),
            ...(parts.actions.length ? [t('workflows.upkeep.check.actions', { kinds: parts.actions.join(', ') })] : [])
          ].join(', ')
          return [t('workflows.upkeep.check.one', { name: workflow.name, why })]
        })
      if (!broken.length) {
        const text = t('workflows.upkeep.check.none')
        return { lines: [text], results: { text } }
      }
      const text = t('workflows.upkeep.check.found', { count: broken.length, list: broken.join(' ; ') })
      notifier.notify(`${text} ${t('workflows.upkeep.check.how')}`, 15000)
      return { lines: [text], results: { text } }
    }
  })

  registerAction({
    id: 'workflows.bilan',
    labelKey: 'workflows.upkeep.action.digest',
    descKey: 'workflows.upkeep.action.digest.desc',
    fields: [{ key: 'jours', labelKey: 'workflows.upkeep.field.days', kind: 'text', required: true, defaultValue: '7' }],
    results: ['text'],
    async run({ fields, notifier }) {
      const days = Math.max(1, Number.parseInt(fields.jours ?? '7', 10) || 7)
      const since = shiftDay(dayOf(deps.now()), -days)
      const runs = journalRuns(await readJournal(), Number.MAX_SAFE_INTEGER).filter((run) => run.when.slice(0, 10) > since)
      const failed = runs.filter((run) => run.tone === 'danger')
      const byName = new Map<string, number>()
      for (const run of failed) byName.set(run.name, (byName.get(run.name) ?? 0) + 1)
      const names = [...byName].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).map(([name, count]) => t('workflows.upkeep.digest.name', { name, count }))
      const text = failed.length
        ? t('workflows.upkeep.digest.failed', { days, count: runs.length, failed: failed.length, names: names.join(', ') })
        : t('workflows.upkeep.digest.fine', { days, count: runs.length })
      notifier.notify(text, 12000)
      return { lines: [text], results: { text } }
    }
  })

  registerAction({
    id: 'workflows.archiver',
    labelKey: 'workflows.upkeep.action.archive',
    descKey: 'workflows.upkeep.action.archive.desc',
    fields: [{ key: 'jours', labelKey: 'workflows.upkeep.field.older', kind: 'text', required: true, defaultValue: '30' }],
    results: ['path', 'text'],
    async run({ fields }): Promise<ActionOutcome> {
      const { fs } = deps
      const days = Math.max(1, Number.parseInt(fields.jours ?? '30', 10) || 30)
      const today = dayOf(deps.now())
      const cutoff = shiftDay(today, -days)
      const path = journalPath(deps.folder(), t)
      const note = await readJournal()
      if (!note.includes(JOURNAL_START) || !note.includes(JOURNAL_END)) {
        const text = t('workflows.upkeep.archive.none', { days })
        return { lines: [text], results: { text } }
      }
      const from = note.indexOf(JOURNAL_START) + JOURNAL_START.length
      const to = note.indexOf(JOURNAL_END)
      const lines = note
        .slice(from, to)
        .split('\n')
        .filter((each) => each.startsWith('- '))
      // « - AAAA-MM-JJ HH:MM · … » : plus vieille que la borne, elle part à l'archive.
      const old = lines.filter((line) => line.slice(2, 12) < cutoff)
      if (!old.length) {
        const text = t('workflows.upkeep.archive.none', { days })
        return { lines: [text], results: { text } }
      }
      const kept = lines.filter((line) => !old.includes(line))
      const archive = archivePath(deps.folder(), t, today.slice(0, 7))
      const before = (await fs.exists(archive)) ? (await fs.readText(archive)).split('\n').filter((each) => each.startsWith('- ')) : []
      const all = [...new Set([...old, ...before])].sort((a, b) => b.slice(2, 18).localeCompare(a.slice(2, 18)))
      await fs.writeText(
        archive,
        ['---', 'bp-type: workflows-journal-archive', '---', '', `# ${t('workflows.archive.title', { month: today.slice(0, 7) })}`, '', t('workflows.archive.intro'), '', ...all, ''].join('\n')
      )
      await fs.writeText(path, `${note.slice(0, from)}\n${kept.join('\n')}${kept.length ? '\n' : ''}${note.slice(to)}`)
      const text = t('workflows.upkeep.archive.done', { count: old.length, days })
      return { lines: [text], paths: [archive], results: { path: archive, text } }
    }
  })

  // ── Les workflows système de l'entretien ──
  const system = (id: string, enabledByDefault: boolean, make: (tr: Translate) => { trigger: WorkflowTrigger; actions: WorkflowAction[] }) =>
    registerSystemWorkflow({
      id: `sys.workflows.${id}`,
      moduleKey: 'workflows.name',
      enabledByDefault,
      make: (tr) => ({ name: tr(`workflows.sys.${id}`), mode: 'auto', conditions: [], ...make(tr) })
    })
  system('casses', true, () => ({ trigger: { kind: OPENING }, actions: [{ kind: 'workflows.verifier', fields: {} }] }))
  system('bilan-hebdo', false, () => ({ trigger: { kind: SCHEDULE, every: 'week', weekday: 1, time: '08:00' }, actions: [{ kind: 'workflows.bilan', fields: { jours: '7' } }] }))
  system('archiver-journal', false, () => ({ trigger: { kind: SCHEDULE, every: 'month', monthDay: 1, time: '08:00' }, actions: [{ kind: 'workflows.archiver', fields: { jours: '30' } }] }))
}
