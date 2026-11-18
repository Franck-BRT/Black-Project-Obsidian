// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les bibliothèques dans l'interface : la page **Bibliothèque** qui mène aux trois — les
 * documents, les prompts, les personas — ; pour les prompts et pour les personas, chacun sa
 * page (une carte par entrée, les favoris d'abord, une recherche, un filtre par catégorie)
 * et sa fiche (le texte, Modifier, Favori, Ouvrir sa note, Retirer).
 */

import { DEFAULT_THRESHOLD } from './skills'
import { pageWith, type Card, type Explorer, type HomeBlock, type ListItem, type PageView, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { startersFor } from './starters'
import { ENTRY_KINDS, entryCategories, type EntryKind, type EntryStore, type LibraryEntry } from './entries'
import { grouped, groupingOf, groupingSelector } from '../../core/grouping'
import { directoryGroupOf, isHere, isUnder, placeLabel, placeName, placePageOf, placeView, resolvePlace, shelfCards, type ShelfPlacesDeps } from './places'
import { CIRCUIT_SHELF, PROJECT_SHELF, REFERENCE_SHELF, severalShelves } from './shelves'
import { plainText } from '../../core/markdown'
import type { ExplorerPlace } from './explorer'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const HUB_PAGE = 'bibliotheque.accueil'
export const ENTRIES_PAGE: Readonly<Record<EntryKind, string>> = {
  prompt: 'bibliotheque.prompts',
  persona: 'bibliotheque.personas',
  skill: 'bibliotheque.skills',
  issuer: 'bibliotheque.issuers',
  tag: 'bibliotheque.tags',
  person: 'bibliotheque.persons',
  glossary: 'bibliotheque.glossaire'
}
export const ENTRY_PAGE: Readonly<Record<EntryKind, string>> = { prompt: 'bibliotheque.prompt', persona: 'bibliotheque.persona', skill: 'bibliotheque.skill', issuer: 'bibliotheque.issuer', tag: 'bibliotheque.tag', person: 'bibliotheque.person', glossary: 'bibliotheque.terme' }
export const entryPageOf = (kind: EntryKind, path: string): string => pageWith(ENTRY_PAGE[kind], encodeURIComponent(path))

type KindIcon = 'book' | 'chat' | 'spark' | 'list' | 'building' | 'tag' | 'user' | 'star' | 'briefcase' | 'flow' | 'bulb'
const ICON: Readonly<Record<EntryKind, KindIcon>> = { prompt: 'chat', persona: 'spark', skill: 'list', issuer: 'building', tag: 'tag', person: 'user', glossary: 'bulb' }

/** Un document d'une entreprise : où il est (son type, sa date, son lieu), et si l'entreprise y est à confirmer. */
export interface CompanyDoc {
  record: string
  title: string
  detail: string
  toConfirm?: boolean
  /** Le nom par lequel il la cite (sans y être relié). */
  found?: string
}

/** Un document qui emploie un terme du glossaire : où il est, s'il y est relié (lien et rétrolien), la forme qu'il emploie. */
export interface TermUse {
  record: string
  title: string
  detail: string
  linked: boolean
  found?: string
}

export interface EntriesHomeDeps {
  t: Translate
  /** L'arborescence des bibliothèques (la colonne de gauche), le lieu montré marqué ; absente : l'affichage en cartes. */
  explorer?(current: ExplorerPlace): Promise<Explorer | undefined>
  stores: Readonly<Record<EntryKind, EntryStore>>
  /** Le nom d'un contexte de skill exécutable (« Sa fiche », « Les dossiers où ranger »). */
  skillContextLabel?(key: string): string
  /** La page des documents, et ses chiffres pour l'accueil de la bibliothèque. */
  documentsPage: string
  documents(): Promise<{ count: number; likely: number }>
  showPage?(id: string): void
  /** Toute la bibliothèque d'un coup : l'exporter en une archive, en importer une. */
  exportAll?(): Promise<void>
  importAll?(): Promise<void>
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
  /** La supprimer (sa note à la corbeille), après confirmation ; absent sans corbeille. */
  remove?(kind: EntryKind, path: string): Promise<boolean>
  /** Écrire les exemples qui manquent. */
  addStarters(kind: EntryKind): Promise<void>
  /** Un terme du glossaire : les documents qui l'emploient (le terme, son sigle ou une autre forme, ou reliés par le circuit). */
  documentsUsing?(path: string): Promise<TermUse[]>
  /** Relier à un document les termes du glossaire qu'il emploie (la recherche dans le glossaire, sans IA). */
  linkTermIn?(record: string): Promise<void>
  /** Une entreprise : les documents qu'elle émet, et ceux qui la citent (reliés à sa note). */
  companyDocuments?(entry: LibraryEntry): Promise<{ issued: CompanyDoc[]; cited: CompanyDoc[] }>
  /** Une personne : les documents qui y sont reliés, et ceux qui la citent sans y être reliés. */
  personDocuments?(entry: LibraryEntry): Promise<{ linked: CompanyDoc[]; cited: CompanyDoc[] }>
  /** Relier un document à une note (la personne qu'il cite) : lien et rétrolien. */
  linkNoteIn?(record: string, path: string, why: string): Promise<void>
  /** Un prompt, un persona, un skill : les workflows dont une étape le nomme (champ « Prompt », « Persona », « Skill »). */
  usedBy?(kind: 'prompt' | 'persona' | 'skill', name: string): readonly { id: string; name: string; enabled: boolean; system: boolean; steps: number[] }[]
  /** Ouvrir la fiche d'un workflow. */
  showWorkflow?(id: string): void
  /** Une étiquette : les documents qui la portent, et ceux où elle est suggérée (à confirmer). */
  tagDocuments?(entry: LibraryEntry): Promise<{ tagged: CompanyDoc[]; suggested: CompanyDoc[] }>
  /** Ajouter une étiquette à un document. */
  tagDocument?(record: string, name: string): Promise<void>
  /** Ouvrir la fiche d'un document. */
  showDocument?(record: string): void
}

const slug = (category: string): string =>
  `categorie-${category
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`

/** Les premiers mots d'un texte, sur une ligne. */
// L'extrait d'une carte : le texte sans sa syntaxe Markdown (titres, puces, gras…).
const excerpt = (text: string, size = 220): string => {
  const flat = plainText(text.replace(/^\s*#{1,6}\s+/gm, '').replace(/^\s*(?:[-*+]|\d{1,3}[.)])\s+/gm, ''))
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
    // Un terme du glossaire : ses autres formes (ses notes, sinon) ; rien de plus s'il n'en a pas.
    text:
      entry.kind === 'glossary'
        ? entry.aliases?.length
          ? t('bibliotheque.glossary.aliases', { forms: entry.aliases.join(', ') })
          : excerpt(entry.text)
        : (person ? [entry.email, entry.phone, excerpt(entry.text, 160)].filter(Boolean).join(' · ') : excerpt(entry.text)) || t(person ? 'bibliotheque.person.noContact' : 'bibliotheque.entry.noText'),
    ...(show ? { open: { id: 'open', label: t('bibliotheque.entry.open'), run: () => show(entryPageOf(entry.kind, entry.path)) } } : {}),
    actions: [
      {
        id: 'favorite',
        label: t(entry.favorite ? 'bibliotheque.entry.unfavorite' : 'bibliotheque.entry.makeFavorite'),
        icon: 'star',
        run: () => deps.toggleFavorite(entry.kind, entry.path)
      },
      ...(deps.remove ? [{ id: 'delete', label: t('bibliotheque.entry.delete'), tooltip: t('bibliotheque.entry.delete.tip'), icon: 'trash' as const, run: async () => void (await deps.remove!(entry.kind, entry.path)) }] : [])
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
  const explorer = await deps.explorer?.({ kind, shelf: place.shelf.id, directory: place.directory })
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
  const starters: ViewAction = { id: 'starters', label: t('bibliotheque.entry.starters'), tooltip: t(`bibliotheque.${kind}.starters.tip`), icon: 'copy', more: true, run: () => deps.addStarters(kind) }
  return {
    breadcrumb: top.breadcrumb,
    title: place.directory ? place.directory.slice(place.directory.lastIndexOf('/') + 1) : places.shelves().length > 1 ? place.shelf.name : t(`bibliotheque.${kind}.title`),
    ...(param
      ? { back: { id: 'back', label: t('bibliotheque.back.up'), run: () => deps.showPage?.(place.directory ? placePageOf(ENTRIES_PAGE[kind], { shelf: place.shelf.id, directory: place.directory.split('/').slice(0, -1).join('/') }) : HUB_PAGE) } }
      : {}),
    subtitle: t(`bibliotheque.${kind}.subtitle`, { folder: top.folder }) + top.note,
    actions: [create, ...(startersFor(kind, 'fr').length ? [starters] : []), ...top.actions],
    layouts: explorer ? ['list', 'cards'] : ['cards', 'list'],
    ...(explorer ? { explorer } : {}),
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
          // Les chiffres du lieu : en explorateur, l'arborescence les dit déjà.
          ...(explorer
            ? []
            : [
                {
                  kind: 'stats' as const,
                  stats: [
                    { label: t(`bibliotheque.${kind}.count`), value: String(under.length), icon: ICON[kind] },
                    { label: t('bibliotheque.entry.favorites'), value: String(under.filter((entry) => entry.favorite).length), icon: 'star' as const },
                    { label: t('bibliotheque.entry.categories'), value: String(entryCategories(under).length), icon: 'list' as const }
                  ]
                }
              ]),
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
      : [{ kind: 'message' as const, tone: 'info' as const, text: t(top.blocks.length ? 'bibliotheque.place.empty' : `bibliotheque.${kind}.empty`), // « Nouveau… » est en tête de page ; reste « Ajouter les exemples » (rangé sinon dans « … »).
        actions: [{ ...starters, primary: false, more: false }] }])
    ]
  }
}

/** Où une entrée est rangée, en mots : sa bibliothèque (à sa racine), sinon le chemin de son répertoire. */
const placeText = (places: ShelfPlacesDeps, entry: LibraryEntry): string => (entry.directory ? placeLabel(places, entry) : placeName(places.shelves(), entry.shelf, entry.directory) || placeLabel(places, entry))

/** Son texte à soi (la section des rétroliens est à part, `backlinks` : la page les dit ailleurs). */
const ownText = (_deps: EntriesHomeDeps, entry: LibraryEntry): string => (entry.text ?? '').trim()

/**
 * **La fiche d'un prompt, d'un persona, d'un skill** : ses chiffres en tête (les workflows qui s'en
 * servent ; un skill : son seuil, ce qu'il reçoit) ; son texte (la question, les consignes, la
 * procédure), mis en forme ; l'entrée en lignes (nom, catégorie, description, rangée), chacune avec
 * son bouton ; un skill exécutable : ce qu'il reçoit, ce qu'il rend, son seuil ; les workflows dont
 * une étape le nomme — un clic ouvre le workflow.
 */
async function aiEntryPage(deps: EntriesHomeDeps, entry: LibraryEntry, kind: EntryKind, page: { back: ViewAction; actions: ViewAction[]; explorer?: Explorer }): Promise<PageView> {
  const { t } = deps
  const section = (id: string, title: string, subtitle: string, icon: 'book' | 'info' | 'flow' | 'settings', blocks: HomeBlock[], open = true): HomeBlock => ({
    kind: 'section',
    id: `bibliotheque.entree.${id}`,
    title,
    ...(subtitle ? { subtitle } : {}),
    icon,
    collapsed: !open,
    blocks
  })
  const move = page.actions.find((action) => action.id === 'move')
  const edit = page.actions.find((action) => action.id === 'edit')
  const editTool = (title: string): ViewAction[] => (edit ? [{ ...edit, id: `edit-${title}`, label: t('bibliotheque.term.editField', { field: title }), primary: false }] : [])
  const row = (id: string, title: string, value: string, tools: ViewAction[] = editTool(title)): ListItem => ({ id, title, detail: value || '—', ...(tools.length ? { tools } : {}) })
  const uses = kind === 'prompt' || kind === 'persona' || kind === 'skill' ? (deps.usedBy?.(kind, entry.name) ?? []) : []
  const skill = kind === 'skill'
  const executable = skill && (!!entry.context?.length || !!entry.output)
  const threshold = `${Math.round((entry.threshold ?? DEFAULT_THRESHOLD) * 100)} %`
  const text = ownText(deps, entry)
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0
  return {
    title: entryTitle(entry),
    ...(page.explorer ? { explorer: page.explorer } : {}),
    back: page.back,
    subtitle: [t(`bibliotheque.${kind}.one`), entry.category, entry.favorite ? t('bibliotheque.entry.favorite') : ''].filter(Boolean).join(' · '),
    actions: page.actions,
    blocks: [
      // Ses chiffres, en tête.
      {
        kind: 'stats',
        stats: [
          { label: t('bibliotheque.aiEntry.stat.workflows'), value: String(uses.length), icon: 'flow' },
          { label: t('bibliotheque.aiEntry.stat.words'), value: String(words), icon: 'book' },
          ...(executable ? [{ label: t('bibliotheque.aiEntry.stat.threshold'), value: threshold, icon: 'gauge' as const }] : [])
        ]
      },
      // Sa description, en une phrase, s'il en a une.
      ...(entry.description ? [{ kind: 'text' as const, title: t('bibliotheque.aiEntry.description'), paragraphs: [entry.description] }] : []),
      // Son texte, mis en forme : titres, listes, gras…
      section('texte', t(`bibliotheque.${kind}.text`), words ? t('bibliotheque.aiEntry.words', { count: words }) : t('bibliotheque.entry.noText'), 'book', [{ kind: 'markdown', text, empty: t('bibliotheque.entry.noText') }]),
      // Un skill exécutable : ce qu'il reçoit, ce qu'il rend, son seuil.
      ...(executable
        ? [
            section('execution', t('bibliotheque.skill.executable'), t(entry.output ? `bibliotheque.skill.output.${entry.output}` : 'bibliotheque.skill.output.none'), 'settings', [
              {
                kind: 'list',
                fields: true,
                items: [
                  row('contexte', t('bibliotheque.aiEntry.field.context'), (entry.context ?? []).map((key) => deps.skillContextLabel?.(key) ?? key).join(', ')),
                  row('sortie', t('bibliotheque.aiEntry.field.output'), t(entry.output ? `bibliotheque.skill.output.${entry.output}` : 'bibliotheque.skill.output.none')),
                  row('seuil', t('bibliotheque.aiEntry.field.threshold'), t('bibliotheque.aiEntry.threshold', { threshold }))
                ]
              }
            ])
          ]
        : []),
      // L'entrée : son nom, sa catégorie, sa description, où elle est.
      section('entree', t(`bibliotheque.aiEntry.section.${kind}`), entry.category, 'info', [
        {
          kind: 'list',
          fields: true,
          items: [
            row('name', t('bibliotheque.aiEntry.field.name'), entry.name),
            row('category', t('bibliotheque.aiEntry.field.category'), entry.category),
            row('description', t('bibliotheque.aiEntry.field.description'), entry.description),
            row('place', t('bibliotheque.aiEntry.field.place'), placeText(deps.places[kind], entry), move ? [{ ...move, primary: false }] : [])
          ]
        }
      ], false),
      // Les workflows qui s'en servent : un clic ouvre le workflow.
      section('workflows', t('bibliotheque.aiEntry.workflows', { count: uses.length }), '', 'flow', [
        {
          kind: 'list',
          items: uses.map((use) => ({
            id: `workflow-${use.id}`,
            title: use.name,
            detail: [t('bibliotheque.aiEntry.steps', { steps: use.steps.join(', '), count: use.steps.length }), t(use.enabled ? 'bibliotheque.aiEntry.enabled' : 'bibliotheque.aiEntry.disabled'), use.system ? t('bibliotheque.aiEntry.system') : ''].filter(Boolean).join(' · '),
            icon: 'flow' as const,
            tone: use.enabled ? ('success' as const) : ('neutral' as const),
            ...(deps.showWorkflow ? { open: { id: 'open', label: t('bibliotheque.aiEntry.openWorkflow'), run: () => deps.showWorkflow!(use.id) } } : {})
          })),
          empty: t(`bibliotheque.aiEntry.workflows.none.${kind}`)
        }
      ])
    ]
  }
}

/**
 * **La fiche d'une étiquette** : ses chiffres en tête (documents qui la portent, où elle est
 * suggérée) ; l'étiquette en lignes (nom, autres formes, catégorie, description, rangée), chacune avec
 * son bouton ; les documents qui la portent ; ceux où elle est suggérée — « Ajouter » la leur donne ;
 * les autres étiquettes de sa catégorie.
 */
async function tagPage(deps: EntriesHomeDeps, entry: LibraryEntry, page: { back: ViewAction; actions: ViewAction[]; explorer?: Explorer }): Promise<PageView> {
  const { t } = deps
  const section = (id: string, title: string, subtitle: string, icon: 'tag' | 'file' | 'bulb', blocks: HomeBlock[], open = true): HomeBlock => ({
    kind: 'section',
    id: `bibliotheque.etiquette.${id}`,
    title,
    ...(subtitle ? { subtitle } : {}),
    icon,
    collapsed: !open,
    blocks
  })
  const move = page.actions.find((action) => action.id === 'move')
  const edit = page.actions.find((action) => action.id === 'edit')
  const editTool = (field: string): ViewAction[] => (edit ? [{ ...edit, id: `edit-${field}`, label: t('bibliotheque.term.editField', { field: t(`bibliotheque.tagPage.field.${field}`) }), primary: false }] : [])
  const row = (id: string, value: string, tools: ViewAction[] = []): ListItem => ({ id, title: t(`bibliotheque.tagPage.field.${id}`), detail: value || '—', ...(tools.length ? { tools } : {}) })
  const forms = entry.text
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line && !line.startsWith('#'))
  const { tagged, suggested } = deps.tagDocuments ? await deps.tagDocuments(entry) : { tagged: [], suggested: [] }
  const docItem = (doc: CompanyDoc, suggestion: boolean): ListItem => ({
    id: `document-${doc.record}`,
    title: doc.title,
    detail: [doc.detail, suggestion ? t('bibliotheque.tagPage.suggestedHere') : ''].filter(Boolean).join(' · '),
    icon: suggestion ? 'alert' : 'tag',
    tone: suggestion ? 'warning' : 'success',
    ...(deps.showDocument ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => deps.showDocument!(doc.record) } } : {}),
    ...(suggestion && deps.tagDocument ? { actions: [{ id: `ajouter-${doc.record}`, label: t('bibliotheque.tagPage.add'), tooltip: t('bibliotheque.tagPage.add.tip', { tag: entry.name }), icon: 'plus' as const, run: () => deps.tagDocument!(doc.record, entry.name) }] } : {})
  })
  const neighbours = entry.category ? (await deps.stores.tag.all()).filter((each) => each.path !== entry.path && each.category === entry.category).sort((a, b) => a.name.localeCompare(b.name, 'fr')) : []
  return {
    title: entryTitle(entry),
    ...(page.explorer ? { explorer: page.explorer } : {}),
    back: page.back,
    subtitle: [t('bibliotheque.tag.one'), entry.category, entry.favorite ? t('bibliotheque.entry.favorite') : ''].filter(Boolean).join(' · '),
    actions: page.actions,
    blocks: [
      // Ses chiffres, en tête.
      {
        kind: 'stats',
        stats: [
          { label: t('bibliotheque.tagPage.stat.tagged'), value: String(tagged.length), icon: 'tag' },
          { label: t('bibliotheque.tagPage.stat.suggested'), value: String(suggested.length), icon: 'alert' }
        ]
      },
      // L'étiquette : ce qui la désigne, et où elle est.
      section('etiquette', t('bibliotheque.tagPage.section'), forms.length ? t('bibliotheque.term.forms.count', { count: forms.length }) : '', 'tag', [
        {
          kind: 'list',
          fields: true,
          items: [
            row('name', entry.name, editTool('name')),
            { ...row('forms', forms.join(', '), editTool('forms')), ...(forms.length ? {} : { detail: t('bibliotheque.tagPage.noForms') }) },
            row('category', entry.category, editTool('category')),
            row('description', entry.description, editTool('description')),
            row('place', placeText(deps.places.tag, entry), move ? [{ ...move, primary: false }] : [])
          ]
        }
      ]),
      // Les documents qui la portent.
      section('documents', t('bibliotheque.tagPage.tagged', { count: tagged.length }), '', 'file', [{ kind: 'list', items: tagged.map((doc) => docItem(doc, false)), empty: t('bibliotheque.tagPage.tagged.none') }]),
      // Ceux où elle est suggérée : « Ajouter » la leur donne.
      ...(suggested.length
        ? [
            section('suggeree', t('bibliotheque.tagPage.suggested', { count: suggested.length }), t('bibliotheque.tagPage.suggested.sub'), 'file', [
              ...(suggested.length > 1 && deps.tagDocument
                ? [
                    {
                      kind: 'actions' as const,
                      actions: [
                        {
                          id: 'ajouter-tous',
                          label: t('bibliotheque.tagPage.addAll', { count: suggested.length }),
                          tooltip: t('bibliotheque.tagPage.add.tip', { tag: entry.name }),
                          icon: 'plus' as const,
                          run: async () => {
                            for (const doc of suggested) await deps.tagDocument!(doc.record, entry.name)
                          }
                        }
                      ]
                    }
                  ]
                : []),
              { kind: 'list', items: suggested.map((doc) => docItem(doc, true)) }
            ])
          ]
        : []),
      // Les autres étiquettes de sa catégorie.
      ...(neighbours.length
        ? [
            section(
              'voisines',
              t('bibliotheque.tagPage.neighbours', { category: entry.category, count: neighbours.length }),
              neighbours.slice(0, 8).map((each) => each.name).join(' · '),
              'tag',
              [
                {
                  kind: 'list',
                  items: neighbours.map((each) => ({
                    id: `etiquette-${each.path}`,
                    title: each.name,
                    ...(each.description ? { detail: each.description } : {}),
                    icon: 'tag' as const,
                    ...(deps.showPage ? { open: { id: 'open', label: t('bibliotheque.entry.open'), run: () => deps.showPage?.(entryPageOf('tag', each.path)) } } : {})
                  }))
                }
              ],
              false
            )
          ]
        : [])
    ]
  }
}

