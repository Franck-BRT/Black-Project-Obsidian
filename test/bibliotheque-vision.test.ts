// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La **relecture avec la vision** : sur la fiche, « Relire avec l'IA » fait choisir le modèle —
 * simple (le texte extrait) ou avec la vision (les pages en images, comparées au texte de
 * chacune), quand le fichier se montre en images (un PDF que la plateforme dessine, une
 * image). Un document **sans texte** (un scan, une image) ne propose que « Lire avec la
 * vision (IA) » : le modèle lit ses pages ; son texte devient une version du texte.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import type { ModuleContext } from '../src/core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../src/core/testing/memoryPlatform'
import { ViewsRegistry, type HomeBlock, type ListItem, type ViewAction } from '../src/core/views'
import { aiReadingNow, bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { forgetImageRefusals, iaModule, readVisionPage, repetitionLoop } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small', modeleVision: 'pixtral-12b' }
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown, finish = 'stop') => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: finish }] }) })

/** Un PDF de texte, une page par liste de lignes (Helvetica, sans compression). */
function textPdf(pages: string[][]): Uint8Array {
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, at) => `${4 + at * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']
  for (const [at, lines] of pages.entries()) {
    const body = lines.map((line, row) => `BT /F1 12 Tf 72 ${720 - row * 18} Td (${line}) Tj ET`).join('\n')
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + at * 2} 0 R >>`)
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`)
  }
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const [at, object] of objects.entries()) {
    offsets.push(out.length)
    out += `${at + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(out)
}

interface Seen {
  model: string
  text: string
  image: string
}

let drawnPages = 2
/** Ce que rend la vérification d'une page (sinon : 95, rien à redire) ; `reading` : la transcription vérifiée. */
let verdictOf: ((reading: string, image: string) => { score: number; problems: string[] }) | null = null
/** Les vérifications demandées (la transcription vérifiée, chaque fois). */
let verified: string[] = []
/** La suite d'une page coupée ; les débuts continués. */
let continueWith: string | null = null
/** Attendu avant de rendre une lecture de page : ce que la fiche montre pendant la lecture. */
let visionGate: ((one: Seen) => Promise<void>) | null = null
let continued: string[] = []
/** Ce que répond la relecture du texte (sinon : le texte tel quel) ; `system` : sa consigne. */
let proofreadReply: ((text: string, system: string) => string | { text: string; finish: string }) | null = null
let closed = 0

async function start(platform: MemoryPlatform, see: (seen: Seen) => string | { text: string; finish: string }, drawsPdf = true, ia: Record<string, unknown> = SERVEUR, gate: () => Promise<void> = async () => {}, refuses: (model: string) => boolean = () => false) {
  const i18n = createI18n('fr')
  for (const module of ALL) i18n.register('fr', module.texts.fr)
  if (drawsPdf) platform.pages = { open: async () => ({ pages: drawnPages, page: async (number) => `data:image/jpeg;base64,${btoa(`P${number}`)}`, close: async () => void closed++ }) }
  const settings: Record<string, Record<string, unknown>> = { ia }
  const views = new ViewsRegistry()
  for (const module of ALL) {
    const context: ModuleContext = {
      moduleId: module.id,
      platform,
      i18n,
      settings: { get: () => settings[module.id] ?? {}, save: async (values) => void (settings[module.id] = values), onChange: () => () => {} },
      commands: { register: () => {} },
      views,
      showPage: () => {}
    }
    await module.activate(context)
  }
  const original = platform.http.request.bind(platform.http)
  const seen: Seen[] = []
  const proofread: string[] = []
  platform.http.request = async (request) => {
    if (!request.url.endsWith('/chat/completions')) return original(request)
    const body = JSON.parse(request.body!) as { model: string; messages: { content: string | { type: string; text?: string; image_url?: { url: string } }[] }[] }
    const first = body.messages[0]!.content
    // Une image : un seul message (la consigne, puis l'image), sans message système.
    if (typeof first !== 'string') {
      // La suite d'une page coupée par la limite de longueur : la demande, la réponse, « Continue ».
      if (body.messages.length === 3) {
        expect(body.messages[2]!.content).toBe('Continue la transcription exactement là où elle s’est arrêtée, sans rien répéter ni commenter.')
        continued.push(body.messages[1]!.content as string)
        return chat(continueWith ?? '')
      }
      expect(body.messages).toHaveLength(1)
      const one: Seen = { model: body.model, text: first.find((part) => part.type === 'text')!.text!, image: first.find((part) => part.type === 'image_url')!.image_url!.url }
      // La vérification d'une page : la page en image, sa transcription ; une note en JSON.
      if (one.text.includes('Tu vérifies la transcription')) {
        const reading = one.text.slice(one.text.indexOf('La transcription :') + 'La transcription :'.length).trim()
        verified.push(reading)
        return chat(verdictOf?.(reading, one.image) ?? { score: 95, problems: [] })
      }
      expect(one.text).toMatch(/Voici la page \d+ sur \d+ d’un document/)
      if (refuses(body.model)) return { status: 400, text: JSON.stringify({ error: { message: `litellm.BadRequestError: OpenAIException - Error code: 400 - {'detail': {'error': {'message': '${body.model} is not a multimodal model'}}}` } }) }
      seen.push(one)
      await visionGate?.(one)
      const answer = see(one)
      return typeof answer === 'string' ? chat(answer) : chat(answer.text, answer.finish)
    }
    const system = first
    if (system.startsWith('Tu identifies la langue')) return chat('fr')
    if (system.startsWith('Tu compares un texte extrait')) return chat({ score: 92, problems: [] })
    if (system.includes('Tu relis un texte extrait automatiquement')) {
      proofread.push(body.model)
      await gate()
      const reply = proofreadReply?.(body.messages.at(-1)!.content as string, system)
      if (reply !== undefined) return typeof reply === 'string' ? chat(reply) : chat(reply.text, reply.finish)
      return chat(body.messages.at(-1)!.content as string)
    }
    return chat({ title: '', issuer: '', category: '', date: '', tags: [], reference: '', edition: '', revision: '', certain: false })
  }
  const page = (id: string) => views.pages().find((each) => each.id === id)!
  const pour = async (name: string, bytes: Uint8Array) => (await pourIntoLibrary([{ name, bytes }], { module: 'bibliotheque', label: '' }))!.added[0]!
  const workflows = () => (settings.workflows?.workflows ?? []) as Workflow[]
  const textActions = async (record: string): Promise<ViewAction[]> => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(record))
    const texte = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.texte')
    const message = texte!.blocks[0]!
    return message.kind === 'message' ? (message.actions ?? []) : []
  }
  const textVersions = async (record: string): Promise<ListItem[]> => {
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(record))
    const versions = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.versions')
    const list = versions?.blocks.find((block) => block.kind === 'list' && block.title === 'Versions du texte')
    return list?.kind === 'list' ? list.items : []
  }
  return { pour, seen, proofread, workflows, textActions, textVersions, page }
}

