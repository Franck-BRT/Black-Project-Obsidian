// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que le module IA apporte au module Workflows : « Demander à l'IA » — une consigne,
 * un contexte (souvent le résultat d'une étape d'avant, {step1.text}), une réponse que les
 * étapes suivantes reprennent, et, si on le demande, une note où l'écrire.
 */

import type { FileSystem, PageImages } from '../../core/ports'
import { IDENTITY_HEAD, LANGUAGES, addTextVersionByAi, aiReadingEnded, aiReadingProgress, dateFoundIn, issuerLabelIn, knownIssuerCode, libraryDateLabel, libraryIssuers, libraryPieceTypes, libraryTranscript, type KnownIssuer, libraryDoc, libraryDocText, libraryTags, parseDocDate, setCategoryByAi, setDateByAi, setTagsByAi, tagsFoundIn, namedEntry, personaInstructions, referenceFoundIn, setIdentityByAi, setIssuerByAi, setLanguageByAi, setTitleByAi, issuerFoundIn, titleFoundIn, type LanguageCode } from '../bibliotheque'
import { imageDataUrl, isImage, pdfPageTexts } from '../lecture-fichiers'
import { registerAction } from '../workflows'
import type { AiClient } from './client'
import { LlmError } from './protocol'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Ce qu'on donne à l'IA d'un document pour sa langue : le début de son texte, assez pour trancher. */
const LANGUAGE_SAMPLE = 4000