/**
 * **La fiche d'une personne** : ses chiffres en tête (documents qui la citent, collègues) ; la
 * personne en lignes (nom, fonction, entreprise — un clic l'ouvre —, adresse, téléphone, catégorie,
 * rangée), chacune avec son bouton ; les documents qui la citent — reliés (lien et rétrolien), ou
 * seulement nommés, à relier d'un clic ; ses collègues de la même entreprise ; ses notes.
 */
async function personPage(deps: EntriesHomeDeps, entry: LibraryEntry, page: { back: ViewAction; actions: ViewAction[]; explorer?: Explorer }): Promise<PageView> {
  const { t } = deps
  const section = (id: string, title: string, subtitle: string, icon: 'user' | 'file' | 'users' | 'book', blocks: HomeBlock[], open = true): HomeBlock => ({
    kind: 'section',
    id: `bibliotheque.personne.${id}`,
    title,
    ...(subtitle ? { subtitle } : {}),
    icon,
    collapsed: !open,
    blocks
  })
  const move = page.actions.find((action) => action.id === 'move')
  const edit = page.actions.find((action) => action.id === 'edit')
  const editTool = (field: string): ViewAction[] => (edit ? [{ ...edit, id: `edit-${field}`, label: t('bibliotheque.term.editField', { field: t(`bibliotheque.person.field.${field}`) }), primary: false }] : [])
  const row = (id: string, value: string, tools: ViewAction[] = []): ListItem => ({ id, title: t(`bibliotheque.person.field.${id}`), detail: value || '—', ...(tools.length ? { tools } : {}) })
  const companies = await deps.stores.issuer.all()
  const company = entry.company ? companyOf(entry.company, companies) : undefined
  const colleagues = company ? (await deps.stores.person.all()).filter((each) => each.path !== entry.path && each.company && companyOf(each.company, companies)?.path === company.path).sort((a, b) => a.name.localeCompare(b.name, 'fr')) : []
  const { linked, cited } = deps.personDocuments ? await deps.personDocuments(entry) : { linked: [], cited: [] }
  const why = t('bibliotheque.person.why', { name: entry.name })
  const docItem = (doc: CompanyDoc): ListItem => ({
    id: `document-${doc.record}`,
    title: doc.title,
    detail: [doc.detail, doc.found ? t('bibliotheque.person.cited', { form: doc.found }) : t('bibliotheque.term.linked')].filter(Boolean).join(' · '),
    icon: doc.found ? 'file' : 'link',
    tone: doc.found ? 'neutral' : 'success',
    ...(deps.showDocument ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => deps.showDocument!(doc.record) } } : {}),
    ...(doc.found && deps.linkNoteIn ? { actions: [{ id: `relier-${doc.record}`, label: t('bibliotheque.term.link'), tooltip: t('bibliotheque.person.link.tip'), icon: 'link' as const, run: () => deps.linkNoteIn!(doc.record, entry.path, why) }] } : {})
  })
  const companyRow: ListItem = {
    ...row('company', entry.company ? companyLabel(entry.company, companies) + (company ? '' : ` — ${t('bibliotheque.person.companyOutside')}`) : '', editTool('company')),
    ...(company && deps.showPage ? { open: { id: 'open', label: t('bibliotheque.entry.open'), run: () => deps.showPage?.(entryPageOf('issuer', company.path)) } } : {})
  }
  const notes = ownText(deps, entry)
  return {
    title: entryTitle(entry),
    ...(page.explorer ? { explorer: page.explorer } : {}),
    back: page.back,
    subtitle: [t('bibliotheque.person.one'), personLine(entry, companies), entry.category, entry.favorite ? t('bibliotheque.entry.favorite') : ''].filter(Boolean).join(' · '),
    actions: page.actions,
    blocks: [
      // Ses chiffres, en tête.
      {
        kind: 'stats',
        stats: [
          { label: t('bibliotheque.person.stat.documents'), value: String(linked.length + cited.length), icon: 'file' },
          { label: t('bibliotheque.person.stat.colleagues'), value: String(colleagues.length), icon: 'users' }
        ]
      },
      // La personne : qui elle est, comment la joindre, où est sa note.
      section('personne', t('bibliotheque.person.section'), [entry.description, company ? company.code || company.name : entry.company ?? ''].filter(Boolean).join(' · '), 'user', [
        {
          kind: 'list',
          fields: true,
          items: [
            row('name', entry.name, editTool('name')),
            row('role', entry.description, editTool('role')),
            companyRow,
            row('email', entry.email ?? '', editTool('email')),
            row('phone', entry.phone ?? '', editTool('phone')),
            row('category', entry.category, editTool('category')),
            row('place', placeText(deps.places.person, entry), move ? [{ ...move, primary: false }] : [])
          ]
        }
      ]),
      // Les documents qui la citent : reliés d'abord, puis nommés sans lien.
      section(
        'documents',
        t('bibliotheque.person.documents', { count: linked.length + cited.length }),
        [linked.length ? t('bibliotheque.term.uses.linked', { count: linked.length }) : '', cited.length ? t('bibliotheque.term.uses.cited', { count: cited.length }) : ''].filter(Boolean).join(' · '),
        'file',
        [
          ...(cited.length > 1 && deps.linkNoteIn
            ? [
                {
                  kind: 'message' as const,
                  tone: 'info' as const,
                  text: t('bibliotheque.person.citedOnly', { count: cited.length }),
                  actions: [
                    {
                      id: 'relier-tous',
                      label: t('bibliotheque.term.linkAll', { count: cited.length }),
                      tooltip: t('bibliotheque.person.link.tip'),
                      icon: 'link' as const,
                      run: async () => {
                        for (const doc of cited) await deps.linkNoteIn!(doc.record, entry.path, why)
                      }
                    }
                  ]
                }
              ]
            : []),
          { kind: 'list', items: [...linked, ...cited].map(docItem), empty: t('bibliotheque.person.documents.none') }
        ]
      ),
      // Ses collègues : la même entreprise.
      ...(company && colleagues.length
        ? [
            section('collegues', t('bibliotheque.person.colleagues', { company: company.code || company.name, count: colleagues.length }), '', 'users', [
              {
                kind: 'list',
                items: colleagues.map((each) => ({
                  id: each.path,
                  title: each.name,
                  detail: [each.description, each.email, each.phone].filter(Boolean).join(' · '),
                  icon: 'user' as const,
                  ...(deps.showPage ? { open: { id: 'open', label: t('bibliotheque.entry.open'), run: () => deps.showPage?.(entryPageOf('person', each.path)) } } : {})
                }))
              }
            ])
          ]
        : []),
      // Ses notes.
      section('notes', t('bibliotheque.person.text'), notes ? '' : t('bibliotheque.entry.noText'), 'book', [{ kind: 'markdown', text: notes, empty: t('bibliotheque.entry.noText') }], !!notes)
    ]
  }
}

