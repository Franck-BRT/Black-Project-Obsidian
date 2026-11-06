// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que le module Exigences apporte au module Workflows : un déclencheur (une exigence
 * créée), deux actions (analyser la qualité de la bibliothèque ; relire une exigence avec
 * l'IA, la relecture écrite dans sa note, la formulation inchangée) et un workflow prêt à
 * l'emploi (la qualité chaque lundi).
 */

import { aiClient } from '../ia'
import { emitWorkflowEvent, registerAction, registerTemplate, registerTrigger, type WorkflowAction } from '../workflows'
import { semanticDuplicates } from './ai/semantic'
import { reviewRequirement } from './ai/actions'
import type { Session } from './flows'
import type { Requirement } from './model/requirement'
import { assessAll, qualityMarkdown, withQuality } from './quality/report'

export const TRIGGER_CREATED = 'exigences.creee'

type Translate = (key: string, vars?: Record<string, string | number>) => string

const link = (path: string, label?: string) => `[[${path.replace(/\.md$/, '')}${label ? `|${label}` : ''}]]`

export async function emitRequirementCreated(requirement: Requirement): Promise<void> {
  await emitWorkflowEvent(TRIGGER_CREATED, {
    key: requirement.id,
    label: `${requirement.id} — ${requirement.title}`,
    path: requirement.filePath ?? '',
    vars: {
      id: requirement.id,
      titre: requirement.title,
      categorie: requirement.category,
      type: requirement.type,
      statut: requirement.status,
      criticite: requirement.criticality,
      chemin: requirement.filePath ?? ''
    },
    lists: { motsCles: requirement.tags }
  })
}

/** La note du rapport de qualité de la bibliothèque. */
export const libraryQualityPath = (session: Session): string => `${session.settings().folder}/${session.t('exigences.quality.title')}.md`

/** Le rapport de qualité de la bibliothèque, écrit ; rend son chemin et son résumé. */
export async function writeLibraryQuality(session: Session, date: string): Promise<{ path: string; text: string; count: number }> {
  const { t } = session
  const settings = session.settings()
  const library = await session.store.all()
  const runs = assessAll(library, settings.languages, 'record')
  // Avec un modèle de vecteurs réglé dans le module IA : les doublons par le sens en plus.
  const semantic = await semanticDuplicates(aiClient(), library)
  const path = libraryQualityPath(session)
  const content = qualityMarkdown(runs, {
    t,
    scope: 'record',
    languages: settings.languages,
    date,
    semantic,
    link: (requirement) => (requirement.filePath ? link(requirement.filePath, requirement.id) : requirement.id)
  })
  const existing = (await session.store.readNote(path).catch(() => null)) ?? null
  await session.store.writeNote(path, withQuality(existing, t('exigences.quality.title'), t('exigences.quality.intro'), content, 'Notes'))
  const mean = runs.length ? Math.round((runs.reduce((sum, run) => sum + run.report.score, 0) / runs.length) * 100) : 0
  return { path, count: runs.length, text: t('exigences.quality.done', { count: runs.length, mean, weak: runs.filter((run) => run.report.stars < 3).length }) }
}

export function registerExigencesWorkflows(session: () => Session, t: Translate, today: () => string): void {
  registerTrigger({
    id: TRIGGER_CREATED,
    labelKey: 'exigences.wf.trigger.created',
    descKey: 'exigences.wf.trigger.created.desc',
    fields: ['id', 'titre', 'categorie', 'type', 'statut', 'criticite', 'motsCles'].map((key) => ({ key, labelKey: `exigences.wf.var.${key}` }))
  })

  registerAction({
    id: 'exigences.qualite',
    labelKey: 'exigences.command.quality',
    descKey: 'exigences.wf.action.quality.desc',
    fields: [],
    results: ['path', 'link', 'text'],
    async run() {
      const report = await writeLibraryQuality(session(), today())
      return { lines: [report.text], paths: [report.path], results: { path: report.path, link: link(report.path), text: report.text } }
    }
  })

  registerAction({
    id: 'exigences.relire',
    labelKey: 'exigences.command.review',
    descKey: 'exigences.wf.action.review.desc',
    needsAi: true,
    fields: [{ key: 'exigence', labelKey: 'exigences.wf.field.requirement', kind: 'text', required: true, defaultValue: '{chemin}', tooltipKey: 'exigences.wf.field.requirement.tip' }],
    results: ['path', 'link'],
    async run({ fields, ui, notifier }) {
      const client = aiClient()
      if (!client) throw new Error(t('ia.unavailable'))
      const current = session()
      // Un chemin de note, ou un identifiant de la bibliothèque.
      let path = fields.exigence!
      if (!path.toLowerCase().endsWith('.md')) {
        const found = (await current.store.all()).find((each) => each.id.toUpperCase() === path.toUpperCase())
        if (!found?.filePath) throw new Error(t('exigences.wf.notFound', { id: path }))
        path = found.filePath
      }
      // Sans fenêtre : la relecture est écrite, aucune reformulation n'est appliquée.
      const outcome = await reviewRequirement({ ...current, ui, notifier }, client, path, today(), { offerRewrite: false, quiet: true })
      if (outcome === 'failed') throw new Error(t('exigences.wf.reviewFailed'))
      if (outcome === 'none') throw new Error(t('exigences.ai.noWording'))
      return { lines: [t('exigences.wf.reviewed', { path: link(path) })], paths: [path], results: { path, link: link(path) } }
    }
  })

  registerTemplate({
    id: 'exigences.qualite-hebdo',
    labelKey: 'exigences.wf.template.weekly',
    descKey: 'exigences.wf.template.weekly.desc',
    make: (tr) => ({
      name: tr('exigences.wf.template.weekly'),
      enabled: true,
      mode: 'auto',
      trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' },
      conditions: [],
      actions: [
        { kind: 'exigences.qualite', fields: {} },
        { kind: 'notifier', fields: { message: tr('exigences.wf.template.weekly.message') } }
      ] as WorkflowAction[]
    })
  })
}
