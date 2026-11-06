// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Vérifier les exigences d'un dossier de consultation — quatre vérifications, chacune sa
 * commande, et une commande qui les enchaîne :
 *
 * 1. **Tout extraire** : les exigences de toutes les pièces de l'appel d'offres, en un aperçu ;
 * 2. **Exigences oubliées** : les phrases qui ont la tournure d'une exigence et qu'aucune
 *    exigence ne reprend — proposées à l'ajout ;
 * 3. **Cohérence entre pièces** : identifiants écrits différemment, absents d'une version,
 *    en double ; même texte sous deux identifiants ; exigence rangée qui ne dit plus ce que
 *    dit sa pièce ;
 * 4. **Couverture par la réponse** : pour chaque exigence, l'endroit de la réponse qui la
 *    cite ou la traite, ou son absence — une première matrice de conformité.
 *
 * Les résultats vont dans une note de l'analyse, `Analyse/Vérification des exigences.md`,
 * une section par vérification, réécrite à chaque fois ; un résumé en tête.
 */

import { frontmatter, parseFrontmatter, setFrontmatterField } from '../../core/frontmatter'
import type { Notifier, Ui } from '../../core/ports'
import {
  canExtract,
  coherence,
  coverage,
  describeLocation,
  documentPassages,
  extractRequirements,
  hasPassages,
  missedRequirements,
  previewImport,
  requirementLanguages,
  requirementsAt,
  type Coverage,
  type Extraction,
  type Finding,
  type Missed,
  type PieceRequirements,
  type ReadDocument,
  type ReqLocation
} from '../exigences'
import { extensionOf } from '../lecture-fichiers'
import { ANALYSIS, wikiLink, type Analysis, type PieceRow } from './notes'
import { refreshRequirements, requirementsFolder } from './requirements'
import { listPieces, type Services } from './service'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const CHECKS = ['extraction', 'oubliees', 'coherence', 'couverture'] as const
export type CheckKey = (typeof CHECKS)[number]

export const REPORT_TYPE = 'ao-verification'

export interface Window {
  ui: Ui
  notifier: Notifier
}

export function reportPath(analysis: Analysis): string {
  return `${analysis.folder}/${ANALYSIS}/Vérification des exigences.md`
}

const start = (key: string) => `<!-- bp:verif:${key}:debut — tenu à jour par Black Projects -->`
const end = (key: string) => `<!-- bp:verif:${key}:fin -->`

const excerpt = (text: string, size = 160) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > size ? `${flat.slice(0, size - 1)}…` : flat
}

/** Une cellule de tableau Markdown : les « | » échappés, sur une ligne. */
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ')

const noteName = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')

// ── Le rapport ───────────────────────────────────────────────────────────────────

function skeleton(analysis: Analysis, t: Translate): string {
  return [
    frontmatter({ 'bp-type': REPORT_TYPE, analyse: wikiLink(analysis.note) }),
    `# ${t('ao.verif.report.title', { name: analysis.name })}`,
    '',
    t('ao.verif.report.intro'),
    '',
    `## ${t('ao.verif.summary')}`,
    '',
    start('resume'),
    `*${t('ao.verif.notRun')}*`,
    end('resume'),
    '',
    ...CHECKS.flatMap((key) => [`## ${t(`ao.verif.${key}.title`)}`, '', start(key), `*${t('ao.verif.notRun')}*`, end(key), '']),
    `## ${t('ao.note.notes')}`,
    '',
    ''
  ].join('\n')
}

function withSection(note: string, key: string, content: string): string {
  const from = note.indexOf(start(key))
  const to = note.indexOf(end(key))
  if (from === -1 || to < from) return `${note.trimEnd()}\n\n${start(key)}\n${content}\n${end(key)}\n`
  return `${note.slice(0, from + start(key).length)}\n${content}\n${note.slice(to)}`
}

