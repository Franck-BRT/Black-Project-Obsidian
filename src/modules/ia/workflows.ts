// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que le module IA apporte au module Workflows : « Demander à l'IA » — une consigne,
 * un contexte (souvent le résultat d'une étape d'avant, {step1.text}), une réponse que les
 * étapes suivantes reprennent, et, si on le demande, une note où l'écrire.
 */

import type { FileSystem } from '../../core/ports'
import { registerAction } from '../workflows'
import type { AiClient } from './client'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export function registerIaWorkflows(client: () => AiClient | null, fs: () => FileSystem, t: Translate, describe: (error: unknown) => string): void {
  registerAction({
    id: 'ia.demander',
    labelKey: 'ia.wf.action.ask',
    descKey: 'ia.wf.action.ask.desc',
    needsAi: true,
    fields: [
      { key: 'consigne', labelKey: 'ia.wf.field.prompt', kind: 'textarea', required: true, placeholderKey: 'ia.wf.field.prompt.placeholder' },
      { key: 'contexte', labelKey: 'ia.wf.field.context', kind: 'textarea', tooltipKey: 'ia.wf.field.context.tip' },
      { key: 'note', labelKey: 'ia.wf.field.note', kind: 'text', tooltipKey: 'ia.wf.field.note.tip' }
    ],
    results: ['text', 'path', 'link'],
    async run({ fields }) {
      const ai = client()
      if (!ai) throw new Error(t('ia.unavailable'))
      let text: string
      try {
        text = (
          await ai.chat({
            messages: [
              { role: 'system', content: t('ia.wf.system') },
              { role: 'user', content: [fields.consigne, fields.contexte].filter((part) => part?.trim()).join('\n\n') }
            ],
            temperature: 0.2
          })
        ).trim()
      } catch (error) {
        throw new Error(describe(error))
      }
      const wanted = fields.note?.trim()
      if (!wanted) return { lines: [t('ia.wf.answered', { length: text.length })], results: { text, path: '', link: '' } }
      const path = wanted.toLowerCase().endsWith('.md') ? wanted : `${wanted}.md`
      await fs().writeText(path, `${text}\n`)
      const link = `[[${path.replace(/\.md$/, '')}]]`
      return { lines: [t('ia.wf.written', { path: link })], paths: [path], results: { text, path, link } }
    }
  })
}
