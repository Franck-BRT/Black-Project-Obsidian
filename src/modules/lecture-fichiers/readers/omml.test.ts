// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { parseXml } from '../formats/xmlParse'
import { equationText } from './omml'

const M = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
const r = (text: string) => `<m:r><m:t>${text}</m:t></m:r>`
const math = (inner: string, para = false) => equationText(parseXml(para ? `<m:oMathPara ${M}><m:oMath>${inner}</m:oMath></m:oMathPara>` : `<m:oMath ${M}>${inner}</m:oMath>`))

describe('les équations de Word en LaTeX', () => {
  it('fractions, puissances, indices, racines', () => {
    expect(math(`<m:f><m:num>${r('a')}</m:num><m:den>${r('b')}</m:den></m:f>`)).toBe('$\\frac{a}{b}$')
    expect(math(`<m:sSup><m:e>${r('x')}</m:e><m:sup>${r('2')}</m:sup></m:sSup>${r('+')}<m:sSub><m:e>${r('y')}</m:e><m:sub>${r('i')}</m:sub></m:sSub>`)).toBe('${x}^{2}+{y}_{i}$')
    expect(math(`<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${r('2')}</m:e></m:rad>`)).toBe('$\\sqrt{2}$')
    expect(math(`<m:rad><m:deg>${r('3')}</m:deg><m:e>${r('x')}</m:e></m:rad>`)).toBe('$\\sqrt[3]{x}$')
  })

  it('sommes, parenthèses, fonctions, symboles ; seule sur sa ligne : $$…$$', () => {
    expect(
      math(
        `<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>${r('i=1')}</m:sub><m:sup>${r('n')}</m:sup><m:e><m:sSub><m:e>${r('x')}</m:e><m:sub>${r('i')}</m:sub></m:sSub></m:e></m:nary>`,
        true
      )
    ).toBe('$$\\sum_{i=1}^{n} {x}_{i}$$')
    expect(math(`<m:d><m:e>${r('a+b')}</m:e></m:d>`)).toBe('$\\left( a+b \\right)$')
    expect(math(`<m:func><m:fName>${r('sin')}</m:fName><m:e>${r('θ')}</m:e></m:func>${r('≤1')}`)).toBe('$\\sin{\\theta}\\le 1$')
    expect(math(`<m:limLow><m:e>${r('lim')}</m:e><m:lim>${r('n→∞')}</m:lim></m:limLow>`)).toBe('$\\lim_{n\\to \\infty}$')
    expect(math('')).toBe('')
  })
})
