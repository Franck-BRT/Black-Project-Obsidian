// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le port `Ui` du cœur, dessiné avec les fenêtres d'Obsidian. */

import { FuzzySuggestModal, Modal, Notice, setTooltip, type App, type TFile } from 'obsidian'
import type { I18n } from '../core/i18n'
import type { FilePickOptions, TextView, Ui } from '../core/ports'

/** Les fichiers du coffre, le fichier ouvert d'abord, puis les plus récents. */
class FilePickerModal extends FuzzySuggestModal<TFile> {
  private chosen = false

  constructor(
    app: App,
    private readonly files: TFile[],
    placeholder: string | undefined,
    private readonly done: (path: string | null) => void
  ) {
    super(app)
    if (placeholder) this.setPlaceholder(placeholder)
  }

  getItems(): TFile[] {
    return this.files
  }

  getItemText(file: TFile): string {
    return file.path
  }

  onChooseItem(file: TFile): void {
    this.chosen = true
    this.done(file.path)
  }

  override onClose(): void {
    // Obsidian ferme la fenêtre avant d'annoncer le choix : on attend un tour avant de
    // conclure que l'utilisateur a renoncé.
    window.setTimeout(() => {
      if (!this.chosen) this.done(null)
    }, 0)
  }
}

class TextModal extends Modal {
  constructor(
    app: App,
    private readonly view: TextView,
    private readonly i18n: I18n
  ) {
    super(app)
  }

  override onOpen(): void {
    const { contentEl, view, i18n } = this
    this.modalEl.addClass('bp-text-modal')
    this.setTitle(view.title)
    const bar = contentEl.createDiv({ cls: 'bp-text-modal-bar' })
    if (view.subtitle) bar.createSpan({ text: view.subtitle, cls: 'bp-text-modal-subtitle' })
    const copy = bar.createEl('button', { text: i18n.t('ui.copy') })
    setTooltip(copy, i18n.t('tip.copy'))
    copy.addEventListener('click', () => {
      void navigator.clipboard.writeText(view.text).then(() => new Notice(i18n.t('ui.copied')))
    })
    contentEl.createEl('pre', { text: view.text, cls: 'bp-text-modal-text' })
  }

  override onClose(): void {
    this.contentEl.empty()
  }
}

export function obsidianUi(app: App, i18n: I18n): Ui {
  return {
    pickFile(options: FilePickOptions) {
      const allowed = options.extensions ? new Set(options.extensions) : null
      const active = app.workspace.getActiveFile()?.path
      const files = app.vault
        .getFiles()
        .filter((file) => !allowed || allowed.has(file.extension.toLowerCase()))
        .sort((a, b) => Number(b.path === active) - Number(a.path === active) || b.stat.mtime - a.stat.mtime)
      return new Promise((resolve) => {
        let settled = false
        const done = (path: string | null) => {
          if (settled) return
          settled = true
          resolve(path)
        }
        new FilePickerModal(app, files, options.placeholder, done).open()
      })
    },
    showText(view) {
      new TextModal(app, view, i18n).open()
    },
    async openNote(path) {
      await app.workspace.openLinkText(path, '', false)
    }
  }
}
