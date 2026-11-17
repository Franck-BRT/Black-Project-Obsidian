// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **L'arborescence** d'une page, comme dans un explorateur de fichiers : une colonne à gauche
 * (les bibliothèques et leurs répertoires), chaque nœud avec son icône, son nom, combien il
 * contient ; un chevron le déplie ou le replie ; un clic ouvre sa page ; le lieu montré est
 * marqué. Ce que l'utilisateur déplie ou replie est retenu d'une ouverture à l'autre.
 */

import { useEffect, useState } from 'preact/hooks'
import type { Explorer, ExplorerNode } from '../core/views'
import { useFileDrop } from './drop'
import { Icon } from './icons'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Où est gardé ce que l'utilisateur a déplié ou replié. */
const EXPANDED_KEY = 'black-projects.explorateur-deplie'

const remembered = new Map<string, boolean>(
  (() => {
    try {
      const saved: unknown = JSON.parse(globalThis.localStorage?.getItem(EXPANDED_KEY) ?? '{}')
      return saved && typeof saved === 'object' ? Object.entries(saved as Record<string, unknown>).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean') : []
    } catch {
      return []
    }
  })()
)

function remember(id: string, expanded: boolean): void {
  remembered.set(id, expanded)
  try {
    globalThis.localStorage?.setItem(EXPANDED_KEY, JSON.stringify(Object.fromEntries(remembered)))
  } catch {
    // Sans stockage : retenu le temps de la session.
  }
}

/** Le lieu montré est-il ce nœud, ou sous lui ? */
const holdsCurrent = (node: ExplorerNode): boolean => !!node.current || (node.children ?? []).some(holdsCurrent)

function Node({ node, depth, t }: { node: ExplorerNode; depth: number; t: Translate }) {
  const children = node.children ?? []
  // Le lieu montré, ou le chemin qui y mène : déplié (comme un dossier qu'on ouvre) ; sinon comme
  // l'utilisateur l'a laissé, ou comme la page le dit.
  const opens = children.length > 0 && (!!node.current || children.some(holdsCurrent))
  const [expanded, setExpanded] = useState(() => opens || (remembered.get(node.id) ?? node.expanded === true))
  // Une autre page (un autre lieu) : le chemin qui y mène se déplie.
  useEffect(() => {
    if (opens) setExpanded(true)
  }, [opens])
  const drop = useFileDrop(node.drop)
  const toggle = () => {
    remember(node.id, !expanded)
    setExpanded(!expanded)
  }
  const label = node.count ? `${node.label} (${node.count})` : node.label
  return (
    <li role="treeitem" aria-expanded={children.length ? expanded : undefined} aria-selected={node.current === true} aria-label={label}>
      <div class={`bp-explorer-row${node.current ? ' is-current' : ''}${drop.over ? ' is-drop-over' : ''}`} style={{ paddingLeft: `${4 + depth * 14}px` }} {...drop.props}>
        {children.length ? (
          <button type="button" class="bp-explorer-twist" aria-label={t(expanded ? 'ui.explorer.collapse' : 'ui.explorer.expand', { name: node.label })} title={t(expanded ? 'ui.explorer.collapse' : 'ui.explorer.expand', { name: node.label })} onClick={toggle}>
            <Icon name="chevron" />
          </button>
        ) : (
          <span class="bp-explorer-twist is-leaf" aria-hidden="true" />
        )}
        {node.open ? (
          <button type="button" class="bp-explorer-open" aria-current={node.current ? 'page' : undefined} title={node.open.tooltip ?? node.label} onClick={() => void node.open!.run()}>
            {node.icon && <Icon name={node.icon} />}
            <span class="bp-explorer-label">{node.label}</span>
            {node.count && <span class="bp-explorer-count">{node.count}</span>}
          </button>
        ) : (
          <span class="bp-explorer-open is-heading">
            {node.icon && <Icon name={node.icon} />}
            <span class="bp-explorer-label">{node.label}</span>
            {node.count && <span class="bp-explorer-count">{node.count}</span>}
          </span>
        )}
      </div>
      {children.length > 0 && expanded && (
        <ul role="group" class="bp-explorer-list">
          {children.map((child) => (
            <Node key={child.id} node={child} depth={depth + 1} t={t} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** La colonne de l'arborescence. */
export function ExplorerTree({ explorer, t }: { explorer: Explorer; t: Translate }) {
  return (
    <nav class="bp-explorer" aria-label={explorer.label}>
      <ul role="tree" class="bp-explorer-list" aria-label={explorer.label}>
        {explorer.nodes.map((node) => (
          <Node key={node.id} node={node} depth={0} t={t} />
        ))}
      </ul>
    </nav>
  )
}
