// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** La documentation complète, telle que la commande l'écrit, avec les vrais modules. */

import { describe, expect, it } from 'vitest'
import { docModules, documentationPages, writeDocumentation } from '../core/docs'
import { createI18n } from '../core/i18n'
import { memoryPlatform } from '../core/testing/memoryPlatform'
import { MODULES } from '.'

function build(settings: Record<string, Record<string, unknown>> = {}) {
  const i18n = createI18n('fr')
  for (const module of MODULES) i18n.register('fr', module.texts.fr)
  const folder = 'Black Projects/Documentation'
  const modules = docModules(
    MODULES.map((module) => ({ module, state: 'active' })),
    { version: '0.2.6', folder, t: (key, vars) => i18n.t(key, vars), settingsFor: (id) => settings[id] ?? {} }
  )
  return documentationPages({ version: '0.2.6', folder, modules })
}

describe('documentation des modules', () => {
  it('a une page par module, sans gabarit ni clé de texte oubliés', () => {
    const pages = build()
    expect(pages.map((page) => page.path)).toEqual([
      'Accueil.md',
      'Prise en main.md',
      'Modules/Lecture de fichiers.md',
      'Modules/Typage des pièces.md',
      'Modules/Exigences.md',
      'Modules/IA.md',
      'Modules/Workflows.md',
      "Modules/Analyse d'appels d'offres.md"
    ])
    for (const page of pages) {
      expect(page.content, page.path).not.toMatch(/\{\{|\}\}/)
      expect(page.content, page.path).not.toMatch(/lecture-fichiers\.|typage-pieces\.|exigences\.\w|module\.feature\.|\bao\.\w/)
    }
  })

  it('décrit les formats tels qu’ils sont, et les extensions équivalentes déclarées', () => {
    const page = build({ 'lecture-fichiers': { aliases: { tot: 'xml' } } }).find((each) => each.path === 'Modules/Lecture de fichiers.md')
    const content = page?.content ?? ''
    expect(content).toContain('| Format | En résumé | Lu | Écrit | Précision |')
    expect(content).toContain('| .pdf — PDF avec texte natif | 🟩 Lu et écrit | Oui | Export uniquement |')
    expect(content).toContain('| .pdf — PDF sans texte (scan) | 🟧 En partie | Non · à venir, étape 7 | Export uniquement |')
    expect(content).toContain('| .odt — OpenDocument Texte | 🟥 Ni lu ni écrit · à venir | Non · à venir | Non · pas prévu |')
    expect(content).toContain('| .md — Markdown | 🟩 Lu et écrit | Oui | Oui |')
    expect(content).toContain('- `.tot` lu comme `.xml`')
    expect(content).toContain('| .tot — Lu comme .xml | 🟧 En partie | Oui | Non · pas prévu | Extension équivalente ajoutée')
    expect(build().find((each) => each.path === 'Modules/Lecture de fichiers.md')?.content).toContain('*Aucune pour le moment.*')
  })

  it('relie les pages entre elles dans le dossier choisi', () => {
    const ao = build().find((each) => each.path === "Modules/Analyse d'appels d'offres.md")?.content ?? ''
    expect(ao).toContain('[[Black Projects/Documentation/Modules/Lecture de fichiers|Lecture de fichiers]]')
    expect(ao).toContain('[[Black Projects/Documentation/Accueil|← Accueil]]')
  })

  it('s’écrit dans le coffre', async () => {
    const platform = memoryPlatform()
    const report = await writeDocumentation(platform.fs, 'Black Projects/Documentation', build())
    expect(report.created).toHaveLength(8)
    expect(await platform.fs.exists('Black Projects/Documentation/Modules/Lecture de fichiers.md')).toBe(true)
  })
})

describe('types de pièces dans la documentation', () => {
  it('donne chaque type avec les mots-clés que la reconnaissance cherche', () => {
    const ao = build().find((each) => each.path === 'Modules/Typage des pièces.md')?.content ?? ''
    expect(ao).toContain('| Type | Pièce | Dans le nom du fichier | Dans le titre du document |')
    expect(ao).toContain('| RC | Règlement de la consultation | `RC`, `RDC`, `règlement de consultation`, `règlement de la consultation` |')
    expect(ao).toContain('| ANNEXE | Annexe | `annexe…`, `appendix` | — |')
    expect(ao).toContain('| AUTRE | Autre pièce | — | — |')
  })
})
