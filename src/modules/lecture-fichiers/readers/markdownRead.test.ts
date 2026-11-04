// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

import { describe, expect, it } from 'vitest'
import { plainInline, readMarkdown } from './markdownRead'

describe('readMarkdown', () => {
  it('lit l’en-tête YAML, les titres, les listes et les tableaux', () => {
    const { front, blocks } = readMarkdown(
      [
        '---',
        'language: fr',
        '---',
        '# CCTP',
        '## Exigences générales',
        'Le titulaire **doit** fournir un plan qualité.',
        '',
        '- Livraison sous 15 jours',
        '',
        '| Id | Libellé |',
        '| --- | --- |',
        '| EX-1 | Plan qualité |'
      ].join('\n')
    )
    expect(front.language).toBe('fr')
    expect(blocks.map((block) => (block.kind === 'table' ? 'table' : `${block.style}:${block.text}`))).toEqual([
      'title:CCTP',
      'heading:Exigences générales',
      'normal:Le titulaire doit fournir un plan qualité.',
      'list:Livraison sous 15 jours',
      'table'
    ])
    const table = blocks.at(-1)
    expect(table?.kind === 'table' ? table.rows : []).toEqual([
      ['Id', 'Libellé'],
      ['EX-1', 'Plan qualité']
    ])
  })

  it('garde les lignes d’un paragraphe ensemble, comme elles ont été écrites', () => {
    // Voulu : une exigence écrite sur deux lignes revient sur deux lignes. Une liste
    // collée à un paragraphe, sans ligne vide, en fait donc partie.
    const { blocks } = readMarkdown('Le titulaire doit :\n- livrer le plan')
    expect(blocks.map((block) => (block.kind === 'table' ? '' : block.text))).toEqual([
      'Le titulaire doit :\n- livrer le plan'
    ])
  })

  it('saute le code en entier', () => {
    const { blocks } = readMarkdown(['Avant', '```', 'pas une exigence', '```', 'Après'].join('\n'))
    expect(blocks.map((block) => (block.kind === 'table' ? '' : block.text))).toEqual(['Avant', 'Après'])
  })

  it('retire l’emphase et les liens, garde les mots', () => {
    expect(plainInline('Voir *le* [CCAP](ccap.md) et \\*pas\\* plus')).toBe('Voir le CCAP et *pas* plus')
  })
})
