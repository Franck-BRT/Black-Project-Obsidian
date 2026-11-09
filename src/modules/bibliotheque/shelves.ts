// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Plusieurs **bibliothèques** de chaque sorte — documents, prompts, personas —, chacune un
 * dossier du coffre, avec ses **répertoires** et sous-répertoires (de vrais dossiers).
 *
 * La bibliothèque **principale** de chaque sorte est celle des réglages d'origine (le
 * dossier de la bibliothèque, des prompts, des personas) ; les autres sont rangées dans les
 * réglages du module (`bibliotheques`). Une est **par défaut** (`bibliothequesParDefaut`) :
 * ce qui est versé sans lieu précis (les pièces d'une analyse, un import, le dossier « À
 * verser ») y entre, à la racine.
 */

import { cleanFolder } from '../../core/settings'

/** La sorte d'une bibliothèque. */
export type ShelfKind = 'document' | 'prompt' | 'persona' | 'skill' | 'issuer'
export const SHELF_KINDS: readonly ShelfKind[] = ['document', 'prompt', 'persona', 'skill', 'issuer']

/** Une bibliothèque : son identifiant, son nom, son dossier ; la principale vient des réglages d'origine. */
export interface Shelf {
  id: string
  name: string
  folder: string
  main: boolean
}

export const SHELVES_KEY = 'bibliotheques'
export const DEFAULT_SHELF_KEY = 'bibliothequesParDefaut'
export const MAIN_SHELF = 'principale'

type Settings = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Les bibliothèques ajoutées d'une sorte, telles que les réglages les gardent. */
function storedShelves(settings: Settings, kind: ShelfKind): Shelf[] {
  const all = settings[SHELVES_KEY]
  const list = isRecord(all) && Array.isArray(all[kind]) ? (all[kind] as unknown[]) : []
  return list.flatMap((raw): Shelf[] => {
    if (!isRecord(raw)) return []
    const id = typeof raw.id === 'string' ? raw.id : ''
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const folder = typeof raw.folder === 'string' ? cleanFolder(raw.folder) : ''
    return id && name && folder && id !== MAIN_SHELF ? [{ id, name, folder, main: false }] : []
  })
}

/** Les bibliothèques d'une sorte : la principale d'abord, puis les autres par nom. */
export function shelvesOf(settings: Settings, kind: ShelfKind, mainFolder: string, mainName: string): Shelf[] {
  return [{ id: MAIN_SHELF, name: mainName, folder: mainFolder, main: true }, ...storedShelves(settings, kind).sort((a, b) => a.name.localeCompare(b.name, 'fr'))]
}

/** La bibliothèque par défaut d'une sorte (la principale si rien n'est choisi, ou si elle n'existe plus). */
export function defaultShelfOf(settings: Settings, kind: ShelfKind, shelves: readonly Shelf[]): Shelf {
  const chosen = settings[DEFAULT_SHELF_KEY]
  const id = isRecord(chosen) && typeof chosen[kind] === 'string' ? chosen[kind] : MAIN_SHELF
  return shelves.find((shelf) => shelf.id === id) ?? shelves[0]!
}

const slug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'bibliotheque'

/** Un nom de dossier sûr, tiré d'un nom donné : ce qu'un nom de fichier ne peut pas porter, ôté. */
export const folderName = (name: string): string =>
  name
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[._]+/, '')
    .slice(0, 80)

/** `a` est-il `b`, ou dans `b`, ou `b` dans `a` ? (deux bibliothèques ne s'emboîtent pas) */
const overlaps = (a: string, b: string): boolean => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)

export type ShelfProblem = 'name' | 'folder' | 'overlap'

/**
 * Ajouter une bibliothèque : rend les réglages nouveaux et la bibliothèque, ou ce qui ne va
 * pas — un nom vide, un dossier vide, un dossier qui est (ou contient, ou est dans) celui
 * d'une autre bibliothèque, de quelque sorte qu'elle soit.
 */
export function withShelf(
  settings: Settings,
  kind: ShelfKind,
  wanted: { name: string; folder: string },
  taken: readonly string[]
): { settings: Record<string, unknown>; shelf: Shelf } | { problem: ShelfProblem } {
  const name = wanted.name.trim()
  if (!name) return { problem: 'name' }
  const folder = cleanFolder(wanted.folder)
  if (!folder) return { problem: 'folder' }
  if (taken.some((each) => overlaps(each, folder))) return { problem: 'overlap' }
  const current = storedShelves(settings, kind)
  let id = slug(name)
  for (let index = 2; current.some((shelf) => shelf.id === id) || id === MAIN_SHELF; index++) id = `${slug(name)}-${index}`
  const shelf: Shelf = { id, name, folder, main: false }
  const all = isRecord(settings[SHELVES_KEY]) ? (settings[SHELVES_KEY] as Record<string, unknown>) : {}
  return { settings: { ...settings, [SHELVES_KEY]: { ...all, [kind]: [...current, shelf].map(({ id, name, folder }) => ({ id, name, folder })) } }, shelf }
}

/** Retirer une bibliothèque de la liste (ses notes restent dans le coffre) ; la principale ne se retire pas. */
export function withoutShelf(settings: Settings, kind: ShelfKind, id: string): Record<string, unknown> {
  const all = isRecord(settings[SHELVES_KEY]) ? (settings[SHELVES_KEY] as Record<string, unknown>) : {}
  const kept = storedShelves(settings, kind).filter((shelf) => shelf.id !== id)
  const defaults = isRecord(settings[DEFAULT_SHELF_KEY]) ? { ...(settings[DEFAULT_SHELF_KEY] as Record<string, unknown>) } : {}
  if (defaults[kind] === id) delete defaults[kind]
  return { ...settings, [SHELVES_KEY]: { ...all, [kind]: kept.map(({ id, name, folder }) => ({ id, name, folder })) }, [DEFAULT_SHELF_KEY]: defaults }
}

/** Choisir la bibliothèque par défaut d'une sorte. */
export function withDefaultShelf(settings: Settings, kind: ShelfKind, id: string): Record<string, unknown> {
  const defaults = isRecord(settings[DEFAULT_SHELF_KEY]) ? (settings[DEFAULT_SHELF_KEY] as Record<string, unknown>) : {}
  return { ...settings, [DEFAULT_SHELF_KEY]: { ...defaults, [kind]: id } }
}

/** Un lieu d'une bibliothèque : la bibliothèque, et le répertoire (relatif, vide : sa racine). */
export interface Place {
  shelf: string
  directory: string
}

/** Le paramètre de page d'un lieu, et le lieu d'un paramètre (rien : la bibliothèque par défaut, sa racine). */
export const placeParam = (place: Place): string => encodeURIComponent(`${place.shelf}:${place.directory}`)
export function readPlace(param: string | undefined): Place | null {
  if (!param) return null
  const text = decodeURIComponent(param)
  const at = text.indexOf(':')
  return at < 0 ? { shelf: text, directory: '' } : { shelf: text.slice(0, at), directory: text.slice(at + 1).replace(/^\/+|\/+$/g, '') }
}

/** Le dossier d'un lieu. */
export const folderOfPlace = (shelf: Shelf, directory: string): string => (directory ? `${shelf.folder}/${directory}` : shelf.folder)
