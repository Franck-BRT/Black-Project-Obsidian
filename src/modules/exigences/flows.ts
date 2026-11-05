// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que l'utilisateur fait avec les exigences : en créer une, la modifier, parcourir la
 * bibliothèque, citer des exigences dans un document. Les fenêtres sont celles de la
 * plateforme (`ui.askForm`, `ui.pickFromList`…) : ces fonctions se testent sur un coffre
 * en mémoire.
 */

import type { AiClient } from '../ia'
import { reviewRequirement, translateRequirement } from './ai/actions'
import { localToday } from '../../core/dates'
import type { BlockRow, BlockView } from '../../core/modules/module'
import type { FormField, ListRow, ListState, Notifier, Ui } from '../../core/ports'
import { nameOwner, normalizeAlias } from './model/aliases'
import { isEmptySpec, parseReqBlock, quotedWording, resolveBlockFields, selectRequirements } from './model/block'
import { REQ_BLOCK_BREAK } from './model/blockFields'
import {
  hasSuspectLinks,
  isUnreviewedMachine,
  makeReqText,
  setText,
  staleLanguages,
  textOf,
  VERIFICATION_METHODS,
  type Requirement,
  type VerificationMethod
} from './model/requirement'
import { idCategory, knownCategories } from './model/reqId'
import type { ReqSettings } from './settings'
import { RequirementExists, type RequirementStore } from './store'
import { vocabularyChoices, vocabularyLabel } from './vocabulary'
import { describeFinding, stars } from './quality/report'
import { assessRequirement, isWeak } from './quality/score'

export type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface Session {
  store: RequirementStore
  ui: Ui
  notifier: Notifier
  t: Translate
  settings(): ReqSettings
  /** Le client du serveur d'IA ; `null` si le module IA n'est pas actif ou pas réglé. */
  ai?: () => AiClient | null
  /** Prévenu de chaque exigence créée (les workflows qui l'attendent). */
  created?: (requirement: Requirement) => Promise<void>
}

const list = (raw: string | undefined) =>
  (raw ?? '')
    .split(/[,;]/)
    .map((each) => each.trim())
    .filter((each) => each !== '')

const verificationOf = (raw: string | undefined): VerificationMethod =>
  VERIFICATION_METHODS.includes(raw as VerificationMethod) ? (raw as VerificationMethod) : 'none'

/** Les champs communs à la création et à la modification. */
function detailFields(t: Translate, current: Partial<Requirement>, lang: string): FormField[] {
  return [
    {
      kind: 'text',
      key: 'title',
      label: t('exigences.field.title'),
      placeholder: t('exigences.field.title.placeholder'),
      tooltip: t('exigences.field.title.tip'),
      required: true,
      value: current.title ?? ''
    },
    {
      kind: 'textarea',
      key: 'text',
      label: t('exigences.field.text', { lang: lang.toUpperCase() }),
      description: t('exigences.field.text.desc'),
      placeholder: t('exigences.field.text.placeholder'),
      required: true,
      value: current.text?.[lang]?.body ?? ''
    },
    {
      kind: 'choice',
      key: 'type',
      label: t('exigences.field.type'),
      options: vocabularyChoices('type', t, { empty: true, current: current.type ?? '' }),
      value: current.type ?? ''
    },
    {
      kind: 'choice',
      key: 'status',
      label: t('exigences.field.status'),
      options: vocabularyChoices('status', t, { current: current.status ?? '' }),
      value: current.status || 'draft'
    },
    {
      kind: 'choice',
      key: 'criticality',
      label: t('exigences.field.criticality'),
      options: vocabularyChoices('criticality', t, { empty: true, current: current.criticality ?? '' }),
      value: current.criticality ?? ''
    },
    {
      kind: 'choice',
      key: 'verification',
      label: t('exigences.field.verification'),
      tooltip: t('exigences.field.verification.tip'),
      options: vocabularyChoices('verification', t),
      value: current.verification ?? 'none'
    },
    {
      kind: 'text',
      key: 'source',
      label: t('exigences.field.source'),
      placeholder: t('exigences.field.source.placeholder'),
      tooltip: t('exigences.field.source.tip'),
      value: current.source ?? ''
    },
    {
      kind: 'textarea',
      key: 'rationale',
      label: t('exigences.field.rationale'),
      placeholder: t('exigences.field.rationale.placeholder'),
      value: current.rationale ?? ''
    }
  ]
}

