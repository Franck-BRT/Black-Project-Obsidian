// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le jalon de l'étape 3 : créer, modifier et relire une exigence ; la liste ; le bloc pm-req. */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../../core/i18n'
import type { BlockRenderer, ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../../core/testing/memoryPlatform'
import { exigencesModule } from '.'
import { exigencesFr } from './i18n'

const i18n = createI18n('fr')
i18n.register('fr', exigencesFr)

async function activate(platform: MemoryPlatform = memoryPlatform(), stored: Record<string, unknown> = {}) {
  let settings = stored
  const commands: ModuleCommand[] = []
  const blocks = new Map<string, BlockRenderer>()
  const context: ModuleContext = {
    moduleId: exigencesModule.id,
    platform,
    i18n,
    settings: { get: () => settings, save: async (values) => void (settings = values), onChange: () => () => {} },
    commands: { register: (command) => void commands.push(command) },
    blocks: { register: (language, render) => void blocks.set(language, render) }
  }
  await exigencesModule.activate(context)
  const run = (id: string) => commands.find((command) => command.id === id)!.run()
  return { platform, run, blocks, settings: () => settings }
}

const form = (values: Record<string, string>) => ({
  category: 'sys',
  title: 'Maintien en température',
  text: 'Le système doit maintenir la soute entre 5 °C et 30 °C.',
  type: 'performance',
  status: 'draft',
  criticality: 'high',
  verification: 'test',
  source: 'CCTP § 4.2',
  rationale: '',
  ...values
})

afterEach(async () => {
  await exigencesModule.deactivate?.()
})

describe('créer, modifier, relire', () => {
  it('« Nouvelle exigence » : le formulaire, la note écrite et ouverte', async () => {
    const { platform, run } = await activate()
    platform.forms.push(form({}))
    await run('nouvelle')
    const asked = platform.asked.at(-1)!
    expect(asked.title).toBe('Nouvelle exigence')
    expect(asked.fields.map((field) => field.key)).toEqual([
      'category',
      'title',
      'text',
      'type',
      'status',
      'criticality',
      'verification',
      'source',
      'rationale'
    ])
    expect(platform.notices.at(-1)).toBe('Exigence REQ-SYS-0001 créée.')
    expect(platform.opened.at(-1)).toBe('Exigences/REQ-SYS-0001 Maintien en température.md')
    const content = new TextDecoder().decode(platform.files.get('Exigences/REQ-SYS-0001 Maintien en température.md'))
    expect(content).toContain('verification: test')
    expect(content).toContain('criticality: high')
    expect(content).toContain('category: SYS')
  })

  it('« Modifier l’exigence » : la fiche préremplie ; une nouvelle formulation fait une révision', async () => {
    const { platform, run } = await activate()
    platform.forms.push(form({}))
    await run('nouvelle')
    platform.active = 'Exigences/REQ-SYS-0001 Maintien en température.md'
    platform.forms.push({
      ...form({ text: 'Le système doit maintenir la soute entre 0 °C et 30 °C.', title: 'Température de la soute' }),
      owner: 'Équipe thermique',
      tags: 'thermique, soute',
      aliases: 'omlx-sys-0001'
    })
    await run('modifier')
    const fiche = platform.asked.at(-1)!
    expect(fiche.title).toBe('Fiche REQ-SYS-0001')
    expect(fiche.fields.find((field) => field.key === 'text')?.value).toBe('Le système doit maintenir la soute entre 5 °C et 30 °C.')
    expect(platform.notices.at(-1)).toBe('Exigence REQ-SYS-0001 enregistrée (révision 2).')
    expect(platform.opened.at(-1)).toBe('Exigences/REQ-SYS-0001 Température de la soute.md')
    const content = new TextDecoder().decode(platform.files.get('Exigences/REQ-SYS-0001 Température de la soute.md'))
    expect(content).toContain('aliases:\n- OMLX-SYS-0001')
    expect(content).toContain('was: "Le système doit maintenir la soute entre 5 °C et 30 °C."')
  })

  it('refuse un alias qui désigne déjà une autre exigence', async () => {
    const { platform, run } = await activate()
    platform.forms.push(form({}), form({ title: 'Autre' }))
    await run('nouvelle')
    await run('nouvelle')
    platform.active = 'Exigences/REQ-SYS-0002 Autre.md'
    platform.forms.push({ ...form({ title: 'Autre' }), owner: '', tags: '', aliases: 'REQ-SYS-0001' })
    await expect(run('modifier')).rejects.toThrow('L’alias REQ-SYS-0001 désigne déjà REQ-SYS-0001')
  })

  it('sur une note qui n’est pas une exigence, le dit', async () => {
    const { platform, run } = await activate()
    await platform.fs.writeText('Note.md', '# Rien')
    platform.active = 'Note.md'
    await run('modifier')
    expect(platform.notices.at(-1)).toBe('La note ouverte n’est pas une exigence.')
  })
})

describe('la liste', () => {
  it('montre la bibliothèque, filtres compris ; une ligne mène à la fiche ou à la note', async () => {
    const { platform, run } = await activate()
    platform.forms.push(form({}), form({ category: 'SOL', title: 'Antenne', type: 'interface', criticality: '' }))
    await run('nouvelle')
    await run('nouvelle')
    platform.listAnswers.push({ kind: 'row', id: 'Exigences/REQ-SOL-0001 Antenne.md', state: { search: '', filters: { category: 'SOL' } } })
    platform.choices.push('open')
    await run('liste')
    const view = platform.lists.at(-1)!
    expect(view.title).toBe('Exigences (2)')
    expect(view.rows.map((row) => row.cells.id)).toEqual(['REQ-SOL-0001', 'REQ-SYS-0001'])
    expect(view.rows[0]?.cells).toMatchObject({ type: 'Interface', status: 'Brouillon', criticality: '—' })
    expect(view.filters?.find((filter) => filter.key === 'category')?.options.map((option) => option.value)).toEqual(['SOL', 'SYS'])
    expect(platform.opened.at(-1)).toBe('Exigences/REQ-SOL-0001 Antenne.md')
  })

  it('« Nouvelle exigence » depuis la liste, puis la liste revient aux mêmes filtres', async () => {
    const { platform, run } = await activate()
    const state = { search: 'soute', filters: { status: 'draft' } }
    platform.listAnswers.push({ kind: 'action', value: 'new', state })
    platform.forms.push(form({}))
    await run('liste')
    expect(platform.lists).toHaveLength(2)
    expect(platform.lists[1]?.state).toEqual(state)
    expect(platform.lists[1]?.rows).toHaveLength(1)
  })
})

describe('le bloc pm-req', () => {
  async function library() {
    const app = await activate()
    app.platform.forms.push(form({}), form({ title: 'Antenne', text: 'L’antenne doit…', status: 'approved' }))
    await app.run('nouvelle')
    await app.run('nouvelle')
    return app
  }

  it('cite par identifiant, dans l’ordre écrit, et dit ce qui manque', async () => {
    const { blocks } = await library()
    const view = await blocks.get('pm-req')!('REQ-SYS-0002\nREQ-SYS-0001\nREQ-SYS-0099\nstatut: x', 'Doc.md')
    expect(view.columns).toEqual(['Identifiant', 'Formulation', 'Statut'])
    expect(view.rows.map((row) => row.cells)).toEqual([
      ['REQ-SYS-0002', 'L’antenne doit…', 'Approuvée'],
      ['REQ-SYS-0001', 'Le système doit maintenir la soute entre 5 °C et 30 °C.', 'Brouillon']
    ])
    expect(view.rows[0]?.link).toBe('Exigences/REQ-SYS-0002 Antenne.md')
    expect(view.messages).toEqual(['Clé(s) inconnue(s), ignorée(s) : statut.', 'Introuvable(s) dans la bibliothèque : REQ-SYS-0099.'])
  })

  it('par filtre, avec ses colonnes ; une langue absente est signalée', async () => {
    const { blocks } = await library()
    const view = await blocks.get('pm-req')!('status: approved\nfields: id, title, criticality\nlang: en', 'Doc.md')
    expect(view.columns).toEqual(['Identifiant', 'Titre', 'Criticité'])
    expect(view.rows.map((row) => row.cells)).toEqual([['REQ-SYS-0002', 'Antenne', 'Haute']])
    expect(view.rows[0]?.flags).toEqual(['pas de formulation EN : FR affichée'])
  })

  it('un bloc vide le dit', async () => {
    const { blocks } = await library()
    expect((await blocks.get('pm-req')!('', 'Doc.md')).messages[0]).toContain('Bloc vide')
  })
})
