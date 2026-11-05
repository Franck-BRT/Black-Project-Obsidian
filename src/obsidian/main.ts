// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le point d'entrée du plugin Obsidian : il lit les réglages, déclare les modules,
 * vérifie les droits, active ce qui peut l'être et branche les commandes.
 */

import { Plugin } from 'obsidian'
import { createI18n, type I18n } from '../core/i18n'
import { describeEntitlements, EVALUATION, type Entitlements } from '../core/licence'
import type { BlackModule, ModuleCommand, ModuleContext } from '../core/modules/module'
import { ModuleRegistry } from '../core/modules/registry'
import type { Platform, SettingsStorage } from '../core/ports'
import { docModules, documentationPages, writeDocumentation } from '../core/docs'
import { moduleSettings, readSettings, type CoreSettings } from '../core/settings'
import { MODULES } from '../modules'
import { obsidianPlatform, pluginSettingsStorage } from './platform'
import { BlackProjectsSettingTab } from './settingsTab'

export default class BlackProjectsPlugin extends Plugin {
  config!: CoreSettings
  i18n!: I18n
  platform!: Platform
  readonly registry = new ModuleRegistry()
  /** Les droits d'usage. Le jour où une licence existe, c'est ici qu'elle est lue. */
  entitlements: Entitlements = EVALUATION
  private storage!: SettingsStorage
  private readonly settingsListeners = new Map<string, Set<(values: Readonly<Record<string, unknown>>) => void>>()
  /** Les commandes déclarées par les modules, pour les lancer aussi depuis leur fenêtre. */
  private readonly moduleCommands = new Map<string, ModuleCommand>()

  override async onload(): Promise<void> {
    this.storage = pluginSettingsStorage(this)
    this.config = readSettings(await this.storage.load())
    this.i18n = createI18n(this.config.language)
    this.platform = obsidianPlatform(this.app, this.manifest.version, this.i18n)

    for (const module of MODULES) {
      this.registry.register(module)
      this.i18n.register('fr', module.texts.fr)
      this.i18n.register('en', module.texts.en)
    }

    // Des réglages rangés autrement par une version plus ancienne, remis en ordre.
    let migrated = false
    for (const module of MODULES) {
      const modules = module.migrateSettings?.(this.config.modules)
      if (modules) {
        this.config = { ...this.config, modules }
        migrated = true
      }
    }
    if (migrated) await this.saveSettings()

    this.addCommand({
      id: 'about',
      name: this.i18n.t('command.about'),
      callback: () => this.showAbout()
    })
    this.addCommand({
      id: 'documentation',
      name: this.i18n.t('command.docs'),
      callback: () => void this.createDocumentation()
    })
    this.addSettingTab(new BlackProjectsSettingTab(this.app, this))

    await this.registry.activateAll({
      disabled: this.config.disabledModules,
      entitlements: this.entitlements,
      contextFor: (module) => this.contextFor(module),
      onError: (module, error) => {
        console.error(`[Black Projects] module ${module.id}`, error)
        this.platform.notifier.notify(this.i18n.t('module.failed.notice', { name: this.i18n.t(module.nameKey) }))
      }
    })
  }

  override async onunload(): Promise<void> {
    await this.registry.deactivateAll((module, error) => console.error(`[Black Projects] module ${module.id}`, error))
  }

  async saveSettings(): Promise<void> {
    await this.storage.save(this.config)
  }

  /** Enregistre les réglages d'un module et prévient le module. */
  async saveModuleSettings(moduleId: string, values: Record<string, unknown>): Promise<void> {
    this.config = { ...this.config, modules: { ...this.config.modules, [moduleId]: { ...values } } }
    await this.saveSettings()
    const current = moduleSettings(this.config, moduleId)
    for (const listener of this.settingsListeners.get(moduleId) ?? []) {
      try {
        listener(current)
      } catch (error) {
        console.error(`[Black Projects] réglages du module ${moduleId}`, error)
      }
    }
  }

  /**
   * Écrit la documentation de Black Projects et de ses modules dans le dossier choisi,
   * puis ouvre l'accueil. Les notes de l'utilisateur au même endroit ne sont jamais
   * remplacées.
   */
  async createDocumentation(): Promise<void> {
    const t = (key: string, vars?: Readonly<Record<string, string | number>>) => this.i18n.t(key, vars)
    const folder = this.config.docsFolder
    const version = this.manifest.version
    try {
      const modules = docModules(this.registry.list(), {
        version,
        folder,
        t,
        settingsFor: (id) => moduleSettings(this.config, id)
      })
      const report = await writeDocumentation(this.platform.fs, folder, documentationPages({ version, folder, modules }))
      this.platform.notifier.notify(
        t('docs.done', {
          folder,
          created: report.created.length,
          updated: report.updated.length,
          unchanged: report.unchanged.length
        }),
        8000
      )
      if (report.kept.length > 0) {
        this.platform.notifier.notify(t('docs.kept', { count: report.kept.length, files: report.kept.join(', ') }), 12000)
      }
      await this.platform.ui.openNote(`${folder}/Accueil.md`)
    } catch (error) {
      console.error('[Black Projects] documentation', error)
      this.platform.notifier.notify(t('docs.failed', { error: error instanceof Error ? error.message : String(error) }), 10000)
    }
  }

  describeLicence(): string {
    return describeEntitlements(this.entitlements, (key, vars) => this.i18n.t(key, vars))
  }

  private showAbout(): void {
    const statuses = this.registry.list()
    this.platform.notifier.notify(
      this.i18n.t('about.notice', {
        version: this.manifest.version,
        active: statuses.filter((status) => status.state === 'active').length,
        total: statuses.length,
        licence: this.describeLicence()
      }),
      8000
    )
  }

  private contextFor(module: BlackModule): ModuleContext {
    return {
      moduleId: module.id,
      platform: this.platform,
      i18n: this.i18n,
      settings: {
        get: () => moduleSettings(this.config, module.id),
        save: (values) => this.saveModuleSettings(module.id, values),
        onChange: (listener) => {
          const listeners = this.settingsListeners.get(module.id) ?? new Set()
          listeners.add(listener)
          this.settingsListeners.set(module.id, listeners)
          return () => listeners.delete(listener)
        }
      },
      commands: {
        register: (command) => this.addModuleCommand(module, command)
      }
    }
  }

  /** Lance une commande d'un module, comme depuis la palette ; une erreur est montrée, pas levée. */
  async runModuleCommand(moduleId: string, commandId: string): Promise<void> {
    const command = this.moduleCommands.get(`${moduleId}-${commandId}`)
    if (!command) return
    try {
      await command.run()
    } catch (error) {
      console.error(`[Black Projects] ${moduleId}-${commandId}`, error)
      this.platform.notifier.notify(error instanceof Error ? error.message : String(error))
    }
  }

  private addModuleCommand(module: BlackModule, command: ModuleCommand): void {
    this.moduleCommands.set(`${module.id}-${command.id}`, command)
    this.addCommand({
      id: `${module.id}-${command.id}`,
      name: this.i18n.t(command.nameKey),
      callback: () => {
        Promise.resolve()
          .then(() => command.run())
          .catch((error: unknown) => {
            console.error(`[Black Projects] ${module.id}-${command.id}`, error)
            this.platform.notifier.notify(error instanceof Error ? error.message : String(error))
          })
      }
    })
  }
}
