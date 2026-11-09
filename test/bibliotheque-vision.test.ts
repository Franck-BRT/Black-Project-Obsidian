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
import { bibliothequeModule, pourIntoLibrary } from '../src/modules/bibliotheque'
import { forgetImageRefusals, iaModule, readVisionPage } from '../src/modules/ia'
import { lectureFichiersModule } from '../src/modules/lecture-fichiers'
import { workflowsModule, type Workflow } from '../src/modules/workflows'

const ALL = [lectureFichiersModule, bibliothequeModule, workflowsModule, iaModule]
const SERVEUR = { adresse: 'http://ia.exemple.fr/v1', modele: 'mistral-small', modeleVision: 'pixtral-12b' }
const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const chat = (content: unknown) => ({ status: 200, text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] }) })

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
let closed = 0

async function start(platform: MemoryPlatform, see: (seen: Seen) => string, drawsPdf = true, ia: Record<string, unknown> = SERVEUR, gate: () => Promise<void> = async () => {}, refuses: (model: string) => boolean = () => false) {
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
      expect(body.messages).toHaveLength(1)
      const one: Seen = { model: body.model, text: first.find((part) => part.type === 'text')!.text!, image: first.find((part) => part.type === 'image_url')!.image_url!.url }
      expect(one.text).toContain('Tu lis une page d’un document')
      if (refuses(body.model)) return { status: 400, text: JSON.stringify({ error: { message: `litellm.BadRequestError: OpenAIException - Error code: 400 - {'detail': {'error': {'message': '${body.model} is not a multimodal model'}}}` } }) }
      seen.push(one)
      return chat(see(one))
    }
    const system = first
    if (system.startsWith('Tu identifies la langue')) return chat('fr')
    if (system.includes('Tu relis un texte extrait automatiquement')) {
      proofread.push(body.model)
      await gate()
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
  return { pour, seen, proofread, workflows, textActions, textVersions }
}

afterEach(async () => {
  forgetImageRefusals()
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
    expect(seen[0]!.text).toContain('Le document n’a pas de texte lisible')
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
      const { pour, seen, textVersions } = await start(platform, (one) => `Lu sur ${/Page \d+ sur \d+/.exec(one.text)![0]}`)
      const doc = await pour('Gros scan.pdf', textPdf([[]]))
      expect(seen).toHaveLength(45)
      expect(seen.at(-1)!.text).toContain('Page 45 sur 45.')
      expect((await textVersions(doc.record))[0]!.detail).toContain('45 page(s) regardée(s)')
      expect(read(platform, doc.record)).toContain('Lu sur Page 45 sur 45')
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
    const { pour, seen, proofread, textActions, textVersions, workflows } = await start(platform, (one) => (one.text.includes('Page 1') ? '# Plan qualité\n\nLe présent plan' : 'Revue de conception'))
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
    expect(seen[0]!.text).toContain('Page 1 sur 2.')
    expect(seen[0]!.text).toContain('Le texte extrait automatiquement de cette page, à vérifier d’après l’image :\n\nPlan qualite\nLe pre- sent plan')
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
    const { pour, seen, proofread, textActions } = await start(platform, () => 'x')
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

