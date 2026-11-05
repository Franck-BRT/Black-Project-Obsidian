// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Lire et écrire les notes d'exigences, par les ports de la plateforme (fichiers, YAML) :
 * le même code tourne dans Obsidian, dans l'application de bureau et dans les tests.
 *
 * Mince : une exigence n'a ni dossier ni enfants. Ce qui ne l'est pas, c'est
 * l'identifiant — tout l'intérêt de la bibliothèque, la seule chose à ne jamais rater.
 */

import type { FileSystem } from '../../core/ports'
import { readYamlFrontmatter, type YamlReader } from '../../core/yaml'
import { makeRequirement, markLinksToward, type Requirement } from './model/requirement'
import { isReqId, reqFileName } from './model/reqId'
import { requirementBodyRemainder, serializeRequirement } from './model/note'
import { hydrateRequirement, isRequirementFrontmatter, REQUIREMENT_FRONTMATTER_KEYS } from './model/record'
import { allocateReqId, counterPast, type ReqSettings } from './settings'

export interface StoreDeps {
  fs: FileSystem
  yaml: YamlReader
  settings(): ReqSettings
  /** Retient les compteurs ; appelé avant d'écrire la note. */
  saveCounters(counters: Record<string, number>): Promise<void>
}

/** Le fichier qu'une nouvelle exigence prendrait existe déjà. */
export class RequirementExists extends Error {
  constructor(readonly path: string) {
    super(`Une note existe déjà : ${path}`)
  }
}

function parentOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '' : path.slice(0, index)
}

export class RequirementStore {
  constructor(private readonly deps: StoreDeps) {}

  requirementFilePath(id: string, title: string, folder: string): string {
    const name = reqFileName(id, title)
    return folder ? `${folder}/${name}.md` : `${name}.md`
  }

  /** Toutes les notes Markdown du dossier des exigences, sous-dossiers compris. */
  private async notes(folder: string): Promise<string[]> {
    const { fs } = this.deps
    if (!(await fs.exists(folder))) return []
    const out: string[] = []
    const visit = async (path: string) => {
      const { files, folders } = await fs.list(path)
      out.push(...files.filter((file) => file.toLowerCase().endsWith('.md')))
      for (const sub of folders) await visit(sub)
    }
    await visit(folder)
    return out.sort((a, b) => a.localeCompare(b))
  }

  /** Toute la bibliothèque, triée par identifiant. */
  async all(): Promise<Requirement[]> {
    const found: Requirement[] = []
    for (const path of await this.notes(this.deps.settings().folder)) {
      const requirement = await this.load(path)
      if (requirement) found.push(requirement)
    }
    return found.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  }

  /** L'exigence d'une note ; `null` si la note n'en est pas une. */
  async load(path: string): Promise<Requirement | null> {
    const { fs, yaml } = this.deps
    if (!(await fs.exists(path))) return null
    const { data } = readYamlFrontmatter(yaml, await fs.readText(path))
    if (!data || !isRequirementFrontmatter(data)) return null
    return hydrateRequirement(data, path)
  }

  /**
   * Attribue un identifiant et écrit l'exigence. Le compteur est retenu avant la note :
   * si l'écriture échoue, le numéro est perdu et la suivante prend le d'après. Perdre un
   * numéro ne coûte rien ; donner deux fois le même coûte la traçabilité.
   */
  async create(over: Partial<Requirement> = {}): Promise<Requirement> {
    const settings = this.deps.settings()
    const wanted = (over.id ?? '').trim()
    // Un identifiant apporté (un import avec la numérotation d'un fournisseur) est gardé :
    // renuméroter les exigences de quelqu'un casse toutes les références de ses documents.
    const brought = isReqId(wanted) ? wanted.toUpperCase() : ''
    const library = await this.all()
    const allocated = allocateReqId(
      settings.scheme,
      over.category ?? '',
      library.map((each) => each.id),
      settings.counters
    )
    const id = brought || allocated.id
    await this.deps.saveCounters(brought ? counterPast(settings.scheme, settings.counters, brought) : allocated.counters)

    const sourceLang = over.sourceLang ?? settings.languages[0] ?? 'fr'
    const requirement = makeRequirement({ ...over, id, sourceLang })
    const path = this.requirementFilePath(id, requirement.title, settings.folder)
    if (await this.deps.fs.exists(path)) throw new RequirementExists(path)
    const written = { ...requirement, filePath: path }
    await this.write(written)
    return written
  }