/** Écrit une section du rapport et sa ligne de résumé ; crée le rapport s'il n'existe pas. */
async function writeSection(services: Services, analysis: Analysis, key: CheckKey, summary: string, content: string): Promise<string> {
  const { fs, t } = services
  const path = reportPath(analysis)
  let note = (await fs.exists(path)) ? await fs.readText(path) : skeleton(analysis, t)
  note = setFrontmatterField(note, key, `${services.today()} — ${summary}`)
  const data = parseFrontmatter(note).data
  const resume = CHECKS.map((each) => `- **${t(`ao.verif.${each}.title`)}** : ${data[each] ?? `*${t('ao.verif.notRun')}*`}`).join('\n')
  note = withSection(withSection(note, key, content), 'resume', resume)
  await fs.writeText(path, note)
  return path
}

// ── Les pièces ───────────────────────────────────────────────────────────────────

interface PieceFile {
  row: PieceRow
  /** Un lien vers la note de la pièce. */
  link: string
  name: string
  extension: string
}

async function pieceFiles(services: Services, analysis: Analysis, place: 'appel-d-offres' | 'reponse'): Promise<PieceFile[]> {
  const out: PieceFile[] = []
  for (const row of await listPieces(services, analysis)) {
    if (row.destination.place !== place || !(await services.fs.exists(row.original))) continue
    out.push({ row, link: wikiLink(row.note, noteName(row.note)), name: noteName(row.note), extension: extensionOf(row.original) })
  }
  return out
}

async function readDocuments(services: Services, files: readonly PieceFile[]): Promise<ReadDocument[]> {
  const out: ReadDocument[] = []
  for (const file of files) {
    if (!hasPassages(file.extension)) continue
    const passages = await documentPassages(file.extension, new Uint8Array(await services.fs.readBinary(file.row.original)))
    if (passages) out.push({ piece: file.link, passages })
  }
  return out
}

async function extractEach(services: Services, files: readonly PieceFile[]): Promise<{ file: PieceFile; extraction: Extraction }[]> {
  const out: { file: PieceFile; extraction: Extraction }[] = []
  for (const file of files) {
    if (!canExtract(file.extension)) continue
    const bytes = new Uint8Array(await services.fs.readBinary(file.row.original))
    out.push({ file, extraction: await extractRequirements(file.extension, bytes, requirementLanguages()) })
  }
  return out
}

const where = (location: ReqLocation | undefined, t: Translate) => describeLocation(location, t) || '—'

// ── 1. Tout extraire ─────────────────────────────────────────────────────────────

export async function extractAll(services: Services, window: Window, analysis: Analysis): Promise<string> {
  const { t } = services
  const results = await extractEach(services, await pieceFiles(services, analysis, 'appel-d-offres'))
  const rows: Record<string, string>[] = []
  const locations: ReqLocation[] = []
  const owners: PieceFile[] = []
  for (const { file, extraction } of results) {
    rows.push(...extraction.rows)
    locations.push(...extraction.where)
    owners.push(...extraction.rows.map(() => file))
  }
  const table = [
    `| ${t('ao.verif.column.piece')} | ${t('ao.verif.column.found')} |`,
    '| --- | --- |',
    ...results.map(({ file, extraction }) =>
      `| ${cell(file.link)} | ${extraction.problem ? t(`exigences.import.problem.${extraction.problem}`, { name: file.name }) : extraction.rows.length} |`
    )
  ].join('\n')
  let outcome = ''
  if (rows.length > 0) {
    const report = await previewImport({
      ui: window.ui,
      notifier: window.notifier,
      t,
      store: requirementsAt(requirementsFolder(analysis)),
      extraction: { rows, where: locations, ignored: [], unmatched: [], lang: requirementLanguages()[0] ?? 'fr' },
      name: analysis.name,
      extension: 'pdf',
      piece: '',
      pieceOf: (index) => owners[index]!.link,
      labelOf: (index) => owners[index]!.name,
      categoryOf: (index) => owners[index]!.row.type,
      title: t('ao.verif.extraction.preview', { count: rows.length, pieces: results.length })
    })
    outcome = report
      ? t('ao.verif.extraction.done', { created: report.outcome.created.length, updated: report.outcome.updated.length })
      : t('ao.verif.extraction.cancelled')
    if (report) await refreshRequirements(services, analysis)
  }
  const summary = t('ao.verif.extraction.summary', {
    pieces: results.length,
    found: rows.length,
    without: results.filter(({ extraction }) => extraction.rows.length === 0).length
  })
  await writeSection(
    services,
    analysis,
    'extraction',
    [summary, outcome].filter(Boolean).join(' '),
    [summary, outcome].filter(Boolean).join(' ') + '\n\n' + (results.length ? table : `*${t('ao.verif.noTender')}*`)
  )
  return summary
}

