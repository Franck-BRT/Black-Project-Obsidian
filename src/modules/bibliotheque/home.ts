// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La bibliothèque dans l'interface : sur le tableau de bord, combien de documents et les
 * derniers entrés ; la page **Bibliothèque** — ses chiffres, une carte par document (le
 * plus récent d'abord), une recherche et des filtres (famille, origine, versions) — et la
 * **fiche** d'un document : son identité, son fichier, d'où il vient, ses versions.
 */

import { pageWith, type Badge, type Card, type HomeSectionView, type ListItem, type PageView, type Stat, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { baseName, FAMILIES, readableSize, versionLabel, type DocFamily, type LibraryDoc } from './model'
import { HUB_PAGE } from './entriesHome'
import type { LibraryStore } from './store'

export const LIBRARY_PAGE = 'bibliotheque.documents'
export const DOC_PAGE = 'bibliotheque.document'
export const docPageOf = (record: string): string => pageWith(DOC_PAGE, encodeURIComponent(record))

type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface LibraryHomeDeps {
  t: Translate
  store: LibraryStore
  today(): string
  locale: string
  showPage?(id: string): void
  /** Ouvrir un fichier (par la plateforme), une note de l'origine (sa page quand un module en a une). */
  openFile(path: string): Promise<void>
  showNote(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  /** Verser des documents (le choix des fichiers, puis le versement). */
  pour(): Promise<void>
  /** Classer un document : sa fiche en fenêtre (titre, catégorie, référence…). */
  classify(record: string): Promise<void>
  /** Le dire nouvelle version d'un autre document (choisi). */
  newVersionOf(record: string): Promise<void>
  relate(record: string, previous: string): Promise<void>
  dismissLikely(record: string): Promise<void>
  /** Le retirer (après confirmation) ; rend vrai s'il l'a été. */
  setAside(record: string): Promise<boolean>
}

const ICON: Record<DocFamily, 'file' | 'columns' | 'chart' | 'eye' | 'chat' | 'book'> = {
  pdf: 'file',
  word: 'file',
  sheet: 'columns',
  slides: 'chart',
  image: 'eye',
  mail: 'chat',
  note: 'book',
  other: 'file'
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** D'où vient un document, en mots : « Analyse d'appels d'offres — Station sol ». */
function originText(t: Translate, doc: LibraryDoc): string {
  return doc.origins.map((origin) => [t(`${origin.module}.name`), origin.label].filter(Boolean).join(' — ')).join(' · ')
}

/** La carte d'un document. */
function docCard(deps: LibraryHomeDeps, doc: LibraryDoc, all: readonly LibraryDoc[], missing: boolean): Card {
  const { t } = deps
  const replaced = all.some((other) => other.previous === doc.record)
  const version = versionLabel(doc)
  const badges: Badge[] = [
    { label: t(`bibliotheque.family.${doc.family}`), tone: 'neutral' },
    ...(doc.category ? [{ label: doc.category, tone: 'info' as const }] : []),
    ...(doc.reference || version ? [{ label: [doc.reference, version].filter(Boolean).join(' · '), tone: 'neutral' as const }] : []),
    ...(doc.likelyPrevious ? [{ label: t('bibliotheque.badge.likely'), tone: 'warning' as const }] : []),
    ...(replaced ? [{ label: t('bibliotheque.badge.replaced'), tone: 'neutral' as const }] : []),
    ...(missing ? [{ label: t('bibliotheque.badge.missing'), tone: 'danger' as const }] : [])
  ]
  const show = deps.showPage
  return {
    id: doc.record,
    title: doc.title,
    subtitle: t('bibliotheque.card.subtitle', { file: baseName(doc.file), size: readableSize(doc.size, deps.locale), date: doc.added || '—' }),
    icon: ICON[doc.family],
    badges,
    text: originText(t, doc),
    ...(show ? { open: { id: 'open', label: t('bibliotheque.doc.open'), tooltip: t('bibliotheque.doc.open'), run: () => show(docPageOf(doc.record)) } } : {}),
    actions: missing ? [] : [{ id: 'file', label: t('bibliotheque.doc.file'), icon: 'file', run: () => deps.openFile(doc.file) }],
    tags: [
      `famille-${doc.family}`,
      ...new Set(doc.origins.map((origin) => `de-${origin.module}`)),
      ...(doc.likelyPrevious ? ['a-relier'] : []),
      ...(replaced ? [] : ['a-jour']),
      ...(missing ? ['introuvables'] : [])
    ]
  }
}

/** La page de la bibliothèque. */
export async function libraryPage(deps: LibraryHomeDeps): Promise<PageView> {
  const { t } = deps
  const docs = (await deps.store.all()).sort((a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title, 'fr'))
  const missing = new Set((await Promise.all(docs.map(async (doc) => ((await deps.exists(doc.file)) ? '' : doc.record)))).filter(Boolean))
  const today = deps.today()
  const recent = docs.filter((doc) => doc.added && daysBetween(doc.added, today) <= 7).length
  const likely = docs.filter((doc) => doc.likelyPrevious).length
  const total = docs.reduce((sum, doc) => sum + doc.size, 0)
  const modules = [...new Set(docs.flatMap((doc) => doc.origins.map((origin) => origin.module)))]
  const families = FAMILIES.filter((family) => docs.some((doc) => doc.family === family))
  return {
    subtitle: t('bibliotheque.page.subtitle', { folder: deps.store.root }),
    actions: [{ id: 'pour', label: t('bibliotheque.pour'), tooltip: t('bibliotheque.pour.tip'), icon: 'upload', primary: true, run: () => deps.pour() }],
    search: { label: t('bibliotheque.search'), placeholder: t('bibliotheque.search.placeholder') },
    filters: [
      ...families.map((family) => ({ id: `famille-${family}`, label: t(`bibliotheque.family.${family}`) })),
      ...modules.map((module) => ({ id: `de-${module}`, label: t('bibliotheque.filter.from', { module: t(`${module}.name`) }) })),
      { id: 'a-jour', label: t('bibliotheque.filter.latest') },
      ...(likely ? [{ id: 'a-relier', label: t('bibliotheque.filter.likely') }] : []),
      ...(missing.size ? [{ id: 'introuvables', label: t('bibliotheque.badge.missing') }] : [])
    ],
    blocks: docs.length
      ? [
          {
            kind: 'stats',
            stats: [
              { label: t('bibliotheque.stat.count'), value: String(docs.length), icon: 'book' },
              { label: t('bibliotheque.stat.size'), value: readableSize(total, deps.locale), icon: 'file' },
              { label: t('bibliotheque.stat.recent'), value: String(recent), icon: 'clock', hint: t('bibliotheque.stat.recent.hint') },
              { label: t('bibliotheque.stat.likely'), value: String(likely), icon: 'flow', ...(likely ? { tone: 'warning' as const, hint: t('bibliotheque.stat.likely.hint') } : {}) }
            ]
          },
          { kind: 'cards', cards: docs.map((doc) => docCard(deps, doc, docs, missing.has(doc.record))) }
        ]
      : [{ kind: 'message', tone: 'info', text: t('bibliotheque.empty'), actions: [{ id: 'pour', label: t('bibliotheque.pour'), icon: 'upload', run: () => deps.pour() }] }]
  }
}

/** La fiche d'un document. */
export async function docPage(deps: LibraryHomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const record = param ? decodeURIComponent(param) : ''
  const back: ViewAction = { id: 'back', label: t('bibliotheque.back'), run: () => deps.showPage?.(LIBRARY_PAGE) }
  const all = await deps.store.all()
  const doc = all.find((each) => each.record === record)
  if (!doc) return { title: t('bibliotheque.doc.missing.title'), back, blocks: [{ kind: 'message', tone: 'warning', text: t('bibliotheque.doc.missing') }] }
  const present = await deps.exists(doc.file)
  const byRecord = new Map(all.map((each) => [each.record, each]))
  const open = (other: LibraryDoc): ViewAction => ({ id: 'open', label: t('bibliotheque.doc.open'), run: () => deps.showPage?.(docPageOf(other.record)) })

  // Les versions : les précédentes (en remontant), puis les suivantes (celles qui la donnent pour précédente).
  const older: LibraryDoc[] = []
  for (let at = doc.previous ? byRecord.get(doc.previous) : undefined; at && !older.includes(at) && at !== doc; at = at.previous ? byRecord.get(at.previous) : undefined) older.push(at)
  const newer: LibraryDoc[] = []
  for (let at = all.find((each) => each.previous === doc.record); at && !newer.includes(at); at = all.find((each) => each.previous === at!.record)) newer.push(at)
  const versionItem = (other: LibraryDoc, key: string): ListItem => ({
    id: `${key}-${other.record}`,
    title: other.title,
    detail: [t(key === 'avant' ? 'bibliotheque.version.older' : 'bibliotheque.version.newer'), versionLabel(other), other.added].filter(Boolean).join(' · '),
    tone: key === 'apres' ? 'info' : 'neutral',
    open: open(other)
  })
  const likely = doc.likelyPrevious ? byRecord.get(doc.likelyPrevious) : undefined

  const stats: Stat[] = [
    { label: t('bibliotheque.field.family'), value: t(`bibliotheque.family.${doc.family}`), icon: ICON[doc.family] },
    { label: t('bibliotheque.field.size'), value: readableSize(doc.size, deps.locale), icon: 'file' },
    { label: t('bibliotheque.field.added'), value: doc.added || '—', icon: 'clock' },
    { label: t('bibliotheque.field.version'), value: versionLabel(doc) || (older.length ? `v${older.length + 1}` : '—'), icon: 'flow', ...(newer.length ? { tone: 'warning' as const, hint: t('bibliotheque.badge.replaced') } : {}) }
  ]
  const field = (key: string, value: string): ListItem => ({ id: key, title: t(`bibliotheque.field.${key}`), detail: value || '—' })
  const origins: ListItem[] = doc.origins.map((origin, index) => ({
    id: `origine-${index}`,
    title: t(`${origin.module}.name`),
    detail: origin.label || '—',
    ...(origin.link ? { open: { id: 'open', label: t('bibliotheque.origin.open'), run: () => deps.showNote(origin.link!) } } : {})
  }))
  return {
    title: doc.title,
    back,
    subtitle: [t(`bibliotheque.family.${doc.family}`), doc.category].filter(Boolean).join(' · '),
    actions: [
      ...(present ? [{ id: 'file', label: t('bibliotheque.doc.file'), icon: 'file' as const, primary: true, run: () => deps.openFile(doc.file) }] : []),
      { id: 'classify', label: t('bibliotheque.classify'), icon: 'edit', run: () => deps.classify(doc.record) },
      { id: 'version', label: t('bibliotheque.newVersionOf'), tooltip: t('bibliotheque.newVersionOf.tip'), icon: 'flow', run: () => deps.newVersionOf(doc.record) },
      { id: 'note', label: t('bibliotheque.doc.note'), icon: 'book', run: () => deps.showNote(doc.record) },
      {
        id: 'aside',
        label: t('bibliotheque.setAside'),
        tooltip: t('bibliotheque.setAside.tip'),
        icon: 'trash',
        run: async () => {
          if (await deps.setAside(doc.record)) deps.showPage?.(LIBRARY_PAGE)
        }
      }
    ],
    blocks: [
      ...(present ? [] : [{ kind: 'message' as const, tone: 'danger' as const, text: t('bibliotheque.doc.fileMissing', { file: doc.file }) }]),
      // Une version précédente probable : à relier, ou à oublier.
      ...(likely
        ? [
            {
              kind: 'message' as const,
              tone: 'warning' as const,
              text: t('bibliotheque.likely', { title: likely.title }),
              actions: [
                { id: 'relate', label: t('bibliotheque.likely.relate'), icon: 'check' as const, primary: true, run: () => deps.relate(doc.record, likely.record) },
                { id: 'dismiss', label: t('bibliotheque.likely.dismiss'), icon: 'cross' as const, run: () => deps.dismissLikely(doc.record) },
                { id: 'see', label: t('bibliotheque.likely.see'), icon: 'eye' as const, run: () => deps.showPage?.(docPageOf(likely.record)) }
              ]
            }
          ]
        : []),
      ...(newer.length ? [{ kind: 'message' as const, tone: 'info' as const, text: t('bibliotheque.replaced', { title: newer.at(-1)!.title }), actions: [{ ...open(newer.at(-1)!), label: t('bibliotheque.replaced.open') }] }] : []),
      { kind: 'stats', stats },
      {
        kind: 'list',
        title: t('bibliotheque.section.identity'),
        items: [field('title', doc.title), field('reference', doc.reference), field('edition', doc.edition), field('revision', doc.revision), field('category', doc.category), field('issuer', doc.issuer), field('tags', doc.tags.join(', '))]
      },
      {
        kind: 'list',
        title: t('bibliotheque.section.file'),
        items: [
          { ...field('file', doc.file), ...(present ? { open: { id: 'open', label: t('bibliotheque.doc.file'), run: () => deps.openFile(doc.file) } } : { tone: 'danger' as const }) },
          field('stored', t(doc.copied ? 'bibliotheque.stored.copied' : 'bibliotheque.stored.inPlace')),
          field('hash', doc.hash.slice(0, 16))
        ]
      },
      { kind: 'list', title: t('bibliotheque.section.origins', { count: origins.length }), items: origins, empty: t('bibliotheque.origins.none') },
      {
        kind: 'list',
        title: t('bibliotheque.section.versions'),
        items: [...newer.reverse().map((each) => versionItem(each, 'apres')), ...older.map((each) => versionItem(each, 'avant'))],
        empty: t('bibliotheque.versions.none')
      }
    ]
  }
}

/** La section du tableau de bord : combien, les derniers entrés. */
async function librarySection(deps: LibraryHomeDeps): Promise<HomeSectionView> {
  const { t } = deps
  const docs = (await deps.store.all()).sort((a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title, 'fr'))
  const likely = docs.filter((doc) => doc.likelyPrevious).length
  return {
    title: t('bibliotheque.home.title'),
    icon: 'book',
    subtitle: t('bibliotheque.home.subtitle', { count: docs.length }),
    ...(deps.showPage ? { actions: [{ id: 'all', label: t('bibliotheque.home.all'), icon: 'chevron' as const, run: () => deps.showPage?.(LIBRARY_PAGE) }] } : {}),
    blocks: [
      ...(likely ? [{ kind: 'message' as const, tone: 'warning' as const, text: t('bibliotheque.home.likely', { count: likely }) }] : []),
      {
        kind: 'list',
        items: docs.slice(0, 5).map((doc) => ({
          id: doc.record,
          title: doc.title,
          detail: [t(`bibliotheque.family.${doc.family}`), doc.category, originText(t, doc)].filter(Boolean).join(' · '),
          when: doc.added,
          ...(deps.showPage ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => deps.showPage?.(docPageOf(doc.record)) } } : {})
        })),
        empty: t('bibliotheque.empty')
      },
      { kind: 'actions', actions: [{ id: 'pour', label: t('bibliotheque.pour'), icon: 'upload', run: () => deps.pour() }] }
    ]
  }
}

export function registerLibraryHome(views: ViewsRegistrar | undefined, deps: LibraryHomeDeps): void {
  if (!views) return
  const { t } = deps
  views.home({ id: 'bibliotheque.home', title: t('bibliotheque.home.title'), icon: 'book', order: 35, area: 'side', load: () => librarySection(deps) })
  if (!deps.showPage) return
  const show = deps.showPage
  views.page({ id: LIBRARY_PAGE, title: t('bibliotheque.page.title'), icon: 'book', parent: HUB_PAGE, load: () => libraryPage(deps) })
  views.page({ id: DOC_PAGE, title: t('bibliotheque.doc.title'), icon: 'file', parent: LIBRARY_PAGE, load: (param) => docPage(deps, param) })
  // Le menu mène à la bibliothèque : ses documents, ses prompts, ses personas.
  views.nav({ id: 'bibliotheque', label: t('bibliotheque.nav'), icon: 'book', order: 25, page: HUB_PAGE, run: () => show(HUB_PAGE) })
  views.tile({
    id: 'bibliotheque.documents',
    label: t('bibliotheque.nav'),
    icon: 'book',
    color: 'teal',
    group: t('bibliotheque.name'),
    order: 26,
    description: t('bibliotheque.tile.desc'),
    page: LIBRARY_PAGE,
    run: () => show(LIBRARY_PAGE)
  })
  views.tile({ id: 'bibliotheque.verser', label: t('bibliotheque.pour'), icon: 'upload', color: 'teal', group: t('bibliotheque.name'), order: 27, description: t('bibliotheque.pour.tip'), run: () => deps.pour() })
}
