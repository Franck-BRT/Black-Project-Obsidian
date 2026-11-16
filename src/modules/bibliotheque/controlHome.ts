// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **À contrôler** (le circuit des documents) : les documents que l'IA n'a pas su ranger avec
 * assez de confiance. Pour chacun, sa proposition, sa raison, sa confiance ; l'utilisateur
 * **accepte**, **choisit ailleurs**, ou **écarte** (mis de côté) — ou le laisse là.
 */

import type { Card, HomeBlock, PageView, ViewAction } from '../../core/views'
import type { LibraryDoc } from './model'

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
    actions: controlActions(t, deps, doc)
  }))
  // En cours dans le circuit : où chacun en est ; on peut le ranger soi-même sans attendre.
  const pending = (await deps.pending?.()) ?? []
  const pendingCards: Card[] = pending.map((doc) => ({
    id: doc.record,
    title: doc.title,
    subtitle: t(`bibliotheque.control.state.${doc.circuit ?? 'a-classer'}`),
    icon: 'clock',
    badges: [{ label: t(`bibliotheque.control.state.${doc.circuit ?? 'a-classer'}`), tone: 'info' as const }],
    ...(open ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => open(doc.record) } } : {}),
    actions: [
      {
        id: 'control-elsewhere',
        label: t('bibliotheque.control.fileMyself'),
        tooltip: t('bibliotheque.control.fileMyself.tip'),
        icon: 'folder' as const,
        run: async () => {
          await deps.elsewhere(doc.record)
        }
      }
    ]
  }))
  return {
    title: t('bibliotheque.control.title'),
    subtitle: t('bibliotheque.control.subtitle'),
    blocks: [
      ...(cards.length
        ? [{ kind: 'stats' as const, stats: [{ label: t('bibliotheque.control.count'), value: String(cards.length), icon: 'flag' as const, tone: 'warning' as const }] }, { kind: 'cards' as const, cards }]
        : [{ kind: 'message' as const, tone: 'success' as const, text: t('bibliotheque.control.empty') }]),
      ...(pendingCards.length
        ? [
            {
              kind: 'section' as const,
              id: 'bibliotheque.circuit.en-cours',
              title: t('bibliotheque.control.pending'),
              subtitle: t('bibliotheque.control.pending.count', { count: pendingCards.length }),
              icon: 'clock' as const,
              blocks: [{ kind: 'cards' as const, cards: pendingCards }]
            }
          ]
        : [])
    ]
  }
}
