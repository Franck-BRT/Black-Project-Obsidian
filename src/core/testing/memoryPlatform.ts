// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Une plateforme en mémoire, pour les tests : un coffre fait d'un dictionnaire, des
 * notifications et des fenêtres gardées pour qu'un test les relise. Ce qu'un module fait
 * ici, il le fait de la même façon dans Obsidian.
 */

import type { FilePickOptions, Platform, TextView } from '../ports'

export interface MemoryPlatform extends Platform {
  files: Map<string, Uint8Array>
  notices: string[]
  shown: TextView[]
  /** La réponse que donnera le prochain `pickFile`, et les options qu'il a reçues. */
  nextPick: string | null
  picks: FilePickOptions[]
}

export function memoryPlatform(files: Record<string, string | Uint8Array> = {}): MemoryPlatform {
  const store = new Map<string, Uint8Array>()
  for (const [path, content] of Object.entries(files)) {
    store.set(path, typeof content === 'string' ? new TextEncoder().encode(content) : content)
  }
  const missing = (path: string) => new Error(`Fichier introuvable : ${path}`)
  const platform: MemoryPlatform = {
    files: store,
    notices: [],
    shown: [],
    nextPick: null,
    picks: [],
    info: { name: 'test', version: '0.0.0' },
    fs: {
      exists: async (path) => store.has(path),
      readText: async (path) => {
        const bytes = store.get(path)
        if (!bytes) throw missing(path)
        return new TextDecoder().decode(bytes)
      },
      readBinary: async (path) => {
        const bytes = store.get(path)
        if (!bytes) throw missing(path)
        return bytes.slice().buffer
      },
      writeText: async (path, content) => void store.set(path, new TextEncoder().encode(content)),
      writeBinary: async (path, content) => void store.set(path, new Uint8Array(content)),
      ensureFolder: async () => {},
      list: async (folder) => {
        const prefix = folder ? `${folder}/` : ''
        const files = [...store.keys()].filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
        return { files, folders: [] }
      }
    },
    http: { request: async () => ({ status: 404, text: '' }) },
    notifier: { notify: (message) => void platform.notices.push(message) },
    ui: {
      pickFile: async (options) => {
        platform.picks.push(options)
        return platform.nextPick
      },
      showText: (view) => void platform.shown.push(view)
    }
  }
  return platform
}
