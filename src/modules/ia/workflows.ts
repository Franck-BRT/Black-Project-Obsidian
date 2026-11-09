// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que le module IA apporte au module Workflows : « Demander à l'IA » — une consigne,
 * un contexte (souvent le résultat d'une étape d'avant, {step1.text}), une réponse que les
 * étapes suivantes reprennent, et, si on le demande, une note où l'écrire.
 */

import type { FileSystem } from '../../core/ports'
import { LANGUAGES, libraryDoc, libraryDocText, namedEntry, personaInstructions, setLanguageByAi, type LanguageCode } from '../bibliotheque'
import { registerAction } from '../workflows'
import type { AiClient } from './client'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Ce qu'on donne à l'IA d'un document pour sa langue : le début de son texte, assez pour trancher. */
const LANGUAGE_SAMPLE = 4000

/** La langue que l'IA a dite : un des codes, au début de sa réponse ; « ? » ou autre chose : rien. */
export function readLanguageAnswer(answer: string): LanguageCode | '' {
  // Le premier mot de la réponse, guillemets ôtés : exactement un des codes, sinon rien (« ? », « français », une phrase).
  const word = answer.trim().toLowerCase().replace(/^[«"'`\s]+/, '').match(/^[a-z?]+/)?.[0] ?? ''
  return (LANGUAGES as readonly string[]).includes(word) ? (word as LanguageCode) : ''
}

export function registerIaWorkflows(client: () => AiClient | null, fs: () => FileSystem, t: Translate, describe: (error: unknown) => string): void {
  /**
   * La langue d'un document de la bibliothèque, quand la détection sans IA n'a pas été sûre :
   * le début de son texte demandé à l'IA. Une réponse nette (un des codes) : la langue est
   * donnée, « identifiée par l'IA » ; sinon — l'IA pas sûre, pas réglée, pas de texte —, elle
   * reste à confirmer, sans erreur.
   */
  registerAction({
    id: 'ia.langue-document',
    labelKey: 'ia.wf.action.language',
    descKey: 'ia.wf.action.language.desc',
    needsAi: true,
    fields: [{ key: 'fiche', labelKey: 'ia.wf.field.record', kind: 'text', required: true, defaultValue: '{fiche}' }],
    results: ['text'],
    async run({ fields }) {
      const say = (key: string, vars?: Record<string, string | number>) => {
        const text = t(key, vars)
        return { lines: [text], results: { text } }
      }
      const record = (fields.fiche ?? '').trim()
      const doc = record ? await libraryDoc(record) : null
      if (!doc) return say('ia.wf.language.noDoc', { record })
      if (!doc.languageToConfirm) return say('ia.wf.language.already', { title: doc.title })
      const ai = client()
      if (!ai) return say('ia.wf.language.noAi', { title: doc.title })
      const text = ((await libraryDocText(record)) ?? '').trim()
      if (!text) return say('ia.wf.language.noText', { title: doc.title })
      let answer: string
      try {
        answer = await ai.chat({
          messages: [
            { role: 'system', content: t('ia.wf.language.system', { codes: LANGUAGES.join(', ') }) },
            { role: 'user', content: text.slice(0, LANGUAGE_SAMPLE) }
          ],
          temperature: 0,
          maxTokens: 8
        })
      } catch (error) {
        throw new Error(describe(error))
      }
      const language = readLanguageAnswer(answer)
      if (!language) return say('ia.wf.language.unsure', { title: doc.title })
      await setLanguageByAi(record, language)
      return say('ia.wf.language.found', { title: doc.title, language: t(`bibliotheque.lang.${language}`) })
    }
  })

  registerAction({
    id: 'ia.demander',
    labelKey: 'ia.wf.action.ask',
    descKey: 'ia.wf.action.ask.desc',
    needsAi: true,
    fields: [
      { key: 'consigne', labelKey: 'ia.wf.field.prompt', kind: 'textarea', placeholderKey: 'ia.wf.field.prompt.placeholder', tooltipKey: 'ia.wf.field.prompt.tip' },
      { key: 'prompt', labelKey: 'bibliotheque.wf.field.prompt', kind: 'text', tooltipKey: 'bibliotheque.wf.field.prompt.tip' },
      { key: 'persona', labelKey: 'bibliotheque.wf.field.persona', kind: 'text', tooltipKey: 'bibliotheque.wf.field.persona.tip' },
      { key: 'contexte', labelKey: 'ia.wf.field.context', kind: 'textarea', tooltipKey: 'ia.wf.field.context.tip' },
      { key: 'note', labelKey: 'ia.wf.field.note', kind: 'text', tooltipKey: 'ia.wf.field.note.tip' }
    ],
    results: ['text', 'path', 'link'],
    async run({ fields }) {
      const ai = client()
      if (!ai) throw new Error(t('ia.unavailable'))
      // La consigne : écrite, sinon celle d'un prompt de la bibliothèque ; un persona, si on en nomme un.
      const prompt = await namedEntry('prompt', fields.prompt)
      const instruction = fields.consigne?.trim() || prompt?.text || ''
      if (!instruction) throw new Error(t('ia.wf.noPrompt'))
      const persona = await namedEntry('persona', fields.persona)
      const asked = persona ? ai.withPersona(personaInstructions(persona)) : ai
      let text: string
      try {
        text = (
          await asked.chat({
            messages: [
              { role: 'system', content: t('ia.wf.system') },
              { role: 'user', content: [instruction, fields.contexte].filter((part) => part?.trim()).join('\n\n') }
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
