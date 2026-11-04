// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/// <reference types="node" />

/**
 * Jalon de l'étape 2 : le dossier de consultation d'exemple, compressé en ZIP comme un
 * acheteur le publie, importé dans une analyse — chaque pièce lue et typée.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { zip } from '../src/core/formats/zip'
import { createI18n } from '../src/core/i18n'
import { memoryPlatform } from '../src/core/testing/memoryPlatform'
import { aoModule, createAnalysis, importFiles } from '../src/modules/ao'

const folder = fileURLToPath(new URL('./fixtures/dce-exemple/', import.meta.url))

describe('import du dossier d’exemple', () => {
  it('ouvre le ZIP, lit et type chaque pièce', async () => {
    const names = readdirSync(folder).sort()
    const archive = zip(names.map((name) => ({ name: `DCE Station sol/${name}`, data: new Uint8Array(readFileSync(folder + name)) })))
    const platform = memoryPlatform()
    const i18n = createI18n('fr')
    i18n.register('fr', aoModule.texts.fr)
    const services = { fs: platform.fs, t: i18n.t.bind(i18n), root: "Appels d'offres", today: () => '2026-11-05' }
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'CNES', reference: '' })

    const report = await importFiles(services, analysis, [{ name: 'DCE.zip', bytes: archive }])
    const byName = Object.fromEntries(report.imported.map((piece) => [piece.original.split('/').pop(), `${piece.type} ${piece.state}`]))
    expect(byName).toEqual({
      'BPU.xls': 'BPU lue',
      'BPU.xlsx': 'BPU lue',
      'CCTP.doc': 'CCTP lue',
      'CCTP.docx': 'CCTP lue',
      'CCTP.md': 'CCTP lue',
      'CCTP.pdf': 'CCTP lue',
      'CCTP.rtf': 'CCTP lue',
      'Presentation.pptx': 'AUTRE lue',
      'RC.html': 'RC lue'
    })
    const cctp = await platform.fs.readText("Appels d'offres/Station sol/Pièces/CCTP.md")
    expect(cctp).toContain('EX-SOL-001')
    expect(await platform.fs.readText(analysis.note)).toContain('9 pièce(s), dont 9 lue(s).')
  })
})
