// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le contrat d'un module de Black Projects.
 *
 * Un module est une fonction de l'outil — l'analyse d'appels d'offres aujourd'hui,
 * d'autres demain — qui se déclare au registre et reçoit à son activation tout ce dont
 * il a besoin : les ports de la plateforme, les textes, ses réglages, et de quoi
 * déclarer ses commandes. Il ne va rien chercher ailleurs : c'est ce qui lui permet de
 * tourner dans Obsidian comme, plus tard, dans l'application de bureau.
 */

import type { ViewsRegistrar } from '../views'
import type { DocInput, DocPage } from '../docs'
import type { Dictionary, I18n, Vars } from '../i18n'
import type { Platform } from '../ports'
import type { Language } from '../settings'

/**
 * Où en est une fonction d'un module : disponible, en cours de développement (prévue à
 * une étape du plan), ou prévue plus tard.
 */
export type FeatureStatus = 'available' | 'in-progress' | 'planned'

export const FEATURE_STATUSES: readonly FeatureStatus[] = ['available', 'in-progress', 'planned']

/** Une fonction d'un module, telle que les réglages la montrent : un petit bloc. */
export interface ModuleFeature {
  /** Un texte court affiché tel quel devant le libellé : un code (« RC »), par exemple. */
  readonly prefix?: string
  readonly labelKey: string
  /** Une précision sous le libellé : ce qui est lu, ce qui ne l'est pas, comment. */
  readonly noteKey?: string
  /** Étiquettes courtes affichées dans le bloc : les extensions d'un format, par exemple. */
  readonly tags?: readonly string[]
  readonly status: FeatureStatus
  /** L'étape du plan d'intégration qui l'apporte, quand elle est connue. */
  readonly step?: number
  /** Les variables du libellé et de la précision : `{from}`, `{to}`… */
  readonly vars?: Vars
  /**
   * Des constats sur la fiche, une ligne chacun : « Écrit par Black Projects : Oui ».
   * Chaque valeur a sa couleur (`tone`) et, au besoin, son infobulle.
   */
  readonly facts?: readonly FeatureFact[]
  /**
   * La couleur de la fiche, quand elle ne suit pas l'état (`status`) : vert, orange,
   * rouge. Le résumé en tête de fenêtre compte alors les fiches par couleur.
   */
  readonly tone?: FactTone
  /** Le badge en bas de la fiche, à la place de celui de l'état. */
  readonly badge?: FactValue
  /** Des groupes d'étiquettes, chacun avec son titre : les mots-clés cherchés dans le nom, dans le titre… */
  readonly tagGroups?: readonly { readonly labelKey: string; readonly tags: readonly string[] }[]
  /** La fiche est désactivée par l'utilisateur : montrée en retrait. */
  readonly disabled?: boolean
  /**
   * Un interrupteur sur la fiche, qui active ou désactive ce qu'elle décrit : `id` est
   * ajouté à (ou retiré de) la liste rangée sous `settingsKey` dans les réglages du module.
   */
  readonly switch?: {
    readonly settingsKey: string
    readonly id: string
    /**
     * `off` (par défaut) : la liste est celle des éléments éteints (types désactivés) ;
     * `on` : celle des éléments allumés (extensions affichées).
     */
    readonly listed?: 'off' | 'on'
    /** Les infobulles de l'interrupteur, actif et inactif. */
    readonly tooltipKeys?: { readonly on: string; readonly off: string }
  }
}

/** Un constat sur une fiche : un libellé, puis une ou plusieurs valeurs. */
export interface FeatureFact {
  readonly labelKey: string
  readonly values: readonly FactValue[]
}

/** `yes` : vert ; `partial` : orange (en partie, ou avec une réserve) ; `no` : rouge. */
export type FactTone = 'yes' | 'partial' | 'no'

export interface FactValue {
  readonly textKey: string
  readonly vars?: Vars
  readonly tone: FactTone
  readonly tooltipKey?: string
}

/** Une ligne de blocs : une famille de fonctions (les PDF, les tableurs…). */
export interface ModuleDetailSection {
  readonly titleKey: string
  /** Une phrase sous le titre de la ligne. */
  readonly introKey?: string
  /**
   * `status` (par défaut) : des fonctions, chacune avec son état coloré, comptées dans le
   * résumé. `reference` : des fiches de référence (les types de pièces et leur
   * détection), sans état ni couleur, hors du résumé.
   */
  readonly kind?: 'status' | 'reference'
  /** Ce qui précède chaque étiquette de `tags` : « . » pour une extension (par défaut), rien sinon. */
  readonly tagPrefix?: string
  readonly features: readonly ModuleFeature[]
}

