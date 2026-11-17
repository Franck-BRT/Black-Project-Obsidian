// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le workflow système du module IA : **vérifier la connexion à l'ouverture**, actif
 * d'origine. Rien de dit si tout va bien (la liste des modèles mise à jour, le journal le
 * garde) ; dit si le serveur ne répond pas, ou si un modèle choisi n'y est plus ; rien à
 * vérifier sans adresse.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { iaModule } from '../src/modules/ia'
import { runOpeningWorkflows, workflowsModule, type Workflow } from '../src/modules/workflows'

const MODULES = [iaModule, workflowsModule]
const json = (body: unknown) => ({ status: 200, text: JSON.stringify(body) })
/** La réponse à la demande minuscule chronométrée (la vitesse du serveur, 3e étape de la vérification). */
const quick = () => json({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] })

async function start(platform: MemoryPlatform, ia: Record<string, unknown>) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { workflows: { essentielsSeulement: false }, ia }
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
    // Trois étapes : la connexion, les nouveaux modèles du serveur, sa vitesse (« Signaler les nouveaux modèles » et « … un serveur d'IA lent » y sont fondus).
    expect(system).toMatchObject({ enabled: true, name: 'Vérifier l’IA à l’ouverture : la connexion, les nouveaux modèles, la vitesse du serveur', trigger: { kind: 'ouverture' }, actions: [{ kind: 'ia.verifier' }, { kind: 'ia.nouveaux-modeles' }, { kind: 'ia.temps-reponse', fields: { seuil: '5' } }] })
    expect((settings.workflows!.workflows as Workflow[]).some((each) => each.system === 'sys.ia.nouveaux-modeles' || each.system === 'sys.ia.temps-reponse')).toBe(false)
    platform.httpAnswers.push(json({ data: [{ id: 'mistral-small' }, { id: 'bge-m3' }] }), quick())
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
    platform.httpAnswers.push(json({ data: [{ id: 'mistral-small' }] }), quick())
    await runOpeningWorkflows()
    expect(platform.notices).toEqual(['IA : modèle(s) choisi(s) absent(s) du serveur — bge-m3. Choisissez-en un autre sur la page IA.'])
  })

  it('le serveur ne répond pas : le workflow échoue, le dit, le journal le garde', async () => {
    const platform = memoryPlatform()
    const { journal } = await start(platform, { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small' })
    platform.httpAnswers.push({ status: 401, text: 'unauthorized' })
    await runOpeningWorkflows()
    expect(platform.notices.at(-1)).toMatch(/Vérifier l’IA à l’ouverture : la connexion, les nouveaux modèles, la vitesse du serveur.*Étape 1.*le serveur d’IA ne répond pas/)
    expect(journal()).toMatch(/❌ échec · \*\*Vérifier l’IA à l’ouverture : la connexion, les nouveaux modèles, la vitesse du serveur\*\*/)
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

describe('les nouveaux modèles du serveur, à l’ouverture (une étape de la vérification)', () => {
  it('la première fois, la liste est retenue sans rien dire', async () => {
    const platform = memoryPlatform()
    const { settings, journal } = await start(platform, { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small' })
    platform.httpAnswers.push(json({ data: [{ id: 'mistral-small' }] }), quick())
    await runOpeningWorkflows()
    expect(platform.notices).toEqual([])
    expect(settings.ia!.modelesConnus).toEqual(['mistral-small'])
    expect(journal()).toContain('Modèles du serveur retenus (1)')
  })

  it('de nouveaux modèles : nommés, avec l’usage qui leur conviendrait', async () => {
    const platform = memoryPlatform()
    const { settings } = await start(platform, { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small', modelesConnus: ['mistral-small'] })
    platform.httpAnswers.push(json({ data: [{ id: 'mistral-small' }, { id: 'bge-m3' }, { id: 'qwen2.5-vl' }] }), quick())
    await runOpeningWorkflows()
    expect(platform.notices).toEqual(['IA : 2 nouveau(x) modèle(s) sur le serveur — bge-m3 (vecteurs), qwen2.5-vl (analyse, traduction, lecture OCR, lecture par vision). À choisir pour un usage sur la page IA.'])
    expect(settings.ia!.modelesConnus).toEqual(['mistral-small', 'bge-m3', 'qwen2.5-vl'])
  })
})

describe('un serveur d’IA lent, à l’ouverture (une étape de la vérification)', () => {
  it('une demande minuscule, un message au-delà du seuil', async () => {
    const platform = memoryPlatform()
    await start(platform, { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small', modelesConnus: ['mistral-small'] })
    platform.httpAnswers.push(json({ data: [{ id: 'mistral-small' }] }), quick())
    // La réponse met 7,5 s (l'horloge, avancée pendant la demande).
    const clock = vi.spyOn(Date, 'now')
    let calls = 0
    clock.mockImplementation(() => (calls++ === 0 ? 1_000 : 8_500))
    try {
      await runOpeningWorkflows()
    } finally {
      clock.mockRestore()
    }
    expect(platform.notices).toContain('IA lente : 7,5 s pour répondre (seuil : 5 s). Le serveur est peut-être chargé, ou le modèle se charge.')
    expect(JSON.parse(platform.requests.at(-1)!.body!)).toMatchObject({ model: 'mistral-small', max_tokens: 1 })
  })
})
