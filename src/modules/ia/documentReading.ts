// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **lecture d'un document par l'IA**, de bout en bout. Avec la vision (un PDF dont la
 * plateforme dessine les pages, une image), page par page :
 *
 * 1. **le texte du fichier** (« copier-coller ») : ce que la page porte déjà ;
 * 2. **l'OCR**, si la page n'en porte presque pas (un scan) et qu'un modèle d'OCR est réglé :
 *    son texte brut, lu dans l'image ;
 * 3. **la vision** : la page en image, et ce texte à vérifier, transcrite fidèlement en
 *    Markdown — sa mise en forme (titres, listes, tableaux), **chaque image décrite** à sa
 *    place ; une réponse coupée par la limite de longueur est **continuée** ; une réponse
 *    qui boucle est redemandée ;
 * 4. **le contrôle** : une lecture qui a perdu plus de 30 % des lettres du texte du fichier
 *    est relue, avec insistance ; encore courte, le texte du fichier la complète, dit tel ;
 * 5. **la vérification par l'IA** : la page et sa transcription comparées, une note sur 100
 *    et ce qui ne va pas ; sous 85, la transcription est **corrigée** d'après l'image, puis
 *    revérifiée — la meilleure est gardée.
 *
 * Puis, sur le document : **le nettoyage** (en-têtes et pieds de page répétés, numéros de
 * page, lignes coupées recollées, lignes vides en trop) et **la qualité** — la note de chaque
 * page pesée par sa longueur, tempérée par la part des mots du texte du fichier retrouvés.
 *
 * Sans images (un Word, un texte), le texte extrait est nettoyé (et, d'un PDF, débarrassé des
 * lignes que ses pages répètent), remis en forme et nettoyé par l'IA partie par partie, puis
 * chaque partie **vérifiée** contre l'original — sous 70, relue une seconde fois avec ce qui
 * n'allait pas ; la meilleure est gardée.
 */

import type { ChatMessage, ChatPart } from './protocol'
import { LlmError } from './protocol'
import type { AiClient } from './client'
import {
  blendQuality,
  cleanPages,
  coverage,
  furnitureLines,
  ImagesRefused,
  letterCount,
  needsOcr,
  pause,
  proofreadChunks,
  qualityPercent,
  readProofread,
  readsWhole,
  readVerdict,
  readVisionPage,
  refusesImages,
  rejoinLines,
  repetitionLoop,
  stripFurniture,
  tidy,
  tidyContents,
  withoutFurniture,
  type Verdict
} from './reading'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Ce qu'une lecture dit, à qui la suit : ses notices, son avancement (sur la fiche). */
export interface ReadingContext {
  t: Translate
  title: string
  notify(text: string, ms?: number): void
  progress(detail: string): void
  describe(error: unknown): string
  /** Les consignes de l'étape (prompt, persona, skill), en tête de chaque demande de vision. */
  guidance?: string
  /** Le texte lu jusqu'ici (provisoire), après chaque page (ou partie) : la fiche le montre. */
  partial?(text: string, done: number, total: number): void
}

/** Les pages d'un document en images, et le texte que le fichier porte pour chacune. */
export interface PageSource {
  pages: number
  image(index: number): Promise<string>
  texts?: string[]
}

/** Combien de fois une page coupée par la limite de longueur est continuée. */
const CONTINUATIONS = 4
/** Sous cette note, une page est corrigée d'après l'image (puis revérifiée). */
const CORRECT_BELOW = 85
/** Sous cette note, une partie relue (sans images) est relue une seconde fois. */
const REDO_BELOW = 70
/** Une partie gardée telle quelle (la relecture la changeait trop) : lue, pas remise en forme. */
const KEPT_SCORE = 60

export interface VisionReading {
  text: string
  pages: number
  /** Pages dont la lecture était trop courte : leur texte extrait gardé. */
  kept: number
  /** Pages où le modèle a bouclé deux fois ; celles dont on a gardé le début. */
  looped: number
  salvaged: number
  failed: number
  /** Pages lues par l'OCR d'abord ; complétées du texte du fichier ; corrigées après vérification. */
  ocr: number
  supplemented: number
  corrected: number
  /** Les lignes que les pages répétaient (en-têtes, pieds de page), retirées. */
  removed: string[]
  /** La qualité de la transcription, en pourcentage ; `null` : rien n'a pu la juger. */
  quality: number | null
}

