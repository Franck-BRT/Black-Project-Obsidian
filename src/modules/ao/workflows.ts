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
import { emitWorkflowEvent, registerAction, registerTemplate, registerTrigger, type ActionField, type Subject, type WorkflowAction } from '../workflows'
import { calendarPath, writeCalendar } from './calendar'
import { answerQuestion, QUESTIONNAIRE, runQuestionnaire, writeQuestionNote, type AskMode } from './ask/dossier'
import { pieceSources } from './ask/sources'
import { destinationLabel, wikiLink, type Analysis } from './notes'
import { analyseQuality, qualityPath } from './quality'
import { analysisPosition, listAnalyses, listPieces, type ImportReport, type Services, type Translate } from './service'
import { checkCoherence, checkCoverage, reportPath } from './verification'

export const TRIGGER_CREATED = 'ao.analyse-creee'
export const TRIGGER_IMPORTED = 'ao.pieces-importees'
export const TRIGGER_EXTRACTED = 'ao.exigences-extraites'

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
        pieces: report.imported.map((piece) => noteName(piece.note))
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

/** Les déclarations de l'AO au module Workflows ; `services()` donne l'accès au coffre du moment. */
export function registerAoWorkflows(services: () => Services, t: Translate): void {
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
    fields: subjectFields('nombre', 'lues', 'types', 'places', 'pieces'),
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

  // ── Prêts à l'emploi ──
  registerTemplate({
    id: 'ao.import-calendrier',
    labelKey: 'ao.wf.template.calendar',
    descKey: 'ao.wf.template.calendar.desc',
    make: (tr) => ({
      name: tr('ao.wf.template.calendar'),
      enabled: true,
      mode: 'auto',
      trigger: { kind: TRIGGER_IMPORTED },
      conditions: [{ field: 'places', op: 'contains', value: tr('ao.place.tender') }],
      actions: [
        { kind: 'ao.calendrier', fields: { analyse: '{analyse}' } },
        { kind: 'notifier', fields: { message: tr('ao.wf.template.calendar.message') } }
      ] as WorkflowAction[]
    })
  })
  registerTemplate({
    id: 'ao.extraction-qualite',
    labelKey: 'ao.wf.template.quality',
    descKey: 'ao.wf.template.quality.desc',
    make: (tr) => ({
      name: tr('ao.wf.template.quality'),
      enabled: true,
      mode: 'auto',
      trigger: { kind: TRIGGER_EXTRACTED },
      conditions: [],
      actions: [
        { kind: 'ao.qualite', fields: { analyse: '{analyse}' } },
        { kind: 'ao.coherence', fields: { analyse: '{analyse}' } }
      ]
    })
  })
  registerTemplate({
    id: 'ao.questionnaire-ia',
    labelKey: 'ao.wf.template.questionnaire',
    descKey: 'ao.wf.template.questionnaire.desc',
    make: (tr) => ({
      name: tr('ao.wf.template.questionnaire'),
      enabled: true,
      mode: 'ask',
      trigger: { kind: TRIGGER_IMPORTED },
      conditions: [{ field: 'types', op: 'is', value: 'CCAP, RC, CCTP' }],
      actions: [{ kind: 'ao.questionnaire', fields: { analyse: '{analyse}' } }]
    })
  })
}
