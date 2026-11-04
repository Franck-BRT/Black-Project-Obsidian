// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { isRtf, readRtf } from './rtfRead'

const bytes = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0))

describe('readRtf', () => {
  it('reconnaît un RTF à son début', () => {
    expect(isRtf(bytes('{\\rtf1\\ansi Bonjour}'))).toBe(true)
    expect(isRtf(bytes('Bonjour'))).toBe(false)
  })

  it('lit le texte, ses accents et ses paragraphes, sans la table des polices', () => {
    const text = readRtf(
      bytes(
        "{\\rtf1\\ansi\\ansicpg1252{\\fonttbl{\\f0 Arial;}}\\f0 Cahier des charges\\par Le titulaire doit fournir un r\\'e9sum\\'e9.\\par}"
      )
    )
    expect(text).toContain('Cahier des charges')
    expect(text).toContain('Le titulaire doit fournir un résumé.')
    expect(text).not.toContain('Arial')
  })
})
