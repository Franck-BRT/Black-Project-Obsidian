// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les fenêtres du port `Ui` (`src/core/ports.ts`), dessinées par l'interface : les mêmes
 * dans Obsidian et dans l'application de bureau. Chacune est un composant, et une fonction
 * qui l'ouvre et attend la réponse.
 */

import { useMemo, useRef, useState } from 'preact/hooks'
import type { Choice, ConfirmView, FormField, FormView, ListAnswer, ListState, ListView, MessageAnswer, MessageView, PickManyView, TextView } from '../../core/ports'
import type { Translate } from '../host'
import { Icon } from '../icons'
import { Dialog, openDialog, type DialogHost } from './frame'

const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean)
const matches = (text: string, query: string) => words(query).every((word) => text.toLowerCase().includes(word))

// ── Un choix dans une liste (et un fichier du coffre) ────────────────────────────

export function ChoicePicker({ choices, title, placeholder, t, onPick }: { choices: readonly Choice[]; title: string; placeholder?: string; t: Translate; onPick: (value: string | null) => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const shown = useMemo(() => choices.filter((choice) => matches(`${choice.label} ${choice.description ?? ''}`, query)), [choices, query])
  const current = Math.min(active, Math.max(0, shown.length - 1))
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(Math.min(current + 1, shown.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && shown[current]) {
      event.preventDefault()
      onPick(shown[current]!.value)
    }
  }
  const listId = 'bp-picker-list'
  return (
    <Dialog title={title} size="medium" onClose={() => onPick(null)} t={t}>
      <input
        class="bp-input"
        type="search"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={shown[current] ? `bp-option-${current}` : undefined}
        aria-label={placeholder ?? title}
        placeholder={placeholder ?? t('ui.search')}
        value={query}
        onInput={(event) => {
          setQuery((event.target as HTMLInputElement).value)
          setActive(0)
        }}
        onKeyDown={onKey}
        data-autofocus
      />
      <ul class="bp-picker-list" id={listId} role="listbox" aria-label={title}>
        {shown.length === 0 && <li class="bp-picker-empty">{t('ui.noMatch')}</li>}
        {shown.map((choice, index) => (
          <li
            key={choice.value}
            id={`bp-option-${index}`}
            role="option"
            aria-selected={index === current}
            class="bp-picker-item"
            onMouseEnter={() => setActive(index)}
            onClick={() => onPick(choice.value)}
          >
            <span>{choice.label}</span>
            {choice.description && <small>{choice.description}</small>}
          </li>
        ))}
      </ul>
      <p class="bp-count">{t('ui.picker.help', { count: shown.length })}</p>
    </Dialog>
  )
}

// ── Un formulaire ────────────────────────────────────────────────────────────────

function initialValues(form: FormView): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of form.fields) {
    values[field.key] = field.kind === 'toggle' ? String(field.value ?? false) : (field.value ?? (field.kind === 'choice' ? (field.options[0]?.value ?? '') : ''))
  }
  return values
}

/**
 * Le calendrier d'un champ de date : un bouton qui ouvre celui du système (un champ date
 * caché sous lui) ; la date choisie est écrite dans le champ, en `AAAA-MM-JJ`. La date déjà
 * écrite ainsi y est montrée d'abord.
 */
function CalendarButton({ value, label, onPick }: { value: string; label: string; onPick: (date: string) => void }) {
  const picker = useRef<HTMLInputElement>(null)
  const open = () => {
    const input = picker.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      // Sans `showPicker` (ou refusé) : le champ date lui-même, qui ouvre son calendrier.
      input.focus()
      input.click()
    }
  }
  return (
    <span class="bp-calendar">
      <button type="button" class="bp-button bp-button-icon" title={label} aria-label={label} onClick={open}>
        <Icon name="calendar" />
      </button>
      <input
        ref={picker}
        class="bp-calendar-picker"
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : ''}
        onChange={(event) => {
          const date = (event.target as HTMLInputElement).value
          if (date) onPick(date)
        }}
      />
    </span>
  )
}

