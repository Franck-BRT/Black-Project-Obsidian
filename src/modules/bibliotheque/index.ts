// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module Bibliothèque de documents — et sa **seule porte d'entrée**.
 *
 * Tout fichier déposé dans l'application y est rangé : les pièces importées dans une
 * analyse, le fichier d'où l'on importe des exigences, les échanges de types de pièces ou
 * de workflows, et ce qu'on y verse soi-même. Chaque document a sa fiche — une note : son
 * titre, sa famille, sa catégorie, sa référence et sa version, d'où il vient — ; un même
 * fichier n'y entre qu'une fois (son empreinte), et une nouvelle version d'un document est
 * reconnue à son nom, à relier d'un clic.
 *
 * Les autres modules versent par `pourIntoLibrary` : sans ce module actif, l'appel ne fait
 * rien. Voir README.md pour la maintenance.
 */

import { localToday } from '../../core/dates'
import { fillTemplate } from '../../core/docs'
import type { BlackModule, ModuleContext, ModuleDetails, ModuleFeature, TextField } from '../../core/modules/module'
import { cleanFolder } from '../../core/settings'
import { emitWorkflowEvent, NO_SUBJECT, registerTrigger, systemWorkflowManages, workflowRunning } from '../workflows'
import page from './doc/Bibliothèque.md'
import { docPageOf, registerLibraryHome } from './home'
import { bibliothequeEn, bibliothequeFr } from './i18n'
import { baseName, CATEGORIES, type DocOrigin, type LibraryDoc } from './model'
import { LibraryStore, type PourItem, type PourOptions, type PourReport } from './store'
import { batchSubject, depositSubject, dropDeposit, holdDeposit, registerLibraryWorkflows, SYS_FILES, SYS_PIECES, SYS_VERSIONS, TRIGGER_BATCH, TRIGGER_DEPOSITED, type Deposit } from './workflows'

// ── Interface publique ────────────────────────────────────────────────────────────
export type { DocOrigin, LibraryDoc } from './model'
export type { PourItem, PourOptions, PourReport } from './store'

export const BIBLIOTHEQUE = 'bibliotheque'
export const FOLDER_KEY = 'dossier'
export const DEFAULT_FOLDER = 'Bibliothèque'
/** Un document entré dans la bibliothèque : le déclencheur de workflow. */
export const TRIGGER_POURED = 'bibliotheque.document-verse'
export { SYS_FILES, SYS_MISSING, SYS_PIECES, SYS_VERSIONS, TRIGGER_BATCH, TRIGGER_DEPOSITED } from './workflows'

let active: { store: LibraryStore; t: (key: string, vars?: Record<string, string | number>) => string } | null = null

/**
 * Verser des fichiers dans la bibliothèque, avec leur origine (le module qui les a reçus,
 * ce qu'il en dit, un lien). Les fichiers du coffre y restent où ils sont ; ceux venus de
 * l'ordinateur y sont copiés. Un même fichier n'y entre qu'une fois. Sans le module actif,
 * ne fait rien (`null`). Ne lève pas : un fichier illisible est compté dans `failed`.
 *
 * Le module Workflows actif, un dépôt d'un autre module passe par ses workflows système
 * (« Ranger les pièces importées », « Ranger les fichiers importés ») : désactivés, les
 * fichiers ne sont pas rangés — `null`. Ce qu'on verse soi-même depuis la bibliothèque y
 * entre toujours.
 */
export async function pourIntoLibrary(items: readonly PourItem[], origin: DocOrigin, options: PourOptions = {}): Promise<PourReport | null> {
  if (!active || !items.length) return null
  try {
    if (origin.module !== BIBLIOTHEQUE && (systemWorkflowManages(SYS_PIECES) || systemWorkflowManages(SYS_FILES))) return await depositThroughWorkflows(items, origin, options)
    return await pourNow(items, origin, options, true)
  } catch (error) {
    console.error('[Black Projects] bibliothèque', error)
    return null
  }
}

