// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **langue** d'un document, devinée de ce qu'il dit : aux petits mots dont toute phrase
 * d'une langue est pleine — articles, prépositions, auxiliaires —, propres à chacune autant
 * que possible. Un texte trop court, ou trop partagé entre deux langues, n'est pas tranché :
 * la langue reste **à confirmer** par l'utilisateur, avec, quand il y en a une, la langue
 * **probable** à lui proposer.
 */

/** Les langues reconnues, par leur code. */
export const LANGUAGES = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl'] as const
export type LanguageCode = (typeof LANGUAGES)[number]

const WORDS: Readonly<Record<LanguageCode, readonly string[]>> = {
  fr: ['le', 'les', 'des', 'et', 'est', 'une', 'du', 'dans', 'pour', 'qui', 'sur', 'pas', 'au', 'avec', 'sont', 'ce', 'cette', 'aux', 'nous', 'ou', 'etre', 'doit'],
  en: ['the', 'and', 'of', 'to', 'is', 'that', 'for', 'are', 'with', 'as', 'on', 'be', 'this', 'by', 'it', 'not', 'from', 'which', 'shall', 'an'],
  de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'zu', 'den', 'mit', 'von', 'dem', 'ein', 'eine', 'fur', 'auf', 'sich', 'auch', 'wird', 'werden', 'oder'],
  es: ['el', 'los', 'las', 'y', 'es', 'por', 'para', 'con', 'del', 'se', 'al', 'como', 'mas', 'pero', 'su', 'sus', 'esta', 'lo', 'entre', 'debe'],
  it: ['il', 'di', 'che', 'e', 'per', 'non', 'sono', 'della', 'gli', 'delle', 'nel', 'alla', 'anche', 'questo', 'essere', 'dei', 'ha', 'deve', 'degli', 'nella'],
  pt: ['o', 'os', 'do', 'da', 'em', 'um', 'uma', 'com', 'nao', 'dos', 'das', 'na', 'no', 'ao', 'pelo', 'pela', 'sao', 'mais', 'deve', 'sera'],
  nl: ['het', 'een', 'en', 'van', 'is', 'dat', 'op', 'te', 'niet', 'voor', 'met', 'zijn', 'worden', 'wordt', 'ook', 'bij', 'aan', 'deze', 'naar', 'moet']
}
const SETS = LANGUAGES.map((code) => [code, new Set(WORDS[code])] as const)

/** Ce qui est regardé : assez pour trancher, pas tant qu'un long document soit long à lire. */
const SAMPLE = 20_000
/**
 * Pour trancher : au moins tant de petits mots de la langue, et trois fois plus que la
 * suivante — un texte d'une seule langue n'a presque rien d'une autre ; un document
 * bilingue (moitié-moitié, ou presque) reste à confirmer.
 */
const ENOUGH = 8
const AHEAD = 3
/** Pour proposer une langue probable (à confirmer) : quelques-uns, et devant la suivante. */
const SOME = 3

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export interface LanguageGuess {
  /** La langue, quand la détection est assez sûre ; vide sinon. */
  language: LanguageCode | ''
  /** Pas assez sûre : la langue la plus probable, à proposer ; vide s'il n'y en a pas. */
  probable: LanguageCode | ''
}

/** Deviner la langue d'un texte. */
export function detectLanguage(text: string): LanguageGuess {
  const words = fold(text.slice(0, SAMPLE)).split(/[^a-z]+/)
  const scores = SETS.map(([code, set]) => [code, words.reduce((sum, word) => sum + (set.has(word) ? 1 : 0), 0)] as const).sort((a, b) => b[1] - a[1])
  const [best, next] = [scores[0]!, scores[1]!]
  if (best[1] >= ENOUGH && best[1] >= next[1] * AHEAD) return { language: best[0], probable: '' }
  return { language: '', probable: best[1] >= SOME && best[1] > next[1] ? best[0] : '' }
}

export const isLanguage = (value: unknown): value is LanguageCode => typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
