// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module Analyse d'appels d'offres (AO).
 *
 * Étape 2 : créer une analyse, y importer le dossier de consultation (fichiers et
 * archives ZIP), ou y déposer les fichiers à la main, puis lire, typer et décrire chaque
 * pièce. Les étapes suivantes du plan d'intégration (docs/plan-integration.md) ajoutent
 * les exigences, leur qualité, l'IA et les livrables.
 */

import { cleanFolder } from '../../core/settings'
import { fillTemplate } from '../../core/docs'
import type { BlackModule, MappingField, ModuleContext, ModuleDetails, ModuleFeature, TextField } from '../../core/modules/module'
import { LECTURE_FICHIERS } from '../lecture-fichiers'
import page from "./doc/Analyse d'appels d'offres.md"
import { aoEn, aoFr } from './i18n'
import { ORIGINALS, PIECES, POSITIONS, safeName, type Analysis, type Position } from './notes'
import {
  keywordTargets,
  NAME_KEYWORDS_KEY,
  normalizeKeyword,
  normalizeLabel,
  normalizeTypeCode,
  readCustomKeywords,
  readCustomTypes,
  readNameKeywords,
  readTitleKeywords,
  TITLE_KEYWORDS_KEY,
  TYPES_KEY,
  validateKeyword,
  validateType
} from './keywords'
import { allTypes, NO_CUSTOM_KEYWORDS, OTHER, typeLabel, type CustomKeywords } from './pieces'
import { typesMarkdown } from './typesDoc'
import {
  AnalysisExists,
  analysisOf,
  createAnalysis,
  importFiles,
  listAnalyses,
  localToday,
  pieceAt,
  setPieceType,
  updateAnalysis,
  type ImportReport,
  type Services
} from './service'

// ── Interface publique ────────────────────────────────────────────────────────────
export {
  analysisOf,
  createAnalysis,
  importFiles,
  listAnalyses,
  pieceAt,
  refreshTable,
  setPieceType,
  updateAnalysis,
  type ImportReport,
  type Services
} from './service'
export { classifyPiece, PIECE_TYPES } from './pieces'
export { type Analysis, type ReadingState } from './notes'

export const AO = 'ao'
export const ROOT_KEY = 'dossier'
export const DEFAULT_ROOT = "Appels d'offres"

const rootField: TextField = {
  kind: 'text',
  key: ROOT_KEY,
  nameKey: 'ao.setting.root',
  descKey: 'ao.setting.root.desc',
  tooltipKey: 'ao.setting.root.tip',
  defaultValue: DEFAULT_ROOT,
  normalize: cleanFolder
}

/** Le réglage « Types de pièces personnalisés » : code → libellé. */
const typesField: MappingField = {
  kind: 'mapping',
  key: TYPES_KEY,
  nameKey: 'ao.types.custom',
  descKey: 'ao.types.custom.desc',
  placeholderKey: 'ao.types.custom.placeholder',
  prefix: '',
  connectorKey: 'ao.types.custom.connector',
  valueKind: 'text',
  valuePlaceholderKey: 'ao.types.custom.labelPlaceholder',
  normalizeValue: normalizeLabel,
  tooltipKeys: {
    from: 'ao.types.custom.tip.code',
    to: 'ao.types.custom.tip.label',
    add: 'ao.types.custom.tip.add',
    remove: 'ao.types.custom.tip.remove'
  },
  options: () => [],
  normalize: normalizeTypeCode,
  validate: (code, label, current) => validateType(code, label, current),
  read: readCustomTypes
}

