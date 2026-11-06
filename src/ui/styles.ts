// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les styles des composants, sur les variables des thèmes (`theme.ts`). Tout est sous
 * `.bp-ui` : rien ne déborde sur l'hôte. Pas de majuscules forcées (difficiles à lire
 * pour les lecteurs dys), des cibles d'au moins 36 px, un contour de focus bien visible.
 */

import { THEME_CSS } from './theme'

const COMPONENTS_CSS = String.raw`
.bp-ui, .bp-ui * { box-sizing: border-box; }
.bp-ui { height: 100%; overflow: auto; }
.bp-ui button { font: inherit; letter-spacing: inherit; word-spacing: inherit; }
.bp-ui :focus-visible { outline: 3px solid var(--bp-focus); outline-offset: 2px; border-radius: 6px; }
.bp-ui .bp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.bp-ui svg.bp-icon { width: 1.15em; height: 1.15em; flex: none; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* La coquille */
.bp-shell { display: grid; grid-template-columns: 232px 1fr; min-height: 100%; }
.bp-side { background: var(--bp-surface); border-right: 1px solid var(--bp-border); padding: 20px 12px; display: flex; flex-direction: column; gap: 4px; }
.bp-brand { display: flex; align-items: center; gap: 10px; padding: 4px 10px 18px; }
.bp-brand-mark { width: 34px; height: 34px; border-radius: 10px; background: var(--bp-accent); color: var(--bp-accent-text); display: grid; place-items: center; font-weight: 800; }
.bp-brand-name { font-weight: 700; line-height: 1.2; }
.bp-brand-by { font-size: 0.78em; color: var(--bp-text-muted); }
.bp-nav { display: flex; flex-direction: column; gap: 2px; }
.bp-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 8px 12px; border: 0; border-radius: var(--bp-radius-small); background: transparent; color: var(--bp-text); cursor: pointer; text-align: left; transition: background var(--bp-speed); }
.bp-nav-item:hover { background: var(--bp-surface-2); }
.bp-nav-item[aria-current="page"] { background: var(--bp-accent-soft); color: var(--bp-accent); font-weight: 650; }
.bp-side-foot { margin-top: auto; padding: 12px 10px 0; font-size: 0.8em; color: var(--bp-text-muted); }
.bp-main { padding: 28px 32px 48px; min-width: 0; }

/* L'en-tête */
.bp-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.bp-hello { margin: 0; font-size: 1.6em; line-height: 1.25; font-weight: 750; }
.bp-today { margin: 4px 0 0; color: var(--bp-text-muted); }
.bp-header-tools { display: flex; gap: 8px; align-items: center; position: relative; }

/* Les boutons */
.bp-button { display: inline-flex; align-items: center; gap: 8px; min-height: 38px; padding: 8px 14px; border-radius: var(--bp-radius-small); border: 1px solid var(--bp-border); background: var(--bp-surface); color: var(--bp-text); cursor: pointer; transition: background var(--bp-speed), border-color var(--bp-speed), transform var(--bp-speed); }
.bp-button:hover { background: var(--bp-surface-2); }
.bp-button:active { transform: translateY(1px); }
.bp-button-primary { background: var(--bp-accent); border-color: var(--bp-accent); color: var(--bp-accent-text); font-weight: 650; }
.bp-button-primary:hover { background: var(--bp-accent); filter: brightness(1.08); }
.bp-button-icon { padding: 8px; min-width: 38px; justify-content: center; }
.bp-button[disabled] { opacity: 0.6; cursor: progress; }

/* La grille de l'accueil */
.bp-home { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 24px; align-items: start; }
.bp-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }

/* Une section */
.bp-section { background: var(--bp-surface); border: 1px solid var(--bp-border); border-radius: var(--bp-radius); box-shadow: var(--bp-shadow); padding: 20px; }
.bp-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.bp-section-title { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.12em; font-weight: 700; }
.bp-section-title .bp-icon { color: var(--bp-accent); }
.bp-section-sub { margin: 2px 0 0; color: var(--bp-text-muted); font-size: 0.9em; }
.bp-section-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.bp-section > * + * { margin-top: 14px; }
.bp-section-head + * { margin-top: 0; }

/* Les actions rapides */
.bp-actions { display: flex; flex-wrap: wrap; gap: 10px; }

/* Les cartes */
.bp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.bp-card { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius); background: var(--bp-surface); transition: border-color var(--bp-speed), box-shadow var(--bp-speed), transform var(--bp-speed); }
.bp-card:hover { border-color: var(--bp-accent); box-shadow: var(--bp-shadow); }
.bp-card-head { display: flex; align-items: flex-start; gap: 10px; }
.bp-card-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--bp-accent-soft); color: var(--bp-accent); display: grid; place-items: center; flex: none; }
.bp-card-title { margin: 0; font-size: 1.02em; font-weight: 700; line-height: 1.3; }
.bp-card-open { all: unset; cursor: pointer; }
.bp-card-open::after { content: ""; position: absolute; inset: 0; border-radius: var(--bp-radius); }
.bp-card-open:focus-visible::after { outline: 3px solid var(--bp-focus); outline-offset: 2px; }
.bp-card-sub { margin: 2px 0 0; color: var(--bp-text-muted); font-size: 0.88em; }
.bp-card-actions { display: flex; gap: 8px; flex-wrap: wrap; position: relative; z-index: 1; margin-top: auto; }
.bp-card-actions .bp-button { min-height: 34px; padding: 6px 10px; font-size: 0.9em; }
.bp-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; margin: 0; }
.bp-fact { background: var(--bp-surface-2); border-radius: var(--bp-radius-small); padding: 8px 10px; }
.bp-fact dt { font-size: 0.78em; color: var(--bp-text-muted); }
.bp-fact dd { margin: 0; font-weight: 700; }

/* Les badges : une couleur, une icône et un mot — jamais la couleur seule */
.bp-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.bp-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; border: 1px solid currentColor; font-size: 0.82em; font-weight: 650; line-height: 1.4; }
.bp-tone-success { color: var(--bp-success); background: var(--bp-success-soft); }
.bp-tone-warning { color: var(--bp-warning); background: var(--bp-warning-soft); }
.bp-tone-danger { color: var(--bp-danger); background: var(--bp-danger-soft); }
.bp-tone-info { color: var(--bp-info); background: var(--bp-info-soft); }
.bp-tone-neutral { color: var(--bp-neutral); background: var(--bp-neutral-soft); }

/* L'échéance */
.bp-deadline { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--bp-radius-small); border: 1px solid currentColor; }
.bp-deadline-days { font-size: 1.35em; font-weight: 800; white-space: nowrap; text-align: center; }
.bp-deadline-text { display: flex; flex-direction: column; line-height: 1.3; }
.bp-deadline-text small { opacity: 0.9; }

/* Les étoiles */
.bp-stars { display: inline-flex; align-items: center; gap: 6px; color: var(--bp-text-muted); font-size: 0.9em; }
.bp-stars-glyphs { color: var(--bp-accent); letter-spacing: 1px; }

/* Les indicateurs */
.bp-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.bp-stat { padding: 12px 14px; border-radius: var(--bp-radius-small); background: var(--bp-surface-2); border-left: 4px solid var(--bp-border); }
.bp-stat.bp-tone-success, .bp-stat.bp-tone-warning, .bp-stat.bp-tone-danger, .bp-stat.bp-tone-info { background: var(--bp-surface-2); border-left-color: currentColor; }
.bp-stat-value { display: block; font-size: 1.5em; font-weight: 800; color: var(--bp-text); line-height: 1.2; }
.bp-stat-label { display: flex; align-items: center; gap: 6px; font-size: 0.85em; color: var(--bp-text-muted); }
.bp-stat-hint { display: block; font-size: 0.78em; margin-top: 2px; }

/* Les listes */
.bp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.bp-list-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 4px; border-top: 1px solid var(--bp-border); }
.bp-list-item:first-child { border-top: 0; }
.bp-list-mark { margin-top: 2px; border-radius: 999px; padding: 3px; border: 1px solid currentColor; display: grid; }
.bp-list-body { min-width: 0; flex: 1; }
.bp-list-title { font-weight: 650; overflow-wrap: anywhere; }
.bp-list-title button { all: unset; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.bp-list-detail { color: var(--bp-text-muted); font-size: 0.88em; overflow-wrap: anywhere; }
.bp-list-when { color: var(--bp-text-muted); font-size: 0.8em; white-space: nowrap; }

/* Les messages */
.bp-message { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--bp-radius-small); border: 1px solid currentColor; }
.bp-message-body { color: var(--bp-text); flex: 1; }
.bp-message-body .bp-actions { margin-top: 10px; }
.bp-empty { color: var(--bp-text-muted); padding: 8px 0; margin: 0; }

/* Le chargement */
.bp-skeleton { height: 72px; border-radius: var(--bp-radius-small); background: linear-gradient(90deg, var(--bp-surface-2), var(--bp-border), var(--bp-surface-2)); background-size: 200% 100%; animation: bp-wave 1.4s linear infinite; }
.bp-ui[data-motion="reduced"] .bp-skeleton { animation: none; }
@media (prefers-reduced-motion: reduce) { .bp-skeleton { animation: none; } }
@keyframes bp-wave { from { background-position: 200% 0; } to { background-position: 0 0; } }

/* Le panneau d'apparence */
.bp-panel { position: absolute; right: 0; top: calc(100% + 8px); z-index: 20; width: min(420px, 92vw); max-height: 75vh; overflow: auto; padding: 18px; background: var(--bp-surface); border: 1px solid var(--bp-border); border-radius: var(--bp-radius); box-shadow: var(--bp-shadow); }
.bp-panel h2 { margin: 0 0 4px; font-size: 1.1em; }
.bp-panel > p { margin: 0 0 12px; color: var(--bp-text-muted); font-size: 0.9em; }
.bp-fieldset { border: 0; margin: 0 0 14px; padding: 0; }
.bp-fieldset legend { font-weight: 700; margin-bottom: 6px; padding: 0; }
.bp-choices { display: grid; gap: 6px; }
.bp-choice { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius-small); cursor: pointer; }
.bp-choice:has(input:checked) { border-color: var(--bp-accent); background: var(--bp-accent-soft); }
.bp-choice input { margin-top: 4px; accent-color: var(--bp-accent); }
.bp-choice small { display: block; color: var(--bp-text-muted); }
.bp-swatches { display: inline-flex; gap: 3px; margin-left: 6px; vertical-align: middle; }
.bp-swatches i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; border: 1px solid rgba(0,0,0,0.2); }

/* Petits écrans */
@media (max-width: 900px) {
  .bp-home { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .bp-shell { grid-template-columns: 1fr; }
  .bp-side { flex-direction: row; flex-wrap: wrap; border-right: 0; border-bottom: 1px solid var(--bp-border); padding: 10px; }
  .bp-brand { padding: 4px 8px; }
  .bp-nav { flex-direction: row; flex-wrap: wrap; }
  .bp-side-foot { display: none; }
  .bp-main { padding: 18px 14px 32px; }
}
`

export const UI_CSS = `${THEME_CSS}\n${COMPONENTS_CSS}`

const STYLE_ID = 'bp-ui-styles'

/** Pose les styles de l'interface une fois dans le document de l'élément. */
export function installStyles(element: HTMLElement): void {
  const doc = element.ownerDocument
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = UI_CSS
  doc.head.appendChild(style)
}