/**
 * Ce que les réglages montrent quand on clique sur un module : ce qu'il sait faire, et ce
 * qui arrive. Écrit par le module, dessiné par la plateforme.
 */
export interface ModuleDetails {
  /** Le libellé du bouton qui ouvre le détail : « Formats de fichiers », par exemple. */
  readonly titleKey: string
  readonly introKey?: string
  /** Le libellé de chaque état dans ce module ; à défaut, ceux du cœur. */
  readonly statusKeys?: Partial<Record<FeatureStatus, string>>
  /** Pour des fiches colorées par `tone` : le libellé et l'infobulle de chaque couleur dans le résumé. */
  readonly toneKeys?: Readonly<Record<FactTone, { readonly label: string; readonly tip?: string }>>
  /** Le nombre de fiches par ligne (une grille) ; à défaut, autant qu'il en tient. */
  readonly columns?: number
  readonly sections: readonly ModuleDetailSection[]
}

/** Ce qu'on sait d'un module sans l'activer. */
export interface ModuleDescriptor {
  /** Identifiant stable, en minuscules : `ao`, `planning`… Préfixe de ses clés de texte. */
  readonly id: string
  /** Clé du nom affiché. */
  readonly nameKey: string
  /** Clé de la description affichée dans les réglages. */
  readonly descriptionKey: string
  readonly version: string
  /** Les modules qui doivent être actifs avant celui-ci. */
  readonly requires: readonly string[]
  /**
   * Ses textes, par langue. Enregistrés dès la déclaration, actif ou non : les réglages
   * doivent pouvoir nommer un module désactivé.
   */
  readonly texts: Readonly<Record<Language, Dictionary>>
  /**
   * Le détail montré depuis les réglages, s'il y en a un. Calculé à partir des réglages
   * du module, pour montrer aussi ce que l'utilisateur a ajouté.
   */
  readonly details?: (settings: Readonly<Record<string, unknown>>) => ModuleDetails
  /** Les réglages propres au module, dessinés en tête de sa fenêtre. */
  readonly settingsFields?: readonly ModuleSettingField[]
  /**
   * Ses pages de documentation, écrites dans le coffre à la demande. Leur texte vit dans
   * le répertoire du module (`doc/`), pour se maintenir avec son code.
   */
  readonly docs?: (input: DocInput) => readonly DocPage[]
  /**
   * Remet en ordre, au chargement, des réglages rangés autrement par une version plus
   * ancienne : reçoit les réglages de tous les modules, rend ceux à enregistrer, ou `null`
   * s'il n'y a rien à changer.
   */
  migrateSettings?(modules: Readonly<Record<string, Record<string, unknown>>>): Record<string, Record<string, unknown>> | null
}

/** Une erreur de saisie, à montrer à l'utilisateur. */
export interface FieldError {
  readonly key: string
  readonly vars?: Vars
}

/**
 * Un réglage fait de paires « ceci → cela » : des extensions équivalentes, par exemple.
 * Le module dit ce qui est permis ; la plateforme dessine la liste et le formulaire.
 */
export interface MappingField {
  readonly kind: 'mapping'
  /** La clé, dans les réglages du module, où les paires sont rangées. */
  readonly key: string
  readonly nameKey: string
  readonly descKey?: string
  /** L'exemple affiché dans le champ de saisie. */
  readonly placeholderKey?: string
  /** Affiché devant chaque valeur : « . » pour une extension. */
  readonly prefix?: string
  /** Le mot entre les deux : « lu comme ». */
  readonly connectorKey: string
  /** Les infobulles du champ de saisie, du menu, du bouton d'ajout et de la corbeille. */
  readonly tooltipKeys?: {
    readonly from?: string
    readonly to?: string
    readonly add?: string
    readonly edit?: string
    readonly remove?: string
  }
  /**
   * La valeur de droite : choisie dans un menu (`choice`, par défaut) ou saisie librement
   * (`text`) — un libellé, par exemple.
   */
  readonly valueKind?: 'choice' | 'text'
  /** L'exemple affiché dans le champ de la valeur, quand elle est saisie. */
  readonly valuePlaceholderKey?: string
  /** La valeur saisie, nettoyée. */
  normalizeValue?(input: string): string
  /** Les valeurs possibles à droite, d'après les réglages du module (pour un menu). */
  options(settings: Readonly<Record<string, unknown>>): readonly string[]
  /** La valeur proposée d'abord ; à défaut, la première. */
  readonly defaultOption?: string
  /** Le libellé d'une valeur de droite, affiché après elle : « CCTP — Cahier des… ». */
  optionLabel?(option: string, settings: Readonly<Record<string, unknown>>, t: (key: string) => string): string
  /** La saisie de gauche, nettoyée : « .TOT » devient « tot ». */
  normalize(input: string): string
  /** `null` si la paire est acceptable, sinon pourquoi elle ne l'est pas. */
  validate(
    from: string,
    to: string,
    current: Readonly<Record<string, string>>,
    settings: Readonly<Record<string, unknown>>
  ): FieldError | null
  /** Les paires enregistrées, lues dans les réglages du module. */
  read(settings: Readonly<Record<string, unknown>>): Record<string, string>
  /** Chaque paire a un bouton pour la modifier : les deux valeurs, dans un formulaire. */
  readonly editable?: boolean
  /** Le titre du formulaire de modification ; `{from}` y est remplacé par la paire modifiée. */
  readonly editTitleKey?: string
  /** Les libellés des deux champs du formulaire de modification : « Code », « Libellé ». */
  readonly fromLabelKey?: string
  readonly toLabelKey?: string
  /**
   * Ce que la suppression d'une paire entraîne, à faire confirmer ; `null` : supprimée
   * sans question.
   */
  describeRemoval?(
    from: string,
    to: string,
    settings: Readonly<Record<string, unknown>>,
    t: (key: string, vars?: Vars) => string
  ): string | null
  /**
   * Après un ajout, une modification ou une suppression, les réglages du module tels
   * qu'ils seront enregistrés — la paire déjà changée —, pour que le module ajuste ce qui
   * en dépend : les mots-clés d'un type dont le code change, par exemple.
   */
  afterChange?(change: MappingChange, settings: Record<string, unknown>): Record<string, unknown>
}

