// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Un document de la bibliothèque : un fichier, et sa **fiche** — une note qui le décrit
 * (titre, famille, catégorie, référence, édition, révision, émetteur, étiquettes), dit
 * d'où il vient (ses origines : une analyse, un import…), garde son empreinte, et le relie
 * à sa version précédente.
 */

import { isLanguage, type LanguageCode } from './language'
import { toYaml } from '../../core/yaml'

/** La famille d'un fichier, d'après son extension. */
export type DocFamily = 'pdf' | 'word' | 'sheet' | 'slides' | 'image' | 'mail' | 'note' | 'other'
export const FAMILIES: readonly DocFamily[] = ['pdf', 'word', 'sheet', 'slides', 'image', 'mail', 'note', 'other']

const BY_EXTENSION: Readonly<Record<string, DocFamily>> = {
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  docm: 'word',
  odt: 'word',
  rtf: 'word',
  txt: 'word',
  xls: 'sheet',
  xlsx: 'sheet',
  xlsm: 'sheet',
  ods: 'sheet',
  csv: 'sheet',
  tsv: 'sheet',
  ppt: 'slides',
  pptx: 'slides',
  odp: 'slides',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  tif: 'image',
  tiff: 'image',
  bmp: 'image',
  svg: 'image',
  eml: 'mail',
  msg: 'mail',
  md: 'note',
  html: 'note',
  htm: 'note',
  xml: 'note',
  json: 'note',
  reqif: 'note',
  reqifz: 'note'
}

