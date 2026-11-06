// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module Exigences — le socle des exigences (étape 3 du plan d'intégration).
 *
 * Une bibliothèque d'exigences : une note par exigence, un identifiant attribué une fois
 * et jamais réutilisé, une formulation par langue avec son retard sur la source, des
 * liens entre exigences, et le bloc `brt-req` qui cite des exigences dans un document au
 * lieu de les recopier. Le format reprend celui de la version complète de Black Projects,
 * sous le nom `brt-` ; ses anciennes notes et anciens blocs `pm-` sont encore lus.
 *
 * Ce fichier est la seule porte d'entrée du module ; `model/` (le modèle, repris de la
 * version complète), `store.ts` (les notes) et `flows.ts` (ce que fait l'utilisateur)
 * sont son affaire.
 */

import { fillTemplate } from '../../core/docs'
import type { ExternalFile, Notifier, Ui } from '../../core/ports'
import { extensionOf, LECTURE_FICHIERS } from '../lecture-fichiers'
import type { BlackModule, ModuleContext, ModuleDetails, ModuleFeature, TextField } from '../../core/modules/module'
import { cleanFolder } from '../../core/settings'
import page from './doc/Exigences.md'
import { browseRequirements, createRequirement, editRequirement, renderBlock, type Session } from './flows'
import { exigencesEn, exigencesFr } from './i18n'
import { REQ_BLOCK_LANGUAGES } from './model/block'
import {
  cleanLanguages,
  cleanPrefix,
  cleanWidth,
  COUNTERS_KEY,
  DEFAULT_FOLDER,
  FOLDER_KEY,
  LANGUAGES_KEY,
  PREFIX_KEY,
  readReqSettings,
  WIDTH_KEY
} from './settings'
import { RequirementStore } from './store'
import { canExtract, EXTRACTABLE, extractRequirements } from './import/extract'
import { previewImport, type ImportReport } from './import/preview'
import { localToday } from '../../core/dates'
import { aiClient } from '../ia'
import { reviewRequirement, translateRequirement, translateRequirements } from './ai/actions'
import { emitRequirementCreated, registerExigencesWorkflows, writeLibraryQuality } from './workflows'
import { importPageOf, openLibrary, registerExigencesHome, type LastImport } from './home'
export { requirementPageOf } from './home'

// ── Interface publique ────────────────────────────────────────────────────────────
export { RequirementStore, RequirementExists } from './store'
export { readReqSettings, type ReqSettings } from './settings'
export { REQ_BLOCK_LANGUAGE } from './model/block'
export { canExtract, EXTRACTABLE, extractRequirements, type Extraction } from './import/extract'
export { type ReqLocation } from './import/document'
export { semanticDuplicates } from './ai/semantic'
export {
  acceptTranslation,
  lastReview,
  reviewRequirement,
  reviewSection,
  translateRequirement,
  translateRequirements,
  translationNote,
  translationState,
  withReview,
  type ReviewOptions,
  type ReviewOutcome,
  type TranslateOptions,
  type TranslateOutcome,
  type TranslateRun,
  type TranslationState
} from './ai/actions'
export { type Session as RequirementSession } from './flows'
export { describeLocation, previewImport, type ImportReport, type ImportRequest } from './import/preview'
export { type ImportOutcome } from './import/apply'
export { type ReqOrigin } from './model/requirement'
export { blockPassages, documentPassages, hasPassages, type Passage } from './check/passages'
export {
  coherence,
  coverage,
  missedRequirements,
  ADDRESSED,
  PARTIAL,
  type Coverage,
  type CoverageStatus,
  type Finding,
  type FindingKind,
  type Missed,
  type PieceRequirements,
  type ReadDocument
} from './check/checks'
export { keywords, normativeMarker, overlap, sentences } from './check/text'
export { checkWording, QUALITY_RULES, type QualityFinding, type QualityRule } from './quality/rules'
export { assessRequirement, isWeak, QUALITY_AXES, type QualityReport, type QualityScope } from './quality/score'
export { lexicalPairs, thresholdsFor, type SimilarPair } from './quality/similar'
export { coverageOf, countGaps, COVERAGE_GAPS, type LibraryCoverage } from './quality/library'
export {
  assessAll,
  describeFinding,
  probableDuplicates,
  qualityMarkdown,
  stars,
  withQuality,
  type QualityRun
} from './quality/report'
export {
  makeReqText,
  makeRequirement,
  setText,
  type Requirement,
  type ReqLink,
  type ReqText
} from './model/requirement'

export const EXIGENCES = 'exigences'

/** Ce que le module, une fois actif, prête aux autres : ses ports et ses réglages. */
let active: ModuleContext | null = null

/**
 * Les exigences rangées dans un dossier : la bibliothèque d'une analyse d'appel d'offres,
 * par exemple. Les identifiants sont attribués par les mêmes compteurs que la
 * bibliothèque : jamais deux fois le même, où qu'il soit rangé.
 */
export function requirementsAt(folder: string): RequirementStore {
  if (!active) throw new Error('Le module Exigences n’est pas actif.')
  const context = active
  return new RequirementStore({
    fs: context.platform.fs,
    yaml: context.platform.yaml,
    settings: () => ({ ...readReqSettings(context.settings.get()), folder }),
    saveCounters: (counters) => context.settings.save({ ...context.settings.get(), [COUNTERS_KEY]: counters })
  })
}

/** De quoi relire ou traduire les exigences d'un dossier, avec la fenêtre de l'appelant. */
export function sessionAt(folder: string, ui: Ui, notifier: Notifier): Session {
  if (!active) throw new Error('Le module Exigences n’est pas actif.')
  const context = active
  return {
    store: requirementsAt(folder),
    ui,
    notifier,
    t: (key, vars) => context.i18n.t(key, vars),
    settings: () => ({ ...readReqSettings(context.settings.get()), folder }),
    ai: () => aiClient()
  }
}

/** Les langues de rédaction réglées ; la première est la langue source. */
export function requirementLanguages(): string[] {
  return active ? readReqSettings(active.settings.get()).languages : ['fr', 'en']
}

const text = (key: string, nameKey: string, defaultValue: string, normalize: (input: string) => string): TextField => ({
  kind: 'text',
  key,
  nameKey: `exigences.setting.${nameKey}`,
  descKey: `exigences.setting.${nameKey}.desc`,
  tooltipKey: `exigences.setting.${nameKey}.tip`,
  defaultValue,
  normalize
})

const feature = (key: string, status: ModuleFeature['status'], step?: number): ModuleFeature => ({
  labelKey: `exigences.feature.${key}`,
  noteKey: `exigences.feature.${key}.note`,
  status,
  ...(step === undefined ? {} : { step })
})

export function exigencesFeatures(): ModuleDetails {
  return {
    titleKey: 'exigences.details.title',
    introKey: 'exigences.details.intro',
    sections: [
      {
        titleKey: 'exigences.feature.section.library',
        features: [
          feature('create', 'available'),
          feature('ids', 'available'),
          feature('edit', 'available'),
          feature('browse', 'available'),
          feature('note', 'available'),
          feature('cite', 'available'),
          feature('aliases', 'available')
        ]
      },
      {
        titleKey: 'exigences.feature.section.import',
        features: [
          feature('extract', 'available'),
          feature('reqif', 'available'),
          feature('trace', 'available'),
          feature('preview', 'available')
        ]
      },
      {
        titleKey: 'exigences.feature.section.quality',
        features: [feature('rating', 'available'), feature('qualityReport', 'available')]
      },
      {
        titleKey: 'exigences.feature.section.ai',
        features: [feature('aiReview', 'available', 6), feature('translate', 'available', 6)]
      },
      {
        titleKey: 'exigences.feature.section.next',
        features: [feature('matrix', 'in-progress', 7)]
      }
    ]
  }
}

function sessionFor(context: ModuleContext): Session {
  const { platform, settings, i18n } = context
  return {
    store: new RequirementStore({
      fs: platform.fs,
      yaml: platform.yaml,
      settings: () => readReqSettings(settings.get()),
      saveCounters: (counters) => settings.save({ ...settings.get(), [COUNTERS_KEY]: counters })
    }),
    ui: platform.ui,
    notifier: platform.notifier,
    t: (key, vars) => i18n.t(key, vars),
    settings: () => readReqSettings(settings.get()),
    ai: () => aiClient(),
    created: (requirement) => emitRequirementCreated(requirement)
  }
}

/**
 * Importer dans la bibliothèque les exigences d'un fichier — un classeur, un CSV, un
 * document Word ou PDF, une présentation, un ReqIF venu de DOORS : choisir le fichier,
 * voir ce que l'import ferait, cocher, importer.
 */
async function importFromFile(context: ModuleContext, store: RequirementStore): Promise<(ImportReport & { piece: string; name: string }) | null> {
  const { platform, i18n } = context
  const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
  const source = await platform.ui.pickOption(
    [
      { value: 'computer', label: t('exigences.import.from.computer'), description: t('exigences.import.from.computer.desc') },
      { value: 'vault', label: t('exigences.import.from.vault'), description: t('exigences.import.from.vault.desc') }
    ],
    t('exigences.import.from')
  )
  let file: ExternalFile | null = null
  let piece = ''
  if (source === 'computer') {
    const [picked] = await platform.ui.pickExternalFiles({ accept: [...EXTRACTABLE], multiple: false })
    if (picked) {
      file = picked
      piece = picked.name
    }
  } else if (source === 'vault') {
    const path = await platform.ui.pickFile({ extensions: [...EXTRACTABLE], placeholder: t('exigences.import.from.vault.pick') })
    if (path) {
      file = { name: path.slice(path.lastIndexOf('/') + 1), bytes: new Uint8Array(await platform.fs.readBinary(path)) }
      piece = `[[${path}|${file.name}]]`
    }
  }
  if (!file) return null
  const extension = extensionOf(file.name)
  if (!canExtract(extension)) {
    platform.notifier.notify(t('exigences.import.problem.unsupported', { name: file.name }), 8000)
    return null
  }
  const settings = readReqSettings(context.settings.get())
  const report = await previewImport({
    ui: platform.ui,
    notifier: platform.notifier,
    t,
    store,
    extraction: await extractRequirements(extension, file.bytes, settings.languages),
    name: file.name,
    extension,
    piece
  })
  return report ? { ...report, piece, name: file.name } : null
}

/** Ce qu'un import a fait, en bref, pour sa page. */
function lastImportOf(report: ImportReport & { piece: string; name: string }): LastImport {
  const paths = (list: readonly { filePath?: string }[]) => list.flatMap((requirement) => (requirement.filePath ? [requirement.filePath] : []))
  return { piece: report.piece, name: report.name, date: localToday(), created: paths(report.outcome.created), updated: paths(report.outcome.updated), failed: [...report.outcome.failed] }
}

export const exigencesModule: BlackModule = {
  id: EXIGENCES,
  nameKey: 'exigences.name',
  descriptionKey: 'exigences.description',
  version: '0.13.0',
  // Les fichiers d'où l'on extrait des exigences sont lus par le module Lecture de fichiers.
  requires: [LECTURE_FICHIERS],
  texts: { fr: exigencesFr, en: exigencesEn },
  details: () => exigencesFeatures(),
  settingsFields: [
    text(FOLDER_KEY, 'folder', DEFAULT_FOLDER, cleanFolder),
    text(PREFIX_KEY, 'prefix', 'REQ', cleanPrefix),
    text(WIDTH_KEY, 'width', '4', cleanWidth),
    text(LANGUAGES_KEY, 'languages', 'fr, en', cleanLanguages)
  ],
  docs: ({ folder }) => [{ path: 'Modules/Exigences.md', content: fillTemplate(page, folder) }],
  activate(context) {
    const { commands, platform } = context
    const session = sessionFor(context)
    active = context
    // Ce que les exigences apportent aux workflows.
    registerExigencesWorkflows(() => session, session.t, localToday)
    // L'accueil : la bibliothèque en chiffres.
    const showPage = context.showPage ? (id: string) => context.showPage?.(id) : undefined
    // Le dernier import, pour sa page ; lancé de l'interface, l'import finit sur elle.
    let lastImport: LastImport | null = null
    const runImport = async () => {
      const report = await importFromFile(context, session.store)
      if (report) lastImport = lastImportOf(report)
      return report
    }
    registerExigencesHome(
      context.views,
      session,
      async (id) => {
        await context.commands.run?.(id)
      },
      showPage,
      // La fiche d'une exigence, où qu'elle soit rangée (la bibliothèque, une analyse).
      (folder) => ({ ...sessionAt(folder, platform.ui, platform.notifier), created: session.created }),
      {
        async run() {
          const report = await runImport()
          if (report) showPage?.(importPageOf(report.piece))
        },
        last: () => lastImport
      }
    )

    commands.register({
      id: 'nouvelle',
      nameKey: 'exigences.command.create',
      async run() {
        const created = await createRequirement(session)
        if (created?.filePath) await platform.ui.openNote(created.filePath)
      }
    })

    commands.register({
      id: 'liste',
      nameKey: 'exigences.command.browse',
      // La page de la bibliothèque quand la plateforme en a une ; sinon la liste en fenêtre.
      run: () => openLibrary(showPage, () => browseRequirements(session))
    })

    commands.register({
      id: 'modifier',
      nameKey: 'exigences.command.edit',
      async run() {
        const note = platform.ui.activeNote()
        if (!note) {
          platform.notifier.notify(session.t('exigences.notRequirement'), 6000)
          return
        }
        const path = await editRequirement(session, note)
        if (path && path !== note) await platform.ui.openNote(path)
      }
    })

    // L'IA (le module IA, réglé sur le serveur de l'entreprise) relit et traduit la note ouverte.
    const withAi = (run: (client: NonNullable<ReturnType<typeof aiClient>>, path: string) => Promise<unknown>) => async () => {
      const note = platform.ui.activeNote()
      if (!note || !(await session.store.load(note))) {
        platform.notifier.notify(session.t('exigences.notRequirement'), 6000)
        return
      }
      const client = aiClient()
      if (!client) {
        platform.notifier.notify(session.t('ia.unavailable'), 10000)
        return
      }
      await run(client, note)
    }

    commands.register({
      id: 'relire-ia',
      nameKey: 'exigences.command.review',
      run: withAi((client, path) => reviewRequirement(session, client, path, localToday()))
    })

    commands.register({
      id: 'traduire-ia',
      nameKey: 'exigences.command.translate',
      run: withAi((client, path) => translateRequirement(session, client, path, { date: localToday() }))
    })

    // Plusieurs exigences d'un coup : la langue, les exigences (absentes ou en retard cochées), puis le résumé.
    commands.register({
      id: 'traduire-ia-serie',
      nameKey: 'exigences.command.translateMany',
      async run() {
        const client = aiClient()
        if (!client) {
          platform.notifier.notify(session.t('ia.unavailable'), 10000)
          return
        }
        const run = await translateRequirements(session, client, localToday())
        if (!run) return
        const vars = { translated: run.translated, lang: run.lang.toUpperCase(), drifted: run.drifted }
        platform.notifier.notify(
          [session.t(run.failed ? 'exigences.ai.translate.many.stopped' : 'exigences.ai.translate.many.done', vars), ...(run.drifted ? [session.t('exigences.ai.translate.many.drift', vars)] : [])].join(' '),
          run.drifted ? 15000 : 10000
        )
      }
    })

    commands.register({
      id: 'qualite',
      nameKey: 'exigences.command.quality',
      async run() {
        const report = await writeLibraryQuality(session, localToday())
        platform.notifier.notify(report.text, 8000)
        await platform.ui.openNote(report.path)
      }
    })

    commands.register({
      id: 'importer',
      nameKey: 'exigences.command.import',
      // Depuis la palette : le message seul, comme avant (la page se retrouve depuis la fiche d'une exigence importée).
      run: async () => {
        await runImport()
      }
    })

    // Les blocs `brt-req` des notes : les exigences citées, dessinées d'après la bibliothèque.
    // (les anciens blocs `pm-req` aussi).
    for (const language of REQ_BLOCK_LANGUAGES) context.blocks?.register(language, (source) => renderBlock(session, source))
  },
  deactivate() {
    active = null
  }
}
