// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **lecture d'un document par l'IA**, ses briques sans IA : ce qui se décide sur le texte
 * seul, sûrement et sans rien coûter.
 *
 * - **Faut-il l'OCR ?** Une page qui porte moins de quelques lignes de texte est une image
 *   (un scan, un plan exporté) : son texte est à lire.
 * - **Une lecture est-elle entière ?** Comparée au texte que le fichier porte pour la page :
 *   moins de 70 % de ses lettres, elle en a perdu.
 * - **Le nettoyage** : les lignes que les pages répètent (titre courant, pied de page, numéro
 *   de page) retirées ; les numéros de page seuls en haut ou en bas d'une page aussi ; les
 *   lignes coupées au milieu d'une phrase recollées (un mot coupé d'un tiret, reformé) ; les
 *   lignes vides en trop ôtées.
 * - **La qualité** : la note de chaque page (ou partie), pesée par sa longueur, en
 *   pourcentage ; et en étoiles, sur cinq.
 */

import { isImage } from '../lecture-fichiers'
import type { AiClient } from './client'
import { LlmError } from './protocol'

/** Les lettres d'un texte : ce qu'une page porte, quelle que soit sa mise en page. */
export const letterCount = (text: string): number => (text.match(/\p{L}/gu) ?? []).length

/** Une page dont le texte tient en moins de ~80 lettres : une image, dont le texte est à lire (l'OCR). */
export const needsOcr = (text: string): boolean => letterCount(text.replace(/^#+ .*$/gm, '')) < 80

/**
 * Une lecture qui tient ce que la page porte, d'après le texte du fichier pour elle : au moins
 * 70 % de ses lettres. Une page qui n'en porte presque pas (moins de 200) n'est pas jugée.
 */
export function readsWhole(reading: string, reference: string): boolean {
  const own = letterCount(reference)
  return own < 200 || letterCount(reading) >= 0.7 * own
}

/** Sans accents ni majuscules : ce par quoi une ligne se reconnaît d'une page à l'autre. */
const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Un numéro de page, seul sur sa ligne : « 12 », « - 12 - », « Page 3 », « 3/19 », « Page 3 sur 19 ». */
const PAGE_NUMBER = /^[\s\-–—|*_]*(?:(?:page|p\.)\s*)?\d{1,4}(?:\s*(?:\/|sur|of|de)\s*\d{1,4})?[\s\-–—|*_]*$/i

/**
 * Une référence de document suivie de son numéro de page (« AG 1 100v2 – 5 », « Doc. AG 1 100v2 – 2 ») :
 * courte, des chiffres surtout, un mot au plus de trois lettres et plus, la page après un tiret
 * (« Article 1.2.3 » n'en est pas une).
 */
const pageLike = (bare: string): boolean =>
  bare.length <= 32 && (bare.match(/\d/g) ?? []).length >= 3 && (bare.match(/\p{L}{3,}/gu) ?? []).length <= 1 && /\d.*\s[–—-]\s*\d{1,4}\W*$/u.test(bare)

/** Combien de lignes, en haut et en bas d'une page, sont la place des en-têtes et des pieds. */
const ZONE = 3

/**
 * Ce par quoi une ligne est reconnue d'une page à l'autre ; `null` si elle ne peut pas être un
 * en-tête ni un pied de page : un tableau, une formule, une image décrite, un mot ou deux.
 * Une ligne qui a l'air d'un numéro de page (« 12 », « Page 3 sur 19 », « p. 4 ») se reconnaît
 * sans ses nombres ; une ligne de texte qui diffère d'un nombre d'une page à l'autre (« Lot 2 »,
 * « Total : 12 € ») est du texte.
 */
function furnitureKey(line: string): string | null {
  const bare = line
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!bare || /^[|$!<[]/.test(bare)) return null
  const letters = letterCount(bare)
  const numbered = /\d/.test(bare)
  if (letters < 3 && !numbered) return null
  // Un numéro de page (« 12 », « S 7 212 – 4 », « Page 3 sur 19 ») : reconnu sans ses nombres.
  if (numbered && (letters < 3 || /^\W*(?:page|p\.)\s*\d+(?:\s*(?:\/|sur|of|de)\s*\d+)?\W*$/i.test(bare) || pageLike(bare))) return `#${fold(bare).replace(/[^\p{L}]/gu, '')}`
  // Une ligne de trois mots ou plus : reconnue par ses mots, sans ses nombres ni leur ordre —
  // « © Éditeur, collection S 7 212 – 1 » (page impaire) et « S 7 212 – 2 © Éditeur, collection » (paire).
  const words = [...new Set(fold(bare).match(/\p{L}{2,}/gu) ?? [])]
  return words.length >= 3 ? words.sort().join(' ') : fold(bare)
}

/** Les mots de quatre lettres et plus d'une ligne, sans accents ni majuscules. */
const longWords = (line: string): string[] => fold(line).match(/\p{L}{4,}/gu) ?? []

/** Une ligne repliée pour être cherchée dans une autre : sans accents, ni majuscules, ni ponctuation. */
const flat = (line: string): string =>
  fold(line)
    .replace(/[^\p{L}\d]+/gu, ' ')
    .trim()

/**
 * Ce qui, une fois les en-têtes et pieds de page connus, en est encore :
 * - une ligne faite de leurs mots (« Toute reproduction … interdite. – © Editions T.I. Parution :
 *   avril 2013 » : deux pieds que la vision a mis bout à bout, ou écrits autrement) — cinq mots
 *   de quatre lettres au moins, presque tous les leurs ;
 * - une ligne fourre-tout (une page entière en une cellule de tableau, un très long paragraphe)
 *   qui en contient un en entier : elle est la page mal découpée, pas du texte.
 */
function furnitureLeft(lines: readonly string[]): (line: string) => boolean {
  const vocabulary = new Set(lines.flatMap(longWords))
  const whole = [...new Set(lines.map(flat).filter((line) => line.length >= 25))]
  return (line) => {
    const bare = line.trim()
    const cell = /^\|[^|]*\|$/.test(bare)
    if ((cell || (bare.length > 300 && !bare.startsWith('|'))) && whole.length) {
      const folded = flat(bare)
      if (whole.some((each) => folded.includes(each))) return true
    }
    if (/^[|$!<[]/.test(bare)) return false
    const words = longWords(bare)
    return words.length >= 5 && words.filter((word) => vocabulary.has(word)).length >= words.length * 0.9
  }
}

/**
 * Des pages sans ce qu'elles répètent : une ligne trouvée en haut ou en bas de deux pages au
 * moins, ou sur deux pages sur cinq n'importe où (trois au moins), est un en-tête ou un pied de
 * page — chaque fois retirée, sauf la première fois quand c'est un titre (le titre du document
 * l'est aussi souvent qu'un titre courant). Une seule page : rien à comparer.
 * `known` : des en-têtes et pieds de page déjà connus (ceux du texte du fichier, quand ce sont
 * les pages lues par la vision) — retirés eux aussi, et leurs variantes (`furnitureLeft`).
 */
export function stripFurniture(pages: readonly string[], known: readonly string[] = []): { pages: string[]; removed: string[] } {
  if (pages.length < 2 && !known.length) return { pages: [...pages], removed: [] }
  const knownKeys = new Set(known.map(furnitureKey).filter((key): key is string => !!key))
  const onPages = new Map<string, number>()
  const inZone = new Map<string, number>()
  for (const page of pages) {
    const lines = page.split('\n').filter((line) => line.trim())
    const seen = new Set<string>()
    const zone = new Set<string>()
    const zoned = lines.length > 2 * ZONE
    lines.forEach((line, index) => {
      const key = furnitureKey(line)
      if (!key) return
      seen.add(key)
      if (zoned && (index < ZONE || index >= lines.length - ZONE)) zone.add(key)
    })
    for (const key of seen) onPages.set(key, (onPages.get(key) ?? 0) + 1)
    for (const key of zone) inZone.set(key, (inZone.get(key) ?? 0) + 1)
  }
  const often = Math.max(3, Math.ceil(pages.length * 0.4))
  // Un numéro de page (« S 7 212 – 4 », « 12 ») : dès deux pages, où qu'il soit (la vision le met parfois au milieu).
  const isFurniture = (key: string) =>
    knownKeys.has(key) || (pages.length > 1 && ((inZone.get(key) ?? 0) >= 2 || (onPages.get(key) ?? 0) >= (key.startsWith('#') ? 2 : often)))
  const removed = new Map<string, string>()
  const keptTitle = new Set<string>()
  const firstPass = pages.map((page) =>
    page
      .split('\n')
      .filter((line) => {
        const key = furnitureKey(line)
        if (!key || !isFurniture(key)) return true
        if (/^\s*#/.test(line) && !keptTitle.has(key)) {
          keptTitle.add(key)
          return true
        }
        if (!removed.has(key)) removed.set(key, line.trim())
        return false
      })
  )
  // Puis leurs variantes, et les lignes fourre-tout qui les contiennent (avec le filet d'un tableau d'une cellule).
  const left = furnitureLeft([...known, ...removed.values()].filter((line) => !/^\s*#/.test(line)))
  const cleaned = firstPass.map((lines) => {
    const out: string[] = []
    let dropRule = false
    for (const line of lines) {
      if (dropRule && /^\s*\|\s*:?-{3,}:?\s*\|\s*$/.test(line)) {
        dropRule = false
        continue
      }
      dropRule = false
      if (line.trim() && left(line)) {
        if (!removed.has(`~${flat(line)}`)) removed.set(`~${flat(line)}`, line.trim().length > 160 ? `${line.trim().slice(0, 157)}…` : line.trim())
        dropRule = line.trim().startsWith('|')
        continue
      }
      out.push(line)
    }
    return out.join('\n')
  })
  return { pages: cleaned.map(tidy), removed: [...removed.values()] }
}

/**
 * Les en-têtes et pieds de page d'un document, d'après le texte de ses pages : leurs lignes,
 * telles que trouvées (voir `stripFurniture`).
 */
export function furnitureLines(pages: readonly string[]): string[] {
  return pages.length > 1 ? stripFurniture(pages).removed : []
}

/**
 * Un texte d'un seul tenant (le texte extrait d'un PDF) sans les en-têtes et pieds de page de
 * ses pages (`furnitureLines`), ni leurs variantes ; un titre, la première fois, gardé.
 */
export function withoutFurniture(text: string, known: readonly string[]): string {
  return known.length ? (stripFurniture([text], known).pages[0] ?? '') : text
}

/** Un numéro de page seul, en haut ou en bas d'une page (sa première, sa dernière ligne) : retiré. */
export function stripPageNumbers(page: string): string {
  const lines = page.split('\n')
  const filled = lines.map((line, index) => (line.trim() ? index : -1)).filter((index) => index >= 0)
  const edges = new Set([...filled.slice(0, 1), ...filled.slice(-1)])
  return tidy(lines.filter((line, index) => !(edges.has(index) && PAGE_NUMBER.test(line) && line.trim().length <= 24)).join('\n'))
}

/** Une ligne qui a sa forme à elle : un titre, un élément de liste, une ligne de tableau, une citation, une formule, une image décrite. */
const shaped = (line: string): boolean => /^\s*(?:#{1,6}\s|[-*+•▪◦‣]\s|\d{1,3}[.)]\s|\||>|\$\$|\[|<|```|~~~|---)/.test(line)

/**
 * Les lignes coupées au milieu d'une phrase, recollées : une ligne qui ne finit pas une phrase,
 * suivie d'une ligne qui commence par une minuscule, ne font qu'une (« con-\nception » redevient
 * « conception »). Les titres, listes, tableaux, citations et blocs de code ne bougent pas.
 */
export function rejoinLines(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let fenced = false
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const previous = out.at(-1)
    const joinable =
      !fenced &&
      previous !== undefined &&
      previous.trim() &&
      line.trim() &&
      !shaped(previous) &&
      !shaped(line) &&
      !/[.!?:;…»"”)\]]\s*$/.test(previous) &&
      !/ {2}$/.test(previous) &&
      /^\s*\p{Ll}/u.test(line)
    if (!joinable) {
      out.push(line)
      continue
    }
    const head = previous.trimEnd()
    // Un mot coupé d'un tiret en fin de ligne : reformé.
    out[out.length - 1] = /\p{L}-$/u.test(head) ? `${head.slice(0, -1)}${line.trim()}` : `${head} ${line.trim()}`
  }
  return tidy(out.join('\n'))
}

/** Sans espaces en fin de ligne ni plus d'une ligne vide de suite. */
export function tidy(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Le nettoyage d'un document lu page par page : les en-têtes et pieds de page, les numéros de
 * page, les lignes coupées, les lignes vides en trop ; les pages mises bout à bout. `known` : les
 * en-têtes et pieds de page du texte du fichier (voir `stripFurniture`).
 */
export function cleanPages(pages: readonly string[], known: readonly string[] = []): { text: string; removed: string[] } {
  const { pages: stripped, removed } = stripFurniture(pages.map(stripLayout), known)
  return { text: tidyContents(rejoinLines(joinPages(stripped.map(stripPageNumbers).filter(Boolean)))), removed }
}

/** Ce que la vision ajoute de mise en page : « Colonne de droite », `<div …>`, un commentaire HTML. */
const LAYOUT_NOISE = /^\s*(?:\*\*|#{1,6}\s*)?(?:colonne (?:de )?(?:gauche|droite)|left column|right column)\s*:?\s*(?:\*\*)?\s*$|^\s*<\/?div\b[^>]*>\s*$|^\s*<!--(?!\s*bp:)[\s\S]*?-->\s*$/i
/** Un filet seul sur sa ligne (`***`, `---`, `___`) : la séparation que la vision met entre les colonnes, autour d'un pied de page. */
const RULE_LINE = /^\s*(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/

/** Une page sans ce que la vision y ajoute de mise en page (étiquettes de colonnes, balises, filets). */
export function stripLayout(page: string): string {
  return tidy(
    page
      .split('\n')
      .filter((line) => !LAYOUT_NOISE.test(line) && !RULE_LINE.test(line))
      .join('\n')
  )
}

/**
 * Des pages mises bout à bout ; une phrase coupée par le changement de page (« systé- » en bas
 * d'une page, « matiques permettant… » en haut de la suivante) recollée.
 */
export function joinPages(pages: readonly string[]): string {
  let text = ''
  for (const page of pages) {
    if (!text) {
      text = page
      continue
    }
    const last = text.trimEnd().split('\n').at(-1) ?? ''
    const first = page.trimStart().split('\n')[0] ?? ''
    const cut = last.trim() && first.trim() && !shaped(last) && !shaped(first) && !/[.!?:;…»"”)\]]\s*$/.test(last) && /^\s*\p{Ll}/u.test(first)
    text = `${text.trimEnd()}${cut ? '\n' : '\n\n'}${page.trimStart()}`
  }
  return text
}

/** Des points de conduite (« Titre ........ 3 », « Titre … 3 ») ; des tirets qui répètent la page d'au-dessus. */
const LEADERS = /\s*(?:\.\s?){4,}\s*|\s*…{2,}\s*/g
/** Une page de sommaire : un nombre, « S 7 212 – 2 », « Doc. S 7 573 », ou le tiret qui la répète. */
const PAGE_REF = /^(?:[A-Z]{1,4}\.?\s*)?[\d\s.–—−-]*\d[\d\s.–—−-]*$|^—$|^Doc\.\s.+$/

/** Une référence de document (« AG 1 100v2 », « S 7 212 ») : des lettres capitales, puis des chiffres. */
const DOC_REF = /^(?:Doc\.\s*)?[A-Z]{1,4}(?:\s?\d+)+[a-z]?\d*$/

/** La page d'une entrée : « AG 1 100v2 - 2 » (la référence du document, puis la page) n'en garde que la page. */
const pageOf = (ref: string): string => {
  const split = /^(.*?)\s*[-–—]\s*(\d{1,4})$/.exec(ref)
  return split && /[a-z]/.test(split[1]!) && DOC_REF.test(split[1]!) ? split[2]! : ref.replace(/^[-–—]\s*(?=\d)/, '')
}

/** Une entrée de sommaire en élément de liste, en retrait selon sa numérotation (« 1.2.3 » : trois niveaux) ; sa page après un tiret. */
function contentsLine(label: string, page: string): string {
  const title = label.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  const depth = Math.max(1, (/^(\d+(?:\.\d+)*)\.?(?:\s|$)/.exec(title)?.[1] ?? '').split('.').filter(Boolean).length)
  return `${'  '.repeat(depth - 1)}- ${title}${page ? ` — ${pageOf(page)}` : ''}`
}

/** Une ligne de tableau de sommaire en élément de liste (voir `contentsLine`). */
function contentsItem(cells: readonly string[]): string {
  const kept = cells.map((cell) => cell.replace(LEADERS, ' ').replace(/\s+/g, ' ').trim()).filter((cell) => cell && cell !== '—')
  if (!kept.length) return ''
  let page = kept.length > 1 && PAGE_REF.test(kept.at(-1)!) ? kept.at(-1)! : ''
  let label = kept.slice(0, page ? -1 : undefined)
  // « AG 1 100v2 » puis « - 2 » : la référence du document avant la page — la page seule.
  if (page && label.length > 1 && DOC_REF.test(label.at(-1)!) && /^[-–—]?\s*\d{1,4}$/.test(page)) {
    page = page.replace(/^[-–—]\s*/, '')
    label = label.slice(0, -1)
  }
  return contentsLine(label.join(' '), page)
}

/**
 * Une ligne de sommaire écrite en texte : « 1.1 Titre — 3 », « 1. Titre — AG 1 100v2 - 2 »,
 * « Pour en savoir plus — Doc. AG 1 100v2 » ; en retrait ou non, puce ou non. `null` sinon.
 */
function contentsText(line: string): { label: string; page: string; numbered: boolean } | null {
  const bare = line
    .trim()
    .replace(/^[-*+•]\s+/, '')
    .replace(/\*\*/g, '')
    .trim()
  const parts = /^(.+?)\s+[—–]\s+(.+)$/.exec(bare)
  if (!parts) return null
  const [, label, page] = parts
  if (!PAGE_REF.test(page!) && !PAGE_REF.test(pageOf(page!))) return null
  return { label: label!, page: page!, numbered: /^\d+(?:\.\d+)*\.?\s/.test(label!) }
}

/**
 * **Un sommaire**, toujours de même forme : une liste, une entrée par ligne — « 1.1 Titre — 3 » —,
 * les sous-parties en retrait, sans points de conduite ni tirets répétés. En devient une :
 * - un tableau dont la plupart des lignes ont des points de conduite (ou des numéros de partie
 *   et de page, et le tiret qui répète la page) ;
 * - des lignes de suite (trois au moins) presque toutes « 1.1 Titre — 3 », numérotées pour la
 *   plupart — même écrites en liste numérotée, les sous-parties en retrait sans puce (ce que la
 *   vision écrit, et qu'une application recolle en un paragraphe).
 * Une ligne à points de conduite hors tableau perd ses points.
 */
export function tidyContents(text: string): string {
  const lines = text.split('\n').map((line) => {
    if (/^\s*\|/.test(line) || !LEADERS.test(line)) return line
    LEADERS.lastIndex = 0
    return line.replace(LEADERS, ' — ').replace(/(?:\s*—){2,}/g, ' —').replace(/\s+—\s*$/, '')
  })
  LEADERS.lastIndex = 0
  const out: string[] = []
  for (let at = 0; at < lines.length; ) {
    if (!/^\s*\|/.test(lines[at]!)) {
      // Des lignes de suite : un sommaire écrit en texte ?
      const block: string[] = []
      while (at + block.length < lines.length && lines[at + block.length]!.trim() && !/^\s*\|/.test(lines[at + block.length]!)) block.push(lines[at + block.length]!)
      const entries = block.map(contentsText)
      const found = entries.filter(Boolean).length
      const numbered = entries.filter((entry) => entry?.numbered).length
      if (block.length >= 3 && found >= block.length * 0.8 && numbered >= found * 0.6) {
        out.push(...block.map((line, index) => (entries[index] ? contentsLine(entries[index]!.label, entries[index]!.page) : line)))
        at += block.length
        continue
      }
      out.push(...(block.length ? block : [lines[at]!]))
      at += block.length || 1
      continue
    }
    const block: string[] = []
    while (at < lines.length && /^\s*\|/.test(lines[at]!)) block.push(lines[at++]!)
    const rows = block
      .filter((line) => !/^\s*\|?\s*:?-{2,}/.test(line))
      .map((line) =>
        line
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim())
      )
    const led = rows.filter((row) => row.some((cell) => /(?:\.\s?){4,}|…{2,}/.test(cell))).length
    const numbered = rows.filter((row) => /^\d+(?:\.\d+)*\.?(?:\s|$)/.test((row[0] ?? '').replace(/\*\*/g, '')) && PAGE_REF.test(row.at(-1) ?? '')).length
    // Des numéros de partie et de page ne suffisent pas (un tableau de lots en a) : il faut aussi le tiret qui répète la page.
    const ditto = rows.some((row) => row.includes('—'))
    const contents = rows.length > 0 && (led >= rows.length * 0.6 || (rows.length >= 2 && ditto && numbered >= rows.length * 0.8))
    out.push(...(contents ? rows.map(contentsItem).filter(Boolean) : block))
  }
  return tidy(out.join('\n'))
}

/**
 * La part des mots d'un texte de référence (de 4 lettres et plus) qu'un autre retrouve, de 0
 * à 1 : ce qu'une lecture a gardé de ce que le fichier porte. `null` : une référence trop
 * courte pour en juger (moins de 20 mots).
 */
export function coverage(reference: string, reading: string): number | null {
  const words = (text: string) => fold(text).match(/\p{L}{4,}/gu) ?? []
  const wanted = words(reference)
  if (wanted.length < 20) return null
  const found = new Set(words(reading))
  return wanted.filter((word) => found.has(word)).length / wanted.length
}

/** Le verdict de l'IA sur une transcription : sa note (de 0 à 100) et ce qui ne va pas. */
export interface Verdict {
  score: number
  problems: string[]
}

/** Le verdict lu de la réponse de l'IA (du JSON, entouré ou non de clôtures) ; `null` s'il ne se lit pas. */
export function readVerdict(answer: string): Verdict | null {
  const json = /\{[\s\S]*\}/.exec(answer.replace(/```(?:json)?/gi, ''))?.[0]
  if (!json) return null
  try {
    const data = JSON.parse(json) as { score?: unknown; note?: unknown; problems?: unknown; problemes?: unknown }
    const raw = Number(data.score ?? data.note)
    if (!Number.isFinite(raw)) return null
    const list = Array.isArray(data.problems) ? data.problems : Array.isArray(data.problemes) ? data.problemes : []
    return { score: Math.round(Math.min(100, Math.max(0, raw))), problems: list.filter((each): each is string => typeof each === 'string' && !!each.trim()).map((each) => each.trim()) }
  } catch {
    return null
  }
}

/** La qualité d'un document : la note de chacune de ses parties, pesée par sa longueur, en pourcentage. */
export function qualityPercent(parts: readonly { score: number; weight: number }[]): number | null {
  const weighed = parts.filter((part) => Number.isFinite(part.score))
  const total = weighed.reduce((sum, part) => sum + Math.max(1, part.weight), 0)
  if (!weighed.length || !total) return null
  return Math.round(weighed.reduce((sum, part) => sum + part.score * Math.max(1, part.weight), 0) / total)
}

/**
 * La note de l'IA, tempérée par ce que la lecture a gardé du texte du fichier (quand il en
 * porte assez pour en juger) : trois quarts la note, un quart la part des mots retrouvés.
 */
export const blendQuality = (score: number, kept: number | null): number => (kept === null ? score : Math.round(score * 0.75 + kept * 100 * 0.25))

/** Une qualité en étoiles, sur cinq (arrondie à l'étoile la plus proche). */
export const qualityStars = (percent: number): number => Math.min(5, Math.max(0, Math.round(percent / 20)))

/** Une qualité dite : « ★★★★☆ 87 % ». */
export const qualityLabel = (percent: number): string => `${'★'.repeat(qualityStars(percent))}${'☆'.repeat(5 - qualityStars(percent))} ${percent} %`

/** La taille d'un morceau de texte relu à la fois (en caractères) : qu'il tienne, avec sa réponse, dans le modèle. */
export const PROOFREAD_CHUNK = 6000

/** Le texte en morceaux, coupés entre deux paragraphes (un paragraphe trop long : seul). */
export function proofreadChunks(text: string, size = PROOFREAD_CHUNK): string[] {
  const chunks: string[] = []
  let current = ''
  for (const paragraph of text.split(/\n{2,}/)) {
    if (current && current.length + paragraph.length + 2 > size) {
      chunks.push(current)
      current = ''
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph
  }
  if (current.trim()) chunks.push(current)
  return chunks
}

/**
 * Un morceau relu par l'IA, gardé s'il reste le même texte : ni résumé ni allongé (sa longueur,
 * sans les blancs, entre 60 % et 160 % de l'original) ; sinon `null` — l'original reste. Les
 * clôtures de code dont elle l'entoure parfois sont ôtées.
 */
export function readProofread(answer: string, original: string): string | null {
  const text = answer
    .trim()
    .replace(/^```(?:markdown|md)?\s*\n/i, '')
    .replace(/\n```\s*$/, '')
    .trim()
  const weight = (value: string) => value.replace(/\s+/g, '').length
  if (!text || !weight(original)) return null
  const ratio = weight(text) / weight(original)
  return ratio >= 0.6 && ratio <= 1.6 ? text : null
}

/**
 * Le modèle qui regarde les images, **réglé exprès** : pour lire un scan, celui d'OCR sinon celui
 * de vision ; pour relire avec la vision, celui de vision sinon celui d'OCR. Jamais celui
 * d'analyse : il ne voit pas, souvent, et le serveur refuse les images. Vide : aucun.
 */
export function visionModelOf(client: AiClient, use: 'vision' | 'ocr'): string {
  const vision = client.connection.visionModel.trim()
  const ocr = client.connection.ocrModel.trim()
  // Sinon celui d'analyse, comme le module de gestion de projet : bien des modèles récents voient.
  const text = client.connection.model.trim()
  return use === 'ocr' ? ocr || vision || text : vision || ocr || text
}

/**
 * Les modèles dont le serveur a refusé les images (« … is not a multimodal model ») : on ne
 * les leur montre plus, jusqu'au prochain démarrage — un scan versé n'échoue pas à chaque fois.
 */
const imagesRefusedBy = new Set<string>()

/** Le serveur a-t-il refusé les images pour ce modèle ? */
export const imagesRefused = (model: string): boolean => imagesRefusedBy.has(model)

/** Le serveur a refusé les images de ce modèle : dit une fois, plus rien ne lui est montré en images. */
export const markImagesRefused = (model: string): void => void imagesRefusedBy.add(model)

/** Pour les tests : oublier les refus. */
export const forgetImageRefusals = (): void => imagesRefusedBy.clear()

/** Une erreur qui dit que le modèle ne prend pas d'images (une requête refusée, 400, qui parle d'image ou de multimodal). */
export function refusesImages(error: unknown): boolean {
  if (!(error instanceof LlmError) || error.kind !== 'http' || (error.status ?? 0) >= 500) return false
  return /multi-?modal|image|vision|does not support (image|vision)/i.test(error.message)
}

/** Le serveur refuse les images de ce modèle : la lecture s'arrête là. */
export class ImagesRefused extends Error {
  constructor(override readonly cause: unknown) {
    super('images refused')
  }
}

export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Les fichiers qu'un modèle de vision peut regarder : les images, et les PDF quand la plateforme sait dessiner leurs pages. */
export function visionReadable(file: string, canDrawPdf: boolean): boolean {
  const extension = file.slice(file.lastIndexOf('.') + 1).toLowerCase()
  return isImage(extension) || (extension === 'pdf' && canDrawPdf)
}

/**
 * Ce qu'un modèle de vision a lu d'une page : sans les clôtures de code ; s'il y avait un texte
 * extrait de la page, une réponse bien plus courte (moins de la moitié) le garde — elle en a
 * perdu. Vide : `null`.
 */
export function readVisionPage(answer: string, pageText: string): string | null {
  const text = answer
    .trim()
    .replace(/^```(?:markdown|md)?\s*\n/i, '')
    .replace(/\n```\s*$/, '')
    .trim()
  if (!text) return null
  const weight = (value: string) => value.replace(/\s+/g, '').length
  return pageText && weight(text) < weight(pageText) * 0.5 ? null : text
}

/** Où une réponse **boucle** : là où la répétition commence, et jusqu'où garder (une fois le motif). */
export interface RepetitionLoop {
  /** L'index, dans la réponse, où la répétition commence. */
  start: number
  /** Ce qui se garde : ce qui précède, et le motif une fois (`text.slice(0, keep)`). */
  keep: number
  /** Le motif répété, et combien de fois. */
  unit: string
  times: number
}

/**
 * Une réponse qui **boucle** : le modèle répète le même passage, encore et encore, jusqu'à la
 * limite de longueur (« ≤ 100 Ω des prises de courant ≤ 100 Ω des prises de courant… »). Le
 * même motif — de 4 à 400 caractères, au moins 4 lettres ou chiffres (des « | | | » ou des
 * points de conduite n'en sont pas) —, répété jusqu'à la fin, les espaces comptés comme un
 * seul : 8 fois et 600 caractères ; dans une réponse coupée par la limite (`cut`), 4 fois et
 * 200. `null` : elle ne boucle pas.
 */
export function repetitionLoop(text: string, cut = false): RepetitionLoop | null {
  // Les espaces (sauts de ligne compris) comptés comme un seul ; `at` : d'où vient chaque caractère.
  let flat = ''
  const at: number[] = []
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (/\s/.test(char)) {
      if (flat.endsWith(' ')) continue
      flat += ' '
    } else flat += char
    at.push(index)
  }
  while (flat.endsWith(' ')) {
    flat = flat.slice(0, -1)
    at.pop()
  }
  const length = flat.length
  const least = cut ? { times: 4, covered: 200 } : { times: 8, covered: 600 }
  if (length < least.covered) return null
  const floor = Math.max(0, length - 40_000)
  for (let period = 4; period <= 400 && period * least.times <= length - floor; period++) {
    // Depuis la fin, tant que chaque caractère est celui d'un motif plus tôt : la boucle.
    let index = length - 1
    while (index - period >= floor && flat[index] === flat[index - period]) index--
    const start = index + 1 - period
    const covered = length - start
    if (covered < least.covered || covered / period < least.times) continue
    const unit = flat.slice(start, start + period)
    if ((unit.match(/[\p{L}\p{N}]/gu) ?? []).length < 4) continue
    return { start: at[start]!, keep: (at[start + period - 1] ?? text.length - 1) + 1, unit: unit.trim(), times: Math.floor(covered / period) }
  }
  return null
}
