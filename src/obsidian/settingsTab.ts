// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** L'onglet de réglages : langue, modules et licence. */

import { PluginSettingTab, Setting, type App } from 'obsidian'
import { FEATURE_STATUSES, type FeatureStatus, type ModuleDetails } from '../core/modules/module'
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
  /** Les modules dont le détail est ouvert ; gardé tant que l'onglet vit. */
  private readonly expanded = new Set<string>()

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

      const details = module.details
      if (details) {
        const open = this.expanded.has(module.id)
        const toggleDetails = () => {
          if (open) this.expanded.delete(module.id)
          else this.expanded.add(module.id)
          this.display()
        }
        setting.nameEl.addClass('bp-module-name-toggle')
        setting.nameEl.setAttr('role', 'button')
        setting.nameEl.setAttr('tabindex', '0')
        setting.nameEl.addEventListener('click', toggleDetails)
        setting.nameEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleDetails()
          }
        })
        setting.addExtraButton((button) =>
          button
            .setIcon(open ? 'chevron-up' : 'chevron-down')
            .setTooltip(`${t(open ? 'module.details.hide' : 'module.details.show')} — ${t(details.titleKey)}`)
            .onClick(toggleDetails)
        )
      }

      setting.addToggle((toggle) =>
        toggle.setValue(!plugin.config.disabledModules.includes(module.id)).onChange(async (enabled) => {
          plugin.config = withModuleEnabled(plugin.config, module.id, enabled)
          await plugin.saveSettings()
          plugin.platform.notifier.notify(t('settings.modules.reload'))
        })
      )

      if (details && this.expanded.has(module.id)) this.renderDetails(list.createDiv(), details)
    }

    new Setting(containerEl).setName(t('settings.licence')).setHeading()
    new Setting(containerEl).setName(plugin.describeLicence()).setDesc(t('settings.licence.owner'))
  }

  /** Le détail d'un module : une ligne par famille, un petit bloc par fonction. */
  private renderDetails(panel: HTMLElement, details: ModuleDetails): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n)
    const statusLabel = (status: FeatureStatus) => t(details.statusKeys?.[status] ?? `module.feature.${status}`)
    panel.addClass('bp-module-details')
    panel.createDiv({ text: t(details.titleKey), cls: 'bp-module-details-title' })
    if (details.introKey) panel.createDiv({ text: t(details.introKey), cls: 'bp-module-details-intro' })

    const features = details.sections.flatMap((section) => section.features)
    const legend = panel.createDiv({ cls: 'bp-feature-legend' })
    for (const status of FEATURE_STATUSES) {
      const count = features.filter((feature) => feature.status === status).length
      if (count === 0) continue
      legend.createSpan({ text: `${statusLabel(status)} : ${count}`, cls: ['bp-feature-badge', `is-${status}`] })
    }

    for (const section of details.sections) {
      const block = panel.createDiv({ cls: 'bp-feature-section' })
      block.createDiv({ text: t(section.titleKey), cls: 'bp-feature-section-title' })
      const row = block.createDiv({ cls: 'bp-feature-row' })
      for (const feature of section.features) {
        const card = row.createDiv({ cls: ['bp-feature', `is-${feature.status}`] })
        card.createDiv({ text: t(feature.labelKey), cls: 'bp-feature-label' })
        if (feature.tags && feature.tags.length > 0) {
          const tags = card.createDiv({ cls: 'bp-feature-tags' })
          for (const tag of feature.tags) tags.createSpan({ text: `.${tag}`, cls: 'bp-feature-tag' })
        }
        if (feature.noteKey) card.createDiv({ text: t(feature.noteKey), cls: 'bp-feature-note' })
        const status =
          feature.step !== undefined && feature.status !== 'available'
            ? `${statusLabel(feature.status)} · ${t('module.feature.step', { step: feature.step })}`
            : statusLabel(feature.status)
        card.createSpan({ text: status, cls: ['bp-feature-badge', `is-${feature.status}`] })
      }
    }
  }
}
