// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **La fiche d'une personne** : ses chiffres en tête ; la personne en lignes ; les documents qui la
 * citent — reliés, ou seulement nommés (« Relier », « Tout relier ») ; ses collègues ; ses notes.
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
const MARIE = 'Bibliothèque/Personnes/Marie Dupont.md'

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

const section = (view: PageView, id: string) => view.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === `bibliotheque.personne.${id}`)
const itemsOf = (block: Extract<HomeBlock, { kind: 'section' }> | undefined): ListItem[] => (block?.blocks ?? []).flatMap((each) => (each.kind === 'list' ? each.items : []))

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('la fiche d’une personne', () => {
  it('ses chiffres ; la personne en lignes ; les documents qui la nomment, à relier ; ses collègues ; ses notes', async () => {
    const platform = memoryPlatform()
    await platform.fs.writeText('Bibliothèque/Entreprises/Agence spatiale européenne.md', '---\nbp-type: bibliotheque-emetteur\nnom: Agence spatiale européenne\ncode: ESA\n---\n\n')
    await platform.fs.writeText(MARIE, '---\nbp-type: bibliotheque-personne\nnom: Marie Dupont\nentreprise: ESA\ndescription: Responsable qualité\nemail: "marie.dupont@esa.int"\n---\n\nPréfère les échanges par courriel.\n')
    await platform.fs.writeText('Bibliothèque/Personnes/Jean Martin.md', '---\nbp-type: bibliotheque-personne\nnom: Jean Martin\nentreprise: ESA\ndescription: Chef de projet\n---\n\n')
    const { load, shown } = await start(platform)
    const first = (await pourIntoLibrary([{ name: 'Compte rendu.txt', bytes: enc('Présents : Marie Dupont, Jean Martin.') }], { module: 'bibliotheque', label: '' }))!.added[0]!.record
    await pourIntoLibrary([{ name: 'Revue.txt', bytes: enc('Revue menée par Marie Dupont.') }], { module: 'bibliotheque', label: '' })
    const page = async () => load(`bibliotheque.person?${encodeURIComponent(MARIE)}`)
    let fiche = await page()
    expect(fiche).toMatchObject({ title: 'Marie Dupont', subtitle: 'Personne · Responsable qualité · ESA — Agence spatiale européenne' })
    // Ses chiffres.
    expect(fiche.blocks[0]).toMatchObject({ kind: 'stats', stats: [{ label: 'Documents qui la citent', value: '2' }, { label: 'Collègues', value: '1' }] })
    // La personne en lignes : un clic sur son entreprise l'ouvre.
    const rows = itemsOf(section(fiche, 'personne'))
    expect(rows.map((item) => item.title)).toEqual(['Nom et prénom', 'Fonction', 'Entreprise', 'Adresse électronique', 'Téléphone', 'Catégorie', 'Rangée'])
    await rows.find((item) => item.id === 'company')!.open!.run()
    expect(shown.at(-1)).toMatch(/^bibliotheque\.issuer\?/)
    // Les documents qui la nomment, sans lien : « Tout relier (2) », « Relier » sur chacun.
    let documents = section(fiche, 'documents')!
    expect(documents).toMatchObject({ title: 'Documents qui la citent (2)', subtitle: '2 cité(s) sans lien' })
    expect(documents.blocks[0]).toMatchObject({ kind: 'message', text: '2 document(s) la nomment sans y être reliés.', actions: [{ id: 'relier-tous', label: 'Tout relier (2)' }] })
    const compteRendu = itemsOf(documents).find((item) => item.title === 'Compte rendu')!
    expect(compteRendu.detail).toMatch(/Documents · Nommée \(« Marie Dupont »\), pas encore reliée$/)
    await compteRendu.actions![0]!.run()
    // Relié : le lien dans la fiche du document, le rétrolien dans sa note.
    expect(read(platform, first)).toContain('[[Bibliothèque/Personnes/Marie Dupont|Marie Dupont]] — Cite Marie Dupont')
    expect(read(platform, MARIE)).toContain('[[Bibliothèque/Compte rendu|Compte rendu]]')
    fiche = await page()
    documents = section(fiche, 'documents')!
    expect(documents.subtitle).toBe('1 relié(s) · 1 cité(s) sans lien')
    expect(itemsOf(documents).map((item) => [item.title, item.tone])).toEqual([
      ['Compte rendu', 'success'],
      ['Revue', 'neutral']
    ])
    // Ses collègues ; un clic ouvre leur fiche.
    expect(section(fiche, 'collegues')!.title).toBe('Ses collègues — ESA (1)')
    await itemsOf(section(fiche, 'collegues'))[0]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.person?${encodeURIComponent('Bibliothèque/Personnes/Jean Martin.md')}`)
    // Ses notes : son texte, sans les rétroliens.
    const notes = section(fiche, 'notes')!
    expect(notes.blocks[0]).toMatchObject({ kind: 'markdown', text: 'Préfère les échanges par courriel.' })
  })
})
