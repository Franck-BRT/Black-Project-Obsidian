// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Pour chaque fiche de format, trois constats, chacun vert (oui) ou rouge (non) :
 *
 * - **lu** par Black Projects : l'état de son lecteur ; non lu, on précise s'il arrive ;
 * - **écrit** par Black Projects : ce que l'application produit elle-même dans ce format
 *   (`WRITTEN`, ci-dessous) ; non écrit, on précise si c'est à venir ou pas prévu. Les
 *   fichiers importés sont gardés tels quels : ce n'est pas « écrire » un format ;
 * - **affiché** dans l'application hôte : c'est la plateforme qui le dit
 *   (`Platform.display`). L'utilisateur peut afficher un type qu'elle masque
 *   (interrupteur de la fiche, réglage `SHOWN_KEY`).
 *
 * La fiche prend une couleur : **verte** si les trois sont oui ; **rouge** si elle n'est
 * ni lue ni écrite — son badge dit alors si elle est à venir ou pas prévue ; **orange**
 * sinon.
 *
 * Quand Black Projects se met à écrire un format, c'est ici qu'on le déclare.
 */

import type { FactTone, FactValue, FeatureFact, FeatureStatus, ModuleFeature } from '../../core/modules/module'
import type { DisplayKind, FileDisplay } from '../../core/ports'

const k = (key: string) => `lecture-fichiers.fact.${key}`

/** Le réglage : les extensions que l'utilisateur a choisi d'afficher dans l'application. */
export const SHOWN_KEY = 'extensionsAffichees'

export function readShown(settings: Readonly<Record<string, unknown>>): string[] {
  const raw = settings[SHOWN_KEY]
  return Array.isArray(raw) ? [...new Set(raw.filter((each): each is string => typeof each === 'string' && each !== ''))].sort() : []
}

export type WriteSupport = { support: 'yes'; whatKey: string } | { support: 'in-progress'; step: number; whatKey: string }

/** Ce que Black Projects écrit, ou écrira, par extension. Ce qui n'y est pas n'est pas prévu. */
export const WRITTEN: Readonly<Record<string, WriteSupport>> = {
  md: { support: 'yes', whatKey: k('write.md') },
  json: { support: 'yes', whatKey: k('write.json') },
  reqif: { support: 'in-progress', step: 4, whatKey: k('write.reqif') },
  docx: { support: 'in-progress', step: 7, whatKey: k('write.deliverables') },
  xlsx: { support: 'in-progress', step: 7, whatKey: k('write.deliverables') },
  pptx: { support: 'in-progress', step: 7, whatKey: k('write.deliverables') }
}

/** « à venir, étape 6 », « à venir », ou « pas prévu ». */
function coming(status: 'in-progress' | 'planned' | 'none', step?: number): FactValue {
  if (status === 'none') return { textKey: k('no.never'), tone: 'no' }
  return step === undefined ? { textKey: k('no.coming'), tone: 'no' } : { textKey: k('no.step'), vars: { step }, tone: 'no' }
}

function read(status: FeatureStatus, step?: number): FactValue {
  return status === 'available' ? { textKey: k('yes'), tone: 'yes' } : coming(status, step)
}

function written(extension: string): FactValue {
  const entry = WRITTEN[extension]
  if (!entry) return coming('none')
  if (entry.support === 'yes') return { textKey: k('yes'), tone: 'yes', tooltipKey: entry.whatKey }
  return { ...coming('in-progress', entry.step), tooltipKey: entry.whatKey }
}

const DISPLAYED: Record<DisplayKind, FactValue> = {
  opens: { textKey: k('display.opens'), tone: 'yes', tooltipKey: k('display.opens.tip') },
  viewer: { textKey: k('display.viewer'), tone: 'yes', tooltipKey: k('display.viewer.tip') },
  listed: { textKey: k('display.listed'), tone: 'partial', tooltipKey: k('display.listed.tip') },
  hidden: { textKey: k('display.hidden'), tone: 'no', tooltipKey: k('display.hidden.tip') }
}

export const READ_FACT = k('read')
export const WRITE_FACT = k('write')
export const DISPLAY_FACT = k('display')

/** Les trois constats d'une fiche ; sans `display`, celui de l'affichage est omis. */
export function cardFacts(extension: string, status: FeatureStatus, step: number | undefined, display?: FileDisplay): FeatureFact[] {
  const facts: FeatureFact[] = [
    { labelKey: READ_FACT, values: [read(status, step)] },
    { labelKey: WRITE_FACT, values: [written(extension)] }
  ]
  if (display) facts.push({ labelKey: DISPLAY_FACT, values: [DISPLAYED[display.kind(extension)]] })
  return facts
}

/** La couleur et le badge d'une fiche, d'après ses constats. */
export function cardLook(
  facts: readonly FeatureFact[],
  extension: string,
  status: FeatureStatus,
  step: number | undefined
): Pick<ModuleFeature, 'tone' | 'badge'> {
  const tones = facts.map((fact) => fact.values[0]?.tone)
  const readTone = tones[0]
  const writeTone = tones[1]
  let tone: FactTone = 'partial'
  if (tones.every((each) => each === 'yes')) tone = 'yes'
  else if (readTone === 'no' && writeTone === 'no') tone = 'no'
  // Sans constat d'affichage (la plateforme ne sait pas le dire), le badge n'en parle pas.
  if (tone === 'yes') return { tone, badge: { textKey: facts.length > 2 ? 'lecture-fichiers.badge.yes' : 'lecture-fichiers.badge.readWrite', tone } }
  if (tone === 'partial') return { tone, badge: { textKey: 'lecture-fichiers.badge.partial', tone } }
  // Rouge : dire si c'est à venir — la lecture, ou l'écriture — ou si rien n'est prévu.
  const write = WRITTEN[extension]
  const steps = [status !== 'available' ? step : undefined, write?.support === 'in-progress' ? write.step : undefined].filter(
    (each): each is number => each !== undefined
  )
  const isComing = status !== 'available' || write !== undefined
  if (!isComing) return { tone, badge: { textKey: 'lecture-fichiers.badge.never', tone } }
  return steps.length > 0
    ? { tone, badge: { textKey: 'lecture-fichiers.badge.step', vars: { step: Math.min(...steps) }, tone } }
    : { tone, badge: { textKey: 'lecture-fichiers.badge.coming', tone } }
}
