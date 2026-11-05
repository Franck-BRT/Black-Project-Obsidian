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
  /** Déplace ou renomme un fichier ; crée le dossier d'arrivée s'il manque. Les liens vers lui suivent quand la plateforme le permet. */
  rename(from: VaultPath, to: VaultPath): Promise<void>
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

export interface FilePickOptions {
  /** Les extensions proposées, en minuscules, sans point ; toutes si absent. */
  extensions?: ReadonlySet<string> | readonly string[]
  /** Le texte affiché dans le champ de recherche. */
  placeholder?: string
}

export interface TextView {
  title: string
  /** Une ligne sous le titre : format, taille… */
  subtitle?: string
  text: string
}

/** Un choix dans une liste. */
export interface Choice {
  value: string
  label: string
  /** Une précision sous le libellé. */
  description?: string
}

/** Un fichier pris sur l'ordinateur, hors du coffre. */
export interface ExternalFile {
  name: string
  bytes: Uint8Array
}

export type FormField =
  | {
      kind: 'text'
      key: string
      label: string
      description?: string
      placeholder?: string
      tooltip?: string
      required?: boolean
      value?: string
    }
  | {
      kind: 'choice'
      key: string
      label: string
      description?: string
      tooltip?: string
      options: readonly Choice[]
      value?: string
    }

export interface FormView {
  title: string
  intro?: string
  fields: readonly FormField[]
  submit: string
  submitTooltip?: string
  /** `null` si les valeurs sont acceptables, sinon le message à montrer. */
  validate?(values: Readonly<Record<string, string>>): string | null
}

/** Les fenêtres dont un module a besoin, sans savoir comment la plateforme les dessine. */
export interface Ui {
  /** Fait choisir un fichier du coffre ; `null` si l'utilisateur renonce. */
  pickFile(options: FilePickOptions): Promise<VaultPath | null>
  /** Montre un texte long, avec de quoi le copier. */
  showText(view: TextView): void
  /** Ouvre une note du coffre. */
  openNote(path: VaultPath): Promise<void>
  /** La note ouverte, s'il y en a une. */
  activeNote(): VaultPath | null
  /** Fait choisir dans une liste ; `null` si l'utilisateur renonce. */
  pickOption(choices: readonly Choice[], placeholder?: string): Promise<string | null>
  /** Fait choisir des fichiers sur l'ordinateur ; liste vide si l'utilisateur renonce. */
  pickExternalFiles(options: { accept?: readonly string[]; multiple?: boolean }): Promise<ExternalFile[]>
  /** Un formulaire ; les valeurs saisies, ou `null` si l'utilisateur renonce. */
  askForm(form: FormView): Promise<Record<string, string> | null>
  /** Une question oui / non avant une action qu'on ne défait pas ; `true` si l'utilisateur confirme. */
  confirm(view: ConfirmView): Promise<boolean>
  /** Fait cocher plusieurs choix dans une liste ; `null` si l'utilisateur renonce. */
  pickMany(view: PickManyView): Promise<string[] | null>
}

export interface PickManyView {
  title: string
  intro?: string
  choices: readonly Choice[]
  /** Les choix cochés au départ ; tous si absent. */
  selected?: readonly string[]
  submit: string
}

export interface ConfirmView {
  title: string
  message: string
  /** Le libellé du bouton qui confirme : « Supprimer ». */
  confirm: string
  cancel: string
  /** L'action détruit quelque chose : le bouton est marqué comme tel. */
  danger?: boolean
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
  ui: Ui
}
