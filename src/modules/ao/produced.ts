// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les notes produites par l'analyse que l'interface relit en détail : une question au
 * dossier (`readQuestion`) et le questionnaire (`readQuestionnaire`). Le Markdown en
 * général (une note lisible en blocs) est lu par `src/core/markdown.ts`.
 */

import { firstLink, plainText } from '../../core/markdown'

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
