// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que la bibliothèque d'exigences montre dans l'interface : sur le tableau de bord,
 * combien, quelle note, combien de faibles ; sur la page **Exigences**, la même chose et
 * une carte par exigence — sa formulation, son type, son statut, sa criticité, sa note, ce
 * qui reste à revoir — avec une recherche et des filtres. Décrit en données
 * (`src/core/views.ts`) : l'interface dessine.
 */

import { localToday } from '../../core/dates'
import { pageWith, type Badge, type Card, type HomeSectionView, type ListItem, type PageView, type Stat, type Tone, type ViewAction, type ViewsRegistrar } from '../../core/views'
import { noteBlocks } from '../../core/markdown'
import { acceptTranslation, reviewRequirement, reviewSection, translateRequirement, translationNote } from './ai/actions'
import { hasDrifted, quantityDrift } from './ai/translate'
import { createRequirement, editRequirement, flagsOf, type Session } from './flows'
import { isUnreviewedMachine, textOf, type Requirement } from './model/requirement'
import { assessAll } from './quality/report'
import { assessRequirement, isWeak } from './quality/score'
import { libraryQualityPage, QUALITY_PAGE } from './qualityPage'
import { libraryQualityPath } from './workflows'
import { vocabularyLabel } from './vocabulary'

/** La page de la bibliothèque. */
export const LIBRARY_PAGE = 'exigences.bibliotheque'
/** La fiche d'une exigence : `requirementPageOf(chemin de sa note)`. */
export const REQUIREMENT_PAGE = 'exigences.fiche'
export const requirementPageOf = (path: string): string => pageWith(REQUIREMENT_PAGE, encodeURIComponent(path))

/** La page d'un import : `importPageOf(pièce)` — les exigences venues de ce fichier (leur origine). */
export const IMPORT_PAGE = 'exigences.import'
export const importPageOf = (piece: string): string => pageWith(IMPORT_PAGE, encodeURIComponent(piece))

/** Le dernier import, tant que le module est actif : ce qu'il a créé, mis à jour, manqué. */
export interface LastImport {
  /** L'origine écrite sur les exigences : le nom du fichier, ou son lien dans le coffre. */
  piece: string
  name: string
  date: string
  /** Les chemins des notes créées, mises à jour ; les identifiants de celles qui n'ont pas pu l'être. */
  created: string[]
  updated: string[]
  failed: string[]
}

/** Ce qui fait un import depuis l'interface (puis montre sa page), et le dernier fait. */
export interface ImportHooks {
  run(): Promise<void>
  last(): LastImport | null
}

/** Le nom d'une origine : « [[Pièces/CCTP.docx|CCTP.docx]] » → « CCTP.docx ». */
export function pieceName(piece: string): string {
  const link = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(piece.trim())
  return link ? (link[2] ?? link[1]!.slice(link[1]!.lastIndexOf('/') + 1)) : piece
}

/** Les chiffres de la bibliothèque : combien, la note moyenne, les faibles, les traductions à revoir. */
function libraryStats(session: Session, library: readonly Requirement[]): Stat[] {
  const { t } = session
  const settings = session.settings()
  const runs = assessAll(library, settings.languages, 'record')
  const mean = runs.length ? runs.reduce((sum, each) => sum + each.report.score, 0) / runs.length : null
  const weak = runs.filter((each) => each.report.stars < 3).length
  const lagging = library.filter((requirement) =>
    settings.languages.some((lang) => {
      const text = requirement.text[lang]
      return lang !== requirement.sourceLang && (!text || text.fromRev < requirement.rev || !text.reviewed)
    })
  ).length
  return [
    { label: t('exigences.home.count'), value: String(library.length), icon: 'list' },
    {
      label: t('exigences.home.mean'),
      value: mean === null ? '—' : `${Math.round(mean * 100)} %`,
      icon: 'star',
      ...(mean === null ? {} : { hint: '★'.repeat(Math.round(mean * 5)) + '☆'.repeat(5 - Math.round(mean * 5)) })
    },
    { label: t('exigences.home.weak'), value: String(weak), tone: weak ? 'warning' : 'success', hint: t(weak ? 'exigences.home.weak.some' : 'exigences.home.weak.none') },
    { label: t('exigences.home.lagging'), value: String(lagging), tone: lagging ? 'info' : 'success', hint: t(lagging ? 'exigences.home.lagging.some' : 'exigences.home.lagging.none') }
  ]
}