/** Le serveur refuse les images de ce modèle : la lecture s'arrête, en le disant. */
export class VisionRefused extends Error {
  constructor(
    readonly model: string,
    readonly reason: string
  ) {
    super(reason)
  }
}

/**
 * Une demande d'image (et de texte) au modèle, redemandée deux fois si elle échoue — sauf un
 * refus du serveur (4xx), qui ne changera pas ; continuée tant qu'elle est coupée par la limite
 * de longueur (et ne boucle pas).
 */
async function askImage(client: AiClient, model: string, text: string, image: string, more: string, temperature = 0): Promise<{ text: string; cut: boolean }> {
  const messages: ChatMessage[] = [{ role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: { url: image } }] as ChatPart[] }]
  let whole = ''
  let cut = false
  for (let round = 0; round <= CONTINUATIONS; round++) {
    let last: unknown = null
    let reply: { text: string; finish: string } | null = null
    for (let attempt = 0; attempt < 3 && !reply; attempt++) {
      if (attempt) await pause(attempt * 2000)
      try {
        reply = await client.reply({ model, messages, temperature, maxTokens: Math.max(client.connection.maxTokens, 4096) })
      } catch (error) {
        last = error
        if (refusesImages(error)) throw new ImagesRefused(error)
        if (error instanceof LlmError && error.kind === 'http' && (error.status ?? 500) < 500) break
      }
    }
    if (!reply) {
      // Rien de la première fois : l'échec ; une suite qui échoue : ce qui a été lu.
      if (!round) throw last instanceof Error ? last : new Error(String(last))
      break
    }
    // Telle qu'elle vient : le modèle reprend exactement où il s'était arrêté, au milieu d'un mot souvent.
    whole += reply.text
    cut = reply.finish === 'length'
    if (!cut || repetitionLoop(whole, true)) break
    messages.push({ role: 'assistant', content: reply.text }, { role: 'user', content: more })
  }
  return { text: whole, cut }
}

/** Une demande de texte seul (le verdict, une relecture), sans relance : une erreur dit pourquoi. */
async function askText(client: AiClient, messages: ChatMessage[], temperature = 0): Promise<{ text: string; finish: string }> {
  return client.reply({ messages, temperature })
}

/** Le verdict de l'IA sur une page et sa transcription ; `null` si elle ne répond pas en JSON. */
async function verifyPage(client: AiClient, model: string, t: Translate, image: string, reading: string, page: number, pages: number): Promise<Verdict | null> {
  try {
    const answer = await askImage(client, model, `${t('ia.wf.read.verify', { page, pages })}\n\n${t('ia.wf.read.transcript')}\n\n${reading}`, image, t('ia.wf.read.more'))
    return readVerdict(answer.text)
  } catch (error) {
    if (error instanceof ImagesRefused) throw error
    return null
  }
}

/**
 * Lire un document avec la vision, page par page, puis le nettoyer et en juger la qualité (voir
 * l'en-tête). `ocrModel` : un modèle d'OCR réglé à part (vide : la vision lit seule). Lève
 * `VisionRefused` quand le serveur refuse les images ; une erreur quand aucune page n'a pu être
 * lue, ou qu'il n'y a eu que des boucles.
 */
