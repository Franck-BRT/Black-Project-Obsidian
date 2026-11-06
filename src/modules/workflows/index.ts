// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module Workflows — automatiser : quand ceci arrive, si cela tient, faire ceci.
 *
 * Un workflow a un **déclencheur** (à la main, à heure fixe, ou un évènement d'un module :
 * des pièces importées dans une analyse, une exigence créée), des **conditions** sur ce qui
 * est arrivé, et des **actions** à la suite (relever le calendrier, analyser la qualité,
 * interroger le dossier avec l'IA, écrire une note, prévenir). Exécuté seul ou après
 * accord ; chaque exécution écrite dans un journal du coffre.
 *
 * Les modules déclarent leurs déclencheurs, leurs actions et des workflows prêts à
 * l'emploi par `registerTrigger`, `registerAction`, `registerTemplate`, et signalent ce
 * qui arrive par `emitWorkflowEvent` : sans ce module actif, ces appels ne font rien.
 *
 * Repris de la version complète de Black Projects (modèle, conditions, variables,
 * planification, échange), rendu ouvert aux modules.
 */

import { fillTemplate } from '../../core/docs'
import type { BlackModule, ModuleContext, ModuleDetails, ModuleFeature, TextField } from '../../core/modules/module'
import { cleanFolder } from '../../core/settings'
import { registerBuiltins } from './builtins'
import page from './doc/Workflows.md'
import { WorkflowEngine } from './engine'
import { browseWorkflows, createWorkflow, exportToFile, importFromFile, openJournal, pickAndRun, type Session } from './flows'
import { workflowsEn, workflowsFr } from './i18n'
import { registerWorkflowsHome } from './home'
import type { Subject, Workflow } from './model'

// ── Interface publique ────────────────────────────────────────────────────────────
export { registerAction, registerTemplate, registerTrigger, type ActionField, type ActionOutcome, type ActionRun, type ActionSpec, type TemplateSpec, type TriggerSpec } from './registry'
export { MANUAL, NO_SUBJECT, SCHEDULE, type Subject, type Workflow, type WorkflowAction, type WorkflowCondition } from './model'

export const WORKFLOWS = 'workflows'
export const WORKFLOWS_KEY = 'workflows'
export const FOLDER_KEY = 'dossier'
export const DEFAULT_FOLDER = 'Black Projects/Workflows'

/** Vérifier les workflows planifiés toutes les minutes. */
const TICK = 60_000

let engine: WorkflowEngine | null = null
let session: Session | null = null

/**
 * Signale ce qui vient d'arriver : les workflows qui y répondent s'exécutent. Sans le
 * module Workflows actif, ne fait rien. Ne lève jamais : un workflow qui échoue est dit
 * à l'utilisateur et écrit dans le journal, il ne casse pas ce qui l'a déclenché.
 */
export async function emitWorkflowEvent(trigger: string, subject: Subject): Promise<void> {
  if (!engine) return
  try {
    await engine.emit({ trigger, subject })
  } catch (error) {
    console.error('[Black Projects] workflows', error)
  }
}

/** Exécute les workflows planifiés dont l'heure est venue (la minuterie le fait ; les tests aussi). */
export async function runDueWorkflows(): Promise<void> {
  await engine?.tick()
}

const readWorkflows = (settings: Readonly<Record<string, unknown>>): Workflow[] => {
  const stored = settings[WORKFLOWS_KEY]
  return Array.isArray(stored) ? (stored as Workflow[]).map((workflow) => ({ ...workflow, conditions: workflow.conditions ?? [], actions: workflow.actions ?? [] })) : []
}

const folderField: TextField = {
  kind: 'text',
  key: FOLDER_KEY,
  nameKey: 'workflows.setting.folder',
  descKey: 'workflows.setting.folder.desc',
  tooltipKey: 'workflows.setting.folder.tip',
  defaultValue: DEFAULT_FOLDER,
  normalize: cleanFolder
}

const feature = (key: string, status: ModuleFeature['status'], step?: number): ModuleFeature => ({
  labelKey: `workflows.feature.${key}`,
  noteKey: `workflows.feature.${key}.note`,
  status,
  ...(step === undefined ? {} : { step })
})

export function workflowsFeatures(): ModuleDetails {
  return {
    titleKey: 'workflows.details.title',
    introKey: 'workflows.details.intro',
    sections: [
      {
        titleKey: 'workflows.feature.section.rules',
        features: [feature('triggers', 'available'), feature('conditions', 'available'), feature('actions', 'available'), feature('variables', 'available')]
      },
      {
        titleKey: 'workflows.feature.section.run',
        features: [feature('ask', 'available'), feature('schedule', 'available'), feature('journal', 'available'), feature('loop', 'available')]
      },
      {
        titleKey: 'workflows.feature.section.share',
        features: [feature('templates', 'available'), feature('exchange', 'available'), feature('modules', 'available')]
      },
      {
        titleKey: 'workflows.feature.section.next',
        features: [feature('wait', 'in-progress', 7), feature('loopEach', 'in-progress', 7), feature('mail', 'planned')]
      }
    ]
  }
}

export const workflowsModule: BlackModule = {
  id: WORKFLOWS,
  nameKey: 'workflows.name',
  descriptionKey: 'workflows.description',
  version: '0.2.0',
  requires: [],
  texts: { fr: workflowsFr, en: workflowsEn },
  details: () => workflowsFeatures(),
  settingsFields: [folderField],
  docs: ({ folder }) => [{ path: 'Modules/Workflows.md', content: fillTemplate(page, folder) }],
  activate(context: ModuleContext) {
    const { platform, settings, i18n, commands } = context
    const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
    registerBuiltins(() => platform.fs)
    const folder = () => {
      const stored = settings.get()[FOLDER_KEY]
      return typeof stored === 'string' && stored.trim() ? cleanFolder(stored) : DEFAULT_FOLDER
    }
    const load = () => readWorkflows(settings.get())
    const save = (workflows: Workflow[]) => settings.save({ ...settings.get(), [WORKFLOWS_KEY]: workflows })
    const now = () => new Date()
    engine = new WorkflowEngine({ fs: platform.fs, ui: platform.ui, notifier: platform.notifier, t, now, load, save, folder })
    const current: Session = { ui: platform.ui, notifier: platform.notifier, fs: platform.fs, t, engine, load, save, folder, now }
    session = current

    commands.register({ id: 'liste', nameKey: 'workflows.command.list', run: () => browseWorkflows(current) })
    commands.register({ id: 'nouveau', nameKey: 'workflows.command.new', run: async () => void (await createWorkflow(current)) })
    commands.register({ id: 'executer', nameKey: 'workflows.command.run', run: () => pickAndRun(current) })
    commands.register({ id: 'journal', nameKey: 'workflows.command.journal', run: () => openJournal(current) })
    commands.register({ id: 'exporter', nameKey: 'workflows.command.export', run: async () => void (await exportToFile(current)) })
    commands.register({ id: 'importer', nameKey: 'workflows.command.import', run: async () => void (await importFromFile(current)) })

    // L'accueil : les dernières exécutions.
    registerWorkflowsHome(context.views, {
      t,
      fs: platform.fs,
      folder,
      load,
      run: async (id) => {
        await context.commands.run?.(id)
      },
      openJournal: () => openJournal(current)
    })

    // Les workflows planifiés : à l'ouverture, puis toutes les minutes.
    context.timers?.every(TICK, () => void engine?.tick())
  },
  deactivate() {
    engine = null
    session = null
  }
}

/** La session des fenêtres, pour les tests. */
export const workflowsSession = (): Session | null => session