/** Ce qui vient d'arriver à une paire. */
export type MappingChange =
  | { readonly kind: 'add'; readonly from: string; readonly to: string }
  | { readonly kind: 'edit'; readonly from: string; readonly to: string; readonly previousFrom: string; readonly previousTo: string }
  | { readonly kind: 'remove'; readonly from: string; readonly to: string }

/** Un réglage fait d'un texte : un dossier, par exemple. */
export interface TextField {
  readonly kind: 'text'
  readonly key: string
  readonly nameKey: string
  readonly descKey?: string
  readonly tooltipKey?: string
  /** La valeur quand rien n'est enregistré. */
  readonly defaultValue: string
  /** La saisie nettoyée ; une valeur vide revient à la valeur par défaut. */
  normalize(input: string): string
  /**
   * Des valeurs à choisir plutôt qu'à taper — les modèles d'un serveur, par exemple — ;
   * montrées dans un menu à côté du champ, qui reste modifiable. Vide : le champ seul.
   */
  choices?(settings: Readonly<Record<string, unknown>>): readonly string[]
  /** L'infobulle du menu des choix. */
  readonly choicesTooltipKey?: string
}

/**
 * Une ligne de boutons dans la fenêtre du module, chacun lançant une commande du module
 * (celles qu'il déclare à son activation) : « Importer », « Exporter »…
 */
export interface ActionsField {
  readonly kind: 'actions'
  readonly nameKey: string
  readonly descKey?: string
  readonly actions: readonly { readonly commandId: string; readonly labelKey: string; readonly tooltipKey?: string }[]
}

/**
 * Un réglage fait d'éléments rangés dans des colonnes — des types de pièces, avec
 * l'appel d'offres ou avec la réponse : chaque élément de la liste a un interrupteur par
 * colonne, au moins un allumé. On ajoute un élément dans une petite fenêtre (lequel, et
 * ses colonnes) ; la liste se déplie pour le modifier ou le retirer.
 */
export interface TogglesField {
  readonly kind: 'toggles'
  /** Identifie la liste dans la fenêtre (pour qu'elle reste dépliée quand on la redessine). */
  readonly key: string
  readonly nameKey: string
  /** L'explication, affichée en haut de la liste dépliée, au-dessus des éléments. */
  readonly descKey?: string
  /** Les colonnes : leur identifiant, leur libellé (court : il tient sur la ligne), leur infobulle. */
  readonly columns: readonly { readonly id: string; readonly labelKey: string; readonly tooltipKey?: string }[]
  /** Les éléments de la liste, et leurs colonnes allumées. */
  read(settings: Readonly<Record<string, unknown>>): Record<string, readonly string[]>
  /** Les éléments qu'on peut ajouter : ceux qui ne sont pas encore dans la liste. */
  candidates(settings: Readonly<Record<string, unknown>>): readonly string[]
  /** Le libellé d'un élément : « CCTP — Cahier des clauses techniques particulières ». */
  itemLabel(item: string, settings: Readonly<Record<string, unknown>>, t: (key: string) => string): string
  /** Les réglages du module après le changement ; `columns` à `null` retire l'élément. */
  write(settings: Readonly<Record<string, unknown>>, item: string, columns: readonly string[] | null): Record<string, unknown>
  /** Les colonnes allumées au départ dans la fenêtre d'ajout ; toutes si absent. */
  readonly defaultColumns?: readonly string[]
  /** Le bouton d'ajout, le titre et le texte de sa fenêtre, le libellé du choix de l'élément. */
  readonly addKey: string
  readonly addTitleKey: string
  readonly addIntroKey?: string
  readonly itemFieldKey: string
  /** Le titre de la liste dépliable ; `{count}` y est remplacé par le nombre d'éléments. */
  readonly listKey: string
  readonly emptyKey: string
  /** Quand plus aucun élément ne peut être ajouté. */
  readonly noCandidateKey: string
  /** Quand on éteint la dernière colonne d'un élément. */
  readonly minimumKey: string
  readonly tooltipKeys?: { readonly add?: string; readonly list?: string; readonly remove?: string }
}

