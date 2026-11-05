// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Dessine, dans une note, le bloc de code d'un module (`pm-req`…) : des messages, puis un
 * tableau. Le contenu vient du module (`BlockView`) ; ici, on ne fait que le mettre en
 * forme. Un clic sur la première cellule ouvre la note de la ligne.
 */

import type { BlockView } from '../core/modules/module'
import type { Ui } from '../core/ports'

export function drawBlock(el: HTMLElement, view: BlockView, ui: Ui): void {
  el.empty()
  el.addClass('bp-block')
  for (const message of view.messages) el.createDiv({ text: message, cls: 'bp-block-message' })
  if (view.rows.length === 0) {
    if (view.empty) el.createDiv({ text: view.empty, cls: 'bp-block-empty' })
    return
  }
  const table = el.createEl('table', { cls: 'bp-block-table' })
  const head = table.createEl('thead').createEl('tr')
  for (const column of view.columns) head.createEl('th', { text: column })
  const body = table.createEl('tbody')
  for (const row of view.rows) {
    const line = body.createEl('tr')
    row.cells.forEach((text, index) => {
      const cell = line.createEl('td')
      if (index === 0 && row.link) {
        const link = cell.createEl('a', { text, cls: 'internal-link', href: '#' })
        const target = row.link
        link.addEventListener('click', (event) => {
          event.preventDefault()
          void ui.openNote(target)
        })
      } else cell.setText(text)
      if (index === 0) for (const flag of row.flags ?? []) cell.createDiv({ text: flag, cls: 'bp-block-flag' })
    })
  }
}

/** Ce qui s'affiche quand le module n'a pas pu dessiner le bloc. */
export function drawBlockError(el: HTMLElement, message: string): void {
  el.empty()
  el.addClass('bp-block')
  el.createDiv({ text: message, cls: 'bp-block-message' })
}
