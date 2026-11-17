// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Le menu « … »** : les actions secondaires d'une page (`ViewAction.more`), rangées derrière
 * un bouton pour ne laisser visibles que les principales. Il s'ouvre sous le bouton ; au
 * clavier, les flèches passent d'une action à l'autre, Échap le ferme (le focus revient au
 * bouton) ; un clic ailleurs le ferme aussi.
 */

import { useContext, useEffect, useRef, useState } from 'preact/hooks'
import type { ViewAction } from '../core/views'
import { AfterAction } from './components'
import { Icon } from './icons'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export function MoreMenu({ actions, t }: { actions: readonly ViewAction[]; t: Translate }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const after = useContext(AfterAction)
  const items = () => [...(root.current?.querySelectorAll<HTMLButtonElement>('.bp-more-item:not(:disabled)') ?? [])]
  // Ouvert : le focus sur la première action ; un clic ailleurs le ferme.
  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const outside = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    root.current?.ownerDocument.addEventListener('mousedown', outside)
    return () => root.current?.ownerDocument.removeEventListener('mousedown', outside)
  }, [open])
  const close = () => {
    setOpen(false)
    button.current?.focus()
  }
  const run = async (action: ViewAction) => {
    setOpen(false)
    try {
      await action.run()
    } finally {
      after()
    }
  }
  const onKey = (event: KeyboardEvent) => {
    const list = items()
    const at = list.indexOf(event.target as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown' && list.length) {
      event.preventDefault()
      list[(at + 1) % list.length]?.focus()
    } else if (event.key === 'ArrowUp' && list.length) {
      event.preventDefault()
      list[(at - 1 + list.length) % list.length]?.focus()
    } else if (event.key === 'Tab') setOpen(false)
  }
  if (!actions.length) return null
  return (
    <div class="bp-more" ref={root} onKeyDown={onKey}>
      <button ref={button} type="button" class="bp-button bp-more-button" aria-haspopup="menu" aria-expanded={open} aria-label={t('ui.more')} title={t('ui.more')} onClick={() => setOpen(!open)}>
        <Icon name="more" />
      </button>
      {open && (
        <div class="bp-more-menu" role="menu" aria-label={t('ui.more')}>
          {actions.map((action) => (
            <button key={action.id} type="button" role="menuitem" class="bp-more-item" disabled={action.disabled === true} title={action.tooltip} onClick={() => void run(action)}>
              {action.icon && <Icon name={action.icon} />}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
