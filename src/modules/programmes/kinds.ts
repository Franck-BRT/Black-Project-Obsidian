// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **sortes de phase** que les modules déclarent : une phase de cette sorte, dans un
 * projet, a leurs boutons et ce qu'ils en disent. L'analyse d'un appel d'offres est une
 * sorte du module AO : créer l'analyse, en relier une, l'ouvrir. Sans module, une phase est
 * libre : on la mène soi-même, son état et ses dates suffisent.
 */

import type { HomeBlock, IconName, TileColor, ViewAction } from '../../core/views'
import type { PhaseStatus, Project, ProjectPhase } from './model'

/** Ce qu'une sorte de phase reçoit pour une phase d'un projet. */
export interface PhaseContext {
  project: Project
  phase: ProjectPhase
  /** Relier la phase à ce qui la porte (une note), ou la délier (`null`). */
  link(path: string | null): Promise<void>
  /** Changer son état. */
  setStatus(status: PhaseStatus): Promise<void>
}

export interface PhaseKind {
  id: string
  /** Son nom, dans la langue de l'utilisateur (« Analyse d'appel d'offres »). */
  label: string
  /** Ce qu'elle fait, dans le choix de la sorte d'une phase. */
  description?: string
  icon: IconName
  color: TileColor
  /** Ce que dit la tuile de la phase, sous son nom, d'après ce qui la porte (« 12 pièces »). */
  detail?(phase: ProjectPhase): Promise<string | null>
  /** Ses boutons, sur la page de la phase. */
  actions(context: PhaseContext): ViewAction[]
  /** Ce qu'elle montre sur la page de la phase. */
  blocks?(context: PhaseContext): Promise<HomeBlock[]>
}

const kinds = new Map<string, PhaseKind>()

/** Pour un module : déclarer une sorte de phase ; rend de quoi la retirer. */
export function registerPhaseKind(kind: PhaseKind): () => void {
  kinds.set(kind.id, kind)
  return () => {
    if (kinds.get(kind.id) === kind) kinds.delete(kind.id)
  }
}

/** Les sortes déclarées par les modules actifs. */
export const phaseKinds = (): PhaseKind[] => [...kinds.values()]

export const phaseKind = (id: string): PhaseKind | undefined => kinds.get(id)
