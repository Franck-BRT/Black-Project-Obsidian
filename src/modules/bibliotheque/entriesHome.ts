// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les bibliothèques dans l'interface : la page **Bibliothèque** qui mène aux trois — les
 * documents, les prompts, les personas — ; pour les prompts et pour les personas, chacun sa
 * page (une carte par entrée, les favoris d'abord, une recherche, un filtre par catégorie)
 * et sa fiche (le texte, Modifier, Favori, Ouvrir sa note, Retirer).
 */

import { pageWith, type Card, type PageView, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { entryCategories, type EntryKind, type EntryStore, type LibraryEntry } from './entries'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const HUB_PAGE = 'bibliotheque.accueil'
export const ENTRIES_PAGE: Readonly<Record<EntryKind, string>> = { prompt: 'bibliotheque.prompts', persona: 'bibliotheque.personas' }
export const ENTRY_PAGE: Readonly<Record<EntryKind, string>> = { prompt: 'bibliotheque.prompt', persona: 'bibliotheque.persona' }
export const entryPageOf = (kind: EntryKind, path: string): string => pageWith(ENTRY_PAGE[kind], encodeURIComponent(path))

const ICON: Readonly<Record<EntryKind, 'chat' | 'spark'>> = { prompt: 'chat', persona: 'spark' }

export interface EntriesHomeDeps {
  t: Translate
  stores: Readonly<Record<EntryKind, EntryStore>>
  /** La page des documents, et ses chiffres pour l'accueil de la bibliothèque. */
  documentsPage: string
  documents(): Promise<{ count: number; likely: number }>
  showPage?(id: string): void
  showNote(path: string): Promise<void>
  /** Créer une entrée (sa fenêtre) ; rend son chemin, ou null. */
  create(kind: EntryKind): Promise<string | null>
  /** La modifier (sa fenêtre) ; rend son chemin (renommée, peut-être), ou null. */
  edit(kind: EntryKind, path: string): Promise<string | null>
  toggleFavorite(kind: EntryKind, path: string): Promise<void>
  /** La retirer, après confirmation ; vrai si elle l'a été. */
  setAside(kind: EntryKind, path: string): Promise<boolean>
  /** Écrire les exemples qui manquent. */
  addStarters(kind: EntryKind): Promise<void>
}

const slug = (category: string): string =>
  `categorie-${category
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`

/** Les premiers mots d'un texte, sur une ligne. */
const excerpt = (text: string, size = 220): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > size ? `${flat.slice(0, size - 1)}…` : flat
}

function entryCard(deps: EntriesHomeDeps, entry: LibraryEntry): Card {
  const { t } = deps
  const show = deps.showPage
  return {
    id: entry.path,
    title: entry.name,
    ...(entry.description ? { subtitle: entry.description } : {}),
    icon: ICON[entry.kind],
    badges: [...(entry.favorite ? [{ label: t('bibliotheque.entry.favorite'), tone: 'warning' as const }] : []), ...(entry.category ? [{ label: entry.category, tone: 'info' as const }] : [])],
    text: excerpt(entry.text) || t('bibliotheque.entry.noText'),
    ...(show ? { open: { id: 'open', label: t('bibliotheque.entry.open'), run: () => show(entryPageOf(entry.kind, entry.path)) } } : {}),
    actions: [
      {
        id: 'favorite',
        label: t(entry.favorite ? 'bibliotheque.entry.unfavorite' : 'bibliotheque.entry.makeFavorite'),
        icon: 'star',
        run: () => deps.toggleFavorite(entry.kind, entry.path)
      }
    ],
    tags: [...(entry.favorite ? ['favoris'] : []), ...(entry.category ? [slug(entry.category)] : ['sans-categorie'])]
  }
}

/** La page d'une bibliothèque de prompts ou de personas. */
export async function entriesPage(deps: EntriesHomeDeps, kind: EntryKind): Promise<PageView> {
  const { t } = deps
  const entries = await deps.stores[kind].all()
  const categories = entryCategories(entries)
  const create: ViewAction = {
    id: 'new',
    label: t(`bibliotheque.${kind}.new`),
    icon: 'plus',
    primary: true,
    run: async () => {
      const path = await deps.create(kind)
      if (path) deps.showPage?.(entryPageOf(kind, path))
    }
  }
  const starters: ViewAction = { id: 'starters', label: t('bibliotheque.entry.starters'), tooltip: t(`bibliotheque.${kind}.starters.tip`), icon: 'copy', run: () => deps.addStarters(kind) }
  return {
    subtitle: t(`bibliotheque.${kind}.subtitle`, { folder: deps.stores[kind].root }),
    actions: [create, starters],
    search: { label: t('bibliotheque.entry.search'), placeholder: t(`bibliotheque.${kind}.search.placeholder`) },
    filters: [
      ...(entries.some((entry) => entry.favorite) ? [{ id: 'favoris', label: t('bibliotheque.entry.favorites') }] : []),
      ...categories.map((category) => ({ id: slug(category), label: category })),
      ...(entries.some((entry) => !entry.category) ? [{ id: 'sans-categorie', label: t('bibliotheque.entry.noCategory') }] : [])
    ],
    blocks: entries.length
      ? [
          {
            kind: 'stats',
            stats: [
              { label: t(`bibliotheque.${kind}.count`), value: String(entries.length), icon: ICON[kind] },
              { label: t('bibliotheque.entry.favorites'), value: String(entries.filter((entry) => entry.favorite).length), icon: 'star' },
              { label: t('bibliotheque.entry.categories'), value: String(categories.length), icon: 'list' }
            ]
          },
          { kind: 'cards', cards: entries.map((entry) => entryCard(deps, entry)) }
        ]
      : [{ kind: 'message', tone: 'info', text: t(`bibliotheque.${kind}.empty`), actions: [create, { ...starters, primary: false }] }]
  }
}

/** La fiche d'un prompt ou d'un persona. */
export async function entryPage(deps: EntriesHomeDeps, kind: EntryKind, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const path = param ? decodeURIComponent(param) : ''
  const back: ViewAction = { id: 'back', label: t(`bibliotheque.${kind}.back`), run: () => deps.showPage?.(ENTRIES_PAGE[kind]) }
  const entry = path ? await deps.stores[kind].load(path) : null
  if (!entry) return { title: t(`bibliotheque.${kind}.missing.title`), back, blocks: [{ kind: 'message', tone: 'warning', text: t('bibliotheque.entry.missing') }] }
  return {
    title: entry.name,
    back,
    subtitle: [t(`bibliotheque.${kind}.one`), entry.category, entry.favorite ? t('bibliotheque.entry.favorite') : ''].filter(Boolean).join(' · '),
    actions: [
      {
        id: 'edit',
        label: t('bibliotheque.entry.edit'),
        icon: 'edit',
        primary: true,
        run: async () => {
          const moved = await deps.edit(kind, entry.path)
          if (moved && moved !== entry.path) deps.showPage?.(entryPageOf(kind, moved))
        }
      },
      { id: 'favorite', label: t(entry.favorite ? 'bibliotheque.entry.unfavorite' : 'bibliotheque.entry.makeFavorite'), icon: 'star', run: () => deps.toggleFavorite(kind, entry.path) },
      { id: 'note', label: t('bibliotheque.entry.note'), icon: 'book', run: () => deps.showNote(entry.path) },
      {
        id: 'aside',
        label: t('bibliotheque.entry.setAside'),
        tooltip: t('bibliotheque.entry.setAside.tip'),
        icon: 'trash',
        run: async () => {
          if (await deps.setAside(kind, entry.path)) deps.showPage?.(ENTRIES_PAGE[kind])
        }
      }
    ],
    blocks: [
      ...(entry.description ? [{ kind: 'message' as const, tone: 'info' as const, text: entry.description }] : []),
      { kind: 'text', title: t(`bibliotheque.${kind}.text`), paragraphs: entry.text ? entry.text.split(/\n{2,}/) : [], empty: t('bibliotheque.entry.noText') },
      { kind: 'text', title: t('bibliotheque.entry.where'), paragraphs: [t(`bibliotheque.${kind}.where`)] }
    ]
  }
}

/** La page d'accueil de la bibliothèque : ses trois bibliothèques. */
export async function hubPage(deps: EntriesHomeDeps): Promise<PageView> {
  const { t } = deps
  const documents = await deps.documents()
  const prompts = await deps.stores.prompt.all()
  const personas = await deps.stores.persona.all()
  const go = (page: string): ViewAction => ({ id: 'open', label: t('bibliotheque.hub.open'), run: () => deps.showPage?.(page) })
  const card = (id: string, icon: 'book' | 'chat' | 'spark', count: number, page: string, extra = ''): Card => ({
    id,
    title: t(`bibliotheque.hub.${id}`),
    subtitle: t(`bibliotheque.hub.${id}.count`, { count }),
    icon,
    text: [t(`bibliotheque.hub.${id}.desc`), extra].filter(Boolean).join(' '),
    open: go(page),
    actions: [{ ...go(page), id: 'see', icon: 'chevron' }]
  })
  return {
    subtitle: t('bibliotheque.hub.subtitle'),
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('bibliotheque.hub.documents'), value: String(documents.count), icon: 'book' },
          { label: t('bibliotheque.hub.prompts'), value: String(prompts.length), icon: 'chat' },
          { label: t('bibliotheque.hub.personas'), value: String(personas.length), icon: 'spark' }
        ]
      },
      {
        kind: 'cards',
        cards: [
          card('documents', 'book', documents.count, deps.documentsPage, documents.likely ? t('bibliotheque.home.likely', { count: documents.likely }) : ''),
          card('prompts', 'chat', prompts.length, ENTRIES_PAGE.prompt),
          card('personas', 'spark', personas.length, ENTRIES_PAGE.persona)
        ]
      }
    ]
  }
}

