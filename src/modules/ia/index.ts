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

import { OPENING, registerAction, registerSystemWorkflow } from '../workflows'
import { localToday } from '../../core/dates'
import { fillTemplate } from '../../core/docs'
import type { ActionsField, BlackModule, ModuleContext, ModuleDetails, ModuleFeature, SecretField, TextField } from '../../core/modules/module'
import page from './doc/IA.md'
import { AiClient, type AiConnection } from './client'
import { iaEn, iaFr } from './i18n'
import { LlmError } from './protocol'
import { registerIaHome, USE_FIELD, type ConnectionTest } from './home'
import { registerIaWorkflows } from './workflows'
import { KNOWN_KEY, listedModels, LISTED_KEY, MODEL_KEYS, MODEL_USES, modelsFor, usesOf, type ModelUse } from './models'

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

/** Le dernier test de la connexion, tant que le module est actif : pour la page IA. */
let lastTest: ConnectionTest | null = null

/**
 * Tester la connexion : la liste des modèles du serveur, retenue (chaque usage la propose) ;
 * sans modèle d'analyse, il est demandé tout de suite. Le résultat est dit, et gardé pour
 * la page IA.
 */
async function testConnection(context: ModuleContext): Promise<ConnectionTest> {
  const { platform, i18n, settings } = context
  const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
  const now = new Date()
  const at = `${localToday(now)} ${now.toTimeString().slice(0, 5)}`
  const done = (test: Omit<ConnectionTest, 'at'>): ConnectionTest => (lastTest = { at, ...test })
  const connection = connectionOf(settings.get(), platform.secrets?.get(SECRET_ID) ?? '')
  if (!connection.baseUrl) {
    platform.notifier.notify(t('ia.test.noUrl'), 8000)
    return done({ outcome: 'noUrl', count: 0, model: '', reason: '' })
  }
  let models: string[]
  try {
    models = await new AiClient(platform.http, connection).models()
  } catch (error) {
    const reason = describeAiError(error, t)
    platform.notifier.notify(t('ia.test.failed', { reason }), 12000)
    return done({ outcome: 'failed', count: 0, model: '', reason })
  }
  if (models.length === 0) {
    platform.notifier.notify(t('ia.test.noModel'), 8000)
    return done({ outcome: 'noModel', count: 0, model: '', reason: '' })
  }
  // La liste est retenue : chaque usage la propose (page IA, fenêtre du module).
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
  return done({ outcome: 'ok', count: models.length, model: chosen ?? '', reason: '' })
}

/**
 * Vérifier la connexion sans rien demander (le workflow système, à l'ouverture) : la liste
 * des modèles du serveur mise à jour, rien de dit si tout va bien ; un serveur qui ne
 * répond pas lève (le workflow échoue, le dit, le journal le garde) ; un modèle choisi qui
 * n'est plus sur le serveur est dit. Sans adresse réglée, rien à vérifier.
 */
/**
 * Les nouveaux modèles du serveur : ceux de la liste (mise à jour par la vérification) qui
 * n'y étaient pas la dernière fois. La première fois, la liste est seulement retenue.
 */
async function newModels(context: ModuleContext): Promise<string> {
  const { platform, i18n, settings } = context
  const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
  const listed = listedModels(settings.get())
  if (!listed.length) return t('ia.wf.newModels.unknown')
  const stored = settings.get()[KNOWN_KEY]
  const known = Array.isArray(stored) ? stored.filter((each): each is string => typeof each === 'string') : null
  await settings.save({ ...settings.get(), [KNOWN_KEY]: listed })
  if (!known) return t('ia.wf.newModels.first', { count: listed.length })
  const fresh = listed.filter((model) => !known.includes(model))
  if (!fresh.length) return t('ia.wf.newModels.none')
  const described = fresh.map((model) => {
    const uses = usesOf(model).map((use) => t(`ia.use.${use}`))
    return uses.length ? `${model} (${uses.join(', ')})` : model
  })
  const text = t('ia.wf.newModels.found', { count: fresh.length, models: described.join(', ') })
  platform.notifier.notify(text, 15000)
  return text
}

/** Le temps de réponse du modèle d'analyse, sur une demande minuscule ; dit au-delà du seuil. */
async function responseTime(context: ModuleContext, threshold: number): Promise<string> {
  const { platform, i18n } = context
  const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
  const client = aiClient()
  if (!client) return t('ia.wf.check.noUrl')
  const started = Date.now()
  try {
    await client.chat({ messages: [{ role: 'user', content: 'OK' }], maxTokens: 1 })
  } catch (error) {
    throw new Error(t('ia.wf.check.unreachable', { reason: describeAiError(error, t) }))
  }
  const seconds = Math.round((Date.now() - started) / 100) / 10
  const shown = seconds.toLocaleString(i18n.language === 'en' ? 'en-GB' : 'fr-FR')
  if (seconds <= threshold) return t('ia.wf.speed.ok', { seconds: shown })
  const text = t('ia.wf.speed.slow', { seconds: shown, threshold })
  platform.notifier.notify(text, 15000)
  return text
}

