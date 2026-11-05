// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/// <reference types="node" />

/**
 * Jalon de démo n° 2 : les exigences du CCTP d'exemple extraites et tracées jusqu'à leur
 * pièce — rangées dans les exigences de l'analyse, chacune avec sa pièce et l'endroit ;
 * la pièce liste ses exigences ; l'analyse les tient toutes dans un tableau.
 */

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
  return { i18n, services, settings, run: (id: string) => commands.get(id)!.run() }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('les exigences du CCTP, extraites et tracées', () => {
  it('depuis la note de la pièce : aperçu, import, trace dans les deux sens', async () => {
    const platform = memoryPlatform()
    const { services, run } = await start(platform)
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'CNES', reference: '' })
    const report = await importFiles(services, analysis, [{ name: 'CCTP.docx', bytes: new Uint8Array(readFileSync(folder + 'CCTP.docx')) }])
    const piece = report.imported[0]!.note
    platform.active = piece

    await run('ao-extraire-exigences')

    // L'aperçu : les trois exigences, nouvelles, avec l'endroit où elles sont.
    const preview = platform.manyAsked.at(-1)!
    expect(preview.title).toBe('Exigences trouvées dans CCTP.docx (3)')
    expect(preview.intro).toContain('3 nouvelle(s), 0 à mettre à jour')
    expect(preview.choices.map((choice) => choice.label.split(' — ')[0])).toEqual(['EX-SOL-001', 'EX-SOL-002', 'EX-SOL-003'])
    expect(preview.choices[0]?.description).toContain('Nouvelle · Article 2 — Exigences, tableau 1, ligne 1')
    expect(platform.notices.at(-1)).toBe('CCTP.docx : 3 exigence(s) créée(s), 0 mise(s) à jour.')

    // Les exigences, dans le dossier de l'analyse, chacune avec sa pièce et l'endroit.
    const exigence = await platform.fs.readText("Appels d'offres/Station sol/Exigences/EX-SOL-001.md")
    expect(exigence).toContain('id: EX-SOL-001')
    expect(exigence).toContain('verification: inspection')
    expect(exigence).toContain(`piece: "[[${piece.replace(/\.md$/, '')}|CCTP]]"`)
    expect(exigence).toContain('locator: "Article 2 — Exigences, tableau 1, ligne 1"')
    expect(exigence).toContain('Le titulaire doit fournir une antenne de 3,7 m de diamètre.')
    expect(await platform.fs.readText("Appels d'offres/Station sol/Exigences/EX-SOL-003.md")).toMatch(/locator: "Article 2 — Exigences, paragraphe \d+"/)

    // La pièce liste ses exigences, avant son texte.
    const note = await platform.fs.readText(piece)
    expect(note).toContain('## Exigences extraites (3)')
    expect(note.indexOf('## Exigences extraites')).toBeLessThan(note.indexOf('## Texte extrait'))
    expect(note).toContain("- [[Appels d'offres/Station sol/Exigences/EX-SOL-002|EX-SOL-002]] — La station doit recevoir en bande S")

    // L'analyse les tient toutes, avec leur pièce.
    const analysisNote = await platform.fs.readText(analysis.note)
    expect(analysisNote).toContain('## Exigences du dossier')
    expect(analysisNote).toContain('3 exigence(s), rangées dans le dossier Exigences de l’analyse.')
    expect(analysisNote).toContain("| [[Appels d'offres/Station sol/Exigences/EX-SOL-001\\|EX-SOL-001]] | Le titulaire doit fournir")
    expect(analysisNote.indexOf('## Exigences du dossier')).toBeLessThan(analysisNote.indexOf('## Notes'))
  })

  it('une seconde extraction ne crée rien en double', async () => {
    const platform = memoryPlatform()
    const { services, run } = await start(platform)
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: '', reference: '' })
    const report = await importFiles(services, analysis, [{ name: 'CCTP.md', bytes: new Uint8Array(readFileSync(folder + 'CCTP.md')) }])
    platform.active = report.imported[0]!.note
    await run('ao-extraire-exigences')
    await run('ao-extraire-exigences')
    expect(platform.manyAsked.at(-1)?.intro).toContain('0 nouvelle(s), 0 à mettre à jour, 3 inchangée(s)')
    expect(platform.manyAsked.at(-1)?.selected).toEqual([])
  })

  it('depuis la note de l’analyse : choisir la pièce', async () => {
    const platform = memoryPlatform()
    const { services, run } = await start(platform)
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: '', reference: '' })
    const report = await importFiles(services, analysis, [
      { name: 'CCTP.pdf', bytes: new Uint8Array(readFileSync(folder + 'CCTP.pdf')) },
      { name: 'RC.html', bytes: new Uint8Array(readFileSync(folder + 'RC.html')) }
    ])
    platform.active = analysis.note
    platform.choices.push(report.imported.find((piece) => piece.original.endsWith('CCTP.pdf'))!.note)
    await run('ao-extraire-exigences')
    expect(platform.offered.at(-1)?.map((choice) => choice.label)).toEqual(['CCTP', 'RC'])
    expect(platform.notices.at(-1)).toBe('CCTP.pdf : 3 exigence(s) créée(s), 0 mise(s) à jour.')
  })
})

describe('importer des exigences dans la bibliothèque', () => {
  it('un CSV : sans identifiant, la catégorie est demandée ; l’origine nomme le fichier', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform)
    const csv = 'Exigence;Vérification;Priorité\nLe système doit démarrer en 5 s.;Essai;Haute\nLe système doit tenir 10 ans.;Analyse;Moyenne\n'
    platform.choices.push('computer')
    platform.externalFiles.push([{ name: 'Exigences client.csv', bytes: new TextEncoder().encode(csv) }])
    platform.forms.push({ category: 'cli' })
    await run('exigences-importer')
    expect(platform.manyAsked.at(-1)?.choices.map((choice) => choice.label)).toEqual([
      '(identifiant attribué) — Le système doit démarrer en 5 s.',
      '(identifiant attribué) — Le système doit tenir 10 ans.'
    ])
    const note = await platform.fs.readText('Exigences/REQ-CLI-0001.md')
    expect(note).toContain('verification: test')
    expect(note).toContain('criticality: high')
    expect(note).toContain('piece: Exigences client.csv')
    expect(note).toContain('locator: ligne 1')
    expect(await platform.fs.exists('Exigences/REQ-CLI-0002.md')).toBe(true)
  })

  it('un identifiant d’un autre format devient un alias', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform)
    platform.choices.push('computer')
    platform.externalFiles.push([{ name: 'spec.md', bytes: new TextEncoder().encode('# Spec\n\nSYS-12 — Le système doit tenir.\n') }])
    platform.forms.push({ category: 'SYS' })
    await run('exigences-importer')
    const note = await platform.fs.readText('Exigences/REQ-SYS-0001.md')
    expect(note).toContain('aliases:\n- SYS-12')
  })

  it('un fichier sans exigence le dit, et explique ce qui est reconnu', async () => {
    const platform = memoryPlatform()
    const { run } = await start(platform)
    platform.choices.push('computer')
    platform.externalFiles.push([{ name: 'rien.md', bytes: new TextEncoder().encode('# Rien\n\nDe la prose.') }])
    await run('exigences-importer')
    expect(platform.notices.at(-1)).toContain('Aucune exigence trouvée dans rien.md')
  })
})
