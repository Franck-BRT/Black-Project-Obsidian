// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import tseslint from 'typescript-eslint'

/**
 * Ce qui ne doit jamais entrer dans le cœur ni dans la logique des modules : la
 * plateforme. C'est la règle qui garde possible l'application de bureau, qui fournira
 * ses propres implémentations des ports à la place de celles d'Obsidian.
 */
const PLATFORM_IMPORTS = {
  paths: [
    { name: 'obsidian', message: 'Le cœur est indépendant de la plateforme : passe par un port (src/core/ports.ts).' },
    { name: 'electron', message: 'Le cœur est indépendant de la plateforme : passe par un port (src/core/ports.ts).' }
  ],
  patterns: [
    {
      group: ['node:*', 'fs', 'fs/*', 'path', 'os', 'child_process', 'crypto', 'http', 'https', 'net'],
      message: 'Pas de module Node dans le cœur : passe par un port (src/core/ports.ts).'
    },
    {
      group: ['**/obsidian/**', '**/obsidian', '!obsidian'],
      message: "Le cœur et les modules ne dépendent jamais de l'adaptateur Obsidian."
    }
  ]
}

export default tseslint.config(
  { ignores: ['main.js', 'node_modules/**', 'coverage/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }]
    }
  },
  {
    files: ['src/core/**/*.ts', 'src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', PLATFORM_IMPORTS]
    }
  }
)
