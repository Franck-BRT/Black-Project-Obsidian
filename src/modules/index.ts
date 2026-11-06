// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le catalogue des modules livrés avec le plugin, dans l'ordre où les réglages les
 * montrent. Ajouter un module, c'est l'écrire sous `src/modules/<id>/` et l'ajouter ici.
 */

import type { BlackModule } from '../core/modules/module'
import { aoModule } from './ao'
import { bibliothequeModule } from './bibliotheque'
import { exigencesModule } from './exigences'
import { iaModule } from './ia'
import { workflowsModule } from './workflows'
import { lectureFichiersModule } from './lecture-fichiers'
import { typagePiecesModule } from './typage-pieces'

export const MODULES: readonly BlackModule[] = [lectureFichiersModule, typagePiecesModule, bibliothequeModule, exigencesModule, iaModule, workflowsModule, aoModule]
