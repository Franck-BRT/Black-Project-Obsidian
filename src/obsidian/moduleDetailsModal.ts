// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La fenêtre d'un module, ouverte depuis les réglages : ses réglages propres en tête
 * (les extensions équivalentes, pour la lecture de fichiers), puis ce qu'il sait faire et
 * ce qui arrive — une ligne par famille, un petit bloc par fonction, coloré selon son
 * état. Le contenu vient du module (`settingsFields`, `details`) ; cette fenêtre ne fait
 * que le dessiner, et se redessine quand un réglage change.
 */

import { Modal, Setting, setTooltip, ToggleComponent, type App } from 'obsidian'
import {
  FEATURE_STATUSES,
  type FeatureStatus,
  type ActionsField,
  type BooleanField,
  type SecretField,
  type MappingChange,
  type ModuleFeature,
  type MappingField,
  type TextField,
  type TogglesField,
  type ModuleDescriptor,
  type ModuleDetails
} from '../core/modules/module'
import { moduleSettings } from '../core/settings'
import type BlackProjectsPlugin from './main'

export class ModuleDetailsModal extends Modal {
  /** Les listes dépliées : elles le restent quand la fenêtre se redessine. */
  private readonly openLists = new Set<string>()

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

  /**
   * Dessine (ou redessine) la fenêtre. Redessiner après un interrupteur ne doit pas
   * ramener l'utilisateur en haut : la position de défilement est gardée.
   */
  private render(): void {
    const { contentEl, modalEl, module } = this
    const scrolled = [modalEl.scrollTop, contentEl.scrollTop]
    const details = module.details?.(this.settings())
    contentEl.empty()
    this.setTitle(details ? `${this.t(module.nameKey)} — ${this.t(details.titleKey)}` : this.t(module.nameKey))
    for (const field of module.settingsFields ?? []) {
      if (field.kind === 'mapping') this.renderMapping(contentEl.createDiv(), field)
      else if (field.kind === 'actions') this.renderActions(contentEl.createDiv(), field)
      else if (field.kind === 'toggles') this.renderToggles(contentEl.createDiv(), field)
      else if (field.kind === 'boolean') this.renderBoolean(contentEl.createDiv(), field)
      else if (field.kind === 'secret') this.renderSecret(contentEl.createDiv(), field)
      else this.renderText(contentEl.createDiv(), field)
    }
    if (details) this.renderDetails(contentEl.createDiv(), details)
    modalEl.scrollTop = scrolled[0] ?? 0
    contentEl.scrollTop = scrolled[1] ?? 0
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

  /**
   * Des éléments rangés dans des colonnes : un bouton qui ouvre la petite fenêtre d'ajout
   * (l'élément, et un interrupteur par colonne), puis la liste dépliable où chaque élément
   * a ses interrupteurs et de quoi le retirer.
   */
  private renderToggles(block: HTMLElement, field: TogglesField): void {
    const { plugin, module } = this
    const t = this.t.bind(this)
    const settings = this.settings()
    const items = field.read(settings)
    const save = async (item: string, columns: readonly string[] | null) => {
      await plugin.saveModuleSettings(module.id, field.write(this.settings(), item, columns))
      this.render()
    }

    block.addClass('bp-module-settings')
    const head = new Setting(block).setName(t(field.nameKey))
    head.addButton((button) => {
      button
        .setButtonText(t(field.addKey))
        .setCta()
        .onClick(() => void this.addToggled(field, save))
      if (field.tooltipKeys?.add) button.setTooltip(t(field.tooltipKeys.add))
    })

    const names = Object.keys(items).sort((a, b) => a.localeCompare(b))
    const list = block.createEl('details', { cls: 'bp-toggles-list' })
    list.open = this.openLists.has(field.key)
    list.addEventListener('toggle', () => {
      if (list.open) this.openLists.add(field.key)
      else this.openLists.delete(field.key)
    })
    const summary = list.createEl('summary', { text: t(field.listKey, { count: names.length }) })
    if (field.tooltipKeys?.list) setTooltip(summary, t(field.tooltipKeys.list))
    // L'explication en haut du tableau ; chaque élément tient ensuite sur une ligne.
    if (field.descKey) list.createDiv({ text: t(field.descKey), cls: 'bp-toggles-intro' })
    if (names.length === 0) list.createDiv({ text: t(field.emptyKey), cls: 'bp-mapping-empty' })
    for (const item of names) {
      const on = new Set(items[item])
      const label = field.itemLabel(item, settings, t)
      const line = new Setting(list).setClass('bp-toggles-item').setName(label)
      // Coupé par des points de suspension s'il est trop long : le libellé entier en infobulle.
      setTooltip(line.nameEl, label)
      for (const column of field.columns) {
        line.controlEl.createSpan({ text: t(column.labelKey), cls: 'bp-toggles-column' })
        line.addToggle((toggle) => {
          toggle.setValue(on.has(column.id))
          if (column.tooltipKey) toggle.setTooltip(t(column.tooltipKey))
          toggle.onChange(async (value) => {
            const next = field.columns.map((each) => each.id).filter((id) => (id === column.id ? value : on.has(id)))
            if (next.length === 0) {
              plugin.platform.notifier.notify(t(field.minimumKey), 6000)
              this.render()
              return
            }
            await save(item, next)
          })
        })
      }
      line.addExtraButton((button) => {
        button.setIcon('trash-2').onClick(() => void save(item, null))
        if (field.tooltipKeys?.remove) button.setTooltip(t(field.tooltipKeys.remove))
      })
    }
  }

  /** La petite fenêtre d'ajout : l'élément à ajouter, et ses colonnes. */
  private async addToggled(
    field: TogglesField,
    save: (item: string, columns: readonly string[] | null) => Promise<void>
  ): Promise<void> {
    const t = this.t.bind(this)
    const settings = this.settings()
    const candidates = field.candidates(settings)
    if (candidates.length === 0) {
      this.plugin.platform.notifier.notify(t(field.noCandidateKey), 6000)
      return
    }
    const initially = new Set(field.defaultColumns ?? field.columns.map((column) => column.id))
    const values = await this.plugin.platform.ui.askForm({
      title: t(field.addTitleKey),
      ...(field.addIntroKey ? { intro: t(field.addIntroKey) } : {}),
      fields: [
        {
          kind: 'choice',
          key: 'item',
          label: t(field.itemFieldKey),
          options: candidates.map((item) => ({ value: item, label: field.itemLabel(item, settings, t) }))
        },
        ...field.columns.map((column) => ({
          kind: 'toggle' as const,
          key: `c:${column.id}`,
          label: t(column.labelKey),
          value: initially.has(column.id),
          ...(column.tooltipKey ? { tooltip: t(column.tooltipKey) } : {})
        }))
      ],
      submit: t(field.addKey),
      validate: (entered) => (field.columns.some((column) => entered[`c:${column.id}`] === 'true') ? null : t(field.minimumKey))
    })
    if (!values?.item) return
    this.openLists.add(field.key)
    await save(
      values.item,
      field.columns.filter((column) => values[`c:${column.id}`] === 'true').map((column) => column.id)
    )
  }

  /**
   * Un secret : un champ masqué, rangé dans le trousseau à chaque saisie — jamais dans les
   * réglages. La fenêtre dit s'il est enregistré, sans jamais le montrer.
   */
  private renderSecret(block: HTMLElement, field: SecretField): void {
    const t = this.t.bind(this)
    const secrets = this.plugin.platform.secrets
    block.addClass('bp-module-settings')
    const setting = new Setting(block).setName(t(field.nameKey))
    const describe = () =>
      setting.setDesc(
        [field.descKey ? t(field.descKey) : '', t(secrets?.get(field.secretId) ? 'settings.secret.saved' : 'settings.secret.empty')]
          .filter(Boolean)
          .join(' ')
      )
    if (!secrets) {
      setting.setDesc(t('settings.secret.unavailable'))
      return
    }
    describe()
    setting.addText((text) => {
      text.inputEl.type = 'password'
      text.inputEl.autocomplete = 'off'
      text.setPlaceholder(field.placeholderKey ? t(field.placeholderKey) : '')
      if (field.tooltipKey) setTooltip(text.inputEl, t(field.tooltipKey))
      text.onChange((value) => {
        secrets.set(field.secretId, value.trim())
        describe()
      })
    })
  }

  /** Un réglage oui / non : un interrupteur, enregistré aussitôt. */
  private renderBoolean(block: HTMLElement, field: BooleanField): void {
    const { plugin, module } = this
    const t = this.t.bind(this)
    const stored = this.settings()[field.key]
    block.addClass('bp-module-settings')
    const setting = new Setting(block).setName(t(field.nameKey))
    if (field.descKey) setting.setDesc(t(field.descKey))
    setting.addToggle((toggle) => {
      toggle.setValue(typeof stored === 'boolean' ? stored : field.defaultValue)
      if (field.tooltipKey) toggle.setTooltip(t(field.tooltipKey))
      toggle.onChange(async (value) => {
        await plugin.saveModuleSettings(module.id, { ...this.settings(), [field.key]: value })
      })
    })
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
    // Les valeurs proposées (les modèles du serveur) : un menu, seulement s'il y en a.
    const choices = field.choices?.(this.settings()) ?? []
    if (choices.length === 0) return
    const current = typeof stored === 'string' ? stored : ''
    setting.addDropdown((dropdown) => {
      dropdown.addOption('', t('settings.choices.pick', { count: choices.length }))
      for (const choice of choices) dropdown.addOption(choice, choice)
      dropdown.setValue(choices.includes(current) ? current : '')
      if (field.choicesTooltipKey) setTooltip(dropdown.selectEl, t(field.choicesTooltipKey))
      dropdown.onChange(async (value) => {
        if (!value) return
        await plugin.saveModuleSettings(module.id, { ...this.settings(), [field.key]: field.normalize(value) })
        this.render()
      })
    })
  }

  /**
   * L'interrupteur d'une fiche : il retire son identifiant de la liste (ou l'y ajoute) —
   * celle des éléments éteints, ou celle des allumés (`listed: 'on'`) —, enregistre, et
   * redessine la fenêtre.
   */
  private renderSwitch(head: HTMLElement, spec: NonNullable<ModuleFeature['switch']>, disabled: boolean): void {
    const { plugin, module } = this
    const t = this.t.bind(this)
    const onList = spec.listed === 'on'
    const stored = this.settings()[spec.settingsKey]
    const enabled = onList ? Array.isArray(stored) && stored.includes(spec.id) : !disabled
    const toggle = new ToggleComponent(head.createDiv({ cls: 'bp-feature-switch' })).setValue(enabled)
    if (spec.tooltipKeys) toggle.setTooltip(t(enabled ? spec.tooltipKeys.on : spec.tooltipKeys.off))
    toggle.onChange(async (value) => {
      const settings = this.settings()
      const raw = settings[spec.settingsKey]
      const list = Array.isArray(raw) ? raw.filter((each): each is string => typeof each === 'string') : []
      const add = onList ? value : !value
      const next = add ? [...new Set([...list, spec.id])] : list.filter((each) => each !== spec.id)
      await plugin.saveModuleSettings(module.id, { ...settings, [spec.settingsKey]: next })
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
    // Des fiches colorées par leur propre couleur : le résumé les compte par couleur.
    const tones = details.toneKeys
    for (const tone of tones ? (['yes', 'partial', 'no'] as const) : []) {
      const count = features.filter((feature) => feature.tone === tone).length
      if (count === 0 || !tones) continue
      const badge = legend.createSpan({ text: `${t(tones[tone].label)} : ${count}`, cls: ['bp-feature-badge', `is-tone-${tone}`] })
      if (tones[tone].tip) setTooltip(badge, t(tones[tone].tip))
    }
    for (const status of tones ? [] : FEATURE_STATUSES) {
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
      const row = block.createDiv({ cls: ['bp-feature-row', ...(details.columns ? ['is-grid'] : [])] })
      if (details.columns) row.style.setProperty('--bp-columns', String(details.columns))
      for (const feature of section.features) {
        const look = reference ? 'is-reference' : feature.tone ? `is-tone-${feature.tone}` : `is-${feature.status}`
        const card = row.createDiv({ cls: ['bp-feature', look, ...(feature.disabled ? ['is-disabled'] : [])] })
        const label = t(feature.labelKey, feature.vars)
        const head = card.createDiv({ cls: 'bp-feature-head' })
        head.createDiv({ text: feature.prefix ? `${feature.prefix} — ${label}` : label, cls: 'bp-feature-label' })
        if (feature.switch) this.renderSwitch(head, feature.switch, Boolean(feature.disabled))
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
        if (feature.facts && feature.facts.length > 0) {
          const facts = card.createDiv({ cls: 'bp-feature-facts' })
          for (const fact of feature.facts) {
            const line = facts.createDiv({ cls: 'bp-feature-fact' })
            line.createSpan({ text: t(fact.labelKey), cls: 'bp-feature-fact-label' })
            for (const value of fact.values) {
              const pill = line.createSpan({ text: t(value.textKey, value.vars), cls: ['bp-fact', `is-${value.tone}`] })
              if (value.tooltipKey) setTooltip(pill, t(value.tooltipKey, value.vars))
            }
          }
        }
        if (feature.noteKey) card.createDiv({ text: t(feature.noteKey, feature.vars), cls: 'bp-feature-note' })
        if (reference) continue
        if (feature.badge) {
          const badge = card.createSpan({
            text: t(feature.badge.textKey, feature.badge.vars),
            cls: ['bp-feature-badge', `is-tone-${feature.badge.tone}`]
          })
          if (feature.badge.tooltipKey) setTooltip(badge, t(feature.badge.tooltipKey, feature.badge.vars))
          continue
        }
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
