// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les composants de l'interface, qui dessinent les descriptions des modules
 * (`src/core/views.ts`). Accessibles : de vrais boutons, des titres, des listes, une
 * icône et un mot avec chaque couleur, des libellés pour les lecteurs d'écran.
 */

import { useState } from 'preact/hooks'
import type { Badge as BadgeView, Card as CardView, Deadline, HomeBlock, ListItem, Stat as StatView, Tone, ViewAction } from '../core/views'
import type { Translate } from './host'
import { Icon } from './icons'
import { daysUntil, deadlineTone, starGlyphs, TONE_ICON } from './logic'

/** Un bouton d'action ; occupé (désactivé) pendant que l'action tourne. */
export function ActionButton({ action, compact }: { action: ViewAction; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await action.run()
    } finally {
      setBusy(false)
    }
  }
  const iconOnly = compact && action.icon
  return (
    <button
      type="button"
      class={`bp-button${action.primary ? ' bp-button-primary' : ''}${iconOnly ? ' bp-button-icon' : ''}`}
      onClick={run}
      disabled={busy}
      aria-busy={busy}
      title={action.tooltip ?? (iconOnly ? action.label : undefined)}
      aria-label={iconOnly ? action.label : undefined}
    >
      {action.icon && <Icon name={action.icon} />}
      {!iconOnly && <span>{action.label}</span>}
    </button>
  )
}

export function Badge({ badge }: { badge: BadgeView }) {
  return (
    <span class={`bp-badge bp-tone-${badge.tone}`}>
      <Icon name={TONE_ICON[badge.tone]} />
      {badge.label}
    </span>
  )
}

/** Une échéance : les jours qui restent, en gros, l'urgence par la couleur, l'icône et le mot. */
export function DeadlineView({ deadline, t, now, locale }: { deadline: Deadline; t: Translate; now: Date; locale: string }) {
  const days = daysUntil(deadline.date, now)
  if (days === null) return null
  const tone = deadlineTone(days)
  const [y, m, d] = deadline.date.split('-').map(Number)
  const long = new Date(y!, m! - 1, d!).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const when = days < 0 ? t('ui.deadline.past', { days: -days }) : days === 0 ? t('ui.deadline.today') : t('ui.deadline.in', { days })
  return (
    <div class={`bp-deadline bp-tone-${tone}`}>
      <Icon name={days < 0 ? 'check' : tone === 'danger' ? 'alert' : 'clock'} />
      <span class="bp-deadline-days" aria-hidden="true">
        {days < 0 ? '—' : `J-${days}`}
      </span>
      <span class="bp-deadline-text">
        <strong>{deadline.label}</strong>
        <small>
          {long} · {when}
        </small>
      </span>
    </div>
  )
}

export function CardView({ card, t, now, locale }: { card: CardView; t: Translate; now: Date; locale: string }) {
  const titleId = `bp-card-${card.id}`
  return (
    <article class="bp-card" aria-labelledby={titleId}>
      <div class="bp-card-head">
        {card.icon && (
          <span class="bp-card-icon">
            <Icon name={card.icon} />
          </span>
        )}
        <div>
          <h3 class="bp-card-title" id={titleId}>
            {card.open ? (
              <button type="button" class="bp-card-open" onClick={() => void card.open!.run()} title={card.open.tooltip}>
                {card.title}
              </button>
            ) : (
              card.title
            )}
          </h3>
          {card.subtitle && <p class="bp-card-sub">{card.subtitle}</p>}
        </div>
      </div>
      {!!card.badges?.length && (
        <div class="bp-badges">
          {card.badges.map((badge) => (
            <Badge key={badge.label} badge={badge} />
          ))}
        </div>
      )}
      {card.text && <p class="bp-card-text">{card.text}</p>}
      {card.deadline && <DeadlineView deadline={card.deadline} t={t} now={now} locale={locale} />}
      {!!card.facts?.length && (
        <dl class="bp-facts">
          {card.facts.map((fact) => (
            <div class={`bp-fact${fact.tone ? ` bp-tone-${fact.tone}` : ''}`} key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {card.rating && (
        <span class="bp-stars">
          <span class="bp-stars-glyphs" aria-hidden="true">
            {starGlyphs(card.rating.stars)}
          </span>
          <span>{card.rating.label}</span>
          <span class="bp-sr">{t('ui.stars', { stars: Math.round(card.rating.stars) })}</span>
        </span>
      )}
      {!!card.actions?.length && (
        <div class="bp-card-actions">
          {card.actions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      )}
    </article>
  )
}

export function StatView({ stat }: { stat: StatView }) {
  return (
    <div class={`bp-stat${stat.tone ? ` bp-tone-${stat.tone}` : ''}`}>
      <span class="bp-stat-label">
        {stat.icon && <Icon name={stat.icon} />}
        {stat.label}
      </span>
      <span class="bp-stat-value">{stat.value}</span>
      {stat.hint && (
        <span class="bp-stat-hint">
          {stat.tone && <Icon name={TONE_ICON[stat.tone]} />} {stat.hint}
        </span>
      )}
    </div>
  )
}

function ListItemView({ item }: { item: ListItem }) {
  const tone: Tone = item.tone ?? 'neutral'
  return (
    <li class="bp-list-item">
      <span class={`bp-list-mark bp-tone-${tone}`}>
        <Icon name={TONE_ICON[tone]} />
      </span>
      <div class="bp-list-body">
        <div class="bp-list-title">
          {item.open ? (
            <button type="button" onClick={() => void item.open!.run()}>
              {item.title}
            </button>
          ) : (
            item.title
          )}
        </div>
        {item.detail && <div class="bp-list-detail">{item.detail}</div>}
      </div>
      {item.when && <span class="bp-list-when">{item.when}</span>}
    </li>
  )
}

/** Un bloc de section, selon sa sorte. */
export function BlockView({ block, t, now, locale }: { block: HomeBlock; t: Translate; now: Date; locale: string }) {
  switch (block.kind) {
    case 'actions':
      return (
        <div class="bp-actions">
          {block.actions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      )
    case 'cards':
      return block.cards.length ? (
        <div class="bp-cards">
          {block.cards.map((card) => (
            <CardView key={card.id} card={card} t={t} now={now} locale={locale} />
          ))}
        </div>
      ) : (
        <p class="bp-empty">{block.empty ?? t('ui.empty')}</p>
      )
    case 'stats':
      return (
        <div class="bp-stats">
          {block.stats.map((stat) => (
            <StatView key={stat.label} stat={stat} />
          ))}
        </div>
      )
    case 'list':
      return block.items.length ? (
        <ul class="bp-list">
          {block.items.map((item) => (
            <ListItemView key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p class="bp-empty">{block.empty ?? t('ui.empty')}</p>
      )
    case 'message':
      return (
        <div class={`bp-message bp-tone-${block.tone}`} role={block.tone === 'danger' ? 'alert' : undefined}>
          <Icon name={TONE_ICON[block.tone]} />
          <div class="bp-message-body">
            <p class="bp-text" style={{ margin: 0 }}>
              {block.text}
            </p>
            {!!block.actions?.length && (
              <div class="bp-actions">
                {block.actions.map((action) => (
                  <ActionButton key={action.id} action={action} />
                ))}
              </div>
            )}
          </div>
        </div>
      )
  }
}
