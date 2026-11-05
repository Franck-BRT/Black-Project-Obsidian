// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module Exigences — le socle des exigences (étape 3 du plan d'intégration).
 *
 * Une bibliothèque d'exigences : une note par exigence, un identifiant attribué une fois
 * et jamais réutilisé, une formulation par langue avec son retard sur la source, des
 * liens entre exigences, et le bloc `pm-req` qui cite des exigences dans un document au
 * lieu de les recopier. Le format est celui de la version complète de Black Projects.
 *
 * Ce fichier est la seule porte d'entrée du module ; `model/` (le modèle, repris de la
 * version complète), `store.ts` (les notes) et `flows.ts` (ce que fait l'utilisateur)
 * sont son affaire.
 */

import { fillTemplate } from '../../core/docs'
import type { BlackModule, ModuleContext, ModuleDetails, ModuleFeature, TextField } from '../../core/modules/module'
import { cleanFolder } from '../../core/settings'
import page from './doc/Exigences.md'
import { browseRequirements, createRequirement, editRequirement, renderBlock, type Session } from './flows'
import { exigencesEn, exigencesFr } from './i18n'
import { REQ_BLOCK_LANGUAGE } from './model/block'
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

// ── Interface publique ────────────────────────────────────────────────────────────
export { RequirementStore, RequirementExists } from './store'
export { readReqSettings, type ReqSettings } from './settings'
export { REQ_BLOCK_LANGUAGE } from './model/block'
export {
  makeReqText,
  makeRequirement,
  setText,
  type Requirement,
  type ReqLink,
  type ReqText
} from './model/requirement'

export const EXIGENCES = 'exigences'

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
        titleKey: 'exigences.feature.section.next',
        features: [
          feature('extract', 'in-progress', 4),
          feature('reqif', 'in-progress', 4),
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

export const exigencesModule: BlackModule = {
  id: EXIGENCES,
  nameKey: 'exigences.name',
  descriptionKey: 'exigences.description',
  version: '0.1.0',
  requires: [],
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

    // Les blocs `pm-req` des notes : les exigences citées, dessinées d'après la bibliothèque.
    context.blocks?.register(REQ_BLOCK_LANGUAGE, (source) => renderBlock(session, source))
  }
}
