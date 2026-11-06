// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** L'interface rendue en texte, sans navigateur : thèmes, accueil, accessibilité. */

import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE, readAppearance, resolvedMode, type Appearance } from '../core/appearance'
import type { HomeSection } from '../core/views'
import { ViewsRegistry } from '../core/views'
import { createI18n } from '../core/i18n'
import { BlockView } from './components'
import type { AppHost } from './host'
import { daysUntil, deadlineTone, greetingKey, starGlyphs } from './logic'
import { App } from './shell'
import { scopeCss, UI_CSS } from './styles'
import { addableTiles, moveTile, shownTiles } from './tiles'
import type { TileSpec } from '../core/views'

const i18n = createI18n('fr')
const t = i18n.t.bind(i18n)
const NOW = new Date('2026-11-06T09:30:00')

function host(appearance: Appearance = DEFAULT_APPEARANCE, sections: HomeSection[] = [], dark = false): AppHost {
  const views = new ViewsRegistry()
  for (const section of sections) views.home(section)
  views.nav({ id: 'exigences', label: 'Exigences', icon: 'list', order: 20, run: () => undefined })
  return {
    t,
    locale: 'fr-FR',
    version: '0.10.0',
    sections: () => views.homeSections(),
    tiles: () => views.allTiles(),
    homeTiles: () => null,
    saveHomeTiles: async () => undefined,
    dashboard: () => null,
    saveDashboard: async () => undefined,
    navMenu: () => null,
    saveNavMenu: async () => undefined,
    nav: () => views.navEntries(),
    appearance: () => appearance,
    saveAppearance: async () => undefined,
    hostIsDark: () => dark,
    now: () => NOW
  }
}

describe('la logique', () => {
  it('les jours d’ici une échéance, et leur urgence', () => {
    expect(daysUntil('2026-11-06', NOW)).toBe(0)
    expect(daysUntil('2026-11-20', NOW)).toBe(14)
    expect(daysUntil('2026-11-01', NOW)).toBe(-5)
    expect(daysUntil('demain', NOW)).toBeNull()
    expect([deadlineTone(-1), deadlineTone(3), deadlineTone(14), deadlineTone(40)]).toEqual(['neutral', 'danger', 'warning', 'success'])
    expect(greetingKey(NOW)).toBe('ui.hello.morning')
    expect(starGlyphs(3.6)).toBe('★★★★☆')
  })

  it('l’apparence lue avec soin ; « auto » suit l’hôte', () => {
    expect(readAppearance({ mode: 'dark', vision: 'mono', reading: 'dys', size: 'larger', motion: 'reduced' })).toEqual({
      mode: 'dark',
      vision: 'mono',
      reading: 'dys',
      size: 'larger',
      motion: 'reduced'
    })
    expect(readAppearance({ mode: 'violet', vision: 42 })).toEqual(DEFAULT_APPEARANCE)
    expect(resolvedMode(DEFAULT_APPEARANCE, true)).toBe('dark')
    expect(resolvedMode({ ...DEFAULT_APPEARANCE, mode: 'light' }, true)).toBe('light')
  })
})

describe('la coquille', () => {
  it('pose le thème sur la racine : mode, couleurs, lecture, taille, mouvement', () => {
    const html = renderToString(<App host={host({ mode: 'auto', vision: 'red-green', reading: 'dys', size: 'large', motion: 'reduced' }, [], true)} generation={0} />)
    expect(html).toContain('class="bp-ui" data-mode="dark" data-vision="red-green" data-reading="dys" data-size="large" data-motion="reduced" lang="fr"')
  })

  it('l’accueil : la navigation, le bonjour, la date, les tuiles', () => {
    const html = renderToString(<App host={host()} generation={0} />)
    expect(html).toContain('<nav class="bp-nav" aria-label="Navigation">')
    expect(html).toMatch(/aria-current="page"><svg[^>]*>.*?<\/svg>Accueil<\/button>/)
    expect(html).toContain('>Tableau de bord<')
    expect(html).toContain('>Exigences<')
    expect(html).toContain('<h1 class="bp-hello">Bonjour</h1>')
    expect(html).toContain('vendredi 6 novembre 2026')
    // La tuile du tableau de bord est toujours proposée, et présente par défaut.
    expect(html).toMatch(/data-tile="ui.tableau".*bp-tile-indigo.*<span class="bp-tile-label">Tableau de bord<\/span>/)
    expect(html).toContain('Modifier l’accueil')
    expect(html).toContain('Version 0.10.0')
  })

  it('le tableau de bord : son titre, et vide, expliqué', () => {
    const html = renderToString(<App host={host()} generation={0} page="dashboard" />)
    expect(html).toContain('<h1 class="bp-hello">Tableau de bord</h1>')
    expect(html).toMatch(/aria-current="page"><svg[^>]*>.*?<\/svg>Tableau de bord<\/button>/)
    expect(html).toContain('Aucun module actif n’a de section d’accueil.')
  })
})

