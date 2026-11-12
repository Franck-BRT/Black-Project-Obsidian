// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Où l'on est dans une bibliothèque, à l'écran : le **fil d'Ariane** (Bibliothèque ›
 * Normes › ECSS), une carte par **répertoire** (combien il contient), et ce qu'on y fait —
 * un nouveau répertoire, une nouvelle bibliothèque, la choisir par défaut, la retirer de la
 * liste. Commun aux documents, aux prompts et aux personas.
 */

import { pageWith, type Breadcrumb, type Card, type FileDrop, type HomeBlock, type ViewAction } from '../../core/views'
import type { Group } from '../../core/grouping'
import { builtInShelf, folderOfPlace, placeParam, readPlace, severalShelves, type Place, type Shelf, type ShelfKind } from './shelves'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Ce qui est rangé quelque part : sa bibliothèque, son répertoire (calculés au parcours). */
export interface Placed {
  shelf?: string
  directory?: string
}

export interface ShelfPlacesDeps {
  t: Translate
  kind: ShelfKind
  /** La page de la sorte (ses lieux en paramètre), et celle d'où l'on vient (l'accueil). */
  page: string
  hub: string
  shelves(): readonly Shelf[]
  defaultShelf(): Shelf
  subdirectories(folder: string): Promise<string[]>
  showPage?(id: string): void
  newDirectory(kind: ShelfKind, folder: string): Promise<string | null>
  newShelf(kind: ShelfKind): Promise<Shelf | null>
  setDefault(kind: ShelfKind, id: string): Promise<void>
  removeShelf(kind: ShelfKind, id: string): Promise<boolean>
  /** Des fichiers glissés-déposés sur un lieu (`where` : son nom) : y verser (les documents seulement). */
  dropInto?(folder: string, where: string): FileDrop
}

/** Le lieu d'une page : celui du paramètre, sinon la racine de la bibliothèque par défaut. */
export function resolvePlace(deps: Pick<ShelfPlacesDeps, 'shelves' | 'defaultShelf'>, param: string | undefined): { shelf: Shelf; directory: string } {
  const wanted = readPlace(param)
  const shelf = (wanted && deps.shelves().find((each) => each.id === wanted.shelf)) || deps.defaultShelf()
  return { shelf, directory: wanted && wanted.shelf === shelf.id ? wanted.directory : '' }
}

/** La page d'un lieu. */
export const placePageOf = (page: string, place: Place): string => pageWith(page, placeParam(place))

/** Est-il dans ce lieu (juste là) ? sous ce lieu (là ou plus bas) ? */
export const isHere = (item: Placed, place: { shelf: Shelf; directory: string }): boolean => item.shelf === place.shelf.id && (item.directory ?? '') === place.directory
export const isUnder = (item: Placed, place: { shelf: Shelf; directory: string }): boolean =>
  item.shelf === place.shelf.id && (!place.directory || (item.directory ?? '') === place.directory || (item.directory ?? '').startsWith(`${place.directory}/`))

/** Le répertoire d'un élément, par rapport à un lieu : « Normes › ECSS » ; vide : là même. */
const relative = (item: Placed, directory: string): string => {
  const own = item.directory ?? ''
  return (directory ? own.slice(directory.length).replace(/^\/+/, '') : own).split('/').filter(Boolean).join(' › ')
}

/** Regrouper par répertoire, sous un lieu : là même d'abord, puis chaque répertoire, par nom. */
export function directoryGroupOf(t: Translate, directory: string): (item: Placed) => Group {
  return (item) => {
    const where = relative(item, directory)
    return where ? { key: where, title: where } : { key: '', title: t('bibliotheque.place.here'), order: -1 }
  }
}

