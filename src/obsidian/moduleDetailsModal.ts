// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La fenêtre qui montre le détail d'un module : ce qu'il sait faire et ce qui arrive,
 * une ligne par famille, un petit bloc par fonction, coloré selon son état. Le contenu
 * vient du module (`details`) ; cette fenêtre ne fait que le dessiner.
 */

import { Modal, type App } from 'obsidian'
import type { I18n } from '../core/i18n'
import { FEATURE_STATUSES, type FeatureStatus, type ModuleDetails } from '../core/modules/module'

export class ModuleDetailsModal extends Modal {
  constructor(
    app: App,
    private readonly i18n: I18n,
    private readonly moduleName: string,
    private readonly details: ModuleDetails
  ) {
    super(app)
  }

  override onOpen(): void {
    const { contentEl, details } = this
    const t = this.i18n.t.bind(this.i18n)
    const statusLabel = (status: FeatureStatus) => t(details.statusKeys?.[status] ?? `module.feature.${status}`)

    this.modalEl.addClass('bp-details-modal')
    this.setTitle(`${this.moduleName} — ${t(details.titleKey)}`)
    const panel = contentEl.createDiv({ cls: 'bp-module-details' })
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

  override onClose(): void {
    this.contentEl.empty()
  }
}
