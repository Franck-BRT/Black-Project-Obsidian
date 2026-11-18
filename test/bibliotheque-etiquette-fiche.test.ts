// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **La fiche d'une étiquette** : ses chiffres ; l'étiquette en lignes ; les documents qui la portent ;
 * ceux où elle est suggérée (« Ajouter », les autres suggestions gardées à confirmer) ; les autres
 * étiquettes de sa catégorie. Et **« Nouvelle entreprise… »** à côté de la liste des entreprises.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem, type PageView } from '../src/core/views'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

const MODULES = [lectureFichiersModule, bibliothequeModule]
const enc = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const ANTENNE = 'Bibliothèque/Étiquettes/antenne.md'

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = { bibliotheque: { circuit: false, explorateur: false } }
  const views = new ViewsRegistry()
  const shown: string[] = []
  for (const module of MODULES) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: (id) => void shown.push(id)
    }
    await module.activate(context)
  }
  const load = (target: string): Promise<PageView> => {
    const [id, param] = target.split('?') as [string, string | undefined]
    return views.pages().find((each) => each.id === id)!.load(param)
  }
  const pour = async (name: string, text: string) => (await pourIntoLibrary([{ name, bytes: enc(text) }], { module: 'bibliotheque', label: '' }))!.added[0]!.record
  return { load, shown, pour }
}

const section = (view: PageView, id: string) => view.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === `bibliotheque.etiquette.${id}`)
const itemsOf = (block: Extract<HomeBlock, { kind: 'section' }> | undefined): ListItem[] => (block?.blocks ?? []).flatMap((each) => (each.kind === 'list' ? each.items : []))

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('la fiche d’une étiquette', () => {
  it('ses chiffres ; l’étiquette en lignes ; les documents qui la portent ; ceux où elle est suggérée (« Ajouter ») ; sa catégorie', async () => {
    const platform = memoryPlatform()
    await platform.fs.writeText(ANTENNE, '---\nbp-type: bibliotheque-etiquette\nnom: antenne\ncategorie: Matériel\ndescription: Les antennes de la station\n---\n\nantennes\n')
    await platform.fs.writeText('Bibliothèque/Étiquettes/station sol.md', '---\nbp-type: bibliotheque-etiquette\nnom: station sol\ncategorie: Matériel\n---\n\n')
    const { load, shown, pour } = await start(platform)
    const tagged = await pour('Plan.txt', 'Le plan.')
    const suggested = await pour('Recette.txt', 'La recette.')
    await platform.fs.writeText(tagged, read(platform, tagged).replace(/\netiquettes: \[\]\n/, '\netiquettes:\n- antenne\n').replace(/\netiquettesAConfirmer: true\n/, '\n'))
    await platform.fs.writeText(suggested, read(platform, suggested).replace(/\netiquettes: \[\]\n/, '\netiquettes: []\netiquettesAConfirmer: true\netiquettesProbables:\n- antennes\n- recette\n').replace(/\netiquettesAConfirmer: true\n(?=[\s\S]*etiquettesAConfirmer)/, '\n'))
    const page = async () => load(`bibliotheque.tag?${encodeURIComponent(ANTENNE)}`)
    let fiche = await page()
    expect(fiche).toMatchObject({ title: 'antenne', subtitle: 'Étiquette · Matériel' })
    expect(fiche.blocks[0]).toMatchObject({ kind: 'stats', stats: [{ label: 'Documents étiquetés', value: '1' }, { label: 'Suggérée sur', value: '1' }] })
    expect(itemsOf(section(fiche, 'etiquette')).map((item) => [item.title, item.detail])).toEqual([
      ['Étiquette', 'antenne'],
      ['Autres formes', 'antennes'],
      ['Catégorie', 'Matériel'],
      ['Description', 'Les antennes de la station'],
      ['Rangée', 'Étiquettes']
    ])
    expect(section(fiche, 'documents')!.title).toBe('Documents qui la portent (1)')
    expect(itemsOf(section(fiche, 'documents')).map((item) => item.title)).toEqual(['Plan'])
    // Suggérée (« antennes », une autre forme) : « Ajouter » la donne ; l'autre suggestion reste à confirmer.
    const row = itemsOf(section(fiche, 'suggeree'))[0]!
    expect(row).toMatchObject({ title: 'Recette', tone: 'warning' })
    await row.actions![0]!.run()
    expect(platform.notices.at(-1)).toBe('Étiquette « antenne » ajoutée à « Recette ».')
    const note = read(platform, suggested)
    expect(note).toMatch(/\netiquettes:\n- antenne\n/)
    expect(note).toMatch(/\netiquettesAConfirmer: true\n/)
    expect(note).toMatch(/\netiquettesProbables:\n- recette\n/)
    fiche = await page()
    expect(section(fiche, 'suggeree')).toBeUndefined()
    expect(itemsOf(section(fiche, 'documents')).map((item) => item.title)).toEqual(['Plan', 'Recette'])
    // Sa catégorie : les autres étiquettes ; un clic ouvre la leur.
    expect(section(fiche, 'voisines')!.title).toBe('Dans la même catégorie : Matériel (1)')
    await itemsOf(section(fiche, 'voisines'))[0]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.tag?${encodeURIComponent('Bibliothèque/Étiquettes/station sol.md')}`)
  })

  it('« Nouvelle entreprise… » à côté de la liste des entreprises : l’entreprise créée, puis choisie', async () => {
    const platform = memoryPlatform()
    const { load, pour } = await start(platform)
    const record = await pour('Note.txt', 'Une note.')
    const fiche = await load(`bibliotheque.document?${encodeURIComponent(record)}`)
    platform.forms.push(null)
    await fiche.actions!.find((action) => action.id === 'classify')!.run()
    const issuer = platform.asked.at(-1)!.fields.find((field) => field.key === 'issuer')!
    const create = issuer.kind === 'choice' ? issuer.create : undefined
    expect(create).toMatchObject({ label: 'Nouvelle entreprise…' })
    platform.forms.push({ code: 'ESA', name: 'Agence spatiale européenne', description: '', category: '', text: '', favorite: 'false' })
    expect(await create!.run()).toEqual({ value: 'ESA', label: 'ESA — Agence spatiale européenne' })
    expect(read(platform, 'Bibliothèque/Entreprises/Agence spatiale européenne.md')).toMatch(/\ncode: ESA\n/)
    expect(platform.notices.at(-1)).toBe('Entreprise « ESA — Agence spatiale européenne » créée.')
  })
})
