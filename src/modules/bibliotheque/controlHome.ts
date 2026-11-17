// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **À contrôler** (le circuit des documents) : les documents que l'IA n'a pas su ranger avec
 * assez de confiance. Pour chacun, sa proposition, sa raison, sa confiance ; l'utilisateur
 * **accepte**, **choisit ailleurs**, ou **écarte** (mis de côté) — ou le laisse là.
 */

import type { Card, HomeBlock, PageView, ViewAction } from '../../core/views'
import type { EntityProposal, LibraryDoc } from './model'
import { circuitJourney, continueAction } from './circuitSteps'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const CONTROL_PAGE = 'bibliotheque.a-controler'

/** Ce que la page À contrôler sait faire. */
export interface ControlDeps {
  /** Les documents à contrôler. */
  list(): Promise<LibraryDoc[]>
  /** Les documents en cours dans le circuit (à classer, ingérés, analysés). */
  pending?(): Promise<LibraryDoc[]>
  /** Un dossier en mots (« Documents › Normes »). */
  place(folder: string): string
  /** La proposition de l'IA, acceptée : rend la fiche, là où elle est maintenant. */
  accept(record: string): Promise<string | null>
  /** Un autre dossier, choisi. */
  elsewhere(record: string): Promise<string | null>
  /** Écarté : la fiche mise de côté. */
  discard(record: string): Promise<boolean>
  /** Les entreprises et personnes inconnues que des documents citent, proposées par l'analyse. */
  entities?(): Promise<{ doc: LibraryDoc; proposal: EntityProposal; index: number }[]>
  /** Créer l'entité proposée (liée au document) ; rend sa note. */
  createEntity?(record: string, index: number): Promise<string | null>
  /** Écarter la proposition. */
  dismissEntity?(record: string, index: number): Promise<void>
  /** Pourquoi on ne peut pas continuer le circuit (pas d'IA, le circuit coupé) ; `null` : on peut. */
  cannotContinue?(): string | null
  /** Continuer le circuit pour un document, là où il s'est arrêté (à contrôler : le rangement redemandé à l'IA). */
  continueCircuit?(record: string): Promise<boolean>
  /** Continuer le circuit pour tous ceux qui attendent (pas ceux à contrôler) ; rend combien. */
  continueAll?(): Promise<number>
  /** Relancer une seule étape du parcours d'un document (son identifiant : « ingestion », « type »…). */
  relaunchStep?(record: string, step: string): Promise<void>
  /** Relancer tout le circuit d'un document (après une question) ; vrai s'il a repris. */
  relaunchAll?(record: string): Promise<boolean>
  /** L'étape que le circuit fait en ce moment pour un document (`ingestion`, `glossaire`, `analyse`, `rangement`) ; `null` : aucune. */
  running?(record: string): string | null
  /** Arrêter le circuit d'un document en cours de traitement. */
  stopCircuit?(record: string): Promise<boolean>
}

/** Une proposition en mots : « l'entreprise « ESA — Agence spatiale européenne » », « la personne « Marie Durand » (ESA) ». */
export function proposalLabel(t: Translate, proposal: EntityProposal): string {
  const name = proposal.kind === 'issuer' && proposal.code && proposal.code !== proposal.name ? `${proposal.code} — ${proposal.name}` : proposal.name
  return t(`bibliotheque.proposals.label.${proposal.kind}`, { name, company: proposal.company ?? '' }).replace(/ \(\)$/, '')
}

/** Ce qu'on fait d'une proposition : la créer, l'écarter. */
function entityActions(t: Translate, deps: ControlDeps, record: string, index: number, after?: () => void): ViewAction[] {
  return [
    ...(deps.createEntity
      ? [
          {
            id: `entity-create-${index}`,
            label: t('bibliotheque.proposals.create'),
            tooltip: t('bibliotheque.proposals.create.tip'),
            icon: 'plus' as const,
            primary: true,
            run: async () => {
              await deps.createEntity!(record, index)
              after?.()
            }
          }
        ]
      : []),
    ...(deps.dismissEntity
      ? [
          {
            id: `entity-dismiss-${index}`,
            label: t('bibliotheque.proposals.dismiss'),
            tooltip: t('bibliotheque.proposals.dismiss.tip'),
            icon: 'cross' as const,
            run: async () => {
              await deps.dismissEntity!(record, index)
              after?.()
            }
          }
        ]
      : [])
  ]
}

/** Sur la fiche d'un document : une ligne par entité proposée, à créer ou écarter. */
export function proposalMessages(t: Translate, deps: ControlDeps, doc: LibraryDoc, after?: () => void): HomeBlock[] {
  return (doc.proposals ?? []).map((proposal, index) => ({
    kind: 'message' as const,
    tone: 'info' as const,
    text: [t('bibliotheque.proposals.message', { what: proposalLabel(t, proposal) }), proposal.why].filter(Boolean).join(' — '),
    actions: entityActions(t, deps, doc.record, index, after)
  }))
}

const percent = (value: number | undefined): string => `${Math.round((value ?? 0) * 100)} %`

