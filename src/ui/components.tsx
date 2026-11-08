// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les composants de l'interface, qui dessinent les descriptions des modules
 * (`src/core/views.ts`). Accessibles : de vrais boutons, des titres, des listes, une
 * icône et un mot avec chaque couleur, des libellés pour les lecteurs d'écran.
 */

import { createContext, type ComponentChildren } from 'preact'
import { useContext, useState } from 'preact/hooks'
import type { Badge as BadgeView, Breadcrumb, Card as CardView, Deadline, FlowNode, HomeBlock, ListItem, PageLayout, Stat as StatView, Tone, ViewAction } from '../core/views'
import type { Translate } from './host'
import { useFileDrop, type DropState } from './drop'
import { Icon } from './icons'
import { daysUntil, deadlineTone, starGlyphs, TONE_ICON } from './logic'

/**
 * Ce qu'il faut faire quand une action est finie : redessiner (une action peut changer ce
 * qui est montré sans toucher au coffre — activer un workflow change un réglage).
 */
export const AfterAction = createContext<() => void>(() => {})

/** Un bouton d'action ; occupé (désactivé) pendant que l'action tourne. */
/** Au-delà, la valeur d'un fait est une phrase, pas un chiffre. */
const LONG_FACT = 32

export function ActionButton({ action, compact }: { action: ViewAction; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const after = useContext(AfterAction)
  const run = async () => {
    setBusy(true)
    try {
      await action.run()
    } finally {
      setBusy(false)
      after()
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

/** La classe d'une carte qui reçoit des fichiers : survolée, occupée. */
const dropClass = (drop: DropState): string => `${drop.over ? ' is-drop-over' : ''}${drop.busy ? ' is-busy' : ''}`

export function CardView({ card, t, now, locale }: { card: CardView; t: Translate; now: Date; locale: string }) {
  const titleId = `bp-card-${card.id}`
  const drop = useFileDrop(card.drop)
  return (
    <article class={`bp-card${dropClass(drop)}`} aria-labelledby={titleId} title={drop.over ? card.drop?.label : undefined} {...drop.props}>
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
      {card.text && <p class={`bp-card-text${card.wrap ? ' is-full' : ''}`}>{card.text}</p>}
      {card.deadline && <DeadlineView deadline={card.deadline} t={t} now={now} locale={locale} />}
      {!!card.facts?.length && (
        <dl class="bp-facts">
          {card.facts.map((fact) => (
            // Une phrase (la note de l'IA sur une traduction) prend toute la largeur, en texte courant.
            <div class={`bp-fact${fact.tone ? ` bp-tone-${fact.tone}` : ''}${fact.value.length > LONG_FACT ? ' is-long' : ''}`} key={fact.label}>
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

/** La vue des cartes de la page en cours : la grille (d'origine), une liste, un tableau. */
export const LayoutContext = createContext<PageLayout>('cards')

/** Une carte en une ligne : son icône, son titre (et sous-titre), ses badges, ses faits, ses boutons. */
function CardRow({ card, t, now, locale }: { card: CardView; t: Translate; now: Date; locale: string }) {
  const titleId = `bp-cardrow-${card.id}`
  const drop = useFileDrop(card.drop)
  return (
    <li class={`bp-cardrow${dropClass(drop)}`} aria-labelledby={titleId} {...drop.props}>
      {card.icon && (
        <span class="bp-card-icon bp-cardrow-icon">
          <Icon name={card.icon} />
        </span>
      )}
      <div class="bp-cardrow-main">
        <div class="bp-cardrow-title" id={titleId}>
          {card.open ? (
            <button type="button" class="bp-card-open" onClick={() => void card.open!.run()} title={card.open.tooltip}>
              {card.title}
            </button>
          ) : (
            card.title
          )}
        </div>
        {(card.subtitle || card.text) && <div class="bp-cardrow-sub">{[card.subtitle, card.text].filter(Boolean).join(' — ')}</div>}
      </div>
      {!!card.badges?.length && (
        <div class="bp-badges bp-cardrow-badges">
          {card.badges.map((badge) => (
            <Badge key={badge.label} badge={badge} />
          ))}
        </div>
      )}
      {card.deadline && <DeadlineView deadline={card.deadline} t={t} now={now} locale={locale} />}
      {!!card.facts?.length && (
        <dl class="bp-cardrow-facts">
          {card.facts.map((fact) => (
            <div key={fact.label} class={fact.tone ? `bp-tone-${fact.tone}` : undefined}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {!!card.actions?.length && (
        <div class="bp-cardrow-actions">
          {card.actions.map((action) => (
            <ActionButton key={action.id} action={action} compact />
          ))}
        </div>
      )}
    </li>
  )
}

/** Une ligne du tableau, qui reçoit des fichiers quand sa carte en accepte. */
function DropRow({ card, children }: { card: CardView; children: ComponentChildren }) {
  const drop = useFileDrop(card.drop)
  return (
    <tr class={dropClass(drop).trim() || undefined} {...drop.props}>
      {children}
    </tr>
  )
}

/** Des cartes en tableau : le nom, l'état (les badges), une colonne par fait, les boutons. */
function CardsTable({ cards, t }: { cards: readonly CardView[]; t: Translate }) {
  const columns = [...new Set(cards.flatMap((card) => (card.facts ?? []).map((fact) => fact.label)))]
  return (
    <div class="bp-cardtable-wrap">
      <table class="bp-cardtable">
        <thead>
          <tr>
            <th scope="col">{t('ui.page.table.name')}</th>
            <th scope="col">{t('ui.page.table.state')}</th>
            {columns.map((column) => (
              <th scope="col" key={column}>
                {column}
              </th>
            ))}
            <th scope="col">
              <span class="bp-sr">{t('ui.page.table.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <DropRow key={card.id} card={card}>
              <th scope="row">
                {card.open ? (
                  <button type="button" class="bp-card-open" onClick={() => void card.open!.run()} title={card.open.tooltip}>
                    {card.title}
                  </button>
                ) : (
                  card.title
                )}
                {card.subtitle && <div class="bp-cardrow-sub">{card.subtitle}</div>}
              </th>
              <td>
                <div class="bp-badges">
                  {(card.badges ?? []).map((badge) => (
                    <Badge key={badge.label} badge={badge} />
                  ))}
                </div>
              </td>
              {columns.map((column) => {
                const fact = card.facts?.find((each) => each.label === column)
                return (
                  <td key={column} class={fact?.tone ? `bp-tone-${fact.tone}` : undefined}>
                    {fact?.value ?? '—'}
                  </td>
                )
              })}
              <td>
                <div class="bp-cardtable-actions">
                  {(card.actions ?? []).map((action) => (
                    <ActionButton key={action.id} action={action} compact />
                  ))}
                </div>
              </td>
            </DropRow>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Un fil d'Ariane : chaque étape un bouton, la dernière (là où l'on est) sans lien. */
export function BreadcrumbNav({ crumbs }: { crumbs: Breadcrumb }) {
  return (
    <nav class="bp-crumbs" aria-label={crumbs.label}>
      <ol>
        {crumbs.items.map((item, index) => {
          const last = index === crumbs.items.length - 1
          const inner = (
            <>
              {item.icon && <Icon name={item.icon} />}
              {item.label}
            </>
          )
          return (
            <li key={item.id}>
              {item.run && !last ? (
                <button type="button" class="bp-crumb" onClick={() => void item.run!()}>
                  {inner}
                </button>
              ) : (
                <span class="bp-crumb is-here" aria-current={last ? 'location' : undefined}>
                  {inner}
                </span>
              )}
              {!last && (
                <span class="bp-crumb-sep" aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Un logigramme : ses formes de haut en bas, reliées par des flèches ; une question a sa branche « non ». */
function Flowchart({ block }: { block: Extract<HomeBlock, { kind: 'flowchart' }> }) {
  const shape = (node: FlowNode) => {
    const inner = (
      <>
        {node.caption && <span class="bp-flow-caption">{node.caption}</span>}
        <span class="bp-flow-label">
          {node.icon && <Icon name={node.icon} />}
          {node.label}
        </span>
        {node.detail && <span class="bp-flow-detail">{node.detail}</span>}
      </>
    )
    return node.open ? (
      <button type="button" class="bp-flow-shape" onClick={() => void node.open!.run()} title={node.open.tooltip ?? node.open.label}>
        {inner}
      </button>
    ) : (
      <div class="bp-flow-shape">{inner}</div>
    )
  }
  return (
    <figure class="bp-flow" aria-label={block.label}>
      {block.title && <figcaption class="bp-block-title">{block.title}</figcaption>}
      <ol class="bp-flow-list">
        {block.nodes.map((node, index) => (
          <li key={node.id} class={`bp-flow-node is-${node.kind}`} data-tone={node.tone}>
            {shape(node)}
            {node.kind === 'decision' && node.no && (
              <span class="bp-flow-no">
                <span class="bp-flow-no-line" aria-hidden="true" />
                <span class="bp-flow-no-end">{node.no}</span>
              </span>
            )}
            {index < block.nodes.length - 1 && (
              <span class="bp-flow-link" aria-hidden="true">
                {node.kind === 'decision' && node.yes && <span class="bp-flow-yes">{node.yes}</span>}
              </span>
            )}
          </li>
        ))}
      </ol>
    </figure>
  )
}

/** Ce que l'utilisateur a fait des sections repliables (repliée ou non), le temps de la session. */
const folded = new Map<string, boolean>()

/** Une section repliable : son intitulé (le bouton), puis ses blocs. */
function FoldSection({ block, t, now, locale, narrowed }: { block: Extract<HomeBlock, { kind: 'section' }>; t: Translate; now: Date; locale: string; narrowed?: boolean }) {
  const [collapsed, setCollapsed] = useState(() => folded.get(block.id) ?? block.collapsed ?? false)
  // Une recherche, un filtre : celles sans résultat disparaissent, les autres s'ouvrent.
  if (narrowed && !block.found) return null
  const open = narrowed || !collapsed
  const bodyId = `bp-fold-${block.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const toggle = () => {
    const next = !collapsed
    folded.set(block.id, next)
    setCollapsed(next)
  }
  return (
    <section class={`bp-fold${open ? '' : ' is-collapsed'}`} data-section={block.id}>
      <button type="button" class="bp-fold-head" aria-expanded={open} aria-controls={bodyId} disabled={narrowed} onClick={toggle} title={t(open ? 'ui.dashboard.collapse' : 'ui.dashboard.expand', { title: block.title })}>
        <span class="bp-fold-chevron">
          <Icon name="chevron" />
        </span>
        {block.icon && <Icon name={block.icon} />}
        <span class="bp-fold-title">{block.title}</span>
        {block.subtitle && <span class="bp-fold-sub">{block.subtitle}</span>}
      </button>
      <div class="bp-fold-body" id={bodyId} hidden={!open}>
        {open && block.blocks.map((inner, index) => <BlockView key={inner.kind === 'section' ? inner.id : index} block={inner} t={t} now={now} locale={locale} {...(narrowed ? { narrowed } : {})} />)}
      </div>
    </section>
  )
}

/** Un bloc de section, selon sa sorte. */
export function BlockView({ block, t, now, locale, narrowed }: { block: HomeBlock; t: Translate; now: Date; locale: string; narrowed?: boolean }) {
  const layout = useContext(LayoutContext)
  switch (block.kind) {
    case 'flowchart':
      return <Flowchart block={block} />
    case 'section':
      return <FoldSection block={block} t={t} now={now} locale={locale} {...(narrowed ? { narrowed } : {})} />
    case 'actions':
      return (
        <div class="bp-actions">
          {block.actions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      )
    case 'cards': {
      const cards = !block.cards.length ? (
        <p class="bp-empty">{block.empty ?? t('ui.empty')}</p>
      ) : layout === 'table' ? (
        <CardsTable cards={block.cards} t={t} />
      ) : layout === 'list' ? (
        <ul class="bp-cardrows">
          {block.cards.map((card) => (
            <CardRow key={card.id} card={card} t={t} now={now} locale={locale} />
          ))}
        </ul>
      ) : block.cards.length ? (
        <div class="bp-cards">
          {block.cards.map((card) => (
            <CardView key={card.id} card={card} t={t} now={now} locale={locale} />
          ))}
        </div>
      ) : (
        <p class="bp-empty">{block.empty ?? t('ui.empty')}</p>
      )
      if (!block.title && !block.actions?.length) return cards
      return (
        <section class="bp-group">
          <div class="bp-group-head">
            {block.title && <h2 class="bp-group-title">{block.title}</h2>}
            {!!block.actions?.length && (
              <div class="bp-actions">
                {block.actions.map((action) => (
                  <ActionButton key={action.id} action={action} />
                ))}
              </div>
            )}
          </div>
          {cards}
        </section>
      )
    }
    case 'stats':
      return (
        <div class="bp-stats">
          {block.stats.map((stat) => (
            <StatView key={stat.label} stat={stat} />
          ))}
        </div>
      )
    case 'list': {
      const list = block.items.length ? (
        <ul class="bp-list">
          {block.items.map((item) => (
            <ListItemView key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p class="bp-empty">{block.empty ?? t('ui.empty')}</p>
      )
      return block.title || block.intro?.length ? (
        <div class="bp-block">
          {block.title && <h3 class="bp-block-title">{block.title}</h3>}
          {!!block.intro?.length && (
            <div class="bp-prose">
              {block.intro.map((paragraph, index) => (
                <p key={index} class="bp-text">
                  {paragraph}
                </p>
              ))}
            </div>
          )}
          {list}
        </div>
      ) : (
        list
      )
    }
    case 'text': {
      const body = block.paragraphs.length && block.preformatted ? (
        <pre class="bp-pre">{block.paragraphs.join('\n\n')}</pre>
      ) : block.paragraphs.length ? (
        <div class="bp-prose">
          {block.paragraphs.map((paragraph, index) => (
            <p key={index} class="bp-text">
              {paragraph}
            </p>
          ))}
        </div>
      ) : (
        <p class="bp-empty">{block.empty ?? t('ui.empty')}</p>
      )
      return block.title ? (
        <div class="bp-block">
          <h3 class="bp-block-title">{block.title}</h3>
          {body}
        </div>
      ) : (
        body
      )
    }
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
