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
  const numbered = bare.length <= 40 && /\d/.test(bare)
  if (letters < 3 && !numbered) return null
  const pageLike = numbered && (letters < 3 || /^\W*(?:page|p\.)\s*\d+(?:\s*(?:\/|sur|of|de)\s*\d+)?\W*$/i.test(bare))
  return pageLike ? fold(bare).replace(/\d+/g, '#') : fold(bare)
}

/**
 * Des pages sans ce qu'elles répètent : une ligne trouvée en haut ou en bas de deux pages au
 * moins, ou sur deux pages sur cinq n'importe où (trois au moins), est un en-tête ou un pied de
 * page — chaque fois retirée, sauf la première fois quand c'est un titre (le titre du document
 * l'est aussi souvent qu'un titre courant). Une seule page : rien à comparer.
 */
export function stripFurniture(pages: readonly string[]): { pages: string[]; removed: string[] } {
  if (pages.length < 2) return { pages: [...pages], removed: [] }
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
  const isFurniture = (key: string) => (inZone.get(key) ?? 0) >= 2 || (onPages.get(key) ?? 0) >= often
  const removed = new Map<string, string>()
  const keptTitle = new Set<string>()
  const cleaned = pages.map((page) =>
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
      .join('\n')
  )
  return { pages: cleaned.map(tidy), removed: [...removed.values()] }
}

/**
 * Les en-têtes et pieds de page d'un document, d'après le texte de ses pages : ce par quoi on
 * reconnaît leurs lignes (voir `stripFurniture`).
 */
export function furnitureKeys(pages: readonly string[]): Set<string> {
  const { removed } = stripFurniture(pages)
  return new Set(removed.map((line) => furnitureKey(line)).filter((key): key is string => !!key))
}

/**
 * Un texte d'un seul tenant (le texte extrait d'un PDF) sans les lignes que ses pages
 * répètent (`furnitureKeys`) ; un titre, la première fois, gardé.
 */
export function withoutFurniture(text: string, keys: ReadonlySet<string>): string {
  if (!keys.size) return text
  const keptTitle = new Set<string>()
  return tidy(
    text
      .split('\n')
      .filter((line) => {
        const key = furnitureKey(line)
        if (!key || !keys.has(key)) return true
        if (/^\s*#/.test(line) && !keptTitle.has(key)) {
          keptTitle.add(key)
          return true
        }
        return false
      })
      .join('\n')
  )
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
 * page, les lignes coupées, les lignes vides en trop ; les pages mises bout à bout.
 */
export function cleanPages(pages: readonly string[]): { text: string; removed: string[] } {
  const { pages: stripped, removed } = stripFurniture(pages)
  return { text: rejoinLines(stripped.map(stripPageNumbers).filter(Boolean).join('\n\n')), removed }
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
