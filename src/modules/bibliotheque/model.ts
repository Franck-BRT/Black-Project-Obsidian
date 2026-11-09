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

/** Ce qu'a donné la lecture du fichier — comme pour les pièces d'une analyse. */
export type TranscriptState = 'lue' | 'sans-texte' | 'image' | 'non-lue' | 'illisible'
export const TRANSCRIPT_STATES: readonly TranscriptState[] = ['lue', 'sans-texte', 'image', 'non-lue', 'illisible']

/** Le texte d'un fichier, ou pourquoi il n'y en a pas. */
export interface Transcript {
  state: TranscriptState
  text: string
}

/**
 * Une **version du texte** d'un document : le texte extrait du fichier (1), puis ceux qui le
 * suivent — relu par l'IA, extrait de nouveau. Chacune sa note, gardée : on retrouve le texte
 * d'avant l'IA, on compare. La fiche montre la dernière. L'édition et la révision du
 * document, elles, ne changent pas.
 */
/** Une lecture par l'IA du texte d'un document : lequel, et où elle en est (« page 2 sur 5 »). */
export interface AiReading {
  record: string
  title: string
  detail: string
}

export interface TextVersion {
  /** Sa note. */
  path: string
  number: number
  /** D'où vient ce texte : extrait du fichier, ou relu par l'IA. */
  origin: 'extraction' | 'ia'
  date: string
  /** Relu par l'IA : le modèle, et ce qui l'a guidée (prompt, persona, skill). */
  model?: string
  prompt?: string
  persona?: string
  skill?: string
  /** Relu par l'IA : les morceaux gardés tels quels (une réponse qui résumait, ajoutait). */
  kept?: number
  /** Lu par l'IA avec la vision : les pages du document regardées en images (leur nombre). */
  vision?: number
  text: string
}

export const TEXT_VERSION_TYPE = 'bibliotheque-texte'
/** Le dossier des versions du texte des documents, à côté de leurs fiches. */
export const TEXT_VERSIONS_FOLDER = '_textes'

/** La note d'une version du texte : son en-tête (d'où elle vient), puis le texte. */
export function textVersionContent(version: Omit<TextVersion, 'path'>, record: string): string {
  const data: Record<string, unknown> = {
    'bp-type': TEXT_VERSION_TYPE,
    document: link(record),
    version: version.number,
    origine: version.origin,
    date: version.date,
    ...(version.model ? { modele: version.model } : {}),
    ...(version.prompt ? { prompt: version.prompt } : {}),
    ...(version.persona ? { persona: version.persona } : {}),
    ...(version.skill ? { skill: version.skill } : {}),
    ...(version.kept ? { gardes: version.kept } : {}),
    ...(version.vision ? { vision: version.vision } : {})
  }
  return `---\n${toYaml(data)}\n---\n\n${version.text.trim()}\n`
}

/** Une version du texte relue de sa note ; `null` si ce n'en est pas une. */
export function readTextVersion(path: string, data: Record<string, unknown> | null, body: string): TextVersion | null {
  if (!data || data['bp-type'] !== TEXT_VERSION_TYPE) return null
  const plain = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '')
  return {
    path,
    number: Number(data.version) || 0,
    origin: data.origine === 'ia' ? 'ia' : 'extraction',
    date: plain(data.date),
    ...(plain(data.modele) ? { model: plain(data.modele) } : {}),
    ...(plain(data.prompt) ? { prompt: plain(data.prompt) } : {}),
    ...(plain(data.persona) ? { persona: plain(data.persona) } : {}),
    ...(plain(data.skill) ? { skill: plain(data.skill) } : {}),
    ...(Number(data.gardes) ? { kept: Number(data.gardes) } : {}),
    ...(Number(data.vision) ? { vision: Number(data.vision) } : {}),
    text: body.trim()
  }
}

/** Le texte extrait, dans la note d'un document : entre ces marques (le reste de la note est à l'utilisateur). */
export const TEXT_START = '<!-- bp:texte:debut — texte extrait du fichier, tenu à jour par Black Projects ; ne pas modifier entre ces marques -->'
export const TEXT_END = '<!-- bp:texte:fin -->'

