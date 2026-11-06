// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La page **Paramètres** de Black Projects, décrite en données comme les pages des
 * modules : la plateforme (Obsidian, la démonstration) la déclare et l'ouvre dans l'onglet
 * de Black Projects, depuis « Paramètres » en bas de la barre de gauche. On y retrouve ce
 * que l'onglet de réglages de la plateforme propose — la langue, l'accueil au démarrage,
 * la documentation, l'apparence, les modules (leur état, leur fenêtre « Fonctions », les
 * activer ou les désactiver) et la licence —, chaque changement par une fenêtre de Black
 * Projects (un choix, un formulaire).
 */

import { APPEARANCE_MODES, COLOR_VISIONS, MOTIONS, READING_MODES, TEXT_SIZES, type Appearance } from './appearance'
import type { ModuleDescriptor } from './modules/module'
import type { ModuleState, ModuleStatus } from './modules/registry'
import type { Ui } from './ports'
import { cleanFolder, DEFAULT_DOCS_FOLDER, LANGUAGES, withModuleEnabled, type CoreSettings, type Language } from './settings'
import { pageWith, type Card, type PageView, type Tone, type ViewAction } from './views'

/** La page des paramètres, dans l'onglet de Black Projects. */
export const SETTINGS_PAGE = 'core.parametres'

/**
 * La page « Fonctions » d'un module (ses réglages, ce qu'il sait faire), dans l'onglet de
 * Black Projects : `modulePageOf(id)`. L'interface la dessine elle-même (le contenu de la
 * fenêtre du module) ; l'hôte lui donne de quoi (`AppHost.moduleWindow`).
 */
export const MODULE_PAGE = 'core.fonctions'
export const modulePageOf = (id: string): string => pageWith(MODULE_PAGE, encodeURIComponent(id))

type Translate = (key: string, vars?: Readonly<Record<string, string | number>>) => string

export interface SettingsPageDeps {
  t: Translate
  version: string
  /** Les réglages du cœur, tels qu'enregistrés. */
  config(): CoreSettings
  /** Enregistre les réglages du cœur. */
  save(config: CoreSettings): Promise<void>
  saveAppearance(appearance: Appearance): Promise<void>
  /** Les modules et leur état. */
  modules(): readonly ModuleStatus[]
  /** Les réglages d'un module, pour savoir s'il a une fenêtre « Fonctions ». */
  moduleSettings(id: string): Readonly<Record<string, unknown>>
  /** La fenêtre « Fonctions » d'un module. */
  openModule(module: ModuleDescriptor): Promise<void>
  createDocumentation(): Promise<void>
  /** La licence, en mots. */
  licence(): string
  ui: Pick<Ui, 'pickOption' | 'askForm'>
  notify(message: string): void
  /** L'onglet de réglages de la plateforme (celui d'Obsidian), s'il y en a un. */
  openHostSettings?(): void
}

const STATE_TONE: Record<ModuleState, Tone> = {
  active: 'success',
  pending: 'info',
  disabled: 'neutral',
  'not-licensed': 'warning',
  'missing-dependency': 'warning',
  failed: 'danger'
}

/** Le filtre d'un module : actif, désactivé, ou en difficulté. */
const stateTag = (state: ModuleState) => (state === 'active' ? 'actifs' : state === 'disabled' || state === 'pending' ? 'desactives' : 'problemes')

const APPEARANCE: { key: keyof Appearance; values: readonly string[] }[] = [
  { key: 'mode', values: APPEARANCE_MODES },
  { key: 'vision', values: COLOR_VISIONS },
  { key: 'reading', values: READING_MODES },
  { key: 'size', values: TEXT_SIZES },
  { key: 'motion', values: MOTIONS }
]

/** Choisir une valeur parmi d'autres ; rien si l'utilisateur renonce ou garde la même. */
async function choose(deps: SettingsPageDeps, options: { value: string; label: string; description?: string }[], current: string, placeholder: string): Promise<string | null> {
  const chosen = await deps.ui.pickOption(
    options.map((option) => (option.value === current ? { ...option, description: [option.description, deps.t('settings.page.current')].filter(Boolean).join(' — ') } : option)),
    placeholder
  )
  return chosen === null || chosen === current ? null : chosen
}

