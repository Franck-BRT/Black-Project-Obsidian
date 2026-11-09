// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **types de projet** : ceux livrés pour commencer, et ce qu'on en fait en les dessinant
 * (ajouter une étape, une phase en parallèle, déplacer, modifier, retirer). Des fonctions
 * pures : un type changé est un nouveau type, rangé ensuite dans les réglages.
 */

import { freeId, FREE_KIND, readProjectType, slug, type PhaseSpec, type ProjectType } from './model'

/** La clé des types de projet dans les réglages du module. */
export const TYPES_KEY = 'typesProjet'

/** La sorte de phase de l'analyse d'un appel d'offres (déclarée par le module AO). */
export const AO_KIND = 'ao.analyse'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Les types de projet de départ, dans la langue de l'utilisateur. */
export function starterTypes(t: Translate): ProjectType[] {
  const phase = (id: string, icon: PhaseSpec['icon'], color: PhaseSpec['color'], kind = FREE_KIND): PhaseSpec => ({ id, name: t(`programmes.starter.phase.${id}`), kind, icon, color })
  return [
    {
      id: 'reponse-ao',
      name: t('programmes.starter.reponse-ao'),
      icon: 'building',
      color: 'indigo',
      description: t('programmes.starter.reponse-ao.desc'),
      stages: [
        [phase('veille', 'search', 'slate')],
        [phase('analyse-ao', 'file', 'indigo', AO_KIND)],
        [phase('go-no-go', 'check', 'orange')],
        [phase('redaction', 'edit', 'blue'), phase('chiffrage', 'chart', 'teal')],
        [phase('remise', 'upload', 'violet')],
        [phase('negociation', 'chat', 'rose')],
        [phase('execution', 'play', 'green')],
        [phase('cloture', 'lock', 'slate')]
      ]
    },
    {
      id: 'projet-simple',
      name: t('programmes.starter.projet-simple'),
      icon: 'flow',
      color: 'teal',
      description: t('programmes.starter.projet-simple.desc'),
      stages: [[phase('lancement', 'play', 'teal')], [phase('realisation', 'edit', 'blue')], [phase('recette', 'check', 'orange')], [phase('cloture', 'lock', 'slate')]]
    }
  ]
}

/** Les types de projet des réglages ; jamais réglés : ceux de départ. */
export function readTypes(settings: Readonly<Record<string, unknown>>, t: Translate): ProjectType[] {
  const stored = settings[TYPES_KEY]
  if (!Array.isArray(stored)) return starterTypes(t)
  return stored.map(readProjectType).filter((type): type is ProjectType => type !== null)
}

const allPhaseIds = (type: ProjectType): string[] => type.stages.flat().map((phase) => phase.id)

/** Une phase neuve pour ce type : un identifiant libre tiré de son nom. */
export function newPhase(type: ProjectType, fields: Omit<PhaseSpec, 'id'>): PhaseSpec {
  return { ...fields, id: freeId(slug(fields.name), allPhaseIds(type)) }
}

/** Une étape de plus, à la fin (ou après l'étape `after`, à partir de 0), avec cette phase. */
export function addStage(type: ProjectType, phase: PhaseSpec, after = type.stages.length - 1): ProjectType {
  const stages = [...type.stages]
  stages.splice(after + 1, 0, [phase])
  return { ...type, stages }
}

/** Une phase de plus dans une étape (à partir de 0) : en parallèle des autres. */
export function addParallel(type: ProjectType, stage: number, phase: PhaseSpec): ProjectType {
  return { ...type, stages: type.stages.map((list, at) => (at === stage ? [...list, phase] : list)) }
}

export function updatePhase(type: ProjectType, id: string, patch: Partial<Omit<PhaseSpec, 'id'>>): ProjectType {
  return { ...type, stages: type.stages.map((list) => list.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase))) }
}

/** Sans cette phase ; une étape restée vide disparaît. */
export function removePhase(type: ProjectType, id: string): ProjectType {
  return { ...type, stages: type.stages.map((list) => list.filter((phase) => phase.id !== id)).filter((list) => list.length) }
}

export type Direction = 'left' | 'right' | 'up' | 'down'

/**
 * Une phase déplacée : à gauche ou à droite, dans l'étape d'avant ou d'après (au-delà de la
 * première ou de la dernière : une étape à elle) ; en haut ou en bas, dans son étape.
 */
export function movePhase(type: ProjectType, id: string, direction: Direction): ProjectType {
  const stage = type.stages.findIndex((list) => list.some((phase) => phase.id === id))
  if (stage < 0) return type
  const list = type.stages[stage]!
  const at = list.findIndex((phase) => phase.id === id)
  const phase = list[at]!
  if (direction === 'up' || direction === 'down') {
    const to = direction === 'up' ? at - 1 : at + 1
    if (to < 0 || to >= list.length) return type
    const moved = [...list]
    moved.splice(at, 1)
    moved.splice(to, 0, phase)
    return { ...type, stages: type.stages.map((each, index) => (index === stage ? moved : each)) }
  }
  const alone = list.length === 1
  const stages = type.stages.map((each, index) => (index === stage ? each.filter((other) => other.id !== id) : [...each]))
  const target = direction === 'left' ? stage - 1 : stage + 1
  if (target < 0) {
    // Avant la première : une étape à elle, en tête (seule déjà : rien ne change).
    if (alone) return type
    stages.unshift([phase])
  } else if (target >= stages.length) {
    if (alone) return type
    stages.push([phase])
  } else stages[target]!.push(phase)
  return { ...type, stages: stages.filter((each) => each.length) }
}

/** Un type neuf : une première phase, libre. */
export function newType(types: readonly ProjectType[], name: string, t: Translate): ProjectType {
  return {
    id: freeId(slug(name), types.map((type) => type.id)),
    name,
    icon: 'flow',
    color: 'indigo',
    stages: [[{ id: 'lancement', name: t('programmes.starter.phase.lancement'), kind: FREE_KIND, icon: 'play', color: 'teal' }]]
  }
}

/** Une copie d'un type, sous un autre nom. */
export function copyType(types: readonly ProjectType[], type: ProjectType, name: string): ProjectType {
  return { ...type, id: freeId(slug(name), types.map((each) => each.id)), name, stages: type.stages.map((list) => list.map((phase) => ({ ...phase }))) }
}
