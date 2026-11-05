// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/// <reference types="node" />

/**
 * Jalon de l'étape 4 : les exigences du CCTP d'exemple — un tableau « Identifiant |
 * Exigence | Vérification » et une exigence en ligne — trouvées dans chaque format où il
 * est publié, chacune avec l'endroit où elle a été trouvée.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractRequirements } from '../src/modules/exigences'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))

describe('les exigences du CCTP d’exemple', () => {
  for (const name of ['CCTP.docx', 'CCTP.pdf', 'CCTP.md']) {
    it(`sont trouvées dans le ${name.split('.')[1]}`, async () => {
      const extension = name.split('.')[1]!
      const read = await extractRequirements(extension, new Uint8Array(readFileSync(folder + name)), ['fr', 'en'])
      expect(read.problem).toBeUndefined()
      const flat = (text = '') => text.replace(/\s+/g, ' ').trim()
      expect(read.rows.map((row) => [row.id, flat(row['text.fr']), row.verification ?? ''])).toEqual([
        ['EX-SOL-001', 'Le titulaire doit fournir une antenne de 3,7 m de diamètre.', 'inspection'],
        ['EX-SOL-002', 'La station doit recevoir en bande S avec un débit de 2 Mbit/s.', 'test'],
        ['EX-SOL-003', 'Le système doit être disponible 99,5 % du temps, le cas échéant.', '']
      ])
      expect(read.where[0]).toMatchObject({ kind: 'table', index: 1, row: 1 })
      expect(read.where[1]).toMatchObject({ kind: 'table', index: 1, row: 2 })
      expect(read.where[2]).toMatchObject({ kind: 'paragraph' })
      expect(flat(read.where[0]?.heading)).toContain('Exigences')
    })
  }
})
