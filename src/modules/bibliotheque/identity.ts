// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **référence**, l'**édition** et la **révision** d'un document, telles qu'il les dit —
 * sur sa page de garde, dans son en-tête : « Réf. : DLA-NM-0000000-01-PSP », « Édition 2 »,
 * « Révision 15 », « Indice B », « Version 2.1 » —, sinon telles que le nom de son fichier
 * les dit (« ECSS-E-ST-10C_ed2_rev15.pdf »). D'après la version complète de Black Projects.
 *
 * Lu au début du texte seulement, là où un document dit qui il est : plus loin, une
 * référence est aussi bien celle d'un autre document, citée.
 *
 * **Sûre** quand le texte la dit, avec son mot (« Réf. », « Édition ») : la référence ET la
 * version. Trouvée seulement dans le nom du fichier, ou pas trouvée : **à confirmer** — une
 * seconde passe, avec l'IA, peut trancher.
 */

import { CATEGORIES, guessCategory } from './model'

export interface DocIdentity {
  reference: string
  edition: string
  revision: string
}

export interface IdentityGuess extends DocIdentity {
  /** La référence et la version ont été lues dans le texte, avec leur mot : pas besoin de l'IA. */
  sure: boolean
}

/** Là où un document dit qui il est : ses premières pages. */
export const IDENTITY_HEAD = 6000

/** Un nombre écrit avec ses zéros — « 02 » — dit comme on le dit ; une lettre telle quelle. */
const value = (raw: string): string => {
  const clean = raw.trim()
  return /^\d+$/.test(clean) ? String(Number(clean)) : clean.toUpperCase()
}

const EDITION = /(?:^|[^\p{L}])(?:[ée]dition|issue|ed\.|[ée]d\.)\s*(?:n\s*[°o]\s*)?[:.]?\s*(\d{1,3}|[a-z])(?![\p{L}\d])/iu
const REVISION = /(?:^|[^\p{L}])(?:r[ée]vision|rev\.?|r[ée]v\.?)\s*(?:n\s*[°o]\s*)?[:.]?\s*(\d{1,3}|[a-z])(?![\p{L}\d])/iu
const INDEX = /(?:^|[^\p{L}])(?:indice|ind\.)\s*[:.]?\s*([a-z]\d?|\d{1,2})(?![\p{L}\d])/iu
const VERSION = /(?:^|[^\p{L}])version\s*[:.]?\s*(\d{1,3})(?:\.(\d{1,3}))?(?![\p{L}\d])/iu
const REFERENCE =
  /(?:^|[^\p{L}])(?:r[ée]f(?:[ée]rence)?|reference|doc(?:ument)?\.?\s*(?:n[°o]|no\.?|number|ref\.?))\s*\.?\s*(?:du document\s*)?[:.]?\s*([A-Z0-9][A-Z0-9][A-Z0-9_./-]*(?:\s?[-_/.]\s?[A-Z0-9]+)*)/iu

/** Une référence digne de ce nom : des lettres et des chiffres, séparés ; ni un mot, ni une date. */
export function plausibleReference(raw: string): string {
  const ref = raw.replace(/\s+/g, '').replace(/[-_./]+$/, '')
  if (ref.length < 5 || ref.length > 60) return ''
  if (!/\d/.test(ref) || !/[A-Za-z]/.test(ref)) return ''
  if (!/[-_./]/.test(ref)) return ''
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(ref)) return ''
  return ref
}

/** Ce que le texte, puis le nom du fichier, disent de la référence, de l'édition et de la révision d'un document. */
export function guessIdentity(text: string, fileName: string): IdentityGuess {
  const head = text.slice(0, IDENTITY_HEAD)
  const out: DocIdentity = { reference: '', edition: '', revision: '' }
  out.reference = plausibleReference(REFERENCE.exec(head)?.[1] ?? '')
  const edition = EDITION.exec(head)?.[1]
  const revision = REVISION.exec(head)?.[1] ?? INDEX.exec(head)?.[1]
  if (edition) out.edition = value(edition)
  if (revision) out.revision = value(revision)
  if (!out.edition && !out.revision) {
    const version = VERSION.exec(head)
    if (version) {
      out.edition = value(version[1]!)
      if (version[2]) out.revision = value(version[2])
    }
  }
  // Dit par le texte, avec son mot : sûr.
  const sure = !!out.reference && !!(out.edition || out.revision)
  // Le nom du fichier, pour ce que le texte n'a pas dit : son premier mot quand c'est un code
  // en plusieurs parties — « ECSS-E-AS-11C » —, et « _ed2_rev15 », « indB », « v2.1 ».
  const base = fileName.slice(fileName.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '')
  const name = ` ${base.replace(/_+/g, ' ')} `
  if (!out.reference) {
    const code = plausibleReference(name.trim().split(/\s+/)[0] ?? '')
    if (code && (code.match(/-/g) ?? []).length >= 2 && /^[A-Z0-9.-]+$/.test(code)) out.reference = code
  }
  if (!out.edition) {
    const found = /[\s-](?:ed|[ée]d|edition|[ée]dition)\s*[.-]?\s*(\d{1,3})(?=[\s-])/iu.exec(name)
    if (found) out.edition = value(found[1]!)
  }
  if (!out.revision) {
    const found = /[\s-](?:rev|r[ée]v|revision|r[ée]vision|ind|indice)\s*[.-]?\s*(\d{1,3}|[a-z])(?=[\s-])/iu.exec(name)
    if (found) out.revision = value(found[1]!)
  }
  if (!out.edition && !out.revision) {
    const found = /[\s-]v(\d{1,3})(?:\.(\d{1,3}))?(?=[\s-])/iu.exec(name)
    if (found) {
      out.edition = value(found[1]!)
      if (found[2]) out.revision = value(found[2])
    }
  }
  return { ...out, sure }
}