export async function readWithVision(client: AiClient, source: PageSource, model: string, ocrModel: string, context: ReadingContext): Promise<VisionReading> {
  const { t, title } = context
  const count = source.pages
  const pages: string[] = []
  // Chaque page lue, dite aussitôt (le texte jusqu'ici, provisoire).
  const push = (text: string) => {
    pages.push(text)
    context.partial?.(tidy(pages.join('\n\n')), pages.length, count)
  }
  const scores: { score: number; weight: number }[] = []
  const result = { kept: 0, looped: 0, salvaged: 0, failed: 0, ocr: 0, supplemented: 0, corrected: 0 }
  const lead = (lines: string[]) => [context.guidance?.trim(), ...lines].filter(Boolean).join('\n\n')
  // Les en-têtes et pieds de page du texte du fichier : retirés de ce qu'on donne au modèle, de ce
  // qu'on garde quand sa lecture échoue, et à la fin de ses pages et de leurs variantes.
  const furniture = source.texts && source.texts.length > 1 ? stripFurniture(source.texts) : null
  // D'entrée : zéro page sur N (la fiche dit le pourcentage).
  context.partial?.('', 0, count)
  try {
    for (let index = 0; index < count; index++) {
      const page = index + 1
      const step = (key: string) => context.progress(t('ia.reading.step', { step: t(key), page, pages: count }))
      if (index > 0) context.notify(t('ia.wf.vision.progress', { title, page, pages: count }), 5000)
      step('ia.reading.step.copy')
      const image = await source.image(index)
      // 1. Ce que le fichier porte pour la page (« copier-coller »).
      const layer = (furniture?.pages[index] ?? source.texts?.[index] ?? '').trim()
      let reference = layer
      // 2. Presque rien : un scan — son texte brut lu par le modèle d'OCR, s'il y en a un à part.
      if (needsOcr(layer) && ocrModel && ocrModel !== model) {
        step('ia.reading.step.ocr')
        try {
          const read = await askImage(client, ocrModel, t('ia.wf.read.ocr', { page, pages: count }), image, t('ia.wf.read.more'))
          if (!repetitionLoop(read.text, read.cut) && letterCount(read.text) > letterCount(layer)) {
            reference = read.text.trim()
            result.ocr++
          }
        } catch (error) {
          if (error instanceof ImagesRefused) throw error
        }
      }
      // 3. La vision : la page transcrite, mise en forme, ses images décrites.
      step('ia.reading.step.vision')
      const ask = (insist: boolean, again: boolean) =>
        lead([
          t('ia.wf.read.vision', { page, pages: count }),
          insist ? t('ia.wf.read.insist') : '',
          again ? t('ia.wf.loop.again') : '',
          reference ? `${t(layer && reference === layer ? 'ia.wf.read.layerGiven' : 'ia.wf.read.ocrGiven')}\n\n${reference}` : t('ia.wf.read.noText')
        ])
      let reading: string
      try {
        let first = await askImage(client, model, ask(false, false), image, t('ia.wf.read.more'))
        let loop = repetitionLoop(first.text, first.cut)
        if (loop) {
          // Le modèle a bouclé : la page relue une deuxième fois, autrement.
          context.notify(t('ia.wf.vision.loopRetry', { title, page }), 6000)
          const second = await askImage(client, model, ask(false, true), image, t('ia.wf.read.more'), 0.3).catch((error: unknown) => {
            if (error instanceof ImagesRefused) throw error
            return null
          })
          if (second) {
            const again = repetitionLoop(second.text, second.cut)
            if (!again || again.keep > loop.keep) {
              first = second
              loop = again
            }
          }
        }
        if (loop) {
          result.looped++
          // Bouclée deux fois : ce qui précède la boucle, s'il dit assez ; sinon le texte du fichier ; sinon la page dite mal lue.
          const said = letterCount(first.text.slice(0, loop.start)) >= 10
          const before = said ? readVisionPage(first.text.slice(0, loop.keep), layer) : null
          if (before) result.salvaged++
          push(before ? `${before}\n\n*${t('ia.wf.vision.pageLooped', { page })}*` : reference || `*${t('ia.wf.vision.pageLoopedNothing', { page })}*`)
          continue
        }
        const read = readVisionPage(first.text, layer)
        if (read === null) {
          // Bien plus courte que le texte du fichier : elle en a perdu — celui-ci reste.
          result.kept++
          push(layer)
          continue
        }
        reading = read
      } catch (error) {
        if (error instanceof ImagesRefused) throw error
        result.failed++
        push(reference || `*${t('ia.wf.vision.pageFailed', { page, reason: context.describe(error) })}*`)
        continue
      }
      // Lue : montrée tout de suite, avant son contrôle et sa vérification (qui prennent du temps).
      context.partial?.(tidy([...pages, reading].join('\n\n')), index + 1, count)
      // 4. Le contrôle : une lecture qui a perdu des lettres du texte du fichier, relue avec insistance ; encore courte, complétée.
      if (layer && !readsWhole(reading, layer)) {
        step('ia.reading.step.check')
        const again = await askImage(client, model, ask(true, false), image, t('ia.wf.read.more')).catch((error: unknown) => {
          if (error instanceof ImagesRefused) throw error
          return null
        })
        const better = again && !repetitionLoop(again.text, again.cut) ? readVisionPage(again.text, '') : null
        if (better && letterCount(better) > letterCount(reading)) reading = better
        if (!readsWhole(reading, layer)) {
          reading = `${reading}\n\n${t('ia.wf.read.layer', { page })}\n\n${layer}`
          result.supplemented++
        }
      }
      // 5. La vérification : la page et sa transcription comparées ; sous 85, corrigée d'après l'image.
      step('ia.reading.step.verify')
      let verdict = await verifyPage(client, model, t, image, reading, page, count)
      if (verdict && verdict.score < CORRECT_BELOW && verdict.problems.length) {
        step('ia.reading.step.correct')
        const fixed = await askImage(client, model, lead([t('ia.wf.read.correct', { page, pages: count, problems: verdict.problems.map((each) => `- ${each}`).join('\n') }), `${t('ia.wf.read.transcript')}\n\n${reading}`]), image, t('ia.wf.read.more')).catch(
          (error: unknown) => {
            if (error instanceof ImagesRefused) throw error
            return null
          }
        )
        const candidate = fixed && !repetitionLoop(fixed.text, fixed.cut) ? readVisionPage(fixed.text, layer) : null
        if (candidate) {
          const second = await verifyPage(client, model, t, image, candidate, page, count)
          if (second && second.score > verdict.score) {
            reading = candidate
            verdict = second
            result.corrected++
          }
        }
      }
      const kept = layer ? coverage(layer, reading) : null
      if (verdict) scores.push({ score: blendQuality(verdict.score, kept), weight: letterCount(reading) })
      else if (kept !== null) scores.push({ score: Math.round(kept * 100), weight: letterCount(reading) })
      push(reading)
    }
  } catch (error) {
    if (error instanceof ImagesRefused) throw new VisionRefused(model, context.describe(error.cause))
    throw error
  }
  // Aucune page lue : l'erreur du serveur ; rien que des boucles : une erreur — le texte de la fiche ne change pas.
  if (result.failed === count) throw new Error(t('ia.wf.vision.allFailed', { title, model }))
  if (result.looped && result.looped + result.failed === count && !result.salvaged) throw new Error(t('ia.wf.vision.allLooped', { title, model }))
  context.progress(t('ia.reading.step.only', { step: t('ia.reading.step.clean') }))
  const { text, removed } = cleanPages(pages, furniture?.removed)
  // Les pages qu'on n'a pas pu juger (échouées, bouclées) comptent pour rien : elles ne sont pas lues.
  for (let lost = 0; lost < result.failed + result.looped; lost++) scores.push({ score: 0, weight: 1500 })
  return { text, pages: count, removed, quality: qualityPercent(scores), ...result }
}

