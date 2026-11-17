// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **La fiche d'une entreprise** : ses chiffres en tête ; l'entreprise en lignes (code, nom, rôle,
 * catégorie, autres noms, rangée) ; les documents qu'elle émet ; ceux qui la citent ; ses personnes.
 * Les rétroliens de sa note sont à part : ni des autres noms (ni pour l'IA), ni dans sa fenêtre, et
 * gardés quand on la modifie.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem, type PageView } from '../src/core/views'
import { bibliothequeModule, libraryEntries, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

const MODULES = [lectureFichiersModule, bibliothequeModule]
const enc = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const ESA = 'Bibliothèque/Entreprises/Agence spatiale européenne.md'

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
  return { load, shown }
}

const section = (view: PageView, id: string) => view.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === `bibliotheque.entreprise.${id}`)
const itemsOf = (block: Extract<HomeBlock, { kind: 'section' }> | undefined): ListItem[] => (block?.blocks ?? []).flatMap((each) => (each.kind === 'list' ? each.items : []))

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('la fiche d’une entreprise', () => {
  it('ses chiffres ; l’entreprise en lignes ; les documents qu’elle émet, ceux qui la citent ; ses personnes', async () => {
    const platform = memoryPlatform()
    // Une entreprise, ses autres noms, et des rétroliens dans sa note (que Black Projects y a écrits).
    await platform.fs.writeText(
      ESA,
      '---\nbp-type: bibliotheque-emetteur\nnom: Agence spatiale européenne\ncode: ESA\ndescription: Acheteur\ncategorie: Agences\n---\n\nEuropean Space Agency\n\n## Liens (Black Projects)\n\n- 2026-11-17 · [[Bibliothèque/Autre|Autre]] — Cité\n'
    )
    await platform.fs.writeText('Bibliothèque/Personnes/Marie Dupont.md', '---\nbp-type: bibliotheque-personne\nnom: Marie Dupont\nentreprise: ESA\ndescription: Responsable qualité\n---\n\n')
    const { load, shown } = await start(platform)
    const issued = (await pourIntoLibrary([{ name: 'Exigences.txt', bytes: enc('Émetteur : Agence spatiale européenne\nLes exigences de la mission.') }], { module: 'bibliotheque', label: '' }))!.added[0]!.record
    const other = (await pourIntoLibrary([{ name: 'Compte rendu.txt', bytes: enc('Réunion avec un partenaire.') }], { module: 'bibliotheque', label: '' }))!.added[0]!.record
    // Le second document cite l'entreprise (un lien que le circuit y aurait mis).
    await platform.fs.writeText(other, read(platform, other).replace(/\n---\n/, '\nliens:\n- "[[Bibliothèque/Entreprises/Agence spatiale européenne.md]]"\n---\n'))
    // Ses autres noms : sans les rétroliens.
    const esa = (await libraryEntries('issuer'))[0]!
    expect(esa.text).toBe('European Space Agency')
    const page = await load(`bibliotheque.issuer?${encodeURIComponent(ESA)}`)
    expect(page).toMatchObject({ title: 'ESA — Agence spatiale européenne', subtitle: 'Entreprise · Acheteur · Agences' })
    // Ses chiffres, en tête.
    expect(page.blocks[0]).toMatchObject({ kind: 'stats', stats: [{ label: 'Documents émis', value: '1' }, { label: 'Documents qui la citent', value: '1' }, { label: 'Personnes', value: '1' }] })
    // L'entreprise en lignes, chacune avec son bouton.
    const fields = itemsOf(section(page, 'entreprise'))
    expect(fields.map((item) => [item.title, item.detail])).toEqual([
      ['Code', 'ESA'],
      ['Nom', 'Agence spatiale européenne'],
      ['Rôle', 'Acheteur'],
      ['Catégorie', 'Agences'],
      ['Autres noms', 'European Space Agency'],
      ['Rangée', 'Entreprises']
    ])
    expect(fields.every((item) => item.tools?.length === 1)).toBe(true)
    // Les documents qu'elle émet ; ceux qui la citent ; un clic ouvre leur fiche.
    expect(section(page, 'emis')!.title).toBe('Documents qu’elle émet (1)')
    const emitted = itemsOf(section(page, 'emis'))
    expect(emitted.map((item) => item.title)).toEqual(['Exigences'])
    await emitted[0]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.document?${encodeURIComponent(issued)}`)
    expect(section(page, 'cites')).toMatchObject({ title: 'Documents qui la citent (1)', subtitle: 'Reliés à sa note par le circuit, sans être émis par elle' })
    expect(itemsOf(section(page, 'cites')).map((item) => item.title)).toEqual(['Compte rendu'])
    // Ses personnes.
    expect(section(page, 'personnes')).toMatchObject({ title: 'Ses personnes (1)', collapsed: false })
    expect(itemsOf(section(page, 'personnes')).map((item) => [item.title, item.detail])).toEqual([['Marie Dupont', 'Responsable qualité']])
    // La modifier : sa fenêtre ne montre pas les rétroliens ; ils sont gardés dans la note.
    platform.forms.push({ code: 'ESA', name: 'Agence spatiale européenne', description: 'Acheteur', category: 'Agences', text: 'European Space Agency\nAgence spatiale', favorite: 'false' })
    await page.actions!.find((action) => action.id === 'edit')!.run()
    expect(platform.asked.at(-1)!.fields.find((field) => field.key === 'text')).toMatchObject({ value: 'European Space Agency' })
    const note = read(platform, ESA)
    expect(note).toContain('European Space Agency\nAgence spatiale\n\n## Liens (Black Projects)\n\n- 2026-11-17 · [[Bibliothèque/Autre|Autre]] — Cité\n')
  })
})
