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

import { TRIGGER_DEPOSITED } from '../bibliotheque'
import { registerAction, registerSystemWorkflow } from '../workflows'
import { isArchive } from './archive'
import { extensionOf } from './lecture'
import { isImage } from './readers/fileText'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const SYS_UNREAD = 'sys.lecture-fichiers.formats-non-lus'

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

export function registerLectureWorkflows(t: Translate, readable: (extension: string) => boolean): void {
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
