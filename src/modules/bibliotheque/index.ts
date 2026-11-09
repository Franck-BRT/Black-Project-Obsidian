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

import { localToday } from '../../core/dates'
import { fillTemplate } from '../../core/docs'
import type { BlackModule, ModuleContext, ModuleDetails, ModuleFeature, TextField } from '../../core/modules/module'
import type { Choice, Ui } from '../../core/ports'
import { cleanFolder } from '../../core/settings'
import { emitWorkflowEvent, NO_SUBJECT, registerFieldSource, registerTrigger, runSystemWorkflow, systemWorkflowManages, workflowRunning, type Subject } from '../workflows'
import page from './doc/Bibliothèque.md'
import { AI_ENTRY_KINDS, ENTRY_KINDS, EntryStore, findIn, type EntryDraft, type EntryKind, type LibraryEntry } from './entries'
import { entryPageOf, entryTitle, registerEntriesHome } from './entriesHome'
import { docPageOf, LIBRARY_PAGE, registerLibraryHome, type EditableField } from './home'
import { startersFor } from './starters'
import { bibliothequeEn, bibliothequeFr } from './i18n'
import { baseName, CATEGORIES, versionLabel, type DocOrigin, type LibraryDoc } from './model'
import { LibraryStore, RESEARCH_KEYS, type PourItem, type PourOptions, type PourReport, type ResearchField } from './store'
import { allPlaces, type ShelfPlacesDeps } from './places'
import { isLanguage, LANGUAGES, type LanguageCode } from './language'
import { defaultShelfOf, folderName, SHELF_KINDS, shelvesOf, withDefaultShelf, withoutShelf, withShelf, type Shelf, type ShelfKind } from './shelves'
import { batchSubject, depositSubject, dropDeposit, holdDeposit, knownSubject, registerLibraryWorkflows, SYS_FILES, SYS_GHOST, SYS_PIECES, SYS_VERSIONS, TRIGGER_BATCH, TRIGGER_DEPOSITED, TRIGGER_KNOWN, type Deposit } from './workflows'

// ── Interface publique ────────────────────────────────────────────────────────────
export type { DocOrigin, LibraryDoc } from './model'
export type { PourItem, PourOptions, PourReport, ResearchField } from './store'
export type { EntryKind, LibraryEntry } from './entries'
export { detectLanguage, LANGUAGES, type LanguageCode, type LanguageGuess } from './language'
import { CATEGORY_TYPER, docDateLabel, knownIssuerCode, parseDocDate, suggestIssuerCode, type KnownIssuer, type PieceTyper } from './identity'
export { categoryFromText, dateFoundIn, docDateLabel, guessDocCategory, guessDocDate, parseDocDate, guessIdentity, guessIssuer, guessTags, guessTitle, IDENTITY_HEAD, issuerFoundIn, tagsFoundIn, plausibleReference, referenceFoundIn, titleFoundIn, type DocIdentity, type CategoryGuess, type DateGuess, type IdentityGuess, type IssuerGuess, type TagsGuess, type TitleGuess, type PieceTyper, pieceTypeCode, knownIssuerCode, suggestIssuerCode, type KnownIssuer } from './identity'

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
export const DEFAULT_ISSUERS_FOLDER = 'Bibliothèque/Émetteurs'
/** Un document entré dans la bibliothèque : le déclencheur de workflow. */
export const TRIGGER_POURED = 'bibliotheque.document-verse'
export { SYS_FILES, SYS_GHOST, SYS_MISSING, SYS_PIECES, SYS_VERSIONS, TRIGGER_BATCH, TRIGGER_DEPOSITED, TRIGGER_KNOWN } from './workflows'

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
} | null = null

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
 * Le module Workflows actif, un dépôt d'un autre module passe par ses workflows système
 * (« Ranger les pièces importées », « Ranger les fichiers importés ») : désactivés, les
 * fichiers ne sont pas rangés — `null`. Ce qu'on verse soi-même depuis la bibliothèque y
 * entre toujours.
 */
