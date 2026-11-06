// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les thèmes : des variables CSS `--bp-*` posées sur la racine de l'interface (`.bp-ui`),
 * selon ses attributs `data-mode`, `data-vision`, `data-reading`, `data-size`,
 * `data-motion`. Les composants n'utilisent que ces variables : un thème de plus est un
 * jeu de valeurs de plus, sans toucher aux composants.
 *
 * Palettes pour les daltonismes : d'après Okabe et Ito (rouge-vert) et Paul Tol
 * (bleu-jaune), et un monochrome où les états se distinguent par le trait (plein, tirets,
 * double) en plus de l'icône et du mot. Toutes visent un contraste d'au moins 4,5:1 pour
 * le texte (WCAG AA).
 *
 * Rien n'est redéfini hors de `.bp-ui` : l'interface ne change pas l'apparence de l'hôte.
 */

export const THEME_CSS = String.raw`
.bp-ui {
  --bp-font: var(--font-interface, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
  --bp-mono: var(--font-monospace, ui-monospace, "Cascadia Code", Menlo, Consolas, monospace);
  --bp-size: 15px;
  --bp-scale: 1;
  --bp-line: 1.5;
  --bp-letter: normal;
  --bp-word: normal;
  --bp-radius: 12px;
  --bp-radius-small: 8px;
  --bp-gap: 16px;
  --bp-speed: 160ms;
  --bp-measure: none;
  font-family: var(--bp-font);
  font-size: calc(var(--bp-size) * var(--bp-scale));
  line-height: var(--bp-line);
  letter-spacing: var(--bp-letter);
  word-spacing: var(--bp-word);
  color: var(--bp-text);
  background: var(--bp-bg);
}

/* ── Clair, standard ─────────────────────────────────────────────── */
.bp-ui, .bp-ui[data-mode="light"] {
  --bp-bg: #f5f6fa;
  --bp-surface: #ffffff;
  --bp-surface-2: #eef0f6;
  --bp-border: #dfe2ec;
  --bp-text: #1b2232;
  --bp-text-muted: #545d70;
  --bp-accent: #4338ca;
  --bp-accent-text: #ffffff;
  --bp-accent-soft: #e8e7fb;
  --bp-success: #17703f;
  --bp-success-soft: #e3f4ea;
  --bp-warning: #9a4a00;
  --bp-warning-soft: #fdf0dd;
  --bp-danger: #b3191d;
  --bp-danger-soft: #fde6e6;
  --bp-info: #1f5bc4;
  --bp-info-soft: #e5edfb;
  --bp-neutral: #4b5468;
  --bp-neutral-soft: #eceef3;
  --bp-focus: #4338ca;
  --bp-shadow: 0 1px 2px rgba(20, 24, 40, 0.06), 0 4px 16px rgba(20, 24, 40, 0.06);
}

/* ── Sombre, standard ────────────────────────────────────────────── */
.bp-ui[data-mode="dark"] {
  --bp-bg: #0f1218;
  --bp-surface: #171b24;
  --bp-surface-2: #1f2430;
  --bp-border: #2d3443;
  --bp-text: #e8ebf2;
  --bp-text-muted: #a2abbd;
  --bp-accent: #9a94ff;
  --bp-accent-text: #11131a;
  --bp-accent-soft: #272646;
  --bp-success: #4fd18b;
  --bp-success-soft: #15301f;
  --bp-warning: #f5a83a;
  --bp-warning-soft: #33250f;
  --bp-danger: #ff7a7a;
  --bp-danger-soft: #3a1719;
  --bp-info: #73a8ff;
  --bp-info-soft: #172640;
  --bp-neutral: #b7bfce;
  --bp-neutral-soft: #252b37;
  --bp-focus: #b3aeff;
  --bp-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 6px 20px rgba(0, 0, 0, 0.35);
}

/* ── Rouge-vert (deutéranopie, protanopie) : bleu pour ce qui va, vermillon pour ce qui ne va pas ── */
.bp-ui[data-vision="red-green"] {
  --bp-accent: #3f3f9e;
  --bp-accent-soft: #e7e7f6;
  --bp-focus: #3f3f9e;
  --bp-success: #005f99;
  --bp-success-soft: #ddeefa;
  --bp-warning: #7a5a00;
  --bp-warning-soft: #fff4c2;
  --bp-danger: #a8430a;
  --bp-danger-soft: #fde8da;
  --bp-info: #4a4a4a;
  --bp-info-soft: #ececec;
}
.bp-ui[data-mode="dark"][data-vision="red-green"] {
  --bp-accent: #a9a9ff;
  --bp-accent-soft: #26264a;
  --bp-focus: #c4c4ff;
  --bp-success: #56b4e9;
  --bp-success-soft: #10283a;
  --bp-warning: #f0e442;
  --bp-warning-soft: #2e2b0c;
  --bp-danger: #ff9b5c;
  --bp-danger-soft: #3a2010;
  --bp-info: #d0d0d0;
  --bp-info-soft: #2a2a2a;
}

/* ── Bleu-jaune (tritanopie) : sarcelle pour ce qui va, rouge pour ce qui ne va pas ── */
.bp-ui[data-vision="blue-yellow"] {
  --bp-accent: #8e1d4f;
  --bp-accent-soft: #f7e3ec;
  --bp-focus: #8e1d4f;
  --bp-success: #00695c;
  --bp-success-soft: #dcf1ee;
  --bp-warning: #8a1c7c;
  --bp-warning-soft: #f6e1f3;
  --bp-danger: #b71c1c;
  --bp-danger-soft: #fbe2e2;
  --bp-info: #37474f;
  --bp-info-soft: #e6eaec;
}
.bp-ui[data-mode="dark"][data-vision="blue-yellow"] {
  --bp-accent: #f48fb1;
  --bp-accent-soft: #3a1626;
  --bp-focus: #f8b4cb;
  --bp-success: #4db6ac;
  --bp-success-soft: #0f2c29;
  --bp-warning: #e17fd3;
  --bp-warning-soft: #33142f;
  --bp-danger: #ff8a80;
  --bp-danger-soft: #3b1513;
  --bp-info: #b0bec5;
  --bp-info-soft: #253035;
}

/* ── Monochrome (achromatopsie) : l'état par le trait, l'icône et le mot ── */
.bp-ui[data-vision="mono"] {
  --bp-accent: #1f1f1f;
  --bp-accent-text: #ffffff;
  --bp-accent-soft: #e6e6e6;
  --bp-focus: #000000;
  --bp-success: #1f1f1f;
  --bp-success-soft: #f2f2f2;
  --bp-warning: #3d3d3d;
  --bp-warning-soft: #ececec;
  --bp-danger: #000000;
  --bp-danger-soft: #dedede;
  --bp-info: #4a4a4a;
  --bp-info-soft: #f0f0f0;
  --bp-neutral: #4a4a4a;
}
.bp-ui[data-mode="dark"][data-vision="mono"] {
  --bp-accent: #f2f2f2;
  --bp-accent-text: #111111;
  --bp-accent-soft: #333333;
  --bp-focus: #ffffff;
  --bp-success: #f2f2f2;
  --bp-success-soft: #262626;
  --bp-warning: #d6d6d6;
  --bp-warning-soft: #2e2e2e;
  --bp-danger: #ffffff;
  --bp-danger-soft: #3a3a3a;
  --bp-info: #c8c8c8;
  --bp-info-soft: #2a2a2a;
  --bp-neutral: #c8c8c8;
}
.bp-ui[data-vision="mono"] :is(.bp-badge, .bp-deadline, .bp-message, .bp-list-mark).bp-tone-success { border-style: solid; }
.bp-ui[data-vision="mono"] :is(.bp-badge, .bp-deadline, .bp-message, .bp-list-mark).bp-tone-warning { border-style: dashed; }
.bp-ui[data-vision="mono"] :is(.bp-badge, .bp-deadline, .bp-message, .bp-list-mark).bp-tone-danger { border-style: double; border-width: 3px; font-weight: 700; }
.bp-ui[data-vision="mono"] .bp-stat.bp-tone-warning, .bp-ui[data-vision="mono"] .bp-stat.bp-tone-danger { border-left-style: double; border-left-width: 6px; }

/* ── Lecture facilitée (dys) ─────────────────────────────────────── */
.bp-ui[data-reading="dys"] {
  --bp-font: "OpenDyslexic", "Lexend", "Atkinson Hyperlegible", "Andika", Verdana, Tahoma, sans-serif;
  --bp-scale: 1.12;
  --bp-line: 1.8;
  --bp-letter: 0.05em;
  --bp-word: 0.16em;
  --bp-measure: 68ch;
}
.bp-ui[data-reading="dys"]:not([data-mode="dark"]) {
  --bp-bg: #f7f2e4;
  --bp-surface: #fffbef;
  --bp-surface-2: #f1ebd8;
  --bp-border: #ddd3b8;
  --bp-text: #262420;
  --bp-text-muted: #4f4a40;
}
.bp-ui[data-reading="dys"][data-mode="dark"] {
  --bp-bg: #1b1a17;
  --bp-surface: #24231f;
  --bp-surface-2: #2d2b26;
  --bp-border: #403d35;
  --bp-text: #ede6d3;
  --bp-text-muted: #c6bea8;
}
.bp-ui[data-reading="dys"] em, .bp-ui[data-reading="dys"] i { font-style: normal; font-weight: 600; }
.bp-ui[data-reading="dys"] p, .bp-ui[data-reading="dys"] .bp-text { max-width: var(--bp-measure); text-align: left; }
.bp-ui[data-reading="dys"] a { text-decoration: underline; text-underline-offset: 3px; }

/* ── Taille du texte ─────────────────────────────────────────────── */
.bp-ui[data-size="large"] { --bp-size: 17px; }
.bp-ui[data-size="larger"] { --bp-size: 19.5px; }

/* ── Mouvement ───────────────────────────────────────────────────── */
.bp-ui[data-motion="reduced"] { --bp-speed: 0ms; }
@media (prefers-reduced-motion: reduce) { .bp-ui { --bp-speed: 0ms; } }
`
