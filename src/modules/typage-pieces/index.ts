// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module Typage des pièces — et sa **seule porte d'entrée**.
 *
 * Reconnaître le type d'un document de dossier de consultation (RC, CCTP, BPU…) d'après
 * le nom de son fichier et le titre de son texte. L'utilisateur y ajoute ses types et
 * ses mots-clés, en désactive, les échange avec d'autres coffres. L'analyse d'appels
 * d'offres s'en sert à l'import des pièces ; tout autre module peut s'en servir.
 *
 * Tout le typage est dans ce répertoire. Les autres modules n'importent que ce fichier ;
 * `pnpm check:modules` le vérifie. Voir README.md pour la maintenance.
 */

import { localToday } from '../../core/dates'
import { fillTemplate } from '../../core/docs'
import type { ActionsField, BlackModule, MappingField, ModuleContext, TextField } from '../../core/modules/module'
import { cleanFolder } from '../../core/settings'
import { typingDetails } from './catalogue'
import {
  afterTypeChange,
  describeTypeRemoval,
  keywordTargets,
  NAME_KEYWORDS_KEY,
  normalizeKeyword,
  normalizeLabel,
  normalizeTypeCode,
  readCustomKeywords,
  readCustomTypes,
  readDisabled,
  readNameKeywords,
  readTitleKeywords,
  TITLE_KEYWORDS_KEY,
  TYPES_KEY,
  validateKeyword,
  validateType
} from './custom'
import { typesMarkdown } from './doc'
import page from './doc/Typage des pièces.md'
import { applyImport, exportableCodes, exportFileName, exportTypes, importable, parseTypesFile, planImport } from './exchange'
import { typageEn, typageFr } from './i18n'
import { migrateFromAo } from './migrate'
import { configureTyping, currentCustomization } from './state'
import {
  activeTypes as activeTypesWith,
  allTypes as allTypesWith,
  classifyPiece as classifyWith,
  isDisabled as isDisabledWith,
  typeLabel as typeLabelWith,
  type CustomKeywords
} from './types'

// ── Interface publique ────────────────────────────────────────────────────────────
export { fold, keywordIn, NO_CUSTOM_KEYWORDS, OTHER, PIECE_TYPES, type CustomKeywords, type PieceType } from './types'
export { currentCode } from './custom'
export {
  annotateTypes,
  currentCustomization,
  currentTyping,
  onTypingChange,
  typeAnnotations,
  type TypeAnnotation,
  type TypeAnnotator,
  type TypingState
} from './state'
export { typesMarkdown } from './doc'

/**
 * Le type d'une pièce, d'après le nom de son fichier et le début de son texte, avec ce
 * que l'utilisateur a réglé (ou `custom`, s'il est donné).
 */
export function classifyPiece(fileName: string, text = '', custom: CustomKeywords = currentCustomization()): string {
  return classifyWith(fileName, text, custom)
}

/** Tous les types : ceux du module, ceux de l'utilisateur, puis « autre pièce ». */
export function allTypes(custom: CustomKeywords = currentCustomization()) {
  return allTypesWith(custom)
}

/** Les types reconnus et proposés : tous, sauf les désactivés. */
export function activeTypes(custom: CustomKeywords = currentCustomization()) {
  return activeTypesWith(custom)
}

export function isDisabled(code: string, custom: CustomKeywords = currentCustomization()): boolean {
  return isDisabledWith(code, custom)
}

/** Le libellé d'un type ; « (type retiré) » pour un code qui n'en est plus un. */
export function typeLabel(
  code: string,
  t: (key: string, vars?: Record<string, string>) => string,
  custom: CustomKeywords = currentCustomization()
): string {
  return typeLabelWith(code, custom, t)
}

/** Le libellé tel que le montre un tableau : « (désactivé) » pour un type désactivé. */
export function typeDisplay(
  code: string,
  t: (key: string, vars?: Record<string, string>) => string,
  custom: CustomKeywords = currentCustomization()
): string {
  const label = typeLabelWith(code, custom, t)
  return isDisabledWith(code, custom) ? t('typage-pieces.types.disabledLabel', { label }) : label
}

// ── Le module ─────────────────────────────────────────────────────────────────────
export const TYPAGE_PIECES = 'typage-pieces'
export const EXCHANGE_FOLDER_KEY = 'dossierEchanges'
export const DEFAULT_EXCHANGE_FOLDER = 'Black Projects/Échanges'

const exchangeField: ActionsField = {
  kind: 'actions',
  nameKey: 'typage-pieces.exchange.title',
  descKey: 'typage-pieces.exchange.desc',
  actions: [
    { commandId: 'importer-types', labelKey: 'typage-pieces.exchange.import', tooltipKey: 'typage-pieces.exchange.import.tip' },
    { commandId: 'exporter-types', labelKey: 'typage-pieces.exchange.export', tooltipKey: 'typage-pieces.exchange.export.tip' }
  ]
}

