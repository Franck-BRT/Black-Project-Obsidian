// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que fait le module, sans fenêtre : créer une analyse, y importer des pièces, la
 * mettre à jour, changer le type d'une pièce. Les commandes (`index.ts`) ne font que
 * demander à l'utilisateur ce qu'il faut, puis appeler ces fonctions — qui se testent
 * donc sur un coffre en mémoire.
 */

import { parseFrontmatter, setFrontmatterField } from '../../core/frontmatter'
import type { ExternalFile, FileSystem } from '../../core/ports'
import { FileReadError, fileText, isArchive, isImage, isReadable, readArchive } from '../lecture-fichiers'
import {
  ANALYSIS,
  ANALYSIS_TYPE,
  analysisAt,
  analysisNote,
  linkTarget,
  originalsFolder,
  PIECE_TYPE,
  pieceNote,
  piecesFolder,
  piecesTable,
  READING_STATES,
  REQUIREMENTS,
  withPiecesTable,
  type Analysis,
  type AnalysisFields,
  type PieceRow,
  type ReadingState
} from './notes'
import { currentCode } from './keywords'
import { classifyPiece, NO_CUSTOM_KEYWORDS, OTHER, type CustomKeywords } from './pieces'

export type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface Services {
  fs: FileSystem
  t: Translate
  /** Le dossier des analyses. */
  root: string
  /** La date du jour, AAAA-MM-JJ. */
  today: () => string
  /** Les mots-clés ajoutés par l'utilisateur à la reconnaissance des types. */
  keywords?: CustomKeywords
  /** Les codes de types renommés (ancien → nouveau) : les pièces à l'ancien code sont retypées. */
  renames?: Readonly<Record<string, string>>
}

