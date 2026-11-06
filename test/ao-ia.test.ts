// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/// <reference types="node" />

/**
 * Jalon de démo n° 4 : l'IA relit, conseille et répond en citant ses sources — sur le
 * dossier d'exemple (CCTP en Word, RC en HTML), un serveur compatible OpenAI simulé.
 * Le calendrier, lui, est relevé sans IA.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'
import { exigencesModule } from '../src/modules/exigences'
import { iaModule } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))
const MODULES = [lectureFichiersModule, typagePiecesModule, exigencesModule, iaModule, aoModule]
const ROOT = "Appels d'offres/Station sol"

async function start(platform: MemoryPlatform, ia: Record<string, unknown>) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {
    ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false },
    ia
  }
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
  const analysis = await createAnalysis(services, 'Station sol', { position: 'emetteur', buyer: 'CNES', reference: '' })
  const report = await importFiles(services, analysis, [
    { name: 'CCTP.docx', bytes: new Uint8Array(readFileSync(folder + 'CCTP.docx')) },
    { name: 'RC.html', bytes: new Uint8Array(readFileSync(folder + 'RC.html')) }
  ])
  const run = (id: string) => commands.get(id)!.run()
  // Les exigences du CCTP, extraites (aperçu accepté tel quel).
  platform.active = report.imported.find((piece) => piece.note.includes('CCTP'))!.note
  await run('ao-extraire-exigences')
  platform.active = analysis.note
  return { run, analysis }
}

const chat = (content: unknown) => ({
  status: 200,
  text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] })
})
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small' }

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('jalon n° 4 — l’IA relit, conseille et répond en citant ses sources', () => {
  it('le calendrier, sans IA : remise du RC, livraison du CCTP, avec leur phrase', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform, {})
    await run('ao-calendrier')
    const note = await platform.fs.readText(`${ROOT}/Analyse/Calendrier.md`)
    expect(note).toMatch(/\*\*Date limite de remise des offres\*\* : vendredi 15 janvier 2027 — « La date limite de remise des offres est fixée au 15 janvier 2027/)
    expect(note).toMatch(/\| 2027-06-30 \| Livraison, recette \| La livraison intervient sous 15 jours après la notification, et au plus tard le 30 juin 2027\. \| .*CCTP/)
    expect(note).toMatch(/\| sous 15 jours après la notification[^|]* \| Livraison, recette \|/)
    expect(platform.requests).toHaveLength(0)
  })

  it('interroger le dossier : la réponse cite le RC, qui est lié', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform, SERVEUR)
    platform.forms.push({ question: 'Quels sont les critères d’attribution ?', mode: 'search' })
    platform.httpAnswers.push(chat('Valeur technique 60 % et prix 40 % [1].'))
    await run('ao-interroger')
    const sent = JSON.parse(platform.requests[0]!.body!) as { model: string; messages: { content: string }[] }
    expect(sent.model).toBe('mistral-small')
    expect(sent.messages[1]!.content).toMatch(/### Source \[1\] — RC\n/)
    const note = await platform.fs.readText(platform.opened.at(-1)!)
    expect(note).toMatch(/Valeur technique 60 % et prix 40 % \\\[\[\[Appels d'offres\/Station sol\/Pièces\/Appel d'offres\/RC\|1\]\]\\\]\./)
    expect(note).toMatch(/1\. \[\[.*\/RC\|RC\]\] — RC · Appel d’offres — \*citée\*/)
  })

  it('relire : côté émetteur, la reformulation retenue devient la formulation', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform, SERVEUR)
    // EX-SOL-003 (« le cas échéant ») est la plus faible, cochée d'avance.
    platform.httpAnswers.push(
      chat({
        assessment: 'Le seuil est mesurable, mais « le cas échéant » laisse le titulaire juge de l’appliquer.',
        findings: [],
        proposals: [{ axis: 'unambiguous', action: 'Retirer « le cas échéant ».', rewrite: 'Le système doit être disponible 99,5 % du temps.' }]
      })
    )
    platform.choices.push('0')
    await run('ao-relire-exigences-ia')
    expect(platform.manyAsked.at(-1)!.selected).toHaveLength(1)
    const path = platform.manyAsked.at(-1)!.selected![0]!
    expect(path).toContain('EX-SOL-003')
    const note = await platform.fs.readText(path)
    expect(note).toContain('Le système doit être disponible 99,5 % du temps.\n')
    expect(note).toContain('laisse le titulaire juge')
    expect(platform.notices.at(-1)).toBe('1 exigence(s) relue(s), 1 reformulée(s). La relecture se lit sur la fiche de chaque exigence (et dans sa note).')
  })

  it('la qualité, avec un modèle d’embeddings : les doublons par le sens en plus', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform, { ...SERVEUR, modeleEmbeddings: 'bge-m3' })
    // EX-SOL-001 et EX-SOL-002 proches par le sens (simulé), EX-SOL-003 à part.
    platform.httpAnswers.push({
      status: 200,
      text: JSON.stringify({ data: [{ index: 0, embedding: [1, 0, 0] }, { index: 1, embedding: [0.99, 0.1, 0] }, { index: 2, embedding: [0, 0, 1] }] })
    })
    await run('ao-qualite-exigences')
    expect(JSON.parse(platform.requests[0]!.body!).model).toBe('bge-m3')
    const note = await platform.fs.readText(`${ROOT}/Analyse/Qualité des exigences.md`)
    expect(note).toMatch(/EX-SOL-001.*\| .*EX-SOL-002.* \| 99 % \(par le sens\) \|/)
  })
})
