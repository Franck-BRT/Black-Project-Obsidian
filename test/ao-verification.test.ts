// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/// <reference types="node" />

/**
 * Vérifier les exigences du dossier d'exemple : tout extraire, les exigences oubliées, la
 * cohérence entre les versions du CCTP, la couverture par un mémoire technique — chaque
 * vérification seule, puis les quatre ensemble, dans le rapport de l'analyse.
 */

import { localToday } from '../src/core/dates'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'
import { exigencesModule } from '../src/modules/exigences'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))
const MODULES = [lectureFichiersModule, typagePiecesModule, exigencesModule, aoModule]
const REPORT = "Appels d'offres/Station sol/Analyse/Vérification des exigences.md"

const memoire = [
  '# Mémoire technique',
  '',
  '## Antenne',
  '',
  'Conformément à EX-SOL-001, nous fournissons une antenne de 3,7 m.',
  '',
  '## Réception',
  '',
  'Notre station reçoit en bande S avec un débit de 2 Mbit/s.',
  ''
].join('\n')

// Une autre version du CCTP, qui a oublié EX-SOL-002, change EX-SOL-001 et ajoute une phrase normative.
const cctpBis = [
  '# CCTP — Station sol (version 2)',
  '',
  '## Article 2 — Exigences',
  '',
  '| Identifiant | Exigence |',
  '|---|---|',
  '| EX-SOL-001 | Le titulaire doit fournir une antenne de 4 m de diamètre. |',
  '',
  'EX-SOL-003 — Le système doit être disponible 99,5 % du temps, le cas échéant.',
  '',
  'Le titulaire devra assurer une formation de deux jours aux opérateurs.',
  ''
].join('\n')

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {
    ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false }
  }
  const commands = new Map<string, ModuleCommand>()
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: {
        get: () => settings[module.id] ?? {},
        save: async (values) => void (settings[module.id] = values),
        onChange: () => () => {}
      },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command) }
    }
    await (module as BlackModule).activate(context)
  }
  const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => '2026-11-05' }
  const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'CNES', reference: '' })
  // Le CCTP en Word et sa version 2 avec l'appel d'offres, le mémoire avec la réponse.
  await importFiles(
    services,
    analysis,
    [
      { name: 'CCTP.docx', bytes: new Uint8Array(readFileSync(folder + 'CCTP.docx')) },
      { name: 'CCTP v2.md', bytes: new TextEncoder().encode(cctpBis) },
      { name: 'Mémoire technique.md', bytes: new TextEncoder().encode(memoire) }
    ],
    async (request) => ({
      places: Object.fromEntries(request.pending.map((piece) => [piece.path, piece.path.startsWith('Mémoire') ? 'reponse' : 'appel-d-offres']))
    })
  )
  platform.active = analysis.note
  return { run: (id: string) => commands.get(id)!.run(), analysis }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('vérifier les exigences du dossier', () => {
  it('« Extraire les exigences de toutes les pièces » : un aperçu pour toutes, puis le rapport', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform)
    await run('ao-extraire-tout')
    const preview = platform.manyAsked.at(-1)!
    expect(preview.title).toBe('Exigences trouvées dans les pièces (5, 2 pièce(s))')
    expect(preview.choices.map((choice) => choice.label.split(' — ')[0])).toEqual([
      '[CCTP] EX-SOL-001',
      '[CCTP] EX-SOL-002',
      '[CCTP] EX-SOL-003',
      '[CCTP v2] EX-SOL-001',
      '[CCTP v2] EX-SOL-003'
    ])
    // Le même identifiant dans la seconde version est refusé : déjà vu plus haut.
    expect(preview.choices[3]?.description).toContain('Refusée : identifiant déjà vu plus haut')
    const report = await platform.fs.readText(REPORT)
    expect(report).toContain('## Extraction')
    expect(report).toContain('2 pièce(s) lue(s), 5 exigence(s) trouvée(s), 0 pièce(s) sans exigence. Importées : 3 nouvelle(s), 0 mise(s) à jour.')
    expect(platform.opened.at(-1)).toBe(REPORT)
  })

  it('« Chercher les exigences oubliées » : la phrase normative non reprise, proposée à l’ajout', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform)
    platform.manyAnswers.push(['0', '1', '2']) // l'extraction : les trois du Word
    await run('ao-extraire-tout')
    platform.manyAnswers.push(['0']) // l'ajout : la phrase oubliée
    await run('ao-exigences-oubliees')
    const proposed = platform.manyAsked.at(-1)!
    expect(proposed.title).toBe('Phrases qui ressemblent à des exigences (1) : cochez celles à ajouter')
    expect(proposed.selected).toEqual([])
    expect(proposed.choices[0]?.label).toBe('[CCTP v2] (identifiant attribué) — Le titulaire devra assurer une formation de deux jours aux opérateurs.')
    // Ajoutée sous le type de la pièce, puis plus rien d'oublié.
    expect(await platform.fs.exists("Appels d'offres/Station sol/Exigences/REQ-CCTP-0001.md")).toBe(true)
    expect(await platform.fs.readText(REPORT)).toContain('0 phrase(s) qui ressemblent à des exigences sans en être, dans 2 document(s) ; 1 ajoutée(s).')
  })

  it('« Vérifier la cohérence » : les écarts entre les deux versions du CCTP', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform)
    await run('ao-coherence-pieces')
    const report = await platform.fs.readText(REPORT)
    expect(report).toContain('2 constat(s) sur 2 pièce(s).')
    expect(report).toMatch(/\| Formulations différentes \| EX-SOL-001 \| .*CCTP.*CCTP v2.* \| « Le titulaire doit fournir une antenne de 3,7 m de diamètre. » ≠ « Le titulaire doit fournir une antenne de 4 m de diamètre. » \|/)
    expect(report).toMatch(/\| Absente de cette version \| EX-SOL-002 \| .*CCTP v2.* \|/)
  })

  it('« Vérifier la couverture » : citée, traitée, absente, avec l’endroit dans le mémoire', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform)
    platform.manyAnswers.push(['0', '1', '2'])
    await run('ao-extraire-tout')
    await run('ao-couverture-reponse')
    const report = await platform.fs.readText(REPORT)
    expect(report).toContain('3 exigence(s) : 1 citée(s), 1 traitée(s), 0 à vérifier, 1 absente(s).')
    expect(report).toMatch(/\| \[\[.*EX-SOL-001\\\|EX-SOL-001\]\] \| 🟩 Citée \| .*Mémoire technique.* — Antenne, paragraphe 1 \|/)
    expect(report).toMatch(/EX-SOL-002\]\] \| 🟩 Traitée \(\d+ %\) \| .*— Réception, paragraphe 1/)
    expect(report).toMatch(/EX-SOL-003\]\] \| 🟥 Absente \| — \|/)
  })

  it('« Vérifier les exigences du dossier » : les quatre, et le résumé', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform)
    await run('ao-verifier-exigences')
    const report = await platform.fs.readText(REPORT)
    for (const title of ['## Résumé', '## Extraction', '## Exigences oubliées', '## Cohérence entre pièces', '## Couverture par la réponse', '## Notes']) {
      expect(report).toContain(title)
    }
    expect(report).toContain(`- **Extraction** : ${localToday()} — 2 pièce(s) lue(s)`)
    expect(report).toContain(`- **Couverture par la réponse** : ${localToday()} — 3 exigence(s)`)
    expect(report).not.toContain('pas encore lancée')
    expect(platform.notices.at(-1)).toBe('Vérification des exigences terminée : voir le rapport.')
  })
})
