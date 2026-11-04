// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La fenêtre d'un module, ouverte depuis les réglages : ses réglages propres en tête
 * (les extensions équivalentes, pour la lecture de fichiers), puis ce qu'il sait faire et
 * ce qui arrive — une ligne par famille, un petit bloc par fonction, coloré selon son
 * état. Le contenu vient du module (`settingsFields`, `details`) ; cette fenêtre ne fait
 * que le dessiner, et se redessine quand un réglage change.
 */

import { Modal, Setting, setTooltip, type App } from 'obsidian'
import {
  FEATURE_STATUSES,
  type FeatureStatus,
  type MappingField,
  type TextField,
  type ModuleDescriptor,
  type ModuleDetails
} from '../core/modules/module'
import { moduleSettings } from '../core/settings'
import type BlackProjectsPlugin from './main'

export class ModuleDetailsModal extends Modal {
  constructor(
    app: App,
    private readonly plugin: BlackProjectsPlugin,
    private readonly module: ModuleDescriptor
  ) {
    super(app)
  }

  private t(key: string, vars?: Readonly<Record<string, string | number>>): string {
    return this.plugin.i18n.t(key, vars)
  }

  private settings(): Readonly<Record<string, unknown>> {
    return moduleSettings(this.plugin.config, this.module.id)
  }

  override onOpen(): void {
    this.modalEl.addClass('bp-details-modal')
    this.render()
  }

  override onClose(): void {
    this.contentEl.empty()
  }

  private render(): void {
    const { contentEl, module } = this
    const details = module.details?.(this.settings())
    contentEl.empty()
    this.setTitle(details ? `${this.t(module.nameKey)} — ${this.t(details.titleKey)}` : this.t(module.nameKey))
    for (const field of module.settingsFields ?? []) {
      if (field.kind === 'mapping') this.renderMapping(contentEl.createDiv(), field)
      else this.renderText(contentEl.createDiv(), field)
    }
    if (details) this.renderDetails(contentEl.createDiv(), details)
  }

