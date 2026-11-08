// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les automatismes de la bibliothèque, écrits en **workflows système** — modifiables, non
 * supprimables :
 *
 * - **Ranger les pièces importées** (activé) : les pièces d'une analyse, à leur dépôt ;
 * - **Ranger les fichiers importés** (activé) : le fichier d'un import d'exigences, un
 *   échange de types de pièces ou de workflows ;
 * - **Repérer les nouvelles versions probables** (activé) : une fois par versement ;
 * - **Signaler les fichiers introuvables** (désactivé) : chaque lundi à 8 h.
 *
 * Un dépôt passe par le déclencheur « Fichiers déposés dans l'application » : ses fichiers
 * (leurs octets ne voyagent pas dans les variables) attendent ici, sous un identifiant, que
 * l'action « Ranger dans la bibliothèque » les verse. Couper le workflow, c'est ne plus
 * ranger ces fichiers-là.
 */

import { OPENING, registerAction, registerSystemWorkflow, registerTrigger, SCHEDULE, type Subject, type WorkflowAction, type WorkflowCondition, type WorkflowTrigger } from '../workflows'
import type { DocOrigin, LibraryDoc } from './model'
import type { LibraryStore, PourItem, PourOptions, PourReport } from './store'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Des fichiers reçus par un module : le déclencheur. */
export const TRIGGER_DEPOSITED = 'bibliotheque.fichiers-deposes'
/** Un versement a fait entrer de nouveaux documents (une fois pour tous) : le déclencheur. */
export const TRIGGER_BATCH = 'bibliotheque.versement'

export const SYS_PIECES = 'sys.bibliotheque.ranger-pieces'
export const SYS_FILES = 'sys.bibliotheque.ranger-fichiers'
export const SYS_VERSIONS = 'sys.bibliotheque.nouvelles-versions'
export const SYS_MISSING = 'sys.bibliotheque.fichiers-introuvables'

/** Le module dont les dépôts sont des pièces d'analyse. */
const PIECES_MODULE = 'ao'

/** Un dépôt en attente de son workflow. */
export interface Deposit {
  items: readonly PourItem[]
  origin: DocOrigin
  options: PourOptions
  /** Celui qui dépose attend la fin du workflow et annonce lui-même les documents versés. */
  awaited: boolean
  report: PourReport | null
}

/** Les dépôts en attente — peu nombreux : un dépôt qu'aucun workflow ne prend est oublié au-delà. */
const KEPT = 20
const deposits = new Map<string, Deposit>()
let counter = 0

export function holdDeposit(deposit: Deposit): string {
  const id = `${Date.now().toString(36)}-${++counter}`
  deposits.set(id, deposit)
  while (deposits.size > KEPT) deposits.delete(deposits.keys().next().value!)
  return id
}

export const dropDeposit = (id: string): void => void deposits.delete(id)

/** Le sujet d'un dépôt : ce que voit le workflow. */
export function depositSubject(id: string, items: readonly PourItem[], origin: DocOrigin): Subject {
  const names = items.map((item) => item.name)
  return {
    key: id,
    label: origin.label,
    path: origin.link ?? '',
    vars: { depot: id, origine: origin.module, libelle: origin.label, fichiers: names.join(', '), nombre: String(names.length) },
    lists: { fichiers: names }
  }
}

/** Le sujet d'un versement : ses nouveaux documents, ensemble. */
export function batchSubject(added: readonly LibraryDoc[], origin: DocOrigin, t: Translate): Subject {
  const titles = added.map((doc) => doc.title)
  return {
    key: added[0]?.record ?? '',
    label: t('bibliotheque.wf.batch', { count: added.length, label: origin.label }),
    path: added.length === 1 ? added[0]!.record : '',
    vars: { nombre: String(added.length), titres: titles.join(', '), origine: origin.module, libelle: origin.label },
    lists: { fiches: added.map((doc) => doc.record), titres: titles }
  }
}

export interface LibraryWorkflowDeps {
  t: Translate
  store: LibraryStore
  /** Verser maintenant (sans repasser par les workflows), et annoncer les documents versés si `announce`. */
  pourNow(items: readonly PourItem[], origin: DocOrigin, options: PourOptions, announce: boolean): Promise<PourReport>
  /** Verser le dossier de dépôt. */
  pourInbox(): Promise<PourReport>
}

