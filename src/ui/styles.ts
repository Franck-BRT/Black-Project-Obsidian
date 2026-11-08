// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les styles des composants, sur les variables des thèmes (`theme.ts`). Tout est sous
 * `.bp-ui` : rien ne déborde sur l'hôte. Pas de majuscules forcées (difficiles à lire
 * pour les lecteurs dys), des cibles d'au moins 36 px, un contour de focus bien visible.
 *
 * L'inverse compte autant : les styles de l'hôte ne doivent pas déborder sur l'interface.
 * Obsidian habille tous les `<button>` (`button:not(.clickable-icon)` : hauteur fixe,
 * fond, ombre, pas de retour à la ligne) avec une priorité plus forte qu'une simple
 * classe. Chaque règle des composants est donc préfixée par `.bp-ui` (`scopeCss`) — deux
 * classes l'emportent toujours sur les sélecteurs d'éléments de l'hôte — et la règle
 * `.bp-ui button` remet à zéro ce qu'Obsidian pose et que les composants ne fixent pas.
 */

import { THEME_CSS } from './theme'

const COMPONENTS_CSS = String.raw`
.bp-ui, .bp-ui * { box-sizing: border-box; }
.bp-ui { height: 100%; overflow: auto; }
.bp-ui button { font: inherit; letter-spacing: inherit; word-spacing: inherit; height: auto; justify-content: normal; box-shadow: none; white-space: normal; user-select: auto; -webkit-user-select: auto; }
.bp-ui button:hover, .bp-ui button:active, .bp-ui button:focus { box-shadow: none; }
.bp-ui :focus-visible { outline: 3px solid var(--bp-focus); outline-offset: 2px; border-radius: 6px; }
.bp-ui .bp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.bp-ui svg.bp-icon { width: 1.15em; height: 1.15em; flex: none; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* La coquille */
/* La barre de gauche reste en place : seule la page (à droite) défile. */
.bp-shell { display: grid; grid-template-columns: 232px 1fr; height: 100%; }
.bp-side { background: var(--bp-surface); border-right: 1px solid var(--bp-border); padding: 20px 12px; display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow-y: auto; }
.bp-brand { display: flex; align-items: center; gap: 10px; padding: 4px 10px 18px; }
.bp-brand-mark { width: 34px; height: 34px; border-radius: 10px; background: var(--bp-accent); color: var(--bp-accent-text); display: grid; place-items: center; font-weight: 800; }
.bp-brand-name { font-weight: 700; line-height: 1.2; }
.bp-brand-by { font-size: 0.78em; color: var(--bp-text-muted); }
.bp-nav { display: flex; flex-direction: column; gap: 2px; }
.bp-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 8px 12px; border: 0; border-radius: var(--bp-radius-small); background: transparent; color: var(--bp-text); cursor: pointer; text-align: left; transition: background var(--bp-speed); }
.bp-nav-item:hover { background: var(--bp-surface-2); }
.bp-nav-item[aria-current="page"] { background: var(--bp-accent-soft); color: var(--bp-accent); font-weight: 650; }
.bp-side-foot { padding: 8px 10px 0; font-size: 0.8em; color: var(--bp-text-muted); }

/* Le menu de gauche : Accueil en haut, Paramètres en bas, le reste rangé par l'utilisateur */
.bp-side .bp-nav { flex: 1 1 auto; }
.bp-nav-top, .bp-nav-middle { display: flex; flex-direction: column; gap: 2px; }
.bp-nav-bottom { margin-top: auto; padding-top: 8px; border-top: 1px solid var(--bp-border); display: flex; flex-direction: column; gap: 2px; }
.bp-nav-bottom .bp-menu-link { margin-top: 0; }
.bp-nav.is-editing .bp-nav-bottom { position: sticky; bottom: -20px; padding-bottom: 20px; background: var(--bp-surface); z-index: 1; }
.bp-shell.is-menu-editing { grid-template-columns: 300px 1fr; }
.bp-menu-pinned { color: var(--bp-text-muted); cursor: default; }
.bp-menu-pinned:hover { background: transparent; }
.bp-menu-help { margin: 6px 4px; font-size: 0.82em; color: var(--bp-text-muted); }
.bp-menu-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.bp-menu-row { display: flex; align-items: center; gap: 6px; padding: 4px 4px 4px 6px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius-small); background: var(--bp-bg); }
.bp-menu-row[draggable="true"] { cursor: grab; }
.bp-menu-row.is-dragged { opacity: 0.4; }
.bp-menu-row.is-addable { border-style: dashed; background: transparent; }
.bp-menu-label { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; line-height: 1.25; }
.bp-menu-tool { flex: none; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 1px solid var(--bp-border); border-radius: var(--bp-radius-small); background: var(--bp-surface); color: var(--bp-text); cursor: pointer; }
.bp-menu-tool:hover { background: var(--bp-surface-2); }
.bp-menu-tool[disabled] { opacity: 0.4; cursor: not-allowed; }
.bp-menu-add { margin-top: 12px; }
.bp-menu-add-title { display: flex; align-items: center; gap: 8px; margin: 0 4px 4px; font-size: 0.9em; font-weight: 700; }
.bp-menu-add h3 { margin: 10px 4px 6px; font-size: 0.8em; color: var(--bp-text-muted); font-weight: 650; }
.bp-menu-link { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 36px; margin-top: 6px; padding: 6px 12px; border: 0; border-radius: var(--bp-radius-small); background: transparent; color: var(--bp-text-muted); cursor: pointer; text-align: left; font-size: 0.88em; }
.bp-menu-link:hover { background: var(--bp-surface-2); color: var(--bp-text); }
.bp-menu-link.is-done { background: var(--bp-accent); color: var(--bp-accent-text); font-weight: 650; justify-content: center; }
.bp-menu-link.is-done:hover { background: var(--bp-accent); filter: brightness(1.08); }
.bp-main { padding: 28px 32px 48px; min-width: 0; min-height: 0; overflow-y: auto; }
/* Focalisable (un clic sur la page y garde le clavier : Alt + ← pour revenir), sans contour. */
.bp-main:focus { outline: none; }

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
.bp-button-danger { background: var(--bp-danger); border-color: var(--bp-danger); color: var(--bp-surface); font-weight: 650; }
.bp-button-danger:hover { background: var(--bp-danger); filter: brightness(1.08); }
.bp-button-icon { padding: 8px; min-width: 38px; justify-content: center; }
.bp-button[disabled] { opacity: 0.6; cursor: progress; }

/* La grille de l'accueil */
.bp-home { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 24px; align-items: start; }
.bp-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.bp-home.is-single { grid-template-columns: minmax(0, 1fr); }

/* La page d'un module (les analyses…) */
.bp-hello .bp-icon { color: var(--bp-accent); margin-right: 10px; vertical-align: -0.12em; }
.bp-page { display: flex; flex-direction: column; gap: 18px; }
.bp-page-sub { margin: -12px 0 0; color: var(--bp-text-muted); }
.bp-page-tools { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.bp-page-search { position: relative; flex: 1 1 260px; max-width: 420px; }
.bp-page-search .bp-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--bp-text-muted); pointer-events: none; }
.bp-page-search .bp-input { padding-left: 38px; }
.bp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.bp-page-views { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 24px; }
.bp-segmented { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 3px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius); background: var(--bp-surface); }
.bp-segmented-label { padding: 0 8px; color: var(--bp-text-muted); font-size: 0.88em; }
.bp-segment { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 4px 12px; border: 0; border-radius: var(--bp-radius-small); background: transparent; color: var(--bp-text); font: inherit; font-size: 0.9em; cursor: pointer; }
.bp-segment:hover { background: var(--bp-surface-2); }
.bp-segment[aria-pressed="true"] { background: var(--bp-accent-soft, var(--bp-surface-2)); color: var(--bp-accent, var(--bp-text)); font-weight: 600; }
.bp-cardrows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border: 1px solid var(--bp-border); border-radius: var(--bp-radius); background: var(--bp-surface); }
.bp-cardrow { position: relative; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-top: 1px solid var(--bp-border); }
.bp-cardrow:hover { background: var(--bp-surface-2); }
.bp-cardrow .bp-card-open::after { border-radius: 0; }
.bp-cardrow-actions { position: relative; z-index: 1; }
.bp-cardrow:first-child { border-top: 0; }
.bp-cardrow-icon { flex: none; }
.bp-cardrow-main { flex: 1 1 220px; min-width: 0; }
.bp-cardrow-title { font-weight: 600; }
.bp-cardrow-sub { color: var(--bp-text-muted); font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bp-cardrow-badges { flex: 0 1 auto; }
.bp-cardrow-facts { display: flex; gap: 14px; margin: 0; color: var(--bp-text-muted); font-size: 0.88em; }
.bp-cardrow-facts div { display: flex; flex-direction: column; }
.bp-cardrow-facts dt { font-size: 0.85em; }
.bp-cardrow-facts dd { margin: 0; color: var(--bp-text); font-weight: 600; }
.bp-cardrow-actions, .bp-cardtable-actions { display: flex; gap: 4px; flex: none; }
.bp-cardtable-wrap { overflow-x: auto; border: 1px solid var(--bp-border); border-radius: var(--bp-radius); background: var(--bp-surface); }
.bp-cardtable { width: 100%; border-collapse: collapse; font-size: 0.92em; }
.bp-cardtable th, .bp-cardtable td { padding: 8px 12px; border-top: 1px solid var(--bp-border); text-align: left; vertical-align: middle; background: transparent; }
.bp-cardtable thead th { border-top: 0; color: var(--bp-text-muted); font-weight: 600; font-size: 0.9em; white-space: nowrap; }
.bp-cardtable tbody th { font-weight: 600; }
.bp-cardtable tbody tr:hover { background: var(--bp-surface-2); }
/* Dans un tableau, le titre seul est le lien (pas toute la ligne). */
.bp-cardtable .bp-card-open { text-decoration: underline; text-underline-offset: 3px; }
.bp-cardtable .bp-card-open::after { content: none; }
@media (max-width: 640px) { .bp-cardrow { flex-wrap: wrap; } .bp-cardrow-sub { white-space: normal; } }
.bp-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 14px; border: 1px solid var(--bp-border); border-radius: 999px; background: var(--bp-surface); color: var(--bp-text); cursor: pointer; font-size: 0.9em; }
.bp-chip:hover { background: var(--bp-surface-2); }
.bp-chip[aria-pressed="true"] { background: var(--bp-accent-soft); border-color: var(--bp-accent); color: var(--bp-accent); font-weight: 650; }
.bp-page-count { margin: -6px 0 0; color: var(--bp-text-muted); font-size: 0.9em; }
.bp-page-body { display: flex; flex-direction: column; gap: 18px; }
.bp-page-body > * { margin: 0; }
.bp-page-body .bp-cards { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.bp-back { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; margin: -14px 0 -6px -8px; padding: 6px 8px; border: 0; border-radius: var(--bp-radius-small); background: transparent; color: var(--bp-accent); cursor: pointer; font-weight: 600; }
.bp-back:hover { background: var(--bp-accent-soft); }
/* Le « Retour » de l'interface, sous l'en-tête : un peu d'air avant le sous-titre de la page. */
.bp-main > .bp-back { margin: -14px 0 12px -8px; }
.bp-main > .bp-back + .bp-page > .bp-page-sub { margin-top: 0; }
.bp-group { display: flex; flex-direction: column; gap: 12px; }
.bp-flow { margin: 0; padding: 18px 12px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius); background: var(--bp-surface); overflow-x: auto; }
.bp-flow-list { list-style: none; margin: 0 auto; padding: 0; display: flex; flex-direction: column; align-items: center; max-width: 760px; }
.bp-flow-node { position: relative; display: flex; flex-direction: column; align-items: center; width: 100%; }
.bp-flow-shape { all: unset; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 2px; width: min(380px, 100%); padding: 10px 18px; border: 2px solid var(--bp-border); border-radius: var(--bp-radius-small); background: var(--bp-bg); color: var(--bp-text); text-align: center; }
button.bp-flow-shape { cursor: pointer; }
button.bp-flow-shape:hover { border-color: var(--bp-accent); }
button.bp-flow-shape:focus-visible { outline: 3px solid var(--bp-focus); outline-offset: 2px; }
.bp-flow-node.is-start .bp-flow-shape, .bp-flow-node.is-end .bp-flow-shape { border-radius: 999px; border-color: var(--bp-accent); background: var(--bp-accent-soft); }
.bp-flow-node.is-end .bp-flow-shape { width: min(300px, 100%); border-style: dashed; }
.bp-flow-node.is-decision .bp-flow-shape { padding: 14px 40px; border: 0; background: var(--bp-border); clip-path: polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%); position: relative; }
.bp-flow-node.is-decision .bp-flow-shape::before { content: ""; position: absolute; inset: 2px; background: var(--bp-surface-2); clip-path: polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%); z-index: 0; }
.bp-flow-node.is-decision .bp-flow-shape > * { position: relative; z-index: 1; }
.bp-flow-node[data-tone="warning"] .bp-flow-shape { border-color: var(--bp-warning, var(--bp-border)); }
.bp-flow-node[data-tone="danger"] .bp-flow-shape { border-color: var(--bp-danger, var(--bp-border)); }
.bp-flow-node[data-tone="neutral"] .bp-flow-shape { opacity: 0.75; }
.bp-flow-caption { font-size: 0.8em; font-weight: 700; color: var(--bp-text-muted); }
.bp-flow-label { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; }
.bp-flow-detail { font-size: 0.85em; color: var(--bp-text-muted); }
.bp-flow-link { position: relative; display: block; width: 2px; height: 34px; background: var(--bp-text-muted); }
.bp-flow-link::after { content: ""; position: absolute; left: 50%; bottom: -1px; transform: translateX(-50%); border: 6px solid transparent; border-top: 8px solid var(--bp-text-muted); border-bottom: 0; }
.bp-flow-yes { position: absolute; left: 10px; top: 6px; font-size: 0.78em; font-weight: 700; color: var(--bp-success, var(--bp-text-muted)); white-space: nowrap; }
.bp-flow-no { position: absolute; left: calc(50% + min(190px, 50%)); top: 0; height: calc(100% - 34px); display: flex; align-items: center; }
.bp-flow-no-line { width: 26px; border-top: 2px dashed var(--bp-text-muted); }
.bp-flow-no-end { padding: 4px 10px; border: 1px dashed var(--bp-text-muted); border-radius: 999px; font-size: 0.82em; color: var(--bp-text-muted); white-space: nowrap; background: var(--bp-bg); }
@media (max-width: 760px) { .bp-flow-no { position: static; height: auto; margin-top: 6px; } .bp-flow-no-line { display: none; } }
.bp-fold { display: flex; flex-direction: column; gap: 12px; }
.bp-fold-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius); background: var(--bp-surface); color: var(--bp-text); font: inherit; text-align: left; cursor: pointer; }
.bp-fold-head:hover:not(:disabled) { background: var(--bp-surface-2); }
.bp-fold-head:disabled { cursor: default; }
.bp-fold-chevron { display: grid; place-items: center; color: var(--bp-text-muted); }
.bp-fold-chevron svg.bp-icon { transform: rotate(90deg); transition: transform var(--bp-speed); }
.bp-fold.is-collapsed .bp-fold-chevron svg.bp-icon { transform: rotate(0deg); }
.bp-fold-title { font-size: 1.08em; font-weight: 700; }
.bp-fold-sub { margin-left: auto; color: var(--bp-text-muted); font-size: 0.92em; }
.bp-fold-body { display: flex; flex-direction: column; gap: 14px; }
.bp-fold .bp-fold { margin-left: 14px; }
.bp-fold .bp-fold .bp-fold-head { padding: 8px 12px; }
.bp-fold .bp-fold .bp-fold-title { font-size: 1em; }
.bp-group-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.bp-group-title { margin: 0; font-size: 1.12em; font-weight: 700; }

/* Le tableau de bord rangé par l'utilisateur */
.bp-dashboard { display: flex; flex-direction: column; gap: 18px; }
.bp-section-heading { display: flex; align-items: flex-start; gap: 6px; min-width: 0; }
.bp-section-toggle { flex: none; display: grid; place-items: center; width: 30px; height: 30px; margin: -2px 0 0 -8px; padding: 0; border: 0; border-radius: var(--bp-radius-small); background: transparent; color: var(--bp-text-muted); cursor: pointer; }
.bp-section-toggle:hover { background: var(--bp-surface-2); color: var(--bp-text); }
.bp-section-toggle svg.bp-icon { transform: rotate(90deg); transition: transform var(--bp-speed); }
.bp-section-toggle[aria-expanded="false"] svg.bp-icon { transform: rotate(0deg); }
.bp-section.is-collapsed { padding-top: 14px; padding-bottom: 14px; }
.bp-section.is-collapsed .bp-section-head { margin-bottom: 0; }
.bp-dash-column { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.bp-dash-column-title { margin: 0; font-size: 0.95em; color: var(--bp-text-muted); font-weight: 650; }
.bp-dash-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.bp-dash-card { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; background: var(--bp-surface); border: 1px solid var(--bp-border); border-radius: var(--bp-radius); box-shadow: var(--bp-shadow); }
.bp-dash-card[draggable="true"] { cursor: grab; }
.bp-dash-card.is-dragged { opacity: 0.4; }
.bp-dash-card.is-hidden { box-shadow: none; border-style: dashed; }
.bp-dash-grip { color: var(--bp-text-muted); display: grid; place-items: center; }
.bp-dash-grip svg.bp-icon { stroke-width: 3.5; }
.bp-dash-name { flex: 1 1 160px; display: flex; align-items: center; gap: 8px; font-weight: 650; min-width: 0; }
.bp-dash-tools { display: flex; gap: 6px; flex-wrap: wrap; }
.bp-dash-tools .bp-button { min-height: 36px; min-width: 36px; padding: 6px; }
.bp-dash-tools .bp-button[disabled] { opacity: 0.4; cursor: not-allowed; }
.bp-dash-drop { padding: 14px; border: 2px dashed var(--bp-border); border-radius: var(--bp-radius); color: var(--bp-text-muted); text-align: center; font-size: 0.9em; }
.bp-dash-hidden .bp-dash-list { margin-top: 12px; }

/* Une section */
.bp-section { background: var(--bp-surface); border: 1px solid var(--bp-border); border-radius: var(--bp-radius); box-shadow: var(--bp-shadow); padding: 20px; }
.bp-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.bp-section-title { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.12em; font-weight: 700; }
.bp-section-title .bp-icon { color: var(--bp-accent); }
.bp-section-sub { margin: 2px 0 0; color: var(--bp-text-muted); font-size: 0.9em; }
.bp-section-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.bp-section > * + * { margin-top: 14px; }
.bp-section-head + * { margin-top: 0; }
/* Le contenu d'une section du tableau de bord : le même écart entre tous ses blocs. */
.bp-section-body { display: flex; flex-direction: column; gap: 14px; }
.bp-section-body > * { margin-top: 0; margin-bottom: 0; }
.bp-section-body[hidden] { display: none; }

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
/* Obsidian pose un fond aux boutons survolés (« button:not(.clickable-icon):hover ») : ces boutons-là n'en ont pas. */
.bp-card-open:hover, .bp-card-open:active, .bp-list-title button:hover, .bp-list-title button:active { background: transparent; box-shadow: none; color: inherit; }
.bp-tile-remove:hover, .bp-tile-remove:active { background: var(--bp-text); color: var(--bp-bg); box-shadow: none; }
.bp-card-open::after { content: ""; position: absolute; inset: 0; border-radius: var(--bp-radius); }
.bp-card-open:focus-visible::after { outline: 3px solid var(--bp-focus); outline-offset: 2px; }
.bp-card-sub { margin: 2px 0 0; color: var(--bp-text-muted); font-size: 0.88em; }
.bp-card-text { margin: 0; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.bp-ui[data-reading="dys"] .bp-card-text { -webkit-line-clamp: 4; }
.bp-card-text.is-full { display: block; -webkit-line-clamp: unset; overflow: visible; white-space: pre-wrap; }
.bp-card-actions { display: flex; gap: 8px; flex-wrap: wrap; position: relative; z-index: 1; margin-top: auto; }
.bp-card-actions .bp-button { min-height: 34px; padding: 6px 10px; font-size: 0.9em; }
.bp-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; margin: 0; }
.bp-fact { background: var(--bp-surface-2); border-radius: var(--bp-radius-small); padding: 8px 10px; }
.bp-fact dt { font-size: 0.78em; color: var(--bp-text-muted); }
.bp-fact dd { margin: 0; font-weight: 700; }
.bp-fact.is-long { grid-column: 1 / -1; }
.bp-fact.is-long dd { font-weight: 400; line-height: 1.45; }

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
/* Lecture dys : lettres espacées — des cases plus larges et des chiffres un peu plus petits, pour ne pas couper un mot (« Brouillon »). */
.bp-ui[data-reading="dys"] .bp-stats { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.bp-ui[data-reading="dys"] .bp-stat-value { font-size: 1.25em; }
.bp-stat { padding: 12px 14px; border-radius: var(--bp-radius-small); background: var(--bp-surface-2); border-left: 4px solid var(--bp-border); }
.bp-stat.bp-tone-success, .bp-stat.bp-tone-warning, .bp-stat.bp-tone-danger, .bp-stat.bp-tone-info { background: var(--bp-surface-2); border-left-color: currentColor; }
.bp-stat-value { display: block; font-size: 1.5em; font-weight: 800; color: var(--bp-text); line-height: 1.2; overflow-wrap: break-word; hyphens: auto; }
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
.bp-prose { display: flex; flex-direction: column; gap: 8px; max-width: 75ch; }
.bp-prose .bp-text { margin: 0; line-height: 1.55; overflow-wrap: anywhere; }

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

/* L'accueil à tuiles */
.bp-springboard { display: flex; flex-direction: column; gap: 18px; }
.bp-springboard-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.bp-springboard-bar .bp-header-tools { margin-left: auto; }
.bp-tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 22px 14px; }
.bp-tile-cell { position: relative; display: flex; flex-direction: column; align-items: center; }
.bp-tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; padding: 10px 6px; border: 0; border-radius: 18px; background: transparent; color: var(--bp-text); cursor: pointer; transition: background var(--bp-speed), transform var(--bp-speed); }
.bp-tile:hover { background: var(--bp-surface-2); }
.bp-tile:active { transform: scale(0.96); }
.bp-tile-icon { width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center; color: #ffffff; box-shadow: 0 6px 16px rgba(20, 24, 40, 0.18), inset 0 1px 0 rgba(255,255,255,0.25); background-image: linear-gradient(160deg, rgba(255,255,255,0.18), rgba(0,0,0,0.12)); }
.bp-tile-icon svg.bp-icon { width: 30px; height: 30px; stroke-width: 1.8; }
.bp-tile-indigo { background-color: var(--bp-tile-indigo); }
.bp-tile-blue { background-color: var(--bp-tile-blue); }
.bp-tile-teal { background-color: var(--bp-tile-teal); }
.bp-tile-green { background-color: var(--bp-tile-green); }
.bp-tile-orange { background-color: var(--bp-tile-orange); }
.bp-tile-rose { background-color: var(--bp-tile-rose); }
.bp-tile-violet { background-color: var(--bp-tile-violet); }
.bp-tile-slate { background-color: var(--bp-tile-slate); }
.bp-tile-label { font-size: 0.86em; font-weight: 600; text-align: center; line-height: 1.25; max-width: 13ch; overflow-wrap: anywhere; }
.bp-tile-badge { position: absolute; top: 2px; right: calc(50% - 44px); min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; font-size: 0.75em; font-weight: 800; border: 2px solid var(--bp-bg); }
.bp-tile-badge.bp-tone-danger { background: var(--bp-danger); color: var(--bp-surface); }
.bp-tile-badge.bp-tone-warning { background: var(--bp-warning); color: var(--bp-surface); }
.bp-tile-badge.bp-tone-info, .bp-tile-badge.bp-tone-success, .bp-tile-badge.bp-tone-neutral { background: var(--bp-info); color: var(--bp-surface); }
.bp-tile-plus { background: var(--bp-accent); color: var(--bp-accent-text); }
.bp-tile-remove { position: absolute; top: 0; left: calc(50% - 46px); z-index: 2; width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--bp-bg); background: var(--bp-text); color: var(--bp-bg); font-size: 18px; line-height: 1; font-weight: 800; display: grid; place-items: center; cursor: pointer; padding: 0; }
.bp-springboard.is-editing .bp-tiles .bp-tile-cell[draggable="true"] { cursor: grab; }
.bp-springboard.is-editing .bp-tiles .bp-tile-cell[draggable="true"] .bp-tile-icon { animation: bp-jiggle 0.3s ease-in-out infinite alternate; }
.bp-springboard.is-editing .bp-tiles .bp-tile-cell[draggable="true"]:nth-child(2n) .bp-tile-icon { animation-delay: -0.15s; }
.bp-tile-cell.is-dragged { opacity: 0.4; }
@keyframes bp-jiggle { from { transform: rotate(-2deg); } to { transform: rotate(2deg); } }
.bp-ui[data-motion="reduced"] .bp-tile-icon { animation: none !important; }
@media (prefers-reduced-motion: reduce) { .bp-tile-icon { animation: none !important; } }
.bp-tile-gallery h3 { margin: 12px 0 8px; font-size: 0.95em; color: var(--bp-text-muted); }
.bp-tile-desc { margin: 4px 0 0; font-size: 0.75em; color: var(--bp-text-muted); text-align: center; max-width: 18ch; }
.bp-page-title { margin: 0; font-size: 1.6em; line-height: 1.25; font-weight: 750; }

/* Les fenêtres */
.bp-ui.bp-layer { height: auto; overflow: visible; background: transparent; }
.bp-backdrop { position: fixed; inset: 0; z-index: calc(var(--layer-modal, 50) + 5); display: grid; place-items: center; padding: 24px; background: rgba(10, 12, 20, 0.45); }
.bp-ui[data-mode="dark"] .bp-backdrop { background: rgba(0, 0, 0, 0.6); }
.bp-dialog { width: 100%; max-height: calc(100vh - 48px); display: flex; flex-direction: column; background: var(--bp-surface); color: var(--bp-text); border: 1px solid var(--bp-border); border-radius: var(--bp-radius); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); outline: none; }
.bp-dialog-small { max-width: 460px; }
.bp-dialog-medium { max-width: 640px; }
.bp-dialog-large { max-width: 880px; }
.bp-dialog-wide { max-width: 1180px; }
.bp-dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px 12px; border-bottom: 1px solid var(--bp-border); }
.bp-dialog-title { margin: 0; font-size: 1.2em; font-weight: 750; line-height: 1.3; }
.bp-dialog-sub { margin: 4px 0 0; color: var(--bp-text-muted); font-size: 0.9em; }
.bp-dialog-body { padding: 16px 20px; overflow: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }
.bp-dialog-foot { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; padding: 12px 20px 16px; border-top: 1px solid var(--bp-border); }
.bp-intro { margin: 0; color: var(--bp-text-muted); white-space: pre-line; }
.bp-ui[data-reading="dys"] .bp-intro { max-width: var(--bp-measure); }

/* Les champs */
.bp-field { display: flex; flex-direction: column; gap: 6px; }
.bp-field-row { flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; }
.bp-field-label { font-weight: 650; }
.bp-field-desc { color: var(--bp-text-muted); font-size: 0.88em; }
.bp-field-error { color: var(--bp-danger); font-size: 0.88em; display: flex; gap: 6px; align-items: center; }
.bp-input, .bp-select, .bp-textarea { width: 100%; min-height: 38px; padding: 8px 10px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius-small); background: var(--bp-bg); color: var(--bp-text); font: inherit; letter-spacing: inherit; word-spacing: inherit; }
.bp-textarea { min-height: 120px; resize: vertical; line-height: var(--bp-line); }
.bp-input:focus, .bp-select:focus, .bp-textarea:focus { border-color: var(--bp-focus); }
.bp-input[aria-invalid="true"], .bp-textarea[aria-invalid="true"] { border-color: var(--bp-danger); }
.bp-select { appearance: auto; }

/* L'interrupteur : une case à cocher habillée, rôle « switch » */
.bp-switch { position: relative; display: inline-flex; flex: none; width: 44px; height: 24px; }
.bp-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.bp-switch span { position: absolute; inset: 0; border-radius: 999px; background: var(--bp-border); transition: background var(--bp-speed); pointer-events: none; }
.bp-switch span::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--bp-surface); box-shadow: 0 1px 2px rgba(0,0,0,0.3); transition: transform var(--bp-speed); }
.bp-switch input:checked + span { background: var(--bp-accent); }
.bp-switch input:checked + span::after { transform: translateX(20px); }
.bp-switch input:focus-visible + span { outline: 3px solid var(--bp-focus); outline-offset: 2px; }

/* Un choix dans une liste */
.bp-picker-list { list-style: none; margin: 0; padding: 4px; display: flex; flex-direction: column; gap: 2px; max-height: 55vh; overflow: auto; border: 1px solid var(--bp-border); border-radius: var(--bp-radius-small); }
.bp-picker-item { display: flex; flex-direction: column; gap: 2px; padding: 9px 12px; border-radius: var(--bp-radius-small); cursor: pointer; }
.bp-picker-item small { color: var(--bp-text-muted); }
.bp-picker-item[aria-selected="true"] { background: var(--bp-accent-soft); color: var(--bp-accent); }
.bp-picker-item[aria-selected="true"] small { color: var(--bp-text); }
.bp-picker-empty { padding: 12px; color: var(--bp-text-muted); }

/* Cases à cocher */
.bp-checks { display: flex; flex-direction: column; gap: 6px; }
.bp-check { display: flex; gap: 10px; align-items: flex-start; padding: 9px 12px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius-small); cursor: pointer; }
.bp-check:has(input:checked) { border-color: var(--bp-accent); background: var(--bp-accent-soft); }
.bp-check input { margin-top: 4px; accent-color: var(--bp-accent); width: 18px; height: 18px; flex: none; }
.bp-check small { display: block; color: var(--bp-text-muted); }
.bp-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bp-toolbar .bp-input { flex: 1 1 220px; width: auto; }
.bp-toolbar .bp-select { width: auto; }
.bp-count { color: var(--bp-text-muted); font-size: 0.85em; }

/* Les tableaux */
.bp-table-wrap { overflow: auto; border: 1px solid var(--bp-border); border-radius: var(--bp-radius-small); max-height: 60vh; }
.bp-table { width: 100%; border-collapse: collapse; }
.bp-table th { position: sticky; top: 0; background: var(--bp-surface-2); text-align: left; font-size: 0.85em; color: var(--bp-text-muted); padding: 8px 10px; border-bottom: 1px solid var(--bp-border); z-index: 1; }
.bp-table td { padding: 9px 10px; border-top: 1px solid var(--bp-border); vertical-align: top; overflow-wrap: anywhere; }
.bp-table .is-narrow { white-space: nowrap; width: 1%; }
.bp-table .is-wide { min-width: 280px; }
.bp-table tbody tr.bp-row { cursor: pointer; }
.bp-table tbody tr.bp-row:hover, .bp-table tbody tr.bp-row:focus-visible { background: var(--bp-accent-soft); outline: none; }
.bp-table tbody tr.bp-row:focus-visible td:first-child { box-shadow: inset 4px 0 0 var(--bp-focus); }
.bp-flag { display: inline-flex; margin: 2px 0 0 6px; padding: 1px 8px; border-radius: 999px; font-size: 0.78em; border: 1px solid currentColor; color: var(--bp-warning); background: var(--bp-warning-soft); }
.bp-pre { margin: 0; padding: 12px; white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--bp-mono); font-size: 0.9em; background: var(--bp-surface-2); border-radius: var(--bp-radius-small); }

/* La fenêtre d'un module */
.bp-block { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius); background: var(--bp-surface); }
.bp-block-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.bp-block-title { margin: 0; font-weight: 700; font-size: 1.02em; }
.bp-block-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.bp-block-controls .bp-input, .bp-block-controls .bp-select { width: auto; min-width: 180px; }
.bp-pairs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.bp-pair { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 10px; border-radius: var(--bp-radius-small); background: var(--bp-surface-2); }
.bp-pair-actions { display: flex; gap: 4px; }
.bp-pair-actions .bp-button { min-height: 32px; min-width: 32px; padding: 4px; }
.bp-details summary { cursor: pointer; font-weight: 650; padding: 6px 0; }
.bp-toggle-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 6px 10px; border-radius: var(--bp-radius-small); background: var(--bp-surface-2); margin-top: 4px; }
.bp-toggle-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bp-toggle-cols { display: flex; gap: 14px; align-items: center; }
.bp-toggle-col { display: inline-flex; gap: 6px; align-items: center; font-size: 0.88em; color: var(--bp-text-muted); }
.bp-legend { display: flex; flex-wrap: wrap; gap: 8px; }
.bp-feature-section { display: flex; flex-direction: column; gap: 8px; }
.bp-feature-section h3 { margin: 6px 0 0; font-size: 1.02em; }
.bp-feature-grid { display: grid; grid-template-columns: repeat(var(--bp-columns, auto-fill), minmax(220px, 1fr)); gap: 10px; }
.bp-feature-card { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 12px 12px 12px 16px; border: 1px solid var(--bp-border); border-radius: var(--bp-radius-small); background: var(--bp-surface); }
.bp-feature-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; border-radius: var(--bp-radius-small) 0 0 var(--bp-radius-small); background: currentColor; }
.bp-feature-card.is-reference { color: var(--bp-neutral); }
.bp-feature-card.is-disabled { opacity: 0.65; }
.bp-feature-card[class*="bp-tone-"] { background: var(--bp-surface); }
.bp-feature-card > * { color: var(--bp-text); }
.bp-feature-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.bp-feature-label { font-weight: 700; }
.bp-feature-note { color: var(--bp-text-muted); font-size: 0.86em; }
.bp-feature-group { font-size: 0.8em; color: var(--bp-text-muted); }
.bp-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.bp-tag { font-family: var(--bp-mono); font-size: 0.8em; padding: 1px 6px; border-radius: 6px; background: var(--bp-surface-2); }
.bp-fact-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.88em; }
.bp-fact-line > span:first-child { color: var(--bp-text-muted); min-width: 4.5em; }
.bp-feature-card .bp-badge { align-self: flex-start; }

/* Petits écrans */
@media (max-width: 900px) {
  .bp-home { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  /* Petit écran : la navigation passe en haut, et tout défile ensemble. */
  .bp-shell { grid-template-columns: 1fr; height: auto; min-height: 100%; }
  .bp-main { overflow-y: visible; }
  .bp-side { overflow-y: visible; flex-direction: row; flex-wrap: wrap; border-right: 0; border-bottom: 1px solid var(--bp-border); padding: 10px; }
  .bp-brand { padding: 4px 8px; }
  .bp-nav { flex-direction: row; flex-wrap: wrap; }
  .bp-side-foot { display: none; }
  .bp-side .bp-nav { flex: 1 1 100%; }
  .bp-nav-bottom { margin-top: 0; padding-top: 0; border-top: 0; }
  .bp-shell.is-menu-editing { grid-template-columns: 1fr; }
  .bp-nav.is-editing { flex-direction: column; }
  .bp-nav-top, .bp-nav-middle { flex-direction: row; flex-wrap: wrap; }
  .bp-nav-bottom { flex-direction: row; flex-wrap: wrap; }
  .bp-nav-top .bp-nav-item, .bp-nav-middle .bp-nav-item, .bp-nav-bottom .bp-nav-item, .bp-nav-bottom .bp-menu-link { width: auto; }
  .bp-nav.is-editing .bp-nav-bottom { flex-direction: column; position: static; padding-bottom: 0; }
  .bp-nav.is-editing .bp-menu-link { width: 100%; }
  .bp-nav.is-editing .bp-nav-middle { flex-direction: column; }
  .bp-main { padding: 18px 14px 32px; }
  .bp-backdrop { padding: 8px; }
  .bp-dialog-head, .bp-dialog-body, .bp-dialog-foot { padding-left: 14px; padding-right: 14px; }
}
`