const DONE_STATUSES = ['approved', 'implemented', 'verified']
const DRAFT_STATUSES = ['draft', 'proposed']

/** La carte d'une exigence. */
function requirementCard(session: Session, requirement: Requirement, showPage?: (id: string) => void): Card {
  const { t } = session
  const languages = session.settings().languages
  const quality = assessRequirement(requirement, languages)
  // Les traductions absentes comptent comme « à revoir », comme dans les chiffres de la bibliothèque.
  const missing = languages.filter((lang) => lang !== requirement.sourceLang && !requirement.text[lang])
  const flags = [...(missing.length ? [t('exigences.page.missing', { langs: missing.join(', ').toUpperCase() })] : []), ...flagsOf(requirement, languages, t)]
  const path = requirement.filePath
  const statusTone: Badge['tone'] = requirement.status === 'rejected' || requirement.status === 'obsolete' ? 'neutral' : DONE_STATUSES.includes(requirement.status) ? 'success' : 'info'
  const badges: Badge[] = [
    ...(requirement.type ? [{ label: vocabularyLabel('type', requirement.type, t), tone: 'neutral' as const }] : []),
    ...(requirement.status ? [{ label: vocabularyLabel('status', requirement.status, t), tone: statusTone }] : []),
    ...(requirement.criticality ? [{ label: t('exigences.page.criticality', { value: vocabularyLabel('criticality', requirement.criticality, t) }), tone: requirement.criticality === 'high' ? ('warning' as const) : ('neutral' as const) }] : []),
    ...flags.map((flag) => ({ label: flag, tone: 'warning' as const }))
  ]
  const ai = session.ai?.() ?? null
  const actions: ViewAction[] = path
    ? [
        {
          id: 'edit',
          label: t('exigences.page.edit'),
          icon: 'edit',
          // La fiche modifiée se lit sur sa fiche : on y va (sous son nouveau nom, si le titre a changé).
          run: async () => {
            const next = await editRequirement(session, path)
            if (next && showPage) showPage(requirementPageOf(next))
          }
        },
        ...(ai
          ? [
              { id: 'review', label: t('exigences.page.review'), icon: 'spark' as const, run: async () => void (await reviewRequirement(session, ai, path, localToday())) },
              {
                id: 'translate',
                label: t('exigences.page.translate'),
                icon: 'chat' as const,
                // La traduction se lit sur la fiche : on y va, comme après « Relire » d'une analyse.
                run: async () => {
                  if ((await translateRequirement(session, ai, path, { date: localToday() })) === 'translated' && showPage) showPage(requirementPageOf(path))
                }
              }
            ]
          : [])
      ]
    : []
  const tags = [
    isWeak(quality) ? 'faibles' : 'bonnes',
    ...(flags.length ? ['a-revoir'] : []),
    ...(requirement.criticality === 'high' ? ['critiques'] : []),
    ...(DRAFT_STATUSES.includes(requirement.status) ? ['brouillons'] : []),
    ...(DONE_STATUSES.includes(requirement.status) ? ['approuvees'] : []),
    ...(Object.keys(requirement.text).some((lang) => isUnreviewedMachine(requirement, lang)) ? ['traductions'] : [])
  ]
  return {
    id: path ?? requirement.id,
    title: requirement.title ? `${requirement.id} — ${requirement.title}` : requirement.id,
    ...(requirement.category ? { subtitle: requirement.category } : {}),
    icon: 'list',
    badges,
    text: textOf(requirement, requirement.sourceLang)?.body ?? '',
    rating: { stars: quality.stars, label: t('exigences.page.rating') },
    // Avec des pages, un clic sur l'exigence ouvre sa fiche ; sinon, sa note.
    ...(path
      ? {
          open: showPage
            ? { id: 'open', label: t('exigences.fiche.open'), tooltip: t('exigences.fiche.open'), run: () => showPage(requirementPageOf(path)) }
            : { id: 'open', label: t('exigences.row.open'), tooltip: t('exigences.row.open'), run: () => session.ui.openNote(path) }
        }
      : {}),
    actions,
    tags
  }
}