/** Un réglage « mot-clé → type » : pour le nom du fichier, ou pour le titre du document. */
function keywordsField(where: 'names' | 'titles'): MappingField {
  const name = where === 'names'
  return {
    kind: 'mapping',
    key: name ? NAME_KEYWORDS_KEY : TITLE_KEYWORDS_KEY,
    nameKey: name ? 'ao.keywords.names' : 'ao.keywords.titles',
    descKey: name ? 'ao.keywords.names.desc' : 'ao.keywords.titles.desc',
    placeholderKey: name ? 'ao.keywords.names.placeholder' : 'ao.keywords.titles.placeholder',
    prefix: '',
    connectorKey: 'ao.keywords.connector',
    tooltipKeys: {
      from: 'ao.keywords.tip.from',
      to: 'ao.keywords.tip.to',
      add: 'ao.keywords.tip.add',
      remove: 'ao.keywords.tip.remove'
    },
    options: (settings) => keywordTargets(readCustomTypes(settings)),
    defaultOption: 'CCTP',
    optionLabel: (code, settings, t) => typeLabel(code, readCustomKeywords(settings), t),
    normalize: normalizeKeyword,
    validate: (keyword, code, current, settings) => validateKeyword(where, keyword, code, current, readCustomTypes(settings)),
    read: name ? readNameKeywords : readTitleKeywords
  }
}

const feature = (key: string, status: ModuleFeature['status'], step?: number): ModuleFeature => ({
  labelKey: `ao.feature.${key}`,
  noteKey: `ao.feature.${key}.note`,
  status,
  ...(step === undefined ? {} : { step })
})

/**
 * Ce que le module sait faire, et ce qui arrive : la fenêtre « Fonctions ». Les types de
 * pièces y montrent aussi les mots-clés ajoutés par l'utilisateur.
 */
export function aoFeatures(custom: CustomKeywords = NO_CUSTOM_KEYWORDS): ModuleDetails {
  const added = (keywords: Readonly<Record<string, string>>, code: string) =>
    Object.keys(keywords).filter((keyword) => keywords[keyword] === code)
  return {
  titleKey: 'ao.details.title',
  introKey: 'ao.details.intro',
  sections: [
    {
      titleKey: 'ao.feature.section.dossier',
      features: [
        feature('create', 'available'),
        feature('import', 'available'),
        feature('drop', 'available'),
        feature('classify', 'available'),
        feature('notes', 'available')
      ]
    },
    {
      // Les types de pièces et ce qui les fait reconnaître, tirés de la liste même que la
      // reconnaissance applique.
      titleKey: 'ao.types.section',
      introKey: 'ao.types.intro',
      kind: 'reference',
      tagPrefix: '',
      features: allTypes(custom).map((each) => ({
        prefix: each.code,
        labelKey: each.labelKey,
        ...(each.label === undefined ? {} : { vars: { label: each.label } }),
        status: 'available' as const,
        tagGroups: [
          { labelKey: 'ao.types.byName', tags: each.names },
          { labelKey: 'ao.types.byTitle', tags: each.titles },
          { labelKey: 'ao.types.addedName', tags: added(custom.names, each.code) },
          { labelKey: 'ao.types.addedTitle', tags: added(custom.titles, each.code) }
        ],
        ...(each.code === OTHER ? { noteKey: 'ao.types.other' } : each.custom ? { noteKey: 'ao.types.customNote' } : {})
      }))
    },
    {
      titleKey: 'ao.feature.section.requirements',
      features: [feature('extract', 'in-progress', 4), feature('reqif', 'in-progress', 4), feature('quality', 'in-progress', 5)]
    },
    {
      titleKey: 'ao.feature.section.ai',
      features: [feature('review', 'in-progress', 6), feature('deadlines', 'in-progress', 6), feature('ask', 'in-progress', 6)]
    },
    {
      titleKey: 'ao.feature.section.deliverables',
      features: [
        feature('matrix', 'in-progress', 7),
        feature('report', 'in-progress', 7),
        feature('summary', 'in-progress', 7),
        feature('compare', 'in-progress', 7)
      ]
    }
  ]
  }
}

function rootOf(settings: Readonly<Record<string, unknown>>): string {
  const value = settings[ROOT_KEY]
  return (typeof value === 'string' && cleanFolder(value)) || DEFAULT_ROOT
}

