// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Une note Markdown lue pour l'interface (une note produite par l'analyse, une page de la
 * documentation) : son Markdown devient des blocs — chaque titre (« ## Dates ») un
 * intitulé ; un tableau, une liste dont chaque ligne est un élément (la première cellule
 * en titre, les autres en détail) ; une liste à puces, une liste ; un paragraphe, du
 * texte ; un bloc de code, du texte tel quel ; un encadré « [!warning] », un message. Les
 * marques de couleur (🟩 🟧 🟥, ✅ ❌) donnent le ton de la ligne ; le premier lien de la
 * ligne, ce qu'elle ouvre. Sans l'en-tête de la note, ni les marques de Black Projects.
 */

import type { HomeBlock, ListItem, Tone, ViewAction } from './views'

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
 * Une puce qui continue sur la ligne suivante (« - **Créer ou mettre à jour la » puis
 * « documentation** ») : la suite rejoint sa puce, pour que le gras ou le lien ne soient
 * pas coupés en deux. Les blocs de code, les citations et les puces en retrait restent tels
 * quels.
 */
function joinContinuations(lines: readonly string[]): string[] {
  const out: string[] = []
  let inBullet = false
  let fence = ''
  for (const line of lines) {
    const opening = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (line.trim() === fence) fence = ''
      out.push(line)
      continue
    }
    if (opening) {
      fence = opening[1]!
      inBullet = false
      out.push(line)
      continue
    }
    const continued = inBullet && /^\s{2,}\S/.test(line) && !BULLET.test(line) && !/^\s*>/.test(line) && !/^\s*\|/.test(line)
    if (continued) {
      out[out.length - 1] = `${out[out.length - 1]!} ${line.trim()}`
      continue
    }
    inBullet = BULLET.test(line)
    out.push(line)
  }
  return out
}

/**
 * Les blocs d'une note (produite par l'analyse, une page de la documentation). `opener` dit ce qu'ouvre un lien (la fiche d'une pièce, d'une
 * exigence…) ; une ligne sans lien ne s'ouvre pas.
 */
export function noteBlocks(markdown: string, opener: LinkOpener): HomeBlock[] {
  const lines = joinContinuations(
    markdown
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .split(/\r?\n/)
  )
  const blocks: HomeBlock[] = []
  let title: string | undefined
  /** Le titre de la section en cours : une liste qui suit un texte le reprend, pour rester dans un cadre. */
  let section: string | undefined
  let paragraph: string[] = []
  let paragraphs: string[] = []
  let items: ListItem[] = []
  /** Les puces qui ne sont que du texte (ni lien, ni intitulé, ni couleur) : elles se lisent en texte. */
  let plain: boolean[] = []
  let header: string[] = []
  let count = 0
  /** Où commence la section en cours, dans les blocs : un texte suivi de sa liste forme un seul cadre. */
  let sectionStart = 0
  /** Le dernier bloc, s'il est le texte de la section en cours (son introduction). */
  const sectionText = () => {
    const last = blocks.at(-1)
    return blocks.length > sectionStart && last?.kind === 'text' && !last.preformatted ? last : undefined
  }

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
    // Du texte qui suit le texte de la section (après des puces lues en texte) : le même cadre.
    const previous = title ? undefined : sectionText()
    if (paragraphs.length && previous) previous.paragraphs.push(...paragraphs)
    else if (paragraphs.length) blocks.push({ kind: 'text', ...titled(), paragraphs })
    paragraphs = []
  }
  const flushItems = () => {
    // Sans titre à elle (après un paragraphe), la liste prend celui de la section, sinon ses colonnes.
    const fallback = section ?? (header.length ? header.map(plainText).filter(Boolean).join(' · ') : undefined)
    const intro = title ? undefined : sectionText()
    if (!items.length) {
      // rien
    } else if (!header.length && plain.every(Boolean)) {
      // Des puces qui ne sont que du texte : « • … », dans le texte de la section s'il y en a un.
      const bullets = items.map((each) => `• ${each.title}${each.detail ? ` — ${each.detail}` : ''}`)
      if (intro) intro.paragraphs.push(...bullets)
      else blocks.push({ kind: 'text', ...(title ? titled() : fallback ? { title: fallback } : {}), paragraphs: bullets })
    } else if (intro) {
      // Le texte de la section, puis sa liste : un seul cadre, le texte en introduction.
      blocks.pop()
      blocks.push({ kind: 'list', ...(intro.title ? { title: intro.title } : {}), intro: intro.paragraphs, items })
    } else blocks.push({ kind: 'list', ...(title ? titled() : fallback ? { title: fallback } : {}), items })
    items = []
    plain = []
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
    // Un bloc de code (une arborescence, un exemple) : tel quel, espaces et retours gardés.
    // Il se ferme sur la même clôture : « ```` » autour d'un exemple qui contient « ``` ».
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) {
      flush()
      const code: string[] = []
      while (index + 1 < lines.length && lines[index + 1]!.trim() !== fence[1]) code.push(lines[++index]!)
      index++
      if (code.some((each) => each.trim())) blocks.push({ kind: 'text', ...titled(), paragraphs: [code.join('\n')], preformatted: true })
      continue
    }
    const heading = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      flush()
      // Le titre de la note (« # Calendrier — Station ») est celui de la page.
      if (heading[1]!.length > 1) section = title = plainText(heading[2]!)
      sectionStart = blocks.length
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
      plain.push(false)
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
      // « **Date limite** : samedi 12 décembre » : l'intitulé en titre, la suite en détail — pas
      // « **Titre**, **Formulation** » : l'intitulé est suivi de « : » ou « — », ou seul.
      const labelled = /^\*\*(.+?)\*\*\s*(?:[:—–]\s*(.*))?$/.exec(text)
      const added = labelled ? item(labelled[1]!, labelled[2] ? [labelled[2]] : []) : item(text, [])
      items.push(added)
      plain.push(!labelled && !added.open && !added.tone)
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

