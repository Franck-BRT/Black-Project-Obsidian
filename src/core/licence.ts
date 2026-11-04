// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les droits d'usage : quels modules l'utilisateur a le droit d'activer.
 *
 * Aujourd'hui tout est ouvert. Ce fichier est le seul endroit où une licence payante se
 * branchera le jour où Black Projects le deviendra : un fichier de licence signé par
 * Black Room, vérifié hors ligne, qui produit des droits du même type. Le registre de
 * modules ne demande jamais autre chose que `allows`, il n'aura donc pas à changer.
 *
 * Règle à garder quand la licence arrivera : à l'échéance, un module passe en lecture
 * seule ; il ne bloque jamais l'accès aux données, qui restent du Markdown dans le
 * coffre.
 */

export type LicenceKind = 'evaluation' | 'licensed'

export interface Entitlements {
  kind: LicenceKind
  /** À qui la licence est accordée, quand on le sait. */
  holder: string | null
  /** Date d'échéance (AAAA-MM-JJ), ou `null` sans échéance. */
  expires: string | null
  /** Le module peut-il être activé ? */
  allows(moduleId: string): boolean
}

/** Tous les modules ouverts, sans échéance : la version d'évaluation. */
export const EVALUATION: Entitlements = Object.freeze({
  kind: 'evaluation' as const,
  holder: null,
  expires: null,
  allows: () => true
})

/**
 * Des droits limités à une liste de modules, éventuellement datés. Prévu pour la
 * licence payante ; utilisé aujourd'hui par les tests du registre.
 */
export function entitlementsFor(options: {
  holder: string
  modules: readonly string[]
  expires?: string | null
  today?: () => string
}): Entitlements {
  const allowed = new Set(options.modules)
  const expires = options.expires ?? null
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10))
  return Object.freeze({
    kind: 'licensed' as const,
    holder: options.holder,
    expires,
    allows: (moduleId: string) => allowed.has(moduleId) && (expires === null || today() <= expires)
  })
}

/** Les droits en une phrase, pour les réglages et la commande « À propos ». */
export function describeEntitlements(entitlements: Entitlements, t: (key: string, vars?: Record<string, string>) => string): string {
  if (entitlements.kind === 'evaluation') return t('settings.licence.evaluation')
  const holder = t('settings.licence.licensed', { holder: entitlements.holder ?? '—' })
  const expiry = entitlements.expires
    ? t('settings.licence.expires', { date: entitlements.expires })
    : t('settings.licence.noExpiry')
  return `${holder} ${expiry}`
}
