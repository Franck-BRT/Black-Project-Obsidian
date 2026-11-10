// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les ports du cœur, implémentés avec l'API d'Obsidian.
 *
 * C'est le seul endroit, avec le reste de `src/obsidian/`, où le code sait qu'il tourne
 * dans Obsidian. L'application de bureau fournira les mêmes interfaces à sa façon.
 */

import { loadPdfJs, normalizePath, Notice, parseYaml, requestUrl, TFile, TFolder, type App, type Plugin } from 'obsidian'
import type { I18n } from '../core/i18n'
import type { Appearance } from '../core/appearance'
import type { FileDisplay, FileSystem, FolderListing, Http, Notifier, PageImages, Platform, SecretStore, SettingsStorage } from '../core/ports'
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
    // Un fichier, un dossier (tout ce qu'il contient) : par Obsidian, les liens suivent.
    if (file instanceof TFile || file instanceof TFolder) await this.app.fileManager.renameFile(file, target)
    else await this.adapter.rename(source, target)
  }

  /** Par le gestionnaire de fichiers d'Obsidian : à la corbeille que l'utilisateur a choisie (système, `.trash`, ou effacé). */
  async trash(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path))
    if (file instanceof TFile) await this.app.fileManager.trashFile(file)
  }

  /** L'index du coffre d'Obsidian (sans ses dossiers cachés). */
  async allFiles(): Promise<string[]> {
    return this.app.vault.getFiles().map((file) => file.path)
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

/** Ce qu'on utilise de pdf.js, celui qu'Obsidian embarque pour montrer les PDF. */
interface PdfJs {
  getDocument(source: { data: Uint8Array }): { promise: Promise<PdfJsDocument> }
}
interface PdfJsDocument {
  numPages: number
  getPage(number: number): Promise<{
    getViewport(options: { scale: number }): { width: number; height: number }
    render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> }
  }>
  destroy(): Promise<void>
}

/** Les pages d'un PDF dessinées par le pdf.js d'Obsidian, une à une, sur un canevas, en JPEG. */
export const obsidianPages: PageImages = {
  async open(bytes) {
    const pdfjs = (await loadPdfJs()) as PdfJs
    // Une copie : pdf.js garde le tampon qu'on lui donne.
    const document = await pdfjs.getDocument({ data: bytes.slice() }).promise
    return {
      pages: document.numPages,
      async page(number, size = 2000) {
        const page = await document.getPage(number)
        const natural = page.getViewport({ scale: 1 })
        // Son plus grand côté à `size` pixels (deux mille : les petits caractères d'un tableau se lisent), au plus quatre fois sa taille.
        const viewport = page.getViewport({ scale: Math.min(4, size / Math.max(natural.width, natural.height)) })
        const canvas = activeDocument.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('canvas 2d')
        // Un fond blanc : une page sans fond deviendrait noire en JPEG.
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: context, viewport }).promise
        const image = canvas.toDataURL('image/jpeg', 0.85)
        // Le canevas rendu tout de suite : un long PDF ne garde pas ses pages en mémoire.
        canvas.width = 0
        canvas.height = 0
        return image
      },
      close: () => document.destroy()
    }
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

/**
 * Le trousseau d'Obsidian (depuis la 1.11.4) : les secrets y sont rangés par le système,
 * hors du coffre. Absent sur une version plus ancienne.
 */
function obsidianSecrets(app: App): { secrets?: SecretStore } {
  const storage = (app as unknown as { secretStorage?: { getSecret(id: string): string | null; setSecret(id: string, value: string): void } })
    .secretStorage
  if (!storage) return {}
  return { secrets: { get: (id) => storage.getSecret(id), set: (id, value) => storage.setSecret(id, value) } }
}

/** Les réglages, dans le `data.json` du plugin. */
export function pluginSettingsStorage(plugin: Plugin): SettingsStorage {
  return {
    load: () => plugin.loadData() as Promise<unknown>,
    save: (data) => plugin.saveData(data)
  }
}

export function obsidianPlatform(plugin: Plugin, version: string, i18n: I18n, appearance: () => Appearance): Platform {
  const app = plugin.app
  return {
    info: { name: 'obsidian', version },
    fs: new ObsidianFileSystem(app),
    http: obsidianHttp,
    notifier: obsidianNotifier,
    ui: obsidianUi(app, i18n, appearance),
    display: obsidianDisplay(plugin),
    yaml: { parse: (text) => parseYaml(text) as unknown },
    pages: obsidianPages,
    ...obsidianSecrets(app)
  }
}
