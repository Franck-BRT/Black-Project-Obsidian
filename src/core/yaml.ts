// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Écrire du YAML lisible, pour les en-têtes de notes qui portent des données structurées
 * (une exigence : ses formulations, ses liens, son historique).
 *
 * L'écriture est la nôtre, pour que le résultat soit stable d'une sauvegarde à l'autre et
 * lisible à la main : style en blocs, clés dans l'ordre donné, chaînes sans guillemets
 * quand c'est sûr, sinon entre guillemets doubles (du JSON, qui est du YAML valide), et
 * les textes sur plusieurs lignes en bloc `|-`. La lecture, elle, est confiée à la
 * plateforme (`Platform.yaml`), qui sait lire tout ce qu'une personne peut écrire.
 */

const RESERVED = /^(true|false|yes|no|on|off|null|~|y|n)$/i

/** Une chaîne qu'on peut écrire sans guillemets et relire à l'identique. */
function plain(value: string): boolean {
  return (
    /^[\p{L}_][\p{L}\p{N} _./()'’-]*$/u.test(value) &&
    !RESERVED.test(value) &&
    !/\s$/.test(value) &&
    !value.includes(': ') &&
    !value.includes(' #')
  )
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const text = String(value)
  if (text === '') return '""'
  return plain(text) ? text : JSON.stringify(text)
}

function key(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) ? name : JSON.stringify(name)
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Un texte sur plusieurs lignes qui peut s'écrire en bloc `|-` et se relire à l'identique. */
function asBlock(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.includes('\n') &&
    !/[\r\t]/.test(value) &&
    !/\s$/.test(value) &&
    !/^\s/.test(value) &&
    !value.split('\n').some((line) => /\s$/.test(line))
  )
}

function block(text: string, pad: string): string[] {
  return text.split('\n').map((line) => (line === '' ? '' : `${pad}  ${line}`))
}

/** Les lignes d'une valeur sous une clé, au niveau `depth`. */
function entry(name: string, value: unknown, depth: number): string[] {
  const pad = '  '.repeat(depth)
  if (value === undefined) return []
  if (asBlock(value)) return [`${pad}${key(name)}: |-`, ...block(value, pad)]
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key(name)}: []`]
    return [`${pad}${key(name)}:`, ...items(value, depth)]
  }
  if (isObject(value)) {
    const fields = Object.entries(value).filter(([, each]) => each !== undefined)
    if (fields.length === 0) return [`${pad}${key(name)}: {}`]
    return [`${pad}${key(name)}:`, ...fields.flatMap(([field, each]) => entry(field, each, depth + 1))]
  }
  return [`${pad}${key(name)}: ${scalar(value)}`]
}

/** Les éléments d'une liste, au niveau `depth` (les tirets alignés sur la clé). */
function items(list: readonly unknown[], depth: number): string[] {
  const pad = '  '.repeat(depth)
  const out: string[] = []
  for (const item of list) {
    if (isObject(item)) {
      const fields = Object.entries(item).filter(([, each]) => each !== undefined)
      if (fields.length === 0) {
        out.push(`${pad}- {}`)
        continue
      }
      // Le premier champ sur la ligne du tiret, les suivants alignés dessous.
      const lines = fields.flatMap(([field, each]) => entry(field, each, depth + 1))
      out.push(`${pad}- ${lines[0]!.trimStart()}`, ...lines.slice(1))
    } else if (Array.isArray(item)) {
      out.push(`${pad}- ${JSON.stringify(item)}`)
    } else if (asBlock(item)) {
      out.push(`${pad}- |-`, ...block(item, pad))
    } else {
      out.push(`${pad}- ${scalar(item)}`)
    }
  }
  return out
}

/** Un objet en YAML, champ par champ dans l'ordre donné ; sans les `---`. */
export function toYaml(data: Readonly<Record<string, unknown>>): string {
  return Object.entries(data)
    .flatMap(([name, value]) => entry(name, value, 0))
    .join('\n')
}

/** Lire du YAML : fourni par la plateforme (Obsidian a le sien ; les tests, une bibliothèque). */
export interface YamlReader {
  /** La valeur lue ; lève une erreur si le texte n'est pas du YAML. */
  parse(text: string): unknown
}

/**
 * L'en-tête d'une note, lu comme un objet ; `null` s'il n'y en a pas ou s'il est
 * illisible. `body` est ce qui suit l'en-tête.
 */
export function readYamlFrontmatter(
  yaml: YamlReader,
  content: string
): { data: Record<string, unknown> | null; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n?---\r?\n?/.exec(content)
  if (!match) return { data: null, body: content }
  const body = content.slice(match[0].length)
  try {
    const parsed = yaml.parse(match[1] ?? '')
    return { data: isObject(parsed) ? parsed : parsed === null ? {} : null, body }
  } catch {
    return { data: null, body }
  }
}
