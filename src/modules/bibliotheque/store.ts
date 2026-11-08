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
import {
  baseName,
  familyOf,
  guessCategory,
  readRecord,
  recordContent,
  titleFromName,
  versionKey,
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

  /** Les fiches de la bibliothèque, partout sous son dossier (sauf ses fichiers et ses retirés). */
  async all(): Promise<LibraryDoc[]> {
    const { fs, yaml } = this.deps
    const out: LibraryDoc[] = []
    const walk = async (folder: string): Promise<void> => {
      if (!(await fs.exists(folder))) return
      const listing = await fs.list(folder)
      for (const path of listing.files.filter((each) => each.endsWith('.md'))) {
        const doc = readRecord(path, readYamlFrontmatter(yaml, await fs.readText(path)).data)
        if (doc) out.push(doc)
      }
      const skipped = this.deps.skip?.() ?? []
      for (const sub of listing.folders) {
        const name = baseName(sub)
        if (name !== FILES_FOLDER && name !== SET_ASIDE_FOLDER && name !== INBOX_FOLDER && !skipped.includes(sub)) await walk(sub)
      }
    }
    await walk(this.root)
    return out
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
    const report: PourReport = { added: [], already: [], failed: [] }
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
        file = await this.free(`${this.root}/${FILES_FOLDER}/${safeName(baseName(item.name))}`)
        await fs.writeBinary(file, bytes.slice().buffer)
      }
      const title = titleFromName(item.name)
      const family = familyOf(item.name)
      const record = await this.free(`${this.root}/${safeName(title)}.md`)
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
        copied: !item.path || item.owned === true
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
    const report: PourReport = { added: [], already: [], failed: [] }
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
      await fs.ensureFolder(`${this.root}/${FILES_FOLDER}`)
      const target = await this.free(`${this.root}/${FILES_FOLDER}/${safeName(name)}`)
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
    const aside = `${this.root}/${SET_ASIDE_FOLDER}`
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
