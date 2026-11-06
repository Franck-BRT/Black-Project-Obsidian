// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le port `Ui` du cœur dans Obsidian. Les fenêtres sont celles de l'interface (`src/ui`),
 * les mêmes que dans l'application de bureau ; Obsidian ne fournit que ce qui lui est
 * propre : la liste des fichiers du coffre, la note ouverte, l'ouverture d'une note, et le
 * thème clair ou sombre de l'hôte.
 */

import { Notice, TFile, type App } from 'obsidian'
import type { Appearance } from '../core/appearance'
import type { I18n } from '../core/i18n'
import type { ExternalFile, FilePickOptions, Ui } from '../core/ports'
import { dialogWindows, type DialogHost } from '../ui'
import { HOME_VIEW } from './homeView'

/** Ce que les fenêtres reçoivent d'Obsidian. */
export function obsidianDialogHost(app: App, i18n: I18n, appearance: () => Appearance): DialogHost {
  return {
    t: (key, vars) => i18n.t(key, vars),
    appearance,
    hostIsDark: () => document.body.classList.contains('theme-dark'),
    notify: (message) => new Notice(message),
    document
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
      void Promise.all(chosen.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }))).then(finish, () => finish([]))
    })
    input.style.display = 'none'
    document.body.appendChild(input)
    input.click()
  })
}

export function obsidianUi(app: App, i18n: I18n, appearance: () => Appearance): Ui {
  const windows = dialogWindows(obsidianDialogHost(app, i18n, appearance))
  return {
    pickFile(options: FilePickOptions) {
      // Le fichier ouvert d'abord, puis les plus récents.
      const allowed = options.extensions ? new Set(options.extensions) : null
      const active = app.workspace.getActiveFile()?.path
      const files = app.vault
        .getFiles()
        .filter((file) => !allowed || allowed.has(file.extension.toLowerCase()))
        .sort((a, b) => Number(b.path === active) - Number(a.path === active) || b.stat.mtime - a.stat.mtime)
      return windows.pickPath(
        files.map((file) => file.path),
        options.placeholder
      )
    },
    showText: windows.showText,
    async openNote(path) {
      // Jamais par le texte d'un lien : un lien vers une note encore inconnue de l'index
      // en créerait une vide. On attend que la note soit indexée, puis on l'ouvre.
      for (let attempt = 0; attempt < 20; attempt++) {
        const file = app.vault.getAbstractFileByPath(path)
        if (file instanceof TFile) {
          // Depuis l'accueil : dans un nouvel onglet, l'accueil reste ouvert.
          const fromHome = app.workspace.getMostRecentLeaf()?.view.getViewType() === HOME_VIEW
          await app.workspace.getLeaf(fromHome ? 'tab' : false).openFile(file)
          return
        }
        await new Promise((resolve) => window.setTimeout(resolve, 100))
      }
    },
    activeNote() {
      return app.workspace.getActiveFile()?.path ?? null
    },
    pickOption: windows.pickOption,
    pickExternalFiles: pickExternal,
    pickMany: windows.pickMany,
    confirm: windows.confirm,
    inform(view) {
      // Au démarrage, attendre que l'espace de travail soit prêt.
      return new Promise((resolve) => app.workspace.onLayoutReady(() => void windows.inform(view).then(resolve)))
    },
    pickFromList: windows.pickFromList,
    askForm: windows.askForm
  }
}
