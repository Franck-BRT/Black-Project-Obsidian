// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La documentation dans le coffre : des notes Markdown que l'utilisateur lit dans
 * Obsidian, à côté de son travail.
 *
 * Le cœur apporte l'accueil et la prise en main ; chaque module apporte ses pages, écrites
 * dans son propre répertoire (`src/modules/<id>/doc/`) — la documentation d'un module se
 * maintient avec son code. Les pages sont embarquées dans le plugin et écrites à la
 * demande, dans le dossier choisi dans les réglages.
 *
 * Une page créée par le plugin porte `bp-doc: true` dans son en-tête : elle est remplacée
 * à chaque mise à jour. Une note de l'utilisateur au même endroit, sans cette marque,
 * n'est jamais écrasée.
 */

import type { ModuleDescriptor } from './modules/module'
import type { FileSystem } from './ports'
import accueil from './doc/Accueil.md'
import priseEnMain from './doc/Prise en main.md'

/** Une page, avec son chemin relatif au dossier de la documentation (`Modules/X.md`). */
export interface DocPage {
  readonly path: string
  readonly content: string
}

/** Ce qu'un module reçoit pour écrire ses pages. */
export interface DocInput {
  readonly version: string
  /** Le dossier de la documentation, pour les liens. */
  readonly folder: string
  readonly t: (key: string, vars?: Readonly<Record<string, string | number>>) => string
  /** Les réglages du module : ses extensions équivalentes, par exemple. */
  readonly settings: Readonly<Record<string, unknown>>
}

export interface DocModule {
  readonly name: string
  readonly version: string
  /** Son état, en mots : « Actif », « Désactivé »… */
  readonly state: string
  readonly pages: readonly DocPage[]
}

/**
 * Les gabarits : `{{nom}}` est remplacé par sa valeur ; `{{link:Chemin|Libellé}}` par un
 * lien vers une page de la documentation, qui suit le dossier choisi.
 */
export function fillTemplate(template: string, folder: string, vars: Readonly<Record<string, string>> = {}): string {
  return template
    .replace(/\{\{link:([^|}]+)\|([^}]+)\}\}/g, (_, path: string, label: string) => `[[${folder}/${path.trim()}|${label.trim()}]]`)
    .replace(/\{\{(\w+)\}\}/g, (whole, name: string) => vars[name] ?? whole)
}

export const DOC_MARK = 'bp-doc: true'

function header(version: string): string {
  return [
    '---',
    DOC_MARK,
    `bp-version: "${version}"`,
    '---',
    '',
    `> [!note] Documentation de Black Projects ${version}`,
    '> Créée par le plugin, et remplacée à chaque mise à jour par la commande « Créer ou mettre à jour la documentation ». Pour garder vos propres notes, écrivez-les ailleurs.',
    '',
    ''
  ].join('\n')
}

/** Toutes les pages, prêtes à écrire : l'accueil, la prise en main, puis celles des modules. */
export function documentationPages(input: {
  version: string
  folder: string
  modules: readonly DocModule[]
}): DocPage[] {
  const { version, folder, modules } = input
  const rows = modules.map((module) => {
    const first = module.pages[0]
    // Dans un tableau, le « | » d'un lien doit être échappé, sinon il coupe la cellule.
    const name = first ? `[[${folder}/${first.path.replace(/\.md$/, '')}\\|${module.name}]]` : module.name
    return `| ${name} | ${module.version} | ${module.state} |`
  })
  const table = ['| Module | Version | État |', '| --- | --- | --- |', ...rows].join('\n')
  const vars = { version, modules: table }
  const pages: DocPage[] = [
    { path: 'Accueil.md', content: fillTemplate(accueil, folder, vars) },
    { path: 'Prise en main.md', content: fillTemplate(priseEnMain, folder, vars) },
    ...modules.flatMap((module) => module.pages)
  ]
  return pages.map((page) => ({ path: page.path, content: header(version) + page.content.trim() + '\n' }))
}

export interface DocReport {
  created: string[]
  updated: string[]
  unchanged: string[]
  /** Des notes de l'utilisateur au même endroit, laissées telles quelles. */
  kept: string[]
}

export function isGeneratedDoc(content: string): boolean {
  const front = /^---\n([\s\S]*?)\n---/.exec(content)
  return front !== null && front[1]!.split('\n').some((line) => line.trim() === DOC_MARK)
}

/** Écrit les pages dans le dossier, sans jamais écraser une note de l'utilisateur. */
export async function writeDocumentation(fs: FileSystem, folder: string, pages: readonly DocPage[]): Promise<DocReport> {
  const report: DocReport = { created: [], updated: [], unchanged: [], kept: [] }
  for (const page of pages) {
    const path = `${folder}/${page.path}`
    if (!(await fs.exists(path))) {
      await fs.writeText(path, page.content)
      report.created.push(path)
      continue
    }
    const existing = await fs.readText(path)
    if (!isGeneratedDoc(existing)) report.kept.push(path)
    else if (existing === page.content) report.unchanged.push(path)
    else {
      await fs.writeText(path, page.content)
      report.updated.push(path)
    }
  }
  return report
}

/**
 * Les modules tels que la documentation les présente : leur nom, leur version, leur état
 * en mots, et leurs pages, écrites à partir de leurs réglages.
 */
export function docModules(
  statuses: readonly { module: ModuleDescriptor; state: string }[],
  input: Omit<DocInput, 'settings'> & { settingsFor: (moduleId: string) => Readonly<Record<string, unknown>> }
): DocModule[] {
  return statuses.map(({ module, state }) => ({
    name: input.t(module.nameKey),
    version: module.version,
    state: input.t(`module.state.${state}`),
    pages:
      module.docs?.({ version: input.version, folder: input.folder, t: input.t, settings: input.settingsFor(module.id) }) ??
      []
  }))
}