  /**
   * Un réglage fait de paires « .tot lu comme .xml » : le formulaire d'ajout, puis les
   * paires enregistrées, chacune avec de quoi la retirer. Ce qui est permis, c'est le
   * module qui le dit (`validate`) ; ici, on ne fait que dessiner et enregistrer.
   */
  private renderMapping(block: HTMLElement, field: MappingField): void {
    const { plugin, module } = this
    const t = this.t.bind(this)
    const prefix = field.prefix ?? ''
    const current = field.read(this.settings())
    const save = async (pairs: Record<string, string>) => {
      await plugin.saveModuleSettings(module.id, { ...this.settings(), [field.key]: pairs })
      this.render()
    }

    block.addClass('bp-module-settings')
    block.createDiv({ text: t(field.nameKey), cls: 'bp-module-settings-title' })
    if (field.descKey) block.createDiv({ text: t(field.descKey), cls: 'bp-module-settings-desc' })

    const options = field.options()
    let typed = ''
    let target = field.defaultOption && options.includes(field.defaultOption) ? field.defaultOption : (options[0] ?? '')
    const add = async () => {
      const from = field.normalize(typed)
      const error = field.validate(from, target, current)
      if (error) {
        plugin.platform.notifier.notify(t(error.key, error.vars), 6000)
        return
      }
      await save({ ...current, [from]: target })
    }
    new Setting(block)
      .setClass('bp-mapping-add')
      .addText((text) => {
        text.setPlaceholder(`${prefix}${field.placeholderKey ? t(field.placeholderKey) : ''}`)
        text.onChange((value) => (typed = value))
        if (field.tooltipKeys?.from) setTooltip(text.inputEl, t(field.tooltipKeys.from))
        text.inputEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void add()
          }
        })
      })
      .addDropdown((dropdown) => {
        for (const option of options) dropdown.addOption(option, `${t(field.connectorKey)} ${prefix}${option}`)
        dropdown.setValue(target).onChange((value) => (target = value))
        if (field.tooltipKeys?.to) setTooltip(dropdown.selectEl, t(field.tooltipKeys.to))
      })
      .addButton((button) =>
        button
          .setButtonText(t('settings.mapping.add'))
          .setCta()
          .setTooltip(t(field.tooltipKeys?.add ?? 'tip.mapping.add'))
          .onClick(add)
      )

    const pairs = Object.entries(current).sort(([a], [b]) => a.localeCompare(b))
    if (pairs.length === 0) block.createDiv({ text: t('settings.mapping.empty'), cls: 'bp-mapping-empty' })
    for (const [from, to] of pairs) {
      new Setting(block)
        .setClass('bp-mapping-pair')
        .setName(`${prefix}${from}  ${t(field.connectorKey)}  ${prefix}${to}`)
        .addExtraButton((button) =>
          button
            .setIcon('trash-2')
            .setTooltip(t(field.tooltipKeys?.remove ?? 'tip.mapping.remove'))
            .onClick(async () => {
              const next = { ...current }
              delete next[from]
              await save(next)
            })
        )
    }
  }

  /** Un réglage fait d'un texte, enregistré à chaque saisie ; vide, il revient à sa valeur par défaut. */
  private renderText(block: HTMLElement, field: TextField): void {
    const { plugin, module } = this
    const t = this.t.bind(this)
    const stored = this.settings()[field.key]
    block.addClass('bp-module-settings')
    const setting = new Setting(block).setName(t(field.nameKey))
    if (field.descKey) setting.setDesc(t(field.descKey))
    setting.addText((text) => {
      text.setPlaceholder(field.defaultValue).setValue(typeof stored === 'string' ? stored : field.defaultValue)
      if (field.tooltipKey) setTooltip(text.inputEl, t(field.tooltipKey))
      text.onChange(async (value) => {
        const clean = field.normalize(value) || field.defaultValue
        await plugin.saveModuleSettings(module.id, { ...this.settings(), [field.key]: clean })
      })
    })
  }

  /** Le détail : un résumé, puis une ligne par famille et un petit bloc par fonction. */
  private renderDetails(panel: HTMLElement, details: ModuleDetails): void {
    const t = this.t.bind(this)
    const statusLabel = (status: FeatureStatus) => t(details.statusKeys?.[status] ?? `module.feature.${status}`)
    panel.addClass('bp-module-details')
    if (details.introKey) panel.createDiv({ text: t(details.introKey), cls: 'bp-module-details-intro' })

    const features = details.sections.filter((section) => section.kind !== 'reference').flatMap((section) => section.features)
    const legend = panel.createDiv({ cls: 'bp-feature-legend' })
    for (const status of FEATURE_STATUSES) {
      const count = features.filter((feature) => feature.status === status).length
      if (count === 0) continue
      const badge = legend.createSpan({ text: `${statusLabel(status)} : ${count}`, cls: ['bp-feature-badge', `is-${status}`] })
      setTooltip(badge, t(`tip.feature.${status}`))
    }

    for (const section of details.sections) {
      const reference = section.kind === 'reference'
      const tagPrefix = section.tagPrefix ?? '.'
      const block = panel.createDiv({ cls: ['bp-feature-section', ...(reference ? ['is-reference'] : [])] })
      block.createDiv({ text: t(section.titleKey), cls: 'bp-feature-section-title' })
      if (section.introKey) block.createDiv({ text: t(section.introKey), cls: 'bp-feature-section-intro' })
      const row = block.createDiv({ cls: 'bp-feature-row' })
      for (const feature of section.features) {
        const card = row.createDiv({ cls: ['bp-feature', reference ? 'is-reference' : `is-${feature.status}`] })
        const label = t(feature.labelKey, feature.vars)
        card.createDiv({ text: feature.prefix ? `${feature.prefix} — ${label}` : label, cls: 'bp-feature-label' })
        if (feature.tags && feature.tags.length > 0) {
          const tags = card.createDiv({ cls: 'bp-feature-tags' })
          for (const tag of feature.tags) tags.createSpan({ text: `${tagPrefix}${tag}`, cls: 'bp-feature-tag' })
        }
        for (const group of feature.tagGroups ?? []) {
          if (group.tags.length === 0) continue
          card.createDiv({ text: t(group.labelKey), cls: 'bp-feature-group' })
          const tags = card.createDiv({ cls: 'bp-feature-tags' })
          for (const tag of group.tags) tags.createSpan({ text: `${tagPrefix}${tag}`, cls: 'bp-feature-tag' })
        }
        if (feature.noteKey) card.createDiv({ text: t(feature.noteKey, feature.vars), cls: 'bp-feature-note' })
        if (reference) continue
        const status =
          feature.step !== undefined && feature.status !== 'available'
            ? `${statusLabel(feature.status)} · ${t('module.feature.step', { step: feature.step })}`
            : statusLabel(feature.status)
        const badge = card.createSpan({ text: status, cls: ['bp-feature-badge', `is-${feature.status}`] })
        setTooltip(badge, t(`tip.feature.${feature.status}`))
      }
    }
  }
}