export function localToday(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// ── Les analyses ────────────────────────────────────────────────────────────────

async function isAnalysis(fs: FileSystem, analysis: Analysis): Promise<boolean> {
  if (!(await fs.exists(analysis.note))) return false
  return parseFrontmatter(await fs.readText(analysis.note)).data['bp-type'] === ANALYSIS_TYPE
}

/** Les analyses du dossier des analyses, par ordre alphabétique. */
export async function listAnalyses(services: Services): Promise<Analysis[]> {
  const { fs, root } = services
  if (!(await fs.exists(root))) return []
  const { folders } = await fs.list(root)
  const found: Analysis[] = []
  for (const folder of folders) {
    const analysis = analysisAt(root, folder.slice(folder.lastIndexOf('/') + 1))
    if (await isAnalysis(fs, analysis)) found.push(analysis)
  }
  return found.sort((a, b) => a.name.localeCompare(b.name))
}

/** L'analyse dont fait partie une note ou un fichier du coffre, s'il y en a une. */
export async function analysisOf(services: Services, path: string | null): Promise<Analysis | null> {
  if (!path) return null
  const prefix = `${services.root}/`
  if (!path.startsWith(prefix)) return null
  const name = path.slice(prefix.length).split('/')[0]
  if (!name) return null
  const analysis = analysisAt(services.root, name)
  return (await isAnalysis(services.fs, analysis)) ? analysis : null
}

export class AnalysisExists extends Error {}

/** Crée le dossier d'une analyse et sa note. */
export async function createAnalysis(services: Services, name: string, fields: Omit<AnalysisFields, 'created'>): Promise<Analysis> {
  const { fs, t } = services
  const analysis = analysisAt(services.root, name)
  if (await fs.exists(analysis.folder)) throw new AnalysisExists(name)
  await fs.ensureFolder(originalsFolder(analysis))
  await fs.ensureFolder(`${analysis.folder}/${REQUIREMENTS}`)
  await fs.ensureFolder(`${analysis.folder}/${ANALYSIS}`)
  await fs.writeText(analysis.note, analysisNote(analysis, { ...fields, created: services.today() }, t))
  return analysis
}

// ── Les pièces ──────────────────────────────────────────────────────────────────

export interface ImportedPiece {
  note: string
  original: string
  type: string
  state: ReadingState
}

export interface ImportReport {
  imported: ImportedPiece[]
  /** Des fichiers déjà dans l'analyse, à l'identique : non importés une seconde fois. */
  duplicates: string[]
  /** Des archives ouvertes. */
  archives: number
  /** Des archives qui n'ont pas pu être ouvertes. */
  brokenArchives: string[]
}

function extensionOf(name: string): string {
  const base = name.slice(name.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return false
  return true
}

/** Un chemin libre : « CCTP.pdf », sinon « CCTP (2).pdf », « CCTP (3).pdf »… */
async function freePath(fs: FileSystem, path: string): Promise<string> {
  if (!(await fs.exists(path))) return path
  const slash = path.lastIndexOf('/')
  const dot = path.lastIndexOf('.')
  const [stem, ext] = dot > slash ? [path.slice(0, dot), path.slice(dot)] : [path, '']
  for (let index = 2; ; index++) {
    const candidate = `${stem} (${index})${ext}`
    if (!(await fs.exists(candidate))) return candidate
  }
}

/** Ce qu'on tire d'un fichier : son texte, ou pourquoi il n'y en a pas. */
async function readPiece(name: string, bytes: Uint8Array): Promise<{ state: ReadingState; text: string }> {
  const ext = extensionOf(name)
  if (isImage(ext)) return { state: 'image', text: '' }
  if (!isReadable(ext)) return { state: 'non-lue', text: '' }
  try {
    return { state: 'lue', text: await fileText(ext, bytes) }
  } catch (error) {
    if (error instanceof FileReadError && error.problem === 'empty') return { state: 'sans-texte', text: '' }
    if (error instanceof FileReadError && error.problem === 'unsupported') return { state: 'non-lue', text: '' }
    return { state: 'illisible', text: '' }
  }
}

/** La note d'une pièce déjà rangée dans les originaux : lue, typée, écrite. */
async function notePiece(services: Services, analysis: Analysis, original: string, bytes: Uint8Array): Promise<ImportedPiece> {
  const { fs, t } = services
  const name = original.slice(original.lastIndexOf('/') + 1)
  const { state, text } = await readPiece(name, bytes)
  const type = classifyPiece(name, text, services.keywords ?? NO_CUSTOM_KEYWORDS)
  // « CCTP.md » ; si le nom est pris par la même pièce dans un autre format, « CCTP (pdf).md » ;
  // ensuite seulement des numéros.
  const stem = name.replace(/\.[^.]+$/, '') || name
  const ext = extensionOf(name)
  const plain = `${piecesFolder(analysis)}/${stem}.md`
  const note =
    !(await fs.exists(plain)) || !ext ? await freePath(fs, plain) : await freePath(fs, `${piecesFolder(analysis)}/${stem} (${ext}).md`)
  await fs.writeText(
    note,
    pieceNote(
      { analysis, original, type, format: extensionOf(name), state, characters: text.length, imported: services.today() },
      text,
      t
    )
  )
  return { note, original, type, state }
}

/**
 * Importe des fichiers dans une analyse : chacun rangé dans les originaux, lu, typé, et
 * décrit par une note ; une archive est ouverte et chacun de ses fichiers importé.
 */
export async function importFiles(services: Services, analysis: Analysis, files: readonly ExternalFile[]): Promise<ImportReport> {
  const { fs } = services
  const report: ImportReport = { imported: [], duplicates: [], archives: 0, brokenArchives: [] }
  const entries: { path: string; bytes: Uint8Array }[] = []
  for (const file of files) {
    if (isArchive(extensionOf(file.name))) {
      try {
        const inner = await readArchive(file.bytes)
        report.archives++
        const folder = file.name.replace(/\.[^.]+$/, '')
        entries.push(...inner.map((entry) => ({ path: `${folder}/${entry.path}`, bytes: entry.bytes })))
      } catch {
        report.brokenArchives.push(file.name)
      }
    } else entries.push({ path: file.name, bytes: file.bytes })
  }

  for (const entry of entries) {
    const wanted = `${originalsFolder(analysis)}/${entry.path}`
    if ((await fs.exists(wanted)) && sameBytes(new Uint8Array(await fs.readBinary(wanted)), entry.bytes)) {
      report.duplicates.push(entry.path)
      continue
    }
    const original = await freePath(fs, wanted)
    await fs.writeBinary(original, entry.bytes.slice().buffer)
    report.imported.push(await notePiece(services, analysis, original, entry.bytes))
  }
  await refreshTable(services, analysis)
  return report
}

/** Tous les fichiers sous un dossier, sous-dossiers compris. */
async function filesUnder(fs: FileSystem, folder: string): Promise<string[]> {
  if (!(await fs.exists(folder))) return []
  const { files, folders } = await fs.list(folder)
  const nested = await Promise.all(folders.map((each) => filesUnder(fs, each)))
  return [...files, ...nested.flat()]
}

interface PieceNoteInfo {
  note: string
  original: string
  type: string
  state: ReadingState
  characters: number
}

/**
 * Les notes des pièces d'une analyse. Une pièce dont le type a été renommé (« PQA » devenu
 * « PAQ ») est retypée au passage, dans sa note ; `retyped` compte celles-là.
 */
async function pieceNotes(
  fs: FileSystem,
  analysis: Analysis,
  renames: Readonly<Record<string, string>> = {},
  retyped: { count: number } = { count: 0 }
): Promise<PieceNoteInfo[]> {
  const folder = piecesFolder(analysis)
  if (!(await fs.exists(folder))) return []
  const { files } = await fs.list(folder)
  const out: PieceNoteInfo[] = []
  for (const note of files.filter((file) => file.endsWith('.md'))) {
    const content = await fs.readText(note)
    const { data } = parseFrontmatter(content)
    if (data['bp-type'] !== PIECE_TYPE) continue
    const state = READING_STATES.includes(data.lecture as ReadingState) ? (data.lecture as ReadingState) : 'non-lue'
    // Un code inconnu — un type ajouté puis retiré — est gardé tel quel : le tableau le
    // signale, et l'utilisateur choisit un autre type s'il le veut.
    const written = (data.type ?? '').trim() || OTHER
    const type = currentCode(written, renames)
    if (type !== written) {
      await fs.writeText(note, setFrontmatterField(content, 'type', type))
      retyped.count++
    }
    out.push({ note, original: linkTarget(data.fichier ?? ''), type, state, characters: Number(data.caracteres) || 0 })
  }
  return out
}

/** Réécrit le tableau des pièces dans la note de l'analyse, d'après les notes des pièces. */
export async function refreshTable(services: Services, analysis: Analysis): Promise<PieceRow[]> {
  const { fs, t } = services
  const rows = await pieceNotes(fs, analysis, services.renames)
  const note = await fs.readText(analysis.note)
  const updated = withPiecesTable(note, piecesTable(rows, t, services.keywords ?? NO_CUSTOM_KEYWORDS))
  if (updated !== note) await fs.writeText(analysis.note, updated)
  return rows
}

/**
 * Applique les renommages de types à toutes les analyses : les pièces à un ancien code
 * prennent le nouveau, et les tableaux suivent. Rend le nombre de pièces retypées.
 */
export async function applyRenames(services: Services): Promise<number> {
  const retyped = { count: 0 }
  for (const analysis of await listAnalyses(services)) {
    await pieceNotes(services.fs, analysis, services.renames, retyped)
    await refreshTable(services, analysis)
  }
  return retyped.count
}

/**
 * Met une analyse à jour : les fichiers déposés à la main dans les originaux et qui n'ont
 * pas encore de note sont lus et décrits ; le tableau des pièces est réécrit.
 */
export async function updateAnalysis(services: Services, analysis: Analysis): Promise<ImportReport> {
  const { fs } = services
  const report: ImportReport = { imported: [], duplicates: [], archives: 0, brokenArchives: [] }
  const known = new Set((await pieceNotes(fs, analysis)).map((piece) => piece.original))
  for (const original of await filesUnder(fs, originalsFolder(analysis))) {
    if (known.has(original)) continue
    const bytes = new Uint8Array(await fs.readBinary(original))
    report.imported.push(await notePiece(services, analysis, original, bytes))
  }
  await refreshTable(services, analysis)
  return report
}

export class NotAPiece extends Error {}

/** La pièce décrite par une note, et son analyse. */
export async function pieceAt(services: Services, note: string): Promise<{ analysis: Analysis; type: string } | null> {
  if (!note.endsWith('.md') || !(await services.fs.exists(note))) return null
  const { data } = parseFrontmatter(await services.fs.readText(note))
  if (data['bp-type'] !== PIECE_TYPE) return null
  const analysis = await analysisOf(services, note)
  return analysis ? { analysis, type: data.type ?? OTHER } : null
}

/** Change le type d'une pièce, puis le tableau de son analyse. */
export async function setPieceType(services: Services, note: string, type: string): Promise<void> {
  const piece = await pieceAt(services, note)
  if (!piece) throw new NotAPiece(note)
  await services.fs.writeText(note, setFrontmatterField(await services.fs.readText(note), 'type', type))
  await refreshTable(services, piece.analysis)
}
