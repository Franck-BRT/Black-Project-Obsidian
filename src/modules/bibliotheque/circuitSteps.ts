// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Les étapes du circuit**, pour un document encore dans « À classer » ou « À contrôler » :
 * versé, ingéré, analysé, rangé — chacune en couleur selon où il en est :
 *
 * - **vert** : faite ;
 * - **orange** : la prochaine, en attente (le circuit la fera), ou à votre décision (À contrôler,
 *   avec une proposition de l'IA) ;
 * - **rouge** : en échec (l'IA injoignable, une erreur), ou À contrôler sans proposition ;
 * - gris : à venir.
 *
 * Et un bouton, **Continuer le circuit** : reprendre là où il s'est arrêté (à contrôler :
 * redemander le rangement à l'IA). Des fonctions pures.
 */

import type { HomeBlock, IconName, JourneyProgress, TileColor, Tone, ViewAction } from '../../core/views'
import type { LibraryDoc } from './model'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Où en est une étape : faite, en attente, à décider, en échec, à venir. */
export type CircuitStepState = 'done' | 'waiting' | 'decide' | 'failed' | 'later'

/** Une étape du circuit, pour un document. */
export interface CircuitStep {
  id: 'verse' | 'ingerer' | 'analyser' | 'ranger'
  icon: IconName
  state: CircuitStepState
  /** Ce qui s'est passé, ou ce qui bloque (l'erreur, la proposition de l'IA). */
  detail?: string
}

/** Les documents dont on montre les étapes : ceux qui ne sont ni rangés, ni écartés. */
export const inCircuit = (doc: LibraryDoc): boolean => doc.circuit === 'a-classer' || doc.circuit === 'ingere' || doc.circuit === 'analyse' || doc.circuit === 'a-controler'

/** Le rang de l'étape suivante (1 : ingérer, 2 : analyser, 3 : ranger), selon l'état. */
const NEXT: Record<string, number> = { 'a-classer': 1, ingere: 2, analyse: 3, 'a-controler': 3 }

const percent = (value: number | undefined): string => `${Math.round((value ?? 0) * 100)} %`

/** Les quatre étapes d'un document du circuit, et l'état de chacune. */
export function circuitSteps(t: Translate, doc: LibraryDoc, place: (folder: string) => string): CircuitStep[] {
  const next = NEXT[doc.circuit ?? ''] ?? 4
  const ids: CircuitStep['id'][] = ['verse', 'ingerer', 'analyser', 'ranger']
  const icons: IconName[] = ['upload', 'file', 'search', 'folder']
  return ids.map((id, at) => {
    const icon = icons[at]!
    if (at < next) return { id, icon, state: 'done', ...(at === 0 ? { detail: doc.added.slice(0, 10) } : {}) }
    if (at > next) return { id, icon, state: 'later' }
    // L'étape suivante : en échec, à votre décision, ou en attente.
    if (doc.circuitError) return { id, icon, state: 'failed', detail: doc.circuitError }
    if (doc.circuit === 'a-controler') {
      return doc.circuitProposal
        ? { id, icon, state: 'decide', detail: t('bibliotheque.circuit.steps.proposed', { place: place(doc.circuitProposal), confidence: percent(doc.circuitConfidence) }) }
        : { id, icon, state: 'failed', detail: doc.circuitReason || t('bibliotheque.control.noProposal') }
    }
    return { id, icon, state: 'waiting' }
  })
}

const COLOR: Record<CircuitStepState, TileColor> = { done: 'green', waiting: 'orange', decide: 'orange', failed: 'rose', later: 'slate' }
const PROGRESS: Record<CircuitStepState, JourneyProgress> = { done: 'done', waiting: 'current', decide: 'current', failed: 'current', later: 'todo' }
const TONE: Record<CircuitStepState, Tone> = { done: 'success', waiting: 'warning', decide: 'warning', failed: 'danger', later: 'neutral' }

/** Ce que les étapes savent faire : le dossier en mots, continuer le circuit, ouvrir la fiche. */
export interface CircuitStepsDeps {
  place(folder: string): string
  /** Pourquoi on ne peut pas continuer le circuit (pas d'IA, le circuit coupé) ; `null` : on peut. */
  cannotContinue?(): string | null
  /** Continuer le circuit pour ce document (là où il s'est arrêté). */
  continueCircuit?(record: string): Promise<boolean>
  /** Ouvrir la fiche du document. */
  open?(record: string): void
}

/** Le bouton « Continuer le circuit » d'un document (grisé, avec sa raison, si on ne peut pas). */
export function continueAction(t: Translate, deps: CircuitStepsDeps, doc: LibraryDoc): ViewAction | null {
  if (!deps.continueCircuit) return null
  const blocked = deps.cannotContinue?.() ?? null
  return {
    id: 'circuit-continue',
    label: t('bibliotheque.circuit.continue'),
    tooltip: blocked ?? t(doc.circuit === 'a-controler' ? 'bibliotheque.circuit.continue.control.tip' : 'bibliotheque.circuit.continue.tip'),
    icon: 'play',
    primary: true,
    ...(blocked ? { disabled: true } : {}),
    run: async () => {
      await deps.continueCircuit!(doc.record)
    }
  }
}

/**
 * Le parcours d'un document dans le circuit : ses quatre étapes, en couleur, et « Continuer le
 * circuit ». `titled` : son titre (le document, qui ouvre sa fiche) et son état en pastille —
 * pour une liste de documents ; sans : sur la fiche même.
 */
export function circuitJourney(t: Translate, deps: CircuitStepsDeps, doc: LibraryDoc, titled = true, extra: ViewAction[] = []): HomeBlock {
  const steps = circuitSteps(t, doc, deps.place)
  const stuck = steps.find((step) => step.state !== 'done' && step.state !== 'later')
  const action = continueAction(t, deps, doc)
  return {
    kind: 'journey',
    label: t('bibliotheque.circuit.steps.label', { title: doc.title, state: t(`bibliotheque.control.state.${doc.circuit ?? 'a-classer'}`) }),
    ...(titled ? { title: doc.title, ...(deps.open ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => deps.open!(doc.record) } } : {}) } : { title: t('bibliotheque.circuit.steps.title') }),
    badge: { label: t(`bibliotheque.control.state.${doc.circuit ?? 'a-classer'}`), tone: stuck ? TONE[stuck.state] : 'success' },
    stages: steps.map((step, at) => ({
      id: step.id,
      caption: t('bibliotheque.circuit.steps.caption', { n: at + 1 }),
      phases: [
        {
          id: step.id,
          label: t(`bibliotheque.circuit.steps.${step.id}`),
          icon: step.icon,
          color: COLOR[step.state],
          progress: PROGRESS[step.state],
          status: { label: t(`bibliotheque.circuit.steps.state.${step.state}`), tone: TONE[step.state] },
          ...(step.detail ? { detail: step.detail } : {})
        }
      ]
    })),
    ...(titled ? {} : { legend: t('bibliotheque.circuit.steps.legend') }),
    actions: [...(action ? [action] : []), ...extra]
  }
}
