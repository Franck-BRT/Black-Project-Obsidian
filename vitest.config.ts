// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      // Les pages de documentation (*.md) importées comme du texte, comme au build.
      name: 'markdown-text',
      transform(code, id) {
        return id.endsWith('.md') ? { code: `export default ${JSON.stringify(code)}`, map: null } : null
      }
    }
  ],
  // L'interface (src/ui) est écrite en JSX pour Preact, comme au build.
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.ts'],
    environment: 'node'
  }
})
