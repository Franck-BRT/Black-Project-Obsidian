// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les types de pièces d'un dossier de consultation, et leur reconnaissance.
 *
 * D'abord par le nom du fichier — c'est là que les acheteurs l'écrivent, « 02_CCTP_v3.pdf »
 * —, puis, si le nom ne dit rien, par le titre en tête du texte. L'utilisateur corrige
 * ensuite ce qui a été mal deviné : la reconnaissance propose, elle ne décide pas.
 *
 * Les mots-clés sont écrits comme un utilisateur les lit, et c'est d'eux que la
 * reconnaissance est tirée : la fenêtre « Fonctions » et la documentation montrent
 * exactement ce que le code cherche. Un mot-clé est cherché comme mot entier, sans tenir
 * compte des accents, de la casse ni de la ponctuation (« CCTP_v3 », « cctp-v3 » et
 * « CCTP v3 » se valent) ; terminé par « … », il vaut aussi pour les mots qui le
 * prolongent (« annexe… » trouve « annexes »).
 */

export interface PieceType {
  readonly code: string
  /** Clé du libellé long : « Cahier des clauses techniques particulières ». */
  readonly labelKey: string
  /** Le libellé tel quel, pour un type ajouté par l'utilisateur (sa clé est alors générique). */
  readonly label?: string
  /** Ajouté par l'utilisateur. */
  readonly custom?: boolean
  /** Les mots-clés cherchés dans le nom du fichier. */
  readonly names: readonly string[]
  /** Les mots-clés cherchés dans le début du texte, quand le nom ne dit rien. */
  readonly titles: readonly string[]
}

const type = (code: string, names: string[], titles: string[] = []): PieceType => ({
  code,
  labelKey: `ao.piece.${code.toLowerCase()}`,
  names,
  titles
})

/** Dans l'ordre où ils sont essayés : le plus précis d'abord ; le premier qui correspond l'emporte. */
export const PIECE_TYPES: readonly PieceType[] = [
  type('AVIS', ['AAPC', 'avis d’appel', 'avis de marché', 'BOAMP'], ['avis d’appel public', 'avis de marché']),
  type(
    'RC',
    ['RC', 'RDC', 'règlement de consultation', 'règlement de la consultation'],
    ['règlement de la consultation', 'règlement de consultation']
  ),
  type('AE', ['AE', 'ATTRI1', 'acte d’engagement'], ['acte d’engagement']),
  type('CCAP', ['CCAP', 'clauses administratives particulières'], ['clauses administratives particulières']),
  type('CCAG', ['CCAG', 'clauses administratives générales'], ['clauses administratives générales']),
  type(
    'CCTP',
    [
      'CCTP',
      'clauses techniques particulières',
      'cahier des charges',
      'CDC',
      'STB',
      'spécification technique',
      'spécifications techniques',
      'expression des besoins',
      'expression fonctionnelle des besoins',
      'SOW',
      'statement of work'
    ],
    ['clauses techniques particulières', 'cahier des charges', 'spécification technique de besoin', 'statement of work']
  ),
  type('CCTG', ['CCTG', 'clauses techniques générales'], ['clauses techniques générales']),
  type('BPU', ['BPU', 'bordereau des prix', 'bordereau de prix'], ['bordereau des prix', 'bordereau de prix']),
  type(
    'DPGF',
    ['DPGF', 'décomposition du prix global', 'décomposition prix global'],
    ['décomposition du prix global', 'décomposition prix global']
  ),
  type('DQE', ['DQE', 'détail quantitatif'], ['détail quantitatif']),
  type(
    'MEMOIRE',
    ['cadre de réponse', 'cadre de mémoire', 'mémoire technique', 'CRT', 'CMT'],
    ['cadre de réponse', 'cadre de mémoire', 'mémoire technique']
  ),
  type('FORMULAIRE', ['DC1', 'DC2', 'DC3', 'DC4', 'DUME', 'formulaire…', 'attestation…', 'déclaration sur l’honneur']),
  type(
    'QR',
    ['questions réponses', 'questions et réponses', 'question réponse', 'FAQ', 'Q/R', 'QR'],
    ['questions et réponses', 'questions réponses']
  ),
  type('PLANNING', ['planning', 'calendrier', 'Gantt']),
  type('ANNEXE', ['annexe…', 'appendix']),
  type('AUTRE', [])
]

export const OTHER = 'AUTRE'

export function pieceType(code: string, custom: CustomKeywords = NO_CUSTOM_KEYWORDS): PieceType {
  return allTypes(custom).find((each) => each.code === code) ?? PIECE_TYPES[PIECE_TYPES.length - 1]!
}

