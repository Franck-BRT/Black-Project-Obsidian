// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les bibliothèques de **prompts** et de **personas** — deux bibliothèques séparées, chacune
 * son dossier, rangées comme le reste du coffre : une note par entrée.
 *
 * - Un **prompt** : une question ou une consigne pour l'IA, écrite une fois, retrouvée et
 *   reprise (« Interroger le dossier », « Demander à l'IA »).
 * - Un **persona** : le rôle dans lequel l'IA répond — un juriste des marchés publics, un
 *   contrôleur technique —, qui il est, ce qu'il sait, comment il répond.
 *
 * La note : `bp-type: bibliotheque-prompt` (ou `-persona`), son nom, sa catégorie, sa
 * description, favori ou non ; son texte en corps de note. Retirée, elle part dans
 * `_retirés` : rien n'est effacé.
 */

import type { FileSystem } from '../../core/ports'
import { readYamlFrontmatter, toYaml, type YamlReader } from '../../core/yaml'

export type EntryKind = 'prompt' | 'persona'
export const ENTRY_KINDS: readonly EntryKind[] = ['prompt', 'persona']
export const ENTRY_TYPE: Readonly<Record<EntryKind, string>> = { prompt: 'bibliotheque-prompt', persona: 'bibliotheque-persona' }

export interface LibraryEntry {
  kind: EntryKind
  /** La note : son identité. */
  path: string
  name: string
  /** La question (prompt) ; qui l'IA doit être et comment répondre (persona). */
  text: string
  category: string
  description: string
  favorite: boolean
}

export type EntryDraft = Omit<LibraryEntry, 'kind' | 'path'>

const SET_ASIDE = '_retirés'

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const plain = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '')

/** Le nom d'une note, d'après celui de l'entrée : ce qu'un nom de fichier ne peut pas porter, ôté. */
export function entryFileName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'Sans nom'
  )
}

/** La note d'une entrée : son en-tête, puis son texte. */
export function entryContent(kind: EntryKind, draft: EntryDraft): string {
  const data: Record<string, unknown> = {
    'bp-type': ENTRY_TYPE[kind],
    nom: draft.name.trim(),
    ...(draft.category.trim() ? { categorie: draft.category.trim() } : {}),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.favorite ? { favori: true } : {})
  }
  return `---\n${toYaml(data)}\n---\n\n${draft.text.trim()}\n`
}

/** Une entrée relue de sa note ; `null` si ce n'en est pas une de ce genre. */
export function readEntry(kind: EntryKind, path: string, data: Record<string, unknown> | null, body: string): LibraryEntry | null {
  if (!data || data['bp-type'] !== ENTRY_TYPE[kind]) return null
  const basename = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')
  return {
    kind,
    path,
    name: plain(data.nom ?? data.name) || basename,
    // Les commentaires d'Obsidian (%% … %%) ne sont pas pour l'IA.
    text: body.replace(/%%[\s\S]*?%%/g, '').trim(),
    category: plain(data.categorie ?? data['catégorie'] ?? data.category),
    description: plain(data.description),
    favorite: data.favori === true || data.favorite === true
  }
}

/** Toutes les entrées contiennent-elles chaque mot cherché (nom, catégorie, description, texte) ? */
export function matchesEntry(entry: LibraryEntry, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  const hay = fold([entry.name, entry.category, entry.description, entry.text].join('\n'))
  return words.every((word) => hay.includes(word))
}

/** Les catégories en usage, une fois chacune (quelle que soit la casse), dans l'ordre alphabétique. */
export function entryCategories(entries: readonly LibraryEntry[]): string[] {
  const seen = new Map<string, string>()
  for (const entry of entries) if (entry.category && !seen.has(fold(entry.category))) seen.set(fold(entry.category), entry.category)
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'))
}

/** L'ordre d'une liste : les favoris d'abord, puis par catégorie (sans catégorie en dernier), puis par nom. */
export function sortEntries(entries: readonly LibraryEntry[]): LibraryEntry[] {
  return [...entries].sort(
    (a, b) =>
      Number(b.favorite) - Number(a.favorite) ||
      (!a.category ? 1 : 0) - (!b.category ? 1 : 0) ||
      a.category.localeCompare(b.category, 'fr') ||
      a.name.localeCompare(b.name, 'fr')
  )
}

