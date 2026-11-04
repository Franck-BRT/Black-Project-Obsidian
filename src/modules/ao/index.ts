// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le module Analyse d'appels d'offres (AO).
 *
 * Étape 0 : le module est déclaré et s'active, sans fonction encore. Les étapes
 * suivantes du plan d'intégration (docs/plan-integration.md) y ajoutent, dans l'ordre,
 * le dossier de consultation, l'extraction des exigences, l'analyse qualité, l'IA
 * locale et les livrables.
 */

import type { BlackModule } from '../../core/modules/module'
import { aoEn, aoFr } from './i18n'

export const aoModule: BlackModule = {
  id: 'ao',
  nameKey: 'ao.name',
  descriptionKey: 'ao.description',
  version: '0.1.0',
  requires: [],
  texts: { fr: aoFr, en: aoEn },
  activate() {
    // Rien encore : les fonctions arrivent à partir de l'étape 2.
  }
}