/**
 * **La fiche d'une entreprise** : ses chiffres en tête (documents émis, documents qui la citent,
 * personnes) ; l'entreprise (code, nom, rôle, catégorie, autres noms, rangée), chaque ligne avec son
 * bouton ; les documents qu'elle émet (ceux où elle est à confirmer, dits) ; ceux qui la citent sans
 * être émis par elle (reliés par le circuit) ; ses personnes.
 */
async function companyPage(deps: EntriesHomeDeps, entry: LibraryEntry, page: { back: ViewAction; actions: ViewAction[]; explorer?: Explorer }): Promise<PageView> {
  const { t } = deps
  const section = (id: string, title: string, subtitle: string, icon: 'info' | 'file' | 'link' | 'users', blocks: HomeBlock[], open = true): HomeBlock => ({
    kind: 'section',
    id: `bibliotheque.entreprise.${id}`,
    title,
    ...(subtitle ? { subtitle } : {}),
    icon,
    collapsed: !open,
    blocks
  })
  const move = page.actions.find((action) => action.id === 'move')
  const edit = page.actions.find((action) => action.id === 'edit')
  const editTool = (field: string): ViewAction[] => (edit ? [{ ...edit, id: `edit-${field}`, label: t('bibliotheque.term.editField', { field: t(`bibliotheque.company.field.${field}`) }), primary: false }] : [])
  const row = (id: string, value: string, tools: ViewAction[] = []): ListItem => ({ id, title: t(`bibliotheque.company.field.${id}`), detail: value || '—', ...(tools.length ? { tools } : {}) })
  const names = entry.text
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line && !line.startsWith('#'))
  const { issued, cited } = deps.companyDocuments ? await deps.companyDocuments(entry) : { issued: [], cited: [] }
  const companies = await deps.stores.issuer.all()
  const people = (await deps.stores.person.all()).filter((each) => each.company && companyOf(each.company, companies)?.path === entry.path).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const docItem = (doc: CompanyDoc): ListItem => ({
    id: `document-${doc.record}`,
    title: doc.title,
    detail: [doc.detail, doc.toConfirm ? t('bibliotheque.company.toConfirm') : ''].filter(Boolean).join(' · '),
    icon: 'file',
    ...(doc.toConfirm ? { tone: 'warning' as const } : {}),
    ...(deps.showDocument ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => deps.showDocument!(doc.record) } } : {})
  })
  const toConfirm = issued.filter((doc) => doc.toConfirm).length
  return {
    title: entryTitle(entry),
    ...(page.explorer ? { explorer: page.explorer } : {}),
    back: page.back,
    subtitle: [t('bibliotheque.issuer.one'), entry.description, entry.category, entry.favorite ? t('bibliotheque.entry.favorite') : ''].filter(Boolean).join(' · '),
    actions: page.actions,
    blocks: [
      // Ses chiffres, en tête.
      {
        kind: 'stats',
        stats: [
          { label: t('bibliotheque.company.stat.issued'), value: String(issued.length), icon: 'file' },
          { label: t('bibliotheque.company.stat.cited'), value: String(cited.length), icon: 'link' },
          { label: t('bibliotheque.company.stat.people'), value: String(people.length), icon: 'users' }
        ]
      },
      // L'entreprise : ce qui la désigne, et où elle est.
      section('entreprise', t('bibliotheque.company.section'), [entry.code, names.length ? t('bibliotheque.company.names.count', { count: names.length }) : ''].filter(Boolean).join(' · '), 'info', [
        {
          kind: 'list',
          fields: true,
          items: [
            row('code', entry.code ?? '', editTool('code')),
            row('name', entry.name, editTool('name')),
            row('role', entry.description, editTool('role')),
            row('category', entry.category, editTool('category')),
            { ...row('names', names.join(', '), editTool('names')), ...(names.length ? {} : { detail: t('bibliotheque.company.noNames') }) },
            row('place', placeText(deps.places.issuer, entry), move ? [{ ...move, primary: false }] : [])
          ]
        }
      ]),
      // Les documents qu'elle émet.
      section('emis', t('bibliotheque.company.issued', { count: issued.length }), toConfirm ? t('bibliotheque.company.issued.toConfirm', { count: toConfirm }) : '', 'file', [
        { kind: 'list', items: issued.map(docItem), empty: t('bibliotheque.company.issued.none') }
      ]),
      // Ceux qui la citent, sans être émis par elle.
      ...(cited.length ? [section('cites', t('bibliotheque.company.cited', { count: cited.length }), t('bibliotheque.company.cited.sub'), 'link', [{ kind: 'list', items: cited.map(docItem) }])] : []),
      // Ses personnes.
      section('personnes', t('bibliotheque.issuer.people', { count: people.length }), '', 'users', [
        {
          kind: 'list',
          items: people.map((each) => ({
            id: each.path,
            title: each.name,
            detail: [each.description, each.email, each.phone].filter(Boolean).join(' · '),
            icon: 'user' as const,
            ...(deps.showPage ? { open: { id: 'open', label: t('bibliotheque.entry.open'), run: () => deps.showPage?.(entryPageOf('person', each.path)) } } : {})
          })),
          empty: t('bibliotheque.issuer.people.none')
        }
      ], people.length > 0)
    ]
  }
}

