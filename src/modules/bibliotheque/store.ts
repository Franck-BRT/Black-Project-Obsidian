// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La bibliothèque, rangée dans le coffre : une fiche (note) par document, sous le dossier
 * de la bibliothèque ; les fichiers venus de l'ordinateur copiés dans son sous-dossier
 * `_fichiers` ; ceux déjà dans le coffre (les pièces d'une analyse) laissés où ils sont.
 *
 * **Verser** un fichier : son empreinte d'abord. Même fichier (même chemin, ou mêmes
 * octets) qu'un document déjà là : rien n'est copié, seule son origine s'ajoute. Sinon, une
 * fiche est créée — titre tiré du nom, famille de l'extension, catégorie devinée —, et si
 * un document du même nom (marques de version ôtées) existe déjà, il est noté comme sa
 * version précédente probable, à confirmer depuis la fiche.
 */

import type { FileSystem } from '../../core/ports'
import { readYamlFrontmatter, type YamlReader } from '../../core/yaml'
import { fingerprintOf } from './hash'
import { ghostContent, ghostTarget, readGhost, type LibraryGhost } from './ghosts'
import { CATEGORY_TYPER, guessDocCategory, guessDocDate, type KnownIssuer, type KnownTag, type PieceTyper, guessIdentity, guessIssuer, guessTags, guessTitle, type DocIdentity } from './identity'
import { detectLanguage, type LanguageCode } from './language'
import { MAIN_SHELF, type Shelf } from './shelves'
import {
  baseName,
  familyOf,
  readRecord,
  recordContent,
  titleFromName,
  readTextVersion,
  TEXT_VERSIONS_FOLDER,
  textVersionContent,
  transcriptBlockOf,
  versionKey,
  withTranscript,
  type DocFamily,
  type DocOrigin,
  type LibraryDoc,
  type TextVersion,
  type Transcript
} from './model'

/** Le sous-dossier des fichiers copiés, et celui des documents retirés : jamais parcourus comme des fiches. */
export const FILES_FOLDER = '_fichiers'
export const SET_ASIDE_FOLDER = '_retirés'
/** Le dossier de dépôt : ce qu'on y pose (explorateur, synchronisation) entre dans la bibliothèque. */
export const INBOX_FOLDER = 'À verser'

export interface StoreDeps {
  fs: FileSystem
  yaml: YamlReader
  folder(): string
  today(): string
  /** L'intitulé de la section des notes de l'utilisateur, dans sa langue. */
  notesHeading(): string
  /** Des dossiers à ne pas parcourir comme des fiches de documents (ceux des prompts, des personas). */
  skip?(): readonly string[]
  /** Les bibliothèques de documents (la principale d'abord) ; sinon, la seule : le dossier. */
  shelves?(): readonly Shelf[]
  /** Le dossier où verser, sans lieu précis : la racine de la bibliothèque par défaut. */
  target?(): string
  /**
   * Le texte d'un fichier (la lecture de fichiers) : `null` quand il n'est pas lu (format non
   * lu, illisible) ; absent, rien n'est lu. Pour deviner sa langue.
   */
  textOf?(name: string, bytes: Uint8Array): Promise<string | null>
  /** Les étiquettes de la liste (nom, autres formes) : celles d'un document y sont ramenées. */
  tags?(): Promise<readonly KnownTag[]>
  /** Les émetteurs de la liste (code, nom, autres noms) : l'émetteur d'un document y est reconnu. */
  issuers?(): Promise<readonly KnownIssuer[]>
  /** Transcrire un fichier (la lecture de fichiers) : son texte, ou pourquoi il n'y en a pas ; absent, rien n'est transcrit. */
  transcribe?(name: string, bytes: Uint8Array): Promise<Transcript | null>
  /** Le texte extrait, tel qu'écrit dans la fiche : son titre, son encadré, son texte (dans la langue) ; une version (relue par l'IA…), dite dans l'encadré. */
  transcriptBlock?(transcript: Transcript, version?: TextVersion): string
  /** Les types de pièce (le module Typage des pièces) ; absent : les catégories de la bibliothèque. */
  typer?(): PieceTyper
  /** La ligne de la note d'un fantôme, dans la langue : où est le document (`link`), dans quel lieu (`where`). */
  ghostLine?(link: string, where: string): string
}

/** Un fantôme, et le document qu'il montre (aucun quand il n'est plus là). */
export interface GhostEntry {
  ghost: LibraryGhost
  doc: LibraryDoc | undefined
}

/** Un fichier à verser : venu de l'ordinateur (ses octets) ou déjà dans le coffre (son chemin). */
export interface PourItem {
  name: string
  bytes?: Uint8Array
  /** Déjà dans le coffre : il y reste, la fiche le désigne. */
  path?: string
  /** Sa catégorie (le type d'une pièce), quand celui qui verse la connaît. */
  category?: string
  /** Déjà déplacé dans les fichiers de la bibliothèque (le dossier de dépôt) : il lui appartient. */
  owned?: boolean
}

export interface PourOptions {
  /** La catégorie à donner (un type de pièce) ; sinon devinée au nom. */
  category?: string
  /** Le dossier où ranger les fiches (une bibliothèque, un répertoire) ; sinon la bibliothèque par défaut. */
  folder?: string
  /**
   * Déposé soi-même dans un lieu : un document déjà là, ailleurs, peut y laisser un fantôme
   * (proposé après le versement). Pas pour les dépôts des autres modules.
   */
  ghosts?: boolean
  /**
   * Repérer, à l'entrée, les nouvelles versions probables (oui, par défaut). Non quand c'est
   * son workflow système qui s'en charge, après le versement (`markLikelyVersions`).
   */
  detectVersions?: boolean
}

export interface PourReport {
  /** Les documents entrés dans la bibliothèque. */
  added: LibraryDoc[]
  /** Ceux qui y étaient déjà (même fichier) : leur origine ajoutée. */
  already: LibraryDoc[]
  /** Le dossier où ce versement range ses fiches (une bibliothèque, un répertoire). */
  folder: string
  /** Les noms qui n'ont pas pu être versés (fichier illisible). */
  failed: string[]
}

const safeName = (name: string): string =>
  name
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'Document'

const sameOrigin = (a: DocOrigin, b: DocOrigin): boolean => a.module === b.module && a.label === b.label && (a.link ?? '') === (b.link ?? '')

/** La clé de version d'un fichier, sans le « (2) » qu'ajoute une copie faite sous un nom déjà pris. */
const nameKey = (path: string): string => versionKey(baseName(path).replace(/ \(\d+\)(?=\.[^.]+$|$)/, ''))