const name = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** Le haut d'une page d'un lieu : son fil d'Ariane, ses répertoires ; et ce qu'on y fait. */
export async function placeView(
  deps: ShelfPlacesDeps,
  place: { shelf: Shelf; directory: string },
  items: readonly Placed[]
): Promise<{ breadcrumb: Breadcrumb; blocks: HomeBlock[]; actions: ViewAction[]; folder: string; note: string }> {
  const { t, kind } = deps
  const show = deps.showPage
  const go = (directory: string, shelf = place.shelf) => () => show?.(placePageOf(deps.page, { shelf: shelf.id, directory }))
  const folder = folderOfPlace(place.shelf, place.directory)
  const parts = place.directory.split('/').filter(Boolean)
  const several = severalShelves(deps.shelves())
  const crumbs: Breadcrumb = {
    label: t('bibliotheque.place.crumbs'),
    items: [
      { id: 'hub', label: t('bibliotheque.hub.title'), icon: 'book', run: () => show?.(deps.hub) },
      { id: 'shelf', label: place.shelf.name, run: go('') },
      ...parts.map((part, index) => ({ id: `dir-${index}`, label: part, run: go(parts.slice(0, index + 1).join('/')) }))
    ]
  }
  const subs = await deps.subdirectories(folder)
  const cards: Card[] = subs.map((path) => {
    const directory = place.directory ? `${place.directory}/${name(path)}` : name(path)
    const inside = items.filter((item) => isUnder(item, { shelf: place.shelf, directory })).length
    return {
      id: `dir:${path}`,
      title: name(path),
      subtitle: t(`bibliotheque.place.${kind}.count`, { count: inside }),
      icon: 'folder',
      open: { id: 'open', label: t('bibliotheque.place.open'), run: go(directory) },
      actions: [{ id: 'see', label: t('bibliotheque.place.open'), icon: 'chevron', run: go(directory) }],
      ...(deps.dropInto ? { drop: deps.dropInto(path, name(path)) } : {})
    }
  })
  const newDirectory: ViewAction = {
    id: 'new-directory',
    label: t('bibliotheque.place.newDirectory'),
    tooltip: t('bibliotheque.place.newDirectory.tip', { folder }),
    icon: 'folder',
    run: async () => {
      const made = await deps.newDirectory(kind, folder)
      if (made) go(place.directory ? `${place.directory}/${name(made)}` : name(made))()
    }
  }
  const isDefault = deps.defaultShelf().id === place.shelf.id
  const actions: ViewAction[] = [
    newDirectory,
    {
      id: 'new-shelf',
      label: t('bibliotheque.shelf.new'),
      tooltip: t(`bibliotheque.shelf.new.${kind}.tip`),
      icon: 'plus',
      run: async () => {
        const shelf = await deps.newShelf(kind)
        if (shelf) go('', shelf)()
      }
    },
    ...(several && !isDefault && !builtInShelf(place.shelf)
      ? [{ id: 'default-shelf', label: t('bibliotheque.shelf.makeDefault'), tooltip: t(`bibliotheque.shelf.makeDefault.${kind}.tip`), icon: 'star' as const, run: () => deps.setDefault(kind, place.shelf.id) }]
      : []),
    ...(place.shelf.main || builtInShelf(place.shelf)
      ? []
      : [
          {
            id: 'remove-shelf',
            label: t('bibliotheque.shelf.remove'),
            tooltip: t('bibliotheque.shelf.remove.tip'),
            icon: 'trash' as const,
            run: async () => {
              if (await deps.removeShelf(kind, place.shelf.id)) show?.(deps.page)
            }
          }
        ])
  ]
  return {
    breadcrumb: crumbs,
    blocks: [...(cards.length ? [{ kind: 'cards' as const, title: t('bibliotheque.place.directories', { count: cards.length }), cards }] : [])],
    actions,
    folder,
    // « La bibliothèque par défaut », quand il y en a plusieurs.
    note: isDefault && several ? ` · ${t('bibliotheque.shelf.default.long')}` : ''
  }
}

/** Les cartes des bibliothèques d'une sorte, pour l'accueil : combien chacune contient, laquelle est par défaut. */
export function shelfCards(deps: Pick<ShelfPlacesDeps, 't' | 'kind' | 'page' | 'shelves' | 'defaultShelf' | 'showPage'>, items: readonly Placed[], icon: 'book' | 'chat' | 'spark' | 'list' | 'building' | 'tag' | 'user' | 'star' | 'briefcase'): Card[] {
  const { t, kind } = deps
  const chosen = deps.defaultShelf().id
  const several = severalShelves(deps.shelves())
  return deps.shelves().map((shelf) => {
    const go: ViewAction = { id: 'open', label: t('bibliotheque.hub.open'), run: () => deps.showPage?.(placePageOf(deps.page, { shelf: shelf.id, directory: '' })) }
    return {
      id: `${kind}:${shelf.id}`,
      title: shelf.name,
      subtitle: t(`bibliotheque.place.${kind}.count`, { count: items.filter((item) => item.shelf === shelf.id).length }),
      // Les documents de référence : une étoile, et ce qu'ils sont.
      icon: shelf.reference ? ('star' as const) : shelf.project ? ('briefcase' as const) : icon,
      badges: [
        ...(several && shelf.id === chosen ? [{ label: t('bibliotheque.shelf.default'), tone: 'info' as const }] : []),
        ...(shelf.reference ? [{ label: t('bibliotheque.references.badge'), tone: 'info' as const }] : []),
        ...(shelf.project ? [{ label: t('bibliotheque.projects.badge'), tone: 'info' as const }] : [])
      ],
      text: shelf.folder,
      open: go,
      actions: [{ ...go, id: 'see', icon: 'chevron' }]
    }
  })
}

/** Les lieux où ranger quelque chose (pour « Déplacer… ») : chaque bibliothèque, chacun de ses répertoires. */
export async function allPlaces(shelves: readonly Shelf[], subdirectories: (folder: string) => Promise<string[]>): Promise<{ shelf: Shelf; directory: string; folder: string }[]> {
  const out: { shelf: Shelf; directory: string; folder: string }[] = []
  const walk = async (shelf: Shelf, directory: string): Promise<void> => {
    const folder = folderOfPlace(shelf, directory)
    out.push({ shelf, directory, folder })
    for (const sub of await subdirectories(folder)) await walk(shelf, directory ? `${directory}/${name(sub)}` : name(sub))
  }
  for (const shelf of shelves) await walk(shelf, '')
  return out
}

/** Où est rangé quelque chose, en mots : « Normes › ECSS », avec sa bibliothèque quand il y en a plusieurs. */
export function placeLabel(places: Pick<ShelfPlacesDeps, 't' | 'shelves'>, item: { shelf?: string; directory?: string }): string {
  const shelves = places.shelves()
  const shelf = shelves.find((each) => each.id === item.shelf)
  const parts = [...((severalShelves(shelves) || builtInShelf(shelf)) && shelf ? [shelf.name] : []), ...(item.directory ?? '').split('/').filter(Boolean)]
  return parts.length ? parts.join(' › ') : places.t('bibliotheque.place.root')
}

/** Le nom d'un lieu, pour un « Retour » : son répertoire, sinon sa bibliothèque. */
export function placeName(shelves: readonly Shelf[], shelf: string | undefined, directory: string | undefined): string {
  const dir = (directory ?? '').split('/').filter(Boolean).at(-1)
  return dir ?? shelves.find((each) => each.id === shelf)?.name ?? ''
}
