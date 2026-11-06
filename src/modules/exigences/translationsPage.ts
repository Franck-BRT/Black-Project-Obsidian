// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **traductions à relire** vers une langue, en page : là où l'on finit le travail après
 * « Traduire des exigences ». Une carte par exigence dont la traduction est de la machine
 * et pas encore validée — et celles de la dernière série, même validées depuis —, avec sa
 * traduction, la formulation source à côté, les chiffres ou unités qui diffèrent et la
 * note de l'IA ; « Valider la traduction », « Traduire de nouveau », un clic ouvre la fiche.
 */

import { localToday } from '../../core/dates'
import { pageWith, type Badge, type Card, type Fact, type PageView, type ViewAction } from '../../core/views'
import { acceptTranslation, translateRequirement, translationNote, translationState } from './ai/actions'
import { hasDrifted, quantityDrift } from './ai/translate'
import type { Session } from './flows'
import { textOf } from './model/requirement'

/** La page des traductions à relire : `translationsPageOf(langue)`. */
export const TRANSLATIONS_PAGE = 'exigences.traductions'
export const translationsPageOf = (lang: string): string => pageWith(TRANSLATIONS_PAGE, encodeURIComponent(lang))

/** La dernière série, tant que le module est actif : la langue, ce qu'elle a traduit, si elle s'est arrêtée. */
export interface LastTranslations {
  lang: string
  date: string
  paths: string[]
  failed: boolean
}

/** Traduire des exigences depuis l'interface (puis montrer cette page), et la dernière série. */
export interface TranslationsHooks {
  run(): Promise<void>
  last(): LastTranslations | null
}

export interface TranslationsPageDeps {
  session: Session
  showPage: (id: string) => void
  library: string
  requirementPageOf: (path: string) => string
  hooks?: TranslationsHooks
}

