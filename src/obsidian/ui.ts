// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le port `Ui` du cœur, dessiné avec les fenêtres d'Obsidian. */

import { FuzzySuggestModal, Modal, Notice, Setting, SuggestModal, TFile, setTooltip, type App } from 'obsidian'
import type { I18n } from '../core/i18n'
import type { Choice, ConfirmView, ExternalFile, FilePickOptions, FormView, PickManyView, TextView, Ui } from '../core/ports'

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

/** Un choix dans une liste, avec une précision sous chaque libellé. */
class ChoiceModal extends SuggestModal<Choice> {
  private chosen = false

  constructor(
    app: App,
    private readonly choices: readonly Choice[],
    placeholder: string | undefined,
    private readonly done: (value: string | null) => void
  ) {
    super(app)
    if (placeholder) this.setPlaceholder(placeholder)
  }

  getSuggestions(query: string): Choice[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return this.choices.filter((choice) => {
      const text = `${choice.label} ${choice.description ?? ''}`.toLowerCase()
      return words.every((word) => text.includes(word))
    })
  }

  renderSuggestion(choice: Choice, el: HTMLElement): void {
    el.createDiv({ text: choice.label })
    if (choice.description) el.createEl('small', { text: choice.description, cls: 'bp-choice-description' })
  }

  onChooseSuggestion(choice: Choice): void {
    this.chosen = true
    this.done(choice.value)
  }

  override onClose(): void {
    window.setTimeout(() => {
      if (!this.chosen) this.done(null)
    }, 0)
  }
}

/** Un formulaire : un réglage par champ, puis le bouton qui valide. */
class FormModal extends Modal {
  private readonly values: Record<string, string> = {}
  private submitted = false

  constructor(
    app: App,
    private readonly form: FormView,
    private readonly done: (values: Record<string, string> | null) => void
  ) {
    super(app)
    for (const field of form.fields) {
      this.values[field.key] =
        field.kind === 'toggle'
          ? String(field.value ?? false)
          : (field.value ?? (field.kind === 'choice' ? (field.options[0]?.value ?? '') : ''))
    }
  }

  override onOpen(): void {
    const { contentEl, form } = this
    this.modalEl.addClass('bp-form-modal')
    this.setTitle(form.title)
    if (form.intro) contentEl.createEl('p', { text: form.intro, cls: 'bp-form-intro' })
    let first: HTMLInputElement | null = null
    for (const field of form.fields) {
      const setting = new Setting(contentEl).setName(field.label)
      if (field.description) setting.setDesc(field.description)
      if (field.kind === 'text') {
        setting.addText((text) => {
          text.setValue(this.values[field.key] ?? '').onChange((value) => (this.values[field.key] = value))
          if (field.placeholder) text.setPlaceholder(field.placeholder)
          if (field.tooltip) setTooltip(text.inputEl, field.tooltip)
          text.inputEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              this.submit()
            }
          })
          first ??= text.inputEl
        })
      } else if (field.kind === 'toggle') {
        setting.addToggle((toggle) => {
          toggle.setValue(this.values[field.key] === 'true').onChange((value) => (this.values[field.key] = String(value)))
          if (field.tooltip) toggle.setTooltip(field.tooltip)
        })
      } else {
        setting.addDropdown((dropdown) => {
          for (const option of field.options) dropdown.addOption(option.value, option.label)
          dropdown.setValue(this.values[field.key] ?? '').onChange((value) => (this.values[field.key] = value))
          if (field.tooltip) setTooltip(dropdown.selectEl, field.tooltip)
        })
      }
    }
    new Setting(contentEl).addButton((button) => {
      button.setButtonText(form.submit).setCta().onClick(() => this.submit())
      if (form.submitTooltip) button.setTooltip(form.submitTooltip)
    })
    window.setTimeout(() => first?.focus(), 0)
  }

  private submit(): void {
    for (const field of this.form.fields) {
      if (field.kind === 'text' && field.required && !(this.values[field.key] ?? '').trim()) {
        new Notice(`${field.label} ?`)
        return
      }
    }
    const error = this.form.validate?.(this.values)
    if (error) {
      new Notice(error, 6000)
      return
    }
    this.submitted = true
    this.done({ ...this.values })
    this.close()
  }

  override onClose(): void {
    this.contentEl.empty()
    if (!this.submitted) this.done(null)
  }
}

/** Une question oui / non, le bouton qui détruit marqué comme tel. */
class ConfirmModal extends Modal {
  private answered = false

  constructor(
    app: App,
    private readonly view: ConfirmView,
    private readonly done: (yes: boolean) => void
  ) {
    super(app)
  }

