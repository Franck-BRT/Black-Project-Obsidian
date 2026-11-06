// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La page d'accueil : un bonjour et la date, puis les sections déclarées par les modules
 * — chacune chargée à part, un module lent ou en panne n'empêchant pas les autres de
 * s'afficher.
 */

import { useEffect, useState } from 'preact/hooks'
import type { HomeSection, HomeSectionView } from '../core/views'
import { ActionButton, BlockView } from './components'
import type { AppHost } from './host'
import { Icon } from './icons'

type State = { status: 'loading' } | { status: 'ready'; view: HomeSectionView | null } | { status: 'failed'; reason: string }

function Section({ section, host, generation }: { section: HomeSection; host: AppHost; generation: number }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    section
      .load()
      .then((view) => alive && setState({ status: 'ready', view }))
      .catch((error: unknown) => alive && setState({ status: 'failed', reason: error instanceof Error ? error.message : String(error) }))
    return () => {
      alive = false
    }
  }, [section, generation])
  const { t } = host
  if (state.status === 'ready' && !state.view) return null
  const titleId = `bp-section-${section.id}`
  if (state.status !== 'ready') {
    return (
      <section class="bp-section" aria-busy={state.status === 'loading'} aria-label={state.status === 'loading' ? t('ui.loading') : undefined}>
        {state.status === 'loading' ? (
          <div class="bp-skeleton" />
        ) : (
          <BlockView block={{ kind: 'message', tone: 'danger', text: t('ui.section.failed', { reason: state.reason }) }} t={t} now={host.now()} locale={host.locale} />
        )}
      </section>
    )
  }
  const view = state.view!
  return (
    <section class="bp-section" aria-labelledby={titleId}>
      <div class="bp-section-head">
        <div>
          <h2 class="bp-section-title" id={titleId}>
            {view.icon && <Icon name={view.icon} />}
            {view.title}
          </h2>
          {view.subtitle && <p class="bp-section-sub">{view.subtitle}</p>}
        </div>
        {!!view.actions?.length && (
          <div class="bp-section-actions">
            {view.actions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </div>
        )}
      </div>
      {view.blocks.map((block, index) => (
        <BlockView key={index} block={block} t={t} now={host.now()} locale={host.locale} />
      ))}
    </section>
  )
}

export function HomePage({ host, generation }: { host: AppHost; generation: number }) {
  const sections = host.sections()
  const column = (area: 'main' | 'side') => (
    <div class="bp-column">
      {sections
        .filter((section) => section.area === area)
        .map((section) => (
          <Section key={section.id} section={section} host={host} generation={generation} />
        ))}
    </div>
  )
  if (!sections.length) {
    return <BlockView block={{ kind: 'message', tone: 'info', text: host.t('ui.home.empty') }} t={host.t} now={host.now()} locale={host.locale} />
  }
  return (
    <div class="bp-home">
      {column('main')}
      {column('side')}
    </div>
  )
}
