// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'interface de Black Projects hors d'Obsidian : les vrais modules, un coffre en
 * mémoire garni d'un dossier fictif, et la même interface (`src/ui`) montée dans une
 * page web. C'est ce que fera l'application de bureau (Tauri), les ports en mémoire
 * remplacés par Rust. Sert aussi aux captures des thèmes.
 *
 * Paramètres d'adresse pour forcer l'apparence : ?mode=dark&vision=red-green&reading=dys&size=large ;
 * ?page=dashboard pour ouvrir le tableau de bord.
 */

import { readAppearance, type Appearance } from '../src/core/appearance'
import { readDashboard, readNavMenu } from '../src/core/settings'
import { createI18n } from '../src/core/i18n'
import { EVALUATION } from '../src/core/licence'
import type { ModuleContext } from '../src/core/modules/module'
import { ModuleRegistry } from '../src/core/modules/registry'
import { memoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { MODULES } from '../src/modules'
import { createAnalysis, importFiles } from '../src/modules/ao'
import { requirementsAt } from '../src/modules/exigences'
import { dialogWindows, mountApp, openModuleWindow, type DialogHost } from '../src/ui'

const params = new URLSearchParams(location.search)
const language = params.get('lang') === 'en' ? 'en' : 'fr'
const i18n = createI18n(language)
for (const module of MODULES) {
  i18n.register('fr', module.texts.fr)
  i18n.register('en', module.texts.en)
}
const t = i18n.t.bind(i18n)

const platform = memoryPlatform()
let appearance: Appearance = readAppearance({})
const dark = matchMedia('(prefers-color-scheme: dark)')

// Les fenêtres : celles de l'interface, comme dans Obsidian. Une note « ouverte » se lit
// dans une fenêtre de texte (l'application de bureau aura son lecteur Markdown).
const dialogHost: DialogHost = { t: (key, vars) => t(key, vars), appearance: () => appearance, hostIsDark: () => dark.matches, notify: (message) => toast(message), document }
const windows = dialogWindows(dialogHost)
let activeNote: string | null = null
platform.ui = {
  ...platform.ui,
  pickOption: windows.pickOption,
  askForm: windows.askForm,
  confirm: windows.confirm,
  pickMany: windows.pickMany,
  inform: windows.inform,
  pickFromList: windows.pickFromList,
  showText: windows.showText,
  pickFile: (options) =>
    windows.pickPath(
      [...platform.files.keys()].filter((path) => !options.extensions || [...options.extensions].includes(path.slice(path.lastIndexOf('.') + 1).toLowerCase())).sort(),
      options.placeholder
    ),
  activeNote: () => activeNote,
  openNote: async (path) => {
    activeNote = path
    windows.showText({ title: path.slice(path.lastIndexOf('/') + 1), subtitle: path, text: await platform.fs.readText(path) })
  },
  pickExternalFiles: (options) =>
    new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = options.multiple ?? true
      if (options.accept?.length) input.accept = options.accept.map((ext) => `.${ext}`).join(',')
      input.addEventListener('cancel', () => resolve([]))
      input.addEventListener('change', () => {
        void Promise.all([...(input.files ?? [])].map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }))).then(resolve)
      })
      input.click()
    })
}
platform.notifier = { notify: (message) => toast(message) }
// Un serveur d'IA simulé : il répond en citant le premier extrait transmis (aucune IA réelle).
platform.http = {
  request: async (request) => {
    if (!request.url.endsWith('/chat/completions')) return { status: 404, text: '' }
    const sent = JSON.parse(request.body ?? '{}') as { messages?: { content: string }[] }
    const question = (sent.messages?.at(-1)?.content ?? '').split('\n').filter(Boolean).at(-1) ?? ''
    const content = `Réponse de démonstration, sans IA réelle : le premier extrait transmis répond à « ${question.slice(0, 120)} » [1].`
    return { status: 200, text: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) }
  }
}
const views = new ViewsRegistry()
const settings: Record<string, Record<string, unknown>> = {
  ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false },
  ia: { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small-3.2', modeleEmbeddings: 'bge-m3', modeleReranking: 'bge-reranker-v2-m3', modelesServeur: ['bge-m3', 'bge-reranker-v2-m3', 'mistral-small-3.2', 'qwen2.5-vl-7b-instruct', 'olmocr-7b'] }
}
const day = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}
const utf8 = (text: string) => new TextEncoder().encode(text)