/** La langue que l'IA a dite : un des codes, au début de sa réponse ; « ? » ou autre chose : rien. */
export function readLanguageAnswer(answer: string): LanguageCode | '' {
  // Le premier mot de la réponse, guillemets ôtés : exactement un des codes, sinon rien (« ? », « français », une phrase).
  const word = answer.trim().toLowerCase().replace(/^[«"'`\s]+/, '').match(/^[a-z?]+/)?.[0] ?? ''
  return (LANGUAGES as readonly string[]).includes(word) ? (word as LanguageCode) : ''
}

/** Ce que l'IA rend de la référence et de la version d'un document. */
interface IdentityAnswer {
  reference: string
  edition: string
  revision: string
  certain: boolean
}

const IDENTITY_SCHEMA = {
  name: 'identite_document',
  schema: {
    type: 'object',
    properties: { reference: { type: 'string' }, edition: { type: 'string' }, revision: { type: 'string' }, certain: { type: 'boolean' } },
    required: ['reference', 'edition', 'revision', 'certain'],
    additionalProperties: false
  }
}

/** Une édition ou une révision, comme on la dit : « 02 » → « 2 », « b » → « B » ; trop longue (une phrase) : rien. */
const versionPart = (raw: unknown): string => {
  const clean = typeof raw === 'string' ? raw.trim().replace(/^(?:[ée]dition|issue|r[ée]vision|rev\.?|indice|ind\.?|version|v)\s*/i, '') : ''
  if (!clean || clean.length > 8) return ''
  return /^\d+$/.test(clean) ? String(Number(clean)) : clean.toUpperCase()
}

/**
 * Lire la réponse de l'IA : pas certaine, rien ; une référence qu'on ne retrouve ni dans le
 * texte ni dans le nom du fichier est écartée (l'IA n'invente pas de référence).
 */
export function readIdentityAnswer(answer: unknown, text: string, fileName: string): { reference: string; edition: string; revision: string } | null {
  if (typeof answer !== 'object' || answer === null) return null
  const reply = answer as Partial<IdentityAnswer>
  if (reply.certain !== true) return null
  const reference = typeof reply.reference === 'string' ? reply.reference.trim() : ''
  return {
    reference: reference && reference.length <= 80 && referenceFoundIn(reference, text, fileName) ? reference : '',
    edition: versionPart(reply.edition),
    revision: versionPart(reply.revision)
  }
}

/**
 * Les consignes d'une étape d'IA, tirées de la bibliothèque : le **persona** (le rôle, en
 * tête), le **skill** (la méthode), le **prompt** (une consigne de plus) choisis par leur
 * nom. Un nom qui n'y est plus (ou vide) : une erreur qui le dit — l'étape échoue, le journal
 * l'écrit.
 */
export function libraryGuidance(t: Translate): (chosen: Readonly<Record<string, string>>) => Promise<string> {
  return async (chosen) => {
    const persona = await namedEntry('persona', chosen.persona)
    const skill = await namedEntry('skill', chosen.skill)
    const prompt = await namedEntry('prompt', chosen.prompt)
    return [
      persona ? personaInstructions(persona) : '',
      skill ? `${t('ia.guidance.skill', { name: skill.name })}\n\n${skill.text.trim()}` : '',
      prompt ? `${t('ia.guidance.prompt', { name: prompt.name })}\n\n${prompt.text.trim()}` : ''
    ]
      .filter(Boolean)
      .join('\n\n')
  }
}

const TITLE_SCHEMA = {
  name: 'titre_document',
  schema: { type: 'object', properties: { title: { type: 'string' }, certain: { type: 'boolean' } }, required: ['title', 'certain'], additionalProperties: false }
}

/** Le titre que l'IA a dit : certaine, pas trop long, et fait des mots du document (elle n'invente pas) ; sinon rien. */
export function readTitleAnswer(answer: unknown, text: string, fileName: string): string {
  if (typeof answer !== 'object' || answer === null) return ''
  const reply = answer as { title?: unknown; certain?: unknown }
  if (reply.certain !== true || typeof reply.title !== 'string') return ''
  const title = reply.title.replace(/\s+/g, ' ').replace(/^["«“\s]+|["»”\s.]+$/g, '').trim()
  return title.length >= 3 && title.length <= 150 && titleFoundIn(title, text, fileName) ? title : ''
}

const ISSUER_SCHEMA = {
  name: 'emetteur_document',
  schema: { type: 'object', properties: { issuer: { type: 'string' }, certain: { type: 'boolean' } }, required: ['issuer', 'certain'], additionalProperties: false }
}

/**
 * L'émetteur que l'IA a dit : pas certaine, `null` ; certaine et vide : aucun émetteur (`''`) ;
 * un émetteur de la liste (par son code, son nom, un autre nom) que le document dit : son
 * code ; sinon, gardé s'il n'est pas trop long et que le document le dit (elle n'invente pas).
 */
export function readIssuerAnswer(answer: unknown, text: string, fileName: string, known: readonly KnownIssuer[] = []): string | null {
  if (typeof answer !== 'object' || answer === null) return null
  const reply = answer as { issuer?: unknown; certain?: unknown }
  if (reply.certain !== true || typeof reply.issuer !== 'string') return null
  const issuer = reply.issuer.replace(/\s+/g, ' ').replace(/^["«“\s]+|["»”\s.]+$/g, '').trim()
  if (!issuer) return ''
  // « ESA (Agence spatiale européenne) », « ESA — … » : le code, devant.
  const code = knownIssuerCode(issuer, known) || knownIssuerCode(issuer.split(/\s+[(—–-]\s*/)[0] ?? '', known)
  const listed = known.find((each) => each.code === code)
  if (listed) {
    const said = [listed.name, ...listed.aliases].some((name) => issuerFoundIn(name, text, fileName)) || new RegExp(`(?<![\\p{L}\\p{N}])${listed.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u').test(`${text} ${fileName}`)
    return said ? listed.code : null
  }
  return issuer.length <= 80 && issuerFoundIn(issuer, text, fileName) ? issuer : null
}

const CATEGORY_SCHEMA = {
  name: 'categorie_document',
  schema: { type: 'object', properties: { category: { type: 'string' }, certain: { type: 'boolean' } }, required: ['category', 'certain'], additionalProperties: false }
}

/**
 * Le type de pièce que l'IA a dit : pas certaine, `null` ; certaine et vide : aucun (`''`) ;
 * sinon, un des types proposés — par son code ou son libellé (à la casse près, « CCTP
 * (Cahier…) » aussi) —, rendu par son code ; rien d'autre.
 */
export function readCategoryAnswer(answer: unknown, types: readonly (string | { code: string; label: string })[]): string | null {
  if (typeof answer !== 'object' || answer === null) return null
  const reply = answer as { category?: unknown; certain?: unknown }
  if (reply.certain !== true || typeof reply.category !== 'string') return null
  const clean = (value: string) => value.replace(/^["«“\s]+|["»”\s.]+$/g, '').trim().toLowerCase()
  const wanted = clean(reply.category)
  if (!wanted) return ''
  const listed = types.map((type) => (typeof type === 'string' ? { code: type, label: type } : type))
  const found = (value: string) => listed.find((type) => clean(type.code) === value || clean(type.label) === value)
  // « CCTP (Cahier…) », « CCTP — Cahier… » : le code, devant.
  return (found(wanted) ?? found(clean(wanted.split(/\s+[(—–-]\s*/)[0] ?? '')))?.code ?? null
}

const DATE_SCHEMA = {
  name: 'date_document',
  schema: { type: 'object', properties: { date: { type: 'string' }, certain: { type: 'boolean' } }, required: ['date', 'certain'], additionalProperties: false }
}

/**
 * La date que l'IA a dite : pas certaine, `null` ; certaine et vide : aucune (`''`) ; sinon
 * la date lue (`AAAA-MM-JJ`, `AAAA-MM`), si le document la dit — rien d'inventé.
 */
export function readDateAnswer(answer: unknown, text: string): string | null {
  if (typeof answer !== 'object' || answer === null) return null
  const reply = answer as { date?: unknown; certain?: unknown }
  if (reply.certain !== true || typeof reply.date !== 'string') return null
  if (!reply.date.trim()) return ''
  const date = parseDocDate(reply.date)
  return date && dateFoundIn(date, text) ? date : null
}

const TAGS_SCHEMA = {
  name: 'etiquettes_document',
  schema: {
    type: 'object',
    properties: { tags: { type: 'array', items: { type: 'string' } }, certain: { type: 'boolean' } },
    required: ['tags', 'certain'],
    additionalProperties: false
  }
}

/** Le nombre d'étiquettes gardées, au plus. */
const MAX_AI_TAGS = 6

/**
 * Les étiquettes que l'IA a données : pas certaine, `null` ; certaine et aucune : `[]` ; sinon
 * celles que le document dit, ou que la bibliothèque emploie déjà (écrites alors comme elle) —
 * au plus six. Aucune ne tient : `null`, rien n'est inventé.
 */
export function readTagsAnswer(answer: unknown, text: string, known: readonly string[]): string[] | null {
  if (typeof answer !== 'object' || answer === null) return null
  const reply = answer as { tags?: unknown; certain?: unknown }
  if (reply.certain !== true || !Array.isArray(reply.tags)) return null
  const given = reply.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.replace(/^[#"«“\s]+|["»”\s.]+$/g, '').trim()).filter(Boolean)
  if (!given.length) return []
  const usual = new Map(known.map((tag) => [tag.toLowerCase(), tag]))
  const kept = tagsFoundIn(given, text, known).map((tag) => usual.get(tag.toLowerCase()) ?? tag.toLowerCase())
  return kept.length ? [...new Set(kept)].slice(0, MAX_AI_TAGS) : null
}

/** La taille d'un morceau de texte relu à la fois (en caractères) : qu'il tienne, avec sa réponse, dans le modèle. */
export const PROOFREAD_CHUNK = 6000

/** Le texte en morceaux, coupés entre deux paragraphes (un paragraphe trop long : seul). */
export function proofreadChunks(text: string, size = PROOFREAD_CHUNK): string[] {
  const chunks: string[] = []
  let current = ''
  for (const paragraph of text.split(/\n{2,}/)) {
    if (current && current.length + paragraph.length + 2 > size) {
      chunks.push(current)
      current = ''
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph
  }
  if (current.trim()) chunks.push(current)
  return chunks
}

/**
 * Un morceau relu par l'IA, gardé s'il reste le même texte : ni résumé ni allongé (sa longueur,
 * sans les blancs, entre 60 % et 160 % de l'original) ; sinon `null` — l'original reste. Les
 * clôtures de code dont elle l'entoure parfois sont ôtées.
 */
export function readProofread(answer: string, original: string): string | null {
  const text = answer
    .trim()
    .replace(/^```(?:markdown|md)?\s*\n/i, '')
    .replace(/\n```\s*$/, '')
    .trim()
  const weight = (value: string) => value.replace(/\s+/g, '').length
  if (!text || !weight(original)) return null
  const ratio = weight(text) / weight(original)
  return ratio >= 0.6 && ratio <= 1.6 ? text : null
}

/**
 * Le modèle qui regarde les images, **réglé exprès** : pour lire un scan, celui d'OCR sinon celui
 * de vision ; pour relire avec la vision, celui de vision sinon celui d'OCR. Jamais celui
 * d'analyse : il ne voit pas, souvent, et le serveur refuse les images. Vide : aucun.
 */
export function visionModelOf(client: AiClient, use: 'vision' | 'ocr'): string {
  const vision = client.connection.visionModel.trim()
  const ocr = client.connection.ocrModel.trim()
  // Sinon celui d'analyse, comme le module de gestion de projet : bien des modèles récents voient.
  const text = client.connection.model.trim()
  return use === 'ocr' ? ocr || vision || text : vision || ocr || text
}

/**
 * Les modèles dont le serveur a refusé les images (« … is not a multimodal model ») : on ne
 * les leur montre plus, jusqu'au prochain démarrage — un scan versé n'échoue pas à chaque fois.
 */
const imagesRefusedBy = new Set<string>()

/** Le serveur a-t-il refusé les images pour ce modèle ? */
export const imagesRefused = (model: string): boolean => imagesRefusedBy.has(model)

/** Pour les tests : oublier les refus. */
export const forgetImageRefusals = (): void => imagesRefusedBy.clear()

/** Une erreur qui dit que le modèle ne prend pas d'images (une requête refusée, 400, qui parle d'image ou de multimodal). */
export function refusesImages(error: unknown): boolean {
  if (!(error instanceof LlmError) || error.kind !== 'http' || (error.status ?? 0) >= 500) return false
  return /multi-?modal|image|vision|does not support (image|vision)/i.test(error.message)
}

/** Le serveur refuse les images de ce modèle : la lecture s'arrête là. */
class ImagesRefused extends Error {
  constructor(override readonly cause: unknown) {
    super('images refused')
  }
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Les fichiers qu'un modèle de vision peut regarder : les images, et les PDF quand la plateforme sait dessiner leurs pages. */
export function visionReadable(file: string, canDrawPdf: boolean): boolean {
  const extension = file.slice(file.lastIndexOf('.') + 1).toLowerCase()
  return isImage(extension) || (extension === 'pdf' && canDrawPdf)
}

/**
 * Ce qu'un modèle de vision a lu d'une page : sans les clôtures de code ; s'il y avait un texte
 * extrait de la page, une réponse bien plus courte (moins de la moitié) le garde — elle en a
 * perdu. Vide : `null`.
 */
export function readVisionPage(answer: string, pageText: string): string | null {
  const text = answer
    .trim()
    .replace(/^```(?:markdown|md)?\s*\n/i, '')
    .replace(/\n```\s*$/, '')
    .trim()
  if (!text) return null
  const weight = (value: string) => value.replace(/\s+/g, '').length
  return pageText && weight(text) < weight(pageText) * 0.5 ? null : text
}

/** Où une réponse **boucle** : là où la répétition commence, et jusqu'où garder (une fois le motif). */
export interface RepetitionLoop {
  /** L'index, dans la réponse, où la répétition commence. */
  start: number
  /** Ce qui se garde : ce qui précède, et le motif une fois (`text.slice(0, keep)`). */
  keep: number
  /** Le motif répété, et combien de fois. */
  unit: string
  times: number
}

/**
 * Une réponse qui **boucle** : le modèle répète le même passage, encore et encore, jusqu'à la
 * limite de longueur (« ≤ 100 Ω des prises de courant ≤ 100 Ω des prises de courant… »). Le
 * même motif — de 4 à 400 caractères, au moins 4 lettres ou chiffres (des « | | | » ou des
 * points de conduite n'en sont pas) —, répété jusqu'à la fin, les espaces comptés comme un
 * seul : 8 fois et 600 caractères ; dans une réponse coupée par la limite (`cut`), 4 fois et
 * 200. `null` : elle ne boucle pas.
 */
export function repetitionLoop(text: string, cut = false): RepetitionLoop | null {
  // Les espaces (sauts de ligne compris) comptés comme un seul ; `at` : d'où vient chaque caractère.
  let flat = ''
  const at: number[] = []
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (/\s/.test(char)) {
      if (flat.endsWith(' ')) continue
      flat += ' '
    } else flat += char
    at.push(index)
  }
  while (flat.endsWith(' ')) {
    flat = flat.slice(0, -1)
    at.pop()
  }
  const length = flat.length
  const least = cut ? { times: 4, covered: 200 } : { times: 8, covered: 600 }
  if (length < least.covered) return null
  const floor = Math.max(0, length - 40_000)
  for (let period = 4; period <= 400 && period * least.times <= length - floor; period++) {
    // Depuis la fin, tant que chaque caractère est celui d'un motif plus tôt : la boucle.
    let index = length - 1
    while (index - period >= floor && flat[index] === flat[index - period]) index--
    const start = index + 1 - period
    const covered = length - start
    if (covered < least.covered || covered / period < least.times) continue
    const unit = flat.slice(start, start + period)
    if ((unit.match(/[\p{L}\p{N}]/gu) ?? []).length < 4) continue
    return { start: at[start]!, keep: (at[start + period - 1] ?? text.length - 1) + 1, unit: unit.trim(), times: Math.floor(covered / period) }
  }
  return null
}

export function registerIaWorkflows(client: () => AiClient | null, fs: () => FileSystem, t: Translate, describe: (error: unknown) => string, pages: () => PageImages | undefined = () => undefined): void {
  /**
   * **Relire le texte extrait** d'un document avec l'IA : vérifier sa cohérence, le remettre
   * en forme (Markdown), corriger ce que l'extraction a abîmé — sans en changer le sens. Par
   * morceaux ; un morceau trop changé (résumé, allongé) garde son original. Le texte relu est
   * une **nouvelle version du texte** (celle d'avant est gardée, comparable) ; l'édition et la
   * révision du document ne changent pas. Prompt, persona, skill : ceux de l'étape.
   */
  registerAction({
    id: 'ia.relire-texte',
    labelKey: 'ia.wf.action.proofread',
    descKey: 'ia.wf.action.proofread.desc',
    needsAi: true,
    fields: [
      { key: 'fiche', labelKey: 'ia.wf.field.record', kind: 'text', required: true, defaultValue: '{fiche}' },
      {
        key: 'mode',
        labelKey: 'ia.wf.field.proofreadMode',
        tooltipKey: 'ia.wf.field.proofreadMode.tip',
        kind: 'choice',
        defaultValue: 'texte',
        options: [
          { value: 'texte', labelKey: 'ia.wf.proofreadMode.texte' },
          { value: 'vision', labelKey: 'ia.wf.proofreadMode.vision' }
        ]
      }
    ],
    results: ['text'],
    async run({ fields, vars, guidance, notifier }) {
      const reading = (fields.fiche ?? '').trim()
      try {
        return await proofread()
      } finally {
        // Finie, réussie ou non : plus en cours sur les fiches.
        aiReadingEnded(reading)
      }
      async function proofread() {
          // Une relecture prend du temps, et son workflow système ne dit rien quand il réussit :
          // elle se dit elle-même — son début, ses morceaux, ce qu'elle a donné.
          const say = (key: string, values?: Record<string, string | number>) => {
            const text = t(key, values)
            notifier.notify(text, 10000)
            return { lines: [text], results: { text } }
          }
          const record = (fields.fiche ?? '').trim()
          const doc = record ? await libraryDoc(record) : null
          if (!doc) return say('ia.wf.language.noDoc', { record })
          const base = client()
          const ai = base?.withInstructions(guidance)
          if (!ai || !base) return say('ia.wf.proofread.noAi', { title: doc.title })
          // Une lecture commence : dite sur les fiches (les boutons grisés, la file d'attente).
          aiReadingProgress(record, doc.title)
          const guided = {
            ...(fields.prompt?.trim() ? { prompt: fields.prompt.trim() } : {}),
            ...(fields.persona?.trim() ? { persona: fields.persona.trim() } : {}),
            ...(fields.skill?.trim() ? { skill: fields.skill.trim() } : {})
          }
          // Le mode : celui choisi sur la fiche (« Relire avec l'IA »), sinon celui de l'étape ; un
          // document sans texte (un scan, une image) ne se lit qu'avec la vision.
          const text = doc.reading === 'lue' ? ((await libraryTranscript(record)) ?? '').trim() : ''
          const mode = !text ? 'vision' : (vars.relecture || fields.mode || 'texte').trim() === 'vision' ? 'vision' : 'texte'
          if (mode === 'vision') {
            const seen = await pageImages(doc.file)
            if (!seen) return text ? say('ia.wf.vision.cannotProofread', { title: doc.title }) : say('ia.wf.vision.cannot', { title: doc.title })
            try {
              if (!seen.pages) return say('ia.wf.vision.noPage', { title: doc.title })
              // Un modèle qui voit, réglé exprès : celui d'analyse, souvent, ne lit pas les images (le serveur refuse).
              const model = visionModelOf(base, text ? 'vision' : 'ocr')
              if (!model) return say('ia.wf.vision.noModel', { title: doc.title })
              const count = seen.pages
              notifier.notify(t(text ? 'ia.wf.vision.startProofread' : 'ia.wf.vision.start', { title: doc.title, pages: count, model }), 8000)
              const out: string[] = []
              let kept = 0
              let failed = 0
              // Les pages où le modèle a bouclé deux fois ; celles dont on a gardé le début.
              let looped = 0
              let salvaged = 0
              for (let index = 0; index < count; index++) {
                const image = await seen.image(index)
                if (index > 0) notifier.notify(t('ia.wf.vision.progress', { title: doc.title, page: index + 1, pages: count }), 5000)
                aiReadingProgress(record, doc.title, t('ia.reading.page', { page: index + 1, pages: count }))
                const pageText = text ? (seen.texts?.[index] ?? '') : ''
                const ask = [t('ia.wf.vision.page', { page: index + 1, pages: seen.pages }), pageText ? `${t('ia.wf.vision.pageText')}\n\n${pageText}` : t(text ? 'ia.wf.vision.pageNoText' : 'ia.wf.vision.pageRead')].join('\n\n')
                // Un seul message, la consigne puis l'image, sans message système : la forme que
                // tous les modèles qui voient acceptent (certains refusent un message système à
                // côté d'une image). La place d'une page entière écrite : 4 096 jetons au moins.
                const asking = (again: boolean) => ({
                  model,
                  messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: [guidance?.trim(), t('ia.wf.vision.system'), again ? t('ia.wf.loop.again') : '', ask].filter(Boolean).join('\n\n') }, { type: 'image_url' as const, image_url: { url: image } }] }],
                  // Relancée après une boucle : un peu de hasard, pour qu'elle ne reprenne pas le même chemin.
                  temperature: again ? 0.3 : 0,
                  maxTokens: Math.max(base.connection.maxTokens, 4096)
                })
                const readOnce = async (again: boolean): Promise<{ text: string; finish: string } | { error: unknown }> => {
                  let last: unknown = null
                  // Une page qui échoue est redemandée, deux fois, un moment après — sauf un refus du serveur (4xx), qui ne changera pas.
                  for (let attempt = 0; attempt < 3; attempt++) {
                    if (attempt) await pause(attempt * 2000)
                    try {
                      return await base.reply(asking(again))
                    } catch (error) {
                      last = error
                      if (refusesImages(error)) throw new ImagesRefused(error)
                      if (error instanceof LlmError && error.kind === 'http' && (error.status ?? 500) < 500) break
                    }
                  }
                  return { error: last }
                }
                let first: Awaited<ReturnType<typeof readOnce>>
                try {
                  first = await readOnce(false)
                } catch (error) {
                  if (!(error instanceof ImagesRefused)) throw error
                  imagesRefusedBy.add(model)
                  return say('ia.wf.vision.refused', { title: doc.title, model, reason: describe(error.cause) })
                }
                if ('error' in first) {
                  failed++
                  // Une page non lue : son texte extrait garde sa place (ou la page est dite), la lecture continue.
                  out.push(pageText || `*${t('ia.wf.vision.pageFailed', { page: index + 1, reason: describe(first.error) })}*`)
                  continue
                }
                let answer = first.text
                let loop = repetitionLoop(answer, first.finish === 'length')
                if (loop) {
                  // Le modèle a bouclé : la page relue une deuxième fois, autrement.
                  notifier.notify(t('ia.wf.vision.loopRetry', { title: doc.title, page: index + 1 }), 6000)
                  const second = await readOnce(true).catch(() => ({ error: null }))
                  if (!('error' in second)) {
                    const again = repetitionLoop(second.text, second.finish === 'length')
                    // Relue sans boucle : elle ; bouclée encore, celle qui en garde le plus.
                    if (!again || again.keep > loop.keep) {
                      answer = second.text
                      loop = again
                    }
                  }
                }
                if (loop) {
                  looped++
                  // Bouclée deux fois : ce qui précède la boucle, s'il dit assez ; sinon le texte extrait
                  // de la page ; sinon, la page dite mal lue — le texte le montre, à sa place.
                  // Une réponse qui n'est que la boucle (rien d'autre avant elle) n'a rien à garder.
                  const said = (answer.slice(0, loop.start).match(/[\p{L}\p{N}]/gu) ?? []).length >= 10
                  const before = said ? readVisionPage(answer.slice(0, loop.keep), pageText) : null
                  if (before) salvaged++
                  out.push(before ? `${before}\n\n*${t('ia.wf.vision.pageLooped', { page: index + 1 })}*` : pageText || `*${t('ia.wf.vision.pageLoopedNothing', { page: index + 1 })}*`)
                  continue
                }
                const read = readVisionPage(answer, pageText)
                if (read === null) kept++
                out.push(read ?? pageText)
              }
              // Aucune page lue : l'erreur du serveur, telle quelle.
              if (failed === count) throw new Error(t('ia.wf.vision.allFailed', { title: doc.title, model }))
              // Rien de lu que des boucles : une erreur, et le texte d'avant reste celui de la fiche.
              if (looped && looped + failed === count && !salvaged) throw new Error(t('ia.wf.vision.allLooped', { title: doc.title, model }))
              const loopedSays = looped ? t('ia.wf.vision.looped', { title: doc.title, count: looped, pages: count, model }) : ''
              if (loopedSays) notifier.notify(loopedSays, 20000)
              const seenText = out.filter((part) => part.trim()).join('\n\n').trim()
              if (!seenText) return say('ia.wf.vision.nothingRead', { title: doc.title })
              if (text && seenText.replace(/\s+/g, ' ') === text.replace(/\s+/g, ' ')) return say('ia.wf.proofread.nothing', { title: doc.title })
              const version = await addTextVersionByAi(record, seenText, { model, ...guided, vision: count, ...(kept ? { kept } : {}) })
              if (!version) return say('ia.wf.proofread.noText', { title: doc.title })
              const done = say(text ? 'ia.wf.vision.doneProofread' : 'ia.wf.vision.done', { title: doc.title, number: version.number, pages: count })
              return loopedSays ? { lines: [...done.lines, loopedSays], results: { text: `${done.results.text} ${loopedSays}` } } : done
            } finally {
              await seen.close()
            }
          }
          const chunks = proofreadChunks(text)
          notifier.notify(t('ia.wf.proofread.start', { title: doc.title, parts: chunks.length }), 8000)
          const out: string[] = []
          let kept = 0
          // Les parties où le modèle a bouclé deux fois (gardées telles quelles).
          let looped = 0
          for (const [index, chunk] of chunks.entries()) {
            if (index > 0) notifier.notify(t('ia.wf.proofread.progress', { title: doc.title, part: index + 1, parts: chunks.length }), 5000)
            aiReadingProgress(record, doc.title, t('ia.reading.part', { part: index + 1, parts: chunks.length }))
            const relire = async (again: boolean) => {
              try {
                return await ai.reply({
                  messages: [
                    { role: 'system', content: again ? `${t('ia.wf.proofread.system')}\n\n${t('ia.wf.loop.again')}` : t('ia.wf.proofread.system') },
                    { role: 'user', content: chunks.length > 1 ? `${t('ia.wf.proofread.part', { part: index + 1, parts: chunks.length })}\n\n${chunk}` : chunk }
                  ],
                  temperature: again ? 0.3 : 0
                })
              } catch (error) {
                throw new Error(describe(error))
              }
            }
            let reply = await relire(false)
            if (repetitionLoop(reply.text, reply.finish === 'length')) {
              // Le modèle a bouclé : la partie relue une deuxième fois, autrement ; bouclée encore,
              // elle reste telle quelle.
              notifier.notify(t('ia.wf.proofread.loopRetry', { title: doc.title, part: index + 1 }), 6000)
              reply = await relire(true)
              if (repetitionLoop(reply.text, reply.finish === 'length')) {
                looped++
                kept++
                out.push(chunk)
                continue
              }
            }
            const answer = reply.text
            const read = readProofread(answer, chunk)
            if (read === null) kept++
            out.push(read ?? chunk)
          }
          const proofread = out.join('\n\n').trim()
          if (looped) notifier.notify(t('ia.wf.proofread.looped', { title: doc.title, count: looped, parts: chunks.length }), 20000)
          // Rien que des boucles : une erreur, le texte reste celui d'avant.
          if (looped === chunks.length) throw new Error(t('ia.wf.proofread.allLooped', { title: doc.title, model: base.connection.model }))
          if (kept === chunks.length) return say('ia.wf.proofread.allKept', { title: doc.title })
          if (proofread.replace(/\s+/g, ' ') === text.replace(/\s+/g, ' ')) return say('ia.wf.proofread.nothing', { title: doc.title })
          const version = await addTextVersionByAi(record, proofread, { model: base.connection.model, ...guided, ...(kept ? { kept } : {}) })
          if (!version) return say('ia.wf.proofread.noText', { title: doc.title })
          return say(kept ? 'ia.wf.proofread.doneKept' : 'ia.wf.proofread.done', { title: doc.title, number: version.number, parts: chunks.length, kept })
      }
    }
  })

  /**
   * Les pages d'un fichier en images, pour un modèle qui voit : une image, elle-même ; un PDF,
   * ses pages dessinées par la plateforme (et le texte que l'extraction a lu sur chacune).
   * `null` : ce fichier ne se montre pas ainsi (un autre format, une plateforme qui ne dessine
   * pas les PDF).
   */
  async function pageImages(file: string): Promise<{ pages: number; image(index: number): Promise<string>; texts?: string[]; close(): Promise<void> } | null> {
    const extension = file.slice(file.lastIndexOf('.') + 1).toLowerCase()
    const files = fs()
    if (!(await files.exists(file))) return null
    if (isImage(extension)) {
      const url = imageDataUrl(extension, new Uint8Array(await files.readBinary(file)))
      return { pages: 1, image: async () => url, close: async () => undefined }
    }
    const draw = pages()
    if (extension !== 'pdf' || !draw) return null
    const bytes = new Uint8Array(await files.readBinary(file))
    const drawn = await draw.open(bytes)
    const texts = await pdfPageTexts(bytes).catch(() => undefined)
    // Chaque page dessinée quand vient son tour : toutes, sans limite, jamais toutes en mémoire.
    return { pages: drawn.pages, image: (index) => drawn.page(index + 1, 1400), close: () => drawn.close(), ...(texts ? { texts } : {}) }
  }

  /**
   * La date d'un document de la bibliothèque, quand la première passe sans IA ne l'a pas lue
   * sûrement : le début de son texte demandé à l'IA. Certaine, et le document la dit : donnée
   * (« identifiée par l'IA » ; vide : aucune) ; sinon, elle reste à confirmer, sans erreur.
   */
  registerAction({
    id: 'ia.date-document',
    labelKey: 'ia.wf.action.date',
    descKey: 'ia.wf.action.date.desc',
    needsAi: true,
    fields: [{ key: 'fiche', labelKey: 'ia.wf.field.record', kind: 'text', required: true, defaultValue: '{fiche}' }],
    results: ['text'],
    async run({ fields, guidance }) {
      const say = (key: string, vars?: Record<string, string | number>) => {
        const text = t(key, vars)
        return { lines: [text], results: { text } }
      }
      const record = (fields.fiche ?? '').trim()
      const doc = record ? await libraryDoc(record) : null
      if (!doc) return say('ia.wf.language.noDoc', { record })
      if (!doc.dateToConfirm) return say('ia.wf.date.already', { title: doc.title })
      const ai = client()?.withInstructions(guidance)
      if (!ai) return say('ia.wf.date.noAi', { title: doc.title })
      const text = ((await libraryDocText(record)) ?? '').trim()
      if (!text) return say('ia.wf.date.noText', { title: doc.title })
      const fileName = doc.file.slice(doc.file.lastIndexOf('/') + 1)
      let answer: unknown
      try {
        answer = await ai.chatJson<unknown>({
          messages: [
            { role: 'system', content: t('ia.wf.date.system') },
            { role: 'user', content: `${t('ia.wf.identity.file', { name: fileName })}\n\n${text.slice(0, IDENTITY_HEAD)}` }
          ],
          temperature: 0,
          schema: DATE_SCHEMA
        })
      } catch (error) {
        throw new Error(describe(error))
      }
      const date = readDateAnswer(answer, text.slice(0, IDENTITY_HEAD))
      if (date === null) return say('ia.wf.date.unsure', { title: doc.title })
      await setDateByAi(record, date)
      return say(date ? 'ia.wf.date.found' : 'ia.wf.date.nothing', { title: doc.title, date: libraryDateLabel(date) })
    }
  })

  /**
   * Les étiquettes d'un document de la bibliothèque, quand la première passe sans IA ne les a
   * pas lues sûrement : le début de son texte, et les étiquettes déjà en usage, demandés à
   * l'IA. Certaine : ses étiquettes sont données (« données par l'IA »), si le document les
   * dit ou si la bibliothèque les emploie ; sinon, elles restent à confirmer, sans erreur.
   */
  registerAction({
    id: 'ia.etiquettes-document',
    labelKey: 'ia.wf.action.tags',
    descKey: 'ia.wf.action.tags.desc',
    needsAi: true,
    fields: [{ key: 'fiche', labelKey: 'ia.wf.field.record', kind: 'text', required: true, defaultValue: '{fiche}' }],
    results: ['text'],
    async run({ fields, guidance }) {
      const say = (key: string, vars?: Record<string, string | number>) => {
        const text = t(key, vars)
        return { lines: [text], results: { text } }
      }
      const record = (fields.fiche ?? '').trim()
      const doc = record ? await libraryDoc(record) : null
      if (!doc) return say('ia.wf.language.noDoc', { record })
      if (!doc.tagsToConfirm) return say('ia.wf.tags.already', { title: doc.title })
      const ai = client()?.withInstructions(guidance)
      if (!ai) return say('ia.wf.tags.noAi', { title: doc.title })
      const text = ((await libraryDocText(record)) ?? '').trim()
      if (!text) return say('ia.wf.tags.noText', { title: doc.title })
      const fileName = doc.file.slice(doc.file.lastIndexOf('/') + 1)
      const known = await libraryTags()
      let answer: unknown
      try {
        answer = await ai.chatJson<unknown>({
          messages: [
            { role: 'system', content: t('ia.wf.tags.system', { list: known.slice(0, 60).join(', ') || t('ia.wf.tags.noKnown') }) },
            { role: 'user', content: `${t('ia.wf.identity.file', { name: fileName })}\n\n${text.slice(0, IDENTITY_HEAD)}` }
          ],
          temperature: 0,
          schema: TAGS_SCHEMA
        })
      } catch (error) {
        throw new Error(describe(error))
      }
      const tags = readTagsAnswer(answer, text.slice(0, IDENTITY_HEAD), known)
      if (tags === null) return say('ia.wf.tags.unsure', { title: doc.title })
      const saved = await setTagsByAi(record, [...new Set([...doc.tags, ...tags])])
      return say(tags.length ? 'ia.wf.tags.found' : 'ia.wf.tags.nothing', { title: doc.title, tags: (saved?.tags ?? tags).join(', ') })
    }
  })

  /**
   * La catégorie d'un document de la bibliothèque, quand la première passe sans IA ne l'a pas
   * établie sûrement : le début de son texte et la liste des catégories connues demandés à
   * l'IA. Certaine, et c'en est une de la liste : donnée (« identifiée par l'IA ») ; sinon,
   * elle reste à confirmer, sans erreur.
   */
  registerAction({
    id: 'ia.categorie-document',
    labelKey: 'ia.wf.action.category',
    descKey: 'ia.wf.action.category.desc',
    needsAi: true,
    fields: [{ key: 'fiche', labelKey: 'ia.wf.field.record', kind: 'text', required: true, defaultValue: '{fiche}' }],
    results: ['text'],
    async run({ fields, guidance }) {
      const say = (key: string, vars?: Record<string, string | number>) => {
        const text = t(key, vars)
        return { lines: [text], results: { text } }
      }
      const record = (fields.fiche ?? '').trim()
      const doc = record ? await libraryDoc(record) : null
      if (!doc) return say('ia.wf.language.noDoc', { record })
      if (!doc.categoryToConfirm) return say('ia.wf.category.already', { title: doc.title })
      const ai = client()?.withInstructions(guidance)
      if (!ai) return say('ia.wf.category.noAi', { title: doc.title })
      const text = ((await libraryDocText(record)) ?? '').trim()
      if (!text) return say('ia.wf.category.noText', { title: doc.title })
      const fileName = doc.file.slice(doc.file.lastIndexOf('/') + 1)
      const categories = libraryPieceTypes()
      let answer: unknown
      try {
        answer = await ai.chatJson<unknown>({
          messages: [
            { role: 'system', content: t('ia.wf.category.system', { list: categories.map((type) => (type.label && type.label !== type.code ? `${type.code} (${type.label})` : type.code)).join(', ') }) },
            { role: 'user', content: `${t('ia.wf.identity.file', { name: fileName })}\n\n${text.slice(0, IDENTITY_HEAD)}` }
          ],
          temperature: 0,
          schema: CATEGORY_SCHEMA
        })
      } catch (error) {
        throw new Error(describe(error))
      }
      const category = readCategoryAnswer(answer, categories)
      if (category === null) return say('ia.wf.category.unsure', { title: doc.title })
      await setCategoryByAi(record, category)
      return say(category ? 'ia.wf.category.found' : 'ia.wf.category.nothing', { title: doc.title, category })
    }
  })

  /**
   * L'émetteur d'un document de la bibliothèque, quand la première passe sans IA ne l'a pas
   * lu sûrement : le début de son texte demandé à l'IA. Certaine : l'émetteur est donné
   * (« identifié par l'IA » ; vide : aucun), s'il figure dans le document ; sinon, il reste à
   * confirmer, sans erreur.
   */
  registerAction({
    id: 'ia.emetteur-document',
    labelKey: 'ia.wf.action.issuer',
    descKey: 'ia.wf.action.issuer.desc',
    needsAi: true,
    fields: [{ key: 'fiche', labelKey: 'ia.wf.field.record', kind: 'text', required: true, defaultValue: '{fiche}' }],
    results: ['text'],
    async run({ fields, guidance }) {
      const say = (key: string, vars?: Record<string, string | number>) => {
        const text = t(key, vars)
        return { lines: [text], results: { text } }
      }
      const record = (fields.fiche ?? '').trim()
      const doc = record ? await libraryDoc(record) : null
      if (!doc) return say('ia.wf.language.noDoc', { record })
      if (!doc.issuerToConfirm) return say('ia.wf.issuer.already', { title: doc.title })
      const ai = client()?.withInstructions(guidance)
      if (!ai) return say('ia.wf.issuer.noAi', { title: doc.title })
      const text = ((await libraryDocText(record)) ?? '').trim()
      if (!text) return say('ia.wf.issuer.noText', { title: doc.title })
      const known = await libraryIssuers()
      const fileName = doc.file.slice(doc.file.lastIndexOf('/') + 1)
      let answer: unknown
      try {
        answer = await ai.chatJson<unknown>({
          messages: [
            { role: 'system', content: [t('ia.wf.issuer.system'), ...(known.length ? [t('ia.wf.issuer.known', { list: known.map((each) => (each.name && each.name !== each.code ? `${each.code} (${each.name})` : each.code)).join(', ') })] : [])].join(' ') },
            { role: 'user', content: `${t('ia.wf.identity.file', { name: fileName })}\n\n${text.slice(0, IDENTITY_HEAD)}` }
          ],
          temperature: 0,
          schema: ISSUER_SCHEMA
        })
      } catch (error) {
        throw new Error(describe(error))
      }
      const issuer = readIssuerAnswer(answer, text, fileName, known)
      if (issuer === null) return say('ia.wf.issuer.unsure', { title: doc.title })
      await setIssuerByAi(record, issuer)
      return say(issuer ? 'ia.wf.issuer.found' : 'ia.wf.issuer.nobody', { title: doc.title, issuer: issuerLabelIn(issuer, known) })
    }
  })

  /**
   * Le titre d'un document de la bibliothèque, quand la première passe sans IA ne l'a pas lu
   * sûrement : le début de son texte (et le nom de son fichier, le titre probable lu) demandés
   * à l'IA. Certaine, et ses mots sont ceux du document : le titre est donné (« identifié par
   * l'IA ») ; sinon, il reste à confirmer, sans erreur.
   */
  registerAction({
    id: 'ia.titre-document',
    labelKey: 'ia.wf.action.title',
    descKey: 'ia.wf.action.title.desc',
    needsAi: true,
    fields: [{ key: 'fiche', labelKey: 'ia.wf.field.record', kind: 'text', required: true, defaultValue: '{fiche}' }],
    results: ['text'],
    async run({ fields, guidance }) {
      const say = (key: string, vars?: Record<string, string | number>) => {
        const text = t(key, vars)
        return { lines: [text], results: { text } }
      }
      const record = (fields.fiche ?? '').trim()
      const doc = record ? await libraryDoc(record) : null
      if (!doc) return say('ia.wf.language.noDoc', { record })
      if (!doc.titleToConfirm) return say('ia.wf.title.already', { title: doc.title })
      const ai = client()?.withInstructions(guidance)
      if (!ai) return say('ia.wf.title.noAi', { title: doc.title })
      const text = ((await libraryDocText(record)) ?? '').trim()
      if (!text) return say('ia.wf.title.noText', { title: doc.title })
      const fileName = doc.file.slice(doc.file.lastIndexOf('/') + 1)
      let answer: unknown
      try {
        answer = await ai.chatJson<unknown>({
          messages: [
            { role: 'system', content: t('ia.wf.title.system') },
            { role: 'user', content: `${t('ia.wf.identity.file', { name: fileName })}\n\n${text.slice(0, IDENTITY_HEAD)}` }
          ],
          temperature: 0,
          schema: TITLE_SCHEMA
        })
      } catch (error) {
        throw new Error(describe(error))
      }
      const title = readTitleAnswer(answer, text, fileName)
      if (!title) return say('ia.wf.title.unsure', { title: doc.title })
      await setTitleByAi(record, title)
      return say('ia.wf.title.found', { title })
    }
  })

  /**
   * La référence et la version d'un document de la bibliothèque, quand la première passe sans
   * IA ne les a pas lues sûrement : le début de son texte (et le nom de son fichier) demandés
   * à l'IA. Certaine : ce qu'elle dit est donné (« identifiées par l'IA »), ce qu'elle ne dit
   * pas gardé de la première passe ; sinon — pas certaine, pas réglée, pas de texte —, elles
   * restent à confirmer, sans erreur.
   */
  registerAction({
    id: 'ia.identite-document',
    labelKey: 'ia.wf.action.identity',
    descKey: 'ia.wf.action.identity.desc',
    needsAi: true,
    fields: [{ key: 'fiche', labelKey: 'ia.wf.field.record', kind: 'text', required: true, defaultValue: '{fiche}' }],
    results: ['text'],
    async run({ fields, guidance }) {
      const say = (key: string, vars?: Record<string, string | number>) => {
        const text = t(key, vars)
        return { lines: [text], results: { text } }
      }
      const record = (fields.fiche ?? '').trim()
      const doc = record ? await libraryDoc(record) : null
      if (!doc) return say('ia.wf.language.noDoc', { record })
      if (!doc.identityToConfirm) return say('ia.wf.identity.already', { title: doc.title })
      const ai = client()?.withInstructions(guidance)
      if (!ai) return say('ia.wf.identity.noAi', { title: doc.title })
      const text = ((await libraryDocText(record)) ?? '').trim()
      if (!text) return say('ia.wf.identity.noText', { title: doc.title })
      const fileName = doc.file.slice(doc.file.lastIndexOf('/') + 1)
      let answer: unknown
      try {
        answer = await ai.chatJson<unknown>({
          messages: [
            { role: 'system', content: t('ia.wf.identity.system') },
            { role: 'user', content: `${t('ia.wf.identity.file', { name: fileName })}\n\n${text.slice(0, IDENTITY_HEAD)}` }
          ],
          temperature: 0,
          schema: IDENTITY_SCHEMA
        })
      } catch (error) {
        throw new Error(describe(error))
      }
      const found = readIdentityAnswer(answer, text, fileName)
      if (!found) return say('ia.wf.identity.unsure', { title: doc.title })
      // Ce que l'IA n'a pas dit : gardé de la première passe.
      const identity = { reference: found.reference || doc.reference, edition: found.edition || doc.edition, revision: found.revision || doc.revision }
      await setIdentityByAi(record, identity)
      const version = [identity.edition, identity.revision].filter(Boolean).join('-')
      return say('ia.wf.identity.found', { title: doc.title, found: [identity.reference, version ? t('ia.wf.identity.version', { version }) : ''].filter(Boolean).join(', ') || t('ia.wf.identity.nothing') })
    }
  })

  /**
   * La langue d'un document de la bibliothèque, quand la détection sans IA n'a pas été sûre :
   * le début de son texte demandé à l'IA. Une réponse nette (un des codes) : la langue est
   * donnée, « identifiée par l'IA » ; sinon — l'IA pas sûre, pas réglée, pas de texte —, elle
   * reste à confirmer, sans erreur.
   */
  registerAction({
    id: 'ia.langue-document',
    labelKey: 'ia.wf.action.language',
    descKey: 'ia.wf.action.language.desc',
    needsAi: true,
    fields: [{ key: 'fiche', labelKey: 'ia.wf.field.record', kind: 'text', required: true, defaultValue: '{fiche}' }],
    results: ['text'],
    async run({ fields, guidance }) {
      const say = (key: string, vars?: Record<string, string | number>) => {
        const text = t(key, vars)
        return { lines: [text], results: { text } }
      }
      const record = (fields.fiche ?? '').trim()
      const doc = record ? await libraryDoc(record) : null
      if (!doc) return say('ia.wf.language.noDoc', { record })
      if (!doc.languageToConfirm) return say('ia.wf.language.already', { title: doc.title })
      const ai = client()?.withInstructions(guidance)
      if (!ai) return say('ia.wf.language.noAi', { title: doc.title })
      const text = ((await libraryDocText(record)) ?? '').trim()
      if (!text) return say('ia.wf.language.noText', { title: doc.title })
      let answer: string
      try {
        answer = await ai.chat({
          messages: [
            { role: 'system', content: t('ia.wf.language.system', { codes: LANGUAGES.join(', ') }) },
            { role: 'user', content: text.slice(0, LANGUAGE_SAMPLE) }
          ],
          temperature: 0,
          maxTokens: 8
        })
      } catch (error) {
        throw new Error(describe(error))
      }
      const language = readLanguageAnswer(answer)
      if (!language) return say('ia.wf.language.unsure', { title: doc.title })
      await setLanguageByAi(record, language)
      return say('ia.wf.language.found', { title: doc.title, language: t(`bibliotheque.lang.${language}`) })
    }
  })

  registerAction({
    id: 'ia.demander',
    labelKey: 'ia.wf.action.ask',
    descKey: 'ia.wf.action.ask.desc',
    needsAi: true,
    fields: [
      { key: 'consigne', labelKey: 'ia.wf.field.prompt', kind: 'textarea', placeholderKey: 'ia.wf.field.prompt.placeholder', tooltipKey: 'ia.wf.field.prompt.tip' },
      { key: 'prompt', labelKey: 'bibliotheque.wf.field.prompt', kind: 'text', tooltipKey: 'bibliotheque.wf.field.prompt.tip' },
      { key: 'persona', labelKey: 'bibliotheque.wf.field.persona', kind: 'text', tooltipKey: 'bibliotheque.wf.field.persona.tip' },
      { key: 'contexte', labelKey: 'ia.wf.field.context', kind: 'textarea', tooltipKey: 'ia.wf.field.context.tip' },
      { key: 'note', labelKey: 'ia.wf.field.note', kind: 'text', tooltipKey: 'ia.wf.field.note.tip' }
    ],
    results: ['text', 'path', 'link'],
    async run({ fields, guidance }) {
      const ai = client()?.withInstructions(guidance)
      if (!ai) throw new Error(t('ia.unavailable'))
      // La consigne : écrite, sinon celle d'un prompt de la bibliothèque ; un persona, si on en nomme un.
      const prompt = await namedEntry('prompt', fields.prompt)
      const instruction = fields.consigne?.trim() || prompt?.text || ''
      if (!instruction) throw new Error(t('ia.wf.noPrompt'))
      const persona = await namedEntry('persona', fields.persona)
      const asked = persona ? ai.withPersona(personaInstructions(persona)) : ai
      let text: string
      try {
        text = (
          await asked.chat({
            messages: [
              { role: 'system', content: t('ia.wf.system') },
              { role: 'user', content: [instruction, fields.contexte].filter((part) => part?.trim()).join('\n\n') }
            ],
            temperature: 0.2
          })
        ).trim()
      } catch (error) {
        throw new Error(describe(error))
      }
      const wanted = fields.note?.trim()
      if (!wanted) return { lines: [t('ia.wf.answered', { length: text.length })], results: { text, path: '', link: '' } }
      const path = wanted.toLowerCase().endsWith('.md') ? wanted : `${wanted}.md`
      await fs().writeText(path, `${text}\n`)
      const link = `[[${path.replace(/\.md$/, '')}]]`
      return { lines: [t('ia.wf.written', { path: link })], paths: [path], results: { text, path, link } }
    }
  })
}