export async function pourIntoLibrary(items: readonly PourItem[], origin: DocOrigin, options: PourOptions = {}): Promise<PourReport | null> {
  if (!active || !items.length) return null
  try {
    if (origin.module !== BIBLIOTHEQUE && (systemWorkflowManages(SYS_PIECES) || systemWorkflowManages(SYS_FILES))) return await depositThroughWorkflows(items, origin, options)
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

/** Pour l'IA : les étiquettes qu'elle a données — plus à confirmer, et on sait qui l'a dit. */
export async function setTagsByAi(record: string, tags: readonly string[]): Promise<LibraryDoc | null> {
  return active ? active.store.setTags(record, tags, true) : null
}

/** Pour l'IA : les étiquettes déjà en usage dans la bibliothèque (un vocabulaire commun), les plus employées d'abord. */
export async function libraryTags(): Promise<string[]> {
  const counts = new Map<string, { tag: string; count: number }>()
  for (const tag of active ? (await active.store.all()).flatMap((doc) => doc.tags) : []) {
    const seen = counts.get(tag.toLowerCase())
    counts.set(tag.toLowerCase(), { tag: seen?.tag ?? tag, count: (seen?.count ?? 0) + 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'fr')).map((each) => each.tag)
}

/** Le choix « Ajouter un émetteur à la liste… » d'une liste d'émetteurs. */
const NEW_ISSUER = '\u0000nouvel-emetteur'

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
      date: doc.date ?? '',
      dateaconfirmer: doc.dateToConfirm ? t('bibliotheque.read.yes') : '',
      etiquettes: doc.tags.join(', '),
      etiquettesaconfirmer: doc.tagsToConfirm ? t('bibliotheque.read.yes') : '',
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

/** Le réglage du dossier de chaque sorte d'entrées, et son dossier d'origine. */
const FOLDER_KEYS: Readonly<Record<EntryKind, readonly [string, string]>> = {
  prompt: [PROMPTS_FOLDER_KEY, DEFAULT_PROMPTS_FOLDER],
  persona: [PERSONAS_FOLDER_KEY, DEFAULT_PERSONAS_FOLDER],
  skill: [SKILLS_FOLDER_KEY, DEFAULT_SKILLS_FOLDER],
  issuer: [ISSUERS_FOLDER_KEY, DEFAULT_ISSUERS_FOLDER]
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
      { titleKey: 'bibliotheque.feature.section.places', features: [feature('shelves', 'available'), feature('directories', 'available'), feature('move', 'available')] },
      { titleKey: 'bibliotheque.feature.section.ai', features: [feature('prompts', 'available'), feature('personas', 'available'), feature('skills', 'available'), feature('starters', 'available')] },
      { titleKey: 'bibliotheque.feature.section.issuers', features: [feature('issuers', 'available')] },
      { titleKey: 'bibliotheque.feature.section.next', features: [feature('text', 'planned', 7), feature('delivery', 'planned', 7)] }
    ]
  }
}

const folderOf = (settings: Readonly<Record<string, unknown>>, key = FOLDER_KEY, fallback = DEFAULT_FOLDER): string => {
  const stored = settings[key]
  return typeof stored === 'string' && stored.trim() ? cleanFolder(stored) : fallback
}

export const bibliothequeModule: BlackModule = {
  id: BIBLIOTHEQUE,
  nameKey: 'bibliotheque.name',
  descriptionKey: 'bibliotheque.description',
  version: '0.25.0',
  requires: [],
  texts: { fr: bibliothequeFr, en: bibliothequeEn },
  details: () => bibliothequeFeatures(),
  settingsFields: [folderField, entriesFolderField('prompt'), entriesFolderField('persona'), entriesFolderField('skill'), entriesFolderField('issuer')],
  docs: ({ folder }) => [{ path: 'Modules/Bibliothèque.md', content: fillTemplate(page, folder) }],
  activate(context: ModuleContext) {
    const { platform, i18n, settings } = context
    const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
    const promptsFolder = () => folderOf(settings.get(), PROMPTS_FOLDER_KEY, DEFAULT_PROMPTS_FOLDER)
    const personasFolder = () => folderOf(settings.get(), PERSONAS_FOLDER_KEY, DEFAULT_PERSONAS_FOLDER)
    const skillsFolder = () => folderOf(settings.get(), SKILLS_FOLDER_KEY, DEFAULT_SKILLS_FOLDER)
    // Les bibliothèques de chaque sorte : la principale (le dossier des réglages), puis celles ajoutées.
    const issuersFolder = () => folderOf(settings.get(), ISSUERS_FOLDER_KEY, DEFAULT_ISSUERS_FOLDER)
    const mainFolder: Record<ShelfKind, () => string> = { document: () => folderOf(settings.get()), prompt: promptsFolder, persona: personasFolder, skill: skillsFolder, issuer: issuersFolder }
    const shelves = (kind: ShelfKind): Shelf[] => shelvesOf(settings.get(), kind, mainFolder[kind](), t(`bibliotheque.shelf.main.${kind}`))
    const defaultShelf = (kind: ShelfKind): Shelf => defaultShelfOf(settings.get(), kind, shelves(kind))
    const store = new LibraryStore({
      fs: platform.fs,
      yaml: platform.yaml,
      folder: mainFolder.document,
      today: localToday,
      notesHeading: () => t('bibliotheque.notes'),
      ghostLine: (link, where) => t('bibliotheque.ghost.line', { link, where }),
      textOf: async (name, bytes) => (textReader ? textReader(name, bytes) : null),
      typer: () => pieceTyper ?? CATEGORY_TYPER,
      issuers: () => knownIssuers(),
      // Les prompts et les personas, rangés sous la bibliothèque (ou ailleurs) : pas des documents.
      skip: () => ENTRY_KINDS.flatMap((kind) => shelves(kind)).map((shelf) => shelf.folder),
      shelves: () => shelves('document'),
      target: () => defaultShelf('document').folder
    })
    const entryStore = (kind: EntryKind) =>
      new EntryStore(kind, { fs: platform.fs, yaml: platform.yaml, folder: mainFolder[kind], shelves: () => shelves(kind), target: () => defaultShelf(kind).folder })
    const entries: Record<EntryKind, EntryStore> = { prompt: entryStore('prompt'), persona: entryStore('persona'), skill: entryStore('skill'), issuer: entryStore('issuer') }
    const subdirectories = (kind: ShelfKind) => (folder: string) => (kind === 'document' ? store.subdirectories(folder) : entries[kind].subdirectories(folder))
    /** Un dossier d'une bibliothèque de documents, en mots : « Normes › ECSS » (son nom d'abord quand il y en a plusieurs). */
    const placeOfFolder = (folder: string): string => {
      const all = shelves('document')
      const shelf = [...all].sort((a, b) => b.folder.length - a.folder.length).find((each) => folder === each.folder || folder.startsWith(`${each.folder}/`))
      if (!shelf) return folder
      const parts = folder.slice(shelf.folder.length).split('/').filter(Boolean)
      // Une seule bibliothèque : son nom n'apprend rien, sauf à sa racine.
      return (all.length > 1 || !parts.length ? [shelf.name, ...parts] : parts).join(' › ')
    }
    /** Proposer — ou placer d'office — un fantôme d'un document ici. */
    const offerGhost = async (record: string, folder: string, ask: boolean, ui: Ui): Promise<string | null> => {
      const doc = await store.load(record)
      if (!doc || !folder) return null
      const range = placeOfFolder(record.slice(0, record.lastIndexOf('/')))
      const ici = placeOfFolder(folder)
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
      return ghost
    }
    active = { store, t, entries, ui: platform.ui, placeOfFolder, offerGhost, locale: i18n.language === 'en' ? 'en-GB' : 'fr-FR', issuers: () => knownIssuers() }
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
      fields: ['titre', 'famille', 'categorie', 'fichier', 'origine', 'extension', 'lisible', 'lecture', 'langue', 'langueaconfirmer', 'reference', 'edition', 'revision', 'identiteaconfirmer', 'titreaconfirmer', 'emetteur', 'emetteurnom', 'emetteuraconfirmer', 'categorieaconfirmer', 'etiquettes', 'etiquettesaconfirmer', 'date', 'dateaconfirmer', 'fiche'].map((key) => ({ key, labelKey: `bibliotheque.wf.var.${key}` }))
    })
    registerLibraryWorkflows({
      t,
      store,
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
    const KIND_PAGE: Record<ShelfKind, string> = { document: LIBRARY_PAGE, prompt: 'bibliotheque.prompts', persona: 'bibliotheque.personas', skill: 'bibliotheque.skills', issuer: 'bibliotheque.issuers' }
    const SHELF_ROOT: Record<ShelfKind, string> = {
      document: 'Bibliothèques/Documents',
      prompt: 'Bibliothèques/Prompts',
      persona: 'Bibliothèques/Personas',
      skill: 'Bibliothèques/Skills',
      issuer: 'Bibliothèques/Émetteurs'
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
    const setDefault = async (kind: ShelfKind, id: string): Promise<void> => {
      await settings.save(withDefaultShelf(settings.get(), kind, id))
      const shelf = shelves(kind).find((each) => each.id === id)
      if (shelf) platform.notifier.notify(t(`bibliotheque.shelf.defaultDone.${kind}`, { name: shelf.name }), 6000)
    }
    const removeShelf = async (kind: ShelfKind, id: string): Promise<boolean> => {
      const shelf = shelves(kind).find((each) => each.id === id)
      if (!shelf || shelf.main) return false
      const sure = await platform.ui.confirm({
        title: t('bibliotheque.shelf.remove.title', { name: shelf.name }),
        message: t('bibliotheque.shelf.remove.message', { name: shelf.name, folder: shelf.folder }),
        confirm: t('bibliotheque.shelf.remove'),
        cancel: t('bibliotheque.cancel')
      })
      if (!sure) return false
      await settings.save(withoutShelf(settings.get(), kind, id))
      platform.notifier.notify(t('bibliotheque.shelf.removed', { name: shelf.name, folder: shelf.folder }), 8000)
      return true
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
      newShelf,
      setDefault,
      removeShelf
    })
    const places = { document: placesOf('document'), prompt: placesOf('prompt'), persona: placesOf('persona'), skill: placesOf('skill'), issuer: placesOf('issuer') }
    /** Choisir où ranger : chaque bibliothèque de la sorte, chacun de ses répertoires (sauf là où c'est déjà). */
    const pickPlace = async (kind: ShelfKind, current: string, title: string): Promise<string | null> => {
      const options = (await allPlaces(shelves(kind), subdirectories(kind)))
        .filter((place) => place.folder !== current)
        .map((place) => ({ value: place.folder, label: [place.shelf.name, ...place.directory.split('/').filter(Boolean)].join(' › '), description: place.folder }))
      if (!options.length) {
        platform.notifier.notify(t('bibliotheque.move.none'), 6000)
        return null
      }
      return platform.ui.pickOption(options, title)
    }

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
    /** Ajouter un émetteur à la liste (sa fenêtre, le nom proposé) ; rend son code. */
    const newIssuer = async (name: string): Promise<EntryDraft | null> => {
      const draft = await entryForm('issuer', undefined, { name, code: suggestIssuerCode(name) })
      if (!draft) return null
      await entries.issuer.create(draft)
      return draft
    }
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
        ...(current && !types.some((type) => type.code === current) ? [{ value: current, label: t('bibliotheque.category.outside', { category: current }) }] : [])
      ]
    }

    const classify = async (record: string): Promise<void> => {
      const doc = await store.load(record)
      if (!doc) return
      const values = await platform.ui.askForm({
        title: t('bibliotheque.classify.title', { title: doc.title }),
        intro: t('bibliotheque.classify.intro'),
        fields: [
          { kind: 'text', key: 'title', label: t('bibliotheque.field.title'), value: doc.title, required: true },
          { kind: 'choice', key: 'category', label: t('bibliotheque.field.category'), value: doc.category, description: t('bibliotheque.classify.categories'), options: typeOptions(doc.category) },
          { kind: 'text', key: 'reference', label: t('bibliotheque.field.reference'), value: doc.reference, placeholder: 'CCTP-2026-118' },
          { kind: 'text', key: 'edition', label: t('bibliotheque.field.edition'), value: doc.edition, placeholder: '2' },
          { kind: 'text', key: 'revision', label: t('bibliotheque.field.revision'), value: doc.revision, placeholder: 'B' },
          { kind: 'choice', key: 'issuer', label: t('bibliotheque.field.issuer'), value: doc.issuer, description: t('bibliotheque.issuer.choose'), options: issuerOptions(doc.issuer, await knownIssuers()) },
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
      // La langue choisie : confirmée ; laissée vide, ce qu'elle était (à confirmer, ou inconnue).
      const language = isLanguage(values.language) ? values.language : ''
      const languageFields = language
        ? { language, languageToConfirm: undefined, languageProbable: undefined }
        : doc.language
          ? { language: undefined }
          : {}
      // La date : écrite comme on veut (« 12/03/2026 », « 12 mars 2026 ») ; illisible, celle qu'il avait reste.
      const typedDate = (values.date ?? '').trim()
      const date = typedDate ? parseDocDate(typedDate) || doc.date : undefined
      await store.save({
        ...doc,
        ...languageFields,
        date,
        dateToConfirm: undefined,
        dateProbable: undefined,
        dateByAi: undefined,
        // Classé à la main : le titre, la référence et la version sont confirmés.
        identityToConfirm: undefined,
        identityByAi: undefined,
        titleToConfirm: undefined,
        titleProbable: undefined,
        titleByAi: undefined,
        issuerToConfirm: undefined,
        issuerProbable: undefined,
        issuerByAi: undefined,
        categoryToConfirm: undefined,
        categoryProbable: undefined,
        categoryByAi: undefined,
        tagsToConfirm: undefined,
        tagsProbable: undefined,
        tagsByAi: undefined,
        title: (values.title ?? '').trim() || doc.title,
        category: (values.category ?? '').trim(),
        reference: (values.reference ?? '').trim(),
        edition: (values.edition ?? '').trim(),
        revision: (values.revision ?? '').trim(),
        issuer: values.issuer === NEW_ISSUER ? doc.issuer : (values.issuer ?? '').trim(),
        tags
      })
      // « Ajouter un émetteur à la liste… » : sa fenêtre, puis il devient celui du document.
      if (values.issuer === NEW_ISSUER) await addIssuerFor(record)
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
      const doc = await store.load(record)
      if (!doc) return
      const label = t(`bibliotheque.field.${key}`)
      const current = key === 'tags' ? doc.tags.join(', ') : key === 'date' ? (doc.date ?? '') : doc[key]
      const help: Partial<Record<EditableField, string>> = {
        category: t('bibliotheque.classify.categories', { list: CATEGORIES.map((each) => each.name).join(', ') }),
        tags: t('bibliotheque.classify.tags'),
        date: t('bibliotheque.classify.date')
      }
      const values = await platform.ui.askForm({
        title: t('bibliotheque.edit.title', { field: label, title: doc.title }),
        fields: [
          key === 'category'
            ? { kind: 'choice', key: 'value', label, value: current, description: t('bibliotheque.classify.categories'), options: typeOptions(current) }
            : key === 'issuer'
              ? { kind: 'choice', key: 'value', label, value: current, description: t('bibliotheque.issuer.choose'), options: issuerOptions(current, await knownIssuers()) }
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
      else {
        const tags = [...new Set(value.split(',').map((each) => each.trim()).filter(Boolean))]
        await store.setTags(record, tags)
        shown = tags.join(', ')
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

    registerLibraryHome(context.views, {
      t,
      store,
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
      places: { ...places.document, dropInto: (folder, where) => ({ label: t('bibliotheque.drop.label', { where }), run: async (files) => void (await pourItems(files, folder)) }) },
      move: async (record) => {
        const doc = await store.load(record)
        if (!doc) return null
        const folder = await pickPlace('document', record.slice(0, record.lastIndexOf('/')), t('bibliotheque.move.pick', { name: doc.title }))
        if (!folder) return null
        const moved = await store.move(record, folder)
        if (moved) platform.notifier.notify(t('bibliotheque.move.done', { name: doc.title, folder }), 5000)
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
      }
    })

    // ── Les prompts et les personas ──
    /** La fenêtre d'une entrée : nom, catégorie, description, favori, texte. */
    const entryForm = async (kind: EntryKind, current?: LibraryEntry, preset: Partial<EntryDraft> = {}): Promise<EntryDraft | null> => {
      const categories = [...new Set((await entries[kind].all()).map((each) => each.category).filter(Boolean))]
      const values = await platform.ui.askForm({
        title: current ? t('bibliotheque.entry.edit.title', { name: current.name }) : t(`bibliotheque.${kind}.new`),
        intro: t(`bibliotheque.${kind}.form.intro`),
        fields: [
          // Un émetteur : son code court, puis son nom.
          ...(kind === 'issuer'
            ? [{ kind: 'text' as const, key: 'code', label: t('bibliotheque.issuer.field.code'), required: true, value: current?.code ?? preset.code ?? '', placeholder: t('bibliotheque.issuer.field.code.placeholder'), description: t('bibliotheque.issuer.field.code.desc') }]
            : []),
          { kind: 'text', key: 'name', label: t(kind === 'issuer' ? 'bibliotheque.issuer.field.name' : 'bibliotheque.entry.field.name'), required: true, value: current?.name ?? preset.name ?? '', ...(kind === 'issuer' ? { placeholder: t('bibliotheque.issuer.field.name.placeholder') } : {}) },
          { kind: 'text', key: 'category', label: t('bibliotheque.entry.field.category'), value: current?.category ?? '', ...(categories.length ? { description: t('bibliotheque.entry.field.category.known', { list: categories.join(', ') }) } : {}) },
          { kind: 'text', key: 'description', label: t('bibliotheque.entry.field.description'), value: current?.description ?? '', placeholder: t(`bibliotheque.${kind}.field.description.placeholder`) },
          { kind: 'textarea', key: 'text', label: t(`bibliotheque.${kind}.text`), required: kind !== 'issuer', value: current?.text ?? '', placeholder: t(`bibliotheque.${kind}.field.text.placeholder`), tooltip: t(`bibliotheque.${kind}.field.text.tip`) },
          { kind: 'toggle', key: 'favorite', label: t('bibliotheque.entry.favorite'), value: current?.favorite ?? false, tooltip: t(`bibliotheque.${kind}.field.favorite.tip`) }
        ],
        submit: current ? t('bibliotheque.entry.save') : t('bibliotheque.entry.create')
      })
      const name = values?.name?.trim()
      const text = values?.text?.trim() ?? ''
      const code = (values?.code ?? '').trim().replace(/\s+/g, ' ')
      if (!values || !name || (!text && kind !== 'issuer') || (kind === 'issuer' && !code)) return null
      return { name, text, category: (values.category ?? '').trim(), description: (values.description ?? '').trim(), favorite: values.favorite === 'true', ...(kind === 'issuer' ? { code } : {}) }
    }
    const createEntry = async (kind: EntryKind, folder?: string): Promise<string | null> => {
      const draft = await entryForm(kind)
      if (!draft) return null
      const path = await entries[kind].create(draft, folder)
      platform.notifier.notify(t(`bibliotheque.${kind}.created`, { name: draft.name }), 5000)
      return path
    }
    registerEntriesHome(context.views, {
      t,
      stores: entries,
      documentsPage: LIBRARY_PAGE,
      documents: async () => {
        const docs = await store.all()
        return { count: docs.length, likely: docs.filter((doc) => doc.likelyPrevious).length }
      },
      places,
      placedDocuments: () => store.all(),
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
    active = null
  }
}
