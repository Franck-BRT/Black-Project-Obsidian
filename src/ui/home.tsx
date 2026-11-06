// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le tableau de bord : les sections déclarées par les modules — chacune chargée à part, un
 * module lent ou en panne n'empêchant pas les autres de s'afficher — rangées comme
 * l'utilisateur le veut. Chaque section se réduit à son titre (et n'est alors plus
 * chargée). « Modifier le tableau de bord » montre les sections en fiches : glisser pour
 * déplacer, ou les boutons Monter, Descendre, Changer de colonne, Masquer ; les sections
 * masquées se réaffichent d'un clic. Le rangement est gardé dans les réglages.
 */

import { useEffect, useRef, useState } from 'preact/hooks'
import type { DashboardLayout, HomeSection, HomeSectionView } from '../core/views'
import { ActionButton, BlockView } from './components'
import { arrange, columnOf, defaultLayout, hideSection, moveSection, placeSection, showSection, switchColumn, toggleCollapsed, type Column } from './dashboard'
import type { AppHost } from './host'
import { Icon } from './icons'

type State = { status: 'loading' } | { status: 'ready'; view: HomeSectionView | null } | { status: 'failed'; reason: string }

function Section({ section, host, generation, collapsed, toggle }: { section: HomeSection; host: AppHost; generation: number; collapsed: boolean; toggle: () => void }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(() => {
    // Réduite : rien à charger.
    if (collapsed) return
    let alive = true
    setState((previous) => (previous.status === 'ready' ? previous : { status: 'loading' }))
    section
      .load()
      .then((view) => alive && setState({ status: 'ready', view }))
      .catch((error: unknown) => alive && setState({ status: 'failed', reason: error instanceof Error ? error.message : String(error) }))
    return () => {
      alive = false
    }
  }, [section, generation, collapsed])
  const { t } = host
  if (!collapsed && state.status === 'ready' && !state.view) return null
  const titleId = `bp-section-${section.id}`
  const bodyId = `bp-section-body-${section.id}`
  const view = !collapsed && state.status === 'ready' ? state.view : null
  const title = view?.title ?? section.title
  const icon = view?.icon ?? section.icon
  return (
    <section class={`bp-section${collapsed ? ' is-collapsed' : ''}`} aria-labelledby={titleId} aria-busy={!collapsed && state.status === 'loading'} data-section={section.id}>
      <div class="bp-section-head">
        <div class="bp-section-heading">
          <button type="button" class="bp-section-toggle" aria-expanded={!collapsed} aria-controls={bodyId} title={t(collapsed ? 'ui.dashboard.expand' : 'ui.dashboard.collapse', { title })} onClick={toggle}>
            <Icon name="chevron" />
            <span class="bp-sr">{t(collapsed ? 'ui.dashboard.expand' : 'ui.dashboard.collapse', { title })}</span>
          </button>
          <div>
            <h2 class="bp-section-title" id={titleId}>
              {icon && <Icon name={icon} />}
              {title}
            </h2>
            {view?.subtitle && <p class="bp-section-sub">{view.subtitle}</p>}
          </div>
        </div>
        {!!view?.actions?.length && (
          <div class="bp-section-actions">
            {view.actions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </div>
        )}
      </div>
      <div id={bodyId} hidden={collapsed}>
        {!collapsed && state.status === 'loading' && <div class="bp-skeleton" aria-label={t('ui.loading')} />}
        {!collapsed && state.status === 'failed' && <BlockView block={{ kind: 'message', tone: 'danger', text: t('ui.section.failed', { reason: state.reason }) }} t={t} now={host.now()} locale={host.locale} />}
        {view?.blocks.map((block, index) => (
          <BlockView key={index} block={block} t={t} now={host.now()} locale={host.locale} />
        ))}
      </div>
    </section>
  )
}

/** Une section en mode modification : une fiche à ranger. */
function EditCard({
  section,
  layout,
  t,
  dragged,
  setDragged,
  apply,
  moved
}: {
  section: HomeSection
  layout: DashboardLayout
  t: AppHost['t']
  dragged: string | null
  setDragged: (id: string | null) => void
  apply: (next: DashboardLayout, message: string, focus?: { id: string; tool: string }) => void
  /** Ce qu'on annonce d'une section déplacée : sa colonne et sa place. */
  moved: (next: DashboardLayout, id: string) => string
}) {
  const column = columnOf(layout, section.id)!
  const ids = layout[column]
  const index = ids.indexOf(section.id)
  const title = section.title
  const other = column === 'main' ? 'ui.dashboard.toSide' : 'ui.dashboard.toMain'
  const button = (tool: string, icon: Parameters<typeof Icon>[0]['name'], label: string, run: () => void, disabled = false) => (
    <button type="button" class="bp-button bp-button-icon" data-tool={tool} aria-label={label} title={label} disabled={disabled} onClick={run}>
      <Icon name={icon} />
    </button>
  )
  // Le focus suit la section déplacée : même bouton, à sa nouvelle place.
  const move = (next: DashboardLayout, tool: string) => apply(next, moved(next, section.id), { id: section.id, tool })
  return (
    <li
      class={`bp-dash-card${dragged === section.id ? ' is-dragged' : ''}`}
      draggable
      data-section={section.id}
      onDragStart={(event) => {
        setDragged(section.id)
        event.dataTransfer?.setData('text/plain', section.id)
      }}
      onDragOver={(event) => {
        if (dragged) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (dragged && dragged !== section.id) {
          const next = placeSection(layout, dragged, column, section.id)
          apply(next, moved(next, dragged))
        }
        setDragged(null)
      }}
      onDragEnd={() => setDragged(null)}
    >
      <span class="bp-dash-grip" aria-hidden="true">
        <Icon name="grip" />
      </span>
      <span class="bp-dash-name">
        {section.icon && <Icon name={section.icon} />}
        <span>{title}</span>
      </span>
      <span class="bp-dash-tools">
        {button('up', 'up', t('ui.dashboard.up', { title }), () => move(moveSection(layout, section.id, -1), 'up'), index === 0)}
        {button('down', 'down', t('ui.dashboard.down', { title }), () => move(moveSection(layout, section.id, 1), 'down'), index === ids.length - 1)}
        {button('columns', 'columns', t(other, { title }), () => move(switchColumn(layout, section.id), 'columns'))}
        {button('hide', 'hide', t('ui.dashboard.hide', { title }), () => apply(hideSection(layout, section.id), t('ui.dashboard.hidden', { title }), { id: section.id, tool: 'show' }))}
      </span>
    </li>
  )
}

export function HomePage({ host, generation }: { host: AppHost; generation: number }) {
  const { t } = host
  const sections = host.sections()
  const [layout, setLayout] = useState<DashboardLayout>(() => arrange(sections, host.dashboard()))
  const [editing, setEditing] = useState(false)
  const [dragged, setDragged] = useState<string | null>(null)
  const [said, setSaid] = useState('')
  const [focus, setFocus] = useState<{ id: string; tool: string } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => setLayout(arrange(host.sections(), host.dashboard())), [generation])
  // Après un déplacement au clavier : le focus revient sur le bouton de la section ; s'il
  // est désactivé (la section est arrivée en haut), sur le premier bouton actif de sa fiche.
  useEffect(() => {
    if (!focus || !root.current) return
    const card = root.current.querySelector<HTMLElement>(`[data-section="${focus.id}"]`)
    const wanted = card?.querySelector<HTMLButtonElement>(`[data-tool="${focus.tool}"]`)
    const target = wanted && !wanted.disabled ? wanted : card?.querySelector<HTMLButtonElement>('button:not([disabled])')
    target?.focus()
    setFocus(null)
  }, [focus])

  if (!sections.length) {
    return <BlockView block={{ kind: 'message', tone: 'info', text: t('ui.home.empty') }} t={t} now={host.now()} locale={host.locale} />
  }
  const byId = new Map(sections.map((section) => [section.id, section]))
  const apply = (next: DashboardLayout, message: string, then?: { id: string; tool: string }) => {
    setLayout(next)
    setSaid(message)
    if (then) setFocus(then)
    void host.saveDashboard(next)
  }
  const moved = (next: DashboardLayout, id: string) => {
    const at = columnOf(next, id) ?? 'main'
    return t('ui.dashboard.moved', { title: byId.get(id)?.title ?? id, column: t(at === 'main' ? 'ui.dashboard.main' : 'ui.dashboard.side'), position: next[at].indexOf(id) + 1, count: next[at].length })
  }
  const reset = () => {
    setLayout(defaultLayout(sections))
    setSaid(t('ui.dashboard.reset'))
    void host.saveDashboard(null)
  }
  const of = (ids: string[]) => ids.map((id) => byId.get(id)).filter((section): section is HomeSection => !!section)
  const dropZone = (column: Column) => (
    <li
      class="bp-dash-drop"
      onDragOver={(event) => {
        if (dragged) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (dragged) {
          const next = placeSection(layout, dragged, column)
          apply(next, moved(next, dragged))
        }
        setDragged(null)
      }}
    >
      {t('ui.dashboard.drop')}
    </li>
  )
  const editColumn = (column: Column) => (
    <section class="bp-dash-column" aria-labelledby={`bp-dash-${column}`}>
      <h2 class="bp-dash-column-title" id={`bp-dash-${column}`}>
        {t(column === 'main' ? 'ui.dashboard.main' : 'ui.dashboard.side')}
      </h2>
      <ul class="bp-dash-list" role="list">
        {of(layout[column]).map((section) => (
          <EditCard key={section.id} section={section} layout={layout} t={t} dragged={dragged} setDragged={setDragged} apply={apply} moved={moved} />
        ))}
        {dropZone(column)}
      </ul>
    </section>
  )
  const viewColumn = (ids: string[]) => (
    <div class="bp-column">
      {of(ids).map((section) => (
        <Section
          key={section.id}
          section={section}
          host={host}
          generation={generation}
          collapsed={layout.collapsed.includes(section.id)}
          toggle={() => apply(toggleCollapsed(layout, section.id), t(layout.collapsed.includes(section.id) ? 'ui.dashboard.expanded' : 'ui.dashboard.collapsed', { title: section.title }))}
        />
      ))}
    </div>
  )
  const columns = (['main', 'side'] as const).filter((column) => layout[column].length > 0)
  const hidden = of(layout.hidden)

  return (
    <div class={`bp-dashboard${editing ? ' is-editing' : ''}`} ref={root}>
      <div class="bp-springboard-bar">
        {editing && <p class="bp-intro">{t('ui.dashboard.help')}</p>}
        <div class="bp-header-tools">
          {editing && (
            <button type="button" class="bp-button" onClick={reset}>
              <Icon name="refresh" />
              <span>{t('ui.dashboard.reset')}</span>
            </button>
          )}
          <button type="button" class={`bp-button${editing ? ' bp-button-primary' : ''}`} aria-pressed={editing} onClick={() => setEditing(!editing)}>
            <Icon name={editing ? 'check' : 'edit'} />
            <span>{t(editing ? 'ui.tiles.done' : 'ui.dashboard.edit')}</span>
          </button>
        </div>
      </div>
      <p class="bp-sr" aria-live="polite">
        {said}
      </p>
      {editing ? (
        <>
          <div class="bp-home">
            {editColumn('main')}
            {editColumn('side')}
          </div>
          <section class="bp-section bp-dash-hidden" aria-labelledby="bp-dash-hidden">
            <h2 class="bp-section-title" id="bp-dash-hidden">
              <Icon name="hide" />
              {t('ui.dashboard.hiddenTitle')}
            </h2>
            {hidden.length === 0 ? (
              <p class="bp-empty">{t('ui.dashboard.noneHidden')}</p>
            ) : (
              <ul class="bp-dash-list" role="list">
                {hidden.map((section) => (
                  <li key={section.id} class="bp-dash-card is-hidden" data-section={section.id}>
                    <span class="bp-dash-name">
                      {section.icon && <Icon name={section.icon} />}
                      <span>{section.title}</span>
                    </span>
                    <button type="button" class="bp-button" data-tool="show" onClick={() => apply(showSection(layout, section), t('ui.dashboard.shown', { title: section.title }), { id: section.id, tool: 'hide' })}>
                      <Icon name="plus" />
                      <span>{t('ui.dashboard.show')}</span>
                      <span class="bp-sr">{` « ${section.title} »`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : columns.length === 0 ? (
        <p class="bp-empty">{t('ui.dashboard.allHidden')}</p>
      ) : (
        <div class={`bp-home${columns.length === 1 ? ' is-single' : ''}`}>{columns.map((column) => viewColumn(layout[column]))}</div>
      )}
    </div>
  )
}
