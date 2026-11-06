// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'interface de Black Projects, en web pur (Preact) : la même dans Obsidian et dans
 * l'application de bureau. Un hôte la monte dans un élément et lui donne un `AppHost` ;
 * elle ne connaît rien d'autre.
 */

import { render } from 'preact'
import type { AppHost } from './host'
import { App, type Page } from './shell'
import { installStyles } from './styles'

export type { AppHost, Translate } from './host'
export { UI_CSS } from './styles'

export type { Page } from './shell'

export interface MountedApp {
  /** Recharge les sections et les pastilles (des fichiers ont changé, une commande s'est exécutée). */
  refresh(): void
  /** Montre une page : l'accueil ou le tableau de bord. */
  show(page: Page): void
  destroy(): void
}

export function mountApp(element: HTMLElement, host: AppHost, initial: Page = 'home'): MountedApp {
  installStyles(element)
  let generation = 0
  let page = initial
  const draw = () => render(<App host={host} generation={generation} page={page} onPage={(next) => (page = next)} />, element)
  draw()
  return {
    refresh() {
      generation++
      draw()
    },
    show(next) {
      page = next
      draw()
    },
    destroy() {
      render(null, element)
    }
  }
}

export { dialogWindows } from './dialogs/windows'
export { openModuleWindow, type ModuleWindowHost } from './dialogs/moduleWindow'
export type { DialogHost } from './dialogs/frame'