function servicesFor(context: ModuleContext): Services {
  return {
    fs: context.platform.fs,
    t: (key, vars) => context.i18n.t(key, vars),
    root: rootOf(context.settings.get()),
    today: localToday,
    keywords: readCustomKeywords(context.settings.get())
  }
}

/** Ce qu'un import a donné, en une phrase ou deux. */
function describeImport(context: ModuleContext, report: ImportReport): string {
  const t = (key: string, vars?: Record<string, string | number>) => context.i18n.t(key, vars)
  const count = (state: string) => report.imported.filter((piece) => piece.state === state).length
  const parts = [t('ao.import.done', { count: report.imported.length, read: count('lue') })]
  const unread = report.imported.length - count('lue')
  if (unread > 0) parts.push(t('ao.import.unread', { count: unread }))
  if (report.archives > 0) parts.push(t('ao.import.archives', { count: report.archives }))
  if (report.duplicates.length > 0) parts.push(t('ao.import.duplicates', { count: report.duplicates.length }))
  if (report.brokenArchives.length > 0) parts.push(t('ao.import.broken', { files: report.brokenArchives.join(', ') }))
  return parts.join(' ')
}

/** L'analyse visée : celle de la note ouverte, sinon celle que l'utilisateur choisit. */
async function chooseAnalysis(context: ModuleContext, services: Services): Promise<Analysis | null> {
  const { ui, notifier } = context.platform
  const t = services.t
  const current = await analysisOf(services, ui.activeNote())
  if (current) return current
  const analyses = await listAnalyses(services)
  if (analyses.length === 0) {
    notifier.notify(t('ao.none', { folder: services.root }), 8000)
    return null
  }
  if (analyses.length === 1) return analyses[0]!
  const chosen = await ui.pickOption(
    analyses.map((analysis) => ({ value: analysis.name, label: analysis.name, description: analysis.folder })),
    t('ao.pick.analysis')
  )
  return analyses.find((analysis) => analysis.name === chosen) ?? null
}

async function importInto(context: ModuleContext, services: Services, analysis: Analysis): Promise<void> {
  const { ui, notifier } = context.platform
  // Tous les fichiers : un dossier contient aussi des plans ou des images, gardés même
  // s'ils ne se lisent pas encore.
  const files = await ui.pickExternalFiles({ multiple: true })
  if (files.length === 0) return
  notifier.notify(services.t('ao.import.reading', { count: files.length }), 3000)
  const report = await importFiles(services, analysis, files)
  notifier.notify(describeImport(context, report), 10000)
  await ui.openNote(analysis.note)
}

