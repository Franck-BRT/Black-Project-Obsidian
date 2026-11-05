// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Le modèle des workflows : conditions, variables, jours, planification (repris de la version complète). */

import { describe, expect, it } from 'vitest'
import {
  conditionsHold,
  expand,
  holds,
  lastSlot,
  matches,
  newWorkflow,
  resolveDay,
  SCHEDULE,
  scheduleDue,
  stepsReferred,
  stepVariable,
  variablesOf,
  type Subject,
  type Workflow
} from './model'

const analysis: Subject = {
  key: 'AO/Station sol/Station sol.md',
  label: 'Station sol',
  path: 'AO/Station sol/Station sol.md',
  vars: { analyse: 'Station sol', position: 'candidat', acheteur: 'Agence', nombre: '4', echeance: '2026-10-20', titre: 'Radier' },
  lists: { types: ['CCTP', 'CCAP'], places: ['Appel d’offres'] }
}

const rule = (given: Partial<Workflow>): Workflow => ({ ...newWorkflow('Règle', new Date('2026-10-01T00:00:00')), ...given })

describe('les conditions', () => {
  it('testent un champ ou une liste, sans majuscules ni accents, plusieurs valeurs voulant dire l’une ou l’autre', () => {
    expect(holds({ field: 'analyse', op: 'is', value: 'station SOL' }, analysis)).toBe(true)
    expect(holds({ field: 'types', op: 'is', value: 'RC, ccap' }, analysis)).toBe(true)
    expect(holds({ field: 'position', op: 'is-not', value: 'candidat' }, analysis)).toBe(false)
    expect(holds({ field: 'places', op: 'contains', value: 'appel d’offres' }, analysis)).toBe(true)
    expect(holds({ field: 'reference', op: 'empty', value: '' }, analysis)).toBe(true)
    expect(holds({ field: 'titre', op: 'not-contains', value: 'rad' }, analysis)).toBe(false)
  })

  it('comparent des nombres, des jours (relatifs aussi) et des mots', () => {
    const today = '2026-10-14'
    expect(holds({ field: 'nombre', op: 'gt', value: '3' }, analysis, today)).toBe(true)
    expect(holds({ field: 'nombre', op: 'gte', value: '4,0' }, analysis, today)).toBe(true)
    expect(holds({ field: 'nombre', op: 'lt', value: '4' }, analysis, today)).toBe(false)
    expect(holds({ field: 'echeance', op: 'lte', value: '+7' }, analysis, today)).toBe(true)
    expect(holds({ field: 'echeance', op: 'lte', value: '+3' }, analysis, today)).toBe(false)
    expect(holds({ field: 'echeance', op: 'gt', value: '{today}' }, analysis, today)).toBe(true)
    expect(holds({ field: 'titre', op: 'gt', value: 'A' }, analysis, today)).toBe(true)
  })

  it('« et » lie plus fort que « ou », comme dans une phrase', () => {
    const is = (field: string, value: string, join?: 'and' | 'or') => ({ field, op: 'is' as const, value, ...(join ? { join } : {}) })
    expect(conditionsHold([is('position', 'candidat'), is('acheteur', 'Autre'), is('types', 'CCTP', 'or')], analysis)).toBe(true)
    expect(conditionsHold([is('position', 'emetteur'), is('acheteur', 'Agence', 'or'), is('types', 'RC')], analysis)).toBe(false)
    expect(conditionsHold([], analysis)).toBe(true)
  })

  it('un workflow répond à son déclencheur seulement, actif, ses conditions tenues', () => {
    const event = { trigger: 'ao.pieces-importees', subject: analysis }
    expect(matches(rule({ trigger: { kind: 'ao.pieces-importees' } }), event)).toBe(true)
    expect(matches(rule({ trigger: { kind: 'ao.analyse-creee' } }), event)).toBe(false)
    expect(matches(rule({ enabled: false, trigger: { kind: 'ao.pieces-importees' } }), event)).toBe(false)
    expect(matches(rule({ trigger: { kind: 'ao.pieces-importees' }, conditions: [{ field: 'types', op: 'is', value: 'BPU' }] }), event)).toBe(false)
  })
})

describe('les planifications', () => {
  it('trouvent le dernier moment demandé : aujourd’hui si l’heure est venue, sinon avant', () => {
    const daily = { kind: SCHEDULE, every: 'day' as const, time: '08:30' }
    expect(lastSlot(daily, new Date('2026-10-14T09:00:00'))).toEqual(new Date('2026-10-14T08:30:00'))
    expect(lastSlot(daily, new Date('2026-10-14T07:00:00'))).toEqual(new Date('2026-10-13T08:30:00'))
    expect(lastSlot({ ...daily, every: 'week', weekday: 1 }, new Date('2026-10-14T09:00:00'))).toEqual(new Date('2026-10-12T08:30:00'))
    expect(lastSlot({ ...daily, every: 'weekdays' }, new Date('2026-10-18T09:00:00'))).toEqual(new Date('2026-10-16T08:30:00'))
    expect(lastSlot({ ...daily, every: 'month', monthDay: 1 }, new Date('2026-10-14T09:00:00'))).toEqual(new Date('2026-10-01T08:30:00'))
    expect(lastSlot({ kind: 'manuel' }, new Date())).toBeNull()
  })

  it('une fois pour les moments manqués, jamais pour un moment d’avant la création', () => {
    const weekly = rule({ trigger: { kind: SCHEDULE, every: 'week', weekday: 1, time: '08:00' } })
    expect(scheduleDue(weekly, new Date('2026-10-06T10:00:00'))).toBe(true)
    expect(scheduleDue({ ...weekly, lastRun: '2026-10-06T10:00:00' }, new Date('2026-10-07T10:00:00'))).toBe(false)
    expect(scheduleDue({ ...weekly, lastRun: '2026-10-06T10:00:00' }, new Date('2026-10-20T10:00:00'))).toBe(true)
    expect(scheduleDue({ ...weekly, created: '2026-10-05T09:00:00' }, new Date('2026-10-06T10:00:00'))).toBe(false)
    expect(scheduleDue({ ...weekly, enabled: false }, new Date('2026-10-06T10:00:00'))).toBe(false)
  })
})

describe('les textes et les jours', () => {
  it('remplacent les variables, déplacent les jours, laissent l’inconnu tel qu’écrit', () => {
    const vars = variablesOf(analysis, rule({ name: 'Suite' }), new Date('2026-10-14T09:05:00'))
    expect(expand('{analyse} ({types}) — avant {echeance+7}, le {today}, {inconnu}, {workflow}', vars)).toBe(
      'Station sol (CCTP, CCAP) — avant 2026-10-27, le 2026-10-14, {inconnu}, Suite'
    )
    expect(vars.now).toBe('2026-10-14 09:05')
  })

  it('lisent un jour comme une date, « +7 », ou une variable', () => {
    expect(resolveDay('2026-11-02', {}, '2026-10-14')).toBe('2026-11-02')
    expect(resolveDay('+7', {}, '2026-10-14')).toBe('2026-10-21')
    expect(resolveDay('+ 3 jours', {}, '2026-10-14')).toBe('2026-10-17')
    expect(resolveDay('{echeance+2}', { echeance: '2026-10-20' }, '2026-10-14')).toBe('2026-10-22')
    expect(resolveDay('demain', {}, '2026-10-14')).toBe('')
  })

  it('les résultats d’une étape à l’autre', () => {
    expect(stepsReferred('{step1.link} — {step3.text} {step1.path} {analyse}')).toEqual([1, 3])
    expect(stepVariable(2, 'path')).toBe('step2.path')
  })
})