/** Le dépôt confié aux workflows : ses fichiers attendent l'action « Ranger dans la bibliothèque ». */
async function depositThroughWorkflows(items: readonly PourItem[], origin: DocOrigin, options: PourOptions): Promise<PourReport | null> {
  // Déposé pendant qu'un workflow s'exécute : le dépôt passe après lui, sans être attendu.
  const awaited = !workflowRunning()
  const deposit: Deposit = { items, origin, options, awaited, report: null }
  const id = holdDeposit(deposit)
  await emitWorkflowEvent(TRIGGER_DEPOSITED, depositSubject(id, items, origin))
  if (!awaited) return null
  dropDeposit(id)
  if (deposit.report) await announce(deposit.report, origin)
  return deposit.report
}

/**
 * Verser maintenant. Les nouvelles versions probables : repérées à l'entrée, sauf quand leur
 * workflow système s'en charge (au versement annoncé). `announce` : dire les documents
 * entrés aux workflows — une fois pour le versement, puis un par document.
 */
async function pourNow(items: readonly PourItem[], origin: DocOrigin, options: PourOptions, toAnnounce: boolean): Promise<PourReport> {
  if (!active) return { added: [], already: [], failed: [] }
  const { store } = active
  const report = await store.pour(items, origin, { ...options, detectVersions: !systemWorkflowManages(SYS_VERSIONS) })
  if (toAnnounce) await announce(report, origin)
  return report
}

async function announce(report: PourReport, origin: DocOrigin): Promise<void> {
  if (!active || !report.added.length) return
  const { store, t } = active
  await emitWorkflowEvent(TRIGGER_BATCH, batchSubject(report.added, origin, t))
  // Son workflow a pu y repérer des versions : les fiches relues.
  report.added = await Promise.all(report.added.map(async (doc) => (await store.load(doc.record)) ?? doc))
  for (const doc of report.added) await emitPoured(doc)
}

/** Le module est-il actif (les autres modules le disent à l'utilisateur, au besoin) ? */
export const libraryActive = (): boolean => active !== null

async function emitPoured(doc: LibraryDoc): Promise<void> {
  await emitWorkflowEvent(TRIGGER_POURED, {
    ...NO_SUBJECT,
    key: doc.record,
    label: doc.title,
    path: doc.record,
    vars: { titre: doc.title, famille: doc.family, categorie: doc.category, fichier: doc.file, origine: doc.origins[0]?.module ?? '' }
  })
}

const folderField: TextField = {
  kind: 'text',
  key: FOLDER_KEY,
  nameKey: 'bibliotheque.setting.folder',
  descKey: 'bibliotheque.setting.folder.desc',
  tooltipKey: 'bibliotheque.setting.folder.tip',
  defaultValue: DEFAULT_FOLDER,
  normalize: cleanFolder
}

const feature = (key: string, status: ModuleFeature['status'], step?: number): ModuleFeature => ({
  labelKey: `bibliotheque.feature.${key}`,
  noteKey: `bibliotheque.feature.${key}.note`,
  status,
  ...(step === undefined ? {} : { step })
})

export function bibliothequeFeatures(): ModuleDetails {
  return {
    titleKey: 'bibliotheque.details.title',
    introKey: 'bibliotheque.details.intro',
    sections: [
      {
        titleKey: 'bibliotheque.feature.section.store',
        features: [feature('everything', 'available'), feature('dedup', 'available'), feature('versions', 'available'), feature('classify', 'available'), feature('origins', 'available')]
      },
      { titleKey: 'bibliotheque.feature.section.next', features: [feature('text', 'planned', 7), feature('delivery', 'planned', 7)] }
    ]
  }
}

const folderOf = (settings: Readonly<Record<string, unknown>>): string => {
  const stored = settings[FOLDER_KEY]
  return typeof stored === 'string' && stored.trim() ? cleanFolder(stored) : DEFAULT_FOLDER
}

