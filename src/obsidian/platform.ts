// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les ports du cœur, implémentés avec l'API d'Obsidian.
 *
 * C'est le seul endroit, avec le reste de `src/obsidian/`, où le code sait qu'il tourne
 * dans Obsidian. L'application de bureau fournira les mêmes interfaces à sa façon.
 */

import { normalizePath, Notice, requestUrl, TFile, TFolder, type App, type Plugin } from 'obsidian'
import type { I18n } from '../core/i18n'
import type { FileSystem, FolderListing, Http, Notifier, Platform, SettingsStorage } from '../core/ports'
import { obsidianUi } from './ui'

function parentOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '' : path.slice(0, index)
}

/**
 * Les fichiers du coffre. Les lectures passent par l'adaptateur ; les écritures par l'API
 * du coffre (`vault.create`, `vault.modify`…), qui tient l'index d'Obsidian à jour sur-le-
 * champ : une note écrite puis ouverte aussitôt est bien celle qu'on vient d'écrire.
 */
export class ObsidianFileSystem implements FileSystem {
  constructor(private readonly app: App) {}

  private get adapter() {
    return this.app.vault.adapter
  }

  exists(path: string): Promise<boolean> {
    return this.adapter.exists(normalizePath(path))
  }

  readText(path: string): Promise<string> {
    return this.adapter.read(normalizePath(path))
  }

  readBinary(path: string): Promise<ArrayBuffer> {
    return this.adapter.readBinary(normalizePath(path))
  }

  async writeText(path: string, content: string): Promise<void> {
    const target = normalizePath(path)
    const existing = this.app.vault.getAbstractFileByPath(target)
    if (existing instanceof TFile) return this.app.vault.modify(existing, content)
    await this.ensureFolder(parentOf(target))
    if (await this.adapter.exists(target)) return this.adapter.write(target, content)
    await this.app.vault.create(target, content)
  }

  async writeBinary(path: string, content: ArrayBuffer): Promise<void> {
    const target = normalizePath(path)
    const existing = this.app.vault.getAbstractFileByPath(target)
    if (existing instanceof TFile) return this.app.vault.modifyBinary(existing, content)
    await this.ensureFolder(parentOf(target))
    if (await this.adapter.exists(target)) return this.adapter.writeBinary(target, content)
    await this.app.vault.createBinary(target, content)
  }

  async ensureFolder(path: string): Promise<void> {
    if (path === '' || path === '/') return
    const segments = normalizePath(path).split('/')
    let current = ''
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment
      if (this.app.vault.getAbstractFileByPath(current) instanceof TFolder) continue
      if (await this.adapter.exists(current)) continue
      try {
        await this.app.vault.createFolder(current)
      } catch (error) {
        // Créé entre-temps : c'est ce qu'on voulait.
        if (!(await this.adapter.exists(current))) throw error
      }
    }
  }

  /** Par le gestionnaire de fichiers d'Obsidian : les liens vers le fichier suivent. */
  async rename(from: string, to: string): Promise<void> {
    const source = normalizePath(from)
    const target = normalizePath(to)
    await this.ensureFolder(parentOf(target))
    const file = this.app.vault.getAbstractFileByPath(source)
    if (file instanceof TFile) await this.app.fileManager.renameFile(file, target)
    else await this.adapter.rename(source, target)
  }

  async list(folder: string): Promise<FolderListing> {
    const listed = await this.adapter.list(normalizePath(folder))
    return { files: listed.files, folders: listed.folders }
  }
}

export const obsidianHttp: Http = {
  async request(request) {
    const response = await requestUrl({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
      throw: false
    })
    return { status: response.status, text: response.text }
  }
}

export const obsidianNotifier: Notifier = {
  notify(message, durationMs) {
    new Notice(message, durationMs)
  }
}

/** Les réglages, dans le `data.json` du plugin. */
export function pluginSettingsStorage(plugin: Plugin): SettingsStorage {
  return {
    load: () => plugin.loadData() as Promise<unknown>,
    save: (data) => plugin.saveData(data)
  }
}

export function obsidianPlatform(app: App, version: string, i18n: I18n): Platform {
  return {
    info: { name: 'obsidian', version },
    fs: new ObsidianFileSystem(app),
    http: obsidianHttp,
    notifier: obsidianNotifier,
    ui: obsidianUi(app, i18n)
  }
}