/**
 * Une référence donnée par l'IA, gardée seulement si le document la dit vraiment (dans son
 * texte ou le nom de son fichier, aux espaces et à la casse près) : l'IA n'invente pas de
 * référence.
 */
export function referenceFoundIn(reference: string, text: string, fileName: string): boolean {
  const squash = (value: string) => value.replace(/\s+/g, '').toUpperCase()
  const wanted = squash(reference)
  return !!wanted && (squash(text).includes(wanted) || squash(fileName).includes(wanted))
}

/**
 * Le **titre** d'un document, tel qu'il le dit au début de son texte. **Sûr** quand il le
 * dit avec son mot (« Titre : … », « Objet : … », « Title: … ») ou en titre de note
 * (« # … ») ; sinon, la première ligne qui a l'air d'un titre (des mots, ni une référence,
 * ni une date, ni un en-tête de page) est **probable** — à confirmer, ou à trancher par l'IA.
 */
export interface TitleGuess {
  title: string
  sure: boolean
}

const TITLE_HEAD = 3000
const LABELLED_TITLE = /^\s*(?:titre|title|intitul[ée]|objet)(?:\s+du\s+document)?\s*[:：.]\s*(.{4,150}?)\s*$/imu
const NOTE_TITLE = /^#\s+(.{2,150}?)\s*#*\s*$/mu
/** Ce qui n'est pas un titre : une page, une date, une mention de confidentialité, un en-tête technique. */
const NOT_TITLE = /^(?:page\s*\d|\d+\s*\/\s*\d+$|confidentiel|diffusion|copyright|©|tous droits|r[ée]f(?:[ée]rence)?\s*[.:]|[ée]dition\s|r[ée]vision\s|version\s|date\s*[:.]|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/iu

const cleanTitle = (raw: string): string =>
  raw
    .replace(/\s+/g, ' ')
    .replace(/^[-–—•*\s]+|[-–—:;,\s]+$/g, '')
    .trim()

export function guessTitle(text: string): TitleGuess {
  const head = text.slice(0, TITLE_HEAD)
  const labelled = LABELLED_TITLE.exec(head)?.[1]
  if (labelled && cleanTitle(labelled).length >= 4) return { title: cleanTitle(labelled), sure: true }
  const note = NOTE_TITLE.exec(head)?.[1]
  if (note && cleanTitle(note).length >= 2) return { title: cleanTitle(note), sure: true }
  // La première ligne qui a l'air d'un titre, dans les premières lignes.
  const lines = head
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 25)
  for (const line of lines) {
    const clean = cleanTitle(line)
    const letters = (clean.match(/\p{L}/gu) ?? []).length
    if (clean.length < 6 || clean.length > 120 || clean.split(/\s+/).length < 2) continue
    // Un nom d'organisme (« Agence spatiale européenne », « Durand SAS ») est un émetteur, pas un titre.
    if (letters / clean.length < 0.6 || NOT_TITLE.test(clean) || ORGANISATION.test(clean) || clean.endsWith(':')) continue
    return { title: clean, sure: false }
  }
  return { title: '', sure: false }
}

/** Un titre donné par l'IA, gardé seulement si ses mots sont ceux du document (texte ou nom du fichier) : elle n'invente pas. */
export function titleFoundIn(title: string, text: string, fileName: string): boolean {
  const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const words = fold(title).match(/\p{L}{4,}/gu) ?? []
  if (!words.length) return false
  const hay = fold(`${text} ${fileName}`)
  return words.filter((word) => hay.includes(word)).length / words.length >= 0.7
}

/**
 * L'**émetteur** d'un document — qui l'a écrit ou publié : une entreprise, un organisme,
 * l'acheteur —, tel qu'il le dit au début de son texte. **Sûr** quand il le dit avec son mot
 * (« Émetteur : », « Émis par », « Rédigé par », « Auteur : », « Société : », « Pouvoir
 * adjudicateur : », « Issued by », « Prepared by »…) ; sinon, une ligne qui a l'air d'un nom
 * d'organisme (« … SAS », « Agence … », « Centre national … ») est **probable** — à
 * confirmer, ou à trancher par l'IA. Rien : pas d'émetteur, à confirmer.
 */
