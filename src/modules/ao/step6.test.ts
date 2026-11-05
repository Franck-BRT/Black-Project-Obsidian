// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le jalon de démonstration n° 4 (étape 6) : l'IA relit, conseille et répond en citant ses
 * sources — et le calendrier de l'appel d'offres, relevé sans elle.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { utf8 } from '../../core/formats/zip'
import { createI18n } from '../../core/i18n'
import type { BlackModule, ModuleCommand, ModuleContext } from '../../core/modules/module'
import { memoryPlatform, type MemoryPlatform } from '../../core/testing/memoryPlatform'
import { exigencesModule, requirementsAt } from '../exigences'
import { iaModule } from '../ia'
import { typagePiecesModule } from '../typage-pieces'
import { aoModule } from '.'
import { citedNumbers, linkCitations } from './ask/dossier'
import { pieceText } from './ask/sources'
import { calendarOf, delayLabel, kindOf } from './calendar'
import { aoFr } from './i18n'
import { requirementsFolder } from './requirements'
import { createAnalysis, importFiles } from './service'

const i18n = createI18n('fr')
for (const module of [aoModule, typagePiecesModule, exigencesModule, iaModule]) i18n.register('fr', module.texts.fr)
i18n.register('fr', aoFr)
const t = i18n.t.bind(i18n)

async function activate(module: BlackModule, platform: MemoryPlatform, initial: Record<string, unknown>) {
  let stored = initial
  const commands: ModuleCommand[] = []
  const context: ModuleContext = {
    moduleId: module.id,
    platform,
    i18n,
    settings: { get: () => stored, save: async (values) => void (stored = values), onChange: () => () => {} },
    commands: { register: (command) => void commands.push(command) }
  }
  await module.activate(context)
  return { run: (id: string) => commands.find((command) => command.id === id)!.run() }
}

const chat = (content: unknown) => ({
  status: 200,
  text: JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] })
})

const RC = `# Règlement de la consultation

## Article 4 — Remise des offres

La date limite de remise des offres est fixée au 15 décembre 2026 à 12h00.

Le délai de validité des offres est fixé à 120 jours à compter de la date limite de remise.

## Article 5 — Jugement des offres

Les offres sont jugées selon les critères suivants : valeur technique 60 %, prix 40 %.
`

const CCTP = `# CCTP Station sol

## Article 7 — Pénalités

### 7.2 Pénalités de retard

En cas de retard de livraison, le titulaire encourt une pénalité de 500 € par jour calendaire de retard, plafonnée à 10 % du montant du marché.

## Article 8 — Livraison

La livraison du segment sol intervient sous 18 mois à compter de la notification.
`

async function setup(withAi = true) {
  const platform = memoryPlatform()
  await activate(typagePiecesModule, platform, {})
  await activate(exigencesModule, platform, {})
  if (withAi) await activate(iaModule, platform, { adresse: 'http://ia.exemple/v1', modele: 'mistral' })
  const ao = await activate(aoModule, platform, { dossier: 'AO' })
  const services = { fs: platform.fs, t, root: 'AO', today: () => '2026-11-05' }
  const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: 'CNES', reference: '' })
  await importFiles(services, analysis, [
    { name: 'RC.md', bytes: utf8(RC) },
    { name: 'CCTP.md', bytes: utf8(CCTP) }
  ])
  platform.active = analysis.note
  return { platform, run: ao.run, analysis }
}

const read = (platform: MemoryPlatform, path: string) => new TextDecoder().decode(platform.files.get(path))
const written = (platform: MemoryPlatform, start: string) => [...platform.files.keys()].filter((path) => path.startsWith(start))

afterEach(async () => {
  for (const module of [aoModule, iaModule, exigencesModule, typagePiecesModule]) await module.deactivate?.()
})