async function checkConnection(context: ModuleContext): Promise<string> {
  const { platform, i18n, settings } = context
  const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
  const now = new Date()
  const at = `${localToday(now)} ${now.toTimeString().slice(0, 5)}`
  const connection = connectionOf(settings.get(), platform.secrets?.get(SECRET_ID) ?? '')
  if (!connection.baseUrl) return t('ia.wf.check.noUrl')
  let models: string[]
  try {
    models = await new AiClient(platform.http, connection).models()
  } catch (error) {
    const reason = describeAiError(error, t)
    lastTest = { at, outcome: 'failed', count: 0, model: '', reason }
    throw new Error(t('ia.wf.check.unreachable', { reason }))
  }
  if (models.length) await settings.save({ ...settings.get(), [LISTED_KEY]: models })
  lastTest = { at, outcome: models.length ? 'ok' : 'noModel', count: models.length, model: connection.model, reason: '' }
  // Un modèle réglé (un usage) qui n'est plus sur le serveur : à choisir de nouveau.
  const chosen = [...new Set(MODEL_USES.map((use) => String(connection[USE_FIELD[use]] ?? '').trim()).filter(Boolean))]
  const missing = models.length ? chosen.filter((model) => !models.includes(model)) : []
  if (missing.length) {
    const text = t('ia.wf.check.missing', { models: missing.join(', ') })
    platform.notifier.notify(text, 15000)
    return text
  }
  return t('ia.wf.check.ok', { count: models.length })
}

export const iaModule: BlackModule = {
  id: IA,
  nameKey: 'ia.name',
  descriptionKey: 'ia.description',
  version: '0.9.0',
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
    // L'interface : la connexion sur le tableau de bord, et la page IA (un modèle par usage).
    registerIaHome(context.views, {
      t: (key, vars) => context.i18n.t(key, vars),
      settings: () => context.settings.get(),
      save: (values) => context.settings.save(values),
      connection: () => connectionOf(context.settings.get(), context.platform.secrets?.get(SECRET_ID) ?? ''),
      client: (connection) => new AiClient(context.platform.http, connection),
      pick: (options, placeholder) => context.platform.ui.pickOption(options, placeholder),
      notify: (message) => context.platform.notifier.notify(message, 6000),
      test: async () => void (await testConnection(context)),
      lastTest: () => lastTest,
      ...(context.openWindow ? { openSettings: context.openWindow } : {}),
      ...(context.showPage ? { showPage: (id: string) => context.showPage?.(id) } : {}),
      features: () => iaFeatures()
    })
    registerIaWorkflows(() => aiClient(), () => context.platform.fs, (key, vars) => context.i18n.t(key, vars), (error) => describeAiError(error, (key, vars) => context.i18n.t(key, vars)))
    // Vérifier la connexion à l'ouverture : une action, et son workflow système (actif d'origine).
    registerAction({
      id: 'ia.verifier',
      labelKey: 'ia.wf.action.check',
      descKey: 'ia.wf.action.check.desc',
      fields: [],
      results: ['text'],
      async run() {
        const text = await checkConnection(context)
        return { lines: [text], results: { text } }
      }
    })
    registerSystemWorkflow({
      id: 'sys.ia.verifier-connexion',
      moduleKey: 'ia.name',
      enabledByDefault: true,
      make: (tr) => ({ name: tr('ia.sys.verifier-connexion'), mode: 'auto', trigger: { kind: OPENING }, conditions: [], actions: [{ kind: 'ia.verifier', fields: {} }] })
    })
    // Les nouveaux modèles du serveur, après la vérification (actif) ; le temps de réponse (désactivé).
    registerAction({
      id: 'ia.nouveaux-modeles',
      labelKey: 'ia.wf.action.newModels',
      descKey: 'ia.wf.action.newModels.desc',
      fields: [],
      results: ['text'],
      async run() {
        const text = await newModels(context)
        return { lines: [text], results: { text } }
      }
    })
    registerAction({
      id: 'ia.temps-reponse',
      labelKey: 'ia.wf.action.speed',
      descKey: 'ia.wf.action.speed.desc',
      fields: [{ key: 'seuil', labelKey: 'ia.wf.field.threshold', kind: 'text', required: true, defaultValue: '5', tooltipKey: 'ia.wf.field.threshold.tip' }],
      results: ['text'],
      async run({ fields }) {
        const threshold = Number.parseFloat((fields.seuil ?? '5').replace(',', '.'))
        const text = await responseTime(context, Number.isFinite(threshold) && threshold > 0 ? threshold : 5)
        return { lines: [text], results: { text } }
      }
    })
    registerSystemWorkflow({
      id: 'sys.ia.nouveaux-modeles',
      moduleKey: 'ia.name',
      enabledByDefault: true,
      make: (tr) => ({ name: tr('ia.sys.nouveaux-modeles'), mode: 'auto', trigger: { kind: OPENING }, conditions: [], actions: [{ kind: 'ia.nouveaux-modeles', fields: {} }] })
    })
    registerSystemWorkflow({
      id: 'sys.ia.temps-reponse',
      moduleKey: 'ia.name',
      enabledByDefault: false,
      make: (tr) => ({ name: tr('ia.sys.temps-reponse'), mode: 'auto', trigger: { kind: OPENING }, conditions: [], actions: [{ kind: 'ia.temps-reponse', fields: { seuil: '5' } }] })
    })

    context.commands.register({
      id: 'tester',
      nameKey: 'ia.command.test',
      // Depuis la palette : les messages, comme avant ; le résultat se lit aussi sur la page IA.
      run: async () => void (await testConnection(context))
    })
  },
  deactivate() {
    active = null
    lastTest = null
  }
}
