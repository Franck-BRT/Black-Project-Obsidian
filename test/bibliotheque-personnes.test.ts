// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le **répertoire des personnes** — une bibliothèque de la Bibliothèque (Personnes), une note
 * par personne : son nom, son entreprise (choisie dans la liste des entreprises, ou ajoutée de
 * là), sa fonction, son adresse électronique, son téléphone, une catégorie, des notes. La
 * fiche d'une personne mène à son entreprise ; celle d'une entreprise montre ses personnes.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type Card, type HomeBlock, type ListItem } from '../src/core/views'
import { bibliothequeModule } from '../src/modules/bibliotheque'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'

const MODULES = [lectureFichiersModule, bibliothequeModule]
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const NEW_COMPANY = '\u0000nouvel-emetteur'

async function start(platform: MemoryPlatform) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const settings: Record<string, Record<string, unknown>> = {}
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
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const load = async (full: string) => {
    const at = full.indexOf('?')
    return at < 0 ? page(full).load() : page(full.slice(0, at)).load(full.slice(at + 1))
  }
  const cardsIn = (blocks: readonly HomeBlock[]): Card[] => blocks.flatMap((block) => (block.kind === 'cards' ? block.cards : block.kind === 'section' ? cardsIn(block.blocks) : []))
  const listsIn = (blocks: readonly HomeBlock[]): Extract<HomeBlock, { kind: 'list' }>[] => blocks.flatMap((block) => (block.kind === 'list' ? [block] : block.kind === 'section' ? listsIn(block.blocks) : []))
  const addCompany = (code: string, name: string) => platform.fs.writeText(`Bibliothèque/Émetteurs/${name}.md`, `---\nbp-type: bibliotheque-emetteur\nnom: ${name}\ncode: ${code}\n---\n\n`)
  return { page, load, shown, cardsIn, listsIn, addCompany }
}

afterEach(async () => {
  for (const module of [...MODULES].reverse()) await module.deactivate?.()
})

