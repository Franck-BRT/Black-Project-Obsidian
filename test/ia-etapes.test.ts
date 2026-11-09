// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les étapes de workflow qui demandent l'IA : un autre fond dans le logigramme (et « IA »
 * écrit), et trois champs — **Prompt**, **Persona**, **Skill** — choisis dans les
 * bibliothèques respectives (la bibliothèque de skills est nouvelle) ; leurs consignes sont
 * données à l'IA avec la demande de l'étape.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type FlowNode, type HomeBlock } from '../src/core/views'
import { addStarterEntries, bibliothequeModule, libraryEntries } from '../src/modules/bibliotheque'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { actionSpec, fieldSourceOptions, runOpeningWorkflows, workflowsModule, type Workflow } from '../src/modules/workflows'

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }
const chat = (content: string) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) })
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const JOURNAL = 'Black Projects/Workflows/Journal des workflows.md'

const workflow = (actions: Workflow['actions']): Workflow => ({
  id: 'wf-ia',
  name: 'Résumer',
  enabled: true,
  mode: 'auto',
  trigger: { kind: 'ouverture' },
  conditions: [],
  actions,
  created: '2026-11-01T00:00:00'
})

async function start(platform: MemoryPlatform, workflows: Workflow[] = []) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ia: SERVEUR, workflows: { workflows } }
  const views = new ViewsRegistry()
  for (const module of ALL) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: () => {}
    }
    await module.activate(context)
  }
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const flowchart = async (id: string): Promise<{ nodes: FlowNode[]; legend?: string }> => {
    const view = await page('workflows.fiche').load(id)
    const section = view.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'workflows.fiche.logigramme')
    const chart = section?.blocks[0]
    if (chart?.kind !== 'flowchart') throw new Error('pas de logigramme')
    return chart
  }
  return { settings, page, flowchart }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('les étapes qui demandent l’IA', () => {
  it('toute action d’IA a ses champs Prompt, Persona, Skill, aux listes de la bibliothèque', async () => {
    await start(memoryPlatform())
    expect(actionSpec('ia.langue-document')!.fields.map((field) => `${field.key}:${field.source ?? ''}`)).toEqual([
      'fiche:',
      'prompt:bibliotheque.prompt',
      'persona:bibliotheque.persona',
      'skill:bibliotheque.skill'
    ])
    // « Demander à l'IA » a déjà ses prompt et persona : leur liste vient de la bibliothèque, le skill s'ajoute.
    const ask = actionSpec('ia.demander')!
    expect(ask.fields.filter((field) => field.source).map((field) => field.key)).toEqual(['prompt', 'persona', 'skill'])
    expect(ask.aiAdded).toEqual(['skill'])
    for (const id of ['ao.interroger', 'ao.questionnaire', 'exigences.relire', 'exigences.traduire', 'ia.identite-document']) {
      expect(actionSpec(id) === undefined || actionSpec(id)!.fields.some((field) => field.key === 'skill')).toBe(true)
    }
    // Une action sans IA : rien d'ajouté.
    expect(actionSpec('notifier')!.fields.map((field) => field.key)).toEqual(['message'])
  })

  it('la bibliothèque de skills : ses exemples, une note par skill ; les listes des champs', async () => {
    const platform = memoryPlatform()
    await start(platform)
    expect(await addStarterEntries('skill', 'fr')).toEqual(['Lire un CCTP', 'Repérer les pénalités', 'Vérifier une exigence', 'Répondre en tableau'])
    expect(read(platform, 'Bibliothèque/Skills/Répondre en tableau.md')).toMatch(/^---\nbp-type: bibliotheque-skill\nnom: Répondre en tableau\ncategorie: Rédaction\n/)
    expect((await libraryEntries('skill')).map((entry) => entry.name)).toContain('Lire un CCTP')
    expect((await fieldSourceOptions('bibliotheque.skill'))?.find((option) => option.value === 'Répondre en tableau')).toMatchObject({ label: 'Répondre en tableau', description: 'Rédaction · Une réponse courte, en tableau, sources citées' })
  })

  it('le logigramme : l’étape d’IA a un autre fond, « IA » dans son intitulé, ce qu’on a choisi ; une légende', async () => {
    const platform = memoryPlatform()
    const { flowchart } = await start(platform, [
      workflow([
        { kind: 'notifier', fields: { message: 'Début' } },
        { kind: 'ia.demander', fields: { consigne: 'Résume', prompt: '', persona: 'Juriste marchés publics', skill: 'Répondre en tableau', contexte: '', note: '' } }
      ])
    ])
    const chart = await flowchart('wf-ia')
    const steps = chart.nodes.filter((node) => node.kind === 'step')
    expect(steps.map((node) => [node.caption, !!node.ai, node.icon])).toEqual([
      ['Étape 1', false, 'play'],
      ['Étape 2 · IA', true, 'spark']
    ])
    expect(steps[1]!.detail).toBe('Persona : Juriste marchés publics · Skill : Répondre en tableau')
    expect(chart.legend).toBe('Fond turquoise : une étape qui demande l’IA ; fond gris : sans IA.')
  })

  it('ouvrir l’étape : Prompt, Persona, Skill sont des listes de la bibliothèque (« Aucun » d’abord ; un nom disparu reste dit)', async () => {
    const platform = memoryPlatform()
    const { flowchart } = await start(platform, [workflow([{ kind: 'ia.langue-document', fields: { fiche: '{fiche}', prompt: '', persona: '', skill: 'Ancien skill' } }])])
    await addStarterEntries('skill', 'fr')
    await addStarterEntries('persona', 'fr')
    const step = (await flowchart('wf-ia')).nodes.find((node) => node.kind === 'step')!
    await step.open!.run()
    const form = platform.asked.at(-1)!
    expect(form.intro).toContain('Cette étape demande l’IA : vous pouvez lui donner un prompt, un persona et un skill de la bibliothèque.')
    const skill = form.fields.find((field) => field.key === 'skill')
    expect(skill?.kind).toBe('choice')
    const options = skill?.kind === 'choice' ? skill.options.map((option) => option.label) : []
    expect(options[0]).toBe('— Aucun —')
    expect(options).toContain('Répondre en tableau')
    expect(options.at(-1)).toBe('Ancien skill (pas dans la bibliothèque)')
    expect(skill).toMatchObject({ label: 'Skill (bibliothèque)', value: 'Ancien skill' })
    const persona = form.fields.find((field) => field.key === 'persona')
    expect(persona?.kind === 'choice' && persona.options.map((option) => option.label)).toContain('Juriste marchés publics')
  })

  it('à l’exécution : le persona, puis la méthode du skill, puis la consigne du prompt, donnés à l’IA', async () => {
    const platform = memoryPlatform()
    await start(platform, [
      workflow([{ kind: 'ia.demander', fields: { consigne: 'Résume le dossier.', prompt: '', persona: 'Juriste marchés publics', skill: 'Répondre en tableau', contexte: 'Texte du dossier', note: '' } }])
    ])
    await addStarterEntries('skill', 'fr')
    await addStarterEntries('persona', 'fr')
    platform.httpAnswers.push(chat('| Point | Source |'))
    const before = platform.requests.length
    await runOpeningWorkflows()
    const sent = JSON.parse(platform.requests[before]!.body!) as { messages: { role: string; content: string }[] }
    const system = sent.messages[0]!.content
    expect(system).toMatch(/^Tu réponds en tant que « Juriste marchés publics »/)
    expect(system.indexOf('Applique ce savoir-faire (« Répondre en tableau ») :')).toBeGreaterThan(system.indexOf('Juriste marchés publics'))
    expect(system).toContain('Réponds par un tableau Markdown')
    expect(sent.messages.at(-1)!.content).toBe('Résume le dossier.\n\nTexte du dossier')
  })

  it('un skill qui n’est pas dans la bibliothèque : l’étape échoue et le journal le dit', async () => {
    const platform = memoryPlatform()
    await start(platform, [workflow([{ kind: 'ia.demander', fields: { consigne: 'Résume.', prompt: '', persona: '', skill: 'Inconnu', contexte: '', note: '' } }])])
    await runOpeningWorkflows()
    expect(read(platform, JOURNAL)).toContain('Aucun skill « Inconnu » dans la bibliothèque (ou il est vide).')
  })
})
