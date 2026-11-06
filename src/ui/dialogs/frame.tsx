// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le cadre de toutes les fenêtres : un fond, un panneau titré, un bouton pour fermer.
 * Accessible : `role="dialog"`, `aria-modal`, le titre qui nomme la fenêtre ; Échap et un
 * clic sur le fond la ferment ; le focus reste dans la fenêtre (Tab, Maj+Tab) et revient
 * où il était à la fermeture. Le thème choisi (mode, couleurs, lecture, taille) s'applique
 * comme à l'accueil.
 *
 * `openDialog` monte une fenêtre dans le document de l'hôte et rend une promesse, tenue
 * à sa fermeture : chaque fenêtre du port `Ui` est une fonction qui attend une réponse.
 */

import type { ComponentChildren, VNode } from 'preact'
import { render } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { resolvedMode, type Appearance } from '../../core/appearance'
import type { Translate } from '../host'
import { Icon } from '../icons'
import { installStyles } from '../styles'

/** Ce que l'hôte donne aux fenêtres. */
export interface DialogHost {
  t: Translate
  appearance(): Appearance
  hostIsDark(): boolean
  /** Un message bref (« Copié ») ; l'hôte le montre à sa façon. */
  notify(message: string): void
  /** Le document où monter les fenêtres (celui d'Obsidian, de la fenêtre Tauri). */
  document: Document
}

export type DialogSize = 'small' | 'medium' | 'large' | 'wide'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

export function Dialog({
  title,
  subtitle,
  size = 'medium',
  onClose,
  t,
  children,
  footer,
  className
}: {
  title: string
  subtitle?: string
  size?: DialogSize
  onClose: () => void
  t: Translate
  children: ComponentChildren
  footer?: ComponentChildren
  className?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = panel.current
    if (!element) return
    const previous = element.ownerDocument.activeElement as HTMLElement | null
    // Le premier champ marqué, sinon le premier élément atteignable (hors bouton « Fermer »).
    const first = element.querySelector<HTMLElement>('[data-autofocus]') ?? [...element.querySelectorAll<HTMLElement>(FOCUSABLE)].find((each) => !each.classList.contains('bp-dialog-close'))
    ;(first ?? element).focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((each) => each.offsetParent !== null || each === element.ownerDocument.activeElement)
      if (!items.length) return
      const firstItem = items[0]!
      const lastItem = items[items.length - 1]!
      const active = element.ownerDocument.activeElement
      if (event.shiftKey && active === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    element.addEventListener('keydown', onKey)
    return () => {
      element.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [])
  const titleId = `bp-dialog-title-${title.length}-${size}`
  return (
    <div
      class="bp-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div class={`bp-dialog bp-dialog-${size}${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel} tabIndex={-1}>
        <header class="bp-dialog-head">
          <div>
            <h2 class="bp-dialog-title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p class="bp-dialog-sub">{subtitle}</p>}
          </div>
          <button type="button" class="bp-button bp-button-icon bp-dialog-close" onClick={onClose} aria-label={t('ui.close')} title={t('ui.close')}>
            <Icon name="cross" />
          </button>
        </header>
        <div class="bp-dialog-body">{children}</div>
        {footer && <footer class="bp-dialog-foot">{footer}</footer>}
      </div>
    </div>
  )
}

/** La racine thémée d'une fenêtre : les mêmes attributs que l'accueil. */
function Themed({ host, children }: { host: DialogHost; children: ComponentChildren }) {
  const appearance = host.appearance()
  return (
    <div
      class="bp-ui bp-layer"
      data-mode={resolvedMode(appearance, host.hostIsDark())}
      data-vision={appearance.vision}
      data-reading={appearance.reading}
      data-size={appearance.size}
      data-motion={appearance.motion}
    >
      {children}
    </div>
  )
}

/**
 * Ouvre une fenêtre et attend sa réponse. `body` reçoit `close(valeur)` et `redraw()` ;
 * la fenêtre passe `close(fallback)` au cadre : fermer sans répondre (Échap, fond, bouton
 * « Fermer ») rend `fallback`.
 */
export function openDialog<T>(host: DialogHost, body: (close: (value: T) => void, redraw: () => void) => VNode, _fallback: T): Promise<T> {
  const doc = host.document
  installStyles(doc.body)
  const mount = doc.createElement('div')
  mount.className = 'bp-dialog-mount'
  doc.body.appendChild(mount)
  return new Promise<T>((resolve) => {
    let settled = false
    const close = (value: T) => {
      if (settled) return
      settled = true
      render(null, mount)
      mount.remove()
      resolve(value)
    }
    const draw = () => render(<Themed host={host}>{body(close, draw)}</Themed>, mount)
    draw()
  })
}
