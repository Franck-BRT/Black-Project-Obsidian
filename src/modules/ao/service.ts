// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que fait le module, sans fenêtre : créer une analyse, y importer des pièces, la
 * mettre à jour, changer le type d'une pièce. Les commandes (`index.ts`) ne font que
 * demander à l'utilisateur ce qu'il faut, puis appeler ces fonctions — qui se testent
 * donc sur un coffre en mémoire.
 */

import { localToday } from '../../core/dates'
import { parseFrontmatter, setFrontmatterField } from '../../core/frontmatter'
import type { ExternalFile, FileSystem } from '../../core/ports'
import { FileReadError, fileText, isArchive, isImage, isReadable, readArchive } from '../lecture-fichiers'
import { classifyPiece, currentCode, currentTyping, OTHER, type CustomKeywords } from '../typage-pieces'
import {
  ANALYSIS,
  ANALYSIS_TYPE,
  analysisAt,
  analysisNote,
  destinationOf,
  linkTarget,
  ORIGINALS,
  PIECE_TYPE,
  pieceNote,
  piecesFolder,
  piecesTable,
  placeFolder,
  placeOriginals,
  POSITIONS,
  READING_STATES,
  REQUIREMENTS,
  RESPONSES,
  withPiecesTable,
  type Analysis,
  type AnalysisFields,
  type Destination,
  type PiecePlace,
  type PieceRow,
  type Position,
  type ReadingState
} from './notes'
import { placeOf, type Place } from './placement'

export { localToday }

export type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface Services {
  fs: FileSystem
  t: Translate
  /** Le dossier des analyses. */
  root: string
  /** La date du jour, AAAA-MM-JJ. */
  today: () => string
  /**
   * Ce que l'utilisateur a réglé dans le module Typage des pièces ; par défaut, ce qui y
   * est en vigueur. Donné explicitement par les tests.
   */
  keywords?: CustomKeywords
  /** Les codes de types renommés (ancien → nouveau) ; par défaut, ceux du module de typage. */
  renames?: Readonly<Record<string, string>>
  /** Où ranger chaque type (réglage `rangement` du module) ; par défaut, aucun : tout est demandé. */
  rangement?: Readonly<Record<string, Place>>
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
  await fs.ensureFolder(placeOriginals(analysis, { place: 'appel-d-offres' }))
  // Le candidat a une réponse, la sienne ; l'émetteur, celles des candidats, rangées par candidat.
  if (fields.position === 'candidat') await fs.ensureFolder(placeOriginals(analysis, { place: 'reponse' }))
  else await fs.ensureFolder(`${piecesFolder(analysis)}/${RESPONSES}`)
  await fs.ensureFolder(`${analysis.folder}/${REQUIREMENTS}`)
  await fs.ensureFolder(`${analysis.folder}/${ANALYSIS}`)
  await fs.writeText(analysis.note, analysisNote(analysis, { ...fields, created: services.today() }, t))
  return analysis
}

/** La position de l'analyse : candidat (une réponse, la sienne) ou émetteur (une réponse par candidat). */
export async function analysisPosition(fs: FileSystem, analysis: Analysis): Promise<Position> {
  const { data } = parseFrontmatter(await fs.readText(analysis.note))
  return POSITIONS.includes(data.position as Position) ? (data.position as Position) : 'candidat'
}

/** Les candidats dont l'émetteur a rangé une réponse, par ordre alphabétique. */
export async function listCandidates(fs: FileSystem, analysis: Analysis): Promise<string[]> {
  const folder = `${piecesFolder(analysis)}/${RESPONSES}`
  if (!(await fs.exists(folder))) return []
  const { folders } = await fs.list(folder)
  return folders.map((each) => each.slice(each.lastIndexOf('/') + 1)).sort((a, b) => a.localeCompare(b))
}

// ── Les pièces ──────────────────────────────────────────────────────────────────

export interface ImportedPiece {
  note: string
  original: string
  type: string
  state: ReadingState
  destination: Destination
}

