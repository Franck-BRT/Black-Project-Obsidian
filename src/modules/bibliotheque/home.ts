// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La bibliothèque dans l'interface : sur le tableau de bord, combien de documents et les
 * derniers entrés ; la page **Bibliothèque** — ses chiffres, une carte par document (le
 * plus récent d'abord), une recherche et des filtres (famille, origine, versions) — et la
 * **fiche** d'un document : son identité, son fichier, d'où il vient, ses versions.
 */

import { pageWith, type Badge, type Card, type HomeBlock, type IconName, type HomeSectionView, type ListItem, type PageView, type Stat, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { baseName, FAMILIES, readableSize, versionLabel, type DocFamily, type LibraryDoc } from './model'
import { HUB_PAGE } from './entriesHome'
import { grouped, groupingOf, groupingSelector, type Group } from '../../core/grouping'
import type { GhostEntry, LibraryStore, ResearchField } from './store'
import type { LibraryGhost } from './ghosts'
import { LANGUAGES, type LanguageCode } from './language'
import { docDateLabel, type KnownIssuer, type KnownTag } from './identity'
import { directoryGroupOf, isHere, isUnder, placeLabel, placeName, placePageOf, placeView, resolvePlace, type ShelfPlacesDeps } from './places'

export const LIBRARY_PAGE = 'bibliotheque.documents'
export const DOC_PAGE = 'bibliotheque.document'
export const docPageOf = (record: string): string => pageWith(DOC_PAGE, encodeURIComponent(record))

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Les champs d'une fiche qu'on modifie un par un (le lieu et la langue ont leurs fenêtres). */
export const EDITABLE_FIELDS = ['title', 'reference', 'edition', 'revision', 'date', 'category', 'issuer', 'tags'] as const
export type EditableField = (typeof EDITABLE_FIELDS)[number]

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
  /** Verser des documents (le choix des fichiers, puis le versement) : dans un dossier, sinon la bibliothèque par défaut. */
  pour(folder?: string): Promise<void>
  /** Les bibliothèques de documents, leurs répertoires, et ce qu'on en fait. */
  places: ShelfPlacesDeps
  /** Retirer un fantôme (sa note mise de côté ; le document reste). */
  removeGhost(path: string): Promise<void>
  /** Déplacer un document (le choix du lieu) ; rend le nouveau chemin de sa fiche, ou null. */
  move(record: string): Promise<string | null>
  /** Classer un document : sa fiche en fenêtre (titre, catégorie, référence…). */
  classify(record: string): Promise<void>
  /** Le dire nouvelle version d'un autre document (choisi). */
  newVersionOf(record: string): Promise<void>
  /** Choisir sa langue (ou la détecter de nouveau, ou aucune). */
  chooseLanguage(record: string): Promise<void>
  /** (Re)transcrire son fichier dans sa fiche. */
  transcribe(record: string): Promise<void>
  /** Ses étiquettes hors de la liste : les y ajouter. */
  addTags(record: string): Promise<void>
  /** Les étiquettes de la liste. */
  tagList(): Promise<readonly KnownTag[]>
  /** Son type de pièce, hors de la liste : l'y ajouter (un type du module Typage des pièces). */
  addPieceType(record: string): Promise<void>
  /** Une valeur hors de la liste des types de pièce ? */
  pieceTypeOutside(code: string): boolean
  /** Peut-on ajouter un type à la liste d'ici (le module Typage des pièces actif) ? */
  canAddPieceType(): boolean
  /** Son émetteur, hors de la liste : l'y ajouter (il devient celui du document, et des autres qui portaient ce nom). */
  addIssuer(record: string): Promise<void>
  /** Les émetteurs de la liste : celui d'un document est dit par son code et son nom. */
  issuers(): Promise<readonly KnownIssuer[]>
  /** Un type de pièce en mots : « CCTP — Cahier des clauses techniques particulières ». */
  typeText(code: string): string
  /** Confirmer la catégorie : celle donnée (la probable ; vide : aucune), ou `null` — celle qu'il a. */
  confirmCategory(record: string, category: string | null): Promise<void>
  /** Renommer son fichier (dans son dossier) ; les liens vers lui, dans le coffre, suivent. */
  renameFile(record: string): Promise<void>
  /** Relancer la recherche d'un champ dans le document : sans IA, puis — pas sûr — avec l'IA (son workflow système). */
  researchField(record: string, field: ResearchField): Promise<void>
  /** Modifier un champ de sa fiche, seul (une petite fenêtre) : il est alors confirmé. */
  editField(record: string, key: EditableField): Promise<void>
  /** Confirmer la date : celle donnée (la probable ; vide : aucune), ou `null` — celle qu'il a. */
  confirmDate(record: string, date: string | null): Promise<void>
  /** Confirmer les étiquettes : celles données (les probables, ajoutées ; vide : aucune), ou `null` — celles qu'il a. */
  confirmTags(record: string, tags: readonly string[] | null): Promise<void>
  /** Confirmer l'émetteur : celui donné (le probable ; vide : aucun), ou `null` — celui qu'il a. */
  confirmIssuer(record: string, issuer: string | null): Promise<void>
  /** Confirmer le titre : celui donné (le probable), ou `null` — celui qu'il a. */
  confirmTitle(record: string, title: string | null): Promise<void>
  /** Confirmer la référence et la version telles qu'elles sont : plus à confirmer. */
  confirmIdentity(record: string): Promise<void>
  /** Confirmer une langue (la probable) : plus à confirmer. */
  setLanguage(record: string, language: LanguageCode): Promise<void>
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
    ...(missing ? [{ label: t('bibliotheque.badge.missing'), tone: 'danger' as const }] : []),
    ...(doc.language ? [{ label: t(`bibliotheque.lang.${doc.language}`), tone: 'neutral' as const }] : doc.languageToConfirm ? [{ label: t('bibliotheque.lang.toConfirm'), tone: 'warning' as const }] : [])
  ]
  const show = deps.showPage
  return {
    id: doc.record,
    title: doc.title,
    subtitle: baseName(doc.file),
    icon: ICON[doc.family],
    badges,
    text: originText(t, doc),
    // Ses chiffres : en faits (les colonnes de la vue tableau).
    facts: [
      { label: t('bibliotheque.field.size'), value: readableSize(doc.size, deps.locale) },
      { label: t('bibliotheque.field.added'), value: doc.added || '—' },
      { label: t('bibliotheque.field.version'), value: version || '—' }
    ],
    ...(show ? { open: { id: 'open', label: t('bibliotheque.doc.open'), tooltip: t('bibliotheque.doc.open'), run: () => show(docPageOf(doc.record)) } } : {}),
    actions: missing ? [] : [{ id: 'file', label: t('bibliotheque.doc.file'), icon: 'file', run: () => deps.openFile(doc.file) }],
    tags: [
      `famille-${doc.family}`,
      ...new Set(doc.origins.map((origin) => `de-${origin.module}`)),
      ...(doc.likelyPrevious ? ['a-relier'] : []),
      ...(replaced ? [] : ['a-jour']),
      ...(missing ? ['introuvables'] : []),
      ...(doc.language ? [`langue-${doc.language}`] : doc.languageToConfirm ? ['langue-a-confirmer'] : []),
      ...(doc.identityToConfirm ? ['identite-a-confirmer'] : []),
      ...(doc.titleToConfirm ? ['titre-a-confirmer'] : []),
      ...(doc.issuerToConfirm ? ['emetteur-a-confirmer'] : []),
      ...(doc.categoryToConfirm ? ['categorie-a-confirmer'] : []),
      ...(doc.tagsToConfirm ? ['etiquettes-a-confirmer'] : []),
      ...(doc.dateToConfirm ? ['date-a-confirmer'] : [])
    ]
  }
}

