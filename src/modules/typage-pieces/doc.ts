// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les types de pièces et leurs mots-clés, en tableau Markdown pour la documentation écrite dans le coffre. */

import { allTypes, isDisabled, NO_CUSTOM_KEYWORDS, typeLabel, type CustomKeywords } from './types'

/** Les mots-clés du module, puis ceux de l'utilisateur, marqués « (ajouté) ». */
function cell(builtIn: readonly string[], custom: Readonly<Record<string, string>>, code: string): string {
  const mine = Object.keys(custom).filter((keyword) => custom[keyword] === code)
  const all = [...builtIn.map((each) => `\`${each}\``), ...mine.map((each) => `\`${each}\` *(ajouté)*`)]
  return all.length > 0 ? all.join(', ') : '—'
}

export function typesMarkdown(
  t: (key: string, vars?: Record<string, string>) => string,
  custom: CustomKeywords = NO_CUSTOM_KEYWORDS
): string {
  return [
    `| Type | Pièce | ${t('typage-pieces.place.label')} | ${t('typage-pieces.types.byName')} | ${t('typage-pieces.types.byTitle')} |`,
    '| --- | --- | --- | --- | --- |',
    ...allTypes(custom).map(
      (each) =>
        `| ${each.code}${each.custom ? ' *(ajouté)*' : ''}${isDisabled(each.code, custom) ? ' *(désactivé)*' : ''} | ${typeLabel(each.code, custom, t)} | ${t(`typage-pieces.place.${each.place}`)} | ${cell(each.names, custom.names, each.code)} | ${cell(each.titles, custom.titles, each.code)} |`
    )
  ].join('\n')
}
