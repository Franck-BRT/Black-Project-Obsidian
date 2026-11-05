// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La qualité des exigences d'un dossier de consultation (étape 5) : combien, la répartition
 * des notes, les défauts les plus fréquents, les doublons probables, les exigences non
 * vérifiables, les plus faibles. Hors ligne, sans IA. Les exigences sont notées sur leur
 * seule rédaction : elles sont de l'acheteur, et n'ont chez nous ni responsable ni liens.
 *
 * Les règles et le rapport sont ceux du module Exigences ; l'AO choisit les exigences (celles
 * de l'analyse) et où va le rapport : `Analyse/Qualité des exigences.md`.
 */

import { assessAll, qualityMarkdown, requirementLanguages, requirementsAt, withQuality, type QualityRun } from '../exigences'
import { ANALYSIS, wikiLink, type Analysis } from './notes'
import { requirementsFolder } from './requirements'
import type { Services } from './service'

export function qualityPath(analysis: Analysis): string {
  return `${analysis.folder}/${ANALYSIS}/Qualité des exigences.md`
}

/** Analyse les exigences de l'analyse et écrit le rapport ; rend les notes calculées. */
export async function analyseQuality(services: Services, analysis: Analysis): Promise<QualityRun[]> {
  const { fs, t } = services
  const languages = requirementLanguages()
  const runs = assessAll(await requirementsAt(requirementsFolder(analysis)).all(), languages, 'wording')
  const content = qualityMarkdown(runs, {
    t,
    scope: 'wording',
    languages,
    date: services.today(),
    link: (requirement) => (requirement.filePath ? wikiLink(requirement.filePath, requirement.id) : requirement.id)
  })
  const path = qualityPath(analysis)
  const existing = (await fs.exists(path)) ? await fs.readText(path) : null
  const title = t('ao.quality.title', { name: analysis.name })
  const intro = `${t('exigences.quality.intro')} ${t('ao.quality.date', { date: services.today() })}`
  await fs.writeText(path, withQuality(existing, title, intro, content, t('ao.note.notes')))
  return runs
}