/** Le texte de l'état d'un module, avec ce qui manque ou l'erreur. */
function stateText(status: ModuleStatus, t: Translate): string {
  if (status.state === 'failed' && status.error) return `${t('module.state.failed')} : ${status.error}`
  if (status.state === 'missing-dependency' && status.missing.length) return `${t('module.state.missing-dependency')} : ${status.missing.join(', ')}`
  return t(`module.state.${status.state}`)
}

/** La carte d'un module : son état, ce qu'il fait, ce dont il a besoin ; sa fenêtre, l'activer ou le désactiver. */
function moduleCard(deps: SettingsPageDeps, status: ModuleStatus, names: Map<string, string>): Card {
  const { t } = deps
  const { module } = status
  const config = deps.config()
  const enabled = !config.disabledModules.includes(module.id)
  const details = module.details?.(deps.moduleSettings(module.id))
  const toggle: ViewAction = {
    id: 'toggle',
    label: t(enabled ? 'settings.page.module.disable' : 'settings.page.module.enable'),
    tooltip: t(enabled ? 'tip.module.toggle.on' : 'tip.module.toggle.off'),
    icon: enabled ? 'hide' : 'check',
    run: async () => {
      await deps.save(withModuleEnabled(deps.config(), module.id, !enabled))
      deps.notify(t(enabled ? 'settings.page.module.disabled' : 'settings.page.module.enabled', { name: t(module.nameKey) }))
    }
  }
  return {
    id: module.id,
    title: t(module.nameKey),
    subtitle: `${module.version} · ${stateText(status, t)}`,
    icon: 'grid',
    badges: [
      { label: t(`module.state.${status.state}`), tone: STATE_TONE[status.state] },
      ...(enabled === (status.state !== 'disabled') ? [] : [{ label: t('settings.page.module.reload'), tone: 'info' as const }])
    ],
    text: t(module.descriptionKey),
    ...(module.requires.length ? { facts: [{ label: t('settings.page.module.requires'), value: module.requires.map((id) => names.get(id) ?? id).join(', ') }] } : {}),
    ...(details ? { open: { id: 'open', label: t(details.titleKey), tooltip: t('tip.module.details'), run: () => deps.openModule(module) } } : {}),
    actions: [...(details ? [{ id: 'details', label: t(details.titleKey), icon: 'settings' as const, tooltip: t('tip.module.details'), run: () => deps.openModule(module) }] : []), toggle],
    tags: [stateTag(status.state)]
  }
}

/**
 * La page **Paramètres** : ses chiffres (modules actifs, langue, version) ; le général (la
 * langue, l'accueil au démarrage, la documentation, la licence) ; l'apparence, un choix
 * par carte ; une carte par module. Recherche et filtres sur les modules (actifs,
 * désactivés, en difficulté).
 */