/** Une entrée par son nom (sans tenir compte des accents ni de la casse) ou par le chemin de sa note. */
export function findIn(entries: readonly LibraryEntry[], nameOrPath: string): LibraryEntry | null {
  const wanted = nameOrPath.trim()
  if (!wanted) return null
  return entries.find((entry) => entry.path === wanted || entry.path === `${wanted}.md`) ?? entries.find((entry) => fold(entry.name) === fold(wanted)) ?? null
}

export interface EntryStoreDeps {
  fs: FileSystem
  yaml: YamlReader
  folder(): string
}

/** Une bibliothèque de prompts, ou de personas : son dossier, ses notes. */
export class EntryStore {
  constructor(
    readonly kind: EntryKind,
    private readonly deps: EntryStoreDeps
  ) {}

  get root(): string {
    return this.deps.folder()
  }

  /** Ses entrées, partout sous son dossier (sauf les retirées), triées. */
  async all(): Promise<LibraryEntry[]> {
    const { fs, yaml } = this.deps
    const out: LibraryEntry[] = []
    const walk = async (folder: string): Promise<void> => {
      if (!(await fs.exists(folder))) return
      const listing = await fs.list(folder)
      for (const path of listing.files.filter((each) => each.endsWith('.md'))) {
        const { data, body } = readYamlFrontmatter(yaml, await fs.readText(path))
        const entry = readEntry(this.kind, path, data, body)
        if (entry) out.push(entry)
      }
      for (const sub of listing.folders) if (!sub.endsWith(`/${SET_ASIDE}`)) await walk(sub)
    }
    await walk(this.root)
    return sortEntries(out)
  }

  async load(path: string): Promise<LibraryEntry | null> {
    const { fs, yaml } = this.deps
    if (!(await fs.exists(path))) return null
    const { data, body } = readYamlFrontmatter(yaml, await fs.readText(path))
    return readEntry(this.kind, path, data, body)
  }

  /** Un chemin libre pour ce nom : « Nom.md », sinon « Nom 2.md », « Nom 3.md »… */
  private async free(folder: string, name: string, keep?: string): Promise<string> {
    const base = entryFileName(name)
    for (let index = 1; ; index++) {
      const path = `${folder}/${index === 1 ? base : `${base} ${index}`}.md`
      if (path === keep || !(await this.deps.fs.exists(path))) return path
    }
  }

  /** Une nouvelle entrée ; rend le chemin de sa note. */
  async create(draft: EntryDraft): Promise<string> {
    await this.deps.fs.ensureFolder(this.root)
    const path = await this.free(this.root, draft.name)
    await this.deps.fs.writeText(path, entryContent(this.kind, draft))
    return path
  }

  /** Une entrée modifiée : sa note réécrite, renommée si son nom a changé ; rend son chemin. */
  async update(path: string, draft: EntryDraft): Promise<string> {
    const { fs } = this.deps
    await fs.writeText(path, entryContent(this.kind, draft))
    const folder = path.slice(0, path.lastIndexOf('/'))
    const target = await this.free(folder, draft.name, path)
    if (target === path) return path
    await fs.rename(path, target)
    return target
  }

  /** Favori, ou plus favori. */
  async toggleFavorite(path: string): Promise<LibraryEntry | null> {
    const entry = await this.load(path)
    if (!entry) return null
    const next = { ...entry, favorite: !entry.favorite }
    await this.deps.fs.writeText(path, entryContent(this.kind, next))
    return next
  }

  /** Retirer : la note mise de côté dans `_retirés` — rien n'est effacé. */
  async setAside(path: string): Promise<boolean> {
    const { fs } = this.deps
    if (!(await fs.exists(path))) return false
    const aside = `${this.root}/${SET_ASIDE}`
    await fs.ensureFolder(aside)
    const name = path.slice(path.lastIndexOf('/') + 1)
    let target = `${aside}/${name}`
    for (let index = 2; await fs.exists(target); index++) target = `${aside}/${name.replace(/\.md$/, '')} (${index}).md`
    await fs.rename(path, target)
    return true
  }

  /**
   * Ajouter des exemples : ceux dont le nom n'est pas déjà pris (une entrée retirée ou
   * renommée n'est pas recréée sous l'ancien nom tant qu'il est pris). Rend ceux ajoutés.
   */
  async addStarters(starters: readonly EntryDraft[]): Promise<string[]> {
    const names = new Set((await this.all()).map((entry) => fold(entry.name)))
    const added: string[] = []
    for (const starter of starters) {
      if (names.has(fold(starter.name))) continue
      await this.create(starter)
      names.add(fold(starter.name))
      added.push(starter.name)
    }
    return added
  }
}