export function FormDialog({ form, t, onDone }: { form: FormView; t: Translate; onDone: (values: Record<string, string> | null) => void }) {
  const [values, setValues] = useState(() => initialValues(form))
  const [missing, setMissing] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const set = (key: string, value: string) => setValues({ ...values, [key]: value })
  const submit = (event?: Event) => {
    event?.preventDefault()
    const empty = form.fields.filter((field) => (field.kind === 'text' || field.kind === 'textarea') && field.required && !(values[field.key] ?? '').trim()).map((field) => field.key)
    setMissing(empty)
    if (empty.length) {
      setError(t('ui.form.missing'))
      return
    }
    const problem = form.validate?.(values) ?? null
    setError(problem)
    if (!problem) onDone({ ...values })
  }
  const textInput = (spec: Extract<FormField, { kind: 'text' }>, common: Record<string, unknown>, invalid: boolean, index: number) => (
    <input
      class="bp-input"
      type="text"
      {...common}
      placeholder={spec.placeholder}
      aria-invalid={invalid}
      aria-required={spec.required}
      value={values[spec.key]}
      onInput={(event) => set(spec.key, (event.target as HTMLInputElement).value)}
      data-autofocus={index === 0 ? true : undefined}
    />
  )
  const field = (spec: FormField, index: number) => {
    const id = `bp-field-${spec.key}`
    const descId = spec.description ? `${id}-desc` : undefined
    const invalid = missing.includes(spec.key)
    const common = { id, title: spec.tooltip, 'aria-describedby': [descId, invalid ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined }
    if (spec.kind === 'toggle') {
      return (
        <div class="bp-field bp-field-row" key={spec.key}>
          <span>
            <label class="bp-field-label" for={id}>
              {spec.label}
            </label>
            {spec.description && (
              <div class="bp-field-desc" id={descId}>
                {spec.description}
              </div>
            )}
          </span>
          <span class="bp-switch">
            <input type="checkbox" role="switch" {...common} checked={values[spec.key] === 'true'} onChange={(event) => set(spec.key, String((event.target as HTMLInputElement).checked))} />
            <span />
          </span>
        </div>
      )
    }
    return (
      <div class="bp-field" key={spec.key}>
        <label class="bp-field-label" for={id}>
          {spec.label}
          {'required' in spec && spec.required && <span aria-hidden="true"> *</span>}
        </label>
        {spec.description && (
          <div class="bp-field-desc" id={descId}>
            {spec.description}
          </div>
        )}
        {spec.kind === 'choice' ? (
          <select class="bp-select" {...common} value={values[spec.key]} onChange={(event) => set(spec.key, (event.target as HTMLSelectElement).value)} data-autofocus={index === 0 ? true : undefined}>
            {spec.options.map((option) => (
              <option key={option.value} value={option.value} title={option.description}>
                {option.label}
              </option>
            ))}
          </select>
        ) : spec.kind === 'textarea' ? (
          <textarea
            class="bp-textarea"
            {...common}
            rows={5}
            placeholder={spec.placeholder}
            aria-invalid={invalid}
            aria-required={spec.required}
            value={values[spec.key]}
            onInput={(event) => set(spec.key, (event.target as HTMLTextAreaElement).value)}
            data-autofocus={index === 0 ? true : undefined}
          />
        ) : spec.calendar ? (
          <div class="bp-input-row">
            {textInput(spec, common, invalid, index)}
            <CalendarButton value={values[spec.key] ?? ''} label={t('ui.form.calendar')} onPick={(date) => set(spec.key, date)} />
          </div>
        ) : (
          textInput(spec, common, invalid, index)
        )}
        {invalid && (
          <div class="bp-field-error" id={`${id}-error`}>
            <Icon name="alert" /> {t('ui.form.required')}
          </div>
        )}
      </div>
    )
  }
  return (
    <Dialog
      title={form.title}
      size="medium"
      onClose={() => onDone(null)}
      t={t}
      footer={
        <>
          <button type="button" class="bp-button" onClick={() => onDone(null)}>
            {t('ui.cancel')}
          </button>
          <button type="submit" form="bp-form" class="bp-button bp-button-primary" title={form.submitTooltip}>
            {form.submit}
          </button>
        </>
      }
    >
      {form.intro && <p class="bp-intro">{form.intro}</p>}
      {error && (
        <div class="bp-message bp-tone-danger" role="alert">
          <Icon name="alert" />
          <div class="bp-message-body">{error}</div>
        </div>
      )}
      <form id="bp-form" class="bp-checks" style={{ gap: '14px' }} onSubmit={submit} noValidate>
        {form.fields.map(field)}
        {/* Entrée dans un champ texte valide le formulaire. */}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

// ── Oui ou non ───────────────────────────────────────────────────────────────────

export function ConfirmDialog({ view, t, onDone }: { view: ConfirmView; t: Translate; onDone: (yes: boolean) => void }) {
  return (
    <Dialog
      title={view.title}
      size="small"
      onClose={() => onDone(false)}
      t={t}
      footer={
        <>
          <button type="button" class="bp-button" onClick={() => onDone(false)} data-autofocus={view.danger ? true : undefined}>
            {view.cancel}
          </button>
          <button type="button" class={`bp-button ${view.danger ? 'bp-button-danger' : 'bp-button-primary'}`} onClick={() => onDone(true)}>
            {view.danger && <Icon name="alert" />}
            {view.confirm}
          </button>
        </>
      }
    >
      <p class="bp-intro" style={{ color: 'var(--bp-text)' }}>
        {view.message}
      </p>
    </Dialog>
  )
}

// ── Plusieurs choix à cocher ─────────────────────────────────────────────────────

export function PickManyDialog({ view, t, onDone }: { view: PickManyView; t: Translate; onDone: (values: string[] | null) => void }) {
  const [chosen, setChosen] = useState(() => new Set(view.selected ?? view.choices.map((choice) => choice.value)))
  const [query, setQuery] = useState('')
  const shown = view.choices.filter((choice) => matches(`${choice.label} ${choice.description ?? ''}`, query))
  const toggle = (value: string, on: boolean) => {
    const next = new Set(chosen)
    if (on) next.add(value)
    else next.delete(value)
    setChosen(next)
  }
  return (
    <Dialog
      title={view.title}
      size="medium"
      onClose={() => onDone(null)}
      t={t}
      className="bp-pick-many"
      footer={
        <>
          <span class="bp-count" style={{ marginRight: 'auto', alignSelf: 'center' }} aria-live="polite">
            {t('ui.pickMany.count', { count: chosen.size, total: view.choices.length })}
          </span>
          <button type="button" class="bp-button" onClick={() => onDone(null)}>
            {t('ui.cancel')}
          </button>
          <button type="button" class="bp-button bp-button-primary" onClick={() => onDone(view.choices.map((choice) => choice.value).filter((value) => chosen.has(value)))}>
            {view.submit}
          </button>
        </>
      }
    >
      {view.intro && <p class="bp-intro">{view.intro}</p>}
      <div class="bp-toolbar">
        {view.choices.length > 8 && (
          <input class="bp-input" type="search" placeholder={t('ui.search')} aria-label={t('ui.search')} value={query} onInput={(event) => setQuery((event.target as HTMLInputElement).value)} />
        )}
        <button type="button" class="bp-button" onClick={() => setChosen(new Set(view.choices.map((choice) => choice.value)))}>
          {t('ui.all')}
        </button>
        <button type="button" class="bp-button" onClick={() => setChosen(new Set())}>
          {t('ui.none')}
        </button>
      </div>
      <fieldset class="bp-fieldset">
        <legend class="bp-sr">{view.title}</legend>
        <div class="bp-checks">
          {shown.map((choice) => (
            <label class="bp-check" key={choice.value}>
              <input type="checkbox" checked={chosen.has(choice.value)} onChange={(event) => toggle(choice.value, (event.target as HTMLInputElement).checked)} />
              <span>
                {choice.label}
                {choice.description && <small>{choice.description}</small>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  )
}

// ── Un message à lire ────────────────────────────────────────────────────────────

export function MessageDialog({ view, t, onDone }: { view: MessageView; t: Translate; onDone: (answer: MessageAnswer) => void }) {
  const [option, setOption] = useState(view.option?.value ?? false)
  return (
    <Dialog
      title={view.title}
      size="medium"
      onClose={() => onDone({ action: null, option })}
      t={t}
      footer={view.actions.map((action) => (
        <button key={action.value} type="button" class={`bp-button${action.cta ? ' bp-button-primary' : ''}`} onClick={() => onDone({ action: action.value, option })} data-autofocus={action.cta ? true : undefined}>
          {action.label}
        </button>
      ))}
    >
      {view.message.split(/\n\s*\n/).map((paragraph, index) => (
        <p class="bp-text" style={{ margin: 0 }} key={index}>
          {paragraph.trim()}
        </p>
      ))}
      {view.option && (
        <div class="bp-field bp-field-row">
          <label class="bp-field-label" for="bp-message-option">
            {view.option.label}
          </label>
          <span class="bp-switch" title={view.option.tooltip}>
            <input id="bp-message-option" type="checkbox" role="switch" checked={option} onChange={(event) => setOption((event.target as HTMLInputElement).checked)} />
            <span />
          </span>
        </div>
      )}
    </Dialog>
  )
}

// ── Une liste qu'on filtre et qu'on parcourt ─────────────────────────────────────

export function ListDialog({ view, t, onDone }: { view: ListView; t: Translate; onDone: (answer: ListAnswer | null) => void }) {
  const [search, setSearch] = useState(view.state?.search ?? '')
  const [filters, setFilters] = useState<Record<string, string>>({ ...(view.state?.filters ?? {}) })
  const state = (): ListState => ({ search, filters: { ...filters } })
  const needle = search.trim().toLowerCase()
  const shown = view.rows.filter(
    (row) => Object.entries(filters).every(([key, value]) => !value || row.values?.[key] === value) && (!needle || Object.values(row.cells).some((cell) => cell.toLowerCase().includes(needle)))
  )
  return (
    <Dialog title={view.title} subtitle={view.intro} size="wide" onClose={() => onDone(null)} t={t} className="bp-list-dialog">
      <div class="bp-toolbar" role="search">
        <input class="bp-input" type="search" placeholder={view.searchPlaceholder ?? t('ui.search')} aria-label={view.searchPlaceholder ?? t('ui.search')} value={search} onInput={(event) => setSearch((event.target as HTMLInputElement).value)} data-autofocus />
        {(view.filters ?? []).map((filter) => (
          <select class="bp-select" key={filter.key} aria-label={filter.label} value={filters[filter.key] ?? ''} onChange={(event) => setFilters({ ...filters, [filter.key]: (event.target as HTMLSelectElement).value })}>
            <option value="">{filter.label}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        {(view.actions ?? []).map((action) => (
          <button key={action.value} type="button" class={`bp-button${action.cta ? ' bp-button-primary' : ''}`} title={action.tooltip} onClick={() => onDone({ kind: 'action', value: action.value, state: state() })}>
            {action.cta && <Icon name="plus" />}
            {action.label}
          </button>
        ))}
      </div>
      <p class="bp-count" aria-live="polite">
        {t('ui.list.count', { shown: shown.length, total: view.rows.length })}
      </p>
      <div class="bp-table-wrap">
        <table class="bp-table">
          <thead>
            <tr>
              {view.columns.map((column) => (
                <th key={column.key} scope="col" class={column.width ? `is-${column.width}` : undefined}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={view.columns.length} class="bp-picker-empty">
                  {view.empty}
                </td>
              </tr>
            )}
            {shown.map((row) => (
              <tr
                key={row.id}
                class="bp-row"
                tabIndex={0}
                onClick={() => onDone({ kind: 'row', id: row.id, state: state() })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onDone({ kind: 'row', id: row.id, state: state() })
                  }
                }}
              >
                {view.columns.map((column, index) => (
                  <td key={column.key} class={column.width ? `is-${column.width}` : undefined}>
                    {row.cells[column.key] ?? ''}
                    {index === 0 &&
                      (row.flags ?? []).map((flag) => (
                        <span class="bp-flag" key={flag}>
                          {flag}
                        </span>
                      ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

// ── Un texte long, à copier ──────────────────────────────────────────────────────

export function TextDialog({ view, t, onDone, copy }: { view: TextView; t: Translate; onDone: () => void; copy: (text: string) => void }) {
  return (
    <Dialog
      title={view.title}
      subtitle={view.subtitle}
      size="large"
      onClose={onDone}
      t={t}
      footer={
        <button type="button" class="bp-button bp-button-primary" onClick={() => copy(view.text)} title={t('tip.copy')}>
          <Icon name="copy" />
          {t('ui.copy')}
        </button>
      }
    >
      <pre class="bp-pre">{view.text}</pre>
    </Dialog>
  )
}

// ── Les fonctions du port ────────────────────────────────────────────────────────

/** Les fenêtres du port `Ui`, à brancher par l'hôte (qui garde fichiers, notes, fichiers de l'ordinateur). */
export function dialogWindows(host: DialogHost) {
  const { t } = host
  return {
    pickOption: (choices: readonly Choice[], placeholder?: string) =>
      openDialog<string | null>(host, (close) => <ChoicePicker choices={choices} title={placeholder ?? t('ui.picker.title')} placeholder={placeholder} t={t} onPick={close} />, null),
    /** Un fichier du coffre parmi ceux que l'hôte donne (le plus récent d'abord). */
    pickPath: (paths: readonly string[], placeholder?: string) =>
      openDialog<string | null>(
        host,
        (close) => <ChoicePicker choices={paths.map((path) => ({ value: path, label: path.slice(path.lastIndexOf('/') + 1), description: path }))} title={placeholder ?? t('ui.picker.file')} placeholder={placeholder} t={t} onPick={close} />,
        null
      ),
    askForm: (form: FormView) => openDialog<Record<string, string> | null>(host, (close) => <FormDialog form={form} t={t} onDone={close} />, null),
    confirm: (view: ConfirmView) => openDialog<boolean>(host, (close) => <ConfirmDialog view={view} t={t} onDone={close} />, false),
    pickMany: (view: PickManyView) => openDialog<string[] | null>(host, (close) => <PickManyDialog view={view} t={t} onDone={close} />, null),
    inform: (view: MessageView) => openDialog<MessageAnswer>(host, (close) => <MessageDialog view={view} t={t} onDone={close} />, { action: null, option: view.option?.value ?? false }),
    pickFromList: (view: ListView) => openDialog<ListAnswer | null>(host, (close) => <ListDialog view={view} t={t} onDone={close} />, null),
    showText: (view: TextView) => {
      void openDialog<void>(
        host,
        (close) => (
          <TextDialog
            view={view}
            t={t}
            onDone={() => close()}
            copy={(text) => {
              void navigator.clipboard?.writeText(text).then(() => host.notify(t('ui.copied')))
            }}
          />
        ),
        undefined
      )
    }
  }
}
