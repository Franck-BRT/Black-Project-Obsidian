// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE } from '../core/appearance'
import { createI18n } from '../core/i18n'
import { ViewsRegistry, type Card, type HomeBlock } from '../core/views'
import { BlockView } from './components'
import type { AppHost } from './host'
import { filterBlocks, fold } from './page'
import { App } from './shell'

const card = (id: string, title: string, subtitle: string, tags: string[]): Card => ({ id, title, subtitle, tags, badges: [{ label: tags[0] ?? '', tone: 'info' }] })
const BLOCKS: HomeBlock[] = [
  { kind: 'stats', stats: [{ label: 'Analyses', value: '3' }] },
  { kind: 'cards', cards: [card('a', 'Station sol', 'Agence spatiale · AO-118', ['candidat', 'a-venir']), card('b', 'Maintenance antennes', 'Centre spatial', ['emetteur']), card('c', 'Télémesure', 'Agence spatiale', ['candidat'])] },
  { kind: 'list', items: [{ id: '1', title: 'Échéance du RC', detail: 'Station sol' }] }
]

describe('la recherche et les filtres d’une page', () => {
  it('sans accents ni majuscules', () => {
    expect(fold('Échéance Télémesure')).toBe('echeance telemesure')
  })

  it('tous les mots cherchés, dans le titre, l’acheteur, les badges ; le reste ne bouge pas', () => {
    const found = filterBlocks(BLOCKS, 'agence telemesure', null)
    expect(found.blocks[1]!.kind === 'cards' && found.blocks[1]!.cards.map((each) => each.id)).toEqual(['c'])
    expect(found.blocks[0]).toBe(BLOCKS[0])
    expect(found.hits).toBe(1)
    expect(found.total).toBe(4)
    expect(filterBlocks(BLOCKS, 'echeance', null).hits).toBe(1)
  })

  it('avec un filtre, seules les cartes comptent ; un bloc vidé dit que rien ne correspond', () => {
    const found = filterBlocks(BLOCKS, '', 'emetteur', 'Rien')
    expect([found.hits, found.total]).toEqual([1, 3])
    const none = filterBlocks(BLOCKS, '', 'inconnu', 'Rien')
    expect(none.blocks[1]).toMatchObject({ kind: 'cards', cards: [], empty: 'Rien' })
    expect(none.blocks[2]).toMatchObject({ kind: 'list', items: [{ id: '1' }] })
    expect(filterBlocks(BLOCKS, 'zzz', null, 'Rien').blocks[2]).toMatchObject({ items: [], empty: 'Rien' })
  })

  it('une liste dont les éléments portent des filtres (le journal) se filtre et compte comme des cartes', () => {
    const journal: HomeBlock[] = [{ kind: 'list', items: [{ id: '1', title: 'A', tags: ['echecs'] }, { id: '2', title: 'B', tags: ['reussies'] }] }]
    const found = filterBlocks(journal, '', 'echecs', 'Rien')
    expect(found.blocks[0]!.kind === 'list' && found.blocks[0]!.items.map((item) => item.id)).toEqual(['1'])
    expect([found.hits, found.total]).toEqual([1, 2])
  })

  it('du texte (une note produite) : la recherche garde les paragraphes qui répondent ; un filtre ne le trie pas', () => {
    const text: HomeBlock[] = [{ kind: 'text', title: 'Réponse', paragraphs: ['Les pénalités de retard sont de 1/1000.', 'La garantie court deux ans.'] }]
    const found = filterBlocks(text, 'penalites', null, 'Rien')
    expect(found.blocks[0]).toEqual({ kind: 'text', title: 'Réponse', paragraphs: ['Les pénalités de retard sont de 1/1000.'] })
    expect([found.hits, found.total]).toEqual([1, 2])
    expect(filterBlocks(text, 'zzz', null, 'Rien').blocks[0]).toMatchObject({ paragraphs: [], empty: 'Rien' })
    expect(filterBlocks(text, '', 'candidat').total).toBe(0)
    const html = renderToString(<BlockView block={text[0]!} t={(key) => key} now={new Date()} locale="fr" />)
    expect(html).toContain('<h3 class="bp-block-title">Réponse</h3>')
    expect(html).toContain('<div class="bp-prose"><p class="bp-text">Les pénalités de retard sont de 1/1000.</p><p class="bp-text">La garantie court deux ans.</p></div>')
  })

  it('un filtre garde les cartes qui y répondent ; avec la recherche, les deux', () => {
    const found = filterBlocks(BLOCKS, '', 'candidat')
    expect(found.blocks[1]!.kind === 'cards' && found.blocks[1]!.cards.map((each) => each.id)).toEqual(['a', 'c'])
    expect(filterBlocks(BLOCKS, 'station', 'candidat').blocks[1]!.kind === 'cards' && (filterBlocks(BLOCKS, 'station', 'candidat').blocks[1] as { cards: Card[] }).cards.map((each) => each.id)).toEqual(['a'])
  })
})

describe('une page de module dans l’onglet', () => {
  const t = createI18n('fr').t.bind(createI18n('fr'))
  function host(): AppHost {
    const views = new ViewsRegistry()
    views.page({ id: 'ao.analyses', title: 'Analyses d’appels d’offres', icon: 'folder', load: async () => ({ blocks: BLOCKS }) })
    views.nav({ id: 'ao.analyses', label: 'Analyses', icon: 'folder', order: 10, page: 'ao.analyses', run: () => undefined })
    views.page({ id: 'ao.fiche', title: 'Analyse', icon: 'folder', parent: 'ao.analyses', load: async (param) => ({ title: `Fiche ${param}`, blocks: [] }) })
    return {
      t,
      locale: 'fr-FR',
      version: '0.15.0',
      sections: () => [],
      pages: () => views.pages(),
      tiles: () => [],
      homeTiles: () => null,
      saveHomeTiles: async () => undefined,
      dashboard: () => null,
      saveDashboard: async () => undefined,
      nav: () => views.navEntries(),
      navMenu: () => null,
      saveNavMenu: async () => undefined,
      appearance: () => DEFAULT_APPEARANCE,
      saveAppearance: async () => undefined,
      hostIsDark: () => false,
      now: () => new Date('2026-11-06T09:30:00')
    }
  }

  it('son titre en tête, son entrée du menu marquée « page en cours »', () => {
    const html = renderToString(<App host={host()} generation={0} page="ao.analyses" />)
    expect(html).toMatch(/<h1 class="bp-hello"><svg[^>]*>.*?<\/svg>Analyses d’appels d’offres<\/h1>/)
    expect(html).toMatch(/aria-current="page"><svg[^>]*>.*?<\/svg>Analyses<\/button>/)
    // Le temps de charger : un squelette.
    expect(html).toContain('bp-skeleton')
  })

  it('une page avec un paramètre (« ao.fiche?42 ») : la page trouvée, l’entrée de sa page parente marquée', () => {
    const html = renderToString(<App host={host()} generation={0} page="ao.fiche?42" />)
    expect(html).toMatch(/<h1 class="bp-hello"><svg[^>]*>.*?<\/svg>Analyse<\/h1>/)
    expect(html).toMatch(/aria-current="page"><svg[^>]*>.*?<\/svg>Analyses<\/button>/)
  })

  it('une page inconnue (module désactivé) : l’accueil', () => {
    const html = renderToString(<App host={host()} generation={0} page="disparu.page" />)
    expect(html).toContain('Modifier l’accueil')
    expect(html).toMatch(/aria-current="page"><svg[^>]*>.*?<\/svg>Accueil<\/button>/)
  })
})
