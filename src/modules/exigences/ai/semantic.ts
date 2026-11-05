// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les exigences qui disent la même chose en d'autres mots : leurs formulations converties
 * en vecteurs par le modèle d'embeddings de Sidonie, comparées deux à deux. S'ajoute aux
 * doublons trouvés sur les lettres, dans l'analyse de qualité, quand un modèle d'embeddings
 * est réglé. Sans lui, ou si le serveur ne répond pas, rien de plus : l'analyse reste
 * celle des règles.
 */

import type { AiClient } from '../../ia'
import type { Requirement } from '../model/requirement'
import { semanticPairs, thresholdsFor, type SimilarPair } from '../quality/similar'

/** Formulations envoyées d'un coup au serveur. */
const BATCH = 64

const wordingOf = (requirement: Requirement): string =>
  requirement.text[requirement.sourceLang]?.body ?? Object.values(requirement.text)[0]?.body ?? requirement.title

/** Les paires proches par le sens ; vide sans modèle d'embeddings ou si le serveur échoue. */
export async function semanticDuplicates(client: AiClient | null, requirements: readonly Requirement[]): Promise<SimilarPair[]> {
  if (!client?.connection.embeddingModel.trim()) return []
  const items = requirements.map((requirement) => ({ id: requirement.id, text: wordingOf(requirement).trim() })).filter((item) => item.text)
  if (items.length < 2) return []
  try {
    const vectors: number[][] = []
    for (let at = 0; at < items.length; at += BATCH) vectors.push(...(await client.embed(items.slice(at, at + BATCH).map((item) => item.text))))
    if (vectors.length !== items.length) return []
    return semanticPairs(
      items.map((item, index) => ({ id: item.id, vector: vectors[index]! })),
      thresholdsFor('normal').semantic
    )
  } catch {
    return []
  }
}
