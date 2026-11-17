// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **L'explorateur des bibliothèques** : l'arborescence de la colonne de gauche, comme dans un
 * explorateur de fichiers — l'accueil de la bibliothèque, puis ses groupes (les documents, le
 * système IA, le système, l'annuaire), chacun avec ses bibliothèques et leurs répertoires,
 * combien chacun contient. Le lieu montré est marqué, et le chemin qui y mène déplié.
 * Le réglage « Les bibliothèques en explorateur de fichiers » le montre ou non (sinon :
 * l'affichage en cartes d'avant).
 */

import type { Explorer, ExplorerNode, IconName, ViewAction } from '../../core/views'
import { isUnder, placePageOf, type Placed, type ShelfPlacesDeps } from './places'
import { folderOfPlace, type Shelf, type ShelfKind } from './shelves'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Le lieu montré : une bibliothèque d'une sorte, un de ses répertoires ; `null` : l'accueil de la bibliothèque. */
export type ExplorerPlace = { kind: ShelfKind; shelf: string; directory: string } | null

export interface ExplorerDeps {
  t: Translate
  /** L'accueil de la bibliothèque. */
  hub: string
  places: Readonly<Record<ShelfKind, ShelfPlacesDeps>>
  /** Ce qui est rangé, sorte par sorte (leur lieu), pour compter. */
  items(kind: ShelfKind): Promise<readonly Placed[]>
  showPage?(id: string): void
}

/** Les groupes, comme sur l'accueil de la bibliothèque. */
const GROUPS: readonly { id: string; icon: IconName; kinds: readonly ShelfKind[] }[] = [
  { id: 'documents', icon: 'book', kinds: ['document'] },
  { id: 'ia', icon: 'spark', kinds: ['prompt', 'persona', 'skill'] },
  { id: 'systeme', icon: 'tag', kinds: ['tag'] },
  { id: 'annuaire', icon: 'user', kinds: ['issuer', 'person'] }
]

const KIND_ICON: Readonly<Record<ShelfKind, IconName>> = { document: 'book', prompt: 'chat', persona: 'spark', skill: 'list', tag: 'tag', issuer: 'building', person: 'user' }

const shelfIcon = (kind: ShelfKind, shelf: Shelf): IconName => (shelf.reference ? 'star' : shelf.project ? 'briefcase' : shelf.circuit ? 'flow' : KIND_ICON[kind])

const name = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** L'arborescence des bibliothèques, le lieu `current` marqué. */
export async function libraryExplorer(deps: ExplorerDeps, current: ExplorerPlace): Promise<Explorer> {
  const { t } = deps
  const open = (kind: ShelfKind, shelf: Shelf, directory: string, label: string): ViewAction => ({
    id: 'open',
    label: t('bibliotheque.explorer.open', { name: label }),
    run: () => deps.showPage?.(placePageOf(deps.places[kind].page, { shelf: shelf.id, directory }))
  })
  const isCurrent = (kind: ShelfKind, shelf: Shelf, directory: string): boolean => !!current && current.kind === kind && current.shelf === shelf.id && current.directory === directory
  /** Les répertoires d'un lieu, et les leurs, en nœuds. */
  const directories = async (kind: ShelfKind, shelf: Shelf, directory: string, items: readonly Placed[]): Promise<ExplorerNode[]> => {
    const places = deps.places[kind]
    const subs = await places.subdirectories(folderOfPlace(shelf, directory))
    return Promise.all(
      subs.map(async (path): Promise<ExplorerNode> => {
        const here = directory ? `${directory}/${name(path)}` : name(path)
        const children = await directories(kind, shelf, here, items)
        return {
          id: `${kind}:${shelf.id}:${here}`,
          label: name(path),
          icon: 'folder',
          count: String(items.filter((item) => isUnder(item, { shelf, directory: here })).length),
          ...(isCurrent(kind, shelf, here) ? { current: true } : {}),
          open: open(kind, shelf, here, name(path)),
          // Des fichiers lâchés sur un répertoire : versés là (pas dans le circuit, qui a son entrée).
          ...(places.dropInto && !shelf.circuit ? { drop: places.dropInto(path, name(path)) } : {}),
          ...(children.length ? { children } : {})
        }
      })
    )
  }
  const shelvesOf = async (kind: ShelfKind): Promise<ExplorerNode[]> => {
    const places = deps.places[kind]
    const items = await deps.items(kind)
    return Promise.all(
      places.shelves().map(async (shelf): Promise<ExplorerNode> => {
        const children = await directories(kind, shelf, '', items)
        return {
          id: `${kind}:${shelf.id}`,
          label: shelf.name,
          icon: shelfIcon(kind, shelf),
          count: String(items.filter((item) => item.shelf === shelf.id).length),
          ...(isCurrent(kind, shelf, '') ? { current: true } : {}),
          open: open(kind, shelf, '', shelf.name),
          ...(places.dropInto && !shelf.circuit ? { drop: places.dropInto(shelf.folder, shelf.name) } : {}),
          ...(children.length ? { children } : {})
        }
      })
    )
  }
  const groups = await Promise.all(
    GROUPS.map(async (group): Promise<ExplorerNode> => ({
      id: `groupe.${group.id}`,
      label: t(`bibliotheque.hub.group.${group.id}`),
      icon: group.icon,
      expanded: true,
      children: (await Promise.all(group.kinds.map(shelvesOf))).flat()
    }))
  )
  return {
    label: t('bibliotheque.explorer.label'),
    nodes: [
      { id: 'hub', label: t('bibliotheque.hub.title'), icon: 'home', ...(current === null ? { current: true } : {}), open: { id: 'open', label: t('bibliotheque.hub.title'), run: () => deps.showPage?.(deps.hub) } },
      ...groups
    ]
  }
}
