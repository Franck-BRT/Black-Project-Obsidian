// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les ports du cœur, implémentés avec l'API d'Obsidian.
 *
 * C'est le seul endroit, avec le reste de `src/obsidian/`, où le code sait qu'il tourne
 * dans Obsidian. L'application de bureau fournira les mêmes interfaces à sa façon.
 */

import { normalizePath, Notice, requestUrl, type App, type Plugin } from 'obsidian'
import type { I18n } from '../core/i18n'
import type { FileSystem, FolderListing, Http, Notifier, Platform, SettingsStorage } from '../core/ports'
import { obsidianUi } from './ui'

function parentOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '' : path.slice(0, index)
}

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
    await this.ensureFolder(parentOf(target))
    await this.adapter.write(target, content)
  }

  async writeBinary(path: string, content: ArrayBuffer): Promise<void> {
    const target = normalizePath(path)
    await this.ensureFolder(parentOf(target))
    await this.adapter.writeBinary(target, content)
  }

  async ensureFolder(path: string): Promise<void> {
    if (path === '' || path === '/') return
    const segments = normalizePath(path).split('/')
    let current = ''
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment
      if (!(await this.adapter.exists(current))) await this.adapter.mkdir(current)
    }
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