export async function translationsPage(deps: TranslationsPageDeps, param: string | undefined): Promise<PageView> {
  const { session, showPage } = deps
  const { t } = session
  const settings = session.settings()
  const lang = (param ? decodeURIComponent(param) : '') || settings.languages.find((each) => each !== settings.languages[0]) || ''
  const LANG = lang.toUpperCase()
  const recent = deps.hooks?.last()?.lang === lang ? deps.hooks.last() : null
  const fromRun = new Set(recent?.paths ?? [])
  const ai = session.ai?.() ?? null
  const library = (await session.store.all()).filter((requirement) => requirement.filePath && requirement.sourceLang !== lang)
  const shown = library
    .filter((requirement) => translationState(requirement, lang) === 'unreviewed' || fromRun.has(requirement.filePath!))
    // Ce qui reste à relire d'abord, celles dont les chiffres diffèrent en tête ; puis ce qui a été validé.
    .map((requirement) => {
      const text = textOf(requirement, lang)
      const drift = text ? quantityDrift(textOf(requirement, requirement.sourceLang)?.body ?? '', text.body) : null
      return { requirement, text, drift: drift && hasDrifted(drift) ? drift : null, pending: translationState(requirement, lang) === 'unreviewed' }
    })
    .sort((a, b) => Number(b.pending) - Number(a.pending) || Number(!!b.drift) - Number(!!a.drift) || a.requirement.id.localeCompare(b.requirement.id, undefined, { numeric: true }))

  const notes = new Map(await Promise.all(shown.map(async (each): Promise<[string, ReturnType<typeof translationNote>]> => [each.requirement.id, translationNote(await session.store.readNote(each.requirement.filePath!).catch(() => ''), lang)])))
  const cards: Card[] = shown.map(({ requirement, text, drift, pending }) => {
    const path = requirement.filePath!
    const said = notes.get(requirement.id)
    const badges: Badge[] = [
      pending ? { label: t('exigences.flag.unreviewed'), tone: 'warning' } : { label: t('exigences.trp.badge.accepted'), tone: 'success' },
      ...(drift ? [{ label: t('exigences.fiche.drift'), tone: 'warning' as const }] : []),
      ...(fromRun.has(path) ? [{ label: t('exigences.trp.badge.run'), tone: 'info' as const }] : [])
    ]
    const facts: Fact[] = [
      { label: t('exigences.trp.source', { lang: requirement.sourceLang.toUpperCase() }), value: textOf(requirement, requirement.sourceLang)?.body ?? '—' },
      ...(drift ? [{ label: t('exigences.fiche.drift'), value: t('exigences.fiche.drift.detail', { missing: drift.missing.join(', ') || '—', added: drift.added.join(', ') || '—' }), tone: 'warning' as const }] : []),
      ...(said ? [{ label: said.date ? t('exigences.fiche.aiNote.on', { date: said.date }) : t('exigences.fiche.aiNote'), value: said.text }] : [])
    ]
    const actions: ViewAction[] = [
      ...(pending ? [{ id: 'accept', label: t('exigences.fiche.accept'), tooltip: t('exigences.fiche.accept.tip'), icon: 'check' as const, run: async () => void (await acceptTranslation(session, path, lang)) }] : []),
      ...(ai ? [{ id: 'translate', label: t('exigences.trp.again'), icon: 'chat' as const, run: async () => void (await translateRequirement(session, ai, path, { lang, date: localToday() })) }] : [])
    ]
    const tags = [...(pending ? ['a-relire'] : ['validees']), ...(drift ? ['ecarts'] : []), ...(said ? ['notes'] : []), ...(fromRun.has(path) ? ['serie'] : [])]
    return {
      id: path,
      title: requirement.title ? `${requirement.id} — ${requirement.title}` : requirement.id,
      subtitle: LANG,
      icon: 'chat',
      badges,
      text: text?.body ?? t('exigences.fiche.noText'),
      wrap: true,
      facts,
      open: { id: 'open', label: t('exigences.fiche.open'), tooltip: t('exigences.fiche.open'), run: () => showPage(deps.requirementPageOf(path)) },
      actions,
      tags
    }
  })

  const pending = shown.filter((each) => each.pending).length
  const drifted = shown.filter((each) => each.pending && each.drift).length
  const others = settings.languages.filter((each) => each !== lang && each !== settings.languages[0])
  return {
    title: t('exigences.trp.title', { lang: LANG }),
    back: { id: 'back', label: t('exigences.fiche.back'), run: () => showPage(deps.library) },
    subtitle: recent ? t('exigences.trp.subtitle.recent', { date: recent.date, count: recent.paths.length }) : t('exigences.trp.subtitle'),
    actions: [
      ...(deps.hooks && ai ? [{ id: 'more', label: t('exigences.trp.more'), icon: 'chat' as const, run: () => deps.hooks!.run() }] : []),
      // Les autres langues de rédaction : leur page.
      ...others.map((each) => ({ id: `lang-${each}`, label: t('exigences.trp.other', { lang: each.toUpperCase() }), icon: 'chevron' as const, run: () => showPage(translationsPageOf(each)) })),
      { id: 'library', label: t('exigences.page.all'), icon: 'list', run: () => showPage(deps.library) }
    ],
    search: { label: t('exigences.page.search'), placeholder: t('exigences.page.search.placeholder') },
    filters: [
      { id: 'a-relire', label: t('exigences.trp.filter.pending') },
      { id: 'ecarts', label: t('exigences.fiche.drift') },
      { id: 'notes', label: t('exigences.trp.filter.notes') },
      ...(recent ? [{ id: 'serie', label: t('exigences.trp.filter.run') }, { id: 'validees', label: t('exigences.trp.filter.accepted') }] : [])
    ],
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('exigences.trp.stat.pending'), value: String(pending), icon: 'chat', tone: pending ? 'warning' : 'success' },
          { label: t('exigences.fiche.drift'), value: String(drifted), icon: 'alert', ...(drifted ? { tone: 'warning' as const } : {}) },
          ...(recent ? [{ label: t('exigences.trp.stat.run'), value: String(recent.paths.length), icon: 'refresh' as const, tone: 'info' as const }] : [])
        ]
      },
      ...(recent?.failed ? [{ kind: 'message' as const, tone: 'warning' as const, text: t('exigences.trp.stopped') }] : []),
      ...(cards.length ? [{ kind: 'cards' as const, cards }] : [{ kind: 'message' as const, tone: 'success' as const, text: t('exigences.trp.none', { lang: LANG }) }])
    ]
  }
}
