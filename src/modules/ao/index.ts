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
import type {
  BlackModule,
  BooleanField,
  ModuleContext,
  ModuleDetails,
  ModuleFeature,
  TextField,
  TogglesField
} from '../../core/modules/module'
import type { FormField } from '../../core/ports'
import { canExtract, EXIGENCES } from '../exigences'
import { extensionOf, LECTURE_FICHIERS } from '../lecture-fichiers'
import {
  allTypes,
  annotateTypes,
  currentTyping,
  extendTypeExchange,
  isDisabled,
  OTHER,
  onTypingChange,
  TYPAGE_PIECES,
  typeLabel
} from '../typage-pieces'
import page from "./doc/Analyse d'appels d'offres.md"
import { aoEn, aoFr } from './i18n'
import {
  destinationLabel,
  placeOriginals,
  POSITIONS,
  safeName,
  type Analysis,
  type Destination,
  type Position
} from './notes'
import {
  columnsPlace,
  migratePlaces,
  PLACES,
  placeColumns,
  placementMessage,
  placeOf,
  RANGEMENT_KEY,
  REMINDER_KEY,
  WELCOME_KEY,
  rangementOf,
  readRangement,
  renameRangement,
  type Place
} from './placement'
import {
  AnalysisExists,
  applyRenames,
  analysisOf,
  createAnalysis,
  analysisPosition,
  importFiles,
  listAnalyses,
  listCandidates,
  listPieces,
  localToday,
  movePiece,
  pieceAt,
  setPieceType,
  updateAnalysis,
  type ImportReport,
  type PlacementRequest,
  type PlacementResolver,
  type Services
} from './service'
import { extractFromPiece, refreshRequirements } from './requirements'
import { checkCoherence, checkCoverage, extractAll, findMissed, reportPath, verifyAll } from './verification'

// ── Interface publique ────────────────────────────────────────────────────────────
export {
  analysisOf,
  createAnalysis,
  importFiles,
  listAnalyses,
  movePiece,
  pieceAt,
  refreshTable,
  setPieceType,
  updateAnalysis,
  type ImportReport,
  type Placement,
  type PlacementRequest,
  type Services
} from './service'
export { type Analysis, type Destination, type ReadingState } from './notes'
export { placeOf, RANGEMENT_KEY, rangementOf, REMINDER_KEY, WELCOME_KEY, type Place } from './placement'

let cleanups: (() => void)[] = []

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

/**
 * Où va chaque type de pièce : une petite fenêtre pour ajouter un type et choisir où il
 * va, puis la liste dépliable, un interrupteur « Appel d'offres » et un « Réponse » par
 * type. Les deux allumés : la question est posée à l'import. Un type absent de la liste
 * aussi.
 */
export const rangementField: TogglesField = {
  kind: 'toggles',
  key: RANGEMENT_KEY,
  nameKey: 'ao.setting.places',
  descKey: 'ao.setting.places.desc',
  columns: [
    { id: 'appel-d-offres', labelKey: 'ao.setting.places.col.tender', tooltipKey: 'ao.setting.places.tender.tip' },
    { id: 'reponse', labelKey: 'ao.setting.places.col.response', tooltipKey: 'ao.setting.places.response.tip' }
  ],
  read: (settings) =>
    Object.fromEntries(Object.entries(rangementOf(settings)).map(([code, place]) => [code, placeColumns(place)])),
  candidates: (settings) => {
    const listed = rangementOf(settings)
    return allTypes()
      .filter((each) => each.code !== OTHER && !(each.code in listed))
      .map((each) => each.code)
  },
  itemLabel: (code, _settings, t) => `${code} — ${typeLabel(code, t)}${isDisabled(code) ? ` (${t('ao.setting.places.disabled')})` : ''}`,
  write: (settings, code, columns) => {
    const rangement: Record<string, string> = readRangement(settings)
    const place = columns ? columnsPlace(columns) : null
    if (place) rangement[code] = place
    else delete rangement[code]
    return { ...settings, [RANGEMENT_KEY]: rangement }
  },
  defaultColumns: ['appel-d-offres'],
  addKey: 'ao.setting.places.add',
  addTitleKey: 'ao.setting.places.addTitle',
  addIntroKey: 'ao.setting.places.addIntro',
  itemFieldKey: 'ao.setting.places.type',
  listKey: 'ao.setting.places.list',
  emptyKey: 'ao.setting.places.empty',
  noCandidateKey: 'ao.setting.places.none',
  minimumKey: 'ao.setting.places.minimum',
  tooltipKeys: {
    add: 'ao.setting.places.add.tip',
    list: 'ao.setting.places.list.tip',
    remove: 'ao.setting.places.remove.tip'
  }
}

