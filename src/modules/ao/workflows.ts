// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que l'analyse d'appels d'offres apporte au module Workflows.
 *
 * - **Déclencheurs** : une analyse créée ; des pièces importées (par fichier, ZIP ou dépôt
 *   à la main) ; des exigences extraites.
 * - **Actions**, sans fenêtre : relever le calendrier, analyser la qualité des exigences,
 *   vérifier leur cohérence et leur couverture, et, avec l'IA, interroger le dossier ou
 *   remplir le questionnaire. Chacune vise l'analyse nommée — `{analyse}` par défaut :
 *   celle de ce qui a déclenché.
 * - **Workflows prêts à l'emploi**, proposés à la création d'un workflow.
 */

import type { Notifier, Ui } from '../../core/ports'
import { aiClient, describeAiError } from '../ia'
import { emitWorkflowEvent, OPENING, registerAction, registerSystemWorkflow, registerTrigger, SCHEDULE, type ActionField, type Subject, type WorkflowAction } from '../workflows'
import { canExtract } from '../exigences'
import { extensionOf } from '../lecture-fichiers'
import { calendarOf, calendarPath, writeCalendar, type Calendar, type DeadlineKind } from './calendar'
import { answerQuestion, QUESTIONNAIRE, runQuestionnaire, writeQuestionNote, type AskMode } from './ask/dossier'
import { OTHER } from '../typage-pieces'
import { pieceSources } from './ask/sources'
import { destinationLabel, wikiLink, type Analysis } from './notes'
import { analyseQuality, qualityPath } from './quality'
import { extractFromPiece, refreshRequirements } from './requirements'
import { analysisPosition, listAnalyses, listPieces, refreshTable, type ImportReport, type Services, type Translate } from './service'
import { checkCoherence, checkCoverage, reportPath } from './verification'

export const TRIGGER_CREATED = 'ao.analyse-creee'
export const TRIGGER_IMPORTED = 'ao.pieces-importees'
export const TRIGGER_EXTRACTED = 'ao.exigences-extraites'

/** Les jours d'un jour à l'autre (AAAA-MM-JJ). */
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Des jours voulus, « 7, 3, 1, 0 » : des entiers positifs ou nuls. */
const wantedDays = (text: string): Set<number> =>
  new Set(
    text
      .split(/[,;\s]+/)
      .map((each) => Number.parseInt(each, 10))
      .filter((each) => Number.isFinite(each) && each >= 0)
  )

const shiftDay = (day: string, days: number, months = 0): string => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + months)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * La fin de validité des offres : sa date, si une pièce la donne ; sinon son délai
 * (« 120 jours », « 6 mois ») compté depuis la date limite de remise.
 */
