// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'interface de Black Projects, en web pur (Preact) : la même dans Obsidian et dans
 * l'application de bureau. Un hôte la monte dans un élément et lui donne un `AppHost` ;
 * elle ne connaît rien d'autre.
 */

import { render } from 'preact'
import type { AppHost } from './host'
import { App } from './shell'
import { installStyles } from './styles'

export type { AppHost, Translate } from './host'
export { UI_CSS } from './styles'

export interface MountedApp {
  /** Recharge les sections (des fichiers ont changé, une commande s'est exécutée). */
  refresh(): void
  destroy(): void
}

export function mountApp(element: HTMLElement, host: AppHost): MountedApp {
  installStyles(element)
  let generation = 0
  const draw = () => render(<App host={host} generation={generation} />, element)
  draw()
  return {
    refresh() {
      generation++
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
