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

/** Un émetteur de la liste : son code, son nom, ses autres noms. */
export interface KnownIssuer {
  code: string
  name: string
  aliases: readonly string[]
}

const foldName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Un code proposé pour un type de pièce, d'après son nom : un mot, lui en capitales (« DEVIS ») ; plusieurs, leurs initiales (« Note de calcul » → « NDC »). */
export function suggestTypeCode(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !/^(?:de|du|des|la|le|les|l|d|et|of|the|and|for|pour|en|a|au|aux)$/i.test(word))
  if (!words.length) return ''
  if (words.length === 1) return words[0]!.toUpperCase().slice(0, 20)
  return words.map((word) => word[0]!.toUpperCase()).join('').slice(0, 20)
}

/** Un code proposé pour un émetteur, d'après son nom : les initiales (« Thales Alenia Space » → « TAS ») ; un seul mot, ses quatre premières lettres. */
export function suggestIssuerCode(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !/^(?:de|du|des|la|le|les|l|d|et|of|the|and|for|pour|en|a|au|aux)$/i.test(word))
  if (!words.length) return ''
  if (words.length === 1) return words[0]!.slice(0, 4).toUpperCase()
  // Un sigle déjà écrit (« ESA », « SNCF ») : gardé.
  const acronym = words.find((word) => word.length >= 2 && word.length <= 6 && word === word.toUpperCase() && /\p{L}/u.test(word))
  return acronym ?? words.map((word) => word[0]!.toUpperCase()).join('').slice(0, 8)
}

/** Le code d'un émetteur de la liste écrit par son code, son nom ou l'un de ses autres noms ; vide s'il n'y est pas. */
export function knownIssuerCode(value: string, known: readonly KnownIssuer[]): string {
  const wanted = foldName(value)
  if (!wanted) return ''
  return known.find((each) => foldName(each.code) === wanted || [each.name, ...each.aliases].some((name) => foldName(name) === wanted))?.code ?? ''
}

