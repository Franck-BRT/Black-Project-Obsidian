// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module Bibliothèque de documents — et sa **seule porte d'entrée**.
 *
 * Tout fichier déposé dans l'application y est rangé : les pièces importées dans une
 * analyse, le fichier d'où l'on importe des exigences, les échanges de types de pièces ou
 * de workflows, et ce qu'on y verse soi-même. Chaque document a sa fiche — une note : son
 * titre, sa famille, sa catégorie, sa référence et sa version, d'où il vient — ; un même
 * fichier n'y entre qu'une fois (son empreinte), et une nouvelle version d'un document est
 * reconnue à son nom, à relier d'un clic.
 *
 * Les autres modules versent par `pourIntoLibrary` : sans ce module actif, l'appel ne fait
 * rien. Voir README.md pour la maintenance.
 */

import { askExportPath } from '../../core/exportPath'
import { completeLists } from '../../core/lists'
import { completeTables } from '../../core/tables'
import { localToday } from '../../core/dates'
import { readYamlFrontmatter } from '../../core/yaml'
import { fillTemplate } from '../../core/docs'
import type { BlackModule, BooleanField, ModuleContext, ModuleDetails, ModuleFeature, TextField } from '../../core/modules/module'
import type { Choice, FormField, Ui } from '../../core/ports'
import { cleanFolder } from '../../core/settings'
import { emitWorkflowEvent, NO_SUBJECT, onRunningChange, workflowPageOf, workflowsUsing, registerFieldSource, registerTrigger, runActionNow, runningSteps, runSystemWorkflow, stopRunning, systemWorkflowManages, workflowRunning, type Subject } from '../workflows'
import page from './doc/Bibliothèque.md'
import { AI_ENTRY_KINDS, ENTRY_KINDS, EntryStore, findIn, type EntryDraft, type EntryKind, type LibraryEntry } from './entries'
import { entryPageOf, entryTitle, HUB_PAGE as ENTRIES_HUB_PAGE, registerEntriesHome, type CompanyDoc, type TermUse } from './entriesHome'
import { libraryExplorer, type ExplorerPlace } from './explorer'
import { docPageOf, LIBRARY_PAGE, registerLibraryHome, textVersionInfo, textVersionLabel, type EditableField } from './home'
import { previousStarterTexts, startersFor } from './starters'
import type { EntityProposal } from './model'
import { DEFAULT_THRESHOLD, readThreshold, SKILL_CONTEXTS, SKILL_OUTPUTS, thresholdLabel, type AnalysisDecision, type FilingDecision } from './skills'
import { MentionIndex } from './mentions'
import { findCandidates, type LinkCandidate, type LinkSourceItem } from './links'
import { bibliothequeEn, bibliothequeFr } from './i18n'
import { baseName, CATEGORIES, nestHeadings, readRecord, versionLabel, type AiReading, type DocOrigin, type LibraryDoc, type TextVersion, type Transcript } from './model'
import { CIRCUIT_FOLDER, LibraryStore, RESEARCH_KEYS, type PourItem, type PourOptions, type PourReport, type ResearchField } from './store'
import { allPlaces, placePageOf, type ShelfPlacesDeps } from './places'
import { archive, ARCHIVE_FILES, archiveName, EXCHANGE_FORMAT, MANIFEST, readManifest, WHOLE, type Manifest, type WholePart } from './exchange'
import type { ZipEntry } from '../../core/formats/zip'
import { isLanguage, LANGUAGES, type LanguageCode } from './language'
import { inCircuit } from './circuitSteps'
import { builtInShelf, defaultShelfOf, folderName, REFERENCE_SHELF, severalShelves, shelfOfPath, SHELF_KINDS, shelvesOf, withDefaultShelf, withoutShelf, withShelf, type Shelf, type ShelfKind } from './shelves'
import { batchSubject, depositSubject, dropDeposit, holdDeposit, knownSubject, registerLibraryWorkflows, SYS_FILES, SYS_GHOST, SYS_VERSIONS, TRIGGER_BATCH, TRIGGER_DEPOSITED, TRIGGER_KNOWN, type Deposit } from './workflows'

// ── Interface publique ────────────────────────────────────────────────────────────
export type { DocOrigin, LibraryDoc, TextVersion, Transcript, TranscriptState } from './model'
export type { PourItem, PourOptions, PourReport, ResearchField } from './store'
export type { EntryKind, LibraryEntry } from './entries'
export { detectLanguage, LANGUAGES, type LanguageCode, type LanguageGuess } from './language'
import { canonicalTag, canonicalTags, CATEGORY_TYPER, docDateLabel, knownIssuerCode, parseDocDate, suggestIssuerCode, suggestTypeCode, type KnownIssuer, type KnownTag, type PieceTyper } from './identity'
export { categoryFromText, dateFoundIn, docDateLabel, guessDocCategory, guessDocDate, parseDocDate, guessIdentity, guessIssuer, guessTags, guessTitle, IDENTITY_HEAD, issuerFoundIn, tagsFoundIn, plausibleReference, referenceFoundIn, titleFoundIn, type DocIdentity, type CategoryGuess, type DateGuess, type IdentityGuess, type IssuerGuess, type TagsGuess, type TitleGuess, type PieceTyper, pieceTypeCode, knownIssuerCode, suggestIssuerCode, suggestTypeCode, canonicalTags, canonicalTag, type KnownIssuer, type KnownTag } from './identity'

export const BIBLIOTHEQUE = 'bibliotheque'
export const FOLDER_KEY = 'dossier'
export const DEFAULT_FOLDER = 'Bibliothèque'
export const PROMPTS_FOLDER_KEY = 'dossierPrompts'
export const PERSONAS_FOLDER_KEY = 'dossierPersonas'
export const SKILLS_FOLDER_KEY = 'dossierSkills'
export const DEFAULT_PROMPTS_FOLDER = 'Bibliothèque/Prompts'
export const DEFAULT_PERSONAS_FOLDER = 'Bibliothèque/Personas'
export const DEFAULT_SKILLS_FOLDER = 'Bibliothèque/Skills'
export const ISSUERS_FOLDER_KEY = 'dossierEmetteurs'
export const DEFAULT_ISSUERS_FOLDER = 'Bibliothèque/Entreprises'
/** Son nom d'avant (« Émetteurs ») : un coffre qui l'a encore le voit renommé à l'ouverture. */
export const FORMER_ISSUERS_FOLDER = 'Bibliothèque/Émetteurs'
export const TAGS_FOLDER_KEY = 'dossierEtiquettes'
export const DEFAULT_TAGS_FOLDER = 'Bibliothèque/Étiquettes'
/** Le glossaire : un terme par note (son sigle, sa définition). */
export const GLOSSARY_FOLDER_KEY = 'dossierGlossaire'
export const DEFAULT_GLOSSARY_FOLDER = 'Bibliothèque/Glossaire'
export const PERSONS_FOLDER_KEY = 'dossierPersonnes'
export const DEFAULT_PERSONS_FOLDER = 'Bibliothèque/Personnes'
/** Le dossier de la bibliothèque des documents de référence (réglage), et son dossier d'origine. */
export const REFERENCES_FOLDER_KEY = 'dossierReferences'
export const DEFAULT_REFERENCES_FOLDER = 'Bibliothèque/Références'
/** Le dossier de la bibliothèque des documents projet (réglage), et son dossier d'origine. */
export const PROJECTS_FOLDER_KEY = 'dossierProjets'
export const DEFAULT_PROJECTS_FOLDER = 'Bibliothèque/Projets'
/** Un document entré dans la bibliothèque : le déclencheur de workflow. */
export const TRIGGER_POURED = 'bibliotheque.document-verse'
export { SYS_FILES, SYS_GHOST, SYS_MONDAY, SYS_VERSIONS, TRIGGER_BATCH, TRIGGER_DEPOSITED, TRIGGER_KNOWN } from './workflows'

/** Ouvrir une archive ZIP (par la lecture de fichiers) : pour importer une bibliothèque. */
let archiveReader: ((bytes: Uint8Array) => Promise<{ path: string; bytes: Uint8Array }[]>) | null = null

/** La lecture de fichiers dit comment ouvrir une archive (rien sans elle : l'import d'une bibliothèque le dit). */
export function setArchiveReader(reader: ((bytes: Uint8Array) => Promise<{ path: string; bytes: Uint8Array }[]>) | null): void {
  archiveReader = reader
}

/** Le dossier du coffre où sont écrites les bibliothèques exportées. */
export const EXCHANGE_FOLDER = 'Échanges/Bibliothèques'

/** Ce qui arrête d'écouter les renommages du coffre (à la désactivation). */
let stopRenames: (() => void) | null = null
/** Ne plus suivre ce que le circuit traite en ce moment (à la désactivation). */
let stopRunningWatch: (() => void) | null = null

let active: {
  store: LibraryStore
  t: (key: string, vars?: Record<string, string | number>) => string
  entries: Readonly<Record<EntryKind, EntryStore>>
  ui: Ui
  /** Un lieu de la bibliothèque, en mots (« Normes › ECSS »), d'après son dossier. */
  placeOfFolder(folder: string): string
  offerGhost(record: string, folder: string, ask: boolean, ui: Ui): Promise<string | null>
  /** La langue des dates écrites en mots (« fr-FR », « en-GB »). */
  locale: string
  /** Les émetteurs de la liste. */
  issuers(): Promise<KnownIssuer[]>
  /** Les étiquettes de la liste. */
  tagList(): Promise<KnownTag[]>
  /** Le dossier des documents de référence. */
  referencesFolder(): string
  /** Le dossier des documents projet. */
  projectsFolder(): string
  /** La bibliothèque de documents d'un dossier (la plus profonde qui le contient). */
  shelfOf(folder: string): Shelf | undefined
  /** Créer un dossier (et ses parents) s'il manque. */
  ensureFolder(folder: string): Promise<void>
  /** Le circuit : les dossiers où ranger ; appliquer (ou soumettre) une décision de rangement. */
  filingFolders(): Promise<{ folder: string; label: string }[]>
  applyFiling(record: string, decision: FilingDecision | null, threshold: number, skill: string): Promise<FilingOutcome | null>
  applyAnalysis(record: string, decision: AnalysisDecision | null, threshold: number, skill: string): Promise<string | null>
  markIngested(record: string, skill: string, detail: string): Promise<void>
  markCircuitError(record: string, skill: string, error: string): Promise<void>
  circuitActive(): boolean
  /** Les skills du circuit (ingérer, analyser, ranger) : ajoutés s'ils manquent. */
  ensureCircuitSkills(): Promise<void>
  /** Supprimer un répertoire de documents (après une question) ; `true` s'il est parti. */
  removeDirectory(folder: string): Promise<boolean>
  /** Verser des documents choisis (l'ordinateur, le coffre) dans un dossier. */
  pour(folder?: string): Promise<PourReport | null>
  /** Ranger un document dans les documents de référence (un fantôme à son ancienne place) ; rend sa nouvelle fiche. */
  toReferences(record: string): Promise<string | null>
} | null = null

// ── Les documents de référence, appelés par les programmes et les projets ──────────

export { REFERENCE_SHELF } from './shelves'

/** Un document de la bibliothèque, tel qu'un autre module le montre : sa fiche, son titre, ce qui le dit. */
export interface LibraryDocRef {
  record: string
  title: string
  /** Sa référence, son édition, sa catégorie. */
  detail: string
  /** Est-il rangé dans les documents de référence ? */
  reference: boolean
  /** Son type de pièce (son code : « CCTP »), vide sans. */
  category: string
}

/** Qui appelle un document : un programme, un projet (sa note, sa page). */
export interface ReferenceCaller {
  title: string
  detail?: string
  /** Sa page dans l'app ; sinon sa note s'ouvre. */
  page?: string
  note: string
}

/** Ce qu'un module qui appelle des documents de référence dit à la bibliothèque. */
export interface ReferenceCallers {
  /** Ceux qui appellent ce document (sa fiche). */
  callers(record: string): Promise<ReferenceCaller[]>
  /** Une fiche déplacée (rangée ailleurs) : ses appels suivent. */
  moved(from: string, to: string): Promise<void>
}

const referenceCallers = new Set<ReferenceCallers>()

/** Déclarer qui appelle des documents (le module Programmes) ; rend de quoi l'oublier. */
export function registerReferenceCallers(callers: ReferenceCallers): () => void {
  referenceCallers.add(callers)
  return () => void referenceCallers.delete(callers)
}

/** Ceux qui appellent un document, de tous les modules. */
async function callersOf(record: string): Promise<ReferenceCaller[]> {
  const all: ReferenceCaller[] = []
  for (const each of referenceCallers) all.push(...(await each.callers(record).catch(() => [])))
  return all
}

/** Une fiche déplacée : les appels suivent. */
async function recordMoved(from: string, to: string): Promise<void> {
  if (from === to) return
  for (const each of referenceCallers) await each.moved(from, to).catch((error: unknown) => console.error('[Black Projects] bibliothèque', error))
}

const docRef = (doc: LibraryDoc): LibraryDocRef => ({
  record: doc.record,
  title: doc.title,
  detail: [doc.reference, [doc.edition, doc.revision].filter(Boolean).join(' '), doc.category ? pieceTypeText(doc.category) : ''].filter(Boolean).join(' · '),
  reference: doc.shelf === REFERENCE_SHELF,
  category: doc.category
})

