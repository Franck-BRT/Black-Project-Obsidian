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
