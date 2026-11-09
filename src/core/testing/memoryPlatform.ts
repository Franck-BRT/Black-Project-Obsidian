// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Une plateforme en mémoire, pour les tests : un coffre fait d'un dictionnaire, des
 * notifications et des fenêtres gardées pour qu'un test les relise. Ce qu'un module fait
 * ici, il le fait de la même façon dans Obsidian.
 */

import { parse as parseYaml } from 'yaml'
import type {
  Choice,
  HttpRequest,
  ListAnswer,
  ListView,
  ConfirmView,
  ExternalFile,
  FilePickOptions,
  FormView,
  MessageAnswer,
  MessageView,
  PickManyView,
  Platform,
  TextView
} from '../ports'

export interface MemoryPlatform extends Platform {
  files: Map<string, Uint8Array>
  notices: string[]
  shown: TextView[]
  /** La réponse que donnera le prochain `pickFile`, et les options qu'il a reçues. */
  nextPick: string | null
  picks: FilePickOptions[]
  opened: string[]
  /** La note « ouverte ». */
  active: string | null
  /** Les réponses des prochains choix, formulaires et sélections de fichiers, dans l'ordre. */
  choices: (string | null)[]
  forms: (Record<string, string> | null)[]
  externalFiles: ExternalFile[][]
  /** Ce qui a été proposé. */
  offered: Choice[][]
  asked: FormView[]
  /** Les réponses des prochaines confirmations (oui par défaut), et les questions posées. */
  confirmations: boolean[]
  confirmed: ConfirmView[]
  /** Les réponses des prochains choix multiples (par défaut : ce qui était coché), et les listes proposées. */
  manyAnswers: (string[] | null)[]
  manyAsked: PickManyView[]
  /** Les réponses des prochains messages (par défaut : fermé, case telle quelle), et les messages montrés. */
  messageAnswers: MessageAnswer[]
  messages: MessageView[]
  /** Les réponses des prochaines listes (par défaut : fermée), et les listes montrées. */
  listAnswers: (ListAnswer | null)[]
  lists: ListView[]
  /** Le trousseau, en mémoire. */
  secretValues: Map<string, string>
  /** Les réponses du réseau, dans l'ordre (par défaut : 404), et les requêtes reçues. */
  httpAnswers: { status: number; text: string }[]
  requests: HttpRequest[]
}

export function memoryPlatform(files: Record<string, string | Uint8Array> = {}): MemoryPlatform {
  const store = new Map<string, Uint8Array>()
  for (const [path, content] of Object.entries(files)) {
    store.set(path, typeof content === 'string' ? new TextEncoder().encode(content) : content)
  }
  const missing = (path: string) => new Error(`Fichier introuvable : ${path}`)
  // Les dossiers : ceux créés explicitement, et ceux qui contiennent un fichier.
  const folders = new Set<string>()
  const addFolders = (path: string) => {
    const parts = path.split('/')
    for (let index = 1; index < parts.length; index++) folders.add(parts.slice(0, index).join('/'))
  }
  for (const path of store.keys()) addFolders(path)
  const put = (path: string, bytes: Uint8Array) => {
    store.set(path, bytes)
    addFolders(path)
  }
  const platform: MemoryPlatform = {
    files: store,
    notices: [],
    shown: [],
    nextPick: null,
    picks: [],
    opened: [],
    active: null,
    choices: [],
    forms: [],
    externalFiles: [],
    offered: [],
    asked: [],
    confirmations: [],
    confirmed: [],
    manyAnswers: [],
    manyAsked: [],
    messageAnswers: [],
    messages: [],
    listAnswers: [],
    lists: [],
    secretValues: new Map(),
    httpAnswers: [],
    requests: [],
    secrets: {
      get: (id) => platform.secretValues.get(id) ?? null,
      set: (id, value) => void (value ? platform.secretValues.set(id, value) : platform.secretValues.delete(id))
    },
    yaml: { parse: (text) => parseYaml(text) as unknown },
    info: { name: 'test', version: '0.0.0' },
    fs: {
      exists: async (path) => store.has(path) || folders.has(path),
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
      writeText: async (path, content) => put(path, new TextEncoder().encode(content)),
      writeBinary: async (path, content) => put(path, new Uint8Array(content)),
      ensureFolder: async (path) => {
        if (path) addFolders(`${path}/x`)
      },
      rename: async (from, to) => {
        const bytes = store.get(from)
        if (!bytes) throw missing(from)
        store.delete(from)
        put(to, bytes)
      },
      allFiles: async () => [...store.keys()].filter((path) => !path.split('/').some((part) => part.startsWith('.'))),
      list: async (folder) => {
        const prefix = folder ? `${folder}/` : ''
        const direct = (path: string) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/')
        return { files: [...store.keys()].filter(direct), folders: [...folders].filter(direct) }
      }
    },
    http: {
      request: async (request) => {
        platform.requests.push(request)
        return platform.httpAnswers.shift() ?? { status: 404, text: '' }
      }
    },
    notifier: { notify: (message) => void platform.notices.push(message) },
    ui: {
      pickFile: async (options) => {
        platform.picks.push(options)
        return platform.nextPick
      },
      showText: (view) => void platform.shown.push(view),
      openNote: async (path) => void platform.opened.push(path),
      activeNote: () => platform.active,
      pickOption: async (choices) => {
        platform.offered.push([...choices])
        return platform.choices.shift() ?? null
      },
      pickExternalFiles: async () => platform.externalFiles.shift() ?? [],
      askForm: async (form) => {
        platform.asked.push(form)
        const answer = platform.forms.shift() ?? null
        if (answer && form.validate) {
          const error = form.validate(answer)
          if (error) throw new Error(`Formulaire refusé : ${error}`)
        }
        return answer
      },
      confirm: async (view) => {
        platform.confirmed.push(view)
        return platform.confirmations.shift() ?? true
      },
      pickMany: async (view) => {
        platform.manyAsked.push(view)
        if (platform.manyAnswers.length > 0) return platform.manyAnswers.shift()!
        return view.selected ? [...view.selected] : view.choices.map((choice) => choice.value)
      },
      inform: async (view) => {
        platform.messages.push(view)
        return platform.messageAnswers.shift() ?? { action: null, option: view.option?.value ?? false }
      },
      pickFromList: async (view) => {
        platform.lists.push(view)
        return platform.listAnswers.shift() ?? null
      }
    }
  }
  return platform
}
