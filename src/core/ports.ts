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

import type { YamlReader } from './yaml'

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
  /** Tous les fichiers du coffre, hors dossiers cachés (`.obsidian`…) — l'index de la plateforme, quand elle en a un. */
  allFiles?(): Promise<VaultPath[]>
  /** Supprimer un fichier : à la corbeille, selon le réglage du coffre, quand la plateforme en a une. */
  trash?(path: VaultPath): Promise<void>
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
      /** Une date : un bouton à côté du champ ouvre un calendrier, qui l'écrit en `AAAA-MM-JJ` (la saisie reste libre). */
      calendar?: boolean
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
  | {
      /** Un texte sur plusieurs lignes : la formulation d'une exigence, par exemple. */
      kind: 'textarea'
      key: string
      label: string
      description?: string
      placeholder?: string
      tooltip?: string
      required?: boolean
      value?: string
    }
  | {
      /** Un interrupteur ; sa valeur rendue est `"true"` ou `"false"`. */
      kind: 'toggle'
      key: string
      label: string
      description?: string
      tooltip?: string
      value?: boolean
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
  /**
   * Un message qui demande qu'on le lise : une explication, des boutons, et parfois une
   * case (« Ne plus me le rappeler »). Montré quand l'espace de travail est prêt.
   */
  inform(view: MessageView): Promise<MessageAnswer>
  /**
   * Une liste qu'on filtre et qu'on parcourt : une ligne par élément, des menus de filtre,
   * une recherche, des boutons. Rend la ligne choisie ou le bouton pressé ; `null` si
   * l'utilisateur ferme la fenêtre.
   */
  pickFromList(view: ListView): Promise<ListAnswer | null>
}

export interface ListColumn {
  key: string
  label: string
  /** `wide` : la colonne prend la place qui reste (le texte d'une exigence). */
  width?: 'narrow' | 'wide'
}

export interface ListRow {
  id: string
  /** Le texte de chaque colonne, par clé. */
  cells: Readonly<Record<string, string>>
  /** Les valeurs sur lesquelles on filtre, par clé de filtre. */
  values?: Readonly<Record<string, string>>
  /** De petites étiquettes après la première colonne : « traduction en retard »… */
  flags?: readonly string[]
}

export interface ListView {
  title: string
  intro?: string
  columns: readonly ListColumn[]
  rows: readonly ListRow[]
  /** Des menus de filtre ; la première option, valeur vide, montre tout. */
  filters?: readonly { key: string; label: string; options: readonly Choice[] }[]
  searchPlaceholder?: string
  /** Affiché quand aucune ligne ne correspond. */
  empty: string
  /** Des boutons en tête : « Nouvelle exigence »… */
  actions?: readonly { value: string; label: string; cta?: boolean; tooltip?: string }[]
  /** Les filtres et la recherche de départ (pour revenir là où l'on était). */
  state?: ListState
}

export interface ListState {
  search: string
  filters: Readonly<Record<string, string>>
}

export type ListAnswer =
  | { kind: 'row'; id: string; state: ListState }
  | { kind: 'action'; value: string; state: ListState }

export interface MessageView {
  title: string
  /** Le texte ; une ligne vide sépare les paragraphes. */
  message: string
  /** Les boutons, dans l'ordre ; `cta` : le bouton mis en avant. */
  actions: readonly { value: string; label: string; cta?: boolean }[]
  /** Une case à cocher sous le texte. */
  option?: { label: string; value?: boolean; tooltip?: string }
}

export interface MessageAnswer {
  /** Le bouton choisi ; `null` si le message a été fermé. */
  action: string | null
  /** L'état de la case, cochée ou non (même si le message a été fermé). */
  option: boolean
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

/**
 * Comment la plateforme montre un fichier, d'après son extension :
 * - `native` : visible dans la liste des fichiers, et ouvert par l'application elle-même ;
 * - `plugin` : visible, et ouvert par une extension de l'application (un autre plugin) ;
 * - `viewer` : visible parce que l'utilisateur l'a demandé, et ouvert dans la visionneuse
 *   de Black Projects (en lecture seule) ;
 * - `listed` : visible, mais ouvert par une autre application de l'ordinateur ;
 * - `hidden` : absent de la liste des fichiers (il est pourtant bien dans le coffre).
 */
export type DisplayKind = 'native' | 'plugin' | 'viewer' | 'listed' | 'hidden'

export interface FileDisplay {
  kind(extension: string): DisplayKind
  /** Peut-on choisir d'afficher ce type ? Pas ceux que la plateforme (ou un plugin) ouvre déjà. */
  canShow(extension: string): boolean
  /** Les types à afficher, en plus de ce que la plateforme montre d'elle-même ; les autres sont masqués. */
  show(extensions: readonly string[]): void
}

/** Tous les ports, tels qu'un module les reçoit. */
export interface Platform {
  info: PlatformInfo
  fs: FileSystem
  http: Http
  notifier: Notifier
  ui: Ui
  /** Ce que la plateforme montre des fichiers ; absent si elle ne sait pas le dire. */
  display?: FileDisplay
  /** Lire du YAML (les en-têtes de notes structurés). */
  yaml: YamlReader
  /**
   * Le trousseau de l'ordinateur, pour les secrets (une clé d'API) : jamais dans le coffre,
   * jamais dans les réglages synchronisés. Absent si la plateforme n'en a pas.
   */
  secrets?: SecretStore
  /** Les pages d'un PDF en images, pour un modèle qui voit ; absent si la plateforme ne sait pas les dessiner. */
  pages?: PageImages
}

/** Les pages d'un document, dessinées en images. */
export interface PageImages {
  /**
   * Les pages d'un PDF, de la première à la `max`-ième, en images (des data URL JPEG, de
   * `width` pixels de large) ; et son nombre de pages.
   */
  pdf(bytes: Uint8Array, options?: { max?: number; width?: number }): Promise<{ pages: number; images: string[] }>
}

export interface SecretStore {
  /** Le secret, ou `null` s'il n'est pas enregistré. */
  get(id: string): string | null
  /** Enregistre (ou remplace) un secret ; une valeur vide l'efface. */
  set(id: string, value: string): void
}