/**
 * La version précédente probable d'un document : même famille, même nom une fois les marques
 * de version ôtées, d'autres octets — la plus récente. Ceux d'un même versement (`batch`) n'en
 * sont pas : deux fichiers du même nom y sont deux formats d'un document, pas deux versions.
 */
function likelyPreviousOf(doc: Pick<LibraryDoc, 'record' | 'file' | 'family' | 'hash'>, known: readonly LibraryDoc[], batch: ReadonlySet<string>): LibraryDoc | undefined {
  const key = nameKey(doc.file)
  return known
    .filter((other) => other.record !== doc.record && !batch.has(other.record) && other.family === doc.family && other.hash !== doc.hash && nameKey(other.file) === key)
    .sort((a, b) => b.added.localeCompare(a.added))[0]
}

/** Les champs d'une fiche dont on relance la recherche dans le document (la référence, l'édition, la révision : ensemble). */
export type ResearchField = 'title' | 'language' | 'identity' | 'reference' | 'edition' | 'revision' | 'date' | 'category' | 'issuer' | 'tags'

/**
 * Ce que relancer la recherche d'un champ peut changer dans sa fiche — rien d'autre : la
 * référence seule ne touche ni l'édition ni la révision (« Référence et version » : les trois).
 */
export const RESEARCH_KEYS: Readonly<Record<ResearchField, readonly (keyof LibraryDoc)[]>> = {
  title: ['title', 'titleToConfirm', 'titleProbable', 'titleByAi'],
  language: ['language', 'languageToConfirm', 'languageProbable', 'languageByAi'],
  identity: ['reference', 'edition', 'revision', 'identityToConfirm', 'identityByAi'],
  reference: ['reference', 'identityToConfirm', 'identityByAi'],
  edition: ['edition', 'identityToConfirm', 'identityByAi'],
  revision: ['revision', 'identityToConfirm', 'identityByAi'],
  date: ['date', 'dateToConfirm', 'dateProbable', 'dateByAi'],
  category: ['category', 'categoryToConfirm', 'categoryProbable', 'categoryByAi'],
  issuer: ['issuer', 'issuerToConfirm', 'issuerProbable', 'issuerByAi'],
  tags: ['tags', 'tagsToConfirm', 'tagsProbable', 'tagsByAi']
}

export class LibraryStore {
  constructor(private readonly deps: StoreDeps) {}

  get root(): string {
    return this.deps.folder()
  }

  /** Un chemin libre : « nom.ext », sinon « nom (2).ext », « nom (3).ext »… */
  private async free(path: string): Promise<string> {
    if (!(await this.deps.fs.exists(path))) return path
    const dot = path.lastIndexOf('.')
    const slash = path.lastIndexOf('/')
    const [stem, ext] = dot > slash ? [path.slice(0, dot), path.slice(dot)] : [path, '']
    for (let index = 2; ; index++) {
      const candidate = `${stem} (${index})${ext}`
      if (!(await this.deps.fs.exists(candidate))) return candidate
    }
  }

  /**
   * La langue d'un document, de son texte : sûre, elle est donnée ; sinon (texte trop court,
   * partagé, ou pas lu) elle est **à confirmer**, avec la plus probable s'il y en a une. Une
   * image n'a pas de langue à confirmer.
   */
  private async languageOf(name: string, family: DocFamily, bytes: Uint8Array): Promise<Pick<LibraryDoc, 'language' | 'languageToConfirm' | 'languageProbable'>> {
    return family === 'image' ? {} : this.languageOfText(await this.readText(name, bytes))
  }

  /** Le texte d'un fichier (la lecture de fichiers) ; `null` s'il n'est pas lu. */
  private async readText(name: string, bytes: Uint8Array): Promise<string | null> {
    try {
      return (await this.deps.textOf?.(name, bytes)) ?? null
    } catch {
      return null
    }
  }

  /**
   * Ce qu'un document dit de lui à son entrée, son texte lu une fois : sa **langue** et sa
   * **référence**, son **édition**, sa **révision** (première passe, sans IA). Pas sûres :
   * à confirmer — une seconde passe, avec l'IA, peut trancher. Une image : rien.
   */
  private async readIdentity(name: string, family: DocFamily, bytes: Uint8Array, given = '', preread?: string | null): Promise<Partial<LibraryDoc>> {
    if (family === 'image') return {}
    // Déjà lu (sa transcription) : pas une seconde fois.
    const text = preread !== undefined ? preread : await this.readText(name, bytes)
    // La catégorie : donnée par celui qui dépose, dite par le document, ou le nom et le texte d'accord : sûre ; sinon à confirmer.
    const sorted = guessDocCategory(text ?? '', name, given, this.deps.typer?.())
    const category: Partial<LibraryDoc> = sorted.sure
      ? { category: sorted.category }
      : { category: sorted.category, categoryToConfirm: true, ...(sorted.probable ? { categoryProbable: sorted.probable } : {}) }
    const identity = guessIdentity(text ?? '', name)
    // Le titre : dit sûrement par le document, il remplace celui du nom du fichier ; sinon, à confirmer (avec le probable lu).
    const titled = guessTitle(text ?? '')
    const fromName = titleFromName(name)
    const title: Partial<LibraryDoc> = titled.sure
      ? { title: titled.title }
      : { titleToConfirm: true, ...(titled.title && titled.title.toLowerCase() !== fromName.toLowerCase() ? { titleProbable: titled.title } : {}) }
    // L'émetteur : dit sûrement par le document, il est donné ; sinon, à confirmer (avec le probable lu).
    const issued = guessIssuer(text ?? '', (await this.deps.issuers?.()) ?? [])
    const issuer: Partial<LibraryDoc> = issued.sure ? { issuer: issued.issuer } : { issuerToConfirm: true, ...(issued.issuer ? { issuerProbable: issued.issuer } : {}) }
    // Les étiquettes : dites par le document, données ; sinon à confirmer (avec celles que le texte suggère).
    const tagged = guessTags(text ?? '', (await this.deps.tags?.()) ?? [])
    const tags: Partial<LibraryDoc> = tagged.sure ? { tags: tagged.tags } : { tagsToConfirm: true, ...(tagged.tags.length ? { tagsProbable: tagged.tags } : {}) }
    // La date : dite par le document (ou le nom et le texte d'accord), donnée ; sinon à confirmer (avec celle lue).
    const dated = guessDocDate(text ?? '', name)
    const date: Partial<LibraryDoc> = dated.sure ? { date: dated.date } : { dateToConfirm: true, ...(dated.date ? { dateProbable: dated.date } : {}) }
    return {
      ...title,
      ...issuer,
      ...category,
      ...tags,
      ...date,
      ...this.languageOfText(text),
      ...(identity.reference ? { reference: identity.reference } : {}),
      ...(identity.edition ? { edition: identity.edition } : {}),
      ...(identity.revision ? { revision: identity.revision } : {}),
      ...(identity.sure ? {} : { identityToConfirm: true })
    }
  }

