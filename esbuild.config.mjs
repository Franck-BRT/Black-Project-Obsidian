// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { builtinModules } from 'node:module'
import esbuild from 'esbuild'

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

const banner = `/*
 * Black Projects by Black Room Technologies
 * Copyright © 2026 Black Room Technologies. Tous droits réservés.
 * Logiciel propriétaire : toute reproduction ou diffusion non autorisée est interdite.
 */`

const context = await esbuild.context({
  entryPoints: ['src/obsidian/main.ts'],
  bundle: true,
  outfile: 'main.js',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  banner: { js: banner },
  external: [
    'obsidian',
    'electron',
    '@codemirror/*',
    '@lezer/*',
    ...builtinModules,
    ...builtinModules.map((name) => `node:${name}`)
  ],
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  minify: production,
  treeShaking: true,
  legalComments: 'inline'
})

if (watch) {
  await context.watch()
} else {
  await context.rebuild()
  await context.dispose()
}
