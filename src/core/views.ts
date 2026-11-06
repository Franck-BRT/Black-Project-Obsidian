// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que les modules donnent à voir, décrit en **données** — jamais dessiné par eux.
 * L'interface (`src/ui`) dessine ces descriptions, dans Obsidian comme dans l'application
 * de bureau ; un module ne connaît ni Preact, ni le DOM, ni l'hôte. Changer la façon de
 * dessiner ne touche donc aucun module.
 *
 * Aujourd'hui : les **tuiles** de l'accueil (que l'utilisateur choisit et range), les
 * sections du **tableau de bord** et les entrées de la **navigation**.
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
  | 'edit'
  | 'trash'
  | 'copy'
  | 'chevron'
  | 'chart'
  | 'grid'
  | 'up'
  | 'down'
  | 'columns'
  | 'hide'
  | 'grip'
  | 'lock'

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
  /** Un extrait (la formulation d'une exigence) : trois lignes au plus, le reste coupé. */
  text?: string
  facts?: Fact[]
  deadline?: Deadline
  /** Une note sur cinq (étoiles), avec ce qu'elle mesure. */
  rating?: { stars: number; label: string }
  /** L'action d'un clic sur la carte. */
  open?: ViewAction
  actions?: ViewAction[]
  /** Les filtres d'une page auxquels la carte répond (`PageView.filters`). */
  tags?: string[]
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
  /** Son nom, sans la charger : pour la ranger ou la réafficher dans le tableau de bord. */
  title: string
  icon?: IconName
  /** Plus petit : plus haut. */
  order: number
  /** La colonne principale, ou la colonne de côté — par défaut ; l'utilisateur la déplace. */
  area: 'main' | 'side'
  load(): Promise<HomeSectionView | null>
}

/**
 * Le tableau de bord tel que l'utilisateur l'a rangé : les sections de chaque colonne dans
 * l'ordre, celles masquées et celles réduites (leur titre seul). Une section qui n'y figure
 * pas (un module activé depuis) se place d'elle-même dans sa colonne par défaut.
 */
export interface DashboardLayout {
  main: string[]
  side: string[]
  hidden: string[]
  collapsed: string[]
}

/**
 * Une page qu'un module ouvre dans l'onglet de Black Projects, comme le tableau de bord :
 * la liste des analyses, plutôt qu'une fenêtre pour en choisir une. On y va par
 * `ModuleContext.showPage(id)` (une entrée du menu, une tuile, une commande).
 */
export interface PageSpec {
  id: string
  title: string
  icon: IconName
  /** Appelé à chaque affichage ou rafraîchissement. */
  load(): Promise<PageView>
}

export interface PageView {
  subtitle?: string
  /** Les boutons en tête de page. */
  actions?: ViewAction[]
  blocks: HomeBlock[]
  /** Un champ de recherche : il filtre les cartes et les listes de la page par leur texte. */
  search?: { label: string; placeholder?: string }
  /** Des filtres à bascule (en plus de « Tout ») : une carte répond à ceux de ses `tags`. */
  filters?: { id: string; label: string }[]
}

/** Les couleurs de tuile : décoratives (le libellé dit tout), définies par chaque thème. */
export type TileColor = 'indigo' | 'blue' | 'teal' | 'green' | 'orange' | 'rose' | 'violet' | 'slate'

/** Une pastille sur une tuile : un nombre, une échéance (« J-5 »). */
export interface TileBadge {
  text: string
  tone: Tone
  /** Ce qu'elle veut dire, pour les lecteurs d'écran et l'infobulle. */
  label: string
}

/**
 * Une tuile de l'accueil : un raccourci vers ce que fait un module. L'utilisateur choisit
 * les siennes et les range ; un module en propose, certaines présentes par défaut.
 */
export interface TileSpec {
  id: string
  label: string
  icon: IconName
  color: TileColor
  /** Le module qui la propose, pour ranger le catalogue : « Analyse d'appels d'offres ». */
  group: string
  /** Une phrase dans le catalogue. */
  description?: string
  /** Sur l'accueil tant que l'utilisateur ne l'a pas réglé. */
  byDefault?: boolean
  /** Plus petit : plus tôt dans l'ordre par défaut. */
  order: number
  run(): void | Promise<void>
  /** La page qu'elle ouvre, s'il y en a une. */
  page?: string
  /** Une pastille calculée à chaque affichage ; `null` : aucune. */
  badge?(): Promise<TileBadge | null>
}

/** Une entrée de la barre de navigation. */
export interface NavEntry {
  id: string
  label: string
  icon: IconName
  order: number
  run(): void | Promise<void>
  /** La page qu'elle ouvre : l'entrée est marquée « page en cours » quand on y est. */
  page?: string
}

/**
 * La barre de gauche telle que l'utilisateur l'a rangée : les entrées montrées, dans
 * l'ordre, et celles proposées par défaut qu'il a retirées. Accueil (toujours en haut) et
 * Paramètres (toujours en bas) n'y figurent pas : ils ne se déplacent ni ne se masquent.
 */
export interface NavLayout {
  shown: string[]
  hidden: string[]
}

/** Ce qu'un module peut déclarer à l'interface, par son contexte. */
export interface ViewsRegistrar {
  /** Une section du tableau de bord. */
  home(section: HomeSection): void
  nav(entry: NavEntry): void
  /** Une tuile proposée pour l'accueil. */
  tile(spec: TileSpec): void
  /** Une page du module, ouverte dans l'onglet de Black Projects. */
  page(spec: PageSpec): void
}

/** Les déclarations de tous les modules actifs, rangées. */
export class ViewsRegistry implements ViewsRegistrar {
  private readonly sections = new Map<string, HomeSection>()
  private readonly entries = new Map<string, NavEntry>()
  private readonly tiles = new Map<string, TileSpec>()
  private readonly modulePages = new Map<string, PageSpec>()

  page(spec: PageSpec): void {
    this.modulePages.set(spec.id, spec)
  }

  /** Les pages des modules actifs. */
  pages(): PageSpec[] {
    return [...this.modulePages.values()]
  }

  tile(spec: TileSpec): void {
    this.tiles.set(spec.id, spec)
  }

  /** Toutes les tuiles proposées, dans l'ordre par défaut. */
  allTiles(): TileSpec[] {
    return [...this.tiles.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  }

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
