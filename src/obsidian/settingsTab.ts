// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** L'onglet de réglages : langue, modules et licence. */

import { PluginSettingTab, Setting, type App } from 'obsidian'
import type { MappingField, ModuleDescriptor } from '../core/modules/module'
import type { ModuleState } from '../core/modules/registry'
import { LANGUAGES, moduleSettings, withModuleEnabled, type Language } from '../core/settings'
import type BlackProjectsPlugin from './main'
import { ModuleDetailsModal } from './moduleDetailsModal'

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

      const details = module.details?.(moduleSettings(plugin.config, module.id))
      if (details) {
        const openDetails = () => new ModuleDetailsModal(this.app, plugin.i18n, t(module.nameKey), details).open()
        setting.nameEl.addClass('bp-module-name-link')
        setting.nameEl.setAttr('role', 'button')
        setting.nameEl.setAttr('tabindex', '0')
        setting.nameEl.setAttr('aria-label', t('module.details.open', { title: t(details.titleKey) }))
        setting.nameEl.addEventListener('click', openDetails)
        setting.nameEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openDetails()
          }
        })
        setting.addButton((button) => button.setButtonText(t(details.titleKey)).onClick(openDetails))
      }

      setting.addToggle((toggle) =>
        toggle.setValue(!plugin.config.disabledModules.includes(module.id)).onChange(async (enabled) => {
          plugin.config = withModuleEnabled(plugin.config, module.id, enabled)
          await plugin.saveSettings()
          plugin.platform.notifier.notify(t('settings.modules.reload'))
        })
      )

      for (const field of module.settingsFields ?? []) this.renderMapping(list.createDiv(), module, field)
    }

    new Setting(containerEl).setName(t('settings.licence')).setHeading()
    new Setting(containerEl).setName(plugin.describeLicence()).setDesc(t('settings.licence.owner'))
  }

  /**
   * Un réglage fait de paires « .tot lu comme .xml » : les paires enregistrées, chacune
   * avec de quoi la retirer, puis le formulaire d'ajout. Ce qui est permis, c'est le
   * module qui le dit (`validate`) ; ici, on ne fait que dessiner et enregistrer.
   */
  private renderMapping(block: HTMLElement, module: ModuleDescriptor, field: MappingField): void {
    const { plugin } = this
    const t = plugin.i18n.t.bind(plugin.i18n)
    const prefix = field.prefix ?? ''
    const settings = () => moduleSettings(plugin.config, module.id)
    const save = async (pairs: Record<string, string>) => {
      await plugin.saveModuleSettings(module.id, { ...settings(), [field.key]: pairs })
      this.display()
    }

    block.addClass('bp-module-settings')
    const head = new Setting(block).setName(t(field.nameKey))
    if (field.descKey) head.setDesc(t(field.descKey))

    const current = field.read(settings())
    const pairs = Object.entries(current).sort(([a], [b]) => a.localeCompare(b))
    if (pairs.length === 0) {
      block.createDiv({ text: t('settings.mapping.empty'), cls: 'bp-mapping-empty' })
    }
    for (const [from, to] of pairs) {
      new Setting(block)
        .setClass('bp-mapping-pair')
        .setName(`${prefix}${from}  ${t(field.connectorKey)}  ${prefix}${to}`)
        .addExtraButton((button) =>
          button
            .setIcon('trash-2')
            .setTooltip(t('settings.mapping.remove'))
            .onClick(async () => {
              const next = { ...current }
              delete next[from]
              await save(next)
            })
        )
    }

    let typed = ''
    const options = field.options()
    let target = field.defaultOption && options.includes(field.defaultOption) ? field.defaultOption : (options[0] ?? '')
    new Setting(block)
      .setClass('bp-mapping-add')
      .addText((text) => {
        text.setPlaceholder(`${prefix}${field.placeholderKey ? t(field.placeholderKey) : ''}`)
        text.onChange((value) => (typed = value))
      })
      .addDropdown((dropdown) => {
        for (const option of options) dropdown.addOption(option, `${t(field.connectorKey)} ${prefix}${option}`)
        dropdown.setValue(target).onChange((value) => (target = value))
      })
      .addButton((button) =>
        button
          .setButtonText(t('settings.mapping.add'))
          .setCta()
          .onClick(async () => {
            const from = field.normalize(typed)
            const error = field.validate(from, target, current)
            if (error) {
              plugin.platform.notifier.notify(t(error.key, error.vars), 6000)
              return
            }
            await save({ ...current, [from]: target })
          })
      )
  }
}