  /** Lit, applique, écrit. Une exigence inchangée n'est pas réécrite du tout. */
  async update(path: string, change: (requirement: Requirement) => Requirement): Promise<Requirement | null> {
    const current = await this.load(path)
    if (!current) return null
    const next = change(current)
    if (next === current) return current
    await this.write({ ...next, filePath: path })
    return next
  }

  /**
   * Écrit, marque les exigences qui s'appuient sur celle-ci si sa formulation a bougé,
   * puis renomme la note si son nom ne correspond plus à son identifiant et à son titre.
   * Rend où l'exigence se trouve désormais.
   */
  async save(path: string, change: (requirement: Requirement) => Requirement): Promise<{ requirement: Requirement; path: string } | null> {
    const before = await this.load(path)
    const saved = await this.update(path, change)
    if (!saved) return null
    if (before && saved.rev !== before.rev) await this.markDependentsSuspect(saved.id)
    const moved = (await this.syncFileName({ ...saved, filePath: path })) ?? path
    return { requirement: { ...saved, filePath: moved }, path: moved }
  }

  /**
   * Prévient les exigences qui s'appuient sur celle-ci qu'elles ont été écrites sur des
   * mots qu'elle n'a plus. Seule une personne retire la marque. Rend les identifiants
   * marqués ; rien n'est marqué deux fois.
   */
  async markDependentsSuspect(id: string): Promise<string[]> {
    const marked: string[] = []
    const wanted = id.toUpperCase()
    for (const dependent of await this.all()) {
      if (!dependent.filePath) continue
      if (!dependent.links.some((link) => link.to.toUpperCase() === wanted && !link.suspect)) continue
      const saved = await this.update(dependent.filePath, (current) => markLinksToward(current, id))
      if (saved) marked.push(saved.id)
    }
    return marked
  }

  /** Renomme la note pour suivre l'identifiant et le titre ; les liens vers elle suivent. */
  async syncFileName(requirement: Requirement): Promise<string | null> {
    const current = requirement.filePath
    if (!current || !(await this.deps.fs.exists(current))) return null
    const wanted = this.requirementFilePath(requirement.id, requirement.title, parentOf(current))
    if (wanted === current || (await this.deps.fs.exists(wanted))) return null
    await this.deps.fs.rename(current, wanted)
    return wanted
  }

  /**
   * Écrit la note. Une note existante garde les clés d'en-tête d'autres outils et ce que
   * l'utilisateur a écrit sous les sections générées.
   */
  async write(requirement: Requirement): Promise<void> {
    const { fs, yaml } = this.deps
    const path = requirement.filePath
    if (!path) return
    if (!(await fs.exists(path))) {
      await fs.writeText(path, serializeRequirement(requirement))
      return
    }
    const { data, body } = readYamlFrontmatter(yaml, await fs.readText(path))
    const foreign = Object.fromEntries(Object.entries(data ?? {}).filter(([key]) => !REQUIREMENT_FRONTMATTER_KEYS.has(key)))
    // Ce qui a été généré l'a été d'après l'exigence d'avant : c'est elle qu'on retire du corps.
    const previous = data ? hydrateRequirement(data, path) : requirement
    await fs.writeText(path, serializeRequirement(requirement, foreign, requirementBodyRemainder(body, previous)))
  }
}
