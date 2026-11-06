// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **documentation** dans l'onglet : le sommaire (l'accueil de la documentation, une carte
 * par page), puis chaque page lisible — sans l'en-tête ni l'encadré « écrite dans le
 * coffre », ses liens vers d'autres pages ouverts dans l'onglet, les pages précédente et
 * suivante, un bloc de code tel quel. « Écrire dans le coffre », et « Ouvrir dans le
 * coffre » quand la note y est.
 */

import { describe, expect, it } from 'vitest'
import { documentationPages } from './docs'
import { DOCS_PAGE, docPageOf, docsPage, type DocsPageDeps } from './docsPage'
import { createI18n } from './i18n'
import type { PageView } from './views'

const FOLDER = 'Black Projects/Documentation'
const ESSAI = [
  '# Essai',
  '',
  'Un module d’essai, pour la documentation.',
  '',
  '## Dans le coffre',
  '',
  '```',
  'Essai/',
  '└── Note.md',
  '```',
  '',
  `Voir aussi [[${FOLDER}/Prise en main|la prise en main]].`,
  '',
  '## Les champs',
  '',
  'Palette de commandes → Nouvelle exigence :',
  '',
  '- **Catégorie** — elle forme l’identifiant ;',
  '- **Titre**, **Formulation**, Type.',
  '',
  '## Un exemple',
  '',
  '- Commande **Créer ou mettre à jour la',
  '  documentation**, ou depuis les réglages.',
  '',
  '````',
  '```brt-req',
  'REQ-SYS-0001',
  '```',
  '````'
].join('\n')

function start(written: string[] = []) {
  const i18n = createI18n('fr')
  const shown: string[] = []
  const opened: string[] = []
  let writes = 0
  const deps: DocsPageDeps = {
    t: (key, vars) => i18n.t(key, vars),
    version: '0.35.0',
    folder: () => FOLDER,
    pages: () => documentationPages({ version: '0.35.0', folder: FOLDER, modules: [{ name: 'Essai', version: '1.0.0', state: 'Actif', pages: [{ path: 'Modules/Essai.md', content: ESSAI }] }] }),
    exists: async (path) => written.includes(path),
    write: async () => void writes++,
    openNote: async (path) => void opened.push(path),
    showPage: (id) => void shown.push(id)
  }
  return { deps, shown, opened, writes: () => writes }
}

const cardsOf = (view: PageView) => view.blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : []))

describe('la documentation, en page', () => {
  it('le sommaire : l’accueil de la documentation, puis une carte par page qui l’ouvre dans l’onglet', async () => {
    const { deps, shown } = start()
    const view = await docsPage(deps)
    expect(DOCS_PAGE).toBe('core.documentation')
    expect(view.subtitle).toMatch(/^La documentation de Black Projects 0\.35\.0, à lire ici/)
    expect(view.actions?.map((action) => action.id)).toEqual(['write'])
    // Ni l'en-tête ni l'encadré « Créée par le plugin… » : on lit, on n'est pas dans le coffre.
    const all = JSON.stringify(view.blocks)
    for (const syntax of ['bp-doc', 'Créée par le plugin', '[[', '{{']) expect(all).not.toContain(syntax)
    const cards = cardsOf(view)
    expect(view.blocks.at(-1)).toMatchObject({ kind: 'cards', title: 'Toutes les pages (3)' })
    expect(cards.map((card) => `${card.title}:${card.subtitle}`)).toEqual(['Black Projects:Accueil', 'Prise en main:Prise en main', 'Essai:Modules/Essai'])
    expect(cards[2]!.text).toBe('Un module d’essai, pour la documentation.')
    await cards[1]!.open!.run()
    expect(shown).toEqual([docPageOf('Prise en main.md')])
    // Le lien de l'accueil vers la prise en main reste dans l'onglet.
    const links = view.blocks.flatMap((block) => (block.kind === 'list' ? block.items : [])).filter((item) => item.open)
    await links.find((item) => item.title.startsWith('Prise en main'))!.open!.run()
    expect(shown.at(-1)).toBe(docPageOf('Prise en main.md'))
  })

  it('une page : son titre, les pages précédente et suivante ; un bloc de code tel quel ; un lien vers une autre page dans l’onglet', async () => {
    const { deps, shown } = start()
    const view = await docsPage(deps, encodeURIComponent('Modules/Essai.md'))
    expect(view.title).toBe('Essai')
    expect(view.back?.label).toBe('Toute la documentation')
    expect(view.subtitle).toBe('Documentation de Black Projects 0.35.0 · Modules/Essai')
    expect(view.actions?.map((action) => action.label)).toEqual(['Toute la documentation', '← Prise en main'])
    expect(view.blocks.find((block) => block.kind === 'text' && block.preformatted)).toEqual({ kind: 'text', title: 'Dans le coffre', paragraphs: ['Essai/\n└── Note.md'], preformatted: true })
    const middle = await docsPage(deps, encodeURIComponent('Prise en main.md'))
    expect(middle.actions?.map((action) => action.label)).toEqual(['Toute la documentation', '← Black Projects', 'Essai →'])
    await middle.actions!.find((action) => action.id === 'next')!.run()
    expect(shown.at(-1)).toBe(docPageOf('Modules/Essai.md'))
    const text = view.blocks.filter((block) => block.kind === 'text' && !block.preformatted)
    expect(JSON.stringify(text)).toContain('Voir aussi la prise en main.')
    // Une puce qui continue sur la ligne suivante : une seule puce, le gras entier.
    // Une phrase puis sa liste : un seul cadre, la phrase en introduction ; « **Titre**, **Formulation** » n'est pas un intitulé.
    expect(view.blocks.find((block) => block.kind === 'list' && block.title === 'Les champs')).toMatchObject({
      intro: ['Palette de commandes → Nouvelle exigence :'],
      items: [{ title: 'Catégorie', detail: 'elle forme l’identifiant ;' }, { title: 'Titre, Formulation, Type.' }]
    })
    expect(view.blocks.filter((block) => 'title' in block && block.title === 'Les champs')).toHaveLength(1)
    // Une puce de texte (ni lien, ni intitulé) se lit en texte.
    expect(view.blocks.find((block) => block.kind === 'text' && block.title === 'Un exemple')).toEqual({ kind: 'text', title: 'Un exemple', paragraphs: ['• Commande Créer ou mettre à jour la documentation, ou depuis les réglages.'] })
    // Un exemple qui contient « ``` », entouré de « ```` » : tel quel.
    expect(view.blocks.at(-1)).toEqual({ kind: 'text', paragraphs: ['```brt-req\nREQ-SYS-0001\n```'], preformatted: true })
  })

  it('« Écrire dans le coffre » ; « Ouvrir dans le coffre » quand la note y est ; une page inconnue', async () => {
    const { deps, opened, writes } = start([`${FOLDER}/Accueil.md`, `${FOLDER}/Modules/Essai.md`])
    const index = await docsPage(deps)
    expect(index.actions?.map((action) => action.id)).toEqual(['write', 'vault'])
    await index.actions![0]!.run()
    expect(writes()).toBe(1)
    await index.actions![1]!.run()
    expect(opened).toEqual([`${FOLDER}/Accueil.md`])
    const page = await docsPage(deps, encodeURIComponent('Modules/Essai.md'))
    expect(page.actions?.at(-1)?.id).toBe('vault')
    expect((await docsPage(deps, encodeURIComponent('Modules/Retiré.md'))).title).toBe('Page introuvable')
  })
})