/**
 * La page **Exigences** : la bibliothèque en chiffres, les actions (nouvelle, importer,
 * qualité), et une carte par exigence, les plus faibles d'abord — avec une recherche
 * (identifiant, titre, formulation…) et des filtres.
 */
export async function libraryPage(session: Session, run: (id: string) => Promise<void>, showPage?: (id: string) => void, imports?: ImportHooks, create?: () => Promise<void>): Promise<PageView> {
  const { t } = session
  const settings = session.settings()
  const library = await session.store.all()
  const languages = settings.languages
  // Les plus faibles d'abord (ce qu'il y a à reprendre), puis par identifiant.
  const sorted = [...library].sort((a, b) => assessRequirement(a, languages).score - assessRequirement(b, languages).score || a.id.localeCompare(b.id, undefined, { numeric: true }))
  return {
    subtitle: t('exigences.page.subtitle', { folder: settings.folder }),
    actions: [
      { id: 'new', label: t('exigences.command.create'), icon: 'plus', primary: true, run: create ?? (() => run('nouvelle')) },
      { id: 'import', label: t('exigences.tile.import'), icon: 'upload', run: () => (imports ? imports.run() : run('importer')) },
      // Avec des pages, la qualité s'ouvre en page (rien n'est écrit) ; sinon, le rapport.
      { id: 'quality', label: t('exigences.home.quality'), icon: 'star', run: () => (showPage ? showPage(QUALITY_PAGE) : run('qualite')) },
      ...(session.ai?.() && settings.languages.length > 1 ? [{ id: 'translate', label: t('exigences.page.translate'), tooltip: t('exigences.command.translateMany'), icon: 'chat' as const, run: () => run('traduire-ia-serie') }] : [])
    ],
    search: { label: t('exigences.page.search'), placeholder: t('exigences.page.search.placeholder') },
    filters: [
      { id: 'faibles', label: t('exigences.page.filter.weak') },
      { id: 'a-revoir', label: t('exigences.page.filter.review') },
      { id: 'critiques', label: t('exigences.page.filter.critical') },
      { id: 'brouillons', label: t('exigences.page.filter.draft') },
      { id: 'approuvees', label: t('exigences.page.filter.approved') },
      { id: 'traductions', label: t('exigences.page.filter.translations') }
    ],
    blocks: library.length
      ? [
          { kind: 'stats', stats: libraryStats(session, library) },
          { kind: 'cards', cards: sorted.map((requirement) => requirementCard(session, requirement, showPage)) }
        ]
      : [{ kind: 'message', tone: 'info', text: t('exigences.list.empty') }]
  }
}

const folderOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')))

/** La note d'une exigence renommée : « REQ-SOL-0001 Ancien titre.md » → celle qui porte REQ-SOL-0001 aujourd'hui. */
async function renamedFrom(session: Session, path: string): Promise<string | null> {
  const id = /^(\S+?)(?:\s.*)?\.md$/.exec(path.slice(path.lastIndexOf('/') + 1))?.[1]
  if (!id) return null
  const found = (await session.store.all().catch(() => [])).find((requirement) => requirement.id === id && requirement.filePath && requirement.filePath !== path)
  return found?.filePath ?? null
}

/** Ce qui coûte à un axe de qualité, en mots : une règle, un manque, un champ vide. */
export function describeMiss(miss: string, t: Session['t']): string {
  const known = (key: string) => {
    const text = t(key)
    return text === key ? null : text
  }
  const lang = /^text\.(.+)$/.exec(miss)?.[1]
  if (lang) return t('exigences.fiche.miss.text', { lang: lang.toUpperCase() })
  if (miss === 'links') return t('exigences.fiche.miss.links')
  if (miss === 'suspect') return t('exigences.flag.suspect')
  const field = known(`exigences.field.${miss}`)
  return known(`exigences.rule.${miss}`) ?? known(`exigences.miss.${miss}`) ?? (field ? t('exigences.fiche.miss.field', { field: field.toLowerCase() }) : miss)
}
const stars = (count: number) => '★'.repeat(count) + '☆'.repeat(Math.max(0, 5 - count))

