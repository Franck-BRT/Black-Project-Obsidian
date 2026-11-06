// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Chaque fichier source porte la mention de propriété de Black Room Technologies dans
 * ses premières lignes. Ce contrôle fait échouer `pnpm check` s'il en manque une.
 */

import { existsSync, readFileSync } from 'node:fs'
import { repositoryFiles } from './files.mjs'

const SOURCE = /\.(ts|tsx|mts|mjs|js|css)$/
const IGNORED = new Set(['main.js'])
const NOTICE = /Copyright © \d{4}(?:-\d{4})? Black Room Technologies\. Tous droits réservés\./

const missing = repositoryFiles().filter((file) => {
  if (!SOURCE.test(file) || IGNORED.has(file) || !existsSync(file)) return false
  const head = readFileSync(file, 'utf8').split('\n').slice(0, 6).join('\n')
  return !NOTICE.test(head)
})

if (missing.length > 0) {
  console.error('Mention de propriété absente en tête de :')
  for (const file of missing) console.error(`  ${file}`)
  console.error('Ajoute en première ligne :')
  console.error('  // Copyright © 2026 Black Room Technologies. Tous droits réservés.')
  process.exit(1)
}
console.log('Mention de propriété présente dans tous les fichiers source.')