let mounted: ReturnType<typeof mountApp> | null = null
const commands = new Map<string, () => void | Promise<void>>()

async function start(): Promise<void> {
  const registry = new ModuleRegistry()
  for (const module of MODULES) registry.register(module)
  await registry.activateAll({
    disabled: [],
    entitlements: EVALUATION,
    onError: (module, error) => console.error(module.id, error),
    contextFor: (module): ModuleContext => ({
      moduleId: module.id,
      platform,
      i18n,
      settings: {
        get: () => settings[module.id] ?? {},
        save: async (values) => void (settings[module.id] = values),
        onChange: () => () => {}
      },
      commands: {
        register: (command) => void commands.set(`${module.id}-${command.id}`, command.run),
        run: async (id) => {
          await commands.get(`${module.id}-${id}`)?.()
          mounted?.refresh()
        }
      },
      views,
      showPage: (id) => mounted?.show(id),
      openWindow: () =>
        void openModuleWindow({
          ...dialogHost,
          module,
          settings: () => settings[module.id] ?? {},
          save: async (values) => void (settings[module.id] = values),
          runCommand: async (id) => {
            await commands.get(`${module.id}-${id}`)?.()
          },
          secrets: platform.secrets!,
          dialogs: windows
        })
    })
  })

  // Le dossier fictif : deux analyses, des pièces avec leurs dates, des exigences, un workflow.
  const services = { fs: platform.fs, t, root: "Appels d'offres", today: () => new Date().toISOString().slice(0, 10) }
  const station = await createAnalysis(services, 'Station sol de télémesure', { position: 'candidat', buyer: 'Agence spatiale', reference: 'AO-2026-118' })
  const imported = await importFiles(services, station, [
    { name: 'RC.md', bytes: utf8(`# Règlement de la consultation\n\nLa date limite de remise des offres est fixée au ${day(68)} à 12 h 00.\n\nLe délai de validité des offres est fixé à 120 jours.`) },
    { name: 'CCTP.md', bytes: utf8(`# CCTP\n\n| Identifiant | Exigence |\n|---|---|\n| EX-SOL-001 | Le titulaire doit fournir une antenne de 3,7 m. |\n\nLa livraison intervient sous 15 jours après la notification.`) },
    { name: 'CCAP.md', bytes: utf8('# CCAP\n\nPénalités : 500 € par jour de retard.') }
  ])
  const antennes = await createAnalysis(services, 'Maintenance des antennes', { position: 'emetteur', buyer: 'Centre spatial', reference: 'MA-07' })
  await importFiles(services, antennes, [
    { name: 'RC.md', bytes: utf8(`# RC\n\nLa date limite de remise des offres est fixée au ${day(5)}.`) },
    { name: 'Plan.png', bytes: new Uint8Array([137, 80, 78, 71]) }
  ])
  const store = requirementsAt(`${station.folder}/Exigences`)
  const text = (body: string) => ({ fr: { body, lang: 'fr', origin: 'human' as const, reviewed: true, by: '', at: '', fromRev: 1 } })
  await store.create({ id: 'EX-SOL-001', title: 'Antenne', text: text('Le titulaire doit fournir une antenne de 3,7 m de diamètre.'), verification: 'inspection' })
  await store.create({ id: 'EX-SOL-002', title: 'Réception', text: text('La station doit recevoir en bande S avec un débit de 2 Mbit/s.'), verification: 'test' })
  await store.create({ id: 'EX-SOL-003', title: 'Disponibilité', text: text('Le système sera disponible le cas échéant.') })
  // L'émetteur : deux exigences, et la réponse de deux candidats, pour la fiche d'un candidat.
  const maintenance = requirementsAt(`${antennes.folder}/Exigences`)
  await maintenance.create({ category: 'MA', title: 'Intervention', text: text('Le titulaire doit intervenir sur site sous 4 heures après un appel.'), verification: 'demonstration' })
  await maintenance.create({ category: 'MA', title: 'Pièces détachées', text: text('Le titulaire doit tenir un stock de pièces détachées pour chaque antenne.'), verification: 'inspection' })
  const respond = (candidate: string, name: string, body: string) =>
    importFiles(services, antennes, [{ name, bytes: utf8(body) }], async (request) => ({ places: Object.fromEntries(request.pending.map((piece) => [piece.path, 'reponse' as const])), candidate }))
  await respond('Acme Spatial', 'Mémoire technique.md', '# Mémoire technique\n\nNous intervenons sur site sous 4 heures après un appel, de jour comme de nuit.\n\nUn stock de pièces détachées est tenu pour chaque antenne, au centre de maintenance.')
  await respond('Orbital Services', 'Offre technique.md', '# Offre technique\n\nNotre équipe intervient dans la journée.')
  const library = requirementsAt('Exigences')
  await library.create({ category: 'SOL', title: 'Maintien en température', text: text('Le système doit maintenir la soute entre 5 °C et 30 °C.'), type: 'performance', status: 'approved', criticality: 'high', verification: 'test' })
  await library.create({ category: 'SOL', title: 'Disponibilité', text: text('La station doit être disponible 99,5 % du temps, mesuré sur chaque mois.'), type: 'performance', status: 'draft', criticality: 'high', verification: 'analysis' })
  await library.create({ category: 'SEC', title: 'Journalisation', text: text('Les accès seront journalisés si possible.'), type: 'security', status: 'draft', criticality: 'medium' })
  settings.workflows = {
    workflows: [{ id: 'wf-1', name: 'À l’import des pièces : relever le calendrier', enabled: true, mode: 'auto', trigger: { kind: 'ao.pieces-importees' }, conditions: [], actions: [{ kind: 'ao.calendrier', fields: { analyse: '{analyse}' } }], created: new Date().toISOString() }]
  }
  const stamp = new Date().toISOString().slice(0, 10)
  // Une question déjà posée au dossier de la station, pour sa page.
  const noteOf = (name: string) => imported.imported.find((piece) => piece.note.endsWith(`/${name}.md`))?.note.replace(/\.md$/, '') ?? name
  await platform.fs.writeText(
    `${station.folder}/Analyse/Questions/${stamp} Quelles pénalités en cas de retard.md`,
    [
      '---',
      'bp-type: ao-question',
      `analyse: "[[${station.note.replace(/\.md$/, '')}]]"`,
      `date: ${stamp}`,
      'mode: recherche',
      'sources: 2',
      '---',
      `# Question au dossier — ${station.name}`,
      '',
      '> [!question] Quelles pénalités en cas de retard de livraison ?',
      '> *Recherche dans les pièces — réponse de l’IA, à vérifier dans les pièces citées*',
      '',
      '## Réponse',
      '',
      `Le CCAP fixe les pénalités de retard à 500 € par jour de retard \\[[[${noteOf('CCAP')}|1]]\\]. Le règlement de la consultation n’en dit rien ; aucun plafond n’est indiqué dans les pièces transmises.`,
      '',
      '## Sources',
      '',
      `1. [[${noteOf('CCAP')}|CCAP]] — CCAP · Appel d’offres — *citée*`,
      '   > [!quote]- Extraits transmis (1)',
      '   > Pénalités : 500 € par jour de retard.',
      `2. [[${noteOf('RC')}|RC]] — RC · Appel d’offres — *transmise, non citée*`,
      '   > [!quote]- Extraits transmis (1)',
      '   > Le délai de validité des offres est fixé à 120 jours.',
      '',
      '## Notes',
      '',
      'À rapprocher du planning : la livraison intervient sous 15 jours après la notification.',
      ''
    ].join('\n')
  )
  await platform.fs.writeText(
    'Black Projects/Workflows/Journal des workflows.md',
    `<!-- bp:journal:debut -->\n- ${stamp} 09:12 · ✅ fait · **À l’import des pièces : relever le calendrier** · sur « Station sol de télémesure » — 1. Calendrier : 2 date(s), 1 délai(s) dans 3 pièce(s).\n- ${stamp} 08:30 · ❌ échec · **Questionnaire (IA)** · sur « Maintenance des antennes » — Étape 1 (Questionnaire du dossier) a échoué : serveur injoignable\n<!-- bp:journal:fin -->\n`
  )

  appearance = readAppearance({
    ...(JSON.parse(safeStorage('get') ?? '{}') as object),
    ...Object.fromEntries([...params.entries()].filter(([key]) => ['mode', 'vision', 'reading', 'size', 'motion'].includes(key)))
  })
  mounted = mountApp(document.getElementById('app')!, {
    t,
    locale: language === 'en' ? 'en-GB' : 'fr-FR',
    version: 'démonstration',
    sections: () => views.homeSections(),
    pages: () => views.pages(),
    tiles: () => views.allTiles(),
    homeTiles: () => {
      const stored = safeStorage('get', undefined, 'bp-demo-tiles')
      return stored ? (JSON.parse(stored) as string[]) : null
    },
    saveHomeTiles: async (ids) => void safeStorage(ids ? 'set' : 'remove', ids ? JSON.stringify(ids) : undefined, 'bp-demo-tiles'),
    dashboard: () => {
      try {
        return readDashboard(JSON.parse(safeStorage('get', undefined, 'bp-demo-dashboard') ?? 'null'))
      } catch {
        return null
      }
    },
    saveDashboard: async (layout) => void safeStorage(layout ? 'set' : 'remove', layout ? JSON.stringify(layout) : undefined, 'bp-demo-dashboard'),
    nav: () => views.navEntries(),
    navMenu: () => {
      try {
        return readNavMenu(JSON.parse(safeStorage('get', undefined, 'bp-demo-menu') ?? 'null'))
      } catch {
        return null
      }
    },
    saveNavMenu: async (layout) => void safeStorage(layout ? 'set' : 'remove', layout ? JSON.stringify(layout) : undefined, 'bp-demo-menu'),
    openSettings: () =>
      void windows.inform({ title: t('home.nav.settings'), message: t('demo.settings'), actions: [{ value: 'ok', label: t('ui.close'), cta: true }] }),
    appearance: () => appearance,
    saveAppearance: async (next) => {
      appearance = next
      safeStorage('set', JSON.stringify(next))
    },
    hostIsDark: () => dark.matches,
    onHostThemeChange: (listener) => {
      dark.addEventListener('change', listener)
      return () => dark.removeEventListener('change', listener)
    },
    now: () => new Date()
  }, params.get('page') === 'dashboard' ? 'dashboard' : 'home')
  document.documentElement.dataset.ready = 'true'
}

function safeStorage(action: 'get' | 'set' | 'remove', value?: string, key = 'bp-demo-appearance'): string | null {
  try {
    if (action === 'set') localStorage.setItem(key, value!)
    if (action === 'remove') localStorage.removeItem(key)
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function toast(message: string): void {
  const element = document.getElementById('toast')!
  element.textContent = message
  element.hidden = false
  window.clearTimeout(Number(element.dataset.timer))
  element.dataset.timer = String(window.setTimeout(() => (element.hidden = true), 4000))
}

void start()
