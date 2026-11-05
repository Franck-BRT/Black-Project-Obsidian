// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le rangement des types : le réglage, sa fenêtre, l'information sur les fiches du typage, la reprise de la 0.4.1. */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import type { ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform } from '../../core/testing/memoryPlatform'
import { typagePiecesModule, typeAnnotations as typeAnnotationsFor } from '../typage-pieces'
import { aoModule, rangementField } from '.'
import { aoFr } from './i18n'
import {
  columnsPlace,
  DEFAULT_RANGEMENT,
  migratePlaces,
  placeColumns,
  placeOf,
  RANGEMENT_KEY,
  rangementOf,
  renameRangement
} from './placement'

const i18n = createI18n('fr')
i18n.register('fr', aoFr)
i18n.register('fr', typagePiecesModule.texts.fr)
const t = (key: string) => i18n.t(key)

describe('le rangement par défaut', () => {
  it('les pièces de l’acheteur avec l’appel d’offres, les autres des deux côtés, AUTRE toujours demandé', () => {
    expect(DEFAULT_RANGEMENT.CCTP).toBe('appel-d-offres')
    expect(DEFAULT_RANGEMENT.RC).toBe('appel-d-offres')
    expect(DEFAULT_RANGEMENT.AVIS).toBe('appel-d-offres')
    expect(Object.keys(DEFAULT_RANGEMENT)).toHaveLength(15)
    expect(DEFAULT_RANGEMENT.BPU).toBe('les-deux')
    expect('AUTRE' in DEFAULT_RANGEMENT).toBe(false)
    expect(rangementOf({})).toEqual(DEFAULT_RANGEMENT)
    expect(placeOf('INCONNU', DEFAULT_RANGEMENT)).toBe('les-deux')
  })

  it('enregistré, il fait foi ; les valeurs inconnues sont écartées', () => {
    expect(rangementOf({ [RANGEMENT_KEY]: { CCTP: 'reponse', RC: 'n-importe', AUTRE: 'reponse', FANTOME: 'reponse' } })).toEqual({
      CCTP: 'reponse'
    })
  })

  it('les colonnes allumées donnent la place, et inversement', () => {
    expect(placeColumns('les-deux')).toEqual(['appel-d-offres', 'reponse'])
    expect(columnsPlace(['reponse'])).toBe('reponse')
    expect(columnsPlace(['appel-d-offres', 'reponse'])).toBe('les-deux')
    expect(columnsPlace([])).toBeNull()
  })
})

describe('le réglage, tel que la fenêtre du module le dessine', () => {
  it('la liste, les types qu’on peut ajouter, l’ajout, la modification, le retrait', () => {
    const start = { [RANGEMENT_KEY]: { CCTP: 'appel-d-offres', BPU: 'les-deux' } }
    expect(rangementField.read(start)).toEqual({ CCTP: ['appel-d-offres'], BPU: ['appel-d-offres', 'reponse'] })
    const candidates = rangementField.candidates(start)
    expect(candidates).toContain('RC')
    expect(candidates).not.toContain('CCTP')
    expect(candidates).not.toContain('AUTRE')
    expect(rangementField.itemLabel('CCTP', start, t)).toBe('CCTP — Cahier des clauses techniques particulières')

    const added = rangementField.write(start, 'MEMOIRE', ['reponse'])
    expect(added[RANGEMENT_KEY]).toEqual({ CCTP: 'appel-d-offres', BPU: 'les-deux', MEMOIRE: 'reponse' })
    const changed = rangementField.write(added, 'BPU', ['reponse'])
    expect((changed[RANGEMENT_KEY] as Record<string, string>).BPU).toBe('reponse')
    const removed = rangementField.write(changed, 'CCTP', null)
    expect(removed[RANGEMENT_KEY]).toEqual({ BPU: 'reponse', MEMOIRE: 'reponse' })
  })

  it('le premier changement part du rangement par défaut', () => {
    const next = rangementField.write({}, 'BPU', ['reponse'])
    expect(next[RANGEMENT_KEY]).toEqual({ ...DEFAULT_RANGEMENT, BPU: 'reponse' })
  })
})

describe('l’information sur les fiches du typage', () => {
  const activate = async (stored: Record<string, unknown>) => {
    const commands: ModuleCommand[] = []
    const context: ModuleContext = {
      moduleId: aoModule.id,
      platform: memoryPlatform(),
      i18n,
      settings: { get: () => stored, save: async () => {}, onChange: () => () => {} },
      commands: { register: (command) => void commands.push(command) }
    }
    await aoModule.activate(context)
  }
  afterEach(async () => {
    await aoModule.deactivate?.()
  })

  it('dit où va chaque type, et disparaît quand le module s’arrête', async () => {
    await activate({ [RANGEMENT_KEY]: { CCTP: 'appel-d-offres', BPU: 'reponse', AE: 'les-deux' } })
    expect(typeAnnotationsFor('CCTP')).toEqual([{ labelKey: 'ao.annotation', tags: ['Appel d’offres'] }])
    expect(typeAnnotationsFor('BPU')).toEqual([{ labelKey: 'ao.annotation', tags: ['Réponse'] }])
    expect(typeAnnotationsFor('AE')[0]?.tags).toEqual(['Appel d’offres', 'Réponse', 'demandé à l’import'])
    expect(typeAnnotationsFor('RC')[0]?.tags).toEqual(['Appel d’offres', 'Réponse', 'demandé à l’import'])
    await aoModule.deactivate?.()
    expect(typeAnnotationsFor('CCTP')).toEqual([])
  })
})

describe('les types renommés, et la reprise de la 0.4.1', () => {
  it('un type renommé garde son rangement', () => {
    const settings = { dossier: 'AO', [RANGEMENT_KEY]: { PAQ: 'reponse', CCTP: 'appel-d-offres' } }
    expect(renameRangement(settings, { PAQ: 'PQ' })).toEqual({
      dossier: 'AO',
      [RANGEMENT_KEY]: { CCTP: 'appel-d-offres', PQ: 'reponse' }
    })
    expect(renameRangement(settings, { AUTRECHOSE: 'X' })).toBeNull()
    expect(renameRangement({}, { PAQ: 'PQ' })).toBeNull()
  })

  it('la place choisie dans le typage en 0.4.1 passe dans ce module', () => {
    const modules = {
      'typage-pieces': { placesTypes: { BPU: 'reponse', AUTRE: 'reponse' }, typesPerso: { PAQ: 'Plan' } },
      ao: { dossier: 'AO' },
      autre: { x: 1 }
    }
    const migrated = migratePlaces(modules, 'ao', 'typage-pieces')!
    expect(migrated['typage-pieces']).toEqual({ typesPerso: { PAQ: 'Plan' } })
    expect(migrated.ao).toEqual({ dossier: 'AO', [RANGEMENT_KEY]: { ...DEFAULT_RANGEMENT, BPU: 'reponse' } })
    expect(migrated.autre).toEqual({ x: 1 })
    expect(migratePlaces(migrated, 'ao', 'typage-pieces')).toBeNull()
  })

  it('un rangement déjà réglé n’est pas écrasé', () => {
    const migrated = migratePlaces(
      { 'typage-pieces': { placesTypes: { BPU: 'reponse' } }, ao: { [RANGEMENT_KEY]: { CCTP: 'reponse' } } },
      'ao',
      'typage-pieces'
    )!
    expect(migrated.ao).toEqual({ [RANGEMENT_KEY]: { CCTP: 'reponse' } })
    expect(migrated['typage-pieces']).toEqual({})
  })
})
