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
}

/** Une ligne de blocs : une famille de fonctions (les PDF, les tableurs…). */
export interface ModuleDetailSection {
  readonly titleKey: string
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
  /** Les réglages propres au module, que la plateforme dessine sous sa ligne. */
  readonly settingsFields?: readonly ModuleSettingField[]
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
  /** Les valeurs possibles à droite. */
  options(): readonly string[]
  /** La valeur proposée d'abord ; à défaut, la première. */
  readonly defaultOption?: string
  /** La saisie de gauche, nettoyée : « .TOT » devient « tot ». */
  normalize(input: string): string
  /** `null` si la paire est acceptable, sinon pourquoi elle ne l'est pas. */
  validate(from: string, to: string, current: Readonly<Record<string, string>>): FieldError | null
  /** Les paires enregistrées, lues dans les réglages du module. */
  read(settings: Readonly<Record<string, unknown>>): Record<string, string>
}

export type ModuleSettingField = MappingField

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
  }
}

export interface BlackModule extends ModuleDescriptor {
  activate(context: ModuleContext): void | Promise<void>
  /** Libère ce que le module a pris : minuteries, observateurs… */
  deactivate?(): void | Promise<void>
}
