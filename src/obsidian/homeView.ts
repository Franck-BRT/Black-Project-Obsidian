// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'onglet d'accueil de Black Projects dans Obsidian : un simple hôte pour l'interface
 * (`src/ui`), qui y est montée telle quelle — la même que dans l'application de bureau.
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian'
import { mountApp, type AppHost, type MountedApp, type Page } from '../ui'

export const HOME_VIEW = 'black-projects-home'

export class BlackHomeView extends ItemView {
  private app_?: MountedApp

  constructor(
    leaf: WorkspaceLeaf,
    private readonly host: AppHost
  ) {
    super(leaf)
  }

  override getViewType(): string {
    return HOME_VIEW
  }

  override getDisplayText(): string {
    return this.host.t('home.tab')
  }

  override getIcon(): string {
    return 'layout-dashboard'
  }

  override async onOpen(): Promise<void> {
    this.contentEl.empty()
    this.contentEl.addClass('bp-home-host')
    this.app_ = mountApp(this.contentEl, this.host)
  }

  override async onClose(): Promise<void> {
    this.app_?.destroy()
  }

  /** Montre l'accueil ou le tableau de bord. */
  show(page: Page): void {
    this.app_?.show(page)
  }

  /** Recharge les sections : des fichiers ont changé, une commande s'est exécutée. */
  refresh(): void {
    this.app_?.refresh()
  }
}
