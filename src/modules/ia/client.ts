// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Parler au serveur d'IA de l'entreprise, compatible OpenAI, par le
 * port réseau de la plateforme (`Platform.http`) : le même code dans Obsidian, dans
 * l'application de bureau et dans les tests. Sans flux (une réponse en une fois) : ce dont
 * l'analyse d'un dossier a besoin, c'est d'une réponse juste, pas d'une réponse qui
 * s'écrit sous les yeux.
 *
 * Inspiré du client de la version complète de Black Projects (Black Room Technologies) :
 * même protocole (`protocol.ts`), mêmes messages d'erreur utiles, même repli quand le
 * serveur refuse le format JSON imposé.
 */

import type { Http } from '../../core/ports'
import type { ModelUse } from './models'
import {
  buildChatBody,
  buildEmbeddingBody,
  buildRerankBody,
  joinUrl,
  LlmError,
  parseJsonContent,
  readChatContent,
  readFinish,
  readEmbeddings,
  readModels,
  readRerank,
  type ChatMessage,
  type ChatRequest
} from './protocol'

export interface AiConnection {
  /** L'adresse du serveur, jusqu'à `/v1`. */
  baseUrl: string
  /** Le modèle d'analyse : relecture, questions au dossier ; le modèle par défaut. */
  model: string
  /** Le modèle de traduction ; vide : celui d'analyse. */
  translateModel: string
  /** Le modèle de vecteurs (embeddings), pour comparer par le sens ; vide : pas de comparaison par le sens. */
  embeddingModel: string
  /** Le modèle de reranking, qui remet les passages trouvés dans l'ordre ; vide : l'ordre de la recherche. */
  rerankModel: string
  /** Le modèle qui lit le texte des images (scans) ; vide : celui de vision. */
  ocrModel: string
  /** Le modèle qui comprend les images (schémas, plans, photos) ; vide : celui d'analyse. */
  visionModel: string
  /** La clé, lue dans le trousseau ; vide si le serveur n'en demande pas. */
  apiKey: string
  /** Le nombre de mots (jetons) au plus d'une réponse ; 0 : celui du serveur. */
  maxTokens: number
}

/** Ce qu'un échec HTTP veut dire, en une phrase sur laquelle on peut agir. */
export function describeHttp(status: number, body: string): string {
  const detail = body.trim().slice(0, 200)
  const more = detail ? ` — ${detail}` : ''
  if (status === 404) return `Introuvable (404). Vérifiez que l’adresse se termine par /v1.${more}`
  if (status === 401 || status === 403) return `Refusé (${status}). Le serveur demande une clé : vérifiez celle du trousseau.`
  if (status === 400 || status === 422) return `Requête rejetée (${status}).${more}`
  if (status === 502 || status === 504) return `Le serveur n’a pas pu joindre le modèle (${status}). Vérifiez le nom du modèle.${more}`
  if (status >= 500) return `Le serveur a échoué (${status}).${more}`
  return `Réponse inattendue (${status}).${more}`
}

/** Le format de la demande, plutôt que la question, a-t-il échoué ? On redemande alors en clair. */
function worthRetryingWithoutSchema(error: unknown): boolean {
  if (!(error instanceof LlmError)) return false
  if (error.kind === 'shape') return true
  return error.kind === 'http' && (error.status === 400 || error.status === 422 || error.status === 500 || error.status === 502)
}

/** Le schéma écrit dans la consigne, pour un serveur qui ne le prend pas en paramètre. */
function askForJson(messages: ChatMessage[], schema: unknown): ChatMessage[] {
  const instruction = [
    'Réponds uniquement en JSON : pas de texte avant, pas de texte après, pas de bloc de code.',
    `Le JSON doit suivre ce schéma : ${JSON.stringify(schema)}`
  ].join('\n')
  const first = messages[0]
  if (first?.role === 'system') return [{ role: 'system', content: `${first.content}\n${instruction}` }, ...messages.slice(1)]
  return [{ role: 'system', content: instruction }, ...messages]
}

/** Le rôle (un persona) dit avant toute autre consigne : en tête du message système. */
function withRole(messages: ChatMessage[], role: string): ChatMessage[] {
  if (!role.trim()) return messages
  const first = messages[0]
  if (first?.role === 'system') return [{ role: 'system', content: `${role}\n\n${first.content}` }, ...messages.slice(1)]
  return [{ role: 'system', content: role }, ...messages]
}

export class AiClient {
  constructor(
    private readonly http: Http,
    readonly connection: AiConnection,
    /** Le persona dans lequel le modèle répond (ses consignes) ; vide : aucun. */
    readonly persona = '',
    /** D'autres consignes, données après le rôle (un skill, un prompt de la bibliothèque) ; vide : aucune. */
    readonly instructions = ''
  ) {}

  /** Le même client, qui répond dans le rôle d'un persona (ses consignes, avant les autres) ; les autres consignes restent. */
  withPersona(instructions: string): AiClient {
    return new AiClient(this.http, this.connection, instructions.trim(), this.instructions)
  }

