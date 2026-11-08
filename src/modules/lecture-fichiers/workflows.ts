// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le workflow système de la lecture de fichiers : **signaler les formats non lus** (activé
 * d'origine). Au dépôt de fichiers dans l'application (les pièces d'une analyse, un import),
 * ceux dont l'extension n'est lue par aucun lecteur — ni déclarée équivalente — sont dits,
 * avec où déclarer une extension équivalente. Les images (montrées, pas lues) et les
 * archives (ouvertes) ne sont pas signalées ; une liste d'extensions à taire se règle dans
 * l'action.
 *
 * Le déclencheur, « Fichiers déposés dans l'application », est celui de la bibliothèque de
 * documents : sans elle, ce workflow ne se déclenche pas.
 */

import type { FileSystem } from '../../core/ports'
import { TRIGGER_DEPOSITED } from '../bibliotheque'
import { registerAction, registerSystemWorkflow } from '../workflows'
import { isArchive } from './archive'
import { extensionOf } from './lecture'
import { isImage } from './readers/fileText'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const SYS_UNREAD = 'sys.lecture-fichiers.formats-non-lus'
export const SYS_UNREADABLE = 'sys.lecture-fichiers.illisibles'
export const SYS_NO_TEXT = 'sys.lecture-fichiers.sans-texte'
export const SYS_FORMATS = 'sys.lecture-fichiers.bilan-formats'
/** « Pièces importées » (analyse d'appels d'offres) : ses pièces illisibles, sans texte. */
const TRIGGER_IMPORTED = 'ao.pieces-importees'

const split = (text: string): string[] =>
  text
    .split(/\s*[,;\n]\s*/)
    .map((each) => each.trim())
    .filter(Boolean)

/** Les fichiers dont le format n'est pas lu : ni lecteur, ni équivalence, ni image, ni archive. */
export function unreadFiles(names: readonly string[], readable: (extension: string) => boolean, ignored: readonly string[] = []): string[] {
  const quiet = new Set(ignored.map((each) => each.replace(/^\./, '').toLowerCase()))
  return names.filter((name) => {
    const extension = extensionOf(name)
    return !quiet.has(extension) && !readable(extension) && !isImage(extension) && !isArchive(extension)
  })
}

/** Le bilan des formats d'un coffre : combien de fichiers lus, d'images, d'archives, de notes, et les extensions non lues. */
export interface FormatsReport {
  total: number
  notes: number
  read: number
  images: number
  archives: number
  unread: Map<string, number>
}

/** Parcourir le coffre (sans ses dossiers cachés : `.obsidian`, `.trash`…) et compter ses fichiers par format. */
export async function formatsOf(fs: FileSystem, readable: (extension: string) => boolean, ignored: readonly string[] = []): Promise<FormatsReport> {
  const quiet = new Set(ignored.map((each) => each.replace(/^\./, '').toLowerCase()))
  const report: FormatsReport = { total: 0, notes: 0, read: 0, images: 0, archives: 0, unread: new Map() }
  const walk = async (folder: string): Promise<void> => {
    const listing = await fs.list(folder)
    for (const path of listing.files) {
      const name = path.slice(path.lastIndexOf('/') + 1)
      if (name.startsWith('.')) continue
      report.total++
      const extension = extensionOf(name)
      if (extension === 'md') report.notes++
      else if (isImage(extension)) report.images++
      else if (isArchive(extension)) report.archives++
      else if (readable(extension)) report.read++
      else if (!quiet.has(extension)) report.unread.set(extension, (report.unread.get(extension) ?? 0) + 1)
    }
    for (const sub of listing.folders) if (!sub.slice(sub.lastIndexOf('/') + 1).startsWith('.')) await walk(sub)
  }
  await walk('')
  return report
}

export function registerLectureWorkflows(t: Translate, readable: (extension: string) => boolean, fs: () => FileSystem): void {
  registerAction({
    id: 'lecture-fichiers.formats-non-lus',
    labelKey: 'lecture-fichiers.wf.action.unread',
    descKey: 'lecture-fichiers.wf.action.unread.desc',
    fields: [
      { key: 'fichiers', labelKey: 'lecture-fichiers.wf.field.files', kind: 'text', defaultValue: '{fichiers}' },
      { key: 'ignorer', labelKey: 'lecture-fichiers.wf.field.ignore', kind: 'text', placeholderKey: 'lecture-fichiers.wf.field.ignore.placeholder', tooltipKey: 'lecture-fichiers.wf.field.ignore.tip' }
    ],
    results: ['text'],
    async run({ fields, subject, notifier }) {
      // Les noms du dépôt tels quels (un nom peut contenir une virgule) ; sinon le champ.
      const names = subject.lists.fichiers?.length && fields.fichiers === subject.vars.fichiers ? subject.lists.fichiers : split(fields.fichiers ?? '')
      const unread = unreadFiles(names, readable, split(fields.ignorer ?? ''))
      if (!unread.length) {
        const text = t('lecture-fichiers.wf.unread.none')
        return { lines: [text], results: { text } }
      }
      const extensions = [...new Set(unread.map((name) => extensionOf(name)))].map((extension) => (extension ? `.${extension}` : t('lecture-fichiers.wf.noExtension')))
      const text = t(subject.label ? 'lecture-fichiers.wf.unread.found.in' : 'lecture-fichiers.wf.unread.found', {
        count: unread.length,
        extensions: extensions.join(', '),
        names: unread.join(', '),
        where: subject.label
      })
      notifier.notify(`${text} ${t('lecture-fichiers.wf.unread.how')}`, 15000)
      return { lines: [text], results: { text } }
    }
  })

  // Les pièces d'une analyse qui n'ont pas pu être lues, ou sans texte : nommées, avec que faire.
  const named = (id: string, labelKey: string, defaultValue: string, found: string, how: string) =>
    registerAction({
      id,
      labelKey,
      descKey: `${labelKey}.desc`,
      fields: [{ key: 'pieces', labelKey: 'lecture-fichiers.wf.field.pieces', kind: 'text', defaultValue }],
      results: ['text'],
      async run({ fields, subject, notifier }) {
        const list = subject.lists[defaultValue.slice(1, -1)] ?? []
        const pieces = list.length && fields.pieces === list.join(', ') ? list : split(fields.pieces ?? '')
        if (!pieces.length) {
          const text = t('lecture-fichiers.wf.pieces.none')
          return { lines: [text], results: { text } }
        }
        const text = t(subject.label ? `${found}.in` : found, { count: pieces.length, names: pieces.join(', '), where: subject.label })
        notifier.notify(`${text} ${t(how)}`, 15000)
        return { lines: [text], results: { text } }
      }
    })
  named('lecture-fichiers.illisibles', 'lecture-fichiers.wf.action.unreadable', '{illisibles}', 'lecture-fichiers.wf.unreadable.found', 'lecture-fichiers.wf.unreadable.how')
  named('lecture-fichiers.sans-texte', 'lecture-fichiers.wf.action.noText', '{sanstexte}', 'lecture-fichiers.wf.noText.found', 'lecture-fichiers.wf.noText.how')

  registerAction({
    id: 'lecture-fichiers.bilan-formats',
    labelKey: 'lecture-fichiers.wf.action.formats',
    descKey: 'lecture-fichiers.wf.action.formats.desc',
    fields: [{ key: 'ignorer', labelKey: 'lecture-fichiers.wf.field.ignore', kind: 'text', placeholderKey: 'lecture-fichiers.wf.field.ignore.placeholder', tooltipKey: 'lecture-fichiers.wf.field.ignore.tip' }],
    results: ['text'],
    async run({ fields, notifier }) {
      const report = await formatsOf(fs(), readable, split(fields.ignorer ?? ''))
      const unread = [...report.unread].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      const unreadCount = unread.reduce((sum, [, count]) => sum + count, 0)
      const text = [
        t('lecture-fichiers.wf.formats.summary', { total: report.total, notes: report.notes, read: report.read, images: report.images, archives: report.archives, unread: unreadCount }),
        ...(unread.length
          ? [t('lecture-fichiers.wf.formats.unread', { list: unread.map(([extension, count]) => `${extension ? `.${extension}` : t('lecture-fichiers.wf.noExtension')} (${count})`).join(', ') }), t('lecture-fichiers.wf.unread.how')]
          : [])
      ].join(' ')
      notifier.notify(text, 15000)
      return { lines: [text], results: { text } }
    }
  })

  registerSystemWorkflow({
    id: SYS_UNREADABLE,
    moduleKey: 'lecture-fichiers.name',
    enabledByDefault: true,
    make: (tr) => ({
      name: tr('lecture-fichiers.sys.illisibles'),
      mode: 'auto',
      trigger: { kind: TRIGGER_IMPORTED },
      conditions: [{ field: 'illisibles', op: 'not-empty', value: '' }],
      actions: [{ kind: 'lecture-fichiers.illisibles', fields: { pieces: '{illisibles}' } }]
    })
  })
  registerSystemWorkflow({
    id: SYS_NO_TEXT,
    moduleKey: 'lecture-fichiers.name',
    enabledByDefault: false,
    make: (tr) => ({
      name: tr('lecture-fichiers.sys.sans-texte'),
      mode: 'auto',
      trigger: { kind: TRIGGER_IMPORTED },
      conditions: [{ field: 'sanstexte', op: 'not-empty', value: '' }],
      actions: [{ kind: 'lecture-fichiers.sans-texte', fields: { pieces: '{sanstexte}' } }]
    })
  })
  registerSystemWorkflow({
    id: SYS_FORMATS,
    moduleKey: 'lecture-fichiers.name',
    enabledByDefault: false,
    make: (tr) => ({
      name: tr('lecture-fichiers.sys.bilan-formats'),
      mode: 'auto',
      trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' },
      conditions: [],
      actions: [{ kind: 'lecture-fichiers.bilan-formats', fields: { ignorer: '' } }]
    })
  })

  registerSystemWorkflow({
    id: SYS_UNREAD,
    moduleKey: 'lecture-fichiers.name',
    enabledByDefault: true,
    make: (tr) => ({
      name: tr('lecture-fichiers.sys.formats-non-lus'),
      mode: 'auto',
      trigger: { kind: TRIGGER_DEPOSITED },
      conditions: [],
      actions: [{ kind: 'lecture-fichiers.formats-non-lus', fields: { fichiers: '{fichiers}', ignorer: '' } }]
    })
  })
}