describe('le calendrier de l’appel d’offres, sans IA', () => {
  it('remise et validité à retenir, chaque date avec sa phrase et sa pièce', async () => {
    const { platform, run, analysis } = await setup(false)
    await run('calendrier')
    const path = `${analysis.folder}/Analyse/Calendrier.md`
    expect(platform.opened.at(-1)).toBe(path)
    const note = read(platform, path)
    expect(note).toContain('**Date limite de remise des offres** : mardi 15 décembre 2026 — « La date limite de remise des offres est fixée au 15 décembre 2026 à 12h00. »')
    expect(note).toMatch(/\*\*Validité des offres\*\* : 120 jours à compter de la date limite de remise — « Le délai de validité/)
    expect(note).toMatch(/\| 2026-12-15 \| Date limite de remise des offres \| La date limite/)
    expect(note).toMatch(/\| sous 18 mois à compter de la notification \| Livraison, recette \|/)
    expect(note).toContain('[[AO/Station sol/Pièces/')
    // Relancé : la section est réécrite, les notes de l'utilisateur gardées.
    await platform.fs.writeText(path, `${note}Mon commentaire\n`)
    await run('calendrier')
    expect(read(platform, path)).toContain('Mon commentaire')
    expect(read(platform, path).match(/## À retenir/g)).toHaveLength(1)
  })

  it('reconnaît ce que dit une phrase', () => {
    expect(kindOf('Les offres devront parvenir avant le 3 mars 2027.')).toBe('remise')
    expect(kindOf('Les questions des candidats sont reçues jusqu’au 1er février.')).toBe('questions')
    expect(kindOf('Une visite du site est organisée le 12 janvier.')).toBe('visite')
    expect(kindOf('Réunion le 4 avril.')).toBe('autre')
    expect(delayLabel('est fixé à 120 jours à compter de la remise')).toBe('120 jours à compter de la remise')
    expect(delayLabel('sous 15 jours')).toBe('sous 15 jours')
    expect(kindOf('La réunion de lancement se tient sous 10 jours à compter de la notification.')).toBe('execution')
    expect(kindOf('Livraison sous 18 mois à compter de la notification.')).toBe('livraison')
    expect(kindOf('Une pénalité par jour de retard de livraison.')).toBe('penalite')
  })
})

describe('une phrase dite par plusieurs pièces', () => {
  it('une seule ligne, toutes ses pièces', () => {
    const piece = (title: string) => ({ path: `P/${title}.md`, title, kind: 'document', detail: '', text: 'La livraison intervient au plus tard le 30 juin 2027.' }) as never
    const calendar = calendarOf([piece('CCTP'), piece('CCTP (pdf)')], 2026)
    expect(calendar.dates).toHaveLength(1)
    expect(calendar.dates[0]!.sources).toHaveLength(2)
  })
})

describe('interroger le dossier : l’IA répond en citant ses sources', () => {
  it('sans IA réglée, le dit', async () => {
    const { platform, run } = await setup(false)
    await run('interroger')
    expect(platform.notices.at(-1)).toMatch(/IA n’est pas réglée/)
  })

  it('les passages trouvés numérotés, la réponse citée, la note avec ses sources', async () => {
    const { platform, run, analysis } = await setup()
    platform.forms.push({ question: 'Quelles sont les pénalités de retard ?', mode: 'search' })
    platform.httpAnswers.push(chat('Le titulaire encourt 500 € par jour calendaire de retard, plafonnés à 10 % du montant du marché (art. 7.2) [1].'))
    await run('interroger')
    const request = JSON.parse(platform.requests[0]!.body!) as { messages: { role: string; content: string }[] }
    expect(request.messages[0]!.content).toContain('uniquement d’après les extraits')
    expect(request.messages[1]!.content).toMatch(/### Source \[1\] — CCTP/)
    expect(request.messages[1]!.content).toContain('500 € par jour calendaire')
    const [path] = written(platform, `${analysis.folder}/Analyse/Questions/`)
    expect(path).toBe(`${analysis.folder}/Analyse/Questions/2026-11-05 Quelles sont les pénalités de retard.md`)
    expect(platform.opened.at(-1)).toBe(path)
    const note = read(platform, path!)
    expect(note).toContain('> [!question] Quelles sont les pénalités de retard ?')
    expect(note).toMatch(/\(art\. 7\.2\) \\\[\[\[AO\/Station sol\/Pièces\/.*CCTP\|1\]\]\\\]/)
    expect(note).toMatch(/1\. \[\[AO\/Station sol\/Pièces\/.*\|CCTP\]\] — .* — \*citée\*/)
    expect(note).toContain('> [!quote]- Extraits transmis')
    expect(platform.notices.at(-1)).toBe('Réponse écrite : 1 source(s) citée(s) sur 1 transmise(s).')
  })

  it('rien dans les pièces : l’IA n’est pas appelée, pour ne rien inventer', async () => {
    const { platform, run } = await setup()
    platform.forms.push({ question: 'Quelle est la couleur du logo ?', mode: 'search' })
    await run('interroger')
    expect(platform.requests).toHaveLength(0)
    expect(platform.notices.at(-1)).toMatch(/l’IA n’a pas été interrogée/)
  })

  it('une question de délais reçoit aussi les dates relevées par le module', async () => {
    const { platform, run } = await setup()
    platform.forms.push({ question: 'Quelle est la date limite de remise des offres ?', mode: 'search' })
    platform.httpAnswers.push(chat('Le 15 décembre 2026 à 12h00 [1].'))
    await run('interroger')
    const request = JSON.parse(platform.requests[0]!.body!) as { messages: { content: string }[] }
    expect(request.messages[1]!.content).toContain('## Dates et délais relevés dans les pièces')
    expect(request.messages[1]!.content).toContain('- 2026-12-15 — « 15 décembre 2026 »')
  })

  it('lecture de chaque pièce : chaque pièce lue, ce qui répond relevé, puis la réponse', async () => {
    const { platform, run, analysis } = await setup()
    platform.forms.push({ question: 'Quelles sont les pénalités ?', mode: 'each' })
    // Les pièces dans l'ordre du tableau : CCTP puis RC.
    platform.httpAnswers.push(chat('Art. 7.2 : 500 € par jour de retard, plafond 10 %.'), chat('RIEN'), chat('500 € par jour [1].'))
    await run('interroger')
    expect(platform.requests).toHaveLength(3)
    const note = read(platform, written(platform, `${analysis.folder}/Analyse/Questions/`)[0]!)
    expect(note).toContain('Lecture de chaque pièce')
    expect(note).toContain('> [!quote]- Ce que l’IA y a relevé')
  })

  it('avec un modèle de reranking, la pièce la plus pertinente devient la source [1]', async () => {
    const platform = memoryPlatform()
    await activate(typagePiecesModule, platform, {})
    await activate(exigencesModule, platform, {})
    await activate(iaModule, platform, { adresse: 'http://ia.exemple/v1', modele: 'mistral', modeleReranking: 'bge-reranker' })
    const ao = await activate(aoModule, platform, { dossier: 'AO' })
    const services = { fs: platform.fs, t, root: 'AO', today: () => '2026-11-05' }
    const analysis = await createAnalysis(services, 'Station sol', { position: 'candidat', buyer: '', reference: '' })
    await importFiles(services, analysis, [
      { name: 'RC.md', bytes: utf8(RC) },
      { name: 'CCTP.md', bytes: utf8(CCTP) }
    ])
    platform.active = analysis.note
    platform.forms.push({ question: 'Quelle est la date limite de remise des offres et la livraison ?', mode: 'search' })
    platform.httpAnswers.push(
      { status: 200, text: JSON.stringify({ results: [{ index: 0, relevance_score: 0.1 }, { index: 1, relevance_score: 0.8 }] }) },
      chat('Le 15 décembre 2026 [1].')
    )
    await ao.run('interroger')
    expect(platform.requests[0]!.url).toBe('http://ia.exemple/v1/rerank')
    // Le second texte envoyé au reranker a la meilleure note : il devient la source [1].
    const ranked = JSON.parse(platform.requests[0]!.body!) as { documents: string[] }
    const [first, second] = ranked.documents.map((document) => document.split('\n')[0])
    const sent = JSON.parse(platform.requests[1]!.body!) as { messages: { content: string }[] }
    expect(sent.messages[1]!.content).toContain(`### Source [1] — ${second}\n`)
    expect(sent.messages[1]!.content).toContain(`### Source [2] — ${first}\n`)
  })

  it('une citation sans source est signalée', async () => {
    expect(citedNumbers('Oui [1][3], et [2, 4].')).toEqual([1, 2, 3, 4])
    const sources = [{ source: { path: 'P/a.md', title: 'a' }, passages: [], cited: true }] as never
    expect(linkCitations('Oui [1] et [7].', sources)).toBe('Oui \\[[[P/a|1]]\\] et [7].')
  })
})

describe('le questionnaire du dossier', () => {
  it('les questions choisies, chacune avec ses sources ; sans passage, pas d’appel', async () => {
    const { platform, run, analysis } = await setup()
    platform.manyAnswers.push(['attribution', 'export'])
    platform.httpAnswers.push(chat('Valeur technique 60 %, prix 40 % (article 5) [1].'))
    await run('questionnaire')
    expect(platform.requests).toHaveLength(1)
    const path = `${analysis.folder}/Analyse/Questionnaire.md`
    const note = read(platform, path)
    expect(note).toContain('## Critères d’attribution')
    expect(note).toContain('Valeur technique 60 %, prix 40 % (article 5)')
    expect(note).toMatch(/## Contrôle export\n\n<!-- bp:questionnaire:export:debut[^\n]*\n.*\n\nRien dans les pièces/)
    expect(note).toContain('## Pénalités\n\n<!-- bp:questionnaire:penalites:debut — tenu à jour par Black Projects -->\n*pas encore lancée*')
    expect(platform.notices.at(-1)).toBe('Questionnaire rempli : 2 question(s), dont 1 sans rien dans les pièces.')
  })
})

describe('relire les exigences du dossier', () => {
  it('côté candidat : la relecture dans la note, la formulation de l’acheteur intacte', async () => {
    const { platform, run, analysis } = await setup()
    const store = requirementsAt(requirementsFolder(analysis))
    const weak = await store.create({ title: 'Disponibilité', text: { fr: { body: 'Disponibilité maximale si possible.', lang: 'fr', origin: 'human', reviewed: true, by: '', at: '', sourceRev: 0 } } as never })
    platform.httpAnswers.push(
      chat({ assessment: 'Non vérifiable : aucun seuil.', findings: [], proposals: [{ axis: 'verifiable', action: 'Donner un taux.', rewrite: 'Le système doit être disponible 99,5 % du temps.' }] })
    )
    await run('relire-exigences-ia')
    expect(platform.manyAsked.at(-1)!.selected).toEqual([weak.filePath])
    const note = read(platform, weak.filePath!)
    expect(note).toContain('Non vérifiable : aucun seuil.')
    expect(note).toContain('Disponibilité maximale si possible.')
    expect(platform.offered).toHaveLength(0)
    expect(platform.notices.at(-1)).toBe('1 exigence(s) relue(s), 0 reformulée(s). La relecture est dans chaque note.')
  })
})

describe('les pièces comme sources', () => {
  it('le texte extrait, sans les sections tenues par Black Projects', () => {
    const note = '---\nx: 1\n---\n# P\n\n## Texte extrait\n\nCorps\n\n<!-- bp:exigences:debut — x -->\nListe\n<!-- bp:exigences:fin -->\n'
    expect(pieceText(note, ['Texte extrait'])).toBe('Corps')
    expect(pieceText(note, ['Extracted text'])).toBe('')
  })
})
