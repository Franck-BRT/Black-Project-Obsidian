// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le panneau d'apparence : mode, couleurs (daltonismes), lecture (dys), taille du texte,
 * mouvement. Chaque choix s'applique tout de suite, et est gardé dans les réglages.
 * Des boutons radio dans des groupes titrés : utilisable au clavier et au lecteur d'écran.
 */

import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { APPEARANCE_MODES, COLOR_VISIONS, MOTIONS, READING_MODES, TEXT_SIZES, type Appearance } from '../core/appearance'
import type { Translate } from './host'

/** Les couleurs « va / attention / ne va pas » de chaque palette, en clair, pour les montrer. */
const SWATCHES: Record<string, string[]> = {
  standard: ['#17703f', '#9a4a00', '#b3191d'],
  'red-green': ['#005f99', '#7a5a00', '#a8430a'],
  'blue-yellow': ['#00695c', '#8a1c7c', '#b71c1c'],
  mono: ['#1f1f1f', '#3d3d3d', '#000000']
}

function Group<K extends keyof Appearance>({
  name,
  values,
  appearance,
  change,
  t,
  extra
}: {
  name: K
  values: readonly Appearance[K][]
  appearance: Appearance
  change: (next: Appearance) => void
  t: Translate
  extra?: (value: Appearance[K]) => ComponentChildren
}) {
  return (
    <fieldset class="bp-fieldset">
      <legend>{t(`ui.appearance.${name}`)}</legend>
      <div class="bp-choices">
        {values.map((value) => (
          <label class="bp-choice" key={value}>
            <input type="radio" name={`bp-${name}`} value={value} checked={appearance[name] === value} onChange={() => change({ ...appearance, [name]: value })} />
            <span>
              {t(`ui.appearance.${name}.${value}`)}
              {extra?.(value)}
              <small>{t(`ui.appearance.${name}.${value}.desc`)}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function AppearancePanel({ appearance, change, close, t }: { appearance: Appearance; change: (next: Appearance) => void; close: () => void; t: Translate }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const doc = panel.current?.ownerDocument
    doc?.addEventListener('keydown', onKey)
    return () => doc?.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div class="bp-panel" role="dialog" aria-modal="false" aria-labelledby="bp-appearance-title" ref={panel}>
      <h2 id="bp-appearance-title">{t('ui.appearance.title')}</h2>
      <p>{t('ui.appearance.intro')}</p>
      <Group name="mode" values={APPEARANCE_MODES} appearance={appearance} change={change} t={t} />
      <Group
        name="vision"
        values={COLOR_VISIONS}
        appearance={appearance}
        change={change}
        t={t}
        extra={(value) => (
          <span class="bp-swatches" aria-hidden="true">
            {SWATCHES[value]!.map((color) => (
              <i key={color} style={{ background: color }} />
            ))}
          </span>
        )}
      />
      <Group name="reading" values={READING_MODES} appearance={appearance} change={change} t={t} />
      <Group name="size" values={TEXT_SIZES} appearance={appearance} change={change} t={t} />
      <Group name="motion" values={MOTIONS} appearance={appearance} change={change} t={t} />
      <button type="button" class="bp-button" onClick={close}>
        {t('ui.close')}
      </button>
    </div>
  )
}
