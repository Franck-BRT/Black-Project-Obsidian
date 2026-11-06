// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La fenêtre « Fonctions » d'un module : ses réglages propres en tête (paires, textes à
 * choix, boutons, interrupteurs par colonnes, oui / non, secret), puis ce qu'il sait faire
 * et ce qui arrive — un résumé, une ligne par famille, une fiche par fonction. Le contenu
 * vient du module (`settingsFields`, `details`) ; la fenêtre le dessine, et se redessine
 * sur place quand un réglage change (le défilement ne bouge pas).
 */

import { useState } from 'preact/hooks'
import {
  FEATURE_STATUSES,
  type ActionsField,
  type BooleanField,
  type FactTone,
  type FeatureStatus,
  type MappingChange,
  type MappingField,
  type ModuleDescriptor,
  type ModuleDetails,
  type ModuleFeature,
  type ModuleSettingField,
  type SecretField,
  type TextField,
  type TogglesField
} from '../../core/modules/module'
import type { SecretStore } from '../../core/ports'
import type { Tone } from '../../core/views'
import { Icon } from '../icons'
import { TONE_ICON } from '../logic'
import { Dialog, openDialog, type DialogHost } from './frame'
import type { dialogWindows } from './windows'

type Settings = Readonly<Record<string, unknown>>

export interface ModuleWindowHost extends DialogHost {
  module: ModuleDescriptor
  settings(): Settings
  save(values: Record<string, unknown>): Promise<void>
  runCommand(id: string): Promise<void>
  secrets?: SecretStore
  dialogs: ReturnType<typeof dialogWindows>
}

const FACT_TONE: Record<FactTone, Tone> = { yes: 'success', partial: 'warning', no: 'danger' }
const STATUS_TONE: Record<FeatureStatus, Tone> = { available: 'success', 'in-progress': 'warning', planned: 'neutral' }

function ToneBadge({ tone, text, tip }: { tone: Tone; text: string; tip?: string }) {
  return (
    <span class={`bp-badge bp-tone-${tone}`} title={tip}>
      <Icon name={TONE_ICON[tone]} />
      {text}
    </span>
  )
}

function Switch({ checked, label, tip, onChange }: { checked: boolean; label: string; tip?: string; onChange: (value: boolean) => void }) {
  return (
    <span class="bp-switch" title={tip}>
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(event) => onChange((event.target as HTMLInputElement).checked)} />
      <span />
    </span>
  )
}

function BlockHead({ title, desc, children }: { title: string; desc?: string; children?: preact.ComponentChildren }) {
  return (
    <div class="bp-block-head">
      <div>
        <h3 class="bp-block-title">{title}</h3>
        {desc && <div class="bp-field-desc">{desc}</div>}
      </div>
      {children && <div class="bp-block-controls">{children}</div>}
    </div>
  )
}

// ── Les réglages ─────────────────────────────────────────────────────────────────

