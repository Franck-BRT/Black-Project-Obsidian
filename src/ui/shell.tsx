// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La coquille : la marque et la navigation à gauche, l'en-tête, et la page — l'**accueil**
 * (le bonjour, la date, les tuiles que l'utilisateur range) ou le **tableau de bord** (les
 * informations des modules). Les attributs du thème sont posés sur la racine `.bp-ui` ; le
 * mode « auto » suit l'hôte, et le suit encore quand il change.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { resolvedMode, type Appearance } from '../core/appearance'
import { AppearancePanel } from './appearance'
import { HomePage } from './home'
import type { AppHost } from './host'
import { Icon } from './icons'
import { greetingKey } from './logic'
import { SideMenu } from './sidemenu'
import { Springboard } from './springboard'
import type { TileSpec } from '../core/views'

export type Page = 'home' | 'dashboard'

export function App({ host, generation, page: wanted = 'home', onPage }: { host: AppHost; generation: number; page?: Page; onPage?: (page: Page) => void }) {
  const { t } = host
  const [appearance, setAppearance] = useState<Appearance>(host.appearance())
  const [dark, setDark] = useState(host.hostIsDark())
  const [panel, setPanel] = useState(false)
  const [local, setLocal] = useState(0)
  const [menuEditing, setMenuEditing] = useState(false)
  const [page, setPageState] = useState<Page>(wanted)
  useEffect(() => setPageState(wanted), [wanted])
  // La page défile seule (la navigation reste en place) : une nouvelle page part du haut.
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    if (main.current) main.current.scrollTop = 0
  }, [page])
  const setPage = (next: Page) => {
    setPageState(next)
    onPage?.(next)
  }
  // La tuile du tableau de bord est celle de l'interface même.
  const tiles = useMemo<TileSpec[]>(
    () => [
      { id: 'ui.tableau', label: t('ui.nav.dashboard'), icon: 'chart', color: 'indigo', group: t('home.tile.group'), order: 0, byDefault: true, description: t('ui.tile.dashboard.desc'), run: () => setPage('dashboard') },
      ...host.tiles()
    ],
    [generation]
  )
  useEffect(() => host.onHostThemeChange?.(() => setDark(host.hostIsDark())), [])
  useEffect(() => setAppearance(host.appearance()), [generation])

  const change = (next: Appearance) => {
    setAppearance(next)
    void host.saveAppearance(next)
  }
  const now = host.now()
  const today = now.toLocaleDateString(host.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div
      class="bp-ui"
      data-mode={resolvedMode(appearance, dark)}
      data-vision={appearance.vision}
      data-reading={appearance.reading}
      data-size={appearance.size}
      data-motion={appearance.motion}
      lang={host.locale.slice(0, 2)}
    >
      <div class={`bp-shell${menuEditing ? ' is-menu-editing' : ''}`}>
        <aside class="bp-side">
          <div class="bp-brand">
            <span class="bp-brand-mark" aria-hidden="true">
              BP
            </span>
            <span>
              <span class="bp-brand-name">Black Projects</span>
              <br />
              <span class="bp-brand-by">by Black Room Technologies</span>
            </span>
          </div>
          <SideMenu
            host={host}
            generation={generation + local}
            tiles={tiles}
            page={page}
            goHome={() => setPage('home')}
            goDashboard={() => setPage('dashboard')}
            editing={menuEditing}
            setEditing={setMenuEditing}
          />
          <div class="bp-side-foot">
            {t('ui.version', { version: host.version })}
          </div>
        </aside>
        <main class="bp-main" ref={main}>
          <header class="bp-header">
            <div>
              <h1 class="bp-hello">{page === 'home' ? t(greetingKey(now)) : t('ui.dashboard.title')}</h1>
              <p class="bp-today">{today}</p>
            </div>
            <div class="bp-header-tools">
              <button type="button" class="bp-button" onClick={() => setLocal(local + 1)}>
                <Icon name="refresh" />
                <span>{t('ui.refresh')}</span>
              </button>
              <button type="button" class="bp-button" aria-expanded={panel} aria-haspopup="dialog" onClick={() => setPanel(!panel)}>
                <Icon name="eye" />
                <span>{t('ui.appearance.button')}</span>
              </button>
              {panel && <AppearancePanel appearance={appearance} change={change} close={() => setPanel(false)} t={t} />}
            </div>
          </header>
          {page === 'home' ? <Springboard host={host} generation={generation + local} tiles={tiles} /> : <HomePage host={host} generation={generation + local} />}
        </main>
      </div>
    </div>
  )
}