  private languageOfText(text: string | null): Pick<LibraryDoc, 'language' | 'languageToConfirm' | 'languageProbable'> {
    const guess = detectLanguage(text ?? '')
    if (guess.language) return { language: guess.language }
    return { languageToConfirm: true, ...(guess.probable ? { languageProbable: guess.probable } : {}) }
  }

  /** Donner sa langue à un document (confirmée par l'utilisateur, ou identifiée par l'IA) ; vide : sans langue, plus à confirmer. */
  async setLanguage(record: string, language: LanguageCode | '', byAi = false): Promise<LibraryDoc | null> {
    const doc = await this.load(record)
    if (!doc) return null
    const next: LibraryDoc = { ...doc }
    delete next.language
    delete next.languageToConfirm
    delete next.languageProbable
    delete next.languageByAi
    if (language) next.language = language
    if (language && byAi) next.languageByAi = true
    await this.save(next)
    return next
  }

  /**
   * Sa référence et sa version, données (par l'IA, ou confirmées) : plus à confirmer. Rien de
   * donné (`null`) : celles qu'il a sont confirmées telles quelles.
   */
  async setIdentity(record: string, identity: DocIdentity | null, byAi = false): Promise<LibraryDoc | null> {
    const doc = await this.load(record)
    if (!doc) return null
    const next: LibraryDoc = { ...doc, ...(identity ?? {}) }
    delete next.identityToConfirm
    delete next.identityByAi
    if (byAi) next.identityByAi = true
    await this.save(next)
    return next
  }

  /** Son titre, donné (par l'IA, ou confirmé) : plus à confirmer. Rien de donné (`null`) : celui qu'il a est confirmé. */
  async setTitle(record: string, title: string | null, byAi = false): Promise<LibraryDoc | null> {
    const doc = await this.load(record)
    if (!doc) return null
    const next: LibraryDoc = { ...doc, ...(title?.trim() ? { title: title.trim() } : {}) }
    delete next.titleToConfirm
    delete next.titleProbable
    delete next.titleByAi
    if (byAi) next.titleByAi = true
    await this.save(next)
    return next
  }

  /** Sa date, donnée (par l'IA, ou confirmée ; vide : aucune) : plus à confirmer. `null` : celle qu'il a est confirmée. */
  async setDate(record: string, date: string | null, byAi = false): Promise<LibraryDoc | null> {
    const doc = await this.load(record)
    if (!doc) return null
    const next: LibraryDoc = { ...doc }
    if (date !== null) {
      if (date) next.date = date
      else delete next.date
    }
    delete next.dateToConfirm
    delete next.dateProbable
    delete next.dateByAi
    if (byAi) next.dateByAi = true
    await this.save(next)
    return next
  }

  /** Ses étiquettes, données (par l'IA, ou confirmées ; vide : aucune) : plus à confirmer. `null` : celles qu'il a sont confirmées. */
  async setTags(record: string, tags: readonly string[] | null, byAi = false): Promise<LibraryDoc | null> {
    const doc = await this.load(record)
    if (!doc) return null
    const next: LibraryDoc = { ...doc, ...(tags === null ? {} : { tags: [...tags] }) }
    delete next.tagsToConfirm
    delete next.tagsProbable
    delete next.tagsByAi
    if (byAi) next.tagsByAi = true
    await this.save(next)
    return next
  }

  /** Sa catégorie, donnée (par l'IA, ou confirmée ; vide : aucune) : plus à confirmer. `null` : celle qu'il a est confirmée. */
  async setCategory(record: string, category: string | null, byAi = false): Promise<LibraryDoc | null> {
    const doc = await this.load(record)
    if (!doc) return null
    const next: LibraryDoc = { ...doc, ...(category === null ? {} : { category: category.trim() }) }
    delete next.categoryToConfirm
    delete next.categoryProbable
    delete next.categoryByAi
    if (byAi) next.categoryByAi = true
    await this.save(next)
    return next
  }

  /** Son émetteur, donné (par l'IA, ou confirmé ; vide : aucun) : plus à confirmer. `null` : celui qu'il a est confirmé. */
  async setIssuer(record: string, issuer: string | null, byAi = false): Promise<LibraryDoc | null> {
    const doc = await this.load(record)
    if (!doc) return null
    const next: LibraryDoc = { ...doc, ...(issuer === null ? {} : { issuer: issuer.trim() }) }
    delete next.issuerToConfirm
    delete next.issuerProbable
    delete next.issuerByAi
    if (byAi) next.issuerByAi = true
    await this.save(next)
    return next
  }

  /** Le texte du fichier d'un document (la lecture de fichiers) ; `null` s'il n'est pas lu. */
  async textOfRecord(record: string): Promise<string | null> {
    const doc = await this.load(record)
    if (!doc || !(await this.deps.fs.exists(doc.file))) return null
    try {
      return (await this.deps.textOf?.(doc.file, new Uint8Array(await this.deps.fs.readBinary(doc.file)))) ?? null
    } catch {
      return null
    }
  }

  /**
   * Un type de pièce ajouté à la liste : les documents qui avaient cette valeur (une ancienne
   * catégorie, sans accents ni casse) prennent son code — comme type, ou comme type proposé.
   * Rend combien ont changé.
   */
  async adoptCategory(value: string, code: string, except = ''): Promise<number> {
    const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
    const wanted = fold(value)
    if (!wanted || !code) return 0
    let changed = 0
    for (const doc of await this.all()) {
      if (doc.record === except) continue
      const category = fold(doc.category) === wanted
      const probable = !!doc.categoryProbable && fold(doc.categoryProbable) === wanted
      if (!category && !probable) continue
      await this.save({ ...doc, ...(category ? { category: code } : {}), ...(probable ? { categoryProbable: code } : {}) })
      changed++
    }
    return changed
  }

