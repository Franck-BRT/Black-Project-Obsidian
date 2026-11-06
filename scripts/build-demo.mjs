// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La démonstration hors d'Obsidian (demo/) : la même interface, les vrais modules, un
 * coffre en mémoire. Produit demo/dist/index.html et demo/dist/demo.js, à ouvrir dans un
 * navigateur.
 */

import { copyFileSync, mkdirSync } from 'node:fs'
import esbuild from 'esbuild'

mkdirSync('demo/dist', { recursive: true })
await esbuild.build({
  entryPoints: ['demo/main.tsx'],
  bundle: true,
  outfile: 'demo/dist/demo.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  loader: { '.md': 'text' },
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: true,
  logLevel: 'info'
})
copyFileSync('demo/index.html', 'demo/dist/index.html')
