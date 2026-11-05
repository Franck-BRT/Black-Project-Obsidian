// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le rangement voyage avec les types exportés par le module Typage des pièces, et revient à l'import. */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../../core/testing/memoryPlatform'
import { typagePiecesModule } from '../typage-pieces'
import { aoModule } from '.'
import { aoFr } from './i18n'
import { RANGEMENT_KEY, WELCOME_KEY } from './placement'

const i18n = createI18n('fr')
i18n.register('fr', aoFr)
i18n.register('fr', typagePiecesModule.texts.fr)

/** Un coffre : les deux modules actifs, avec leurs réglages. */
async function vault(typing: Record<string, unknown>, ao: Record<string, unknown>) {
  const platform = memoryPlatform()
  const stored: Record<string, Record<string, unknown>> = { typing, ao: { [WELCOME_KEY]: true, rappelOuverture: false, ...ao } }
  const commands: ModuleCommand[] = []
  const contextOf = (module: BlackModule, key: 'typing' | 'ao'): ModuleContext => ({
    moduleId: module.id,
    platform,
    i18n,
    settings: { get: () => stored[key]!, save: async (values) => void (stored[key] = values), onChange: () => () => {} },
    commands: { register: (command) => void commands.push(command) }
  })
  await typagePiecesModule.activate(contextOf(typagePiecesModule, 'typing'))
  await aoModule.activate(contextOf(aoModule, 'ao'))
  const run = (id: string) => commands.find((command) => command.id === id)!.run()
  return { platform, run, stored }
}

async function close() {
  await aoModule.deactivate?.()
  await typagePiecesModule.deactivate?.()
}

const exported = (platform: MemoryPlatform) => {
  const path = [...platform.files.keys()].find((each) => each.startsWith('Black Projects/Échanges/'))!
  return platform.files.get(path)!
}

describe('le rangement dans les fichiers de types', () => {
  afterEach(close)

  it('est exporté avec chaque type rangé, puis repris dans un autre coffre', async () => {
    const one = await vault(
      { typesPerso: { PAQ: 'Plan d’assurance qualité' } },
      { [RANGEMENT_KEY]: { BPU: 'reponse', CCTP: 'appel-d-offres', PAQ: 'les-deux' } }
    )
    await one.run('exporter-types')
    // Proposés : le type ajouté, et les types que seul le rangement distingue.
    const offered = one.platform.manyAsked.at(-1)!.choices
    expect(offered.map((choice) => choice.value)).toEqual(['CCTP', 'BPU', 'PAQ'])
    expect(offered.find((choice) => choice.value === 'BPU')?.description).toContain('va dans : Réponse AO')
    const file = JSON.parse(new TextDecoder().decode(exported(one.platform))) as { types: { code: string; modules?: unknown }[] }
    expect(Object.fromEntries(file.types.map((type) => [type.code, type.modules]))).toEqual({
      BPU: { ao: { rangement: 'reponse' } },
      CCTP: { ao: { rangement: 'appel-d-offres' } },
      PAQ: { ao: { rangement: 'les-deux' } }
    })
    const bytes = exported(one.platform)
    await close()

    const two = await vault({}, { [RANGEMENT_KEY]: { RC: 'appel-d-offres', BPU: 'appel-d-offres' } })
    two.platform.choices.push('computer')
    two.platform.externalFiles.push([{ name: 'types.json', bytes }])
    two.platform.manyAnswers.push(['BPU', 'PAQ'])
    await two.run('importer-types')
    expect(two.platform.manyAsked.at(-1)!.choices.find((choice) => choice.value === 'PAQ')?.description).toContain(
      'va dans : AO et Réponse AO (demandé)'
    )
    // BPU et PAQ repris, CCTP non coché laissé, RC déjà là gardé.
    expect(two.stored.ao![RANGEMENT_KEY]).toEqual({ RC: 'appel-d-offres', BPU: 'reponse', PAQ: 'les-deux' })
    expect(two.platform.notices.at(-1)).toContain('Repris aussi : le rangement (Analyse d’appels d’offres) pour 2 type(s).')
  })

  it('module AO absent du coffre qui importe : le rangement est ignoré, et on le dit', async () => {
    const one = await vault({}, { [RANGEMENT_KEY]: { BPU: 'reponse' } })
    await one.run('exporter-types')
    const bytes = exported(one.platform)
    await close()

    const two = await vault({}, {})
    await aoModule.deactivate?.()
    two.platform.choices.push('computer')
    two.platform.externalFiles.push([{ name: 'types.json', bytes }])
    await two.run('importer-types')
    expect(two.platform.notices.at(-1)).toContain('ignorés : ao.')
  })
})