  /**
   * Un émetteur ajouté à la liste : les documents qui portaient son nom (tel quel, sans
   * accents ni casse) prennent son code — comme émetteur, ou comme émetteur proposé. Rend
   * combien ont changé.
   */
  async adoptIssuer(name: string, code: string, except = ''): Promise<number> {
    const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
    const wanted = fold(name)
    if (!wanted || !code) return 0
    let changed = 0
    for (const doc of await this.all()) {
      if (doc.record === except) continue
      const issuer = fold(doc.issuer) === wanted
      const probable = !!doc.issuerProbable && fold(doc.issuerProbable) === wanted
      if (!issuer && !probable) continue
      await this.save({ ...doc, ...(issuer ? { issuer: code } : {}), ...(probable ? { issuerProbable: code } : {}) })
      changed++
    }
    return changed
  }

  /**
   * **Renommer le fichier** d'un document, dans son dossier : `name` sans extension (celle du
   * fichier est gardée). Puis les liens vers lui, dans tout le coffre, suivent — sa fiche, la
   * note de sa pièce, celle de l'analyse… : `[[chemin]]`, `[[chemin|texte]]`, `![[…]]`,
   * `[texte](chemin)`, et `[[nom]]` quand ce nom ne désignait que lui. (Obsidian le fait déjà
   * selon ses réglages : ce qu'il a fait n'est plus à faire.) Rend la fiche et le nombre de
   * notes mises à jour ; `invalid` (un nom vide ou interdit), `exists` (déjà pris).
   */
  async renameFile(record: string, name: string): Promise<{ doc: LibraryDoc; notes: number } | 'invalid' | 'exists' | null> {
    const { fs } = this.deps
    const doc = await this.load(record)
    if (!doc || !(await fs.exists(doc.file))) return null
    const extension = /\.[^./]+$/.exec(doc.file)?.[0] ?? ''
    const wanted = name.trim().replace(/\s+/g, ' ')
    const stem = extension && wanted.toLowerCase().endsWith(extension.toLowerCase()) ? wanted.slice(0, -extension.length).trim() : wanted
    if (!stem || /[\\/:*?"<>|#^[\]]/.test(stem) || stem.startsWith('.')) return 'invalid'
    const folder = doc.file.includes('/') ? doc.file.slice(0, doc.file.lastIndexOf('/')) : ''
    const target = `${folder ? `${folder}/` : ''}${stem}${extension}`
    if (target === doc.file) return { doc, notes: 0 }
    if (target.toLowerCase() !== doc.file.toLowerCase() && (await fs.exists(target))) return 'exists'
    const from = doc.file
    await fs.rename(from, target)
    const moved: LibraryDoc = { ...doc, file: target }
    await this.save(moved)
    const notes = await this.relink(from, target)
    return { doc: moved, notes }
  }

  /** Les liens vers un fichier, dans les notes du coffre (hors dossiers cachés), suivent son nouveau chemin ; rend combien de notes ont changé. */
  private async relink(from: string, to: string): Promise<number> {
    const { fs } = this.deps
    // L'index du coffre ; sans lui, ses dossiers parcourus.
    const files: string[] = []
    const walk = async (folder: string): Promise<void> => {
      const listed = await fs.list(folder)
      files.push(...listed.files)
      for (const sub of listed.folders) if (!baseName(sub).startsWith('.')) await walk(sub)
    }
    if (fs.allFiles) files.push(...(await fs.allFiles()))
    else await walk('')
    const notes = files.filter((file) => file.endsWith('.md'))
    const oldName = baseName(from)
    // Le nom seul ne désignait que lui : aucun autre fichier ne le porte.
    const nameAlone = !files.some((file) => file !== to && baseName(file) === oldName)
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const targets = [from, ...(nameAlone ? [oldName] : [])]
    const wiki = new RegExp(`(!?\\[\\[)(${targets.map(escape).join('|')})(?=[\\]|#])`, 'g')
    const markdown = new RegExp(`(\\]\\()(${[from, encodeURI(from), from.replace(/ /g, '%20')].map(escape).join('|')})(?=[)#])`, 'g')
    let changed = 0
    for (const note of notes) {
      const text = await fs.readText(note)
      const next = text.replace(wiki, (_all, open: string, found: string) => `${open}${found === from ? to : baseName(to)}`).replace(markdown, (_all, open: string) => `${open}${encodeURI(to)}`)
      if (next === text) continue
      await fs.writeText(note, next)
      changed++
    }
    return changed
  }

  /**
   * **Relancer la recherche** d'un champ dans le document (la première passe, sans IA), son
   * texte relu : trouvé sûrement, il est donné et confirmé ; sinon il est à confirmer, avec
   * ce qui a été lu (probable) — la valeur qu'il a reste. Rend la fiche, et si c'est sûr ;
   * `null` sans fiche.
   */
  async researchField(record: string, field: ResearchField): Promise<{ doc: LibraryDoc; sure: boolean } | null> {
    const doc = await this.load(record)
    if (!doc) return null
    const text = doc.family === 'image' ? null : await this.textOfRecord(record)
    const name = baseName(doc.file)
    const next: LibraryDoc = { ...doc }
    let sure = false
    if (field === 'language') {
      delete next.language
      delete next.languageToConfirm
      delete next.languageProbable
      delete next.languageByAi
      Object.assign(next, this.languageOfText(text))
      sure = !!next.language
    } else if (field === 'title') {
      const found = guessTitle(text ?? '')
      delete next.titleToConfirm
      delete next.titleProbable
      delete next.titleByAi
      sure = found.sure
      if (found.sure) next.title = found.title
      else Object.assign(next, { titleToConfirm: true }, found.title && found.title.toLowerCase() !== doc.title.toLowerCase() ? { titleProbable: found.title } : {})
    } else if (field === 'identity') {
      const found = guessIdentity(text ?? '', name)
      delete next.identityToConfirm
      delete next.identityByAi
      sure = found.sure
      if (found.reference) next.reference = found.reference
      if (found.edition) next.edition = found.edition
      if (found.revision) next.revision = found.revision
      if (!found.sure) next.identityToConfirm = true
    } else if (field === 'reference' || field === 'edition' || field === 'revision') {
      // Ce seul champ : les deux autres restent tels qu'ils sont (changés à la main, peut-être).
      const found = guessIdentity(text ?? '', name)
      sure = found.sure && !!found[field]
      if (found[field]) next[field] = found[field]
      delete next.identityByAi
      if (sure) delete next.identityToConfirm
      else next.identityToConfirm = true
    } else if (field === 'date') {
      const found = guessDocDate(text ?? '', name)
      delete next.dateToConfirm
      delete next.dateProbable
      delete next.dateByAi
      sure = found.sure
      if (found.sure) next.date = found.date
      else Object.assign(next, { dateToConfirm: true }, found.date && found.date !== doc.date ? { dateProbable: found.date } : {})
    } else if (field === 'category') {
      const found = guessDocCategory(text ?? '', name, '', this.deps.typer?.())
      delete next.categoryToConfirm
      delete next.categoryProbable
      delete next.categoryByAi
      sure = found.sure
      if (found.sure) next.category = found.category
      else Object.assign(next, { categoryToConfirm: true }, found.probable && found.probable !== doc.category ? { categoryProbable: found.probable } : {})
    } else if (field === 'issuer') {
      const found = guessIssuer(text ?? '', (await this.deps.issuers?.()) ?? [])
      delete next.issuerToConfirm
      delete next.issuerProbable
      delete next.issuerByAi
      sure = found.sure
      if (found.sure) next.issuer = found.issuer
      else Object.assign(next, { issuerToConfirm: true }, found.issuer && found.issuer !== doc.issuer ? { issuerProbable: found.issuer } : {})
    } else {
      const found = guessTags(text ?? '', (await this.deps.tags?.()) ?? [])
      delete next.tagsToConfirm
      delete next.tagsProbable
      delete next.tagsByAi
      sure = found.sure
      if (found.sure) next.tags = found.tags
      else {
        const fresh = found.tags.filter((tag) => !doc.tags.some((had) => had.toLowerCase() === tag.toLowerCase()))
        Object.assign(next, { tagsToConfirm: true }, fresh.length ? { tagsProbable: fresh } : {})
      }
    }
    await this.save(next)
    return { doc: next, sure }
  }

  /** Détecter de nouveau la langue d'un document, de son fichier ; rend la fiche, ou `null`. */
  async detectLanguageOf(record: string): Promise<LibraryDoc | null> {
    const doc = await this.load(record)
    if (!doc || !(await this.deps.fs.exists(doc.file))) return null
    const found = await this.languageOf(doc.file, doc.family, new Uint8Array(await this.deps.fs.readBinary(doc.file)))
    const next: LibraryDoc = { ...doc }
    delete next.language
    delete next.languageToConfirm
    delete next.languageProbable
    delete next.languageByAi
    await this.save({ ...next, ...found })
    return { ...next, ...found }
  }

  /** Les bibliothèques de documents : celles données, sinon la seule (son dossier). */
  shelves(): readonly Shelf[] {
    return this.deps.shelves?.() ?? [{ id: MAIN_SHELF, name: '', folder: this.root, main: true }]
  }

  /** Le dossier où verser sans lieu précis. */
  get target(): string {
    return this.deps.target?.() ?? this.root
  }

  /** Un sous-dossier à parcourir (ni fichiers, ni retirés, ni dépôt, ni une autre bibliothèque, ni prompts ou personas) ? */
  private walkable(sub: string): boolean {
    const name = baseName(sub)
    if (name.startsWith('_') || name.startsWith('.') || name === INBOX_FOLDER) return false
    if ((this.deps.skip?.() ?? []).includes(sub)) return false
    return !this.shelves().some((shelf) => shelf.folder === sub)
  }

  /** Les répertoires d'un dossier d'une bibliothèque (leurs chemins), par nom. */
  async subdirectories(folder: string): Promise<string[]> {
    const { fs } = this.deps
    if (!(await fs.exists(folder))) return []
    return (await fs.list(folder)).folders.filter((sub) => this.walkable(sub)).sort((a, b) => baseName(a).localeCompare(baseName(b), 'fr'))
  }

  /** Les fiches de toutes les bibliothèques, partout sous leur dossier (sauf leurs fichiers et leurs retirés) ; chacune sait où elle est. */
  async all(): Promise<LibraryDoc[]> {
    return (await this.scan()).docs
  }

  /** Les fiches et les fantômes de toutes les bibliothèques, en un parcours. */
  private async scan(): Promise<{ docs: LibraryDoc[]; ghosts: LibraryGhost[] }> {
    const { fs, yaml } = this.deps
    const docs: LibraryDoc[] = []
    const ghosts: LibraryGhost[] = []
    const walk = async (shelf: Shelf, folder: string, directory: string): Promise<void> => {
      if (!(await fs.exists(folder))) return
      const listing = await fs.list(folder)
      for (const path of listing.files.filter((each) => each.endsWith('.md'))) {
        const data = readYamlFrontmatter(yaml, await fs.readText(path)).data
        const doc = readRecord(path, data)
        if (doc) docs.push({ ...doc, shelf: shelf.id, directory })
        const ghost = doc ? null : readGhost(path, data)
        if (ghost) ghosts.push({ ...ghost, shelf: shelf.id, directory })
      }
      for (const sub of listing.folders) if (this.walkable(sub)) await walk(shelf, sub, directory ? `${directory}/${baseName(sub)}` : baseName(sub))
    }
    for (const shelf of this.shelves()) await walk(shelf, shelf.folder, '')
    return { docs, ghosts }
  }

  /** Les fantômes de toutes les bibliothèques, chacun avec le document qu'il montre. */
  async ghosts(): Promise<GhostEntry[]> {
    const { docs, ghosts } = await this.scan()
    return ghosts.map((ghost) => ({ ghost, doc: ghostTarget(ghost, docs) }))
  }

  /** Les fantômes d'un document (par sa fiche, ou son empreinte). */
  async ghostsOf(doc: Pick<LibraryDoc, 'record' | 'hash'>): Promise<GhostEntry[]> {
    return (await this.ghosts()).filter((entry) => entry.doc?.record === doc.record || (!entry.doc && !!doc.hash && entry.ghost.hash === doc.hash))
  }

  /**
   * Laisser un fantôme d'un document dans un dossier (une bibliothèque, un répertoire) : pas
   * là où il est rangé, ni là où il en a déjà un. Rend la note du fantôme, ou `null`.
   */
  async addGhost(doc: LibraryDoc, folder: string, where = ''): Promise<string | null> {
    const { fs } = this.deps
    if (doc.record.slice(0, doc.record.lastIndexOf('/')) === folder) return null
    if ((await this.ghostsOf(doc)).some(({ ghost }) => ghost.path.slice(0, ghost.path.lastIndexOf('/')) === folder)) return null
    await fs.ensureFolder(folder)
    const path = await this.free(`${folder}/${baseName(doc.record)}`)
    await fs.writeText(path, ghostContent(doc, (link) => this.deps.ghostLine?.(link, where) ?? `${link} — ${where}`))
    return path
  }

  /** Retirer un fantôme : sa note mise de côté dans les retirés de sa bibliothèque (rien n'est effacé ; le document reste). */
  async removeGhost(path: string): Promise<boolean> {
    const { fs } = this.deps
    if (!(await fs.exists(path))) return false
    const shelf = this.shelves().find((each) => path.startsWith(`${each.folder}/`)) ?? this.shelves()[0]!
    const aside = `${shelf.folder}/${SET_ASIDE_FOLDER}`
    await fs.ensureFolder(aside)
    await fs.rename(path, await this.free(`${aside}/${baseName(path)}`))
    return true
  }

  /**
   * Déplacer la fiche d'un document dans un autre dossier (une bibliothèque, un répertoire) :
   * son fichier ne bouge pas ; les documents qui la donnaient pour version précédente suivent.
   * Rend son nouveau chemin.
   */
  async move(record: string, folder: string): Promise<string | null> {
    const { fs } = this.deps
    const doc = await this.load(record)
    if (!doc) return null
    if (record.slice(0, record.lastIndexOf('/')) === folder) return record
    // Ses fantômes : celui du dossier où il arrive n'a plus rien à dire (retiré d'abord : sa place se libère) ; les autres le suivent.
    const ghosts = await this.ghostsOf(doc)
    const inPlace = (path: string) => path.slice(0, path.lastIndexOf('/')) === folder
    for (const { ghost } of ghosts) if (inPlace(ghost.path)) await this.removeGhost(ghost.path)
    await fs.ensureFolder(folder)
    const target = await this.free(`${folder}/${baseName(record)}`)
    await fs.rename(record, target)
    for (const { ghost } of ghosts) if (!inPlace(ghost.path)) await fs.writeText(ghost.path, (await fs.readText(ghost.path)).split(`[[${record}`).join(`[[${target}`))
    for (const other of await this.all()) {
      if (other.previous !== record && other.likelyPrevious !== record) continue
      await this.save({ ...other, ...(other.previous === record ? { previous: target } : {}), ...(other.likelyPrevious === record ? { likelyPrevious: target } : {}) })
    }
    return target
  }

  async load(record: string): Promise<LibraryDoc | null> {
    const { fs, yaml } = this.deps
    if (!(await fs.exists(record))) return null
    return readRecord(record, readYamlFrontmatter(yaml, await fs.readText(record)).data)
  }

  /** Réécrire l'en-tête d'une fiche, sa section de notes gardée. */
  /** La transcription d'un fichier ; `null` sans lecture de fichiers. */
  private async transcribeBytes(name: string, family: DocFamily, bytes: Uint8Array): Promise<Transcript | null> {
    if (!this.deps.transcribe) return null
    if (family === 'image') return { state: 'image', text: '' }
    try {
      return await this.deps.transcribe(name, bytes)
    } catch {
      return { state: 'illisible', text: '' }
    }
  }

  /** Écrire (réécrire) le texte extrait dans la fiche, entre ses marques ; le reste de la note ne bouge pas. */
  private async writeTranscript(doc: LibraryDoc, transcript: Transcript, version?: TextVersion): Promise<void> {
    const { fs, yaml } = this.deps
    if (!this.deps.transcriptBlock || !(await fs.exists(doc.record))) return
    const body = readYamlFrontmatter(yaml, await fs.readText(doc.record)).body
    await fs.writeText(doc.record, recordContent(doc, this.deps.notesHeading(), withTranscript(body, this.deps.transcriptBlock(transcript, version))))
  }

  /** Le dossier des versions du texte d'un document : d'après l'empreinte de son fichier (il suit la fiche, déplacée ou renommée). */
  private textVersionsFolder(doc: LibraryDoc): string {
    return `${this.root}/${TEXT_VERSIONS_FOLDER}/${(doc.hash || baseName(doc.record)).slice(0, 16)}`
  }

  /** Les versions du texte d'un document, de la première à la dernière ; aucune tant que l'IA ne l'a pas relu. */
  async textVersions(record: string): Promise<TextVersion[]> {
    const { fs, yaml } = this.deps
    const doc = await this.load(record)
    if (!doc) return []
    const folder = this.textVersionsFolder(doc)
    if (!(await fs.exists(folder))) return []
    const versions: TextVersion[] = []
    for (const path of (await fs.list(folder)).files.filter((each) => each.endsWith('.md'))) {
      const { data, body } = readYamlFrontmatter(yaml, await fs.readText(path))
      const version = readTextVersion(path, data, body)
      if (version) versions.push(version)
    }
    return versions.sort((a, b) => a.number - b.number)
  }

  /**
   * Une **nouvelle version du texte** (relue par l'IA, extraite de nouveau) : la première fois,
   * le texte que montrait la fiche est d'abord gardé (« Texte 1 », extrait du fichier). La fiche
   * montre la nouvelle ; l'édition et la révision du document ne changent pas.
   */
  async addTextVersion(record: string, text: string, about: Pick<TextVersion, 'origin'> & Partial<Pick<TextVersion, 'model' | 'prompt' | 'persona' | 'skill' | 'kept'>>): Promise<TextVersion | null> {
    const { fs } = this.deps
    const doc = await this.load(record)
    if (!doc) return null
    const folder = this.textVersionsFolder(doc)
    let versions = await this.textVersions(record)
    await fs.ensureFolder(folder)
    if (!versions.length) {
      const first = await this.transcriptText(record)
      if (first !== null) {
        const kept: Omit<TextVersion, 'path'> = { number: 1, origin: 'extraction', date: doc.added || this.deps.today(), text: first }
        await fs.writeText(`${folder}/Texte 1.md`, textVersionContent(kept, record))
        versions = [{ ...kept, path: `${folder}/Texte 1.md` }]
      }
    }
    const number = (versions.at(-1)?.number ?? 0) + 1
    const version: TextVersion = { ...about, number, date: this.deps.today(), text: text.trim(), path: `${folder}/Texte ${number}.md` }
    await fs.writeText(version.path, textVersionContent(version, record))
    const next: LibraryDoc = { ...doc, reading: 'lue', characters: version.text.length, textVersion: number }
    await this.save(next)
    await this.writeTranscript(next, { state: 'lue', text: version.text }, version)
    return version
  }

  /**
   * **Supprimer une version du texte**, et sa note (à la corbeille, quand la plateforme en a
   * une ; sinon mise de côté). Celle que montrait la fiche : la dernière qui reste la remplace
   * (aucune : le texte reste sur la fiche, sans version). Les autres ne changent pas.
   */
  async deleteTextVersion(record: string, number: number): Promise<{ removed: TextVersion; shown: TextVersion | null } | null> {
    const { fs } = this.deps
    const doc = await this.load(record)
    const versions = await this.textVersions(record)
    const removed = versions.find((each) => each.number === number)
    if (!doc || !removed) return null
    if (fs.trash) await fs.trash(removed.path)
    else {
      const shelf = this.shelves().find((each) => record.startsWith(`${each.folder}/`)) ?? this.shelves()[0]!
      const aside = `${shelf.folder}/${SET_ASIDE_FOLDER}`
      await fs.ensureFolder(aside)
      await fs.rename(removed.path, await this.free(`${aside}/${baseName(removed.path)}`))
    }
    const left = versions.filter((each) => each !== removed)
    const shown = doc.textVersion ?? versions.at(-1)?.number
    if (shown !== number) return { removed, shown: left.find((each) => each.number === shown) ?? null }
    const latest = left.at(-1) ?? null
    if (latest) return { removed, shown: await this.showTextVersion(record, latest.number) }
    const next: LibraryDoc = { ...doc }
    delete next.textVersion
    await this.save(next)
    await this.writeTranscript(next, { state: 'lue', text: removed.text })
    return { removed, shown: null }
  }

  /** Montrer de nouveau une version gardée du texte (la fiche la montre ; rien n'est effacé). */
  async showTextVersion(record: string, number: number): Promise<TextVersion | null> {
    const doc = await this.load(record)
    const version = (await this.textVersions(record)).find((each) => each.number === number)
    if (!doc || !version) return null
    const next: LibraryDoc = { ...doc, reading: 'lue', characters: version.text.length, textVersion: number }
    await this.save(next)
    await this.writeTranscript(next, { state: 'lue', text: version.text }, version)
    return version
  }

  /** (Re)transcrire le fichier d'un document dans sa fiche ; rend la fiche et la transcription, ou `null` (pas de fichier, pas de lecture). */
  async transcribe(record: string): Promise<{ doc: LibraryDoc; transcript: Transcript } | null> {
    const { fs } = this.deps
    const doc = await this.load(record)
    if (!doc || !(await fs.exists(doc.file))) return null
    const transcript = await this.transcribeBytes(baseName(doc.file), doc.family, new Uint8Array(await fs.readBinary(doc.file)))
    if (!transcript) return null
    // Des versions déjà gardées (relu par l'IA…) : le texte extrait de nouveau en est une de plus.
    if (transcript.state === 'lue' && (await this.textVersions(record)).length) {
      await this.addTextVersion(record, transcript.text, { origin: 'extraction' })
      return { doc: (await this.load(record)) ?? doc, transcript }
    }
    const next: LibraryDoc = { ...doc, reading: transcript.state, characters: transcript.text.length }
    delete next.textVersion
    await this.save(next)
    await this.writeTranscript(next, transcript)
    return { doc: next, transcript }
  }

  /** Le texte extrait écrit dans la fiche (sans son titre ni son encadré) ; `null` s'il n'y en a pas. */
  async transcriptText(record: string): Promise<string | null> {
    const { fs, yaml } = this.deps
    if (!(await fs.exists(record))) return null
    const block = transcriptBlockOf(readYamlFrontmatter(yaml, await fs.readText(record)).body)
    if (block === null) return null
    const lines = block.split('\n')
    // Son titre (« ## Texte extrait »), puis son encadré (« > … »), puis le texte.
    let at = lines[0]?.startsWith('## ') ? 1 : 0
    while (at < lines.length && (lines[at]!.startsWith('>') || !lines[at]!.trim())) at++
    return lines.slice(at).join('\n').trim()
  }

  async save(doc: LibraryDoc): Promise<void> {
    const { fs, yaml } = this.deps
    const body = (await fs.exists(doc.record)) ? readYamlFrontmatter(yaml, await fs.readText(doc.record)).body : undefined
    await fs.writeText(doc.record, recordContent(doc, this.deps.notesHeading(), body))
  }

  /** Verser des fichiers dans la bibliothèque, avec leur origine. */
  async pour(items: readonly PourItem[], origin: DocOrigin, options: PourOptions = {}): Promise<PourReport> {
    const { fs } = this.deps
    const report: PourReport = { added: [], already: [], failed: [], folder: options.folder ?? this.target }
    const known = await this.all()
    // Ceux de ce même versement : deux fichiers du même nom y sont deux formats d'un document, pas deux versions.
    const batch = new Set<string>()
    for (const item of items) {
      let bytes: Uint8Array
      try {
        bytes = item.bytes ?? new Uint8Array(await fs.readBinary(item.path!))
      } catch {
        report.failed.push(item.name)
        continue
      }
      const hash = await fingerprintOf(bytes)
      // Déjà là (le même fichier, ou les mêmes octets ailleurs) : son origine s'ajoute.
      const existing = known.find((doc) => (item.path && doc.file === item.path) || doc.hash === hash)
      if (existing) {
        const origins = existing.origins.some((each) => sameOrigin(each, origin)) ? existing.origins : [...existing.origins, origin]
        const category = existing.category || item.category || options.category || ''
        if (origins !== existing.origins || category !== existing.category) {
          Object.assign(existing, { origins, category })
          await this.save(existing)
        }
        report.already.push(existing)
        continue
      }
      // Venu de l'ordinateur : copié dans la bibliothèque ; déjà dans le coffre : laissé où il est.
      let file = item.path
      if (!file) {
        file = await this.free(`${this.target}/${FILES_FOLDER}/${safeName(baseName(item.name))}`)
        await fs.writeBinary(file, bytes.slice().buffer)
      }
      const title = titleFromName(item.name)
      const family = familyOf(item.name)
      const record = await this.free(`${options.folder ?? this.target}/${safeName(title)}.md`)
      // Une version précédente probable (le nom du fichier versé fait foi : un fichier copié a pu être renommé).
      const previous = options.detectVersions === false ? undefined : likelyPreviousOf({ record, file: item.name, family, hash }, known, batch)
      // Son texte, transcrit dans sa fiche (comme une pièce d'analyse) — et lu une seule fois.
      const transcript = await this.transcribeBytes(item.name, family, bytes)
      const doc: LibraryDoc = {
        record,
        title,
        file,
        family,
        size: bytes.byteLength,
        hash,
        added: this.deps.today(),
        category: item.category || options.category || (this.deps.typer?.() ?? CATEGORY_TYPER).ofName(item.name),
        reference: '',
        edition: '',
        revision: '',
        issuer: '',
        tags: [],
        origins: [origin],
        ...(previous ? { likelyPrevious: previous.record } : {}),
        copied: !item.path || item.owned === true,
        ...(transcript ? { reading: transcript.state, characters: transcript.text.length } : {}),
        ...(await this.readIdentity(item.name, family, bytes, item.category || options.category || '', transcript ? (transcript.state === 'lue' ? transcript.text : null) : undefined))
      }
      await this.save(doc)
      if (transcript) await this.writeTranscript(doc, transcript)
      known.push(doc)
      batch.add(doc.record)
      report.added.push(doc)
    }
    return report
  }

  /**
   * Repérer les nouvelles versions probables parmi des documents tout juste versés (leurs
   * fiches) : ceux qui n'ont encore ni version précédente ni suggestion. Rend ceux qui en ont
   * reçu une.
   */
  async markLikelyVersions(records: readonly string[]): Promise<LibraryDoc[]> {
    const known = await this.all()
    const batch = new Set(records)
    const marked: LibraryDoc[] = []
    for (const record of records) {
      const doc = known.find((each) => each.record === record)
      if (!doc || doc.previous || doc.likelyPrevious) continue
      const previous = likelyPreviousOf(doc, known, batch)
      if (!previous) continue
      doc.likelyPrevious = previous.record
      await this.save(doc)
      marked.push(doc)
    }
    return marked
  }

  /** Les documents dont le fichier n'est plus dans le coffre (déplacé, renommé, effacé). */
  async missingFiles(): Promise<LibraryDoc[]> {
    const missing: LibraryDoc[] = []
    for (const doc of await this.all()) if (!doc.file || !(await this.deps.fs.exists(doc.file))) missing.push(doc)
    return missing.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  }

  get inbox(): string {
    return `${this.root}/${INBOX_FOLDER}`
  }

  /**
   * Verser ce qui est posé dans le dossier de dépôt (sous-dossiers compris) : un nouveau
   * fichier passe dans `_fichiers` et entre dans la bibliothèque ; un fichier déjà là (mêmes
   * octets) y ajoute son origine et part dans `_retirés` — rien n'est effacé. Le dossier est
   * créé s'il n'existe pas.
   */
  async pourInbox(origin: DocOrigin, options: PourOptions = {}): Promise<PourReport> {
    const { fs } = this.deps
    const report: PourReport = { added: [], already: [], failed: [], folder: options.folder ?? this.target }
    if (!(await fs.exists(this.inbox))) await fs.ensureFolder(this.inbox)
    const files: string[] = []
    const walk = async (folder: string): Promise<void> => {
      const listing = await fs.list(folder)
      files.push(...listing.files)
      for (const sub of listing.folders) await walk(sub)
    }
    await walk(this.inbox)
    if (!files.length) return report
    const known = new Set((await this.all()).map((doc) => doc.hash))
    const fresh: PourItem[] = []
    const twice: { item: PourItem; from: string }[] = []
    for (const path of files.sort()) {
      const name = baseName(path)
      let hash: string
      try {
        hash = await fingerprintOf(new Uint8Array(await fs.readBinary(path)))
      } catch {
        report.failed.push(name)
        continue
      }
      if (known.has(hash)) {
        twice.push({ item: { name, path }, from: path })
        continue
      }
      known.add(hash)
      await fs.ensureFolder(`${this.target}/${FILES_FOLDER}`)
      const target = await this.free(`${this.target}/${FILES_FOLDER}/${safeName(name)}`)
      await fs.rename(path, target)
      fresh.push({ name, path: target, owned: true })
    }
    if (fresh.length) {
      const poured = await this.pour(fresh, origin, options)
      report.added.push(...poured.added)
      report.failed.push(...poured.failed)
    }
    if (twice.length) {
      // Déjà dans la bibliothèque : son origine s'ajoute ; le fichier posé est mis de côté.
      const poured = await this.pour(
        twice.map((each) => each.item),
        origin,
        options
      )
      report.already.push(...poured.already)
      await fs.ensureFolder(`${this.root}/${SET_ASIDE_FOLDER}`)
      for (const each of twice) await fs.rename(each.from, await this.free(`${this.root}/${SET_ASIDE_FOLDER}/${baseName(each.from)}`))
    }
    return report
  }

  /** Relier un document à sa version précédente (ou défaire le lien : `previous` vide). */
  async relate(record: string, previous: string): Promise<LibraryDoc | null> {
    const doc = await this.load(record)
    if (!doc) return null
    const next: LibraryDoc = { ...doc }
    delete next.likelyPrevious
    if (previous) next.previous = previous
    else delete next.previous
    await this.save(next)
    return next
  }

  /** Ce n'est pas une nouvelle version : la suggestion oubliée. */
  async dismissLikely(record: string): Promise<void> {
    const doc = await this.load(record)
    if (!doc?.likelyPrevious) return
    const next = { ...doc }
    delete next.likelyPrevious
    await this.save(next)
  }

  /**
   * Retirer un document : sa fiche (et son fichier, s'il a été copié dans la bibliothèque)
   * mis de côté dans `_retirés` — rien n'est effacé. Un fichier resté à sa place (une pièce
   * d'analyse) n'est pas touché. Les documents qui le donnaient pour version précédente
   * perdent ce lien.
   */
  async setAside(record: string): Promise<boolean> {
    const { fs } = this.deps
    const doc = await this.load(record)
    if (!doc) return false
    // Mis de côté dans les retirés de sa bibliothèque.
    const shelf = this.shelves().find((each) => record.startsWith(`${each.folder}/`)) ?? this.shelves()[0]!
    const aside = `${shelf.folder}/${SET_ASIDE_FOLDER}`
    // Ses fantômes n'ont plus rien à montrer.
    for (const { ghost } of await this.ghostsOf(doc)) await this.removeGhost(ghost.path)
    if (doc.copied && (await fs.exists(doc.file))) await fs.rename(doc.file, await this.free(`${aside}/${baseName(doc.file)}`))
    await fs.rename(record, await this.free(`${aside}/${baseName(record)}`))
    for (const other of await this.all()) {
      if (other.previous !== record && other.likelyPrevious !== record) continue
      const next = { ...other }
      if (next.previous === record) delete next.previous
      if (next.likelyPrevious === record) delete next.likelyPrevious
      await this.save(next)
    }
    return true
  }
}