/** Créer une exigence : le formulaire, l'identifiant attribué, la note écrite. Rend la note, ou `null`. */
export async function createRequirement(session: Session): Promise<Requirement | null> {
  const { store, ui, notifier, t } = session
  const settings = session.settings()
  const lang = settings.languages[0] ?? 'fr'
  const library = await store.all()
  const categories = knownCategories(
    settings.scheme,
    library.map((each) => each.id),
    settings.counters
  )
  const values = await ui.askForm({
    title: t('exigences.create.title'),
    intro: t('exigences.create.intro', { folder: settings.folder, prefix: settings.scheme.prefix }),
    fields: [
      {
        kind: 'text',
        key: 'category',
        label: t('exigences.field.category'),
        description: categories.length
          ? t('exigences.field.category.known', { categories: categories.join(', ') })
          : t('exigences.field.category.none'),
        placeholder: 'SYS',
        tooltip: t('exigences.field.category.tip'),
        required: true
      },
      ...detailFields(t, {}, lang)
    ],
    submit: t('exigences.create.submit')
  })
  if (!values) return null
  try {
    const created = await store.create({
      // Rangée comme elle figure dans l'identifiant : « sys » et « SYS » sont une seule catégorie.
      category: idCategory(values.category ?? ''),
      title: (values.title ?? '').trim(),
      type: values.type ?? '',
      status: values.status || 'draft',
      criticality: values.criticality ?? '',
      verification: verificationOf(values.verification),
      source: (values.source ?? '').trim(),
      rationale: (values.rationale ?? '').trim(),
      sourceLang: lang,
      text: { [lang]: makeReqText({ body: (values.text ?? '').trim() }) }
    })
    notifier.notify(t('exigences.create.done', { id: created.id }), 6000)
    await session.created?.(created)
    return created
  } catch (error) {
    if (error instanceof RequirementExists) {
      notifier.notify(t('exigences.create.exists', { path: error.path }), 8000)
      return null
    }
    throw error
  }
}

/**
 * Modifier la fiche d'une exigence : sa formulation source, ses attributs, ses mots-clés
 * et ses alias. Changer la formulation crée une révision ; le reste non. Rend le chemin
 * de la note (elle est renommée si le titre change), ou `null`.
 */
export async function editRequirement(session: Session, path: string): Promise<string | null> {
  const { store, ui, notifier, t } = session
  const current = await store.load(path)
  if (!current) {
    notifier.notify(t('exigences.notRequirement'), 6000)
    return null
  }
  const lang = current.sourceLang
  const library = await store.all()
  // La note et les défauts de rédaction, en tête de la fiche : ce qu'on vient corriger.
  const quality = assessRequirement(current, session.settings().languages)
  const defects = quality.findings.map((finding) => describeFinding(finding, t)).join(', ')
  const values = await ui.askForm({
    title: t('exigences.edit.title', { id: current.id }),
    intro: [
      t('exigences.edit.intro', { rev: current.rev, category: current.category || '—' }),
      t('exigences.edit.quality', {
        stars: stars(quality.stars),
        score: Math.round(quality.score * 100),
        defects: defects ? `${defects}.` : t('exigences.edit.quality.clean')
      })
    ].join(' '),
    fields: [
      ...detailFields(t, current, lang),
      {
        kind: 'text',
        key: 'owner',
        label: t('exigences.field.owner'),
        value: current.owner
      },
      {
        kind: 'text',
        key: 'tags',
        label: t('exigences.field.tags'),
        placeholder: t('exigences.field.tags.placeholder'),
        value: current.tags.join(', ')
      },
      {
        kind: 'text',
        key: 'aliases',
        label: t('exigences.field.aliases'),
        description: t('exigences.field.aliases.desc'),
        placeholder: 'OMLX-SYS-0001',
        value: current.aliases.join(', ')
      }
    ],
    submit: t('exigences.edit.submit'),
    validate: (entered) => {
      for (const alias of list(entered.aliases).map(normalizeAlias)) {
        const owner = nameOwner(library, alias, current.id)
        if (owner) return t('exigences.alias.taken', { alias, id: owner.id })
      }
      return null
    }
  })
  if (!values) return null
  const aliases = [...new Set(list(values.aliases).map(normalizeAlias).filter((alias) => alias && alias !== current.id.toUpperCase()))]
  const result = await store.save(path, (requirement) => {
    let next = setText(requirement, lang, (values.text ?? '').trim(), '')
    const fields = {
      title: (values.title ?? '').trim(),
      type: values.type ?? '',
      status: values.status ?? '',
      criticality: values.criticality ?? '',
      verification: verificationOf(values.verification),
      source: (values.source ?? '').trim(),
      rationale: (values.rationale ?? '').trim(),
      owner: (values.owner ?? '').trim(),
      tags: list(values.tags),
      aliases
    }
    const same =
      next === requirement &&
      (Object.keys(fields) as (keyof typeof fields)[]).every((key) => JSON.stringify(fields[key]) === JSON.stringify(requirement[key]))
    if (same) return requirement
    next = { ...next, ...fields, updatedAt: new Date().toISOString() }
    return next
  })
  if (!result) return null
  notifier.notify(t('exigences.edit.done', { id: result.requirement.id, rev: result.requirement.rev }), 5000)
  return result.path
}