/** La carte d'un fantôme : le document qu'il montre ici, et où il est rangé. */
function ghostCard(deps: LibraryHomeDeps, ghost: LibraryGhost, doc: LibraryDoc): Card {
  const { t } = deps
  const home = placePageOf(LIBRARY_PAGE, { shelf: doc.shelf ?? '', directory: doc.directory ?? '' })
  return {
    id: `ghost:${ghost.path}`,
    title: doc.title,
    subtitle: t('bibliotheque.ghost.in', { where: placeLabel(deps.places, doc) }),
    icon: 'copy',
    badges: [{ label: t('bibliotheque.ghost'), tone: 'neutral' }, { label: t(`bibliotheque.family.${doc.family}`), tone: 'neutral' }],
    text: t('bibliotheque.ghost.hint'),
    ...(deps.showPage ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => deps.showPage?.(docPageOf(doc.record)) } } : {}),
    actions: [
      { id: 'original', label: t('bibliotheque.ghost.go'), tooltip: t('bibliotheque.ghost.go.tip'), icon: 'chevron', run: () => deps.showPage?.(home) },
      { id: 'remove-ghost', label: t('bibliotheque.ghost.remove'), tooltip: t('bibliotheque.ghost.remove.tip'), icon: 'cross', run: () => deps.removeGhost(ghost.path) }
    ],
    tags: ['fantomes', `famille-${doc.family}`]
  }
}

/** Les regroupements des documents : par origine (d'origine), famille, catégorie, mois d'ajout, ou aucun. */
export const DOC_GROUPINGS = ['origine', 'famille', 'categorie', 'langue', 'mois', 'repertoire', 'aucun'] as const

