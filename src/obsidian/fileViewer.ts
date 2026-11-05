// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La visionneuse de Black Projects : ce qui s'ouvre quand on clique, dans l'explorateur,
 * sur un fichier qu'Obsidian n'ouvre pas lui-même mais que l'utilisateur a choisi
 * d'afficher (fenêtre Formats de fichiers, interrupteur de la fiche) — un export de
 * types en `.json`, un tableau `.csv`, un document Word…
 *
 * En lecture seule : le texte tel que le module Lecture de fichiers le lit, et de quoi
 * ouvrir le fichier avec l'application de l'ordinateur. Rien n'y est jamais réécrit.
 */

import { FileView, Setting, type TFile, type WorkspaceLeaf } from 'obsidian'
import { readVaultFile } from '../modules/lecture-fichiers'
import type BlackProjectsPlugin from './main'
import { FILE_VIEW } from './platform'

/** Au-delà, le texte est coupé : la visionneuse sert à voir, pas à tout relire. */
const MAX_CHARACTERS = 200_000

export class BlackFileView extends FileView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: BlackProjectsPlugin
  ) {
    super(leaf)
  }

  override getViewType(): string {
    return FILE_VIEW
  }

  override getIcon(): string {
    return 'file-search'
  }

  override getDisplayText(): string {
    return this.file?.name ?? this.plugin.i18n.t('viewer.title')
  }

  override canAcceptExtension(extension: string): boolean {
    return this.plugin.platform.display?.kind(extension) === 'viewer'
  }

  override async onLoadFile(file: TFile): Promise<void> {
    await this.renderFile(file)
  }

  override async onUnloadFile(): Promise<void> {
    this.contentEl.empty()
  }

  private async renderFile(file: TFile): Promise<void> {
    const t = (key: string, vars?: Record<string, string | number>) => this.plugin.i18n.t(key, vars)
    const el = this.contentEl
    el.empty()
    el.addClass('bp-file-view')
    el.createEl('h2', { text: file.name })
    const size = file.stat.size < 1024 ? `${file.stat.size} o` : `${Math.round(file.stat.size / 1024)} Ko`
    el.createDiv({ text: t('viewer.meta', { extension: file.extension, size }), cls: 'bp-file-view-meta' })

    // Ouvrir ailleurs : pas dans l'API publique d'Obsidian, proposé quand c'est possible.
    const app = this.app as unknown as { openWithDefaultApp?(path: string): void; showInFolder?(path: string): void }
    const actions = new Setting(el)
    if (app.openWithDefaultApp) {
      actions.addButton((button) =>
        button.setButtonText(t('viewer.open')).setTooltip(t('viewer.open.tip')).onClick(() => app.openWithDefaultApp?.(file.path))
      )
    }
    if (app.showInFolder) {
      actions.addButton((button) =>
        button.setButtonText(t('viewer.folder')).setTooltip(t('viewer.folder.tip')).onClick(() => app.showInFolder?.(file.path))
      )
    }

    const outcome = await readVaultFile(this.plugin.platform.fs, file.path)
    if (this.file !== file) return
    if (!outcome.ok) {
      el.createDiv({ text: t(`viewer.problem.${outcome.problem}`, { extension: file.extension }), cls: 'bp-file-view-problem' })
      return
    }
    const cut = outcome.text.length > MAX_CHARACTERS
    if (cut) el.createDiv({ text: t('viewer.cut', { count: MAX_CHARACTERS }), cls: 'bp-file-view-meta' })
    el.createEl('pre', { text: cut ? outcome.text.slice(0, MAX_CHARACTERS) : outcome.text, cls: 'bp-file-view-text' })
  }
}