// ── 2. Les exigences oubliées ────────────────────────────────────────────────────

function missedTable(missed: readonly Missed[], t: Translate): string {
  return [
    `| ${t('ao.verif.column.sentence')} | ${t('ao.verif.column.piece')} | ${t('ao.verif.column.where')} | ${t('ao.verif.column.marker')} |`,
    '| --- | --- | --- | --- |',
    ...missed.map(
      (each) =>
        `| ${cell(excerpt(each.sentence, 240))} | ${cell([each.piece, ...each.alsoIn].join(', '))} | ${cell(where(each.where, t))} | « ${cell(each.marker)} » |`
    )
  ].join('\n')
}

export async function findMissed(services: Services, window: Window, analysis: Analysis): Promise<string> {
  const { t } = services
  const files = await pieceFiles(services, analysis, 'appel-d-offres')
  const documents = await readDocuments(services, files)
  const store = requirementsAt(requirementsFolder(analysis))
  let missed = missedRequirements(documents, await store.all())
  let added = 0
  if (missed.length > 0) {
    // Proposées à l'ajout, aucune cochée d'avance : c'est à l'utilisateur de dire lesquelles en sont.
    const fileOf = (link: string) => files.find((file) => file.link === link)
    const lang = requirementLanguages()[0] ?? 'fr'
    const report = await previewImport({
      ui: window.ui,
      notifier: window.notifier,
      t,
      store,
      extraction: { rows: missed.map((each) => ({ [`text.${lang}`]: each.sentence })), where: missed.map((each) => each.where), ignored: [], unmatched: [], lang },
      name: analysis.name,
      extension: 'md',
      piece: '',
      pieceOf: (index) => missed[index]!.piece,
      labelOf: (index) => fileOf(missed[index]!.piece)?.name ?? '',
      categoryOf: (index) => fileOf(missed[index]!.piece)?.row.type ?? '',
      preselect: false,
      title: t('ao.verif.oubliees.preview', { count: missed.length })
    })
    if (report) {
      added = report.outcome.created.length
      await refreshRequirements(services, analysis)
      missed = missedRequirements(documents, await store.all())
    }
  }
  const summary = t('ao.verif.oubliees.summary', { count: missed.length, documents: documents.length, added })
  await writeSection(
    services,
    analysis,
    'oubliees',
    summary,
    [summary, '', missed.length ? missedTable(missed, t) : `*${t('ao.verif.oubliees.none')}*`].join('\n')
  )
  return summary
}

// ── 3. La cohérence entre pièces ─────────────────────────────────────────────────

function findingsTable(findings: readonly Finding[], t: Translate): string {
  return [
    `| ${t('ao.verif.column.finding')} | ${t('ao.verif.column.ids')} | ${t('ao.verif.column.pieces')} | ${t('ao.verif.column.detail')} |`,
    '| --- | --- | --- | --- |',
    ...findings.map(
      (finding) =>
        `| ${t(`ao.verif.finding.${finding.kind}`)} | ${cell(finding.ids.join(', '))} | ${cell(finding.pieces.join(', '))} | ${cell(
          finding.texts.map((text) => `« ${excerpt(text, 120)} »`).join(' ≠ ')
        )} |`
    )
  ].join('\n')
}

