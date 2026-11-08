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
import { registerUpkeep } from './upkeep'
import page from './doc/Workflows.md'
import { WorkflowEngine } from './engine'
import {
  addAction,
  addCondition,
  browseWorkflows,
  createWorkflow,
  deleteWorkflow,
  describeAction,
  describeCondition,
  describeTrigger,
  duplicateWorkflow,
  editAction,
  editGeneral,
  editWorkflow,
  exportToFile,
  importFromFile,
  localStamp,
  moveAction,
  openJournal,
  pickAndRun,
  removeAction,
  removeCondition,
  runByHand,
  setEnabled,
  type Session
} from './flows'
import { workflowsEn, workflowsFr } from './i18n'
import { JOURNAL_PAGE, lastRunLine, openWorkflows, registerWorkflowsHome, runPageOf, WORKFLOW_PAGE, WORKFLOWS_PAGE } from './home'
import { pageWith } from '../../core/views'
import { allSystemWorkflows, systemWorkflowSpec, triggerSpec, whenSystemDeclared } from './registry'
import { NO_SUBJECT, OPENING, type Subject, type Workflow } from './model'
import { restoreSystem, seedSystem, systemOrigin, systemState, usable } from './system'

// ── Interface publique ────────────────────────────────────────────────────────────
export {
  forgetDeclarations,
  registerAction,
  registerSystemWorkflow,
  registerTemplate,
  registerTrigger,
  type ActionField,
  type ActionOutcome,
  type ActionRun,
  type ActionSpec,
  type SystemWorkflowSpec,
  type TemplateSpec,
  type TriggerSpec
} from './registry'
export { MANUAL, NO_SUBJECT, OPENING, SCHEDULE, type Subject, type Workflow, type WorkflowAction, type WorkflowCondition, type WorkflowTrigger } from './model'

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

/** Exécute les workflows « À l'ouverture » (la première minuterie le fait ; les tests aussi). */
export async function runOpeningWorkflows(): Promise<void> {
  await engine?.emit({ trigger: OPENING, subject: NO_SUBJECT })
}

/** Le module Workflows est-il actif (ses workflows système font alors ce que d'autres feraient en dur) ? */
export const systemWorkflowsActive = (): boolean => engine !== null

/** Un workflow s'exécute-t-il en ce moment ? (Ce qui est émis pendant ce temps passe après lui, sans être attendu.) */
export const workflowRunning = (): boolean => engine?.busy ?? false

/**
 * Un automatisme est-il confié à son workflow système : le module Workflows actif, le
 * workflow présent — activé ou non (désactivé, l'automatisme ne se fait plus : c'est le
 * choix de l'utilisateur). Sinon, le module qui l'a déclaré le fait lui-même.
 */
