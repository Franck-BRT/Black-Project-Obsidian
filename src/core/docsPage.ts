// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **documentation** dans l'onglet de Black Projects : les mêmes pages que celles écrites
 * dans le coffre (l'accueil, la prise en main, celles des modules), lues en page sans la
 * syntaxe Markdown — sans avoir à les écrire d'abord. Les liens d'une page vers une autre
 * restent dans l'onglet ; « Écrire dans le coffre » garde les notes à côté du travail, et
 * « Ouvrir dans le coffre » ouvre la note quand elle y est.
 */

import type { DocPage } from './docs'
import { noteBlocks, plainText } from './markdown'
import { pageWith, type Card, type PageView, type ViewAction } from './views'

/** La documentation : `DOCS_PAGE` pour son sommaire, `docPageOf(chemin)` pour une page. */
export const DOCS_PAGE = 'core.documentation'
export const docPageOf = (path: string): string => pageWith(DOCS_PAGE, encodeURIComponent(path))

type Translate = (key: string, vars?: Readonly<Record<string, string | number>>) => string

export interface DocsPageDeps {
  t: Translate
  version: string
  /** Le dossier de la documentation dans le coffre (les liens des pages le portent). */
  folder(): string
  /** Les pages, telles qu'elles seraient écrites (`documentationPages`). */
  pages(): readonly DocPage[]
  /** La note est-elle dans le coffre ? */
  exists(path: string): Promise<boolean>
  /** Écrire (ou mettre à jour) la documentation dans le coffre. */
  write(): Promise<void>
  openNote(path: string): Promise<void>
  showPage(id: string): void
}

/** Le texte d'une page, sans son en-tête ni l'encadré qui dit qu'elle a été écrite dans le coffre. */
export function docBody(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').replace(/^\s*>\s*\[!note\][^\n]*\n(?:>[^\n]*\n)*/, '')
}

/** Le titre d'une page : son « # Titre », sinon son nom. */
export function docTitle(page: DocPage): string {
  const heading = /^#\s+(.+)$/m.exec(docBody(page.content))
  return heading ? plainText(heading[1]!) : page.path.slice(page.path.lastIndexOf('/') + 1).replace(/\.md$/, '')
}

/** Le premier paragraphe d'une page, pour la présenter dans le sommaire. */
function docSummary(page: DocPage): string {
  const block = noteBlocks(docBody(page.content), () => undefined).find((each) => each.kind === 'text' && !each.preformatted)
  const text = block?.kind === 'text' ? (block.paragraphs[0] ?? '') : ''
  return text.length > 220 ? `${text.slice(0, 219)}…` : text
}

/**
 * La documentation : sans paramètre, son sommaire — l'accueil de la documentation, puis une
 * carte par page ; avec le chemin d'une page, cette page, lisible, ses liens vers d'autres
 * pages ouverts dans l'onglet, et les pages précédente et suivante.
 */
export async function docsPage(deps: DocsPageDeps, param?: string): Promise<PageView> {
  const { t } = deps
  const folder = deps.folder()
  const pages = deps.pages()
  const byPath = new Map(pages.map((page) => [page.path, page]))
  // Un lien « [[Dossier/Modules/IA|IA]] » : une page de la documentation s'ouvre dans l'onglet ; une autre note, dans le coffre.
  const opener = (target: string): ViewAction | undefined => {
    const relative = target.startsWith(`${folder}/`) ? target.slice(folder.length + 1) : target
    if (byPath.has(relative)) return { id: 'open', label: t('docs.page.open'), run: () => deps.showPage(docPageOf(relative)) }
    return { id: 'open', label: t('docs.page.note'), run: () => deps.openNote(target) }
  }
  const write: ViewAction = { id: 'write', label: t('docs.page.write'), tooltip: t('docs.page.write.tip'), icon: 'refresh', run: () => deps.write() }
  const inVault = async (path: string): Promise<ViewAction[]> =>
    (await deps.exists(`${folder}/${path}`)) ? [{ id: 'vault', label: t('docs.page.vault'), tooltip: t('docs.page.vault.tip', { folder }), icon: 'file', run: () => deps.openNote(`${folder}/${path}`) }] : []
  const search = { label: t('docs.page.search'), placeholder: t('docs.page.search.placeholder') }

  const path = param ? decodeURIComponent(param) : ''
  if (!path) {
    const home = pages[0]
    const cards: Card[] = pages.map((page) => ({
      id: page.path,
      title: docTitle(page),
      subtitle: page.path.replace(/\.md$/, ''),
      icon: 'book',
      ...(docSummary(page) ? { text: docSummary(page) } : {}),
      open: { id: 'open', label: t('docs.page.open'), tooltip: t('docs.page.open'), run: () => deps.showPage(docPageOf(page.path)) }
    }))
    return {
      subtitle: t('docs.page.subtitle', { version: deps.version }),
      actions: [write, ...(home ? await inVault(home.path) : [])],
      search,
      blocks: [
        ...(home ? noteBlocks(docBody(home.content), opener) : []),
        { kind: 'cards', title: t('docs.page.all', { count: pages.length }), cards }
      ]
    }
  }

  const index = pages.findIndex((page) => page.path === path)
  const page = pages[index]
  const back: ViewAction = { id: 'back', label: t('docs.page.index'), run: () => deps.showPage(DOCS_PAGE) }
  if (!page) return { title: t('docs.page.missing.title'), back, blocks: [{ kind: 'message', tone: 'warning', text: t('docs.page.missing') }] }
  const previous = pages[index - 1]
  const next = pages[index + 1]
  return {
    title: docTitle(page),
    back,
    subtitle: t('docs.page.of', { version: deps.version, path: page.path.replace(/\.md$/, '') }),
    actions: [
      { id: 'index', label: t('docs.page.index'), icon: 'book', run: () => deps.showPage(DOCS_PAGE) },
      ...(previous ? [{ id: 'previous', label: t('docs.page.previous', { title: docTitle(previous) }), icon: 'back' as const, run: () => deps.showPage(docPageOf(previous.path)) }] : []),
      ...(next ? [{ id: 'next', label: t('docs.page.next', { title: docTitle(next) }), icon: 'chevron' as const, run: () => deps.showPage(docPageOf(next.path)) }] : []),
      ...(await inVault(page.path))
    ],
    search,
    // Le « # Titre » est celui de la page : les blocs commencent après.
    blocks: noteBlocks(docBody(page.content), opener)
  }
}