export async function checkCoherence(services: Services, analysis: Analysis): Promise<string> {
  const { t } = services
  const results = await extractEach(services, await pieceFiles(services, analysis, 'appel-d-offres'))
  const pieces: PieceRequirements[] = results.map(({ file, extraction }) => ({
    piece: file.link,
    type: file.row.type,
    rows: extraction.rows,
    where: extraction.where
  }))
  const findings = coherence(pieces, await requirementsAt(requirementsFolder(analysis)).all())
  const summary = t('ao.verif.coherence.summary', { count: findings.length, pieces: pieces.length })
  await writeSection(
    services,
    analysis,
    'coherence',
    summary,
    [summary, '', findings.length ? findingsTable(findings, t) : `*${t('ao.verif.coherence.none')}*`].join('\n')
  )
  return summary
}

// ── 4. La couverture par la réponse ──────────────────────────────────────────────

const STATUS_MARK: Record<Coverage['status'], string> = { cited: '🟩', addressed: '🟩', partial: '🟧', absent: '🟥' }

function coverageTable(rows: readonly Coverage[], t: Translate): string {
  return [
    `| ${t('ao.verif.column.requirement')} | ${t('ao.verif.column.status')} | ${t('ao.verif.column.answer')} | ${t('ao.verif.column.excerpt')} |`,
    '| --- | --- | --- | --- |',
    ...rows.map((row) => {
      const link = row.requirement.filePath ? wikiLink(row.requirement.filePath, row.requirement.id) : row.requirement.id
      const status = `${STATUS_MARK[row.status]} ${t(`ao.verif.status.${row.status}`, { score: Math.round(row.score * 100) })}`
      const place = row.piece ? `${row.piece} — ${where(row.where, t)}` : '—'
      return `| ${cell(link)} | ${status} | ${cell(place)} | ${cell(row.excerpt ? excerpt(row.excerpt, 140) : '—')} |`
    })
  ].join('\n')
}

const counts = (rows: readonly Coverage[]) => ({
  cited: rows.filter((row) => row.status === 'cited').length,
  addressed: rows.filter((row) => row.status === 'addressed').length,
  partial: rows.filter((row) => row.status === 'partial').length,
  absent: rows.filter((row) => row.status === 'absent').length
})

/** Où, dans une pièce, en mots (« Article 2 — tableau 1, ligne 2 ») ; « — » si on ne sait pas. */
export const describeWhere = where

/**
 * La couverture des exigences de l'analyse par la réponse d'un candidat, sans rien écrire :
 * la fiche du candidat la montre telle qu'elle est maintenant. `candidate` vide : la
 * réponse unique (position candidat).
 */
export async function candidateCoverage(services: Services, analysis: Analysis, candidate: string): Promise<Coverage[]> {
  const requirements = await requirementsAt(requirementsFolder(analysis)).all()
  const files = (await pieceFiles(services, analysis, 'reponse')).filter((file) => (file.row.destination.candidate ?? '') === candidate)
  if (!requirements.length || !files.length) return []
  return coverage(requirements, await readDocuments(services, files))
}

