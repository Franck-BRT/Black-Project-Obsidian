// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Une exigence en note lisible.
 *
 * L'en-tête est l'enregistrement ; le corps, une politesse. Ouverte dans un Obsidian sans
 * ce plugin, une exigence doit montrer sa formulation plutôt qu'un mur de YAML : chaque
 * formulation est reprise en section, la langue source d'abord, puisque c'est elle qui fait foi.
 */

import { toYaml } from '../../../core/yaml'
import type { Requirement } from './requirement'
import { requirementFrontmatter } from './record'

/** La langue source d'abord, puis les autres par ordre alphabétique : un ordre stable, pour des sauvegardes qui ne bougent pas. */
export function orderedLanguages(requirement: Requirement): string[] {
  const rest = Object.keys(requirement.text)
    .filter((lang) => lang !== requirement.sourceLang)
    .sort((a, b) => a.localeCompare(b))
  return Object.hasOwn(requirement.text, requirement.sourceLang) ? [requirement.sourceLang, ...rest] : rest
}

function generatedBody(requirement: Requirement): string {
  // Sans titre (une exigence extraite d'un tableau, souvent), l'identifiant seul.
  const lines: string[] = [requirement.title.trim() ? `# ${requirement.id} — ${requirement.title}` : `# ${requirement.id}`, '']
  // La trace jusqu'à la pièce d'origine, lisible sans le plugin.
  if (requirement.origin) {
    const where = requirement.origin.locator ? ` — ${requirement.origin.locator}` : ''
    lines.push(`*Origine : ${requirement.origin.piece}${where}*`, '')
  }
  for (const lang of orderedLanguages(requirement)) {
    lines.push(`## ${lang.toUpperCase()}`, '', requirement.text[lang]!.body.trim(), '')
  }
  return lines.join('\n')
}

/**
 * Ce qui reste du corps d'une note une fois retiré ce que le plugin y a écrit. Comparé à
 * l'identique : tout ce que nous n'avons pas écrit nous-mêmes est gardé et réécrit. Au
 * pire un paragraphe en double, jamais un paragraphe perdu.
 */
export function requirementBodyRemainder(body: string, requirement: Requirement): string {
  const generated = generatedBody(requirement).trim()
  const rest = body.trim()
  return generated && rest.startsWith(generated) ? rest.slice(generated.length).trim() : rest
}

/** La note complète : l'en-tête (et les clés d'autres outils, gardées), le corps généré, puis ce que l'utilisateur a ajouté. */
export function serializeRequirement(requirement: Requirement, foreign: Record<string, unknown> = {}, extraBody = ''): string {
  const lines: string[] = ['---', toYaml(requirementFrontmatter(requirement))]
  if (Object.keys(foreign).length) lines.push(toYaml(foreign))
  lines.push('---', '', generatedBody(requirement))
  if (extraBody.trim()) lines.push(extraBody.trim(), '')
  return lines.join('\n')
}
