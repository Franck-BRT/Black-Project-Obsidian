// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le registre des modules : qui est déclaré, dans quel ordre l'activer, et ce qu'il est
 * devenu.
 *
 * Trois règles :
 *
 * - **Un module en panne n'emporte pas les autres.** Son erreur est gardée et montrée
 *   dans les réglages ; les modules qui n'en dépendent pas se chargent normalement.
 * - **Un module n'est activé qu'après ceux qu'il requiert.** S'il en manque un —
 *   inconnu, désactivé, non couvert par la licence, en panne, ou pris dans une
 *   dépendance circulaire —, il ne l'est pas, et l'on dit lequel manque.
 * - **La licence est demandée ici et nulle part ailleurs**, par `allows`. Le jour où
 *   Black Projects devient payant, seuls les droits passés au registre changent.
 */

import type { Entitlements } from '../licence'
import type { BlackModule, ModuleContext, ModuleDescriptor } from './module'

export type ModuleState = 'pending' | 'active' | 'disabled' | 'not-licensed' | 'missing-dependency' | 'failed'

export interface ModuleStatus {
  readonly module: ModuleDescriptor
  readonly state: ModuleState
  /** Les modules requis qui manquent, pour `missing-dependency`. */
  readonly missing: readonly string[]
  /** Le message de l'erreur, pour `failed`. */
  readonly error: string | null
}

export interface ActivationOptions {
  disabled: Iterable<string>
  entitlements: Entitlements
  contextFor(module: BlackModule): ModuleContext
  /** Prévenu quand un module échoue à s'activer ou à se désactiver. */
  onError?(module: ModuleDescriptor, error: unknown): void
}

const ID = /^[a-z][a-z0-9-]*$/

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class ModuleRegistry {
  private readonly modules = new Map<string, BlackModule>()
  private readonly statuses = new Map<string, ModuleStatus>()
  private activated: BlackModule[] = []

  register(module: BlackModule): void {
    if (!ID.test(module.id)) throw new Error(`Identifiant de module invalide : « ${module.id} »`)
    if (this.modules.has(module.id)) throw new Error(`Module déjà déclaré : « ${module.id} »`)
    this.modules.set(module.id, module)
    this.statuses.set(module.id, { module, state: 'pending', missing: [], error: null })
  }

  /** Les modules dans l'ordre de leur déclaration, avec leur état. */
  list(): ModuleStatus[] {
    return [...this.statuses.values()]
  }

  status(id: string): ModuleStatus | undefined {
    return this.statuses.get(id)
  }

  isActive(id: string): boolean {
    return this.statuses.get(id)?.state === 'active'
  }

  /**
   * Les modules dans un ordre où chacun vient après ceux qu'il requiert. Ceux pris dans
   * une dépendance circulaire sont rendus à part : aucun ordre ne leur convient.
   */
  order(): { ordered: BlackModule[]; cyclic: BlackModule[] } {
    const remaining = new Map<string, Set<string>>()
    for (const module of this.modules.values()) {
      remaining.set(module.id, new Set(module.requires.filter((id) => this.modules.has(id))))
    }
    const ordered: BlackModule[] = []
    let progressed = true
    while (progressed) {
      progressed = false
      for (const module of this.modules.values()) {
        const waiting = remaining.get(module.id)
        if (!waiting || waiting.size > 0) continue
        ordered.push(module)
        remaining.delete(module.id)
        for (const others of remaining.values()) others.delete(module.id)
        progressed = true
      }
    }
    const cyclic = [...remaining.keys()].map((id) => this.modules.get(id) as BlackModule)
    return { ordered, cyclic }
  }

  async activateAll(options: ActivationOptions): Promise<ModuleStatus[]> {
    const disabled = new Set(options.disabled)
    const { ordered, cyclic } = this.order()

    for (const module of cyclic) {
      this.set(module, 'missing-dependency', {
        missing: module.requires.filter((id) => cyclic.some((other) => other.id === id))
      })
    }

    for (const module of ordered) {
      if (disabled.has(module.id)) {
        this.set(module, 'disabled')
        continue
      }
      if (!options.entitlements.allows(module.id)) {
        this.set(module, 'not-licensed')
        continue
      }
      const missing = module.requires.filter((id) => !this.isActive(id))
      if (missing.length > 0) {
        this.set(module, 'missing-dependency', { missing })
        continue
      }
      try {
        await module.activate(options.contextFor(module))
        this.activated.push(module)
        this.set(module, 'active')
      } catch (error) {
        this.set(module, 'failed', { error: message(error) })
        options.onError?.(module, error)
      }
    }
    return this.list()
  }

  /** Désactive les modules actifs, du dernier activé au premier. */
  async deactivateAll(onError?: (module: ModuleDescriptor, error: unknown) => void): Promise<void> {
    for (const module of [...this.activated].reverse()) {
      try {
        await module.deactivate?.()
      } catch (error) {
        onError?.(module, error)
      }
      this.set(module, 'pending')
    }
    this.activated = []
  }

  private set(
    module: ModuleDescriptor,
    state: ModuleState,
    extra: { missing?: readonly string[]; error?: string } = {}
  ): void {
    this.statuses.set(module.id, {
      module,
      state,
      missing: extra.missing ?? [],
      error: extra.error ?? null
    })
  }
}
