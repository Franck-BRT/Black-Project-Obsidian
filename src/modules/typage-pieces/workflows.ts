// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le workflow système du typage des pièces : **signaler les pièces sans type reconnu**
 * (activé d'origine). À l'import des pièces d'une analyse, celles qu'aucun mot-clé n'a
 * reconnues (classées « Autre ») sont nommées, avec comment les typer : un mot-clé pour la
 * suite, « Changer le type de la pièce » pour celles-ci.
 *
 * Le déclencheur est celui de l'analyse d'appels d'offres (« Pièces importées »), désigné
 * par son identifiant : sans elle, ce workflow ne se déclenche pas.
 */

import { registerAction, registerSystemWorkflow } from '../workflows'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const SYS_UNTYPED = 'sys.typage-pieces.sans-type'
/** « Pièces importées » (analyse d'appels d'offres) : ses pièces sans type reconnu dans `nontypees`. */
const TRIGGER_IMPORTED = 'ao.pieces-importees'

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

  registerSystemWorkflow({
    id: SYS_UNTYPED,
    moduleKey: 'typage-pieces.name',
    enabledByDefault: true,
    make: (tr) => ({
      name: tr('typage-pieces.sys.sans-type'),
      mode: 'auto',
      trigger: { kind: TRIGGER_IMPORTED },
      conditions: [{ field: 'nontypees', op: 'not-empty', value: '' }],
      actions: [{ kind: 'typage-pieces.sans-type', fields: { pieces: '{nontypees}' } }]
    })
  })
}
