// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le workflow système du module IA : **vérifier la connexion à l'ouverture**, actif
 * d'origine. Rien de dit si tout va bien (la liste des modèles mise à jour, le journal le
 * garde) ; dit si le serveur ne répond pas, ou si un modèle choisi n'y est plus ; rien à
 * vérifier sans adresse.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { iaModule } from '../src/modules/ia'
import { runOpeningWorkflows, workflowsModule, type Workflow } from '../src/modules/workflows'

const MODULES = [iaModule, workflowsModule]
const json = (body: unknown) => ({ status: 200, text: JSON.stringify(body) })

async function start(platform: MemoryPlatform, ia: Record<string, unknown>) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ia }
  const views = new ViewsRegistry()
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: () => {}
    }
    await (module as BlackModule).activate(context)
  }
  const journal = () => new TextDecoder().decode(platform.files.get('Black Projects/Workflows/Journal des workflows.md'))
  return { settings, views, journal }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('vérifier la connexion à l’IA, à l’ouverture (workflow système)', () => {
  it('créé actif ; tout va bien : rien n’est dit, la liste des modèles est à jour, la page IA le montre', async () => {
    const platform = memoryPlatform()
    const { settings, views, journal } = await start(platform, { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small' })
    const system = (settings.workflows!.workflows as Workflow[]).find((each) => each.system === 'sys.ia.verifier-connexion')
    expect(system).toMatchObject({ enabled: true, name: 'Vérifier la connexion à l’IA, à l’ouverture', trigger: { kind: 'ouverture' } })
    platform.httpAnswers.push(json({ data: [{ id: 'mistral-small' }, { id: 'bge-m3' }] }))
    await runOpeningWorkflows()
    expect(platform.notices).toEqual([])
    expect(settings.ia!.modelesServeur).toEqual(['mistral-small', 'bge-m3'])
    expect(journal()).toContain('Connexion vérifiée : 2 modèle(s) sur le serveur.')
    const page = await views.pages().find((each) => each.id === 'ia.connexion')!.load()
    expect(page.blocks[0]).toMatchObject({ kind: 'message', tone: 'success' })
  })

  it('un modèle choisi n’est plus sur le serveur : c’est dit', async () => {
    const platform = memoryPlatform()
    await start(platform, { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small', modeleEmbeddings: 'bge-m3' })
    platform.httpAnswers.push(json({ data: [{ id: 'mistral-small' }] }))
    await runOpeningWorkflows()
    expect(platform.notices).toEqual(['IA : modèle(s) choisi(s) absent(s) du serveur — bge-m3. Choisissez-en un autre sur la page IA.'])
  })

  it('le serveur ne répond pas : le workflow échoue, le dit, le journal le garde', async () => {
    const platform = memoryPlatform()
    const { journal } = await start(platform, { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small' })
    platform.httpAnswers.push({ status: 401, text: 'unauthorized' })
    await runOpeningWorkflows()
    expect(platform.notices.at(-1)).toMatch(/Vérifier la connexion à l’IA, à l’ouverture.*le serveur d’IA ne répond pas/)
    expect(journal()).toMatch(/❌ échec · \*\*Vérifier la connexion à l’IA, à l’ouverture\*\*/)
  })

  it('aucune adresse réglée : rien à vérifier, rien n’est dit, aucun appel', async () => {
    const platform = memoryPlatform()
    const { journal } = await start(platform, {})
    await runOpeningWorkflows()
    expect(platform.notices).toEqual([])
    expect(platform.requests).toEqual([])
    expect(journal()).toContain('Aucune adresse de serveur réglée : rien à vérifier.')
  })
})