afterEach(async () => {
  forgetImageRefusals()
  proofreadReply = null
  verdictOf = null
  verified = []
  continueWith = null
  visionGate = null
  continued = []
  for (const module of [...ALL].reverse()) await module.deactivate?.()
})

describe('ce que lit la vision', () => {
  it('une réponse sans ses clôtures ; bien plus courte que le texte extrait de la page : écartée', () => {
    expect(readVisionPage('```markdown\n# Plan\n```', '')).toBe('# Plan')
    expect(readVisionPage('', 'texte')).toBeNull()
    expect(readVisionPage('Plan.', 'Le présent plan décrit l’organisation qualité du projet.')).toBeNull()
    expect(readVisionPage('Le présent plan décrit l’organisation.', 'Le pré- sent plan dé crit l’orga nisation.')).toBe('Le présent plan décrit l’organisation.')
  })
})

/** La sortie de l'exemple : une ligne lue, puis la même phrase, en boucle, jusqu'à la limite. */
const LOOP = `## Mesures\n\nRésistance de terre ≤ 100 Ω des prises de courant ${'≤ 100 Ω des prises de courant '.repeat(300)}≤ 100 Ω des pri`

describe('la lecture d’un document par l’IA, de bout en bout', () => {
  /** Une page de cahier des charges : un en-tête et un pied répétés, du texte entre les deux. */
  const sheet = (number: number, lines: string[]) => ['Societe X - CCTP station sol', ...lines, 'Confidentiel - reproduction interdite', `Page ${number} sur 3`]

  it('au dépôt, un PDF avec du texte : la vision d’origine (« automatique ») — le texte de chaque page donné à vérifier, la page vérifiée, la qualité notée (★ et %) sur la version et la fiche', async () => {
    const platform = memoryPlatform()
    const { pour, seen, proofread, textVersions } = await start(platform, (one) => (one.text.includes('page 1 sur') ? '# Plan qualité\n\nLe présent plan décrit l’organisation.' : '## Revue\n\nRevue de conception.'))
    const doc = await pour('Plan.pdf', textPdf([['Plan qualite', 'Le pre- sent plan decrit l organisation.'], ['Revue de con- ception.']]))
    expect(proofread).toEqual([])
    expect(seen).toHaveLength(2)
    expect(seen[0]!.text).toContain('À la place de chaque image, photo, schéma, graphique ou logo, écris une courte description entre crochets')
    expect(seen[0]!.text).toContain('Le texte que le fichier porte pour cette page (copié tel quel')
    expect(verified).toEqual(['# Plan qualité\n\nLe présent plan décrit l’organisation.', '## Revue\n\nRevue de conception.'])
    const [version] = await textVersions(doc.record)
    expect(version!.title).toBe('Texte 2 — lu par l’IA avec la vision')
    expect(version!.detail).toContain('qualité ★★★★★ 95 %')
    const note = read(platform, doc.record)
    expect(note).toContain('Qualité de la transcription : ★★★★★ 95 %.')
    expect(platform.notices).toContain('Qualité de la transcription : ★★★★★ 95 %.')
  })

  it('une page coupée par la limite de longueur : continuée là où elle s’arrête ; les en-têtes, pieds de page et numéros de page retirés ; les lignes coupées recollées', async () => {
    const platform = memoryPlatform()
    drawnPages = 3
    try {
      continueWith = 'nue en usine.\n\nConfidentiel - reproduction interdite\nPage 2 sur 3'
      const { pour, textVersions } = await start(platform, (one) => {
        const page = Number(/page (\d) sur/.exec(one.text)![1])
        if (page === 2) return { text: sheet(2, ['## 2. Exigences', '', 'La station est mainte']).join('\n').replace(/\nConfidentiel[\s\S]*$/, ''), finish: 'length' }
        return sheet(page, [page === 1 ? '# CCTP' : '## 3. Essais', '', page === 1 ? 'Le présent document décrit la station' : 'Les essais se font', page === 1 ? 'sol et ses moyens.' : 'sur site.']).join('\n')
      })
      const doc = await pour('CCTP.pdf', textPdf([[], [], []]))
      expect(continued).toEqual(['Societe X - CCTP station sol\n## 2. Exigences\n\nLa station est mainte'])
      const text = (await textVersions(doc.record)).length ? read(platform, doc.record) : ''
      expect(text).toContain('La station est maintenue en usine.')
      expect(text).toContain('Le présent document décrit la station sol et ses moyens.')
      expect(text).toContain('Les essais se font sur site.')
      expect(text).not.toMatch(/Confidentiel|Page \d sur 3|Societe X/)
    } finally {
      drawnPages = 2
    }
  })

  it('une page vérifiée sous 85 : corrigée d’après l’image (ce qui n’allait pas dit au modèle), revérifiée — la meilleure gardée, sa note comptée', async () => {
    const platform = memoryPlatform()
    drawnPages = 1
    try {
      verdictOf = (reading) => (reading.includes('2025') ? { score: 60, problems: ['« 2025 » : l’image dit 2026'] } : { score: 90, problems: [] })
      const { pour, seen, textVersions } = await start(platform, (one) => (one.text.includes('une vérification a trouvé ces problèmes') ? 'Réception le 12 mars 2026.' : 'Réception le 12 mars 2025.'))
      const doc = await pour('PV.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
      expect(seen).toHaveLength(2)
      expect(seen[1]!.text).toContain('- « 2025 » : l’image dit 2026')
      expect(seen[1]!.text).toContain('La transcription :\n\nRéception le 12 mars 2025.')
      expect(read(platform, doc.record)).toContain('Réception le 12 mars 2026.')
      expect((await textVersions(doc.record))[0]!.detail).toContain('qualité ★★★★★ 90 %')
    } finally {
      drawnPages = 2
    }
  })

  it('une lecture qui a perdu plus de 30 % du texte du fichier : relue avec insistance ; encore courte, complétée du texte du fichier, dit tel', async () => {
    const platform = memoryPlatform()
    drawnPages = 1
    try {
      const line = 'Le titulaire fournit le dossier des ouvrages executes avec les plans'
      const layer = [line, line.replace('plans', 'notes de calcul'), line.replace('plans', 'proces verbaux'), line.replace('plans', 'fiches techniques'), line.replace('plans', 'certificats')]
      const short = layer.slice(0, 3).join(' ')
      const { pour, seen } = await start(platform, () => short)
      const doc = await pour('Clauses.pdf', textPdf([layer]))
      expect(seen).toHaveLength(2)
      expect(seen[1]!.text).toContain('Une première transcription de cette page était incomplète')
      const note = read(platform, doc.record)
      expect(note).toContain('[Page 1 : la lecture semblait incomplète ; voici le texte que porte le fichier lui-même pour cette page.]')
      expect(note).toContain('certificats')
    } finally {
      drawnPages = 2
    }
  })

  it('un scan, un modèle d’OCR réglé à part : la page lue d’abord par l’OCR, son texte donné à la vision pour vérification', async () => {
    const platform = memoryPlatform()
    drawnPages = 1
    try {
      const { pour, seen } = await start(platform, (one) => (one.model === 'ocr-1' ? 'PROCES VERBAL DE RECEPTION\nReception prononcee le 12 mars 2026 sans reserve par le maitre d ouvrage.' : '# Procès-verbal de réception\n\nRéception prononcée le 12 mars 2026, sans réserve.'), true, { ...SERVEUR, modeleOcr: 'ocr-1' })
      const doc = await pour('Scan.pdf', textPdf([[]]))
      expect(seen.map((one) => one.model)).toEqual(['ocr-1', 'pixtral-12b'])
      expect(seen[0]!.text).toContain('Lis-en TOUT le texte, tel quel')
      expect(seen[1]!.text).toContain('Le texte que l’OCR a lu sur cette page')
      expect(seen[1]!.text).toContain('PROCES VERBAL DE RECEPTION')
      expect(read(platform, doc.record)).toContain('Réception prononcée le 12 mars 2026, sans réserve.')
    } finally {
      drawnPages = 2
    }
  })

  it('sans images : le texte relu partie par partie, chaque partie vérifiée contre l’original ; la qualité notée', async () => {
    const platform = memoryPlatform()
    const { pour, textVersions } = await start(platform, () => 'x', false)
    proofreadReply = (text) => `${text}\n\nRelu.`
    const doc = await pour('Plan.pdf', textPdf([['Plan qualite', 'Le pre- sent plan']]))
    expect((await textVersions(doc.record))[0]!.detail).toContain('qualité ★★★★★ 92 %')
  })
})

describe('pendant la lecture', () => {
  it('la section « Texte extrait » s’ouvre et dit où en est l’IA (étape, page, %) ; le texte lu jusqu’ici s’y affiche, provisoire ; à la fin, le texte lu', async () => {
    const platform = memoryPlatform()
    const shown: { subtitle?: string; collapsed?: boolean; texts: string[]; titles: string[] }[] = []
    const { pour, page } = await start(platform, (one) => (one.text.includes('page 1 sur') ? '# Procès-verbal\n\nPage un lue.' : 'Page deux lue.'))
    visionGate = async (one) => {
      if (!one.text.includes('page 2 sur')) return
      // La page 2 en cours : la fiche, à cet instant.
      const fiche = await page('bibliotheque.document').load(encodeURIComponent(aiReadingNow().running!.record))
      const section = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.texte')!
      shown.push({
        ...(section.subtitle !== undefined ? { subtitle: section.subtitle } : {}),
        ...(section.collapsed !== undefined ? { collapsed: section.collapsed } : {}),
        texts: section.blocks.map((block) => (block.kind === 'message' ? block.text : block.kind === 'markdown' ? block.text : '')),
        titles: section.blocks.map((block) => (block.kind === 'markdown' ? (block.title ?? '') : ''))
      })
    }
    const doc = await pour('Scan.pdf', textPdf([[], []]))
    expect(shown).toHaveLength(1)
    expect(shown[0]!.subtitle).toBe('L’IA lit ce document — lecture par la vision — page 2 sur 2 (50 %)')
    expect(shown[0]!.collapsed).toBe(false)
    expect(shown[0]!.texts.some((text) => text.startsWith('L’IA lit ce document — lecture par la vision — page 2 sur 2. 1 sur 2 lu(s) (50 %).'))).toBe(true)
    expect(shown[0]!.titles).toContain('Lu jusqu’ici (1 sur 2) — provisoire : il sera nettoyé et vérifié à la fin')
    expect(shown[0]!.texts).toContain('# Procès-verbal\n\nPage un lue.')
    // Fini : plus d'état de lecture ; le texte lu, la section repliée.
    const fiche = await page('bibliotheque.document').load(encodeURIComponent(doc.record))
    const section = fiche.blocks.find((block): block is Extract<HomeBlock, { kind: 'section' }> => block.kind === 'section' && block.id === 'bibliotheque.document.texte')!
    expect(section.collapsed).toBe(true)
    expect(section.subtitle).toMatch(/^Texte 1 — lu par l’IA avec la vision/)
    expect(aiReadingNow().running).toBeNull()
  })
})

describe('une lecture qui boucle', () => {
  it('repérée : le même passage répété jusqu’à la fin — où elle commence, ce qui se garde ; une réponse saine, des tableaux, des points de conduite, non', () => {
    const loop = repetitionLoop(LOOP, true)!
    expect(loop).toMatchObject({ start: 31, unit: '≤ 100 Ω des prises de courant', times: 301 })
    expect(LOOP.slice(0, loop.keep)).toBe('## Mesures\n\nRésistance de terre ≤ 100 Ω des prises de courant')
    // Sans « coupée par la limite » aussi, tant la boucle est longue ; des espaces qui changent n'y font rien.
    expect(repetitionLoop(LOOP.replace(/courant /g, (_, at: number) => (at % 3 ? 'courant\n' : 'courant  ')))).not.toBeNull()
    // Une page normale, un tableau aux lignes vides, des points de conduite, un formulaire répétitif court : non.
    expect(repetitionLoop('# Plan\n\n' + 'Le présent plan décrit l’organisation qualité du projet. '.repeat(3))).toBeNull()
    expect(repetitionLoop(`| Lot | Prix |\n|---|---|\n${'|  |  |\n'.repeat(200)}`, true)).toBeNull()
    expect(repetitionLoop(`Sommaire ${'.'.repeat(2000)} 3`, true)).toBeNull()
    expect(repetitionLoop(`| Question | Réponse |\n|---|---|\n${'| Conforme ? | ☐ Oui ☐ Non |\n'.repeat(6)}`)).toBeNull()
    // Coupée par la limite, une boucle plus courte suffit : 4 fois, 200 caractères.
    const short = `Texte. ${'Le titulaire fournit le dossier des ouvrages exécutés. '.repeat(5)}`
    expect(repetitionLoop(short)).toBeNull()
    expect(repetitionLoop(short, true)).not.toBeNull()
  })

  it('une page qui boucle : relue une deuxième fois (autrement : la consigne le dit, un peu de hasard) — bonne, elle est gardée', async () => {
    const platform = memoryPlatform()
    let calls = 0
    const { pour, seen, textVersions } = await start(platform, () => (++calls === 1 ? { text: LOOP, finish: 'length' } : '## Mesures\n\nRésistance de terre ≤ 100 Ω des prises de courant.'))
    const doc = await pour('Scan PV.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    expect(seen).toHaveLength(2)
    expect(seen[0]!.text).not.toContain('une première lecture a bouclé')
    expect(seen[1]!.text).toContain('une première lecture a bouclé')
    expect(platform.notices).toContain('« Scan PV » : la lecture de la page 1 a bouclé (le modèle répétait le même passage) — relancée une deuxième fois.')
    expect((await textVersions(doc.record)).map((item) => item.title)).toEqual(['Texte 1 — lu par l’IA avec la vision'])
    const note = read(platform, doc.record)
    expect(note).toContain('Résistance de terre ≤ 100 Ω des prises de courant.')
    expect(note).not.toContain('courant ≤ 100 Ω')
    expect(platform.notices.some((notice) => notice.includes('mal lue'))).toBe(false)
  })

  it('bouclée deux fois : ce qui précède la boucle est gardé, la page marquée dans le texte ; un message le dit', async () => {
    const platform = memoryPlatform()
    const { pour, seen } = await start(platform, (one) => (one.image.endsWith('UDE=') ? 'Page un, bien lue.' : { text: LOOP, finish: 'length' }))
    const doc = await pour('Scan.pdf', textPdf([[], []]))
    expect(seen).toHaveLength(3)
    const note = read(platform, doc.record)
    expect(note).toContain('Page un, bien lue.\n\n#### Mesures\n\nRésistance de terre ≤ 100 Ω des prises de courant\n\n*Page 2 : la lecture par l’IA a bouclé deux fois — le texte s’arrête là où la répétition commençait ; la suite de la page manque.*')
    expect(note).not.toContain('courant ≤ 100 Ω')
    const said = '« Scan » : 1 page(s) sur 2 mal lue(s) — le modèle (pixtral-12b) a bouclé, même relancé ; elles sont marquées dans le texte. Relancez la lecture, ou réglez un autre modèle de vision.'
    expect(platform.notices).toContain(said)
  })

  it('rien que des boucles, rien à garder : une erreur, le texte de la fiche ne change pas', async () => {
    const platform = memoryPlatform()
    const { pour, seen, textVersions } = await start(platform, () => ({ text: '≤ 100 Ω des prises de courant '.repeat(300), finish: 'length' }))
    const doc = await pour('Scan PV.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    expect(seen).toHaveLength(2)
    expect(await textVersions(doc.record)).toEqual([])
    expect(read(platform, doc.record)).not.toContain('prises de courant')
    expect(platform.notices.some((notice) => notice.includes('la lecture par l’IA a échoué — le modèle (pixtral-12b) a bouclé sur chaque page, même relancé'))).toBe(true)
  })
})

describe('une relecture du texte qui boucle', () => {
  it('relancée une deuxième fois (la consigne le dit) : bonne, elle fait la version ; bouclée encore partout : une erreur, pas de version', async () => {
    const platform = memoryPlatform()
    const asked: string[] = []
    proofreadReply = (text, system) => {
      asked.push(system)
      return system.includes('une première lecture a bouclé') ? `${text}\n\nRelu.` : { text: `${text} ${'≤ 100 Ω des prises de courant '.repeat(200)}`, finish: 'length' }
    }
    // Une plateforme qui ne dessine pas les PDF : la relecture du texte, sans images.
    const { pour, textVersions, textActions } = await start(platform, () => 'x', false)
    const doc = await pour('Plan.pdf', textPdf([['Plan qualite', 'Le pre- sent plan'], ['Revue de con- ception']]))
    expect(asked).toHaveLength(2)
    expect(platform.notices).toContain('« Plan » : la relecture de la partie 1 a bouclé (le modèle répétait le même passage) — relancée une deuxième fois.')
    expect((await textVersions(doc.record)).map((item) => item.title)).toEqual(['Texte 2 — relu par l’IA', 'Texte 1 — extrait du fichier'])
    expect(read(platform, doc.record)).not.toContain('courant ≤ 100 Ω')
    // Toujours en boucle : la partie gardée telle quelle, une erreur, pas de nouvelle version.
    proofreadReply = (text) => ({ text: `${text} ${'≤ 100 Ω des prises de courant '.repeat(200)}`, finish: 'length' })
    platform.choices.push('texte')
    await (await textActions(doc.record)).find((action) => action.id === 'proofread')!.run()
    expect(platform.notices.some((notice) => notice.includes('« Plan » : la relecture par l’IA a échoué — le modèle (mistral-small) a bouclé sur chaque partie, même relancé.'))).toBe(true)
    expect(await textVersions(doc.record)).toHaveLength(2)
  })
})

describe('un document sans texte : la vision seule', () => {
  it('un scan versé (une image) : lu aussitôt par le modèle d’OCR (ou de vision), son workflow système ; texte 1, la fiche le montre', async () => {
    const platform = memoryPlatform()
    const { pour, seen, textActions, textVersions, workflows } = await start(platform, () => '# Procès-verbal\n\nRéception prononcée le 12 mars 2026.')
    expect(workflows().find((each) => each.system === 'sys.ia.lire-scans')).toMatchObject({
      enabled: true,
      name: 'Lire avec la vision un document versé sans texte (un scan, une image)',
      trigger: { kind: 'bibliotheque.document-verse' },
      conditions: [{ field: 'scan', op: 'not-empty', value: '' }],
      actions: [{ kind: 'ia.relire-texte', fields: { fiche: '{fiche}', mode: 'vision' } }]
    })
    const doc = await pour('Scan PV.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    expect(seen).toHaveLength(1)
    expect(seen[0]!.model).toBe('pixtral-12b')
    expect(seen[0]!.image).toMatch(/^data:image\/png;base64,/)
    expect(seen[0]!.text).toContain('Le fichier ne porte pas de texte pour cette page : lis-le sur l’image.')
    expect((await textVersions(doc.record)).map((item) => item.title)).toEqual(['Texte 1 — lu par l’IA avec la vision'])
    const note = read(platform, doc.record)
    expect(note).toMatch(/\nlecture: lue\n/)
    expect(note).toContain('> [!info] Texte 1, lu par l’IA avec la vision (1 page(s) regardée(s)) :')
    expect(note).not.toContain('Les versions d’avant sont gardées')
    expect(note).toContain('Réception prononcée le 12 mars 2026.')
    expect(platform.notices).toContain('« Scan PV » : lu par l’IA avec la vision — texte 1 (1 page(s)).')
    // Lu : la fiche propose de le relire (le texte), plus de le lire.
    expect((await textActions(doc.record)).map((action) => action.id)).toEqual(['extract', 'proofread', 'text-note'])
  })

  it('son workflow désactivé : rien au dépôt ; la fiche propose seulement « Lire avec la vision (IA) », sans question', async () => {
    const platform = memoryPlatform()
    const { pour, seen, textActions, textVersions, workflows } = await start(platform, () => 'Texte lu')
    workflows().find((each) => each.system === 'sys.ia.lire-scans')!.enabled = false
    const doc = await pour('Scan PV.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    expect(seen).toHaveLength(0)
    const actions = await textActions(doc.record)
    expect(actions.map((action) => action.label)).toEqual(['Extraire de nouveau', 'Lire avec la vision (IA)', 'Ouvrir sa note'])
    await actions.find((action) => action.id === 'vision')!.run()
    expect(platform.offered).toHaveLength(0)
    expect(seen).toHaveLength(1)
    expect((await textVersions(doc.record)).map((item) => item.title)).toEqual(['Texte 1 — lu par l’IA avec la vision'])
  })

  it('un PDF scanné (sans texte) : ses pages dessinées, lues par la vision au dépôt', async () => {
    const platform = memoryPlatform()
    const { pour, seen, textVersions } = await start(platform, (one) => (one.image.endsWith('UDE=') ? 'Page un' : 'Page deux'))
    const doc = await pour('Scan.pdf', textPdf([[], []]))
    expect(seen.map((one) => one.image)).toEqual(['data:image/jpeg;base64,UDE=', 'data:image/jpeg;base64,UDI='])
    expect((await textVersions(doc.record))[0]!.detail).toContain('2 page(s) regardée(s)')
    expect(read(platform, doc.record)).toContain('Page un\n\nPage deux')
  })

  it('sans limite de pages : un scan de 45 pages, chacune dessinée à son tour, toutes lues ; le PDF refermé', async () => {
    const platform = memoryPlatform()
    drawnPages = 45
    closed = 0
    try {
      const { pour, seen, textVersions } = await start(platform, (one) => `Texte propre à la ${/page (\d+) sur \d+/.exec(one.text)![1]}${'e'.repeat(Number(/page (\d+) sur/.exec(one.text)![1]))}`)
      const doc = await pour('Gros scan.pdf', textPdf([[]]))
      expect(seen).toHaveLength(45)
      expect(seen.at(-1)!.text).toContain('la page 45 sur 45 d’un document')
      expect((await textVersions(doc.record))[0]!.detail).toContain('45 page(s) regardée(s)')
      expect(read(platform, doc.record)).toContain(`Texte propre à la 45${'e'.repeat(45)}`)
      expect(closed).toBe(1)
    } finally {
      drawnPages = 2
    }
  })

  it('une plateforme qui ne dessine pas les PDF : un PDF scanné n’est pas lu, ni proposé', async () => {
    const platform = memoryPlatform()
    const { pour, seen, textActions } = await start(platform, () => 'x', false)
    const doc = await pour('Scan.pdf', textPdf([[]]))
    expect(seen).toHaveLength(0)
    expect((await textActions(doc.record)).map((action) => action.id)).not.toContain('vision')
  })

  it('un format qui ne se montre pas en images (un Word illisible) : rien à proposer', async () => {
    const platform = memoryPlatform()
    const { pour, textActions } = await start(platform, () => '')
    const doc = await pour('Abîmé.docx', new Uint8Array([1, 2, 3]))
    expect((await textActions(doc.record)).map((action) => action.id)).not.toContain('vision')
  })
})

describe('un PDF avec du texte : le modèle à choisir', () => {
  const PDF = textPdf([['Plan qualite', 'Le pre- sent plan'], ['Revue de con- ception']])

  it('« Relire avec l’IA » demande le modèle : avec la vision, chaque page en image et son texte extrait ; une nouvelle version', async () => {
    const platform = memoryPlatform()
    const { pour, seen, proofread, textActions, textVersions, workflows } = await start(platform, (one) => (one.text.includes('page 1 sur') ? '# Plan qualité\n\nLe présent plan' : 'Revue de conception'))
    // L'étape du dépôt réglée sur le modèle simple (d'origine : automatique — la vision pour un PDF).
    workflows().find((each) => each.system === 'sys.ia.relire-textes')!.actions[0]!.fields.mode = 'texte'
    const doc = await pour('Plan.pdf', PDF)
    // Au dépôt : la relecture de l'étape, avec le modèle simple.
    expect(seen).toHaveLength(0)
    expect(proofread).toEqual(['mistral-small'])
    // L'étape a son champ « Modèle » (simple par défaut).
    expect(workflows().find((each) => each.system === 'sys.ia.relire-textes')!.actions[0]!.kind).toBe('ia.relire-texte')
    platform.choices.push('vision')
    await (await textActions(doc.record)).find((action) => action.id === 'proofread')!.run()
    expect(platform.offered.at(-1)!.map((choice) => choice.label)).toEqual(['Modèle simple', 'Modèle avec la vision'])
    expect(seen.map((one) => one.image)).toEqual(['data:image/jpeg;base64,UDE=', 'data:image/jpeg;base64,UDI='])
    expect(seen[0]!.text).toContain('Voici la page 1 sur 2 d’un document')
    expect(seen[0]!.text).toContain('et corrige-le d’après l’image :\n\nPlan qualite\nLe pre- sent plan')
    expect(seen[1]!.text).toContain('Revue de con- ception')
    const items = await textVersions(doc.record)
    // Le texte extrait gardé (texte 1) ; le relu par la vision, texte 2 (la relecture simple du dépôt n'avait rien changé).
    expect(items.map((item) => item.title)).toEqual(['Texte 2 — lu par l’IA avec la vision', 'Texte 1 — extrait du fichier'])
    expect(items[0]!.detail).toContain('2 page(s) regardée(s)')
    expect(items[0]!.detail).toContain('pixtral-12b')
    expect(read(platform, doc.record)).toContain('Revue de conception')
  })

  it('le modèle simple choisi : la relecture du texte, sans image', async () => {
    const platform = memoryPlatform()
    const { pour, seen, proofread, textActions, workflows } = await start(platform, () => 'x')
    workflows().find((each) => each.system === 'sys.ia.relire-textes')!.actions[0]!.fields.mode = 'texte'
    const doc = await pour('Plan.pdf', PDF)
    platform.choices.push('texte')
    await (await textActions(doc.record)).find((action) => action.id === 'proofread')!.run()
    expect(seen).toHaveLength(0)
    expect(proofread).toEqual(['mistral-small', 'mistral-small'])
  })

  it('une plateforme qui ne dessine pas les PDF : pas de question, le modèle simple', async () => {
    const platform = memoryPlatform()
    const { pour, proofread, textActions } = await start(platform, () => 'x', false)
    const doc = await pour('Plan.pdf', PDF)
    await (await textActions(doc.record)).find((action) => action.id === 'proofread')!.run()
    expect(platform.offered).toHaveLength(0)
    expect(proofread).toHaveLength(2)
  })

  it('l’étape du workflow réglée « avec la vision » : au dépôt, la relecture se fait avec la vision', async () => {
    const platform = memoryPlatform()
    const { pour, seen, proofread, workflows } = await start(platform, () => 'Texte vu')
    workflows().find((each) => each.system === 'sys.ia.relire-textes')!.actions[0]!.fields.mode = 'vision'
    await pour('Plan.pdf', PDF)
    expect(seen).toHaveLength(2)
    expect(proofread).toHaveLength(0)
  })
})

describe('sans modèle de vision réglé : celui d’analyse, comme l’autre module', () => {
  const SANS_VISION = { adresse: 'http://ia.exemple.fr/v1', modele: 'deepseek-v4-flash' }

  it('un modèle d’analyse qui voit : le scan lui est montré, et lu', async () => {
    const platform = memoryPlatform()
    const { pour, seen, textVersions } = await start(platform, () => 'Lu par le modèle d’analyse', true, SANS_VISION)
    const doc = await pour('Scan PV.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    expect(seen.map((one) => one.model)).toEqual(['deepseek-v4-flash'])
    expect((await textVersions(doc.record))[0]!.title).toBe('Texte 1 — lu par l’IA avec la vision')
  })

  it('un modèle que le serveur dit sans vision : dit une fois, clairement ; plus rien ne lui est montré en images', async () => {
    const platform = memoryPlatform()
    const { pour, seen, textActions } = await start(platform, () => 'x', true, SANS_VISION, async () => {}, () => true)
    await pour('Scan PV.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    expect(platform.notices.find((notice) => notice.includes('refuse les images'))).toMatch(/^« Scan PV » : le serveur refuse les images pour le modèle deepseek-v4-flash \(.*is not a multimodal model.*\)\. Choisissez un modèle qui voit sur la page IA/)
    // Un autre scan : rien n'est envoyé, rien n'est proposé.
    const requests = platform.requests.length
    const other = await pour('Scan 2.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]))
    expect(seen).toHaveLength(0)
    expect(platform.requests.filter((request) => (request.body ?? '').includes('image_url')).length).toBe(0)
    expect(platform.requests.length).toBeGreaterThanOrEqual(requests)
    expect((await textActions(other.record)).map((action) => action.id)).not.toContain('vision')
  })
})

describe('une lecture en cours, la file d’attente', () => {
  it('pendant que l’IA lit un document : son bouton grisé ; un autre « Ajouter à la file d’attente », puis grisé « En file d’attente » ; après, tout revient', async () => {
    const platform = memoryPlatform()
    let release: () => void = () => {}
    let held = false
    let asked: () => void = () => {}
    const reached = () => new Promise<void>((resolve) => (asked = resolve))
    const gate = () => {
      if (!held) return Promise.resolve()
      asked()
      return new Promise<void>((resolve) => (release = resolve))
    }
    const { pour, textActions, textVersions } = await start(platform, () => '', false, SERVEUR, gate)
    const one = await pour('Un.txt', new TextEncoder().encode('Le pre- mier texte.'))
    const two = await pour('Deux.txt', new TextEncoder().encode('Le se- cond texte.'))
    held = true
    const reading = reached()
    const first = (await textActions(one.record)).find((action) => action.id === 'proofread')!.run()
    await reading
    // Le premier : en cours, grisé ; l'extraction aussi.
    const here = await textActions(one.record)
    expect(here.find((action) => action.id === 'proofread')).toMatchObject({ label: 'Lecture par l’IA en cours…', disabled: true })
    expect(here.find((action) => action.id === 'extract')!.disabled).toBe(true)
    // Le second : à mettre en file d'attente.
    const other = (await textActions(two.record)).find((action) => action.id === 'proofread')!
    expect(other.label).toBe('Ajouter à la file d’attente')
    expect(other.disabled).toBeUndefined()
    const second = other.run()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect((await textActions(two.record)).find((action) => action.id === 'proofread')).toMatchObject({ label: 'En file d’attente (1)', disabled: true })
    expect(platform.notices).toContain('« Deux » : ajouté à la file d’attente (position 1) — l’IA lit « Un ».')
    held = false
    release()
    await Promise.all([first, second])
    expect((await textActions(one.record)).find((action) => action.id === 'proofread')).toMatchObject({ label: 'Relire avec l’IA' })
    expect((await textActions(two.record)).find((action) => action.id === 'proofread')!.disabled).toBeUndefined()
    expect(await textVersions(two.record)).toEqual([])
  })
})

