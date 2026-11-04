// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que le cœur attend de la plateforme qui l'héberge.
 *
 * Le cœur et les modules ne parlent jamais à Obsidian directement : ils parlent à ces
 * interfaces. Le plugin Obsidian les implémente avec l'API d'Obsidian ; l'application de
 * bureau les implémentera avec Tauri ; les tests les implémentent en mémoire. Tant que
 * cette frontière tient, le même code métier tourne partout.
 */

/** Un chemin relatif à la racine du coffre, avec des « / », sans « / » initial. */
export type VaultPath = string

export interface FolderListing {
  files: VaultPath[]
  folders: VaultPath[]
}

/** Les fichiers du coffre. */
export interface FileSystem {
  exists(path: VaultPath): Promise<boolean>
  readText(path: VaultPath): Promise<string>
  readBinary(path: VaultPath): Promise<ArrayBuffer>
  /** Crée le fichier, et ses dossiers parents, s'il n'existe pas. */
  writeText(path: VaultPath, content: string): Promise<void>
  writeBinary(path: VaultPath, content: ArrayBuffer): Promise<void>
  /** Crée le dossier et ses parents ; ne fait rien s'il existe déjà. */
  ensureFolder(path: VaultPath): Promise<void>
  list(folder: VaultPath): Promise<FolderListing>
}

export interface HttpRequest {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
}

export interface HttpResponse {
  status: number
  text: string
}

/**
 * Le réseau. Une réponse en erreur (4xx, 5xx) est rendue, pas levée : c'est à
 * l'appelant de dire ce qu'elle signifie. Seule une panne de transport est levée.
 */
export interface Http {
  request(request: HttpRequest): Promise<HttpResponse>
}

/** Dire quelque chose à l'utilisateur, brièvement. */
export interface Notifier {
  notify(message: string, durationMs?: number): void
}

/** Garder et relire les réglages du plugin. */
export interface SettingsStorage {
  load(): Promise<unknown>
  save(data: unknown): Promise<void>
}

/** Ce que la plateforme sait d'elle-même. */
export interface PlatformInfo {
  /** `obsidian`, `desktop` (l'application Tauri, plus tard) ou `test`. */
  name: 'obsidian' | 'desktop' | 'test'
  version: string
}

/** Tous les ports, tels qu'un module les reçoit. */
export interface Platform {
  info: PlatformInfo
  fs: FileSystem
  http: Http
  notifier: Notifier
}