/** Des titres, les dix premiers, puis « … ». */
const someTitles = (docs: readonly LibraryDoc[]): string => [...docs.slice(0, 10).map((doc) => doc.title), ...(docs.length > 10 ? ['…'] : [])].join(', ')

export function registerLibraryWorkflows(deps: LibraryWorkflowDeps): void {
  const { t, store } = deps
  const vars = (keys: readonly string[]) => keys.map((key) => ({ key, labelKey: `bibliotheque.wf.var.${key}` }))

  registerTrigger({
    id: TRIGGER_DEPOSITED,
    labelKey: 'bibliotheque.wf.trigger.deposited',
    descKey: 'bibliotheque.wf.trigger.deposited.desc',
    fields: vars(['origine', 'libelle', 'fichiers', 'nombre', 'depot'])
  })
  registerTrigger({
    id: TRIGGER_BATCH,
    labelKey: 'bibliotheque.wf.trigger.batch',
    descKey: 'bibliotheque.wf.trigger.batch.desc',
    fields: vars(['nombre', 'titres', 'origine', 'libelle'])
  })

  registerAction({
    id: 'bibliotheque.verser',
    labelKey: 'bibliotheque.wf.action.pour',
    descKey: 'bibliotheque.wf.action.pour.desc',
    fields: [{ key: 'depot', labelKey: 'bibliotheque.wf.field.depot', kind: 'text', defaultValue: '{depot}', required: true }],
    results: ['text'],
    async run({ fields }) {
      const deposit = deposits.get(fields.depot ?? '')
      if (!deposit) return { lines: [t('bibliotheque.wf.pour.none')] }
      // Pris une fois : un second workflow sur le même dépôt n'y trouve plus rien.
      deposits.delete(fields.depot ?? '')
      const report = await deps.pourNow(deposit.items, deposit.origin, deposit.options, !deposit.awaited)
      deposit.report = report
      const text = [
        t('bibliotheque.wf.pour.done', { added: report.added.length, already: report.already.length }),
        ...(report.failed.length ? [t('bibliotheque.wf.pour.failed', { names: report.failed.join(', ') })] : [])
      ].join(' ')
      return { lines: [text], paths: report.added.map((doc) => doc.record), results: { text } }
    }
  })

  registerAction({
    id: 'bibliotheque.versions',
    labelKey: 'bibliotheque.wf.action.versions',
    descKey: 'bibliotheque.wf.action.versions.desc',
    fields: [],
    results: ['text'],
    async run({ subject }) {
      const records = subject.lists.fiches ?? []
      if (!records.length) return { lines: [t('bibliotheque.wf.versions.nothing')] }
      const marked = await store.markLikelyVersions(records)
      const text = marked.length ? t('bibliotheque.wf.versions.found', { titles: marked.map((doc) => doc.title).join(', ') }) : t('bibliotheque.wf.versions.none')
      return { lines: [text], paths: marked.map((doc) => doc.record), results: { text } }
    }
  })

  registerAction({
    id: 'bibliotheque.introuvables',
    labelKey: 'bibliotheque.wf.action.missing',
    descKey: 'bibliotheque.wf.action.missing.desc',
    fields: [],
    results: ['text'],
    async run({ notifier }) {
      const missing = await store.missingFiles()
      if (!missing.length) {
        const text = t('bibliotheque.wf.missing.none')
        return { lines: [text], results: { text } }
      }
      const text = t('bibliotheque.wf.missing.found', { count: missing.length, titles: missing.map((doc) => doc.title).join(', ') })
      notifier.notify(text, 15000)
      return { lines: [text], paths: missing.map((doc) => doc.record), results: { text } }
    }
  })

  registerAction({
    id: 'bibliotheque.depot',
    labelKey: 'bibliotheque.wf.action.inbox',
    descKey: 'bibliotheque.wf.action.inbox.desc',
    fields: [],
    results: ['text'],
    async run({ notifier }) {
      const report = await deps.pourInbox()
      if (!report.added.length && !report.already.length && !report.failed.length) {
        const text = t('bibliotheque.wf.inbox.none', { folder: store.inbox })
        return { lines: [text], results: { text } }
      }
      const text = [
        t('bibliotheque.wf.inbox.done', { added: report.added.length, folder: store.inbox }),
        ...(report.already.length ? [t('bibliotheque.wf.inbox.already', { already: report.already.length })] : []),
        ...(report.failed.length ? [t('bibliotheque.wf.pour.failed', { names: report.failed.join(', ') })] : [])
      ].join(' ')
      notifier.notify(text, 10000)
      return { lines: [text], paths: report.added.map((doc) => doc.record), results: { text } }
    }
  })

  registerAction({
    id: 'bibliotheque.versions-a-confirmer',
    labelKey: 'bibliotheque.wf.action.pending',
    descKey: 'bibliotheque.wf.action.pending.desc',
    fields: [],
    results: ['text'],
    async run({ notifier }) {
      const pending = (await store.all()).filter((doc) => doc.likelyPrevious).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
      if (!pending.length) {
        const text = t('bibliotheque.wf.pending.none')
        return { lines: [text], results: { text } }
      }
      const text = t('bibliotheque.wf.pending.found', { count: pending.length, titles: someTitles(pending) })
      notifier.notify(text, 15000)
      return { lines: [text], paths: pending.map((doc) => doc.record), results: { text } }
    }
  })

  registerAction({
    id: 'bibliotheque.a-classer',
    labelKey: 'bibliotheque.wf.action.unclassified',
    descKey: 'bibliotheque.wf.action.unclassified.desc',
    fields: [],
    results: ['text'],
    async run({ notifier }) {
      const unclassified = (await store.all()).filter((doc) => !doc.category.trim()).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
      if (!unclassified.length) {
        const text = t('bibliotheque.wf.unclassified.none')
        return { lines: [text], results: { text } }
      }
      const text = t('bibliotheque.wf.unclassified.found', { count: unclassified.length, titles: someTitles(unclassified) })
      notifier.notify(text, 15000)
      return { lines: [text], paths: unclassified.map((doc) => doc.record), results: { text } }
    }
  })

  // ── Les workflows système de la bibliothèque ──
  const system = (id: string, enabledByDefault: boolean, trigger: WorkflowTrigger, actions: WorkflowAction[], conditions: WorkflowCondition[] = []) =>
    registerSystemWorkflow({
      id: `sys.bibliotheque.${id}`,
      moduleKey: 'bibliotheque.name',
      enabledByDefault,
      make: (tr) => ({ name: tr(`bibliotheque.sys.${id}`), mode: 'auto', trigger, conditions, actions })
    })
  const pour: WorkflowAction[] = [{ kind: 'bibliotheque.verser', fields: { depot: '{depot}' } }]
  system('ranger-pieces', true, { kind: TRIGGER_DEPOSITED }, pour, [{ field: 'origine', op: 'is', value: PIECES_MODULE }])
  system('ranger-fichiers', true, { kind: TRIGGER_DEPOSITED }, pour, [{ field: 'origine', op: 'is-not', value: PIECES_MODULE }])
  system('nouvelles-versions', true, { kind: TRIGGER_BATCH }, [{ kind: 'bibliotheque.versions', fields: {} }])
  system('fichiers-introuvables', false, { kind: SCHEDULE, every: 'week', weekday: 1, time: '08:00' }, [{ kind: 'bibliotheque.introuvables', fields: {} }])
  const inbox: WorkflowAction[] = [{ kind: 'bibliotheque.depot', fields: {} }]
  system('depot-ouverture', true, { kind: OPENING }, inbox)
  system('depot-quotidien', true, { kind: SCHEDULE, every: 'day', time: '08:00' }, inbox)
  system('versions-a-confirmer', false, { kind: SCHEDULE, every: 'week', weekday: 1, time: '08:00' }, [{ kind: 'bibliotheque.versions-a-confirmer', fields: {} }])
  system('a-classer', false, { kind: SCHEDULE, every: 'week', weekday: 1, time: '08:00' }, [{ kind: 'bibliotheque.a-classer', fields: {} }])
}
