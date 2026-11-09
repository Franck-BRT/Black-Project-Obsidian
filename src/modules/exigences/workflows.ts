// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que le module Exigences apporte au module Workflows : un déclencheur (une exigence
 * créée), deux actions (analyser la qualité de la bibliothèque ; relire une exigence avec
 * l'IA, la relecture écrite dans sa note, la formulation inchangée) et un workflow prêt à
 * l'emploi (la qualité chaque lundi).
 */

import { aiClient } from '../ia'
import { namedEntry } from '../bibliotheque'
import { emitWorkflowEvent, registerAction, registerSystemWorkflow, registerTrigger, type WorkflowAction } from '../workflows'
import { semanticDuplicates } from './ai/semantic'
import { reviewRequirement, translateRequirement, translationTargets } from './ai/actions'
import type { Session } from './flows'
import type { Requirement } from './model/requirement'
import { assessAll, qualityMarkdown, withQuality } from './quality/report'

export const TRIGGER_CREATED = 'exigences.creee'
/** Des exigences importées d'un fichier (créées ou mises à jour) : le déclencheur. */
export const TRIGGER_IMPORTED = 'exigences.importees'

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

/** Un import d'exigences fait : les workflows qui y répondent s'exécutent. */
export async function emitRequirementsImported(outcome: { created: readonly Requirement[]; updated: readonly Requirement[] }, name: string, label: string): Promise<void> {
  const all = [...outcome.created, ...outcome.updated]
  if (!all.length) return
  await emitWorkflowEvent(TRIGGER_IMPORTED, {
    key: name,
    label,
    path: '',
    vars: { fichier: name, nombre: String(all.length), creees: String(outcome.created.length), modifiees: String(outcome.updated.length) },
    lists: { ids: all.map((requirement) => requirement.id), chemins: all.flatMap((requirement) => (requirement.filePath ? [requirement.filePath] : [])) }
  })
}

/** Les traductions à revoir dans la bibliothèque : absentes, en retard sur la source, ou à relire. */
export function laggingTranslations(library: readonly Requirement[], languages: readonly string[]): { missing: number; stale: number; unreviewed: number; requirements: Requirement[] } {
  let missing = 0
  let stale = 0
  let unreviewed = 0
  const requirements: Requirement[] = []
  for (const requirement of library) {
    let lagging = false
    for (const lang of languages) {
      if (lang === requirement.sourceLang) continue
      const text = requirement.text[lang]
      if (!text) missing++
      else if (text.fromRev < requirement.rev) stale++
      else if (!text.reviewed) unreviewed++
      else continue
      lagging = true
    }
    if (lagging) requirements.push(requirement)
  }
  return { missing, stale, unreviewed, requirements }
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

  registerTrigger({
    id: TRIGGER_IMPORTED,
    labelKey: 'exigences.wf.trigger.imported',
    descKey: 'exigences.wf.trigger.imported.desc',
    fields: ['fichier', 'nombre', 'creees', 'modifiees', 'ids'].map((key) => ({ key, labelKey: `exigences.wf.var.${key}` }))
  })

  // Contrôler la qualité des exigences d'un import : les faibles (moins de 3 étoiles), nommées.
  registerAction({
    id: 'exigences.controle-import',
    labelKey: 'exigences.wf.action.checkImport',
    descKey: 'exigences.wf.action.checkImport.desc',
    fields: [],
    results: ['text'],
    async run({ subject, notifier }) {
      const current = session()
      const paths = new Set(subject.lists.chemins ?? [])
      const ids = new Set((subject.lists.ids ?? []).map((id) => id.toUpperCase()))
      const imported = (await current.store.all()).filter((requirement) => (requirement.filePath && paths.has(requirement.filePath)) || ids.has(requirement.id.toUpperCase()))
      if (!imported.length) {
        const text = t('exigences.wf.checkImport.nothing')
        return { lines: [text], results: { text } }
      }
      const runs = assessAll(imported, current.settings().languages, 'record')
      const mean = Math.round((runs.reduce((sum, run) => sum + run.report.score, 0) / runs.length) * 100)
      const weak = runs.filter((run) => run.report.stars < 3).sort((a, b) => a.report.stars - b.report.stars || a.requirement.id.localeCompare(b.requirement.id, undefined, { numeric: true }))
      if (!weak.length) {
        const text = t('exigences.wf.checkImport.fine', { count: runs.length, mean })
        return { lines: [text], results: { text } }
      }
      const names = weak.map((run) => `${run.requirement.id} (${'★'.repeat(run.report.stars) || '☆'})`).join(', ')
      const text = t(subject.label ? 'exigences.wf.checkImport.weak.in' : 'exigences.wf.checkImport.weak', { weak: weak.length, count: runs.length, names, mean, where: subject.label })
      notifier.notify(`${text} ${t('exigences.wf.checkImport.how')}`, 15000)
      return { lines: [text], paths: weak.flatMap((run) => (run.requirement.filePath ? [run.requirement.filePath] : [])), results: { text } }
    }
  })

  // Les traductions à revoir dans la bibliothèque, comptées ; dites s'il y en a.
  registerAction({
    id: 'exigences.traductions-retard',
    labelKey: 'exigences.wf.action.lagging',
    descKey: 'exigences.wf.action.lagging.desc',
    fields: [],
    results: ['text'],
    async run({ notifier }) {
      const current = session()
      const lagging = laggingTranslations(await current.store.all(), current.settings().languages)
      if (!lagging.requirements.length) {
        const text = t('exigences.wf.lagging.none')
        return { lines: [text], results: { text } }
      }
      const text = t('exigences.wf.lagging.found', { count: lagging.requirements.length, missing: lagging.missing, stale: lagging.stale, unreviewed: lagging.unreviewed })
      notifier.notify(`${text} ${t('exigences.wf.lagging.how')}`, 15000)
      return { lines: [text], results: { text } }
    }
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
    fields: [
      { key: 'exigence', labelKey: 'exigences.wf.field.requirement', kind: 'text', required: true, defaultValue: '{chemin}', tooltipKey: 'exigences.wf.field.requirement.tip' },
      { key: 'persona', labelKey: 'bibliotheque.wf.field.persona', kind: 'text', tooltipKey: 'bibliotheque.wf.field.persona.tip' }
    ],
    results: ['path', 'link'],
    async run({ fields, ui, notifier, guidance }) {
      const client = aiClient()?.withInstructions(guidance)
      if (!client) throw new Error(t('ia.unavailable'))
      const current = session()
      const persona = await namedEntry('persona', fields.persona)
      // Un chemin de note, ou un identifiant de la bibliothèque.
      let path = fields.exigence!
      if (!path.toLowerCase().endsWith('.md')) {
        const found = (await current.store.all()).find((each) => each.id.toUpperCase() === path.toUpperCase())
        if (!found?.filePath) throw new Error(t('exigences.wf.notFound', { id: path }))
        path = found.filePath
      }
      // Sans fenêtre : la relecture est écrite, aucune reformulation n'est appliquée.
      const outcome = await reviewRequirement({ ...current, ui, notifier }, client, path, today(), { offerRewrite: false, quiet: true, persona })
      if (outcome === 'failed') throw new Error(t('exigences.wf.reviewFailed'))
      if (outcome === 'none') throw new Error(t('exigences.ai.noWording'))
      return { lines: [t('exigences.wf.reviewed', { path: link(path) })], paths: [path], results: { path, link: link(path) } }
    }
  })

  // Traduire une exigence dans les autres langues de rédaction ; chaque traduction marquée « à relire ».
  registerAction({
    id: 'exigences.traduire',
    labelKey: 'exigences.wf.action.translate',
    descKey: 'exigences.wf.action.translate.desc',
    needsAi: true,
    fields: [{ key: 'exigence', labelKey: 'exigences.wf.field.requirement', kind: 'text', required: true, defaultValue: '{chemin}', tooltipKey: 'exigences.wf.field.requirement.tip' }],
    results: ['path', 'link'],
    async run({ fields, ui, notifier, guidance }) {
      const client = aiClient()?.withInstructions(guidance)
      if (!client) throw new Error(t('ia.unavailable'))
      const current = session()
      let path = fields.exigence!
      if (!path.toLowerCase().endsWith('.md')) {
        const found = (await current.store.all()).find((each) => each.id.toUpperCase() === path.toUpperCase())
        if (!found?.filePath) throw new Error(t('exigences.wf.notFound', { id: path }))
        path = found.filePath
      }
      const requirement = await current.store.load(path)
      if (!requirement) throw new Error(t('exigences.wf.notFound', { id: path }))
      const done: string[] = []
      for (const lang of translationTargets(current, requirement.sourceLang)) {
        const outcome = await translateRequirement({ ...current, ui, notifier }, client, path, { lang, quiet: true, date: today() })
        if (outcome === 'failed') throw new Error(t('exigences.wf.translateFailed', { lang: lang.toUpperCase() }))
        if (outcome === 'translated') done.push(lang.toUpperCase())
      }
      return { lines: [done.length ? t('exigences.wf.translated', { path: link(path), langs: done.join(', ') }) : t('exigences.ai.translate.noTarget')], paths: [path], results: { path, link: link(path) } }
    }
  })

  // ── Les workflows système des exigences ──
  registerSystemWorkflow({
    id: 'sys.exigences.qualite-hebdo',
    moduleKey: 'exigences.name',
    enabledByDefault: false,
    make: (tr) => ({
      name: tr('exigences.sys.qualite-hebdo'),
      mode: 'auto',
      trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' },
      conditions: [],
      actions: [
        { kind: 'exigences.qualite', fields: {} },
        { kind: 'notifier', fields: { message: tr('exigences.wf.template.weekly.message') } }
      ] as WorkflowAction[]
    })
  })
  registerSystemWorkflow({
    id: 'sys.exigences.traduire-nouvelles',
    moduleKey: 'exigences.name',
    enabledByDefault: false,
    make: (tr) => ({
      name: tr('exigences.sys.traduire-nouvelles'),
      mode: 'auto',
      trigger: { kind: TRIGGER_CREATED },
      conditions: [],
      actions: [{ kind: 'exigences.traduire', fields: { exigence: '{chemin}' } }]
    })
  })
  registerSystemWorkflow({
    id: 'sys.exigences.controle-import',
    moduleKey: 'exigences.name',
    enabledByDefault: true,
    make: (tr) => ({ name: tr('exigences.sys.controle-import'), mode: 'auto', trigger: { kind: TRIGGER_IMPORTED }, conditions: [], actions: [{ kind: 'exigences.controle-import', fields: {} }] })
  })
  registerSystemWorkflow({
    id: 'sys.exigences.traductions-hebdo',
    moduleKey: 'exigences.name',
    enabledByDefault: false,
    make: (tr) => ({
      name: tr('exigences.sys.traductions-hebdo'),
      mode: 'auto',
      trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' },
      conditions: [],
      actions: [{ kind: 'exigences.traductions-retard', fields: {} }]
    })
  })
  registerSystemWorkflow({
    id: 'sys.exigences.relire-nouvelles',
    moduleKey: 'exigences.name',
    enabledByDefault: false,
    make: (tr) => ({ name: tr('exigences.sys.relire-nouvelles'), mode: 'auto', trigger: { kind: TRIGGER_CREATED }, conditions: [], actions: [{ kind: 'exigences.relire', fields: { exigence: '{chemin}' } }] })
  })
}
