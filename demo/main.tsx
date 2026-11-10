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
import { DEFAULT_SETTINGS, readDashboard, readNavMenu, type CoreSettings } from '../src/core/settings'
import { modulePageOf, SETTINGS_PAGE, settingsPage } from '../src/core/settingsPage'
import { docModules, documentationPages } from '../src/core/docs'
import { DOCS_PAGE, docsPage } from '../src/core/docsPage'
import { createI18n } from '../src/core/i18n'
import { EVALUATION } from '../src/core/licence'
import type { ModuleContext } from '../src/core/modules/module'
import { ModuleRegistry } from '../src/core/modules/registry'
import { memoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry } from '../src/core/views'
import { MODULES } from '../src/modules'
import { createAnalysis, importFiles } from '../src/modules/ao'
import { addStarterEntries } from '../src/modules/bibliotheque'
import { requirementsAt } from '../src/modules/exigences'
import { pdfPageTexts } from '../src/modules/lecture-fichiers'
import { dialogWindows, mountApp, type DialogHost, type ModuleWindowHost } from '../src/ui'

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
// Les pages d'un PDF « dessinées » : sans pdf.js hors d'Obsidian, un aperçu de démonstration par page (son texte écrit sur une page blanche).
platform.pages = {
  open: async (bytes) => {
    const texts = await pdfPageTexts(bytes)
    return {
      pages: texts.length,
      page: async (number) => {
        const canvas = document.createElement('canvas')
        canvas.width = 700
        canvas.height = 990
        const context = canvas.getContext('2d')!
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#111111'
        context.font = '20px sans-serif'
        context.fillText(`Page ${number} — aperçu de démonstration`, 40, 50)
        ;(texts[number - 1] ?? '').split('\n').slice(0, 40).forEach((line, row) => context.fillText(line.slice(0, 70), 40, 100 + row * 24))
        return canvas.toDataURL('image/jpeg', 0.8)
      },
      close: async () => undefined
    }
  }
}
// Un serveur d'IA simulé : il répond en citant le premier extrait transmis (aucune IA réelle).
platform.http = {
  request: async (request) => {
    // « Tester la connexion » : la liste des modèles du serveur.
    if (request.url.endsWith('/models')) return { status: 200, text: JSON.stringify({ data: ['bge-m3', 'bge-reranker-v2-m3', 'mistral-small-3.2', 'qwen2.5-vl-7b-instruct', 'olmocr-7b'].map((id) => ({ id })) }) }
    if (!request.url.endsWith('/chat/completions')) return { status: 404, text: '' }
    const raw = JSON.parse(request.body ?? '{}') as {
      messages?: { content: string | { type: string; text?: string }[] }[]
      response_format?: { json_schema?: { schema?: { properties?: Record<string, { type?: string }> } } }
    }
    // Un message avec des images (la vision) : son texte seulement.
    const textOf = (content: string | { type: string; text?: string }[]) => (typeof content === 'string' ? content : content.map((part) => part.text ?? '').join('\n'))
    const sent = { ...raw, messages: raw.messages?.map((message) => ({ content: textOf(message.content) })) }
    const asked = (sent.messages ?? []).map((message) => message.content).join('\n')
    const question = (sent.messages?.at(-1)?.content ?? '').split('\n').filter(Boolean).at(-1) ?? ''
    // Traduire une exigence : le texte repris tel quel (les chiffres ne bougent pas), et une note.
    // Relire une exigence : un avis, des constats, des propositions, en JSON comme le ferait le serveur.
    // Relire un texte extrait : sans IA réelle, des corrections de démonstration — mots recollés, puces en liste, premier titre.
    const proofreading = (sent.messages?.[0]?.content ?? '').includes('Tu relis un texte extrait automatiquement')
    const proofread = (text: string) => {
      const lines = text
        .replace(/(\p{L})- (\p{L})/gu, '$1$2')
        .replace(/ {2,}/g, ' ')
        .split('\n')
        .map((line) => line.replace(/^\s*[•▪]\s*/, '- '))
      if (lines[0] && !lines[0].startsWith('#') && !lines[0].startsWith('(')) lines[0] = `# ${lines[0]}`
      return lines.join('\n')
    }
    // Lire une page avec la vision : sans IA réelle, le texte extrait de la page corrigé, ou un texte de démonstration (un scan).
    const opening = sent.messages?.[0]?.content ?? ''
    // La vérification d'une page (ou d'une partie relue) : une note de démonstration, en JSON comme un vrai modèle.
    const verifying = opening.includes('Tu vérifies la transcription') || opening.startsWith('Tu compares un texte extrait')
    // L'OCR d'une page scannée : son texte brut, de démonstration.
    const ocr = opening.includes('Lis-en TOUT le texte')
    const seeing = !verifying && !ocr && opening.includes('Voici la page')
    const pageText = (sent.messages?.at(-1)?.content ?? '').split('d’après l’image :\n\n')[1]
    // Une page regardée prend un peu de temps, comme avec un vrai modèle : on voit la lecture avancer.
    if (seeing) await new Promise((resolve) => setTimeout(resolve, 250))
    const content = verifying
      ? JSON.stringify({ score: 92, problems: [] })
      : ocr
      ? 'PROCES-VERBAL DE RECEPTION\nLecture de demonstration par l OCR, sans IA reelle.'
      : seeing
      ? pageText
        ? proofread(pageText)
        : '# Procès-verbal de réception\n\nLecture de démonstration par la vision, sans IA réelle : le texte de la page aurait été lu dans l’image.\n\n| Lot | Réserves |\n| --- | --- |\n| Lot 1 | Aucune |'
      : proofreading
      ? proofread(sent.messages?.at(-1)?.content ?? '')
      : asked.includes('You translate requirements')
      ? JSON.stringify({ text: `[EN] ${sent.messages?.at(-1)?.content.trim() ?? ''}`, notes: 'Traduction de démonstration, sans IA réelle : le texte source est repris tel quel.' })
      : asked.includes('"assessment"')
        ? JSON.stringify({
            assessment: 'Relecture de démonstration, sans IA réelle : la formulation laisse au titulaire une marge d’appréciation ; le seuil attendu n’est pas dit.',
            findings: [],
            proposals: [{ axis: 'verifiable', action: 'Dire le seuil attendu et comment il sera mesuré.', rewrite: '' }]
          })
        : asked.includes('"findings"')
          ? JSON.stringify({ findings: [] })
          : sent.response_format?.json_schema?.schema?.properties
            ? // Une réponse imposée (identifier un titre, un émetteur, une date…) : sans IA réelle, « pas sûr ».
              JSON.stringify(
                Object.fromEntries(
                  Object.entries(sent.response_format.json_schema.schema.properties).map(([key, spec]) => [key, spec.type === 'boolean' ? false : spec.type === 'array' ? [] : ''])
                )
              )
            : `Réponse de démonstration, sans IA réelle : le premier extrait transmis répond à « ${question.slice(0, 120)} » [1].`
    return { status: 200, text: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) }
  }
}
const views = new ViewsRegistry()
const settings: Record<string, Record<string, unknown>> = {
  ao: { dossier: "Appels d'offres", accueilVu: true, rappelOuverture: false },
  ia: { adresse: 'https://ia.exemple.fr/v1', modele: 'mistral-small-3.2', modeleEmbeddings: 'bge-m3', modeleReranking: 'bge-reranker-v2-m3', modeleVision: 'qwen2.5-vl-7b-instruct', modeleOcr: 'olmocr-7b', modelesServeur: ['bge-m3', 'bge-reranker-v2-m3', 'mistral-small-3.2', 'qwen2.5-vl-7b-instruct', 'olmocr-7b'] }
}
const day = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}
const utf8 = (text: string) => new TextEncoder().encode(text)