/**
 * La **fiche** d'une exigence, en page : en tête Modifier la fiche, Relire et Traduire
 * (IA), Ouvrir la note ; ses chiffres (note, type, statut, criticité) ; ses formulations,
 * une carte par langue (source, traduction à jour, en retard ou à relire) ; la qualité
 * axe par axe ; ses attributs ; ses liens ; son historique. Celle de la bibliothèque comme
 * celle d'une analyse : le dossier de sa note dit où elle est rangée.
 */
export async function requirementPage(sessionFor: (folder: string) => Session, showPage: (id: string) => void, param: string | undefined, libraryFolder?: () => string): Promise<PageView> {
  const path = param ? decodeURIComponent(param) : ''
  const session = sessionFor(folderOf(path))
  const { t } = session
  const back: ViewAction = { id: 'back', label: t('exigences.fiche.back'), run: () => showPage(LIBRARY_PAGE) }
  const requirement = path ? await session.store.load(path).catch(() => null) : null
  if (!requirement && path) {
    // Renommée depuis (un titre modifié, « Retour » vers son ancien nom) : la même exigence, par son identifiant.
    const renamed = await renamedFrom(session, path)
    if (renamed) return requirementPage(sessionFor, showPage, encodeURIComponent(renamed), libraryFolder)
  }
  if (!requirement) return { title: t('exigences.fiche.missing.title'), back, blocks: [{ kind: 'message', tone: 'warning', text: t('exigences.fiche.missing') }] }

  const languages = session.settings().languages
  const quality = assessRequirement(requirement, languages)
  const ai = session.ai?.() ?? null
  const actions: ViewAction[] = [
    {
      id: 'edit',
      label: t('exigences.row.edit'),
      icon: 'edit',
      primary: true,
      // Un titre modifié renomme la note : la fiche la suit.
      run: async () => {
        const next = await editRequirement(session, path)
        if (next && next !== path) showPage(requirementPageOf(next))
      }
    },
    ...(ai
      ? [
          { id: 'review', label: t('exigences.page.review'), icon: 'spark' as const, run: async () => void (await reviewRequirement(session, ai, path, localToday())) },
          { id: 'translate', label: t('exigences.page.translate'), icon: 'chat' as const, run: async () => void (await translateRequirement(session, ai, path, { date: localToday() })) }
        ]
      : []),
    { id: 'note', label: t('exigences.row.open'), icon: 'file', run: () => session.ui.openNote(path) }
  ]

  const stats: Stat[] = [
    { label: t('exigences.fiche.rating'), value: `${Math.round(quality.score * 100)} %`, icon: 'star', tone: isWeak(quality) ? 'warning' : 'success', hint: stars(quality.stars) },
    { label: t('exigences.field.type'), value: vocabularyLabel('type', requirement.type, t), icon: 'list' },
    { label: t('exigences.field.status'), value: vocabularyLabel('status', requirement.status, t), icon: 'check', tone: DONE_STATUSES.includes(requirement.status) ? 'success' : 'neutral' },
    { label: t('exigences.field.criticality'), value: vocabularyLabel('criticality', requirement.criticality, t), icon: 'alert', ...(requirement.criticality === 'high' ? { tone: 'warning' as const } : {}) }
  ]

  // Les formulations : la langue source, puis chaque langue réglée ou déjà écrite.
  const note = await session.store.readNote(path).catch(() => '')
  const sourceBody = textOf(requirement, requirement.sourceLang)?.body ?? ''
  const langs = [...new Set([requirement.sourceLang, ...languages, ...Object.keys(requirement.text)])]
  const wordings: Card[] = langs.map((lang) => {
    const text = requirement.text[lang]
    const source = lang === requirement.sourceLang
    const badges: Badge[] = source
      ? [{ label: t('exigences.fiche.source'), tone: 'info' }]
      : !text
        ? [{ label: t('exigences.fiche.missingText'), tone: 'warning' }]
        : [
            ...(text.fromRev < requirement.rev ? [{ label: t('exigences.fiche.stale', { from: text.fromRev, rev: requirement.rev }), tone: 'warning' as const }] : []),
            ...(text.origin === 'machine' && !text.reviewed ? [{ label: t('exigences.flag.unreviewed'), tone: 'warning' as const }] : []),
            ...(text.fromRev >= requirement.rev && (text.origin === 'human' || text.reviewed) ? [{ label: t('exigences.fiche.upToDate'), tone: 'success' as const }] : [])
          ]
    // Ce qu'il faut voir avant de valider une traduction : les chiffres ou unités qui diffèrent, la note de l'IA.
    const drift = !source && text ? quantityDrift(sourceBody, text.body) : null
    const said = !source && text?.origin === 'machine' ? translationNote(note, lang) : null
    const facts = [
      ...(drift && hasDrifted(drift) ? [{ label: t('exigences.fiche.drift'), value: t('exigences.fiche.drift.detail', { missing: drift.missing.join(', ') || '—', added: drift.added.join(', ') || '—' }), tone: 'warning' as const }] : []),
      ...(said ? [{ label: said.date ? t('exigences.fiche.aiNote.on', { date: said.date }) : t('exigences.fiche.aiNote'), value: said.text }] : [])
    ]
    if (drift && hasDrifted(drift)) badges.unshift({ label: t('exigences.fiche.drift'), tone: 'warning' })
    const unreviewed = !source && text?.origin === 'machine' && !text.reviewed
    const cardActions: ViewAction[] = [
      ...(unreviewed ? [{ id: 'accept', label: t('exigences.fiche.accept'), tooltip: t('exigences.fiche.accept.tip'), icon: 'check' as const, run: async () => void (await acceptTranslation(session, path, lang)) }] : []),
      // Traduire vers la langue de la carte, sans la redemander.
      ...(!source && ai && (!text || text.fromRev < requirement.rev || unreviewed)
        ? [{ id: 'translate', label: t('exigences.page.translate'), icon: 'chat' as const, run: async () => void (await translateRequirement(session, ai, path, { lang, date: localToday() })) }]
        : [])
    ]
    return {
      id: `text-${lang}`,
      title: lang.toUpperCase(),
      ...(text
        ? {
            subtitle:
              text.by || text.at
                ? t(text.origin === 'machine' ? (text.reviewed ? 'exigences.fiche.byMachine.accepted' : 'exigences.fiche.byMachine') : 'exigences.fiche.byHuman', { by: text.by || '—', at: text.at.slice(0, 10) || '—' })
                : t(text.origin === 'machine' ? 'exigences.fiche.machine' : 'exigences.fiche.human')
          }
        : {}),
      icon: 'chat',
      badges,
      text: text?.body || t('exigences.fiche.noText'),
      wrap: true,
      ...(facts.length ? { facts } : {}),
      actions: cardActions
    }
  })

  const axes: ListItem[] = quality.axes.map((axis) => ({
    id: axis.id,
    title: t(`exigences.axis.${axis.id}`),
    detail: axis.misses.length ? axis.misses.map((miss) => describeMiss(miss, t)).join(' · ') : t('exigences.fiche.axisOk'),
    tone: (axis.score >= 0.99 ? 'success' : axis.score >= 0.5 ? 'warning' : 'danger') as Tone,
    when: `${Math.round(axis.score * 100)} %`
  }))

  const attribute = (key: string, value: string): ListItem => ({ id: key, title: t(`exigences.field.${key}`), detail: value || '—' })
  const attributes: ListItem[] = [
    attribute('category', requirement.category),
    { id: 'verification', title: t('exigences.field.verification'), detail: t(`exigences.verification.${requirement.verification}`) },
    attribute('source', requirement.source),
    attribute('rationale', requirement.rationale),
    attribute('owner', requirement.owner),
    attribute('tags', requirement.tags.join(', ')),
    attribute('aliases', requirement.aliases.join(', ')),
    ...(requirement.origin
      ? [
          {
            id: 'origin',
            title: t('exigences.fiche.origin'),
            detail: [requirement.origin.piece.replace(/^\[\[|\]\]$/g, '').split('|')[0], requirement.origin.locator].filter(Boolean).join(' — '),
            // Une exigence importée dans la bibliothèque : toutes celles du même fichier, en page.
            ...(libraryFolder && folderOf(path) === libraryFolder()
              ? { open: { id: 'import', label: t('exigences.fiche.origin.open'), tooltip: t('exigences.fiche.origin.open'), run: () => showPage(importPageOf(requirement.origin!.piece)) } }
              : {})
          }
        ]
      : []),
    { id: 'dates', title: t('exigences.fiche.dates'), detail: t('exigences.fiche.dates.detail', { created: requirement.createdAt.slice(0, 10) || '—', updated: requirement.updatedAt.slice(0, 10) || '—', rev: requirement.rev }) }
  ]
  const links: ListItem[] = requirement.links.map((link, index) => ({
    id: `link-${index}`,
    title: `${t(`exigences.fiche.link.${link.kind}`)} ${link.to}`,
    ...(link.suspect ? { detail: t('exigences.flag.suspect'), tone: 'warning' as const } : { tone: 'info' as const })
  }))
  const history: ListItem[] = [...requirement.history].reverse().map((revision, index) => ({
    id: `rev-${index}`,
    title: t('exigences.fiche.revision', { rev: revision.rev, lang: revision.lang.toUpperCase() }),
    when: revision.at.slice(0, 16).replace('T', ' '),
    detail: [revision.note, revision.was ? t('exigences.fiche.was', { was: revision.was }) : ''].filter(Boolean).join(' — ')
  }))

  // La dernière relecture par l'IA, écrite dans la note : son avis, ses constats, ses propositions.
  const review = reviewSection(note)
  return {
    title: requirement.title ? `${requirement.id} — ${requirement.title}` : requirement.id,
    back,
    subtitle: [requirement.category, folderOf(path)].filter(Boolean).join(' · '),
    actions,
    blocks: [
      { kind: 'stats', stats },
      { kind: 'cards', title: t('exigences.fiche.wordings', { count: langs.length }), cards: wordings },
      // La relecture d'abord : c'est ce qu'on vient lire après « Relire (IA) ».
      ...(review ? noteBlocks(review, () => undefined) : []),
      { kind: 'list', title: t('exigences.fiche.quality', { stars: stars(quality.stars) }), items: axes },
      { kind: 'list', title: t('exigences.fiche.attributes'), items: attributes },
      { kind: 'list', title: t('exigences.fiche.links', { count: links.length }), items: links, empty: t('exigences.fiche.links.none') },
      { kind: 'list', title: t('exigences.fiche.history', { count: history.length }), items: history, empty: t('exigences.fiche.history.none') }
    ]
  }
}