describe('les blocs', () => {
  const render = (block: Parameters<typeof BlockView>[0]['block']) => renderToString(<BlockView block={block} t={t} now={NOW} locale="fr-FR" />)

  it('une carte : titre ouvrant, badges avec icône et mot, échéance en jours, faits, étoiles', () => {
    const html = render({
      kind: 'cards',
      cards: [
        {
          id: 'a',
          title: 'Station sol',
          subtitle: 'Agence',
          badges: [{ label: '2 pièce(s) non lue(s)', tone: 'warning' }],
          deadline: { date: '2026-11-11', label: 'Date limite de remise des offres' },
          facts: [{ label: 'Pièces', value: '10' }],
          rating: { stars: 3.8, label: 'qualité moyenne' },
          open: { id: 'o', label: 'Ouvrir', run: () => undefined },
          actions: [{ id: 'c', label: 'Calendrier', icon: 'calendar', run: () => undefined }]
        }
      ]
    })
    expect(html).toContain('<button type="button" class="bp-card-open"')
    expect(html).toMatch(/class="bp-badge bp-tone-warning"><svg[^>]*aria-hidden="true"[^>]*>.*<\/svg>2 pièce\(s\) non lue\(s\)<\/span>/)
    expect(html).toContain('bp-deadline bp-tone-danger')
    expect(html).toContain('J-5')
    expect(html).toContain('mercredi 11 novembre 2026 · dans 5 jour(s)')
    expect(html).toContain('<dt>Pièces</dt><dd>10</dd>')
    expect(html).toContain('★★★★☆')
    expect(html).toContain('4 étoile(s) sur 5')
  })

  it('une liste vide dit qu’elle est vide ; un message d’erreur est une alerte', () => {
    expect(render({ kind: 'list', items: [], empty: 'Aucune exécution.' })).toContain('Aucune exécution.')
    expect(render({ kind: 'message', tone: 'danger', text: 'Échec' })).toContain('role="alert"')
  })
})

describe('les styles', () => {
  it('chaque palette, la lecture dys et le mouvement réduit sont définis, sous .bp-ui seulement', () => {
    for (const selector of ['[data-mode="dark"]', '[data-vision="red-green"]', '[data-vision="blue-yellow"]', '[data-vision="mono"]', '[data-reading="dys"]', '[data-size="larger"]', '[data-motion="reduced"]']) {
      expect(UI_CSS).toContain(`.bp-ui${selector}`)
    }
    // Aucune règle hors de l'interface (hors @media et @keyframes).
    const rules = UI_CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '').match(/(^|\})\s*([^@{}\s][^{}]*)\{/g) ?? []
    for (const rule of rules) {
      const selectors = rule.replace(/^\}?\s*/, '').replace(/\{$/, '').replace(/\([^()]*\)/g, '()').split(',')
      // Sous la racine, pour l'emporter sur les styles d'éléments de l'hôte (les boutons d'Obsidian).
      for (const selector of selectors) if (selector.trim()) expect(selector.trim(), selector).toMatch(/^\.bp-ui(?=[ .[:]|$)/)
    }
    expect(UI_CSS).not.toMatch(/text-transform:\s*uppercase/)
  })

  it('les règles des composants sont préfixées par la racine, jusque dans les @media', () => {
    const css = scopeCss('/* c */ .a, .bp-ui .b, .bp-ui.c, .d:is(.e, .f) { x: 1; }\n@media (max-width: 9px) { .g { y: 2; } }\n@keyframes k { from { z: 0; } to { z: 1; } }')
    expect(css).toContain('.bp-ui .a, .bp-ui .b, .bp-ui.c, .bp-ui .d:is(.e, .f) { x: 1; }')
    expect(css).toContain('@media (max-width: 9px) {\n.bp-ui .g { y: 2; }')
    expect(css).toContain('@keyframes k { from { z: 0; } to { z: 1; } }')
    expect(css).not.toContain('/* c */')
    // Les boutons : ce qu'Obsidian leur pose est remis à zéro.
    expect(UI_CSS).toMatch(/\.bp-ui button \{[^}]*height: auto;[^}]*box-shadow: none;[^}]*white-space: normal;/)
    expect(UI_CSS).toContain('.bp-ui .bp-tile {')
  })
})

describe('les tuiles', () => {
  const tile = (id: string, group: string, byDefault = false): TileSpec => ({ id, label: id, icon: 'plus', color: 'blue', group, order: 0, byDefault, run: () => undefined })
  const all = [tile('a', 'AO', true), tile('b', 'AO'), tile('c', 'Exigences', true), tile('d', 'IA')]

  it('par défaut, celles marquées ; sinon celles choisies, dans leur ordre, sans celles d’un module absent', () => {
    expect(shownTiles(all, null).map((each) => each.id)).toEqual(['a', 'c'])
    expect(shownTiles(all, ['d', 'gone', 'a']).map((each) => each.id)).toEqual(['d', 'a'])
    expect(shownTiles(all, []).map((each) => each.id)).toEqual([])
  })

  it('celles à ajouter, rangées par module ; déplacer', () => {
    expect(addableTiles(all, shownTiles(all, null))).toEqual([
      { group: 'AO', tiles: [all[1]] },
      { group: 'IA', tiles: [all[3]] }
    ])
    expect(moveTile(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveTile(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveTile(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })
})