/** Les titres du texte extrait, descendus de deux niveaux pour tenir sous « Texte extrait » (comme pour une pièce d'analyse). */
export function nestHeadings(text: string): string {
  return text.replace(/^(#{1,6}) /gm, (_, hashes: string) => `${'#'.repeat(Math.min(6, hashes.length + 2))} `)
}

/** La note d'un document, son texte extrait mis (ou remis) entre ses marques — à la fin, la première fois. */
export function withTranscript(body: string, block: string): string {
  const start = body.indexOf(TEXT_START)
  const end = body.indexOf(TEXT_END)
  const wrapped = `${TEXT_START}\n${block.trim()}\n${TEXT_END}`
  if (start !== -1 && end > start) return body.slice(0, start) + wrapped + body.slice(end + TEXT_END.length)
  return `${body.trimEnd()}\n\n${wrapped}\n`
}

/** Ce qui est entre les marques du texte extrait ; `null` s'il n'y en a pas. */
export function transcriptBlockOf(body: string): string | null {
  const start = body.indexOf(TEXT_START)
  const end = body.indexOf(TEXT_END)
  return start !== -1 && end > start ? body.slice(start + TEXT_START.length, end).trim() : null
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
  /** Sa langue a été identifiée par l'IA (la détection sans IA n'était pas sûre). */
  languageByAi?: boolean
  /** Sa référence et sa version n'ont pas été lues sûrement (absentes, ou du seul nom du fichier) : à confirmer. */
  identityToConfirm?: boolean
  /** Sa référence et sa version ont été identifiées par l'IA. */
  identityByAi?: boolean
  /** Son titre n'a pas été lu sûrement dans le document (il vient du nom du fichier) : à confirmer, avec le titre probable lu, s'il y en a un. */
  titleToConfirm?: boolean
  titleProbable?: string
  /** Son titre a été identifié par l'IA. */
  titleByAi?: boolean
  /** Son émetteur n'a pas été lu sûrement dans le document : à confirmer, avec l'émetteur probable lu, s'il y en a un. */
  issuerToConfirm?: boolean
  issuerProbable?: string
  /** Son émetteur a été identifié par l'IA. */
  issuerByAi?: boolean
  /** Sa catégorie n'a pas été établie sûrement (le nom du fichier seul, ou rien) : à confirmer, avec celle que le texte suggère. */
  categoryToConfirm?: boolean
  categoryProbable?: string
  /** Sa catégorie a été identifiée par l'IA. */
  categoryByAi?: boolean
  /** Sa date (édition, publication, signature) : `AAAA-MM-JJ`, ou `AAAA-MM` ; absente : pas connue. */
  date?: string
  /** Sa date n'a pas été lue sûrement : à confirmer, avec celle que le texte suggère. */
  dateToConfirm?: boolean
  dateProbable?: string
  /** Sa date a été identifiée par l'IA. */
  dateByAi?: boolean
  /** Son texte extrait (dans sa note) : comment s'est passée la lecture, combien de caractères. */
  reading?: TranscriptState
  characters?: number
  /** La version de son texte que montre sa fiche (ses versions : des notes à part) ; absente, le texte extrait du fichier, seul. */
  textVersion?: number
  /** Ses étiquettes n'ont pas été lues sûrement : à confirmer, avec celles que le texte suggère. */
  tagsToConfirm?: boolean
  tagsProbable?: string[]
  /** Ses étiquettes ont été données par l'IA. */
  tagsByAi?: boolean
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
    ...(doc.language && doc.languageByAi ? { langueIdentifieePar: 'ia' } : {}),
    ...(doc.languageToConfirm ? { langueAConfirmer: true } : {}),
    ...(doc.languageToConfirm && doc.languageProbable ? { langueProbable: doc.languageProbable } : {}),
    ...(doc.identityToConfirm ? { identiteAConfirmer: true } : {}),
    ...(doc.identityByAi ? { identiteIdentifieePar: 'ia' } : {}),
    ...(doc.titleToConfirm ? { titreAConfirmer: true } : {}),
    ...(doc.titleToConfirm && doc.titleProbable ? { titreProbable: doc.titleProbable } : {}),
    ...(doc.titleByAi ? { titreIdentifiePar: 'ia' } : {}),
    ...(doc.issuerToConfirm ? { emetteurAConfirmer: true } : {}),
    ...(doc.issuerToConfirm && doc.issuerProbable ? { emetteurProbable: doc.issuerProbable } : {}),
    ...(doc.issuerByAi ? { emetteurIdentifiePar: 'ia' } : {}),
    ...(doc.categoryToConfirm ? { categorieAConfirmer: true } : {}),
    ...(doc.categoryToConfirm && doc.categoryProbable ? { categorieProbable: doc.categoryProbable } : {}),
    ...(doc.categoryByAi ? { categorieIdentifieePar: 'ia' } : {}),
    ...(doc.date ? { dateDocument: doc.date } : {}),
    ...(doc.dateToConfirm ? { dateAConfirmer: true } : {}),
    ...(doc.dateToConfirm && doc.dateProbable ? { dateProbable: doc.dateProbable } : {}),
    ...(doc.dateByAi ? { dateIdentifieePar: 'ia' } : {}),
    ...(doc.reading ? { lecture: doc.reading, caracteres: doc.characters ?? 0 } : {}),
    ...(doc.textVersion ? { texteVersion: doc.textVersion } : {}),
    ...(doc.tagsToConfirm ? { etiquettesAConfirmer: true } : {}),
    ...(doc.tagsToConfirm && doc.tagsProbable?.length ? { etiquettesProbables: doc.tagsProbable } : {}),
    ...(doc.tagsByAi ? { etiquettesIdentifieesPar: 'ia' } : {})
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
    ...(isLanguage(data.langue) && data.langueIdentifieePar === 'ia' ? { languageByAi: true } : {}),
    ...(data.langueAConfirmer === true ? { languageToConfirm: true } : {}),
    ...(data.langueAConfirmer === true && isLanguage(data.langueProbable) ? { languageProbable: data.langueProbable } : {}),
    ...(data.identiteAConfirmer === true ? { identityToConfirm: true } : {}),
    ...(data.identiteIdentifieePar === 'ia' ? { identityByAi: true } : {}),
    ...(data.titreAConfirmer === true ? { titleToConfirm: true } : {}),
    ...(data.titreAConfirmer === true && typeof data.titreProbable === 'string' && data.titreProbable.trim() ? { titleProbable: data.titreProbable.trim() } : {}),
    ...(data.titreIdentifiePar === 'ia' ? { titleByAi: true } : {}),
    ...(data.emetteurAConfirmer === true ? { issuerToConfirm: true } : {}),
    ...(data.emetteurAConfirmer === true && typeof data.emetteurProbable === 'string' && data.emetteurProbable.trim() ? { issuerProbable: data.emetteurProbable.trim() } : {}),
    ...(data.emetteurIdentifiePar === 'ia' ? { issuerByAi: true } : {}),
    ...(data.categorieAConfirmer === true ? { categoryToConfirm: true } : {}),
    ...(data.categorieAConfirmer === true && typeof data.categorieProbable === 'string' && data.categorieProbable.trim() ? { categoryProbable: data.categorieProbable.trim() } : {}),
    ...(data.categorieIdentifieePar === 'ia' ? { categoryByAi: true } : {}),
    ...(text(data.dateDocument) ? { date: text(data.dateDocument) } : {}),
    ...(data.dateAConfirmer === true ? { dateToConfirm: true } : {}),
    ...(data.dateAConfirmer === true && text(data.dateProbable) ? { dateProbable: text(data.dateProbable) } : {}),
    ...(data.dateIdentifieePar === 'ia' ? { dateByAi: true } : {}),
    ...(TRANSCRIPT_STATES.includes(data.lecture as TranscriptState) ? { reading: data.lecture as TranscriptState, characters: Number(data.caracteres) || 0 } : {}),
    ...(Number(data.texteVersion) ? { textVersion: Number(data.texteVersion) } : {}),
    ...(data.etiquettesAConfirmer === true ? { tagsToConfirm: true } : {}),
    ...(data.etiquettesAConfirmer === true && Array.isArray(data.etiquettesProbables) && data.etiquettesProbables.length ? { tagsProbable: data.etiquettesProbables.map(text).filter(Boolean) } : {}),
    ...(data.etiquettesIdentifieesPar === 'ia' ? { tagsByAi: true } : {})
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