export const aoModule: BlackModule = {
  id: AO,
  nameKey: 'ao.name',
  descriptionKey: 'ao.description',
  version: '0.3.3',
  // Les pièces du dossier sont lues par le module Lecture de fichiers.
  requires: [LECTURE_FICHIERS],
  texts: { fr: aoFr, en: aoEn },
  details: (settings) => aoFeatures(readCustomKeywords(settings)),
  settingsFields: [rootField, typesField, keywordsField('names'), keywordsField('titles')],
  docs: ({ folder, t, settings }) => [
    {
      path: "Modules/Analyse d'appels d'offres.md",
      content: fillTemplate(page, folder, { types: typesMarkdown(t, readCustomKeywords(settings)) })
    }
  ],
  activate(context) {
    const { commands, platform, i18n } = context
    const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)

    commands.register({
      id: 'nouvelle-analyse',
      nameKey: 'ao.command.create',
      async run() {
        const services = servicesFor(context)
        const values = await platform.ui.askForm({
          title: t('ao.form.title'),
          intro: t('ao.form.intro', { folder: services.root }),
          fields: [
            {
              kind: 'text',
              key: 'name',
              label: t('ao.form.name'),
              placeholder: t('ao.form.name.placeholder'),
              tooltip: t('ao.form.name.tip'),
              required: true
            },
            {
              kind: 'choice',
              key: 'position',
              label: t('ao.form.position'),
              tooltip: t('ao.form.position.tip'),
              options: POSITIONS.map((position) => ({ value: position, label: t(`ao.position.${position}`) }))
            },
            { kind: 'text', key: 'buyer', label: t('ao.form.buyer'), placeholder: t('ao.form.buyer.placeholder') },
            { kind: 'text', key: 'reference', label: t('ao.form.reference'), placeholder: t('ao.form.reference.placeholder') }
          ],
          submit: t('ao.form.submit'),
          submitTooltip: t('ao.form.submit.tip'),
          validate: (entered) => (safeName(entered.name ?? '') ? null : t('ao.form.name.invalid'))
        })
        if (!values) return
        const name = safeName(values.name ?? '')
        let analysis: Analysis
        try {
          analysis = await createAnalysis(services, name, {
            position: (POSITIONS.includes(values.position as Position) ? values.position : 'candidat') as Position,
            buyer: (values.buyer ?? '').trim(),
            reference: (values.reference ?? '').trim()
          })
        } catch (error) {
          if (error instanceof AnalysisExists) {
            platform.notifier.notify(t('ao.exists', { name, folder: services.root }), 8000)
            return
          }
          throw error
        }
        await platform.ui.openNote(analysis.note)
        const next = await platform.ui.pickOption(
          [
            { value: 'import', label: t('ao.next.import'), description: t('ao.next.import.desc') },
            {
              value: 'drop',
              label: t('ao.next.drop'),
              description: t('ao.next.drop.desc', { folder: `${analysis.folder}/${PIECES}/${ORIGINALS}` })
            },
            { value: 'later', label: t('ao.next.later'), description: t('ao.next.later.desc') }
          ],
          t('ao.next.placeholder')
        )
        if (next === 'import') await importInto(context, services, analysis)
        else if (next === 'drop')
          platform.notifier.notify(t('ao.next.drop.notice', { folder: `${analysis.folder}/${PIECES}/${ORIGINALS}` }), 12000)
      }
    })

    commands.register({
      id: 'importer',
      nameKey: 'ao.command.import',
      async run() {
        const services = servicesFor(context)
        const analysis = await chooseAnalysis(context, services)
        if (analysis) await importInto(context, services, analysis)
      }
    })

    commands.register({
      id: 'mettre-a-jour',
      nameKey: 'ao.command.update',
      async run() {
        const services = servicesFor(context)
        const analysis = await chooseAnalysis(context, services)
        if (!analysis) return
        const report = await updateAnalysis(services, analysis)
        platform.notifier.notify(
          report.imported.length > 0 ? describeImport(context, report) : t('ao.update.nothing'),
          8000
        )
        await platform.ui.openNote(analysis.note)
      }
    })

    commands.register({
      id: 'type-piece',
      nameKey: 'ao.command.type',
      async run() {
        const services = servicesFor(context)
        const note = platform.ui.activeNote()
        const piece = note ? await pieceAt(services, note) : null
        if (!note || !piece) {
          platform.notifier.notify(t('ao.type.notPiece'), 6000)
          return
        }
        const custom = services.keywords ?? NO_CUSTOM_KEYWORDS
        const type = await platform.ui.pickOption(
          allTypes(custom).map((each) => ({
            value: each.code,
            label: `${each.code} — ${typeLabel(each.code, custom, t)}`,
            ...(each.code === piece.type
              ? { description: t('ao.type.current') }
              : each.custom
                ? { description: t('ao.type.custom') }
                : {})
          })),
          t('ao.type.placeholder')
        )
        if (!type || type === piece.type) return
        await setPieceType(services, note, type)
        platform.notifier.notify(t('ao.type.done', { type: `${type} — ${typeLabel(type, custom, t)}` }), 5000)
      }
    })
  }
}
