// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Black Projects est un projet Black Room Technologies à part entière. Aucune référence
 * à un projet tiers d'origine ne doit y entrer, ni le nom d'un outil propre à un client :
 * ni dans le code, ni dans la doc, ni dans la configuration. Ce contrôle fait échouer `pnpm check` à la première.
 *
 * Les termes sont écrits en morceaux pour que ce fichier ne se signale pas lui-même.
 */

import { existsSync, readFileSync } from 'node:fs'
import { repositoryFiles } from './files.mjs'

const FORBIDDEN = [
  ['dot', 'pm'],
  ['obsidian', '-pm'],
  ['kropa', 'chev'],
  ['project', '-manager'],
  ['buymea', 'coffee'],
  // Le nom d'un serveur d'IA propre à un client : Black Projects se connecte au serveur
  // d'IA de chaque entreprise, sans en nommer aucun.
  ['sido', 'nie']
].map((parts) => parts.join(''))

const pattern = new RegExp(FORBIDDEN.map((term) => term.replace(/[-]/g, '\\-')).join('|'), 'gi')

const problems = []
for (const file of repositoryFiles()) {
  if (!existsSync(file)) continue
  const buffer = readFileSync(file)
  if (buffer.includes(0)) continue
  const lines = buffer.toString('utf8').split('\n')
  lines.forEach((line, index) => {
    for (const match of line.matchAll(pattern)) problems.push(`${file}:${index + 1} : « ${match[0]} »`)
  })
  for (const term of FORBIDDEN) {
    if (file.toLowerCase().includes(term)) problems.push(`${file} : nom de fichier contenant « ${term} »`)
  }
}

if (problems.length > 0) {
  console.error('Références interdites trouvées :')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('Aucune référence interdite.')
