// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le calendrier d'un appel d'offres : les dates et les délais que posent ses pièces — date
 * limite de remise des offres, validité des offres, questions, visite, notification,
 * livraisons, pénalités —, chacun avec la phrase d'où il vient et sa pièce. Relevés par le
 * module, hors ligne, sans IA : une date oubliée ou inventée est un jalon faux.
 *
 * Écrit dans `Analyse/Calendrier.md` : « À retenir » (la remise et la validité), puis les
 * dates par ordre chronologique, puis les délais.
 */

import { frontmatter } from '../../core/frontmatter'
import { fold } from './ask/retrieval'
import { pieceSources, type PieceSource } from './ask/sources'
import { findDates, findDelays } from './deadlines'
import { ANALYSIS, wikiLink, type Analysis } from './notes'
import type { Services, Translate } from './service'

export const CALENDAR_TYPE = 'ao-calendrier'

/** Ce que dit une date ou un délai, reconnu aux mots de sa phrase ; le premier qui va l'emporte. */
export const KINDS = ['remise', 'validite', 'questions', 'visite', 'notification', 'execution', 'livraison', 'penalite', 'autre'] as const
export type DeadlineKind = (typeof KINDS)[number]

const CUES: Record<Exclude<DeadlineKind, 'autre'>, RegExp> = {
  remise:
    /remise des (?:offres|plis|candidatures)|date (?:et heure )?limites? de (?:remise|reception|depot)|reception des (?:offres|plis)|depot des (?:offres|plis)|(?:offres|plis) (?:devront|doivent) (?:parvenir|etre (?:remis|deposes|recus))|submission deadline|tender (?:due|deadline)|closing date/,
  validite: /validite (?:des offres|de l.offre|de l.engagement)|delai de validite|offer validity|valid for/,
  questions: /questions?|demandes? de renseignements|renseignements complementaires|clarification/,
  visite: /visite/,
  notification: /notification|attribution du marche|signature du marche|award/,
  execution: /demarrage|commencement|lancement|debut des (?:prestations|travaux)|duree (?:du marche|d.execution)|kick.?off|start/,
  livraison: /livraison|livrable|recette|achevement|fin des (?:prestations|travaux)|reception|delivery|acceptance/,
  penalite: /penalite|retard|penalt/
}

/**
 * L'ordre où les natures sont essayées : ce dont la phrase parle avant ce à partir de quoi
 * elle compte — « valable 120 jours à compter de la date limite de remise » parle de
 * validité, « livré sous 18 mois à compter de la notification » de livraison.
 */
const PRECEDENCE: readonly Exclude<DeadlineKind, 'autre'>[] = ['validite', 'remise', 'questions', 'visite', 'penalite', 'livraison', 'execution', 'notification']

export function kindOf(sentence: string): DeadlineKind {
  const folded = fold(sentence)
  return PRECEDENCE.find((kind) => CUES[kind].test(folded)) ?? 'autre'
}

export interface CalendarDate {
  date: string
  written: string
  sentence: string
  guessedYear: boolean
  kind: DeadlineKind
  /** Les pièces qui disent la même phrase (un CCTP en Word et en PDF) : une ligne pour toutes. */
  sources: PieceSource[]
}

export interface CalendarDelay {
  written: string
  sentence: string
  kind: DeadlineKind
  sources: PieceSource[]
}