export interface ImportReport {
  imported: ImportedPiece[]
  /** Des fichiers déjà dans l'analyse, à l'identique : non importés une seconde fois. */
  duplicates: string[]
  /** Des archives ouvertes. */
  archives: number
  /** Des archives qui n'ont pas pu être ouvertes. */
  brokenArchives: string[]
  /** L'utilisateur a renoncé quand on lui a demandé où ranger les pièces : rien n'a été écrit. */
  cancelled?: boolean
}

/** Une pièce dont le type va « dans les deux » : il faut demander où la ranger. */
export interface PendingPiece {
  path: string
  type: string
}

/** Ce qu'il faut demander à l'utilisateur avant de ranger les pièces. */
export interface PlacementRequest {
  position: Position
  /** Les pièces à ranger à la main : avec l'appel d'offres, ou avec la réponse. */
  pending: PendingPiece[]
  /** Des pièces vont certainement dans une réponse (leur type le dit). */
  responseCertain: boolean
  /** Émetteur : les candidats dont une réponse est déjà rangée. */
  candidates: string[]
}

export interface Placement {
  /** Chemin dans l'import → place choisie. */
  places: Record<string, PiecePlace>
  /** Émetteur : le candidat dont les pièces « réponse » sont la réponse. */
  candidate?: string
}

/** Demande à l'utilisateur où ranger les pièces ; `null` s'il renonce. */
export type PlacementResolver = (request: PlacementRequest) => Promise<Placement | null>

/** Sans personne à qui demander (les tests) : l'appel d'offres, et le premier candidat connu. */
const defaultResolver: PlacementResolver = async (request) => ({
  places: Object.fromEntries(request.pending.map((piece) => [piece.path, 'appel-d-offres' as const])),
  candidate: request.candidates[0] ?? 'Candidat'
})

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

/** Le chemin de la note d'une pièce : « CCTP.md », sinon « CCTP (pdf).md », ensuite des numéros. */
async function notePath(fs: FileSystem, folder: string, name: string): Promise<string> {
  const stem = name.replace(/\.[^.]+$/, '') || name
  const ext = extensionOf(name)
  const plain = `${folder}/${stem}.md`
  return !(await fs.exists(plain)) || !ext ? freePath(fs, plain) : freePath(fs, `${folder}/${stem} (${ext}).md`)
}

/** Écrit la note d'une pièce déjà rangée dans les originaux de sa destination. */
async function writePieceNote(
  services: Services,
  analysis: Analysis,
  destination: Destination,
  original: string,
  read: { state: ReadingState; text: string },
  type: string
): Promise<ImportedPiece> {
  const { fs, t } = services
  const name = original.slice(original.lastIndexOf('/') + 1)
  const note = await notePath(fs, placeFolder(analysis, destination), name)
  await fs.writeText(
    note,
    pieceNote(
      {
        analysis,
        destination,
        original,
        type,
        format: extensionOf(name),
        state: read.state,
        characters: read.text.length,
        imported: services.today()
      },
      read.text,
      t
    )
  )
  return { note, original, type, state: read.state, destination }
}

/**
 * Importe des fichiers dans une analyse. Chacun est lu et typé ; son type dit s'il va avec
 * l'appel d'offres ou avec la réponse ; quand il peut aller dans les deux — et, pour
 * l'émetteur, pour savoir de quel candidat est la réponse —, `resolve` le demande à
 * l'utilisateur, en une fois pour tout l'import. Puis chaque fichier est rangé dans les
 * originaux de sa destination et décrit par une note. Une archive est ouverte, et chacun
 * de ses fichiers importé.
 */