let mounted: ReturnType<typeof mountApp> | null = null
// Un module dit que ses pages ont changé (une lecture par l'IA avance) : redessinées.
views.onChanged(() => mounted?.refresh())
const commands = new Map<string, () => void | Promise<void>>()

/** Les réglages du cœur, le temps de la visite : la démonstration n'a pas de coffre où les garder. */
let core: CoreSettings = { ...DEFAULT_SETTINGS }
/** La page « Fonctions » d'un module : ce que reçoit sa fenêtre. */
let moduleWindowOf: (id: string) => ModuleWindowHost | null = () => null

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
      showNote: async (path) => {
        const page = await views.pageForNote(path)
        if (page) mounted?.show(page)
        else await platform.ui.openNote(path)
      },
      // « Régler », « Formats de fichiers »… : la page « Fonctions » du module, dans l'onglet.
      openWindow: () => mounted?.show(modulePageOf(module.id))
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
  const disponibilite = await library.create({ category: 'SOL', title: 'Disponibilité', text: text('La station doit être disponible 99,5 % du temps, mesuré sur chaque mois.'), type: 'performance', status: 'draft', criticality: 'high', verification: 'analysis' })
  // Des liens, pour la fiche : la disponibilité découle du maintien en température, et un ticket la satisfait.
  if (disponibilite.filePath) await library.save(disponibilite.filePath, (current) => ({ ...current, links: [{ kind: 'derives-from', to: 'REQ-SOL-0001' }, { kind: 'satisfied-by', to: 'TICKET-128' }] }))
  await library.create({ category: 'SEC', title: 'Journalisation', text: text('Les accès seront journalisés si possible.'), type: 'security', status: 'draft', criticality: 'medium' })
  // Les bibliothèques de prompts et de personas : leurs exemples, pour la visite.
  await addStarterEntries('prompt', 'fr')
  await addStarterEntries('persona', 'fr')
  // Un workflow de l'utilisateur, à côté des workflows système créés à l'activation.
  settings.workflows = {
    ...settings.workflows,
    workflows: [...((settings.workflows?.workflows as unknown[] | undefined) ?? []), { id: 'wf-1', name: 'Prévenir à chaque analyse créée', enabled: true, mode: 'auto', trigger: { kind: 'ao.analyse-creee' }, conditions: [], actions: [{ kind: 'notifier', fields: { message: 'Nouvelle analyse : {analyse}' } }], created: new Date().toISOString() }]
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
    `<!-- bp:journal:debut -->\n- ${stamp} 09:12 · ✅ fait · **À l’import des pièces : relever le calendrier** · sur « Station sol de télémesure » ([[${station.note.replace(/\.md$/, '')}]]) — 1. Calendrier : 2 date(s), 1 délai(s) dans 3 pièce(s). · [[${station.folder}/Analyse/Calendrier]]\n- ${stamp} 08:30 · ❌ échec · **Questionnaire (IA)** · sur « Maintenance des antennes » — Étape 1 (Questionnaire du dossier) a échoué : serveur injoignable\n<!-- bp:journal:fin -->\n`
  )

  // Les paramètres, en page comme dans Obsidian ; gardés le temps de la visite.
  const windowOf = (module: ModuleWindowHost['module']): ModuleWindowHost => ({
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
  moduleWindowOf = (id) => {
    const module = registry.status(id)?.module
    return module ? windowOf(module) : null
  }
  // La documentation, à lire dans l'onglet comme dans Obsidian.
  views.page({
    id: DOCS_PAGE,
    title: t('docs.page.title'),
    icon: 'book',
    load: (param) =>
      docsPage(
        {
          t,
          version: 'démonstration',
          folder: () => core.docsFolder,
          pages: () =>
            documentationPages({
              version: 'démonstration',
              folder: core.docsFolder,
              modules: docModules(registry.list(), { version: 'démonstration', folder: core.docsFolder, t, settingsFor: (id) => settings[id] ?? {} })
            }),
          exists: (path) => platform.fs.exists(path),
          write: async () => toast(t('demo.docs')),
          openNote: (path) => platform.ui.openNote(path),
          showPage: (id) => mounted?.show(id)
        },
        param
      )
  })
  views.page({
    id: SETTINGS_PAGE,
    title: t('home.nav.settings'),
    icon: 'settings',
    load: async () =>
      settingsPage({
        t,
        version: 'démo',
        config: () => ({ ...core, language, appearance }),
        save: async (next) => void (core = next),
        saveAppearance: async (next) => {
          appearance = next
          safeStorage('set', JSON.stringify(next))
          mounted?.refresh()
        },
        modules: () => registry.list(),
        moduleSettings: (id) => settings[id] ?? {},
        openModule: async (module) => mounted?.show(modulePageOf(module.id)),
        createDocumentation: async () => toast(t('demo.docs')),
        readDocumentation: () => mounted?.show(DOCS_PAGE),
        licence: () => t('settings.licence.evaluation'),
        ui: platform.ui,
        notify: (message) => toast(message)
      })
  })

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
    openSettings: () => mounted?.show(SETTINGS_PAGE),
    settingsPage: SETTINGS_PAGE,
    moduleWindow: (id) => moduleWindowOf(id),
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
