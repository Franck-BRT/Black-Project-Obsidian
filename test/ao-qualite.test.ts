// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/// <reference types="node" />

/**
 * Jalon de démo n° 3 : l'analyse de qualité complète des exigences du dossier, hors ligne,
 * sans serveur d'IA — répartition des notes, défauts, doublons, non vérifiables.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, BlockRenderer, ModuleCommand, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'
import { exigencesModule } from '../src/modules/exigences'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { typagePiecesModule } from '../src/modules/typage-pieces'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))
const MODULES = [lectureFichiersModule, typagePiecesModule, exigencesModule, aoModule]
const REPORT = "Appels d'offres/Station sol/Analyse/Qualité des exigences.md"

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false } }
  const commands = new Map<string, ModuleCommand>()
  const blocks = new Map<string, BlockRenderer>()
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: (command) => void commands.set(`${module.id}-${command.id}`, command) },
      blocks: { register: (language, render) => void blocks.set(language, render) }
    }
    await (module as BlackModule).activate(context)
  }
  const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => '2026-11-05' }
  return { run: (id: string) => commands.get(id)!.run(), services, blocks }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('la qualité des exigences du dossier', () => {
  it('le CCTP : notes, défauts, non vérifiables — sans IA', async () => {
    const platform = memoryPlatform()
    const { run, services } = await start(platform)
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: '', reference: '' })
    const report = await importFiles(services, analysis, [{ name: 'CCTP.docx', bytes: new Uint8Array(readFileSync(folder + 'CCTP.docx')) }])
    platform.active = report.imported[0]!.note
    await run('ao-extraire-exigences')
    platform.active = analysis.note
    await run('ao-qualite-exigences')

    const note = await platform.fs.readText(REPORT)
    expect(platform.opened.at(-1)).toBe(REPORT)
    expect(note).toContain('# Qualité des exigences — Station sol')
    expect(note).toContain('Notées sur leur seule rédaction')
    expect(note).toContain('| Exigences | 3 |')
    // EX-SOL-003 : « le cas échéant » est un terme vague, et aucune méthode de vérification.
    expect(note).toMatch(/\| terme vague \| 1 \| \[\[.*EX-SOL-003\\\|EX-SOL-003\]\] \(« le cas échéant »\) \|/)
    expect(note).toMatch(/## Exigences non vérifiables[\s\S]*EX-SOL-003\\\|EX-SOL-003\]\] \| pas de méthode de vérification \|/)
    expect(note).toContain('*Aucun doublon probable.*')
    expect(note).toMatch(/EX-SOL-001\\\|EX-SOL-001\]\] \| ★★★★★ 100 % \| — \|/)
    expect(platform.notices.at(-1)).toMatch(/^Qualité des exigences : 3 exigence\(s\), note moyenne \d+ %, 0 faible\(s\)\.$/)

    // Relancée : ce que l'utilisateur a écrit dans Notes est gardé.
    await platform.fs.writeText(REPORT, `${note}Ma remarque.\n`)
    await run('ao-qualite-exigences')
    expect(await platform.fs.readText(REPORT)).toContain('Ma remarque.')
  })
})

describe('la qualité de la bibliothèque', () => {
  it('le rapport, la note dans la liste, le filtre, et la colonne rating d’un bloc', async () => {
    const platform = memoryPlatform()
    const { run, blocks } = await start(platform)
    const form = (title: string, text: string, extra: Record<string, string> = {}) => ({
      category: 'SYS',
      title,
      text,
      type: 'performance',
      status: 'draft',
      criticality: 'high',
      verification: 'test',
      source: 'CCTP',
      rationale: '',
      ...extra
    })
    platform.forms.push(
      form('Démarrage', 'Le système doit démarrer en moins de 5 s.'),
      form('Démarrage bis', 'Le système doit démarrer en moins de 5 secondes.'),
      form('Vague', 'Le système doit être rapide et/ou robuste, TBD.', { verification: 'none' })
    )
    await run('exigences-nouvelle')
    await run('exigences-nouvelle')
    await run('exigences-nouvelle')

    await run('exigences-qualite')
    const note = await platform.fs.readText('Exigences/Qualité des exigences.md')
    expect(note).toContain('| Exigences | 3 |')
    expect(note).toContain('## Doublons probables')
    expect(note).toMatch(/REQ-SYS-0001\]\] — Le système doit démarrer en moins de 5 s\. \| .*REQ-SYS-0002.* \| \d+ % \|/)
    expect(note).toMatch(/\| à définir \| 1 \|/)
    expect(note).toMatch(/\| « et\/ou » \| 1 \|/)
    expect(note).toContain('## Rattachements')
    expect(note).toContain('| Sans méthode de vérification | 1 |')

    // La liste : la note en étoiles, et le filtre des faibles.
    platform.listAnswers.push(null)
    await run('exigences-liste')
    const view = platform.lists.at(-1)!
    expect(view.columns.at(-1)?.key).toBe('rating')
    expect(view.rows.find((row) => row.cells.id === 'REQ-SYS-0003')?.values?.rating).toBe('weak')
    expect(view.rows.find((row) => row.cells.id === 'REQ-SYS-0003')?.cells.rating).toMatch(/^★*☆+$/)

    // Le bloc : la colonne rating n'est plus un tiret.
    const rendered = await blocks.get('brt-req')!('REQ-SYS-0001\nfields: id, rating', 'Doc.md')
    expect(rendered.columns).toEqual(['Identifiant', 'Note'])
    expect(rendered.rows[0]?.cells[1]).toMatch(/^★+☆*$/)
  })
})
