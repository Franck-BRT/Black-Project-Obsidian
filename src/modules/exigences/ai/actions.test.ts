// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Relire et traduire une exigence avec l'IA : rien ne change sans l'accord de l'utilisateur. */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../../../core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../../../core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../../../core/testing/memoryPlatform'
import { iaModule } from '../../ia'
import { exigencesModule } from '..'
import { exigencesFr } from '../i18n'
import { withReview, REVIEW_END, REVIEW_START } from './actions'

const i18n = createI18n('fr')
i18n.register('fr', exigencesFr)
i18n.register('fr', iaModule.texts.fr)

async function activate(module: BlackModule, platform: MemoryPlatform, initial: Record<string, unknown>) {
  let stored = initial
  const commands: ModuleCommand[] = []
  const context: ModuleContext = {
    moduleId: module.id,
    platform,
    i18n,
    settings: { get: () => stored, save: async (values) => void (stored = values), onChange: () => () => {} },
    commands: { register: (command) => void commands.push(command) }
  }
  await module.activate(context)
  return { run: (id: string) => commands.find((command) => command.id === id)!.run() }
}

/** Une réponse de serveur compatible OpenAI dont le message est `content`. */
const chat = (content: unknown) => ({
  status: 200,
  text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] })
})

const PATH = 'Exigences/REQ-SYS-0001 Maintien en température.md'

async function setup(withAi = true) {
  const platform = memoryPlatform()
  if (withAi) await activate(iaModule, platform, { adresse: 'http://sidonie/v1', modele: 'mistral' })
  const exigences = await activate(exigencesModule, platform, {})
  platform.forms.push({
    category: 'sys',
    title: 'Maintien en température',
    text: 'Le système doit maintenir la soute entre 5 °C et 30 °C si possible.',
    type: 'performance',
    status: 'draft',
    criticality: 'high',
    verification: 'test',
    source: 'CCTP § 4.2',
    rationale: ''
  })
  await exigences.run('nouvelle')
  platform.active = PATH
  return { platform, run: exigences.run }
}

const read = (platform: MemoryPlatform, path = PATH) => new TextDecoder().decode(platform.files.get(path))

afterEach(async () => {
  await exigencesModule.deactivate?.()
  await iaModule.deactivate?.()
})

describe('la relecture par l’IA', () => {
  it('sans IA réglée, le dit au lieu d’échouer', async () => {
    const { platform, run } = await setup(false)
    await run('relire-ia')
    expect(platform.notices.at(-1)).toMatch(/IA n’est pas réglée|AI is not set up/)
    expect(platform.requests).toHaveLength(0)
  })

  it('écrit la relecture dans la note et applique la reformulation choisie, avec une révision', async () => {
    const { platform, run } = await setup()
    platform.httpAnswers.push(
      chat({
        assessment: 'Exigence claire sur la plage, affaiblie par « si possible ».',
        findings: [{ rule: 'escape-clause', severity: 'error', message: 'Retirer la clause d’échappement.' }],
        proposals: [
          {
            axis: 'unambiguous',
            action: 'Retirer « si possible ».',
            rewrite: 'Le système doit maintenir la soute entre 5 °C et 30 °C.'
          }
        ]
      })
    )
    platform.choices.push('0')
    await run('relire-ia')
    // Ce qui a été demandé : la formulation, et les axes faibles calculés par les règles.
    const body = JSON.parse(platform.requests[0]!.body!) as { messages: { role: string; content: string }[] }
    expect(body.messages[1]!.content).toContain('si possible')
    expect(platform.offered.at(-1)!.map((choice) => choice.label)).toEqual([
      'Le système doit maintenir la soute entre 5 °C et 30 °C.',
      'Ne rien changer'
    ])
    const note = read(platform)
    expect(note).toContain('Relecture par l’IA')
    expect(note).toContain('affaiblie par « si possible »')
    expect(note).toContain('Le système doit maintenir la soute entre 5 °C et 30 °C.\n')
    expect(note).toMatch(/rev: 2/)
    expect(platform.notices.at(-1)).toContain('révision 2')
  })

  it('« Ne rien changer » laisse la formulation, la relecture reste', async () => {
    const { platform, run } = await setup()
    platform.httpAnswers.push(
      chat({ assessment: 'Correct.', findings: [], proposals: [{ axis: 'unambiguous', action: 'Préciser.', rewrite: 'Autre texte.' }] })
    )
    platform.choices.push('keep')
    await run('relire-ia')
    const note = read(platform)
    expect(note).toContain('si possible')
    expect(note).toMatch(/rev: 1/)
    expect(note).toContain('Autre texte.')
  })

  it('une deuxième relecture remplace la première', () => {
    const once = withReview('# Note\n\nCorps', 'Première')
    const twice = withReview(once, 'Seconde')
    expect(twice).toContain('Seconde')
    expect(twice).not.toContain('Première')
    expect(twice.split(REVIEW_START)).toHaveLength(2)
    expect(twice.split(REVIEW_END)).toHaveLength(2)
  })

  it('le serveur injoignable est dit en clair, la note intacte', async () => {
    const { platform, run } = await setup()
    const before = read(platform)
    platform.httpAnswers.push({ status: 500, text: 'boom' })
    await run('relire-ia')
    expect(platform.notices.at(-1)).toMatch(/^L’IA n’a pas pu répondre/)
    expect(read(platform)).toBe(before)
  })
})

describe('la traduction par l’IA', () => {
  it('traduit dans l’autre langue de rédaction, marquée automatique, à relire', async () => {
    const { platform, run } = await setup()
    platform.httpAnswers.push(chat({ text: 'The system shall keep the hold between 5 °C and 30 °C if possible.', notes: '' }))
    await run('traduire-ia')
    const note = read(platform)
    expect(note).toContain('The system shall keep the hold between 5 °C and 30 °C if possible.')
    expect(note).toMatch(/origin: machine/)
    expect(platform.notices.at(-1)).toContain('traduite en EN')
    expect(platform.notices.at(-1)).not.toContain('Attention')
  })

  it('prévient quand un chiffre a changé', async () => {
    const { platform, run } = await setup()
    platform.httpAnswers.push(chat({ text: 'The system shall keep the hold between 5 °C and 35 °C.', notes: '' }))
    await run('traduire-ia')
    expect(platform.notices.at(-1)).toMatch(/Attention, chiffres ou unités différents — absents : .*30/)
  })
})