/**
 * Tous les types : ceux du module, puis ceux de l'utilisateur, puis « autre pièce », qui
 * reste le dernier. Le code d'un type ajouté est aussi son premier mot-clé de nom : un
 * type « PAQ » reconnaît « PAQ_v2.pdf » sans rien de plus.
 */
export function allTypes(custom: CustomKeywords = NO_CUSTOM_KEYWORDS): PieceType[] {
  const builtIn = PIECE_TYPES.filter((each) => each.code !== OTHER)
  const added = Object.entries(custom.types)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, label]): PieceType => ({ code, labelKey: 'ao.types.customLabel', label, names: [code], titles: [], custom: true }))
  return [...builtIn, ...added, PIECE_TYPES[PIECE_TYPES.length - 1]!]
}

export function isDisabled(code: string, custom: CustomKeywords = NO_CUSTOM_KEYWORDS): boolean {
  return code !== OTHER && (custom.disabled ?? []).includes(code)
}

/** Les types qui peuvent être reconnus et proposés : tous, sauf ceux que l'utilisateur a désactivés. */
export function activeTypes(custom: CustomKeywords = NO_CUSTOM_KEYWORDS): PieceType[] {
  return allTypes(custom).filter((each) => !isDisabled(each.code, custom))
}

/** Le libellé d'un type, ajouté ou non ; un code qui n'est plus un type est montré tel quel. */
export function typeLabel(code: string, custom: CustomKeywords, t: (key: string, vars?: Record<string, string>) => string): string {
  const type = allTypes(custom).find((each) => each.code === code)
  if (!type) return t('ao.types.removed', { code })
  return type.label ?? t(type.labelKey)
}

/** Sans accents, en minuscules, la ponctuation et les séparateurs ramenés à des espaces. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const PREFIX = '…'

/** Le mot-clé se trouve-t-il, comme mot entier (ou début de mot s'il finit par « … »), dans un texte déjà replié ? */
export function keywordIn(keyword: string, folded: string): boolean {
  const prefix = keyword.endsWith(PREFIX)
  const phrase = fold(prefix ? keyword.slice(0, -PREFIX.length) : keyword)
  if (!phrase) return false
  const padded = ` ${folded} `
  if (!prefix) return padded.includes(` ${phrase} `)
  return padded.includes(` ${phrase}`)
}

/**
 * Les mots-clés ajoutés par l'utilisateur, chacun vers un type : ceux du nom du fichier,
 * ceux du titre du document.
 */
export interface CustomKeywords {
  readonly names: Readonly<Record<string, string>>
  readonly titles: Readonly<Record<string, string>>
  /** Les types ajoutés par l'utilisateur : code → libellé. */
  readonly types: Readonly<Record<string, string>>
  /** Les types désactivés : ni reconnus ni proposés ; les pièces qui les ont les gardent. */
  readonly disabled?: readonly string[]
}

export const NO_CUSTOM_KEYWORDS: CustomKeywords = { names: {}, titles: {}, types: {} }

function customMatch(keywords: Readonly<Record<string, string>>, folded: string, custom: CustomKeywords): string | null {
  for (const [keyword, code] of Object.entries(keywords)) {
    if (!isDisabled(code, custom) && keywordIn(keyword, folded)) return code
  }
  return null
}

/**
 * Le type d'une pièce, d'après le nom de son fichier (sans le chemin ni l'extension) et
 * le début de son texte s'il est connu.
 *
 * Dans cet ordre : les mots-clés de l'utilisateur pour le nom, ceux du module pour le
 * nom, puis ceux de l'utilisateur pour le titre, ceux du module pour le titre. Les mots de
 * l'utilisateur passent devant : ils disent ce qu'il sait de ses propres dossiers.
 */
export function classifyPiece(fileName: string, text = '', custom: CustomKeywords = NO_CUSTOM_KEYWORDS): string {
  const base = fileName.slice(fileName.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '')
  const name = fold(base)
  const byName = customMatch(custom.names, name, custom)
  if (byName) return byName
  // Un type désactivé n'est plus reconnu, ni par ses mots-clés ni par ceux de l'utilisateur.
  const types = activeTypes(custom)
  for (const each of types) if (each.names.some((keyword) => keywordIn(keyword, name))) return each.code
  const head = fold(text.slice(0, 1500))
  if (!head) return OTHER
  const byTitle = customMatch(custom.titles, head, custom)
  if (byTitle) return byTitle
  for (const each of types) if (each.titles.some((keyword) => keywordIn(keyword, head))) return each.code
  return OTHER
}
