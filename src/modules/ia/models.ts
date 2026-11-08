// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Un modèle par usage, comme dans la version complète : le serveur d'IA d'une entreprise
 * en propose souvent plusieurs, et chacun a son métier — un modèle qui raisonne pour
 * l'analyse, un plus rapide pour traduire, un modèle de vecteurs (embeddings) pour
 * comparer par le sens, un reranker pour remettre les passages trouvés dans l'ordre, un
 * modèle d'OCR pour lire le texte des scans, un modèle de vision pour comprendre une image
 * (un schéma, un plan, une photo).
 *
 * Les noms ne se tapent pas : « Tester la connexion » retient la liste du serveur, et
 * chaque usage propose ceux qui lui conviennent (d'après leur nom ; s'il n'y en a aucun,
 * tous). Un usage facultatif laissé vide prend un autre modèle — la traduction et la
 * vision celui d'analyse, l'OCR celui de vision — ou n'est pas utilisé (vecteurs, reranking).
 */

export const MODEL_USES = ['text', 'translate', 'embedding', 'rerank', 'ocr', 'vision'] as const
export type ModelUse = (typeof MODEL_USES)[number]

/** La clé de réglage de chaque usage. */
export const MODEL_KEYS: Record<ModelUse, string> = {
  text: 'modele',
  translate: 'modeleTraduction',
  embedding: 'modeleEmbeddings',
  rerank: 'modeleReranking',
  ocr: 'modeleOcr',
  vision: 'modeleVision'
}

/** La liste des modèles du serveur, retenue au dernier test de connexion. */
export const LISTED_KEY = 'modelesServeur'

/** Les modèles qui répondent autre chose qu'un texte : vecteurs, reranking, parole. */
const NOT_CHAT = /embed|rerank|whisper|\btts\b|speech|transcri|moderation|\bbge\b|\be5\b|\bgte\b/i
const EMBEDDING = /embed|\bbge\b|bge-|\be5\b|e5-|\bgte\b|gte-|nomic|minilm|mpnet|sentence/i
const RERANK = /rerank/i
const OCR = /ocr|nougat|got-|olmocr|dots\.?ocr|docling|surya|paddle/i
const VISION = /vision|\bvl\b|-vl|vl-|pixtral|llava|gemma-?3|qwen2?\.?5?-?vl|minicpm-v|internvl|molmo|llama-?4/i

const tests: Record<ModelUse, (name: string) => boolean> = {
  // Un modèle d'OCR pur lit des pages ; il ne tient pas une analyse.
  text: (name) => !NOT_CHAT.test(name) && !OCR.test(name),
  translate: (name) => !NOT_CHAT.test(name) && !OCR.test(name),
  embedding: (name) => EMBEDDING.test(name) && !RERANK.test(name),
  rerank: (name) => RERANK.test(name),
  ocr: (name) => OCR.test(name) || VISION.test(name),
  vision: (name) => VISION.test(name) && !OCR.test(name)
}

/** Les modèles du serveur qui conviennent à un usage, une fois chacun, triés ; tous si aucun ne convient. */
export function modelsFor(use: ModelUse, listed: readonly string[]): string[] {
  const all = [...new Set(listed.map((name) => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const fitting = all.filter(tests[use])
  return fitting.length ? fitting : all
}

/** Les usages auxquels un modèle convient, d'après son nom (aucun : on ne sait pas). */
export function usesOf(name: string): ModelUse[] {
  return MODEL_USES.filter((use) => tests[use](name))
}

/** Les modèles du serveur déjà vus (pour signaler les nouveaux). */
export const KNOWN_KEY = 'modelesConnus'

/** La liste retenue dans les réglages. */
export function listedModels(settings: Readonly<Record<string, unknown>>): string[] {
  const stored = settings[LISTED_KEY]
  return Array.isArray(stored) ? stored.filter((each): each is string => typeof each === 'string') : []
}
