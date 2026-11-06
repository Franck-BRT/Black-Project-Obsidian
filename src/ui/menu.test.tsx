// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE } from '../core/appearance'
import { createI18n } from '../core/i18n'
import { readNavMenu, readSettings } from '../core/settings'
import { ViewsRegistry, type NavEntry, type NavLayout, type TileSpec } from '../core/views'
import type { AppHost } from './host'
import { addableMenu, menuCatalog, menuLayout, shownMenu, TILE_PREFIX } from './menu'
import { App } from './shell'

const entry = (id: string, label: string): NavEntry => ({ id, label, icon: 'list', order: 0, run: () => undefined })
const tile = (id: string, label: string, group = 'AO'): TileSpec => ({ id, label, icon: 'plus', color: 'blue', group, order: 0, run: () => undefined })
const ENTRIES = [entry('ui.dashboard', 'Tableau de bord'), entry('ao', 'Analyses'), entry('exigences', 'Exigences'), entry('accueil', 'Accueil')]
const TILES = [tile('ui.tableau', 'Tableau de bord', 'Black Projects'), tile('ao.analyses', 'Analyses'), tile('ao.calendrier', 'Calendrier'), tile('core.reglages', 'Paramètres', 'Black Projects'), tile('core.documentation', 'Documentation', 'Black Projects')]

describe('le rangement du menu de gauche', () => {
  const items = menuCatalog(ENTRIES, TILES, 'Menu', ['Accueil', 'Paramètres'])

  it('le catalogue : les entrées par défaut, puis les tuiles sans double emploi ni Accueil ni Paramètres', () => {
    expect(items.map((item) => `${item.id}:${item.byDefault}`)).toEqual(['ui.dashboard:true', 'ao:true', 'exigences:true', `${TILE_PREFIX}ao.calendrier:false`, `${TILE_PREFIX}core.documentation:false`])
  })

  it('montrées : par défaut, celles des modules ; sinon celles choisies, plus les nouvelles par défaut', () => {
    expect(shownMenu(items, null)).toEqual(['ui.dashboard', 'ao', 'exigences'])
    const saved: NavLayout = { shown: [`${TILE_PREFIX}ao.calendrier`, 'ao', 'disparue'], hidden: ['ui.dashboard'] }
    expect(shownMenu(items, saved)).toEqual([`${TILE_PREFIX}ao.calendrier`, 'ao', 'exigences'])
  })

  it('à ajouter : les entrées retirées et les fonctions, par module', () => {
    expect(addableMenu(items, ['ao']).map(({ group, items: list }) => [group, list.map((item) => item.label)])).toEqual([
      ['Menu', ['Tableau de bord', 'Exigences']],
      ['AO', ['Calendrier']],
      ['Black Projects', ['Documentation']]
    ])
  })

  it('le rangement gardé : les entrées par défaut retirées, même d’un module désactivé pour l’instant', () => {
    expect(menuLayout(items, ['ao'], { shown: [], hidden: ['ia'] })).toEqual({ shown: ['ao'], hidden: ['ia', 'ui.dashboard', 'exigences'] })
    expect(menuLayout(items, ['exigences', 'ui.dashboard', 'ao'])).toEqual({ shown: ['exigences', 'ui.dashboard', 'ao'], hidden: [] })
  })

  it('les réglages : lus sans les croire sur parole', () => {
    expect(readSettings({}).navMenu).toBeNull()
    expect(readNavMenu(['a'])).toBeNull()
    expect(readNavMenu({ shown: ['a', 'a', 4], hidden: ['a', 'b'] })).toEqual({ shown: ['a'], hidden: ['b'] })
  })
})

describe('la barre de gauche', () => {
  const t = createI18n('fr').t.bind(createI18n('fr'))
  function host(layout: NavLayout | null, settings = true): AppHost {
    const views = new ViewsRegistry()
    views.nav({ id: 'exigences', label: 'Exigences', icon: 'list', order: 20, run: () => undefined })
    views.nav({ id: 'workflows', label: 'Workflows', icon: 'flow', order: 30, run: () => undefined })
    views.tile({ id: 'ao.calendrier', label: 'Calendrier', icon: 'calendar', color: 'orange', group: 'AO', order: 13, run: () => undefined })
    return {
      t,
      locale: 'fr-FR',
      version: '0.14.0',
      sections: () => [],
      pages: () => [],
      tiles: () => views.allTiles(),
      homeTiles: () => null,
      saveHomeTiles: async () => undefined,
      dashboard: () => null,
      saveDashboard: async () => undefined,
      nav: () => views.navEntries(),
      navMenu: () => layout,
      saveNavMenu: async () => undefined,
      ...(settings ? { openSettings: () => undefined } : {}),
      appearance: () => DEFAULT_APPEARANCE,
      saveAppearance: async () => undefined,
      hostIsDark: () => false,
      now: () => new Date('2026-11-06T09:30:00')
    }
  }
  const labels = (html: string) => [...html.matchAll(/class="bp-nav-item"[^>]*>(?:<svg[^>]*>.*?<\/svg>)([^<]+)</g)].map((found) => found[1])

  it('Accueil en premier, Paramètres en dernier, et le menu rangé entre les deux', () => {
    const html = renderToString(<App host={host({ shown: ['workflows', `${TILE_PREFIX}ao.calendrier`], hidden: ['ui.dashboard', 'exigences'] })} generation={0} />)
    expect(labels(html)).toEqual(['Accueil', 'Workflows', 'Calendrier', 'Paramètres'])
    // En bas, sous la séparation : « Modifier le menu », puis Paramètres en dernier.
    expect(html).toMatch(/class="bp-nav-bottom"><button type="button" class="bp-menu-link" data-tool="edit"[^>]*>.*?Modifier le menu<\/span><\/button><button type="button" class="bp-nav-item">.*?Paramètres<\/button><\/div><\/nav>/)
  })

  it('par défaut : le tableau de bord et les entrées des modules ; sans paramètres chez l’hôte, seulement « Modifier le menu » en bas', () => {
    expect(labels(renderToString(<App host={host(null)} generation={0} />))).toEqual(['Accueil', 'Tableau de bord', 'Exigences', 'Workflows', 'Paramètres'])
    const bare = renderToString(<App host={host(null, false)} generation={0} />)
    expect(bare).not.toContain('Paramètres')
    expect(bare).toContain('Modifier le menu')
  })

  it('les paramètres en page dans l’onglet : sur leur page, l’entrée Paramètres est « page en cours »', () => {
    const base = host(null)
    const withPage = { ...base, settingsPage: 'core.parametres', pages: () => [{ id: 'core.parametres', title: 'Paramètres', icon: 'settings' as const, load: async () => ({ blocks: [] }) }] }
    const on = renderToString(<App host={withPage} generation={0} page="core.parametres" />)
    expect(on).toMatch(/<button type="button" class="bp-nav-item" aria-current="page">.*?Paramètres<\/button><\/div><\/nav>/)
    const off = renderToString(<App host={withPage} generation={0} />)
    expect(off).not.toMatch(/aria-current="page">(?:(?!<button).)*Paramètres<\/button>/)
  })
})
