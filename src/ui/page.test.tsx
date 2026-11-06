// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE } from '../core/appearance'
import { createI18n } from '../core/i18n'
import { ViewsRegistry, type Card, type HomeBlock } from '../core/views'
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
