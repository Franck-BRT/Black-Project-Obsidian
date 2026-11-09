// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **langue** d'un document de la bibliothèque : détectée à son entrée, d'après son texte
 * (lu par la lecture de fichiers). Sûre, elle est donnée ; pas assez sûre (texte court,
 * partagé, illisible), il n'y en a pas et elle est **à confirmer** par l'utilisateur — la
 * plus probable proposée quand il y en a une. Une image n'a rien à confirmer.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { BlackModule, ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type PageView } from '../src/core/views'
import { bibliothequeModule, detectLanguage, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

/** La liste d'une section repliable de la fiche, par son intitulé. */
const sectionList = (blocks: readonly HomeBlock[], title: string | ((title: string) => boolean)): HomeBlock | undefined => {
  const section = blocks.find((block) => block.kind === 'section' && (typeof title === 'string' ? block.title === title : title(block.title)))
  return section?.kind === 'section' ? section.blocks.find((block) => block.kind === 'list') : undefined
}

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule]
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const cardsIn = (blocks: readonly HomeBlock[]): Card[] => blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : block.kind === 'section' ? cardsIn(block.blocks) : []))
const fiche = (page: (id: string) => { load(param?: string): Promise<PageView> }, record: string) => page('bibliotheque.document').load(encodeURIComponent(record))

const FRENCH =
  'Le présent cahier des charges définit les exigences techniques de la station sol. Les offres sont remises dans le délai fixé par le règlement de la consultation, et le titulaire doit fournir les pièces demandées pour chaque lot. Les prix sont fermes et la durée du marché est de quatre ans avec une reconduction.'
const ENGLISH =
  'The contractor shall deliver the ground station and the documents listed in this statement of work. It is the responsibility of the supplier to ensure that all equipment is tested by an approved laboratory, and the results are to be sent to the customer within ten days from the date of the test.'

async function start(platform: MemoryPlatform, modules: readonly BlackModule[] = ALL, workflows?: Workflow[]) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = workflows ? { workflows: { workflows } } : {}
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
  const pour = async (name: string, text: string) => (await pourIntoLibrary([{ name, bytes: bytes(text) }], { module: 'bibliotheque', label: '' }))!.added[0]!
  return { settings, page, pour }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('détecter la langue d’un texte', () => {
  it('assez de petits mots d’une langue, et nettement plus que la suivante : la langue', () => {
    expect(detectLanguage(FRENCH)).toEqual({ language: 'fr', probable: '' })
    expect(detectLanguage(ENGLISH)).toEqual({ language: 'en', probable: '' })
    expect(detectLanguage('Der Auftragnehmer liefert die Bodenstation und die Unterlagen, die in der Leistungsbeschreibung aufgeführt sind, und er ist für die Prüfung mit dem Labor zuständig, das von dem Kunden auch zugelassen wird oder werden soll.')).toEqual({ language: 'de', probable: '' })
  })

  it('trop court : pas de langue — la plus probable, s’il y en a une', () => {
    expect(detectLanguage('Le rapport est dans le dossier.')).toEqual({ language: '', probable: 'fr' })
    expect(detectLanguage('CCTP-2026-118 — Station sol')).toEqual({ language: '', probable: '' })
    expect(detectLanguage('')).toEqual({ language: '', probable: '' })
  })

  it('partagé entre deux langues : pas tranché', () => {
    expect(detectLanguage(`${FRENCH} ${ENGLISH}`).language).toBe('')
  })
})

