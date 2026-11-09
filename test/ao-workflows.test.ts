// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/// <reference types="node" />

/**
 * Les workflows avec l'analyse d'appels d'offres, sur le dossier d'exemple : un workflow
 * prêt à l'emploi relève le calendrier dès que des pièces sont déposées ; un autre analyse
 * la qualité dès que des exigences sont extraites ; un workflow écrit à la main interroge
 * le dossier avec l'IA (serveur simulé) et passe la réponse à l'étape suivante.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { aoModule, createAnalysis } from '../src/modules/ao'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'
import { runOpeningWorkflows, workflowsModule, type Workflow } from '../src/modules/workflows'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))
const MODULES = [lectureFichiersModule, typagePiecesModule, exigencesModule, iaModule, workflowsModule, aoModule]
const ROOT = "Appels d'offres/Station sol"
const TENDER = `${ROOT}/Pièces/Appel d'offres/Originaux`

async function start(platform: MemoryPlatform, ia: Record<string, unknown> = {}, ao: Record<string, unknown> = {}) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false, ...ao }, ia }
  const commands = new Map<string, ModuleCommand>()
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command) }
    }
    await (module as BlackModule).activate(context)
  }
  const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => '2026-11-05' }
  const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'Agence', reference: '' })
  return {
    run: (id: string) => commands.get(id)!.run(),
    analysis,
    workflows: () => (settings.workflows?.workflows ?? []) as Workflow[],
    settings
  }
}

const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: string) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) })

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('les workflows et l’analyse d’appels d’offres', () => {
  it('les workflows système, dès l’activation : calendrier à l’import des pièces, qualité à l’extraction, note de l’analyse', async () => {
    const platform = memoryPlatform()
    const { run, analysis, workflows } = await start(platform)
    // Créés à l'activation : les automatismes de l'application, actifs ou non selon ce qui est prévu.
    expect(workflows().map((workflow) => `${workflow.system}:${workflow.enabled}`).sort()).toEqual([
      'sys.ao.calendrier-import:true',
      'sys.ao.controle-extraction:true',
      'sys.ao.couverture-reponse:false',
      'sys.ao.extraire-cctp:false',
      'sys.ao.note-exigences:true',
      'sys.ao.note-pieces:true',
      'sys.ao.questionnaire-ia:false',
      'sys.ao.rappel-echeances:true',
      'sys.ao.rappel-rangement:true',
      'sys.ao.rappel-remises:true',
      'sys.ao.validite-offres:false',
      'sys.exigences.controle-import:true',
      'sys.exigences.qualite-hebdo:false',
      'sys.exigences.relire-nouvelles:false',
      'sys.exigences.traductions-hebdo:false',
      'sys.exigences.traduire-nouvelles:false',
      'sys.ia.identite-documents:true',
      'sys.ia.langue-documents:true',
      'sys.ia.nouveaux-modeles:true',
      'sys.ia.temps-reponse:false',
      'sys.ia.verifier-connexion:true',
      'sys.lecture-fichiers.bilan-formats:false',
      'sys.lecture-fichiers.formats-non-lus:true',
      'sys.lecture-fichiers.illisibles:true',
      'sys.lecture-fichiers.sans-texte:false',
      'sys.typage-pieces.sans-type:true',
      'sys.workflows.archiver-journal:false',
      'sys.workflows.bilan-hebdo:false',
      'sys.workflows.casses:true'
    ])

    // Le RC et le CCTP déposés à la main, puis « Mettre à jour l'analyse ».
    for (const name of ['RC.html', 'CCTP.docx']) platform.files.set(`${TENDER}/${name}`, new Uint8Array(readFileSync(folder + name)))
    platform.active = analysis.note
    await run('ao-mettre-a-jour')
    const calendar = read(platform, `${ROOT}/Analyse/Calendrier.md`)
    expect(calendar).toContain('**Date limite de remise des offres** : vendredi 15 janvier 2027')
    // Le tableau des pièces de la note : par son workflow système.
    expect(read(platform, analysis.note)).toContain('CCTP')

    // Les exigences du CCTP extraites : la qualité et la cohérence suivent, seules ; la note les liste.
    platform.active = `${ROOT}/Pièces/Appel d'offres/CCTP.md`
    await run('ao-extraire-exigences')
    expect(read(platform, `${ROOT}/Analyse/Qualité des exigences.md`)).toContain('| Exigences | 3 |')
    expect(read(platform, `${ROOT}/Analyse/Vérification des exigences.md`)).toContain('Cohérence')
    expect(read(platform, analysis.note)).toContain('EX-SOL-001')
    const journal = read(platform, 'Black Projects/Workflows/Journal des workflows.md')
    expect(journal).toMatch(/✅ fait · \*\*Contrôler les exigences extraites \(qualité et cohérence\)\*\* · sur « Station sol »/)
    expect(journal).toMatch(/✅ fait · \*\*Relever le calendrier à l’import des pièces\*\*/)
    expect(journal).toMatch(/✅ fait · \*\*Note de l’analyse : le tableau des pièces, à l’import\*\*/)
    // Un workflow système réussi ne prévient pas à chaque fois (le journal le garde).
    expect(platform.notices.some((notice) => /^Workflow « Relever le calendrier/.test(notice))).toBe(false)
  })

  it('la note de l’analyse sans son workflow système (désactivé) : elle n’est plus mise à jour à l’import', async () => {
    const platform = memoryPlatform()
    const { run, analysis, settings } = await start(platform)
    settings.workflows!.workflows = (settings.workflows!.workflows as Workflow[]).map((workflow) => (workflow.system === 'sys.ao.note-pieces' ? { ...workflow, enabled: false } : workflow))
    const before = read(platform, analysis.note)
    for (const name of ['RC.html']) platform.files.set(`${TENDER}/${name}`, new Uint8Array(readFileSync(folder + name)))
    platform.active = analysis.note
    await run('ao-mettre-a-jour')
    expect(read(platform, analysis.note)).toBe(before)
  })

  it('écrit à la main : interroger le dossier avec l’IA, puis noter la réponse', async () => {
    const platform = memoryPlatform()
    const { run, analysis, workflows } = await start(platform, { adresse: 'http://ia.exemple/v1', modele: 'mistral' })
    for (const name of ['RC.html', 'CCTP.docx']) platform.files.set(`${TENDER}/${name}`, new Uint8Array(readFileSync(folder + name)))
    platform.active = analysis.note
    await run('ao-mettre-a-jour')

    // Nouveau → de zéro (à la main) → Actions : interroger le dossier, puis ajouter à une note.
    platform.choices.push('actions', 'add', 'ao.interroger', 'add', 'ajouter-note', 'back', 'close')
    platform.forms.push(
      { name: 'Critères', trigger: 'ao.pieces-importees', mode: 'auto' },
      { analyse: '{analyse}', question: 'Quels sont les critères d’attribution ?', mode: 'search' },
      { chemin: 'Suivi/{analyse}', texte: '- {today} : {step1.text} ({step1.link})', position: 'fin' }
    )
    await run('workflows-nouveau')
    const criteria = workflows().find((workflow) => workflow.name === 'Critères')!
    expect(criteria.actions.map((action) => action.kind)).toEqual(['ao.interroger', 'ajouter-note'])

    // Exécuté à la main depuis la palette : l'analyse est demandée (une seule : prise d'office).
    platform.httpAnswers.push(chat('Valeur technique 60 % et prix 40 % [1].'))
    platform.choices.push(criteria.id)
    await run('workflows-executer')
    const note = read(platform, 'Suivi/Station sol.md')
    expect(note).toMatch(/^- \d{4}-\d{2}-\d{2} : Valeur technique 60 % et prix 40 % \[1\]\. \(\[\[.*Analyse\/Questions\/.*\]\]\)\n$/)
    expect(platform.notices.at(-1)).toBe('Workflow « Critères » exécuté (2 étape(s)).')
  })

  it('le rappel des dates limites : les analyses dont la remise tombe dans les jours dits', async () => {
    const platform = memoryPlatform()
    const { run, analysis, workflows, settings } = await start(platform)
    for (const name of ['RC.html', 'CCTP.docx']) platform.files.set(`${TENDER}/${name}`, new Uint8Array(readFileSync(folder + name)))
    platform.active = analysis.note
    await run('ao-mettre-a-jour')
    // La remise du dossier d'exemple : le 15 janvier 2027 ; à combien de jours d'aujourd'hui ?
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const days = Math.round((Date.parse('2027-01-15T00:00:00Z') - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    settings.workflows!.workflows = workflows().map((workflow) => (workflow.system === 'sys.ao.rappel-remises' ? { ...workflow, actions: [{ kind: 'ao.rappel-remises', fields: { jours: `${days}` } }] } : workflow))
    platform.choices.push('sys.ao.rappel-remises')
    await run('workflows-executer')
    expect(platform.notices).toContain(`Station sol : remise dans ${days} jour(s), le 2027-01-15.`)
    // Hors des jours dits : rien n'est montré, le journal dit « aucune ».
    settings.workflows!.workflows = workflows().map((workflow) => (workflow.system === 'sys.ao.rappel-remises' ? { ...workflow, actions: [{ kind: 'ao.rappel-remises', fields: { jours: `${days + 1}` } }] } : workflow))
    const before = platform.notices.length
    platform.choices.push('sys.ao.rappel-remises')
    await run('workflows-executer')
    expect(platform.notices.slice(before).some((notice) => /remise dans/.test(notice))).toBe(false)
    expect(read(platform, 'Black Projects/Workflows/Journal des workflows.md')).toContain('Aucune remise à rappeler aujourd’hui.')
  })

  it('le rappel du rangement : plus à l’activation, mais par son workflow système à l’ouverture', async () => {
    const platform = memoryPlatform()
    await start(platform, {}, { rappelOuverture: true })
    // À l'activation : rien (le module Workflows est là) ; à l'ouverture : le rappel.
    expect(platform.messages).toEqual([])
    await runOpeningWorkflows()
    expect(platform.messages.map((message) => message.title)).toEqual(['Rappel : aucun type de pièce rangé'])
  })

  it('traduire les nouvelles exigences (désactivé d’origine) : activé, une exigence créée est traduite, à relire', async () => {
    const platform = memoryPlatform()
    const { run, workflows, settings } = await start(platform, { adresse: 'http://ia.exemple/v1', modele: 'mistral' })
    settings.workflows!.workflows = workflows().map((workflow) => (workflow.system === 'sys.exigences.traduire-nouvelles' ? { ...workflow, enabled: true } : workflow))
    platform.forms.push({ category: 'sys', title: 'Démarrage', text: 'Le système doit démarrer en 5 s.', type: 'performance', status: 'draft', criticality: 'high', verification: 'test', source: '', rationale: '' })
    platform.httpAnswers.push(chat(JSON.stringify({ text: 'The system shall start within 5 s.', notes: '' })))
    await run('exigences-nouvelle')
    const note = read(platform, 'Exigences/REQ-SYS-0001 Démarrage.md')
    expect(note).toContain('The system shall start within 5 s.')
    expect(note).toMatch(/origin: machine/)
    expect(read(platform, 'Black Projects/Workflows/Journal des workflows.md')).toMatch(/✅ fait · \*\*Traduire les nouvelles exigences \(IA\)\*\*/)
  })
})
