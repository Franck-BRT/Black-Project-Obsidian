// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module IA — la connexion à un serveur d'IA compatible OpenAI : **Sidonie**, au CNES,
 * ou tout autre (vLLM, Ollama, LiteLLM…). L'adresse et les modèles dans les réglages ; la
 * clé dans le trousseau de l'ordinateur, jamais dans le coffre ; un bouton « Tester la
 * connexion » qui liste les modèles et fait choisir.
 *
 * Les autres modules s'en servent par `aiClient()` : la relecture et la traduction des
 * exigences, les questions posées au dossier. Sans IA réglée (ou ce module désactivé),
 * tout le reste de Black Projects fonctionne : seules ces fonctions le disent.
 */

import { fillTemplate } from '../../core/docs'
import type { ActionsField, BlackModule, ModuleContext, ModuleDetails, ModuleFeature, SecretField, TextField } from '../../core/modules/module'
import page from './doc/IA.md'
import { AiClient, type AiConnection } from './client'
import { iaEn, iaFr } from './i18n'
import { LlmError } from './protocol'

// ── Interface publique ────────────────────────────────────────────────────────────
export { AiClient, describeHttp, type AiConnection } from './client'
export {
  buildChatBody,
  cosine,
  LlmError,
  parseJsonContent,
  type ChatMessage,
  type ChatRequest,
  type LlmFailure
} from './protocol'

export const IA = 'ia'
export const URL_KEY = 'adresse'
export const MODEL_KEY = 'modele'
export const EMBEDDING_KEY = 'modeleEmbeddings'
export const TOKENS_KEY = 'jetons'
/** L'identifiant de la clé dans le trousseau. */
export const SECRET_ID = 'black-projects-ia-cle'

type Settings = Readonly<Record<string, unknown>>
const text = (settings: Settings, key: string) => (typeof settings[key] === 'string' ? (settings[key] as string).trim() : '')

let active: ModuleContext | null = null

export function connectionOf(settings: Settings, apiKey: string): AiConnection {
  const tokens = Number.parseInt(text(settings, TOKENS_KEY), 10)
  return {
    baseUrl: text(settings, URL_KEY),
    model: text(settings, MODEL_KEY),
    embeddingModel: text(settings, EMBEDDING_KEY),
    apiKey,
    maxTokens: Number.isFinite(tokens) && tokens > 0 ? tokens : 0
  }
}

/** Le client du serveur d'IA réglé ; `null` si le module est inactif ou la connexion incomplète. */
export function aiClient(): AiClient | null {
  if (!active) return null
  const client = new AiClient(
    active.platform.http,
    connectionOf(active.settings.get(), active.platform.secrets?.get(SECRET_ID) ?? '')
  )
  return client.configured ? client : null
}

/** Ce qu'un échec veut dire pour l'utilisateur, en une phrase. */
export function describeAiError(error: unknown, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (error instanceof LlmError) return t(`ia.error.${error.kind}`, { detail: error.message })
  return t('ia.error.other', { detail: error instanceof Error ? error.message : String(error) })
}

const field = (key: string, name: string, defaultValue = '', normalize = (input: string) => input.trim()): TextField => ({
  kind: 'text',
  key,
  nameKey: `ia.setting.${name}`,
  descKey: `ia.setting.${name}.desc`,
  tooltipKey: `ia.setting.${name}.tip`,
  defaultValue,
  normalize
})

const keyField: SecretField = {
  kind: 'secret',
  secretId: SECRET_ID,
  nameKey: 'ia.setting.key',
  descKey: 'ia.setting.key.desc',
  tooltipKey: 'ia.setting.key.tip',
  placeholderKey: 'ia.setting.key.placeholder'
}

const testField: ActionsField = {
  kind: 'actions',
  nameKey: 'ia.setting.test',
  descKey: 'ia.setting.test.desc',
  actions: [{ commandId: 'tester', labelKey: 'ia.setting.test.button', tooltipKey: 'ia.setting.test.tip' }]
}

const feature = (key: string, status: ModuleFeature['status'], step?: number): ModuleFeature => ({
  labelKey: `ia.feature.${key}`,
  noteKey: `ia.feature.${key}.note`,
  status,
  ...(step === undefined ? {} : { step })
})

export function iaFeatures(): ModuleDetails {
  return {
    titleKey: 'ia.details.title',
    introKey: 'ia.details.intro',
    sections: [
      {
        titleKey: 'ia.feature.section.connection',
        features: [feature('server', 'available'), feature('key', 'available'), feature('test', 'available')]
      },
      {
        titleKey: 'ia.feature.section.uses',
        features: [
          feature('review', 'available'),
          feature('translate', 'available'),
          feature('ask', 'available'),
          feature('questionnaire', 'available'),
          feature('semantic', 'available'),
          feature('vision', 'in-progress', 7)
        ]
      }
    ]
  }
}

export const iaModule: BlackModule = {
  id: IA,
  nameKey: 'ia.name',
  descriptionKey: 'ia.description',
  version: '0.1.0',
  requires: [],
  texts: { fr: iaFr, en: iaEn },
  details: () => iaFeatures(),
  settingsFields: [
    field(URL_KEY, 'url'),
    field(MODEL_KEY, 'model'),
    field(EMBEDDING_KEY, 'embedding'),
    field(TOKENS_KEY, 'tokens', '', (input) => {
      const value = Number.parseInt(input.trim(), 10)
      return Number.isFinite(value) && value > 0 ? String(value) : ''
    }),
    keyField,
    testField
  ],
  docs: ({ folder }) => [{ path: 'Modules/IA.md', content: fillTemplate(page, folder) }],
  activate(context) {
    active = context
    const { platform, i18n, settings } = context
    const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)

    context.commands.register({
      id: 'tester',
      nameKey: 'ia.command.test',
      async run() {
        const connection = connectionOf(settings.get(), platform.secrets?.get(SECRET_ID) ?? '')
        if (!connection.baseUrl) {
          platform.notifier.notify(t('ia.test.noUrl'), 8000)
          return
        }
        let models: string[]
        try {
          models = await new AiClient(platform.http, connection).models()
        } catch (error) {
          platform.notifier.notify(t('ia.test.failed', { reason: describeAiError(error, t) }), 12000)
          return
        }
        if (models.length === 0) {
          platform.notifier.notify(t('ia.test.noModel'), 8000)
          return
        }
        // Reachable : faire choisir le modèle de texte parmi ceux du serveur.
        const chosen = await platform.ui.pickOption(
          models.map((model) => ({
            value: model,
            label: model,
            ...(model === connection.model ? { description: t('ia.test.current') } : {})
          })),
          t('ia.test.pick', { count: models.length })
        )
        if (chosen && chosen !== connection.model) await settings.save({ ...settings.get(), [MODEL_KEY]: chosen })
        platform.notifier.notify(t('ia.test.ok', { count: models.length, model: chosen ?? connection.model ?? '—' }), 8000)
      }
    })
  },
  deactivate() {
    active = null
  }
}