/**
 * La page d'un **import** : les exigences venues d'un fichier — celles que le dernier import
 * a créées ou mises à jour marquées, ce qui n'a pas pu l'être dit —, chacune avec l'endroit
 * du fichier d'où elle vient ; un clic ouvre sa fiche. L'origine est écrite sur chaque
 * exigence : la page se retrouve après coup, les chiffres du dernier import en moins.
 */
export async function importPage(session: Session, showPage: (id: string) => void, imports: ImportHooks | undefined, param: string | undefined): Promise<PageView> {
  const { t } = session
  const piece = param ? decodeURIComponent(param) : ''
  const name = pieceName(piece)
  const folder = session.settings().folder
  const languages = session.settings().languages
  const back: ViewAction = { id: 'back', label: t('exigences.fiche.back'), run: () => showPage(LIBRARY_PAGE) }
  const recent = imports?.last()?.piece === piece && piece ? imports.last() : null
  const created = new Set(recent?.created ?? [])
  const updated = new Set(recent?.updated ?? [])
  const library = piece ? await session.store.all() : []
  const imported = library
    .filter((requirement) => requirement.origin?.piece === piece)
    // Celles du dernier import d'abord (créées, puis mises à jour), puis par identifiant.
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id, undefined, { numeric: true }))
  function rank(requirement: Requirement): number {
    return created.has(requirement.filePath ?? '') ? 0 : updated.has(requirement.filePath ?? '') ? 1 : 2
  }
  const cards = imported.map((requirement) => {
    const card = requirementCard(session, requirement, showPage)
    const path = requirement.filePath ?? ''
    const mark: Badge[] = created.has(path)
      ? [{ label: t('exigences.importPage.badge.created'), tone: 'success' }]
      : updated.has(path)
        ? [{ label: t('exigences.importPage.badge.updated'), tone: 'info' }]
        : []
    return {
      ...card,
      badges: [...mark, ...(requirement.origin?.locator ? [{ label: requirement.origin.locator, tone: 'neutral' as const }] : []), ...(card.badges ?? [])],
      tags: [...(card.tags ?? []), ...(created.has(path) ? ['creees'] : []), ...(updated.has(path) ? ['mises-a-jour'] : [])]
    }
  })
  const weak = imported.filter((requirement) => isWeak(assessRequirement(requirement, languages))).length
  const stats: Stat[] = [
    { label: t('exigences.importPage.count'), value: String(imported.length), icon: 'list' },
    ...(recent
      ? [
          { label: t('exigences.importPage.created'), value: String(recent.created.length), icon: 'plus' as const, tone: 'success' as const },
          { label: t('exigences.importPage.updated'), value: String(recent.updated.length), icon: 'refresh' as const, tone: 'info' as const },
          ...(recent.failed.length ? [{ label: t('exigences.importPage.failed'), value: String(recent.failed.length), icon: 'alert' as const, tone: 'danger' as const }] : [])
        ]
      : []),
    { label: t('exigences.home.weak'), value: String(weak), icon: 'star', tone: weak ? 'warning' : 'success' }
  ]
  return {
    title: t('exigences.importPage.title', { name: name || '—' }),
    back,
    subtitle: recent ? t('exigences.importPage.subtitle.recent', { date: recent.date, folder }) : t('exigences.importPage.subtitle', { folder }),
    actions: [
      ...(imports ? [{ id: 'again', label: t('exigences.importPage.again'), icon: 'upload' as const, run: () => imports.run() }] : []),
      { id: 'library', label: t('exigences.page.all'), icon: 'list', run: () => showPage(LIBRARY_PAGE) }
    ],
    search: { label: t('exigences.page.search'), placeholder: t('exigences.page.search.placeholder') },
    filters: [
      ...(recent ? [{ id: 'creees', label: t('exigences.importPage.filter.created') }, { id: 'mises-a-jour', label: t('exigences.importPage.filter.updated') }] : []),
      { id: 'faibles', label: t('exigences.page.filter.weak') },
      { id: 'a-revoir', label: t('exigences.page.filter.review') }
    ],
    blocks: [
      ...(imported.length ? [{ kind: 'stats' as const, stats }] : []),
      ...(recent?.failed.length ? [{ kind: 'message' as const, tone: 'warning' as const, text: t('exigences.importPage.failed.text', { ids: recent.failed.join(', ') }) }] : []),
      ...(imported.length ? [{ kind: 'cards' as const, cards }] : [{ kind: 'message' as const, tone: 'info' as const, text: t('exigences.importPage.empty', { name: name || '—' }) }])
    ]
  }
}

