// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { documentationPages, fillTemplate, isGeneratedDoc, writeDocumentation } from './docs'
import { memoryPlatform } from './testing/memoryPlatform'

describe('gabarits', () => {
  it('remplace les variables et fait des liens qui suivent le dossier choisi', () => {
    expect(fillTemplate('Version {{version}}, {{inconnu}} — {{link:Modules/Lecture de fichiers|la lecture}}', 'Doc BP', { version: '1.0' })).toBe(
      'Version 1.0, {{inconnu}} — [[Doc BP/Modules/Lecture de fichiers|la lecture]]'
    )
  })
})

describe('pages de la documentation', () => {
  const pages = documentationPages({
    version: '0.2.6',
    folder: 'BP/Doc',
    modules: [
      { name: 'Lecture de fichiers', version: '0.2.0', state: 'Actif', pages: [{ path: 'Modules/Lecture de fichiers.md', content: '# Lecture' }] },
      { name: 'Sans page', version: '1.0.0', state: 'Désactivé', pages: [] }
    ]
  })

  it('commence par l’accueil et la prise en main, puis les pages des modules', () => {
    expect(pages.map((page) => page.path)).toEqual(['Accueil.md', 'Prise en main.md', 'Modules/Lecture de fichiers.md'])
  })

  it('marque chaque page comme créée par le plugin, avec sa version', () => {
    for (const page of pages) {
      expect(isGeneratedDoc(page.content)).toBe(true)
      expect(page.content).toContain('bp-version: "0.2.6"')
    }
  })

  it('liste les modules sur l’accueil, avec un lien vers leur page', () => {
    const home = pages[0]?.content ?? ''
    expect(home).toContain('| [[BP/Doc/Modules/Lecture de fichiers\\|Lecture de fichiers]] | 0.2.0 | Actif |')
    expect(home).toContain('| Sans page | 1.0.0 | Désactivé |')
    expect(home).toContain('[[BP/Doc/Prise en main|Prise en main]]')
    expect(home).not.toMatch(/\{\{/)
  })
})

describe('écriture dans le coffre', () => {
  const page = (content: string) => ({ path: 'Accueil.md', content: `---\nbp-doc: true\n---\n${content}` })

  it('crée, laisse ce qui n’a pas changé, met à jour ce qui a changé', async () => {
    const platform = memoryPlatform()
    expect((await writeDocumentation(platform.fs, 'Doc', [page('v1')])).created).toEqual(['Doc/Accueil.md'])
    expect((await writeDocumentation(platform.fs, 'Doc', [page('v1')])).unchanged).toEqual(['Doc/Accueil.md'])
    expect((await writeDocumentation(platform.fs, 'Doc', [page('v2')])).updated).toEqual(['Doc/Accueil.md'])
    expect(await platform.fs.readText('Doc/Accueil.md')).toContain('v2')
  })

  it('n’écrase jamais une note de l’utilisateur au même endroit', async () => {
    const platform = memoryPlatform({ 'Doc/Accueil.md': '# Mes notes\n\nÀ garder.' })
    const report = await writeDocumentation(platform.fs, 'Doc', [page('v1')])
    expect(report.kept).toEqual(['Doc/Accueil.md'])
    expect(await platform.fs.readText('Doc/Accueil.md')).toBe('# Mes notes\n\nÀ garder.')
  })

  it('ne prend pour sienne qu’une page dont l’en-tête porte la marque', () => {
    expect(isGeneratedDoc('---\nbp-doc: true\n---\n# x')).toBe(true)
    expect(isGeneratedDoc('# x\n\nbp-doc: true')).toBe(false)
    expect(isGeneratedDoc('---\ntitle: x\n---\n')).toBe(false)
  })
})