export function validityEnd(calendar: Calendar): string | null {
  const dated = calendar.dates.find((date) => date.kind === 'validite')
  if (dated) return dated.date
  const delay = calendar.delays.find((each) => each.kind === 'validite')
  const submission = calendar.dates.filter((date) => date.kind === 'remise').map((date) => date.date).sort()[0]
  if (!delay || !submission) return null
  const found = /(\d+)\s*(jours?|days?|mois|months?|semaines?|weeks?)/i.exec(delay.written)
  if (!found) return null
  const count = Number(found[1])
  const unit = found[2]!.toLowerCase()
  if (unit.startsWith('mois') || unit.startsWith('month')) return shiftDay(submission, 0, count)
  if (unit.startsWith('semaine') || unit.startsWith('week')) return shiftDay(submission, count * 7)
  return shiftDay(submission, count)
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
const noteName = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')
const link = (path: string) => wikiLink(path, noteName(path))

/** Le sujet d'une analyse : son nom, sa position, son acheteur ; et plus selon l'évènement. */
async function analysisSubject(services: Services, analysis: Analysis, extra: { vars?: Record<string, string>; lists?: Record<string, string[]> } = {}): Promise<Subject> {
  const position = await analysisPosition(services.fs, analysis)
  const note = await services.fs.readText(analysis.note)
  const field = (name: string) => new RegExp(`^${name}:\\s*"?([^"\\n]*)"?\\s*$`, 'm').exec(note)?.[1]?.trim() ?? ''
  return {
    key: analysis.note,
    label: analysis.name,
    path: analysis.note,
    vars: { analyse: analysis.name, position, acheteur: field('acheteur'), reference: field('reference'), dossier: analysis.folder, ...extra.vars },
    lists: { ...extra.lists }
  }
}

/** Des pièces importées dans une analyse : les workflows qui y répondent s'exécutent. */
export async function emitImported(services: Services, analysis: Analysis, report: ImportReport): Promise<void> {
  if (!report.imported.length) return
  const { t } = services
  await emitWorkflowEvent(
    TRIGGER_IMPORTED,
    await analysisSubject(services, analysis, {
      vars: { nombre: String(report.imported.length), lues: String(report.imported.filter((piece) => piece.state === 'lue').length) },
      lists: {
        types: [...new Set(report.imported.map((piece) => piece.type))],
        places: [...new Set(report.imported.map((piece) => destinationLabel(piece.destination, t)))],
        pieces: report.imported.map((piece) => noteName(piece.note)),
        // Celles qu'aucun mot-clé n'a reconnues.
        nontypees: report.imported.filter((piece) => piece.type === OTHER).map((piece) => noteName(piece.note))
      }
    })
  )
}

export async function emitCreated(services: Services, analysis: Analysis): Promise<void> {
  await emitWorkflowEvent(TRIGGER_CREATED, await analysisSubject(services, analysis))
}

export async function emitExtracted(services: Services, analysis: Analysis, piece: string, count: number): Promise<void> {
  if (count <= 0) return
  await emitWorkflowEvent(TRIGGER_EXTRACTED, await analysisSubject(services, analysis, { vars: { piece, nombre: String(count) } }))
}

const ANALYSIS_FIELD: ActionField = {
  key: 'analyse',
  labelKey: 'ao.wf.field.analysis',
  kind: 'text',
  required: true,
  defaultValue: '{analyse}',
  tooltipKey: 'ao.wf.field.analysis.tip'
}

const subjectFields = (...more: string[]) =>
  ['analyse', 'position', 'acheteur', 'reference', ...more].map((key) => ({ key, labelKey: `ao.wf.var.${key}` }))

/**
 * Les déclarations de l'AO au module Workflows ; `services()` donne l'accès au coffre du
 * moment, `remindPlacement()` montre le rappel du rangement (s'il y a lieu ; vrai s'il l'a fait).
 */
export function registerAoWorkflows(services: () => Services, t: Translate, remindPlacement: () => Promise<boolean> = async () => false): void {
  const find = async (name: string): Promise<Analysis> => {
    const all = await listAnalyses(services())
    const found = all.find((analysis) => fold(analysis.name) === fold(name) || analysis.note === name || analysis.folder === name)
    if (!found) throw new Error(t('ao.wf.noAnalysis', { name }))
    return found
  }

  const pickSubject = async (window: { ui: Ui; notifier: Notifier }) => {
    const all = await listAnalyses(services())
    if (!all.length) {
      window.notifier.notify(t('ao.none', { folder: services().root }), 8000)
      return null
    }
    const chosen = all.length === 1 ? all[0]!.name : await window.ui.pickOption(all.map((analysis) => ({ value: analysis.name, label: analysis.name, description: analysis.folder })), t('ao.pick.analysis'))
    const analysis = all.find((each) => each.name === chosen)
    if (!analysis) return null
    const pieces = await listPieces(services(), analysis)
    return analysisSubject(services(), analysis, {
      vars: { nombre: String(pieces.length), lues: String(pieces.filter((piece) => piece.state === 'lue').length) },
      lists: { types: [...new Set(pieces.map((piece) => piece.type))], pieces: pieces.map((piece) => noteName(piece.note)) }
    })
  }

  registerTrigger({ id: TRIGGER_CREATED, labelKey: 'ao.wf.trigger.created', descKey: 'ao.wf.trigger.created.desc', fields: subjectFields(), pickSubject })
  registerTrigger({
    id: TRIGGER_IMPORTED,
    labelKey: 'ao.wf.trigger.imported',
    descKey: 'ao.wf.trigger.imported.desc',
    fields: subjectFields('nombre', 'lues', 'types', 'places', 'pieces', 'nontypees'),
    pickSubject
  })
  registerTrigger({ id: TRIGGER_EXTRACTED, labelKey: 'ao.wf.trigger.extracted', descKey: 'ao.wf.trigger.extracted.desc', fields: subjectFields('piece', 'nombre'), pickSubject })

  registerAction({
    id: 'ao.calendrier',
    labelKey: 'ao.command.calendar',
    descKey: 'ao.wf.action.calendar.desc',
    fields: [ANALYSIS_FIELD],
    results: ['path', 'link', 'text'],
    async run({ fields }) {
      const analysis = await find(fields.analyse!)
      const calendar = await writeCalendar(services(), analysis)
      const text = t('ao.calendar.summary', { dates: calendar.dates.length, delays: calendar.delays.length, pieces: calendar.read })
      const path = calendarPath(analysis)
      return { lines: [text], paths: [path], results: { path, link: link(path), text } }
    }
  })

  registerAction({
    id: 'ao.qualite',
    labelKey: 'ao.command.quality',
    descKey: 'ao.wf.action.quality.desc',
    fields: [ANALYSIS_FIELD],
    results: ['path', 'link', 'text'],
    async run({ fields }) {
      const analysis = await find(fields.analyse!)
      const runs = await analyseQuality(services(), analysis)
      const mean = runs.length ? Math.round((runs.reduce((sum, run) => sum + run.report.score, 0) / runs.length) * 100) : 0
      const text = t('exigences.quality.done', { count: runs.length, mean, weak: runs.filter((run) => run.report.stars < 3).length })
      const path = qualityPath(analysis)
      return { lines: [text], paths: [path], results: { path, link: link(path), text } }
    }
  })

  for (const [id, labelKey, check] of [
    ['ao.coherence', 'ao.command.coherence', checkCoherence],
    ['ao.couverture', 'ao.command.coverage', checkCoverage]
  ] as const) {
    registerAction({
      id,
      labelKey,
      descKey: `ao.wf.action.${id.slice(3)}.desc`,
      fields: [ANALYSIS_FIELD],
      results: ['path', 'link', 'text'],
      async run({ fields }) {
        const analysis = await find(fields.analyse!)
        const text = await check(services(), analysis)
        const path = reportPath(analysis)
        return { lines: [text], paths: [path], results: { path, link: link(path), text } }
      }
    })
  }

  const needAi = () => {
    const client = aiClient()
    if (!client) throw new Error(t('ia.unavailable'))
    return client
  }

  registerAction({
    id: 'ao.interroger',
    labelKey: 'ao.command.ask',
    descKey: 'ao.wf.action.ask.desc',
    needsAi: true,
    fields: [
      ANALYSIS_FIELD,
      { key: 'question', labelKey: 'ao.ask.form.question', kind: 'textarea', required: true, placeholderKey: 'ao.ask.form.question.placeholder' },
      {
        key: 'mode',
        labelKey: 'ao.ask.form.mode',
        kind: 'choice',
        defaultValue: 'search',
        options: [
          { value: 'search', labelKey: 'ao.ask.mode.search' },
          { value: 'each', labelKey: 'ao.ask.mode.each' }
        ]
      }
    ],
    results: ['path', 'link', 'text'],
    async run({ fields }) {
      const client = needAi()
      const analysis = await find(fields.analyse!)
      const sources = await pieceSources(services(), analysis)
      if (!sources.length) throw new Error(t('ao.ask.noPiece'))
      try {
        const answer = await answerQuestion(client, t, sources, fields.question!, (fields.mode === 'each' ? 'each' : 'search') as AskMode)
        const path = await writeQuestionNote(services(), analysis, answer)
        return { lines: [answer.nothing ? t('ao.ask.nothing') : t('ao.ask.done', { cited: answer.sources.filter((each) => each.cited).length, sources: answer.sources.length })], paths: [path], results: { path, link: link(path), text: answer.text } }
      } catch (error) {
        throw new Error(describeAiError(error, t))
      }
    }
  })

  registerAction({
    id: 'ao.questionnaire',
    labelKey: 'ao.command.questionnaire',
    descKey: 'ao.wf.action.questionnaire.desc',
    needsAi: true,
    fields: [ANALYSIS_FIELD],
    results: ['path', 'link', 'text'],
    async run({ fields }) {
      const client = needAi()
      const analysis = await find(fields.analyse!)
      const sources = await pieceSources(services(), analysis)
      if (!sources.length) throw new Error(t('ao.ask.noPiece'))
      try {
        const { path, answers } = await runQuestionnaire(services(), client, analysis, sources, QUESTIONNAIRE)
        const text = t('ao.questionnaire.done', { count: answers.length, empty: answers.filter((answer) => answer.nothing).length })
        return { lines: [text], paths: [path], results: { path, link: link(path), text } }
      } catch (error) {
        throw new Error(describeAiError(error, t))
      }
    }
  })

  // ── Ce que l'application faisait d'elle-même : la note de l'analyse, les rappels ──
  registerAction({
    id: 'ao.note-pieces',
    labelKey: 'ao.wf.action.notePieces',
    descKey: 'ao.wf.action.notePieces.desc',
    fields: [ANALYSIS_FIELD],
    results: ['path'],
    async run({ fields }) {
      const analysis = await find(fields.analyse!)
      const rows = await refreshTable(services(), analysis)
      return { lines: [t('ao.wf.notePieces.done', { count: rows.length })], paths: [analysis.note], results: { path: analysis.note } }
    }
  })
  registerAction({
    id: 'ao.note-exigences',
    labelKey: 'ao.wf.action.noteRequirements',
    descKey: 'ao.wf.action.noteRequirements.desc',
    fields: [ANALYSIS_FIELD],
    results: ['path'],
    async run({ fields }) {
      const analysis = await find(fields.analyse!)
      const requirements = await refreshRequirements(services(), analysis)
      return { lines: [t('ao.wf.noteRequirements.done', { count: requirements.length })], paths: [analysis.note], results: { path: analysis.note } }
    }
  })
  registerAction({
    id: 'ao.rappel-remises',
    labelKey: 'ao.wf.action.deadlines',
    descKey: 'ao.wf.action.deadlines.desc',
    fields: [{ key: 'jours', labelKey: 'ao.wf.field.days', kind: 'text', required: true, defaultValue: '7, 3, 1, 0', tooltipKey: 'ao.wf.field.days.tip' }],
    results: ['text'],
    async run({ fields, notifier }) {
      const wanted = new Set(
        (fields.jours ?? '')
          .split(/[,;\s]+/)
          .map((each) => Number.parseInt(each, 10))
          .filter((each) => Number.isFinite(each) && each >= 0)
      )
      const today = services().today()
      const soon: string[] = []
      for (const analysis of await listAnalyses(services())) {
        const calendar = calendarOf(await pieceSources(services(), analysis, 'appel-d-offres'), Number(today.slice(0, 4)))
        const due = calendar.dates
          .filter((date) => date.kind === 'remise' && date.date >= today)
          .map((date) => date.date)
          .sort()[0]
        if (!due) continue
        const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
        if (!wanted.has(days)) continue
        soon.push(t(days === 0 ? 'ao.wf.deadlines.today' : 'ao.wf.deadlines.in', { name: analysis.name, days, date: due }))
      }
      // Rien à dire : rien n'est montré, le journal le garde.
      if (soon.length) notifier.notify(soon.join(' '), 15000)
      const text = soon.length ? soon.join(' ') : t('ao.wf.deadlines.none')
      return { lines: [text], results: { text } }
    }
  })
  // Les autres échéances de la consultation : la date limite des questions, la visite.
  registerAction({
    id: 'ao.rappel-echeances',
    labelKey: 'ao.wf.action.milestones',
    descKey: 'ao.wf.action.milestones.desc',
    fields: [{ key: 'jours', labelKey: 'ao.wf.field.milestoneDays', kind: 'text', required: true, defaultValue: '3, 1, 0', tooltipKey: 'ao.wf.field.days.tip' }],
    results: ['text'],
    async run({ fields, notifier }) {
      const wanted = wantedDays(fields.jours ?? '')
      const today = services().today()
      const kinds: readonly DeadlineKind[] = ['questions', 'visite']
      const soon: string[] = []
      for (const analysis of await listAnalyses(services())) {
        const calendar = calendarOf(await pieceSources(services(), analysis, 'appel-d-offres'), Number(today.slice(0, 4)))
        for (const kind of kinds) {
          const due = calendar.dates
            .filter((date) => date.kind === kind && date.date >= today)
            .map((date) => date.date)
            .sort()[0]
          if (!due) continue
          const days = daysBetween(today, due)
          if (!wanted.has(days)) continue
          const what = t(`ao.calendar.kind.${kind}`)
          soon.push(t(days === 0 ? 'ao.wf.milestones.today' : 'ao.wf.milestones.in', { name: analysis.name, what, days, date: due }))
        }
      }
      if (soon.length) notifier.notify(soon.join(' '), 15000)
      const text = soon.length ? soon.join(' ') : t('ao.wf.milestones.none')
      return { lines: [text], results: { text } }
    }
  })
  // La fin de validité des offres, une fois la remise passée.
  registerAction({
    id: 'ao.validite-offres',
    labelKey: 'ao.wf.action.validity',
    descKey: 'ao.wf.action.validity.desc',
    fields: [{ key: 'jours', labelKey: 'ao.wf.field.validityDays', kind: 'text', required: true, defaultValue: '7, 1', tooltipKey: 'ao.wf.field.days.tip' }],
    results: ['text'],
    async run({ fields, notifier }) {
      const wanted = wantedDays(fields.jours ?? '')
      const today = services().today()
      const soon: string[] = []
      for (const analysis of await listAnalyses(services())) {
        const calendar = calendarOf(await pieceSources(services(), analysis, 'appel-d-offres'), Number(today.slice(0, 4)))
        const submission = calendar.dates.filter((date) => date.kind === 'remise').map((date) => date.date).sort().at(-1)
        // Avant la remise, l'offre n'est pas encore engagée : rien à dire.
        if (!submission || submission >= today) continue
        const end = validityEnd(calendar)
        if (!end || end < today) continue
        const days = daysBetween(today, end)
        if (!wanted.has(days)) continue
        soon.push(t(days === 0 ? 'ao.wf.validity.today' : 'ao.wf.validity.in', { name: analysis.name, days, date: end }))
      }
      if (soon.length) notifier.notify(soon.join(' '), 15000)
      const text = soon.length ? soon.join(' ') : t('ao.wf.validity.none')
      return { lines: [text], results: { text } }
    }
  })
  // Extraire les exigences des pièces d'un type tout juste importées : l'aperçu s'ouvre, on coche, on importe.
  registerAction({
    id: 'ao.extraire',
    labelKey: 'ao.wf.action.extract',
    descKey: 'ao.wf.action.extract.desc',
    fields: [ANALYSIS_FIELD, { key: 'type', labelKey: 'ao.wf.field.type', kind: 'text', required: true, defaultValue: 'CCTP', tooltipKey: 'ao.wf.field.type.tip' }],
    results: ['text'],
    async run({ fields, subject, ui, notifier }) {
      const analysis = await find(fields.analyse!)
      const types = new Set((fields.type ?? '').split(/[,;]/).map((each) => each.trim().toUpperCase()).filter(Boolean))
      // Celles de l'import qui a déclenché (sinon toutes celles de ce type).
      const just = new Set(subject.lists.pieces ?? [])
      const pieces = (await listPieces(services(), analysis)).filter(
        (piece) => types.has(piece.type.toUpperCase()) && canExtract(extensionOf(piece.original)) && (!just.size || just.has(noteName(piece.note)))
      )
      if (!pieces.length) return { lines: [t('ao.wf.extract.none', { types: [...types].join(', ') })] }
      const done: string[] = []
      for (const piece of pieces) {
        const report = await extractFromPiece(services(), { ui, notifier }, piece.note)
        if (!report) continue
        const count = report.outcome.created.length + report.outcome.updated.length
        done.push(t('ao.wf.extract.piece', { piece: noteName(piece.note), count }))
        // Les workflows des exigences extraites passent après celui-ci.
        await emitExtracted(services(), analysis, noteName(piece.note), count)
      }
      const text = done.length ? done.join(' ') : t('ao.wf.extract.skipped')
      return { lines: [text], paths: pieces.map((piece) => piece.note), results: { text } }
    }
  })
  registerAction({
    id: 'ao.rappel-rangement',
    labelKey: 'ao.wf.action.placementReminder',
    descKey: 'ao.wf.action.placementReminder.desc',
    fields: [],
    results: [],
    async run() {
      return { lines: [t(await remindPlacement() ? 'ao.wf.placementReminder.shown' : 'ao.wf.placementReminder.none')] }
    }
  })

  // ── Les workflows système : les automatismes de l'analyse d'appels d'offres ──
  const system = (id: string, enabledByDefault: boolean, make: (tr: Translate) => { mode?: 'auto' | 'ask'; trigger: { kind: string; every?: 'day'; time?: string }; conditions?: { field: string; op: 'contains' | 'is'; value: string }[]; actions: WorkflowAction[] }) =>
    registerSystemWorkflow({
      id: `sys.ao.${id}`,
      moduleKey: 'ao.name',
      enabledByDefault,
      make: (tr) => {
        const made = make(tr)
        return { name: tr(`ao.sys.${id}`), mode: made.mode ?? 'auto', trigger: made.trigger, conditions: made.conditions ?? [], actions: made.actions }
      }
    })
  const analysisField = { analyse: '{analyse}' }
  system('note-pieces', true, () => ({ trigger: { kind: TRIGGER_IMPORTED }, actions: [{ kind: 'ao.note-pieces', fields: analysisField }] }))
  system('note-exigences', true, () => ({ trigger: { kind: TRIGGER_EXTRACTED }, actions: [{ kind: 'ao.note-exigences', fields: analysisField }] }))
  system('calendrier-import', true, (tr) => ({
    trigger: { kind: TRIGGER_IMPORTED },
    conditions: [{ field: 'places', op: 'contains', value: tr('ao.place.tender') }],
    actions: [{ kind: 'ao.calendrier', fields: analysisField }]
  }))
  system('controle-extraction', true, () => ({
    trigger: { kind: TRIGGER_EXTRACTED },
    actions: [
      { kind: 'ao.qualite', fields: analysisField },
      { kind: 'ao.coherence', fields: analysisField }
    ]
  }))
  system('rappel-remises', true, () => ({ trigger: { kind: SCHEDULE, every: 'day', time: '08:00' }, actions: [{ kind: 'ao.rappel-remises', fields: { jours: '7, 3, 1, 0' } }] }))
  system('rappel-rangement', true, () => ({ trigger: { kind: OPENING }, actions: [{ kind: 'ao.rappel-rangement', fields: {} }] }))
  system('rappel-echeances', true, () => ({ trigger: { kind: SCHEDULE, every: 'day', time: '08:00' }, actions: [{ kind: 'ao.rappel-echeances', fields: { jours: '3, 1, 0' } }] }))
  system('validite-offres', false, () => ({ trigger: { kind: SCHEDULE, every: 'day', time: '08:00' }, actions: [{ kind: 'ao.validite-offres', fields: { jours: '7, 1' } }] }))
  system('extraire-cctp', false, () => ({
    trigger: { kind: TRIGGER_IMPORTED },
    conditions: [{ field: 'types', op: 'contains', value: 'CCTP' }],
    actions: [{ kind: 'ao.extraire', fields: { ...analysisField, type: 'CCTP' } }]
  }))
  system('questionnaire-ia', false, () => ({
    mode: 'ask',
    trigger: { kind: TRIGGER_IMPORTED },
    conditions: [{ field: 'types', op: 'is', value: 'CCAP, RC, CCTP' }],
    actions: [{ kind: 'ao.questionnaire', fields: analysisField }]
  }))
  system('couverture-reponse', false, (tr) => ({
    trigger: { kind: TRIGGER_IMPORTED },
    conditions: [{ field: 'places', op: 'contains', value: tr('ao.place.response') }],
    actions: [{ kind: 'ao.couverture', fields: analysisField }]
  }))
}
