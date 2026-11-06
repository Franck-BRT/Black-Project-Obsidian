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
import type { Badge, Card, HomeSectionView, PageView, Stat, ViewAction, ViewsRegistrar } from '../../core/views'
import { reviewRequirement, translateRequirement } from './ai/actions'
import { editRequirement, flagsOf, type Session } from './flows'
import { textOf, type Requirement } from './model/requirement'
import { assessAll } from './quality/report'
import { assessRequirement, isWeak } from './quality/score'
import { vocabularyLabel } from './vocabulary'

/** La page de la bibliothèque. */
export const LIBRARY_PAGE = 'exigences.bibliotheque'

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
function requirementCard(session: Session, requirement: Requirement): Card {
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
        { id: 'edit', label: t('exigences.page.edit'), icon: 'edit', run: async () => void (await editRequirement(session, path)) },
        ...(ai
          ? [
              { id: 'review', label: t('exigences.page.review'), icon: 'spark' as const, run: async () => void (await reviewRequirement(session, ai, path, localToday())) },
              { id: 'translate', label: t('exigences.page.translate'), icon: 'chat' as const, run: async () => void (await translateRequirement(session, ai, path)) }
            ]
          : [])
      ]
    : []
  const tags = [
    isWeak(quality) ? 'faibles' : 'bonnes',
    ...(flags.length ? ['a-revoir'] : []),
    ...(requirement.criticality === 'high' ? ['critiques'] : []),
    ...(DRAFT_STATUSES.includes(requirement.status) ? ['brouillons'] : []),
    ...(DONE_STATUSES.includes(requirement.status) ? ['approuvees'] : [])
  ]
  return {
    id: path ?? requirement.id,
    title: requirement.title ? `${requirement.id} — ${requirement.title}` : requirement.id,
    ...(requirement.category ? { subtitle: requirement.category } : {}),
    icon: 'list',
    badges,
    text: textOf(requirement, requirement.sourceLang)?.body ?? '',
    rating: { stars: quality.stars, label: t('exigences.page.rating') },
    ...(path ? { open: { id: 'open', label: t('exigences.row.open'), tooltip: t('exigences.row.open'), run: () => session.ui.openNote(path) } } : {}),
    actions,
    tags
  }
}

/**
 * La page **Exigences** : la bibliothèque en chiffres, les actions (nouvelle, importer,
 * qualité), et une carte par exigence, les plus faibles d'abord — avec une recherche
 * (identifiant, titre, formulation…) et des filtres.
 */
export async function libraryPage(session: Session, run: (id: string) => Promise<void>): Promise<PageView> {
  const { t } = session
  const settings = session.settings()
  const library = await session.store.all()
  const languages = settings.languages
  // Les plus faibles d'abord (ce qu'il y a à reprendre), puis par identifiant.
  const sorted = [...library].sort((a, b) => assessRequirement(a, languages).score - assessRequirement(b, languages).score || a.id.localeCompare(b.id, undefined, { numeric: true }))
  return {
    subtitle: t('exigences.page.subtitle', { folder: settings.folder }),
    actions: [
      { id: 'new', label: t('exigences.command.create'), icon: 'plus', primary: true, run: () => run('nouvelle') },
      { id: 'import', label: t('exigences.tile.import'), icon: 'upload', run: () => run('importer') },
      { id: 'quality', label: t('exigences.home.quality'), icon: 'star', run: () => run('qualite') }
    ],
    search: { label: t('exigences.page.search'), placeholder: t('exigences.page.search.placeholder') },
    filters: [
      { id: 'faibles', label: t('exigences.page.filter.weak') },
      { id: 'a-revoir', label: t('exigences.page.filter.review') },
      { id: 'critiques', label: t('exigences.page.filter.critical') },
      { id: 'brouillons', label: t('exigences.page.filter.draft') },
      { id: 'approuvees', label: t('exigences.page.filter.approved') }
    ],
    blocks: library.length
      ? [
          { kind: 'stats', stats: libraryStats(session, library) },
          { kind: 'cards', cards: sorted.map((requirement) => requirementCard(session, requirement)) }
        ]
      : [{ kind: 'message', tone: 'info', text: t('exigences.list.empty') }]
  }
}

/** La bibliothèque : sa page, quand la plateforme en a ; sinon la liste en fenêtre. */
export async function openLibrary(showPage: ((id: string) => void) | undefined, browse: () => Promise<void>): Promise<void> {
  if (showPage) showPage(LIBRARY_PAGE)
  else await browse()
}

export function registerExigencesHome(views: ViewsRegistrar | undefined, session: Session, run: (id: string) => Promise<void>, showPage?: (id: string) => void): void {
  if (!views) return
  const { t } = session
  const page = showPage ? { page: LIBRARY_PAGE } : {}
  const open = () => (showPage ? showPage(LIBRARY_PAGE) : run('liste'))
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
              { id: 'new', label: t('exigences.command.create'), icon: 'plus', run: () => run('nouvelle') },
              // Avec une page, le lien d'en-tête y mène déjà.
              ...(showPage ? [] : [{ id: 'list', label: t('exigences.home.browse'), icon: 'search' as const, run: open }]),
              { id: 'quality', label: t('exigences.home.quality'), icon: 'star', run: () => run('qualite') }
            ]
          }
        ]
      }
    }
  })
  views.page({ id: LIBRARY_PAGE, title: t('exigences.home.title'), icon: 'list', load: () => libraryPage(session, run) })
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
  views.tile({ id: 'exigences.nouvelle', label: t('exigences.tile.new'), icon: 'plus', color: 'green', group, order: 21, description: t('exigences.tile.new.desc'), run: () => run('nouvelle') })
  views.tile({ id: 'exigences.qualite', label: t('exigences.tile.quality'), icon: 'star', color: 'green', group, order: 22, description: t('exigences.tile.quality.desc'), run: () => run('qualite') })
  views.tile({ id: 'exigences.importer', label: t('exigences.tile.import'), icon: 'upload', color: 'green', group, order: 23, description: t('exigences.tile.import.desc'), run: () => run('importer') })
}
