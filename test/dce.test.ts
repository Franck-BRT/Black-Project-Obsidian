// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/// <reference types="node" />

/**
 * Jalon de l'étape 1 : chaque pièce d'un dossier de consultation est lue.
 *
 * Les pièces de `fixtures/dce-exemple/` sont fictives, mais produites par d'autres
 * outils que les nôtres — Word et PDF par LibreOffice, HTML et PowerPoint par pandoc —,
 * comme celles qu'un acheteur publie. Un lecteur qui ne relirait que ce que nos propres
 * générateurs écrivent passerait ses tests et échouerait ici.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fileText } from '../src/core/readers/fileText'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))

async function read(name: string): Promise<string> {
  const extension = name.slice(name.lastIndexOf('.') + 1)
  return fileText(extension, new Uint8Array(readFileSync(folder + name)))
}

/** Les espaces, insécables compris, ramenés à une seule. */
const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('dossier de consultation d’exemple', () => {
  for (const name of ['CCTP.docx', 'CCTP.pdf', 'CCTP.doc', 'CCTP.rtf', 'CCTP.md']) {
    it(`lit le CCTP au format ${name.split('.')[1]}`, async () => {
      const text = flat(await read(name))
      expect(text).toContain('Station sol de télémesure')
      expect(text).toContain('EX-SOL-001')
      expect(text).toContain('Le titulaire doit fournir une antenne de 3,7 m de diamètre.')
      expect(text).toContain('EX-SOL-003')
      expect(text).toContain('au plus tard le 30 juin 2027')
    })
  }

  for (const name of ['CCTP.docx', 'CCTP.pdf']) {
    it(`garde le tableau des exigences en lignes et colonnes (${name.split('.')[1]})`, async () => {
      const lines = (await read(name)).split('\n').map(flat)
      expect(lines.some((line) => /EX-SOL-002 \| La station doit recevoir en bande S/.test(line))).toBe(true)
    })
  }

  it('lit le règlement de consultation en HTML', async () => {
    const text = flat(await read('RC.html'))
    expect(text).toContain('La date limite de remise des offres est fixée au 15 janvier 2027')
    expect(text).toContain('valeur technique (60 %)')
  })

  for (const name of ['BPU.xlsx', 'BPU.xls']) {
    it(`lit le bordereau de prix (${name.split('.')[1]})`, async () => {
      const text = await read(name)
      expect(text).toContain('| Poste | Désignation | Unité | Prix unitaire HT |')
      expect(text).toContain('Antenne 3,7 m')
    })
  }

  it('lit la présentation PowerPoint diapositive par diapositive', async () => {
    const text = flat(await read('Presentation.pptx'))
    expect(text).toContain('Bande S, 2 Mbit/s')
    expect(text).toContain('Remise des offres : 15 janvier 2027')
  })
})
