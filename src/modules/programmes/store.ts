// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les programmes, leurs projets et leurs affaires, **dans le coffre** :
 *
 * ```
 * Programmes/
 *   Spatial/
 *     Spatial.md                     ← le programme
 *     Station sol 2027/
 *       Station sol 2027.md          ← le projet (ses phases dans son en-tête)
 *       Affaires/
 *         Station sol 2027.md        ← une affaire
 * ```
 *
 * Une note est relue à chaque fois : ce que l'utilisateur y change lui-même est vu.
 */

import type { FileSystem } from '../../core/ports'
import { readYamlFrontmatter, toYaml, type YamlReader } from '../../core/yaml'
import {
  AFFAIRE_TYPE,
  AFFAIRES_FOLDER,
  affaireData,
  baseName,
  phasesFromType,
  planPhases,
  replanPhases,
  spansFromType,
  PROGRAMME_TYPE,
  programmeData,
  PROJECT_TYPE,
  projectData,
  readAffaire,
  readProgramme,
  readProject,
  type Affaire,
  type AffaireStatus,
  type Programme,
  type Project,
  type ProjectPhase,
  type ProjectType
} from './model'

export interface StoreDeps {
  fs: FileSystem
  yaml: YamlReader
  /** Le dossier des programmes (réglage). */
  root(): string
  today(): string
  /** Le titre de la partie « Notes » d'une note neuve. */
  notesHeading(): string
}

export class AlreadyThere extends Error {
  constructor(readonly path: string) {
    super(path)
  }
}

export class ProgrammeStore {
  constructor(private readonly deps: StoreDeps) {}

  get root(): string {
    return this.deps.root()
  }

  private async read(path: string, type: string): Promise<Record<string, unknown> | null> {
    const { fs, yaml } = this.deps
    if (!(await fs.exists(path))) return null
    const { data } = readYamlFrontmatter(yaml, await fs.readText(path))
    return data && data['bp-type'] === type ? data : null
  }

  /** Réécrire l'en-tête d'une note ; sa suite (les notes de l'utilisateur) est gardée. */
  private async write(path: string, data: Record<string, unknown>, title: string): Promise<void> {
    const { fs, yaml } = this.deps
    const body = (await fs.exists(path)) ? readYamlFrontmatter(yaml, await fs.readText(path)).body : `\n# ${title}\n\n## ${this.deps.notesHeading()}\n\n`
    await fs.writeText(path, `---\n${toYaml(data)}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`)
  }

  /** Les sous-dossiers d'un dossier qui ont leur note du même nom et de cette sorte. */
  private async notesIn(folder: string, type: string): Promise<{ path: string; data: Record<string, unknown> }[]> {
    const { fs } = this.deps
    if (!(await fs.exists(folder))) return []
    const found: { path: string; data: Record<string, unknown> }[] = []
    for (const sub of (await fs.list(folder)).folders) {
      const path = `${sub}/${baseName(sub)}.md`
      const data = await this.read(path, type)
      if (data) found.push({ path, data })
    }
    return found.sort((a, b) => baseName(a.path).localeCompare(baseName(b.path)))
  }

  // ── Programmes ────────────────────────────────────────────────────────────────

  async programmes(): Promise<Programme[]> {
    return (await this.notesIn(this.root, PROGRAMME_TYPE)).map(({ path, data }) => readProgramme(path, data))
  }

  async programme(path: string): Promise<Programme | null> {
    const data = await this.read(path, PROGRAMME_TYPE)
    return data ? readProgramme(path, data) : null
  }

  async createProgramme(name: string, fields: Pick<Programme, 'code' | 'color' | 'icon' | 'description'>): Promise<Programme> {
    const folder = `${this.root}/${name}`
    const path = `${folder}/${name}.md`
    if (await this.deps.fs.exists(path)) throw new AlreadyThere(path)
    await this.deps.fs.ensureFolder(folder)
    await this.write(path, programmeData({ ...fields, created: this.deps.today() }), name)
    return (await this.programme(path))!
  }

  async updateProgramme(path: string, patch: Partial<Pick<Programme, 'code' | 'color' | 'icon' | 'description'>>): Promise<Programme | null> {
    const programme = await this.programme(path)
    if (!programme) return null
    await this.write(path, programmeData({ ...programme, ...patch }), programme.name)
    return this.programme(path)
  }

  // ── Projets ───────────────────────────────────────────────────────────────────

  async projects(programme: Programme): Promise<Project[]> {
    return (await this.notesIn(programme.folder, PROJECT_TYPE)).map(({ path, data }) => this.planned(readProject(path, data)))
  }

  /** Tous les projets, de tous les programmes. */
  async allProjects(): Promise<Project[]> {
    return (await Promise.all((await this.programmes()).map((programme) => this.projects(programme)))).flat()
  }

  /** Un projet, ses dates prévues recalées au jour d'aujourd'hui (une phase en retard s'étend, la suite recule). */
  async project(path: string): Promise<Project | null> {
    const data = await this.read(path, PROJECT_TYPE)
    return data ? this.planned(readProject(path, data)) : null
  }

  /** Un projet neuf dans un programme : les phases de son type, toutes à venir. */
  async createProject(programme: Programme, name: string, type: ProjectType, description = ''): Promise<Project> {
    const folder = `${programme.folder}/${name}`
    const path = `${folder}/${name}.md`
    if (await this.deps.fs.exists(path)) throw new AlreadyThere(path)
    await this.deps.fs.ensureFolder(folder)
    await this.write(
      path,
      projectData({ programme: programme.path, typeId: type.id, typeName: type.name, color: type.color, icon: type.icon, description, created: this.deps.today(), phases: phasesFromType(type), spans: spansFromType(type) }),
      name
    )
    return (await this.project(path))!
  }