describe('la langue des documents de la bibliothèque', () => {
  it('détectée sûrement à l’entrée : dans sa fiche, un badge, un filtre, un regroupement', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform)
    const doc = await pour('Cahier des charges.txt', FRENCH)
    expect(doc).toMatchObject({ language: 'fr' })
    expect(doc.languageToConfirm).toBeUndefined()
    expect(read(platform, doc.record)).toMatch(/\nlangue: fr\n/)
    await pour('Statement of work.txt', ENGLISH)
    const view = await page('bibliotheque.documents').load()
    expect(cardsIn(view.blocks).find((card) => card.title === 'Cahier des charges')?.badges?.map((badge) => badge.label)).toContain('Français')
    expect(view.filters?.map((filter) => filter.id)).toEqual(expect.arrayContaining(['langue-fr', 'langue-en']))
    await view.grouping!.options.find((option) => option.id === 'langue')!.run()
    const grouped = await page('bibliotheque.documents').load()
    expect(grouped.blocks.flatMap((block) => (block.kind === 'section' ? [block.title] : []))).toEqual(['Français', 'Anglais'])
    await grouped.grouping!.options.find((option) => option.id === 'origine')!.run()
    const identity = sectionList((await fiche(page, doc.record)).blocks, 'Identification')
    expect(identity?.kind === 'list' && identity.items.find((item) => item.id === 'language')?.detail).toBe('Français')
  })

  it('pas assez sûre : pas de langue, « à confirmer » — la probable confirmée d’un clic', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform)
    const doc = await pour('Note.txt', 'Le rapport est dans le dossier.')
    expect(doc).toMatchObject({ languageToConfirm: true, languageProbable: 'fr' })
    expect(doc.language).toBeUndefined()
    expect(read(platform, doc.record)).toMatch(/\nlangueAConfirmer: true\nlangueProbable: fr\n/)
    const view = await fiche(page, doc.record)
    const message = view.blocks.find((block) => block.kind === 'message' && block.text.startsWith('Langue à confirmer'))
    expect(message).toMatchObject({ tone: 'warning', text: 'Langue à confirmer : la détection n’a pas été assez sûre. Peut-être : Français.' })
    await (message?.kind === 'message' ? message.actions!.find((action) => action.id === 'confirm-language')!.run() : null)
    expect(platform.notices.at(-1)).toBe('« Note » : Français.')
    expect(read(platform, doc.record)).toMatch(/\nlangue: fr\n/)
    expect(read(platform, doc.record)).not.toMatch(/langueAConfirmer/)
    expect((await fiche(page, doc.record)).blocks.some((block) => block.kind === 'message' && block.text.startsWith('Langue à confirmer'))).toBe(false)
  })

  it('un fichier dont le texte n’est pas lu : à confirmer, sans langue probable ; « Langue… » la donne, ou la détecte de nouveau', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform)
    const doc = await pour('Maquette.dwg', 'binaire')
    expect(doc).toMatchObject({ languageToConfirm: true })
    expect(doc.languageProbable).toBeUndefined()
    const view = await fiche(page, doc.record)
    expect(view.blocks.find((block) => block.kind === 'message' && block.text.startsWith('Langue à confirmer'))).toMatchObject({
      text: 'Langue à confirmer : la détection n’a pas pu trancher (texte trop court, illisible, ou partagé entre plusieurs langues).'
    })
    platform.choices.push('en')
    await view.actions!.find((action) => action.id === 'language')!.run()
    expect(platform.offered.at(-1)!.map((choice) => choice.label)).toEqual(['Français', 'Anglais', 'Allemand', 'Espagnol', 'Italien', 'Portugais', 'Néerlandais', 'Détecter de nouveau', 'Sans langue'])
    expect(read(platform, doc.record)).toMatch(/\nlangue: en\n/)
    // Sans langue : plus rien à confirmer.
    platform.choices.push('aucune')
    await (await fiche(page, doc.record)).actions!.find((action) => action.id === 'language')!.run()
    expect(read(platform, doc.record)).not.toMatch(/langue/)
    // Détecter de nouveau : toujours rien de sûr, à confirmer de nouveau.
    platform.choices.push('detecter')
    await (await fiche(page, doc.record)).actions!.find((action) => action.id === 'language')!.run()
    expect(platform.notices.at(-1)).toBe('« Maquette » : la langue n’a pas pu être détectée sûrement ; elle reste à confirmer.')
    expect(read(platform, doc.record)).toMatch(/\nlangueAConfirmer: true\n/)
  })

  it('« Classer… » : la langue choisie est confirmée', async () => {
    const platform = memoryPlatform()
    const { page, pour } = await start(platform)
    const doc = await pour('Note.txt', 'Le rapport est dans le dossier.')
    platform.forms.push({ title: 'Note', category: '', reference: '', edition: '', revision: '', issuer: '', tags: '', language: 'it' })
    await (await fiche(page, doc.record)).actions!.find((action) => action.id === 'classify')!.run()
    const field = platform.asked.at(-1)!.fields.find((each) => each.key === 'language')
    expect(field).toMatchObject({ kind: 'choice', label: 'Langue', value: '', description: 'La détection n’a pas été assez sûre : choisissez-la pour la confirmer.' })
    expect(read(platform, doc.record)).toMatch(/\nlangue: it\n/)
    expect(read(platform, doc.record)).not.toMatch(/langueAConfirmer/)
  })

  it('une image : pas de langue, rien à confirmer ; sans la lecture de fichiers, tout est à confirmer', async () => {
    const platform = memoryPlatform()
    const { pour } = await start(platform)
    const image = await pour('Plan.png', 'png')
    expect(image.language).toBeUndefined()
    expect(image.languageToConfirm).toBeUndefined()
    await bibliothequeModule.deactivate?.()
    await lectureFichiersModule.deactivate?.()
    await workflowsModule.deactivate?.()
    const again = await start(memoryPlatform(), [bibliothequeModule])
    expect(await again.pour('Cahier des charges.txt', FRENCH)).toMatchObject({ languageToConfirm: true })
  })

  it('les workflows : {langue} et {langueaconfirmer} au document versé ; « Langues à confirmer, chaque lundi » (désactivé)', async () => {
    const platform = memoryPlatform()
    const workflow: Workflow = {
      id: 'wf-langue',
      name: 'Langue',
      enabled: true,
      mode: 'auto',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [],
      actions: [{ kind: 'notifier', fields: { message: '{titre} : {langue} — à confirmer : {langueaconfirmer}' } }],
      created: '2026-11-01T00:00:00'
    }
    const { settings, pour } = await start(platform, ALL, [workflow])
    await pour('Cahier des charges.txt', FRENCH)
    await pour('Note.txt', 'Bonjour')
    expect(platform.notices).toEqual(expect.arrayContaining(['Cahier des charges : Français — à confirmer : non', 'Note :  — à confirmer : oui']))
    const system = ((settings.workflows?.workflows ?? []) as Workflow[]).find((each) => each.system === 'sys.bibliotheque.langues-a-confirmer')
    expect(system).toMatchObject({ enabled: false, name: 'Langues à confirmer, chaque lundi', trigger: { kind: 'planifie', every: 'week', weekday: 1, time: '08:00' } })
  })
})
