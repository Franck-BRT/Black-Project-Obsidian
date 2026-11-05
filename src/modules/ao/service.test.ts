// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { utf8, zip } from '../../core/formats/zip'
import { parseFrontmatter } from '../../core/frontmatter'
import { createI18n } from '../../core/i18n'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { buildXlsx } from '../../core/writers/xlsx'
import { typagePiecesModule } from '../typage-pieces'
import { aoFr } from './i18n'
import { PIECES_END, PIECES_START } from './notes'
import {
  AnalysisExists,
  analysisOf,
  createAnalysis,
  importFiles,
  listAnalyses,
  pieceAt,
  refreshTable,
  setPieceType,
  updateAnalysis,
  type Services
} from './service'

function setup(files: Record<string, string | Uint8Array> = {}) {
  const platform = memoryPlatform(files)
  const i18n = createI18n('fr')
  i18n.register('fr', aoFr)
  i18n.register('fr', typagePiecesModule.texts.fr)
  const services: Services = {
    fs: platform.fs,
    t: (key, vars) => i18n.t(key, vars),
    root: "Appels d'offres",
    today: () => '2026-11-05'
  }
  return { platform, services }
}

const CCTP = '# CCTP\n\nEX-1 — Le titulaire doit fournir une antenne.'

describe('analyses', () => {
  it('crée une analyse : sa note, et la retrouve', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'CNES', reference: '2026-42' })
    expect(analysis).toEqual({
      name: 'Station sol',
      folder: "Appels d'offres/Station sol",
      note: "Appels d'offres/Station sol/Station sol.md"
    })
    const note = await platform.fs.readText(analysis.note)
    expect(parseFrontmatter(note).data).toMatchObject({
      'bp-type': 'ao-analyse',
      position: 'candidat',
      acheteur: 'CNES',
      reference: '2026-42',
      creee: '2026-11-05'
    })
    expect(note).toContain('| Position | Candidat ou évaluateur — analyser un dossier reçu |')
    expect(note).toContain(PIECES_START)
    expect(await listAnalyses(services)).toEqual([analysis])
    expect(await analysisOf(services, "Appels d'offres/Station sol/Pièces/CCTP.md")).toEqual(analysis)
    expect(await analysisOf(services, 'Ailleurs/note.md')).toBeNull()
  })

  it('refuse de recréer une analyse existante', async () => {
    const { services } = setup()
    await createAnalysis(services, 'Station sol', { position: 'emetteur', buyer: '', reference: '' })
    await expect(createAnalysis(services, 'Station sol', { position: 'emetteur', buyer: '', reference: '' })).rejects.toBeInstanceOf(
      AnalysisExists
    )
  })
})

describe('import des pièces', () => {
  it('range, lit, type et décrit chaque pièce, et tient le tableau à jour', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'CNES', reference: '' })
    const report = await importFiles(services, analysis, [
      { name: '03_CCTP.md', bytes: utf8(CCTP) },
      { name: 'BPU.xlsx', bytes: buildXlsx([{ name: 'BPU', columns: [{ label: 'Poste', width: 8 }], rows: [['Antenne']] }]) },
      { name: 'Plan.dwg', bytes: utf8('binaire') },
      { name: 'Photo.png', bytes: utf8('png') },
      { name: 'Vide.txt', bytes: utf8('  ') }
    ])
    expect(report.imported.map((piece) => [piece.original.split('/').pop(), piece.type, piece.state])).toEqual([
      ['03_CCTP.md', 'CCTP', 'lue'],
      ['BPU.xlsx', 'BPU', 'lue'],
      ['Plan.dwg', 'AUTRE', 'non-lue'],
      ['Photo.png', 'AUTRE', 'image'],
      ['Vide.txt', 'AUTRE', 'sans-texte']
    ])
    // L'original est gardé tel quel, la note décrit la pièce.
    expect(await platform.fs.readText("Appels d'offres/Station sol/Pièces/Appel d'offres/Originaux/03_CCTP.md")).toBe(CCTP)
    const note = await platform.fs.readText("Appels d'offres/Station sol/Pièces/Appel d'offres/03_CCTP.md")
    expect(parseFrontmatter(note).data).toMatchObject({
      'bp-type': 'ao-piece',
      type: 'CCTP',
      lecture: 'lue',
      format: 'md',
      fichier: "[[Appels d'offres/Station sol/Pièces/Appel d'offres/Originaux/03_CCTP.md]]",
      analyse: "[[Appels d'offres/Station sol/Station sol]]"
    })
    // Le titre du texte extrait est descendu sous « Texte extrait ».
    expect(note).toContain('## Texte extrait\n\n### CCTP\n\nEX-1 — Le titulaire doit fournir une antenne.')

    const table = await platform.fs.readText(analysis.note)
    const inside = table.slice(table.indexOf(PIECES_START), table.indexOf(PIECES_END))
    expect(inside).toContain('5 pièce(s), dont 2 lue(s).')
    expect(inside).toContain("| [[Appels d'offres/Station sol/Pièces/Appel d'offres/03_CCTP\\|03_CCTP.md]] | CCTP — Cahier des clauses techniques particulières | 🟩 Lue |")
    expect(inside).toContain('| ⬜ Format non lu | — |')
  })

  it('ouvre un ZIP, garde son arborescence, et n’importe pas deux fois le même fichier', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'AO', { position: 'candidat', buyer: '', reference: '' })
    const archive = zip([
      { name: 'DCE/RC.md', data: utf8('# Règlement\n\nRemise le 15 janvier 2027.') },
      { name: 'DCE/Technique/CCTP.md', data: utf8(CCTP) },
      { name: '__MACOSX/DCE/._RC.md', data: utf8('x') }
    ])
    const first = await importFiles(services, analysis, [{ name: 'DCE complet.zip', bytes: archive }])
    expect(first.archives).toBe(1)
    expect(first.imported.map((piece) => piece.original)).toEqual([
      "Appels d'offres/AO/Pièces/Appel d'offres/Originaux/DCE complet/DCE/RC.md",
      "Appels d'offres/AO/Pièces/Appel d'offres/Originaux/DCE complet/DCE/Technique/CCTP.md"
    ])
    expect(first.imported.map((piece) => piece.type)).toEqual(['RC', 'CCTP'])

    const again = await importFiles(services, analysis, [{ name: 'DCE complet.zip', bytes: archive }])
    expect(again.imported).toEqual([])
    expect(again.duplicates).toHaveLength(2)

    // Un fichier différent du même nom est gardé à côté, et sa note aussi.
    const other = await importFiles(services, analysis, [{ name: 'RC.md', bytes: utf8('# Autre') }, { name: 'RC.md', bytes: utf8('# Encore') }])
    expect(other.imported.map((piece) => piece.note.split('/').pop())).toEqual(['RC (md).md', 'RC (2).md'])
    expect(await platform.fs.exists("Appels d'offres/AO/Pièces/Appel d'offres/Originaux/RC (2).md")).toBe(true)
  })

  it('dit quand une archive est illisible', async () => {
    const { services } = setup()
    const analysis = await createAnalysis(services, 'AO', { position: 'candidat', buyer: '', reference: '' })
    const report = await importFiles(services, analysis, [{ name: 'abîmé.zip', bytes: utf8('pas un zip') }])
    expect(report.brokenArchives).toEqual(['abîmé.zip'])
    expect(report.imported).toEqual([])
  })
})

