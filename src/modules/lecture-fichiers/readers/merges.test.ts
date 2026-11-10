// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Merged cells, read from each format, written as an HTML table the page shows merged. */

import { describe, expect, it } from 'vitest'
import { mergedTable, writtenTable } from '../../../core/tables'
import { utf8, zip } from '../../../core/formats/zip'
import { fileText } from './fileText'
import { readDocx } from './docxRead'
import { readHtml } from './htmlRead'
import { readPptx } from './pptxRead'
import { readXlsx } from './xlsxRead'

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const run = (text: string) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`
const tc = (text: string, properties = '') => `<w:tc>${properties ? `<w:tcPr>${properties}</w:tcPr>` : ''}<w:p>${text ? run(text) : ''}</w:p></w:tc>`

/** Lot (on two rows) | Prix (on two columns) / HT | TTC / 1 (on two rows) | 10 | 12 / 20 | 24. */
function wordTable(): Uint8Array {
  const rows = [
    tc('Lot', '<w:vMerge w:val="restart"/>') + tc('Prix', '<w:gridSpan w:val="2"/>'),
    tc('', '<w:vMerge/>') + tc('HT') + tc('TTC'),
    tc('1', '<w:vMerge w:val="restart"/>') + tc('10') + tc('12'),
    tc('', '<w:vMerge/>') + tc('20') + tc('24 & <plus>'.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
  ]
  const body = `<w:tbl>${rows.map((row) => `<w:tr>${row}</w:tr>`).join('')}</w:tbl>`
  return zip([{ name: 'word/document.xml', data: utf8(`<w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`) }])
}

const EXPECTED = [
  '<table>',
  '<tr><th rowspan="2">Lot</th><th colspan="2">Prix</th></tr>',
  '<tr><td>HT</td><td>TTC</td></tr>',
  '<tr><td rowspan="2">1</td><td>10</td><td>12</td></tr>',
  '<tr><td>20</td><td>24 &amp; &lt;plus&gt;</td></tr>',
  '</table>'
].join('\n')

describe('les cellules fusionnées', () => {
  it('écrites : en HTML (colspan, rowspan), la première ligne en en-tête ; sans fusion, en Markdown', () => {
    const rows = [['Lot', 'Prix', ''], ['', 'HT', 'TTC'], ['1', '10', '12'], ['', '20', '24 & <plus>']]
    const merges = [
      { row: 0, column: 0, rows: 2, columns: 1 },
      { row: 0, column: 1, rows: 1, columns: 2 },
      { row: 2, column: 0, rows: 2, columns: 1 }
    ]
    expect(mergedTable(rows, merges)).toBe(EXPECTED)
    expect(writtenTable([['A', 'B'], ['1', '2']])).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |')
    expect(writtenTable([['A', 'B'], ['1', '2']], [{ row: 0, column: 0, rows: 1, columns: 1 }])).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |')
  })

  it('écrites : une colonne, une ligne vides retirées — sauf celles qu’une fusion traverse ; une fusion sans texte défaite ; des sauts de ligne en <br>', () => {
    const rows = [['Titre', '', '', ''], ['', '', '', ''], ['a\nb', '', 'c', ''], ['', '', '', '']]
    expect(mergedTable(rows, [{ row: 0, column: 0, rows: 1, columns: 3 }, { row: 1, column: 0, rows: 1, columns: 2 }])).toBe(
      ['<table>', '<tr><th colspan="3">Titre</th></tr>', '<tr><td>a<br>b</td><td></td><td>c</td></tr>', '</table>'].join('\n')
    )
  })

  it('Word : gridSpan et vMerge ; le texte extrait, un tableau HTML', async () => {
    const [table] = await readDocx(wordTable())
    expect(table).toMatchObject({
      kind: 'table',
      rows: [['Lot', 'Prix', ''], ['', 'HT', 'TTC'], ['1', '10', '12'], ['', '20', '24 & <plus>']],
      merges: [
        { row: 0, column: 0, rows: 2, columns: 1 },
        { row: 0, column: 1, rows: 1, columns: 2 },
        { row: 2, column: 0, rows: 2, columns: 1 }
      ]
    })
    expect(await fileText('docx', wordTable())).toBe(EXPECTED)
  })

  it('HTML : colspan et rowspan — les cellules des lignes suivantes restent dans leur colonne', () => {
    const [table] = readHtml(
      '<table><tr><th rowspan="2">Lot</th><th colspan="2">Prix</th></tr><tr><th>HT</th><th>TTC</th></tr><tr><td rowspan="2">1</td><td>10</td><td>12</td></tr><tr><td>20</td><td>24</td></tr></table>'
    )
    expect(table).toEqual({
      kind: 'table',
      rows: [['Lot', 'Prix', ''], ['', 'HT', 'TTC'], ['1', '10', '12'], ['', '20', '24']],
      merges: [
        { row: 0, column: 0, rows: 2, columns: 1 },
        { row: 0, column: 1, rows: 1, columns: 2 },
        { row: 2, column: 0, rows: 2, columns: 1 }
      ]
    })
  })

  it('PowerPoint : gridSpan et rowSpan, les cellules couvertes (hMerge, vMerge) vides', async () => {
    const NS = 'xmlns:p="p" xmlns:a="a" xmlns:r="r"'
    const cell = (text: string, attrs = '') => `<a:tc${attrs}><a:txBody><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></a:txBody></a:tc>`
    const table =
      `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Tableau"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/></p:xfrm><a:graphic><a:graphicData uri="t"><a:tbl>` +
      `<a:tr h="1">${cell('Lot', ' rowSpan="2"')}${cell('Prix', ' gridSpan="2"')}${cell('x', ' hMerge="1"')}</a:tr>` +
      `<a:tr h="1">${cell('y', ' vMerge="1"')}${cell('HT')}${cell('TTC')}</a:tr>` +
      `</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
    const bytes = zip([
      { name: 'ppt/presentation.xml', data: utf8(`<p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`) },
      { name: 'ppt/_rels/presentation.xml.rels', data: utf8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>') },
      { name: 'ppt/slides/slide1.xml', data: utf8(`<p:sld ${NS}><p:cSld><p:spTree>${table}</p:spTree></p:cSld></p:sld>`) }
    ])
    const [slide] = await readPptx(bytes)
    expect(slide!.shapes[0]).toMatchObject({ kind: 'table', rows: [['Lot', 'Prix', ''], ['', 'HT', 'TTC']], merges: [{ row: 0, column: 0, rows: 2, columns: 1 }, { row: 0, column: 1, rows: 1, columns: 2 }] })
    expect(await fileText('pptx', bytes)).toBe('## 1\n\n<table>\n<tr><th rowspan="2">Lot</th><th colspan="2">Prix</th></tr>\n<tr><td>HT</td><td>TTC</td></tr>\n</table>')
  })

  it('Excel : mergeCells, comptées dans les lignes gardées (une ligne vide retirée)', async () => {
    const X = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    const s = (ref: string, text: string) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`
    const bytes = zip([
      { name: '_rels/.rels', data: utf8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: utf8(`<workbook ${X} xmlns:r="r"><sheets><sheet name="DPGF" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
      { name: 'xl/_rels/workbook.xml.rels', data: utf8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>') },
      {
        name: 'xl/worksheets/sheet1.xml',
        data: utf8(
          `<worksheet ${X}><sheetData>` +
            `<row r="1">${s('A1', 'Lot')}${s('B1', 'Prix')}</row>` +
            `<row r="2"/>` +
            `<row r="3">${s('B3', 'HT')}${s('C3', 'TTC')}</row>` +
            `<row r="4">${s('A4', '1')}${s('B4', '10')}${s('C4', '12')}</row>` +
            `</sheetData><mergeCells count="3"><mergeCell ref="A1:A3"/><mergeCell ref="B1:C2"/><mergeCell ref="E9:F9"/></mergeCells></worksheet>`
        )
      }
    ])
    const [sheet] = await readXlsx(bytes)
    expect(sheet).toEqual({ name: 'DPGF', rows: [['Lot', 'Prix'], ['', 'HT', 'TTC'], ['1', '10', '12']], merges: [{ row: 0, column: 0, rows: 2, columns: 1 }, { row: 0, column: 1, rows: 1, columns: 2 }] })
    expect(await fileText('xlsx', bytes)).toBe('## DPGF\n\n<table>\n<tr><th rowspan="2">Lot</th><th colspan="2">Prix</th></tr>\n<tr><td>HT</td><td>TTC</td></tr>\n<tr><td>1</td><td>10</td><td>12</td></tr>\n</table>')
  })
})
