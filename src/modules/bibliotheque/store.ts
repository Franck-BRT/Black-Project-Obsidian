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
import { guessDocCategory, guessDocDate, guessIdentity, guessIssuer, guessTags, guessTitle, type DocIdentity } from './identity'
import { detectLanguage, type LanguageCode } from './language'
import { MAIN_SHELF, type Shelf } from './shelves'
import {
  baseName,
  familyOf,
  guessCategory,
  readRecord,
  recordContent,
  titleFromName,
  versionKey,
  type DocFamily,
  type DocOrigin,
  type LibraryDoc
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
  private async readIdentity(name: string, family: DocFamily, bytes: Uint8Array, given = ''): Promise<Partial<LibraryDoc>> {
    if (family === 'image') return {}
    const text = await this.readText(name, bytes)
    // La catégorie : donnée par celui qui dépose, dite par le document, ou le nom et le texte d'accord : sûre ; sinon à confirmer.
    const sorted = guessDocCategory(text ?? '', name, given)
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
    const issued = guessIssuer(text ?? '')
    const issuer: Partial<LibraryDoc> = issued.sure ? { issuer: issued.issuer } : { issuerToConfirm: true, ...(issued.issuer ? { issuerProbable: issued.issuer } : {}) }
    // Les étiquettes : dites par le document, données ; sinon à confirmer (avec celles que le texte suggère).
    const tagged = guessTags(text ?? '')
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
      const doc: LibraryDoc = {
        record,
        title,
        file,
        family,
        size: bytes.byteLength,
        hash,
        added: this.deps.today(),
        category: item.category || options.category || guessCategory(item.name),
        reference: '',
        edition: '',
        revision: '',
        issuer: '',
        tags: [],
        origins: [origin],
        ...(previous ? { likelyPrevious: previous.record } : {}),
        copied: !item.path || item.owned === true,
        ...(await this.readIdentity(item.name, family, bytes, item.category || options.category || ''))
      }
      await this.save(doc)
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
