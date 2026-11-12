// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les **types de projet** : ceux livrés pour commencer, et ce qu'on en fait en les dessinant
 * (ajouter une étape, une phase en parallèle, déplacer, modifier, retirer). Des fonctions
 * pures : un type changé est un nouveau type, rangé ensuite dans les réglages.
 */

import { freeId, FREE_KIND, readProjectType, slug, type FolderSpec, type PhaseSpec, type ProjectType, type SpanSpec } from './model'

/** La clé des types de projet dans les réglages du module. */
export const TYPES_KEY = 'typesProjet'

/** La sorte de phase de l'analyse d'un appel d'offres (déclarée par le module AO). */
export const AO_KIND = 'ao.analyse'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Les types de projet de départ, dans la langue de l'utilisateur. */
export function starterTypes(t: Translate): ProjectType[] {
  const phase = (id: string, icon: PhaseSpec['icon'], color: PhaseSpec['color'], duration: number, kind = FREE_KIND, documents: string[] = []): PhaseSpec => ({
    id,
    name: t(`programmes.starter.phase.${id}`),
    kind,
    icon,
    color,
    duration,
    ...(documents.length ? { documents: documents.map((type) => ({ type })) } : {})
  })
  return [
    {
      id: 'reponse-ao',
      name: t('programmes.starter.reponse-ao'),
      icon: 'building',
      color: 'indigo',
      description: t('programmes.starter.reponse-ao.desc'),
      stages: [
        [phase('veille', 'search', 'slate', 10)],
        // L'analyse attend le dossier de l'acheteur : son règlement, ses cahiers des charges.
        [phase('analyse-ao', 'file', 'indigo', 10, AO_KIND, ['RC', 'CCAP', 'CCTP'])],
        [phase('go-no-go', 'check', 'orange', 2)],
        [phase('redaction', 'edit', 'blue', 15, FREE_KIND, ['MEMOIRE']), phase('chiffrage', 'chart', 'teal', 10, FREE_KIND, ['BPU'])],
        [phase('remise', 'upload', 'violet', 1, FREE_KIND, ['AE'])],
        [phase('negociation', 'chat', 'rose', 15)],
        [phase('execution', 'play', 'green', 180)],
        [phase('cloture', 'lock', 'slate', 10)]
      ],
      spans: [
        { id: 'avant-vente', name: t('programmes.starter.span.avant-vente'), color: 'indigo', from: 0, to: 4 },
        { id: 'contrat', name: t('programmes.starter.span.contrat'), color: 'green', from: 5, to: 7 }
      ]
    },
    {
      id: 'projet-simple',
      name: t('programmes.starter.projet-simple'),
      icon: 'flow',
      color: 'teal',
      description: t('programmes.starter.projet-simple.desc'),
      stages: [[phase('lancement', 'play', 'teal', 5)], [phase('realisation', 'edit', 'blue', 30)], [phase('recette', 'check', 'orange', 10)], [phase('cloture', 'lock', 'slate', 5)]]
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

/** Une phase réécrite tout entière (ce qu'on n'a plus — une durée, des documents — disparaît). */
export function replacePhase(type: ProjectType, id: string, fields: Omit<PhaseSpec, 'id'>): ProjectType {
  return { ...type, stages: type.stages.map((list) => list.map((phase) => (phase.id === id ? { ...fields, id } : phase))) }
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

// ── Les phases englobantes ──────────────────────────────────────────────────────────

const spanIds = (type: ProjectType): string[] => [...(type.spans ?? []).map((span) => span.id), ...allPhaseIds(type)]

/** Une phase englobante de plus (de l'étape `from` à `to`, à partir de 0). */
export function addSpan(type: ProjectType, fields: Omit<SpanSpec, 'id'>): ProjectType {
  const span: SpanSpec = { ...fields, id: freeId(slug(fields.name), spanIds(type)) }
  return { ...type, spans: [...(type.spans ?? []), span] }
}

export function updateSpan(type: ProjectType, id: string, patch: Partial<Omit<SpanSpec, 'id'>>): ProjectType {
  return { ...type, spans: (type.spans ?? []).map((span) => (span.id === id ? { ...span, ...patch } : span)) }
}

export function removeSpan(type: ProjectType, id: string): ProjectType {
  const spans = (type.spans ?? []).filter((span) => span.id !== id)
  const next: ProjectType = { ...type, spans }
  if (!spans.length) delete next.spans
  return next
}

/**
 * Les phases englobantes d'un type, suivies après qu'on a changé ses étapes (une phase
 * déplacée, une étape ajoutée ou disparue) : chacune couvre toujours les phases qu'elle
 * couvrait — de l'étape de la première à celle de la dernière ; plus aucune : elle disparaît.
 */
export function remapSpans(before: ProjectType, after: ProjectType): ProjectType {
  if (!before.spans?.length) return after
  const stageOf = new Map<string, number>()
  after.stages.forEach((stage, at) => stage.forEach((phase) => stageOf.set(phase.id, at)))
  const spans = before.spans
    .map((span): SpanSpec | null => {
      const covered = before.stages.slice(span.from, span.to + 1).flat()
      const now = covered.map((phase) => stageOf.get(phase.id)).filter((at): at is number => at !== undefined)
      if (!now.length) return null
      return { ...span, from: Math.min(...now), to: Math.max(...now) }
    })
    .filter((span): span is SpanSpec => span !== null)
  const next: ProjectType = { ...after, spans }
  if (!spans.length) delete next.spans
  return next
}

// ── Les répertoires des documents d'un type ─────────────────────────────────────────

/** Tous les identifiants de répertoires d'un arbre. */
const folderIds = (folders: readonly FolderSpec[]): string[] => folders.flatMap((folder) => [folder.id, ...folderIds(folder.children ?? [])])

/** Un arbre de répertoires, chacun passé par `change` (qui rend le répertoire changé, ou `null` pour le retirer). */
const mapFolders = (folders: readonly FolderSpec[], change: (folder: FolderSpec) => FolderSpec | null): FolderSpec[] =>
  folders.flatMap((folder) => {
    const changed = change(folder)
    if (!changed) return []
    const children = mapFolders(changed.children ?? [], change)
    const next: FolderSpec = { ...changed }
    if (children.length) next.children = children
    else delete next.children
    return [next]
  })

/** Ajouter un répertoire à un type : à la racine (`parent` vide) ou dans un autre. */
export function addFolder(type: ProjectType, parent: string | null, name: string): ProjectType {
  const folder: FolderSpec = { id: freeId(slug(name), folderIds(type.folders ?? [])), name }
  if (!parent) return { ...type, folders: [...(type.folders ?? []), folder] }
  return { ...type, folders: mapFolders(type.folders ?? [], (each) => (each.id === parent ? { ...each, children: [...(each.children ?? []), folder] } : each)) }
}

/** Changer un répertoire d'un type (son nom, ce qu'on y attend). */
export function updateFolder(type: ProjectType, id: string, patch: Partial<Pick<FolderSpec, 'name' | 'expects'>>): ProjectType {
  return {
    ...type,
    folders: mapFolders(type.folders ?? [], (each) => {
      if (each.id !== id) return each
      const next: FolderSpec = { ...each, ...patch }
      if (!next.expects?.length) delete next.expects
      return next
    })
  }
}

/** Retirer un répertoire d'un type, et ses sous-répertoires. */
export function removeFolder(type: ProjectType, id: string): ProjectType {
  const folders = mapFolders(type.folders ?? [], (each) => (each.id === id ? null : each))
  const next: ProjectType = { ...type, folders }
  if (!folders.length) delete next.folders
  return next
}

/** Un répertoire d'un type, par son identifiant. */
export function findFolder(folders: readonly FolderSpec[], id: string): FolderSpec | null {
  for (const folder of folders) {
    if (folder.id === id) return folder
    const inside = findFolder(folder.children ?? [], id)
    if (inside) return inside
  }
  return null
}
