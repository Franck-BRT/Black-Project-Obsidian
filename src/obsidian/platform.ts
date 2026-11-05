// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les ports du cœur, implémentés avec l'API d'Obsidian.
 *
 * C'est le seul endroit, avec le reste de `src/obsidian/`, où le code sait qu'il tourne
 * dans Obsidian. L'application de bureau fournira les mêmes interfaces à sa façon.
 */

import { normalizePath, Notice, parseYaml, requestUrl, TFile, TFolder, type App, type Plugin } from 'obsidian'
import type { I18n } from '../core/i18n'
import type { FileDisplay, FileSystem, FolderListing, Http, Notifier, Platform, SettingsStorage } from '../core/ports'
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

/** Ce qu'Obsidian ouvre lui-même, plugins à part : notes, toiles, bases, PDF, images, sons, vidéos. */
const OPENED_BY_OBSIDIAN = new Set([
  'md',
  'canvas',
  'base',
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'svg',
  'webp',
  'avif',
  'mp3',
  'wav',
  'm4a',
  'ogg',
  '3gp',
  'flac',
  'webm',
  'mp4',
  'ogv',
  'mov',
  'mkv'
])

/** La vue de Black Projects qui ouvre, en lecture seule, les fichiers que l'utilisateur a choisi d'afficher. */
export const FILE_VIEW = 'black-projects-file'

/**
 * Ce que l'explorateur d'Obsidian montre. Une extension qu'Obsidian (ou un plugin) sait
 * ouvrir est visible ; les autres n'y paraissent que si « Détecter toutes les extensions
 * de fichier » est activé (Paramètres → Fichiers et liens), et s'ouvrent alors avec une
 * autre application — ou si l'utilisateur a choisi de les afficher dans Black Projects :
 * elles sont alors déclarées à Obsidian, ouvertes par la visionneuse de Black Projects.
 * Lu à chaque question : les réglages peuvent changer entre-temps.
 */
export function obsidianDisplay(plugin: Plugin): FileDisplay {
  // Pas dans l'API publique : lus prudemment, avec la liste ci-dessus en repli.
  const internals = plugin.app as unknown as {
    viewRegistry?: { isExtensionRegistered?(extension: string): boolean; unregisterExtensions?(extensions: string[]): void }
    vault: { getConfig?(key: string): unknown }
  }
  /** Les extensions que Black Projects a déclarées à Obsidian. */
  const ours = new Set<string>()
  const openedByPlugin = (ext: string) => !ours.has(ext) && (internals.viewRegistry?.isExtensionRegistered?.(ext) ?? false)
  const openedByOthers = (ext: string) => OPENED_BY_OBSIDIAN.has(ext) || openedByPlugin(ext)
  return {
    kind(extension) {
      const ext = extension.toLowerCase()
      if (OPENED_BY_OBSIDIAN.has(ext)) return 'native'
      if (ours.has(ext)) return 'viewer'
      if (openedByPlugin(ext)) return 'plugin'
      return internals.vault.getConfig?.('showUnsupportedFiles') === true ? 'listed' : 'hidden'
    },
    canShow(extension) {
      return !openedByOthers(extension.toLowerCase())
    },
    show(extensions) {
      const wanted = new Set(extensions.map((ext) => ext.toLowerCase()).filter((ext) => ext && !openedByOthers(ext)))
      for (const ext of [...ours]) {
        if (wanted.has(ext)) continue
        // Sans moyen de la retirer tout de suite, l'extension reste affichée jusqu'au prochain démarrage.
        if (!internals.viewRegistry?.unregisterExtensions) continue
        try {
          internals.viewRegistry.unregisterExtensions([ext])
          ours.delete(ext)
        } catch (error) {
          console.error(`[Black Projects] masquer .${ext}`, error)
        }
      }
      for (const ext of wanted) {
        if (ours.has(ext)) continue
        try {
          plugin.registerExtensions([ext], FILE_VIEW)
          ours.add(ext)
        } catch (error) {
          // Déjà prise par un autre plugin entre-temps : c'est lui qui l'ouvre.
          console.error(`[Black Projects] afficher .${ext}`, error)
        }
      }
    }
  }
}

/** Les réglages, dans le `data.json` du plugin. */
export function pluginSettingsStorage(plugin: Plugin): SettingsStorage {
  return {
    load: () => plugin.loadData() as Promise<unknown>,
    save: (data) => plugin.saveData(data)
  }
}

export function obsidianPlatform(plugin: Plugin, version: string, i18n: I18n): Platform {
  const app = plugin.app
  return {
    info: { name: 'obsidian', version },
    fs: new ObsidianFileSystem(app),
    http: obsidianHttp,
    notifier: obsidianNotifier,
    ui: obsidianUi(app, i18n),
    display: obsidianDisplay(plugin),
    yaml: { parse: (text) => parseYaml(text) as unknown }
  }
}
