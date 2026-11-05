// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Montrer ce qu'un import ferait, puis le faire : la liste des exigences trouvées, chacune
 * avec ce qu'elle deviendra (nouvelle, mise à jour, inchangée, refusée) et l'endroit où
 * elle a été trouvée ; l'utilisateur coche ce qu'il prend. Rien n'est écrit avant.
 */

import type { Notifier, Ui } from '../../../core/ports'
import { idCategory } from '../model/reqId'
import type { RequirementStore } from '../store'
import { applyPlan, type ImportOutcome } from './apply'
import { countPlan, planCsvImport, type CsvPlanRow } from './csv'
import { settleLanguages, settleSpacing, type ReqLocation } from './document'
import type { Extraction } from './extract'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** L'endroit d'une exigence dans son document, en mots : « Article 2 — Exigences, tableau 1, ligne 2 ». */
export function describeLocation(where: ReqLocation | undefined, t: Translate): string {
  if (!where) return ''
  const heading = where.heading.replace(/\s+/g, ' ').trim()
  const place = (() => {
    switch (where.kind) {
      case 'table':
        return t('exigences.where.table', { table: where.index ?? 1, row: where.row ?? 1 })
      case 'paragraph':
        return where.index === undefined ? '' : t('exigences.where.paragraph', { index: where.index })
      case 'sheet':
        return where.sheet ? t('exigences.where.sheet', { sheet: where.sheet, row: where.row ?? 1 }) : t('exigences.where.line', { row: where.row ?? 1 })
      case 'object':
        return t('exigences.where.object', { index: where.index ?? 1 })
      case 'slide':
        return t('exigences.where.slide', { index: where.index ?? 1 })
    }
  })()
  return [heading, place].filter(Boolean).join(', ')
}

const excerpt = (text: string, size = 110) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > size ? `${flat.slice(0, size - 1)}…` : flat
}

export interface ImportRequest {
  ui: Ui
  notifier: Notifier
  t: Translate
  /** Où les exigences sont écrites (la bibliothèque, ou les exigences d'une analyse). */
  store: RequirementStore
  extraction: Extraction
  /** Le nom du fichier, pour les messages : « CCTP.pdf ». */
  name: string
  /** Le format, pour accorder les sauts de ligne d'un PDF. */
  extension: string
  /** La catégorie des exigences sans identifiant ; demandée si absente et nécessaire. */
  category?: string
  /** Ce que l'origine de chaque exigence nomme : un lien vers la note de la pièce, ou le nom du fichier. */
  piece: string
  /** Quand les lignes viennent de plusieurs pièces : la pièce de chacune, et son nom court pour l'aperçu. */
  pieceOf?: (index: number) => string
  labelOf?: (index: number) => string
  /** Quand les lignes viennent de plusieurs pièces : la catégorie des exigences sans identifiant, pour chacune. */
  categoryOf?: (index: number) => string
  /** Cocher d'avance les nouvelles et les mises à jour (oui par défaut). */
  preselect?: boolean
  /** Le titre de la fenêtre, à la place de « Exigences trouvées dans … ». */
  title?: string
}

export interface ImportReport {
  outcome: ImportOutcome
  plan: CsvPlanRow[]
}

/** La fenêtre d'aperçu, puis l'écriture ; `null` si rien n'a été trouvé ou si l'utilisateur renonce. */
export async function previewImport(request: ImportRequest): Promise<ImportReport | null> {
  const { ui, notifier, t, store, extraction, name } = request
  if (extraction.problem) {
    notifier.notify(t(`exigences.import.problem.${extraction.problem}`, { name }), 10000)
    return null
  }
  if (extraction.rows.length === 0) {
    notifier.notify(t('exigences.import.none', { name }), 12000)
    return null
  }
  const library = await store.all()
  let rows = settleLanguages(extraction.rows, library)
  if (request.extension === 'pdf') rows = settleSpacing(rows, library)
  const plan = planCsvImport(rows, library)
  const counts = countPlan(plan)
  const notes = [
    t('exigences.import.counts', { create: counts.create, update: counts.update, unchanged: counts.unchanged, invalid: counts.invalid }),
    ...(extraction.ignored.length ? [t('exigences.import.ignored', { names: extraction.ignored.join(', ') })] : []),
    ...(extraction.unmatched.length ? [t('exigences.import.unmatched', { values: extraction.unmatched.join(', ') })] : [])
  ]
  const chosen = await ui.pickMany({
    title: request.title ?? t('exigences.import.title', { name, count: plan.length }),
    intro: notes.join(' '),
    choices: plan.map((row, index) => {
      const body = Object.values(row.values.text)[0] ?? row.title
      return {
        value: String(index),
        label: `${request.labelOf ? `[${request.labelOf(index)}] ` : ''}${row.id || t('exigences.import.newId')} — ${excerpt(body)}`,
        description: [
          row.action === 'invalid' ? t(`exigences.import.invalid.${row.reason ?? 'no-wording'}`) : t(`exigences.import.action.${row.action}`),
          describeLocation(extraction.where[index], t)
        ]
          .filter(Boolean)
          .join(' · ')
      }
    }),
    selected:
      request.preselect === false
        ? []
        : plan.flatMap((row, index) => (row.action === 'create' || row.action === 'update' ? [String(index)] : [])),
    submit: t('exigences.import.submit')
  })
  if (!chosen || chosen.length === 0) return null

  // Une exigence sans identifiant en reçoit un, dans une catégorie : demandée si on n'en a pas.
  let category = request.category ?? ''
  const minted = chosen.some((value) => {
    const row = plan[Number(value)]
    return row?.action === 'create' && !row.values.category && !request.categoryOf?.(Number(value))
  })
  if (minted && !category) {
    const values = await ui.askForm({
      title: t('exigences.import.category.title'),
      intro: t('exigences.import.category.intro'),
      fields: [{ kind: 'text', key: 'category', label: t('exigences.field.category'), placeholder: 'GEN', required: true }],
      submit: t('exigences.import.submit')
    })
    if (!values) return null
    category = values.category ?? ''
  }

  const outcome = await applyPlan(store, plan, {
    chosen: new Set(chosen.map(Number)),
    by: '',
    lang: extraction.lang,
    category: idCategory(category || 'GEN'),
    ...(request.categoryOf ? { categoryOf: (index: number) => idCategory(request.categoryOf!(index) || category || 'GEN') } : {}),
    origin: (index) => ({ piece: request.pieceOf?.(index) ?? request.piece, locator: describeLocation(extraction.where[index], t) })
  })
  notifier.notify(
    [
      t('exigences.import.done', { name, created: outcome.created.length, updated: outcome.updated.length }),
      ...(outcome.failed.length ? [t('exigences.import.failed', { ids: outcome.failed.join(', ') })] : [])
    ].join(' '),
    10000
  )
  return { outcome, plan }
}