/** Le groupe d'un document, selon le regroupement choisi ; `null` : sans regroupement. */
function docGroupOf(deps: LibraryHomeDeps, by: string): ((doc: LibraryDoc) => Group) | null {
  const { t } = deps
  switch (by) {
    case 'origine':
      return (doc) => {
        // Sa première origine : l'analyse, l'import d'où il est entré.
        const origin = doc.origins[0]
        if (!origin) return { key: 'aucune', title: t('bibliotheque.group.none.origin'), order: 1 }
        const title = [t(`${origin.module}.name`), origin.label].filter(Boolean).join(' — ')
        return { key: `${origin.module}.${origin.label}`, title }
      }
    case 'famille':
      return (doc) => ({ key: doc.family, title: t(`bibliotheque.family.${doc.family}`), order: FAMILIES.indexOf(doc.family) })
    case 'categorie':
      return (doc) => (doc.category ? { key: doc.category.toLowerCase(), title: doc.category } : { key: '', title: t('bibliotheque.group.none.category'), order: 1 })
    case 'langue':
      return (doc) =>
        doc.language
          ? { key: doc.language, title: t(`bibliotheque.lang.${doc.language}`), order: LANGUAGES.indexOf(doc.language) }
          : doc.languageToConfirm
            ? { key: 'a-confirmer', title: t('bibliotheque.lang.toConfirm'), order: 98 }
            : { key: '', title: t('bibliotheque.group.none.language'), order: 99 }
    case 'mois':
      return (doc) => {
        const month = doc.added.slice(0, 7)
        if (!month) return { key: '', title: t('bibliotheque.group.none.date'), order: 1 }
        const date = new Date(`${month}-01T00:00:00Z`)
        const title = date.toLocaleDateString(deps.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
        // Le plus récent d'abord.
        return { key: month, title: title.charAt(0).toUpperCase() + title.slice(1), order: -Number(month.replace('-', '')) }
      }
    default:
      return null
  }
}

/** La page d'un lieu de la bibliothèque : une bibliothèque, ou l'un de ses répertoires (d'origine : la racine de celle par défaut). */
export async function libraryPage(deps: LibraryHomeDeps, param?: string): Promise<PageView> {
  const { t } = deps
  const place = resolvePlace(deps.places, param)
  const docGrouping = groupingOf(LIBRARY_PAGE, 'origine')
  const everything = (await deps.store.all()).sort((a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title, 'fr'))
  const under = everything.filter((doc) => isUnder(doc, place))
  // Regroupés par répertoire : tout ce qui est sous ce lieu ; sinon, ce qui est là même.
  const docs = docGrouping === 'repertoire' ? under : under.filter((doc) => isHere(doc, place))
  const top = await placeView(deps.places, place, everything)
  // Les fantômes de ce lieu : des documents rangés ailleurs, montrés ici aussi.
  const ghostsHere = (await deps.store.ghosts()).filter((entry): entry is GhostEntry & { doc: LibraryDoc } => !!entry.doc && isHere(entry.ghost, place))
  const ghostBlock: HomeBlock[] = ghostsHere.length
    ? [{ kind: 'cards', title: t('bibliotheque.ghost.section', { count: ghostsHere.length }), cards: ghostsHere.map(({ ghost, doc }) => ghostCard(deps, ghost, doc)) }]
    : []
  const pourHere = () => deps.pour(top.folder)
  const missing = new Set((await Promise.all(docs.map(async (doc) => ((await deps.exists(doc.file)) ? '' : doc.record)))).filter(Boolean))
  const today = deps.today()
  const recent = under.filter((doc) => doc.added && daysBetween(doc.added, today) <= 7).length
  const likely = under.filter((doc) => doc.likelyPrevious).length
  const total = under.reduce((sum, doc) => sum + doc.size, 0)
  const modules = [...new Set(docs.flatMap((doc) => doc.origins.map((origin) => origin.module)))]
  const families = FAMILIES.filter((family) => docs.some((doc) => doc.family === family))
  const languages = LANGUAGES.filter((language) => docs.some((doc) => doc.language === language))
  const toConfirm = docs.filter((doc) => doc.languageToConfirm).length
  const stats: Stat[] = [
    { label: t('bibliotheque.stat.count'), value: String(under.length), icon: 'book' },
    { label: t('bibliotheque.stat.size'), value: readableSize(total, deps.locale), icon: 'file' },
    { label: t('bibliotheque.stat.recent'), value: String(recent), icon: 'clock', hint: t('bibliotheque.stat.recent.hint') },
    { label: t('bibliotheque.stat.likely'), value: String(likely), icon: 'flow', ...(likely ? { tone: 'warning' as const, hint: t('bibliotheque.stat.likely.hint') } : {}) }
  ]
  const empty: HomeBlock = { kind: 'message', tone: 'info', text: t(top.blocks.length ? 'bibliotheque.place.empty' : 'bibliotheque.empty'), actions: [{ id: 'pour', label: t('bibliotheque.pour'), icon: 'upload', run: pourHere }] }
  const groupOf = docGrouping === 'repertoire' ? directoryGroupOf(t, place.directory) : docGroupOf(deps, docGrouping)
  return {
    breadcrumb: top.breadcrumb,
    title: place.directory ? place.directory.slice(place.directory.lastIndexOf('/') + 1) : deps.places.shelves().length > 1 ? place.shelf.name : t('bibliotheque.page.title'),
    ...(param ? { back: { id: 'back', label: t('bibliotheque.back.up'), run: () => deps.showPage?.(place.directory ? placePageOf(LIBRARY_PAGE, { shelf: place.shelf.id, directory: place.directory.split('/').slice(0, -1).join('/') }) : HUB_PAGE) } } : {}),
    subtitle: t('bibliotheque.page.subtitle', { folder: top.folder }) + top.note,
    // Des fichiers glissés-déposés sur la page : versés là où l'on est.
    ...(deps.places.dropInto
      ? { drop: { ...deps.places.dropInto(top.folder, place.directory ? place.directory.slice(place.directory.lastIndexOf('/') + 1) : place.shelf.name), hint: t('bibliotheque.drop.hint') } }
      : {}),
    actions: [{ id: 'pour', label: t('bibliotheque.pour'), tooltip: t('bibliotheque.pour.here.tip', { folder: top.folder }), icon: 'upload', primary: true, run: pourHere }, ...top.actions],
    layouts: ['cards', 'list', 'table'],
    grouping: groupingSelector(LIBRARY_PAGE, docGrouping, DOC_GROUPINGS, t, 'bibliotheque.group.doc'),
    search: { label: t('bibliotheque.search'), placeholder: t('bibliotheque.search.placeholder') },
    filters: [
      ...families.map((family) => ({ id: `famille-${family}`, label: t(`bibliotheque.family.${family}`) })),
      ...languages.map((language) => ({ id: `langue-${language}`, label: t(`bibliotheque.lang.${language}`) })),
      ...(toConfirm ? [{ id: 'langue-a-confirmer', label: t('bibliotheque.lang.toConfirm') }] : []),
      ...(docs.some((doc) => doc.identityToConfirm) ? [{ id: 'identite-a-confirmer', label: t('bibliotheque.identity.toConfirm') }] : []),
      ...(docs.some((doc) => doc.titleToConfirm) ? [{ id: 'titre-a-confirmer', label: t('bibliotheque.title.toConfirm') }] : []),
      ...(docs.some((doc) => doc.issuerToConfirm) ? [{ id: 'emetteur-a-confirmer', label: t('bibliotheque.issuer.toConfirm') }] : []),
      ...(docs.some((doc) => doc.categoryToConfirm) ? [{ id: 'categorie-a-confirmer', label: t('bibliotheque.category.toConfirm') }] : []),
      ...(docs.some((doc) => doc.tagsToConfirm) ? [{ id: 'etiquettes-a-confirmer', label: t('bibliotheque.tags.toConfirm') }] : []),
      ...(docs.some((doc) => doc.dateToConfirm) ? [{ id: 'date-a-confirmer', label: t('bibliotheque.date.toConfirm') }] : []),
      ...modules.map((module) => ({ id: `de-${module}`, label: t('bibliotheque.filter.from', { module: t(`${module}.name`) }) })),
      { id: 'a-jour', label: t('bibliotheque.filter.latest') },
      ...(likely ? [{ id: 'a-relier', label: t('bibliotheque.filter.likely') }] : []),
      ...(missing.size ? [{ id: 'introuvables', label: t('bibliotheque.badge.missing') }] : []),
      ...(ghostsHere.length ? [{ id: 'fantomes', label: t('bibliotheque.ghost.filter') }] : [])
    ],
    blocks: [
      ...top.blocks,
      ...ghostBlock,
      ...(under.length ? [{ kind: 'stats' as const, stats }, ...(docs.length ? grouped(docs, (doc) => docCard(deps, doc, everything, missing.has(doc.record)), groupOf, `bibliotheque.documents.${docGrouping}`, (count) => t('bibliotheque.group.count', { count })) : [])] : ghostsHere.length ? [] : [empty])
    ]
  }
}

/** Une section repliable de la fiche, repliée d'origine (l'interface se souvient ensuite de ce qu'on en a fait, le temps de la session). */
const fold = (id: string, title: string, subtitle: string, icon: IconName, list: HomeBlock): HomeBlock => ({
  kind: 'section',
  id: `bibliotheque.document.${id}`,
  title,
  ...(subtitle ? { subtitle } : {}),
  icon,
  collapsed: true,
  blocks: [list]
})

/** La fiche d'un document. */
export async function docPage(deps: LibraryHomeDeps, param: string | undefined): Promise<PageView> {
  const { t } = deps
  const record = param ? decodeURIComponent(param) : ''
  const all = await deps.store.all()
  const doc = all.find((each) => each.record === record)
  // Retour : là où il est rangé.
  const home = doc?.shelf ? placePageOf(LIBRARY_PAGE, { shelf: doc.shelf, directory: doc.directory ?? '' }) : LIBRARY_PAGE
  const back: ViewAction = { id: 'back', label: (doc && placeName(deps.places.shelves(), doc.shelf, doc.directory)) || t('bibliotheque.back'), run: () => deps.showPage?.(home) }
  if (!doc) return { title: t('bibliotheque.doc.missing.title'), back, blocks: [{ kind: 'message', tone: 'warning', text: t('bibliotheque.doc.missing') }] }
  const present = await deps.exists(doc.file)
  const ghosts = await deps.store.ghostsOf(doc)
  // Un émetteur de la liste : son code et son nom.
  const issuers = await deps.issuers()
  const outsideType = deps.pieceTypeOutside(doc.category)
  // Ses étiquettes hors de la liste des étiquettes.
  const tagList = await deps.tagList()
  const foldTag = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
  const outsideTags = doc.tags.filter((tag) => !tagList.some((each) => [each.name, ...each.aliases].some((name) => foldTag(name) === foldTag(tag))))
  const outsideIssuer = !!doc.issuer && !issuers.some((each) => each.code === doc.issuer)
  const issuerText = (value: string): string => {
    const found = issuers.find((each) => each.code === value)
    return found ? (found.name && found.name !== found.code ? `${found.code} — ${found.name}` : found.code) : value
  }
  // Ce qui reste à confirmer (la langue, le titre, la catégorie, l'émetteur, la référence) : un message chacun —
  // plusieurs, ensemble dans une section, dépliée, que l'en-tête résume.
  const confirming: HomeBlock[] = [
    // Sa langue n'a pas été détectée sûrement : à confirmer — la probable d'un clic, ou une autre.
    ...(doc.languageToConfirm
      ? [
          {
            kind: 'message' as const,
            tone: 'warning' as const,
            text: doc.languageProbable ? t('bibliotheque.lang.confirm.probable', { language: t(`bibliotheque.lang.${doc.languageProbable}`) }) : t('bibliotheque.lang.confirm.none'),
            actions: [
              ...(doc.languageProbable
                ? [{ id: 'confirm-language', label: t('bibliotheque.lang.confirm', { language: t(`bibliotheque.lang.${doc.languageProbable}`) }), icon: 'check' as const, primary: true, run: () => deps.setLanguage(doc.record, doc.languageProbable!) }]
                : []),
              { id: 'choose-language', label: t('bibliotheque.lang.choose'), icon: 'chat' as const, ...(doc.languageProbable ? {} : { primary: true }), run: () => deps.chooseLanguage(doc.record) }
            ]
          }
        ]
      : []),
    // Son titre n'a pas été lu sûrement : celui lu dans le document (probable), celui du nom du fichier, ou un autre.
    ...(doc.titleToConfirm
      ? [
          {
            kind: 'message' as const,
            tone: 'warning' as const,
            text: doc.titleProbable ? t('bibliotheque.title.confirm.probable', { probable: doc.titleProbable, title: doc.title }) : t('bibliotheque.title.confirm.name', { title: doc.title }),
            actions: [
              ...(doc.titleProbable
                ? [{ id: 'use-title', label: t('bibliotheque.title.use', { title: doc.titleProbable }), icon: 'check' as const, primary: true, run: () => deps.confirmTitle(doc.record, doc.titleProbable!) }]
                : []),
              { id: 'keep-title', label: t(doc.titleProbable ? 'bibliotheque.title.keep' : 'bibliotheque.identity.confirm'), icon: doc.titleProbable ? ('cross' as const) : ('check' as const), ...(doc.titleProbable ? {} : { primary: true }), run: () => deps.confirmTitle(doc.record, null) },
              { id: 'classify-title', label: t('bibliotheque.classify'), icon: 'edit' as const, run: () => deps.classify(doc.record) }
            ]
          }
        ]
      : []),
    // Sa catégorie n'a pas été établie sûrement : celle que le texte suggère (probable), celle du nom du fichier, aucune, ou une autre.
    ...(doc.categoryToConfirm
      ? [
          {
            kind: 'message' as const,
            tone: 'warning' as const,
            text: doc.categoryProbable
              ? doc.category
                ? t('bibliotheque.category.confirm.both', { probable: doc.categoryProbable, category: doc.category })
                : t('bibliotheque.category.confirm.text', { probable: doc.categoryProbable })
              : doc.category
                ? t('bibliotheque.category.confirm.name', { category: doc.category })
                : t('bibliotheque.category.confirm.none'),
            actions: [
              ...(doc.categoryProbable
                ? [{ id: 'use-category', label: t('bibliotheque.issuer.use', { issuer: doc.categoryProbable }), icon: 'check' as const, primary: true, run: () => deps.confirmCategory(doc.record, doc.categoryProbable!) }]
                : []),
              {
                id: 'keep-category',
                label: t(doc.category ? (doc.categoryProbable ? 'bibliotheque.category.keep' : 'bibliotheque.identity.confirm') : 'bibliotheque.category.none'),
                icon: doc.category ? ('check' as const) : ('cross' as const),
                ...(doc.category && !doc.categoryProbable ? { primary: true } : {}),
                run: () => deps.confirmCategory(doc.record, null)
              },
              { id: 'classify-category', label: t('bibliotheque.classify'), icon: 'edit' as const, ...(doc.category || doc.categoryProbable ? {} : { primary: true }), run: () => deps.classify(doc.record) }
            ]
          }
        ]
      : []),
    // Ses étiquettes n'ont pas été lues sûrement : celles que le texte suggère (ajoutées), celles qu'il a, aucune, ou d'autres.
    ...(doc.tagsToConfirm
      ? [
          {
            kind: 'message' as const,
            tone: 'warning' as const,
            text: doc.tagsProbable?.length ? t('bibliotheque.tags.confirm.probable', { probable: doc.tagsProbable.join(', ') }) : t('bibliotheque.tags.confirm.none'),
            actions: [
              ...(doc.tagsProbable?.length
                ? [
                    {
                      id: 'use-tags',
                      label: t(doc.tags.length ? 'bibliotheque.tags.add' : 'bibliotheque.tags.use'),
                      icon: 'check' as const,
                      primary: true,
                      run: () => deps.confirmTags(doc.record, [...new Set([...doc.tags, ...doc.tagsProbable!])])
                    }
                  ]
                : []),
              { id: 'keep-tags', label: t(doc.tags.length ? 'bibliotheque.identity.confirm' : 'bibliotheque.tags.none'), icon: 'cross' as const, run: () => deps.confirmTags(doc.record, null) },
              { id: 'classify-tags', label: t('bibliotheque.classify'), icon: 'edit' as const, ...(doc.tagsProbable?.length ? {} : { primary: true }), run: () => deps.classify(doc.record) }
            ]
          }
        ]
      : []),
    // Son émetteur n'a pas été lu sûrement : celui lu au début du document (probable), aucun, ou un autre.
    ...(doc.issuerToConfirm
      ? [
          {
            kind: 'message' as const,
            tone: 'warning' as const,
            text: doc.issuerProbable ? t('bibliotheque.issuer.confirm.probable', { probable: issuerText(doc.issuerProbable) }) : t('bibliotheque.issuer.confirm.none'),
            actions: [
              ...(doc.issuerProbable
                ? [{ id: 'use-issuer', label: t('bibliotheque.issuer.use', { issuer: issuerText(doc.issuerProbable) }), icon: 'check' as const, primary: true, run: () => deps.confirmIssuer(doc.record, doc.issuerProbable!) }]
                : []),
              { id: 'keep-issuer', label: t(doc.issuer ? 'bibliotheque.identity.confirm' : 'bibliotheque.issuer.none'), icon: 'cross' as const, run: () => deps.confirmIssuer(doc.record, null) },
              { id: 'classify-issuer', label: t('bibliotheque.classify'), icon: 'edit' as const, ...(doc.issuerProbable ? {} : { primary: true }), run: () => deps.classify(doc.record) }
            ]
          }
        ]
      : []),
    // Sa date n'a pas été lue sûrement : celle lue au début du document (probable), aucune, ou une autre.
    ...(doc.dateToConfirm
      ? [
          {
            kind: 'message' as const,
            tone: 'warning' as const,
            text: doc.dateProbable ? t('bibliotheque.date.confirm.probable', { probable: docDateLabel(doc.dateProbable, deps.locale) }) : t('bibliotheque.date.confirm.none'),
            actions: [
              ...(doc.dateProbable
                ? [{ id: 'use-date', label: t('bibliotheque.issuer.use', { issuer: docDateLabel(doc.dateProbable, deps.locale) }), icon: 'check' as const, primary: true, run: () => deps.confirmDate(doc.record, doc.dateProbable!) }]
                : []),
              { id: 'keep-date', label: t(doc.date ? 'bibliotheque.identity.confirm' : 'bibliotheque.date.none'), icon: 'cross' as const, run: () => deps.confirmDate(doc.record, null) },
              { id: 'classify-date', label: t('bibliotheque.classify'), icon: 'edit' as const, ...(doc.dateProbable ? {} : { primary: true }), run: () => deps.classify(doc.record) }
            ]
          }
        ]
      : []),
    // Sa référence et sa version n'ont pas été lues sûrement : à confirmer (telles quelles, ou « Classer… »).
    ...(doc.identityToConfirm
      ? [
          {
            kind: 'message' as const,
            tone: 'warning' as const,
            text:
              doc.reference || versionLabel(doc)
                ? t('bibliotheque.identity.confirm.found', { found: [doc.reference, versionLabel(doc) ? t('bibliotheque.identity.version', { version: versionLabel(doc) }) : ''].filter(Boolean).join(', ') })
                : t('bibliotheque.identity.confirm.none'),
            actions: [
              ...(doc.reference || versionLabel(doc)
                ? [{ id: 'confirm-identity', label: t('bibliotheque.identity.confirm'), icon: 'check' as const, primary: true, run: () => deps.confirmIdentity(doc.record) }]
                : []),
              { id: 'classify-identity', label: t('bibliotheque.classify'), icon: 'edit' as const, ...(doc.reference || versionLabel(doc) ? {} : { primary: true }), run: () => deps.classify(doc.record) }
            ]
          }
        ]
      : []),
  ]
  const moveDoc = async (): Promise<void> => {
    const moved = await deps.move(doc.record)
    if (moved && moved !== doc.record) deps.showPage?.(docPageOf(moved))
  }
  const edits: Record<string, () => Promise<void>> = {
    place: moveDoc,
    language: () => deps.chooseLanguage(doc.record),
    identity: () => deps.classify(doc.record),
    ...Object.fromEntries(EDITABLE_FIELDS.map((key) => [key, () => deps.editField(doc.record, key)]))
  }
  // Relancer la recherche d'un champ dans le document : ce seul champ (« Référence et version » : les trois ensemble).
  const researched: Record<string, ResearchField> = {
    title: 'title',
    language: 'language',
    reference: 'reference',
    edition: 'edition',
    revision: 'revision',
    identity: 'identity',
    date: 'date',
    category: 'category',
    issuer: 'issuer',
    tags: 'tags'
  }
  const withEdits = (items: ListItem[]): ListItem[] =>
    items.map((item) => {
      const tools: ViewAction[] = [
        ...(edits[item.id] ? [{ id: `edit-${item.id}`, label: t('bibliotheque.field.edit', { field: item.title }), icon: 'edit' as const, run: edits[item.id]! }] : []),
        ...(researched[item.id]
          ? [{ id: `research-${item.id}`, label: t('bibliotheque.field.research', { field: item.title }), icon: 'refresh' as const, run: () => deps.researchField(doc.record, researched[item.id]!) }]
          : []),
        // Des étiquettes hors de la liste : les y ajouter, en un clic.
        ...(item.id === 'tags' && outsideTags.length
          ? [{ id: 'add-tags', label: t('bibliotheque.tags.addThese', { tags: outsideTags.join(', ') }), icon: 'plus' as const, run: () => deps.addTags(doc.record) }]
          : []),
        // Un type de pièce hors de la liste : l'y ajouter, en un clic.
        ...(item.id === 'category' && outsideType && deps.canAddPieceType()
          ? [{ id: 'add-type', label: t('bibliotheque.category.addThis', { category: doc.category }), icon: 'plus' as const, run: () => deps.addPieceType(doc.record) }]
          : []),
        // Un émetteur hors de la liste : l'y ajouter, en un clic.
        ...(item.id === 'issuer' && outsideIssuer
          ? [{ id: 'add-issuer', label: t('bibliotheque.issuer.addThis', { issuer: doc.issuer }), icon: 'plus' as const, run: () => deps.addIssuer(doc.record) }]
          : [])
      ]
      return tools.length ? { ...item, tools } : item
    })
  // Le texte du fichier, transcrit dans la fiche (comme une pièce d'analyse) : son état, ses actions, son texte.
  const transcript = doc.reading === 'lue' ? ((await deps.store.transcriptText(doc.record)) ?? '') : ''
  const characters = (doc.characters ?? 0).toLocaleString('fr-FR')
  const textActions: ViewAction[] = [
    { id: 'extract', label: t(doc.reading ? 'bibliotheque.text.extract.again' : 'bibliotheque.text.extract'), tooltip: t('bibliotheque.text.extract.tip'), icon: 'refresh', ...(doc.reading ? {} : { primary: true }), run: () => deps.transcribe(doc.record) },
    { id: 'text-note', label: t('bibliotheque.doc.note'), icon: 'book', run: () => deps.showNote(doc.record) }
  ]
  const textSection: HomeBlock = {
    kind: 'section',
    id: 'bibliotheque.document.texte',
    title: t('bibliotheque.section.text'),
    subtitle: !doc.reading ? t('bibliotheque.section.text.never') : doc.reading === 'lue' ? t('bibliotheque.section.text.read', { characters }) : t(`bibliotheque.text.state.${doc.reading}`),
    icon: 'file',
    collapsed: true,
    blocks: [
      !doc.reading
        ? { kind: 'message', tone: 'info', text: t('bibliotheque.text.never'), actions: textActions }
        : doc.reading === 'lue'
          ? { kind: 'message', tone: 'info', text: t('bibliotheque.text.read', { characters }), actions: textActions }
          : { kind: 'message', tone: 'warning', text: `${t(`bibliotheque.text.state.${doc.reading}`)} — ${t(`bibliotheque.text.state.${doc.reading}.help`)}`, actions: textActions },
      ...(doc.reading === 'lue'
        ? [
            {
              // Mis en forme : ses titres, ses listes, ses tableaux (le Markdown de la lecture de fichiers).
              kind: 'markdown' as const,
              // En entier.
              text: transcript,
              empty: t('bibliotheque.text.none')
            }
          ]
        : [])
    ]
  }
  const confirmNames = [
    doc.languageToConfirm ? t('bibliotheque.field.language') : '',
    doc.titleToConfirm ? t('bibliotheque.field.title') : '',
    doc.categoryToConfirm ? t('bibliotheque.field.category') : '',
    doc.tagsToConfirm ? t('bibliotheque.field.tags') : '',
    doc.issuerToConfirm ? t('bibliotheque.field.issuer') : '',
    doc.dateToConfirm ? t('bibliotheque.field.date') : '',
    doc.identityToConfirm ? t('bibliotheque.field.identity') : ''
  ].filter(Boolean)
  const confirmBlocks: HomeBlock[] =
    confirming.length > 1
      ? [{ kind: 'section', id: 'bibliotheque.document.a-confirmer', title: t('bibliotheque.toConfirm.section', { count: confirming.length }), subtitle: confirmNames.join(' · '), icon: 'alert', blocks: confirming }]
      : confirming
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
      { id: 'language', label: t('bibliotheque.lang.choose'), tooltip: t('bibliotheque.lang.choose.tip'), icon: 'chat', run: () => deps.chooseLanguage(doc.record) },
      { id: 'version', label: t('bibliotheque.newVersionOf'), tooltip: t('bibliotheque.newVersionOf.tip'), icon: 'flow', run: () => deps.newVersionOf(doc.record) },
      {
        id: 'move',
        label: t('bibliotheque.move'),
        tooltip: t('bibliotheque.move.doc.tip'),
        icon: 'folder',
        run: moveDoc
      },
      { id: 'note', label: t('bibliotheque.doc.note'), icon: 'book', run: () => deps.showNote(doc.record) },
      {
        id: 'aside',
        label: t('bibliotheque.setAside'),
        tooltip: t('bibliotheque.setAside.tip'),
        icon: 'trash',
        run: async () => {
          if (await deps.setAside(doc.record)) deps.showPage?.(home)
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
      ...confirmBlocks,
      ...(newer.length ? [{ kind: 'message' as const, tone: 'info' as const, text: t('bibliotheque.replaced', { title: newer.at(-1)!.title }), actions: [{ ...open(newer.at(-1)!), label: t('bibliotheque.replaced.open') }] }] : []),
      { kind: 'stats', stats },
      // Le détail, en sections repliables — repliées d'origine : leur en-tête en dit l'essentiel.
      // Chaque champ : un bouton pour le modifier, seul (le lieu : Déplacer… ; la langue : Langue… ; à confirmer : Classer…).
      fold('identite', t('bibliotheque.section.identity'), [doc.category, doc.reference, versionLabel(doc), doc.language ? t(`bibliotheque.lang.${doc.language}`) : ''].filter(Boolean).join(' · '), 'info', {
        kind: 'list',
        items: withEdits([{ ...field('title', doc.title), ...(doc.titleToConfirm ? { detail: t('bibliotheque.title.detail.toConfirm', { title: doc.title }) } : doc.titleByAi ? { detail: t('bibliotheque.title.detail.byAi', { title: doc.title }) } : {}) }, field('place', placeLabel(deps.places, doc)), field('language', doc.language ? (doc.languageByAi ? t('bibliotheque.lang.byAi', { language: t(`bibliotheque.lang.${doc.language}`) }) : t(`bibliotheque.lang.${doc.language}`)) : doc.languageToConfirm ? t('bibliotheque.lang.toConfirm') : ''), field('reference', doc.reference), field('edition', doc.edition), field('revision', doc.revision), { ...field('date', doc.date ? docDateLabel(doc.date, deps.locale) : ''), ...(doc.dateToConfirm ? { detail: (doc.date ? t('bibliotheque.date.detail.toConfirm', { date: docDateLabel(doc.date, deps.locale) }) : t('bibliotheque.detail.toConfirm')) } : doc.dateByAi && doc.date ? { detail: t('bibliotheque.date.detail.byAi', { date: docDateLabel(doc.date, deps.locale) }) } : {}) },
          ...(doc.identityToConfirm || doc.identityByAi ? [field('identity', t(doc.identityToConfirm ? 'bibliotheque.identity.toConfirm' : 'bibliotheque.identity.byAi'))] : []), { ...field('category', doc.category ? deps.typeText(doc.category) : ''), ...(outsideType ? { detail: t('bibliotheque.category.detail.outside', { category: doc.category }) } : doc.categoryToConfirm ? { detail: (doc.category ? t('bibliotheque.category.detail.toConfirm', { category: deps.typeText(doc.category) }) : t('bibliotheque.detail.toConfirm')) } : doc.categoryByAi ? { detail: t('bibliotheque.category.detail.byAi', { category: doc.category ? deps.typeText(doc.category) : '—' }) } : {}) }, { ...field('issuer', issuerText(doc.issuer)), ...(outsideIssuer ? { detail: t('bibliotheque.issuer.detail.outside', { issuer: doc.issuer }) } : doc.issuerToConfirm ? { detail: (doc.issuer ? t('bibliotheque.issuer.detail.toConfirm', { issuer: issuerText(doc.issuer) }) : t('bibliotheque.detail.toConfirm')) } : doc.issuerByAi ? { detail: t('bibliotheque.issuer.detail.byAi', { issuer: issuerText(doc.issuer) || '—' }) } : {}) }, {
            ...field('tags', doc.tags.join(', ')),
            ...(outsideTags.length
              ? {
                  detail:
                    outsideTags.length === doc.tags.length
                      ? t('bibliotheque.tags.detail.outside', { tags: doc.tags.join(', ') })
                      : t('bibliotheque.tags.detail.someOutside', { tags: doc.tags.join(', '), outside: outsideTags.join(', ') })
                }
              : doc.tagsToConfirm ? { detail: (doc.tags.length ? t('bibliotheque.tags.detail.toConfirm', { tags: doc.tags.join(', ') }) : t('bibliotheque.detail.toConfirm')) } : doc.tagsByAi ? { detail: t('bibliotheque.tags.detail.byAi', { tags: doc.tags.join(', ') || '—' }) } : {})
          }])
      }),
      fold('fichier', t('bibliotheque.section.file'), present ? baseName(doc.file) : t('bibliotheque.section.file.missing', { name: baseName(doc.file) }), 'file', {
        kind: 'list',
        items: [
          {
            ...field('file', doc.file),
            ...(present
              ? {
                  open: { id: 'open', label: t('bibliotheque.doc.file'), run: () => deps.openFile(doc.file) },
                  tools: [{ id: 'rename-file', label: t('bibliotheque.file.rename'), icon: 'edit' as const, run: () => deps.renameFile(doc.record) }]
                }
              : { tone: 'danger' as const })
          },
          field('stored', t(doc.copied ? 'bibliotheque.stored.copied' : 'bibliotheque.stored.inPlace')),
          field('hash', doc.hash.slice(0, 16))
        ]
      }),
      fold('origines', t('bibliotheque.section.origins', { count: origins.length }), originText(t, doc), 'upload', { kind: 'list', items: origins, empty: t('bibliotheque.origins.none') }),
      ...(ghosts.length
        ? [
            fold('fantomes', t('bibliotheque.section.ghosts', { count: ghosts.length }), ghosts.map(({ ghost }) => placeLabel(deps.places, ghost)).join(' · '), 'copy', {
              kind: 'list',
              intro: [t('bibliotheque.ghost.hint')],
              items: ghosts.map(({ ghost }) => ({
                id: ghost.path,
                title: placeLabel(deps.places, ghost),
                detail: ghost.path,
                open: { id: 'open', label: t('bibliotheque.place.open'), run: () => deps.showPage?.(placePageOf(LIBRARY_PAGE, { shelf: ghost.shelf ?? '', directory: ghost.directory ?? '' })) }
              }))
            })
          ]
        : []),
      fold('versions', t('bibliotheque.section.versions'), older.length + newer.length ? t('bibliotheque.section.versions.sub', { count: older.length + newer.length }) : t('bibliotheque.versions.none'), 'flow', {
        kind: 'list',
        items: [...newer.reverse().map((each) => versionItem(each, 'apres')), ...older.map((each) => versionItem(each, 'avant'))],
        empty: t('bibliotheque.versions.none')
      }),
      textSection
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
  views.page({ id: LIBRARY_PAGE, title: t('bibliotheque.page.title'), icon: 'book', parent: HUB_PAGE, load: (param) => libraryPage(deps, param) })
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