/** Couper (ou rétablir) le rappel à l'ouverture, tant qu'aucun type n'est rangé. */
export const reminderField: BooleanField = {
  kind: 'boolean',
  key: REMINDER_KEY,
  nameKey: 'ao.setting.reminder',
  descKey: 'ao.setting.reminder.desc',
  tooltipKey: 'ao.setting.reminder.tip',
  defaultValue: true
}

/**
 * À l'activation du module, puis à chaque ouverture tant qu'aucun type n'est rangé :
 * expliquer ce qu'il faut faire, et proposer d'ouvrir la fenêtre du module. Le rappel
 * se coupe d'une case, ou dans la fenêtre du module.
 */
export async function explainPlacement(context: ModuleContext): Promise<void> {
  const kind = placementMessage(context.settings.get())
  if (!kind) return
  const t = (key: string) => context.i18n.t(key)
  const answer = await context.platform.ui.inform({
    title: t(`ao.message.${kind}.title`),
    message: t(`ao.message.${kind}`),
    actions: [
      { value: 'later', label: t('ao.message.later') },
      ...(context.openWindow ? [{ value: 'open', label: t('ao.message.open'), cta: true }] : [])
    ],
    ...(kind === 'reminder' ? { option: { label: t('ao.message.stop'), value: false, tooltip: t('ao.message.stop.tip') } } : {})
  })
  await context.settings.save({
    ...context.settings.get(),
    [WELCOME_KEY]: true,
    ...(answer.option ? { [REMINDER_KEY]: false } : {})
  })
  if (answer.action === 'open') context.openWindow?.()
}

const feature = (key: string, status: ModuleFeature['status'], step?: number): ModuleFeature => ({
  labelKey: `ao.feature.${key}`,
  noteKey: `ao.feature.${key}.note`,
  status,
  ...(step === undefined ? {} : { step })
})

/**
 * Ce que le module sait faire, et ce qui arrive : la fenêtre « Fonctions ». Les types de
 * pièces sont dans celle du module Typage des pièces.
 */
export function aoFeatures(): ModuleDetails {
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
          feature('place', 'available'),
          feature('notes', 'available')
        ]
      },
      {
        titleKey: 'ao.feature.section.requirements',
        features: [
          feature('extract', 'available'),
          feature('reqif', 'available'),
          feature('trace', 'available'),
          feature('verify', 'available'),
          feature('quality', 'in-progress', 5)
        ]
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
    rangement: rangementOf(context.settings.get())
  }
}