export async function checkCoverage(services: Services, analysis: Analysis): Promise<string> {
  const { t } = services
  const requirements = await requirementsAt(requirementsFolder(analysis)).all()
  const responses = await pieceFiles(services, analysis, 'reponse')
  // Une réponse par candidat pour l'émetteur ; une seule pour le candidat.
  const groups = new Map<string, PieceFile[]>()
  for (const file of responses) {
    const key = file.row.destination.candidate ?? ''
    groups.set(key, [...(groups.get(key) ?? []), file])
  }
  let summary: string
  let content: string
  if (requirements.length === 0) {
    summary = t('ao.verif.couverture.noRequirements')
    content = `*${summary}*`
  } else if (groups.size === 0) {
    summary = t('ao.verif.couverture.noResponse')
    content = `*${summary}*`
  } else {
    const parts: string[] = []
    const lines: string[] = []
    for (const [candidate, files] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
      const rows = coverage(requirements, await readDocuments(services, files))
      const line = t('ao.verif.couverture.counts', { total: rows.length, ...counts(rows) })
      lines.push(candidate ? `${candidate} : ${line}` : line)
      parts.push(...(candidate ? [`### ${candidate}`, ''] : []), line, '', coverageTable(rows, t), '')
    }
    summary = lines.join(' · ')
    content = [t('ao.verif.couverture.intro'), '', ...parts].join('\n').trimEnd()
  }
  await writeSection(services, analysis, 'couverture', summary, content)
  return summary
}

// ── Maintenant, sans rien écrire ─────────────────────────────────────────────────

/** Les quatre vérifications telles qu'elles sont maintenant, pour la page : rien n'est écrit ni proposé. */
export interface VerificationNow {
  /** Chaque pièce de l'appel d'offres d'où l'on sait extraire : combien d'exigences elle porte, ou ce qui l'empêche. */
  extraction: { note: string; name: string; found: number; problem?: string }[]
  /** Les phrases à tournure d'exigence qu'aucune exigence ne reprend. */
  missed: Missed[]
  /** Les pièces lues pour les chercher. */
  documents: number
  findings: Finding[]
  /** La couverture des exigences par chaque réponse (`candidate` vide : la réponse unique). */
  coverage: { candidate: string; rows: Coverage[] }[]
  requirements: number
  /** Les pièces de réponse. */
  responses: number
}

/**
 * Les quatre vérifications, calculées sans rien écrire : la page de la vérification les
 * montre telles qu'elles sont à son ouverture. Les pièces de l'appel d'offres ne sont lues
 * qu'une fois (l'extraction sert aussi à la cohérence).
 */
export async function verificationNow(services: Services, analysis: Analysis): Promise<VerificationNow> {
  const tender = await pieceFiles(services, analysis, 'appel-d-offres')
  const results = await extractEach(services, tender)
  const documents = await readDocuments(services, tender)
  const requirements = await requirementsAt(requirementsFolder(analysis)).all()
  const findings = coherence(
    results.map(({ file, extraction }) => ({ piece: file.link, type: file.row.type, rows: extraction.rows, where: extraction.where })),
    requirements
  )
  const responses = await pieceFiles(services, analysis, 'reponse')
  const groups = new Map<string, PieceFile[]>()
  for (const file of responses) groups.set(file.row.destination.candidate ?? '', [...(groups.get(file.row.destination.candidate ?? '') ?? []), file])
  const covered: VerificationNow['coverage'] = []
  if (requirements.length)
    for (const [candidate, files] of [...groups].sort(([a], [b]) => a.localeCompare(b))) covered.push({ candidate, rows: coverage(requirements, await readDocuments(services, files)) })
  return {
    extraction: results.map(({ file, extraction }) => ({ note: file.row.note, name: file.name, found: extraction.rows.length, ...(extraction.problem ? { problem: extraction.problem } : {}) })),
    missed: missedRequirements(documents, requirements),
    documents: documents.length,
    findings,
    coverage: covered,
    requirements: requirements.length,
    responses: responses.length
  }
}

// ── Les quatre ───────────────────────────────────────────────────────────────────

/** Les quatre vérifications, l'une après l'autre ; rend le chemin du rapport. */
export async function verifyAll(services: Services, window: Window, analysis: Analysis): Promise<string> {
  await extractAll(services, window, analysis)
  await findMissed(services, window, analysis)
  await checkCoherence(services, analysis)
  await checkCoverage(services, analysis)
  return reportPath(analysis)
}