describe('mise à jour et type des pièces', () => {
  it('décrit les fichiers déposés à la main, une seule fois', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'AO', { position: 'candidat', buyer: '', reference: '' })
    await platform.fs.writeText("Appels d'offres/AO/Pièces/Originaux/CCAP.md", '# CCAP\n\nPénalités : 1 % par jour.')
    await platform.fs.writeText("Appels d'offres/AO/Pièces/Originaux/Lot 2/DPGF.csv", 'Poste;Prix\n1;')
    const report = await updateAnalysis(services, analysis)
    expect(report.imported.map((piece) => piece.type).sort()).toEqual(['CCAP', 'DPGF'])
    expect((await updateAnalysis(services, analysis)).imported).toEqual([])
  })

  it('change le type d’une pièce, et le tableau suit', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'AO', { position: 'candidat', buyer: '', reference: '' })
    const [piece] = (await importFiles(services, analysis, [{ name: 'document.md', bytes: utf8('Texte quelconque') }])).imported
    expect(piece?.type).toBe('AUTRE')
    expect(await pieceAt(services, piece!.note)).toMatchObject({ analysis, type: 'AUTRE', destination: { place: 'appel-d-offres' } })
    await setPieceType(services, piece!.note, 'ANNEXE')
    expect(parseFrontmatter(await platform.fs.readText(piece!.note)).data.type).toBe('ANNEXE')
    expect(await platform.fs.readText(analysis.note)).toContain('| ANNEXE — Annexe |')
    expect(await pieceAt(services, analysis.note)).toBeNull()
  })

  it('remet le tableau s’il a été effacé de la note, sans toucher aux notes de l’utilisateur', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'AO', { position: 'candidat', buyer: '', reference: '' })
    await platform.fs.writeText(analysis.note, '---\nbp-type: ao-analyse\n---\n# AO\n\nMes remarques.')
    await refreshTable(services, analysis)
    const note = await platform.fs.readText(analysis.note)
    expect(note).toContain('Mes remarques.')
    expect(note).toContain(PIECES_START)
  })
})

describe('noms des notes et ordre du tableau', () => {
  it('distingue une même pièce en plusieurs formats, et range le tableau dans l’ordre d’un dossier', async () => {
    const { platform, services } = setup()
    const analysis = await createAnalysis(services, 'AO', { position: 'candidat', buyer: '', reference: '' })
    const report = await importFiles(services, analysis, [
      { name: 'Annexe.md', bytes: utf8('# Annexe') },
      { name: 'CCTP.md', bytes: utf8(CCTP) },
      { name: 'CCTP.txt', bytes: utf8(CCTP) },
      { name: 'RC.md', bytes: utf8('# RC') }
    ])
    expect(report.imported.map((piece) => piece.note.split('/').pop())).toEqual(['Annexe.md', 'CCTP.md', 'CCTP (txt).md', 'RC.md'])
    const note = await platform.fs.readText(analysis.note)
    const at = (label: string) => note.indexOf(`|${label}]]`)
    expect(at('RC.md')).toBeGreaterThan(0)
    expect(at('RC.md')).toBeLessThan(Math.min(at('CCTP.md'), at('CCTP.txt')))
    expect(Math.max(at('CCTP.md'), at('CCTP.txt'))).toBeLessThan(at('Annexe.md'))
  })
})
