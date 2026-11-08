// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Relire avec l'IA les exigences d'un dossier : les plus faibles cochées d'avance, chacune
 * relue — un avis, ce que les règles ne voient pas, des reformulations — et la relecture
 * écrite dans sa note. Notées sur leur seule rédaction, comme dans le rapport de qualité.
 *
 * Côté émetteur, une reformulation peut être retenue (ce sont nos exigences) ; côté
 * candidat, elle reste dans la note : de quoi rédiger une question à l'acheteur.
 */

import { choosePersona } from '../bibliotheque'
import type { AiClient } from '../ia'
import { assessRequirement, requirementLanguages, reviewRequirement, sessionAt, stars } from '../exigences'
import type { Notifier, Ui } from '../../core/ports'
import { requirementsFolder } from './requirements'
import type { Analysis, Position } from './notes'
import type { Services } from './service'

/** Au-delà, la série serait longue : on en coche d'avance au plus autant. */
const PRESELECT = 10

/** Cochées d'avance : les faibles (moins de trois étoiles) ; s'il n'y en a pas, celles qui ne sont pas parfaites. */
export function preselected(rated: readonly { path: string; stars: number }[]): string[] {
  const weak = rated.filter((each) => each.stars < 3)
  return (weak.length ? weak : rated.filter((each) => each.stars < 5)).slice(0, PRESELECT).map((each) => each.path)
}

export interface ReviewRun {
  reviewed: number
  rewritten: number
  failed: boolean
}

export async function reviewAnalysisRequirements(
  services: Services,
  window: { ui: Ui; notifier: Notifier },
  client: AiClient,
  analysis: Analysis,
  position: Position
): Promise<ReviewRun | null> {
  const { t } = services
  const session = sessionAt(requirementsFolder(analysis), window.ui, window.notifier)
  const languages = requirementLanguages()
  const rated = (await session.store.all())
    .filter((requirement) => requirement.filePath)
    .map((requirement) => ({ requirement, report: assessRequirement(requirement, languages, 'wording') }))
    .sort((a, b) => a.report.score - b.report.score)
  if (rated.length === 0) {
    window.notifier.notify(t('ao.review.none'), 8000)
    return null
  }
  const chosen = await window.ui.pickMany({
    title: t('ao.review.pick.title', { name: analysis.name }),
    intro: t(position === 'emetteur' ? 'ao.review.pick.intro.emetteur' : 'ao.review.pick.intro.candidat'),
    choices: rated.map(({ requirement, report }) => ({
      value: requirement.filePath!,
      label: `${stars(report.stars)} ${requirement.id} — ${requirement.title}`,
      description: `${Math.round(report.score * 100)} %`
    })),
    selected: preselected(rated.map(({ requirement, report }) => ({ path: requirement.filePath!, stars: report.stars }))),
    submit: t('ao.review.pick.submit')
  })
  if (!chosen || chosen.length === 0) return null
  // Qui relit (la bibliothèque de personas, s'il y en a) : une fois pour toute la série.
  const persona = await choosePersona(window.ui)
  if (persona === undefined) return null
  const run: ReviewRun = { reviewed: 0, rewritten: 0, failed: false }
  for (const [index, path] of chosen.entries()) {
    window.notifier.notify(t('ao.review.progress', { index: index + 1, total: chosen.length }), 3000)
    const outcome = await reviewRequirement(session, client, path, services.today(), {
      scope: 'wording',
      offerRewrite: position === 'emetteur',
      quiet: true,
      persona
    })
    if (outcome === 'failed') {
      run.failed = true
      break
    }
    if (outcome !== 'none') run.reviewed++
    if (outcome === 'rewritten') run.rewritten++
  }
  return run
}
