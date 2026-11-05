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
  migratePlaces,
  placeColumns,
  placementMessage,
  placeOf,
  RANGEMENT_KEY,
  rangementOf,
  REMINDER_KEY,
  renameRangement,
  WELCOME_KEY
} from './placement'

const i18n = createI18n('fr')
i18n.register('fr', aoFr)
i18n.register('fr', typagePiecesModule.texts.fr)
const t = (key: string) => i18n.t(key)

describe('le rangement', () => {
  it('vide au départ : c’est à l’utilisateur de choisir, et tout est demandé', () => {
    expect(rangementOf({})).toEqual({})
    expect(placeOf('CCTP', rangementOf({}))).toBe('les-deux')
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

  it('au départ, la liste est vide et tous les types (sauf AUTRE) peuvent être ajoutés', () => {
    expect(rangementField.read({})).toEqual({})
    expect(rangementField.candidates({})).toHaveLength(15)
    expect(rangementField.write({}, 'BPU', ['reponse'])[RANGEMENT_KEY]).toEqual({ BPU: 'reponse' })
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
    expect(typeAnnotationsFor('RC')[0]?.tags).toEqual(['pas encore rangé — demandé à l’import'])
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
    expect(migrated.ao).toEqual({ dossier: 'AO', [RANGEMENT_KEY]: { BPU: 'reponse' } })
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

describe('le message à l’activation, puis le rappel à l’ouverture', () => {
  const activate = async (stored: Record<string, unknown>, platform = memoryPlatform(), withWindow = true) => {
    let settings = stored
    let opened = 0
    const context: ModuleContext = {
      moduleId: aoModule.id,
      platform,
      i18n,
      settings: { get: () => settings, save: async (values) => void (settings = values), onChange: () => () => {} },
      commands: { register: () => {} },
      ...(withWindow ? { openWindow: () => void opened++ } : {})
    }
    await aoModule.activate(context)
    // Le message est montré sans bloquer l'activation.
    await new Promise((resolve) => setTimeout(resolve, 0))
    return { platform, settings: () => settings, opened: () => opened }
  }
  afterEach(async () => {
    await aoModule.deactivate?.()
  })

  it('quand dire quoi', () => {
    expect(placementMessage({})).toBe('welcome')
    expect(placementMessage({ [WELCOME_KEY]: true })).toBe('reminder')
    expect(placementMessage({ [WELCOME_KEY]: true, [REMINDER_KEY]: false })).toBeNull()
    expect(placementMessage({ [RANGEMENT_KEY]: { CCTP: 'appel-d-offres' } })).toBeNull()
    // Seulement des types qui n'existent plus : la liste est vide.
    expect(placementMessage({ [WELCOME_KEY]: true, [RANGEMENT_KEY]: { FANTOME: 'reponse' } })).toBe('reminder')
  })

  it('à l’activation : l’explication, sans case ; « Régler maintenant » ouvre la fenêtre du module', async () => {
    const platform = memoryPlatform()
    platform.messageAnswers.push({ action: 'open', option: false })
    const run = await activate({}, platform)
    const [message] = platform.messages
    expect(message?.title).toBe('Analyse d’appels d’offres : où ranger les pièces ?')
    expect(message?.message).toContain('Aucun type de pièce n’est encore rangé')
    expect(message?.option).toBeUndefined()
    expect(message?.actions.map((action) => action.label)).toEqual(['Plus tard', 'Régler maintenant'])
    expect(run.opened()).toBe(1)
    expect(run.settings()[WELCOME_KEY]).toBe(true)
  })

  it('aux ouvertures suivantes : le rappel, avec sa case ; cochée, il ne revient plus', async () => {
    const platform = memoryPlatform()
    platform.messageAnswers.push({ action: 'later', option: true })
    const run = await activate({ [WELCOME_KEY]: true }, platform)
    expect(platform.messages[0]?.title).toBe('Rappel : aucun type de pièce rangé')
    expect(platform.messages[0]?.option?.label).toBe('Ne plus me le rappeler à l’ouverture')
    expect(run.opened()).toBe(0)
    expect(run.settings()[REMINDER_KEY]).toBe(false)
    await aoModule.deactivate?.()
    const again = await activate(run.settings())
    expect(again.platform.messages).toEqual([])
  })

  it('rien quand un type est rangé ; pas de bouton « Régler » sans fenêtre de module', async () => {
    const ranged = await activate({ [RANGEMENT_KEY]: { CCTP: 'appel-d-offres' } })
    expect(ranged.platform.messages).toEqual([])
    await aoModule.deactivate?.()
    const bare = await activate({}, memoryPlatform(), false)
    expect(bare.platform.messages[0]?.actions.map((action) => action.value)).toEqual(['later'])
  })
})