export async function importFiles(
  services: Services,
  analysis: Analysis,
  files: readonly ExternalFile[],
  resolve: PlacementResolver = defaultResolver
): Promise<ImportReport> {
  const { fs } = services
  const custom = services.keywords ?? currentTyping().custom
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

  // Lire et typer d'abord : la place dépend du type.
  const pieces = []
  for (const entry of entries) {
    const name = entry.path.slice(entry.path.lastIndexOf('/') + 1)
    const read = await readPiece(name, entry.bytes)
    const type = classifyPiece(name, read.text, custom)
    pieces.push({ ...entry, read, type, place: placeOf(type, services.rangement ?? {}) })
  }

  // Puis demander, une fois, ce que les types ne disent pas.
  const position = await analysisPosition(fs, analysis)
  const pending = pieces.filter((piece) => piece.place === 'les-deux').map((piece) => ({ path: piece.path, type: piece.type }))
  const responseCertain = pieces.some((piece) => piece.place === 'reponse')
  let placement: Placement = { places: {} }
  if (pending.length > 0 || (position === 'emetteur' && responseCertain)) {
    const answer = await resolve({ position, pending, responseCertain, candidates: await listCandidates(fs, analysis) })
    if (!answer) return { ...report, cancelled: true }
    placement = answer
  }

  for (const piece of pieces) {
    const place: PiecePlace = piece.place === 'les-deux' ? (placement.places[piece.path] ?? 'appel-d-offres') : piece.place
    const destination: Destination =
      place === 'reponse' && position === 'emetteur'
        ? { place, candidate: safeCandidate(placement.candidate) }
        : { place }
    const wanted = `${placeOriginals(analysis, destination)}/${piece.path}`
    if ((await fs.exists(wanted)) && sameBytes(new Uint8Array(await fs.readBinary(wanted)), piece.bytes)) {
      report.duplicates.push(piece.path)
      continue
    }
    const original = await freePath(fs, wanted)
    await fs.writeBinary(original, piece.bytes.slice().buffer)
    report.imported.push(await writePieceNote(services, analysis, destination, original, piece.read, piece.type))
  }
  await refreshTable(services, analysis)
  return report
}

/** Un nom de candidat utilisable comme nom de dossier. */
export function safeCandidate(name: string | undefined): string {
  const clean = (name ?? '')
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return clean || 'Candidat'
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
  destination: Destination
  original: string
  type: string
  state: ReadingState
  characters: number
}

/** Les notes sous `Pièces`, hors des originaux, à toute profondeur. */
async function notesUnder(fs: FileSystem, folder: string): Promise<string[]> {
  if (!(await fs.exists(folder))) return []
  const { files, folders } = await fs.list(folder)
  const nested = await Promise.all(
    folders.filter((each) => each.slice(each.lastIndexOf('/') + 1) !== ORIGINALS).map((each) => notesUnder(fs, each))
  )
  return [...files.filter((file) => file.endsWith('.md')), ...nested.flat()]
}

/**
 * Les notes des pièces d'une analyse, où qu'elles soient rangées. Une pièce dont le type a
 * été renommé (« PQA » devenu « PAQ ») est retypée au passage, dans sa note ; `retyped`
 * compte celles-là.
 */
async function pieceNotes(
  fs: FileSystem,
  analysis: Analysis,
  renames: Readonly<Record<string, string>> = {},
  retyped: { count: number } = { count: 0 }
): Promise<PieceNoteInfo[]> {
  const out: PieceNoteInfo[] = []
  for (const note of await notesUnder(fs, piecesFolder(analysis))) {
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
    // Une pièce d'avant la v0.4.1 n'a pas de place : elle compte avec l'appel d'offres.
    const destination: Destination =
      data.place === 'reponse' ? { place: 'reponse', ...(data.candidat ? { candidate: data.candidat } : {}) } : { place: 'appel-d-offres' }
    out.push({ note, destination, original: linkTarget(data.fichier ?? ''), type, state, characters: Number(data.caracteres) || 0 })
  }
  return out
}

/** Réécrit le tableau des pièces dans la note de l'analyse, d'après les notes des pièces. */
export async function refreshTable(services: Services, analysis: Analysis): Promise<PieceRow[]> {
  const { fs, t } = services
  const rows = await pieceNotes(fs, analysis, services.renames ?? currentTyping().renames)
  const note = await fs.readText(analysis.note)
  const updated = withPiecesTable(note, piecesTable(rows, t, services.keywords ?? currentTyping().custom))
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
    await pieceNotes(services.fs, analysis, services.renames ?? currentTyping().renames, retyped)
    await refreshTable(services, analysis)
  }
  return retyped.count
}

