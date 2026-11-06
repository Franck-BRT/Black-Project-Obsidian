// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module IA — la connexion au serveur d'IA de l'entreprise, compatible OpenAI (vLLM,
 * Ollama, LiteLLM…). L'adresse et les modèles dans les réglages ; la
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
import { registerIaWorkflows } from './workflows'
import { listedModels, LISTED_KEY, MODEL_KEYS, MODEL_USES, modelsFor, type ModelUse } from './models'

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
export { listedModels, LISTED_KEY, MODEL_KEYS, MODEL_USES, modelsFor, type ModelUse } from './models'
export const MODEL_KEY = MODEL_KEYS.text
export const EMBEDDING_KEY = MODEL_KEYS.embedding
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
    model: text(settings, MODEL_KEYS.text),
    translateModel: text(settings, MODEL_KEYS.translate),
    embeddingModel: text(settings, MODEL_KEYS.embedding),
    rerankModel: text(settings, MODEL_KEYS.rerank),
    ocrModel: text(settings, MODEL_KEYS.ocr),
    visionModel: text(settings, MODEL_KEYS.vision),
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

/** Le champ de la connexion qui porte le modèle de chaque usage. */
const USE_FIELD: Record<ModelUse, keyof AiConnection> = {
  text: 'model',
  translate: 'translateModel',
  embedding: 'embeddingModel',
  rerank: 'rerankModel',
  ocr: 'ocrModel',
  vision: 'visionModel'
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

/** Le champ d'un usage : son nom, et les modèles du serveur qui lui conviennent. */
const modelField = (use: ModelUse): TextField => ({
  ...field(MODEL_KEYS[use], `model.${use}`),
  choices: (settings) => modelsFor(use, listedModels(settings)),
  choicesTooltipKey: 'ia.setting.model.choices'
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
        features: [feature('server', 'available'), feature('key', 'available'), feature('test', 'available'), feature('models', 'available')]
      },
      {
        titleKey: 'ia.feature.section.uses',
        features: [
          feature('review', 'available'),
          feature('translate', 'available'),
          feature('ask', 'available'),
          feature('questionnaire', 'available'),
          feature('semantic', 'available'),
          feature('rerank', 'available'),
          feature('ocr', 'in-progress', 7),
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
  version: '0.4.0',
  requires: [],
  texts: { fr: iaFr, en: iaEn },
  details: () => iaFeatures(),
  settingsFields: [
    field(URL_KEY, 'url'),
    keyField,
    testField,
    // Un modèle par usage, choisi dans la liste du serveur (retenue par « Tester la connexion »).
    ...MODEL_USES.map(modelField),
    field(TOKENS_KEY, 'tokens', '', (input) => {
      const value = Number.parseInt(input.trim(), 10)
      return Number.isFinite(value) && value > 0 ? String(value) : ''
    })
  ],
  docs: ({ folder }) => [{ path: 'Modules/IA.md', content: fillTemplate(page, folder) }],
  activate(context) {
    active = context
    // L'accueil : la connexion et un modèle par usage, d'un coup d'œil.
    if (context.views) {
      const tr = (key: string, vars?: Record<string, string | number>) => context.i18n.t(key, vars)
      const settingsWindow = context.openWindow
      const configure = settingsWindow ? [{ id: 'settings', label: tr('ia.home.settings'), icon: 'settings' as const, run: () => settingsWindow() }] : []
      const test = { id: 'test', label: tr('ia.setting.test.button'), icon: 'refresh' as const, run: () => context.commands.run?.('tester') ?? Promise.resolve() }
      context.views.home({
        id: 'ia.status',
        order: 20,
        area: 'side',
        async load() {
          const connection = connectionOf(context.settings.get(), context.platform.secrets?.get(SECRET_ID) ?? '')
          const head = { title: tr('ia.home.title'), icon: 'spark' as const }
          if (!connection.baseUrl) return { ...head, blocks: [{ kind: 'message', tone: 'warning', text: tr('ia.home.noUrl'), actions: configure }] }
          if (!connection.model) return { ...head, blocks: [{ kind: 'message', tone: 'warning', text: tr('ia.home.noModel'), actions: [test, ...configure] }] }
          const client = new AiClient(context.platform.http, connection)
          return {
            ...head,
            subtitle: connection.baseUrl,
            blocks: [
              {
                kind: 'list',
                items: MODEL_USES.map((use) => {
                  const own = (connection as unknown as Record<string, string>)[USE_FIELD[use]] ?? ''
                  const model = client.modelFor(use)
                  return {
                    id: use,
                    title: tr(`ia.setting.model.${use}`),
                    detail: own.trim() ? own : model ? tr('ia.home.fallback', { model }) : tr('ia.home.unused'),
                    tone: own.trim() ? ('success' as const) : model ? ('info' as const) : ('neutral' as const)
                  }
                })
              },
              { kind: 'actions', actions: [test, ...configure] }
            ]
          }
        }
      })
      if (settingsWindow) context.views.nav({ id: 'ia', label: tr('ia.name'), icon: 'spark', order: 40, run: () => settingsWindow() })
    }
    registerIaWorkflows(() => aiClient(), () => context.platform.fs, (key, vars) => context.i18n.t(key, vars), (error) => describeAiError(error, (key, vars) => context.i18n.t(key, vars)))
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
        // La liste est retenue : chaque usage la propose dans la fenêtre du module.
        await settings.save({ ...settings.get(), [LISTED_KEY]: models })
        // Sans modèle d'analyse, rien ne marche : il est demandé tout de suite.
        let chosen: string | null = connection.model || null
        if (!chosen) {
          const fitting = modelsFor('text', models)
          chosen = await platform.ui.pickOption(
            fitting.map((model) => ({ value: model, label: model })),
            t('ia.test.pick', { count: fitting.length })
          )
          if (chosen) await settings.save({ ...settings.get(), [MODEL_KEYS.text]: chosen })
        }
        platform.notifier.notify(t('ia.test.ok', { count: models.length, model: chosen ?? '—' }), 10000)
      }
    })
  },
  deactivate() {
    active = null
  }
}
