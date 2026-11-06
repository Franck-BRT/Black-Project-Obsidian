// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que les modules donnent à voir, décrit en **données** — jamais dessiné par eux.
 * L'interface (`src/ui`) dessine ces descriptions, dans Obsidian comme dans l'application
 * de bureau ; un module ne connaît ni Preact, ni le DOM, ni l'hôte. Changer la façon de
 * dessiner ne touche donc aucun module.
 *
 * Aujourd'hui : les sections de la **page d'accueil** et les entrées de la **navigation**.
 */

/** Ce qu'un élément dit de son état. L'interface lui donne une couleur, une icône et un mot. */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Les icônes que l'interface sait dessiner. */
export type IconName =
  | 'home'
  | 'folder'
  | 'file'
  | 'list'
  | 'check'
  | 'alert'
  | 'cross'
  | 'info'
  | 'plus'
  | 'upload'
  | 'search'
  | 'calendar'
  | 'clock'
  | 'star'
  | 'flow'
  | 'spark'
  | 'settings'
  | 'refresh'
  | 'book'
  | 'eye'
  | 'chat'
  | 'play'

/** Un bouton : ce qu'il dit, ce qu'il fait. */
export interface ViewAction {
  id: string
  label: string
  icon?: IconName
  tooltip?: string
  /** Mis en avant (l'action principale d'un bloc). */
  primary?: boolean
  run(): void | Promise<void>
}

export interface Badge {
  label: string
  tone: Tone
}

/** Un fait sur une carte : « Pièces : 10 ». */
export interface Fact {
  label: string
  value: string
  tone?: Tone
}

/** Une échéance : l'interface dit combien de jours il reste, et l'urgence. */
export interface Deadline {
  /** AAAA-MM-JJ. */
  date: string
  label: string
}

export interface Card {
  id: string
  title: string
  subtitle?: string
  icon?: IconName
  badges?: Badge[]
  facts?: Fact[]
  deadline?: Deadline
  /** Une note sur cinq (étoiles), avec ce qu'elle mesure. */
  rating?: { stars: number; label: string }
  /** L'action d'un clic sur la carte. */
  open?: ViewAction
  actions?: ViewAction[]
}

/** Un indicateur : un chiffre et ce qu'il compte. */
export interface Stat {
  label: string
  value: string
  hint?: string
  tone?: Tone
  icon?: IconName
}

export interface ListItem {
  id: string
  title: string
  detail?: string
  /** Quand, tel qu'à montrer : « 2026-11-05 14:02 ». */
  when?: string
  tone?: Tone
  open?: ViewAction
}

export type HomeBlock =
  | { kind: 'actions'; actions: ViewAction[] }
  | { kind: 'cards'; cards: Card[]; empty?: string }
  | { kind: 'stats'; stats: Stat[] }
  | { kind: 'list'; items: ListItem[]; empty?: string }
  | { kind: 'message'; tone: Tone; text: string; actions?: ViewAction[] }

/** Une section de l'accueil, telle qu'elle est à cet instant. */
export interface HomeSectionView {
  title: string
  subtitle?: string
  icon?: IconName
  blocks: HomeBlock[]
  /** Des boutons dans l'en-tête de la section (« Tout voir »). */
  actions?: ViewAction[]
}

/**
 * Une section déclarée par un module : où elle va, et de quoi la remplir. `load` est
 * appelé à chaque affichage ou rafraîchissement ; `null` : rien à montrer.
 */
export interface HomeSection {
  id: string
  /** Plus petit : plus haut. */
  order: number
  /** La colonne principale, ou la colonne de côté. */
  area: 'main' | 'side'
  load(): Promise<HomeSectionView | null>
}

/** Une entrée de la barre de navigation. */
export interface NavEntry {
  id: string
  label: string
  icon: IconName
  order: number
  run(): void | Promise<void>
}

/** Ce qu'un module peut déclarer à l'interface, par son contexte. */
export interface ViewsRegistrar {
  home(section: HomeSection): void
  nav(entry: NavEntry): void
}

/** Les déclarations de tous les modules actifs, rangées. */
export class ViewsRegistry implements ViewsRegistrar {
  private readonly sections = new Map<string, HomeSection>()
  private readonly entries = new Map<string, NavEntry>()

  home(section: HomeSection): void {
    this.sections.set(section.id, section)
  }

  nav(entry: NavEntry): void {
    this.entries.set(entry.id, entry)
  }

  homeSections(): HomeSection[] {
    return [...this.sections.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  }

  navEntries(): NavEntry[] {
    return [...this.entries.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  }
}
