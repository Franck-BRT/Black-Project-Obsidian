// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'en-tête YAML d'une note, pour les notes que Black Projects écrit lui-même.
 *
 * Volontairement réduit : des champs `clé: valeur` sur une ligne, valeurs entre
 * guillemets si besoin. C'est tout ce que nos notes contiennent, et le lire à la main
 * évite de dépendre d'un analyseur YAML complet. Une ligne que ce lecteur ne comprend pas
 * (liste, bloc) est gardée telle quelle à la réécriture, jamais perdue.
 */

export interface Frontmatter {
  data: Record<string, string>
  /** Le texte après l'en-tête. */
  body: string
  /** Les lignes de l'en-tête, telles quelles. */
  lines: string[]
}

const FIELD = /^([A-Za-z0-9_-]+):\s*(.*)$/

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replace(/''/g, "'")
  return trimmed
}

export function parseFrontmatter(content: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content)
  if (!match) return { data: {}, body: content, lines: [] }
  const lines = match[1]!.split(/\r?\n/)
  const data: Record<string, string> = {}
  for (const line of lines) {
    const field = FIELD.exec(line)
    if (field) data[field[1]!] = unquote(field[2]!)
  }
  return { data, body: content.slice(match[0].length), lines }
}

/** Une valeur écrite pour qu'elle se relise à l'identique, entre guillemets quand il le faut. */
export function yamlValue(value: string | number): string {
  if (typeof value === 'number') return String(value)
  if (value === '') return '""'
  return /^[\p{L}\p{N}][\p{L}\p{N} ._/-]*$/u.test(value) && !/^(true|false|null|yes|no|~)$/i.test(value) && !/^\d/.test(value)
    ? value
    : JSON.stringify(value)
}

/** Un en-tête complet, champ par champ, dans l'ordre donné. */
export function frontmatter(fields: Readonly<Record<string, string | number>>): string {
  return ['---', ...Object.entries(fields).map(([key, value]) => `${key}: ${yamlValue(value)}`), '---', ''].join('\n')
}

/** Change (ou ajoute) un champ de l'en-tête, sans toucher au reste de la note. */
export function setFrontmatterField(content: string, key: string, value: string | number): string {
  const parsed = parseFrontmatter(content)
  const line = `${key}: ${yamlValue(value)}`
  if (parsed.lines.length === 0 && !/^---\r?\n/.test(content)) return `---\n${line}\n---\n${content}`
  let found = false
  const lines = parsed.lines.map((each) => {
    const field = FIELD.exec(each)
    if (field && field[1] === key) {
      found = true
      return line
    }
    return each
  })
  if (!found) lines.push(line)
  return `---\n${lines.join('\n')}\n---\n${parsed.body}`
}