export const bibliothequeModule: BlackModule = {
  id: BIBLIOTHEQUE,
  nameKey: 'bibliotheque.name',
  descriptionKey: 'bibliotheque.description',
  version: '0.2.0',
  requires: [],
  texts: { fr: bibliothequeFr, en: bibliothequeEn },
  details: () => bibliothequeFeatures(),
  settingsFields: [folderField],
  docs: ({ folder }) => [{ path: 'Modules/Bibliothèque.md', content: fillTemplate(page, folder) }],
  activate(context: ModuleContext) {
    const { platform, i18n, settings } = context
    const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
    const store = new LibraryStore({ fs: platform.fs, yaml: platform.yaml, folder: () => folderOf(settings.get()), today: localToday, notesHeading: () => t('bibliotheque.notes') })
    active = { store, t }
    const showPage = context.showPage ? (id: string) => context.showPage?.(id) : undefined
    const showNote = (path: string) => (context.showNote ? context.showNote(path) : platform.ui.openNote(path))

    registerTrigger({
      id: TRIGGER_POURED,
      labelKey: 'bibliotheque.wf.trigger.poured',
      descKey: 'bibliotheque.wf.trigger.poured.desc',
      fields: ['titre', 'famille', 'categorie', 'fichier', 'origine'].map((key) => ({ key, labelKey: `bibliotheque.wf.var.${key}` }))
    })
    registerLibraryWorkflows({ t, store, pourNow })

    /** Verser des documents soi-même : de l'ordinateur (copiés) ou du coffre (laissés à leur place). */
    const pour = async (): Promise<PourReport | null> => {
      const source = await platform.ui.pickOption(
        [
          { value: 'computer', label: t('bibliotheque.pour.computer'), description: t('bibliotheque.pour.computer.desc') },
          { value: 'vault', label: t('bibliotheque.pour.vault'), description: t('bibliotheque.pour.vault.desc') }
        ],
        t('bibliotheque.pour.from')
      )
      let items: PourItem[] = []
      if (source === 'computer') items = (await platform.ui.pickExternalFiles({ multiple: true })).map((file) => ({ name: file.name, bytes: file.bytes }))
      else if (source === 'vault') {
        const path = await platform.ui.pickFile({ placeholder: t('bibliotheque.pour.vault.pick') })
        if (path) items = [{ name: baseName(path), path }]
      }
      if (!items.length) return null
      const report = await pourIntoLibrary(items, { module: BIBLIOTHEQUE, label: t('bibliotheque.origin.hand') })
      if (report)
        platform.notifier.notify(
          [
            t('bibliotheque.pour.done', { added: report.added.length, already: report.already.length }),
            ...(report.failed.length ? [t('bibliotheque.pour.failed', { names: report.failed.join(', ') })] : []),
            ...(report.added.some((doc) => doc.likelyPrevious) ? [t('bibliotheque.pour.likely')] : [])
          ].join(' '),
          10000
        )
      return report
    }

    const classify = async (record: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const values = await platform.ui.askForm({
        title: t('bibliotheque.classify.title', { title: doc.title }),
        intro: t('bibliotheque.classify.intro'),
        fields: [
          { kind: 'text', key: 'title', label: t('bibliotheque.field.title'), value: doc.title, required: true },
          { kind: 'text', key: 'category', label: t('bibliotheque.field.category'), value: doc.category, description: t('bibliotheque.classify.categories', { list: CATEGORIES.map((each) => each.name).join(', ') }) },
          { kind: 'text', key: 'reference', label: t('bibliotheque.field.reference'), value: doc.reference, placeholder: 'CCTP-2026-118' },
          { kind: 'text', key: 'edition', label: t('bibliotheque.field.edition'), value: doc.edition, placeholder: '2' },
          { kind: 'text', key: 'revision', label: t('bibliotheque.field.revision'), value: doc.revision, placeholder: 'B' },
          { kind: 'text', key: 'issuer', label: t('bibliotheque.field.issuer'), value: doc.issuer },
          { kind: 'text', key: 'tags', label: t('bibliotheque.field.tags'), value: doc.tags.join(', '), description: t('bibliotheque.classify.tags') }
        ],
        submit: t('bibliotheque.classify.submit')
      })
      if (!values) return
      const tags = (values.tags ?? '')
        .split(',')
        .map((each) => each.trim())
        .filter(Boolean)
      await store.save({
        ...doc,
        title: (values.title ?? '').trim() || doc.title,
        category: (values.category ?? '').trim(),
        reference: (values.reference ?? '').trim(),
        edition: (values.edition ?? '').trim(),
        revision: (values.revision ?? '').trim(),
        issuer: (values.issuer ?? '').trim(),
        tags
      })
      platform.notifier.notify(t('bibliotheque.classify.done', { title: (values.title ?? '').trim() || doc.title }), 5000)
    }

    const newVersionOf = async (record: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const others = (await store.all()).filter((each) => each.record !== record && each.previous !== record).sort((a, b) => Number(b.family === doc.family) - Number(a.family === doc.family) || a.title.localeCompare(b.title, 'fr'))
      if (!others.length) {
        platform.notifier.notify(t('bibliotheque.newVersionOf.none'), 6000)
        return
      }
      const chosen = await platform.ui.pickOption(
        [
          ...others.map((each) => ({ value: each.record, label: each.title, description: [t(`bibliotheque.family.${each.family}`), each.category, each.added].filter(Boolean).join(' · ') })),
          ...(doc.previous ? [{ value: '', label: t('bibliotheque.newVersionOf.unlink'), description: t('bibliotheque.newVersionOf.unlink.desc') }] : [])
        ],
        t('bibliotheque.newVersionOf.pick', { title: doc.title })
      )
      if (chosen === null) return
      await store.relate(record, chosen)
      platform.notifier.notify(chosen ? t('bibliotheque.related', { title: doc.title }) : t('bibliotheque.unlinked', { title: doc.title }), 5000)
    }

    registerLibraryHome(context.views, {
      t,
      store,
      today: localToday,
      locale: i18n.language === 'en' ? 'en-GB' : 'fr-FR',
      ...(showPage ? { showPage } : {}),
      openFile: (path) => platform.ui.openNote(path),
      showNote,
      exists: (path) => platform.fs.exists(path),
      // Versés depuis l'interface : un seul nouveau document, sa fiche ; sinon la page se redessine.
      pour: async () => {
        const report = await pour()
        if (report?.added.length === 1 && report.already.length === 0) showPage?.(docPageOf(report.added[0]!.record))
      },
      classify,
      newVersionOf,
      relate: async (record, previous) => {
        const doc = await store.relate(record, previous)
        if (doc) platform.notifier.notify(t('bibliotheque.related', { title: doc.title }), 5000)
      },
      dismissLikely: (record) => store.dismissLikely(record),
      setAside: async (record) => {
        const doc = await store.load(record)
        if (!doc) return false
        const sure = await platform.ui.confirm({
          title: t('bibliotheque.setAside.title'),
          message: t(doc.copied ? 'bibliotheque.setAside.message.copied' : 'bibliotheque.setAside.message.inPlace', { title: doc.title }),
          confirm: t('bibliotheque.setAside'),
          cancel: t('bibliotheque.cancel'),
          danger: true
        })
        if (!sure) return false
        await store.setAside(record)
        platform.notifier.notify(t('bibliotheque.setAside.done', { title: doc.title }), 6000)
        return true
      }
    })

    context.commands.register({
      id: 'documents',
      nameKey: 'bibliotheque.command.open',
      run: async () => {
        if (showPage) showPage('bibliotheque.documents')
        else await platform.ui.openNote(store.root)
      }
    })
    context.commands.register({ id: 'verser', nameKey: 'bibliotheque.command.pour', run: async () => void (await pour()) })
  },
  deactivate() {
    active = null
  }
}
