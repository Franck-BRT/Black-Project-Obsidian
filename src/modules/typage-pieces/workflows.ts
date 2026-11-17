// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'action du typage des pièces pour les workflows : **signaler les pièces sans type reconnu**.
 * À l'import des pièces d'une analyse, celles qu'aucun mot-clé n'a reconnues (classées
 * « Autre ») sont nommées, avec comment les typer : un mot-clé pour la suite, « Changer le
 * type de la pièce » pour celles-ci. Le workflow système qui s'en sert (« Signaler les pièces
 * à problème, à l'import ») est déclaré par l'analyse d'appels d'offres.
 */

import { registerAction } from '../workflows'

type Translate = (key: string, vars?: Record<string, string | number>) => string


const split = (text: string): string[] =>
  text
    .split(/\s*[,;\n]\s*/)
    .map((each) => each.trim())
    .filter(Boolean)

export function registerTypingWorkflows(t: Translate): void {
  registerAction({
    id: 'typage-pieces.sans-type',
    labelKey: 'typage-pieces.wf.action.untyped',
    descKey: 'typage-pieces.wf.action.untyped.desc',
    fields: [{ key: 'pieces', labelKey: 'typage-pieces.wf.field.pieces', kind: 'text', defaultValue: '{nontypees}' }],
    results: ['text'],
    async run({ fields, subject, notifier }) {
      // Les noms tels quels (un nom peut contenir une virgule) ; sinon le champ.
      const listed = subject.lists.nontypees ?? []
      const pieces = listed.length && fields.pieces === listed.join(', ') ? listed : split(fields.pieces ?? '')
      if (!pieces.length) {
        const text = t('typage-pieces.wf.untyped.none')
        return { lines: [text], results: { text } }
      }
      const text = t(subject.label ? 'typage-pieces.wf.untyped.found.in' : 'typage-pieces.wf.untyped.found', { count: pieces.length, names: pieces.join(', '), where: subject.label })
      notifier.notify(`${text} ${t('typage-pieces.wf.untyped.how')}`, 15000)
      return { lines: [text], results: { text } }
    }
  })
}
