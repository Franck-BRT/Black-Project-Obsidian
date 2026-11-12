// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les bibliothèques dans l'interface : la page **Bibliothèque** qui mène aux trois — les
 * documents, les prompts, les personas — ; pour les prompts et pour les personas, chacun sa
 * page (une carte par entrée, les favoris d'abord, une recherche, un filtre par catégorie)
 * et sa fiche (le texte, Modifier, Favori, Ouvrir sa note, Retirer).
 */

import { pageWith, type Card, type HomeBlock, type PageView, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { startersFor } from './starters'
import { ENTRY_KINDS, entryCategories, type EntryKind, type EntryStore, type LibraryEntry } from './entries'
import { grouped, groupingOf, groupingSelector } from '../../core/grouping'
import { directoryGroupOf, isHere, isUnder, placeLabel, placeName, placePageOf, placeView, resolvePlace, shelfCards, type ShelfPlacesDeps } from './places'
import { PROJECT_SHELF, REFERENCE_SHELF, severalShelves } from './shelves'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const HUB_PAGE = 'bibliotheque.accueil'
export const ENTRIES_PAGE: Readonly<Record<EntryKind, string>> = {
  prompt: 'bibliotheque.prompts',
  persona: 'bibliotheque.personas',
  skill: 'bibliotheque.skills',
  issuer: 'bibliotheque.issuers',
  tag: 'bibliotheque.tags',
  person: 'bibliotheque.persons'
}
export const ENTRY_PAGE: Readonly<Record<EntryKind, string>> = { prompt: 'bibliotheque.prompt', persona: 'bibliotheque.persona', skill: 'bibliotheque.skill', issuer: 'bibliotheque.issuer', tag: 'bibliotheque.tag', person: 'bibliotheque.person' }
export const entryPageOf = (kind: EntryKind, path: string): string => pageWith(ENTRY_PAGE[kind], encodeURIComponent(path))

type KindIcon = 'book' | 'chat' | 'spark' | 'list' | 'building' | 'tag' | 'user' | 'star' | 'briefcase'
const ICON: Readonly<Record<EntryKind, KindIcon>> = { prompt: 'chat', persona: 'spark', skill: 'list', issuer: 'building', tag: 'tag', person: 'user' }

export interface EntriesHomeDeps {
  t: Translate
  stores: Readonly<Record<EntryKind, EntryStore>>
  /** La page des documents, et ses chiffres pour l'accueil de la bibliothèque. */
  documentsPage: string
  documents(): Promise<{ count: number; likely: number }>
  showPage?(id: string): void
  showNote(path: string): Promise<void>
  /** Les bibliothèques de chaque sorte, leurs répertoires, et ce qu'on en fait (documents compris, pour l'accueil). */
  places: Readonly<Record<EntryKind | 'document', ShelfPlacesDeps>>
  /** Les documents rangés (leur lieu), pour l'accueil. */
  placedDocuments(): Promise<readonly { shelf?: string; directory?: string }[]>
  /** Créer une entrée (sa fenêtre), dans un dossier (sinon la bibliothèque par défaut) ; rend son chemin, ou null. */
  create(kind: EntryKind, folder?: string): Promise<string | null>
  /** La déplacer (le choix du lieu) ; rend son nouveau chemin, ou null. */
  move(kind: EntryKind, path: string): Promise<string | null>
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

/** Le nom d'une entrée tel qu'on le montre : un émetteur, son code devant (« ESA — Agence spatiale européenne »). */
export const entryTitle = (entry: Pick<LibraryEntry, 'name' | 'code'>): string => (entry.code ? `${entry.code} — ${entry.name}` : entry.name)

/** Une personne en une ligne : sa fonction, son entreprise (« Responsable qualité · ESA — Agence spatiale européenne »). */
const personLine = (entry: LibraryEntry, companies: readonly LibraryEntry[]): string => [entry.description, entry.company ? companyLabel(entry.company, companies) : ''].filter(Boolean).join(' · ')

/** L'entreprise d'une personne telle qu'on la montre : celle de la liste (« ESA — … »), sinon ce qui est écrit. */
export const companyLabel = (value: string, companies: readonly LibraryEntry[]): string => {
  const found = companyOf(value, companies)
  return found ? entryTitle(found) : value
}

/** L'entreprise de la liste qu'une personne nomme : par son code, sinon par son nom. */
export const companyOf = (value: string, companies: readonly LibraryEntry[]): LibraryEntry | undefined => {
  const wanted = value.trim().toLowerCase()
  return wanted ? (companies.find((each) => each.code?.toLowerCase() === wanted) ?? companies.find((each) => each.name.toLowerCase() === wanted)) : undefined
}

function entryCard(deps: EntriesHomeDeps, entry: LibraryEntry, companies: readonly LibraryEntry[] = []): Card {
  const { t } = deps
  const show = deps.showPage
  const person = entry.kind === 'person'
  const subtitle = person ? personLine(entry, companies) : entry.description
  return {
    id: entry.path,
    title: entryTitle(entry),
    ...(subtitle ? { subtitle } : {}),
    icon: ICON[entry.kind],
    badges: [...(entry.favorite ? [{ label: t('bibliotheque.entry.favorite'), tone: 'warning' as const }] : []), ...(entry.category ? [{ label: entry.category, tone: 'info' as const }] : [])],
    // Une personne : ses coordonnées d'abord.
    text: (person ? [entry.email, entry.phone, excerpt(entry.text, 160)].filter(Boolean).join(' · ') : excerpt(entry.text)) || t(person ? 'bibliotheque.person.noContact' : 'bibliotheque.entry.noText'),
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

/** Les regroupements des prompts et des personas : par catégorie (d'origine), favoris, ou aucun. */
export const ENTRY_GROUPINGS = ['categorie', 'favoris', 'repertoire', 'aucun'] as const

/** La page d'un lieu d'une bibliothèque de prompts ou de personas (d'origine : la racine de celle par défaut). */
export async function entriesPage(deps: EntriesHomeDeps, kind: EntryKind, param?: string): Promise<PageView> {
  const { t } = deps
  const places = deps.places[kind]
  const place = resolvePlace(places, param)
  const everything = await deps.stores[kind].all()
  const companies = kind === 'person' ? await deps.stores.issuer.all() : []
  const by = groupingOf(ENTRIES_PAGE[kind], 'categorie')
  const under = everything.filter((entry) => isUnder(entry, place))
  const entries = by === 'repertoire' ? under : under.filter((entry) => isHere(entry, place))
  const categories = entryCategories(entries)
  const top = await placeView(places, place, everything)
  const create: ViewAction = {
    id: 'new',
    label: t(`bibliotheque.${kind}.new`),
    icon: 'plus',
    primary: true,
    run: async () => {
      const path = await deps.create(kind, top.folder)
      if (path) deps.showPage?.(entryPageOf(kind, path))
    }
  }
  const starters: ViewAction = { id: 'starters', label: t('bibliotheque.entry.starters'), tooltip: t(`bibliotheque.${kind}.starters.tip`), icon: 'copy', run: () => deps.addStarters(kind) }
  return {
    breadcrumb: top.breadcrumb,
    title: place.directory ? place.directory.slice(place.directory.lastIndexOf('/') + 1) : places.shelves().length > 1 ? place.shelf.name : t(`bibliotheque.${kind}.title`),
    ...(param
      ? { back: { id: 'back', label: t('bibliotheque.back.up'), run: () => deps.showPage?.(place.directory ? placePageOf(ENTRIES_PAGE[kind], { shelf: place.shelf.id, directory: place.directory.split('/').slice(0, -1).join('/') }) : HUB_PAGE) } }
      : {}),
    subtitle: t(`bibliotheque.${kind}.subtitle`, { folder: top.folder }) + top.note,
    actions: [create, ...(startersFor(kind, 'fr').length ? [starters] : []), ...top.actions],
    layouts: ['cards', 'list'],
    grouping: groupingSelector(ENTRIES_PAGE[kind], by, ENTRY_GROUPINGS, t, 'bibliotheque.group.entry'),
    search: { label: t('bibliotheque.entry.search'), placeholder: t(`bibliotheque.${kind}.search.placeholder`) },
    filters: [
      ...(entries.some((entry) => entry.favorite) ? [{ id: 'favoris', label: t('bibliotheque.entry.favorites') }] : []),
      ...categories.map((category) => ({ id: slug(category), label: category })),
      ...(entries.some((entry) => !entry.category) ? [{ id: 'sans-categorie', label: t('bibliotheque.entry.noCategory') }] : [])
    ],
    blocks: [
      ...top.blocks,
      ...(under.length
      ? [
          {
            kind: 'stats' as const,
            stats: [
              { label: t(`bibliotheque.${kind}.count`), value: String(under.length), icon: ICON[kind] },
              { label: t('bibliotheque.entry.favorites'), value: String(under.filter((entry) => entry.favorite).length), icon: 'star' as const },
              { label: t('bibliotheque.entry.categories'), value: String(entryCategories(under).length), icon: 'list' as const }
            ]
          },
          ...grouped(
            entries,
            (entry) => entryCard(deps, entry, companies),
            by === 'categorie'
              ? (entry) => (entry.category ? { key: entry.category.toLowerCase(), title: entry.category } : { key: '', title: t('bibliotheque.entry.noCategory'), order: 1 })
              : by === 'favoris'
                ? (entry) => (entry.favorite ? { key: 'favoris', title: t('bibliotheque.entry.favorites') } : { key: 'autres', title: t('bibliotheque.group.others'), order: 1 })
                : by === 'repertoire'
                  ? directoryGroupOf(t, place.directory)
                  : null,
            `${ENTRIES_PAGE[kind]}.${by}`,
            (count) => t(`bibliotheque.${kind}.group.count`, { count })
          )
        ]
      : [{ kind: 'message' as const, tone: 'info' as const, text: t(top.blocks.length ? 'bibliotheque.place.empty' : `bibliotheque.${kind}.empty`), actions: [create, { ...starters, primary: false }] }])
    ]
  }
}

/** La fiche d'un prompt ou d'un persona. */
export async function entryPage(deps: EntriesHomeDeps, kind: EntryKind, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const path = param ? decodeURIComponent(param) : ''
  // Relue parmi toutes : elle sait où elle est rangée (retour : là).
  const entry = path ? ((await deps.stores[kind].all()).find((each) => each.path === path) ?? (await deps.stores[kind].load(path))) : null
  const home = entry?.shelf ? placePageOf(ENTRIES_PAGE[kind], { shelf: entry.shelf, directory: entry.directory ?? '' }) : ENTRIES_PAGE[kind]
  const back: ViewAction = { id: 'back', label: (entry && placeName(deps.places[kind].shelves(), entry.shelf, entry.directory)) || t(`bibliotheque.${kind}.title`), run: () => deps.showPage?.(home) }
  if (!entry) return { title: t(`bibliotheque.${kind}.missing.title`), back, blocks: [{ kind: 'message', tone: 'warning', text: t('bibliotheque.entry.missing') }] }
  const companies = kind === 'person' || kind === 'issuer' ? await deps.stores.issuer.all() : []
  // Une personne : ses coordonnées ; un clic sur son entreprise (de la liste) l'ouvre.
  const company = kind === 'person' && entry.company ? companyOf(entry.company, companies) : undefined
  const contact: HomeBlock[] =
    kind === 'person'
      ? [
          {
            kind: 'list',
            title: t('bibliotheque.person.contact'),
            items: [
              {
                id: 'company',
                title: t('bibliotheque.person.field.company'),
                detail: entry.company ? companyLabel(entry.company, companies) + (company ? '' : ` — ${t('bibliotheque.person.companyOutside')}`) : t('bibliotheque.person.none'),
                ...(company && deps.showPage ? { open: { id: 'open', label: t('bibliotheque.entry.open'), run: () => deps.showPage?.(entryPageOf('issuer', company.path)) } } : {})
              },
              { id: 'role', title: t('bibliotheque.person.field.role'), detail: entry.description || t('bibliotheque.person.none') },
              { id: 'email', title: t('bibliotheque.person.field.email'), detail: entry.email || t('bibliotheque.person.none') },
              { id: 'phone', title: t('bibliotheque.person.field.phone'), detail: entry.phone || t('bibliotheque.person.none') }
            ]
          }
        ]
      : []
  // Une entreprise : les personnes de la liste qui y travaillent.
  const people = kind === 'issuer' ? (await deps.stores.person.all()).filter((each) => each.company && companyOf(each.company, companies)?.path === entry.path) : []
  const staff: HomeBlock[] =
    kind === 'issuer'
      ? [
          {
            kind: 'list',
            title: t('bibliotheque.issuer.people', { count: people.length }),
            items: people.map((each) => ({
              id: each.path,
              title: each.name,
              detail: [each.description, each.email, each.phone].filter(Boolean).join(' · '),
              ...(deps.showPage ? { open: { id: 'open', label: t('bibliotheque.entry.open'), run: () => deps.showPage?.(entryPageOf('person', each.path)) } } : {})
            })),
            empty: t('bibliotheque.issuer.people.none')
          }
        ]
      : []
  return {
    title: entryTitle(entry),
    back,
    subtitle: [t(`bibliotheque.${kind}.one`), kind === 'person' ? personLine(entry, companies) : '', entry.category, entry.favorite ? t('bibliotheque.entry.favorite') : ''].filter(Boolean).join(' · '),
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
      {
        id: 'move',
        label: t('bibliotheque.move'),
        tooltip: t(`bibliotheque.move.${kind}.tip`),
        icon: 'folder',
        run: async () => {
          const moved = await deps.move(kind, entry.path)
          if (moved && moved !== entry.path) deps.showPage?.(entryPageOf(kind, moved))
        }
      },
      { id: 'note', label: t('bibliotheque.entry.note'), icon: 'book', run: () => deps.showNote(entry.path) },
      {
        id: 'aside',
        label: t('bibliotheque.entry.setAside'),
        tooltip: t('bibliotheque.entry.setAside.tip'),
        icon: 'trash',
        run: async () => {
          if (await deps.setAside(kind, entry.path)) deps.showPage?.(home)
        }
      }
    ],
    blocks: [
      ...(entry.description && kind !== 'person' ? [{ kind: 'message' as const, tone: 'info' as const, text: entry.description }] : []),
      ...contact,
      ...staff,
      { kind: 'text', title: t(`bibliotheque.${kind}.text`), paragraphs: entry.text ? entry.text.split(/\n{2,}/) : [], empty: t('bibliotheque.entry.noText') },
      { kind: 'text', title: t('bibliotheque.entry.where'), paragraphs: [t('bibliotheque.entry.placed', { place: placeLabel(deps.places[kind], entry) }), t(`bibliotheque.${kind}.where`)] }
    ]
  }
}

/** La page d'accueil de la bibliothèque : ses trois bibliothèques. */
export async function hubPage(deps: EntriesHomeDeps): Promise<PageView> {
  const { t } = deps
  const documents = await deps.documents()
  const prompts = await deps.stores.prompt.all()
  const personas = await deps.stores.persona.all()
  const skills = await deps.stores.skill.all()
  const issuers = await deps.stores.issuer.all()
  const tags = await deps.stores.tag.all()
  const persons = await deps.stores.person.all()
  const go = (page: string): ViewAction => ({ id: 'open', label: t('bibliotheque.hub.open'), run: () => deps.showPage?.(page) })
  /** Créer une bibliothèque, puis l'ouvrir (sa page la montre aussitôt, vide). */
  const openNewShelf = async (kind: 'document' | EntryKind): Promise<void> => {
    const shelf = await deps.places[kind].newShelf(kind)
    if (shelf) deps.showPage?.(placePageOf(deps.places[kind].page, { shelf: shelf.id, directory: '' }))
  }
  const stats: HomeBlock = {
    kind: 'stats',
    stats: [
      { label: t('bibliotheque.hub.documents'), value: String(documents.count), icon: 'book' },
      { label: t('bibliotheque.hub.prompts'), value: String(prompts.length), icon: 'chat' },
      { label: t('bibliotheque.hub.personas'), value: String(personas.length), icon: 'spark' },
      { label: t('bibliotheque.hub.skills'), value: String(skills.length), icon: 'list' },
      { label: t('bibliotheque.hub.issuers'), value: String(issuers.length), icon: 'building' },
      { label: t('bibliotheque.hub.persons'), value: String(persons.length), icon: 'user' },
      { label: t('bibliotheque.hub.tags'), value: String(tags.length), icon: 'tag' }
    ]
  }
  const likely: HomeBlock[] = documents.likely ? [{ kind: 'message', tone: 'warning', text: t('bibliotheque.home.likely', { count: documents.likely }) }] : []
  /**
   * Les bibliothèques, **regroupées** en sections qu'on déplie ou replie : les documents (et
   * ceux de référence, et ceux des projets), le système IA (prompts, personas, skills), le
   * système (les étiquettes), l'annuaire (entreprises, personnes). Chaque groupe a de quoi
   * créer une bibliothèque de chacune de ses sortes.
   */
  const group = (id: string, icon: KindIcon, blocks: HomeBlock[], count: number): HomeBlock => ({
    kind: 'section',
    id: `bibliotheque.hub.groupe.${id}`,
    title: t(`bibliotheque.hub.group.${id}`),
    subtitle: t(`bibliotheque.hub.group.${id}.sub`, { count }),
    icon,
    blocks
  })
  // Plusieurs bibliothèques d'une sorte (la bibliothèque des documents de référence, toujours là, ne compte pas) :
  // dans chaque groupe, les cartes de ses bibliothèques, sorte par sorte.
  const several = (['document', 'prompt', 'persona', 'skill', 'issuer', 'person', 'tag'] as const).some((kind) => severalShelves(deps.places[kind].shelves()))
  if (several) {
    const placed = await deps.placedDocuments()
    const shelvesOf = (kind: 'document' | EntryKind, icon: KindIcon, items: readonly { shelf?: string; directory?: string }[]): HomeBlock => ({
      kind: 'cards',
      title: `${t(`bibliotheque.hub.${kind}s`)} · ${t('bibliotheque.hub.shelves', { count: deps.places[kind].shelves().length })}`,
      cards: shelfCards(deps.places[kind], items, icon),
      // Les prompts, personas, skills, étiquettes : une bibliothèque chacun, on n'en crée pas d'autre.
      actions: deps.places[kind].canCreateShelves === false ? [] : [{ id: `new-shelf-${kind}`, label: t('bibliotheque.shelf.new'), tooltip: t(`bibliotheque.shelf.new.${kind}.tip`), icon: 'plus', run: () => void openNewShelf(kind) }]
    })
    return {
      subtitle: t('bibliotheque.hub.subtitle'),
      blocks: [
        stats,
        ...likely,
        group('documents', 'book', [shelvesOf('document', 'book', placed)], documents.count),
        group('ia', 'spark', [shelvesOf('prompt', 'chat', prompts), shelvesOf('persona', 'spark', personas), shelvesOf('skill', 'list', skills)], prompts.length + personas.length + skills.length),
        group('systeme', 'tag', [shelvesOf('tag', 'tag', tags)], tags.length),
        group('annuaire', 'user', [shelvesOf('issuer', 'building', issuers), shelvesOf('person', 'user', persons)], issuers.length + persons.length)
      ]
    }
  }
  const card = (id: string, icon: KindIcon, count: number, page: string, extra = ''): Card => ({
    id,
    title: t(`bibliotheque.hub.${id}`),
    subtitle: t(`bibliotheque.hub.${id}.count`, { count }),
    icon,
    text: [t(`bibliotheque.hub.${id}.desc`), extra].filter(Boolean).join(' '),
    open: go(page),
    actions: [{ ...go(page), id: 'see', icon: 'chevron' }]
  })
  // Les documents de référence et les documents projet : leurs cartes, à côté de celle des documents.
  const placed = await deps.placedDocuments()
  const referenceShelf = deps.places.document.shelves().find((shelf) => shelf.reference)
  const projectShelf = deps.places.document.shelves().find((shelf) => shelf.project)
  const references = placed.filter((item) => item.shelf === REFERENCE_SHELF).length
  const projects = placed.filter((item) => item.shelf === PROJECT_SHELF).length
  /** Les cartes d'un groupe, et de quoi créer une bibliothèque de chacune de ses sortes. */
  const cards = (list: Card[], kinds: readonly ('document' | EntryKind)[]): HomeBlock[] => [
    {
      kind: 'cards',
      cards: list,
      actions: kinds.map((kind) => ({ id: `new-shelf-${kind}`, label: t(`bibliotheque.hub.newShelf.${kind}`), tooltip: t(`bibliotheque.shelf.new.${kind}.tip`), icon: 'plus' as const, run: () => void openNewShelf(kind) }))
    }
  ]
  return {
    subtitle: t('bibliotheque.hub.subtitle'),
    blocks: [
      stats,
      group(
        'documents',
        'book',
        cards(
          [
            card('documents', 'book', documents.count - references - projects, deps.documentsPage, documents.likely ? t('bibliotheque.home.likely', { count: documents.likely }) : ''),
            ...(referenceShelf ? [card('references', 'star', references, placePageOf(deps.documentsPage, { shelf: REFERENCE_SHELF, directory: '' }))] : []),
            ...(projectShelf ? [card('projects', 'briefcase', projects, placePageOf(deps.documentsPage, { shelf: PROJECT_SHELF, directory: '' }))] : [])
          ],
          ['document']
        ),
        documents.count
      ),
      group('ia', 'spark', cards([card('prompts', 'chat', prompts.length, ENTRIES_PAGE.prompt), card('personas', 'spark', personas.length, ENTRIES_PAGE.persona), card('skills', 'list', skills.length, ENTRIES_PAGE.skill)], []), prompts.length + personas.length + skills.length),
      group('systeme', 'tag', cards([card('tags', 'tag', tags.length, ENTRIES_PAGE.tag)], []), tags.length),
      group('annuaire', 'user', cards([card('issuers', 'building', issuers.length, ENTRIES_PAGE.issuer), card('persons', 'user', persons.length, ENTRIES_PAGE.person)], ['issuer', 'person']), issuers.length + persons.length)
    ]
  }
}

export function registerEntriesHome(views: ViewsRegistrar | undefined, deps: EntriesHomeDeps): void {
  if (!views || !deps.showPage) return
  const { t } = deps
  const show = deps.showPage
  views.page({ id: HUB_PAGE, title: t('bibliotheque.hub.title'), icon: 'book', load: () => hubPage(deps) })
  for (const kind of ENTRY_KINDS) {
    views.page({ id: ENTRIES_PAGE[kind], title: t(`bibliotheque.${kind}.title`), icon: ICON[kind], parent: HUB_PAGE, load: (param) => entriesPage(deps, kind, param) })
    views.page({ id: ENTRY_PAGE[kind], title: t(`bibliotheque.${kind}.one`), icon: ICON[kind], parent: ENTRIES_PAGE[kind], load: (param) => entryPage(deps, kind, param) })
    views.tile({
      id: ENTRIES_PAGE[kind],
      label: t(`bibliotheque.${kind}.title`),
      icon: ICON[kind],
      color: 'teal',
      group: t('bibliotheque.name'),
      order: { prompt: 28, persona: 29, skill: 30, issuer: 31, tag: 32, person: 33 }[kind],
      description: t(`bibliotheque.${kind}.tile`),
      page: ENTRIES_PAGE[kind],
      run: () => show(ENTRIES_PAGE[kind])
    })
  }
}
