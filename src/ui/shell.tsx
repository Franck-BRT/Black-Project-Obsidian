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
import { AfterAction } from './components'
import { HomePage } from './home'
import { ModulePage } from './page'
import { ModuleFunctionsPage, moduleFunctionsTitle } from './dialogs/moduleWindow'
import { MODULE_PAGE } from '../core/settingsPage'
import type { AppHost } from './host'
import { Icon } from './icons'
import { greetingKey } from './logic'
import { SideMenu } from './sidemenu'
import { Springboard } from './springboard'
import { back as backFrom, leave, type Visit } from './history'
import type { TileSpec } from '../core/views'

/** L'accueil, le tableau de bord, ou la page d'un module (son identifiant : « ao.analyses »). */
export type Page = string

export function App({ host, generation, page: wanted = 'home', request = 0, onPage }: { host: AppHost; generation: number; page?: Page; request?: number; onPage?: (page: Page) => void }) {
  const { t } = host
  const [appearance, setAppearance] = useState<Appearance>(host.appearance())
  const [dark, setDark] = useState(host.hostIsDark())
  const [panel, setPanel] = useState(false)
  const [local, setLocal] = useState(0)
  const [menuEditing, setMenuEditing] = useState(false)
  // Le titre d'une page qui dépend de ce qu'elle montre (le nom d'un workflow).
  const [pageTitle, setPageTitle] = useState<string | undefined>(undefined)
  const [page, setPageState] = useState<Page>(wanted)
  useEffect(() => setPageState(wanted), [wanted, request])
  // L'historique : chaque page quittée, avec son titre ; « Retour » ramène à la dernière.
  const [trail, setTrail] = useState<Visit[]>([])
  const shownVisit = useRef<Visit | null>(null)
  const goingBack = useRef(false)
  useEffect(() => {
    if (goingBack.current) goingBack.current = false
    else setTrail((previous) => leave(previous, shownVisit.current, page))
  }, [page])
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
      { id: 'ui.tableau', label: t('ui.nav.dashboard'), icon: 'chart', color: 'indigo', group: t('home.tile.group'), order: 0, byDefault: true, description: t('ui.tile.dashboard.desc'), page: 'dashboard', run: () => setPage('dashboard') },
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
  // La page d'un module, si c'en est une (« id?paramètre ») ; une page inconnue (module désactivé) : l'accueil.
  const cut = page.indexOf('?')
  const pageId = cut < 0 ? page : page.slice(0, cut)
  const param = cut < 0 ? undefined : page.slice(cut + 1)
  // La page « Fonctions » d'un module : le contenu de sa fenêtre, dessiné ici.
  const functions = pageId === MODULE_PAGE && host.moduleWindow ? host.moduleWindow(decodeURIComponent(param ?? '')) : null
  const modulePage = functions || pageId === 'home' || pageId === 'dashboard' ? undefined : host.pages().find((each) => each.id === pageId)
  const shown = functions ? MODULE_PAGE : modulePage ? pageId : page === 'dashboard' ? 'dashboard' : 'home'
  // L'entrée du menu marquée : celle de la page, ou de celle dont elle dépend (la liste d'une fiche) ;
  // pour les fonctions d'un module, les paramètres.
  const current = functions ? (host.settingsPage ?? 'home') : (modulePage?.parent ?? shown)
  // Le titre de la page montrée : ce que « Retour » dira pour y revenir.
  const title = functions ? moduleFunctionsTitle(functions) : modulePage ? (pageTitle ?? modulePage.title) : shown === 'dashboard' ? t('ui.dashboard.title') : t('ui.nav.home')
  useEffect(() => {
    shownVisit.current = { page, title }
  })
  const previous = trail.at(-1)
  const goBack = () => {
    const step = backFrom(trail)
    if (!step) return
    goingBack.current = true
    setTrail(step.trail)
    setPage(step.to.page)
  }
  const now = host.now()
  const today = now.toLocaleDateString(host.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <AfterAction.Provider value={() => setLocal((n) => n + 1)}>
      <div
        class="bp-ui"
        data-mode={resolvedMode(appearance, dark)}
        data-vision={appearance.vision}
        data-reading={appearance.reading}
        data-size={appearance.size}
        data-motion={appearance.motion}
        lang={host.locale.slice(0, 2)}
        // Alt + ← et le bouton « précédent » de la souris, comme dans un navigateur.
        onKeyDown={(event) => {
          if (event.altKey && event.key === 'ArrowLeft' && !event.defaultPrevented && previous) {
            event.preventDefault()
            goBack()
          }
        }}
        onMouseUp={(event) => {
          if (event.button === 3 && previous) {
            event.preventDefault()
            goBack()
          }
        }}
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
              page={current}
              goHome={() => setPage('home')}
              goDashboard={() => setPage('dashboard')}
              editing={menuEditing}
              setEditing={setMenuEditing}
            />
            <div class="bp-side-foot">
              {t('ui.version', { version: host.version })}
            </div>
          </aside>
          <main class="bp-main" ref={main} tabIndex={-1}>
            <header class="bp-header">
              <div>
                <h1 class="bp-hello">
                  {functions ? (
                    <>
                      <Icon name="settings" />
                      {title}
                    </>
                  ) : modulePage ? (
                    <>
                      <Icon name={modulePage.icon} />
                      {pageTitle ?? modulePage.title}
                    </>
                  ) : shown === 'home' ? (
                    t(greetingKey(now))
                  ) : (
                    t('ui.dashboard.title')
                  )}
                </h1>
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
            {previous && (
              <button type="button" class="bp-back" aria-label={t('ui.back.label', { title: previous.title })} title={t('ui.back.label', { title: previous.title })} onClick={goBack}>
                <Icon name="back" />
                {t('ui.back', { title: previous.title })}
              </button>
            )}
            {functions ? (
              <ModuleFunctionsPage key={page} host={functions} />
            ) : modulePage ? (
              <ModulePage spec={modulePage} param={param} host={host} generation={generation + local} onTitle={setPageTitle} hasHistory={!!previous} />
            ) : shown === 'home' ? (
              <Springboard host={host} generation={generation + local} tiles={tiles} />
            ) : (
              <HomePage host={host} generation={generation + local} />
            )}
          </main>
        </div>
      </div>
    </AfterAction.Provider>
  )
}
