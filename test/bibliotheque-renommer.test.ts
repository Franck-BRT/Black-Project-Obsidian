// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Renommer le fichier** d'un document, depuis sa fiche (le bouton devant le champ
 * *Fichier*) : dans son dossier, son extension gardée ; les liens vers lui, dans tout le
 * coffre, suivent — sa fiche, la note d'une pièce d'analyse (`fichier: "[[…]]"`), les liens
 * `[[…|texte]]`, `![[…]]`, `[texte](…)`, et `[[nom]]` quand ce nom ne désignait que lui.
 * Un nom interdit, ou déjà pris : rien ne bouge, et c'est dit.
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
/** Une note, ses dossiers créés (comme le fait l'application). */
const write = (platform: MemoryPlatform, path: string, text: string) => platform.fs.writeText(path, text)

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
  const doc = (await pourIntoLibrary([{ name: 'Devis antenne.txt', bytes: bytes('Devis de l’antenne.') }], { module: 'bibliotheque', label: '' }))!.added[0]!
  /** La section « Le fichier » de sa fiche, telle qu'elle est maintenant. */
  const fileItems = async (): Promise<ListItem[]> => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const section = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.fichier')
    const list = section?.blocks[0]
    return list?.kind === 'list' ? list.items : []
  }
  const rename = async (name: string | null) => {
    platform.forms.push(name === null ? null : { name })
    await (await fileItems()).find((item) => item.id === 'file')!.tools![0]!.run()
  }
  return { doc, fileItems, rename }
}

afterEach(async () => {
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('renommer le fichier d’un document', () => {
  it('le bouton devant le champ Fichier ; une petite fenêtre : le nom sans l’extension', async () => {
    const platform = memoryPlatform()
    const { doc, fileItems, rename } = await start(platform)
    const file = (await fileItems()).find((item) => item.id === 'file')!
    expect(file.detail).toBe(doc.file)
    expect(file.tools?.map((tool) => [tool.id, tool.label, tool.icon])).toEqual([['rename-file', 'Renommer le fichier', 'edit']])
    await rename(null)
    const form = platform.asked.at(-1)!
    expect(form.title).toBe('Renommer « Devis antenne.txt »')
    expect(form.fields).toMatchObject([{ key: 'name', label: 'Nom du fichier', value: 'Devis antenne', required: true, description: expect.stringContaining('« .txt » est gardée') }])
    expect(form.submit).toBe('Renommer')
    expect(platform.files.has(doc.file)).toBe(true)
  })

  it('renommé dans son dossier ; sa fiche, et les liens du coffre, suivent', async () => {
    const platform = memoryPlatform()
    const { doc, fileItems, rename } = await start(platform)
    const folder = doc.file.slice(0, doc.file.lastIndexOf('/'))
    const target = `${folder}/Devis antenne v2.txt`
    // La note d'une pièce d'analyse, une autre note avec tous les liens, une sans.
    await write(platform, 'Appels d’offres/Station sol/Pièces/Devis.md', `---\nbp-type: ao-piece\nfichier: "[[${doc.file}]]"\n---\n> Fichier : [[${doc.file}|Devis antenne.txt]]\n`)
    await write(platform, 'Notes/Suivi.md', `Voir [[${doc.file}]], ![[${doc.file}]], [[${doc.file}#page=2]], [le devis](${encodeURI(doc.file)}) et [[Devis antenne.txt]].`)
    await write(platform, 'Notes/Autre.md', 'Rien à voir : [[Devis antenne v1.txt]].')
    await write(platform, '.obsidian/workspace.md', `[[${doc.file}]]`)
    await rename('Devis antenne v2')
    expect(platform.files.has(doc.file)).toBe(false)
    expect(platform.files.has(target)).toBe(true)
    expect(read(platform, doc.record)).toContain(`fichier: "[[${target}]]"`)
    expect(read(platform, 'Appels d’offres/Station sol/Pièces/Devis.md')).toBe(`---\nbp-type: ao-piece\nfichier: "[[${target}]]"\n---\n> Fichier : [[${target}|Devis antenne.txt]]\n`)
    expect(read(platform, 'Notes/Suivi.md')).toBe(`Voir [[${target}]], ![[${target}]], [[${target}#page=2]], [le devis](${encodeURI(target)}) et [[Devis antenne v2.txt]].`)
    expect(read(platform, 'Notes/Autre.md')).toBe('Rien à voir : [[Devis antenne v1.txt]].')
    // Les dossiers cachés (les réglages d'Obsidian) ne sont pas touchés.
    expect(read(platform, '.obsidian/workspace.md')).toBe(`[[${doc.file}]]`)
    expect(platform.notices.at(-1)).toBe('Fichier renommé : « Devis antenne v2.txt » ; les liens de 2 note(s) mis à jour.')
    expect((await fileItems()).find((item) => item.id === 'file')?.detail).toBe(target)
  })

  it('l’extension tapée n’est pas doublée ; le nom seul, porté par un autre fichier, n’est pas touché', async () => {
    const platform = memoryPlatform()
    const { doc, rename } = await start(platform)
    // Sans l'index du coffre : ses dossiers sont parcourus.
    delete (platform.fs as { allFiles?: unknown }).allFiles
    await write(platform, 'Ailleurs/Devis antenne.txt', 'un autre')
    await write(platform, 'Notes/Suivi.md', 'Le nôtre : [[' + doc.file + ']] ; l’autre : [[Devis antenne.txt]].')
    await rename('Devis final.txt')
    const target = `${doc.file.slice(0, doc.file.lastIndexOf('/'))}/Devis final.txt`
    expect(platform.files.has(target)).toBe(true)
    expect(read(platform, 'Notes/Suivi.md')).toBe(`Le nôtre : [[${target}]] ; l’autre : [[Devis antenne.txt]].`)
  })

  it('un nom interdit, ou déjà pris dans le dossier : rien ne bouge, et c’est dit', async () => {
    const platform = memoryPlatform()
    const { doc, rename } = await start(platform)
    for (const name of ['a/b', 'Devis : final', '.cache', '   ']) {
      await rename(name)
      expect(platform.notices.at(-1)).toMatch(/^Ce nom ne peut pas être celui d’un fichier/)
    }
    await write(platform, `${doc.file.slice(0, doc.file.lastIndexOf('/'))}/Autre.txt`, 'déjà là')
    await rename('Autre')
    expect(platform.notices.at(-1)).toBe('Un fichier « Autre.txt » est déjà dans ce dossier : rien n’a été renommé.')
    expect(platform.files.has(doc.file)).toBe(true)
    expect(read(platform, doc.record)).toContain(`fichier: "[[${doc.file}]]"`)
  })
})