/** Un réglage oui / non : un interrupteur. */
export interface BooleanField {
  readonly kind: 'boolean'
  readonly key: string
  readonly nameKey: string
  readonly descKey?: string
  readonly tooltipKey?: string
  /** La valeur quand rien n'est enregistré. */
  readonly defaultValue: boolean
}

/**
 * Un secret (une clé d'API) : saisi dans la fenêtre du module, rangé dans le trousseau de
 * la plateforme sous `secretId` — jamais dans les réglages du module ni dans le coffre.
 */
export interface SecretField {
  readonly kind: 'secret'
  readonly secretId: string
  readonly nameKey: string
  readonly descKey?: string
  readonly tooltipKey?: string
  readonly placeholderKey?: string
}

export type ModuleSettingField = MappingField | TextField | ActionsField | TogglesField | BooleanField | SecretField

/** Une action que l'utilisateur lance, depuis la palette de commandes par exemple. */
export interface ModuleCommand {
  /** Unique dans le module ; la plateforme le préfixe par l'identifiant du module. */
  readonly id: string
  readonly nameKey: string
  run(): void | Promise<void>
}

/** Les réglages d'un module, rangés sous son identifiant. */
export interface ModuleSettings {
  get(): Readonly<Record<string, unknown>>
  save(values: Record<string, unknown>): Promise<void>
  /** Prévient quand ils changent, d'où que vienne le changement ; rend de quoi se désabonner. */
  onChange(listener: (values: Readonly<Record<string, unknown>>) => void): () => void
}

/** Tout ce qu'un module reçoit à son activation. */
export interface ModuleContext {
  readonly moduleId: string
  readonly platform: Platform
  readonly i18n: I18n
  readonly settings: ModuleSettings
  readonly commands: {
    register(command: ModuleCommand): void
    /** Lance une commande du module, comme depuis la palette (une erreur est montrée, pas levée). */
    run?(id: string): Promise<void>
  }
  /** Ouvre la fenêtre du module (ses réglages et ses fonctions), quand la plateforme en a une. */
  openWindow?(): void
  /** Des blocs de code que le module dessine dans les notes (`brt-req`…), quand la plateforme le permet. */
  readonly blocks?: {
    register(language: string, render: BlockRenderer): void
  }
  /**
   * Une tâche répétée tant que le plugin tourne (les workflows planifiés), arrêtée à son
   * déchargement ; aussi lancée une fois quand l'espace de travail est prêt.
   */
  readonly timers?: {
    every(milliseconds: number, run: () => void): void
  }  /** Ce que le module montre dans l'interface : sections de l'accueil, entrées de navigation. */
  readonly views?: ViewsRegistrar
}

/** Ce qu'un bloc de code devient : un tableau, et des messages au-dessus. */
export interface BlockView {
  readonly columns: readonly string[]
  readonly rows: readonly BlockRow[]
  /** Ce que le lecteur doit savoir : un identifiant introuvable, une clé inconnue… */
  readonly messages: readonly string[]
  /** Affiché quand il n'y a aucune ligne. */
  readonly empty?: string
}

export interface BlockRow {
  readonly cells: readonly string[]
  /** De petites étiquettes sous la ligne : « traduction en retard »… */
  readonly flags?: readonly string[]
  /** La note de l'élément, ouverte d'un clic sur la première cellule. */
  readonly link?: string
}

/** Dessine un bloc : son texte, et la note où il est. */
export type BlockRenderer = (source: string, notePath: string) => Promise<BlockView>

export interface BlackModule extends ModuleDescriptor {
  activate(context: ModuleContext): void | Promise<void>
  /** Libère ce que le module a pris : minuteries, observateurs… */
  deactivate?(): void | Promise<void>
}
