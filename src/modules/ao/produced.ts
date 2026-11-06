// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Une note produite par l'analyse (le calendrier, la vérification des exigences, la
 * qualité, le questionnaire, une question), lue pour l'interface : son Markdown devient
 * des blocs — chaque titre (« ## Dates ») un intitulé ; un tableau, une liste dont chaque
 * ligne est un élément (la première cellule en titre, les autres en détail) ; une liste à
 * puces, une liste ; un paragraphe, du texte ; un encadré « [!warning] », un message. Les
 * marques de couleur (🟩 🟧 🟥, ✅ ❌) donnent le ton de la ligne ; le premier lien de la
 * ligne, ce qu'elle ouvre. Sans l'en-tête de la note, ni les marques de Black Projects.
 */

import type { HomeBlock, ListItem, Tone, ViewAction } from '../../core/views'

/** Ce qu'ouvre un lien de la note (« [[chemin|libellé]] ») : la fiche d'une pièce, d'une exigence, ou la note. */
export type LinkOpener = (note: string) => ViewAction | undefined

const MARKS: [string, Tone][] = [
  ['🟩', 'success'],
  ['✅', 'success'],
  ['🟧', 'warning'],
  ['⚠️', 'warning'],
  ['⚠', 'warning'],
  ['🟥', 'danger'],
  ['❌', 'danger']
]

const CALLOUT_TONE: Record<string, Tone> = { warning: 'warning', caution: 'warning', attention: 'warning', danger: 'danger', error: 'danger', bug: 'danger', success: 'success', check: 'success', done: 'success', tip: 'success' }

/** Le premier lien Obsidian d'un texte, en chemin de note (`.md` compris) ; « » s'il n'y en a pas. */
export function firstLink(text: string): string {
  // Dans un tableau, le « | » du lien est échappé (« [[Pièces/RC\|RC]] »).
  const link = /\[\[([^\]|#\\[]+)(?:#[^\]|]*)?(?:\\?\|[^\]]*)?\]\]/.exec(text.replace(/\\\|/g, '|'))
  if (!link) return ''
  const target = link[1]!.trim()
  return target.endsWith('.md') || /\.[a-z0-9]{2,4}$/i.test(target) ? target : `${target}.md`
}

/** Un texte Markdown d'une ligne, tel qu'à lire : liens, gras, italique et code sans leur syntaxe. */
export function plainText(text: string): string {
  return text
    .replace(/\\\|/g, '|')
    .replace(/!?\[\[([^\]|[]+)\|([^\]]*)\]\]/g, '$2')
    .replace(/!?\[\[([^\][]+)\]\]/g, (_, target: string) => target.slice(target.lastIndexOf('/') + 1).replace(/#.*$/, '').replace(/\.md$/, ''))
    .replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    // Les citations « \[[[pièce|1]]\] » : le lien d'abord, puis les crochets échappés.
    .replace(/\\([[\]])/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Le ton que donne une marque de couleur, et le texte sans elle. */
function toneOf(text: string): { tone?: Tone; text: string } {
  for (const [mark, tone] of MARKS) if (text.includes(mark)) return { tone, text: text.split(mark).join('').replace(/️/g, '').replace(/\s+/g, ' ').trim() }
  return { text }
}

/** Les cellules d'une ligne de tableau ; les « \| » des liens ne coupent pas. */
function cellsOf(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim())
}

const isSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)
const isRow = (line: string) => /^\s*\|.*\|\s*$/.test(line)
const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/
const EMPTY = new Set(['', '—', '-', '–'])

/**
 * Les blocs d'une note produite. `opener` dit ce qu'ouvre un lien (la fiche d'une pièce, d'une
 * exigence…) ; une ligne sans lien ne s'ouvre pas.
 */
export function noteBlocks(markdown: string, opener: LinkOpener): HomeBlock[] {
  const lines = markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
  const blocks: HomeBlock[] = []
  let title: string | undefined
  /** Le titre de la section en cours : une liste qui suit un texte le reprend, pour rester dans un cadre. */
  let section: string | undefined
  let paragraph: string[] = []
  let paragraphs: string[] = []
  let items: ListItem[] = []
  let header: string[] = []
  let count = 0

  /** Le titre en attente va au premier bloc qui suit. */
  const titled = () => {
    const out = title ? { title } : {}
    title = undefined
    return out
  }
  const endParagraph = () => {
    const text = plainText(paragraph.join(' '))
    if (text) paragraphs.push(text)
    paragraph = []
  }
  const flushText = () => {
    endParagraph()
    if (paragraphs.length) blocks.push({ kind: 'text', ...titled(), paragraphs })
    paragraphs = []
  }
  const flushItems = () => {
    // Sans titre à elle (après un paragraphe), la liste prend celui de la section, sinon ses colonnes.
    const fallback = section ?? (header.length ? header.map(plainText).filter(Boolean).join(' · ') : undefined)
    if (items.length) blocks.push({ kind: 'list', ...(title ? titled() : fallback ? { title: fallback } : {}), items })
    items = []
    header = []
  }
  const flush = () => {
    flushText()
    flushItems()
  }
  const item = (raw: string, detail: string[]): ListItem => {
    const link = firstLink([raw, ...detail].join(' '))
    const marked = toneOf(plainText(raw))
    const details = detail.map((each) => toneOf(plainText(each)))
    const tone = marked.tone ?? details.find((each) => each.tone)?.tone
    const open = link ? opener(link) : undefined
    return {
      id: `l${count++}`,
      title: marked.text || '—',
      ...(details.some((each) => !EMPTY.has(each.text)) ? { detail: details.map((each) => each.text).filter((text) => !EMPTY.has(text)).join(' — ') } : {}),
      ...(tone ? { tone } : {}),
      ...(open ? { open } : {})
    }
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const heading = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      flush()
      // Le titre de la note (« # Calendrier — Station ») est celui de la page.
      if (heading[1]!.length > 1) section = title = plainText(heading[2]!)
      continue
    }
    if (isRow(line)) {
      flushText()
      const cells = cellsOf(line)
      if (isSeparator(lines[index + 1] ?? '')) {
        flushItems()
        header = cells
        index++
        continue
      }
      if (cells.every((cell) => EMPTY.has(cell))) continue
      items.push(item(cells[0]!, cells.slice(1)))
      continue
    }
    if (header.length) flushItems()
    const callout = /^\s*>\s*\[!(\w+)\][+-]?\s*(.*)$/.exec(line)
    const quote = /^(\s*)>\s?(.*)$/.exec(line)
    if (quote && quote[1]!.length > 0 && items.length) {
      // Sous une puce (« > [!quote]- Passages »), le passage cité complète l'élément.
      if (callout) continue
      const text = plainText(quote[2]!)
      const last = items[items.length - 1]!
      if (text) last.detail = last.detail ? `${last.detail} — ${text}` : text
      continue
    }
    if (callout) {
      flush()
      const kind = callout[1]!.toLowerCase()
      const body = [callout[2]!]
      while (index + 1 < lines.length && /^\s*>/.test(lines[index + 1]!) && !/^\s*>\s*\[!/.test(lines[index + 1]!)) body.push(lines[++index]!.replace(/^\s*>\s?/, ''))
      const text = plainText(body.join(' '))
      if (text) blocks.push({ kind: 'message', tone: CALLOUT_TONE[kind] ?? 'info', text })
      continue
    }
    if (/^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line)) continue
    const bullet = BULLET.exec(line)
    if (bullet) {
      flushText()
      const text = bullet[2]!
      if (bullet[1]!.length > 0 && items.length) {
        // Une puce sous une autre : le détail de la première.
        const last = items[items.length - 1]!
        const more = plainText(text)
        if (more) last.detail = last.detail ? `${last.detail} — ${more}` : more
        if (!last.open) {
          const link = firstLink(text)
          const open = link ? opener(link) : undefined
          if (open) last.open = open
        }
        continue
      }
      // « **Date limite** : samedi 12 décembre » : l'intitulé en titre, la suite en détail.
      const labelled = /^\*\*(.+?)\*\*\s*:?\s*(.*)$/.exec(text)
      items.push(labelled ? item(labelled[1]!, [labelled[2]!.replace(/^:\s*/, '')]) : item(text, []))
      continue
    }
    if (!line.trim()) {
      endParagraph()
      continue
    }
    flushItems()
    paragraph.push(quote ? quote[2]! : line)
  }
  flush()
  return blocks
}

/** Les mots d'une note de question, dans la langue où elle a été écrite (les titres de ses sections). */
export interface QuestionWords {
  answer: string
  sources: string
  notes: string
  cited: string
}

/** Une source de la réponse : la pièce, l'endroit, citée ou non, et ce qui a été transmis. */
export interface QuestionSource {
  number: number
  link: string
  title: string
  detail: string
  cited: boolean
  /** « Extraits transmis (2) », « Ce que l'IA y a relevé ». */
  label: string
  extracts: string[]
}

/** Une question au dossier, relue depuis sa note (`Analyse/Questions/…`). */
export interface QuestionNote {
  question: string
  mode: 'search' | 'each'
  date: string
  answer: string[]
  warnings: string[]
  sources: QuestionSource[]
  /** Ce que l'utilisateur a écrit dans la section Notes. */
  notes: string[]
}

/** Les paragraphes d'un texte Markdown, lisibles ; les encadrés « [!warning] » à part. */
function paragraphsOf(lines: readonly string[]): { paragraphs: string[]; warnings: string[] } {
  const paragraphs: string[] = []
  const warnings: string[] = []
  let current: string[] = []
  const end = () => {
    const text = plainText(current.join(' '))
    if (text) paragraphs.push(text)
    current = []
  }
  for (const line of lines) {
    const callout = /^\s*>\s*\[!\w+\][+-]?\s*(.*)$/.exec(line)
    if (callout) {
      end()
      const text = plainText(callout[1]!)
      if (text) warnings.push(text)
    } else if (!line.trim()) end()
    else current.push(line.replace(/^\s*>\s?/, ''))
  }
  end()
  return { paragraphs, warnings }
}

/** Les sources d'une réponse (« 1. [[pièce|titre]] — endroit — *citée* », puis ses extraits en retrait). */
function sourcesOf(lines: readonly string[], citedWord: string): QuestionSource[] {
  const sources: QuestionSource[] = []
  let passage: string[] = []
  const endPassage = () => {
    const text = passage.join(' ').replace(/\s+/g, ' ').trim()
    if (text && sources.length) sources[sources.length - 1]!.extracts.push(text)
    passage = []
  }
  for (const line of lines) {
    const item = /^(\d+)\.\s+(.*)$/.exec(line)
    if (item) {
      endPassage()
      const link = firstLink(item[2]!)
      const parts = item[2]!.split(' — ')
      const mark = /^\*(.+)\*$/.exec(parts.at(-1)!.trim())
      sources.push({
        number: Number(item[1]),
        link,
        title: plainText(parts[0]!),
        detail: plainText(parts.slice(1, mark ? -1 : undefined).join(' — ')),
        cited: mark ? mark[1]!.trim() === citedWord : false,
        label: '',
        extracts: []
      })
      continue
    }
    const quoted = /^\s+>\s?(.*)$/.exec(line)
    if (!quoted || !sources.length) continue
    const label = /^\[!quote\][+-]?\s*(.*)$/.exec(quoted[1]!.trim())
    if (label) sources[sources.length - 1]!.label = plainText(label[1]!)
    // « > » seul sépare deux extraits ; « > > » vide est une ligne vide dans l'extrait.
    else if (/^\s*$/.test(quoted[1]!)) endPassage()
    else {
      const text = quoted[1]!.replace(/^>\s?/, '')
      // Un titre de la pièce (« ### CCAP ») n'est pas du texte transmis à lire.
      if (!/^\s*#{1,6}\s/.test(text)) passage.push(text)
    }
  }
  endPassage()
  return sources
}

/**
 * Relit la note d'une question : la question (l'encadré « [!question] »), le mode et la
 * date (l'en-tête), la réponse et ses avertissements, les sources — chacune citée ou non,
 * avec les extraits transmis à l'IA —, et les notes de l'utilisateur. `null` : ce n'est pas
 * la note d'une question.
 */
export function readQuestion(markdown: string, words: QuestionWords): QuestionNote | null {
  const head = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown)
  const field = (key: string) => (head ? new RegExp(`^${key}:\\s*"?([^"\\n]*)"?\\s*$`, 'm').exec(head[1]!)?.[1]?.trim() ?? '' : '')
  const lines = markdown
    .slice(head ? head[0].length : 0)
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
  const start = lines.findIndex((line) => /^>\s*\[!question\]/i.test(line))
  if (start === -1) return null
  const asked = [lines[start]!.replace(/^>\s*\[!question\][+-]?\s*/i, '')]
  let index = start + 1
  // La suite de l'encadré ; la ligne en italique (« *Recherche dans les pièces — …* ») n'en est pas.
  for (; index < lines.length && /^>/.test(lines[index]!); index++) {
    const text = lines[index]!.replace(/^>\s?/, '')
    if (!/^\*[^*].*\*$/.test(text.trim())) asked.push(text)
  }
  const sections: { title: string; lines: string[] }[] = []
  for (; index < lines.length; index++) {
    const heading = /^\s*#{2,6}\s+(.*?)\s*$/.exec(lines[index]!)
    if (heading) sections.push({ title: plainText(heading[1]!), lines: [] })
    else sections.at(-1)?.lines.push(lines[index]!)
  }
  const named = (title: string) => sections.find((section) => section.title === title)
  const answerSection = named(words.answer) ?? sections.find((section) => section.title !== words.sources && section.title !== words.notes)
  const answer = paragraphsOf(answerSection?.lines ?? [])
  const sources = sourcesOf(named(words.sources)?.lines ?? [], words.cited)
  return {
    question: plainText(asked.join(' ')),
    mode: field('mode') === 'lecture' ? 'each' : 'search',
    date: field('date'),
    answer: answer.paragraphs,
    warnings: answer.warnings,
    sources,
    notes: paragraphsOf(named(words.notes)?.lines ?? []).paragraphs
  }
}

/** Les mots du questionnaire : ses thèmes (« Pénalités »), et ce qui dit qu'un thème n'a pas été posé. */
export interface QuestionnaireWords extends QuestionWords {
  topics: { key: string; title: string }[]
  notRun: string
}

/** Un thème du questionnaire : posé ou non, la question, la réponse, ses sources. */
export interface QuestionnaireItem {
  key: string
  title: string
  asked: boolean
  date: string
  question: string
  answer: string[]
  warnings: string[]
  sources: QuestionSource[]
}

/**
 * Relit la note du questionnaire : pour chaque thème (« ## Pénalités »), s'il a été posé,
 * quand (« *Posée le 2026-11-06 :* … »), la question, la réponse, ses avertissements et ses
 * sources (« ### Sources ») ; et les notes de l'utilisateur. Un thème absent de la note est
 * rendu « pas posé » : la page montre toujours les six.
 */
export function readQuestionnaire(markdown: string, words: QuestionnaireWords): { items: QuestionnaireItem[]; notes: string[] } {
  const lines = markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
  const sections: { title: string; lines: string[] }[] = []
  for (const line of lines) {
    const heading = /^##\s+(.*?)\s*$/.exec(line)
    if (heading) sections.push({ title: plainText(heading[1]!), lines: [] })
    else sections.at(-1)?.lines.push(line)
  }
  const items = words.topics.map(({ key, title }): QuestionnaireItem => {
    const section = sections.find((each) => each.title === title)
    const body = section?.lines ?? []
    const split = body.findIndex((line) => {
      const heading = /^#{3,6}\s+(.*?)\s*$/.exec(line)
      return heading ? plainText(heading[1]!) === words.sources : false
    })
    const text = paragraphsOf(split === -1 ? body : body.slice(0, split))
    const first = text.paragraphs[0] ?? ''
    // « Posée le 2026-11-06 : Quels sont… » : la date et la question, avant la réponse.
    const stamp = /\d{4}-\d{2}-\d{2}/.exec(first)
    const asked = Boolean(section) && Boolean(stamp) && first !== plainText(`*${words.notRun}*`)
    const question = asked ? first.replace(/^[^:]*\d{4}-\d{2}-\d{2}[^:]*:\s*/, '') : ''
    return {
      key,
      title,
      asked,
      date: asked ? stamp![0] : '',
      question,
      answer: asked ? text.paragraphs.slice(1) : [],
      warnings: asked ? text.warnings : [],
      sources: asked && split !== -1 ? sourcesOf(body.slice(split + 1), words.cited) : []
    }
  })
  return { items, notes: paragraphsOf(sections.find((each) => each.title === words.notes)?.lines ?? []).paragraphs }
}