  /**
   * Les dates d'un projet : prévues, **recalées** sur ce qui s'est passé (au jour d'aujourd'hui) ;
   * celles du planning initial, gardées — refaites quand `rebase` (un démarrage, une durée
   * changée), ou s'il n'y en a pas encore.
   */
  private planned(project: Project, rebase = false): Project {
    const initial = new Map(planPhases(project.phases, project.start).map((phase) => [phase.id, phase]))
    const phases = replanPhases(project.phases, project.start, this.deps.today()).map((phase) => {
      if (!project.start) return phase
      const base = rebase || !phase.initialEnd ? initial.get(phase.id) : undefined
      return base ? { ...phase, initialStart: base.plannedStart!, initialEnd: base.plannedEnd! } : phase
    })
    return { ...project, phases }
  }

  /** Enregistrer un projet ; ses dates prévues recalées (`rebase` : son planning initial refait). */
  private async saveProject(project: Project, rebase = false): Promise<Project> {
    await this.write(project.path, projectData(this.planned(project, rebase)), project.name)
    return (await this.project(project.path))!
  }

  /** Le démarrage d'un projet (vide : pas démarré) : toutes les dates prévues en découlent. */
  async setStart(path: string, start: string): Promise<Project | null> {
    const project = await this.project(path)
    if (!project) return null
    const next: Project = { ...project }
    if (start) next.start = start
    else delete next.start
    return this.saveProject(next, true)
  }

  /** Une phase d'un projet changée (son état, ses dates, ce qui la porte). */
  async setPhase(path: string, id: string, patch: Partial<Pick<ProjectPhase, 'status' | 'start' | 'end' | 'link' | 'duration' | 'documents'>>): Promise<Project | null> {
    const project = await this.project(path)
    if (!project || !project.phases.some((phase) => phase.id === id)) return null
    const phases = project.phases.map((phase) => {
      if (phase.id !== id) return phase
      const next: ProjectPhase = { ...phase, ...patch }
      for (const key of ['start', 'end', 'link'] as const) if (key in patch && !patch[key]) delete next[key]
      if ('duration' in patch && patch.duration === undefined) delete next.duration
      if ('documents' in patch && !patch.documents?.length) delete next.documents
      return next
    })
    // Une durée changée : un nouveau planning, le planning initial avec.
    return this.saveProject({ ...project, phases }, 'duration' in patch)
  }

  // ── Documents de référence ────────────────────────────────────────────────────

  /** Les documents de référence qu'appelle un programme ou un projet (sa note) : remplacés par ceux-ci. */
  async setReferences(path: string, references: readonly string[]): Promise<Programme | Project | null> {
    const unique = [...new Set(references)]
    const programme = await this.programme(path)
    if (programme) {
      await this.write(path, programmeData({ ...programme, references: unique }), programme.name)
      return this.programme(path)
    }
    const project = await this.project(path)
    if (!project) return null
    return this.saveProject({ ...project, references: unique })
  }

  /** Les programmes et les projets qui appellent un document de référence (sa fiche). */
  async callersOf(record: string): Promise<(Programme | Project)[]> {
    const out: (Programme | Project)[] = []
    for (const programme of await this.programmes()) {
      if (programme.references.includes(record)) out.push(programme)
      for (const project of await this.projects(programme)) if (project.references.includes(record)) out.push(project)
    }
    return out
  }

  /** Une fiche de la bibliothèque déplacée : les programmes et les projets qui l'appelaient suivent. */
  async referenceMoved(from: string, to: string): Promise<number> {
    let changed = 0
    for (const caller of await this.callersOf(from)) {
      await this.setReferences(caller.path, caller.references.map((record) => (record === from ? to : record)))
      changed++
    }
    return changed
  }

  // ── Affaires ──────────────────────────────────────────────────────────────────

  async affaires(project: Project): Promise<Affaire[]> {
    const { fs } = this.deps
    const folder = `${project.folder}/${AFFAIRES_FOLDER}`
    if (!(await fs.exists(folder))) return []
    const found: Affaire[] = []
    for (const path of (await fs.list(folder)).files.filter((each) => each.endsWith('.md'))) {
      const data = await this.read(path, AFFAIRE_TYPE)
      if (data) found.push(readAffaire(path, data))
    }
    return found.sort((a, b) => a.name.localeCompare(b.name))
  }

  async affaire(path: string): Promise<Affaire | null> {
    const data = await this.read(path, AFFAIRE_TYPE)
    return data ? readAffaire(path, data) : null
  }

  async createAffaire(project: Project, name: string, fields: Pick<Affaire, 'client' | 'reference'>): Promise<Affaire> {
    const folder = `${project.folder}/${AFFAIRES_FOLDER}`
    const path = `${folder}/${name}.md`
    if (await this.deps.fs.exists(path)) throw new AlreadyThere(path)
    await this.deps.fs.ensureFolder(folder)
    await this.write(path, affaireData({ ...fields, project: project.path, programme: project.programme, status: 'en-cours', created: this.deps.today() }), name)
    return (await this.affaire(path))!
  }

  async setAffaireStatus(path: string, status: AffaireStatus): Promise<Affaire | null> {
    const affaire = await this.affaire(path)
    if (!affaire) return null
    const project = await this.project(affaire.project)
    await this.write(path, affaireData({ ...affaire, status, programme: project?.programme ?? '' }), affaire.name)
    return this.affaire(path)
  }
}