export const extensionOfName = (name: string): string => (/\.([^./]+)$/.exec(name)?.[1] ?? '').toLowerCase()
export const familyOf = (name: string): DocFamily => BY_EXTENSION[extensionOfName(name)] ?? 'other'
export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** Le titre d'un fichier : son nom sans l'extension, les « _ » et les espaces répétés ramenés à un espace. */
export function titleFromName(name: string): string {
  return baseName(name)
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Les catégories reconnues au nom du fichier : une catégorie, ses mots-clés (sans accents,
 * en minuscules). La première qui répond l'emporte ; sinon, pas de catégorie.
 */
export const CATEGORIES: readonly { name: string; words: readonly string[] }[] = [
  { name: 'CCTP', words: ['cctp', 'clauses techniques'] },
  { name: 'CCAP', words: ['ccap', 'clauses administratives'] },
  { name: 'RC', words: ['reglement de consultation', 'rc'] },
  { name: 'BPU', words: ['bpu', 'bordereau des prix'] },
  { name: 'DPGF', words: ['dpgf', 'decomposition du prix'] },
  { name: 'Acte d’engagement', words: ['acte d engagement', 'ae'] },
  { name: 'Mémoire technique', words: ['memoire technique', 'memoire'] },
  { name: 'Plan', words: ['plan', 'plans'] },
  { name: 'Planning', words: ['planning', 'calendrier', 'gantt'] },
  { name: 'Compte rendu', words: ['compte rendu', 'cr', 'pv', 'proces verbal'] },
  { name: 'Note de calcul', words: ['note de calcul', 'ndc'] },
  { name: 'Devis', words: ['devis', 'offre de prix'] },
  { name: 'Facture', words: ['facture'] },
  { name: 'Contrat', words: ['contrat', 'marche', 'avenant'] },
  { name: 'Courrier', words: ['courrier', 'lettre'] },
  { name: 'Rapport', words: ['rapport'] },
  { name: 'Photo', words: ['photo', 'img', 'dsc'] },
  { name: 'Norme', words: ['norme', 'nf', 'iso', 'ecss'] },
  { name: 'Échange', words: ['types de pieces', 'workflows'] }
]

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** La catégorie devinée au nom du fichier ; vide si rien ne répond. */
export function guessCategory(name: string): string {
  const words = ` ${fold(titleFromName(name)).replace(/[^\p{L}\p{N}]+/gu, ' ')} `
  return CATEGORIES.find((category) => category.words.some((word) => words.includes(` ${word} `)))?.name ?? ''
}

/** Ce qui marque une version dans un nom de fichier : « ind B », « rev 2 », « v3 », « ed 1 », « issue 02 ». */
const ISSUE = /(?:^|[\s_\-(])(?:ind(?:ice)?|rev(?:ision)?|v(?:ersion)?|ed(?:ition)?|issue)\s*[.:°#-]?\s*[a-z]?\d{0,3}[a-z]?(?=$|[\s_\-)])/g

/** La clé d'un nom, ses marques de version ôtées : deux versions d'un même document ont la même. */
export function versionKey(name: string): string {
  return fold(baseName(name).replace(/\.[^.]+$/, ''))
    .replace(ISSUE, ' ')
    .replace(/[\s_\-().]+/g, ' ')
    .trim()
}

/** D'où vient un document : le module, ce qu'il en dit (une analyse, un import), un lien. */
export interface DocOrigin {
  module: string
  label: string
  link?: string
}

export interface LibraryDoc {
  /** La note qui le décrit : son identité. */
  record: string
  title: string
  /** Le fichier, dans le coffre. */
  file: string
  family: DocFamily
  size: number
  /** SHA-256 de ses octets. */
  hash: string
  /** Le jour où il est entré dans la bibliothèque (AAAA-MM-JJ). */
  added: string
  category: string
  reference: string
  edition: string
  revision: string
  issuer: string
  tags: string[]
  origins: DocOrigin[]
  /** La fiche de sa version précédente, quand elle est reliée. */
  previous?: string
  /** Une version précédente probable (même nom, marques de version ôtées), à confirmer. */
  likelyPrevious?: string
  /** Le fichier a été copié dans la bibliothèque (venu de l'ordinateur) ; sinon il est resté où il était. */
  copied: boolean
  /** Sa langue (fr, en…), détectée sûrement ou confirmée ; absente sinon. */
  language?: LanguageCode
  /** La détection n'a pas été assez sûre : la langue est à confirmer (avec la plus probable, s'il y en a une). */
  languageToConfirm?: boolean
  languageProbable?: LanguageCode
  /** Où est sa fiche (calculé au parcours, pas écrit) : la bibliothèque, le répertoire (vide : sa racine). */
  shelf?: string
  directory?: string
}

export const RECORD_TYPE = 'bibliotheque-document'

const link = (path: string): string => `[[${path}]]`
/** Le chemin d'un lien « [[chemin|texte]] », ou le texte tel quel. */
export const unlink = (value: unknown): string => (typeof value === 'string' ? value.replace(/^\[\[|\]\]$/g, '').split('|')[0]!.trim() : '')

/** La note d'un document : son en-tête, son titre, une section de notes à l'utilisateur. */
export function recordContent(doc: Omit<LibraryDoc, 'record'> & { record?: string }, notesHeading: string, body?: string): string {
  const data: Record<string, unknown> = {
    'bp-type': RECORD_TYPE,
    titre: doc.title,
    fichier: link(doc.file),
    famille: doc.family,
    taille: doc.size,
    sha256: doc.hash,
    ajoute: doc.added,
    categorie: doc.category,
    reference: doc.reference,
    edition: doc.edition,
    revision: doc.revision,
    emetteur: doc.issuer,
    etiquettes: doc.tags,
    origines: doc.origins.map((origin) => ({ module: origin.module, libelle: origin.label, ...(origin.link ? { lien: link(origin.link) } : {}) })),
    copie: doc.copied,
    ...(doc.previous ? { precedent: link(doc.previous) } : {}),
    ...(doc.likelyPrevious ? { precedentProbable: link(doc.likelyPrevious) } : {}),
    ...(doc.language ? { langue: doc.language } : {}),
    ...(doc.languageToConfirm ? { langueAConfirmer: true } : {}),
    ...(doc.languageToConfirm && doc.languageProbable ? { langueProbable: doc.languageProbable } : {})
  }
  return `---\n${toYaml(data)}\n---\n${body ?? `\n# ${doc.title}\n\n## ${notesHeading}\n\n`}`
}

const text = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '')

/** Une fiche relue de son en-tête ; `null` si ce n'est pas celle d'un document de la bibliothèque. */
export function readRecord(record: string, data: Record<string, unknown> | null): LibraryDoc | null {
  if (!data || data['bp-type'] !== RECORD_TYPE) return null
  const file = unlink(data.fichier)
  const origins = Array.isArray(data.origines)
    ? data.origines.flatMap((raw): DocOrigin[] => {
        if (typeof raw !== 'object' || raw === null) return []
        const row = raw as Record<string, unknown>
        const target = unlink(row.lien)
        return [{ module: text(row.module), label: text(row.libelle), ...(target ? { link: target } : {}) }]
      })
    : []
  const previous = unlink(data.precedent)
  const likelyPrevious = unlink(data.precedentProbable)
  const family = text(data.famille) as DocFamily
  return {
    record,
    title: text(data.titre) || titleFromName(file),
    file,
    family: FAMILIES.includes(family) ? family : familyOf(file),
    size: Number(data.taille) || 0,
    hash: text(data.sha256),
    added: text(data.ajoute),
    category: text(data.categorie),
    reference: text(data.reference),
    edition: text(data.edition),
    revision: text(data.revision),
    issuer: text(data.emetteur),
    tags: Array.isArray(data.etiquettes) ? data.etiquettes.map(text).filter(Boolean) : [],
    origins,
    ...(previous ? { previous } : {}),
    ...(likelyPrevious ? { likelyPrevious } : {}),
    copied: data.copie === true,
    ...(isLanguage(data.langue) ? { language: data.langue } : {}),
    ...(data.langueAConfirmer === true ? { languageToConfirm: true } : {}),
    ...(data.langueAConfirmer === true && isLanguage(data.langueProbable) ? { languageProbable: data.langueProbable } : {})
  }
}

/** Une taille lisible : « 12 Ko », « 3,4 Mo ». */
export function readableSize(bytes: number, locale = 'fr-FR'): string {
  const units = ['o', 'Ko', 'Mo', 'Go']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString(locale, { maximumFractionDigits: unit && value < 10 ? 1 : 0 })} ${units[unit]}`
}

/** La version d'un document : « édition-révision », ou ce qu'il en a. */
export const versionLabel = (doc: Pick<LibraryDoc, 'edition' | 'revision'>): string => [doc.edition, doc.revision].filter(Boolean).join('-')
