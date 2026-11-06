// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE } from '../core/appearance'
import { createI18n } from '../core/i18n'
import { readDashboard, readSettings } from '../core/settings'
import { ViewsRegistry, type DashboardLayout, type HomeSection } from '../core/views'
import { arrange, columnOf, defaultLayout, hideSection, moveSection, placeSection, showSection, switchColumn, toggleCollapsed } from './dashboard'
import type { AppHost } from './host'
import { App } from './shell'

const section = (id: string, area: 'main' | 'side', order: number): HomeSection => ({
  id,
  title: `Titre ${id}`,
  icon: 'list',
  order,
  area,
  load: async () => ({ title: `Titre ${id}`, blocks: [] })
})
const ALL = [section('a', 'main', 10), section('b', 'side', 20), section('c', 'side', 30), section('d', 'main', 40)]

describe('le rangement du tableau de bord', () => {
  it('par défaut : chaque section dans sa colonne, dans l’ordre des modules', () => {
    expect(defaultLayout(ALL)).toEqual({ main: ['a', 'd'], side: ['b', 'c'], hidden: [], collapsed: [] })
    expect(arrange(ALL, null)).toEqual(defaultLayout(ALL))
  })

  it('celui de l’utilisateur, sans les sections disparues, avec les nouvelles à la fin de leur colonne', () => {
    const saved: DashboardLayout = { main: ['c', 'gone'], side: ['a'], hidden: ['b'], collapsed: ['a', 'gone'] }
    expect(arrange(ALL, saved)).toEqual({ main: ['c', 'd'], side: ['a'], hidden: ['b'], collapsed: ['a'] })
  })

  it('monter, descendre — sans sortir de la colonne', () => {
    const layout = defaultLayout(ALL)
    expect(moveSection(layout, 'd', -1).main).toEqual(['d', 'a'])
    expect(moveSection(layout, 'a', -1)).toBe(layout)
    expect(moveSection(layout, 'c', 1)).toBe(layout)
    expect(moveSection(layout, 'b', 1).side).toEqual(['c', 'b'])
  })

  it('changer de colonne, à la même hauteur ; glisser avant une autre ou à la fin', () => {
    const layout = defaultLayout(ALL)
    expect(switchColumn(layout, 'd')).toMatchObject({ main: ['a'], side: ['b', 'd', 'c'] })
    expect(switchColumn(layout, 'b')).toMatchObject({ main: ['b', 'a', 'd'], side: ['c'] })
    expect(placeSection(layout, 'c', 'main', 'a')).toMatchObject({ main: ['c', 'a', 'd'], side: ['b'] })
    expect(placeSection(layout, 'a', 'main')).toMatchObject({ main: ['d', 'a'] })
    expect(placeSection(layout, 'a', 'main', 'a')).toBe(layout)
    expect(columnOf(layout, 'c')).toBe('side')
  })

  it('masquer, réafficher dans sa colonne par défaut ; réduire, déplier', () => {
    const hidden = hideSection(switchColumn(defaultLayout(ALL), 'b'), 'b')
    expect(hidden).toMatchObject({ main: ['a', 'd'], side: ['c'], hidden: ['b'] })
    expect(columnOf(hidden, 'b')).toBeNull()
    expect(showSection(hidden, ALL[1]!)).toMatchObject({ side: ['c', 'b'], hidden: [] })
    const collapsed = toggleCollapsed(hidden, 'a')
    expect(collapsed.collapsed).toEqual(['a'])
    expect(toggleCollapsed(collapsed, 'a').collapsed).toEqual([])
  })

  it('les réglages : lus sans les croire sur parole', () => {
    expect(readSettings({}).dashboard).toBeNull()
    expect(readDashboard('n’importe quoi')).toBeNull()
    expect(readDashboard({ main: ['a', 'a', 3, ''], side: ['a', 'b'], hidden: 'x', collapsed: ['b'] })).toEqual({ main: ['a'], side: ['b'], hidden: [], collapsed: ['b'] })
  })
})

describe('la page du tableau de bord', () => {
  const i18n = createI18n('fr')
  const t = i18n.t.bind(i18n)
  function host(layout: DashboardLayout | null): AppHost {
    const views = new ViewsRegistry()
    for (const each of ALL) views.home(each)
    return {
      t,
      locale: 'fr-FR',
      version: '0.13.0',
      sections: () => views.homeSections(),
      tiles: () => [],
      homeTiles: () => null,
      saveHomeTiles: async () => undefined,
      dashboard: () => layout,
      saveDashboard: async () => undefined,
      nav: () => [],
      appearance: () => DEFAULT_APPEARANCE,
      saveAppearance: async () => undefined,
      hostIsDark: () => false,
      now: () => new Date('2026-11-06T09:30:00')
    }
  }
  const render = (layout: DashboardLayout | null) => renderToString(<App host={host(layout)} generation={0} page="dashboard" />)

  it('les sections dans l’ordre choisi, le bouton pour le modifier, chaque section repliable', () => {
    const html = render({ main: ['d', 'a'], side: ['c'], hidden: ['b'], collapsed: [] })
    expect(html).toContain('Modifier le tableau de bord')
    const order = [...html.matchAll(/data-section="(\w)"/g)].map((found) => found[1])
    expect(order).toEqual(['d', 'a', 'c'])
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Réduire « Titre d »')
  })

  it('une section réduite : son titre seul, sans chargement', () => {
    const html = render({ main: ['a'], side: [], hidden: ['b', 'c', 'd'], collapsed: ['a'] })
    expect(html).toMatch(/class="bp-section is-collapsed"[^>]*data-section="a"/)
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Déplier « Titre a »')
    expect(html).not.toContain('bp-skeleton')
    // Une seule colonne remplie : toute la largeur.
    expect(html).toContain('class="bp-home is-single"')
  })

  it('toutes masquées : dit comment les réafficher', () => {
    expect(render({ main: [], side: [], hidden: ['a', 'b', 'c', 'd'], collapsed: [] })).toContain('Toutes les sections sont masquées')
  })
})