describe('le répertoire des personnes', () => {
  it('une bibliothèque de plus : l’accueil y mène ; une personne — son entreprise dans la liste, sa fonction, ses coordonnées ; une note par personne', async () => {
    const platform = memoryPlatform()
    const { page, load, shown, cardsIn, listsIn, addCompany } = await start(platform)
    await addCompany('ESA', 'Agence spatiale européenne')
    const hub = await page('bibliotheque.accueil').load()
    expect(cardsIn(hub.blocks).find((card) => card.title === 'Personnes')).toMatchObject({ subtitle: '0 personne(s)', icon: 'user' })
    const persons = await page('bibliotheque.persons').load()
    expect(persons.title).toBe('Personnes')
    expect(persons.actions?.map((action) => action.id)).not.toContain('starters')
    platform.forms.push({ name: 'Marie Dupont', company: 'ESA', description: 'Responsable qualité', email: 'marie.dupont@esa.int', phone: '+33 1 23 45 67 89', category: 'Client', text: 'Préfère les échanges par courriel.', favorite: 'true' })
    await persons.actions!.find((action) => action.id === 'new')!.run()
    const form = platform.asked.at(-1)!
    expect(form.fields.map((field) => [field.key, field.label])).toEqual([
      ['name', 'Nom et prénom'],
      ['company', 'Entreprise'],
      ['description', 'Fonction'],
      ['email', 'Adresse électronique'],
      ['phone', 'Téléphone'],
      ['category', 'Catégorie'],
      ['text', 'Notes'],
      ['favorite', 'Favori']
    ])
    const company = form.fields.find((field) => field.key === 'company')!
    expect(company.kind === 'choice' && company.options.map((option) => option.label)).toEqual(['— Aucune —', 'ESA — Agence spatiale européenne', '＋ Ajouter une entreprise à la liste…'])
    const note = read(platform, 'Bibliothèque/Personnes/Marie Dupont.md')
    expect(note).toBe('---\nbp-type: bibliotheque-personne\nnom: Marie Dupont\nentreprise: ESA\nemail: "marie.dupont@esa.int"\ntelephone: "+33 1 23 45 67 89"\ncategorie: Client\ndescription: Responsable qualité\nfavori: true\n---\n\nPréfère les échanges par courriel.\n')
    expect(platform.notices.at(-1)).toBe('Personne « Marie Dupont » ajoutée.')
    // La liste : une carte — sa fonction et son entreprise, ses coordonnées.
    const card = cardsIn((await page('bibliotheque.persons').load()).blocks)[0]!
    expect(card).toMatchObject({ title: 'Marie Dupont', subtitle: 'Responsable qualité · ESA — Agence spatiale européenne', icon: 'user', text: 'marie.dupont@esa.int · +33 1 23 45 67 89 · Préfère les échanges par courriel.' })
    // Sa fiche : ses coordonnées ; un clic sur son entreprise l'ouvre.
    card.open!.run()
    const fiche = await load(shown.at(-1)!)
    expect(fiche.subtitle).toBe('Personne · Responsable qualité · ESA — Agence spatiale européenne · Client · Favori')
    const contact = listsIn(fiche.blocks).find((list) => list.title === 'Coordonnées')!
    expect(contact.items.map((item: ListItem) => [item.title, item.detail])).toEqual([
      ['Entreprise', 'ESA — Agence spatiale européenne'],
      ['Fonction', 'Responsable qualité'],
      ['Adresse électronique', 'marie.dupont@esa.int'],
      ['Téléphone', '+33 1 23 45 67 89']
    ])
    contact.items[0]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.issuer?${encodeURIComponent('Bibliothèque/Émetteurs/Agence spatiale européenne.md')}`)
    // La fiche de l'entreprise : ses personnes ; un clic mène à la personne.
    const esa = await load(shown.at(-1)!)
    const people = listsIn(esa.blocks).find((list) => list.title === 'Ses personnes (1)')!
    expect(people.items.map((item) => [item.title, item.detail])).toEqual([['Marie Dupont', 'Responsable qualité · marie.dupont@esa.int · +33 1 23 45 67 89']])
    people.items[0]!.open!.run()
    expect(shown.at(-1)).toBe(`bibliotheque.person?${encodeURIComponent('Bibliothèque/Personnes/Marie Dupont.md')}`)
    // Une autre entreprise de la liste : personne.
    await addCompany('DGA', 'Direction générale de l’armement')
    const dga = await page('bibliotheque.issuer').load(encodeURIComponent('Bibliothèque/Émetteurs/Direction générale de l’armement.md'))
    expect(listsIn(dga.blocks).find((list) => list.title === 'Ses personnes (0)')).toMatchObject({ items: [], empty: 'Aucune personne de cette entreprise dans le répertoire.' })
  })

  it('son entreprise ajoutée depuis sa fenêtre ; une entreprise écrite hors de la liste, gardée et dite ; une adresse qui n’en est pas une, refusée', async () => {
    const platform = memoryPlatform()
    const { page, listsIn } = await start(platform)
    platform.forms.push({ name: 'Paul Martin', company: NEW_COMPANY, description: 'Acheteur', email: '', phone: '', category: '', text: '', favorite: 'false' })
    platform.forms.push({ code: 'TAS', name: 'Thales Alenia Space', category: '', description: '', text: '', favorite: 'false' })
    await (await page('bibliotheque.persons').load()).actions!.find((action) => action.id === 'new')!.run()
    expect(read(platform, 'Bibliothèque/Émetteurs/Thales Alenia Space.md')).toMatch(/\ncode: TAS\n/)
    expect(read(platform, 'Bibliothèque/Personnes/Paul Martin.md')).toMatch(/\nentreprise: TAS\n/)
    // Écrite à la main dans la note, une entreprise inconnue : gardée, dite hors de la liste.
    await platform.fs.writeText('Bibliothèque/Personnes/Léa Petit.md', '---\nbp-type: bibliotheque-personne\nnom: Léa Petit\nentreprise: Airbus\n---\n\n')
    const lea = await page('bibliotheque.person').load(encodeURIComponent('Bibliothèque/Personnes/Léa Petit.md'))
    const contact = listsIn(lea.blocks).find((list) => list.title === 'Coordonnées')!
    expect(contact.items.map((item) => item.detail)).toEqual(['Airbus — hors de la liste des entreprises', '—', '—', '—'])
    expect(contact.items[0]!.open).toBeUndefined()
    // La recherche trouve une personne par son entreprise, sa fonction, son adresse.
    const persons = await page('bibliotheque.persons').load()
    expect(persons.search?.placeholder).toBe('Nom, entreprise, fonction, adresse, téléphone…')
    // Une adresse mal écrite : rien n'est enregistré, c'est dit.
    platform.forms.push({ name: 'Jean Faux', company: '', description: '', email: 'jean.faux', phone: '', category: '', text: '', favorite: 'false' })
    await persons.actions!.find((action) => action.id === 'new')!.run()
    expect(platform.files.has('Bibliothèque/Personnes/Jean Faux.md')).toBe(false)
    expect(platform.notices.at(-1)).toBe('« jean.faux » n’est pas une adresse électronique : rien n’a été enregistré.')
  })
})