/** Ce qui ne va pas avec une exigence, en quelques mots, pour la liste. */
function flagsOf(requirement: Requirement, languages: string[], t: Translate): string[] {
  const flags: string[] = []
  const stale = staleLanguages(requirement, languages)
  if (stale.length) flags.push(t('exigences.flag.stale', { langs: stale.join(', ').toUpperCase() }))
  if (Object.keys(requirement.text).some((lang) => isUnreviewedMachine(requirement, lang))) flags.push(t('exigences.flag.unreviewed'))
  if (hasSuspectLinks(requirement)) flags.push(t('exigences.flag.suspect'))
  return flags
}

/** Les lignes de la liste des exigences. */
export function listRows(library: readonly Requirement[], settings: ReqSettings, t: Translate): ListRow[] {
  return library.map((requirement) => {
    const quality = assessRequirement(requirement, settings.languages)
    return {
    id: requirement.filePath ?? requirement.id,
    cells: {
      rating: stars(quality.stars),
      id: requirement.id,
      title: requirement.title,
      text: textOf(requirement, requirement.sourceLang)?.body ?? '',
      type: vocabularyLabel('type', requirement.type, t),
      status: vocabularyLabel('status', requirement.status, t),
      criticality: vocabularyLabel('criticality', requirement.criticality, t)
    },
    values: {
      category: requirement.category,
      type: requirement.type,
      status: requirement.status,
      criticality: requirement.criticality,
      rating: isWeak(quality) ? 'weak' : 'good'
    },
    flags: flagsOf(requirement, settings.languages, t)
    }
  })
}

/**
 * La bibliothèque : une liste qu'on filtre (catégorie, type, statut, criticité) et qu'on
 * cherche. Une ligne choisie propose de modifier la fiche ou d'ouvrir la note ; la liste
 * revient ensuite, aux mêmes filtres. « Nouvelle exigence » en crée une.
 */
