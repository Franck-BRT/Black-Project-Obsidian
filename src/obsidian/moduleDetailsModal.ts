// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La fenêtre d'un module, ouverte depuis les réglages : ses réglages propres en tête
 * (les extensions équivalentes, pour la lecture de fichiers), puis ce qu'il sait faire et
 * ce qui arrive — une ligne par famille, un petit bloc par fonction, coloré selon son
 * état. Le contenu vient du module (`settingsFields`, `details`) ; cette fenêtre ne fait
 * que le dessiner, et se redessine quand un réglage change.
 */

import { DropdownComponent, Modal, Setting, setTooltip, ToggleComponent, type App } from 'obsidian'
import {
  FEATURE_STATUSES,
  type FeatureStatus,
  type ActionsField,
  type MappingChange,
  type ModuleFeature,
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
      else if (field.kind === 'actions') this.renderActions(contentEl.createDiv(), field)
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
    const settings = this.settings()
    const current = field.read(settings)
    const free = field.valueKind === 'text'
    const optionText = (option: string) => {
      if (free) return option
      const label = field.optionLabel?.(option, settings, t)
      return label ? `${prefix}${option} — ${label}` : `${prefix}${option}`
    }
    const save = async (pairs: Record<string, string>, change: MappingChange) => {
      const next = { ...this.settings(), [field.key]: pairs }
      await plugin.saveModuleSettings(module.id, field.afterChange ? field.afterChange(change, next) : next)
      this.render()
    }
    const without = (from: string) => {
      const rest = { ...current }
      delete rest[from]
      return rest
    }

    block.addClass('bp-module-settings')
    block.createDiv({ text: t(field.nameKey), cls: 'bp-module-settings-title' })
    if (field.descKey) block.createDiv({ text: t(field.descKey), cls: 'bp-module-settings-desc' })

    const options = free ? [] : field.options(settings)
    let typed = ''
    let target = free ? '' : field.defaultOption && options.includes(field.defaultOption) ? field.defaultOption : (options[0] ?? '')
    const add = async () => {
      const from = field.normalize(typed)
      const to = free ? (field.normalizeValue?.(target) ?? target.trim()) : target
      const error = field.validate(from, to, current, settings)
      if (error) {
        plugin.platform.notifier.notify(t(error.key, error.vars), 6000)
        return
      }
      await save({ ...current, [from]: to }, { kind: 'add', from, to })
    }
    const onEnter = (input: HTMLInputElement) =>
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void add()
        }
      })
    const row = new Setting(block).setClass('bp-mapping-add').addText((text) => {
      text.setPlaceholder(`${prefix}${field.placeholderKey ? t(field.placeholderKey) : ''}`)
      text.onChange((value) => (typed = value))
      if (field.tooltipKeys?.from) setTooltip(text.inputEl, t(field.tooltipKeys.from))
      onEnter(text.inputEl)
    })
    if (free) {
      row.addText((text) => {
        text.setPlaceholder(field.valuePlaceholderKey ? t(field.valuePlaceholderKey) : '')
        text.onChange((value) => (target = value))
        text.inputEl.addClass('bp-mapping-value')
        if (field.tooltipKeys?.to) setTooltip(text.inputEl, t(field.tooltipKeys.to))
        onEnter(text.inputEl)
      })
    } else {
      row.addDropdown((dropdown) => {
        for (const option of options) dropdown.addOption(option, `${t(field.connectorKey)} ${optionText(option)}`)
        dropdown.setValue(target).onChange((value) => (target = value))
        if (field.tooltipKeys?.to) setTooltip(dropdown.selectEl, t(field.tooltipKeys.to))
      })
    }
    row.addButton((button) =>
      button
        .setButtonText(t('settings.mapping.add'))
        .setCta()
        .setTooltip(t(field.tooltipKeys?.add ?? 'tip.mapping.add'))
        .onClick(add)
    )

    const pairs = Object.entries(current).sort(([a], [b]) => a.localeCompare(b))
    if (pairs.length === 0) block.createDiv({ text: t('settings.mapping.empty'), cls: 'bp-mapping-empty' })
    for (const [from, to] of pairs) {
      const line = new Setting(block).setClass('bp-mapping-pair').setName(`${prefix}${from}  ${t(field.connectorKey)}  ${optionText(to)}`)
      if (field.editable) {
        line.addExtraButton((button) =>
          button
            .setIcon('pencil')
            .setTooltip(t(field.tooltipKeys?.edit ?? 'tip.mapping.edit'))
            .onClick(() => void this.editPair(field, from, to, without(from), optionText, save))
        )
      }
      line.addExtraButton((button) =>
        button
          .setIcon('trash-2')
          .setTooltip(t(field.tooltipKeys?.remove ?? 'tip.mapping.remove'))
          .onClick(async () => {
            const impact = field.describeRemoval?.(from, to, this.settings(), t)
            if (impact) {
              const yes = await plugin.platform.ui.confirm({
                title: t('settings.mapping.removeTitle', { item: `${prefix}${from}` }),
                message: impact,
                confirm: t('settings.mapping.delete'),
                cancel: t('settings.mapping.cancel'),
                danger: true
              })
              if (!yes) return
            }
            await save(without(from), { kind: 'remove', from, to })
          })
      )
    }
  }

  /** Le formulaire qui modifie une paire : les deux valeurs, contrôlées comme à l'ajout. */
  private async editPair(
    field: MappingField,
    from: string,
    to: string,
    others: Record<string, string>,
    optionText: (option: string) => string,
    save: (pairs: Record<string, string>, change: MappingChange) => Promise<void>
  ): Promise<void> {
    const t = this.t.bind(this)
    const settings = this.settings()
    const free = field.valueKind === 'text'
    const values = await this.plugin.platform.ui.askForm({
      title: t(field.editTitleKey ?? 'settings.mapping.editTitle', { from: `${field.prefix ?? ''}${from}` }),
      fields: [
        {
          kind: 'text',
          key: 'from',
          label: t(field.fromLabelKey ?? field.nameKey),
          value: from,
          required: true,
          ...(field.tooltipKeys?.from ? { tooltip: t(field.tooltipKeys.from) } : {})
        },
        free
          ? {
              kind: 'text',
              key: 'to',
              label: t(field.toLabelKey ?? field.connectorKey),
              value: to,
              required: true,
              ...(field.tooltipKeys?.to ? { tooltip: t(field.tooltipKeys.to) } : {})
            }
          : {
              kind: 'choice',
              key: 'to',
              label: t(field.toLabelKey ?? field.connectorKey),
              value: to,
              options: field.options(settings).map((option) => ({ value: option, label: optionText(option) })),
              ...(field.tooltipKeys?.to ? { tooltip: t(field.tooltipKeys.to) } : {})
            }
      ],
      submit: t('settings.mapping.save'),
      validate: (entered) => {
        const newFrom = field.normalize(entered.from ?? '')
        const newTo = free ? (field.normalizeValue?.(entered.to ?? '') ?? (entered.to ?? '').trim()) : (entered.to ?? '')
        const error = field.validate(newFrom, newTo, others, settings)
        return error ? t(error.key, error.vars) : null
      }
    })
    if (!values) return
    const newFrom = field.normalize(values.from ?? '')
    const newTo = free ? (field.normalizeValue?.(values.to ?? '') ?? (values.to ?? '').trim()) : (values.to ?? '')
    if (newFrom === from && newTo === to) return
    await save({ ...others, [newFrom]: newTo }, { kind: 'edit', from: newFrom, to: newTo, previousFrom: from, previousTo: to })
  }

  /** Une ligne de boutons, chacun lançant une commande du module ; la fenêtre se redessine après. */
  private renderActions(block: HTMLElement, field: ActionsField): void {
    const t = this.t.bind(this)
    block.addClass('bp-module-settings')
    const row = new Setting(block).setName(t(field.nameKey))
    if (field.descKey) row.setDesc(t(field.descKey))
    for (const action of field.actions) {
      row.addButton((button) => {
        button.setButtonText(t(action.labelKey)).onClick(async () => {
          await this.plugin.runModuleCommand(this.module.id, action.commandId)
          this.render()
        })
        if (action.tooltipKey) button.setTooltip(t(action.tooltipKey))
      })
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

  /**
   * L'interrupteur d'une fiche : il retire son identifiant de la liste des désactivés (ou
   * l'y ajoute), enregistre, et redessine la fenêtre.
   */
  private renderSwitch(head: HTMLElement, spec: NonNullable<ModuleFeature['switch']>, enabled: boolean): void {
    const { plugin, module } = this
    const t = this.t.bind(this)
    const toggle = new ToggleComponent(head.createDiv({ cls: 'bp-feature-switch' })).setValue(enabled)
    if (spec.tooltipKeys) toggle.setTooltip(t(enabled ? spec.tooltipKeys.on : spec.tooltipKeys.off))
    toggle.onChange(async (value) => {
      const settings = this.settings()
      const raw = settings[spec.settingsKey]
      const list = Array.isArray(raw) ? raw.filter((each): each is string => typeof each === 'string') : []
      const next = value ? list.filter((each) => each !== spec.id) : [...new Set([...list, spec.id])]
      await plugin.saveModuleSettings(module.id, { ...settings, [spec.settingsKey]: next })
      this.render()
    })
  }

  /** Le menu d'une fiche : la valeur choisie est rangée sous son identifiant, puis la fenêtre se redessine. */
  private renderSelect(card: HTMLElement, spec: NonNullable<ModuleFeature['select']>): void {
    const { plugin, module } = this
    const t = this.t.bind(this)
    const row = card.createDiv({ cls: 'bp-feature-select' })
    row.createSpan({ text: t(spec.labelKey), cls: 'bp-feature-group' })
    const dropdown = new DropdownComponent(row)
    for (const option of spec.options) dropdown.addOption(option.value, t(option.labelKey))
    dropdown.setValue(spec.value)
    if (spec.tooltipKey) setTooltip(dropdown.selectEl, t(spec.tooltipKey))
    dropdown.onChange(async (value) => {
      const settings = this.settings()
      const raw = settings[spec.settingsKey]
      const map = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {}
      map[spec.id] = value
      await plugin.saveModuleSettings(module.id, { ...settings, [spec.settingsKey]: map })
      this.render()
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
        const card = row.createDiv({
          cls: ['bp-feature', reference ? 'is-reference' : `is-${feature.status}`, ...(feature.disabled ? ['is-disabled'] : [])]
        })
        const label = t(feature.labelKey, feature.vars)
        const head = card.createDiv({ cls: 'bp-feature-head' })
        head.createDiv({ text: feature.prefix ? `${feature.prefix} — ${label}` : label, cls: 'bp-feature-label' })
        if (feature.switch) this.renderSwitch(head, feature.switch, !feature.disabled)
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
        if (feature.select) this.renderSelect(card, feature.select)
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
