// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { utf8, zip } from '../../core/formats/zip'
import { ArchiveError, readArchive } from './archive'
import { entryName } from './formats/unzip'

describe('readArchive', () => {
  it('rend les fichiers avec leur chemin, sans dossiers ni fichiers parasites', async () => {
    const archive = zip([
      { name: 'DCE/RC.pdf', data: utf8('rc') },
      { name: 'DCE/Pièces techniques/CCTP.docx', data: utf8('cctp') },
      { name: '__MACOSX/DCE/._RC.pdf', data: utf8('x') },
      { name: 'DCE/.DS_Store', data: utf8('x') },
      { name: 'DCE/Thumbs.db', data: utf8('x') },
      { name: 'DCE/.cache/x.txt', data: utf8('x') }
    ])
    const entries = await readArchive(archive)
    expect(entries.map((entry) => entry.path)).toEqual(['DCE/RC.pdf', 'DCE/Pièces techniques/CCTP.docx'])
    expect(new TextDecoder().decode(entries[1]?.bytes)).toBe('cctp')
  })

  it('ouvre une archive dans l’archive', async () => {
    const lot = zip([{ name: 'BPU.xlsx', data: utf8('bpu') }])
    const entries = await readArchive(zip([{ name: 'RC.pdf', data: utf8('rc') }, { name: 'Lot 1.zip', data: lot }]))
    expect(entries.map((entry) => entry.path)).toEqual(['RC.pdf', 'Lot 1/BPU.xlsx'])
  })

  it('refuse ce qui n’est pas une archive', async () => {
    await expect(readArchive(utf8('pas un zip'))).rejects.toBeInstanceOf(ArchiveError)
  })
})

describe('noms des fichiers d’une archive', () => {
  it('lit l’UTF-8, et la page de code 437 des archives de Windows', () => {
    expect(entryName(utf8('Pièces/CCTP.pdf'), true)).toBe('Pièces/CCTP.pdf')
    expect(entryName(utf8('Pièces/CCTP.pdf'), false)).toBe('Pièces/CCTP.pdf')
    // « Pièces » écrit par l'outil « Compresser » de Windows : è vaut 0x8A en page 437.
    expect(entryName(Uint8Array.from([0x50, 0x69, 0x8a, 0x63, 0x65, 0x73]), false)).toBe('Pièces')
    expect(entryName(Uint8Array.from([0x82, 0x74, 0x82]), false)).toBe('été')
  })
})
