// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le module IA : la connexion au serveur d'IA, le test de connexion, la clé dans le trousseau. */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import type { ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../../core/testing/memoryPlatform'
import { aiClient, iaModule, MODEL_KEY, SECRET_ID } from '.'
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
    expect(platform.offered[0]!.map((choice) => choice.value)).toEqual(['mistral-small', 'llama-70b'])
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
