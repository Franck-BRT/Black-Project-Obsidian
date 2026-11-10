// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Modifier un champ de la fiche d'un document, seul : dans la section *Identification*,
 * chaque champ a un bouton (à gauche de son icône) qui ouvre une petite fenêtre. Enregistré,
 * le champ est confirmé — plus « à confirmer », plus « identifié par l'IA ». Le lieu ouvre
 * *Déplacer…*, la langue *Langue…*, ce qui reste à confirmer de la référence *Classer…*.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem } from '../src/core/views'
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

const ALL = [lectureFichiersModule, bibliothequeModule]
const bytes = (text: string) => new TextEncoder().encode(text)
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const NOTE = 'Note sur la station sol\nLa réunion du 12/02/2026 a fixé la suite.'

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {}
  const views = new ViewsRegistry()
  for (const module of ALL) {
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
  const doc = (await pourIntoLibrary([{ name: 'Note.txt', bytes: bytes(NOTE) }], { module: 'bibliotheque', label: '' }))!.added[0]!
  /** Les champs de la section Identification de sa fiche, telle qu'elle est maintenant. */
  const fields = async (): Promise<ListItem[]> => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const identity = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.identite')
    const list = identity?.blocks[0]
    return list?.kind === 'list' ? list.items : []
  }
  const edit = async (id: string, value: string) => {
    platform.forms.push({ value })
    await (await fields()).find((item) => item.id === id)!.tools![0]!.run()
  }
  return { doc, fields, edit }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('modifier un champ de la fiche', () => {
  it('chaque champ a son bouton « Modifier : … », puis « Relancer la recherche… » (sauf le lieu)', async () => {
    const { fields } = await start(memoryPlatform())
    const items = await fields()
    const R = 'Relancer la recherche dans le document : '
    expect(items.map((item) => [item.id, ...(item.tools ?? []).map((tool) => `${tool.icon}:${tool.label}`)])).toEqual([
      ['title', 'edit:Modifier : Titre', `refresh:${R}Titre`],
      ['place', 'edit:Modifier : Rangé'],
      ['language', 'edit:Modifier : Langue', `refresh:${R}Langue`],
      ['reference', 'edit:Modifier : Référence', `refresh:${R}Référence`],
      ['edition', 'edit:Modifier : Édition', `refresh:${R}Édition`],
      ['revision', 'edit:Modifier : Révision', `refresh:${R}Révision`],
      ['date', 'edit:Modifier : Date du document', `refresh:${R}Date du document`],
      ['identity', 'edit:Modifier : Référence et version', `refresh:${R}Référence et version`],
      ['category', 'edit:Modifier : Type de pièce', `refresh:${R}Type de pièce`],
      ['issuer', 'edit:Modifier : Entreprise', `refresh:${R}Entreprise`],
      ['tags', 'edit:Modifier : Étiquettes', `refresh:${R}Étiquettes`]
    ])
  })

  it('une petite fenêtre, un seul champ, sa valeur ; enregistré : confirmé, et c’est dit', async () => {
    const platform = memoryPlatform()
    const { doc, fields, edit } = await start(platform)
    expect(read(platform, doc.record)).toMatch(/\ntitreAConfirmer: true\n/)
    await edit('title', 'Compte rendu de la réunion de suivi')
    const form = platform.asked.at(-1)!
    expect(form.title).toBe('Titre — « Note »')
    expect(form.fields).toMatchObject([{ key: 'value', label: 'Titre', value: 'Note', required: true }])
    expect(form.submit).toBe('Enregistrer')
    expect(read(platform, doc.record)).toMatch(/\ntitre: Compte rendu de la réunion de suivi\n/)
    expect(read(platform, doc.record)).not.toMatch(/titreAConfirmer/)
    expect(platform.notices.at(-1)).toBe('Titre : Compte rendu de la réunion de suivi.')
    expect((await fields()).find((item) => item.id === 'title')?.detail).toBe('Compte rendu de la réunion de suivi')
    // Un titre vide n'est pas enregistré.
    await edit('title', '  ')
    expect(read(platform, doc.record)).toMatch(/\ntitre: Compte rendu de la réunion de suivi\n/)
  })

  it('la référence, l’édition, la révision : chacune seule ; la référence est alors confirmée', async () => {
    const platform = memoryPlatform()
    const { doc, edit } = await start(platform)
    await edit('reference', 'CR-2026-07')
    await edit('edition', '2')
    expect(read(platform, doc.record)).toMatch(/\nreference: CR-2026-07\nedition: "2"\n/)
    expect(read(platform, doc.record)).not.toMatch(/identiteAConfirmer/)
    await edit('edition', '')
    expect(platform.notices.at(-1)).toBe('Édition : vide.')
  })

  it('la date : écrite comme on veut, dite en mots ; illisible, refusée', async () => {
    const platform = memoryPlatform()
    const { doc, fields, edit } = await start(platform)
    await edit('date', '3 mars 2026')
    expect(read(platform, doc.record)).toMatch(/\ndateDocument: "2026-03-03"\n/)
    expect(read(platform, doc.record)).not.toMatch(/dateAConfirmer/)
    expect(platform.notices.at(-1)).toBe('Date du document : 3 mars 2026.')
    expect(platform.asked.at(-1)!.fields[0]).toMatchObject({ value: '', description: expect.stringContaining('12/03/2026') })
    await edit('date', 'bientôt')
    expect(platform.notices.at(-1)).toBe('La date « bientôt » n’a pas pu être lue : celle d’avant reste.')
    expect((await fields()).find((item) => item.id === 'date')?.detail).toBe('3 mars 2026')
  })

  it('la catégorie, l’émetteur, les étiquettes (à cocher ; d’autres, écrites, sans doublon)', async () => {
    const platform = memoryPlatform()
    const { doc, fields, edit } = await start(platform)
    await edit('category', 'Compte rendu')
    await edit('issuer', 'Agence spatiale')
    const tagsTool = async () => (await fields()).find((item) => item.id === 'tags')!.tools![0]!.run()
    platform.manyAnswers.push(null)
    await tagsTool()
    const other = platform.manyAsked.at(-1)!.choices.at(-1)!
    expect(other.label).toBe('＋ Autre(s) étiquette(s)…')
    platform.manyAnswers.push([other.value])
    platform.forms.push({ value: 'réunion, station sol, réunion', list: 'false' })
    await tagsTool()
    const note = read(platform, doc.record)
    expect(note).toMatch(/\ncategorie: Compte rendu\n/)
    expect(note).toMatch(/\nemetteur: Agence spatiale\n/)
    expect(note).not.toMatch(/categorieAConfirmer|emetteurAConfirmer|etiquettesAConfirmer/)
    expect((await fields()).find((item) => item.id === 'tags')?.detail).toBe('réunion, station sol — hors de la liste des étiquettes')
    expect(platform.notices.at(-1)).toBe('Étiquettes : réunion, station sol.')
  })

  it('fermer la fenêtre : rien ne change', async () => {
    const platform = memoryPlatform()
    const { doc, fields } = await start(platform)
    const before = read(platform, doc.record)
    platform.forms.push(null)
    await (await fields()).find((item) => item.id === 'issuer')!.tools![0]!.run()
    expect(read(platform, doc.record)).toBe(before)
  })
})
