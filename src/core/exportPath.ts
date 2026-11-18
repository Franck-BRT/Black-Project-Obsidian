// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * « Où enregistrer l'export ? » : avant d'écrire un export (des workflows, des types, une
 * bibliothèque…), une fenêtre propose le dossier du coffre et le nom du fichier, préremplis
 * par le chemin habituel du module. On peut les changer, ou valider tels quels.
 */

import type { FileSystem, Ui } from './ports'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** L'endroit proposé d'office : le dossier, le nom (sans l'extension) et l'extension (`json`, `zip`…). */
export interface ExportPlace {
  folder: string
  name: string
  extension: string
}

/** Un dossier tel qu'écrit : sans « / » au début ni à la fin, ni espaces autour de chaque partie. */
export const cleanExportFolder = (folder: string): string =>
  folder
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')

/** Les caractères qu'un nom de fichier ne peut pas porter (dans Obsidian, sur tous les systèmes). */
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/

/** Ce qui ne va pas dans le dossier ou le nom choisis ; `null` s'ils conviennent. */
export function exportPathProblem(t: Translate, folder: string, name: string): string | null {
  if (cleanExportFolder(folder).split('/').some((part) => part === '..' || part === '.')) return t('export.where.problem.folder')
  if (!name.trim()) return t('export.where.problem.empty')
  if (FORBIDDEN.test(name)) return t('export.where.problem.name')
  return null
}

/** Le premier chemin libre : `nom.ext`, sinon `nom (2).ext`, `nom (3).ext`… */
export async function freeExportPath(fs: Pick<FileSystem, 'exists'>, folder: string, name: string, extension: string): Promise<string> {
  const at = (base: string) => `${folder ? `${folder}/` : ''}${base}.${extension}`
  let path = at(name)
  for (let index = 2; await fs.exists(path); index++) path = at(`${name} (${index})`)
  return path
}

/**
 * Demande où enregistrer l'export, et rend le chemin (libre : « (2) » si le fichier existe
 * déjà) ; le dossier est créé s'il le faut. `null` si l'on renonce : rien n'est écrit.
 */
export async function askExportPath(deps: { ui: Pick<Ui, 'askForm'>; fs: Pick<FileSystem, 'exists' | 'ensureFolder'>; t: Translate }, place: ExportPlace): Promise<string | null> {
  const { ui, fs, t } = deps
  const extension = place.extension.replace(/^\./, '')
  // Un nom tapé avec son extension la garde une seule fois.
  const bare = (name: string) => name.trim().replace(new RegExp(`\\.${extension}$`, 'i'), '').trim()
  const values = await ui.askForm({
    title: t('export.where.title'),
    intro: t('export.where.intro', { extension }),
    fields: [
      { kind: 'text', key: 'folder', label: t('export.where.folder'), description: t('export.where.folder.desc'), placeholder: t('export.where.folder.root'), value: place.folder },
      { kind: 'text', key: 'name', label: t('export.where.name'), description: t('export.where.name.desc', { extension }), required: true, value: place.name }
    ],
    submit: t('export.where.submit'),
    validate: (entered) => exportPathProblem(t, entered.folder ?? '', bare(entered.name ?? ''))
  })
  if (!values) return null
  const folder = cleanExportFolder(values.folder ?? '')
  const name = bare(values.name ?? '') || place.name
  if (folder) await fs.ensureFolder(folder)
  return freeExportPath(fs, folder, name, extension)
}