/** Ce qu'un import a donné, en une phrase ou deux. */
function describeImport(context: ModuleContext, report: ImportReport): string {
  const t = (key: string, vars?: Record<string, string | number>) => context.i18n.t(key, vars)
  const count = (state: string) => report.imported.filter((piece) => piece.state === state).length
  const parts = [t('ao.import.done', { count: report.imported.length, read: count('lue') })]
  const toResponse = report.imported.filter((piece) => piece.destination.place === 'reponse').length
  if (toResponse > 0) parts.push(t('ao.import.places', { tender: report.imported.length - toResponse, response: toResponse }))
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

const NEW_CANDIDATE = '__nouveau__'

/**
 * La fenêtre qui demande, en une fois pour tout l'import, où ranger les pièces dont le type
 * va « dans les deux » — avec l'appel d'offres ou avec la réponse —, et, pour l'émetteur,
 * de quel candidat est la réponse.
 */
function placementResolver(context: ModuleContext): PlacementResolver {
  const { ui } = context.platform
  const t = (key: string, vars?: Record<string, string | number>) => context.i18n.t(key, vars)
  const places = [
    { value: 'appel-d-offres', label: t('ao.place.tender') },
    { value: 'reponse', label: t('ao.place.response') }
  ]
  return async (request: PlacementRequest) => {
    const emitter = request.position === 'emetteur'
    const fields: FormField[] = []
    if (request.pending.length > 1) {
      fields.push({
        kind: 'choice',
        key: 'all',
        label: t('ao.ask.all'),
        tooltip: t('ao.ask.all.tip'),
        options: [{ value: 'case', label: t('ao.ask.case') }, ...places]
      })
    }
    for (const [index, piece] of request.pending.entries()) {
      const name = piece.path.slice(piece.path.lastIndexOf('/') + 1)
      fields.push({
        kind: 'choice',
        key: `p${index}`,
        label: name,
        description: `${piece.type} — ${typeLabel(piece.type, t)}${piece.path !== name ? ` · ${piece.path}` : ''}`,
        options: places
      })
    }
    if (emitter) {
      fields.push({
        kind: 'choice',
        key: 'candidate',
        label: t('ao.ask.candidate'),
        tooltip: t('ao.ask.candidate.tip'),
        options: [
          ...request.candidates.map((candidate) => ({ value: candidate, label: candidate })),
          { value: NEW_CANDIDATE, label: t('ao.ask.candidate.new') }
        ]
      })
      fields.push({ kind: 'text', key: 'newCandidate', label: t('ao.ask.candidate.name'), placeholder: t('ao.ask.candidate.placeholder') })
    }
    const placeOf = (values: Readonly<Record<string, string>>, index: number) =>
      (values.all && values.all !== 'case' ? values.all : values[`p${index}`]) === 'reponse' ? 'reponse' : 'appel-d-offres'
    const values = await ui.askForm({
      title: t('ao.ask.title'),
      intro: emitter ? t('ao.ask.intro.emitter') : t('ao.ask.intro'),
      fields,
      submit: t('ao.ask.submit'),
      validate: (entered) => {
        const toResponse = request.responseCertain || request.pending.some((_, index) => placeOf(entered, index) === 'reponse')
        if (emitter && toResponse && entered.candidate === NEW_CANDIDATE && !(entered.newCandidate ?? '').trim()) {
          return t('ao.ask.candidate.missing')
        }
        return null
      }
    })
    if (!values) return null
    return {
      places: Object.fromEntries(request.pending.map((piece, index) => [piece.path, placeOf(values, index)])),
      ...(emitter
        ? { candidate: values.candidate === NEW_CANDIDATE || !values.candidate ? (values.newCandidate ?? '').trim() : values.candidate }
        : {})
    }
  }
}

async function importInto(context: ModuleContext, services: Services, analysis: Analysis): Promise<void> {
  const { ui, notifier } = context.platform
  // Tous les fichiers : un dossier contient aussi des plans ou des images, gardés même
  // s'ils ne se lisent pas encore.
  const files = await ui.pickExternalFiles({ multiple: true })
  if (files.length === 0) return
  notifier.notify(services.t('ao.import.reading', { count: files.length }), 3000)
  const report = await importFiles(services, analysis, files, placementResolver(context))
  if (report.cancelled) {
    notifier.notify(services.t('ao.import.cancelled'), 6000)
    return
  }
  notifier.notify(describeImport(context, report), 10000)
  await ui.openNote(analysis.note)
}

export const aoModule: BlackModule = {
  id: AO,
  nameKey: 'ao.name',
  descriptionKey: 'ao.description',
  version: '0.6.0',
  // Les pièces sont lues par le module Lecture de fichiers, typées par Typage des pièces ;
  // leurs exigences sont extraites et rangées par le module Exigences.
  requires: [LECTURE_FICHIERS, TYPAGE_PIECES, EXIGENCES],
  texts: { fr: aoFr, en: aoEn },
  details: () => aoFeatures(),
  settingsFields: [rootField, rangementField, reminderField],
  // En 0.4.1, la place d'un type se choisissait dans le module de typage : reprise ici.
  migrateSettings: (modules) => migratePlaces(modules, AO, TYPAGE_PIECES),
  docs: ({ folder }) => [{ path: "Modules/Analyse d'appels d'offres.md", content: fillTemplate(page, folder) }],
  activate(context) {
    const { commands, platform, i18n } = context
    const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)

    // Sur la fiche de chaque type, dans le module Typage des pièces : où l'analyse le range.
    const placeTag = (place: string) => (place === 'reponse' ? t('ao.place.response') : t('ao.place.tender'))
    cleanups.push(
      annotateTypes(AO, (code) => {
        if (code === OTHER) return { labelKey: 'ao.annotation', tags: [t('ao.annotation.ask')] }
        const rangement = rangementOf(context.settings.get())
        if (!(code in rangement)) return { labelKey: 'ao.annotation', tags: [t('ao.annotation.unset')] }
        const place = placeOf(code, rangement)
        return {
          labelKey: 'ao.annotation',
          tags: place === 'les-deux' ? [t('ao.place.tender'), t('ao.place.response'), t('ao.annotation.ask')] : [placeTag(place)]
        }
      })
    )

    // Le rangement voyage avec les types exportés par le module Typage des pièces :
    // `"modules": { "ao": { "rangement": "reponse" } }`, repris à l'import.
    const shortPlace = (place: string) => t(`ao.exchange.place.${place}`)
    const placeIn = (value: unknown): Place | null => {
      const place = typeof value === 'object' && value !== null ? (value as { rangement?: unknown }).rangement : undefined
      return PLACES.includes(place as Place) ? (place as Place) : null
    }
    cleanups.push(
      extendTypeExchange(AO, {
        nameKey: 'ao.exchange.name',
        exportType: (code) => {
          const rangement = rangementOf(context.settings.get())
          return code in rangement ? { rangement: rangement[code] } : undefined
        },
        describe: (value) => {
          const place = placeIn(value)
          return place ? t('ao.exchange.describe', { place: shortPlace(place) }) : null
        },
        importTypes: async (values) => {
          const rangement: Record<string, Place> = readRangement(context.settings.get())
          let count = 0
          for (const [code, value] of Object.entries(values)) {
            const place = placeIn(value)
            if (!place || code === OTHER) continue
            rangement[code] = place
            count++
          }
          if (count > 0) await context.settings.save({ ...context.settings.get(), [RANGEMENT_KEY]: rangement })
          return count
        }
      })
    )

    // Un type renommé dans le module Typage des pièces : les pièces qui avaient l'ancien
    // code le quittent aussitôt, dans toutes les analyses, et le rangement suit.
    let renames = JSON.stringify(currentTyping().renames)
    const fromTyping = onTypingChange((state) => {
      const now = JSON.stringify(state.renames)
      if (now === renames) return
      renames = now
      const moved = renameRangement(context.settings.get(), state.renames)
      if (moved) void context.settings.save(moved)
      void applyRenames(servicesFor(context))
        .then((count) => {
          if (count > 0) platform.notifier.notify(t('ao.retyped', { count }), 6000)
        })
        .catch((error: unknown) => console.error('[Black Projects] renommage des types', error))
    })
    cleanups.push(fromTyping)

    // Le rangement est vide tant que l'utilisateur ne l'a pas réglé : le lui expliquer.
    void explainPlacement(context).catch((error: unknown) => console.error('[Black Projects] message de rangement', error))

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
              description: t('ao.next.drop.desc', { folder: placeOriginals(analysis, { place: 'appel-d-offres' }) })
            },
            { value: 'later', label: t('ao.next.later'), description: t('ao.next.later.desc') }
          ],
          t('ao.next.placeholder')
        )
        if (next === 'import') await importInto(context, services, analysis)
        else if (next === 'drop')
          platform.notifier.notify(t('ao.next.drop.notice', { folder: placeOriginals(analysis, { place: 'appel-d-offres' }) }), 12000)
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
        const type = await platform.ui.pickOption(
          // Les types actifs, et le type actuel de la pièce même s'il a été désactivé.
          allTypes()
            .filter((each) => !isDisabled(each.code) || each.code === piece.type)
            .map((each) => ({
            value: each.code,
            label: `${each.code} — ${typeLabel(each.code, t)}`,
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
        platform.notifier.notify(t('ao.type.done', { type: `${type} — ${typeLabel(type, t)}` }), 5000)
      }
    })

    commands.register({
      id: 'extraire-exigences',
      nameKey: 'ao.command.extract',
      async run() {
        const services = servicesFor(context)
        const note = platform.ui.activeNote()
        let target = note && (await pieceAt(services, note)) ? note : null
        // Depuis la note de l'analyse : choisir la pièce.
        if (!target) {
          const analysis = await chooseAnalysis(context, services)
          if (!analysis) return
          const pieces = (await listPieces(services, analysis)).filter((piece) => canExtract(extensionOf(piece.original)))
          if (pieces.length === 0) {
            platform.notifier.notify(t('ao.req.noPiece'), 8000)
            return
          }
          target = await platform.ui.pickOption(
            pieces.map((piece) => ({
              value: piece.note,
              label: piece.note.slice(piece.note.lastIndexOf('/') + 1).replace(/\.md$/, ''),
              description: `${piece.type} — ${typeLabel(piece.type, t)}`
            })),
            t('ao.req.pickPiece')
          )
          if (!target) return
        }
        const report = await extractFromPiece(services, { ui: platform.ui, notifier: platform.notifier }, target)
        if (report) await platform.ui.openNote(target)
      }
    })

    // Vérifier les exigences du dossier : quatre vérifications, et une qui les enchaîne.
    // Chacune écrit sa section du rapport (Analyse/Vérification des exigences.md), puis l'ouvre.
    const verification = (id: string, nameKey: string, check: (services: Services, analysis: Analysis) => Promise<string>) =>
      commands.register({
        id,
        nameKey,
        async run() {
          const services = servicesFor(context)
          const analysis = await chooseAnalysis(context, services)
          if (!analysis) return
          platform.notifier.notify(t('ao.verif.running'), 3000)
          const summary = await check(services, analysis)
          platform.notifier.notify(summary, 10000)
          await platform.ui.openNote(reportPath(analysis))
        }
      })
    const window = { ui: platform.ui, notifier: platform.notifier }
    verification('verifier-exigences', 'ao.command.verifyAll', async (services, analysis) => {
      await verifyAll(services, window, analysis)
      return t('ao.verif.all.done')
    })
    verification('extraire-tout', 'ao.command.extractAll', (services, analysis) => extractAll(services, window, analysis))
    verification('exigences-oubliees', 'ao.command.missed', (services, analysis) => findMissed(services, window, analysis))
    verification('coherence-pieces', 'ao.command.coherence', (services, analysis) => checkCoherence(services, analysis))
    verification('couverture-reponse', 'ao.command.coverage', (services, analysis) => checkCoverage(services, analysis))

    commands.register({
      id: 'exigences-a-jour',
      nameKey: 'ao.command.refreshRequirements',
      async run() {
        const services = servicesFor(context)
        const analysis = await chooseAnalysis(context, services)
        if (!analysis) return
        const requirements = await refreshRequirements(services, analysis)
        platform.notifier.notify(t('ao.req.refreshed', { count: requirements.length }), 6000)
        await platform.ui.openNote(analysis.note)
      }
    })

    commands.register({
      id: 'deplacer-piece',
      nameKey: 'ao.command.move',
      async run() {
        const services = servicesFor(context)
        const note = platform.ui.activeNote()
        const piece = note ? await pieceAt(services, note) : null
        if (!note || !piece) {
          platform.notifier.notify(t('ao.type.notPiece'), 6000)
          return
        }
        const same = (a: Destination, b: Destination) => a.place === b.place && (a.candidate ?? '') === (b.candidate ?? '')
        const position = await analysisPosition(services.fs, piece.analysis)
        const destinations: Destination[] = [{ place: 'appel-d-offres' }]
        if (position === 'emetteur') {
          for (const candidate of await listCandidates(services.fs, piece.analysis)) destinations.push({ place: 'reponse', candidate })
        } else destinations.push({ place: 'reponse' })
        const choices = destinations.map((destination, index) => ({
          value: String(index),
          label: destinationLabel(destination, t),
          ...(same(destination, piece.destination) ? { description: t('ao.move.current') } : {})
        }))
        if (position === 'emetteur') choices.push({ value: 'new', label: t('ao.move.newCandidate'), description: t('ao.move.newCandidate.desc') })
        const chosen = await platform.ui.pickOption(choices, t('ao.move.placeholder'))
        if (chosen === null) return
        let destination: Destination
        if (chosen === 'new') {
          const values = await platform.ui.askForm({
            title: t('ao.move.newCandidate'),
            fields: [{ kind: 'text', key: 'name', label: t('ao.ask.candidate.name'), placeholder: t('ao.ask.candidate.placeholder'), required: true }],
            submit: t('ao.move.submit')
          })
          if (!values) return
          destination = { place: 'reponse', candidate: (values.name ?? '').trim() }
        } else destination = destinations[Number(chosen)]!
        if (same(destination, piece.destination)) return
        const moved = await movePiece(services, note, destination)
        platform.notifier.notify(t('ao.move.done', { place: destinationLabel(destination, t) }), 5000)
        await platform.ui.openNote(moved)
      }
    })
  },
  deactivate() {
    for (const cleanup of cleanups) cleanup()
    cleanups = []
  }
}