/** La bibliothèque : sa page, quand la plateforme en a ; sinon la liste en fenêtre. */
export async function openLibrary(showPage: ((id: string) => void) | undefined, browse: () => Promise<void>): Promise<void> {
  if (showPage) showPage(LIBRARY_PAGE)
  else await browse()
}

export function registerExigencesHome(
  views: ViewsRegistrar | undefined,
  session: Session,
  run: (id: string) => Promise<void>,
  showPage?: (id: string) => void,
  sessionFor?: (folder: string) => Session,
  imports?: ImportHooks
): void {
  if (!views) return
  const { t } = session
  const page = showPage ? { page: LIBRARY_PAGE } : {}
  const open = () => (showPage ? showPage(LIBRARY_PAGE) : run('liste'))
  const quality = () => (showPage ? showPage(QUALITY_PAGE) : run('qualite'))
  // Avec des pages, une exigence créée depuis l'interface s'ouvre en fiche ; sinon, sa note (la commande).
  const create = async () => {
    if (!showPage || !sessionFor) return run('nouvelle')
    const created = await createRequirement(session)
    if (created?.filePath) showPage(requirementPageOf(created.filePath))
  }
  views.home({
    id: 'exigences.library',
    title: t('exigences.home.title'),
    icon: 'list',
    order: 30,
    area: 'side',
    async load(): Promise<HomeSectionView> {
      const settings = session.settings()
      const library = await session.store.all()
      return {
        title: t('exigences.home.title'),
        subtitle: t('exigences.home.subtitle', { folder: settings.folder }),
        icon: 'list',
        ...(showPage ? { actions: [{ id: 'all', label: t('exigences.page.all'), icon: 'chevron' as const, run: open }] } : {}),
        blocks: [
          { kind: 'stats', stats: libraryStats(session, library) },
          {
            kind: 'actions',
            actions: [
              { id: 'new', label: t('exigences.command.create'), icon: 'plus', run: create },
              // Avec une page, le lien d'en-tête y mène déjà.
              ...(showPage ? [] : [{ id: 'list', label: t('exigences.home.browse'), icon: 'search' as const, run: open }]),
              { id: 'quality', label: t('exigences.home.quality'), icon: 'star', run: quality }
            ]
          }
        ]
      }
    }
  })
  // Avec des pages, un import lancé de l'interface finit sur sa page ; sinon, le message seul.
  const importHere = showPage ? imports : undefined
  views.page({ id: LIBRARY_PAGE, title: t('exigences.home.title'), icon: 'list', load: () => libraryPage(session, run, showPage, importHere, create) })
  if (showPage && sessionFor) {
    views.page({ id: REQUIREMENT_PAGE, title: t('exigences.fiche.title'), icon: 'list', parent: LIBRARY_PAGE, load: (param) => requirementPage(sessionFor, showPage, param, () => session.settings().folder) })
    views.page({ id: QUALITY_PAGE, title: t('exigences.quality.title'), icon: 'star', parent: LIBRARY_PAGE, load: () => libraryQualityPage({ session, showPage, library: LIBRARY_PAGE, requirementPageOf }) })
    views.page({ id: IMPORT_PAGE, title: t('exigences.importPage.nav'), icon: 'upload', parent: LIBRARY_PAGE, load: (param) => importPage(session, showPage, importHere, param) })
    // Une exigence de la bibliothèque, ouverte par un autre module : sa fiche.
    // Le rapport de qualité, lui, est la page de la qualité.
    views.notePage?.((path) => (path === libraryQualityPath(session) ? QUALITY_PAGE : path.startsWith(`${session.settings().folder}/`) && path.endsWith('.md') ? requirementPageOf(path) : null))
  }
  views.nav({ id: 'exigences', label: t('exigences.home.nav'), icon: 'list', order: 20, ...page, run: open })
  const group = t('exigences.name')
  views.tile({
    id: 'exigences.liste',
    label: t('exigences.home.nav'),
    icon: 'list',
    color: 'green',
    group,
    order: 20,
    byDefault: true,
    description: t('exigences.tile.list.desc'),
    ...page,
    run: open,
    async badge() {
      const library = await session.store.all()
      const weak = assessAll(library, session.settings().languages, 'record').filter((each) => each.report.stars < 3).length
      return weak ? { text: String(weak), tone: 'warning', label: t('exigences.tile.weak', { count: weak }) } : null
    }
  })
  views.tile({ id: 'exigences.nouvelle', label: t('exigences.tile.new'), icon: 'plus', color: 'green', group, order: 21, description: t('exigences.tile.new.desc'), run: create })
  views.tile({ id: 'exigences.qualite', label: t('exigences.tile.quality'), icon: 'star', color: 'green', group, order: 22, description: t('exigences.tile.quality.desc'), ...(showPage ? { page: QUALITY_PAGE } : {}), run: quality })
  views.tile({ id: 'exigences.importer', label: t('exigences.tile.import'), icon: 'upload', color: 'green', group, order: 23, description: t('exigences.tile.import.desc'), run: () => (importHere ? importHere.run() : run('importer')) })
}