  override onOpen(): void {
    const { contentEl, view } = this
    this.setTitle(view.title)
    contentEl.createEl('p', { text: view.message, cls: 'bp-confirm-message' })
    new Setting(contentEl)
      .addButton((button) => button.setButtonText(view.cancel).onClick(() => this.answer(false)))
      .addButton((button) => {
        button.setButtonText(view.confirm).onClick(() => this.answer(true))
        if (view.danger) button.setWarning()
        else button.setCta()
      })
  }

  private answer(yes: boolean): void {
    this.answered = true
    this.done(yes)
    this.close()
  }

  override onClose(): void {
    this.contentEl.empty()
    if (!this.answered) this.done(false)
  }
}

/** Plusieurs choix à cocher, avec « Tout » et « Rien ». */
class PickManyModal extends Modal {
  private readonly chosen: Set<string>
  private answered = false

  constructor(
    app: App,
    private readonly view: PickManyView,
    private readonly i18n: I18n,
    private readonly done: (values: string[] | null) => void
  ) {
    super(app)
    this.chosen = new Set(view.selected ?? view.choices.map((choice) => choice.value))
  }

  override onOpen(): void {
    this.modalEl.addClass('bp-form-modal')
    this.render()
  }

  private render(): void {
    const { contentEl, view, i18n } = this
    contentEl.empty()
    this.setTitle(view.title)
    if (view.intro) contentEl.createEl('p', { text: view.intro, cls: 'bp-form-intro' })
    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText(i18n.t('ui.all')).onClick(() => {
          for (const choice of view.choices) this.chosen.add(choice.value)
          this.render()
        })
      )
      .addButton((button) =>
        button.setButtonText(i18n.t('ui.none')).onClick(() => {
          this.chosen.clear()
          this.render()
        })
      )
    const list = contentEl.createDiv({ cls: 'bp-pick-many' })
    for (const choice of view.choices) {
      const row = new Setting(list).setName(choice.label)
      if (choice.description) row.setDesc(choice.description)
      row.addToggle((toggle) =>
        toggle.setValue(this.chosen.has(choice.value)).onChange((on) => {
          if (on) this.chosen.add(choice.value)
          else this.chosen.delete(choice.value)
        })
      )
    }
    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText(view.submit)
        .setCta()
        .onClick(() => {
          this.answered = true
          this.done(view.choices.map((choice) => choice.value).filter((value) => this.chosen.has(value)))
          this.close()
        })
    )
  }

  override onClose(): void {
    this.contentEl.empty()
    if (!this.answered) this.done(null)
  }
}

/** Des fichiers pris sur l'ordinateur, par la fenêtre de sélection du système. */
function pickExternal(options: { accept?: readonly string[]; multiple?: boolean }): Promise<ExternalFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = options.multiple ?? true
    if (options.accept && options.accept.length > 0) input.accept = options.accept.map((ext) => `.${ext}`).join(',')
    let settled = false
    const finish = (files: ExternalFile[]) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }
    input.addEventListener('cancel', () => finish([]))
    input.addEventListener('change', () => {
      const chosen = [...(input.files ?? [])]
      void Promise.all(chosen.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }))).then(
        finish,
        () => finish([])
      )
    })
    input.style.display = 'none'
    document.body.appendChild(input)
    input.click()
  })
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
      // Jamais par le texte d'un lien : un lien vers une note encore inconnue de l'index
      // en créerait une vide. On attend que la note soit indexée, puis on l'ouvre.
      for (let attempt = 0; attempt < 20; attempt++) {
        const file = app.vault.getAbstractFileByPath(path)
        if (file instanceof TFile) {
          await app.workspace.getLeaf(false).openFile(file)
          return
        }
        await new Promise((resolve) => window.setTimeout(resolve, 100))
      }
    },
    activeNote() {
      return app.workspace.getActiveFile()?.path ?? null
    },
    pickOption(choices, placeholder) {
      return new Promise((resolve) => {
        let settled = false
        new ChoiceModal(app, choices, placeholder, (value) => {
          if (settled) return
          settled = true
          resolve(value)
        }).open()
      })
    },
    pickExternalFiles: pickExternal,
    pickMany(view) {
      return new Promise((resolve) => {
        let settled = false
        new PickManyModal(app, view, i18n, (values) => {
          if (settled) return
          settled = true
          resolve(values)
        }).open()
      })
    },
    confirm(view) {
      return new Promise((resolve) => {
        let settled = false
        new ConfirmModal(app, view, (yes) => {
          if (settled) return
          settled = true
          resolve(yes)
        }).open()
      })
    },
    askForm(form) {
      return new Promise((resolve) => {
        let settled = false
        new FormModal(app, form, (values) => {
          if (settled) return
          settled = true
          resolve(values)
        }).open()
      })
    }
  }
}