/** Un délai tel qu'on le lit : « 120 jours à compter de… » plutôt que « est fixé à 120 jours à compter de… ». */
export function delayLabel(written: string): string {
  return written.replace(/^(?:est\s+)?fix[ée]e?s?\s+à\s+|^est\s+de\s+|^(?:pour|d['’])\s*une\s+durée\s+de\s+/iu, '').trim()
}

const flat = (text: string) => text.replace(/\s+/g, ' ').trim()

export interface Calendar {
  dates: CalendarDate[]
  delays: CalendarDelay[]
  /** Les pièces lues. */
  read: number
}

/** Les dates et délais des pièces, les dates par ordre chronologique. */
export function calendarOf(sources: readonly PieceSource[], year?: number): Calendar {
  const dates: CalendarDate[] = []
  const delays: CalendarDelay[] = []
  const byDate = new Map<string, CalendarDate>()
  const byDelay = new Map<string, CalendarDelay>()
  for (const source of sources) {
    for (const found of findDates(source.text, year)) {
      const key = `${found.date}|${flat(found.sentence)}`
      const held = byDate.get(key)
      if (held) held.sources.push(source)
      else {
        const entry = { ...found, kind: kindOf(found.sentence), sources: [source] }
        byDate.set(key, entry)
        dates.push(entry)
      }
    }
    for (const found of findDelays(source.text)) {
      const key = `${flat(found.written)}|${flat(found.sentence)}`
      const held = byDelay.get(key)
      if (held) held.sources.push(source)
      else {
        const entry = { ...found, kind: kindOf(found.sentence), sources: [source] }
        byDelay.set(key, entry)
        delays.push(entry)
      }
    }
  }
  dates.sort((a, b) => a.date.localeCompare(b.date))
  const order = (kind: DeadlineKind) => KINDS.indexOf(kind)
  delays.sort((a, b) => order(a.kind) - order(b.kind))
  return { dates, delays, read: sources.length }
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()

const long = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function calendarMarkdown(calendar: Calendar, t: Translate): string {
  const link = (sources: readonly PieceSource[]) => sources.map((source) => wikiLink(source.path, source.title)).join(', ')
  const out: string[] = []
  out.push(`## ${t('ao.calendar.keep')}`, '')
  const keep: string[] = []
  for (const kind of ['remise', 'validite'] as const) {
    const date = calendar.dates.find((each) => each.kind === kind)
    const delay = calendar.delays.find((each) => each.kind === kind)
    if (date) keep.push(`- **${t(`ao.calendar.kind.${kind}`)}** : ${long(date.date)} — « ${cell(date.sentence)} » (${link(date.sources)})`)
    else if (delay) keep.push(`- **${t(`ao.calendar.kind.${kind}`)}** : ${delayLabel(delay.written)} — « ${cell(delay.sentence)} » (${link(delay.sources)})`)
    else keep.push(`- **${t(`ao.calendar.kind.${kind}`)}** : *${t('ao.calendar.notFound')}*`)
  }
  out.push(...keep, '')
  if (calendar.dates.some((each) => each.guessedYear)) out.push(`> [!warning] ${t('ao.calendar.guessedWarning')}`, '')

  out.push(`## ${t('ao.calendar.dates')}`, '')
  if (calendar.dates.length) {
    out.push(
      `| ${t('ao.calendar.column.date')} | ${t('ao.calendar.column.kind')} | ${t('ao.calendar.column.sentence')} | ${t('ao.verif.column.piece')} |`,
      '| --- | --- | --- | --- |',
      ...calendar.dates.map(
        (each) =>
          `| ${each.date}${each.guessedYear ? ` (${t('ao.calendar.guessed')})` : ''} | ${t(`ao.calendar.kind.${each.kind}`)} | ${cell(each.sentence)} | ${cell(link(each.sources))} |`
      )
    )
  } else out.push(`*${t('ao.calendar.noDate')}*`)
  out.push('', `## ${t('ao.calendar.delays')}`, '')
  if (calendar.delays.length) {
    out.push(
      `| ${t('ao.calendar.column.delay')} | ${t('ao.calendar.column.kind')} | ${t('ao.calendar.column.sentence')} | ${t('ao.verif.column.piece')} |`,
      '| --- | --- | --- | --- |',
      ...calendar.delays.map(
        (each) => `| ${cell(delayLabel(each.written))} | ${t(`ao.calendar.kind.${each.kind}`)} | ${cell(each.sentence)} | ${cell(link(each.sources))} |`
      )
    )
  } else out.push(`*${t('ao.calendar.noDelay')}*`)
  return out.join('\n')
}

export function calendarPath(analysis: Analysis): string {
  return `${analysis.folder}/${ANALYSIS}/Calendrier.md`
}

const START = '<!-- bp:calendrier:debut — tenu à jour par Black Projects -->'
const END = '<!-- bp:calendrier:fin -->'

/** Relève le calendrier des pièces de l'appel d'offres et l'écrit ; les notes de l'utilisateur sous la section sont gardées. */
export async function writeCalendar(services: Services, analysis: Analysis): Promise<Calendar> {
  const { fs, t } = services
  const sources = await pieceSources(services, analysis, 'appel-d-offres')
  const calendar = calendarOf(sources, Number(services.today().slice(0, 4)))
  const content = [`*${t('ao.calendar.date', { date: services.today(), count: calendar.read })}*`, '', calendarMarkdown(calendar, t)].join('\n')
  const path = calendarPath(analysis)
  const existing = (await fs.exists(path)) ? await fs.readText(path) : null
  let note: string
  if (existing && existing.includes(START) && existing.includes(END)) {
    note = existing.slice(0, existing.indexOf(START) + START.length) + `\n${content}\n` + existing.slice(existing.indexOf(END))
  } else {
    note = [
      frontmatter({ 'bp-type': CALENDAR_TYPE, analyse: wikiLink(analysis.note) }),
      `# ${t('ao.calendar.title', { name: analysis.name })}`,
      '',
      t('ao.calendar.intro'),
      '',
      START,
      content,
      END,
      '',
      `## ${t('ao.note.notes')}`,
      '',
      ''
    ].join('\n')
  }
  await fs.writeText(path, note)
  return calendar
}
