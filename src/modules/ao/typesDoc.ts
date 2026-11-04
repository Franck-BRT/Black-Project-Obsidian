// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les types de pièces et leurs mots-clés, en tableau Markdown pour la documentation écrite dans le coffre. */

import { PIECE_TYPES } from './pieces'

const cell = (keywords: readonly string[]) => (keywords.length > 0 ? keywords.map((each) => `\`${each}\``).join(', ') : '—')

export function typesMarkdown(t: (key: string) => string): string {
  return [
    `| Type | Pièce | ${t('ao.types.byName')} | ${t('ao.types.byTitle')} |`,
    '| --- | --- | --- | --- |',
    ...PIECE_TYPES.map((each) => `| ${each.code} | ${t(each.labelKey)} | ${cell(each.names)} | ${cell(each.titles)} |`)
  ].join('\n')
}
