// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La fenêtre du module : chaque type de pièce sur sa fiche, avec les mots-clés qui le font
 * reconnaître (ceux du module et ceux de l'utilisateur) et l'interrupteur qui le désactive.
 * Tirée de la liste même que la reconnaissance applique.
 */

import type { ModuleDetails } from '../../core/modules/module'
import { DISABLED_KEY, PLACES_KEY } from './custom'
import { allTypes, isDisabled, NO_CUSTOM_KEYWORDS, OTHER, PLACES, type CustomKeywords } from './types'

export function typingDetails(custom: CustomKeywords = NO_CUSTOM_KEYWORDS): ModuleDetails {
  const added = (keywords: Readonly<Record<string, string>>, code: string) =>
    Object.keys(keywords).filter((keyword) => keywords[keyword] === code)
  return {
    titleKey: 'typage-pieces.details.title',
    introKey: 'typage-pieces.details.intro',
    sections: [
      {
        // Les types de pièces et ce qui les fait reconnaître, tirés de la liste même que la
        // reconnaissance applique.
        titleKey: 'typage-pieces.types.section',
        introKey: 'typage-pieces.types.intro',
        kind: 'reference',
        tagPrefix: '',
        features: allTypes(custom).map((each) => ({
          prefix: each.code,
          labelKey: each.labelKey,
          ...(each.label === undefined ? {} : { vars: { label: each.label } }),
          status: 'available' as const,
          // « Autre pièce » ne se désactive pas : c'est là que va ce qui n'est rien d'autre.
          ...(each.code === OTHER
            ? {}
            : {
                disabled: isDisabled(each.code, custom),
                switch: {
                  settingsKey: DISABLED_KEY,
                  id: each.code,
                  tooltipKeys: { on: 'typage-pieces.types.switch.on', off: 'typage-pieces.types.switch.off' }
                }
              }),
          // Où va une pièce de ce type dans une analyse ; « les deux » : demandé à l'import.
          select: {
            settingsKey: PLACES_KEY,
            id: each.code,
            labelKey: 'typage-pieces.place.label',
            value: each.place,
            options: PLACES.map((place) => ({ value: place, labelKey: `typage-pieces.place.${place}` })),
            tooltipKey: 'typage-pieces.place.tip'
          },
          tagGroups: [
            { labelKey: 'typage-pieces.types.byName', tags: each.names },
            { labelKey: 'typage-pieces.types.byTitle', tags: each.titles },
            { labelKey: 'typage-pieces.types.addedName', tags: added(custom.names, each.code) },
            { labelKey: 'typage-pieces.types.addedTitle', tags: added(custom.titles, each.code) }
          ],
          ...(each.code === OTHER
            ? { noteKey: 'typage-pieces.types.other' }
            : isDisabled(each.code, custom)
              ? { noteKey: 'typage-pieces.types.disabledNote' }
              : each.custom
                ? { noteKey: 'typage-pieces.types.customNote' }
                : {})
        }))
      }
    ]
  }
}