export function registerEntriesHome(views: ViewsRegistrar | undefined, deps: EntriesHomeDeps): void {
  if (!views || !deps.showPage) return
  const { t } = deps
  const show = deps.showPage
  views.page({ id: HUB_PAGE, title: t('bibliotheque.hub.title'), icon: 'book', load: () => hubPage(deps) })
  for (const kind of ['prompt', 'persona'] as const) {
    views.page({ id: ENTRIES_PAGE[kind], title: t(`bibliotheque.${kind}.title`), icon: ICON[kind], parent: HUB_PAGE, load: () => entriesPage(deps, kind) })
    views.page({ id: ENTRY_PAGE[kind], title: t(`bibliotheque.${kind}.one`), icon: ICON[kind], parent: ENTRIES_PAGE[kind], load: (param) => entryPage(deps, kind, param) })
    views.tile({
      id: ENTRIES_PAGE[kind],
      label: t(`bibliotheque.${kind}.title`),
      icon: ICON[kind],
      color: 'teal',
      group: t('bibliotheque.name'),
      order: kind === 'prompt' ? 28 : 29,
      description: t(`bibliotheque.${kind}.tile`),
      page: ENTRIES_PAGE[kind],
      run: () => show(ENTRIES_PAGE[kind])
    })
  }
}
