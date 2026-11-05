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
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))
const MODULES = [lectureFichiersModule, typagePiecesModule, exigencesModule, iaModule, workflowsModule, aoModule]
const ROOT = "Appels d'offres/Station sol"
const TENDER = `${ROOT}/Pièces/Appel d'offres/Originaux`

async function start(platform: MemoryPlatform, ia: Record<string, unknown> = {}) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false }, ia }
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
    workflows: () => (settings.workflows?.workflows ?? []) as Workflow[]
  }
}

const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: string) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) })

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('les workflows et l’analyse d’appels d’offres', () => {
  it('prêts à l’emploi : calendrier à l’import des pièces, qualité à l’extraction des exigences', async () => {
    const platform = memoryPlatform()
    const { run, analysis, workflows } = await start(platform)
    // Les modèles proposés par les modules.
    platform.choices.push('ao.import-calendrier', 'close')
    await run('workflows-nouveau')
    expect(platform.offered[0]!.map((choice) => choice.value)).toEqual(
      expect.arrayContaining(['', 'ao.import-calendrier', 'ao.extraction-qualite', 'ao.questionnaire-ia', 'exigences.qualite-hebdo'])
    )
    platform.choices.push('ao.extraction-qualite', 'close')
    await run('workflows-nouveau')
    expect(workflows().map((workflow) => workflow.trigger.kind)).toEqual(['ao.pieces-importees', 'ao.exigences-extraites'])

    // Le RC et le CCTP déposés à la main, puis « Mettre à jour l'analyse ».
    for (const name of ['RC.html', 'CCTP.docx']) platform.files.set(`${TENDER}/${name}`, new Uint8Array(readFileSync(folder + name)))
    platform.active = analysis.note
    await run('ao-mettre-a-jour')
    const calendar = read(platform, `${ROOT}/Analyse/Calendrier.md`)
    expect(calendar).toContain('**Date limite de remise des offres** : vendredi 15 janvier 2027')
    expect(platform.notices).toContain(
      'Calendrier de Station sol relevé : 2 date(s), 1 délai(s) dans 2 pièce(s).'
    )

    // Les exigences du CCTP extraites : la qualité et la cohérence suivent, seules.
    platform.active = `${ROOT}/Pièces/Appel d'offres/CCTP.md`
    await run('ao-extraire-exigences')
    expect(read(platform, `${ROOT}/Analyse/Qualité des exigences.md`)).toContain('| Exigences | 3 |')
    expect(read(platform, `${ROOT}/Analyse/Vérification des exigences.md`)).toContain('Cohérence')
    const journal = read(platform, 'Black Projects/Workflows/Journal des workflows.md')
    expect(journal).toMatch(/✅ fait · \*\*À l’extraction des exigences : qualité et cohérence\*\* · sur « Station sol »/)
    expect(journal).toMatch(/✅ fait · \*\*À l’import des pièces : relever le calendrier\*\*/)
  })

  it('écrit à la main : interroger le dossier avec l’IA, puis noter la réponse', async () => {
    const platform = memoryPlatform()
    const { run, analysis, workflows } = await start(platform, { adresse: 'http://ia.exemple/v1', modele: 'mistral' })
    for (const name of ['RC.html', 'CCTP.docx']) platform.files.set(`${TENDER}/${name}`, new Uint8Array(readFileSync(folder + name)))
    platform.active = analysis.note
    await run('ao-mettre-a-jour')

    // Nouveau → de zéro (à la main) → Actions : interroger le dossier, puis ajouter à une note.
    platform.choices.push('', 'actions', 'add', 'ao.interroger', 'add', 'ajouter-note', 'back', 'close')
    platform.forms.push(
      { name: 'Critères', trigger: 'ao.pieces-importees', mode: 'auto' },
      { analyse: '{analyse}', question: 'Quels sont les critères d’attribution ?', mode: 'search' },
      { chemin: 'Suivi/{analyse}', texte: '- {today} : {step1.text} ({step1.link})', position: 'fin' }
    )
    await run('workflows-nouveau')
    expect(workflows()[0]!.actions.map((action) => action.kind)).toEqual(['ao.interroger', 'ajouter-note'])

    // Exécuté à la main depuis la palette : l'analyse est demandée (une seule : prise d'office).
    platform.httpAnswers.push(chat('Valeur technique 60 % et prix 40 % [1].'))
    platform.choices.push(workflows()[0]!.id)
    await run('workflows-executer')
    const note = read(platform, 'Suivi/Station sol.md')
    expect(note).toMatch(/^- \d{4}-\d{2}-\d{2} : Valeur technique 60 % et prix 40 % \[1\]\. \(\[\[.*Analyse\/Questions\/.*\]\]\)\n$/)
    expect(platform.notices.at(-1)).toBe('Workflow « Critères » exécuté (2 étape(s)).')
  })
})
