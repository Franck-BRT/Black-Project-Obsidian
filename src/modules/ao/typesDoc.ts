// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les types de pièces et leurs mots-clés, en tableau Markdown pour la documentation écrite dans le coffre. */

import { NO_CUSTOM_KEYWORDS, PIECE_TYPES, type CustomKeywords } from './pieces'

/** Les mots-clés du module, puis ceux de l'utilisateur, marqués « (ajouté) ». */
function cell(builtIn: readonly string[], custom: Readonly<Record<string, string>>, code: string): string {
  const mine = Object.keys(custom).filter((keyword) => custom[keyword] === code)
  const all = [...builtIn.map((each) => `\`${each}\``), ...mine.map((each) => `\`${each}\` *(ajouté)*`)]
  return all.length > 0 ? all.join(', ') : '—'
}

export function typesMarkdown(t: (key: string) => string, custom: CustomKeywords = NO_CUSTOM_KEYWORDS): string {
  return [
    `| Type | Pièce | ${t('ao.types.byName')} | ${t('ao.types.byTitle')} |`,
    '| --- | --- | --- | --- |',
    ...PIECE_TYPES.map(
      (each) =>
        `| ${each.code} | ${t(each.labelKey)} | ${cell(each.names, custom.names, each.code)} | ${cell(each.titles, custom.titles, each.code)} |`
    )
  ].join('\n')
}
