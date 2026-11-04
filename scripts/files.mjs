// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les fichiers du dépôt : suivis par git, ou nouveaux et non ignorés. */

import { execFileSync } from 'node:child_process'

export function repositoryFiles() {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8'
  })
  return [...new Set(output.split('\0').filter(Boolean))].sort()
}