/** Les documents de référence (par titre) ; aucun sans le module. */
export async function referenceDocuments(): Promise<LibraryDocRef[]> {
  if (!active) return []
  return (await active.store.all())
    .filter((doc) => doc.shelf === REFERENCE_SHELF)
    .map(docRef)
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

/** Un document de la bibliothèque par sa fiche (où qu'il soit rangé) ; `null` s'il n'y est plus. */
export async function libraryDocument(record: string): Promise<LibraryDocRef | null> {
  if (!active) return null
  const doc = (await active.store.all()).find((each) => each.record === record)
  return doc ? docRef(doc) : null
}

/**
 * Ces octets sont-ils déjà dans la bibliothèque (n'importe laquelle de ses bibliothèques de
 * documents) ? Le document, son fichier et où il est rangé ; `null` sinon, ou sans le module.
 * Un module qui écrit un fichier dans le coffre le demande d'abord : un fichier déjà là n'est
 * pas copié une seconde fois.
 */
export async function findInLibrary(bytes: Uint8Array): Promise<(LibraryDocRef & { file: string; place: string }) | null> {
  if (!active) return null
  try {
    const doc = await active.store.findByBytes(bytes)
    return doc ? { ...docRef(doc), file: doc.file, place: active.placeOfFolder(doc.record.slice(0, doc.record.lastIndexOf('/'))) } : null
  } catch (error) {
    console.error('[Black Projects] bibliothèque', error)
    return null
  }
}

// ── Les documents projet : un répertoire par programme, puis par projet ─────────────

export { PROJECT_SHELF } from './shelves'

/** Un nom de répertoire sûr, tiré d'un nom de programme ou de projet. */
const directoryName = (name: string): string => folderName(name) || '_'

/**
 * Le dossier des documents d'un programme (`project` absent) ou d'un projet, dans la
 * bibliothèque des documents projet : `Bibliothèque/Projets/<Programme>/<Projet>`. Créé s'il
 * manque. Vide sans le module.
 */
export async function projectDocumentsFolder(programme: string, project?: string): Promise<string> {
  if (!active) return ''
  const folder = [active.projectsFolder(), directoryName(programme), ...(project ? [directoryName(project)] : [])].join('/')
  await active.ensureFolder(folder)
  return folder
}

/**
 * Les documents rangés dans un dossier de la bibliothèque (`deep` : ses sous-répertoires
 * aussi), par titre ; aucun sans le module.
 */
export async function documentsIn(folder: string, deep = false): Promise<LibraryDocRef[]> {
  if (!active || !folder) return []
  return (await active.store.all())
    .filter((doc) => {
      const where = doc.record.slice(0, doc.record.lastIndexOf('/'))
      return where === folder || (deep && where.startsWith(`${folder}/`))
    })
    .map(docRef)
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

/** Verser des documents dans un dossier de la bibliothèque : le choix des fichiers (l'ordinateur, le coffre), puis le versement. */
/**
 * Supprimer un répertoire de documents (un répertoire d'un projet…) : une question d'abord —
 * ses documents remontent d'un cran, ou sont retirés. `false` : rien n'a changé.
 */
export async function removeLibraryDirectory(folder: string): Promise<boolean> {
  return (await active?.removeDirectory(folder)) ?? false
}

export async function pourDocumentsInto(folder: string): Promise<void> {
  await active?.pour(folder)
}

/** Verser des fichiers glissés-déposés dans un dossier de la bibliothèque (un document déjà rangé ailleurs : un fantôme proposé). */
export async function dropDocumentsInto(folder: string, files: readonly { name: string; bytes: Uint8Array }[]): Promise<void> {
  if (!active || !files.length) return
  await pourIntoLibrary(
    files.map((file) => ({ name: file.name, bytes: file.bytes })),
    { module: BIBLIOTHEQUE, label: active.t('bibliotheque.origin.hand') },
    { folder, ghosts: true }
  )
}

/** La page d'un dossier de la bibliothèque (sa bibliothèque, son répertoire) ; `null` hors de la bibliothèque. */
export function libraryFolderPage(folder: string): string | null {
  if (!active) return null
  const shelf = active.shelfOf(folder)
  return shelf ? placePageOf(LIBRARY_PAGE, { shelf: shelf.id, directory: folder.slice(shelf.folder.length).replace(/^\/+/, '') }) : null
}

/** La page d'un document de la bibliothèque (sa fiche). */
export const libraryDocPage = (record: string): string => docPageOf(record)

/**
 * Choisir des documents de référence (cochés : ceux déjà appelés) ; on peut aussi en verser
 * un nouveau. Rend les fiches cochées, ou `null` (abandon). Un document appelé mais rangé
 * ailleurs (sorti des références) reste dans la liste, coché.
 */
export async function chooseReferenceDocuments(title: string, current: readonly string[]): Promise<string[] | null> {
  if (!active) return null
  const { t, ui } = active
  const all = await active.store.all()
  const refs = all.filter((doc) => doc.shelf === REFERENCE_SHELF).map(docRef)
  const others = current.flatMap((record) => {
    if (refs.some((doc) => doc.record === record)) return []
    const doc = all.find((each) => each.record === record)
    return [doc ? docRef(doc) : { record, title: record.slice(record.lastIndexOf('/') + 1).replace(/\.md$/, ''), detail: t('bibliotheque.references.gone'), reference: false, category: '' }]
  })
  const choice = (doc: LibraryDocRef) => ({ value: doc.record, label: doc.title, ...(doc.detail || !doc.reference ? { description: [doc.detail, doc.reference ? '' : t('bibliotheque.references.outside')].filter(Boolean).join(' · ') } : {}) })
  const pour = active.pour
  const folder = active.referencesFolder()
  return ui.pickMany({
    title,
    intro: refs.length ? t('bibliotheque.references.choose.intro') : t('bibliotheque.references.choose.empty'),
    choices: [...refs.sort((a, b) => a.title.localeCompare(b.title, 'fr')), ...others].map(choice),
    selected: [...current],
    submit: t('bibliotheque.edit.submit'),
    create: {
      label: t('bibliotheque.references.pour'),
      run: async () => {
        const report = await pour(folder)
        const doc = report?.added[0] ?? report?.already[0]
        return doc ? choice(docRef(doc)) : null
      }
    }
  })
}

/** Les prompts, ou les personas, de la bibliothèque (favoris d'abord) ; aucun sans le module actif. */
export async function libraryEntries(kind: EntryKind): Promise<LibraryEntry[]> {
  if (!active) return []
  try {
    return await active.entries[kind].all()
  } catch (error) {
    console.error('[Black Projects] bibliothèque', error)
    return []
  }
}

/** Un prompt ou un persona, par son nom ou le chemin de sa note ; `null` s'il n'y est pas. */
export async function findLibraryEntry(kind: EntryKind, nameOrPath: string): Promise<LibraryEntry | null> {
  return findIn(await libraryEntries(kind), nameOrPath)
}

/** Écrire les exemples qui manquent (prompts ou personas, pour les appels d'offres) ; rend leurs noms. */
export async function addStarterEntries(kind: EntryKind, language: string): Promise<string[]> {
  if (!active) return []
  return active.entries[kind].addStarters(startersFor(kind, language))
}

/**
 * Pour une action de workflow : le prompt ou le persona nommé dans un champ. Vide : `null` ;
 * nommé mais absent (ou sans texte) : une erreur qui le dit — le workflow échoue et l'écrit.
 */
export async function namedEntry(kind: EntryKind, name: string | undefined): Promise<LibraryEntry | null> {
  const wanted = (name ?? '').trim()
  if (!wanted) return null
  const found = await findLibraryEntry(kind, wanted)
  if (found?.text) return found
  throw new Error(active ? active.t(`bibliotheque.${kind}.notFound`, { name: wanted }) : `${kind} « ${wanted} » introuvable.`)
}

// ── Les skills exécutables : le circuit des documents ──────────────────────────────

/** Un contexte qu'un skill peut recevoir : son nom en mots, et de quoi le rassembler pour un document. */
export interface SkillContext {
  key: string
  label: string
  /** Ce que reçoit l'IA, pour ce document (du texte) ; vide : rien à en dire. */
  provide(record: string): Promise<string>
}

const skillContexts = new Map<string, SkillContext>()

/** Déclarer un contexte (la bibliothèque les siens ; un autre module, les siens : les projets…) ; rend de quoi l'oublier. */
export function registerSkillContext(context: SkillContext): () => void {
  skillContexts.set(context.key, context)
  return () => {
    if (skillContexts.get(context.key) === context) skillContexts.delete(context.key)
  }
}

/** Les contextes connus : ceux de la bibliothèque d'abord, dans leur ordre, puis ceux des autres modules. */
export function skillContextKeys(): string[] {
  const own = SKILL_CONTEXTS.filter((key) => skillContexts.has(key)) as string[]
  return [...own, ...[...skillContexts.keys()].filter((key) => !own.includes(key))]
}

/** Le nom d'un contexte, en mots (inconnu : sa clé). */
export function skillContextLabel(key: string): string {
  return skillContexts.get(key)?.label ?? key
}

/** Ce que reçoit un skill pour un document : une section par contexte demandé (un contexte inconnu est dit tel). */
export async function skillContextFor(record: string, keys: readonly string[]): Promise<string> {
  const parts: string[] = []
  for (const key of keys) {
    const context = skillContexts.get(key)
    if (!context) {
      parts.push(`## ${key}\n\n${active?.t('bibliotheque.skill.context.unknown') ?? '—'}`)
      continue
    }
    parts.push(`## ${context.label}\n\n${(await context.provide(record)).trim() || '—'}`)
  }
  return parts.join('\n\n')
}

// ── Les liens (le circuit des documents, version C) ─────────────────────────────

/** Des entités où chercher les liens d'un document : la bibliothèque les siennes ; un autre module, les siennes (les projets…). */
export interface LinkSource {
  key: string
  /** Leur sorte, en mots (« Entreprise », « Projet »…). */
  label: string
  items(): Promise<{ path: string; label: string; names: readonly string[] }[]>
}

const linkSources = new Map<string, LinkSource>()

/** Déclarer des entités où chercher les liens ; rend de quoi l'oublier. */
export function registerLinkSource(source: LinkSource): () => void {
  linkSources.set(source.key, source)
  return () => {
    if (linkSources.get(source.key) === source) linkSources.delete(source.key)
  }
}

/** Les liens possibles d'un document : les entités connues dont un nom apparaît dans son titre ou son texte. */
export async function linkCandidatesFor(record: string): Promise<LinkCandidate[]> {
  if (!active) return []
  const doc = await active.store.load(record)
  if (!doc) return []
  const text = `${doc.title}\n${(await active.store.textOfRecord(record)) ?? ''}`
  const items: LinkSourceItem[] = []
  for (const source of linkSources.values()) for (const item of await source.items()) items.push({ ...item, kind: source.label })
  return findCandidates(text, items, record)
}

export { candidatePath, findCandidates, withBacklink, withLinkSection, withoutBacklink, type DocLink, type LinkCandidate } from './links'

/** Les dossiers où l'on peut ranger un document (ce que le skill de rangement peut choisir), chacun en mots. */
export async function filingFolders(): Promise<{ folder: string; label: string }[]> {
  return active ? active.filingFolders() : []
}

/** Ce qu'est devenue une décision de rangement : appliquée (rangé), ou soumise (à contrôler). */
export interface FilingOutcome {
  outcome: 'range' | 'a-controler'
  /** La fiche, là où elle est maintenant. */
  record: string
  message: string
}

/**
 * Une décision de rangement (rendue par un skill) : sûre (un dossier proposé, une confiance
 * au moins égale au seuil) — appliquée, le document rangé ; sinon (ou illisible : `null`) —
 * soumise, le document dans À contrôler avec la raison et la proposition. Toujours journalisée
 * sur sa fiche. `null` : le document n'est plus là.
 */
export async function applyFilingDecision(record: string, decision: FilingDecision | null, threshold: number, skill: string): Promise<FilingOutcome | null> {
  return active ? active.applyFiling(record, decision, threshold, skill) : null
}

export { ANALYSIS_SCHEMA, DEFAULT_THRESHOLD, FILING_SCHEMA, readAnalysisAnswer, readFilingAnswer, readThreshold, thresholdLabel, type AnalysisDecision, type FilingDecision } from './skills'
export { circuitJourney, circuitSteps, inCircuit, type CircuitStep, type CircuitStepState } from './circuitSteps'

/**
 * Une analyse (rendue par un skill) : le projet reconnu gardé sur la fiche (s'il existe), pour
 * le rangement ; sûre (confiance au moins égale au seuil), le type de pièce et l'émetteur
 * donnés — seulement s'ils manquaient ou étaient à confirmer (ce qui est sûr ne change pas).
 * L'état devient « analysé » (dans le circuit). Rend ce qui a été fait, en une phrase.
 */
export async function applyAnalysisDecision(record: string, decision: AnalysisDecision | null, threshold: number, skill: string): Promise<string | null> {
  return active ? active.applyAnalysis(record, decision, threshold, skill) : null
}

/** L'ingestion d'un document faite (sa relecture, `detail`) : l'état devient « ingéré » (dans le circuit), dit sur sa fiche. */
export async function markIngested(record: string, skill: string, detail: string): Promise<void> {
  await active?.markIngested(record, skill, detail)
}

/** Une étape du circuit a échoué (l'IA injoignable, une erreur du serveur) : dit sur sa fiche, l'étape montrée en rouge. */
export async function markCircuitError(record: string, skill: string, error: string): Promise<void> {
  await active?.markCircuitError(record, skill, error)
}

/** L'IA a-t-elle déjà relu le texte de ce document (une version du texte « relue par l'IA ») ? */
export async function aiProofreadAlready(record: string): Promise<boolean> {
  return active ? (await active.store.textVersions(record)).some((version) => version.origin === 'ia') : false
}

/** Le circuit des documents est-il actif (son réglage) ? */
export function circuitActive(): boolean {
  return active?.circuitActive() ?? false
}

/** Le répertoire des documents d'un programme ou d'un projet (sans le créer). */
export function projectDocumentsPath(programme: string, project?: string): string {
  return active ? [active.projectsFolder(), directoryName(programme), ...(project ? [directoryName(project)] : [])].join('/') : ''
}

/** Ce qu'on dit à l'IA d'un persona, avant toute autre consigne : qui elle est, comment répondre. */
export function personaInstructions(persona: Pick<LibraryEntry, 'name' | 'text'>): string {
  const intro = active ? active.t('bibliotheque.persona.intro', { name: persona.name }) : `Tu réponds en tant que « ${persona.name} ».`
  return `${intro}\n\n${persona.text.trim()}`
}

/**
 * Choisir un persona pour une demande à l'IA : la liste (« Sans persona » d'abord) quand
 * la bibliothèque en a ; sinon rien n'est demandé. `null` : sans persona ; `undefined` :
 * abandonné.
 */
export async function choosePersona(ui: Ui): Promise<LibraryEntry | null | undefined> {
  const personas = (await libraryEntries('persona')).filter((persona) => persona.text)
  if (!personas.length || !active) return null
  const { t } = active
  const chosen = await ui.pickOption(
    [
      { value: '', label: t('bibliotheque.persona.none'), description: t('bibliotheque.persona.none.desc') },
      ...personas.map((persona) => ({ value: persona.path, label: persona.name, description: [persona.favorite ? '★' : '', persona.category, persona.description].filter(Boolean).join(' · ') }))
    ],
    t('bibliotheque.persona.pick')
  )
  if (chosen === null) return undefined
  return personas.find((persona) => persona.path === chosen) ?? null
}

/**
 * Verser des fichiers dans la bibliothèque, avec leur origine (le module qui les a reçus,
 * ce qu'il en dit, un lien). Les fichiers du coffre y restent où ils sont ; ceux venus de
 * l'ordinateur y sont copiés. Un même fichier n'y entre qu'une fois. Sans le module actif,
 * ne fait rien (`null`). Ne lève pas : un fichier illisible est compté dans `failed`.
 *
 * Le module Workflows actif, un dépôt d'un autre module passe par son workflow système
 * « Ranger les fichiers importés » (pièces d'analyse comprises) : désactivé, les fichiers ne
 * sont pas rangés — `null`. Ce qu'on verse soi-même depuis la bibliothèque y
 * entre toujours.
 */
export async function pourIntoLibrary(items: readonly PourItem[], origin: DocOrigin, options: PourOptions = {}): Promise<PourReport | null> {
  if (!active || !items.length) return null
  try {
    if (origin.module !== BIBLIOTHEQUE && systemWorkflowManages(SYS_FILES)) return await depositThroughWorkflows(items, origin, options)
    return await pourNow(items, origin, options, true)
  } catch (error) {
    console.error('[Black Projects] bibliothèque', error)
    return null
  }
}

/** Le dépôt confié aux workflows : ses fichiers attendent l'action « Ranger dans la bibliothèque ». */
async function depositThroughWorkflows(items: readonly PourItem[], origin: DocOrigin, options: PourOptions): Promise<PourReport | null> {
  // Déposé pendant qu'un workflow s'exécute : le dépôt passe après lui, sans être attendu.
  const awaited = !workflowRunning()
  const deposit: Deposit = { items, origin, options, awaited, report: null }
  const id = holdDeposit(deposit)
  await emitWorkflowEvent(TRIGGER_DEPOSITED, depositSubject(id, items, origin, (name) => readingOf(name, active?.t ?? ((key: string) => key))))
  if (!awaited) return null
  dropDeposit(id)
  if (deposit.report) await announce(deposit.report, origin)
  return deposit.report
}

/**
 * Verser maintenant. Les nouvelles versions probables : repérées à l'entrée, sauf quand leur
 * workflow système s'en charge (au versement annoncé). `announce` : dire les documents
 * entrés aux workflows — une fois pour le versement, puis un par document.
 */
async function pourNow(items: readonly PourItem[], origin: DocOrigin, options: PourOptions, toAnnounce: boolean): Promise<PourReport> {
  if (!active) return { added: [], already: [], failed: [], folder: '' }
  const { store } = active
  const report = await store.pour(items, origin, { ...options, detectVersions: !systemWorkflowManages(SYS_VERSIONS) })
  if (toAnnounce) await announce(report, origin, options.ghosts)
  return report
}

/**
 * Déposés soi-même dans un lieu, les documents qui y étaient déjà, ailleurs : un fantôme
 * proposé pour chacun — par son workflow système quand les workflows s'en chargent (couper
 * le workflow, c'est ne plus rien proposer), sinon ici même, par une fenêtre.
 */
async function announceKnown(report: PourReport, origin: DocOrigin): Promise<void> {
  if (!active) return
  const { store, t } = active
  const seen = new Set<string>()
  for (const doc of report.already) {
    if (seen.has(doc.record) || doc.record.slice(0, doc.record.lastIndexOf('/')) === report.folder) continue
    seen.add(doc.record)
    // Déjà un fantôme ici : rien à proposer.
    if ((await store.ghostsOf(doc)).some(({ ghost }) => ghost.path.slice(0, ghost.path.lastIndexOf('/')) === report.folder)) continue
    if (systemWorkflowManages(SYS_GHOST)) {
      const where = { range: active.placeOfFolder(doc.record.slice(0, doc.record.lastIndexOf('/'))), ici: active.placeOfFolder(report.folder) }
      await emitWorkflowEvent(TRIGGER_KNOWN, knownSubject(doc, report.folder, where, origin, readingVars(readingOf(doc.file, t))))
    } else await active.offerGhost(doc.record, report.folder, true, active.ui)
  }
}

async function announce(report: PourReport, origin: DocOrigin, ghosts = false): Promise<void> {
  if (ghosts) await announceKnown(report, origin)
  if (!active || !report.added.length) return
  const { store, t } = active
  // Le circuit des documents : ses skills là avant qu'il ne démarre.
  if (report.added.some((doc) => doc.circuit === 'a-classer')) await active.ensureCircuitSkills()
  await emitWorkflowEvent(TRIGGER_BATCH, batchSubject(report.added, origin, t))
  // Son workflow a pu y repérer des versions : les fiches relues.
  report.added = await Promise.all(report.added.map(async (doc) => (await store.load(doc.record)) ?? doc))
  for (const doc of report.added) await emitPoured(doc)
}

/**
 * Comment l'application lit un fichier, d'après son extension : son **texte** (lu), une
 * **image** (montrée, pas lue), une **archive** (ouverte, ses fichiers lus un à un), ou
 * **non lu**. C'est la lecture de fichiers qui le sait (`setReadability`, à son
 * activation) ; sans elle, rien n'est lu.
 */
export type Readability = 'texte' | 'image' | 'archive' | 'non-lu'
let readability: ((extension: string) => Readability) | null = null

/** Pour la lecture de fichiers : dire comment un fichier est lu (`null` : plus rien). */
export function setReadability(judge: ((extension: string) => Readability) | null): void {
  readability = judge
}

/** Le texte d'un fichier, pour deviner sa langue : la lecture de fichiers le donne (`null` : pas lu). */
let textReader: ((name: string, bytes: Uint8Array) => Promise<string | null>) | null = null

/** Pour la lecture de fichiers : lire le texte d'un fichier versé (`null` : plus rien). */
export function setTextReader(reader: ((name: string, bytes: Uint8Array) => Promise<string | null>) | null): void {
  textReader = reader
}

/** Le texte d'un fichier versé, ou pourquoi il n'y en a pas : la lecture de fichiers le donne (comme pour les pièces d'une analyse). */
let transcriber: ((name: string, bytes: Uint8Array) => Promise<Transcript>) | null = null

/** Pour la lecture de fichiers : transcrire un fichier versé (`null` : plus rien). */
export function setTranscriber(transcribe: ((name: string, bytes: Uint8Array) => Promise<Transcript>) | null): void {
  transcriber = transcribe
}

/** L'extension d'un nom de fichier, en minuscules, sans le point ; vide s'il n'en a pas. */
export function extensionOfName(name: string): string {
  const base = baseName(name)
  const at = base.lastIndexOf('.')
  return at > 0 ? base.slice(at + 1).toLowerCase() : ''
}

export interface FileReading {
  extension: string
  /** Son texte est-il lu ? */
  read: boolean
  /** « oui » / « non », et comment il est lu, en mots : pour les workflows. */
  lisible: string
  lecture: string
}

/** Ce que les workflows savent de la lecture d'un fichier : son extension, lisible ou non, et comment. */
export function readingOf(name: string, t: (key: string) => string): FileReading {
  const extension = extensionOfName(name)
  const how = readability ? readability(extension) : null
  return {
    extension,
    read: how === 'texte',
    lisible: t(how === 'texte' ? 'bibliotheque.read.yes' : 'bibliotheque.read.no'),
    lecture: t(how ? `bibliotheque.read.${how}` : 'bibliotheque.read.off')
  }
}

const readingVars = ({ extension, lisible, lecture }: FileReading) => ({ extension, lisible, lecture })

/** Pour l'IA : un document de la bibliothèque, par sa fiche ; `null` sans le module, ou s'il n'y est plus. */
export async function libraryDoc(record: string): Promise<LibraryDoc | null> {
  return active ? active.store.load(record) : null
}

/** Pour l'IA : le texte du fichier d'un document (lu par la lecture de fichiers) ; `null` s'il n'est pas lu. */
export async function libraryDocText(record: string): Promise<string | null> {
  return active ? active.store.textOfRecord(record) : null
}

/** Pour l'IA : la langue qu'elle a identifiée — le document n'est plus à confirmer, et on sait qui l'a dit. */
export async function setLanguageByAi(record: string, language: LanguageCode): Promise<LibraryDoc | null> {
  return active ? active.store.setLanguage(record, language, true) : null
}

/** Pour l'IA : la catégorie qu'elle a identifiée (vide : aucune) — plus à confirmer, et on sait qui l'a dit. */
export async function setCategoryByAi(record: string, category: string): Promise<LibraryDoc | null> {
  return active ? active.store.setCategory(record, category, true) : null
}

/**
 * Les types de pièce d'un document (le module Typage des pièces les donne ; sans lui, les
 * catégories de la bibliothèque) : leur liste, et ce qui les reconnaît.
 */
let pieceTyper: PieceTyper | null = null

/** Pour le module Typage des pièces : ses types (`null` : plus aucun, les catégories de la bibliothèque reprennent). */
export function setPieceTyper(typer: PieceTyper | null): void {
  pieceTyper = typer
}

/** Les types de pièce à choisir : un code, un libellé. */
export const libraryPieceTypes = (): readonly { code: string; label: string }[] => (pieceTyper ?? CATEGORY_TYPER).types()

/** Créer un type de pièce (sa fenêtre : code, libellé) ; `null` si l'on renonce, ou sans le module Typage des pièces. */
let pieceTypeMaker: (() => Promise<{ code: string; label: string } | null>) | null = null

/** Pour les autres modules : peut-on créer un type de pièce (le module Typage des pièces actif) ? */
/** L'accès rapide aux types de document (Bibliothèques système) : leur page et combien ; `null` sans page. */
const pieceTypesShortcut = (): { page: string; count: number } | null => (pieceTyper?.page ? { page: pieceTyper.page, count: pieceTyper.types().length } : null)
export const canCreatePieceType = (): boolean => !!pieceTyper?.add && pieceTypeMaker !== null

/** Pour les autres modules : créer un type de pièce, par sa fenêtre (code, libellé) ; rend le type créé. */
export const createPieceType = (): Promise<{ code: string; label: string } | null> => pieceTypeMaker?.() ?? Promise.resolve(null)

/** Un type de pièce en mots : « CCTP — Cahier des clauses techniques particulières » ; un code hors de la liste, tel quel. */
export function pieceTypeText(code: string): string {
  const type = libraryPieceTypes().find((each) => each.code === code)
  return type && type.label && type.label !== type.code ? `${type.code} — ${type.label}` : code
}

/** Pour l'IA : les types de pièce à choisir (leurs codes). */
export async function libraryCategories(): Promise<string[]> {
  return libraryPieceTypes().map((type) => type.code)
}

/** Pour l'IA : la date qu'elle a identifiée (vide : aucune) — plus à confirmer, et on sait qui l'a dit. */
export async function setDateByAi(record: string, date: string): Promise<LibraryDoc | null> {
  return active ? active.store.setDate(record, date, true) : null
}

/** Une date de document en mots, dans la langue de l'application (« 12 mars 2026 »). */
export const libraryDateLabel = (value: string): string => docDateLabel(value, active?.locale)

/** Pour l'IA : le texte que montre la fiche d'un document (sa dernière version) ; `null` s'il n'y en a pas. */
export async function libraryTranscript(record: string): Promise<string | null> {
  return active ? active.store.transcriptText(record) : null
}

/** Pour l'IA : son texte relu — une nouvelle version du texte du document (celle d'avant est gardée). */
export async function addTextVersionByAi(record: string, text: string, about: { model?: string; prompt?: string; persona?: string; skill?: string; kept?: number; vision?: number; quality?: number }): Promise<TextVersion | null> {
  return active ? active.store.addTextVersion(record, text, { origin: 'ia', ...about }) : null
}

/** Pour l'IA : les étiquettes qu'elle a données — plus à confirmer, et on sait qui l'a dit. */
export async function setTagsByAi(record: string, tags: readonly string[]): Promise<LibraryDoc | null> {
  // Ramenées à celles de la liste (une autre forme → l'étiquette).
  return active ? active.store.setTags(record, canonicalTags(tags, await active.tagList()), true) : null
}

/** Pour l'IA : les étiquettes déjà en usage dans la bibliothèque (un vocabulaire commun), les plus employées d'abord. */
export async function libraryTags(): Promise<string[]> {
  const counts = new Map<string, { tag: string; count: number }>()
  for (const tag of active ? (await active.store.all()).flatMap((doc) => doc.tags) : []) {
    const seen = counts.get(tag.toLowerCase())
    counts.set(tag.toLowerCase(), { tag: seen?.tag ?? tag, count: (seen?.count ?? 0) + 1 })
  }
  const used = [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'fr')).map((each) => each.tag)
  // Celles de la liste des étiquettes d'abord : le vocabulaire commun.
  const listed = active ? (await active.tagList()).map((each) => each.name) : []
  return [...new Map([...listed, ...used].map((tag) => [tag.toLowerCase(), tag])).values()]
}

/** Le choix « Ajouter un émetteur à la liste… » d'une liste d'émetteurs. */
const NEW_ISSUER = '\u0000nouvel-emetteur'
/** Le choix « Autre(s) étiquette(s)… » d'une liste d'étiquettes. */
const NEW_TAGS = '\u0000autres-etiquettes'
/** Le choix « Ajouter un type de pièce… » d'une liste de types. */
const NEW_TYPE = '\u0000nouveau-type'

/** Un émetteur en mots : « ESA — Agence spatiale européenne » s'il est de la liste ; sinon tel quel. */
export function issuerLabelIn(value: string, known: readonly KnownIssuer[]): string {
  const found = known.find((each) => each.code === value)
  return found ? (found.name && found.name !== found.code ? `${found.code} — ${found.name}` : found.code) : value
}

/** Pour l'IA : les émetteurs de la liste (code, nom, autres noms). */
export async function libraryIssuers(): Promise<KnownIssuer[]> {
  return active ? active.issuers() : []
}

/** Pour l'IA : l'émetteur qu'elle a identifié (vide : aucun) — plus à confirmer, et on sait qui l'a dit. */
export async function setIssuerByAi(record: string, issuer: string): Promise<LibraryDoc | null> {
  return active ? active.store.setIssuer(record, issuer, true) : null
}

/** Pour l'IA : le titre qu'elle a identifié — plus à confirmer, et on sait qui l'a dit. */
export async function setTitleByAi(record: string, title: string): Promise<LibraryDoc | null> {
  return active ? active.store.setTitle(record, title, true) : null
}

/** Pour l'IA : la référence et la version qu'elle a identifiées — plus à confirmer, et on sait qui l'a dit. */
export async function setIdentityByAi(record: string, identity: { reference: string; edition: string; revision: string }): Promise<LibraryDoc | null> {
  return active ? active.store.setIdentity(record, identity, true) : null
}

/** Le module est-il actif (les autres modules le disent à l'utilisateur, au besoin) ? */
export const libraryActive = (): boolean => active !== null

/**
 * Les workflows système qui cherchent un champ avec l'IA (le module IA les dit) : relancer la
 * recherche d'un champ les exécute pour le document, quand la première passe n'est pas sûre.
 */
const aiResearch = new Map<ResearchField, string>()

/** Pour le module IA : le workflow système qui cherche ce champ avec l'IA (`null` : plus aucun). */
export function setAiResearch(field: ResearchField, systemWorkflow: string | null): void {
  if (systemWorkflow) aiResearch.set(field, systemWorkflow)
  else aiResearch.delete(field)
}

/**
 * Le workflow système qui relit le texte extrait avec l'IA (le module IA le dit) : extraire de
 * nouveau le texte d'un document l'exécute ensuite, et la fiche propose de le relancer.
 */
let aiProofread: string | null = null

/** Pour le module IA : le workflow système qui relit le texte extrait (`null` : plus aucun). */
export function setAiProofread(systemWorkflow: string | null): void {
  aiProofread = systemWorkflow
}

/**
 * La **lecture par l'IA** du texte d'un document — une seule à la fois (le moteur des
 * workflows les passe l'une après l'autre) : celle en cours, où elle en est, et celles qu'on a
 * mises en file d'attente. Les pages ouvertes se redessinent à chaque changement.
 */
let aiRunning: AiReading | null = null
const aiQueue: AiReading[] = []
let pagesChanged: () => void = () => undefined
/** Les contextes de skill de la bibliothèque, déclarés à l'activation : de quoi les oublier. */
let stopSkillContexts: (() => void)[] = []

/** Pour le module IA : une lecture commence (`detail` : où elle en est), ou avance. */
export function aiReadingProgress(record: string, title: string, detail = ''): void {
  const queued = aiQueue.findIndex((each) => each.record === record)
  if (queued >= 0) aiQueue.splice(queued, 1)
  // Le texte lu jusqu'ici reste : il ne change qu'à la page suivante.
  const kept = aiRunning?.record === record ? { ...(aiRunning.partial !== undefined ? { partial: aiRunning.partial } : {}), ...(aiRunning.done !== undefined ? { done: aiRunning.done } : {}), ...(aiRunning.total !== undefined ? { total: aiRunning.total } : {}) } : {}
  aiRunning = { record, title, detail, ...kept }
  pagesChanged()
}

/** Pour le module IA : le texte lu jusqu'ici (provisoire), après `done` pages (ou parties) sur `total`. */
export function aiReadingPartial(record: string, partial: string, done: number, total: number): void {
  if (aiRunning?.record !== record) return
  aiRunning = { ...aiRunning, partial, done, total }
  pagesChanged()
}

/** Les documents dont le texte est en train d'être extrait du fichier (« Extraire de nouveau »). */
const extracting = new Set<string>()
export const extractingNow = (record: string): boolean => extracting.has(record)

/** Pour le module IA : la lecture de ce document est finie (réussie ou non). */
export function aiReadingEnded(record: string): void {
  if (aiRunning?.record !== record) return
  aiRunning = null
  pagesChanged()
}

/** La lecture par l'IA en cours, et la file d'attente. */
export const aiReadingNow = (): { running: AiReading | null; queue: readonly AiReading[] } => ({ running: aiRunning, queue: [...aiQueue] })

/** Ce qu'un modèle de vision peut regarder (le module IA le dit : une image, un PDF que la plateforme dessine). */
let aiVision: ((file: string) => boolean) | null = null

/** Le circuit des documents peut-il passer : une IA réglée (le module IA le dit ; sans lui, non). */
let aiCircuitReady: (() => boolean) | null = null

/** Pour le module IA : une IA est-elle réglée pour le circuit des documents (`null` : non) ? */
export function setAiCircuitReady(ready: (() => boolean) | null): void {
  aiCircuitReady = ready
}

/** Le circuit des documents : son réglage (activé d'origine), et une IA réglée. */
const circuitOn = (values: Readonly<Record<string, unknown>>): boolean => values[CIRCUIT_KEY] !== false && aiCircuitReady?.() === true

/** Pour le module IA : les fichiers qu'un modèle de vision peut regarder (`null` : aucun). */
export function setAiVision(canSee: ((file: string) => boolean) | null): void {
  aiVision = canSee
}

async function emitPoured(doc: LibraryDoc): Promise<void> {
  await emitWorkflowEvent(TRIGGER_POURED, pouredSubject(doc, active ? await active.issuers() : []))
}

/** Le sujet d'un document versé, et ses variables (ce qu'on en sait, ce qui est à confirmer). */
function pouredSubject(doc: LibraryDoc, issuers: readonly KnownIssuer[] = []): Subject {
  const t = active?.t ?? ((key: string) => key)
  return {
    ...NO_SUBJECT,
    key: doc.record,
    label: doc.title,
    path: doc.record,
    vars: { titre: doc.title, famille: doc.family, categorie: doc.category, fichier: doc.file, origine: doc.origins[0]?.module ?? '',
      ...readingVars(readingOf(doc.file, t)),
      langue: doc.language ? t(`bibliotheque.lang.${doc.language}`) : '',
      langueaconfirmer: t(doc.languageToConfirm ? 'bibliotheque.read.yes' : 'bibliotheque.read.no'),
      reference: doc.reference,
      edition: doc.edition,
      revision: doc.revision,
      // Vide quand elles sont sûres : une condition « n'est pas vide » vaut quelle que soit la langue.
      identiteaconfirmer: doc.identityToConfirm ? t('bibliotheque.read.yes') : '',
      titreaconfirmer: doc.titleToConfirm ? t('bibliotheque.read.yes') : '',
      categorieaconfirmer: doc.categoryToConfirm ? t('bibliotheque.read.yes') : '',
      emetteur: doc.issuer,
      // Son nom, s'il est de la liste (le code est dans {emetteur}) ; sinon tel quel.
      emetteurnom: issuers.find((each) => each.code === doc.issuer)?.name ?? doc.issuer,
      emetteuraconfirmer: doc.issuerToConfirm ? t('bibliotheque.read.yes') : '',
      // Un texte extrait du fichier (lu) : la relecture par l'IA s'y attache.
      texteextrait: doc.reading === 'lue' ? t('bibliotheque.read.yes') : '',
      // Un scan : sans texte (un PDF scanné, une image), et un modèle de vision peut le regarder.
      scan: (doc.reading === 'sans-texte' || doc.reading === 'image') && aiVision?.(doc.file) ? t('bibliotheque.read.yes') : '',
      date: doc.date ?? '',
      dateaconfirmer: doc.dateToConfirm ? t('bibliotheque.read.yes') : '',
      etiquettes: doc.tags.join(', '),
      etiquettesaconfirmer: doc.tagsToConfirm ? t('bibliotheque.read.yes') : '',
      // Le circuit des documents : où il en est ; « en cours » tant qu'il n'est ni rangé, ni à contrôler, ni écarté.
      circuit: doc.circuit ?? '',
      circuitencours: doc.circuit === 'a-classer' || doc.circuit === 'ingere' || doc.circuit === 'analyse' ? t('bibliotheque.read.yes') : '',
      fiche: doc.record
    }
  }
}

const folderField: TextField = {
  kind: 'text',
  key: FOLDER_KEY,
  nameKey: 'bibliotheque.setting.folder',
  descKey: 'bibliotheque.setting.folder.desc',
  tooltipKey: 'bibliotheque.setting.folder.tip',
  defaultValue: DEFAULT_FOLDER,
  normalize: cleanFolder
}

const referencesFolderField: TextField = {
  kind: 'text',
  key: REFERENCES_FOLDER_KEY,
  nameKey: 'bibliotheque.setting.references.folder',
  descKey: 'bibliotheque.setting.references.folder.desc',
  tooltipKey: 'bibliotheque.setting.references.folder.tip',
  defaultValue: DEFAULT_REFERENCES_FOLDER,
  normalize: cleanFolder
}

/** Le workflow système du circuit des documents (déclaré par le module IA, après ses passes sur les documents). */
export const CIRCUIT_WORKFLOW = 'sys.ia.circuit'

/**
 * Le réglage du circuit des documents : activé par défaut (depuis 0.136.14) — il ne passe que si une
 * IA est réglée dans le module IA ; sinon, les documents sont versés directement, comme avant.
 */
export const CIRCUIT_KEY = 'circuit'
const circuitField: BooleanField = {
  kind: 'boolean',
  key: CIRCUIT_KEY,
  nameKey: 'bibliotheque.setting.circuit',
  descKey: 'bibliotheque.setting.circuit.desc',
  tooltipKey: 'bibliotheque.setting.circuit.tip',
  defaultValue: true
}

/**
 * **Les bibliothèques en explorateur de fichiers** : une colonne à gauche (les bibliothèques et
 * leurs répertoires), les documents en liste ; désactivé : l'affichage en cartes d'avant.
 */
export const EXPLORER_KEY = 'explorateur'
const explorerField: BooleanField = {
  kind: 'boolean',
  key: EXPLORER_KEY,
  nameKey: 'bibliotheque.setting.explorer',
  descKey: 'bibliotheque.setting.explorer.desc',
  tooltipKey: 'bibliotheque.setting.explorer.tip',
  defaultValue: true
}

const projectsFolderField: TextField = {
  kind: 'text',
  key: PROJECTS_FOLDER_KEY,
  nameKey: 'bibliotheque.setting.projects.folder',
  descKey: 'bibliotheque.setting.projects.folder.desc',
  tooltipKey: 'bibliotheque.setting.projects.folder.tip',
  defaultValue: DEFAULT_PROJECTS_FOLDER,
  normalize: cleanFolder
}

/** Le réglage du dossier de chaque sorte d'entrées, et son dossier d'origine. */
const FOLDER_KEYS: Readonly<Record<EntryKind, readonly [string, string]>> = {
  prompt: [PROMPTS_FOLDER_KEY, DEFAULT_PROMPTS_FOLDER],
  persona: [PERSONAS_FOLDER_KEY, DEFAULT_PERSONAS_FOLDER],
  skill: [SKILLS_FOLDER_KEY, DEFAULT_SKILLS_FOLDER],
  issuer: [ISSUERS_FOLDER_KEY, DEFAULT_ISSUERS_FOLDER],
  tag: [TAGS_FOLDER_KEY, DEFAULT_TAGS_FOLDER],
  person: [PERSONS_FOLDER_KEY, DEFAULT_PERSONS_FOLDER],
  glossary: [GLOSSARY_FOLDER_KEY, DEFAULT_GLOSSARY_FOLDER]
}

const entriesFolderField = (kind: EntryKind): TextField => ({
  kind: 'text',
  key: FOLDER_KEYS[kind][0],
  nameKey: `bibliotheque.setting.${kind}.folder`,
  descKey: `bibliotheque.setting.${kind}.folder.desc`,
  tooltipKey: `bibliotheque.setting.${kind}.folder.tip`,
  defaultValue: FOLDER_KEYS[kind][1],
  normalize: cleanFolder
})

const feature = (key: string, status: ModuleFeature['status'], step?: number): ModuleFeature => ({
  labelKey: `bibliotheque.feature.${key}`,
  noteKey: `bibliotheque.feature.${key}.note`,
  status,
  ...(step === undefined ? {} : { step })
})

export function bibliothequeFeatures(): ModuleDetails {
  return {
    titleKey: 'bibliotheque.details.title',
    introKey: 'bibliotheque.details.intro',
    sections: [
      {
        titleKey: 'bibliotheque.feature.section.store',
        features: [feature('everything', 'available'), feature('dedup', 'available'), feature('versions', 'available'), feature('classify', 'available'), feature('language', 'available'), feature('origins', 'available')]
      },
      { titleKey: 'bibliotheque.feature.section.places', features: [feature('shelves', 'available'), feature('references', 'available'), feature('directories', 'available'), feature('move', 'available')] },
      { titleKey: 'bibliotheque.feature.section.ai', features: [feature('prompts', 'available'), feature('personas', 'available'), feature('skills', 'available'), feature('starters', 'available')] },
      { titleKey: 'bibliotheque.feature.section.issuers', features: [feature('issuers', 'available'), feature('persons', 'available'), feature('tagList', 'available')] },
      { titleKey: 'bibliotheque.feature.section.next', features: [feature('text', 'planned', 7), feature('delivery', 'planned', 7)] }
    ]
  }
}

const folderOf = (settings: Readonly<Record<string, unknown>>, key = FOLDER_KEY, fallback = DEFAULT_FOLDER): string => {
  const stored = settings[key]
  return typeof stored === 'string' && stored.trim() ? cleanFolder(stored) : fallback
}

/**
 * Le dossier des entreprises s'appelait « Émetteurs » : à l'ouverture d'un coffre qui l'a
 * encore (et qui n'a pas réglé un autre dossier), il est **renommé** « Entreprises », ses notes
 * et ses répertoires avec. Un coffre qui a déjà les deux garde l'ancien (le réglage le dit) :
 * rien n'est mêlé ni perdu.
 */
async function renameIssuersFolder(context: ModuleContext, t: (key: string, vars?: Record<string, string | number>) => string): Promise<void> {
  const { platform, settings } = context
  const saved = settings.get()[ISSUERS_FOLDER_KEY]
  const configured = typeof saved === 'string' && saved.trim() ? cleanFolder(saved) : ''
  // Un dossier choisi par l'utilisateur (ni l'ancien, ni celui d'origine, que la plateforme a pu écrire) : rien ne bouge.
  if (configured && configured !== FORMER_ISSUERS_FOLDER && configured !== DEFAULT_ISSUERS_FOLDER) return
  try {
    if (!(await platform.fs.exists(FORMER_ISSUERS_FOLDER))) return
    if (await platform.fs.exists(DEFAULT_ISSUERS_FOLDER)) {
      if (configured !== FORMER_ISSUERS_FOLDER) await settings.save({ ...settings.get(), [ISSUERS_FOLDER_KEY]: FORMER_ISSUERS_FOLDER })
      return
    }
    await platform.fs.rename(FORMER_ISSUERS_FOLDER, DEFAULT_ISSUERS_FOLDER)
    if (configured === FORMER_ISSUERS_FOLDER) await settings.save({ ...settings.get(), [ISSUERS_FOLDER_KEY]: DEFAULT_ISSUERS_FOLDER })
    platform.notifier.notify(t('bibliotheque.issuer.folderRenamed', { from: FORMER_ISSUERS_FOLDER, to: DEFAULT_ISSUERS_FOLDER }), 10000)
  } catch {
    // Pas renommé (un fichier ouvert, un droit) : le réglage garde l'ancien, la liste reste lue.
    if (configured !== FORMER_ISSUERS_FOLDER) await settings.save({ ...settings.get(), [ISSUERS_FOLDER_KEY]: FORMER_ISSUERS_FOLDER })
  }
}

export const bibliothequeModule: BlackModule = {
  id: BIBLIOTHEQUE,
  nameKey: 'bibliotheque.name',
  descriptionKey: 'bibliotheque.description',
  version: '0.74.0',
  requires: [],
  texts: { fr: bibliothequeFr, en: bibliothequeEn },
  details: () => bibliothequeFeatures(),
  settingsFields: [folderField, explorerField, circuitField, referencesFolderField, projectsFolderField, entriesFolderField('prompt'), entriesFolderField('persona'), entriesFolderField('skill'), entriesFolderField('issuer'), entriesFolderField('person'), entriesFolderField('tag'), entriesFolderField('glossary')],
  docs: ({ folder }) => [{ path: 'Modules/Bibliothèque.md', content: fillTemplate(page, folder) }],
  async activate(context: ModuleContext) {
    const { platform, i18n, settings } = context
    const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
    await renameIssuersFolder(context, t)
    const promptsFolder = () => folderOf(settings.get(), PROMPTS_FOLDER_KEY, DEFAULT_PROMPTS_FOLDER)
    const personasFolder = () => folderOf(settings.get(), PERSONAS_FOLDER_KEY, DEFAULT_PERSONAS_FOLDER)
    const skillsFolder = () => folderOf(settings.get(), SKILLS_FOLDER_KEY, DEFAULT_SKILLS_FOLDER)
    // Les bibliothèques de chaque sorte : la principale (le dossier des réglages), puis celles ajoutées.
    const issuersFolder = () => folderOf(settings.get(), ISSUERS_FOLDER_KEY, DEFAULT_ISSUERS_FOLDER)
    const tagsFolder = () => folderOf(settings.get(), TAGS_FOLDER_KEY, DEFAULT_TAGS_FOLDER)
    const mainFolder: Record<ShelfKind, () => string> = {
      document: () => folderOf(settings.get()),
      prompt: promptsFolder,
      persona: personasFolder,
      skill: skillsFolder,
      issuer: issuersFolder,
      tag: tagsFolder,
      person: () => folderOf(settings.get(), PERSONS_FOLDER_KEY, DEFAULT_PERSONS_FOLDER),
      glossary: () => folderOf(settings.get(), GLOSSARY_FOLDER_KEY, DEFAULT_GLOSSARY_FOLDER)
    }
    const referencesFolder = () => folderOf(settings.get(), REFERENCES_FOLDER_KEY, DEFAULT_REFERENCES_FOLDER)
    /** Les fiches que la bibliothèque déplace elle-même : leur renommage n'est pas un geste de l'utilisateur. */
    const ownMoves = new Set<string>()
    const projectsFolder = () => folderOf(settings.get(), PROJECTS_FOLDER_KEY, DEFAULT_PROJECTS_FOLDER)
    const shelves = (kind: ShelfKind): Shelf[] =>
      shelvesOf(
        settings.get(),
        kind,
        mainFolder[kind](),
        t(`bibliotheque.shelf.main.${kind}`),
        { folder: referencesFolder(), name: t('bibliotheque.shelf.references') },
        { folder: projectsFolder(), name: t('bibliotheque.shelf.projects') },
        // Le circuit des documents : À classer et À contrôler, dans leur bibliothèque.
        { folder: `${mainFolder.document()}/${CIRCUIT_FOLDER}`, name: t('bibliotheque.shelf.circuit') }
      )
    const defaultShelf = (kind: ShelfKind): Shelf => defaultShelfOf(settings.get(), kind, shelves(kind))
    // Les fiches déplacées (le circuit les range pendant qu'on regarde) : la page d'une fiche la suit.
    const movedRecords = new Map<string, string>()
    const store = new LibraryStore({
      fs: platform.fs,
      yaml: platform.yaml,
      folder: mainFolder.document,
      circuit: () => circuitOn(settings.get()),
      linksHeading: () => t('bibliotheque.links.heading'),
      backlinksHeading: () => t('bibliotheque.links.backHeading'),
      today: localToday,
      notesHeading: () => t('bibliotheque.notes'),
      ghostLine: (link, where) => t('bibliotheque.ghost.line', { link, where }),
      textOf: async (name, bytes) => (textReader ? textReader(name, bytes) : null),
      typer: () => pieceTyper ?? CATEGORY_TYPER,
      // Le texte du fichier, transcrit dans sa fiche — comme une pièce d'analyse (la lecture de fichiers le donne).
      transcribe: async (name, bytes) => (transcriber ? transcriber(name, bytes) : null),
      transcriptBlock: (transcript, version) =>
        [
          `## ${t('bibliotheque.text.heading')}`,
          '',
          ...(version
            ? [
                `> [!info] ${textVersionInfo(t, version, transcript.text.length.toLocaleString('fr-FR'))}`,
                // Des versions d'avant, s'il y en a (un scan lu par la vision n'en a pas).
                ...(version.number > 1 ? [`> ${t('bibliotheque.text.versionsKept')}`] : [])
              ]
            : transcript.state === 'lue'
            ? [`> [!info] ${t('bibliotheque.text.read', { characters: transcript.text.length.toLocaleString('fr-FR') })}`]
            : [`> [!warning] ${t(`bibliotheque.text.state.${transcript.state}`)}`, `> ${t(`bibliotheque.text.state.${transcript.state}.help`)}`]),
          '',
          // Ses tableaux complets (leur ligne de séparation), pour qu'Obsidian les montre en tableaux.
          transcript.state === 'lue' && transcript.text.trim() ? nestHeadings(completeLists(completeTables(transcript.text.trim()))) : `*${t('bibliotheque.text.none')}*`
        ].join('\n'),
      issuers: () => knownIssuers(),
      tags: () => knownTags(),
      // Les prompts et les personas, rangés sous la bibliothèque (ou ailleurs) : pas des documents.
      skip: () => ENTRY_KINDS.flatMap((kind) => shelves(kind)).map((shelf) => shelf.folder),
      shelves: () => shelves('document'),
      target: () => defaultShelf('document').folder,
      moving: (from, to) => {
        ownMoves.add(`${from}\u0000${to}`)
        movedRecords.set(from, to)
      }
    })
    const entryStore = (kind: EntryKind) =>
      new EntryStore(kind, { fs: platform.fs, yaml: platform.yaml, folder: mainFolder[kind], shelves: () => shelves(kind), target: () => defaultShelf(kind).folder })
    const entries: Record<EntryKind, EntryStore> = { prompt: entryStore('prompt'), persona: entryStore('persona'), skill: entryStore('skill'), issuer: entryStore('issuer'), tag: entryStore('tag'), person: entryStore('person'), glossary: entryStore('glossary') }
    const subdirectories = (kind: ShelfKind) => (folder: string) => (kind === 'document' ? store.subdirectories(folder) : entries[kind].subdirectories(folder))
    /** Un dossier d'une bibliothèque de documents, en mots : « Normes › ECSS » (son nom d'abord quand il y en a plusieurs). */
    const placeOfFolder = (folder: string): string => {
      const all = shelves('document')
      const shelf = [...all].sort((a, b) => b.folder.length - a.folder.length).find((each) => folder === each.folder || folder.startsWith(`${each.folder}/`))
      if (!shelf) return folder
      const parts = folder.slice(shelf.folder.length).split('/').filter(Boolean)
      // Une seule bibliothèque : son nom n'apprend rien, sauf à sa racine.
      return (severalShelves(all) || builtInShelf(shelf) || !parts.length ? [shelf.name, ...parts] : parts).join(' › ')
    }
    /** Un dossier des documents de référence (ou de l'un de ses répertoires) ? */
    const inReferences = (folder: string): boolean => folder === referencesFolder() || folder.startsWith(`${referencesFolder()}/`)
    /**
     * Ranger un document dans les documents de référence (`folder` : l'un de leurs répertoires,
     * sinon leur racine) : sa fiche y va, ses appels suivent ; un fantôme à son ancienne place,
     * proposé (`ghost: 'ask'`) — ou placé d'office quand on l'a déjà dit (`'always'`).
     */
    const toReferences = async (record: string, folder = referencesFolder(), ghost: 'ask' | 'always' = 'ask', ui: Ui = platform.ui): Promise<string | null> => {
      const doc = await store.load(record)
      if (!doc) return null
      const from = record.slice(0, record.lastIndexOf('/'))
      if (inReferences(from)) return record
      const moved = await store.move(record, folder)
      if (!moved) return null
      await recordMoved(record, moved)
      const references = placeOfFolder(folder)
      const before = placeOfFolder(from)
      const leave =
        ghost === 'always' ||
        (await ui.confirm({
          title: t('bibliotheque.references.ghost.title'),
          message: t('bibliotheque.references.ghost.message', { title: doc.title, where: before, references }),
          confirm: t('bibliotheque.references.ghost.place'),
          cancel: t('bibliotheque.references.ghost.none')
        }))
      const placed = leave ? await store.load(moved) : null
      const left = placed ? await store.addGhost(placed, from, references) : null
      platform.notifier.notify(t(left ? 'bibliotheque.references.moved' : 'bibliotheque.references.movedNoGhost', { title: doc.title, references }), 7000)
      return moved
    }
    /**
     * Une fiche déplacée **depuis l'explorateur d'Obsidian** dans les documents de référence (d'un
     * autre dossier) : ses appels suivent, et un fantôme à son ancienne place est proposé — comme
     * par « Déplacer… ». Ce que la bibliothèque déplace elle-même ne compte pas.
     */
    stopRenames?.()
    stopRenames =
      platform.fs.onRenamed?.(async (from, to) => {
        if (ownMoves.delete(`${from}\u0000${to}`) || !to.endsWith('.md')) return
        const before = from.slice(0, from.lastIndexOf('/'))
        const after = to.slice(0, to.lastIndexOf('/'))
        if (before === after || !inReferences(after) || inReferences(before)) return
        const doc = await store.load(to)
        if (!doc) return
        await recordMoved(from, to)
        const references = placeOfFolder(after)
        const where = placeOfFolder(before)
        const leave = await platform.ui.confirm({
          title: t('bibliotheque.references.ghost.title'),
          message: t('bibliotheque.references.ghost.message', { title: doc.title, where, references }),
          confirm: t('bibliotheque.references.ghost.place'),
          cancel: t('bibliotheque.references.ghost.none')
        })
        if (leave && (await store.addGhost(doc, before, references))) platform.notifier.notify(t('bibliotheque.references.ghost.done', { title: doc.title, where }), 6000)
        pagesChanged()
      }) ?? null
    /**
     * Proposer — ou placer d'office — un fantôme d'un document ici. Un document déjà rangé
     * ailleurs que dans les références : le ranger dans les références est proposé (versé dans
     * les références même, c'est ce qui est proposé d'abord).
     */
    const offerGhost = async (record: string, folder: string, ask: boolean, ui: Ui): Promise<string | null> => {
      const doc = await store.load(record)
      if (!doc || !folder) return null
      const range = placeOfFolder(record.slice(0, record.lastIndexOf('/')))
      const ici = placeOfFolder(folder)
      const outside = !inReferences(record.slice(0, record.lastIndexOf('/')))
      // Versé dans les références, un document rangé ailleurs : l'y ranger (un fantôme à son ancienne place) ?
      if (outside && inReferences(folder)) {
        const sure = await ui.confirm({
          title: t('bibliotheque.references.ask.title'),
          message: t('bibliotheque.references.askHere', { title: doc.title, where: range, references: ici }),
          confirm: t('bibliotheque.references.move', { references: ici }),
          cancel: t('bibliotheque.references.keep')
        })
        if (sure) return toReferences(record, folder, 'always', ui)
      }
      if (ask) {
        const sure = await ui.confirm({
          title: t('bibliotheque.ghost.ask.title'),
          message: t('bibliotheque.ghost.ask.message', { title: doc.title, where: range, ici }),
          confirm: t('bibliotheque.ghost.place'),
          cancel: t('bibliotheque.ghost.nothing')
        })
        if (!sure) return null
      }
      const ghost = await store.addGhost(doc, folder, range)
      if (ghost) platform.notifier.notify(t('bibliotheque.ghost.done', { title: doc.title, ici }), 6000)
      // Un document montré dans deux dossiers : commun, il a sa place dans les références (demandé, sauf « sans demander »).
      if (ask && ghost && outside && !inReferences(folder)) {
        const references = placeOfFolder(referencesFolder())
        const sure = await ui.confirm({
          title: t('bibliotheque.references.ask.title'),
          message: t('bibliotheque.references.ask', { title: doc.title, where: range, ici, references }),
          confirm: t('bibliotheque.references.move', { references }),
          cancel: t('bibliotheque.references.keep')
        })
        if (sure) await toReferences(record, referencesFolder(), 'always', ui)
      }
      return ghost
    }
    // Une lecture par l'IA qui commence, avance, finit : les pages ouvertes se redessinent.
    pagesChanged = () => context.views?.changed?.()
    // L'ancienne entrée « À verser » devient « À classer » (son contenu repris).
    try {
      await store.migrateInbox()
    } catch (error) {
      console.error('[Black Projects] bibliothèque', error)
    }
    // Les skills du circuit des documents (Ingérer, Analyser, Ranger un document) : là dès le départ,
    // puisque son workflow système les nomme ; recréés s'ils manquent.
    try {
      const circuitSkills = startersFor('skill', i18n.language).filter((draft) => !!draft.output)
      await entries.skill.addStarters(circuitSkills)
      // Un skill livré resté tel quel (pas modifié) suit sa nouvelle version (le texte, le contexte).
      for (const draft of circuitSkills) {
        const previous = previousStarterTexts(draft.name, i18n.language)
        if (!previous.length) continue
        const current = (await entries.skill.all()).find((entry) => entry.name === draft.name)
        if (current && previous.some((text) => text.trim() === current.text.trim())) await entries.skill.update(current.path, { ...draft, favorite: current.favorite, category: current.category, description: current.description, ...(current.threshold !== undefined ? { threshold: current.threshold } : {}) })
      }
    } catch (error) {
      console.error('[Black Projects] bibliothèque', error)
    }
    active = {
      store,
      t,
      entries,
      ui: platform.ui,
      placeOfFolder,
      offerGhost,
      locale: i18n.language === 'en' ? 'en-GB' : 'fr-FR',
      issuers: () => knownIssuers(),
      tagList: () => knownTags(),
      referencesFolder,
      projectsFolder,
      shelfOf: (folder) => shelfOfPath(shelves('document'), folder),
      ensureFolder: (folder) => platform.fs.ensureFolder(folder),
      filingFolders: () => filingFoldersNow(),
      applyFiling: (record, decision, threshold, skill) => applyFiling(record, decision, threshold, skill),
      applyAnalysis: (record, decision, threshold, skill) => applyAnalysis(record, decision, threshold, skill),
      markIngested: async (record, skill, detail) => {
        const doc = await store.load(record)
        if (!doc) return
        await store.setCircuit(record, doc.circuit === 'a-classer' ? { circuit: 'ingere' } : {}, circuitLine('bibliotheque.circuit.line.ingested', { skill, detail }))
        pagesChanged()
      },
      markCircuitError: async (record, skill, error) => {
        const doc = await store.load(record)
        if (!doc?.circuit) return
        await store.setCircuit(record, { circuitError: error }, circuitLine('bibliotheque.circuit.line.failed', { skill, error }))
        pagesChanged()
      },
      circuitActive: () => circuitOn(settings.get()),
      ensureCircuitSkills: () => ensureCircuitSkills(),
      removeDirectory: (folder) => removeDirectory('document', folder),
      pour: (folder) => pour(folder),
      toReferences: (record) => toReferences(record)
    }
    // Les listes des champs Prompt, Persona, Skill des étapes de workflow qui demandent l'IA.
    for (const kind of AI_ENTRY_KINDS)
      registerFieldSource(`bibliotheque.${kind}`, async () =>
        (await libraryEntries(kind)).map((entry) => ({ value: entry.name, label: entry.name, ...(entry.category || entry.description ? { description: [entry.category, entry.description].filter(Boolean).join(' · ') } : {}) }))
      )
    const showPage = context.showPage ? (id: string) => context.showPage?.(id) : undefined
    const showNote = (path: string) => (context.showNote ? context.showNote(path) : platform.ui.openNote(path))

    registerTrigger({
      id: TRIGGER_POURED,
      labelKey: 'bibliotheque.wf.trigger.poured',
      descKey: 'bibliotheque.wf.trigger.poured.desc',
      fields: ['titre', 'famille', 'categorie', 'fichier', 'origine', 'extension', 'lisible', 'lecture', 'langue', 'langueaconfirmer', 'reference', 'edition', 'revision', 'identiteaconfirmer', 'titreaconfirmer', 'emetteur', 'emetteurnom', 'emetteuraconfirmer', 'categorieaconfirmer', 'etiquettes', 'etiquettesaconfirmer', 'date', 'dateaconfirmer', 'texteextrait', 'scan', 'circuit', 'circuitencours', 'fiche'].map((key) => ({ key, labelKey: `bibliotheque.wf.var.${key}` }))
    })
    registerLibraryWorkflows({
      t,
      store,
      relaunchCircuit: async () => {
        if (!circuitOn(settings.get())) return 0
        await ensureCircuitSkills()
        // Pas ceux dont vous avez arrêté le circuit : « Continuer le circuit » les reprendra.
        const pending = (await store.all()).filter((doc) => (doc.circuit === 'a-classer' || doc.circuit === 'ingere' || doc.circuit === 'analyse') && !doc.circuitStopped)
        // Chacun repasse par le circuit, à la suite (un workflow s'exécute déjà : sans l'attendre, il le bloquerait) ; « relance » : sa lecture n'a pas pu se faire à l'entrée.
        const issuers = await knownIssuers()
        for (const doc of pending) {
          const subject = pouredSubject(doc, issuers)
          const run = runSystemWorkflow(CIRCUIT_WORKFLOW, TRIGGER_POURED, { ...subject, vars: { ...subject.vars, relance: t('bibliotheque.read.yes') } })
          if (!workflowRunning()) await run
        }
        return pending.length
      },
      toControl: async () => (await store.all()).filter((doc) => doc.circuit === 'a-controler'),
      pendingEntities: async () => (await store.all()).flatMap((doc) => (doc.proposals ?? []).map((proposal) => proposal.name)),
      searchGlossary: (record) => searchGlossary(record),
      maintainLinks: async () => {
        const done = await store.maintainLinks()
        if (done.docs.length) pagesChanged()
        return done
      },
      pourNow,
      // Le dossier de dépôt : versé, puis annoncé (le versement, chaque document) comme un autre.
      pourInbox: async () => {
        const origin = { module: BIBLIOTHEQUE, label: t('bibliotheque.origin.inbox') }
        const report = await store.pourInbox(origin, { detectVersions: !systemWorkflowManages(SYS_VERSIONS) })
        await announce(report, origin)
        return report
      },
      offerGhost
    })

    // ── Les bibliothèques et leurs répertoires ──
    const KIND_PAGE: Record<ShelfKind, string> = { document: LIBRARY_PAGE, prompt: 'bibliotheque.prompts', persona: 'bibliotheque.personas', skill: 'bibliotheque.skills', issuer: 'bibliotheque.issuers', tag: 'bibliotheque.tags', person: 'bibliotheque.persons', glossary: 'bibliotheque.glossaire' }
    const SHELF_ROOT: Record<ShelfKind, string> = {
      document: 'Bibliothèques/Documents',
      prompt: 'Bibliothèques/Prompts',
      persona: 'Bibliothèques/Personas',
      skill: 'Bibliothèques/Skills',
      issuer: 'Bibliothèques/Entreprises',
      tag: 'Bibliothèques/Étiquettes',
      person: 'Bibliothèques/Personnes',
      glossary: 'Bibliothèques/Glossaire'
    }
    const allShelfFolders = () => SHELF_KINDS.flatMap((kind) => shelves(kind).map((shelf) => shelf.folder))
    /** Une nouvelle bibliothèque : son nom, son dossier (proposé d'après le nom), par défaut ou non. */
    const newShelf = async (kind: ShelfKind): Promise<Shelf | null> => {
      const values = await platform.ui.askForm({
        title: t(`bibliotheque.shelf.new.${kind}`),
        intro: t('bibliotheque.shelf.new.intro'),
        fields: [
          { kind: 'text', key: 'name', label: t('bibliotheque.shelf.field.name'), required: true, value: '', placeholder: t(`bibliotheque.shelf.field.name.${kind}.placeholder`) },
          { kind: 'text', key: 'folder', label: t('bibliotheque.shelf.field.folder'), value: '', placeholder: `${SHELF_ROOT[kind]}/…`, description: t('bibliotheque.shelf.field.folder.desc', { root: SHELF_ROOT[kind] }) },
          { kind: 'toggle', key: 'default', label: t('bibliotheque.shelf.field.default'), value: false, tooltip: t(`bibliotheque.shelf.field.default.${kind}.tip`) }
        ],
        submit: t('bibliotheque.shelf.create')
      })
      const name = values?.name?.trim()
      if (!values || !name) return null
      const folder = (values.folder ?? '').trim() || `${SHELF_ROOT[kind]}/${folderName(name) || 'Bibliothèque'}`
      const made = withShelf(settings.get(), kind, { name, folder }, allShelfFolders())
      if ('problem' in made) {
        platform.notifier.notify(t(`bibliotheque.shelf.problem.${made.problem}`, { folder }), 8000)
        return null
      }
      await settings.save(values.default === 'true' ? withDefaultShelf(made.settings, kind, made.shelf.id) : made.settings)
      await platform.fs.ensureFolder(made.shelf.folder)
      platform.notifier.notify(t('bibliotheque.shelf.created', { name: made.shelf.name, folder: made.shelf.folder }), 6000)
      // Les pages ouvertes (l'accueil de la bibliothèque) la montrent aussitôt.
      pagesChanged()
      return made.shelf
    }
    const newDirectory = async (_kind: ShelfKind, folder: string): Promise<string | null> => {
      const values = await platform.ui.askForm({
        title: t('bibliotheque.place.newDirectory'),
        intro: t('bibliotheque.place.newDirectory.intro', { folder }),
        fields: [{ kind: 'text', key: 'name', label: t('bibliotheque.place.field.name'), required: true, value: '', placeholder: t('bibliotheque.place.field.name.placeholder') }],
        submit: t('bibliotheque.place.create')
      })
      const name = folderName(values?.name ?? '')
      if (!name) return null
      const path = `${folder}/${name}`
      if (await platform.fs.exists(path)) {
        platform.notifier.notify(t('bibliotheque.place.exists', { name }), 6000)
        return path
      }
      await platform.fs.ensureFolder(path)
      platform.notifier.notify(t('bibliotheque.place.created', { name }), 5000)
      return path
    }
    /** Tous les fichiers sous un dossier (sous-dossiers compris). */
    const filesUnder = async (folder: string): Promise<string[]> => {
      const out: string[] = []
      const walk = async (current: string): Promise<void> => {
        const listing = await platform.fs.list(current)
        out.push(...listing.files)
        for (const sub of listing.folders) await walk(sub)
      }
      if (await platform.fs.exists(folder)) await walk(folder)
      return out
    }
    /** Un chemin libre (« Plan (2).pdf » si « Plan.pdf » est pris). */
    const freePath = async (path: string): Promise<string> => {
      const dot = path.lastIndexOf('.')
      const [stem, ext] = dot > path.lastIndexOf('/') ? [path.slice(0, dot), path.slice(dot)] : [path, '']
      let candidate = path
      for (let index = 2; await platform.fs.exists(candidate); index++) candidate = `${stem} (${index})${ext}`
      return candidate
    }
    /**
     * **Supprimer un répertoire** d'une bibliothèque. Vide : après confirmation, à la corbeille.
     * Avec des documents (ou des entrées) : au choix, ils **remontent** dans le répertoire du
     * dessus (sous-répertoires compris ; les autres fichiers aussi), ou ils sont **retirés** —
     * mis de côté dans les retirés, rien n'est effacé ; le reste part à la corbeille avec le
     * répertoire. Jamais une bibliothèque, ni un répertoire qui en contient une.
     */
    const removeDirectory = async (kind: ShelfKind, folder: string): Promise<boolean> => {
      const fs = platform.fs
      if (!fs.trash || !folder.includes('/')) return false
      const name = folder.slice(folder.lastIndexOf('/') + 1)
      const parent = folder.slice(0, folder.lastIndexOf('/'))
      const under = (path: string) => path.startsWith(`${folder}/`)
      if (SHELF_KINDS.some((each) => shelves(each).some((shelf) => shelf.folder === folder || under(shelf.folder)))) {
        platform.notifier.notify(t('bibliotheque.place.remove.shelf', { name }), 8000)
        return false
      }
      const docs = kind === 'document' ? (await store.all()).filter((doc) => under(doc.record)) : []
      const notes = kind === 'document' ? [] : (await entries[kind as EntryKind].all()).filter((entry) => under(entry.path))
      const ghosts = kind === 'document' ? (await store.ghosts()).map((entry) => entry.ghost.path).filter(under) : []
      const known = new Set([...docs.map((doc) => doc.record), ...notes.map((entry) => entry.path), ...ghosts])
      const others = (await filesUnder(folder)).filter((path) => !known.has(path))
      const count = docs.length + notes.length
      let choice: 'empty' | 'keep' | 'aside'
      if (!count && !others.length) {
        const sure = await platform.ui.confirm({
          title: t('bibliotheque.place.remove.title', { name }),
          message: t('bibliotheque.place.remove.empty', { folder }),
          confirm: t('bibliotheque.place.remove'),
          cancel: t('bibliotheque.cancel'),
          danger: true
        })
        if (!sure) return false
        choice = 'empty'
      } else {
        const what = t(!count ? 'bibliotheque.place.remove.files' : others.length ? 'bibliotheque.place.remove.whatFiles' : 'bibliotheque.place.remove.what', { count, kind: kindName(kind), others: others.length })
        const picked = await platform.ui.pickOption(
          [
            { value: 'keep', label: t('bibliotheque.place.remove.keep', { parent: placeOfFolder(parent) || parent }), description: t('bibliotheque.place.remove.keep.desc', { what }) },
            { value: 'aside', label: t('bibliotheque.place.remove.aside', { kind: kindName(kind) }), description: t('bibliotheque.place.remove.aside.desc', { what }) }
          ],
          t('bibliotheque.place.remove.ask', { name, what })
        )
        if (picked !== 'keep' && picked !== 'aside') return false
        choice = picked
      }
      if (choice === 'keep') {
        for (const doc of docs) await store.move(doc.record, parent)
        for (const entry of notes) await entries[kind as EntryKind].move(entry.path, parent)
        for (const path of [...ghosts, ...others]) if (await fs.exists(path)) await fs.rename(path, await freePath(`${parent}/${path.slice(path.lastIndexOf('/') + 1)}`))
      } else if (choice === 'aside') {
        for (const doc of docs) await store.setAside(doc.record)
        for (const entry of notes) await entries[kind as EntryKind].setAside(entry.path)
        for (const path of ghosts) await store.removeGhost(path)
      }
      if (await fs.exists(folder)) await fs.trash(folder)
      platform.notifier.notify(
        t(choice === 'keep' ? 'bibliotheque.place.removed.keep' : choice === 'aside' ? 'bibliotheque.place.removed.aside' : 'bibliotheque.place.removed', { name, count, kind: kindName(kind), parent: placeOfFolder(parent) || parent }),
        8000
      )
      pagesChanged()
      return true
    }
    const setDefault = async (kind: ShelfKind, id: string): Promise<void> => {
      await settings.save(withDefaultShelf(settings.get(), kind, id))
      pagesChanged()
      const shelf = shelves(kind).find((each) => each.id === id)
      if (shelf) platform.notifier.notify(t(`bibliotheque.shelf.defaultDone.${kind}`, { name: shelf.name }), 6000)
    }
    const removeShelf = async (kind: ShelfKind, id: string): Promise<boolean> => {
      const shelf = shelves(kind).find((each) => each.id === id)
      if (!shelf || shelf.main || builtInShelf(shelf)) return false
      const sure = await platform.ui.confirm({
        title: t('bibliotheque.shelf.remove.title', { name: shelf.name }),
        message: t('bibliotheque.shelf.remove.message', { name: shelf.name, folder: shelf.folder }),
        confirm: t('bibliotheque.shelf.remove'),
        cancel: t('bibliotheque.cancel')
      })
      if (!sure) return false
      await settings.save(withoutShelf(settings.get(), kind, id))
      pagesChanged()
      platform.notifier.notify(t('bibliotheque.shelf.removed', { name: shelf.name, folder: shelf.folder }), 8000)
      return true
    }
    /** Un nom de sorte, pour les messages : « prompts », « documents »… */
    const kindName = (kind: ShelfKind) => t(`bibliotheque.exchange.kind.${kind}`)
    /** Ce qu'un lieu (une bibliothèque, ou l'un de ses répertoires) met dans une archive : ses notes, ou ses documents (fiche et fichier). */
    const collect = async (kind: ShelfKind, shelf: Shelf, directory: string): Promise<{ zipped: ZipEntry[]; documents: { fiche: string; fichier: string }[] }> => {
      const under = (item: { shelf?: string; directory?: string }) => item.shelf === shelf.id && (!directory || (item.directory ?? '') === directory || (item.directory ?? '').startsWith(`${directory}/`))
      const base = directory ? `${shelf.folder}/${directory}` : shelf.folder
      const relative = (path: string) => path.slice(base.length + 1)
      const read = async (path: string) => new Uint8Array(await platform.fs.readBinary(path))
      const zipped: ZipEntry[] = []
      const documents: { fiche: string; fichier: string }[] = []
      if (kind === 'document') {
        for (const doc of (await store.all()).filter(under)) {
          const fiche = relative(doc.record)
          zipped.push({ name: fiche, data: await read(doc.record) })
          if (doc.file && (await platform.fs.exists(doc.file))) {
            const fichier = `${ARCHIVE_FILES}/${fiche.replace(/\.md$/, '')}/${doc.file.slice(doc.file.lastIndexOf('/') + 1)}`
            zipped.push({ name: fichier, data: await read(doc.file) })
            documents.push({ fiche, fichier })
          }
        }
      } else {
        for (const entry of (await entries[kind as EntryKind].all()).filter(under)) zipped.push({ name: relative(entry.path), data: await read(entry.path) })
      }
      return { zipped, documents }
    }
    /**
     * Écrire une archive : la fenêtre propose où (d'office `Échanges/Bibliothèques`, son nom
     * habituel ; un nom libre) ; rend son chemin, `null` si l'on renonce (rien n'est écrit).
     */
    const writeArchive = async (name: string, manifest: Manifest, zipped: ZipEntry[]): Promise<string | null> => {
      const path = await askExportPath({ ui: platform.ui, fs: platform.fs, t }, { folder: EXCHANGE_FOLDER, name: archiveName(name, manifest.exporte).replace(/\.zip$/, ''), extension: 'zip' })
      if (!path) return null
      await platform.fs.writeBinary(path, archive(manifest, zipped, new Date()).slice().buffer)
      return path
    }
    const hiddenZip = (): boolean => platform.display?.kind('zip') === 'hidden'
    /**
     * Exporter un lieu (une bibliothèque, ou l'un de ses répertoires) : une archive ZIP dans
     * `Échanges/Bibliothèques`, à se passer — ses notes, ou ses documents (fiche et fichier).
     */
    const exportPlace = async (kind: ShelfKind, shelf: Shelf, directory: string): Promise<void> => {
      const { zipped, documents } = await collect(kind, shelf, directory)
      if (!zipped.length) {
        platform.notifier.notify(t('bibliotheque.exchange.empty', { where: directory || shelf.name }), 6000)
        return
      }
      const name = directory ? `${shelf.name} ${directory.split('/').join(' ')}` : shelf.name
      const path = await writeArchive(name, { format: EXCHANGE_FORMAT, sorte: kind, nom: name, exporte: localToday(), ...(kind === 'document' ? { documents } : {}) }, zipped)
      if (!path) return
      const count = kind === 'document' ? documents.length : zipped.length
      platform.notifier.notify([t('bibliotheque.exchange.exported', { count, kind: kindName(kind), path }), ...(hiddenZip() ? [t('bibliotheque.exchange.hidden')] : [])].join(' '), hiddenZip() ? 15000 : 10000)
    }
    /** Choisir une archive (de l'ordinateur ou du coffre) et l'ouvrir : son manifeste et ses fichiers (chemins sans le dossier qui l'entoure) ; `null` sinon (dit pourquoi). */
    const pickArchive = async (): Promise<{ manifest: Manifest; files: Map<string, Uint8Array> } | null> => {
      if (!archiveReader) {
        platform.notifier.notify(t('bibliotheque.exchange.noReader'), 8000)
        return null
      }
      const source = await platform.ui.pickOption(
        [
          { value: 'computer', label: t('bibliotheque.pour.computer'), description: t('bibliotheque.exchange.computer.desc') },
          { value: 'vault', label: t('bibliotheque.pour.vault'), description: t('bibliotheque.exchange.vault.desc') }
        ],
        t('bibliotheque.exchange.from')
      )
      let bytes: Uint8Array | null = null
      if (source === 'computer') bytes = (await platform.ui.pickExternalFiles({ accept: ['zip'], multiple: false }))[0]?.bytes ?? null
      else if (source === 'vault') {
        const path = await platform.ui.pickFile({ extensions: ['zip'], placeholder: t('bibliotheque.exchange.vault.pick') })
        if (path) bytes = new Uint8Array(await platform.fs.readBinary(path))
      }
      if (!bytes) return null
      let inside: { path: string; bytes: Uint8Array }[]
      try {
        inside = await archiveReader(bytes)
      } catch {
        platform.notifier.notify(t('bibliotheque.exchange.unreadable'), 8000)
        return null
      }
      const manifest = readManifest(inside)
      if (!manifest) {
        platform.notifier.notify(t('bibliotheque.exchange.notLibrary'), 8000)
        return null
      }
      // L'archive a pu être refaite autour d'un dossier : ses chemins, sans lui.
      const holder = inside.find((entry) => entry.path === MANIFEST || entry.path.endsWith(`/${MANIFEST}`))!.path.slice(0, -MANIFEST.length)
      return { manifest, files: new Map(inside.filter((entry) => entry.path.startsWith(holder)).map((entry) => [entry.path.slice(holder.length), entry.bytes])) }
    }
    /**
     * Ranger dans un dossier ce qu'une archive porte d'une bibliothèque (`files` : ses chemins à
     * elle). Une note déjà là à l'identique n'est pas réécrite (différente : gardée à côté) ; un
     * document passe par le versement (déjà là : pas de seconde copie ; nouveau : sa fiche
     * reprend celle de l'archive).
     */
    const restore = async (kind: ShelfKind, folder: string, files: ReadonlyMap<string, Uint8Array>, documents: readonly { fiche: string; fichier: string }[], name: string): Promise<{ added: number; already: number }> => {
      let added = 0
      let already = 0
      if (kind === 'document') {
        const origin = { module: BIBLIOTHEQUE, label: t('bibliotheque.exchange.origin', { name }) }
        for (const each of documents) {
          const file = files.get(each.fichier)
          if (!file) continue
          const where = each.fiche.includes('/') ? `${folder}/${each.fiche.slice(0, each.fiche.lastIndexOf('/'))}` : folder
          await platform.fs.ensureFolder(where)
          const report = await store.pour([{ name: each.fichier.slice(each.fichier.lastIndexOf('/') + 1), bytes: file }], origin, { folder: where })
          const fresh = report.added[0]
          if (!fresh) {
            already += report.already.length
            continue
          }
          added++
          // Sa fiche reprend ce que disait celle de l'archive (titre, type, référence, édition, entreprise…).
          const record = files.get(each.fiche)
          const was = record ? readRecord(each.fiche, readYamlFrontmatter(platform.yaml, new TextDecoder().decode(record)).data) : null
          if (was) {
            const keep = { ...fresh }
            for (const key of ['title', 'category', 'reference', 'edition', 'revision', 'issuer', 'tags', 'date', 'language'] as const) {
              const value = was[key]
              if (value !== undefined && value !== '' && !(Array.isArray(value) && !value.length)) Object.assign(keep, { [key]: value })
            }
            for (const flag of ['titleToConfirm', 'identityToConfirm', 'categoryToConfirm', 'issuerToConfirm', 'dateToConfirm', 'tagsToConfirm', 'languageToConfirm'] as const) {
              if (!was[flag]) delete keep[flag]
            }
            await store.save(keep)
          }
        }
      } else {
        for (const [path, content] of files) {
          if (!path.endsWith('.md') || path === MANIFEST || path.startsWith(`${ARCHIVE_FILES}/`)) continue
          let target = `${folder}/${path}`
          if (await platform.fs.exists(target)) {
            if (new TextDecoder().decode(content) === (await platform.fs.readText(target))) {
              already++
              continue
            }
            const stem = target.slice(0, -3)
            target = `${stem} (importé).md`
            for (let index = 2; await platform.fs.exists(target); index++) target = `${stem} (importé ${index}).md`
          }
          await platform.fs.ensureFolder(target.slice(0, target.lastIndexOf('/')))
          await platform.fs.writeText(target, new TextDecoder().decode(content))
          added++
        }
      }
      return { added, already }
    }
    /** Importer une archive de bibliothèque dans un lieu (de la même sorte). */
    const importInto = async (kind: ShelfKind, folder: string): Promise<void> => {
      const picked = await pickArchive()
      if (!picked) return
      const { manifest, files } = picked
      if (manifest.sorte === WHOLE) {
        platform.notifier.notify(t('bibliotheque.exchange.wholeHere'), 10000)
        return
      }
      if (manifest.sorte !== kind) {
        platform.notifier.notify(t('bibliotheque.exchange.otherKind', { kind: kindName(manifest.sorte), here: kindName(kind) }), 10000)
        return
      }
      const { added, already } = await restore(kind, folder, files, manifest.documents ?? [], manifest.nom)
      platform.notifier.notify(t('bibliotheque.exchange.imported', { added, already, kind: kindName(kind), name: manifest.nom }), 10000)
      pagesChanged()
    }
    /**
     * **Toute la bibliothèque**, d'un coup : chaque bibliothèque de chaque sorte (documents,
     * références, documents projet, les vôtres ; prompts, personas, skills ; étiquettes ;
     * entreprises, personnes) dans une seule archive, chacune sous `<sorte>/<bibliothèque>/`.
     */
    const exportAll = async (): Promise<void> => {
      const zipped: ZipEntry[] = []
      const parts: WholePart[] = []
      const counts = new Map<ShelfKind, number>()
      for (const kind of SHELF_KINDS) {
        for (const shelf of shelves(kind)) {
          const found = await collect(kind, shelf, '')
          if (!found.zipped.length) continue
          const prefix = `${kind}/${shelf.id}`
          zipped.push(...found.zipped.map((entry) => ({ name: `${prefix}/${entry.name}`, data: entry.data })))
          parts.push({ prefixe: prefix, sorte: kind, id: shelf.id, nom: shelf.name, ...(kind === 'document' ? { documents: found.documents } : {}) })
          counts.set(kind, (counts.get(kind) ?? 0) + (kind === 'document' ? found.documents.length : found.zipped.length))
        }
      }
      if (!zipped.length) {
        platform.notifier.notify(t('bibliotheque.exchange.allEmpty'), 6000)
        return
      }
      const name = t('bibliotheque.exchange.whole')
      const path = await writeArchive(name, { format: EXCHANGE_FORMAT, sorte: WHOLE, nom: name, exporte: localToday(), bibliotheques: parts }, zipped)
      if (!path) return
      const what = [...counts].map(([kind, count]) => `${count} ${kindName(kind)}`).join(', ')
      platform.notifier.notify([t('bibliotheque.exchange.allExported', { what, path }), ...(hiddenZip() ? [t('bibliotheque.exchange.hidden')] : [])].join(' '), hiddenZip() ? 15000 : 10000)
    }
    /**
     * Importer **toute une bibliothèque** : chaque partie dans la bibliothèque du même nom chez
     * soi — la même (principale, références, documents projet), ou une créée pour elle (documents,
     * annuaire) ; une bibliothèque de prompts, personas… en plus : dans un répertoire de la
     * principale. Une archive d'une seule bibliothèque va dans la bibliothèque par défaut de sa sorte.
     */
    const importAll = async (): Promise<void> => {
      const picked = await pickArchive()
      if (!picked) return
      const { manifest, files } = picked
      const parts: WholePart[] = manifest.sorte === WHOLE ? manifest.bibliotheques ?? [] : [{ prefixe: '', sorte: manifest.sorte, id: defaultShelf(manifest.sorte).id, nom: manifest.nom, ...(manifest.documents ? { documents: manifest.documents } : {}) }]
      const added = new Map<ShelfKind, number>()
      let already = 0
      for (const part of parts) {
        if (!SHELF_KINDS.includes(part.sorte)) continue
        const kind = part.sorte
        let folder = shelves(kind).find((shelf) => shelf.id === part.id)?.folder
        if (!folder && (kind === 'document' || kind === 'issuer' || kind === 'person')) {
          const made = withShelf(settings.get(), kind, { name: part.nom, folder: `${SHELF_ROOT[kind]}/${folderName(part.nom) || 'Bibliothèque'}` }, allShelfFolders())
          if (!('problem' in made)) {
            await settings.save(made.settings)
            await platform.fs.ensureFolder(made.shelf.folder)
            folder = made.shelf.folder
          }
        }
        // Sinon : dans un répertoire de la principale, du nom de la bibliothèque.
        folder ??= `${shelves(kind)[0]!.folder}/${folderName(part.nom) || 'Importé'}`
        const prefix = part.prefixe ? `${part.prefixe}/` : ''
        const own = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]))
        const result = await restore(kind, folder, own, part.documents ?? [], manifest.nom)
        added.set(kind, (added.get(kind) ?? 0) + result.added)
        already += result.already
      }
      const what = [...added].filter(([, count]) => count).map(([kind, count]) => `${count} ${kindName(kind)}`).join(', ') || t('bibliotheque.exchange.nothingNew')
      platform.notifier.notify(t('bibliotheque.exchange.allImported', { name: manifest.nom, what, already }), 10000)
      pagesChanged()
    }
    const placesOf = (kind: ShelfKind): ShelfPlacesDeps => ({
      t,
      kind,
      page: KIND_PAGE[kind],
      hub: 'bibliotheque.accueil',
      shelves: () => shelves(kind),
      defaultShelf: () => defaultShelf(kind),
      subdirectories: subdirectories(kind),
      ...(showPage ? { showPage } : {}),
      newDirectory,
      ...(platform.fs.trash ? { removeDirectory } : {}),
      newShelf,
      setDefault,
      removeShelf,
      // Les prompts, personas, skills, étiquettes : une seule bibliothèque chacun (on y ajoute ses entrées).
      canCreateShelves: kind === 'document' || kind === 'issuer' || kind === 'person',
      exportPlace,
      importInto
    })
    const places = { document: placesOf('document'), prompt: placesOf('prompt'), persona: placesOf('persona'), skill: placesOf('skill'), issuer: placesOf('issuer'), tag: placesOf('tag'), person: placesOf('person'), glossary: placesOf('glossary') }
    /** L'arborescence des bibliothèques (en explorateur de fichiers, le réglage d'origine) ; sinon rien : l'affichage en cartes. */
    const explorerFor = async (current: ExplorerPlace) =>
      settings.get()[EXPLORER_KEY] === false
        ? undefined
        : libraryExplorer({ t, hub: ENTRIES_HUB_PAGE, places, items: (kind) => (kind === 'document' ? store.all() : entries[kind].all()), pieceTypes: pieceTypesShortcut, ...(showPage ? { showPage } : {}) }, current)
    /** Choisir où ranger : chaque bibliothèque de la sorte, chacun de ses répertoires (sauf là où c'est déjà). */
    const pickPlace = async (kind: ShelfKind, current: string, title: string): Promise<string | null> => {
      const options = (await allPlaces(shelves(kind), subdirectories(kind)))
        // Pas dans le circuit : on n'y range pas (le circuit y met ce qu'il trie).
        .filter((place) => place.folder !== current && !place.shelf.circuit)
        .map((place) => ({ value: place.folder, label: [place.shelf.name, ...place.directory.split('/').filter(Boolean)].join(' › '), description: place.folder }))
      if (!options.length) {
        platform.notifier.notify(t('bibliotheque.move.none'), 6000)
        return null
      }
      return platform.ui.pickOption(options, title)
    }

    // ── Le circuit des documents : les contextes des skills, les décisions, À contrôler ──
    /** Les dossiers où ranger un document : chaque bibliothèque de documents, chacun de ses répertoires. */
    const filingFoldersNow = async (): Promise<{ folder: string; label: string }[]> =>
      (await allPlaces(shelves('document'), subdirectories('document'))).filter((place) => !place.shelf.circuit).map((place) => ({ folder: place.folder, label: [place.shelf.name, ...place.directory.split('/').filter(Boolean)].join(' › ') }))
    /** « 2026-11-16 10:42 » : quand, pour l'historique d'une fiche. */
    const momentNow = (): string => {
      const now = new Date()
      return `${localToday()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    }
    const percent = (value: number): string => `${Math.round(value * 100)} %`
    const circuitLine = (key: string, vars: Record<string, string | number>) => ({ heading: t('bibliotheque.circuit.heading'), line: `${momentNow()} · ${t(key, vars)}` })
    /** Ce que lit le skill de rangement : les règles de la bibliothèque principale (une note à soi), s'il y en a. */
    const rulesNote = (): string => `${store.root}/${t('bibliotheque.circuit.rulesNote')}.md`
    const SKILL_TEXT_LIMIT = 12000
    // Les contextes livrés par la bibliothèque : la fiche, le texte, les dossiers, les règles de rangement.
    for (const stop of stopSkillContexts) stop()
    stopSkillContexts = [
      registerSkillContext({
        key: 'fiche',
        label: t('bibliotheque.skill.context.fiche'),
        provide: async (record) => {
          const doc = await store.load(record)
          if (!doc) return ''
          const line = (key: string, value: string | undefined) => (value ? `- ${t(key)} : ${value}` : '')
          return [
            line('bibliotheque.circuit.ctx.title', doc.title),
            line('bibliotheque.circuit.ctx.file', baseName(doc.file)),
            line('bibliotheque.circuit.ctx.where', placeOfFolder(record.slice(0, record.lastIndexOf('/')))),
            line('bibliotheque.circuit.ctx.category', doc.category),
            line('bibliotheque.circuit.ctx.issuer', doc.issuer),
            line('bibliotheque.circuit.ctx.reference', [doc.reference, versionLabel(doc)].filter(Boolean).join(' ')),
            line('bibliotheque.circuit.ctx.date', doc.date),
            line('bibliotheque.circuit.ctx.tags', doc.tags.join(', ')),
            line('bibliotheque.circuit.ctx.language', doc.language),
            line('bibliotheque.circuit.ctx.origins', doc.origins.map((origin) => [origin.module, origin.label].filter(Boolean).join(' — ')).join(' ; ')),
            line('bibliotheque.circuit.ctx.project', doc.circuitProject)
          ]
            .filter(Boolean)
            .join('\n')
        }
      }),
      registerSkillContext({
        key: 'texte',
        label: t('bibliotheque.skill.context.texte'),
        provide: async (record) => {
          const text = ((await store.textOfRecord(record)) ?? '').trim()
          if (!text) return t('bibliotheque.circuit.ctx.noText')
          return text.length > SKILL_TEXT_LIMIT ? `${text.slice(0, SKILL_TEXT_LIMIT)}\n\n${t('bibliotheque.circuit.ctx.truncated', { shown: SKILL_TEXT_LIMIT, total: text.length })}` : text
        }
      }),
      registerSkillContext({
        key: 'types-de-piece',
        label: t('bibliotheque.skill.context.types-de-piece'),
        provide: async () => [t('bibliotheque.circuit.ctx.types'), ...libraryPieceTypes().map((type) => `- ${type.code}${type.label && type.label !== type.code ? ` — ${type.label}` : ''}`)].join('\n')
      }),
      registerSkillContext({
        key: 'emetteurs',
        label: t('bibliotheque.skill.context.emetteurs'),
        provide: async () => {
          const known = await knownIssuers()
          return known.length ? [t('bibliotheque.circuit.ctx.issuers'), ...known.map((issuer) => `- ${issuer.code} — ${issuer.name}${issuer.aliases.length ? ` (${issuer.aliases.join(', ')})` : ''}`)].join('\n') : t('bibliotheque.circuit.ctx.noIssuers')
        }
      }),
      registerSkillContext({
        key: 'candidats',
        label: t('bibliotheque.skill.context.candidats'),
        provide: async (record) => {
          const found = await linkCandidatesFor(record)
          return found.length ? [t('bibliotheque.circuit.ctx.candidates'), ...found.map((each) => `- ${each.path} — ${each.kind} : ${each.label} (« ${each.found} »)`)].join('\n') : t('bibliotheque.circuit.ctx.noCandidates')
        }
      }),
      // Le glossaire : les termes que le document emploie, et leur définition — pour que l'IA le comprenne.
      registerSkillContext({
        key: 'glossaire',
        label: t('bibliotheque.skill.context.glossaire'),
        provide: async (record) => {
          const terms = await glossaryOf(record)
          return terms.length ? [t('bibliotheque.circuit.ctx.glossary'), ...terms.map((term) => `- ${term.label} : ${term.definition}`)].join('\n') : t('bibliotheque.circuit.ctx.noGlossary')
        }
      }),
      // Où chercher les liens : les autres documents (par leur référence), les entreprises, les personnes.
      registerLinkSource({
        key: 'documents',
        label: t('bibliotheque.links.kind.document'),
        items: async () => (await store.all()).filter((doc) => doc.reference.trim().length >= 4).map((doc) => ({ path: doc.record, label: [doc.reference, doc.title].filter(Boolean).join(' — '), names: [doc.reference] }))
      }),
      registerLinkSource({
        key: 'entreprises',
        label: t('bibliotheque.links.kind.issuer'),
        items: async () =>
          (await entries.issuer.all()).map((entry) => ({
            path: entry.path,
            label: entry.code ? `${entry.code} — ${entry.name}` : entry.name,
            names: [entry.code ?? '', entry.name, ...entry.text.split('\n').map((line) => line.replace(/^[-*•]\s*/, '').trim())].filter(Boolean)
          }))
      }),
      registerLinkSource({
        key: 'personnes',
        label: t('bibliotheque.links.kind.person'),
        items: async () => (await entries.person.all()).map((entry) => ({ path: entry.path, label: entry.name, names: [entry.name] }))
      }),
      // Le glossaire : un terme (ou son sigle) que le document emploie — le circuit peut l'y relier.
      registerLinkSource({
        key: 'glossaire',
        label: t('bibliotheque.links.kind.glossary'),
        items: async () => (await entries.glossary.all()).map((entry) => ({ path: entry.path, label: entryTitle(entry), names: [entry.name, entry.code ?? '', ...(entry.aliases ?? [])].filter(Boolean) }))
      }),
      registerSkillContext({
        key: 'dossiers',
        label: t('bibliotheque.skill.context.dossiers'),
        provide: async () => [t('bibliotheque.circuit.ctx.folders'), ...(await filingFoldersNow()).map((each) => `- ${each.folder} — ${each.label}`)].join('\n')
      }),
      registerSkillContext({
        key: 'regles-de-rangement',
        label: t('bibliotheque.skill.context.regles-de-rangement'),
        provide: async () => {
          const path = rulesNote()
          if (!(await platform.fs.exists(path))) return t('bibliotheque.circuit.ctx.noRules')
          return readYamlFrontmatter(platform.yaml, await platform.fs.readText(path)).body.replace(/%%[\s\S]*?%%/g, '').trim() || t('bibliotheque.circuit.ctx.noRules')
        }
      })
    ]
    /** Ranger pour de bon (une décision sûre, ou celle de l'utilisateur) : la fiche va dans le dossier, le circuit dit « rangé ». */
    const fileInto = async (record: string, folder: string, line: { heading: string; line: string }, confidence?: number): Promise<string> => {
      const moved = (await store.move(record, folder)) ?? record
      await store.setCircuit(moved, { circuit: 'range', circuitReason: undefined, circuitProposal: undefined, circuitAlternatives: undefined, circuitConfidence: confidence }, line)
      pagesChanged()
      return moved
    }
    const applyFiling = async (record: string, decision: FilingDecision | null, threshold: number, skill: string): Promise<FilingOutcome | null> => {
      const doc = await store.load(record)
      if (!doc) return null
      if (decision && decision.folder && decision.confidence >= threshold) {
        const place = placeOfFolder(decision.folder)
        const moved = await fileInto(record, decision.folder, circuitLine('bibliotheque.circuit.line.filed', { skill, place, confidence: percent(decision.confidence) }), decision.confidence)
        return { outcome: 'range', record: moved, message: t('bibliotheque.circuit.filed', { title: doc.title, place, confidence: percent(decision.confidence) }) }
      }
      // Pas sûre (ou illisible, ou un dossier qui n'existe pas) : soumise à l'utilisateur.
      const reason = !decision
        ? t('bibliotheque.circuit.reason.unreadable')
        : !decision.folder
          ? [t('bibliotheque.circuit.reason.noFolder'), decision.reason].filter(Boolean).join(' — ')
          : decision.reason || t('bibliotheque.circuit.reason.none')
      await platform.fs.ensureFolder(store.controlFolder)
      const moved = (await store.move(record, store.controlFolder)) ?? record
      await store.setCircuit(
        moved,
        {
          circuit: 'a-controler',
          circuitReason: reason,
          circuitProposal: decision?.folder || undefined,
          circuitConfidence: decision?.confidence ?? 0,
          circuitAlternatives: decision?.alternatives.length ? decision.alternatives : undefined
        },
        circuitLine('bibliotheque.circuit.line.toControl', { skill, confidence: percent(decision?.confidence ?? 0), threshold: percent(threshold), reason })
      )
      pagesChanged()
      return { outcome: 'a-controler', record: moved, message: t('bibliotheque.circuit.toControl', { title: doc.title, confidence: percent(decision?.confidence ?? 0), threshold: percent(threshold) }) }
    }
    const applyAnalysis = async (record: string, decision: AnalysisDecision | null, threshold: number, skill: string): Promise<string | null> => {
      const doc = await store.load(record)
      if (!doc) return null
      const project = decision?.project && decision.project.endsWith('.md') && (await platform.fs.exists(decision.project)) ? decision.project : ''
      const sure = !!decision && decision.confidence >= threshold
      const done: string[] = []
      if (sure && decision.category && decision.category !== doc.category && (doc.categoryToConfirm || !doc.category)) {
        await store.setCategory(record, decision.category, true)
        done.push(t('bibliotheque.circuit.analysis.category', { category: decision.category }))
      }
      if (sure && decision.issuer && decision.issuer !== doc.issuer && (doc.issuerToConfirm || !doc.issuer)) {
        await store.setIssuer(record, decision.issuer, true)
        done.push(t('bibliotheque.circuit.analysis.issuer', { issuer: decision.issuer }))
      }
      if (project) done.push(t('bibliotheque.circuit.analysis.project', { project: baseName(project).replace(/\.md$/, '') }))
      // Ses liens (sûre seulement) : ceux que l'IA a choisis parmi les candidats, et le projet reconnu ; un rétrolien dans chaque note citée.
      if (sure) {
        const links = [...decision.links]
        if (project && !links.some((each) => each.path === project)) links.push({ path: project, why: t('bibliotheque.links.projectWhy') })
        // Les termes que la recherche dans le glossaire a déjà reliés : gardés.
        const terms = new Set((await entries.glossary.all()).map((entry) => entry.path))
        for (const link of await store.linksOf(record)) if (terms.has(link.path) && !links.some((each) => each.path === link.path)) links.push(link)
        if (links.length) {
          const written = await store.setLinks(record, links)
          if (written.length) done.push(t('bibliotheque.circuit.analysis.links', { count: written.length }))
        }
      }
      // Les entreprises et personnes inconnues qu'il cite : proposées (gardées sur sa fiche), jamais créées seules.
      if (decision?.proposals.length) {
        const added = await addProposals(record, decision.proposals)
        if (added) done.push(t('bibliotheque.circuit.analysis.proposals', { count: added }))
      }
      const summary = !decision
        ? t('bibliotheque.circuit.reason.unreadable')
        : [done.join(', ') || t('bibliotheque.circuit.analysis.nothing'), `${t('bibliotheque.circuit.analysis.confidence', { confidence: percent(decision.confidence) })}${sure ? '' : ` — ${t('bibliotheque.circuit.analysis.unsure', { threshold: percent(threshold) })}`}`].join(' · ')
      await store.setCircuit(
        record,
        { ...(doc.circuit === 'a-classer' || doc.circuit === 'ingere' ? { circuit: 'analyse' as const } : {}), ...(project ? { circuitProject: project } : {}) },
        circuitLine('bibliotheque.circuit.line.analysed', { skill, summary })
      )
      pagesChanged()
      return t('bibliotheque.circuit.analysed', { title: doc.title, summary })
    }
    /** Les skills du circuit (ceux qui rendent une décision) : ajoutés à la bibliothèque des skills s'ils manquent. */
    const ensureCircuitSkills = async (): Promise<void> => {
      await entries.skill.addStarters(startersFor('skill', i18n.language).filter((draft) => !!draft.output))
    }
    /** À contrôler : la proposition de l'IA, acceptée. */
    const acceptProposal = async (record: string): Promise<string | null> => {
      const doc = await store.load(record)
      if (!doc?.circuitProposal) return null
      const place = placeOfFolder(doc.circuitProposal)
      const moved = await fileInto(record, doc.circuitProposal, circuitLine('bibliotheque.circuit.line.accepted', { place }))
      platform.notifier.notify(t('bibliotheque.circuit.accepted', { title: doc.title, place }), 6000)
      return moved
    }
    /** À contrôler : un autre dossier, choisi (les autres propositions de l'IA d'abord, puis tous). */
    const fileElsewhere = async (record: string): Promise<string | null> => {
      const doc = await store.load(record)
      if (!doc) return null
      const all = await filingFoldersNow()
      const proposed = [doc.circuitProposal, ...(doc.circuitAlternatives ?? [])].filter((each): each is string => !!each)
      const options = [
        ...proposed.filter((folder) => all.some((each) => each.folder === folder)).map((folder) => ({ value: folder, label: all.find((each) => each.folder === folder)!.label, description: t('bibliotheque.circuit.proposedByAi') })),
        ...all.filter((each) => !proposed.includes(each.folder)).map((each) => ({ value: each.folder, label: each.label, description: each.folder }))
      ]
      const folder = await platform.ui.pickOption(options, t('bibliotheque.circuit.pick', { title: doc.title }))
      if (!folder) return null
      const place = placeOfFolder(folder)
      const moved = await fileInto(record, folder, circuitLine('bibliotheque.circuit.line.chosen', { place }))
      platform.notifier.notify(t('bibliotheque.circuit.accepted', { title: doc.title, place }), 6000)
      return moved
    }
    /** À contrôler : écarté — la fiche mise de côté (rien n'est effacé). */
    const discardControlled = async (record: string): Promise<boolean> => {
      const doc = await store.load(record)
      if (!doc) return false
      await store.setCircuit(record, { circuit: 'ecarte' }, circuitLine('bibliotheque.circuit.line.discarded', {}))
      await store.setAside(record)
      platform.notifier.notify(t('bibliotheque.circuit.discarded', { title: doc.title }), 6000)
      pagesChanged()
      return true
    }
    /** Pourquoi on ne peut pas continuer le circuit (le réglage coupé, pas d'IA) ; `null` : on peut. */
    const cannotContinue = (): string | null =>
      settings.get()[CIRCUIT_KEY] === false ? t('bibliotheque.circuit.continue.off') : aiCircuitReady?.() === true ? null : t('bibliotheque.circuit.continue.noAi')
    /**
     * Continuer le circuit d'un document, là où il s'est arrêté : son échec oublié, le workflow du
     * circuit relancé (les étapes faites sont passées). À contrôler : le rangement redemandé à l'IA
     * (s'il ne peut pas l'être — le workflow coupé —, il reste à contrôler).
     */
    const continueCircuit = async (record: string, quiet = false): Promise<boolean> => {
      if (cannotContinue()) return false
      const doc = await store.load(record)
      // Pas dans le circuit, ou déjà en cours de traitement : rien à continuer.
      if (!doc || !inCircuit(doc) || circuitRunning.has(record)) return false
      await ensureCircuitSkills()
      const control = doc.circuit === 'a-controler'
      const ready = await store.setCircuit(
        record,
        { ...(control ? { circuit: 'analyse' as const, circuitReason: undefined, circuitProposal: undefined, circuitConfidence: undefined, circuitAlternatives: undefined } : {}), circuitError: undefined, circuitStopped: undefined },
        circuitLine('bibliotheque.circuit.line.continued', {})
      )
      if (!ready) return false
      pagesChanged()
      if (!quiet) platform.notifier.notify(t('bibliotheque.circuit.continued', { title: doc.title }), 5000)
      const subject = pouredSubject(ready, await knownIssuers())
      const run = runSystemWorkflow(CIRCUIT_WORKFLOW, TRIGGER_POURED, { ...subject, vars: { ...subject.vars, relance: t('bibliotheque.read.yes') } })
      // Un workflow s'exécute déjà : sans l'attendre (il le bloquerait), le circuit passera à la suite.
      if (workflowRunning()) return true
      const ran = await run
      if (!ran && control) {
        await store.setCircuit(record, { circuit: 'a-controler', circuitReason: doc.circuitReason, circuitProposal: doc.circuitProposal, circuitConfidence: doc.circuitConfidence, circuitAlternatives: doc.circuitAlternatives })
        platform.notifier.notify(t('bibliotheque.circuit.continue.notRun'), 6000)
      }
      pagesChanged()
      return ran
    }
    /** Continuer le circuit de tous ceux qui attendent (pas ceux à contrôler : ils attendent votre décision). */
    const continueAll = async (): Promise<number> => {
      if (cannotContinue()) return 0
      const waiting = (await store.all()).filter((doc) => inCircuit(doc) && doc.circuit !== 'a-controler' && !circuitRunning.has(doc.record))
      for (const doc of waiting) await continueCircuit(doc.record, true)
      if (waiting.length) platform.notifier.notify(t('bibliotheque.circuit.continuedAll', { count: waiting.length }), 5000)
      return waiting.length
    }
    /** Les documents à contrôler. */
    const toControl = async (): Promise<LibraryDoc[]> => (await store.all()).filter((doc) => doc.circuit === 'a-controler')

    // ── Les entreprises et personnes inconnues, proposées par l'analyse ──
    const sameName = (a: string, b: string) => a.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim() === b.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
    /** Déjà connue (une note d'entreprise ou de personne) : son chemin ; sinon `null`. */
    const knownEntity = async (proposal: EntityProposal): Promise<string | null> => {
      const all = await entries[proposal.kind].all()
      const found = all.find((entry) => sameName(entry.name, proposal.name) || (proposal.kind === 'issuer' && !!proposal.code && !!entry.code && sameName(entry.code, proposal.code)))
      return found?.path ?? null
    }
    /** Ajouter des propositions à une fiche (pas celles qu'elle a déjà, ni les entités connues) ; rend combien. */
    const addProposals = async (record: string, proposals: readonly EntityProposal[]): Promise<number> => {
      const doc = await store.load(record)
      if (!doc) return 0
      const kept = [...(doc.proposals ?? [])]
      let added = 0
      for (const proposal of proposals) {
        if (kept.some((each) => each.kind === proposal.kind && sameName(each.name, proposal.name))) continue
        if (await knownEntity(proposal)) continue
        kept.push(proposal)
        added++
      }
      if (added) await store.save({ ...doc, proposals: kept })
      return added
    }
    const withoutProposal = async (record: string, index: number): Promise<{ doc: LibraryDoc; proposal: EntityProposal } | null> => {
      const doc = await store.load(record)
      const proposal = doc?.proposals?.[index]
      if (!doc || !proposal) return null
      const rest = doc.proposals!.filter((_, at) => at !== index)
      const next: LibraryDoc = { ...doc }
      if (rest.length) next.proposals = rest
      else delete next.proposals
      await store.save(next)
      return { doc, proposal }
    }
    /** Créer l'entité proposée (une note d'entreprise ou de personne ; déjà là, celle-ci), liée au document. Rend sa note. */
    const createProposed = async (record: string, index: number): Promise<string | null> => {
      const taken = await withoutProposal(record, index)
      if (!taken) return null
      const { doc, proposal } = taken
      const path =
        (await knownEntity(proposal)) ??
        (await entries[proposal.kind].create({
          name: proposal.name,
          category: '',
          description: '',
          text: '',
          favorite: false,
          ...(proposal.kind === 'issuer' && proposal.code ? { code: proposal.code } : {}),
          ...(proposal.kind === 'person' && proposal.company ? { company: proposal.company } : {})
        }))
      const links = await store.linksOf(record)
      await store.setLinks(record, [...links.filter((each) => each.path !== path), { path, why: proposal.why || t('bibliotheque.proposals.citedWhy') }])
      platform.notifier.notify(t(`bibliotheque.proposals.created.${proposal.kind}`, { name: proposal.name, title: doc.title }), 6000)
      pagesChanged()
      return path
    }
    const dismissProposed = async (record: string, index: number): Promise<void> => {
      if (await withoutProposal(record, index)) pagesChanged()
    }
    /** Toutes les propositions en attente, document par document. */
    const allProposals = async (): Promise<{ doc: LibraryDoc; proposal: EntityProposal; index: number }[]> =>
      (await store.all()).flatMap((doc) => (doc.proposals ?? []).map((proposal, index) => ({ doc, proposal, index })))

    /** Verser des documents soi-même : de l'ordinateur (copiés) ou du coffre (laissés à leur place) ; dans un dossier, sinon la bibliothèque par défaut. */
    const pour = async (folder?: string): Promise<PourReport | null> => {
      const source = await platform.ui.pickOption(
        [
          { value: 'computer', label: t('bibliotheque.pour.computer'), description: t('bibliotheque.pour.computer.desc') },
          { value: 'vault', label: t('bibliotheque.pour.vault'), description: t('bibliotheque.pour.vault.desc') }
        ],
        t('bibliotheque.pour.from')
      )
      let items: PourItem[] = []
      if (source === 'computer') items = (await platform.ui.pickExternalFiles({ multiple: true })).map((file) => ({ name: file.name, bytes: file.bytes }))
      else if (source === 'vault') {
        const path = await platform.ui.pickFile({ placeholder: t('bibliotheque.pour.vault.pick') })
        if (path) items = [{ name: baseName(path), path }]
      }
      return pourItems(items, folder)
    }
    /** Verser ce qui est choisi, ou glissé-déposé : le dire ensuite (entrés, déjà là, illisibles). */
    const pourItems = async (items: readonly PourItem[], folder?: string): Promise<PourReport | null> => {
      if (!items.length) return null
      // Déposé soi-même dans un lieu : un document déjà là, ailleurs, peut y laisser un fantôme.
      const report = await pourIntoLibrary(items, { module: BIBLIOTHEQUE, label: t('bibliotheque.origin.hand') }, folder ? { folder, ghosts: true } : {})
      if (report)
        platform.notifier.notify(
          [
            t('bibliotheque.pour.done', { added: report.added.length, already: report.already.length }),
            ...(report.failed.length ? [t('bibliotheque.pour.failed', { names: report.failed.join(', ') })] : []),
            ...(report.added.some((doc) => doc.likelyPrevious) ? [t('bibliotheque.pour.likely')] : [])
          ].join(' '),
          10000
        )
      return report
    }

    // ── Les émetteurs : une liste (code, nom, autres noms), comme les types de pièce ──
    /** Les émetteurs de la liste, pour reconnaître et choisir celui d'un document. */
    // (Une fonction déclarée : la fiche d'un document versé dès l'activation la trouve déjà.)
    async function knownIssuers(): Promise<KnownIssuer[]> {
      return (await entries.issuer.all()).map((entry) => ({
        code: entry.code || entry.name,
        name: entry.name,
        aliases: entry.text
          .split('\n')
          .map((line) => line.replace(/^[-*•]\s*/, '').trim())
          .filter(Boolean)
      }))
    }
    /** Les étiquettes de la liste : leur nom, leurs autres formes. */
    async function knownTags(): Promise<KnownTag[]> {
      return (await entries.tag.all()).map((entry) => ({
        name: entry.name,
        aliases: entry.text
          .split('\n')
          .map((line) => line.replace(/^[-*•]\s*/, '').trim())
          .filter(Boolean)
      }))
    }
    /** Ajouter des étiquettes à la liste (une note chacune) ; rend celles ajoutées. */
    const listTags = async (names: readonly string[]): Promise<string[]> => {
      const known = await knownTags()
      const fresh = names.filter((name) => name.trim() && !known.some((each) => each.name.toLowerCase() === name.trim().toLowerCase()))
      for (const name of fresh) await entries.tag.create({ name: name.trim(), text: '', category: '', description: '', favorite: false })
      return fresh
    }
    /**
     * Les étiquettes d'un document, à cocher : celles de la liste, les siennes qui n'y sont
     * pas, et « Autre(s) étiquette(s)… » (à écrire ; ajoutées à la liste d'un même geste).
     */
    const chooseTags = async (record: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const known = await knownTags()
      const current = canonicalTags(doc.tags, known)
      const outside = current.filter((tag) => !known.some((each) => each.name === tag))
      const chosen = await platform.ui.pickMany({
        title: t('bibliotheque.tags.choose.title', { title: doc.title }),
        intro: t('bibliotheque.tags.choose.intro'),
        choices: [
          ...[...known]
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
            .map((each) => ({ value: each.name, label: each.name, ...(each.aliases.length ? { description: each.aliases.join(', ') } : {}) })),
          ...outside.map((tag) => ({ value: tag, label: t('bibliotheque.tags.outside', { tag }) })),
          { value: NEW_TAGS, label: t('bibliotheque.tags.other') }
        ],
        selected: current,
        submit: t('bibliotheque.edit.submit')
      })
      if (!chosen) return
      let tags = chosen.filter((value) => value !== NEW_TAGS)
      if (chosen.includes(NEW_TAGS)) {
        const values = await platform.ui.askForm({
          title: t('bibliotheque.tags.other.title', { title: doc.title }),
          fields: [
            { kind: 'text', key: 'value', label: t('bibliotheque.tags.other.field'), required: true, description: t('bibliotheque.classify.tags') },
            { kind: 'toggle', key: 'list', label: t('bibliotheque.tags.other.list'), value: true }
          ],
          submit: t('bibliotheque.edit.submit')
        })
        if (!values) return
        const typed = canonicalTags((values.value ?? '').split(','), known)
        if (values.list === 'true') await listTags(typed)
        tags = [...tags, ...typed]
      }
      const saved = await store.setTags(record, canonicalTags(tags, await knownTags()))
      if (saved) platform.notifier.notify(saved.tags.length ? t('bibliotheque.edit.done', { field: t('bibliotheque.field.tags'), value: saved.tags.join(', ') }) : t('bibliotheque.edit.cleared', { field: t('bibliotheque.field.tags') }), 5000)
    }
    /** Les étiquettes d'un document hors de la liste : les y ajouter (cochées ; on en décoche). */
    const addTagsFor = async (record: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const known = await knownTags()
      const outside = doc.tags.filter((tag) => !known.some((each) => each.name.toLowerCase() === canonicalTag(tag, known).toLowerCase()))
      if (!outside.length) return
      const chosen = await platform.ui.pickMany({
        title: t('bibliotheque.tags.add.title'),
        intro: t('bibliotheque.tags.add.intro', { title: doc.title }),
        choices: outside.map((tag) => ({ value: tag, label: tag })),
        submit: t('bibliotheque.tags.add.submit')
      })
      if (!chosen?.length) return
      const added = await listTags(chosen)
      if (added.length) platform.notifier.notify(t('bibliotheque.tags.added', { count: added.length, tags: added.join(', ') }), 6000)
    }
    /** Ajouter un émetteur à la liste (sa fenêtre, le nom proposé) ; rend son code. */
    const newIssuer = async (name: string): Promise<EntryDraft | null> => {
      const draft = await entryForm('issuer', undefined, { name, code: suggestIssuerCode(name) })
      if (!draft) return null
      await entries.issuer.create(draft)
      return draft
    }
    /** Le bouton « Nouvelle entreprise… » à côté de la liste des entreprises : sa fenêtre par-dessus ; l'entreprise créée est choisie. */
    const issuerCreate = () => ({
      label: t('bibliotheque.issuer.create'),
      tooltip: t('bibliotheque.issuer.create.tip'),
      run: async (): Promise<Choice | null> => {
        const draft = await newIssuer('')
        if (!draft) return null
        const code = draft.code || draft.name
        platform.notifier.notify(t('bibliotheque.issuer.created', { name: entryTitle(draft) }), 5000)
        pagesChanged()
        return { value: code, label: issuerLabelIn(code, await knownIssuers()) }
      }
    })
    /**
     * L'émetteur d'un document, hors de la liste : l'y ajouter (sa fenêtre, son nom et un code
     * proposés) ; il devient celui du document — et des autres documents qui portaient ce nom.
     */
    const addIssuerFor = async (record: string): Promise<string | null> => {
      const doc = await store.load(record)
      if (!doc) return null
      const raw = knownIssuerCode(doc.issuer, await knownIssuers()) ? '' : doc.issuer
      const draft = await newIssuer(raw)
      if (!draft) return null
      const code = draft.code || draft.name
      await store.setIssuer(record, code)
      const others = raw ? await store.adoptIssuer(raw, code, record) : 0
      platform.notifier.notify(
        [t('bibliotheque.issuer.added', { issuer: entryTitle(draft) }), ...(others ? [t('bibliotheque.issuer.adopted', { count: others, name: raw })] : [])].join(' '),
        6000
      )
      return code
    }
    /** L'émetteur d'un document à choisir : « Aucun », ceux de la liste, celui qu'il a s'il n'y est pas, et en ajouter un. */
    const issuerOptions = (current: string, known: readonly KnownIssuer[]): Choice[] => [
      { value: '', label: t('bibliotheque.issuer.unset') },
      ...[...known].sort((a, b) => a.code.localeCompare(b.code, 'fr')).map((each) => ({ value: each.code, label: issuerLabelIn(each.code, known) })),
      ...(current && !known.some((each) => each.code === current) ? [{ value: current, label: t('bibliotheque.issuer.outside', { issuer: current }) }] : []),
      { value: NEW_ISSUER, label: t('bibliotheque.issuer.add') }
    ]

    /** Les types de pièce à choisir : « Aucun », ceux de la liste, et celui qu'il a s'il n'y est pas (gardé, dit). */
    const typeOptions = (current: string): Choice[] => {
      const types = libraryPieceTypes()
      return [
        { value: '', label: t('bibliotheque.category.unset') },
        ...types.map((type) => ({ value: type.code, label: pieceTypeText(type.code) })),
        ...(current && !types.some((type) => type.code === current) ? [{ value: current, label: t('bibliotheque.category.outside', { category: current }) }] : []),
        // Le module Typage des pièces actif : ajouter un type à sa liste, d'ici.
        ...(pieceTyper?.add ? [{ value: NEW_TYPE, label: t('bibliotheque.category.add') }] : [])
      ]
    }
    /** Le bouton « Nouveau type… » à côté de la liste des types de pièce (le module Typage des pièces actif) : le type créé est choisi. */
    const typeCreate = () =>
      pieceTyper?.add
        ? {
            label: t('bibliotheque.category.create'),
            tooltip: t('bibliotheque.category.create.tip'),
            run: async (): Promise<Choice | null> => {
              const made = await pieceTypeMaker?.()
              return made ? { value: made.code, label: pieceTypeText(made.code) } : null
            }
          }
        : undefined
    /**
     * Le type de pièce d'un document, hors de la liste : l'y ajouter (un type personnalisé du
     * module Typage des pièces — son code proposé, son libellé) ; il devient celui du
     * document, et des autres documents qui avaient cette valeur.
     */
    const addPieceTypeFor = async (record: string): Promise<string | null> => {
      const doc = await store.load(record)
      const typer = pieceTyper
      if (!doc || !typer?.add) return null
      const raw = libraryPieceTypes().some((type) => type.code === doc.category) ? '' : doc.category
      const values = await platform.ui.askForm({
        title: raw ? t('bibliotheque.category.add.title', { category: raw }) : t('bibliotheque.category.add.new'),
        intro: t('bibliotheque.category.add.intro'),
        fields: [
          { kind: 'text', key: 'code', label: t('bibliotheque.category.add.code'), value: suggestTypeCode(raw), required: true, description: t('bibliotheque.category.add.code.desc') },
          { kind: 'text', key: 'label', label: t('bibliotheque.category.add.label'), value: raw, required: true }
        ],
        submit: t('bibliotheque.category.add.submit'),
        validate: (typed) => typer.check?.(typed.code ?? '', typed.label ?? '') ?? null
      })
      if (!values) return null
      const added = await typer.add(values.code ?? '', values.label ?? '')
      if ('error' in added) {
        platform.notifier.notify(added.error, 8000)
        return null
      }
      await store.setCategory(record, added.code)
      const others = raw ? await store.adoptCategory(raw, added.code, record) : 0
      platform.notifier.notify(
        [t('bibliotheque.category.added', { category: pieceTypeText(added.code) }), ...(others ? [t('bibliotheque.category.adopted', { count: others, name: raw })] : [])].join(' '),
        6000
      )
      return added.code
    }

    pieceTypeMaker = async () => {
      const typer = pieceTyper
      if (!typer?.add) return null
      const values = await platform.ui.askForm({
        title: t('bibliotheque.category.add.new'),
        intro: t('bibliotheque.category.add.intro'),
        fields: [
          { kind: 'text', key: 'code', label: t('bibliotheque.category.add.code'), required: true, description: t('bibliotheque.category.add.code.desc') },
          { kind: 'text', key: 'label', label: t('bibliotheque.category.add.label'), required: true }
        ],
        submit: t('bibliotheque.category.add.submit'),
        validate: (typed) => typer.check?.(typed.code ?? '', typed.label ?? '') ?? null
      })
      if (!values) return null
      const added = await typer.add(values.code ?? '', values.label ?? '')
      if ('error' in added) {
        platform.notifier.notify(added.error, 8000)
        return null
      }
      platform.notifier.notify(t('bibliotheque.category.created', { category: pieceTypeText(added.code) }), 6000)
      return { code: added.code, label: libraryPieceTypes().find((type) => type.code === added.code)?.label ?? (values.label ?? '').trim() }
    }

    const classify = async (record: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const values = await platform.ui.askForm({
        title: t('bibliotheque.classify.title', { title: doc.title }),
        intro: t('bibliotheque.classify.intro'),
        fields: [
          { kind: 'text', key: 'title', label: t('bibliotheque.field.title'), value: doc.title, required: true },
          { kind: 'choice', key: 'category', label: t('bibliotheque.field.category'), value: doc.category, description: t('bibliotheque.classify.categories'), options: typeOptions(doc.category), ...(typeCreate() ? { create: typeCreate()! } : {}) },
          { kind: 'text', key: 'reference', label: t('bibliotheque.field.reference'), value: doc.reference, placeholder: 'CCTP-2026-118' },
          { kind: 'text', key: 'edition', label: t('bibliotheque.field.edition'), value: doc.edition, placeholder: '2' },
          { kind: 'text', key: 'revision', label: t('bibliotheque.field.revision'), value: doc.revision, placeholder: 'B' },
          { kind: 'choice', key: 'issuer', label: t('bibliotheque.field.issuer'), value: doc.issuer, description: t('bibliotheque.issuer.choose'), options: issuerOptions(doc.issuer, await knownIssuers()), create: issuerCreate() },
          { kind: 'text', key: 'date', label: t('bibliotheque.field.date'), value: doc.date ?? '', placeholder: '2026-03-12', description: t('bibliotheque.classify.date'), calendar: true },
          {
            kind: 'choice',
            key: 'language',
            label: t('bibliotheque.field.language'),
            value: doc.language ?? '',
            ...(doc.languageToConfirm ? { description: t('bibliotheque.lang.form.toConfirm') } : {}),
            options: [{ value: '', label: t(doc.languageToConfirm ? 'bibliotheque.lang.toConfirm' : 'bibliotheque.lang.unknown') }, ...LANGUAGES.map((language) => ({ value: language, label: t(`bibliotheque.lang.${language}`) }))]
          },
          { kind: 'text', key: 'tags', label: t('bibliotheque.field.tags'), value: doc.tags.join(', '), description: t('bibliotheque.classify.tags') }
        ],
        submit: t('bibliotheque.classify.submit')
      })
      if (!values) return
      const tags = (values.tags ?? '')
        .split(',')
        .map((each) => each.trim())
        .filter(Boolean)
      // La langue choisie (changée) : confirmée ; vidée, retirée ; la même, ce qu'elle était (à confirmer, ou non).
      const language = isLanguage(values.language) ? values.language : ''
      const languageFields =
        language === (doc.language ?? '')
          ? {}
          : language
            ? { language, languageToConfirm: undefined, languageProbable: undefined }
            : { language: undefined }
      // La date : écrite comme on veut (« 12/03/2026 », « 12 mars 2026 ») ; illisible, celle qu'il avait reste.
      const typedDate = (values.date ?? '').trim()
      const date = typedDate ? parseDocDate(typedDate) || doc.date : undefined
      const title = (values.title ?? '').trim() || doc.title
      const category = values.category === NEW_TYPE ? doc.category : (values.category ?? '').trim()
      const reference = (values.reference ?? '').trim()
      const edition = (values.edition ?? '').trim()
      const revision = (values.revision ?? '').trim()
      const issuer = values.issuer === NEW_ISSUER ? doc.issuer : (values.issuer ?? '').trim()
      // Seul ce que vous avez changé est confirmé : le reste, encore à confirmer, le reste.
      const sameTags = tags.length === doc.tags.length && tags.every((tag) => doc.tags.some((each) => each.toLowerCase() === tag.toLowerCase()))
      const changed = {
        title: title !== doc.title,
        category: category !== doc.category || values.category === NEW_TYPE,
        identity: reference !== doc.reference || edition !== doc.edition || revision !== doc.revision,
        issuer: issuer !== doc.issuer || values.issuer === NEW_ISSUER,
        tags: !sameTags,
        date: (date ?? '') !== (doc.date ?? '')
      }
      await store.save({
        ...doc,
        ...languageFields,
        date,
        ...(changed.date ? { dateToConfirm: undefined, dateProbable: undefined, dateByAi: undefined } : {}),
        ...(changed.identity ? { identityToConfirm: undefined, identityByAi: undefined } : {}),
        ...(changed.title ? { titleToConfirm: undefined, titleProbable: undefined, titleByAi: undefined } : {}),
        ...(changed.issuer ? { issuerToConfirm: undefined, issuerProbable: undefined, issuerByAi: undefined } : {}),
        ...(changed.category ? { categoryToConfirm: undefined, categoryProbable: undefined, categoryByAi: undefined } : {}),
        ...(changed.tags ? { tagsToConfirm: undefined, tagsProbable: undefined, tagsByAi: undefined } : {}),
        title,
        category,
        reference,
        edition,
        revision,
        issuer,
        tags
      })
      // « Ajouter un émetteur à la liste… » : sa fenêtre, puis il devient celui du document.
      if (values.issuer === NEW_ISSUER) await addIssuerFor(record)
      if (values.category === NEW_TYPE) await addPieceTypeFor(record)
      platform.notifier.notify(
        [t('bibliotheque.classify.done', { title: (values.title ?? '').trim() || doc.title }), ...(typedDate && !parseDocDate(typedDate) ? [t('bibliotheque.date.unreadable', { value: typedDate })] : [])].join(' '),
        5000
      )
    }

    /**
     * Relancer la recherche d'un champ dans le document : la première passe, sans IA ; pas
     * sûre, le workflow système qui le cherche avec l'IA (s'il y en a un, activé), pour ce
     * document. Ce qui en sort est dit.
     */
    const researchField = async (record: string, field: ResearchField): Promise<void> => {
      const first = await store.researchField(record, field)
      if (!first) return
      let doc = first.doc
      const notes: string[] = []
      if (!first.sure) {
        const system = aiResearch.get(field)
        if (system) {
          if (!(await runSystemWorkflow(system, TRIGGER_POURED, pouredSubject(doc, await knownIssuers())))) notes.push(t('bibliotheque.research.aiOff'))
          // L'IA a pu en dire plus (la référence et la version, ensemble) : seul ce champ change.
          const after = (await store.load(record)) ?? doc
          const kept: LibraryDoc = { ...doc }
          for (const key of RESEARCH_KEYS[field]) {
            if (after[key] === undefined) delete kept[key]
            else (kept as unknown as Record<string, unknown>)[key] = after[key]
          }
          if (JSON.stringify(kept) !== JSON.stringify(after)) await store.save(kept)
          doc = kept
        } else notes.push(t('bibliotheque.research.aiNone'))
      }
      const label = t(`bibliotheque.field.${field}`)
      const locale = active?.locale
      const issuers = await knownIssuers()
      const state = {
        title: { toConfirm: doc.titleToConfirm, byAi: doc.titleByAi, value: doc.title, probable: doc.titleProbable },
        language: { toConfirm: doc.languageToConfirm, byAi: doc.languageByAi, value: doc.language ? t(`bibliotheque.lang.${doc.language}`) : '', probable: doc.languageProbable ? t(`bibliotheque.lang.${doc.languageProbable}`) : '' },
        identity: { toConfirm: doc.identityToConfirm, byAi: doc.identityByAi, value: [doc.reference, versionLabel(doc) ? t('bibliotheque.identity.version', { version: versionLabel(doc) }) : ''].filter(Boolean).join(', '), probable: '' },
        reference: { toConfirm: doc.identityToConfirm, byAi: doc.identityByAi, value: doc.reference, probable: '' },
        edition: { toConfirm: doc.identityToConfirm, byAi: doc.identityByAi, value: doc.edition, probable: '' },
        revision: { toConfirm: doc.identityToConfirm, byAi: doc.identityByAi, value: doc.revision, probable: '' },
        date: { toConfirm: doc.dateToConfirm, byAi: doc.dateByAi, value: doc.date ? docDateLabel(doc.date, locale) : '', probable: doc.dateProbable ? docDateLabel(doc.dateProbable, locale) : '' },
        category: { toConfirm: doc.categoryToConfirm, byAi: doc.categoryByAi, value: doc.category, probable: doc.categoryProbable },
        issuer: { toConfirm: doc.issuerToConfirm, byAi: doc.issuerByAi, value: issuerLabelIn(doc.issuer, issuers), probable: doc.issuerProbable ? issuerLabelIn(doc.issuerProbable, issuers) : '' },
        tags: { toConfirm: doc.tagsToConfirm, byAi: doc.tagsByAi, value: doc.tags.join(', '), probable: doc.tagsProbable?.join(', ') }
      }[field]
      const said = state.toConfirm
        ? state.probable
          ? t('bibliotheque.research.probable', { field: label, probable: state.probable })
          : t('bibliotheque.research.toConfirm', { field: label })
        : t(state.byAi ? 'bibliotheque.research.byAi' : 'bibliotheque.research.sure', { field: label, value: state.value || '—' })
      platform.notifier.notify([said, ...(state.toConfirm ? notes : [])].join(' '), 8000)
    }

    /** Renommer le fichier d'un document : son nom, sans l'extension (gardée) ; les liens vers lui suivent. */
    const renameFile = async (record: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const name = baseName(doc.file)
      const extension = /\.[^./]+$/.exec(name)?.[0] ?? ''
      const values = await platform.ui.askForm({
        title: t('bibliotheque.file.rename.title', { name }),
        fields: [
          {
            kind: 'text',
            key: 'name',
            label: t('bibliotheque.file.rename.name'),
            value: extension ? name.slice(0, -extension.length) : name,
            required: true,
            description: extension ? t('bibliotheque.file.rename.desc', { extension }) : t('bibliotheque.file.rename.desc.none')
          }
        ],
        submit: t('bibliotheque.file.rename.submit')
      })
      if (!values) return
      const done = await store.renameFile(record, values.name ?? '')
      if (done === 'invalid') platform.notifier.notify(t('bibliotheque.file.rename.invalid'), 8000)
      else if (done === 'exists') platform.notifier.notify(t('bibliotheque.file.rename.exists', { name: `${(values.name ?? '').trim()}${extension}` }), 8000)
      else if (done && done.doc.file !== doc.file)
        platform.notifier.notify(t(done.notes ? 'bibliotheque.file.renamed.links' : 'bibliotheque.file.renamed', { name: baseName(done.doc.file), count: done.notes }), 6000)
    }

    /** Un champ de la fiche, seul : une petite fenêtre ; enregistré, il est confirmé (plus « à confirmer », plus « par l'IA »). */
    const editField = async (record: string, key: EditableField): Promise<void> => {
      // Les étiquettes : à cocher dans la liste.
      if (key === 'tags') return chooseTags(record)
      const doc = await store.load(record)
      if (!doc) return
      const label = t(`bibliotheque.field.${key}`)
      const current = key === 'date' ? (doc.date ?? '') : doc[key]
      const help: Partial<Record<EditableField, string>> = {
        category: t('bibliotheque.classify.categories', { list: CATEGORIES.map((each) => each.name).join(', ') }),
        date: t('bibliotheque.classify.date')
      }
      const values = await platform.ui.askForm({
        title: t('bibliotheque.edit.title', { field: label, title: doc.title }),
        fields: [
          key === 'category'
            ? { kind: 'choice', key: 'value', label, value: current, description: t('bibliotheque.classify.categories'), options: typeOptions(current), ...(typeCreate() ? { create: typeCreate()! } : {}) }
            : key === 'issuer'
              ? { kind: 'choice', key: 'value', label, value: current, description: t('bibliotheque.issuer.choose'), options: issuerOptions(current, await knownIssuers()), create: issuerCreate() }
              : { kind: 'text', key: 'value', label, value: current, ...(key === 'title' ? { required: true } : {}), ...(help[key] ? { description: help[key] } : {}), ...(key === 'date' ? { calendar: true, placeholder: '2026-03-12' } : {}) }
        ],
        submit: t('bibliotheque.edit.submit')
      })
      if (!values) return
      const value = (values.value ?? '').trim()
      let shown = value
      if (key === 'title') {
        if (!value) return
        await store.setTitle(record, value)
      } else if (key === 'reference' || key === 'edition' || key === 'revision') {
        await store.setIdentity(record, { reference: doc.reference, edition: doc.edition, revision: doc.revision, [key]: value })
      } else if (key === 'date') {
        const date = value ? parseDocDate(value) : ''
        if (value && !date) {
          platform.notifier.notify(t('bibliotheque.date.unreadable', { value }), 6000)
          return
        }
        await store.setDate(record, date)
        shown = date ? docDateLabel(date, active?.locale) : ''
      } else if (key === 'category') {
        // « Ajouter un type de pièce… » : sa fenêtre ; ce qu'elle a fait est dit.
        if (value === NEW_TYPE) {
          await addPieceTypeFor(record)
          return
        }
        await store.setCategory(record, value)
        shown = value ? pieceTypeText(value) : ''
      }
      else if (key === 'issuer') {
        // « Ajouter un émetteur à la liste… » : sa fenêtre ; ce qu'elle a fait est dit.
        if (value === NEW_ISSUER) {
          await addIssuerFor(record)
          return
        }
        await store.setIssuer(record, value)
        shown = value ? issuerLabelIn(value, await knownIssuers()) : ''
      }

      platform.notifier.notify(shown ? t('bibliotheque.edit.done', { field: label, value: shown }) : t('bibliotheque.edit.cleared', { field: label }), 5000)
    }

    /** La langue d'un document : une des langues, la détecter de nouveau, ou aucune. */
    const chooseLanguage = async (record: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const chosen = await platform.ui.pickOption(
        [
          ...LANGUAGES.map((language) => ({
            value: language,
            label: t(`bibliotheque.lang.${language}`),
            ...(language === doc.language ? { description: t('bibliotheque.lang.current') } : language === doc.languageProbable ? { description: t('bibliotheque.lang.probable') } : {})
          })),
          { value: 'detecter', label: t('bibliotheque.lang.detect'), description: t('bibliotheque.lang.detect.desc') },
          { value: 'aucune', label: t('bibliotheque.lang.none'), description: t('bibliotheque.lang.none.desc') }
        ],
        t('bibliotheque.lang.pick', { title: doc.title })
      )
      if (chosen === null) return
      if (chosen === 'detecter') {
        const found = await store.detectLanguageOf(record)
        platform.notifier.notify(
          found?.language
            ? t('bibliotheque.lang.detected', { title: doc.title, language: t(`bibliotheque.lang.${found.language}`) })
            : t('bibliotheque.lang.undetected', { title: doc.title }),
          6000
        )
        return
      }
      const language = isLanguage(chosen) ? chosen : ''
      await store.setLanguage(record, language)
      platform.notifier.notify(language ? t('bibliotheque.lang.set', { title: doc.title, language: t(`bibliotheque.lang.${language}`) }) : t('bibliotheque.lang.cleared', { title: doc.title }), 5000)
    }

    const newVersionOf = async (record: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const others = (await store.all()).filter((each) => each.record !== record && each.previous !== record).sort((a, b) => Number(b.family === doc.family) - Number(a.family === doc.family) || a.title.localeCompare(b.title, 'fr'))
      if (!others.length) {
        platform.notifier.notify(t('bibliotheque.newVersionOf.none'), 6000)
        return
      }
      const chosen = await platform.ui.pickOption(
        [
          ...others.map((each) => ({ value: each.record, label: each.title, description: [t(`bibliotheque.family.${each.family}`), each.category, each.added].filter(Boolean).join(' · ') })),
          ...(doc.previous ? [{ value: '', label: t('bibliotheque.newVersionOf.unlink'), description: t('bibliotheque.newVersionOf.unlink.desc') }] : [])
        ],
        t('bibliotheque.newVersionOf.pick', { title: doc.title })
      )
      if (chosen === null) return
      await store.relate(record, chosen)
      platform.notifier.notify(chosen ? t('bibliotheque.related', { title: doc.title }) : t('bibliotheque.unlinked', { title: doc.title }), 5000)
    }

    /**
     * **Relancer une seule étape** du parcours d'un document (un bouton de sa fiche) : les doublons
     * revérifiés ; remis dans « À classer » (sans lancer la suite) ; l'ingestion, l'analyse (et ce qu'elle
     * donne : le projet, les liens) ou le rangement refaits par leur skill (« Refaire », même déjà faits) ;
     * un champ cherché de nouveau ; les liens réécrits avec leurs rétroliens.
     */
    const RESEARCH_STEP: Readonly<Record<string, ResearchField>> = { type: 'category', entreprise: 'issuer', titre: 'title', date: 'date', langue: 'language', reference: 'identity', etiquettes: 'tags' }
    const skillFor = async (output: 'ingestion' | 'analyse' | 'rangement'): Promise<string> => {
      await ensureCircuitSkills()
      return (await entries.skill.all()).find((entry) => entry.output === output)?.name ?? ''
    }
    const relaunchStep = async (record: string, step: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const tell = (text: string) => platform.notifier.notify(text, 7000)
      if (step === 'doublons') {
        const twins = doc.hash ? (await store.all()).filter((other) => other.record !== record && other.hash === doc.hash) : []
        tell(twins.length ? t('bibliotheque.steps.redo.twins', { title: doc.title, others: twins.map((other) => other.title).join(', ') }) : t('bibliotheque.steps.redo.noTwin', { title: doc.title }))
        return
      }
      const field = RESEARCH_STEP[step]
      if (field) {
        await researchField(record, field)
        return
      }
      if (step === 'glossaire') {
        const found = await searchGlossary(record)
        if (found) tell(t('bibliotheque.steps.redo.glossary', { title: doc.title, count: found.terms.length }))
        return
      }
      if (step === 'liens-crees') {
        const written = await store.setLinks(record, await store.linksOf(record))
        pagesChanged()
        tell(t('bibliotheque.steps.redo.relinked', { title: doc.title, count: written.length }))
        return
      }
      const blocked = cannotContinue()
      if (blocked) return tell(blocked)
      if (step === 'a-classer') {
        await platform.fs.ensureFolder(store.inbox)
        const moved = (await store.move(record, store.inbox)) ?? record
        await store.setCircuit(moved, { circuit: 'a-classer', circuitReason: undefined, circuitProposal: undefined, circuitConfidence: undefined, circuitAlternatives: undefined, circuitError: undefined }, circuitLine('bibliotheque.circuit.line.backToInbox', {}))
        pagesChanged()
        tell(t('bibliotheque.steps.redo.inbox', { title: doc.title }))
        return
      }
      const skill = await skillFor(step === 'ingestion' ? 'ingestion' : step === 'rangement' ? 'rangement' : 'analyse')
      try {
        const outcome = await runActionNow('ia.executer-skill', { fiche: record, skill, seuil: '', refaire: 'oui' }, { ...NO_SUBJECT, key: record, label: doc.title, path: record })
        tell(outcome ? outcome.lines.join(' ') : t('bibliotheque.steps.redo.noWorkflows'))
      } catch (error) {
        tell(t('bibliotheque.steps.redo.failed', { reason: error instanceof Error ? error.message : String(error) }))
      }
      pagesChanged()
    }
    /** **Relancer tout le circuit** d'un document (après une question) : remis au début (« À classer »), puis le circuit le reprend. */
    const relaunchAll = async (record: string): Promise<boolean> => {
      const blocked = cannotContinue()
      if (blocked) {
        platform.notifier.notify(blocked, 7000)
        return false
      }
      const doc = await store.load(record)
      if (!doc) return false
      const agreed = await platform.ui.confirm({
        title: t('bibliotheque.steps.restart.title', { title: doc.title }),
        message: t('bibliotheque.steps.restart.message'),
        confirm: t('bibliotheque.steps.restart'),
        cancel: t('bibliotheque.steps.restart.cancel')
      })
      if (!agreed) return false
      await store.setCircuit(
        record,
        { circuit: 'a-classer', circuitReason: undefined, circuitProposal: undefined, circuitConfidence: undefined, circuitAlternatives: undefined, circuitError: undefined, circuitProject: undefined, circuitStopped: undefined },
        circuitLine('bibliotheque.circuit.line.restarted', {})
      )
      return continueCircuit(record)
    }

    /**
     * **Le glossaire et les documents** : les termes qu'un document emploie (son titre et son texte,
     * le terme ou son sigle, en mot entier), et les documents qui emploient un terme (ceux qui le
     * citent, et ceux que le circuit y a reliés).
     */
    const glossaryItems = async (): Promise<(LinkSourceItem & { entry: LibraryEntry })[]> =>
      (await entries.glossary.all()).map((entry) => ({ path: entry.path, label: entryTitle(entry), kind: 'glossary', names: [entry.name, entry.code ?? '', ...(entry.aliases ?? [])].filter(Boolean), entry }))
    const docText = async (doc: LibraryDoc): Promise<string> => [doc.title, doc.reading === 'lue' ? ((await store.transcriptText(doc.record)) ?? '') : ''].join('\n')
    /** Ce que chaque document cite (termes, personnes) : relu seulement quand le document ou la source change. */
    const mentions = new MentionIndex(docText)
    const glossaryOf = async (record: string): Promise<{ path: string; label: string; definition: string }[]> => {
      const doc = await store.load(record)
      if (!doc) return []
      const items = await glossaryItems()
      if (!items.length) return []
      // Dans l'ordre où le document les emploie ; puis ceux que le circuit y a reliés.
      const found = new Set((await mentions.of('glossaire', doc, items)).map((candidate) => candidate.path))
      for (const link of doc.links ?? []) if (items.some((item) => item.path === link)) found.add(link)
      return [...found].map((path) => items.find((item) => item.path === path)!).map((item) => ({ path: item.path, label: item.label, definition: item.entry.description }))
    }
    const documentsUsing = async (path: string): Promise<TermUse[]> => {
      const items = await glossaryItems()
      if (!items.some((each) => each.path === path)) return []
      const out: TermUse[] = []
      const all = await store.all()
      mentions.keep(new Set(all.map((doc) => doc.record)))
      for (const doc of all) {
        const linked = (doc.links ?? []).includes(path)
        const found = (await mentions.of('glossaire', doc, items)).find((candidate) => candidate.path === path)?.found
        if (linked || found) out.push({ record: doc.record, title: doc.title, detail: placeOfFolder(doc.record.slice(0, doc.record.lastIndexOf('/'))), linked, ...(found ? { found } : {}) })
      }
      return out.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
    }
    /**
     * **La recherche dans le glossaire** (une étape du circuit, sans IA) : les termes que le document
     * emploie (son titre et son texte ; le terme, son sigle ou une autre forme), reliés à sa fiche
     * (section Liens), avec un rétrolien dans la note du terme. Ses autres liens sont gardés ; refaite,
     * elle ne double rien.
     */
    const searchGlossary = async (record: string): Promise<{ title: string; terms: string[] } | null> => {
      const doc = await store.load(record)
      if (!doc) return null
      const items = await glossaryItems()
      const found = await mentions.of('glossaire', doc, items)
      const links = await store.linksOf(record)
      const added = found.filter((candidate) => !links.some((link) => link.path === candidate.path)).map((candidate) => ({ path: candidate.path, why: t('bibliotheque.glossary.why', { found: candidate.found }) }))
      if (added.length) await store.setLinks(record, [...links, ...added])
      const after = await store.load(record)
      if (after) await store.save({ ...after, glossarySearched: found.length })
      const terms = found.map((candidate) => candidate.label)
      if (after?.circuit) await store.setCircuit(record, {}, circuitLine('bibliotheque.circuit.line.glossary', { count: found.length, terms: terms.length ? ` (${terms.join(', ')})` : '' }))
      pagesChanged()
      return { title: doc.title, terms }
    }

    /**
     * **Ce que le circuit traite en ce moment** : le document (sa fiche) et l'étape (`ingestion`,
     * `glossaire`, `analyse`, `rangement`) — le workflow du circuit, ou une étape relancée d'un
     * bouton. Tenu à jour à chaque étape ; les pages se redessinent.
     */
    const circuitRunning = new Map<string, string>()
    /** Les documents dont vous avez arrêté le circuit, le temps que leur étape en cours finisse. */
    const stopping = new Set<string>()
    const sameSkill = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
    const refreshRunning = async (): Promise<void> => {
      const skills = await entries.skill.all()
      const next = new Map<string, string>()
      for (const step of runningSteps()) {
        if (step.system !== CIRCUIT_WORKFLOW && step.workflowId !== '') continue
        const record = step.fields.fiche || step.subjectPath
        const id = step.kind === 'bibliotheque.glossaire' ? 'glossaire' : step.kind === 'ia.executer-skill' ? skills.find((entry) => sameSkill(entry.name, step.fields.skill ?? ''))?.output : undefined
        if (record && (id === 'ingestion' || id === 'analyse' || id === 'rangement' || id === 'glossaire')) next.set(record, id)
      }
      const before = [...circuitRunning.entries()].join('|')
      // Ceux qui ne sont plus en cours, et dont vous aviez arrêté le circuit : marqués arrêtés (leur dernière étape a pu réécrire leur fiche).
      for (const record of [...stopping]) {
        if (next.has(record)) continue
        stopping.delete(record)
        const doc = await store.load(record)
        if (doc && inCircuit(doc) && !doc.circuitStopped) await store.setCircuit(record, { circuitStopped: true })
      }
      circuitRunning.clear()
      for (const [record, id] of next) circuitRunning.set(record, id)
      if ([...circuitRunning.entries()].join('|') !== before) pagesChanged()
    }
    stopRunningWatch?.()
    stopRunningWatch = onRunningChange(() => void refreshRunning().catch((error) => console.error('[Black Projects] bibliotheque', error)))
    /** **Arrêter le circuit** d'un document en cours de traitement : il s'arrête avant son étape suivante ; ce que l'étape en cours trouve n'est pas appliqué. */
    const stopCircuit = async (record: string): Promise<boolean> => {
      const doc = await store.load(record)
      if (!doc) return false
      if (!stopRunning(record)) {
        platform.notifier.notify(t('bibliotheque.circuit.stop.none', { title: doc.title }), 5000)
        pagesChanged()
        return false
      }
      stopping.add(record)
      await store.setCircuit(record, { circuitStopped: true }, circuitLine('bibliotheque.circuit.line.stopped', {}))
      platform.notifier.notify(t('bibliotheque.circuit.stopped', { title: doc.title }), 6000)
      pagesChanged()
      return true
    }

    registerLibraryHome(context.views, {
      t,
      store,
      glossaryOf,
      explorer: explorerFor,
      movedTo: (record) => movedRecords.get(record),
      control: {
        list: toControl,
        pending: async () => (await store.all()).filter((doc) => doc.circuit === 'a-classer' || doc.circuit === 'ingere' || doc.circuit === 'analyse'),
        place: placeOfFolder,
        accept: acceptProposal,
        elsewhere: fileElsewhere,
        discard: discardControlled,
        entities: allProposals,
        createEntity: createProposed,
        dismissEntity: dismissProposed,
        cannotContinue,
        continueCircuit: (record) => continueCircuit(record),
        continueAll,
        relaunchStep,
        relaunchAll,
        running: (record) => circuitRunning.get(record) ?? null,
        stopCircuit
      },
      today: localToday,
      locale: i18n.language === 'en' ? 'en-GB' : 'fr-FR',
      ...(showPage ? { showPage } : {}),
      openFile: (path) => platform.ui.openNote(path),
      showNote,
      exists: (path) => platform.fs.exists(path),
      // Versés depuis l'interface : un seul nouveau document, sa fiche ; sinon la page se redessine.
      removeGhost: async (path) => {
        if (await store.removeGhost(path)) platform.notifier.notify(t('bibliotheque.ghost.removed'), 5000)
      },
      callers: (record) => callersOf(record),
      toReferences: (record) => toReferences(record),
      places: { ...places.document, dropInto: (folder, where) => ({ label: t('bibliotheque.drop.label', { where }), run: async (files) => void (await pourItems(files, folder)) }) },
      move: async (record) => {
        const doc = await store.load(record)
        if (!doc) return null
        const folder = await pickPlace('document', record.slice(0, record.lastIndexOf('/')), t('bibliotheque.move.pick', { name: doc.title }))
        if (!folder) return null
        // Vers les documents de référence : un fantôme à son ancienne place, proposé.
        if (inReferences(folder) && !inReferences(record.slice(0, record.lastIndexOf('/')))) return toReferences(record, folder)
        const moved = await store.move(record, folder)
        if (moved) {
          await recordMoved(record, moved)
          platform.notifier.notify(t('bibliotheque.move.done', { name: doc.title, folder }), 5000)
        }
        return moved
      },
      pour: async (folder) => {
        const report = await pour(folder)
        if (report?.added.length === 1 && report.already.length === 0) showPage?.(docPageOf(report.added[0]!.record))
      },
      classify,
      newVersionOf,
      chooseLanguage,
      confirmCategory: async (record, category) => {
        const doc = await store.setCategory(record, category)
        if (doc) platform.notifier.notify(doc.category ? t('bibliotheque.category.confirmed', { category: doc.category }) : t('bibliotheque.category.confirmed.none', { title: doc.title }), 5000)
      },
      editField,
      addIssuer: async (record) => void (await addIssuerFor(record)),
      addPieceType: async (record) => void (await addPieceTypeFor(record)),
      addTags: (record) => addTagsFor(record),
      showTextVersion: async (record, number) => {
        const version = await store.showTextVersion(record, number)
        if (version) platform.notifier.notify(t('bibliotheque.textVersion.shownDone', { version: textVersionLabel(t, version) }), 5000)
      },
      deleteTextVersion: async (record, number) => {
        const versions = await store.textVersions(record)
        const version = versions.find((each) => each.number === number)
        if (!version) return
        const label = textVersionLabel(t, version)
        const shownNow = ((await store.load(record))?.textVersion ?? versions.at(-1)?.number) === number
        const sure = await platform.ui.confirm({
          title: t('bibliotheque.textVersion.delete.title', { version: label }),
          message: t(shownNow ? 'bibliotheque.textVersion.delete.messageShown' : 'bibliotheque.textVersion.delete.message', { version: label }),
          confirm: t('bibliotheque.textVersion.delete.confirm'),
          cancel: t('bibliotheque.cancel'),
          danger: true
        })
        if (!sure) return
        const done = await store.deleteTextVersion(record, number)
        if (!done) return
        platform.notifier.notify(
          done.shown && shownNow
            ? t('bibliotheque.textVersion.deleted.shown', { version: label, shown: textVersionLabel(t, done.shown) })
            : t('bibliotheque.textVersion.deleted', { version: label }),
          6000
        )
      },
      transcribe: async (record) => {
        // Dit sur la fiche pendant qu'il se fait : un gros PDF prend du temps.
        extracting.add(record)
        pagesChanged()
        let done: Awaited<ReturnType<typeof store.transcribe>>
        try {
          done = await store.transcribe(record)
        } finally {
          extracting.delete(record)
          pagesChanged()
        }
        if (!done) return platform.notifier.notify(t('bibliotheque.text.unavailable'), 8000)
        const state = t(`bibliotheque.text.state.${done.transcript.state}`)
        platform.notifier.notify(
          done.transcript.state === 'lue'
            ? t('bibliotheque.text.extracted', { title: done.doc.title, state, characters: done.transcript.text.length.toLocaleString('fr-FR') })
            : t('bibliotheque.text.extracted.none', { title: done.doc.title, state }),
          6000
        )
        // Le texte extrait de nouveau : relu par l'IA, comme au dépôt (son workflow système, s'il est actif).
        if (done.transcript.state === 'lue' && aiProofread) await runSystemWorkflow(aiProofread, TRIGGER_POURED, pouredSubject(done.doc, await knownIssuers()))
      },
      aiReading: aiReadingNow,
      extracting: extractingNow,
      proofreading: (doc) => ({ text: aiProofread !== null && doc.reading === 'lue', vision: aiProofread !== null && !!aiVision?.(doc.file) }),
      proofread: async (record) => {
        const doc = await store.load(record)
        if (!doc) return
        const withText = doc.reading === 'lue'
        // Un texte : le modèle à choisir, simple ou avec la vision (si le fichier se montre en images) ; sans texte, la vision seule.
        let mode: 'texte' | 'vision' = withText ? 'texte' : 'vision'
        if (withText && aiVision?.(doc.file)) {
          const chosen = await platform.ui.pickOption(
            // La vision d'abord : le choix proposé d'office.
            [
              { value: 'vision', label: t('bibliotheque.text.proofread.vision'), description: t('bibliotheque.text.proofread.vision.desc') },
              { value: 'texte', label: t('bibliotheque.text.proofread.texte'), description: t('bibliotheque.text.proofread.texte.desc') }
            ],
            t('bibliotheque.text.proofread.choose')
          )
          if (!chosen) return
          mode = chosen === 'vision' ? 'vision' : 'texte'
        }
        // L'IA lit déjà un document : celui-ci attend son tour (dit sur les fiches).
        const waits = aiRunning !== null && aiRunning.record !== doc.record
        if (waits && !aiQueue.some((each) => each.record === doc.record)) {
          aiQueue.push({ record: doc.record, title: doc.title, detail: '' })
          pagesChanged()
          platform.notifier.notify(t('bibliotheque.ai.enqueued', { title: doc.title, position: aiQueue.length, running: aiRunning!.title }), 6000)
        }
        const subject = pouredSubject(doc, await knownIssuers())
        // Le mode choisi passe par une variable du sujet ; un scan, sans texte, est lu quand même (la condition du workflow le demande).
        const asked: Subject = { ...subject, vars: { ...subject.vars, relecture: mode, ...(withText ? {} : { texteextrait: t('bibliotheque.text.proofread.byVision') }) } }
        try {
          if (!aiProofread || !(await runSystemWorkflow(aiProofread, TRIGGER_POURED, asked))) {
            platform.notifier.notify(t('bibliotheque.text.proofread.off'), 10000)
          }
        } finally {
          // Passé (ou pas lancé) : plus en file d'attente.
          const left = aiQueue.findIndex((each) => each.record === doc.record)
          if (left >= 0) {
            aiQueue.splice(left, 1)
            pagesChanged()
          }
        }
      },
      tagList: () => knownTags(),
      pieceTypeOutside: (code) => !!code && !libraryPieceTypes().some((type) => type.code === code),
      canAddPieceType: () => !!pieceTyper?.add,
      typeText: pieceTypeText,
      issuers: () => knownIssuers(),
      researchField,
      renameFile,
      confirmDate: async (record, date) => {
        const doc = await store.setDate(record, date)
        if (doc) platform.notifier.notify(doc.date ? t('bibliotheque.date.confirmed', { date: docDateLabel(doc.date, active?.locale) }) : t('bibliotheque.date.confirmed.none', { title: doc.title }), 5000)
      },
      confirmTags: async (record, tags) => {
        const doc = await store.setTags(record, tags)
        if (doc) platform.notifier.notify(doc.tags.length ? t('bibliotheque.tags.confirmed', { tags: doc.tags.join(', ') }) : t('bibliotheque.tags.confirmed.none', { title: doc.title }), 5000)
      },
      confirmIssuer: async (record, issuer) => {
        const doc = await store.setIssuer(record, issuer)
        if (doc) platform.notifier.notify(doc.issuer ? t('bibliotheque.issuer.confirmed', { issuer: issuerLabelIn(doc.issuer, await knownIssuers()) }) : t('bibliotheque.issuer.confirmed.none', { title: doc.title }), 5000)
      },
      confirmTitle: async (record, title) => {
        const doc = await store.setTitle(record, title)
        if (doc) platform.notifier.notify(t('bibliotheque.title.confirmed', { title: doc.title }), 5000)
      },
      confirmIdentity: async (record) => {
        const doc = await store.setIdentity(record, null)
        if (doc) platform.notifier.notify(t('bibliotheque.identity.confirmed', { title: doc.title }), 5000)
      },
      setLanguage: async (record, language) => {
        const doc = await store.setLanguage(record, language)
        if (doc) platform.notifier.notify(t('bibliotheque.lang.set', { title: doc.title, language: t(`bibliotheque.lang.${language}`) }), 5000)
      },
      relate: async (record, previous) => {
        const doc = await store.relate(record, previous)
        if (doc) platform.notifier.notify(t('bibliotheque.related', { title: doc.title }), 5000)
      },
      dismissLikely: (record) => store.dismissLikely(record),
      setAside: async (record) => {
        const doc = await store.load(record)
        if (!doc) return false
        const sure = await platform.ui.confirm({
          title: t('bibliotheque.setAside.title'),
          message: t(doc.copied ? 'bibliotheque.setAside.message.copied' : 'bibliotheque.setAside.message.inPlace', { title: doc.title }),
          confirm: t('bibliotheque.setAside'),
          cancel: t('bibliotheque.cancel'),
          danger: true
        })
        if (!sure) return false
        await store.setAside(record)
        platform.notifier.notify(t('bibliotheque.setAside.done', { title: doc.title }), 6000)
        return true
      },
      ...(platform.fs.trash
        ? {
            deleteDoc: async (record: string) => {
              const doc = await store.load(record)
              if (!doc) return false
              // Ce qui s'en sert : les modules d'où il vient (une analyse…), ceux qui l'appellent (un projet…).
              const users = [
                ...doc.origins.filter((origin) => origin.module !== BIBLIOTHEQUE).map((origin) => [t(`${origin.module}.name`), origin.label].filter(Boolean).join(' — ')),
                ...(await callersOf(record)).map((caller) => caller.title)
              ]
              const sure = await platform.ui.confirm({
                title: t('bibliotheque.delete.title', { title: doc.title }),
                message: [
                  t(doc.copied ? 'bibliotheque.delete.message.copied' : 'bibliotheque.delete.message.inPlace', { title: doc.title, file: doc.file }),
                  ...(users.length ? [t('bibliotheque.delete.users', { users: [...new Set(users)].join(', ') })] : [])
                ].join('\n\n'),
                confirm: t('bibliotheque.delete'),
                cancel: t('bibliotheque.cancel'),
                danger: true
              })
              if (!sure) return false
              if (!(await store.deleteDoc(record))) return false
              platform.notifier.notify(t('bibliotheque.delete.done', { title: doc.title }), 6000)
              pagesChanged()
              return true
            }
          }
        : {})
    })

    // ── Les prompts et les personas ──
    /** La fenêtre d'une entrée : nom, catégorie, description, favori, texte. */
    const entryForm = async (kind: EntryKind, current?: LibraryEntry, preset: Partial<EntryDraft> = {}): Promise<EntryDraft | null> => {
      if (kind === 'person') return personForm(current, preset)
      const categories = [...new Set((await entries[kind].all()).map((each) => each.category).filter(Boolean))]
      const values = await platform.ui.askForm({
        title: current ? t('bibliotheque.entry.edit.title', { name: current.name }) : t(`bibliotheque.${kind}.new`),
        intro: t(`bibliotheque.${kind}.form.intro`),
        fields: [
          // Un émetteur : son code court, puis son nom.
          ...(kind === 'issuer'
            ? [{ kind: 'text' as const, key: 'code', label: t('bibliotheque.issuer.field.code'), required: true, value: current?.code ?? preset.code ?? '', placeholder: t('bibliotheque.issuer.field.code.placeholder'), description: t('bibliotheque.issuer.field.code.desc') }]
            : []),
          { kind: 'text', key: 'name', label: t(kind === 'issuer' || kind === 'tag' || kind === 'glossary' ? `bibliotheque.${kind}.field.name` : 'bibliotheque.entry.field.name'), required: true, value: current?.name ?? preset.name ?? '', ...(kind === 'issuer' || kind === 'glossary' ? { placeholder: t(`bibliotheque.${kind}.field.name.placeholder`) } : {}) },
          // Un terme du glossaire : son sigle ou son abréviation, s'il en a un.
          ...(kind === 'glossary'
            ? [{ kind: 'text' as const, key: 'code', label: t('bibliotheque.glossary.field.code'), value: current?.code ?? preset.code ?? '', placeholder: t('bibliotheque.glossary.field.code.placeholder'), description: t('bibliotheque.glossary.field.code.desc') }]
            : []),
          { kind: 'text', key: 'category', label: t('bibliotheque.entry.field.category'), value: current?.category ?? '', ...(categories.length ? { description: t('bibliotheque.entry.field.category.known', { list: categories.join(', ') }) } : {}) },
          { kind: kind === 'glossary' ? ('textarea' as const) : ('text' as const), key: 'description', label: t(kind === 'glossary' ? 'bibliotheque.glossary.field.description' : 'bibliotheque.entry.field.description'), required: kind === 'glossary', value: current?.description ?? '', placeholder: t(`bibliotheque.${kind}.field.description.placeholder`) },
          { kind: 'textarea', key: 'text', label: t(`bibliotheque.${kind}.text`), required: kind !== 'issuer' && kind !== 'tag' && kind !== 'glossary', value: current?.text ?? '', placeholder: t(`bibliotheque.${kind}.field.text.placeholder`), tooltip: t(`bibliotheque.${kind}.field.text.tip`) },
          // Un terme du glossaire : ses autres formes, une par ligne (cherchées comme lui dans les documents).
          ...(kind === 'glossary'
            ? [{ kind: 'textarea' as const, key: 'aliases', label: t('bibliotheque.glossary.field.aliases'), value: (current?.aliases ?? preset.aliases ?? []).join('\n'), placeholder: t('bibliotheque.glossary.field.aliases.placeholder'), tooltip: t('bibliotheque.glossary.field.aliases.tip') }]
            : []),
          { kind: 'toggle', key: 'favorite', label: t('bibliotheque.entry.favorite'), value: current?.favorite ?? false, tooltip: t(`bibliotheque.${kind}.field.favorite.tip`) },
          // Un skill exécutable : ce qu'il reçoit, ce qu'il rend, son seuil.
          ...(kind === 'skill' ? skillFormFields(current) : [])
        ],
        submit: current ? t('bibliotheque.entry.save') : t('bibliotheque.entry.create')
      })
      const name = values?.name?.trim()
      const text = values?.text?.trim() ?? ''
      const code = (values?.code ?? '').trim().replace(/\s+/g, ' ')
      if (!values || !name || (!text && kind !== 'issuer' && kind !== 'tag' && kind !== 'glossary') || (kind === 'issuer' && !code) || (kind === 'glossary' && !(values.description ?? '').trim())) return null
      return { name, text, category: (values.category ?? '').trim(), description: (values.description ?? '').trim(), favorite: values.favorite === 'true', ...(kind === 'issuer' || (kind === 'glossary' && code) ? { code } : {}), ...(kind === 'skill' ? skillDraft(values) : {}), ...(kind === 'glossary' ? glossaryAliases(values.aliases ?? '', name, code) : {}) }
    }
    /** Les autres formes d'un terme : une par ligne, sans doublon, ni son nom ni son sigle. */
    const glossaryAliases = (raw: string, name: string, code: string): Pick<EntryDraft, 'aliases'> => {
      const same = (a: string, b: string) => a.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() === b.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
      const forms = [...new Set(raw.split(/\n|;/).map((each) => each.trim()).filter(Boolean))].filter((each) => !same(each, name) && !(code && same(each, code)))
      return forms.length ? { aliases: forms } : {}
    }
    /** Les champs d'un skill exécutable : un interrupteur par contexte, la sortie, le seuil. */
    const skillFormFields = (current?: LibraryEntry): FormField[] => [
      ...skillContextKeys().map((key, index) => ({
        kind: 'toggle' as const,
        key: `contexte:${key}`,
        label: skillContextLabel(key),
        value: current?.context?.includes(key) ?? false,
        ...(index === 0 ? { description: t('bibliotheque.skill.field.context.desc') } : {})
      })),
      {
        kind: 'choice',
        key: 'sortie',
        label: t('bibliotheque.skill.field.output'),
        value: current?.output ?? '',
        description: t('bibliotheque.skill.field.output.desc'),
        options: [{ value: '', label: t('bibliotheque.skill.output.none') }, ...SKILL_OUTPUTS.map((output) => ({ value: output, label: t(`bibliotheque.skill.output.${output}`) }))]
      },
      {
        kind: 'text',
        key: 'seuil',
        label: t('bibliotheque.skill.field.threshold'),
        value: current?.threshold !== undefined ? String(current.threshold).replace('.', ',') : '',
        placeholder: String(DEFAULT_THRESHOLD).replace('.', ','),
        description: t('bibliotheque.skill.field.threshold.desc', { threshold: thresholdLabel(DEFAULT_THRESHOLD) })
      }
    ]
    const skillDraft = (values: Record<string, string>): Pick<EntryDraft, 'context' | 'output' | 'threshold'> => {
      const context = skillContextKeys().filter((key) => values[`contexte:${key}`] === 'true')
      const output = (values.sortie ?? '').trim()
      const threshold = readThreshold(values.seuil)
      return { ...(context.length ? { context } : {}), ...(output ? { output } : {}), ...(threshold !== null ? { threshold } : {}) }
    }
    /**
     * La fenêtre d'une personne : son nom, son entreprise (dans la liste des entreprises, ou
     * « ＋ Ajouter une entreprise à la liste… »), sa fonction, son adresse, son téléphone, sa
     * catégorie, favorite ou non, des notes.
     */
    const personForm = async (current?: LibraryEntry, preset: Partial<EntryDraft> = {}): Promise<EntryDraft | null> => {
      const categories = [...new Set((await entries.person.all()).map((each) => each.category).filter(Boolean))]
      const known = await knownIssuers()
      const company = current?.company ?? preset.company ?? ''
      // Une entreprise écrite qui n'est pas (ou plus) dans la liste : gardée, dite telle.
      const listed = known.find((each) => each.code === company || each.name.toLowerCase() === company.toLowerCase())?.code
      const values = await platform.ui.askForm({
        title: current ? t('bibliotheque.entry.edit.title', { name: current.name }) : t('bibliotheque.person.new'),
        intro: t('bibliotheque.person.form.intro'),
        fields: [
          { kind: 'text', key: 'name', label: t('bibliotheque.person.field.name'), required: true, value: current?.name ?? preset.name ?? '', placeholder: t('bibliotheque.person.field.name.placeholder') },
          {
            kind: 'choice',
            key: 'company',
            label: t('bibliotheque.person.field.company'),
            value: listed ?? company,
            description: t('bibliotheque.person.field.company.desc'),
            create: issuerCreate(),
            options: [
              { value: '', label: t('bibliotheque.issuer.unset') },
              ...[...known].sort((a, b) => a.code.localeCompare(b.code, 'fr')).map((each) => ({ value: each.code, label: issuerLabelIn(each.code, known) })),
              ...(company && !listed ? [{ value: company, label: t('bibliotheque.issuer.outside', { issuer: company }) }] : []),
              { value: NEW_ISSUER, label: t('bibliotheque.issuer.add') }
            ]
          },
          { kind: 'text', key: 'description', label: t('bibliotheque.person.field.role'), value: current?.description ?? preset.description ?? '', placeholder: t('bibliotheque.person.field.role.placeholder') },
          { kind: 'text', key: 'email', label: t('bibliotheque.person.field.email'), value: current?.email ?? preset.email ?? '', placeholder: t('bibliotheque.person.field.email.placeholder') },
          { kind: 'text', key: 'phone', label: t('bibliotheque.person.field.phone'), value: current?.phone ?? preset.phone ?? '', placeholder: t('bibliotheque.person.field.phone.placeholder') },
          { kind: 'text', key: 'category', label: t('bibliotheque.entry.field.category'), value: current?.category ?? '', placeholder: t('bibliotheque.person.field.category.placeholder'), ...(categories.length ? { description: t('bibliotheque.entry.field.category.known', { list: categories.join(', ') }) } : {}) },
          { kind: 'textarea', key: 'text', label: t('bibliotheque.person.text'), value: current?.text ?? '', placeholder: t('bibliotheque.person.field.text.placeholder') },
          { kind: 'toggle', key: 'favorite', label: t('bibliotheque.entry.favorite'), value: current?.favorite ?? false, tooltip: t('bibliotheque.person.field.favorite.tip') }
        ],
        submit: current ? t('bibliotheque.entry.save') : t('bibliotheque.entry.create')
      })
      const name = values?.name?.trim()
      if (!values || !name) return null
      const email = (values.email ?? '').trim()
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        platform.notifier.notify(t('bibliotheque.person.badEmail', { email }), 8000)
        return null
      }
      // Une entreprise à ajouter : sa fenêtre, puis elle est celle de la personne.
      let chosen = (values.company ?? '').trim()
      if (chosen === NEW_ISSUER) {
        const draft = await newIssuer('')
        chosen = draft?.code ?? company
      }
      return {
        name,
        text: (values.text ?? '').trim(),
        category: (values.category ?? '').trim(),
        description: (values.description ?? '').trim(),
        favorite: values.favorite === 'true',
        ...(chosen ? { company: chosen } : {}),
        ...(email ? { email } : {}),
        ...((values.phone ?? '').trim() ? { phone: (values.phone ?? '').trim() } : {})
      }
    }
    const createEntry = async (kind: EntryKind, folder?: string): Promise<string | null> => {
      const draft = await entryForm(kind)
      if (!draft) return null
      const path = await entries[kind].create(draft, folder)
      platform.notifier.notify(t(`bibliotheque.${kind}.created`, { name: draft.name }), 5000)
      return path
    }
    /**
     * **Les documents d'une entreprise** : ceux qu'elle émet (leur champ « Entreprise » : son code ou
     * son nom ; à confirmer, dit), et ceux qui la citent (reliés à sa note par le circuit) sans être
     * émis par elle.
     */
    const companyDocuments = async (entry: LibraryEntry): Promise<{ issued: CompanyDoc[]; cited: CompanyDoc[] }> => {
      const all = await store.all()
      const mine = (doc: LibraryDoc) => !!doc.issuer && (sameName(doc.issuer, entry.code || entry.name) || sameName(doc.issuer, entry.name))
      const row = (doc: LibraryDoc): CompanyDoc => ({
        record: doc.record,
        title: doc.title,
        detail: [doc.category, doc.date, placeOfFolder(doc.record.slice(0, doc.record.lastIndexOf('/')))].filter(Boolean).join(' · '),
        ...(mine(doc) && doc.issuerToConfirm ? { toConfirm: true } : {})
      })
      const byTitle = (a: CompanyDoc, b: CompanyDoc) => a.title.localeCompare(b.title, 'fr')
      return {
        issued: all.filter(mine).map(row).sort(byTitle),
        cited: all.filter((doc) => !mine(doc) && (doc.links ?? []).includes(entry.path)).map(row).sort(byTitle)
      }
    }
    /**
     * **Les documents d'une personne** : ceux qui y sont reliés (lien et rétrolien), et ceux qui la
     * citent (son nom, en mot entier) sans y être reliés — à relier d'un clic.
     */
    const personDocuments = async (entry: LibraryEntry): Promise<{ linked: CompanyDoc[]; cited: CompanyDoc[] }> => {
      // Toutes les personnes, en une source : l'index sert à la fiche de chacune.
      const persons: LinkSourceItem[] = (await entries.person.all()).map((each) => ({ path: each.path, label: each.name, kind: 'person', names: [each.name] }))
      const row = (doc: LibraryDoc, found?: string): CompanyDoc => ({
        record: doc.record,
        title: doc.title,
        detail: [doc.category, doc.date, placeOfFolder(doc.record.slice(0, doc.record.lastIndexOf('/')))].filter(Boolean).join(' · '),
        ...(found ? { found } : {})
      })
      const linked: CompanyDoc[] = []
      const cited: CompanyDoc[] = []
      const all = await store.all()
      mentions.keep(new Set(all.map((doc) => doc.record)))
      for (const doc of all) {
        if ((doc.links ?? []).includes(entry.path)) linked.push(row(doc))
        else {
          const found = (await mentions.of('personnes', doc, persons)).find((candidate) => candidate.path === entry.path)?.found
          if (found) cited.push(row(doc, found))
        }
      }
      const byTitle = (a: CompanyDoc, b: CompanyDoc) => a.title.localeCompare(b.title, 'fr')
      return { linked: linked.sort(byTitle), cited: cited.sort(byTitle) }
    }
    /** Relier un document à une note (une personne qu'il cite) : le lien dans sa fiche, le rétrolien dans la note. */
    const linkNoteIn = async (record: string, path: string, why: string): Promise<void> => {
      const links = await store.linksOf(record)
      if (links.some((each) => each.path === path)) return
      await store.setLinks(record, [...links, { path, why }])
      pagesChanged()
    }
    /**
     * **Les documents d'une étiquette** : ceux qui la portent (elle, ou une de ses autres formes), et
     * ceux où elle est suggérée (leurs étiquettes à confirmer) sans y être encore — à ajouter d'un clic.
     */
    const tagDocuments = async (entry: LibraryEntry): Promise<{ tagged: CompanyDoc[]; suggested: CompanyDoc[] }> => {
      const forms = [entry.name, ...entry.text.split('\n').map((line) => line.replace(/^[-*•]\s*/, '').trim())].filter(Boolean)
      const isIt = (tag: string) => forms.some((form) => sameName(form, tag))
      const row = (doc: LibraryDoc): CompanyDoc => ({ record: doc.record, title: doc.title, detail: [doc.category, doc.date, placeOfFolder(doc.record.slice(0, doc.record.lastIndexOf('/')))].filter(Boolean).join(' · ') })
      const byTitle = (a: CompanyDoc, b: CompanyDoc) => a.title.localeCompare(b.title, 'fr')
      const all = await store.all()
      return {
        tagged: all.filter((doc) => doc.tags.some(isIt)).map(row).sort(byTitle),
        suggested: all.filter((doc) => !doc.tags.some(isIt) && !!doc.tagsToConfirm && (doc.tagsProbable ?? []).some(isIt)).map(row).sort(byTitle)
      }
    }
    /** Ajouter une étiquette à un document (gardée sous son nom). */
    const tagDocument = async (record: string, name: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc || doc.tags.some((tag) => sameName(tag, name))) return
      const saved = await store.setTags(record, [...doc.tags, name])
      // Ses autres étiquettes suggérées restent à confirmer (seule celle-ci, sous toutes ses formes, est donnée).
      const entry = (await entries.tag.all()).find((each) => sameName(each.name, name))
      const forms = [name, ...(entry?.text ?? '').split('\n').map((line) => line.replace(/^[-*•]\s*/, '').trim())].filter(Boolean)
      const rest = (doc.tagsProbable ?? []).filter((tag) => !forms.some((form) => sameName(form, tag)) && !doc.tags.some((each) => sameName(each, tag)))
      if (saved && doc.tagsToConfirm && rest.length) await store.save({ ...saved, tagsToConfirm: true, tagsProbable: rest })
      platform.notifier.notify(t('bibliotheque.tagPage.added', { tag: name, title: doc.title }), 5000)
      pagesChanged()
    }
    registerEntriesHome(context.views, {
      usedBy: (kind, name) => workflowsUsing(kind, name),
      showWorkflow: (id) => showPage?.(workflowPageOf(id)),
      tagDocuments,
      tagDocument,
      personDocuments,
      linkNoteIn,
      companyDocuments,
      documentsUsing,
      linkTermIn: async (record: string) => void (await searchGlossary(record)),
      showDocument: (record: string) => showPage?.(docPageOf(record)),
      explorer: explorerFor,
      t,
      stores: entries,
      skillContextLabel,
      documentsPage: LIBRARY_PAGE,
      documents: async () => {
        const docs = await store.all()
        return { count: docs.length, likely: docs.filter((doc) => doc.likelyPrevious).length }
      },
      places,
      placedDocuments: () => store.all(),
      pieceTypes: pieceTypesShortcut,
      exportAll,
      importAll,
      ...(showPage ? { showPage } : {}),
      showNote,
      create: createEntry,
      move: async (kind, path) => {
        const entry = await entries[kind].load(path)
        if (!entry) return null
        const folder = await pickPlace(kind, path.slice(0, path.lastIndexOf('/')), t('bibliotheque.move.pick', { name: entry.name }))
        if (!folder) return null
        const moved = await entries[kind].move(path, folder)
        if (moved) platform.notifier.notify(t('bibliotheque.move.done', { name: entry.name, folder }), 5000)
        return moved
      },
      edit: async (kind, path) => {
        const current = await entries[kind].load(path)
        if (!current) return null
        const draft = await entryForm(kind, current)
        if (!draft) return null
        const moved = await entries[kind].update(path, draft)
        platform.notifier.notify(t('bibliotheque.entry.saved', { name: draft.name }), 5000)
        return moved
      },
      toggleFavorite: async (kind, path) => void (await entries[kind].toggleFavorite(path)),
      setAside: async (kind, path) => {
        const current = await entries[kind].load(path)
        if (!current) return false
        const sure = await platform.ui.confirm({
          title: t(`bibliotheque.${kind}.setAside.title`),
          message: t('bibliotheque.entry.setAside.message', { name: current.name, folder: `${(shelves(kind).find((shelf) => path.startsWith(`${shelf.folder}/`)) ?? shelves(kind)[0]!).folder}/_retirés` }),
          confirm: t('bibliotheque.entry.setAside'),
          cancel: t('bibliotheque.cancel'),
          danger: true
        })
        if (!sure) return false
        await entries[kind].setAside(path)
        platform.notifier.notify(t('bibliotheque.entry.setAside.done', { name: current.name }), 6000)
        return true
      },
      ...(platform.fs.trash
        ? {
            remove: async (kind: EntryKind, path: string) => {
              const current = await entries[kind].load(path)
              if (!current) return false
              const sure = await platform.ui.confirm({
                title: t('bibliotheque.entry.delete.title', { name: current.name }),
                message: t('bibliotheque.entry.delete.message', { name: current.name, path }),
                confirm: t('bibliotheque.entry.delete'),
                cancel: t('bibliotheque.cancel'),
                danger: true
              })
              if (!sure || !(await entries[kind].remove(path))) return false
              platform.notifier.notify(t('bibliotheque.entry.delete.done', { name: current.name }), 6000)
              pagesChanged()
              return true
            }
          }
        : {}),
      addStarters: async (kind) => {
        const added = await entries[kind].addStarters(startersFor(kind, i18n.language))
        platform.notifier.notify(added.length ? t(`bibliotheque.${kind}.starters.done`, { count: added.length, names: added.join(', ') }) : t('bibliotheque.entry.starters.none'), 8000)
      }
    })
    for (const kind of ENTRY_KINDS) {
      context.commands.register({
        id: `${kind}s`,
        nameKey: `bibliotheque.command.${kind}s`,
        run: async () => {
          if (showPage) showPage(`bibliotheque.${kind}s`)
          else await platform.ui.openNote(entries[kind].root)
        }
      })
      context.commands.register({
        id: `nouveau-${kind}`,
        nameKey: `bibliotheque.command.new.${kind}`,
        run: async () => {
          const path = await createEntry(kind)
          if (path) {
            if (showPage) showPage(entryPageOf(kind, path))
            else await platform.ui.openNote(path)
          }
        }
      })
    }

    context.commands.register({
      id: 'documents',
      nameKey: 'bibliotheque.command.open',
      run: async () => {
        if (showPage) showPage('bibliotheque.documents')
        else await platform.ui.openNote(store.root)
      }
    })
    context.commands.register({ id: 'verser', nameKey: 'bibliotheque.command.pour', run: async () => void (await pour()) })
  },
  deactivate() {
    pieceTypeMaker = null
    active = null
    for (const stop of stopSkillContexts) stop()
    stopSkillContexts = []
    stopRenames?.()
    stopRenames = null
    stopRunningWatch?.()
    stopRunningWatch = null
  }
}
