// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Comparer des textes sans IA : les ramener à leurs mots porteurs de sens (sans accents,
 * sans majuscules, sans mots vides), puis compter ce qu'ils ont en commun. Simple,
 * explicable, et le même résultat d'une fois à l'autre ; l'IA l'affinera avec
 * la matrice de conformité (étape 7).
 */

const STOPWORDS = new Set(
  (
    'le la les un une des du de d l au aux et ou ni mais donc or car que qui quoi dont ou en dans sur sous par pour avec sans ' +
    'ce cet cette ces son sa ses leur leurs notre nos votre vos mon ma mes ton ta tes il elle ils elles on nous vous je tu se ' +
    'est sont etre ete sera seront a ont avoir avait fait faire doit doivent devra devront peut peuvent pourra pourront ' +
    'tout tous toute toutes autre autres meme plus moins tres bien ainsi aussi alors si ne pas non y ' +
    'the a an of to in on at by for with without and or nor but if then than that this these those it its is are be been ' +
    'shall must will should may can could would has have had do does not no as from into over under per each any all'
  ).split(' ')
)

/** Un texte sans accents, en minuscules, la ponctuation remplacée par des espaces. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9%,.]+/g, ' ')
    .replace(/(?<!\d)[,.]|[,.](?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Les mots porteurs de sens d'un texte : sans mots vides ni mots d'une lettre ; les nombres gardés. */
export function keywords(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((word) => (word.length > 2 || /\d/.test(word)) && !STOPWORDS.has(word))
  )
}

/** La part des mots de `of` qu'on retrouve dans `in` (0 à 1). */
export function overlap(of: ReadonlySet<string>, inside: ReadonlySet<string>): number {
  if (of.size === 0) return 0
  let found = 0
  for (const word of of) if (inside.has(word)) found += 1
  return found / of.size
}

/** Deux formulations disent-elles la même chose, aux espaces et à la casse près ? */
export function sameWording(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b)
}

/** Un texte en phrases : coupé après un point, un point d'exclamation ou d'interrogation, ou un point-virgule. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+(?=[A-ZÀ-ÝÉÈ«"(\-–•])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

/**
 * Les tournures qui font une exigence : « doit », « devra », « est tenu de », « s'engage
 * à », « il est exigé », « obligatoirement »… et, en anglais, « shall », « must », « is
 * required to ».
 */
const NORMATIVE = [
  /\bdoi(?:t|vent)\b/i,
  /\bdevr(?:a|ont)\b/i,
  /\b(?:est|sont) tenue?s? (?:de|d['’])/i,
  /\bs['’]engagen?t? [àa]\b/i,
  /\bil (?:est|sera) (?:exig[ée]|demand[ée]|requis|attendu)\b/i,
  /\b(?:est|sont|sera|seront) (?:exig[ée]e?s?|requise?s?|obligatoires?)\b/i,
  /\bobligatoirement\b/i,
  /\bimp[ée]rativement\b/i,
  /\bil appartient au (?:titulaire|prestataire|fournisseur|candidat)\b/i,
  /\bshall\b/i,
  /\bmust\b/i,
  /\bis required to\b/i,
  /\bare required to\b/i
]

/** La tournure normative d'une phrase, si elle en a une. */
export function normativeMarker(sentence: string): string | null {
  for (const pattern of NORMATIVE) {
    const found = pattern.exec(sentence)
    if (found) return found[0]
  }
  return null
}
