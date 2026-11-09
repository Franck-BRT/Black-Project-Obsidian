// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que le module IA apporte au module Workflows : « Demander à l'IA » — une consigne,
 * un contexte (souvent le résultat d'une étape d'avant, {step1.text}), une réponse que les
 * étapes suivantes reprennent, et, si on le demande, une note où l'écrire.
 */

import type { FileSystem } from '../../core/ports'
import { IDENTITY_HEAD, LANGUAGES, dateFoundIn, libraryDateLabel, libraryPieceTypes, libraryDoc, libraryDocText, libraryTags, parseDocDate, setCategoryByAi, setDateByAi, setTagsByAi, tagsFoundIn, namedEntry, personaInstructions, referenceFoundIn, setIdentityByAi, setIssuerByAi, setLanguageByAi, setTitleByAi, issuerFoundIn, titleFoundIn, type LanguageCode } from '../bibliotheque'
import { registerAction } from '../workflows'
import type { AiClient } from './client'

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
 * sinon, gardé s'il n'est pas trop long et que le document le dit (elle n'invente pas).
 */
export function readIssuerAnswer(answer: unknown, text: string, fileName: string): string | null {
  if (typeof answer !== 'object' || answer === null) return null
  const reply = answer as { issuer?: unknown; certain?: unknown }
  if (reply.certain !== true || typeof reply.issuer !== 'string') return null
  const issuer = reply.issuer.replace(/\s+/g, ' ').replace(/^["«“\s]+|["»”\s.]+$/g, '').trim()
  if (!issuer) return ''
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

export function registerIaWorkflows(client: () => AiClient | null, fs: () => FileSystem, t: Translate, describe: (error: unknown) => string): void {
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
      const fileName = doc.file.slice(doc.file.lastIndexOf('/') + 1)
      let answer: unknown
      try {
        answer = await ai.chatJson<unknown>({
          messages: [
            { role: 'system', content: t('ia.wf.issuer.system') },
            { role: 'user', content: `${t('ia.wf.identity.file', { name: fileName })}\n\n${text.slice(0, IDENTITY_HEAD)}` }
          ],
          temperature: 0,
          schema: ISSUER_SCHEMA
        })
      } catch (error) {
        throw new Error(describe(error))
      }
      const issuer = readIssuerAnswer(answer, text, fileName)
      if (issuer === null) return say('ia.wf.issuer.unsure', { title: doc.title })
      await setIssuerByAi(record, issuer)
      return say(issuer ? 'ia.wf.issuer.found' : 'ia.wf.issuer.nobody', { title: doc.title, issuer })
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
