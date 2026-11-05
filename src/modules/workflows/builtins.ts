// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que le module Workflows sait faire de lui-même : être lancé à la main ou à heure fixe,
 * prévenir, écrire une note ou ajouter à une note. Le reste vient des autres modules.
 */

import type { FileSystem } from '../../core/ports'
import { MANUAL, SCHEDULE } from './model'
import { registerAction, registerTrigger } from './registry'

const withMd = (path: string) => (path.toLowerCase().endsWith('.md') ? path : `${path}.md`)
const link = (path: string) => `[[${path.replace(/\.md$/, '')}]]`
/** Les caractères qu'un nom de fichier ne peut pas porter, par morceau de chemin. */
const safePath = (path: string) =>
  path
    .split('/')
    .map((part) => part.replace(/[\\:*?"<>|#^[\]]/g, '-').trim())
    .filter(Boolean)
    .join('/')

export function registerBuiltins(fs: () => FileSystem): void {
  registerTrigger({ id: MANUAL, labelKey: 'workflows.trigger.manuel', descKey: 'workflows.trigger.manuel.desc', fields: [] })
  registerTrigger({ id: SCHEDULE, labelKey: 'workflows.trigger.planifie', descKey: 'workflows.trigger.planifie.desc', fields: [] })

  registerAction({
    id: 'notifier',
    labelKey: 'workflows.action.notifier',
    descKey: 'workflows.action.notifier.desc',
    fields: [{ key: 'message', labelKey: 'workflows.field.message', kind: 'textarea', required: true, placeholderKey: 'workflows.field.message.placeholder' }],
    results: [],
    async run({ fields, notifier }) {
      notifier.notify(fields.message!, 10000)
      return { lines: [fields.message!] }
    }
  })

  registerAction({
    id: 'creer-note',
    labelKey: 'workflows.action.creer-note',
    descKey: 'workflows.action.creer-note.desc',
    fields: [
      { key: 'chemin', labelKey: 'workflows.field.path', kind: 'text', required: true, defaultValue: 'Black Projects/Workflows/{today} {workflow}', tooltipKey: 'workflows.field.path.tip' },
      { key: 'contenu', labelKey: 'workflows.field.content', kind: 'textarea', defaultValue: '# {workflow}\n\n' }
    ],
    results: ['path', 'link', 'text'],
    async run({ fields, t }) {
      const files = fs()
      const wanted = withMd(safePath(fields.chemin!))
      let path = wanted
      for (let n = 2; await files.exists(path); n++) path = wanted.replace(/\.md$/, ` (${n}).md`)
      await files.writeText(path, `${fields.contenu ?? ''}\n`)
      return { lines: [t('workflows.wrote', { path: link(path) })], paths: [path], results: { path, link: link(path), text: fields.contenu ?? '' } }
    }
  })

  registerAction({
    id: 'ajouter-note',
    labelKey: 'workflows.action.ajouter-note',
    descKey: 'workflows.action.ajouter-note.desc',
    fields: [
      { key: 'chemin', labelKey: 'workflows.field.path', kind: 'text', required: true, tooltipKey: 'workflows.field.path.tip' },
      { key: 'texte', labelKey: 'workflows.field.text', kind: 'textarea', required: true, defaultValue: '- {now} : ' },
      {
        key: 'position',
        labelKey: 'workflows.field.where',
        kind: 'choice',
        defaultValue: 'fin',
        options: [
          { value: 'fin', labelKey: 'workflows.field.where.end' },
          { value: 'debut', labelKey: 'workflows.field.where.start' }
        ]
      }
    ],
    results: ['path', 'link'],
    async run({ fields, t }) {
      const files = fs()
      const path = withMd(safePath(fields.chemin!))
      const before = (await files.exists(path)) ? await files.readText(path) : ''
      const text = fields.texte!
      const next =
        fields.position === 'debut' && before
          ? before.startsWith('---')
            ? before.replace(/^(---[\s\S]*?\n---\n)/, `$1${text}\n`)
            : `${text}\n${before}`
          : `${before.trimEnd()}${before ? '\n' : ''}${text}\n`
      await files.writeText(path, next)
      return { lines: [t('workflows.appended', { path: link(path) })], paths: [path], results: { path, link: link(path) } }
    }
  })
}
