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

  override async onload(): Promise<void> {
    this.storage = pluginSettingsStorage(this)
    this.config = readSettings(await this.storage.load())
    this.i18n = createI18n(this.config.language)
    this.platform = obsidianPlatform(this.app, this.manifest.version)

    for (const module of MODULES) {
      this.registry.register(module)
      this.i18n.register('fr', module.texts.fr)
      this.i18n.register('en', module.texts.en)
    }

    this.addCommand({
      id: 'about',
      name: this.i18n.t('command.about'),
      callback: () => this.showAbout()
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
        save: async (values) => {
          this.config = { ...this.config, modules: { ...this.config.modules, [module.id]: { ...values } } }
          await this.saveSettings()
        }
      },
      commands: {
        register: (command) => this.addModuleCommand(module, command)
      }
    }
  }

  private addModuleCommand(module: BlackModule, command: ModuleCommand): void {
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
