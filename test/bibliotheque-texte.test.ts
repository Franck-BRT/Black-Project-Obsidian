// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le **texte extrait** d'un document de la bibliothèque — exactement comme pour une pièce
 * d'analyse : à son entrée, son texte est transcrit dans sa fiche (sa note), entre des marques
 * (« ## Texte extrait », un encadré qui dit la lecture, le texte, ses titres descendus de
 * deux niveaux) ; l'en-tête garde `lecture` et `caracteres`. Les notes de l'utilisateur, hors
 * des marques, ne bougent jamais. Sur la fiche, une section repliable « Texte extrait » ;
 * « Extraire le texte » (de nouveau) le relit.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock } from '../src/core/views'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

const ALL = [lectureFichiersModule, bibliothequeModule]
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const START = '<!-- bp:texte:debut — texte extrait du fichier, tenu à jour par Black Projects ; ne pas modifier entre ces marques -->'
const END = '<!-- bp:texte:fin -->'

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = ALL) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {}
  const views = new ViewsRegistry()
  for (const module of modules) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: () => {}
    }
    await module.activate(context)
  }
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const pour = async (name: string, content: string | Uint8Array) => (await pourIntoLibrary([{ name, bytes: typeof content === 'string' ? bytes(content) : content }], { module: 'bibliotheque', label: '' }))!.added[0]!
  const section = async (record: string) => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(record))
    return fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.texte')
  }
  return { pour, section }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('le texte extrait, dans la fiche', () => {
  it('à l’entrée : transcrit entre ses marques, l’encadré, les titres descendus ; lecture et caractères dans l’en-tête', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform)
    const text = '# Plan qualité\n\nLe présent plan décrit l’organisation.\n\n## Contrôles\n\nUne revue par mois.'
    const doc = await pour('Plan qualité.md', text)
    const note = read(platform, doc.record)
    expect(note).toMatch(/\nlecture: lue\ncaracteres: \d+\n/)
    expect(doc).toMatchObject({ reading: 'lue' })
    const block = note.slice(note.indexOf(START), note.indexOf(END) + END.length)
    expect(block).toBe(
      [
        START,
        '## Texte extrait',
        '',
        `> [!info] Document lu : ${doc.characters} caractères de texte extrait.`,
        '',
        '### Plan qualité',
        '',
        'Le présent plan décrit l’organisation.',
        '',
        '#### Contrôles',
        '',
        'Une revue par mois.',
        END
      ].join('\n')
    )
    // Après la section des notes de l'utilisateur.
    expect(note.indexOf('## Notes')).toBeLessThan(note.indexOf(START))
  })

  it('pas de texte : l’encadré dit pourquoi — image, format non lu, illisible ; sans lecture de fichiers, rien n’est transcrit', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform)
    const image = await pour('Photo.png', new Uint8Array([137, 80, 78, 71]))
    expect(read(platform, image.record)).toMatch(/\nlecture: image\ncaracteres: 0\n/)
    expect(read(platform, image.record)).toContain('> [!warning] Image\n> Une image sera lue par le modèle de vision du serveur d’IA (étape 7).\n\n*Pas de texte extrait.*')
    const plan = await pour('Maquette.dwg', 'binaire')
    expect(read(platform, plan.record)).toContain('> [!warning] Format non lu')
    for (const module of [...ALL].reverse()) await module.deactivate?.()
    const other = memoryPlatform()
    const again = await start(other, [bibliothequeModule])
    const doc = await again.pour('Note.md', 'Bonjour.')
    expect(read(other, doc.record)).not.toContain(START)
    expect(read(other, doc.record)).not.toMatch(/\nlecture:/)
  })

  it('la section de la fiche : repliée, l’état en en-tête ; l’encadré, ses actions, le texte', async () => {
    const platform = memoryPlatform()
    const { pour, section } = await start(platform)
    const doc = await pour('Compte rendu.md', 'Compte rendu de réunion.\n\nLes décisions sont prises.')
    const texte = await section(doc.record)
    expect(texte).toMatchObject({ title: 'Texte extrait', subtitle: `Lu — ${doc.characters} caractères`, icon: 'file', collapsed: true })
    expect(texte!.blocks[0]).toMatchObject({ kind: 'message', tone: 'info', text: `Document lu : ${doc.characters} caractères de texte extrait.` })
    expect(texte!.blocks[0]!.kind === 'message' && texte!.blocks[0]!.actions!.map((action) => action.label)).toEqual(['Extraire de nouveau', 'Ouvrir sa note'])
    // Mis en forme : du Markdown (ses titres, ses listes, ses tableaux).
    expect(texte!.blocks[1]).toMatchObject({ kind: 'markdown', text: 'Compte rendu de réunion.\n\nLes décisions sont prises.' })
    // En entier, aussi long soit-il.
    const long = Array.from({ length: 3000 }, (_, at) => `Paragraphe ${at + 1} du document.`).join('\n\n')
    const big = await pour('Long.md', long)
    const shown = (await section(big.record))!.blocks[1]
    expect(shown?.kind === 'markdown' && shown.text.length).toBe(long.length)
    expect(shown?.kind === 'markdown' && shown.text.endsWith('Paragraphe 3000 du document.')).toBe(true)
    const titled = await pour('Plan.md', '# Plan qualité\n\n- un\n- deux')
    expect((await section(titled.record))!.blocks[1]).toMatchObject({ kind: 'markdown', text: '### Plan qualité\n\n- un\n- deux' })
  })

  it('« Extraire de nouveau » : relu, réécrit entre ses marques ; les notes de l’utilisateur ne bougent pas', async () => {
    const platform = memoryPlatform()
    const { pour, section } = await start(platform)
    const doc = await pour('Note.md', 'Première version.')
    // L'utilisateur écrit ses notes ; le fichier change.
    await platform.fs.writeText(doc.record, read(platform, doc.record).replace('## Notes\n', '## Notes\n\nÀ relire avec le client.\n'))
    await platform.fs.writeText(doc.file, 'Seconde version, plus longue.')
    const texte = await section(doc.record)
    await (texte!.blocks[0]!.kind === 'message' ? texte!.blocks[0]!.actions![0]!.run() : null)
    const note = read(platform, doc.record)
    expect(note).toContain('À relire avec le client.')
    const block = note.slice(note.indexOf(START), note.indexOf(END))
    expect(block).toContain('Seconde version, plus longue.')
    expect(block).not.toContain('Première version.')
    expect(note.split(START)).toHaveLength(2)
    expect(platform.notices.at(-1)).toBe('« Note » : Lu — 29 caractères de texte extrait.')
  })

  it('un document versé avant : « Pas encore extrait », et « Extraire le texte »', async () => {
    const platform = memoryPlatform()
    const { pour, section } = await start(platform)
    const doc = await pour('Ancien.md', 'Un vieux document.')
    // Comme avant cette version : ni marques ni lecture.
    const note = read(platform, doc.record)
    await platform.fs.writeText(doc.record, note.slice(0, note.indexOf(START)).replace(/lecture: lue\ncaracteres: \d+\n/, ''))
    const texte = await section(doc.record)
    expect(texte).toMatchObject({ subtitle: 'Pas encore extrait' })
    expect(texte!.blocks[0]!.kind === 'message' && texte!.blocks[0]!.actions![0]).toMatchObject({ label: 'Extraire le texte', primary: true })
    await (texte!.blocks[0]!.kind === 'message' ? texte!.blocks[0]!.actions![0]!.run() : null)
    expect(read(platform, doc.record)).toContain('Un vieux document.')
    expect((await section(doc.record))?.subtitle).toMatch(/^Lu — \d+ caractères$/)
  })
})