export interface IssuerGuess {
  issuer: string
  sure: boolean
}

const ISSUER_HEAD = 3000
const LABELLED_ISSUER =
  /^\s*(?:[ée]metteur|[ée]mis\s+par|r[ée]dig[ée]\s+par|[ée]tabli\s+par|auteur|soci[ée]t[ée]|organisme|entreprise|acheteur|pouvoir\s+adjudicateur|ma[îi]tre\s+d['’]ouvrage|issued\s+by|prepared\s+by|author|issuer|company|organisation|organization)\s*[:：]?\s+(?!:)(.{2,80}?)\s*$/imu
const ORGANISATION =
  /(?:\b(?:S\.?A\.?S\.?U?|S\.?A\.?|SARL|SNC|EURL|SCOP|GIE|GmbH|AG|Ltd|LLC|Inc\.?|PLC|S\.p\.A\.?|B\.V\.?|N\.V\.?)$|^(?:agence|centre|minist[èe]re|direction|soci[ée]t[ée]|groupe|group|laboratoire|universit[ée]|commune|d[ée]partement|r[ée]gion|conseil|office|institut|[ée]tablissement|syndicat|agency|ministry|department|university|council|institute)\b)/iu

const cleanIssuer = (raw: string): string =>
  raw
    .replace(/\s+/g, ' ')
    .replace(/^[-–—•*:\s]+|[-–—:;,.\s]+$/g, '')
    .trim()

export function guessIssuer(text: string): IssuerGuess {
  const head = text.slice(0, ISSUER_HEAD)
  const labelled = LABELLED_ISSUER.exec(head)?.[1]
  if (labelled && cleanIssuer(labelled).length >= 2) return { issuer: cleanIssuer(labelled), sure: true }
  const lines = head
    .split(/\r?\n/)
    .map((line) => cleanIssuer(line))
    .filter(Boolean)
    .slice(0, 25)
  const found = lines.find((line) => line.length >= 3 && line.length <= 80 && ORGANISATION.test(line))
  return { issuer: found ?? '', sure: false }
}

/** Un émetteur donné par l'IA, gardé seulement si le document le dit (tel quel, ou l'essentiel de ses mots) : elle n'invente pas. */
export function issuerFoundIn(issuer: string, text: string, fileName: string): boolean {
  const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const hay = fold(`${text} ${fileName}`)
  const squash = (value: string) => value.replace(/[^\p{L}\p{N}]+/gu, '')
  if (squash(fold(issuer)).length >= 2 && squash(hay).includes(squash(fold(issuer)))) return true
  const words = fold(issuer).match(/\p{L}{3,}/gu) ?? []
  return !!words.length && words.filter((word) => hay.includes(word)).length / words.length >= 0.7
}

/**
 * La **catégorie** d'un document (CCTP, RC, Devis, Plan…). **Sûre** quand celui qui le
 * dépose la donne (le type d'une pièce d'analyse), quand le document la dit avec son mot
 * (« Type de document : CCTP »), ou quand son nom de fichier et son texte disent la même.
 * Sinon, à confirmer : la catégorie du nom du fichier reste, et celle que le texte suggère
 * est **probable** — l'IA peut trancher.
 */
export interface CategoryGuess {
  category: string
  sure: boolean
  /** Celle que le texte suggère, quand elle n'est pas celle retenue. */
  probable: string
}

const CATEGORY_HEAD = 3000
const LABELLED_CATEGORY = /^\s*(?:type|nature|cat[ée]gorie)\s+(?:de\s+|du\s+)?(?:document|pi[èe]ce)\s*[:：]\s*(.{2,60}?)\s*$/imu
const foldText = (value: string) =>
  ` ${value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')} `

/** La catégorie que le début du texte suggère : ses mots-clés longs (« clauses techniques »), pas les sigles courts, trop fréquents. */
export function categoryFromText(text: string): string {
  const head = foldText(text.slice(0, CATEGORY_HEAD))
  const scores = CATEGORIES.map((category) => ({
    name: category.name,
    hits: category.words.filter((word) => word.length >= 6 || word.includes(' ')).reduce((sum, word) => sum + (head.split(` ${word} `).length - 1), 0)
  })).sort((a, b) => b.hits - a.hits)
  const [best, next] = [scores[0]!, scores[1]!]
  return best.hits >= 1 && best.hits > next.hits ? best.name : ''
}

export function guessDocCategory(text: string, fileName: string, given = ''): CategoryGuess {
  if (given.trim()) return { category: given.trim(), sure: true, probable: '' }
  const labelled = LABELLED_CATEGORY.exec(text.slice(0, CATEGORY_HEAD))?.[1]
  const said = labelled ? guessCategory(labelled) || labelled.trim() : ''
  if (said) return { category: said, sure: true, probable: '' }
  const fromName = guessCategory(fileName)
  const fromText = categoryFromText(text)
  if (fromName && fromName === fromText) return { category: fromName, sure: true, probable: '' }
  return { category: fromName, sure: false, probable: fromText && fromText !== fromName ? fromText : '' }
}