/**
 * Met une analyse à jour : les fichiers déposés à la main dans des originaux — ceux de
 * l'appel d'offres, de la réponse, ou d'un candidat — et qui n'ont pas encore de note sont
 * lus, typés et décrits, là où ils ont été déposés ; le tableau des pièces est réécrit.
 */
export async function updateAnalysis(services: Services, analysis: Analysis): Promise<ImportReport> {
  const { fs } = services
  const custom = services.keywords ?? currentTyping().custom
  const report: ImportReport = { imported: [], duplicates: [], archives: 0, brokenArchives: [] }
  const known = new Set((await pieceNotes(fs, analysis)).map((piece) => piece.original))
  for (const original of await filesUnder(fs, piecesFolder(analysis))) {
    const destination = destinationOf(analysis, original)
    if (!destination || known.has(original)) continue
    const name = original.slice(original.lastIndexOf('/') + 1)
    const read = await readPiece(name, new Uint8Array(await fs.readBinary(original)))
    const type = classifyPiece(name, read.text, custom)
    report.imported.push(await writePieceNote(services, analysis, destination, original, read, type))
  }
  await refreshTable(services, analysis)
  return report
}

export class NotAPiece extends Error {}

export interface PieceInfo {
  analysis: Analysis
  type: string
  destination: Destination
  original: string
}

/** La pièce décrite par une note, et son analyse. */
export async function pieceAt(services: Services, note: string): Promise<PieceInfo | null> {
  if (!note.endsWith('.md') || !(await services.fs.exists(note))) return null
  const { data } = parseFrontmatter(await services.fs.readText(note))
  if (data['bp-type'] !== PIECE_TYPE) return null
  const analysis = await analysisOf(services, note)
  if (!analysis) return null
  const destination: Destination =
    data.place === 'reponse' ? { place: 'reponse', ...(data.candidat ? { candidate: data.candidat } : {}) } : { place: 'appel-d-offres' }
  return { analysis, type: data.type ?? OTHER, destination, original: linkTarget(data.fichier ?? '') }
}

/** Change le type d'une pièce, puis le tableau de son analyse. */
export async function setPieceType(services: Services, note: string, type: string): Promise<void> {
  const piece = await pieceAt(services, note)
  if (!piece) throw new NotAPiece(note)
  await services.fs.writeText(note, setFrontmatterField(await services.fs.readText(note), 'type', type))
  await refreshTable(services, piece.analysis)
}

/**
 * Déplace une pièce vers une autre destination — de l'appel d'offres vers la réponse, ou
 * vers la réponse d'un autre candidat : son original et sa note changent de dossier, sa
 * note dit sa nouvelle place, et le tableau suit. Rend le nouveau chemin de la note.
 */
export async function movePiece(services: Services, note: string, destination: Destination): Promise<string> {
  const { fs } = services
  const piece = await pieceAt(services, note)
  if (!piece) throw new NotAPiece(note)
  const target: Destination =
    destination.place === 'reponse' && destination.candidate ? { place: 'reponse', candidate: safeCandidate(destination.candidate) } : destination
  const name = piece.original.slice(piece.original.lastIndexOf('/') + 1)
  let original = piece.original
  if (piece.original && (await fs.exists(piece.original))) {
    original = await freePath(fs, `${placeOriginals(piece.analysis, target)}/${name}`)
    await fs.rename(piece.original, original)
  }
  const newNote = await notePath(fs, placeFolder(piece.analysis, target), name)
  await fs.rename(note, newNote)
  let content = await fs.readText(newNote)
  // Les liens vers l'original : la plateforme les suit d'ordinaire ; on s'en assure.
  if (original !== piece.original) content = content.split(`[[${piece.original}`).join(`[[${original}`)
  content = setFrontmatterField(content, 'place', target.place)
  content = target.candidate ? setFrontmatterField(content, 'candidat', target.candidate) : removeField(content, 'candidat')
  await fs.writeText(newNote, content)
  await refreshTable(services, piece.analysis)
  return newNote
}

/** Retire un champ de l'en-tête, s'il y est. */
function removeField(content: string, key: string): string {
  return content.replace(new RegExp(`^(---\\n[\\s\\S]*?)^${key}:.*\\n([\\s\\S]*?^---)`, 'm'), '$1$2')
}
