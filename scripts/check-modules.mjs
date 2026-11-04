// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les frontières du code, vérifiées import par import :
 *
 * - **Un module est une boîte fermée.** Hors de `src/modules/<id>/`, on n'importe que
 *   son `index.ts`, son interface publique. Ce qui est dedans peut alors changer sans
 *   toucher à rien d'autre : pour la lecture de fichiers, par exemple, toute
 *   modification se fait dans `src/modules/lecture-fichiers/` et nulle part ailleurs.
 * - **Le cœur ne dépend d'aucun module.** Ce sont les modules qui s'appuient sur lui.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, relative, sep } from 'node:path'
import { repositoryFiles } from './files.mjs'

const IMPORT = /(?:from\s+|import\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\1/g
const posix = (path) => path.split(sep).join('/')

function resolve(from, specifier) {
  const base = posix(normalize(join(dirname(from), specifier)))
  for (const candidate of [`${base}.ts`, `${base}/index.ts`, base]) if (existsSync(candidate)) return candidate
  return null
}

function moduleOf(path) {
  const found = /^src\/modules\/([^/]+)\//.exec(path)
  return found ? found[1] : null
}

const problems = []
for (const file of repositoryFiles().filter((path) => /\.(ts|mts)$/.test(path))) {
  if (!existsSync(file)) continue
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(IMPORT)) {
    const target = resolve(file, match[2])
    if (!target) continue
    const owner = moduleOf(target)
    if (file.startsWith('src/core/') && owner) {
      problems.push(`${file} : le cœur importe le module « ${owner} » (${match[2]})`)
      continue
    }
    if (owner && moduleOf(file) !== owner && target !== `src/modules/${owner}/index.ts`) {
      problems.push(
        `${file} : importe l'intérieur du module « ${owner} » (${match[2]}) ; passe par src/modules/${owner}/index.ts`
      )
    }
  }
}

if (problems.length > 0) {
  console.error('Frontières de modules franchies :')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('Frontières de modules respectées.')
