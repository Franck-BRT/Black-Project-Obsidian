// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les exigences d'un dossier de consultation : extraites d'une pièce (le CCTP, surtout),
 * rangées dans le dossier `Exigences` de l'analyse, et tracées dans les deux sens — chaque
 * exigence nomme sa pièce et l'endroit où elle a été trouvée ; la note de la pièce liste
 * ses exigences ; la note de l'analyse les tient toutes dans un tableau.
 *
 * L'extraction elle-même, l'aperçu et l'écriture sont ceux du module Exigences.
 */

import type { Notifier, Ui } from '../../core/ports'
import {
  canExtract,
  extractRequirements,
  previewImport,
  requirementLanguages,
  requirementsAt,
  type ImportReport,
  type Requirement
} from '../exigences'
import { extensionOf } from '../lecture-fichiers'
import { REQUIREMENTS, wikiLink, type Analysis } from './notes'
import { pieceAt, type Services } from './service'

export const REQUIREMENTS_START = '<!-- bp:exigences:debut — tenu à jour par Black Projects ; ne pas modifier entre ces marques -->'
export const REQUIREMENTS_END = '<!-- bp:exigences:fin -->'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export function requirementsFolder(analysis: Analysis): string {
  return `${analysis.folder}/${REQUIREMENTS}`
}

const excerpt = (text: string, size = 140) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > size ? `${flat.slice(0, size - 1)}…` : flat
}

const wordingOf = (requirement: Requirement) =>
  requirement.text[requirement.sourceLang]?.body ?? Object.values(requirement.text)[0]?.body ?? requirement.title

/** Une cellule de tableau Markdown : les « | » des liens échappés, sur une ligne. */
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ')

/** Le chemin de note qu'un lien `[[chemin|libellé]]` désigne, `.md` compris. */
/** La note qu’un lien Obsidian désigne (« [[Pièces/CCTP|CCTP]] » → « Pièces/CCTP.md ») ; « » si ce n’en est pas un. */
export function linkedNote(link: string): string {
  const inner = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/.exec(link.trim())
  if (!inner) return ''
  const target = inner[1]!.trim()
  return target.endsWith('.md') ? target : `${target}.md`
}

/** Remplace une partie tenue entre ses marques ; l'insère avant `before` (un titre), ou en fin de note. */
export function withSection(note: string, content: string, before?: RegExp): string {
  const start = note.indexOf(REQUIREMENTS_START)
  const end = note.indexOf(REQUIREMENTS_END)
  const block = `${REQUIREMENTS_START}\n${content}\n${REQUIREMENTS_END}`
  if (start !== -1 && end > start) return note.slice(0, start) + block + note.slice(end + REQUIREMENTS_END.length)
  const at = before ? note.search(before) : -1
  if (at !== -1) return `${note.slice(0, at)}${block}\n\n${note.slice(at)}`
  return `${note.trimEnd()}\n\n${block}\n`
}

/** La liste des exigences d'une pièce, pour sa note. */
export function pieceRequirements(requirements: readonly Requirement[], t: Translate): string {
  if (requirements.length === 0) return `*${t('ao.req.pieceNone')}*`
  return [
    `## ${t('ao.req.pieceTitle', { count: requirements.length })}`,
    '',
    ...requirements.map((requirement) => {
      const where = requirement.origin?.locator ? ` *(${requirement.origin.locator})*` : ''
      return `- ${wikiLink(requirement.filePath ?? '', requirement.id)} — ${excerpt(wordingOf(requirement))}${where}`
    })
  ].join('\n')
}

/** Le tableau des exigences de l'analyse, pour sa note : chaque exigence, sa pièce, l'endroit. */
export function analysisRequirements(requirements: readonly Requirement[], t: Translate): string {
  if (requirements.length === 0) return `*${t('ao.req.none')}*`
  return [
    t('ao.req.count', { count: requirements.length }),
    '',
    `| ${t('ao.req.column.id')} | ${t('ao.req.column.text')} | ${t('ao.req.column.piece')} | ${t('ao.req.column.where')} |`,
    '| --- | --- | --- | --- |',
    ...requirements.map(
      (requirement) =>
        `| ${cell(wikiLink(requirement.filePath ?? '', requirement.id))} | ${cell(excerpt(wordingOf(requirement)))} | ${cell(
          requirement.origin?.piece ?? '—'
        )} | ${cell(requirement.origin?.locator || '—')} |`
    )
  ].join('\n')
}

/** Réécrit les exigences de l'analyse dans sa note, et la liste de chaque pièce dans la sienne. */
export async function refreshRequirements(services: Services, analysis: Analysis): Promise<Requirement[]> {
  const { fs, t } = services
  const requirements = await requirementsAt(requirementsFolder(analysis)).all()
  if (await fs.exists(analysis.note)) {
    const note = await fs.readText(analysis.note)
    // Avant les notes de l'utilisateur, après le tableau des pièces.
    const updated = withSection(note, `## ${t('ao.req.title')}\n\n${analysisRequirements(requirements, t)}`, /^## Notes\s*$/m)
    if (updated !== note) await fs.writeText(analysis.note, updated)
  }
  const byPiece = new Map<string, Requirement[]>()
  for (const requirement of requirements) {
    const piece = requirement.origin ? linkedNote(requirement.origin.piece) : ''
    if (piece) byPiece.set(piece, [...(byPiece.get(piece) ?? []), requirement])
  }
  for (const [piece, list] of byPiece) {
    if (!(await fs.exists(piece))) continue
    const note = await fs.readText(piece)
    // Avant le texte extrait : la liste se voit en ouvrant la pièce.
    const updated = withSection(note, pieceRequirements(list, t), /^## /m)
    if (updated !== note) await fs.writeText(piece, updated)
  }
  return requirements
}

export interface Extract {
  ui: Ui
  notifier: Notifier
}

/**
 * Extraire les exigences d'une pièce : lire son fichier, montrer ce que l'import ferait,
 * écrire ce qui est accepté dans les exigences de l'analyse, puis tenir à jour la note de
 * la pièce et celle de l'analyse. Rend le rapport, ou `null`.
 */
export async function extractFromPiece(services: Services, window: Extract, note: string): Promise<ImportReport | null> {
  const { fs, t } = services
  const piece = await pieceAt(services, note)
  if (!piece) {
    window.notifier.notify(t('ao.type.notPiece'), 6000)
    return null
  }
  const name = piece.original.slice(piece.original.lastIndexOf('/') + 1)
  const extension = extensionOf(name)
  if (!canExtract(extension)) {
    window.notifier.notify(t('ao.req.unsupported', { name }), 8000)
    return null
  }
  if (!(await fs.exists(piece.original))) {
    window.notifier.notify(t('ao.req.missingFile', { path: piece.original }), 8000)
    return null
  }
  const extraction = await extractRequirements(extension, new Uint8Array(await fs.readBinary(piece.original)), requirementLanguages())
  const report = await previewImport({
    ui: window.ui,
    notifier: window.notifier,
    t,
    store: requirementsAt(requirementsFolder(piece.analysis)),
    extraction,
    name,
    extension,
    // Les exigences sans identifiant sont numérotées sous le type de la pièce : REQ-CCTP-0001.
    category: piece.type,
    piece: wikiLink(note, note.slice(note.lastIndexOf('/') + 1).replace(/\.md$/, ''))
  })
  if (report) await refreshRequirements(services, piece.analysis)
  return report
}
