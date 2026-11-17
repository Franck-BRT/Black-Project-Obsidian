// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Les liens** d'un document (le circuit des documents, version C — voir
 * `docs/architecture/circuit-des-documents.md`) :
 *
 * - les **candidats**, trouvés sans IA : les entités connues (entreprises, personnes, projets,
 *   autres documents par leur référence…) dont un nom apparaît dans le texte du document ;
 *   l'IA choisit parmi eux, elle n'en invente pas ;
 * - la section **Liens** de la fiche (ses liens, chacun avec sa raison) ;
 * - les **rétroliens** : dans la note citée, une ligne dans une section réservée que
 *   l'application seule écrit — le reste de la note n'est jamais touché.
 *
 * Des fonctions pures.
 */

import { TEXT_START } from './model'

/** Une entité connue, à chercher dans un texte : sa note, son nom en mots, sa sorte, les noms qui la désignent. */
export interface LinkSourceItem {
  path: string
  label: string
  kind: string
  names: readonly string[]
}

/** Un lien possible : l'entité, et le nom par lequel le texte la cite. */
export interface LinkCandidate {
  path: string
  label: string
  kind: string
  found: string
}

/** Un lien d'un document : la note citée, et pourquoi (une phrase). */
export interface DocLink {
  path: string
  why: string
}

const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Un nom assez parlant pour être cherché : trois caractères au moins, pas seulement des chiffres. */
const searchable = (name: string): boolean => name.trim().length >= 3 && !/^\d+$/.test(name.trim())

/**
 * Les liens possibles d'un document : les entités dont un nom apparaît dans son texte (mot entier,
 * sans tenir compte des accents ni des majuscules), sauf le document lui-même ; une fois chacune,
 * dans l'ordre où le texte les cite ; `limit` au plus.
 */
export function findCandidates(text: string, items: readonly LinkSourceItem[], exclude: string, limit = 40): LinkCandidate[] {
  const hay = fold(text)
  const found: (LinkCandidate & { at: number })[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (item.path === exclude || seen.has(item.path)) continue
    let best: { at: number; name: string } | null = null
    for (const name of item.names) {
      if (!searchable(name)) continue
      const match = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(fold(name.trim()))}(?=$|[^\\p{L}\\p{N}])`, 'u').exec(hay)
      if (match && (!best || match.index < best.at)) best = { at: match.index, name: name.trim() }
    }
    if (!best) continue
    seen.add(item.path)
    found.push({ path: item.path, label: item.label, kind: item.kind, found: best.name, at: best.at })
  }
  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map(({ at: _at, ...candidate }) => candidate)
}

/** Le chemin d'un lien rendu par l'IA, parmi les candidats (par son chemin, ou son nom) ; inconnu : `null`. */
export function candidatePath(value: string, candidates: readonly Pick<LinkCandidate, 'path' | 'label'>[]): string | null {
  const wanted = value.replace(/^\[\[|\]\]$/g, '').split('|')[0]!.trim()
  if (!wanted) return null
  const plain = (path: string) => fold(path.replace(/\.md$/, ''))
  const hit = candidates.find((each) => plain(each.path) === plain(wanted) || fold(each.label) === fold(wanted))
  return hit?.path ?? null
}

/** Un lien Obsidian vers une note, avec son texte : `[[chemin|texte]]` (le chemin sans « .md »). */
export const wikiLink = (path: string, label: string): string => `[[${path.replace(/\.md$/, '')}|${label}]]`

/** La fin d'une section : le titre suivant (`#` ou `##`), le texte extrait, ou la fin. */
function sectionBounds(lines: readonly string[], title: string): { at: number; end: number } | null {
  const at = lines.findIndex((each) => each.trim() === title)
  if (at === -1) return null
  let end = lines.findIndex((each, index) => index > at && (/^#{1,2} /.test(each) || each.startsWith(TEXT_START)))
  if (end === -1) end = lines.length
  return { at, end }
}

/**
 * La section des liens de la fiche (`heading`), remplacée par ces lignes (avant le texte extrait,
 * ou à la fin) ; aucune ligne : la section retirée. Le reste de la note ne bouge pas.
 */
export function withLinkSection(body: string, heading: string, lines: readonly string[]): string {
  const title = `## ${heading}`
  const all = body.split('\n')
  const bounds = sectionBounds(all, title)
  const section = lines.length ? [title, '', ...lines.map((line) => `- ${line}`), ''] : []
  if (bounds) {
    all.splice(bounds.at, bounds.end - bounds.at, ...section)
    return all.join('\n').replace(/\n{3,}/g, '\n\n')
  }
  if (!lines.length) return body
  const text = section.join('\n')
  const start = body.indexOf(TEXT_START)
  if (start !== -1) return `${body.slice(0, start).trimEnd()}\n\n${text}\n${body.slice(start)}`
  return `${body.trimEnd()}\n\n${text}`
}

/** Les lignes d'une section (sans leur tiret). */
export function sectionLines(body: string, heading: string): string[] {
  const all = body.split('\n')
  const bounds = sectionBounds(all, `## ${heading}`)
  if (!bounds) return []
  return all
    .slice(bounds.at + 1, bounds.end)
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
}

/** La ligne d'une section qui parle de ce document (son lien `[[chemin` ou `[[chemin|`). */
const mentions = (line: string, record: string): boolean => {
  const target = record.replace(/\.md$/, '')
  return line.includes(`[[${target}|`) || line.includes(`[[${target}]]`) || line.includes(`[[${record}|`) || line.includes(`[[${record}]]`)
}

/**
 * Le rétrolien d'un document dans une note citée : sa ligne dans la section réservée (`heading`,
 * à la fin de la note, créée au besoin) — remplacée si elle y est déjà. Le reste ne bouge pas.
 */
export function withBacklink(content: string, heading: string, record: string, line: string): string {
  const title = `## ${heading}`
  const all = content.split('\n')
  const bounds = sectionBounds(all, title)
  const entry = `- ${line.trim()}`
  if (!bounds) return `${content.trimEnd()}\n\n${title}\n\n${entry}\n`
  const inside = all.slice(bounds.at + 1, bounds.end)
  const existing = inside.findIndex((each) => each.startsWith('- ') && mentions(each, record))
  if (existing !== -1) {
    all[bounds.at + 1 + existing] = entry
    return all.join('\n')
  }
  let last = bounds.end
  while (last > bounds.at + 1 && !all[last - 1]!.trim()) last--
  if (last === bounds.at + 1) all.splice(last, 0, '', entry)
  else all.splice(last, 0, entry)
  return all.join('\n')
}

/** Le rétrolien d'un document retiré de la note citée (la section retirée si elle est vide). */
export function withoutBacklink(content: string, heading: string, record: string): string {
  const title = `## ${heading}`
  const all = content.split('\n')
  const bounds = sectionBounds(all, title)
  if (!bounds) return content
  const kept = all.slice(bounds.at + 1, bounds.end).filter((each) => !(each.startsWith('- ') && mentions(each, record)))
  const left = kept.filter((each) => each.startsWith('- '))
  const replacement = left.length ? [title, ...kept] : []
  all.splice(bounds.at, bounds.end - bounds.at, ...replacement)
  return all.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

/** Le rétrolien d'un document est-il dans la note citée ? */
export function hasBacklink(content: string, heading: string, record: string): boolean {
  return sectionLines(content, heading).some((line) => mentions(line, record))
}
