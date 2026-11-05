// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { readYamlFrontmatter, toYaml } from './yaml'

const reader = { parse: (text: string) => parse(text) as unknown }

describe('écrire du YAML', () => {
  const data = {
    'brt-requirement': true,
    id: 'REQ-SYS-0001',
    title: 'Maintien en température',
    rev: 2,
    text: {
      fr: { body: 'Le système doit : tenir 5 °C.\nMême la nuit.', fromRev: 2, origin: 'human', reviewed: true },
      en: { body: 'yes', fromRev: 1, origin: 'machine', reviewed: false }
    },
    tags: ['thermique', 'soute #2'],
    links: [{ kind: 'derives-from', to: 'REQ-SYS-0000', suspect: true }],
    history: [],
    empty: {},
    note: '',
    weird: '- tiret',
    date: '2026-11-05'
  }

  it('se relit à l’identique', () => {
    expect(reader.parse(toYaml(data))).toEqual(data)
  })

  it('reste lisible : blocs, sans guillemets quand c’est sûr', () => {
    const text = toYaml(data)
    expect(text).toContain('title: Maintien en température')
    expect(text).toContain('    body: |-\n      Le système doit : tenir 5 °C.\n      Même la nuit.')
    expect(text).toContain('links:\n- kind: derives-from\n  to: REQ-SYS-0000\n  suspect: true')
    expect(text).toContain('en:\n    body: "yes"')
    expect(text).toContain('date: "2026-11-05"')
  })

  it('tient les textes délicats', () => {
    for (const value of ['a: b', ' espace', 'fin ', 'ligne\r\nwindows', 'tab\tici', '#titre', 'null', '"cité"', 'deux\n\nparagraphes', 'x\n  indenté']) {
      expect(reader.parse(toYaml({ value })), JSON.stringify(value)).toEqual({ value })
    }
  })
})

describe('lire un en-tête', () => {
  it('rend les données et le corps', () => {
    expect(readYamlFrontmatter(reader, '---\nid: A\nn: 2\n---\n# Titre\n')).toEqual({ data: { id: 'A', n: 2 }, body: '# Titre\n' })
  })

  it('sans en-tête, ou illisible : pas de données', () => {
    expect(readYamlFrontmatter(reader, '# Titre').data).toBeNull()
    expect(readYamlFrontmatter(reader, '---\n: : [\n---\ncorps').data).toBeNull()
  })
})
