// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { frontmatter, parseFrontmatter, setFrontmatterField, yamlValue } from './frontmatter'

describe('en-tête des notes', () => {
  it('écrit et relit à l’identique', () => {
    const fields = {
      'bp-type': 'ao-piece',
      analyse: '[[Appels d’offres/Station sol/Station sol]]',
      type: 'CCTP',
      caracteres: 12345,
      vide: '',
      vrai: 'true',
      date: '2026-11-05',
      deux: 'a: b'
    }
    const parsed = parseFrontmatter(frontmatter(fields) + '# Titre\n')
    expect(parsed.data).toEqual({ ...fields, caracteres: '12345' })
    expect(parsed.body).toBe('# Titre\n')
  })

  it('met entre guillemets ce qui serait mal relu', () => {
    expect(yamlValue('CCTP')).toBe('CCTP')
    expect(yamlValue('[[lien]]')).toBe('"[[lien]]"')
    expect(yamlValue('true')).toBe('"true"')
    expect(yamlValue('2026-11-05')).toBe('"2026-11-05"')
    expect(yamlValue('a: b')).toBe('"a: b"')
  })

  it('change un champ sans toucher au reste, lignes inconnues comprises', () => {
    const note = '---\ntype: RC\ntags:\n  - ao\n---\n# Pièce\n\nTexte.'
    const changed = setFrontmatterField(note, 'type', 'CCTP')
    expect(changed).toBe('---\ntype: CCTP\ntags:\n  - ao\n---\n# Pièce\n\nTexte.')
    expect(setFrontmatterField(changed, 'lecture', 'lue')).toContain('  - ao\nlecture: lue\n---')
    expect(setFrontmatterField('# Sans en-tête', 'type', 'RC')).toBe('---\ntype: RC\n---\n# Sans en-tête')
  })

  it('lit les guillemets simples et doubles', () => {
    expect(parseFrontmatter("---\na: 'l''acheteur'\nb: \"x \\\"y\\\"\"\n---\n").data).toEqual({ a: "l'acheteur", b: 'x "y"' })
  })
})