const exchangeFolderField: TextField = {
  kind: 'text',
  key: EXCHANGE_FOLDER_KEY,
  nameKey: 'typage-pieces.exchange.folder',
  descKey: 'typage-pieces.exchange.folder.desc',
  tooltipKey: 'typage-pieces.exchange.folder.tip',
  defaultValue: DEFAULT_EXCHANGE_FOLDER,
  normalize: cleanFolder
}

/** Le réglage « Types de pièces personnalisés » : code → libellé. */
const typesField: MappingField = {
  kind: 'mapping',
  key: TYPES_KEY,
  nameKey: 'typage-pieces.types.custom',
  descKey: 'typage-pieces.types.custom.desc',
  placeholderKey: 'typage-pieces.types.custom.placeholder',
  prefix: '',
  connectorKey: 'typage-pieces.types.custom.connector',
  valueKind: 'text',
  valuePlaceholderKey: 'typage-pieces.types.custom.labelPlaceholder',
  normalizeValue: normalizeLabel,
  tooltipKeys: {
    from: 'typage-pieces.types.custom.tip.code',
    to: 'typage-pieces.types.custom.tip.label',
    add: 'typage-pieces.types.custom.tip.add',
    edit: 'typage-pieces.types.custom.tip.edit',
    remove: 'typage-pieces.types.custom.tip.remove'
  },
  options: () => [],
  normalize: normalizeTypeCode,
  validate: (code, label, current) => validateType(code, label, current),
  read: readCustomTypes,
  editable: true,
  editTitleKey: 'typage-pieces.types.custom.editTitle',
  fromLabelKey: 'typage-pieces.types.custom.code',
  toLabelKey: 'typage-pieces.types.custom.label',
  describeRemoval: (code, label, settings, t) => describeTypeRemoval(code, label, settings, t),
  afterChange: afterTypeChange
}

/** Un réglage « mot-clé → type » : pour le nom du fichier, ou pour le titre du document. */
function keywordsField(where: 'names' | 'titles'): MappingField {
  const name = where === 'names'
  return {
    kind: 'mapping',
    key: name ? NAME_KEYWORDS_KEY : TITLE_KEYWORDS_KEY,
    nameKey: name ? 'typage-pieces.keywords.names' : 'typage-pieces.keywords.titles',
    descKey: name ? 'typage-pieces.keywords.names.desc' : 'typage-pieces.keywords.titles.desc',
    placeholderKey: name ? 'typage-pieces.keywords.names.placeholder' : 'typage-pieces.keywords.titles.placeholder',
    prefix: '',
    connectorKey: 'typage-pieces.keywords.connector',
    tooltipKeys: {
      from: 'typage-pieces.keywords.tip.from',
      to: 'typage-pieces.keywords.tip.to',
      add: 'typage-pieces.keywords.tip.add',
      remove: 'typage-pieces.keywords.tip.remove'
    },
    options: (settings) => keywordTargets(readCustomTypes(settings), readDisabled(settings)),
    defaultOption: 'CCTP',
    optionLabel: (code, settings, t) => typeLabelWith(code, readCustomKeywords(settings), t),
    normalize: normalizeKeyword,
    validate: (keyword, code, current, settings) => validateKeyword(where, keyword, code, current, readCustomTypes(settings)),
    read: name ? readNameKeywords : readTitleKeywords,
    editable: true,
    editTitleKey: 'typage-pieces.keywords.editTitle',
    fromLabelKey: 'typage-pieces.keywords.keyword',
    toLabelKey: 'typage-pieces.keywords.type'
  }
}

function exchangeFolder(settings: Readonly<Record<string, unknown>>): string {
  const value = settings[EXCHANGE_FOLDER_KEY]
  return (typeof value === 'string' && cleanFolder(value)) || DEFAULT_EXCHANGE_FOLDER
}

/** Exporter des types : les choisir, puis les écrire dans un fichier du coffre. */
async function exportCommand(context: ModuleContext): Promise<void> {
  const { platform, i18n, settings } = context
  const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
  const custom = readCustomKeywords(settings.get())
  const codes = exportableCodes(custom)
  if (codes.length === 0) {
    platform.notifier.notify(t('typage-pieces.exchange.nothing'), 8000)
    return
  }
  const chosen = await platform.ui.pickMany({
    title: t('typage-pieces.exchange.export.title'),
    intro: t('typage-pieces.exchange.export.intro'),
    choices: codes.map((code) => {
      const type = allTypesWith(custom).find((each) => each.code === code)
      const keywords = [...Object.values(custom.names), ...Object.values(custom.titles)].filter((target) => target === code).length
      return {
        value: code,
        label: `${code} — ${typeLabelWith(code, custom, t)}`,
        description: [
          type?.custom ? t('typage-pieces.exchange.added') : t('typage-pieces.exchange.builtIn'),
          t('typage-pieces.exchange.keywords', { count: keywords }),
          ...(isDisabledWith(code, custom) ? [t('typage-pieces.exchange.disabled')] : [])
        ].join(' · ')
      }
    }),
    submit: t('typage-pieces.exchange.export.submit')
  })
  if (!chosen || chosen.length === 0) return
  const today = localToday()
  const folder = exchangeFolder(settings.get())
  let path = `${folder}/${exportFileName(today)}`
  for (let index = 2; await platform.fs.exists(path); index++) path = `${folder}/${exportFileName(`${today} (${index})`)}`
  await platform.fs.writeText(path, `${JSON.stringify(exportTypes(custom, chosen, today), null, 2)}\n`)
  platform.notifier.notify(t('typage-pieces.exchange.exported', { count: chosen.length, path }), 10000)
}

