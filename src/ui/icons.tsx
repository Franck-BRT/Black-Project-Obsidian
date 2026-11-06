// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les icônes, dessinées pour Black Projects (24 × 24, au trait). Décoratives : le texte dit tout. */

import type { IconName } from '../core/views'

const PATHS: Record<IconName, string> = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  folder: 'M3 6h6l2 2h10v11H3z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  check: 'M4 12l5 5L20 6',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  cross: 'M6 6l12 12M18 6L6 18',
  info: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 11v6M12 7h.01',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 3',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  flow: 'M5 4h4v4H5zM15 16h4v4h-4zM7 8v4a2 2 0 0 0 2 2h6a2 2 0 0 1 2 2',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18',
  settings: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M19 12l2-1-1-3-2 .2-1.5-1.5L16.7 4l-3-1-1 2h-1.4l-1-2-3 1 .2 2.7L6 8.2 4 8 3 11l2 1v1.4l-2 1 1 3 2-.2 1.5 1.5L7.3 20l3 1 1-2h1.4l1 2 3-1-.2-2.7 1.5-1.5 2 .2 1-3-2-1z',
  refresh: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  book: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  chat: 'M4 5h16v11H9l-5 4z',
  play: 'M7 4l13 8-13 8z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  chevron: 'M9 6l6 6-6 6',
  chart: 'M4 20V11M10 20V5M16 20v-6M22 20H2',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  columns: 'M3 5h18v14H3zM14 5v14',
  hide: 'M3 3l18 18M10.6 6.1A10.5 10.5 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.6M6.6 7.6A17 17 0 0 0 2 12s4 6 10 6a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  back: 'M19 12H5M11 6l-6 6 6 6'
}

export function Icon({ name, label }: { name: IconName; label?: string }) {
  return (
    <svg class="bp-icon" viewBox="0 0 24 24" aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined} aria-label={label}>
      <path d={PATHS[name]} />
    </svg>
  )
}
