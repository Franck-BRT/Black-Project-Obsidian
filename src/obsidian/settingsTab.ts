// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** L'onglet de réglages : langue, modules et licence. */

import { PluginSettingTab, Setting, type App } from 'obsidian'
import type { ModuleState } from '../core/modules/registry'
import { LANGUAGES, withModuleEnabled, type Language } from '../core/settings'
import type BlackProjectsPlugin from './main'

const STATE_CLASS: Record<ModuleState, string> = {
  active: 'is-active',
  pending: '',
  disabled: '',
  'not-licensed': 'is-blocked',
  'missing-dependency': 'is-blocked',
  failed: 'is-failed'
}

export class BlackProjectsSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: BlackProjectsPlugin
  ) {
    super(app, plugin)
  }

  override display(): void {
    const { containerEl, plugin } = this
    const t = plugin.i18n.t.bind(plugin.i18n)
    containerEl.empty()

    new Setting(containerEl).setName(t('settings.general')).setHeading()
    new Setting(containerEl)
      .setName(t('settings.language'))
      .setDesc(t('settings.language.desc'))
      .addDropdown((dropdown) => {
        for (const language of LANGUAGES) dropdown.addOption(language, t(`settings.language.${language}`))
        dropdown.setValue(plugin.config.language).onChange(async (value) => {
          plugin.config = { ...plugin.config, language: value as Language }
          await plugin.saveSettings()
          plugin.platform.notifier.notify(t('settings.languageReload'))
        })
      })

    new Setting(containerEl).setName(t('settings.modules')).setHeading().setDesc(t('settings.modules.desc'))
    const list = containerEl.createDiv({ cls: 'bp-modules-list' })
    for (const status of plugin.registry.list()) {
      const { module } = status
      const setting = new Setting(list).setName(`${t(module.nameKey)} · ${module.version}`)
      const description = setting.descEl
      description.createDiv({ text: t(module.descriptionKey) })
      if (module.requires.length > 0) {
        const names = module.requires.map((id) => {
          const required = plugin.registry.status(id)?.module
          return required ? t(required.nameKey) : id
        })
        description.createDiv({ text: t('settings.modules.requires', { modules: names.join(', ') }) })
      }
      const stateText =
        status.state === 'failed' && status.error
          ? `${t('module.state.failed')} : ${status.error}`
          : status.state === 'missing-dependency' && status.missing.length > 0
            ? `${t('module.state.missing-dependency')} : ${status.missing.join(', ')}`
            : t(`module.state.${status.state}`)
      description.createDiv({ text: stateText, cls: ['bp-module-state', STATE_CLASS[status.state]].filter(Boolean) })

      setting.addToggle((toggle) =>
        toggle.setValue(!plugin.config.disabledModules.includes(module.id)).onChange(async (enabled) => {
          plugin.config = withModuleEnabled(plugin.config, module.id, enabled)
          await plugin.saveSettings()
          plugin.platform.notifier.notify(t('settings.modules.reload'))
        })
      )
    }

    new Setting(containerEl).setName(t('settings.licence')).setHeading()
    new Setting(containerEl).setName(plugin.describeLicence()).setDesc(t('settings.licence.owner'))
  }
}