/** L'indice de l'accolade qui ferme celle ouverte en `open`. */
function closingBrace(css: string, open: number): number {
  let depth = 0
  for (let index = open; index < css.length; index++) {
    if (css[index] === '{') depth++
    else if (css[index] === '}' && --depth === 0) return index
  }
  return css.length
}

/** Les sélecteurs d'une liste, séparés par les virgules hors parenthèses. */
function splitSelectors(list: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < list.length; index++) {
    if (list[index] === '(') depth++
    else if (list[index] === ')') depth--
    else if (list[index] === ',' && depth === 0) {
      parts.push(list.slice(start, index))
      start = index + 1
    }
  }
  parts.push(list.slice(start))
  return parts
}

/**
 * Préfixe chaque sélecteur par `root` (sauf ceux qui commencent déjà par lui), y compris
 * dans les `@media` ; les `@keyframes` restent tels quels. Les commentaires sont retirés.
 */
export function scopeCss(css: string, root = '.bp-ui'): string {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let out = ''
  let index = 0
  while (index < source.length) {
    const open = source.indexOf('{', index)
    if (open < 0) break
    const head = source.slice(index, open).trim()
    const close = closingBrace(source, open)
    const body = source.slice(open + 1, close)
    if (/^@(media|supports)\b/.test(head)) out += `${head} {\n${scopeCss(body, root)}}\n`
    else if (head.startsWith('@')) out += `${head} {${body}}\n`
    else {
      const selectors = splitSelectors(head).map((each) => each.trim()).filter(Boolean)
      out += `${selectors.map((each) => (each === root || each.startsWith(`${root} `) || each.startsWith(`${root}.`) || each.startsWith(`${root}[`) || each.startsWith(`${root}:`) ? each : `${root} ${each}`)).join(', ')} {${body}}\n`
    }
    index = close + 1
  }
  return out
}

export const UI_CSS = `${THEME_CSS}\n${scopeCss(COMPONENTS_CSS)}`

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
