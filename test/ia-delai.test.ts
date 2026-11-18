// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Un serveur d'IA trop lent** (504, délai dépassé) : le message le dit (et non « le modèle
 * introuvable »), sans la page HTML de la passerelle ; la relecture d'un texte coupe en deux la
 * partie que le serveur ne relit pas à temps — et, trop courte pour l'être encore, la garde telle
 * qu'extraite : le document n'est plus bloqué à l'ingestion.
 */

import { describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { HttpRequest } from '../src/core/ports'
import { AiClient, describeHttp, halve, iaModule, proofreadDocument, SPLIT_ABOVE } from '../src/modules/ia'

const NGINX = '<html>\r\n<head><title>504 Gateway Time-out</title></head>\r\n<body>\r\n<center><h1>504 Gateway Time-out</h1></center>\r\n<hr><center>nginx/1.20.1</center>\r\n</body>\r\n</html>\r\n<!-- a padding to disable MSIE and Chrome friendly error page -->'
const CONNECTION = { baseUrl: 'http://ia.exemple.fr/v1', model: 'mistral-small', translateModel: '', embeddingModel: '', rerankModel: '', ocrModel: '', visionModel: '', apiKey: '', maxTokens: 0 }
const chat = (content: string) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) })
const paragraph = (n: number) => `Paragraphe ${n}. ${'La station sol reçoit les données du satellite et les transmet au centre de contrôle. '.repeat(5)}`.trim()
const TEXT = [1, 2, 3, 4].map(paragraph).join('\n\n')

/** Un serveur qui relit tel quel ; au-delà de `limit` caractères demandés, il ne répond pas à temps (504). */
function server(limit: number) {
  const asked: number[] = []
  const http = {
    request: async (request: HttpRequest) => {
      const messages = (JSON.parse(request.body!) as { messages: { role: string; content: string }[] }).messages
      const user = messages.at(-1)!.content
      // La vérification : une note.
      if (user.startsWith('L’original :')) return chat('{"score": 95, "problems": []}')
      const chunk = user.startsWith('(Morceau') ? user.split('\n\n').slice(1).join('\n\n') : user
      asked.push(chunk.length)
      return chunk.length > limit ? { status: 504, text: NGINX } : chat(chunk)
    }
  }
  return { client: new AiClient(http, CONNECTION), asked }
}

function context() {
  const i18n = createI18n('fr')
  i18n.register('fr', iaModule.texts.fr)
  const t = i18n.t.bind(i18n)
  const notices: string[] = []
  return { notices, context: { t, title: 'Note station', notify: (text: string) => void notices.push(text), progress: () => {}, describe: (error: unknown) => (error instanceof Error ? error.message : String(error)) } }
}

describe('un serveur d’IA trop lent (504)', () => {
  it('le message dit le délai dépassé, sans la page HTML de la passerelle', () => {
    const text = describeHttp(504, NGINX)
    expect(text).toBe('Le serveur d’IA a mis trop de temps à répondre (504 : délai dépassé). La demande était sans doute trop longue pour lui. — 504 Gateway Time-out')
    expect(text).not.toContain('<')
    expect(describeHttp(502, '')).toBe('Le serveur n’a pas pu joindre le modèle (502). Vérifiez le nom du modèle.')
  })

  it('un texte coupé en deux : entre deux paragraphes au plus près du milieu, sinon entre deux phrases', () => {
    expect(halve(TEXT)).toEqual([[1, 2].map(paragraph).join('\n\n'), [3, 4].map(paragraph).join('\n\n')])
    const sentences = 'Première phrase assez longue. Deuxième phrase assez longue. Troisième phrase assez longue. Quatrième phrase assez longue.'
    expect(halve(sentences)).toEqual(['Première phrase assez longue. Deuxième phrase assez longue.', 'Troisième phrase assez longue. Quatrième phrase assez longue.'])
    expect(halve('mot')).toBeNull()
  })

  it('la partie que le serveur ne relit pas à temps : coupée en deux, chaque moitié relue', async () => {
    const { client, asked } = server(1000)
    const { context: ctx, notices } = context()
    const read = await proofreadDocument(client, client, TEXT, undefined, ctx)
    expect(asked[0]).toBeGreaterThan(1000)
    expect(read).toMatchObject({ parts: 2, split: 1, slow: 0, kept: 0 })
    expect(read.text).toBe(TEXT)
    expect(notices).toContain('« Note station » : le serveur d’IA n’a pas relu la partie 1 à temps — coupée en deux, chaque moitié relue à son tour.')
  })

  it('jamais à temps, même coupée : le texte extrait gardé tel quel — pas d’erreur, le document n’est pas bloqué', async () => {
    const { client, asked } = server(0)
    const { context: ctx } = context()
    const read = await proofreadDocument(client, client, TEXT, undefined, ctx)
    expect(read.slow).toBe(read.parts)
    expect(read.text).toBe(TEXT)
    // Coupée tant qu'elle dépassait le seuil, puis plus.
    expect(Math.min(...asked)).toBeLessThanOrEqual(SPLIT_ABOVE)
  })
})
