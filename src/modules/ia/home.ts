// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Ce que l'IA montre dans l'interface : sur le tableau de bord, la connexion et un modèle
 * par usage ; sur la page **IA**, la connexion en chiffres, une carte par usage — le
 * modèle choisi, ou celui pris à la place, et à quoi il sert — avec « Choisir le modèle »
 * parmi ceux du serveur, et ce qui, dans Black Projects, se sert de l'IA. Les réglages
 * (adresse, clé) restent dans la fenêtre du module, ouverte par « Régler la connexion ».
 */

import type { Card, HomeSectionView, ListItem, PageView, Tone, ViewAction, ViewsRegistrar } from '../../core/views'
import type { ModuleDetails } from '../../core/modules/module'
import type { AiClient, AiConnection } from './client'
import { listedModels, MODEL_KEYS, MODEL_USES, modelsFor, type ModelUse } from './models'

/** La page de l'IA. */
export const IA_PAGE = 'ia.connexion'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface IaHomeDeps {
  t: Translate
  /** Les réglages du module, tels qu'enregistrés. */
  settings(): Readonly<Record<string, unknown>>
  save(values: Record<string, unknown>): Promise<void>
  /** La connexion, clé comprise. */
  connection(): AiConnection
  client(connection: AiConnection): AiClient
  /** Choisir parmi des options (la fenêtre de la plateforme) ; `null` : annulé. */
  pick(options: { value: string; label: string; description?: string }[], placeholder: string): Promise<string | null>
  notify(message: string): void
  test(): Promise<void>
  /** La fenêtre du module (adresse, clé, jetons), quand la plateforme en a une. */
  openSettings?(): void
  showPage?(id: string): void
  features(): ModuleDetails
}

/** Le champ de la connexion qui porte le modèle de chaque usage. */
export const USE_FIELD: Record<ModelUse, keyof AiConnection> = {
  text: 'model',
  translate: 'translateModel',
  embedding: 'embeddingModel',
  rerank: 'rerankModel',
  ocr: 'ocrModel',
  vision: 'visionModel'
}

/** Le modèle d'un usage : choisi, pris à la place d'un autre, ou pas utilisé. */
function usageOf(deps: IaHomeDeps, connection: AiConnection, use: ModelUse): { own: string; model: string; tone: Tone; detail: string } {
  const own = String(connection[USE_FIELD[use]] ?? '').trim()
  const model = connection.baseUrl ? deps.client(connection).modelFor(use) : ''
  if (own) return { own, model: own, tone: 'success', detail: own }
  if (model) return { own, model, tone: 'info', detail: deps.t('ia.home.fallback', { model }) }
  return { own, model: '', tone: 'neutral', detail: deps.t('ia.home.unused') }
}

/** Choisir le modèle d'un usage parmi ceux du serveur ; « aucun » le laisse prendre celui par défaut. */
async function chooseModel(deps: IaHomeDeps, use: ModelUse): Promise<void> {
  const { t } = deps
  const listed = listedModels(deps.settings())
  if (!listed.length) {
    deps.notify(t('ia.page.testFirst'))
    return
  }
  const current = String(deps.connection()[USE_FIELD[use]] ?? '').trim()
  const options = [
    ...modelsFor(use, listed).map((name) => ({ value: name, label: name, ...(name === current ? { description: t('ia.page.current') } : {}) })),
    { value: '', label: t('ia.page.none'), description: t(`ia.page.none.${use}`) }
  ]
  const chosen = await deps.pick(options, t('ia.page.pick', { use: t(`ia.setting.model.${use}`) }))
  if (chosen === null || chosen === current) return
  await deps.save({ ...deps.settings(), [MODEL_KEYS[use]]: chosen })
  deps.notify(chosen ? t('ia.page.chosen', { use: t(`ia.setting.model.${use}`), model: chosen }) : t('ia.page.cleared', { use: t(`ia.setting.model.${use}`) }))
}

/** Les boutons communs : tester, régler. */
function commonActions(deps: IaHomeDeps): { test: ViewAction; configure: ViewAction[] } {
  const { t } = deps
  const open = deps.openSettings
  return {
    test: { id: 'test', label: t('ia.setting.test.button'), icon: 'refresh', run: () => deps.test() },
    configure: open ? [{ id: 'settings', label: t('ia.page.configure'), icon: 'settings', run: () => open() }] : []
  }
}

/** La section du tableau de bord : la connexion, un modèle par usage. */
export async function iaSection(deps: IaHomeDeps): Promise<HomeSectionView> {
  const { t } = deps
  const connection = deps.connection()
  const { test, configure } = commonActions(deps)
  const head = { title: t('ia.home.title'), icon: 'spark' as const, ...(deps.showPage ? { actions: [{ id: 'all', label: t('ia.page.all'), icon: 'chevron' as const, run: () => deps.showPage?.(IA_PAGE) }] } : {}) }
  if (!connection.baseUrl) return { ...head, blocks: [{ kind: 'message', tone: 'warning', text: t('ia.home.noUrl'), actions: configure }] }
  if (!connection.model) return { ...head, blocks: [{ kind: 'message', tone: 'warning', text: t('ia.home.noModel'), actions: [test, ...configure] }] }
  return {
    ...head,
    subtitle: connection.baseUrl,
    blocks: [
      {
        kind: 'list',
        items: MODEL_USES.map((use) => {
          const usage = usageOf(deps, connection, use)
          return { id: use, title: t(`ia.setting.model.${use}`), detail: usage.detail, tone: usage.tone }
        })
      },
      { kind: 'actions', actions: [test, ...configure] }
    ]
  }
}

