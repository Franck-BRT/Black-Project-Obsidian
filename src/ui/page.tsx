// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La page d'un module (la liste des analyses…), dans l'onglet de Black Projects comme le
 * tableau de bord. Le module la décrit en données (`PageView`) ; l'interface la dessine,
 * avec une recherche et des filtres qui trient ses cartes et ses listes sans recharger.
 */

import { useContext, useEffect, useState } from 'preact/hooks'
import type { Breadcrumb, Card, HomeBlock, ListItem, PageLayout, PageSpec, PageView, ViewAction } from '../core/views'
import { ActionButton, AfterAction, BlockView, BreadcrumbNav, LayoutContext } from './components'
import { DropLabel, useFileDrop } from './drop'
import type { AppHost } from './host'
import { Icon } from './icons'

type State = { status: 'loading' } | { status: 'ready'; view: PageView } | { status: 'failed'; reason: string }

/** Sans accents ni majuscules : « Échéance » se trouve en tapant « echeance ». */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

const cardText = (card: Card) => [card.title, card.subtitle, card.text, ...(card.badges ?? []).map((badge) => badge.label), ...(card.facts ?? []).map((fact) => `${fact.label} ${fact.value}`)].filter(Boolean).join(' ')
const itemText = (item: ListItem) => [item.title, item.detail].filter(Boolean).join(' ')

/**
 * Les blocs, filtrés : les cartes et les éléments de liste qui contiennent tous les mots
 * cherchés et, si un filtre est choisi, les cartes qui y répondent. Le reste ne bouge pas.
 * Les nombres ne comptent que ce que la recherche ou le filtre trie : un filtre ne
 * s'applique qu'aux cartes et aux listes dont les éléments portent des filtres ; les
 * autres listes ne comptent pas avec lui. Un bloc
 * vidé dit que rien ne correspond (`none`), à sa place.
 */
export function filterBlocks(blocks: readonly HomeBlock[], query: string, filter: string | null, none?: string): { blocks: HomeBlock[]; hits: number; total: number } {
  const words = fold(query).split(/\s+/).filter(Boolean)
  const matches = (text: string) => words.every((word) => fold(text).includes(word))
  let hits = 0
  let total = 0
  const out = blocks.map((block): HomeBlock => {
    if (block.kind === 'cards') {
      total += block.cards.length
      const cards = block.cards.filter((card) => matches(cardText(card)) && (!filter || (card.tags ?? []).includes(filter)))
      hits += cards.length
      return { ...block, cards, ...(none && block.cards.length && !cards.length ? { empty: none } : {}) }
    }
    if (block.kind === 'list') {
      // Une liste dont les éléments portent des filtres (le journal) se filtre comme des cartes.
      const tagged = block.items.some((item) => item.tags?.length)
      const items = block.items.filter((item) => matches(itemText(item)) && (!filter || !tagged || (item.tags ?? []).includes(filter)))
      if (!filter || tagged) {
        total += block.items.length
        hits += items.length
      }
      return { ...block, items, ...(none && block.items.length && !items.length ? { empty: none } : {}) }
    }
    if (block.kind === 'section') {
      // Une section : ses blocs triés de même ; elle dit combien elle en garde.
      const inner = filterBlocks(block.blocks, query, filter, none)
      hits += inner.hits
      total += inner.total
      return { ...block, blocks: inner.blocks, found: inner.hits }
    }
    if (block.kind === 'text') {
      // Du texte : les paragraphes qui contiennent les mots ; un filtre ne le trie pas.
      const paragraphs = block.paragraphs.filter((paragraph) => matches(paragraph))
      if (!filter) {
        total += block.paragraphs.length
        hits += paragraphs.length
      }
      return { ...block, paragraphs, ...(none && block.paragraphs.length && !paragraphs.length ? { empty: none } : {}) }
    }
    return block
  })
  return { blocks: out, hits, total }
}

const LAYOUT_ICON = { cards: 'grid', list: 'list', table: 'columns' } as const

/** La vue retenue pour une page (la dernière choisie sur cet appareil), si la page la propose. */
function storedLayout(page: string): PageLayout | null {
  try {
    const value = globalThis.localStorage?.getItem(`bp.page.layout.${page}`)
    return value === 'cards' || value === 'list' || value === 'table' ? value : null
  } catch {
    return null
  }
}

