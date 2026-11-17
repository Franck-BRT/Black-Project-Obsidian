// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les automatismes de la bibliothèque, écrits en **workflows système** — modifiables, non
 * supprimables :
 *
 * - **Ranger les fichiers et pièces importés** (activé) : tout ce qu'un module dépose — les
 *   pièces d'une analyse, le fichier d'un import d'exigences, un échange de types de pièces
 *   ou de workflows (l'ancien « Ranger les pièces importées » y est fondu) ;
 * - **Repérer les nouvelles versions probables** (activé) : une fois par versement ;
 * - **Rappels de la bibliothèque, chaque lundi** (activé) : une étape par rappel — documents à
 *   contrôler, versions et langues à confirmer, documents sans type de pièce, fichiers
 *   introuvables —, chacune muette s'il n'y a rien à dire ;
 * - **Proposer un fantôme d'un document déjà là** (activé) : déposé soi-même dans un lieu
 *   de la bibliothèque, un document qui y est déjà ailleurs — une fenêtre propose de ne
 *   rien faire, ou de laisser ici un fantôme.
 *
 * Un dépôt passe par le déclencheur « Fichiers déposés dans l'application » : ses fichiers
 * (leurs octets ne voyagent pas dans les variables) attendent ici, sous un identifiant, que
 * l'action « Ranger dans la bibliothèque » les verse. Couper le workflow, c'est ne plus
 * ranger ces fichiers-là.
 */

import type { Ui } from '../../core/ports'
import { OPENING, registerAction, registerSystemWorkflow, registerTrigger, SCHEDULE, type Subject, type WorkflowAction, type WorkflowCondition, type WorkflowTrigger } from '../workflows'
import type { DocOrigin, LibraryDoc } from './model'
import type { LibraryStore, PourItem, PourOptions, PourReport } from './store'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Des fichiers reçus par un module : le déclencheur. */
export const TRIGGER_DEPOSITED = 'bibliotheque.fichiers-deposes'
/** Un versement a fait entrer de nouveaux documents (une fois pour tous) : le déclencheur. */
export const TRIGGER_BATCH = 'bibliotheque.versement'
/** Un document déposé (soi-même, dans un lieu) qui est déjà dans la bibliothèque, ailleurs : le déclencheur. */
export const TRIGGER_KNOWN = 'bibliotheque.document-deja-la'

/** Ranger les fichiers importés (pièces d'analyse comprises) : un seul workflow, depuis 0.136.3. */
export const SYS_FILES = 'sys.bibliotheque.ranger-fichiers'
/** L'ancien « Ranger les pièces importées », fondu dans « Ranger les fichiers importés ». */
const SYS_PIECES_RETIRED = 'sys.bibliotheque.ranger-pieces'
export const SYS_VERSIONS = 'sys.bibliotheque.nouvelles-versions'
/** Les rappels du lundi de la bibliothèque, en un seul workflow (depuis 0.136.5). */
export const SYS_MONDAY = 'sys.bibliotheque.rappels-lundi'
/** Les cinq rappels du lundi d'avant, fondus dans `SYS_MONDAY`. */
const MONDAY_RETIRED = ['rappel-a-controler', 'versions-a-confirmer', 'langues-a-confirmer', 'a-classer', 'fichiers-introuvables'].map((id) => `sys.bibliotheque.${id}`)
export const SYS_GHOST = 'sys.bibliotheque.fantome'


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
export function depositSubject(id: string, items: readonly PourItem[], origin: DocOrigin, reading?: (name: string) => { extension: string; read: boolean }): Subject {
  const names = items.map((item) => item.name)
  // Les extensions (une fois chacune) et les fichiers que l'application ne lit pas.
  const read = reading ? names.map((name) => ({ name, ...reading(name) })) : []
  const extensions = [...new Set(read.map((each) => each.extension).filter(Boolean))]
  const unread = read.filter((each) => !each.read).map((each) => each.name)
  return {
    key: id,
    label: origin.label,
    path: origin.link ?? '',
    vars: { depot: id, origine: origin.module, libelle: origin.label, fichiers: names.join(', '), nombre: String(names.length), extensions: extensions.join(', '), nonlisibles: unread.join(', ') },
    lists: { fichiers: names, extensions, nonlisibles: unread }
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
  /**
   * Proposer (une fenêtre : ne rien faire, ou placer ici un fantôme) — ou placer d'office —
   * un fantôme d'un document dans un dossier. Rend la note du fantôme, ou `null`.
   */
  offerGhost(record: string, folder: string, ask: boolean, ui: Ui): Promise<string | null>
  /** Le circuit des documents : relancer ceux qui s'y sont arrêtés (rend combien) ; ceux qui attendent d'être contrôlés. */
  relaunchCircuit(): Promise<number>
  toControl(): Promise<LibraryDoc[]>
  /** Les entreprises et personnes proposées à créer (leur nom), en attente. */
  pendingEntities?(): Promise<string[]>
  /** L'entretien des liens des documents (le circuit, version C). */
  maintainLinks(): Promise<{ dropped: number; restored: number; docs: string[] }>
}

/** Le sujet d'un document déjà là : lui, où il est rangé, et le lieu où on l'a déposé. */
export function knownSubject(doc: LibraryDoc, folder: string, where: { range: string; ici: string }, origin: DocOrigin, reading: Record<string, string>): Subject {
  return {
    key: `${doc.record}>${folder}`,
    label: doc.title,
    path: doc.record,
    vars: { titre: doc.title, fichier: doc.file, fiche: doc.record, range: where.range, ici: where.ici, dossier: folder, origine: origin.module, ...reading },
    lists: {}
  }
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
    fields: vars(['origine', 'libelle', 'fichiers', 'nombre', 'extensions', 'nonlisibles', 'depot'])
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
    id: 'bibliotheque.langues-a-confirmer',
    labelKey: 'bibliotheque.wf.action.languages',
    descKey: 'bibliotheque.wf.action.languages.desc',
    fields: [],
    results: ['text'],
    async run({ notifier }) {
      const pending = (await store.all()).filter((doc) => doc.languageToConfirm).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
      if (!pending.length) {
        const text = t('bibliotheque.wf.languages.none')
        return { lines: [text], results: { text } }
      }
      const text = t('bibliotheque.wf.languages.found', { count: pending.length, titles: someTitles(pending) })
      notifier.notify(text, 15000)
      return { lines: [text], paths: pending.map((doc) => doc.record), results: { text } }
    }
  })

  // ── Le circuit des documents : relancer, rappeler ce qui est à contrôler ──
  registerAction({
    id: 'bibliotheque.relancer-circuit',
    labelKey: 'bibliotheque.wf.action.relaunch',
    descKey: 'bibliotheque.wf.action.relaunch.desc',
    fields: [],
    results: ['text'],
    async run() {
      const count = await deps.relaunchCircuit()
      const text = t(count ? 'bibliotheque.wf.relaunch.done' : 'bibliotheque.wf.relaunch.none', { count })
      return { lines: [text], results: { text } }
    }
  })
  registerAction({
    id: 'bibliotheque.rappel-a-controler',
    labelKey: 'bibliotheque.wf.action.toControl',
    descKey: 'bibliotheque.wf.action.toControl.desc',
    fields: [],
    results: ['text'],
    async run({ notifier }) {
      const pending = (await deps.toControl()).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
      // Et les entreprises et personnes que l'analyse propose de créer.
      const entities = [...new Set((await deps.pendingEntities?.()) ?? [])]
      if (!pending.length && !entities.length) {
        const text = t('bibliotheque.wf.toControl.none')
        return { lines: [text], results: { text } }
      }
      const text = [
        ...(pending.length ? [t('bibliotheque.wf.toControl.found', { count: pending.length, titles: someTitles(pending) })] : []),
        ...(entities.length ? [t('bibliotheque.wf.toControl.entities', { count: entities.length, names: entities.slice(0, 5).join(', ') + (entities.length > 5 ? '…' : '') })] : [])
      ].join(' ')
      notifier.notify(text, 15000)
      return { lines: [text], paths: pending.map((doc) => doc.record), results: { text } }
    }
  })

  registerAction({
    id: 'bibliotheque.entretien-liens',
    labelKey: 'bibliotheque.wf.action.links',
    descKey: 'bibliotheque.wf.action.links.desc',
    fields: [],
    results: ['text'],
    async run({ notifier }) {
      const done = await deps.maintainLinks()
      if (!done.dropped && !done.restored) {
        const text = t('bibliotheque.wf.links.none')
        return { lines: [text], results: { text } }
      }
      const text = t('bibliotheque.wf.links.done', { dropped: done.dropped, restored: done.restored })
      notifier.notify(text, 15000)
      return { lines: [text], paths: done.docs, results: { text } }
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

  registerTrigger({
    id: TRIGGER_KNOWN,
    labelKey: 'bibliotheque.wf.trigger.known',
    descKey: 'bibliotheque.wf.trigger.known.desc',
    fields: vars(['titre', 'fichier', 'range', 'ici', 'origine', 'extension', 'lisible', 'lecture', 'fiche', 'dossier'])
  })
  registerAction({
    id: 'bibliotheque.fantome',
    labelKey: 'bibliotheque.wf.action.ghost',
    descKey: 'bibliotheque.wf.action.ghost.desc',
    fields: [
      {
        key: 'quoi',
        labelKey: 'bibliotheque.wf.field.ghost.how',
        kind: 'choice',
        defaultValue: 'demander',
        options: [
          { value: 'demander', labelKey: 'bibliotheque.wf.ghost.ask' },
          { value: 'toujours', labelKey: 'bibliotheque.wf.ghost.always' }
        ]
      },
      { key: 'fiche', labelKey: 'bibliotheque.wf.field.ghost.record', kind: 'text', defaultValue: '{fiche}', required: true },
      { key: 'dossier', labelKey: 'bibliotheque.wf.field.ghost.folder', kind: 'text', defaultValue: '{dossier}', required: true }
    ],
    results: ['path'],
    async run({ fields, ui }) {
      const ghost = await deps.offerGhost(fields.fiche ?? '', fields.dossier ?? '', fields.quoi !== 'toujours', ui)
      const text = ghost ? t('bibliotheque.wf.ghost.done', { path: ghost }) : t('bibliotheque.wf.ghost.nothing')
      return { lines: [text], ...(ghost ? { paths: [ghost], results: { path: ghost } } : {}) }
    }
  })

  // ── Les workflows système de la bibliothèque ──
  // Les essentiels : ce sans quoi rien n'entre dans la bibliothèque, et le circuit des documents.
  const essential = new Set(['ranger-fichiers', 'depot', 'relancer-circuit', 'rappels-lundi'])
  const system = (id: string, enabledByDefault: boolean, trigger: WorkflowTrigger, actions: WorkflowAction[], conditions: WorkflowCondition[] = [], replaces: string[] = []) =>
    registerSystemWorkflow({
      id: `sys.bibliotheque.${id}`,
      moduleKey: 'bibliotheque.name',
      enabledByDefault,
      ...(essential.has(id) ? { essential: true } : {}),
      ...(replaces.length ? { replaces } : {}),
      make: (tr) => ({ name: tr(`bibliotheque.sys.${id}`), mode: 'auto', trigger, conditions, actions })
    })
  const pour: WorkflowAction[] = [{ kind: 'bibliotheque.verser', fields: { depot: '{depot}' } }]
  // Tout ce qu'un module dépose (pièces d'analyse, imports d'exigences, de types de pièces, de
  // workflows) : un seul workflow — « Ranger les pièces importées » y est fondu.
  system('ranger-fichiers', true, { kind: TRIGGER_DEPOSITED }, pour, [], [SYS_PIECES_RETIRED])
  system('nouvelles-versions', true, { kind: TRIGGER_BATCH }, [{ kind: 'bibliotheque.versions', fields: {} }])
  const inbox: WorkflowAction[] = [{ kind: 'bibliotheque.depot', fields: {} }]
  // Le dossier « À classer » : versé à l'ouverture et chaque jour à 8 h — un seul workflow (« à heure
  // fixe, et à l'ouverture ») ; les deux d'avant y sont fondus.
  system('depot', true, { kind: SCHEDULE, every: 'day', time: '08:00', atOpening: true }, inbox, [], ['sys.bibliotheque.depot-ouverture', 'sys.bibliotheque.depot-quotidien'])
  system('fantome', true, { kind: TRIGGER_KNOWN }, [{ kind: 'bibliotheque.fantome', fields: { quoi: 'demander', fiche: '{fiche}', dossier: '{dossier}' } }])
  // Le circuit des documents : ceux qui s'y sont arrêtés (IA coupée, Obsidian fermé) reprennent à l'ouverture.
  system('relancer-circuit', true, { kind: OPENING }, [{ kind: 'bibliotheque.relancer-circuit', fields: {} }])
  // Les rappels du lundi, en un seul workflow : une étape par rappel, chacune muette s'il n'y a
  // rien à dire (on retire une étape pour ne plus avoir ce rappel). Les cinq d'avant y sont fondus.
  system(
    'rappels-lundi',
    true,
    { kind: SCHEDULE, every: 'week', weekday: 1, time: '08:00' },
    ['bibliotheque.rappel-a-controler', 'bibliotheque.versions-a-confirmer', 'bibliotheque.langues-a-confirmer', 'bibliotheque.a-classer', 'bibliotheque.introuvables', 'bibliotheque.entretien-liens'].map((kind) => ({ kind, fields: {} })),
    [],
    MONDAY_RETIRED
  )
}