function MappingBlock({ field, host, refresh }: { field: MappingField; host: ModuleWindowHost; refresh: () => void }) {
  const { t } = host
  const settings = host.settings()
  const current = field.read(settings)
  const free = field.valueKind === 'text'
  const prefix = field.prefix ?? ''
  const options = free ? [] : field.options(settings)
  const [typed, setTyped] = useState('')
  const [target, setTarget] = useState(free ? '' : field.defaultOption && options.includes(field.defaultOption) ? field.defaultOption : (options[0] ?? ''))
  const optionText = (option: string) => {
    if (free) return option
    const label = field.optionLabel?.(option, settings, t)
    return label ? `${prefix}${option} — ${label}` : `${prefix}${option}`
  }
  const save = async (pairs: Record<string, string>, change: MappingChange) => {
    const next = { ...host.settings(), [field.key]: pairs }
    await host.save(field.afterChange ? field.afterChange(change, next) : next)
    refresh()
  }
  const without = (from: string) => {
    const rest = { ...current }
    delete rest[from]
    return rest
  }
  const add = async () => {
    const from = field.normalize(typed)
    const to = free ? (field.normalizeValue?.(target) ?? target.trim()) : target
    const error = field.validate(from, to, current, settings)
    if (error) {
      host.notify(t(error.key, error.vars))
      return
    }
    setTyped('')
    if (free) setTarget('')
    await save({ ...current, [from]: to }, { kind: 'add', from, to })
  }
  const edit = async (from: string, to: string) => {
    const others = without(from)
    const values = await host.dialogs.askForm({
      title: t(field.editTitleKey ?? 'settings.mapping.editTitle', { from: `${prefix}${from}` }),
      fields: [
        { kind: 'text', key: 'from', label: t(field.fromLabelKey ?? field.nameKey), value: from, required: true, ...(field.tooltipKeys?.from ? { tooltip: t(field.tooltipKeys.from) } : {}) },
        free
          ? { kind: 'text', key: 'to', label: t(field.toLabelKey ?? field.connectorKey), value: to, required: true }
          : { kind: 'choice', key: 'to', label: t(field.toLabelKey ?? field.connectorKey), value: to, options: field.options(settings).map((option) => ({ value: option, label: optionText(option) })) }
      ],
      submit: t('settings.mapping.save'),
      validate: (entered) => {
        const error = field.validate(field.normalize(entered.from ?? ''), free ? (field.normalizeValue?.(entered.to ?? '') ?? (entered.to ?? '').trim()) : (entered.to ?? ''), others, settings)
        return error ? t(error.key, error.vars) : null
      }
    })
    if (!values) return
    const newFrom = field.normalize(values.from ?? '')
    const newTo = free ? (field.normalizeValue?.(values.to ?? '') ?? (values.to ?? '').trim()) : (values.to ?? '')
    if (newFrom === from && newTo === to) return
    await save({ ...others, [newFrom]: newTo }, { kind: 'edit', from: newFrom, to: newTo, previousFrom: from, previousTo: to })
  }
  const remove = async (from: string, to: string) => {
    const impact = field.describeRemoval?.(from, to, host.settings(), t)
    if (impact) {
      const yes = await host.dialogs.confirm({ title: t('settings.mapping.removeTitle', { item: `${prefix}${from}` }), message: impact, confirm: t('settings.mapping.delete'), cancel: t('settings.mapping.cancel'), danger: true })
      if (!yes) return
    }
    await save(without(from), { kind: 'remove', from, to })
  }
  const enter = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void add()
    }
  }
  const pairs = Object.entries(current).sort(([a], [b]) => a.localeCompare(b))
  return (
    <section class="bp-block">
      <BlockHead title={t(field.nameKey)} desc={field.descKey ? t(field.descKey) : undefined} />
      <div class="bp-block-controls bp-mapping-add">
        <input class="bp-input" aria-label={t(field.fromLabelKey ?? field.nameKey)} placeholder={`${prefix}${field.placeholderKey ? t(field.placeholderKey) : ''}`} title={field.tooltipKeys?.from ? t(field.tooltipKeys.from) : undefined} value={typed} onInput={(event) => setTyped((event.target as HTMLInputElement).value)} onKeyDown={enter} />
        {free ? (
          <input class="bp-input" aria-label={t(field.toLabelKey ?? field.connectorKey)} placeholder={field.valuePlaceholderKey ? t(field.valuePlaceholderKey) : ''} title={field.tooltipKeys?.to ? t(field.tooltipKeys.to) : undefined} value={target} onInput={(event) => setTarget((event.target as HTMLInputElement).value)} onKeyDown={enter} />
        ) : (
          <select class="bp-select" aria-label={t(field.connectorKey)} title={field.tooltipKeys?.to ? t(field.tooltipKeys.to) : undefined} value={target} onChange={(event) => setTarget((event.target as HTMLSelectElement).value)}>
            {options.map((option) => (
              <option key={option} value={option}>
                {`${t(field.connectorKey)} ${optionText(option)}`}
              </option>
            ))}
          </select>
        )}
        <button type="button" class="bp-button bp-button-primary" title={t(field.tooltipKeys?.add ?? 'tip.mapping.add')} onClick={() => void add()}>
          <Icon name="plus" />
          {t('settings.mapping.add')}
        </button>
      </div>
      {pairs.length === 0 ? (
        <p class="bp-empty">{t('settings.mapping.empty')}</p>
      ) : (
        <ul class="bp-pairs">
          {pairs.map(([from, to]) => (
            <li class="bp-pair" key={from}>
              <span>
                <strong>{`${prefix}${from}`}</strong> {t(field.connectorKey)} {optionText(to)}
              </span>
              <span class="bp-pair-actions">
                {field.editable && (
                  <button type="button" class="bp-button bp-button-icon" aria-label={`${t(field.tooltipKeys?.edit ?? 'tip.mapping.edit')} ${prefix}${from}`} title={t(field.tooltipKeys?.edit ?? 'tip.mapping.edit')} onClick={() => void edit(from, to)}>
                    <Icon name="edit" />
                  </button>
                )}
                <button type="button" class="bp-button bp-button-icon" aria-label={`${t(field.tooltipKeys?.remove ?? 'tip.mapping.remove')} ${prefix}${from}`} title={t(field.tooltipKeys?.remove ?? 'tip.mapping.remove')} onClick={() => void remove(from, to)}>
                  <Icon name="trash" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TogglesBlock({ field, host, refresh, open, setOpen }: { field: TogglesField; host: ModuleWindowHost; refresh: () => void; open: boolean; setOpen: (open: boolean) => void }) {
  const { t } = host
  const settings = host.settings()
  const items = field.read(settings)
  const names = Object.keys(items).sort((a, b) => a.localeCompare(b))
  const save = async (item: string, columns: readonly string[] | null) => {
    await host.save(field.write(host.settings(), item, columns))
    refresh()
  }
  const add = async () => {
    const candidates = field.candidates(settings)
    if (!candidates.length) {
      host.notify(t(field.noCandidateKey))
      return
    }
    const initially = new Set(field.defaultColumns ?? field.columns.map((column) => column.id))
    const values = await host.dialogs.askForm({
      title: t(field.addTitleKey),
      ...(field.addIntroKey ? { intro: t(field.addIntroKey) } : {}),
      fields: [
        { kind: 'choice', key: 'item', label: t(field.itemFieldKey), options: candidates.map((item) => ({ value: item, label: field.itemLabel(item, settings, t) })) },
        ...field.columns.map((column) => ({ kind: 'toggle' as const, key: `c:${column.id}`, label: t(column.labelKey), value: initially.has(column.id), ...(column.tooltipKey ? { tooltip: t(column.tooltipKey) } : {}) }))
      ],
      submit: t(field.addSubmitKey ?? field.addKey),
      validate: (entered) => (field.columns.some((column) => entered[`c:${column.id}`] === 'true') ? null : t(field.minimumKey))
    })
    if (!values?.item) return
    setOpen(true)
    await save(values.item, field.columns.filter((column) => values[`c:${column.id}`] === 'true').map((column) => column.id))
  }
  return (
    <section class="bp-block">
      <BlockHead title={t(field.nameKey)}>
        <button type="button" class="bp-button bp-button-primary" title={field.tooltipKeys?.add ? t(field.tooltipKeys.add) : undefined} onClick={() => void add()}>
          <Icon name="plus" />
          {t(field.addKey)}
        </button>
      </BlockHead>
      <details class="bp-details bp-toggles-list" open={open} onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary title={field.tooltipKeys?.list ? t(field.tooltipKeys.list) : undefined}>{t(field.listKey, { count: names.length })}</summary>
        {field.descKey && <p class="bp-intro">{t(field.descKey)}</p>}
        {names.length === 0 && <p class="bp-empty">{t(field.emptyKey)}</p>}
        {names.map((item) => {
          const on = new Set(items[item])
          const label = field.itemLabel(item, settings, t)
          return (
            <div class="bp-toggle-row bp-toggles-item" key={item}>
              <span class="bp-toggle-row-name" title={label}>
                {label}
              </span>
              <span class="bp-toggle-cols">
                {field.columns.map((column) => (
                  <label class="bp-toggle-col" key={column.id} title={column.tooltipKey ? t(column.tooltipKey) : undefined}>
                    {t(column.labelKey)}
                    <Switch
                      checked={on.has(column.id)}
                      label={`${label} — ${t(column.labelKey)}`}
                      onChange={async (value) => {
                        const next = field.columns.map((each) => each.id).filter((id) => (id === column.id ? value : on.has(id)))
                        if (!next.length) {
                          host.notify(t(field.minimumKey))
                          refresh()
                          return
                        }
                        await save(item, next)
                      }}
                    />
                  </label>
                ))}
                <button type="button" class="bp-button bp-button-icon" aria-label={`${field.tooltipKeys?.remove ? t(field.tooltipKeys.remove) : t('settings.mapping.delete')} ${label}`} title={field.tooltipKeys?.remove ? t(field.tooltipKeys.remove) : undefined} onClick={() => void save(item, null)}>
                  <Icon name="trash" />
                </button>
              </span>
            </div>
          )
        })}
      </details>
    </section>
  )
}

function SecretBlock({ field, host }: { field: SecretField; host: ModuleWindowHost }) {
  const { t } = host
  const secrets = host.secrets
  const [saved, setSaved] = useState(Boolean(secrets?.get(field.secretId)))
  const id = `bp-secret-${field.secretId}`
  return (
    <section class="bp-block">
      <div class="bp-field">
        <label class="bp-block-title" for={id}>
          {t(field.nameKey)}
        </label>
        <div class="bp-field-desc" aria-live="polite">
          {secrets ? [field.descKey ? t(field.descKey) : '', t(saved ? 'settings.secret.saved' : 'settings.secret.empty')].filter(Boolean).join(' ') : t('settings.secret.unavailable')}
        </div>
        {secrets && (
          <input
            id={id}
            class="bp-input"
            type="password"
            autocomplete="off"
            placeholder={field.placeholderKey ? t(field.placeholderKey) : ''}
            title={field.tooltipKey ? t(field.tooltipKey) : undefined}
            onInput={(event) => {
              secrets.set(field.secretId, (event.target as HTMLInputElement).value.trim())
              setSaved(Boolean(secrets.get(field.secretId)))
            }}
          />
        )}
      </div>
    </section>
  )
}

function BooleanBlock({ field, host, refresh }: { field: BooleanField; host: ModuleWindowHost; refresh: () => void }) {
  const { t } = host
  const stored = host.settings()[field.key]
  return (
    <section class="bp-block">
      <div class="bp-field bp-field-row">
        <span>
          <span class="bp-block-title">{t(field.nameKey)}</span>
          {field.descKey && <div class="bp-field-desc">{t(field.descKey)}</div>}
        </span>
        <Switch
          checked={typeof stored === 'boolean' ? stored : field.defaultValue}
          label={t(field.nameKey)}
          tip={field.tooltipKey ? t(field.tooltipKey) : undefined}
          onChange={async (value) => {
            await host.save({ ...host.settings(), [field.key]: value })
            refresh()
          }}
        />
      </div>
    </section>
  )
}

function ActionsBlock({ field, host, refresh }: { field: ActionsField; host: ModuleWindowHost; refresh: () => void }) {
  const { t } = host
  const [busy, setBusy] = useState('')
  return (
    <section class="bp-block">
      <BlockHead title={t(field.nameKey)} desc={field.descKey ? t(field.descKey) : undefined}>
        {field.actions.map((action) => (
          <button
            key={action.commandId}
            type="button"
            class="bp-button"
            disabled={busy === action.commandId}
            aria-busy={busy === action.commandId}
            title={action.tooltipKey ? t(action.tooltipKey) : undefined}
            onClick={async () => {
              setBusy(action.commandId)
              try {
                await host.runCommand(action.commandId)
              } finally {
                setBusy('')
                refresh()
              }
            }}
          >
            {t(action.labelKey)}
          </button>
        ))}
      </BlockHead>
    </section>
  )
}

const TYPE = '__bp-saisir__'

function TextBlock({ field, host, refresh }: { field: TextField; host: ModuleWindowHost; refresh: () => void }) {
  const { t } = host
  const stored = host.settings()[field.key]
  const current = typeof stored === 'string' ? stored : ''
  const choices = field.choices?.(host.settings()) ?? []
  const [typing, setTyping] = useState(false)
  const id = `bp-text-${field.key}`
  const save = async (value: string) => {
    await host.save({ ...host.settings(), [field.key]: field.normalize(value) || field.defaultValue })
  }
  return (
    <section class="bp-block">
      <div class="bp-block-head">
        <div style={{ flex: '1 1 260px' }}>
          <label class="bp-block-title" for={id}>
            {t(field.nameKey)}
          </label>
          {field.descKey && <div class="bp-field-desc">{t(field.descKey)}</div>}
        </div>
        <div class="bp-block-controls">
          {choices.length === 0 || typing ? (
            <>
              <input id={id} class="bp-input" placeholder={field.defaultValue} title={field.tooltipKey ? t(field.tooltipKey) : undefined} value={typeof stored === 'string' ? stored : field.defaultValue} onInput={(event) => void save((event.target as HTMLInputElement).value)} />
              {choices.length > 0 && (
                <button
                  type="button"
                  class="bp-button bp-button-icon"
                  aria-label={t('settings.choices.back')}
                  title={t('settings.choices.back')}
                  onClick={() => {
                    setTyping(false)
                    refresh()
                  }}
                >
                  <Icon name="list" />
                </button>
              )}
            </>
          ) : (
            <select
              id={id}
              class="bp-select"
              value={current}
              title={field.choicesTooltipKey ? t(field.choicesTooltipKey) : undefined}
              onChange={async (event) => {
                const value = (event.target as HTMLSelectElement).value
                if (value === TYPE) setTyping(true)
                else await save(value)
                refresh()
              }}
            >
              <option value="">{t('settings.choices.none')}</option>
              {choices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
              {current && !choices.includes(current) && <option value={current}>{t('settings.choices.typed', { name: current })}</option>}
              <option value={TYPE}>{t('settings.choices.type')}</option>
            </select>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Ce que le module sait faire ──────────────────────────────────────────────────

function FeatureCard({ feature, reference, tagPrefix, statusLabel, host, refresh }: { feature: ModuleFeature; reference: boolean; tagPrefix: string; statusLabel: (status: FeatureStatus) => string; host: ModuleWindowHost; refresh: () => void }) {
  const { t } = host
  const label = t(feature.labelKey, feature.vars)
  const tone: Tone = reference ? 'neutral' : feature.tone ? FACT_TONE[feature.tone] : STATUS_TONE[feature.status]
  const sw = feature.switch
  let switchControl = null
  if (sw) {
    const stored = host.settings()[sw.settingsKey]
    const onList = sw.listed === 'on'
    const enabled = onList ? Array.isArray(stored) && stored.includes(sw.id) : !feature.disabled
    switchControl = (
      <Switch
        checked={enabled}
        label={label}
        tip={sw.tooltipKeys ? t(enabled ? sw.tooltipKeys.on : sw.tooltipKeys.off) : undefined}
        onChange={async (value) => {
          const settings = host.settings()
          const raw = settings[sw.settingsKey]
          const list = Array.isArray(raw) ? raw.filter((each): each is string => typeof each === 'string') : []
          const add = onList ? value : !value
          const next = add ? [...new Set([...list, sw.id])] : list.filter((each) => each !== sw.id)
          await host.save({ ...settings, [sw.settingsKey]: next })
          refresh()
        }}
      />
    )
  }
  const tags = (list: readonly string[]) => (
    <div class="bp-tags">
      {list.map((tag) => (
        <span class="bp-tag" key={tag}>{`${tagPrefix}${tag}`}</span>
      ))}
    </div>
  )
  return (
    <article class={`bp-feature-card bp-tone-${tone}${reference ? ' is-reference' : ''}${feature.disabled ? ' is-disabled' : ''}`}>
      <div class="bp-feature-head">
        <span class="bp-feature-label">{feature.prefix ? `${feature.prefix} — ${label}` : label}</span>
        {switchControl}
      </div>
      {!!feature.tags?.length && tags(feature.tags)}
      {(feature.tagGroups ?? [])
        .filter((group) => group.tags.length)
        .map((group) => (
          <div key={group.labelKey}>
            <div class="bp-feature-group">{t(group.labelKey)}</div>
            {tags(group.tags)}
          </div>
        ))}
      {(feature.facts ?? []).map((fact) => (
        <div class="bp-fact-line" key={fact.labelKey}>
          <span>{t(fact.labelKey)}</span>
          {fact.values.map((value) => (
            <ToneBadge key={value.textKey} tone={FACT_TONE[value.tone]} text={t(value.textKey, value.vars)} tip={value.tooltipKey ? t(value.tooltipKey, value.vars) : undefined} />
          ))}
        </div>
      ))}
      {feature.noteKey && <div class="bp-feature-note">{t(feature.noteKey, feature.vars)}</div>}
      {!reference &&
        (feature.badge ? (
          <ToneBadge tone={FACT_TONE[feature.badge.tone]} text={t(feature.badge.textKey, feature.badge.vars)} tip={feature.badge.tooltipKey ? t(feature.badge.tooltipKey, feature.badge.vars) : undefined} />
        ) : (
          <ToneBadge
            tone={STATUS_TONE[feature.status]}
            text={feature.step !== undefined && feature.status !== 'available' ? `${statusLabel(feature.status)} · ${t('module.feature.step', { step: feature.step })}` : statusLabel(feature.status)}
            tip={t(`tip.feature.${feature.status}`)}
          />
        ))}
    </article>
  )
}

function DetailsBlock({ details, host, refresh }: { details: ModuleDetails; host: ModuleWindowHost; refresh: () => void }) {
  const { t } = host
  const statusLabel = (status: FeatureStatus) => t(details.statusKeys?.[status] ?? `module.feature.${status}`)
  const features = details.sections.filter((section) => section.kind !== 'reference').flatMap((section) => section.features)
  const tones = details.toneKeys
  return (
    <div class="bp-checks" style={{ gap: '16px' }}>
      {details.introKey && <p class="bp-intro">{t(details.introKey)}</p>}
      <div class="bp-legend">
        {tones
          ? (['yes', 'partial', 'no'] as const).map((tone) => {
              const count = features.filter((feature) => feature.tone === tone).length
              return count ? <ToneBadge key={tone} tone={FACT_TONE[tone]} text={`${t(tones[tone].label)} : ${count}`} tip={tones[tone].tip ? t(tones[tone].tip!) : undefined} /> : null
            })
          : FEATURE_STATUSES.map((status) => {
              const count = features.filter((feature) => feature.status === status).length
              return count ? <ToneBadge key={status} tone={STATUS_TONE[status]} text={`${statusLabel(status)} : ${count}`} tip={t(`tip.feature.${status}`)} /> : null
            })}
      </div>
      {details.sections.map((section) => (
        <section class="bp-feature-section" key={section.titleKey}>
          <h3>{t(section.titleKey)}</h3>
          {section.introKey && <p class="bp-intro">{t(section.introKey)}</p>}
          <div class="bp-feature-grid" style={details.columns ? { '--bp-columns': String(details.columns) } : undefined}>
            {section.features.map((feature, index) => (
              <FeatureCard key={`${feature.labelKey}-${feature.prefix ?? ''}-${index}`} feature={feature} reference={section.kind === 'reference'} tagPrefix={section.tagPrefix ?? '.'} statusLabel={statusLabel} host={host} refresh={refresh} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function fieldBlock(field: ModuleSettingField, host: ModuleWindowHost, refresh: () => void, open: Set<string>, setOpen: (key: string, value: boolean) => void, index: number) {
  switch (field.kind) {
    case 'mapping':
      return <MappingBlock key={index} field={field} host={host} refresh={refresh} />
    case 'toggles':
      return <TogglesBlock key={index} field={field} host={host} refresh={refresh} open={open.has(field.key)} setOpen={(value) => setOpen(field.key, value)} />
    case 'secret':
      return <SecretBlock key={index} field={field} host={host} />
    case 'boolean':
      return <BooleanBlock key={index} field={field} host={host} refresh={refresh} />
    case 'actions':
      return <ActionsBlock key={index} field={field} host={host} refresh={refresh} />
    default:
      return <TextBlock key={index} field={field} host={host} refresh={refresh} />
  }
}

/**
 * Ce que montre la fenêtre « Fonctions » d'un module, sans son cadre : ses réglages, puis ce
 * qu'il sait faire. La fenêtre le met dans un cadre ; l'onglet de Black Projects, dans une
 * page (`ModuleFunctionsPage`).
 */
export function ModuleFunctions({ host }: { host: ModuleWindowHost }) {
  const [, setVersion] = useState(0)
  const [open, setOpenLists] = useState(() => new Set<string>())
  const refresh = () => setVersion((version) => version + 1)
  const setOpen = (key: string, value: boolean) =>
    setOpenLists((current) => {
      const next = new Set(current)
      if (value) next.add(key)
      else next.delete(key)
      return next
    })
  const details = host.module.details?.(host.settings())
  return (
    <>
      {(host.module.settingsFields ?? []).map((field, index) => fieldBlock(field, host, refresh, open, setOpen, index))}
      {details && <DetailsBlock details={details} host={host} refresh={refresh} />}
    </>
  )
}

/** Le titre de la fenêtre (ou de la page) « Fonctions » d'un module : « Lecture de fichiers — Formats de fichiers ». */
export function moduleFunctionsTitle(host: Pick<ModuleWindowHost, 't' | 'module' | 'settings'>): string {
  const details = host.module.details?.(host.settings())
  return details ? `${host.t(host.module.nameKey)} — ${host.t(details.titleKey)}` : host.t(host.module.nameKey)
}

export function ModuleWindow({ host, onClose }: { host: ModuleWindowHost; onClose: () => void }) {
  return (
    <Dialog title={moduleFunctionsTitle(host)} subtitle={host.t(host.module.descriptionKey)} size="wide" onClose={onClose} t={host.t} className="bp-module-window">
      <ModuleFunctions host={host} />
    </Dialog>
  )
}

/**
 * La page « Fonctions » d'un module, dans l'onglet de Black Projects : ce qu'il fait, puis
 * ses réglages et ce qu'il sait faire — le contenu de sa fenêtre, à la place d'une page.
 */
export function ModuleFunctionsPage({ host }: { host: ModuleWindowHost }) {
  return (
    <div class="bp-page bp-module-page" data-page={`module-${host.module.id}`}>
      <p class="bp-page-sub">{host.t(host.module.descriptionKey)}</p>
      <div class="bp-page-body">
        <ModuleFunctions host={host} />
      </div>
    </div>
  )
}

export function openModuleWindow(host: ModuleWindowHost): Promise<void> {
  return openDialog<void>(host, (close) => <ModuleWindow host={host} onClose={() => close()} />, undefined)
}
