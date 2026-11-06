// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'onglet de réglages : langue, documentation, modules et licence. Chaque réglage,
 * bouton et état porte une infobulle qui dit à quoi il sert.
 */

import { APPEARANCE_MODES, COLOR_VISIONS, MOTIONS, READING_MODES, TEXT_SIZES, type Appearance } from '../core/appearance'
import { PluginSettingTab, Setting, setTooltip, type App } from 'obsidian'
import type { ModuleState } from '../core/modules/registry'
import { cleanFolder, DEFAULT_DOCS_FOLDER, LANGUAGES, moduleSettings, withModuleEnabled, type Language } from '../core/settings'
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

    // ── Général ──────────────────────────────────────────────────────────────────
    new Setting(containerEl).setName(t('settings.general')).setHeading()
    new Setting(containerEl)
      .setName(t('settings.language'))
      .setDesc(t('settings.language.desc'))
      .addDropdown((dropdown) => {
        for (const language of LANGUAGES) dropdown.addOption(language, t(`settings.language.${language}`))
        setTooltip(dropdown.selectEl, t('tip.language'))
        dropdown.setValue(plugin.config.language).onChange(async (value) => {
          plugin.config = { ...plugin.config, language: value as Language }
          await plugin.saveSettings()
          plugin.platform.notifier.notify(t('settings.languageReload'))
        })
      })

    // ── Accueil et apparence ─────────────────────────────────────────────────────
    new Setting(containerEl).setName(t('settings.appearance')).setHeading().setDesc(t('settings.appearance.desc'))
    new Setting(containerEl)
      .setName(t('settings.home.atStart'))
      .setDesc(t('settings.home.atStart.desc'))
      .addToggle((toggle) =>
        toggle.setValue(plugin.config.openHomeAtStart).onChange(async (value) => {
          plugin.config = { ...plugin.config, openHomeAtStart: value }
          await plugin.saveSettings()
        })
      )
      .addButton((button) => button.setButtonText(t('command.home')).onClick(() => void plugin.openHome()))
    const choice = <K extends keyof Appearance>(key: K, values: readonly Appearance[K][]) =>
      new Setting(containerEl)
        .setName(t(`ui.appearance.${key}`))
        .setDesc(t(`ui.appearance.${key}.${plugin.config.appearance[key]}.desc`))
        .addDropdown((dropdown) => {
          for (const value of values) dropdown.addOption(value, t(`ui.appearance.${key}.${value}`))
          dropdown.setValue(plugin.config.appearance[key]).onChange(async (value) => {
            await plugin.saveAppearance({ ...plugin.config.appearance, [key]: value })
            this.display()
          })
        })
    choice('mode', APPEARANCE_MODES)
    choice('vision', COLOR_VISIONS)
    choice('reading', READING_MODES)
    choice('size', TEXT_SIZES)
    choice('motion', MOTIONS)

    // ── Documentation ────────────────────────────────────────────────────────────
    new Setting(containerEl).setName(t('settings.docs')).setHeading()
    new Setting(containerEl)
      .setName(t('settings.docs.folder'))
      .setDesc(t('settings.docs.folder.desc'))
      .addText((text) => {
        text.setPlaceholder(DEFAULT_DOCS_FOLDER).setValue(plugin.config.docsFolder)
        setTooltip(text.inputEl, t('tip.docs.folder'))
        text.onChange(async (value) => {
          plugin.config = { ...plugin.config, docsFolder: cleanFolder(value) || DEFAULT_DOCS_FOLDER }
          await plugin.saveSettings()
        })
      })
    new Setting(containerEl)
      .setName(t('settings.docs.create'))
      .setDesc(t('settings.docs.create.desc'))
      .addButton((button) =>
        button
          .setButtonText(t('settings.docs.button'))
          .setCta()
          .setTooltip(t('tip.docs.create'))
          .onClick(() => plugin.createDocumentation())
      )

    // ── Modules ──────────────────────────────────────────────────────────────────
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
        const requires = description.createDiv({ text: t('settings.modules.requires', { modules: names.join(', ') }) })
        setTooltip(requires, t('tip.module.requires'))
      }
      const stateText =
        status.state === 'failed' && status.error
          ? `${t('module.state.failed')} : ${status.error}`
          : status.state === 'missing-dependency' && status.missing.length > 0
            ? `${t('module.state.missing-dependency')} : ${status.missing.join(', ')}`
            : t(`module.state.${status.state}`)
      const state = description.createDiv({
        text: stateText,
        cls: ['bp-module-state', STATE_CLASS[status.state]].filter(Boolean)
      })
      setTooltip(state, t(`tip.module.state.${status.state}`))

      const details = module.details?.(moduleSettings(plugin.config, module.id))
      if (details) {
        const openDetails = () => void plugin.openModuleWindow(module)
        setting.nameEl.addClass('bp-module-name-link')
        setting.nameEl.setAttr('role', 'button')
        setting.nameEl.setAttr('tabindex', '0')
        setTooltip(setting.nameEl, t('module.details.open', { title: t(details.titleKey) }))
        setting.nameEl.addEventListener('click', openDetails)
        setting.nameEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openDetails()
          }
        })
        setting.addButton((button) =>
          button.setButtonText(t(details.titleKey)).setTooltip(t('tip.module.details')).onClick(openDetails)
        )
      }

      const enabled = !plugin.config.disabledModules.includes(module.id)
      setting.addToggle((toggle) =>
        toggle
          .setValue(enabled)
          .setTooltip(t(enabled ? 'tip.module.toggle.on' : 'tip.module.toggle.off'))
          .onChange(async (value) => {
            plugin.config = withModuleEnabled(plugin.config, module.id, value)
            await plugin.saveSettings()
            toggle.setTooltip(t(value ? 'tip.module.toggle.on' : 'tip.module.toggle.off'))
            plugin.platform.notifier.notify(t('settings.modules.reload'))
          })
      )
    }

    // ── Licence ──────────────────────────────────────────────────────────────────
    new Setting(containerEl).setName(t('settings.licence')).setHeading()
    const licence = new Setting(containerEl).setName(plugin.describeLicence()).setDesc(t('settings.licence.owner'))
    setTooltip(licence.nameEl, t('tip.licence'))
  }
}