function storeLayout(page: string, layout: PageLayout): void {
  try {
    globalThis.localStorage?.setItem(`bp.page.layout.${page}`, layout)
  } catch {
    // Pas de stockage (une fenêtre privée) : la vue vaut pour la visite.
  }
}

/**
 * `hasHistory` : l'interface a un vrai « Retour » (la page précédente) ; le lien de la page
 * (« ← Toutes les analyses ») ne sert alors plus — il ne reste que quand on arrive tout
 * droit sur la page (une commande, l'ouverture de l'onglet).
 *
 * `onCrumbs` : l'interface dessine elle-même le fil d'Ariane de la page, tout en haut (au-
 * dessus du titre) ; sans elle, la page le dessine en tête.
 */
export function ModulePage({
  spec,
  param,
  host,
  generation,
  onTitle,
  onCrumbs,
  hasHistory
}: {
  spec: PageSpec
  param?: string
  host: AppHost
  generation: number
  onTitle?: (title: string | undefined) => void
  onCrumbs?: (crumbs: Breadcrumb | undefined) => void
  hasHistory?: boolean
}) {
  const { t } = host
  const [state, setState] = useState<State>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [chosen, setChosen] = useState<PageLayout | null>(() => storedLayout(spec.id))
  useEffect(() => setChosen(storedLayout(spec.id)), [spec.id])
  useEffect(() => {
    let alive = true
    setState((previous) => (previous.status === 'ready' ? previous : { status: 'loading' }))
    spec
      .load(param)
      .then((view) => {
        if (!alive) return
        setState({ status: 'ready', view })
        onTitle?.(view.title)
        onCrumbs?.(view.breadcrumb)
      })
      .catch((error: unknown) => alive && setState({ status: 'failed', reason: error instanceof Error ? error.message : String(error) }))
    return () => {
      alive = false
    }
  }, [spec, param, generation])
  // Une autre page : on repart sans recherche ni filtre, et sans le titre de la précédente.
  useEffect(() => {
    setQuery('')
    setFilter(null)
    setState({ status: 'loading' })
    onTitle?.(undefined)
    onCrumbs?.(undefined)
  }, [spec.id, param])

  if (state.status === 'loading') return <div class="bp-skeleton" aria-busy="true" aria-label={t('ui.loading')} />
  if (state.status === 'failed') return <BlockView block={{ kind: 'message', tone: 'danger', text: t('ui.section.failed', { reason: state.reason }) }} t={t} now={host.now()} locale={host.locale} />
  const { view } = state
  const narrowed = query.trim() !== '' || filter !== null
  const { blocks, hits, total } = filterBlocks(view.blocks, query, filter, t('ui.page.none'))
  const searchId = `bp-page-search-${spec.id}`
  const layouts = view.layouts ?? []
  const layout: PageLayout = chosen && layouts.includes(chosen) ? chosen : (layouts[0] ?? 'cards')
  const choose = (next: PageLayout) => {
    storeLayout(spec.id, next)
    setChosen(next)
  }
  return <PageBody {...{ view, spec, t, host, query, setQuery, filter, setFilter, layouts, layout, choose, searchId, narrowed, blocks, hits, total, onCrumbs, hasHistory }} />
}

interface PageBodyProps {
  view: PageView
  spec: PageSpec
  t: AppHost['t']
  host: AppHost
  query: string
  setQuery: (query: string) => void
  filter: string | null
  setFilter: (filter: string | null) => void
  layouts: readonly PageLayout[]
  layout: PageLayout
  choose: (layout: PageLayout) => void
  searchId: string
  narrowed: boolean
  blocks: HomeBlock[]
  hits: number
  total: number
  onCrumbs?: ((crumbs: Breadcrumb | undefined) => void) | undefined
  hasHistory?: boolean | undefined
}

