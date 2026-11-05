// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le module IA : la connexion au serveur d'IA, le test de connexion, la clé dans le trousseau. */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import type { ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../../core/testing/memoryPlatform'
import { aiClient, iaModule, LISTED_KEY, MODEL_KEY, modelsFor, SECRET_ID, type AiConnection } from '.'
import { AiClient } from './client'
import { iaFr } from './i18n'

const i18n = createI18n('fr')
i18n.register('fr', iaFr)

async function activate(platform: MemoryPlatform, initial: Record<string, unknown>) {
  let stored = initial
  const commands: ModuleCommand[] = []
  const context: ModuleContext = {
    moduleId: iaModule.id,
    platform,
    i18n,
    settings: { get: () => stored, save: async (values) => void (stored = values), onChange: () => () => {} },
    commands: { register: (command) => void commands.push(command) }
  }
  await iaModule.activate(context)
  return { run: (id: string) => commands.find((command) => command.id === id)!.run(), settings: () => stored }
}

const json = (value: unknown) => ({ status: 200, text: JSON.stringify(value) })

afterEach(async () => {
  await iaModule.deactivate?.()
})

describe('la connexion au serveur d’IA', () => {
  it('sans adresse ni modèle, pas de client : les autres modules le disent', async () => {
    const platform = memoryPlatform()
    await activate(platform, {})
    expect(aiClient()).toBeNull()
  })

  it('« Tester la connexion » liste les modèles et fait choisir celui de texte, la clé du trousseau envoyée', async () => {
    const platform = memoryPlatform()
    platform.secretValues.set(SECRET_ID, 'cle-secrete')
    const ia = await activate(platform, { adresse: 'https://ia.exemple.fr/v1' })
    platform.httpAnswers.push(json({ data: [{ id: 'mistral-small' }, { id: 'llama-70b' }] }))
    platform.choices.push('llama-70b')
    await ia.run('tester')
    expect(platform.requests[0]!.url).toBe('https://ia.exemple.fr/v1/models')
    expect(platform.requests[0]!.headers?.Authorization).toBe('Bearer cle-secrete')
    expect(platform.offered[0]!.map((choice) => choice.value)).toEqual(['llama-70b', 'mistral-small'])
    expect(ia.settings()[LISTED_KEY]).toEqual(['mistral-small', 'llama-70b'])
    expect(ia.settings()[MODEL_KEY]).toBe('llama-70b')
    expect(platform.notices.at(-1)).toContain('llama-70b')
    // La clé n'est jamais dans les réglages (donc jamais dans le coffre).
    expect(JSON.stringify(ia.settings())).not.toContain('cle-secrete')
    expect(aiClient()?.connection.model).toBe('llama-70b')
  })

  it('un échec est dit en clair', async () => {
    const platform = memoryPlatform()
    const ia = await activate(platform, { adresse: 'https://ia.exemple.fr/v1' })
    platform.httpAnswers.push({ status: 401, text: 'unauthorized' })
    await ia.run('tester')
    expect(platform.notices.at(-1)).toMatch(/clé/i)
  })
})

const SERVER = [
  'mistral-small-3.2',
  'llama-3.3-70b',
  'bge-m3',
  'multilingual-e5-large',
  'bge-reranker-v2-m3',
  'qwen2.5-vl-72b',
  'pixtral-12b',
  'dots.ocr',
  'whisper-large-v3'
]

describe('un modèle par usage', () => {
  it('chaque usage propose les modèles du serveur qui lui conviennent', () => {
    expect(modelsFor('text', SERVER)).toEqual(['llama-3.3-70b', 'mistral-small-3.2', 'pixtral-12b', 'qwen2.5-vl-72b'])
    expect(modelsFor('embedding', SERVER)).toEqual(['bge-m3', 'multilingual-e5-large'])
    expect(modelsFor('rerank', SERVER)).toEqual(['bge-reranker-v2-m3'])
    expect(modelsFor('ocr', SERVER)).toEqual(['dots.ocr', 'pixtral-12b', 'qwen2.5-vl-72b'])
    expect(modelsFor('vision', SERVER)).toEqual(['pixtral-12b', 'qwen2.5-vl-72b'])
    // Aucun ne convient : tous, plutôt qu'un menu vide.
    expect(modelsFor('rerank', ['mistral-small'])).toEqual(['mistral-small'])
  })

  it('les champs de la fenêtre proposent la liste retenue', async () => {
    const fields = iaModule.settingsFields!.filter((field) => field.kind === 'text' && field.choices)
    expect(fields.map((field) => (field as { key: string }).key)).toEqual([
      'modele',
      'modeleTraduction',
      'modeleEmbeddings',
      'modeleReranking',
      'modeleOcr',
      'modeleVision'
    ])
    const embedding = fields[2] as { choices: (settings: Record<string, unknown>) => readonly string[] }
    expect(embedding.choices({ [LISTED_KEY]: SERVER })).toEqual(['bge-m3', 'multilingual-e5-large'])
    expect(embedding.choices({})).toEqual([])
  })

  it('un usage vide prend le modèle qui le remplace', () => {
    const connection = (over: Partial<AiConnection>): AiConnection => ({
      baseUrl: 'http://ia.exemple/v1',
      model: 'analyse',
      translateModel: '',
      embeddingModel: '',
      rerankModel: '',
      ocrModel: '',
      visionModel: '',
      apiKey: '',
      maxTokens: 0,
      ...over
    })
    const client = (over: Partial<AiConnection>) => new AiClient(memoryPlatform().http, connection(over))
    expect(client({}).modelFor('translate')).toBe('analyse')
    expect(client({ translateModel: 'rapide' }).modelFor('translate')).toBe('rapide')
    expect(client({}).modelFor('ocr')).toBe('analyse')
    expect(client({ visionModel: 'vue' }).modelFor('ocr')).toBe('vue')
    expect(client({ visionModel: 'vue', ocrModel: 'ocr' }).modelFor('ocr')).toBe('ocr')
    expect(client({}).modelFor('embedding')).toBe('')
    expect(client({}).modelFor('rerank')).toBe('')
  })

  it('le reranking passe par /rerank', async () => {
    const platform = memoryPlatform()
    platform.httpAnswers.push({ status: 200, text: JSON.stringify({ results: [{ index: 1, relevance_score: 0.9 }, { index: 0, relevance_score: 0.2 }] }) })
    const client = new AiClient(platform.http, {
      baseUrl: 'http://ia.exemple/v1', model: 'm', translateModel: '', embeddingModel: '', rerankModel: 'bge-reranker', ocrModel: '', visionModel: '', apiKey: '', maxTokens: 0
    })
    expect(await client.rerank('pénalités', ['a', 'b'])).toEqual([0.2, 0.9])
    expect(platform.requests[0]!.url).toBe('http://ia.exemple/v1/rerank')
    expect(JSON.parse(platform.requests[0]!.body!).model).toBe('bge-reranker')
  })
})

