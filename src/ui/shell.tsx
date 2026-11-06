// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La coquille : la marque et la navigation à gauche, l'en-tête (bonjour, date,
 * rafraîchir, apparence), et la page. Les attributs du thème sont posés sur la racine
 * `.bp-ui` ; le mode « auto » suit l'hôte, et le suit encore quand il change.
 */

import { useEffect, useState } from 'preact/hooks'
import { resolvedMode, type Appearance } from '../core/appearance'
import { AppearancePanel } from './appearance'
import { HomePage } from './home'
import type { AppHost } from './host'
import { Icon } from './icons'
import { greetingKey } from './logic'

export function App({ host, generation }: { host: AppHost; generation: number }) {
  const { t } = host
  const [appearance, setAppearance] = useState<Appearance>(host.appearance())
  const [dark, setDark] = useState(host.hostIsDark())
  const [panel, setPanel] = useState(false)
  const [local, setLocal] = useState(0)
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
      <div class="bp-shell">
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
          <nav class="bp-nav" aria-label={t('ui.nav')}>
            <button type="button" class="bp-nav-item" aria-current="page">
              <Icon name="home" />
              {t('ui.nav.home')}
            </button>
            {host.nav().map((entry) => (
              <button type="button" class="bp-nav-item" key={entry.id} onClick={() => void entry.run()}>
                <Icon name={entry.icon} />
                {entry.label}
              </button>
            ))}
          </nav>
          <div class="bp-side-foot">
            {t('ui.version', { version: host.version })}
          </div>
        </aside>
        <main class="bp-main">
          <header class="bp-header">
            <div>
              <h1 class="bp-hello">{t(greetingKey(now))}</h1>
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
          <HomePage host={host} generation={generation + local} />
        </main>
      </div>
    </div>
  )
}
