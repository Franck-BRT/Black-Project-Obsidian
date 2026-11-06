// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La page **Paramètres** : la langue, l'accueil au démarrage, la documentation, la
 * licence ; l'apparence, un choix par carte ; une carte par module — son état, sa fenêtre
 * « Fonctions », l'activer ou le désactiver. Chaque changement passe par une fenêtre et
 * s'enregistre dans les réglages du cœur.
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE, type Appearance } from './appearance'
import { createI18n } from './i18n'
import type { ModuleDescriptor } from './modules/module'
import type { ModuleStatus } from './modules/registry'
import { DEFAULT_SETTINGS, type CoreSettings } from './settings'
import { SETTINGS_PAGE, settingsPage, type SettingsPageDeps } from './settingsPage'
import type { Card, PageView } from './views'

const module = (id: string, extra: Partial<ModuleDescriptor> = {}): ModuleDescriptor =>
  ({ id, nameKey: `${id}.name`, descriptionKey: `${id}.desc`, version: '1.2.0', requires: [], texts: { fr: { [`${id}.name`]: id.toUpperCase(), [`${id}.desc`]: `Ce que fait ${id}.` }, en: {} }, ...extra }) as unknown as ModuleDescriptor
const STATUSES: ModuleStatus[] = [
  { module: module('lecture', { details: () => ({ titleKey: 'lecture.fonctions', sections: [] }) as never }), state: 'active', missing: [], error: null },
  { module: module('ia'), state: 'disabled', missing: [], error: null },
  { module: module('ao', { requires: ['lecture', 'ia'] }), state: 'missing-dependency', missing: ['ia'], error: null },
  { module: module('casse'), state: 'failed', missing: [], error: 'boum' }
]

function start(overrides: Partial<SettingsPageDeps> = {}) {
  const i18n = createI18n('fr')
  for (const status of STATUSES) i18n.register('fr', status.module.texts.fr)
  i18n.register('fr', { 'lecture.fonctions': 'Formats de fichiers' })
  let config: CoreSettings = { ...DEFAULT_SETTINGS, disabledModules: ['ia'] }
  const saved: CoreSettings[] = []
  const appearances: Appearance[] = []
  const notices: string[] = []
  const opened: string[] = []
  const picks: { values: string[]; descriptions: (string | undefined)[] }[] = []
  let answer: string | null = null
  let form: Record<string, string> | null = null
  const docs: string[] = []
  const deps: SettingsPageDeps = {
    t: (key, vars) => i18n.t(key, vars),
    version: '0.33.0',
    config: () => config,
    save: async (next) => {
      config = next
      saved.push(next)
    },
    saveAppearance: async (next) => {
      config = { ...config, appearance: next }
      appearances.push(next)
    },
    modules: () => STATUSES,
    moduleSettings: () => ({}),
    openModule: async (descriptor) => void opened.push(descriptor.id),
    createDocumentation: async () => void docs.push('écrite'),
    licence: () => 'Version d’évaluation : tous les modules sont ouverts.',
    ui: {
      pickOption: async (options) => {
        picks.push({ values: options.map((option) => option.value), descriptions: options.map((option) => option.description) })
        return answer
      },
      askForm: async () => form
    },
    notify: (message) => void notices.push(message),
    openHostSettings: () => void opened.push('obsidian'),
    ...overrides
  }
  return {
    deps,
    view: () => settingsPage(deps),
    config: () => config,
    saved,
    appearances,
    notices,
    opened,
    picks,
    docs,
    answer: (value: string | null) => void (answer = value),
    form: (value: Record<string, string> | null) => void (form = value)
  }
}

const group = (view: PageView, title: string): Card[] => {
  const block = view.blocks.find((each) => each.kind === 'cards' && each.title === title)
  return block?.kind === 'cards' ? block.cards : []
}