export function settingsPage(deps: SettingsPageDeps): PageView {
  const { t } = deps
  const config = deps.config()
  const statuses = deps.modules()
  const names = new Map(statuses.map((status) => [status.module.id, t(status.module.nameKey)]))
  const active = statuses.filter((status) => status.state === 'active').length
  const troubled = statuses.filter((status) => stateTag(status.state) === 'problemes').length

  const general: Card[] = [
    {
      id: 'langue',
      title: t('settings.language'),
      subtitle: t(`settings.language.${config.language}`),
      icon: 'chat',
      text: t('settings.language.desc'),
      actions: [
        {
          id: 'language',
          label: t('settings.page.language.change'),
          icon: 'edit',
          run: async () => {
            const chosen = await choose(deps, LANGUAGES.map((language) => ({ value: language, label: t(`settings.language.${language}`) })), config.language, t('settings.language'))
            if (!chosen) return
            await deps.save({ ...deps.config(), language: chosen as Language })
            deps.notify(t('settings.languageReload'))
          }
        }
      ]
    },
    {
      id: 'demarrage',
      title: t('settings.home.atStart'),
      subtitle: t(config.openHomeAtStart ? 'settings.page.yes' : 'settings.page.no'),
      icon: 'home',
      text: t('settings.home.atStart.desc'),
      badges: [{ label: t(config.openHomeAtStart ? 'settings.page.on' : 'settings.page.off'), tone: config.openHomeAtStart ? 'success' : 'neutral' }],
      actions: [
        {
          id: 'start',
          label: t(config.openHomeAtStart ? 'settings.page.start.off' : 'settings.page.start.on'),
          icon: config.openHomeAtStart ? 'hide' : 'check',
          run: () => deps.save({ ...deps.config(), openHomeAtStart: !deps.config().openHomeAtStart })
        }
      ]
    },
    {
      id: 'documentation',
      title: t('settings.docs'),
      subtitle: config.docsFolder,
      icon: 'book',
      text: t('settings.docs.create.desc'),
      actions: [
        { id: 'docs', label: t('settings.docs.button'), icon: 'refresh', tooltip: t('tip.docs.create'), run: () => deps.createDocumentation() },
        {
          id: 'folder',
          label: t('settings.page.docs.folder'),
          icon: 'folder',
          tooltip: t('tip.docs.folder'),
          run: async () => {
            const values = await deps.ui.askForm({
              title: t('settings.docs.folder'),
              intro: t('settings.docs.folder.desc'),
              fields: [{ kind: 'text', key: 'folder', label: t('settings.docs.folder'), value: deps.config().docsFolder, placeholder: DEFAULT_DOCS_FOLDER, required: true }],
              submit: t('settings.page.save')
            })
            const folder = values ? cleanFolder(values.folder ?? '') || DEFAULT_DOCS_FOLDER : null
            if (!folder || folder === deps.config().docsFolder) return
            await deps.save({ ...deps.config(), docsFolder: folder })
            deps.notify(t('settings.page.docs.saved', { folder }))
          }
        }
      ]
    },
    { id: 'licence', title: t('settings.licence'), subtitle: deps.licence(), icon: 'lock', text: t('settings.licence.owner') }
  ]

  const appearance: Card[] = APPEARANCE.map(({ key, values }) => {
    const current = String(config.appearance[key])
    return {
      id: `apparence-${key}`,
      title: t(`ui.appearance.${key}`),
      subtitle: t(`ui.appearance.${key}.${current}`),
      icon: 'eye',
      text: t(`ui.appearance.${key}.${current}.desc`),
      actions: [
        {
          id: 'change',
          label: t('settings.page.appearance.change'),
          icon: 'edit',
          run: async () => {
            const options = values.map((value) => ({ value, label: t(`ui.appearance.${key}.${value}`), description: t(`ui.appearance.${key}.${value}.desc`) }))
            const chosen = await choose(deps, options, current, t(`ui.appearance.${key}`))
            if (chosen) await deps.saveAppearance({ ...deps.config().appearance, [key]: chosen })
          }
        }
      ]
    }
  })

  return {
    subtitle: t('settings.page.subtitle'),
    actions: [
      { id: 'docs', label: t('settings.docs.button'), icon: 'book', tooltip: t('tip.docs.create'), run: () => deps.createDocumentation() },
      ...(deps.openHostSettings ? [{ id: 'host', label: t('settings.page.host'), icon: 'settings' as const, tooltip: t('settings.page.host.tip'), run: () => deps.openHostSettings?.() }] : [])
    ],
    search: { label: t('settings.page.search'), placeholder: t('settings.page.search.placeholder') },
    filters: [
      { id: 'actifs', label: t('settings.page.filter.active') },
      { id: 'desactives', label: t('settings.page.filter.disabled') },
      { id: 'problemes', label: t('settings.page.filter.troubled') }
    ],
    blocks: [
      {
        kind: 'stats',
        stats: [
          { label: t('settings.page.stat.modules'), value: `${active} / ${statuses.length}`, icon: 'grid', tone: troubled ? 'warning' : 'success', ...(troubled ? { hint: t('settings.page.stat.troubled', { count: troubled }) } : {}) },
          { label: t('settings.language'), value: t(`settings.language.${config.language}`), icon: 'chat' },
          { label: t('settings.page.stat.version'), value: deps.version, icon: 'info' }
        ]
      },
      { kind: 'cards', title: t('settings.general'), cards: general },
      { kind: 'cards', title: t('settings.page.appearance'), cards: appearance },
      { kind: 'cards', title: t('settings.page.modules', { count: statuses.length }), cards: statuses.map((status) => moduleCard(deps, status, names)) }
    ]
  }
}