export async function browseRequirements(session: Session): Promise<void> {
  const { store, ui, t } = session
  let state: ListState | undefined
  for (;;) {
    const settings = session.settings()
    const library = await store.all()
    const categories = [...new Set(library.map((each) => each.category).filter(Boolean))].sort()
    const answer = await ui.pickFromList({
      title: t('exigences.list.title', { count: library.length }),
      intro: t('exigences.list.intro', { folder: settings.folder }),
      columns: [
        { key: 'id', label: t('exigences.column.id'), width: 'narrow' },
        { key: 'title', label: t('exigences.column.title') },
        { key: 'text', label: t('exigences.column.text'), width: 'wide' },
        { key: 'type', label: t('exigences.column.type'), width: 'narrow' },
        { key: 'status', label: t('exigences.column.status'), width: 'narrow' },
        { key: 'criticality', label: t('exigences.column.criticality'), width: 'narrow' },
        { key: 'rating', label: t('exigences.column.ratingShort'), width: 'narrow' }
      ],
      rows: listRows(library, settings, t),
      filters: [
        { key: 'category', label: t('exigences.filter.category'), options: categories.map((value) => ({ value, label: value })) },
        { key: 'type', label: t('exigences.filter.type'), options: vocabularyChoices('type', t) },
        { key: 'status', label: t('exigences.filter.status'), options: vocabularyChoices('status', t) },
        { key: 'criticality', label: t('exigences.filter.criticality'), options: vocabularyChoices('criticality', t) },
        {
          key: 'rating',
          label: t('exigences.filter.rating'),
          options: [
            { value: 'weak', label: t('exigences.filter.rating.weak') },
            { value: 'good', label: t('exigences.filter.rating.good') }
          ]
        }
      ],
      searchPlaceholder: t('exigences.list.search'),
      empty: library.length ? t('exigences.list.noMatch') : t('exigences.list.empty'),
      actions: [{ value: 'new', label: t('exigences.list.new'), cta: true, tooltip: t('exigences.list.new.tip') }],
      ...(state ? { state } : {})
    })
    if (!answer) return
    state = answer.state
    if (answer.kind === 'action') {
      await createRequirement(session)
      continue
    }
    const requirement = library.find((each) => (each.filePath ?? each.id) === answer.id)
    if (!requirement?.filePath) continue
    const next = await ui.pickOption(
      [
        { value: 'edit', label: t('exigences.row.edit'), description: t('exigences.row.edit.desc') },
        { value: 'open', label: t('exigences.row.open'), description: t('exigences.row.open.desc') },
        ...(session.ai
          ? [
              { value: 'review', label: t('exigences.row.review'), description: t('exigences.row.review.desc') },
              { value: 'translate', label: t('exigences.row.translate'), description: t('exigences.row.translate.desc') }
            ]
          : []),
        { value: 'back', label: t('exigences.row.back') }
      ],
      `${requirement.id} — ${requirement.title}`
    )
    if (next === 'edit') await editRequirement(session, requirement.filePath)
    else if (next === 'review' || next === 'translate') {
      const client = session.ai?.() ?? null
      if (!client) session.notifier.notify(t('ia.unavailable'), 10000)
      else if (next === 'review') await reviewRequirement(session, client, requirement.filePath, localToday())
      else await translateRequirement(session, client, requirement.filePath)
    }
    else if (next === 'open') {
      await ui.openNote(requirement.filePath)
      return
    }
  }
}

/**
 * Un bloc `brt-req` dessiné : les exigences citées, leur formulation et son état. Un
 * identifiant introuvable, une clé inconnue ou un bloc vide sont dits, jamais tus.
 */
export async function renderBlock(session: Session, source: string): Promise<BlockView> {
  const { store, t } = session
  const settings = session.settings()
  const spec = parseReqBlock(source)
  const messages: string[] = []
  if (spec.unknown.length) messages.push(t('exigences.block.unknown', { keys: spec.unknown.join(', ') }))
  if (isEmptySpec(spec)) {
    messages.push(t('exigences.block.empty'))
    return { columns: [], rows: [], messages }
  }
  const result = selectRequirements(spec, await store.all())
  if (result.missing.length) messages.push(t('exigences.block.missing', { ids: result.missing.join(', ') }))
  const fields = resolveBlockFields(spec.fields, settings.blockFields).filter((field) => field !== REQ_BLOCK_BREAK)
  const rows: BlockRow[] = result.rows.map(({ requirement, citedAs }) => {
    const wording = quotedWording(requirement, spec.lang)
    const flags: string[] = []
    if (wording?.fallback) flags.push(t('exigences.block.fallback', { lang: spec.lang.toUpperCase(), source: wording.lang.toUpperCase() }))
    if (wording?.stale) flags.push(t('exigences.block.stale'))
    if (wording?.unreviewed) flags.push(t('exigences.block.unreviewed'))
    const cell = (field: string): string => {
      switch (field) {
        case 'id':
          return citedAs === requirement.id.toUpperCase() ? requirement.id : `${citedAs} (${requirement.id})`
        case 'title':
          return requirement.title
        case 'text':
          return wording?.body ?? '—'
        case 'type':
          return vocabularyLabel('type', requirement.type, t)
        case 'status':
          return vocabularyLabel('status', requirement.status, t)
        case 'criticality':
          return vocabularyLabel('criticality', requirement.criticality, t)
        case 'verification':
          return vocabularyLabel('verification', requirement.verification, t)
        case 'rating':
          return stars(assessRequirement(requirement, settings.languages).stars)
        default:
          return '—'
      }
    }
    return {
      cells: fields.map(cell),
      ...(flags.length ? { flags } : {}),
      ...(requirement.filePath ? { link: requirement.filePath } : {})
    }
  })
  return {
    columns: fields.map((field) => t(`exigences.column.${field}`)),
    rows,
    messages,
    empty: t('exigences.block.nothing')
  }
}
