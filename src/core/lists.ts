// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **listes en Markdown** : des éléments de liste (lus d'un fichier) écrits comme une
 * liste qu'Obsidian reconnaît — `- ` pour une puce, `1. ` pour un numéro (Markdown numérote
 * lui-même), quatre espaces par niveau —, et les puces tapées dans un texte (« • », « ▪ »,
 * « – »…), qui ne sont pas des listes pour Markdown, changées en `- `.
 */

/** Une puce tapée dans le texte, au début d'une ligne, suivie d'un blanc. */
const TYPED_BULLET = /^(\s*)[•·▪◦‣●○■□►▸➢➤✓✔–—](?:\s+|$)/

/** Un élément de liste en Markdown : sa puce (ou son numéro), en retrait selon son niveau. */
export function listItem(text: string, level = 0, ordered = false): string {
  const own = text
    .replace(TYPED_BULLET, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
  return `${'    '.repeat(Math.max(0, Math.min(level, 8)))}${ordered ? '1.' : '-'} ${own}`
}

/**
 * Dans un texte, les lignes qui commencent par une puce tapée (« • texte ») en éléments de
 * liste Markdown (« - texte »), leur retrait gardé ; hors des blocs de code. Le reste ne
 * change pas.
 */
export function completeLists(text: string): string {
  let code = false
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) code = !code
      if (code) return line
      const typed = TYPED_BULLET.exec(line)
      return typed && line.slice(typed[0].length).trim() ? `${typed[1]}- ${line.slice(typed[0].length).trimEnd()}` : line
    })
    .join('\n')
}
