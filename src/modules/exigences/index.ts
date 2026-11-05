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
import type { ExternalFile } from '../../core/ports'
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

// ── Interface publique ────────────────────────────────────────────────────────────
export { RequirementStore, RequirementExists } from './store'
export { readReqSettings, type ReqSettings } from './settings'
export { REQ_BLOCK_LANGUAGE } from './model/block'
export { canExtract, EXTRACTABLE, extractRequirements, type Extraction } from './import/extract'
export { type ReqLocation } from './import/document'
export { describeLocation, previewImport, type ImportReport, type ImportRequest } from './import/preview'
export { type ImportOutcome } from './import/apply'
export { type ReqOrigin } from './model/requirement'
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
        titleKey: 'exigences.feature.section.next',
        features: [

          feature('quality', 'in-progress', 5),
          feature('translate', 'in-progress', 6),
          feature('matrix', 'in-progress', 7)
        ]
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
    settings: () => readReqSettings(settings.get())
  }
}

/**
 * Importer dans la bibliothèque les exigences d'un fichier — un classeur, un CSV, un
 * document Word ou PDF, une présentation, un ReqIF venu de DOORS : choisir le fichier,
 * voir ce que l'import ferait, cocher, importer.
 */
async function importFromFile(context: ModuleContext, store: RequirementStore): Promise<ImportReport | null> {
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
  return previewImport({
    ui: platform.ui,
    notifier: platform.notifier,
    t,
    store,
    extraction: await extractRequirements(extension, file.bytes, settings.languages),
    name: file.name,
    extension,
    piece
  })
}

export const exigencesModule: BlackModule = {
  id: EXIGENCES,
  nameKey: 'exigences.name',
  descriptionKey: 'exigences.description',
  version: '0.2.0',
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
      run: () => browseRequirements(session)
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

    commands.register({
      id: 'importer',
      nameKey: 'exigences.command.import',
      run: async () => {
        await importFromFile(context, session.store)
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
