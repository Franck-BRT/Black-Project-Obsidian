// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * **Les étapes du circuit**, pour un document encore dans « À classer » ou « À contrôler » :
 * versé, ingéré, analysé, rangé — chacune en couleur selon où il en est :
 *
 * - **vert** : faite ;
 * - **orange** : la prochaine, en attente (le circuit la fera), ou à votre décision (À contrôler,
 *   avec une proposition de l'IA) ;
 * - **rouge** : en échec (l'IA injoignable, une erreur), ou À contrôler sans proposition ;
 * - gris : à venir.
 *
 * Et un bouton, **Continuer le circuit** : reprendre là où il s'est arrêté (à contrôler :
 * redemander le rangement à l'IA). Des fonctions pures.
 */

import type { HomeBlock, IconName, JourneyProgress, ListItem, TileColor, Tone, ViewAction } from '../../core/views'
import type { LibraryDoc } from './model'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Où en est une étape : faite, en cours (le circuit la fait en ce moment), en attente, à décider, en échec, à venir. */
export type CircuitStepState = 'done' | 'running' | 'waiting' | 'decide' | 'failed' | 'later'

/** L'étape du parcours que le circuit fait en ce moment (`ingestion`, `glossaire`, `analyse`, `rangement`) → celle des quatre étapes du circuit. */
const RUNNING_STAGE: Readonly<Record<string, CircuitStep['id']>> = { ingestion: 'ingerer', glossaire: 'analyser', analyse: 'analyser', projet: 'analyser', liens: 'analyser', rangement: 'ranger' }

/** Une étape du circuit, pour un document. */
export interface CircuitStep {
  id: 'verse' | 'ingerer' | 'analyser' | 'ranger'
  icon: IconName
  state: CircuitStepState
  /** Ce qui s'est passé, ou ce qui bloque (l'erreur, la proposition de l'IA). */
  detail?: string
}

/** Les documents dont on montre les étapes : ceux qui ne sont ni rangés, ni écartés. */
export const inCircuit = (doc: LibraryDoc): boolean => doc.circuit === 'a-classer' || doc.circuit === 'ingere' || doc.circuit === 'analyse' || doc.circuit === 'a-controler'

/** Le rang de l'étape suivante (1 : ingérer, 2 : analyser, 3 : ranger), selon l'état. */
const NEXT: Record<string, number> = { 'a-classer': 1, ingere: 2, analyse: 3, 'a-controler': 3 }

const percent = (value: number | undefined): string => `${Math.round((value ?? 0) * 100)} %`

/** Les quatre étapes d'un document du circuit, et l'état de chacune ; `running` : l'étape du parcours que le circuit fait en ce moment. */
export function circuitSteps(t: Translate, doc: LibraryDoc, place: (folder: string) => string, running: string | null = null): CircuitStep[] {
  const next = NEXT[doc.circuit ?? ''] ?? 4
  const ids: CircuitStep['id'][] = ['verse', 'ingerer', 'analyser', 'ranger']
  const icons: IconName[] = ['upload', 'file', 'search', 'folder']
  const now = running ? RUNNING_STAGE[running] : undefined
  return ids.map((id, at) => {
    const icon = icons[at]!
    if (now === id) return { id, icon: 'spinner', state: 'running', detail: t(`bibliotheque.steps.running.${running}`) }
    if (at < next) return { id, icon, state: 'done', ...(at === 0 ? { detail: doc.added.slice(0, 10) } : {}) }
    if (at > next) return { id, icon, state: 'later' }
    // L'étape suivante : en échec, à votre décision, ou en attente.
    if (doc.circuitError) return { id, icon, state: 'failed', detail: doc.circuitError }
    if (doc.circuit === 'a-controler') {
      return doc.circuitProposal
        ? { id, icon, state: 'decide', detail: t('bibliotheque.circuit.steps.proposed', { place: place(doc.circuitProposal), confidence: percent(doc.circuitConfidence) }) }
        : { id, icon, state: 'failed', detail: doc.circuitReason || t('bibliotheque.control.noProposal') }
    }
    return { id, icon, state: 'waiting', ...(doc.circuitStopped ? { detail: t('bibliotheque.steps.stopped') } : {}) }
  })
}

const COLOR: Record<CircuitStepState, TileColor> = { done: 'green', running: 'blue', waiting: 'orange', decide: 'orange', failed: 'rose', later: 'slate' }
const PROGRESS: Record<CircuitStepState, JourneyProgress> = { done: 'done', running: 'current', waiting: 'current', decide: 'current', failed: 'current', later: 'todo' }
const TONE: Record<CircuitStepState, Tone> = { done: 'success', running: 'info', waiting: 'warning', decide: 'warning', failed: 'danger', later: 'neutral' }

/** Ce que les étapes savent faire : le dossier en mots, continuer le circuit, ouvrir la fiche. */
export interface CircuitStepsDeps {
  place(folder: string): string
  /** Pourquoi on ne peut pas continuer le circuit (pas d'IA, le circuit coupé) ; `null` : on peut. */
  cannotContinue?(): string | null
  /** Continuer le circuit pour ce document (là où il s'est arrêté). */
  continueCircuit?(record: string): Promise<boolean>
  /** L'étape que le circuit fait en ce moment pour ce document (`ingestion`, `glossaire`, `analyse`, `rangement`) ; `null` : aucune. */
  running?(record: string): string | null
  /** Arrêter le circuit pour ce document (il s'arrête avant son étape suivante ; celle en cours n'applique rien). */
  stopCircuit?(record: string): Promise<boolean>
  /** Ouvrir la fiche du document. */
  open?(record: string): void
}

/** Le bouton « Arrêter le circuit » d'un document que le circuit traite en ce moment ; `null` : il n'est pas en cours. */
export function stopAction(t: Translate, deps: CircuitStepsDeps, doc: LibraryDoc): ViewAction | null {
  if (!deps.stopCircuit || !deps.running?.(doc.record)) return null
  return {
    id: 'circuit-stop',
    label: t('bibliotheque.circuit.stop'),
    tooltip: t('bibliotheque.circuit.stop.tip'),
    icon: 'stop',
    primary: true,
    run: async () => {
      await deps.stopCircuit!(doc.record)
    }
  }
}

/**
 * Le bouton « Continuer le circuit » d'un document (grisé, avec sa raison, si on ne peut pas) —
 * ou, s'il est en cours de traitement, « Arrêter le circuit ».
 */
export function continueAction(t: Translate, deps: CircuitStepsDeps, doc: LibraryDoc): ViewAction | null {
  const stop = stopAction(t, deps, doc)
  if (stop) return stop
  if (!deps.continueCircuit) return null
  const blocked = deps.cannotContinue?.() ?? null
  return {
    id: 'circuit-continue',
    label: t('bibliotheque.circuit.continue'),
    tooltip: blocked ?? t(doc.circuit === 'a-controler' ? 'bibliotheque.circuit.continue.control.tip' : 'bibliotheque.circuit.continue.tip'),
    icon: 'play',
    primary: true,
    ...(blocked ? { disabled: true } : {}),
    run: async () => {
      await deps.continueCircuit!(doc.record)
    }
  }
}

/**
 * Le parcours d'un document dans le circuit : ses quatre étapes, en couleur, et « Continuer le
 * circuit ». `titled` : son titre (le document, qui ouvre sa fiche) et son état en pastille —
 * pour une liste de documents ; sans : sur la fiche même.
 */
export function circuitJourney(t: Translate, deps: CircuitStepsDeps, doc: LibraryDoc, titled = true, extra: ViewAction[] = []): HomeBlock {
  const running = deps.running?.(doc.record) ?? null
  const steps = circuitSteps(t, doc, deps.place, running)
  const stuck = steps.find((step) => step.state !== 'done' && step.state !== 'later')
  const action = continueAction(t, deps, doc)
  const state = running ? t('bibliotheque.circuit.running') : t(`bibliotheque.control.state.${doc.circuit ?? 'a-classer'}`)
  return {
    kind: 'journey',
    label: t('bibliotheque.circuit.steps.label', { title: doc.title, state }),
    ...(titled ? { title: doc.title, ...(deps.open ? { open: { id: 'open', label: t('bibliotheque.doc.open'), run: () => deps.open!(doc.record) } } : {}) } : { title: t('bibliotheque.circuit.steps.title') }),
    badge: { label: state, tone: stuck ? TONE[stuck.state] : 'success' },
    stages: steps.map((step, at) => ({
      id: step.id,
      caption: t('bibliotheque.circuit.steps.caption', { n: at + 1 }),
      phases: [
        {
          id: step.id,
          label: t(`bibliotheque.circuit.steps.${step.id}`),
          icon: step.icon,
          color: COLOR[step.state],
          progress: PROGRESS[step.state],
          status: { label: t(`bibliotheque.circuit.steps.state.${step.state}`), tone: TONE[step.state] },
          ...(step.detail ? { detail: step.detail } : {})
        }
      ]
    })),
    ...(titled ? {} : { legend: t('bibliotheque.circuit.steps.legend') }),
    actions: [...(action ? [action] : []), ...extra]
  }
}

// ── Le parcours complet d'un document, sur sa fiche ──

/** Une étape du parcours d'un document : faite, en attente, à décider (à confirmer), en échec, à venir, sans objet. */
export type DocStepState = 'done' | 'running' | 'waiting' | 'decide' | 'failed' | 'later' | 'skipped'

const STEP_TONE: Record<DocStepState, Tone> = { done: 'success', running: 'info', waiting: 'warning', decide: 'warning', failed: 'danger', later: 'neutral', skipped: 'neutral' }
const STEP_ICON: Record<DocStepState, IconName> = { done: 'check', running: 'spinner', waiting: 'clock', decide: 'alert', failed: 'cross', later: 'more', skipped: 'hide' }

/** Ce que le parcours d'un document a besoin de savoir, en plus de sa fiche. */
export interface DocStepsContext {
  /** Un dossier en mots (« Documents › Normes »). */
  place(folder: string): string
  /** Où il est rangé, en mots. */
  here: string
  /** Ses fantômes : où chacun le montre aussi, et y aller. */
  ghosts: readonly { label: string; open(): void }[]
  /** Une entreprise en mots (son code et son nom). */
  issuer(code: string): string
  /** Une date en mots. */
  date(value: string): string
  /** Combien de liens il a, et d'entreprises ou personnes proposées à créer. */
  links: number
  proposals: number
  /** Les termes du glossaire qu'il emploie (en mots), pour l'étape « Recherche dans le glossaire ». */
  glossary?: readonly string[]
  /** « Continuer le circuit » (absent : pas de bouton). */
  continueAction?: ViewAction | null
  /** L'étape que le circuit fait en ce moment (`ingestion`, `glossaire`, `analyse`, `rangement`), et « Arrêter le circuit » ; absente : aucune. */
  running?: string | null
  stopAction?: ViewAction | null
  /** Le bouton qui relance seulement cette étape (son identifiant, son nom) ; `null` : pas de bouton. */
  relaunch?(id: string, title: string): ViewAction | null
}

/**
 * **Le parcours d'un document**, dès sa création, une ligne par étape, chacune en couleur selon où
 * il en est : le contrôle des doublons (et ses fantômes), l'entrée dans « À classer », l'ingestion
 * (son texte lu), la recherche dans le glossaire (les termes qu'il emploie, reliés à sa fiche),
 * l'analyse — puis, en retrait, chaque champ (type de pièce, entreprise, titre, date, langue,
 * référence, étiquettes, projet) —, l'analyse des liens, leur création, le rangement. Hors du
 * circuit (versé dans un répertoire choisi, ou le circuit coupé), ce qui a été fait à l'entrée.
 */
export function documentSteps(t: Translate, doc: LibraryDoc, context: DocStepsContext): ListItem[] {
  const circuit = !!doc.circuit
  const state = doc.circuit ?? ''
  const label = (key: DocStepState | 'confirm' | 'none'): string => t(`bibliotheque.steps.state.${key}`)
  const running = context.running ?? null
  const item = (id: string, title: string, given: DocStepState, givenDetail = '', level = 0, givenExtra: Partial<ListItem> = {}): ListItem => {
    // L'étape en cours : en bleu, « Arrêter le circuit » sur sa ligne (pas de relance pendant ce temps).
    const now = id === running
    const stepState: DocStepState = now ? 'running' : given
    const detail = now ? t(`bibliotheque.steps.running.${id}`) : givenDetail || (given === 'waiting' && doc.circuitStopped ? t('bibliotheque.steps.stopped') : '')
    const extra: Partial<ListItem> = now ? { ...(context.stopAction ? { actions: [context.stopAction] } : {}) } : givenExtra
    // Relancer seulement cette étape : un petit bouton, devant la ligne.
    const relaunch = running ? null : (context.relaunch?.(id, title) ?? null)
    return {
      id: `parcours-${id}`,
      title,
      ...(detail ? { detail } : {}),
      tone: STEP_TONE[stepState],
      icon: STEP_ICON[stepState],
      when: label(stepState),
      ...(level ? { level } : {}),
      ...(relaunch ? { tools: [relaunch] } : {}),
      ...extra
    }
  }
  // L'étape où le circuit s'est arrêté (en échec, en attente, à décider) : « Continuer le circuit » y est.
  const resume = (stepState: DocStepState): Partial<ListItem> =>
    !running && circuit && context.continueAction && (stepState === 'failed' || stepState === 'waiting' || (stepState === 'decide' && state === 'a-controler')) ? { actions: [context.continueAction] } : {}
  const error = doc.circuitError ?? ''
  const items: ListItem[] = []

  // 1. Le contrôle des doublons : versé une seule fois ; déposé de nouveau ailleurs, ses fantômes l'y montrent.
  items.push(
    item('doublons', t('bibliotheque.steps.dedupe'), 'done', context.ghosts.length ? t('bibliotheque.steps.dedupe.ghosts', { places: context.ghosts.map((each) => each.label).join(', ') }) : t('bibliotheque.steps.dedupe.none'), 0, {
      ...(context.ghosts.length ? { actions: context.ghosts.slice(0, 3).map((ghost, index) => ({ id: `fantome-${index}`, label: t('bibliotheque.steps.ghost', { place: ghost.label }), icon: 'ghost' as const, run: () => ghost.open() })) } : {})
    })
  )
  // 2. L'entrée dans « À classer ».
  items.push(circuit ? item('a-classer', t('bibliotheque.steps.inbox'), 'done', t('bibliotheque.steps.inbox.done')) : item('a-classer', t('bibliotheque.steps.inbox'), 'skipped', t('bibliotheque.steps.inbox.direct')))
  // 3. L'ingestion : son texte lu (et relu par l'IA, dans le circuit).
  const readDetail = doc.reading === 'lue' ? t('bibliotheque.steps.read', { count: (doc.characters ?? 0).toLocaleString('fr-FR') }) : doc.reading ? t(`bibliotheque.steps.read.${doc.reading}`) : t('bibliotheque.steps.read.none')
  const readState: DocStepState = doc.reading === 'lue' ? 'done' : doc.reading === 'sans-texte' || doc.reading === 'image' ? 'decide' : doc.reading === 'illisible' ? 'failed' : 'later'
  const ingestState: DocStepState = circuit ? (state === 'a-classer' ? (error ? 'failed' : 'waiting') : 'done') : readState
  items.push(item('ingestion', t('bibliotheque.steps.ingest'), ingestState, ingestState === 'failed' && error ? error : readDetail, 0, resume(ingestState)))
  // 3 bis. La recherche dans le glossaire (sans IA) : les termes qu'il emploie, reliés à sa fiche.
  const terms = context.glossary ?? []
  const termsText = (count: number): string => (terms.length ? `${t('bibliotheque.steps.glossary.found', { count })} : ${terms.join(', ')}` : t('bibliotheque.steps.glossary.found', { count }))
  const searched = doc.glossarySearched
  items.push(
    searched !== undefined
      ? searched > 0 || terms.length
        ? item('glossaire', t('bibliotheque.steps.glossary'), 'done', termsText(Math.max(searched, terms.length)))
        : item('glossaire', t('bibliotheque.steps.glossary'), 'skipped', t('bibliotheque.steps.glossary.none'), 0, { when: label('none') })
      : circuit && (state === 'a-classer' || state === 'ingere' || state === 'analyse' || state === 'a-controler')
        ? state === 'a-classer'
          ? item('glossaire', t('bibliotheque.steps.glossary'), 'later')
          : item('glossaire', t('bibliotheque.steps.glossary'), 'waiting', '', 0, resume('waiting'))
        : item('glossaire', t('bibliotheque.steps.glossary'), 'skipped', terms.length ? t('bibliotheque.steps.glossary.notLinked', { count: terms.length, terms: terms.join(', ') }) : t('bibliotheque.steps.glossary.notSearched'))
  )
  // 4. L'analyse, puis chacun de ses champs.
  const analysed = !circuit || (state !== 'a-classer' && state !== 'ingere')
  const analysisState: DocStepState = !circuit ? 'done' : analysed ? 'done' : state === 'ingere' ? (error ? 'failed' : 'waiting') : 'later'
  items.push(
    item(
      'analyse',
      t('bibliotheque.steps.analyse'),
      analysisState,
      analysisState === 'failed' && error ? error : circuit ? (analysed ? t('bibliotheque.steps.analyse.done') : '') : t('bibliotheque.steps.analyse.entry'),
      0,
      resume(analysisState)
    )
  )
  const field = (id: string, name: string, value: string, toConfirm: boolean): ListItem =>
    !analysed ? item(id, name, 'later', '', 1) : toConfirm ? item(id, name, 'decide', value, 1, { when: label('confirm') }) : value ? item(id, name, 'done', value, 1) : item(id, name, 'skipped', '', 1, { when: label('none') })
  const version = [doc.reference, doc.edition ? `ed${doc.edition}` : '', doc.revision ? `rev${doc.revision}` : ''].filter(Boolean).join(' ')
  const projectName = doc.circuitProject ? doc.circuitProject.slice(doc.circuitProject.lastIndexOf('/') + 1).replace(/\.md$/, '') : ''
  items.push(
    field('type', t('bibliotheque.field.category'), doc.category, !!doc.categoryToConfirm),
    field('entreprise', t('bibliotheque.field.issuer'), doc.issuer ? context.issuer(doc.issuer) : '', !!doc.issuerToConfirm),
    field('titre', t('bibliotheque.field.title'), doc.title, !!doc.titleToConfirm),
    field('date', t('bibliotheque.field.date'), doc.date ? context.date(doc.date) : '', !!doc.dateToConfirm),
    field('langue', t('bibliotheque.field.language'), doc.language ? t(`bibliotheque.lang.${doc.language}`) : '', !!doc.languageToConfirm && !doc.language),
    field('reference', t('bibliotheque.field.identity'), version, !!doc.identityToConfirm),
    field('etiquettes', t('bibliotheque.field.tags'), doc.tags.join(', '), !!doc.tagsToConfirm),
    ...(circuit ? [field('projet', t('bibliotheque.steps.project'), projectName, false)] : [])
  )
  // 5. L'analyse des liens : les entités que le texte cite ; les inconnues, proposées à créer.
  const linksFound = context.links ? t('bibliotheque.steps.links.found', { count: context.links }) : ''
  const proposed = context.proposals ? t('bibliotheque.steps.links.proposed', { count: context.proposals }) : ''
  items.push(
    !circuit && !context.links
      ? item('liens', t('bibliotheque.steps.links'), 'skipped', t('bibliotheque.steps.outside'))
      : !analysed
        ? item('liens', t('bibliotheque.steps.links'), 'later')
        : context.proposals
          ? item('liens', t('bibliotheque.steps.links'), 'decide', [linksFound, proposed].filter(Boolean).join(' · '))
          : context.links
            ? item('liens', t('bibliotheque.steps.links'), 'done', linksFound)
            : item('liens', t('bibliotheque.steps.links'), 'skipped', t('bibliotheque.steps.links.none'), 0, { when: label('none') })
  )
  // 6. La création des liens : dans la fiche, et un rétrolien dans chaque note citée.
  items.push(
    context.links
      ? item('liens-crees', t('bibliotheque.steps.linksWritten'), 'done', t('bibliotheque.steps.linksWritten.done', { count: context.links }))
      : !analysed
        ? item('liens-crees', t('bibliotheque.steps.linksWritten'), 'later')
        : item('liens-crees', t('bibliotheque.steps.linksWritten'), 'skipped', circuit ? t('bibliotheque.steps.linksWritten.none') : t('bibliotheque.steps.outside'), 0, { when: label(circuit ? 'none' : 'skipped') })
  )
  // 7. Le rangement.
  const percent = (value: number | undefined): string => `${Math.round((value ?? 0) * 100)} %`
  const filing: ListItem = !circuit
    ? item('rangement', t('bibliotheque.steps.file'), 'done', t('bibliotheque.steps.file.here', { place: context.here }))
    : state === 'range'
      ? item('rangement', t('bibliotheque.steps.file'), 'done', t('bibliotheque.steps.file.here', { place: context.here }))
      : state === 'ecarte'
        ? item('rangement', t('bibliotheque.steps.file'), 'skipped', t('bibliotheque.steps.file.discarded'))
        : state === 'a-controler'
          ? doc.circuitProposal
            ? item('rangement', t('bibliotheque.steps.file'), 'decide', t('bibliotheque.circuit.steps.proposed', { place: context.place(doc.circuitProposal), confidence: percent(doc.circuitConfidence) }), 0, resume('decide'))
            : item('rangement', t('bibliotheque.steps.file'), 'failed', doc.circuitReason || t('bibliotheque.control.noProposal'), 0, resume('failed'))
          : state === 'analyse'
            ? item('rangement', t('bibliotheque.steps.file'), error ? 'failed' : 'waiting', error, 0, resume(error ? 'failed' : 'waiting'))
            : item('rangement', t('bibliotheque.steps.file'), 'later')
  items.push(filing)
  return items
}