/**
 * **La fiche d'un terme du glossaire** : sa définition en tête ; le terme (son nom, son sigle, son
 * domaine, ses autres formes, où il est rangé) ; les documents qui l'emploient — reliés (lien et
 * rétrolien) ou seulement cités, à relier d'un clic ; les autres termes de son domaine ; ses notes
 * (sans les rétroliens, déjà dits au-dessus).
 */
async function termPage(deps: EntriesHomeDeps, entry: LibraryEntry, page: { back: ViewAction; actions: ViewAction[]; explorer?: Explorer }): Promise<PageView> {
  const { t } = deps
  const section = (id: string, title: string, subtitle: string, icon: 'info' | 'file' | 'bulb' | 'book', blocks: HomeBlock[], open = true): HomeBlock => ({
    kind: 'section',
    id: `bibliotheque.terme.${id}`,
    title,
    ...(subtitle ? { subtitle } : {}),
    icon,
    collapsed: !open,
    blocks
  })
  const move = page.actions.find((action) => action.id === 'move')
  const edit = page.actions.find((action) => action.id === 'edit')
  const editTool = (field: string): ViewAction[] => (edit ? [{ ...edit, id: `edit-${field}`, label: t('bibliotheque.term.editField', { field: t(`bibliotheque.term.field.${field}`) }), primary: false }] : [])
  const row = (id: string, value: string, tools: ViewAction[] = []): ListItem => ({ id, title: t(`bibliotheque.term.field.${id}`), detail: value || '—', ...(tools.length ? { tools } : {}) })
  const forms = entry.aliases ?? []
  // Les documents qui l'emploient : reliés d'abord, puis ceux qui le citent sans y être reliés.
  const uses = deps.documentsUsing ? await deps.documentsUsing(entry.path) : []
  const linked = uses.filter((use) => use.linked)
  const cited = uses.filter((use) => !use.linked)
  const useItem = (use: TermUse): ListItem => ({
    id: `document-${use.record}`,
    title: use.title,
    detail: [use.detail, use.linked ? t('bibliotheque.term.linked') : t('bibliotheque.term.cited', { form: use.found ?? entry.name })].filter(Boolean).join(' · '),
    icon: use.linked ? 'link' : 'file',
    tone: use.linked ? 'success' : 'neutral',
    ...(deps.showDocument ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => deps.showDocument!(use.record) } } : {}),
    ...(!use.linked && deps.linkTermIn ? { actions: [{ id: `relier-${use.record}`, label: t('bibliotheque.term.link'), tooltip: t('bibliotheque.term.link.tip'), icon: 'link' as const, run: () => deps.linkTermIn!(use.record) }] } : {})
  })
  // Les autres termes de son domaine : pour passer de l'un à l'autre.
  const neighbours = entry.category ? (await deps.stores.glossary.all()).filter((each) => each.path !== entry.path && each.category === entry.category).sort((a, b) => a.name.localeCompare(b.name, 'fr')) : []
  const notes = ownText(deps, entry)
  return {
    title: entryTitle(entry),
    ...(page.explorer ? { explorer: page.explorer } : {}),
    back: page.back,
    subtitle: [t('bibliotheque.glossary.one'), entry.category, entry.favorite ? t('bibliotheque.entry.favorite') : ''].filter(Boolean).join(' · '),
    actions: page.actions,
    blocks: [
      // Sa définition, en tête.
      entry.description
        ? { kind: 'text', title: t('bibliotheque.glossary.field.description'), paragraphs: [entry.description] }
        : { kind: 'message', tone: 'warning', text: t('bibliotheque.term.noDefinition'), ...(edit ? { actions: [edit] } : {}) },
      // Le terme : ce qui le désigne, et où il est.
      section('terme', t('bibliotheque.term.section'), [entry.code, forms.length ? t('bibliotheque.term.forms.count', { count: forms.length }) : ''].filter(Boolean).join(' · '), 'info', [
        {
          kind: 'list',
          fields: true,
          items: [
            row('name', entry.name, editTool('name')),
            row('code', entry.code ?? '', editTool('code')),
            row('category', entry.category, editTool('category')),
            { ...row('aliases', forms.join(', '), editTool('aliases')), ...(forms.length ? {} : { detail: t('bibliotheque.term.noForms') }) },
            row('place', placeText(deps.places.glossary, entry), move ? [{ ...move, primary: false }] : [])
          ]
        }
      ]),
      // Les documents qui l'emploient.
      section('documents', t('bibliotheque.glossary.usedIn', { count: uses.length }), [linked.length ? t('bibliotheque.term.uses.linked', { count: linked.length }) : '', cited.length ? t('bibliotheque.term.uses.cited', { count: cited.length }) : ''].filter(Boolean).join(' · '), 'file', [
        ...(cited.length > 1 && deps.linkTermIn
          ? [
              {
                kind: 'message' as const,
                tone: 'info' as const,
                text: t('bibliotheque.term.citedOnly', { count: cited.length }),
                actions: [
                  {
                    id: 'relier-tous',
                    label: t('bibliotheque.term.linkAll', { count: cited.length }),
                    tooltip: t('bibliotheque.term.link.tip'),
                    icon: 'link' as const,
                    run: async () => {
                      for (const use of cited) await deps.linkTermIn!(use.record)
                    }
                  }
                ]
              }
            ]
          : []),
        { kind: 'list', items: [...linked, ...cited].map(useItem), empty: t('bibliotheque.glossary.usedIn.none') }
      ]),
      // Les autres termes de son domaine.
      ...(neighbours.length
        ? [
            section(
              'domaine',
              t('bibliotheque.term.neighbours', { category: entry.category, count: neighbours.length }),
              neighbours.slice(0, 6).map((each) => each.code || each.name).join(' · '),
              'bulb',
              [
                {
                  kind: 'list',
                  items: neighbours.map((each) => ({
                    id: `terme-${each.path}`,
                    title: entryTitle(each),
                    ...(each.description ? { detail: each.description } : {}),
                    icon: 'bulb' as const,
                    ...(deps.showPage ? { open: { id: 'open', label: t('bibliotheque.entry.open'), run: () => deps.showPage?.(entryPageOf('glossary', each.path)) } } : {})
                  }))
                }
              ],
              false
            )
          ]
        : []),
      // Ses notes : exemples, références (sans les rétroliens).
      section('notes', t('bibliotheque.glossary.text'), notes ? '' : t('bibliotheque.entry.noText'), 'book', [{ kind: 'markdown', text: notes, empty: t('bibliotheque.entry.noText') }], !!notes)
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
  const explorer = await deps.explorer?.({ kind, shelf: entry.shelf ?? '', directory: entry.directory ?? '' })
  const actions: ViewAction[] = [
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
    // Les actions secondaires : dans le menu « … ».
    { id: 'note', label: t('bibliotheque.entry.note'), icon: 'book', more: true, run: () => deps.showNote(entry.path) },
    {
      id: 'aside',
      label: t('bibliotheque.entry.setAside'),
      tooltip: t('bibliotheque.entry.setAside.tip'),
      icon: 'archive',
      more: true,
      run: async () => {
        if (await deps.setAside(kind, entry.path)) deps.showPage?.(home)
      }
    },
    ...(deps.remove
      ? [
          {
            id: 'delete',
            label: t('bibliotheque.entry.delete'),
            tooltip: t('bibliotheque.entry.delete.tip'),
            icon: 'trash' as const,
            more: true,
            run: async () => {
              if (await deps.remove!(kind, entry.path)) deps.showPage?.(home)
            }
          }
        ]
      : [])
  ]
  // Un terme du glossaire, une entreprise, une personne, une étiquette : leur page à eux.
  if (kind === 'glossary') return termPage(deps, entry, { back, actions, ...(explorer ? { explorer } : {}) })
  if (kind === 'issuer') return companyPage(deps, entry, { back, actions, ...(explorer ? { explorer } : {}) })
  if (kind === 'person') return personPage(deps, entry, { back, actions, ...(explorer ? { explorer } : {}) })
  if (kind === 'tag') return tagPage(deps, entry, { back, actions, ...(explorer ? { explorer } : {}) })
  return aiEntryPage(deps, entry, kind, { back, actions, ...(explorer ? { explorer } : {}) })
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
  const glossary = await deps.stores.glossary.all()
  const persons = await deps.stores.person.all()
  const go = (page: string): ViewAction => ({ id: 'open', label: t('bibliotheque.hub.open'), run: () => deps.showPage?.(page) })
  /** Créer une bibliothèque, puis l'ouvrir (sa page la montre aussitôt, vide). */
  const openNewShelf = async (kind: 'document' | EntryKind): Promise<void> => {
    const shelf = await deps.places[kind].newShelf(kind)
    if (shelf) deps.showPage?.(placePageOf(deps.places[kind].page, { shelf: shelf.id, directory: '' }))
  }
  // Toute la bibliothèque, d'un coup : à se passer (une archive), ou reprise d'une autre.
  const wholeActions: ViewAction[] = [
    ...(deps.exportAll ? [{ id: 'export-all', label: t('bibliotheque.exchange.exportAll'), tooltip: t('bibliotheque.exchange.exportAll.tip'), icon: 'archive' as const, more: true, run: () => deps.exportAll!() }] : []),
    ...(deps.importAll ? [{ id: 'import-all', label: t('bibliotheque.exchange.importAll'), tooltip: t('bibliotheque.exchange.importAll.tip'), icon: 'upload' as const, more: true, run: () => deps.importAll!() }] : [])
  ]
  const stats: HomeBlock = {
    kind: 'stats',
    stats: [
      { label: t('bibliotheque.hub.documents'), value: String(documents.count), icon: 'book' },
      { label: t('bibliotheque.hub.prompts'), value: String(prompts.length), icon: 'chat' },
      { label: t('bibliotheque.hub.personas'), value: String(personas.length), icon: 'spark' },
      { label: t('bibliotheque.hub.skills'), value: String(skills.length), icon: 'list' },
      { label: t('bibliotheque.hub.issuers'), value: String(issuers.length), icon: 'building' },
      { label: t('bibliotheque.hub.persons'), value: String(persons.length), icon: 'user' },
      { label: t('bibliotheque.hub.tags'), value: String(tags.length), icon: 'tag' },
      { label: t('bibliotheque.hub.glossarys'), value: String(glossary.length), icon: 'bulb' }
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
  const several = (['document', 'prompt', 'persona', 'skill', 'issuer', 'person', 'tag', 'glossary'] as const).some((kind) => severalShelves(deps.places[kind].shelves()))
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
      actions: wholeActions,
      blocks: [
        stats,
        ...likely,
        group('documents', 'book', [shelvesOf('document', 'book', placed)], documents.count),
        group('ia', 'spark', [shelvesOf('prompt', 'chat', prompts), shelvesOf('persona', 'spark', personas), shelvesOf('skill', 'list', skills)], prompts.length + personas.length + skills.length),
        group('systeme', 'tag', [shelvesOf('tag', 'tag', tags), shelvesOf('glossary', 'bulb', glossary)], tags.length + glossary.length),
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
  const circuitShelf = deps.places.document.shelves().find((shelf) => shelf.circuit)
  const inCircuit = placed.filter((item) => item.shelf === CIRCUIT_SHELF).length
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
    actions: wholeActions,
    blocks: [
      stats,
      group(
        'documents',
        'book',
        cards(
          [
            card('documents', 'book', documents.count - references - projects - inCircuit, deps.documentsPage, documents.likely ? t('bibliotheque.home.likely', { count: documents.likely }) : ''),
            ...(referenceShelf ? [card('references', 'star', references, placePageOf(deps.documentsPage, { shelf: REFERENCE_SHELF, directory: '' }))] : []),
            ...(projectShelf ? [card('projects', 'briefcase', projects, placePageOf(deps.documentsPage, { shelf: PROJECT_SHELF, directory: '' }))] : []),
            ...(circuitShelf ? [card('circuit', 'flow', inCircuit, placePageOf(deps.documentsPage, { shelf: CIRCUIT_SHELF, directory: '' }))] : [])
          ],
          ['document']
        ),
        documents.count
      ),
      group('ia', 'spark', cards([card('prompts', 'chat', prompts.length, ENTRIES_PAGE.prompt), card('personas', 'spark', personas.length, ENTRIES_PAGE.persona), card('skills', 'list', skills.length, ENTRIES_PAGE.skill)], []), prompts.length + personas.length + skills.length),
      group('systeme', 'tag', cards([card('tags', 'tag', tags.length, ENTRIES_PAGE.tag), card('glossarys', 'bulb', glossary.length, ENTRIES_PAGE.glossary)], []), tags.length + glossary.length),
      group('annuaire', 'user', cards([card('issuers', 'building', issuers.length, ENTRIES_PAGE.issuer), card('persons', 'user', persons.length, ENTRIES_PAGE.person)], ['issuer', 'person']), issuers.length + persons.length)
    ]
  }
}

export function registerEntriesHome(views: ViewsRegistrar | undefined, deps: EntriesHomeDeps): void {
  if (!views || !deps.showPage) return
  const { t } = deps
  const show = deps.showPage
  views.page({
    id: HUB_PAGE,
    title: t('bibliotheque.hub.title'),
    icon: 'book',
    load: async () => {
      const page = await hubPage(deps)
      const explorer = await deps.explorer?.(null)
      return explorer ? { ...page, explorer } : page
    }
  })
  for (const kind of ENTRY_KINDS) {
    views.page({ id: ENTRIES_PAGE[kind], title: t(`bibliotheque.${kind}.title`), icon: ICON[kind], parent: HUB_PAGE, load: (param) => entriesPage(deps, kind, param) })
    views.page({ id: ENTRY_PAGE[kind], title: t(`bibliotheque.${kind}.one`), icon: ICON[kind], parent: ENTRIES_PAGE[kind], load: (param) => entryPage(deps, kind, param) })
    views.tile({
      id: ENTRIES_PAGE[kind],
      label: t(`bibliotheque.${kind}.title`),
      icon: ICON[kind],
      color: 'teal',
      group: t('bibliotheque.name'),
      order: { prompt: 28, persona: 29, skill: 30, issuer: 31, tag: 32, person: 33, glossary: 34 }[kind],
      description: t(`bibliotheque.${kind}.tile`),
      page: ENTRIES_PAGE[kind],
      run: () => show(ENTRIES_PAGE[kind])
    })
  }
}