/** La carte d'un usage. */
function usageCard(deps: IaHomeDeps, connection: AiConnection, use: ModelUse, fitting: number): Card {
  const { t } = deps
  const usage = usageOf(deps, connection, use)
  const state = usage.own ? 'choisis' : usage.model ? 'par-defaut' : 'inutilises'
  return {
    id: use,
    title: t(`ia.setting.model.${use}`),
    subtitle: usage.detail,
    icon: 'spark',
    badges: [{ label: t(`ia.page.state.${state}`), tone: usage.tone }],
    text: t(`ia.setting.model.${use}.desc`),
    facts: [{ label: t('ia.page.fitting'), value: fitting ? String(fitting) : '—' }],
    actions: [{ id: 'choose', label: t('ia.page.choose'), icon: 'edit', run: () => chooseModel(deps, use) }],
    tags: [state]
  }
}

/**
 * La page **IA** : la connexion (réglée ou pas, les modèles du serveur, les usages
 * couverts, la longueur des réponses), une carte par usage, et ce qui se sert de l'IA.
 */
export async function iaPage(deps: IaHomeDeps): Promise<PageView> {
  const { t } = deps
  const connection = deps.connection()
  const listed = listedModels(deps.settings())
  const { test, configure } = commonActions(deps)
  const covered = MODEL_USES.filter((use) => usageOf(deps, connection, use).model).length
  const ready = Boolean(connection.baseUrl && connection.model)
  const warning = !connection.baseUrl ? t('ia.home.noUrl') : !connection.model ? t('ia.home.noModel') : ''
  const details = deps.features()
  const uses = details.sections[1]?.features ?? []
  const items: ListItem[] = uses.map((feature) => ({
    id: feature.labelKey,
    title: t(feature.labelKey),
    detail: feature.noteKey ? t(feature.noteKey) : '',
    tone: feature.status === 'available' ? (ready ? 'success' : 'warning') : 'neutral',
    ...(feature.status !== 'available' ? { when: t('ia.page.coming', { step: feature.step ?? '' }) } : {})
  }))
  return {
    subtitle: connection.baseUrl ? t('ia.page.subtitle', { url: connection.baseUrl }) : t('ia.page.subtitle.none'),
    actions: [{ ...test, primary: !listed.length && Boolean(connection.baseUrl) }, ...configure.map((action) => ({ ...action, primary: !connection.baseUrl }))],
    search: { label: t('ia.page.search'), placeholder: t('ia.page.search.placeholder') },
    filters: [
      { id: 'choisis', label: t('ia.page.state.choisis') },
      { id: 'par-defaut', label: t('ia.page.state.par-defaut') },
      { id: 'inutilises', label: t('ia.page.state.inutilises') }
    ],
    blocks: [
      ...(warning ? [{ kind: 'message' as const, tone: 'warning' as const, text: warning }] : []),
      {
        kind: 'stats',
        stats: [
          { label: t('ia.page.stat.connection'), value: t(ready ? 'ia.page.stat.ready' : 'ia.page.stat.notReady'), icon: 'spark', tone: ready ? 'success' : 'warning' },
          { label: t('ia.page.stat.listed'), value: String(listed.length), icon: 'list', hint: t('ia.page.stat.listed.hint') },
          { label: t('ia.page.stat.covered'), value: `${covered} / ${MODEL_USES.length}`, icon: 'check', tone: covered ? 'success' : 'neutral' },
          { label: t('ia.page.stat.tokens'), value: connection.maxTokens ? String(connection.maxTokens) : t('ia.page.stat.tokens.default'), icon: 'chat' }
        ]
      },
      { kind: 'cards', cards: MODEL_USES.map((use) => usageCard(deps, connection, use, listed.length ? modelsFor(use, listed).length : 0)) },
      { kind: 'list', title: t('ia.page.uses'), items }
    ]
  }
}

export function registerIaHome(views: ViewsRegistrar | undefined, deps: IaHomeDeps): void {
  if (!views) return
  const { t } = deps
  const open = deps.showPage ? () => deps.showPage?.(IA_PAGE) : deps.openSettings
  const page = deps.showPage ? { page: IA_PAGE } : {}
  views.home({ id: 'ia.status', title: t('ia.home.title'), icon: 'spark', order: 20, area: 'side', load: () => iaSection(deps) })
  if (deps.showPage) views.page({ id: IA_PAGE, title: t('ia.page.title'), icon: 'spark', load: () => iaPage(deps) })
  if (open) {
    views.nav({ id: 'ia', label: t('ia.name'), icon: 'spark', order: 40, ...page, run: open })
    views.tile({
      id: 'ia.reglages',
      label: t('ia.name'),
      icon: 'spark',
      color: 'violet',
      group: t('ia.name'),
      order: 40,
      byDefault: true,
      description: t('ia.tile.desc'),
      ...page,
      run: open,
      badge: async () => {
        const connection = deps.connection()
        return connection.baseUrl && connection.model ? null : { text: '!', tone: 'warning', label: t('ia.home.noUrl') }
      }
    })
  }
  views.tile({ id: 'ia.tester', label: t('ia.setting.test.button'), icon: 'refresh', color: 'violet', group: t('ia.name'), order: 41, description: t('ia.setting.test.desc'), run: () => deps.test() })
}