export function systemWorkflowManages(id: string): boolean {
  if (!engine || !session) return false
  return session.load().some((workflow) => workflow.system === id)
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
  version: '0.15.0',
  requires: [],
  texts: { fr: workflowsFr, en: workflowsEn },
  details: () => workflowsFeatures(),
  settingsFields: [folderField],
  docs: ({ folder }) => [{ path: 'Modules/Workflows.md', content: fillTemplate(page, folder) }],
  async activate(context: ModuleContext) {
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

    // Les workflows système : créés ou mis à jour à l'activation, puis à chaque module qui en déclare.
    let seeding: Promise<void> = Promise.resolve()
    const seed = () => {
      seeding = seeding
        .then(async () => {
          const next = seedSystem(load(), allSystemWorkflows(), t, now())
          if (next.changed) await save(next.workflows)
        })
        .catch((error: unknown) => console.error('[Black Projects] workflows système', error))
      return seeding
    }
    // L'entretien des workflows : ses propres workflows système (cassés, bilan, archive du journal).
    registerUpkeep({ fs: platform.fs, t, folder, load, now })
    whenSystemDeclared(() => void seed())
    await seed()

    const showPage = context.showPage ? (id: string) => context.showPage?.(id) : undefined
    // Les workflows du dernier import (tant que le module est actif), pour la liste.
    let lastImported: string[] = []
    // La page des workflows quand la plateforme en a une ; sinon la liste en fenêtre.
    commands.register({ id: 'liste', nameKey: 'workflows.command.list', run: () => openWorkflows(showPage, () => browseWorkflows(current)) })
    commands.register({ id: 'nouveau', nameKey: 'workflows.command.new', run: async () => void (await createWorkflow(current)) })
    commands.register({ id: 'executer', nameKey: 'workflows.command.run', run: () => pickAndRun(current) })
    // Le journal : en page quand la plateforme en a une ; sinon sa note.
    commands.register({ id: 'journal', nameKey: 'workflows.command.journal', run: async () => (context.showPage ? context.showPage(JOURNAL_PAGE) : openJournal(current)) })
    commands.register({ id: 'exporter', nameKey: 'workflows.command.export', run: async () => void (await exportToFile(current)) })
    commands.register({ id: 'importer', nameKey: 'workflows.command.import', run: async () => void (await importFromFile(current)) })

    // L'accueil : les dernières exécutions.
    registerWorkflowsHome(context.views, {
      t,
      fs: platform.fs,
      folder,
      // Ceux d'un module désactivé (ses workflows système) ne se montrent pas.
      load: () => load().filter(usable),
      run: async (id) => {
        await context.commands.run?.(id)
      },
      openJournal: () => openJournal(current),
      // Le sujet d'une exécution, les notes qu'elle a écrites : leur page quand un module en a une.
      openNote: (path) => (context.showNote ? context.showNote(path) : platform.ui.openNote(path)),
      ...(showPage
        ? {
            showPage,
            create: () => createWorkflow(current, { open: false }),
            // Importés : un seul, sa fiche ; plusieurs, la liste, eux en tête et marqués.
            imports: {
              async run() {
                const imported = await importFromFile(current)
                if (!imported.length) return
                lastImported = imported.map((each) => each.id)
                showPage(imported.length === 1 ? pageWith(WORKFLOW_PAGE, imported[0]!.id) : WORKFLOWS_PAGE)
              },
              last: () => lastImported
            }
          }
        : {}),
      page: {
        t,
        load: () => load().filter(usable),
        system: (workflow) => {
          const spec = workflow.system ? systemWorkflowSpec(workflow.system) : undefined
          const state = systemState(workflow, t)
          const origin = systemOrigin(workflow, t)
          if (!spec || !state || !origin) return null
          return {
            moduleName: t(spec.moduleKey),
            state,
            origin: {
              name: origin.name,
              trigger: describeTrigger(origin.trigger, t),
              conditions: origin.conditions.map((condition, index) => describeCondition(condition, origin.trigger.kind, t, index === 0)),
              actions: origin.actions.map((action) => describeAction(action, t))
            }
          }
        },
        describeTrigger: (workflow) => describeTrigger(workflow.trigger, t),
        describeActions: (workflow) => workflow.actions.map((action) => describeAction(action, t)),
        stamp: (iso) => localStamp(new Date(iso)),
        // Avec des pages, un workflow s'ouvre en fiche ; sinon, la fiche en fenêtre.
        edit: async (id) => (showPage ? showPage(pageWith(WORKFLOW_PAGE, id)) : editWorkflow(current, id)),
        // Lancé de l'interface : l'exécution faite, sa page (ce qu'elle a fait, écrit, ou pourquoi elle a échoué).
        runNow: async (id) => {
          const workflow = load().find((each) => each.id === id)
          if (!workflow) return
          const journal = { t, fs: platform.fs, folder }
          const before = await lastRunLine(journal, workflow.name)
          await runByHand(current, workflow)
          const after = await lastRunLine(journal, workflow.name)
          if (showPage && after && after !== before) showPage(runPageOf(after))
        },
        setEnabled: (id, enabled) => setEnabled(current, id, enabled),
        fiche: {
          describeCondition: (workflow, index) => describeCondition(workflow.conditions[index]!, workflow.trigger.kind, t, index === 0),
          canCondition: (workflow) => (triggerSpec(workflow.trigger.kind)?.fields ?? []).length > 0,
          editGeneral: (id) => editGeneral(current, id),
          addCondition: (id) => addCondition(current, id),
          removeCondition: (id, index) => removeCondition(current, id, index),
          addAction: (id) => addAction(current, id),
          editAction: (id, index) => editAction(current, id, index),
          moveAction: (id, index, delta) => moveAction(current, id, index, delta),
          removeAction: (id, index) => removeAction(current, id, index),
          duplicate: (id) => duplicateWorkflow(current, id),
          // Un workflow système modifié : le remettre à l'origine, après confirmation.
          restore: async (id) => {
            const workflow = load().find((each) => each.id === id)
            if (!workflow?.system) return false
            const sure = await platform.ui.confirm({
              title: t('workflows.system.restore.title'),
              message: t('workflows.system.restore.message', { name: workflow.name }),
              confirm: t('workflows.system.restore'),
              cancel: t('workflows.cancel')
            })
            if (!sure) return false
            await save(load().map((each) => (each.id === id ? restoreSystem(each, t) : each)))
            platform.notifier.notify(t('workflows.system.restored', { name: restoreSystem(workflow, t).name }), 6000)
            return true
          },
          remove: (id) => deleteWorkflow(current, id)
        }
      }
    })

    // Les workflows planifiés : à l'ouverture, puis toutes les minutes.
    // À la première, ceux « À l'ouverture » (l'interface est prête), puis les planifiés.
    let opened = false
    context.timers?.every(TICK, async () => {
      if (!opened) {
        opened = true
        await engine?.emit({ trigger: OPENING, subject: NO_SUBJECT })
      }
      await engine?.tick()
    })
  },
  deactivate() {
    whenSystemDeclared(null)
    engine = null
    session = null
  }
}

/** La session des fenêtres, pour les tests. */
export const workflowsSession = (): Session | null => session
