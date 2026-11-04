// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les types de pièces d'un dossier de consultation, et leur reconnaissance.
 *
 * D'abord par le nom du fichier — c'est là que les acheteurs l'écrivent, « 02_CCTP_v3.pdf »
 * —, puis, si le nom ne dit rien, par le titre en tête du texte. L'utilisateur corrige
 * ensuite ce qui a été mal deviné : la reconnaissance propose, elle ne décide pas.
 */

export interface PieceType {
  readonly code: string
  /** Clé du libellé long : « Cahier des clauses techniques particulières ». */
  readonly labelKey: string
  /** Motifs cherchés dans le nom, sans accents, en minuscules, séparateurs en espaces. */
  readonly names: readonly RegExp[]
  /** Motifs cherchés dans le début du texte, quand le nom ne dit rien. */
  readonly titles: readonly RegExp[]
}

const type = (code: string, names: RegExp[], titles: RegExp[] = []): PieceType => ({
  code,
  labelKey: `ao.piece.${code.toLowerCase()}`,
  names,
  titles
})

/** Dans l'ordre où ils sont essayés : le plus précis d'abord. */
export const PIECE_TYPES: readonly PieceType[] = [
  type('AVIS', [/\baapc\b/, /avis d appel/, /avis de marche/, /\bboamp\b/], [/avis d appel public/, /avis de marche/]),
  type('RC', [/\brc\b/, /reglement (de la |du )?consultation/, /\brdc\b/], [/reglement (de la |du )?consultation/]),
  type('AE', [/\bae\b/, /acte d ?engagement/, /\batti\b/], [/acte d engagement/]),
  type('CCAP', [/\bccap\b/, /clauses administratives particulieres/], [/clauses administratives particulieres/]),
  type('CCAG', [/\bccag\b/, /clauses administratives generales/], [/clauses administratives generales/]),
  type(
    'CCTP',
    [
      /\bcctp\b/,
      /clauses techniques particulieres/,
      /cahier des charges/,
      /\bcdc\b/,
      /\bstb\b/,
      /specifications? techniques?/,
      /expression (fonctionnelle )?des besoins/,
      /\bsow\b/,
      /statement of work/
    ],
    [/clauses techniques particulieres/, /cahier des charges/, /specification technique de besoin/, /statement of work/]
  ),
  type('CCTG', [/\bcctg\b/, /clauses techniques generales/], [/clauses techniques generales/]),
  type('BPU', [/\bbpu\b/, /bordereau (des )?prix/], [/bordereau (des )?prix/]),
  type('DPGF', [/\bdpgf\b/, /decomposition (du )?prix global/], [/decomposition (du )?prix global/]),
  type('DQE', [/\bdqe\b/, /detail quantitatif/], [/detail quantitatif/]),
  type('MEMOIRE', [/cadre de (reponse|memoire)/, /memoire technique/, /\bcrt\b/, /\bcmt\b/], [/cadre de (reponse|memoire)/, /memoire technique/]),
  type('FORMULAIRE', [/\bdc ?[1-4]\b/, /\bdume\b/, /formulaire/, /attestation/, /declaration sur l honneur/]),
  type('QR', [/questions? (et )?reponses?/, /\bfaq\b/, /\bq ?r\b/], [/questions? (et )?reponses?/]),
  type('PLANNING', [/planning/, /calendrier/, /\bgantt\b/]),
  type('ANNEXE', [/\bannexe/, /\bappendix\b/, /\bapp \d/]),
  type('AUTRE', [])
]

export const OTHER = 'AUTRE'

export function pieceType(code: string): PieceType {
  return PIECE_TYPES.find((each) => each.code === code) ?? PIECE_TYPES[PIECE_TYPES.length - 1]!
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

/**
 * Le type d'une pièce, d'après le nom de son fichier (sans le chemin ni l'extension) et
 * le début de son texte s'il est connu.
 */
export function classifyPiece(fileName: string, text = ''): string {
  const base = fileName.slice(fileName.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '')
  const name = fold(base)
  for (const each of PIECE_TYPES) if (each.names.some((pattern) => pattern.test(name))) return each.code
  const head = fold(text.slice(0, 1500))
  if (head) for (const each of PIECE_TYPES) if (each.titles.some((pattern) => pattern.test(head))) return each.code
  return OTHER
}