/** Le corps d'une page prête ; une cible de glisser-déposer quand la page prend des fichiers. */
function PageBody({ view, spec, t, host, query, setQuery, filter, setFilter, layouts, layout, choose, searchId, narrowed, blocks, hits, total, onCrumbs, hasHistory }: PageBodyProps) {
  const drop = useFileDrop(view.drop)
  // Une carte survolée (un répertoire) dit son propre « Déposer pour verser dans… ».
  const [inner, setInner] = useState<string | null>(null)
  return (
    <div class={`bp-page${drop.over ? ' is-drop-over' : ''}`} data-page={spec.id} aria-busy={drop.busy || undefined} {...drop.props}>
      {drop.over && view.drop && (
        <div class="bp-drop-banner" role="status">
          <Icon name="upload" />
          {inner ?? view.drop.label}
        </div>
      )}
      {view.breadcrumb && !onCrumbs && <BreadcrumbNav crumbs={view.breadcrumb} />}
      {view.back && !hasHistory && (
        <button type="button" class="bp-back" onClick={() => void view.back!.run()}>
          <Icon name="back" />
          {view.back.label}
        </button>
      )}
      {view.subtitle && <p class="bp-page-sub">{view.subtitle}</p>}
      {!!view.actions?.length && (
        <div class="bp-actions bp-page-actions">
          {view.actions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      )}
      {view.drop?.hint && (
        <p class="bp-drop-hint">
          <Icon name="upload" />
          {view.drop.hint}
        </p>
      )}
      {(view.search || !!view.filters?.length) && (
        <div class="bp-page-tools" role="search">
          {view.search && (
            <div class="bp-page-search">
              <label class="bp-sr" for={searchId}>
                {view.search.label}
              </label>
              <Icon name="search" />
              <input id={searchId} class="bp-input" type="search" value={query} placeholder={view.search.placeholder ?? view.search.label} onInput={(event) => setQuery(event.currentTarget.value)} />
            </div>
          )}
          {!!view.filters?.length && (
            <div class="bp-chips" role="group" aria-label={t('ui.page.filters')}>
              {[{ id: null, label: t('ui.page.all') }, ...view.filters].map((each) => (
                <button key={each.id ?? 'all'} type="button" class="bp-chip" aria-pressed={filter === each.id} onClick={() => setFilter(each.id)}>
                  {filter === each.id && <Icon name="check" />}
                  {each.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {(layouts.length > 1 || view.grouping) && (
        <div class="bp-page-views">
          {layouts.length > 1 && (
            <div class="bp-segmented" role="group" aria-label={t('ui.page.layout')}>
              <span class="bp-segmented-label">{t('ui.page.layout')}</span>
              {layouts.map((each) => (
                <button key={each} type="button" class="bp-segment" aria-pressed={layout === each} onClick={() => choose(each)}>
                  <Icon name={LAYOUT_ICON[each]} />
                  {t(`ui.page.layout.${each}`)}
                </button>
              ))}
            </div>
          )}
          {view.grouping && (
            <div class="bp-segmented" role="group" aria-label={view.grouping.label}>
              <span class="bp-segmented-label">{view.grouping.label}</span>
              {view.grouping.options.map((option) => (
                <GroupingButton key={option.id} option={option} pressed={option.id === view.grouping!.current} />
              ))}
            </div>
          )}
        </div>
      )}
      {narrowed && (
        <p class="bp-page-count" role="status">
          {t('ui.page.count', { hits, total })}
        </p>
      )}
      <DropLabel.Provider value={setInner}>
      <LayoutContext.Provider value={layout}>
        <div class={`bp-page-body bp-layout-${layout}`}>
          {blocks.map((block, index) => (
            <BlockView key={block.kind === 'section' ? block.id : index} block={block} t={t} now={host.now()} locale={host.locale} narrowed={narrowed} />
          ))}
        </div>
      </LayoutContext.Provider>
      </DropLabel.Provider>
    </div>
  )
}

/** Un choix de regroupement : un bouton à bascule, qui demande à la page de se redessiner. */
function GroupingButton({ option, pressed }: { option: ViewAction; pressed: boolean }) {
  const after = useContext(AfterAction)
  return (
    <button
      type="button"
      class="bp-segment"
      aria-pressed={pressed}
      onClick={async () => {
        await option.run()
        after()
      }}
    >
      {option.icon && <Icon name={option.icon} />}
      {option.label}
    </button>
  )
}
