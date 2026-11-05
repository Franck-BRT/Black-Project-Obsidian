// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Trouver les blocs `brt-req` dans une note : quels documents citent une exigence.
 * Comptés depuis le haut : une clôture se ressemble à l'ouverture et à la fermeture, et
 * seule la lecture de celles d'avant dit laquelle on regarde. Une clôture fermante n'a
 * pas de langue et est du même type que l'ouvrante — une note sur le Markdown cite des
 * clôtures comme du texte.
 */

import { parseReqBlock, REQ_BLOCK_LANGUAGES, type ReqBlockSpec } from './block'

const FENCE = /^(\s*)(`{3,}|~{3,})\s*(\S*)\s*$/

export interface FencedBlock {
  /** La ligne de la clôture ouvrante. */
  open: number
  /** La ligne de la clôture fermante, ou la dernière ligne quand le bloc n'est pas fermé. */
  close: number
  closed: boolean
}

/** Tous les blocs `brt-req` d'une note, dans l'ordre. */
export function reqBlockRanges(lines: string[]): FencedBlock[] {
  const found: FencedBlock[] = []
  let open = -1
  let language = ''
  let marker = ''
  for (let i = 0; i < lines.length; i++) {
    const match = FENCE.exec(lines[i]!)
    if (!match) continue
    if (open === -1) {
      open = i
      marker = match[2]![0]!
      language = match[3]!.toLowerCase()
      continue
    }
    if (match[3] !== '' || match[2]![0] !== marker) continue
    if (REQ_BLOCK_LANGUAGES.includes(language)) found.push({ open, close: i, closed: true })
    open = -1
    language = ''
  }
  if (open !== -1 && REQ_BLOCK_LANGUAGES.includes(language)) found.push({ open, close: lines.length - 1, closed: false })
  return found
}

/** Le bloc `brt-req` où se trouve une ligne, s'il y en a un. Les clôtures comptent comme dedans. */
export function reqBlockAt(lines: string[], cursorLine: number): FencedBlock | null {
  return reqBlockRanges(lines).find((block) => cursorLine >= block.open && cursorLine <= block.close) ?? null
}

export function blockBody(lines: string[], block: FencedBlock): string {
  return lines.slice(block.open + 1, block.closed ? block.close : lines.length).join('\n')
}

/** Les identifiants qu'un bloc cite déjà. */
export function idsInBlock(lines: string[], block: FencedBlock): string[] {
  const ids: string[] = []
  for (const line of blockBody(lines, block).split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const at = trimmed.indexOf(':')
    const key = at === -1 ? '' : trimmed.slice(0, at).trim().toLowerCase()
    if (at !== -1 && key !== 'id' && key !== 'ids') continue
    const value = at === -1 ? trimmed : trimmed.slice(at + 1)
    for (const piece of value.split(/[,;]/)) {
      const id = piece.trim()
      if (id) ids.push(id.toUpperCase())
    }
  }
  return ids
}

/** Ce qu'une note demande à la bibliothèque, un élément par bloc. */
export function reqSpecsIn(content: string): ReqBlockSpec[] {
  const lines = content.split('\n')
  return reqBlockRanges(lines).map((block) => parseReqBlock(blockBody(lines, block)))
}