  /** Le même client, avec d'autres consignes encore (un skill, un prompt de la bibliothèque) ; vide : le même. */
  withInstructions(instructions: string | undefined): AiClient {
    const extra = (instructions ?? '').trim()
    return extra ? new AiClient(this.http, this.connection, this.persona, [this.instructions, extra].filter(Boolean).join('\n\n')) : this
  }

  get configured(): boolean {
    return this.connection.baseUrl.trim() !== '' && this.connection.model.trim() !== ''
  }

  private async send(path: string, method: 'GET' | 'POST', body?: unknown): Promise<unknown> {
    const base = this.connection.baseUrl.trim()
    if (!base) throw new LlmError('disabled', 'Aucun serveur d’IA n’est réglé.')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const key = this.connection.apiKey.trim()
    if (key) headers.Authorization = `Bearer ${key}`
    let response
    try {
      response = await this.http.request({
        url: joinUrl(base, path),
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      })
    } catch (error) {
      throw new LlmError('unreachable', `Le serveur ne répond pas : ${error instanceof Error ? error.message : String(error)}`)
    }
    if (response.status < 200 || response.status >= 300) {
      throw new LlmError('http', describeHttp(response.status, response.text), response.status)
    }
    try {
      return JSON.parse(response.text) as unknown
    } catch {
      throw new LlmError('shape', 'Le serveur a répondu autre chose que du JSON.')
    }
  }

  /** Les modèles que le serveur propose ; c'est aussi le test de connexion. */
  async models(): Promise<string[]> {
    return readModels(await this.send('models', 'GET'))
  }

  private withDefaults(request: Omit<ChatRequest, 'model'> & { model?: string }): ChatRequest {
    return {
      ...request,
      model: request.model ?? this.connection.model,
      ...(request.maxTokens === undefined && this.connection.maxTokens ? { maxTokens: this.connection.maxTokens } : {})
    }
  }

  /** La réponse du modèle, en texte. */
  async chat(request: Omit<ChatRequest, 'model'> & { model?: string }): Promise<string> {
    return (await this.reply(request)).text
  }

  /**
   * La réponse du modèle, et pourquoi il s'est arrêté : `stop`, il avait fini ; `length`, la
   * limite de longueur l'a coupé (un modèle qui boucle s'arrête ainsi) ; '' s'il ne le dit pas.
   */
  async reply(request: Omit<ChatRequest, 'model'> & { model?: string }): Promise<{ text: string; finish: string }> {
    // Le rôle, puis les autres consignes, en tête du message système.
    const preamble = [this.persona, this.instructions].filter((part) => part.trim()).join('\n\n')
    const asked = preamble ? { ...request, messages: withRole(request.messages, preamble) } : request
    const payload = await this.send('chat/completions', 'POST', buildChatBody(this.withDefaults(asked)))
    return { text: readChatContent(payload), finish: readFinish(payload) }
  }

  /**
   * Une réponse en JSON, selon un schéma. D'abord en l'imposant au serveur ; s'il refuse
   * ce format, la même question, le schéma écrit dans la consigne.
   */
  async chatJson<T>(request: Omit<ChatRequest, 'model'> & { model?: string; schema: { name: string; schema: unknown } }): Promise<T> {
    try {
      return parseJsonContent<T>(await this.chat(request))
    } catch (error) {
      if (!worthRetryingWithoutSchema(error)) throw error
      const { schema, ...plain } = request
      return parseJsonContent<T>(await this.chat({ ...plain, messages: askForJson(request.messages, schema.schema) }))
    }
  }

  /** Le modèle d'un usage : celui réglé, sinon celui qui le remplace (OCR → vision → analyse ; traduction → analyse). */
  modelFor(use: ModelUse): string {
    const { model, translateModel, embeddingModel, rerankModel, ocrModel, visionModel } = this.connection
    switch (use) {
      case 'translate':
        return translateModel.trim() || model.trim()
      case 'ocr':
        return ocrModel.trim() || visionModel.trim() || model.trim()
      case 'vision':
        return visionModel.trim() || model.trim()
      case 'embedding':
        return embeddingModel.trim()
      case 'rerank':
        return rerankModel.trim()
      default:
        return model.trim()
    }
  }

  /**
   * La pertinence de chaque texte pour la question, dans l'ordre où ils sont donnés, par le
   * modèle de reranking (`/rerank`, à la manière de Cohere et vLLM).
   */
  async rerank(query: string, documents: string[]): Promise<number[]> {
    const model = this.connection.rerankModel.trim()
    if (!model) throw new LlmError('disabled', 'Aucun modèle de reranking n’est réglé.')
    if (documents.length === 0) return []
    return readRerank(await this.send('rerank', 'POST', buildRerankBody(model, query, documents)), documents.length)
  }

  /** Les vecteurs de textes, pour les comparer par le sens. */
  async embed(input: string[]): Promise<number[][]> {
    const model = this.connection.embeddingModel.trim()
    if (!model) throw new LlmError('disabled', 'Aucun modèle d’embeddings n’est réglé.')
    if (input.length === 0) return []
    return readEmbeddings(await this.send('embeddings', 'POST', buildEmbeddingBody(model, input)))
  }
}