export interface TextReading {
  text: string
  parts: number
  /** Parties gardées telles quelles (la relecture les changeait trop), dont celles où le modèle bouclait. */
  kept: number
  looped: number
  /** Parties relues une seconde fois après la vérification. */
  redone: number
  /** Les lignes que les pages du fichier répétaient, retirées avant la relecture. */
  removed: number
  quality: number | null
}

/**
 * Relire un texte extrait, sans images : nettoyé, remis en forme par l'IA partie par partie,
 * chaque partie vérifiée (voir l'en-tête). `pageTexts` : le texte de chaque page d'un PDF, pour
 * en reconnaître les en-têtes et pieds de page. Lève une erreur quand le modèle a bouclé partout.
 */
export async function proofreadDocument(ai: AiClient, judge: AiClient, source: string, pageTexts: readonly string[] | undefined, context: ReadingContext): Promise<TextReading> {
  const { t, title } = context
  // D'abord sans IA : les lignes que les pages répètent, les lignes coupées, les lignes vides en trop.
  const furniture = furnitureLines(pageTexts ?? [])
  const cleaned = tidyContents(rejoinLines(withoutFurniture(source, furniture)))
  const chunks = proofreadChunks(cleaned)
  context.notify(t('ia.wf.proofread.start', { title, parts: chunks.length }), 8000)
  const out: string[] = []
  const push = (text: string) => {
    out.push(text)
    context.partial?.(tidy(out.join('\n\n')), out.length, chunks.length)
  }
  const scores: { score: number; weight: number }[] = []
  let kept = 0
  let looped = 0
  let redone = 0
  for (const [index, chunk] of chunks.entries()) {
    const part = index + 1
    const step = (key: string) => context.progress(t('ia.reading.stepPart', { step: t(key), part, parts: chunks.length }))
    if (index > 0) context.notify(t('ia.wf.proofread.progress', { title, part, parts: chunks.length }), 5000)
    step('ia.reading.step.format')
    const relire = async (again: boolean, problems: string[] = []) => {
      const system = [t('ia.wf.proofread.system'), again ? t('ia.wf.loop.again') : '', problems.length ? t('ia.wf.read.redo', { problems: problems.map((each) => `- ${each}`).join('\n') }) : ''].filter(Boolean).join('\n\n')
      try {
        return await askText(ai, [
          { role: 'system', content: system },
          { role: 'user', content: chunks.length > 1 ? `${t('ia.wf.proofread.part', { part, parts: chunks.length })}\n\n${chunk}` : chunk }
        ], again ? 0.3 : 0)
      } catch (error) {
        throw new Error(context.describe(error))
      }
    }
    let reply = await relire(false)
    if (repetitionLoop(reply.text, reply.finish === 'length')) {
      // Le modèle a bouclé : la partie relue une deuxième fois, autrement ; bouclée encore, elle reste telle quelle.
      context.notify(t('ia.wf.proofread.loopRetry', { title, part }), 6000)
      reply = await relire(true)
      if (repetitionLoop(reply.text, reply.finish === 'length')) {
        looped++
        kept++
        push(chunk)
        continue
      }
    }
    let read = readProofread(reply.text, chunk)
    if (read === null) {
      kept++
      push(chunk)
      scores.push({ score: KEPT_SCORE, weight: letterCount(chunk) })
      continue
    }
    // La vérification : l'original et la relue comparés ; sous 70, relue une seconde fois avec ce qui n'allait pas.
    step('ia.reading.step.verify')
    const verify = async (text: string): Promise<Verdict | null> => {
      try {
        return readVerdict((await askText(judge, [{ role: 'system', content: t('ia.wf.read.verifyText') }, { role: 'user', content: `${t('ia.wf.read.original')}\n\n${chunk}\n\n${t('ia.wf.read.proofread')}\n\n${text}` }])).text)
      } catch {
        return null
      }
    }
    let verdict = await verify(read)
    if (verdict && verdict.score < REDO_BELOW && verdict.problems.length) {
      step('ia.reading.step.correct')
      const again = await relire(false, verdict.problems).catch(() => null)
      const candidate = again && !repetitionLoop(again.text, again.finish === 'length') ? readProofread(again.text, chunk) : null
      if (candidate) {
        const second = await verify(candidate)
        if (second && second.score > verdict.score) {
          read = candidate
          verdict = second
          redone++
        }
      }
    }
    const share = coverage(chunk, read)
    if (verdict) scores.push({ score: blendQuality(verdict.score, share), weight: letterCount(read) })
    else if (share !== null) scores.push({ score: Math.round(share * 100), weight: letterCount(read) })
    push(read)
  }
  if (looped && looped === chunks.length) throw new Error(t('ia.wf.proofread.allLooped', { title, model: ai.connection.model }))
  return { text: tidy(out.join('\n\n')), parts: chunks.length, kept, looped, redone, removed: furniture.length, quality: qualityPercent(scores) }
}