/** Ce que l'on fait d'un document à contrôler (sur sa carte, sur sa fiche). */
export function controlActions(t: Translate, deps: ControlDeps, doc: LibraryDoc, after?: (record: string | null) => void): ViewAction[] {
  return [
    ...(doc.circuitProposal
      ? [
          {
            id: 'control-accept',
            label: t('bibliotheque.control.accept'),
            tooltip: t('bibliotheque.control.accept.tip', { place: deps.place(doc.circuitProposal) }),
            icon: 'check' as const,
            primary: true,
            run: async () => {
              const moved = await deps.accept(doc.record)
              after?.(moved)
            }
          }
        ]
      : []),
    {
      id: 'control-elsewhere',
      label: t('bibliotheque.control.elsewhere'),
      tooltip: t('bibliotheque.control.elsewhere.tip'),
      icon: 'folder',
      run: async () => {
        const moved = await deps.elsewhere(doc.record)
        after?.(moved)
      }
    },
    {
      id: 'control-discard',
      label: t('bibliotheque.control.discard'),
      tooltip: t('bibliotheque.control.discard.tip'),
      icon: 'archive',
      run: async () => {
        if (await deps.discard(doc.record)) after?.(null)
      }
    }
  ]
}

/** Ce que l'IA a dit d'un document à contrôler, en une ligne : sa proposition et sa confiance. */
export function proposalText(t: Translate, deps: Pick<ControlDeps, 'place'>, doc: LibraryDoc): string {
  return doc.circuitProposal ? t('bibliotheque.control.proposal', { place: deps.place(doc.circuitProposal), confidence: percent(doc.circuitConfidence) }) : t('bibliotheque.control.noProposal')
}

/** Le message d'une fiche à contrôler : ce que l'IA propose, pourquoi, et quoi faire. */
export function controlMessage(t: Translate, deps: ControlDeps, doc: LibraryDoc, after?: (record: string | null) => void): HomeBlock {
  return {
    kind: 'message',
    tone: 'warning',
    text: [t('bibliotheque.control.doc', { proposal: proposalText(t, deps, doc) }), doc.circuitReason].filter(Boolean).join(' — '),
    actions: controlActions(t, deps, doc, after)
  }
}

/** La page À contrôler. */
export async function controlPage(t: Translate, deps: ControlDeps, open: ((record: string) => void) | undefined): Promise<PageView> {
  const docs = (await deps.list()).sort((a, b) => (a.circuitConfidence ?? 0) - (b.circuitConfidence ?? 0) || a.title.localeCompare(b.title, 'fr'))
  const cards: Card[] = docs.map((doc) => ({
    id: doc.record,
    title: doc.title,
    subtitle: proposalText(t, deps, doc),
    icon: 'file',
    ...(doc.circuitReason ? { text: doc.circuitReason } : {}),
    badges: [{ label: t('bibliotheque.control.confidence', { confidence: percent(doc.circuitConfidence) }), tone: (doc.circuitConfidence ?? 0) >= 0.5 ? ('warning' as const) : ('danger' as const) }],
    ...(open ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => open(doc.record) } } : {}),
    actions: [...controlActions(t, deps, doc), ...[continueAction(t, deps, doc)].filter((action): action is ViewAction => !!action).map((action) => ({ ...action, primary: false }))]
  }))
  // En cours dans le circuit : où chacun en est ; on peut le ranger soi-même sans attendre.
  const pending = (await deps.pending?.()) ?? []
  const pendingJourneys: HomeBlock[] = pending.map((doc) =>
    circuitJourney(t, { ...deps, ...(open ? { open } : {}) }, doc, true, [
      {
        id: 'control-elsewhere',
        label: t('bibliotheque.control.fileMyself'),
        tooltip: t('bibliotheque.control.fileMyself.tip'),
        icon: 'folder' as const,
        run: async () => {
          await deps.elsewhere(doc.record)
        }
      }
    ])
  )
  // Les entreprises et personnes inconnues que des documents citent : à créer (liées) ou à écarter.
  const proposed = (await deps.entities?.()) ?? []
  const entityCards: Card[] = proposed.map(({ doc, proposal, index }) => ({
    id: `${doc.record}#${index}`,
    title: proposalLabel(t, proposal),
    subtitle: t('bibliotheque.proposals.citedIn', { title: doc.title }),
    icon: proposal.kind === 'issuer' ? ('building' as const) : ('user' as const),
    ...(proposal.why ? { text: proposal.why } : {}),
    ...(open ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => open(doc.record) } } : {}),
    actions: entityActions(t, deps, doc.record, index)
  }))
  return {
    title: t('bibliotheque.control.title'),
    subtitle: t('bibliotheque.control.subtitle'),
    blocks: [
      ...(cards.length
        ? [{ kind: 'stats' as const, stats: [{ label: t('bibliotheque.control.count'), value: String(cards.length), icon: 'flag' as const, tone: 'warning' as const }] }, { kind: 'cards' as const, cards }]
        : [{ kind: 'message' as const, tone: 'success' as const, text: t('bibliotheque.control.empty') }]),
      ...(entityCards.length
        ? [
            {
              kind: 'section' as const,
              id: 'bibliotheque.circuit.a-creer',
              title: t('bibliotheque.proposals.section'),
              subtitle: t('bibliotheque.proposals.section.count', { count: entityCards.length }),
              icon: 'plus' as const,
              blocks: [{ kind: 'cards' as const, cards: entityCards }]
            }
          ]
        : []),
      ...(pendingJourneys.length
        ? [
            {
              kind: 'section' as const,
              id: 'bibliotheque.circuit.en-cours',
              title: t('bibliotheque.control.pending'),
              subtitle: t('bibliotheque.control.pending.count', { count: pendingJourneys.length }),
              icon: 'clock' as const,
              blocks: [{ kind: 'message' as const, tone: 'info' as const, text: t('bibliotheque.circuit.steps.legend') }, ...pendingJourneys]
            }
          ]
        : [])
    ]
  }
}