describe('la page Paramètres', () => {
  it('ses chiffres, puis le général, l’apparence et une carte par module ; recherche et filtres', () => {
    const view = start().view()
    expect(SETTINGS_PAGE).toBe('core.parametres')
    expect(view.actions?.map((action) => action.id)).toEqual(['docs', 'host'])
    expect(view.filters?.map((filter) => filter.id)).toEqual(['actifs', 'desactives', 'problemes'])
    const stats = view.blocks.find((block) => block.kind === 'stats')
    expect(stats?.kind === 'stats' && stats.stats.map((stat) => `${stat.label}=${stat.value}`)).toEqual(['Modules actifs=1 / 4', 'Langue=Français', 'Version=0.33.0'])
    expect(stats?.kind === 'stats' && stats.stats[0]).toMatchObject({ tone: 'warning', hint: '2 en difficulté' })
    expect(view.blocks.map((block) => (block.kind === 'cards' ? block.title : block.kind))).toEqual(['stats', 'Général', 'Apparence', 'Modules (4)'])
    expect(group(view, 'Général').map((card) => `${card.title}:${card.subtitle}`)).toEqual([
      'Langue:Français',
      'Ouvrir l’accueil au démarrage:Oui',
      'Documentation:Black Projects/Documentation',
      'Licence:Version d’évaluation : tous les modules sont ouverts.'
    ])
    expect(group(view, 'Apparence').map((card) => card.id)).toEqual(['apparence-mode', 'apparence-vision', 'apparence-reading', 'apparence-size', 'apparence-motion'])
  })

  it('un module : son état, ce dont il a besoin, sa fenêtre « Fonctions », l’activer ou le désactiver', async () => {
    const run = start()
    const modules = group(run.view(), 'Modules (4)')
    expect(modules.map((card) => `${card.title}:${card.tags![0]}:${card.badges![0]!.tone}`)).toEqual(['LECTURE:actifs:success', 'IA:desactives:neutral', 'AO:problemes:warning', 'CASSE:problemes:danger'])
    expect(modules[0]!.subtitle).toBe('1.2.0 · Actif')
    expect(modules[2]!.subtitle).toBe('1.2.0 · Module requis indisponible : ia')
    expect(modules[2]!.facts).toEqual([{ label: 'Nécessite', value: 'LECTURE, IA' }])
    expect(modules[3]!.subtitle).toBe('1.2.0 · Erreur au chargement : boum')
    expect(modules[0]!.actions!.map((action) => action.label)).toEqual(['Formats de fichiers', 'Désactiver'])
    expect(modules[1]!.actions!.map((action) => action.label)).toEqual(['Activer'])
    await modules[0]!.open!.run()
    expect(run.opened).toEqual(['lecture'])
    // Désactivé, réactivé : au prochain chargement du plugin, la carte le dit.
    await modules[0]!.actions!.find((action) => action.id === 'toggle')!.run()
    expect(run.config().disabledModules).toEqual(['ia', 'lecture'])
    expect(run.notices.at(-1)).toBe('« LECTURE » sera désactivé au prochain chargement du plugin. Vos données restent dans le coffre.')
    const again = group(run.view(), 'Modules (4)')
    expect(again[0]!.badges!.map((badge) => badge.label)).toEqual(['Actif', 'Au prochain chargement'])
    await again[1]!.actions!.find((action) => action.id === 'toggle')!.run()
    expect(run.config().disabledModules).toEqual(['lecture'])
  })

  it('la langue et l’apparence : un choix, l’actuel marqué ; rien d’enregistré si on renonce ou garde le même', async () => {
    const run = start()
    const language = group(run.view(), 'Général')[0]!.actions![0]!
    run.answer(null)
    await language.run()
    run.answer('fr')
    await language.run()
    expect(run.saved).toEqual([])
    expect(run.picks[0]).toEqual({ values: ['fr', 'en'], descriptions: ['actuel', undefined] })
    run.answer('en')
    await language.run()
    expect(run.config().language).toBe('en')
    expect(run.notices.at(-1)).toBe('La nouvelle langue sera appliquée au prochain chargement du plugin.')
    const vision = group(run.view(), 'Apparence').find((card) => card.id === 'apparence-vision')!
    expect(vision.subtitle).toBe('Standard')
    run.answer('mono')
    await vision.actions![0]!.run()
    expect(run.appearances).toEqual([{ ...DEFAULT_APPEARANCE, vision: 'mono' }])
  })

  it('l’accueil au démarrage, le dossier de la documentation, l’écrire ; l’onglet de la plateforme', async () => {
    const run = start()
    const [, startup, docs] = group(run.view(), 'Général')
    expect(startup!.actions![0]!.label).toBe('Ne plus l’ouvrir au démarrage')
    await startup!.actions![0]!.run()
    expect(run.config().openHomeAtStart).toBe(false)
    expect(group(run.view(), 'Général')[1]!.actions![0]!.label).toBe('L’ouvrir au démarrage')
    run.form({ folder: '  Doc/Black  ' })
    await docs!.actions!.find((action) => action.id === 'folder')!.run()
    expect(run.config().docsFolder).toBe('Doc/Black')
    expect(run.notices.at(-1)).toBe('La documentation sera écrite dans « Doc/Black ».')
    await docs!.actions!.find((action) => action.id === 'docs')!.run()
    expect(run.docs).toEqual(['écrite'])
    await run.view().actions!.find((action) => action.id === 'host')!.run()
    expect(run.opened).toEqual(['obsidian'])
    // Sans onglet de réglages chez la plateforme (la démonstration) : pas de bouton pour lui.
    expect(settingsPage({ ...run.deps, openHostSettings: undefined }).actions?.map((action) => action.id)).toEqual(['docs'])
  })
})