/** Les émetteurs de la liste que dit un texte : leur nom ou un autre nom (sans accents ni casse), leur code tel quel, en mot entier. */
function knownIssuersIn(text: string, known: readonly KnownIssuer[]): KnownIssuer[] {
  const folded = ` ${foldName(text)} `
  return known.filter(
    (each) =>
      [each.name, ...each.aliases].some((name) => foldName(name).length >= 3 && folded.includes(` ${foldName(name)} `)) ||
      (each.code.length >= 2 && new RegExp(`(?<![\\p{L}\\p{N}])${each.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u').test(text))
  )
}

export function guessIssuer(text: string, known: readonly KnownIssuer[] = []): IssuerGuess {
  const head = text.slice(0, ISSUER_HEAD)
  const labelled = LABELLED_ISSUER.exec(head)?.[1]
  // Dit avec son mot : sûr — par son code, s'il est de la liste.
  if (labelled && cleanIssuer(labelled).length >= 2) return { issuer: knownIssuerCode(cleanIssuer(labelled), known) || knownIssuersIn(labelled, known)[0]?.code || cleanIssuer(labelled), sure: true }
  const lines = head
    .split(/\r?\n/)
    .map((line) => cleanIssuer(line))
    .filter(Boolean)
    .slice(0, 25)
  // Un émetteur de la liste, en tête du document (sa page de garde) : un seul, sûr ; plusieurs, le premier, probable.
  if (known.length) {
    const top = lines.slice(0, 15)
    const named = known
      .map((each) => ({ each, at: top.findIndex((line) => knownIssuersIn(line, [each]).length > 0) }))
      .filter((found) => found.at >= 0)
      .sort((a, b) => a.at - b.at)
    if (named.length === 1) return { issuer: named[0]!.each.code, sure: true }
    if (named.length > 1) return { issuer: named[0]!.each.code, sure: false }
  }
  const found = lines.find((line) => line.length >= 3 && line.length <= 80 && ORGANISATION.test(line))
  return { issuer: found ? knownIssuerCode(found, known) || found : '', sure: false }
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

/**
 * Les **types de pièce** d'un document : leur liste (un code, un libellé) et ce qui les
 * reconnaît — au nom du fichier, au début du texte. Le module Typage des pièces les donne (ses
 * types, ceux de l'utilisateur, sans les désactivés) ; sans lui, les catégories de la
 * bibliothèque en tiennent lieu.
 */
export interface PieceTyper {
  types(): readonly { code: string; label: string }[]
  /** Le type que dit le nom du fichier ; vide si aucun. */
  ofName(fileName: string): string
  /** Le type que dit le début du texte ; vide si aucun. */
  ofText(text: string): string
  /** Ajouter un type à la liste (les types personnalisés) : son code, ou pourquoi il ne peut pas l'être. Absent : la liste ne s'étend pas d'ici. */
  add?(code: string, label: string): Promise<{ code: string } | { error: string }>
  /** Pourquoi ce code et ce libellé ne peuvent pas être ajoutés (`null` : ils le peuvent). */
  check?(code: string, label: string): string | null
}

/** Sans le module Typage des pièces : les catégories de la bibliothèque. */
export const CATEGORY_TYPER: PieceTyper = {
  types: () => CATEGORIES.map((category) => ({ code: category.name, label: category.name })),
  ofName: (fileName) => guessCategory(fileName),
  ofText: (text) => categoryFromText(text)
}

/** Le code d'un type écrit par son code ou son libellé (à la casse et aux accents près) ; vide s'il n'en est pas un. */
export function pieceTypeCode(value: string, typer: PieceTyper = CATEGORY_TYPER): string {
  const wanted = foldText(value).trim()
  if (!wanted) return ''
  return typer.types().find((type) => foldText(type.code).trim() === wanted || foldText(type.label).trim() === wanted)?.code ?? ''
}

export function guessDocCategory(text: string, fileName: string, given = '', typer: PieceTyper = CATEGORY_TYPER): CategoryGuess {
  if (given.trim()) return { category: given.trim(), sure: true, probable: '' }
  // « Type de document : CCTP » : un type de la liste (son code, son libellé, ou ses mots-clés).
  const labelled = LABELLED_CATEGORY.exec(text.slice(0, CATEGORY_HEAD))?.[1]
  const said = labelled ? pieceTypeCode(labelled, typer) || typer.ofName(labelled) : ''
  if (said) return { category: said, sure: true, probable: '' }
  const fromName = typer.ofName(fileName)
  const fromText = typer.ofText(text)
  if (fromName && fromName === fromText) return { category: fromName, sure: true, probable: '' }
  return { category: fromName, sure: false, probable: fromText && fromText !== fromName ? fromText : '' }
}

/**
 * Les **étiquettes** d'un document (ses mots-clés). **Sûres** quand il les dit avec leur mot
 * (« Mots-clés : », « Keywords: », « Étiquettes : ») ; sinon, à confirmer — avec, proposés,
 * les mots importants qui reviennent le plus au début de son texte ; l'IA peut trancher.
 */
export interface TagsGuess {
  tags: string[]
  sure: boolean
}

const TAGS_HEAD = 6000
const LABELLED_TAGS = /^\s*(?:mots?[-\s]cl[ée]s?|keywords?|[ée]tiquettes?|tags?)\s*[:：]\s*(.{2,300}?)\s*$/imu
/** Des mots longs et fréquents qui ne disent rien du sujet. */
const COMMON = new Set(
  'document documents present presente presentes dossier dossiers marche marches doivent devront pendant egalement notamment toutes chaque autres celle celles ceux cette ainsi article articles annexe annexes conditions conformement concernant suivant suivants suivantes titulaire titulaires respect ensemble prestations prestation cadre should within whether therefore following section sections shall document provided according'
    .split(' ')
)

const splitTags = (raw: string): string[] => [
  ...new Set(
    raw
      .split(/[,;|·•\/]+/)
      .map((tag) => tag.replace(/^[#\s"'«“]+|[\s"'»”.]+$/g, '').trim())
      .filter((tag) => tag.length >= 2 && tag.length <= 40)
  )
]

export function guessTags(text: string): TagsGuess {
  const head = text.slice(0, TAGS_HEAD)
  const labelled = LABELLED_TAGS.exec(head)?.[1]
  if (labelled && splitTags(labelled).length) return { tags: splitTags(labelled).slice(0, 12), sure: true }
  // Les mots d'au moins six lettres, sans accents ni casse, comptés ; ceux qui reviennent trois fois et plus.
  const counts = new Map<string, { count: number; shown: string }>()
  for (const word of head.match(/\p{L}{6,}/gu) ?? []) {
    const key = word.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    if (COMMON.has(key)) continue
    const seen = counts.get(key)
    counts.set(key, { count: (seen?.count ?? 0) + 1, shown: seen?.shown ?? word.toLowerCase() })
  }
  const tags = [...counts.values()]
    .filter((each) => each.count >= 3)
    .sort((a, b) => b.count - a.count || a.shown.localeCompare(b.shown, 'fr'))
    .slice(0, 5)
    .map((each) => each.shown)
  return { tags, sure: false }
}

/** Les étiquettes données par l'IA : gardées si le document les dit, ou si la bibliothèque les emploie déjà. */
export function tagsFoundIn(tags: readonly string[], text: string, known: readonly string[]): string[] {
  const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const hay = fold(text)
  const usual = new Set(known.map(fold))
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length >= 2 && tag.length <= 40 && tag.split(/\s+/).length <= 4))].filter((tag) => usual.has(fold(tag)) || hay.includes(fold(tag)))
}

/**
 * La **date** d'un document (celle de son édition, de sa publication, de sa signature), en
 * `AAAA-MM-JJ` — ou `AAAA-MM` quand seul le mois est dit. **Sûre** quand le document la dit
 * avec son mot (« Date : », « Date d'édition : », « Émis le », « Toulouse, le 12 mars
 * 2026 »), ou quand le nom du fichier et le texte disent la même ; sinon, à confirmer — avec
 * la première date du début du texte (hors dates limites, échéances), ou celle du nom.
 */
export interface DateGuess {
  date: string
  sure: boolean
}

const MONTHS: Readonly<Record<string, number>> = {
  janvier: 1, janv: 1, january: 1, jan: 1,
  fevrier: 2, fevr: 2, fev: 2, february: 2, feb: 2,
  mars: 3, march: 3,
  avril: 4, avr: 4, april: 4, apr: 4,
  mai: 5, may: 5,
  juin: 6, june: 6,
  juillet: 7, juil: 7, july: 7,
  aout: 8, august: 8, aug: 8,
  septembre: 9, sept: 9, september: 9, sep: 9,
  octobre: 10, october: 10, oct: 10,
  novembre: 11, november: 11, nov: 11,
  decembre: 12, december: 12, dec: 12
}
const MONTH = `(${Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')})\\b\\.?`
const DATE_PATTERNS: readonly { re: RegExp; read: (m: RegExpExecArray) => [number, number, number] }[] = [
  { re: /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g, read: (m) => [+m[1]!, +m[2]!, +m[3]!] },
  { re: /(?<![\d/.-])(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d/.-]*\d)/g, read: (m) => [m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!, +m[2]!, +m[1]!] },
  { re: new RegExp(`(?<!\\d)(\\d{1,2})(?:er|st|nd|rd|th)?\\s+${MONTH}\\s+(\\d{4})(?!\\d)`, 'g'), read: (m) => [+m[3]!, MONTHS[m[2]!]!, +m[1]!] },
  { re: new RegExp(`(?<![\\p{L}])${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})(?!\\d)`, 'gu'), read: (m) => [+m[3]!, MONTHS[m[1]!]!, +m[2]!] },
  { re: new RegExp(`(?<![\\p{L}])${MONTH}\\s+(\\d{4})(?!\\d)`, 'gu'), read: (m) => [+m[2]!, MONTHS[m[1]!]!, 0] }
]

const foldDate = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const pad = (value: number) => String(value).padStart(2, '0')

/** Une date plausible (1950 à 2100, un jour qui existe), en `AAAA-MM-JJ` (`AAAA-MM` sans jour) ; sinon vide. */
function isoDate(year: number, month: number, day: number): string {
  if (year < 1950 || year > 2100 || month < 1 || month > 12) return ''
  if (!day) return `${year}-${pad(month)}`
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return ''
  return `${year}-${pad(month)}-${pad(day)}`
}

interface FoundDate {
  value: string
  index: number
  end: number
}

/** Les dates d'un texte, dans l'ordre ; à un même endroit, la plus complète (« 12 mars 2026 », pas « mars 2026 »). */
function datesIn(text: string): FoundDate[] {
  const folded = foldDate(text)
  const found: FoundDate[] = []
  for (const pattern of DATE_PATTERNS) {
    pattern.re.lastIndex = 0
    for (let m = pattern.re.exec(folded); m; m = pattern.re.exec(folded)) {
      const [year, first, second] = pattern.read(m)
      // 03/25/2026 : écrite mois/jour.
      const swap = pattern === DATE_PATTERNS[1] && first > 12 && second <= 12
      const value = isoDate(year, swap ? second : first, swap ? first : second)
      if (value) found.push({ value, index: m.index, end: m.index + m[0].length })
    }
  }
  found.sort((a, b) => a.index - b.index || b.end - a.end)
  return found.filter((each, at) => !found.slice(0, at).some((other) => other.index <= each.index && other.end >= each.end))
}

/** La date écrite dans une valeur (« 12/03/2026 », « 12 mars 2026 », « 2026-03 ») ; vide sinon. */
export function parseDocDate(value: string): string {
  return datesIn(value)[0]?.value ?? ''
}

/** La date d'un nom de fichier : « 2026-03-12 », « 20260312 », « 12-03-2026 ». */
function dateOfName(fileName: string): string {
  const name = fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ')
  const compact = /(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/.exec(name)
  return parseDocDate(name) || (compact ? isoDate(+compact[1]!, +compact[2]!, +compact[3]!) : '')
}

const DATE_HEAD = 6000
const LABELLED_DATE =
  /^\s*(?:date(?:\s+(?:d\s*['’]\s*|de\s+(?:la\s+|l\s*['’]\s*)?)?(?:emission|edition|publication|diffusion|redaction|signature|version|revision|mise a jour|mise en application|application))?|issue date|date of issue|publication date|release date|emise? le|publiee? le|redigee? le|signee? le|fait a [^,\n]{1,40},?\s*le|[\p{L}][\p{L}' -]{1,40},\s*le)\s*[:：]?\s*/u
/** Une date limite, une échéance : pas celle du document. */
const DEADLINE = /limite|remise|echeance|deadline|avant le|au plus tard|jusqu|due date|expir|validite/

export function guessDocDate(text: string, fileName = ''): DateGuess {
  const head = text.slice(0, DATE_HEAD)
  for (const line of head.split('\n')) {
    const folded = foldDate(line)
    const label = LABELLED_DATE.exec(folded)
    if (!label || DEADLINE.test(folded)) continue
    const first = datesIn(line)[0]
    // La date suit son mot : au début de ce qui reste de la ligne.
    if (first && first.index <= label[0].length + 2) return { date: first.value, sure: true }
  }
  const named = dateOfName(fileName)
  // Les dates du texte, sauf celles qui suivent, sur leur ligne, une date limite ou une échéance.
  const inText = head
    .split('\n')
    .flatMap((line) => {
      const deadline = DEADLINE.exec(foldDate(line))?.index ?? Infinity
      return datesIn(line).filter((each) => each.index < deadline)
    })
    .map((each) => each.value)
  if (named && inText.includes(named)) return { date: named, sure: true }
  return { date: inText[0] ?? named, sure: false }
}

/** La date donnée par l'IA : gardée si le document la dit (le mois seul : une de ses dates de ce mois). */
export function dateFoundIn(value: string, text: string): boolean {
  if (!value) return false
  return datesIn(text).some((each) => each.value === value || (value.length === 7 && each.value.startsWith(value)))
}

/** Une date du document, en mots : « 12 mars 2026 », « mars 2026 ». */
export function docDateLabel(value: string, locale = 'fr-FR'): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value)
  if (!m) return value
  const date = new Date(Date.UTC(+m[1]!, +m[2]! - 1, m[3] ? +m[3] : 1))
  return date.toLocaleDateString(locale, m[3] ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