/** Importer des types : un fichier de l'ordinateur ou du coffre, les types à prendre, puis l'import. */
async function importCommand(context: ModuleContext): Promise<void> {
  const { platform, i18n, settings } = context
  const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
  const source = await platform.ui.pickOption(
    [
      { value: 'computer', label: t('typage-pieces.exchange.from.computer'), description: t('typage-pieces.exchange.from.computer.desc') },
      { value: 'vault', label: t('typage-pieces.exchange.from.vault'), description: t('typage-pieces.exchange.from.vault.desc') }
    ],
    t('typage-pieces.exchange.from')
  )
  let text: string | null = null
  if (source === 'computer') {
    const [file] = await platform.ui.pickExternalFiles({ accept: ['json'], multiple: false })
    if (file) text = new TextDecoder().decode(file.bytes)
  } else if (source === 'vault') {
    const path = await platform.ui.pickFile({ extensions: ['json'], placeholder: t('typage-pieces.exchange.from.vault.pick') })
    if (path) text = await platform.fs.readText(path)
  }
  if (text === null) return
  const parsed = parseTypesFile(text)
  if (!parsed.ok) {
    platform.notifier.notify(t(parsed.errorKey), 8000)
    return
  }
  const plan = planImport(settings.get(), parsed.file)
  const chosen = await platform.ui.pickMany({
    title: t('typage-pieces.exchange.import.title'),
    intro: t('typage-pieces.exchange.import.intro', { date: parsed.file.exporte || '—' }),
    choices: plan.map((entry) => ({
      value: entry.code,
      label: entry.label ? `${entry.code} — ${entry.label}` : entry.code,
      description: [
        t(`typage-pieces.exchange.plan.${entry.kind}`),
        t('typage-pieces.exchange.keywords', { count: entry.keywords }),
        ...(entry.desactive ? [t('typage-pieces.exchange.disabled')] : [])
      ].join(' · ')
    })),
    selected: plan.filter(importable).map((entry) => entry.code),
    submit: t('typage-pieces.exchange.import.submit')
  })
  if (!chosen || chosen.length === 0) return
  const result = applyImport(settings.get(), parsed.file, chosen)
  await settings.save(result.settings)
  platform.notifier.notify(
    [
      t('typage-pieces.exchange.imported', { added: result.added, updated: result.updated, keywords: result.keywordsAdded }),
      ...(result.keywordsSkipped > 0 ? [t('typage-pieces.exchange.keywordsSkipped', { count: result.keywordsSkipped })] : []),
      ...(result.skipped.length > 0 ? [t('typage-pieces.exchange.skipped', { codes: result.skipped.join(', ') })] : [])
    ].join(' '),
    10000
  )
}

let unsubscribe: (() => void) | null = null

export const typagePiecesModule: BlackModule = {
  id: TYPAGE_PIECES,
  nameKey: 'typage-pieces.name',
  descriptionKey: 'typage-pieces.description',
  version: '0.4.2',
  requires: [],
  texts: { fr: typageFr, en: typageEn },
  details: (settings) => typingDetails(readCustomKeywords(settings)),
  settingsFields: [exchangeField, exchangeFolderField, typesField, keywordsField('names'), keywordsField('titles')],
  docs: ({ folder, t, settings }) => [
    {
      path: 'Modules/Typage des pièces.md',
      content: fillTemplate(page, folder, { types: typesMarkdown(t, readCustomKeywords(settings)) })
    }
  ],
  migrateSettings: migrateFromAo,
  activate(context) {
    configureTyping(context.settings.get())
    unsubscribe = context.settings.onChange((values) => configureTyping(values))
    context.commands.register({ id: 'exporter-types', nameKey: 'typage-pieces.command.export', run: () => exportCommand(context) })
    context.commands.register({ id: 'importer-types', nameKey: 'typage-pieces.command.import', run: () => importCommand(context) })
  },
  deactivate() {
    unsubscribe?.()
    unsubscribe = null
    configureTyping({})
  }
}
