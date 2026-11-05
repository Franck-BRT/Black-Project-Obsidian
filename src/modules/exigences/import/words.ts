// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les mots des documents des autres : comment un acheteur, un fournisseur ou un outil
 * d'exigences titre ses colonnes et écrit ses valeurs, en français et en anglais. C'est ce
 * qui permet de lire le tableau d'exigences d'un CCTP sans le retoucher d'abord.
 *
 * Une valeur que rien ne reconnaît est gardée telle quelle et signalée, jamais devinée.
 */

import type { DocxVocabulary } from './document'
import type { PptxVocabulary } from './slides'
import type { XlsxEnumField } from './table'

/** Un en-tête, en minuscules, vers la colonne d'import qu'il remplit. */
const HEADERS: Record<string, string> = {
  identifiant: 'id',
  id: 'id',
  'id.': 'id',
  réf: 'id',
  'réf.': 'id',
  ref: 'id',
  'ref.': 'id',
  référence: 'id',
  reference: 'id',
  'n°': 'id',
  numéro: 'id',
  'exigence n°': 'id',
  'n° exigence': 'id',
  'code exigence': 'id',
  identifier: 'id',
  'requirement id': 'id',
  'req. id': 'id',
  titre: 'title',
  intitulé: 'title',
  objet: 'title',
  title: 'title',
  catégorie: 'category',
  domaine: 'category',
  category: 'category',
  type: 'type',
  'type d’exigence': 'type',
  "type d'exigence": 'type',
  statut: 'status',
  état: 'status',
  status: 'status',
  criticité: 'criticality',
  priorité: 'criticality',
  importance: 'criticality',
  criticality: 'criticality',
  priority: 'criticality',
  vérification: 'verification',
  'méthode de vérification': 'verification',
  'mode de vérification': 'verification',
  'moyen de vérification': 'verification',
  'mode de preuve': 'verification',
  verification: 'verification',
  'verification method': 'verification',
  source: 'source',
  origine: 'source',
  justification: 'rationale',
  rationale: 'rationale',
  responsable: 'owner',
  owner: 'owner',
  'mots-clés': 'tags',
  tags: 'tags',
  alias: 'aliases',
  aliases: 'aliases'
}

/** Les en-têtes d'une colonne de formulation. */
const WORDING = [
  'Exigence',
  'Exigences',
  'Énoncé',
  'Énoncé de l’exigence',
  "Énoncé de l'exigence",
  'Formulation',
  'Libellé',
  'Libellé de l’exigence',
  "Libellé de l'exigence",
  'Texte',
  'Texte de l’exigence',
  "Texte de l'exigence",
  'Description',
  'Requirement',
  'Requirement text',
  'Text',
  'Statement'
]

/** Pour chaque champ affiché en mot, ce mot (en minuscules) vers la valeur rangée. */
const VALUES: Record<XlsxEnumField, Record<string, string>> = {
  type: {
    fonctionnelle: 'functional',
    fonctionnel: 'functional',
    functional: 'functional',
    performance: 'performance',
    performances: 'performance',
    interface: 'interface',
    opérationnelle: 'operational',
    opérationnel: 'operational',
    operational: 'operational',
    contrainte: 'constraint',
    constraint: 'constraint',
    sécurité: 'safety',
    sûreté: 'safety',
    safety: 'safety'
  },
  status: {
    brouillon: 'draft',
    draft: 'draft',
    proposée: 'proposed',
    proposé: 'proposed',
    proposed: 'proposed',
    approuvée: 'approved',
    approuvé: 'approved',
    validée: 'approved',
    approved: 'approved',
    réalisée: 'implemented',
    implemented: 'implemented',
    vérifiée: 'verified',
    verified: 'verified',
    rejetée: 'rejected',
    rejected: 'rejected',
    obsolète: 'obsolete',
    obsolete: 'obsolete'
  },
  criticality: {
    haute: 'high',
    élevée: 'high',
    forte: 'high',
    critique: 'high',
    high: 'high',
    moyenne: 'medium',
    normale: 'medium',
    medium: 'medium',
    basse: 'low',
    faible: 'low',
    low: 'low'
  },
  verification: {
    essai: 'test',
    essais: 'test',
    test: 'test',
    tests: 'test',
    t: 'test',
    analyse: 'analysis',
    analysis: 'analysis',
    a: 'analysis',
    inspection: 'inspection',
    revue: 'inspection',
    'revue de conception': 'inspection',
    review: 'inspection',
    i: 'inspection',
    démonstration: 'demonstration',
    demonstration: 'demonstration',
    d: 'demonstration'
  }
}

export function documentWords(languages: readonly string[]): DocxVocabulary {
  return {
    headers: HEADERS,
    languages: [...languages],
    computed: ['note', 'rating'],
    values: VALUES,
    sourceLabels: ['Source', 'Origine'],
    noCategory: ['Sans catégorie', 'No category'],
    wording: WORDING,
    isMark: () => false,
    fallbackLang: () => undefined
  }
}

export function slideWords(languages: readonly string[]): PptxVocabulary {
  return {
    ...documentWords(languages),
    rationaleLabels: ['Justification', 'Rationale'],
    sectionLabels: ['Catégorie', 'Category'],
    noWording: ['Pas de formulation', 'No wording']
  }
}
