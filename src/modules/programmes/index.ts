// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Module **Programmes** : des **programmes**, leurs **projets**, leurs **affaires**. Un projet
 * suit les **phases** de son **type** (que l'utilisateur dessine : des étapes qui se suivent,
 * des phases en parallèle) ; une phase peut être celle d'un module — l'analyse d'un appel
 * d'offres est une phase d'un projet, que le module AO mène.
 */

import { localToday } from '../../core/dates'
import { canCreatePieceType, chooseReferenceDocuments, createPieceType, documentsIn, dropDocumentsInto, libraryActive, libraryDocPage, libraryDocument, libraryFolderPage, libraryPieceTypes, pieceTypeText, pourDocumentsInto, projectDocumentsFolder, registerReferenceCallers } from '../bibliotheque'
import { fillTemplate } from '../../core/docs'
import page from './doc/Programmes.md'
import type { BlackModule, ModuleContext, TextField } from '../../core/modules/module'
import type { Choice, FormField } from '../../core/ports'
import { phaseKinds, type PhaseContext } from './kinds'
import { AFFAIRE_STATUSES, flatFolders, FREE_KIND, PHASE_ICONS, safeName, TILE_COLORS, type ExpectedDoc, type PhaseSpec, type PhaseStatus, type Project, type ProjectPhase, type ProjectType, type SpanSpec } from './model'
import { programmePageOf, PROGRAMMES_PAGE, projectPageOf, registerProgrammesHome, typePageOf, TYPES_PAGE } from './home'
import { AlreadyThere, ProgrammeStore } from './store'
import { addFolder, addParallel, addSpan, addStage, copyType, findFolder, movePhase, newPhase, newType, readTypes, remapSpans, removeFolder, removePhase, removeSpan, replacePhase, TYPES_KEY, updateFolder, updateSpan } from './types'
import { programmesEn, programmesFr } from './i18n'
import { mergeTypes, readTypesFile, typesFile, typesFileName, TYPES_EXCHANGE_FOLDER } from './exchange'

// ── Interface publique ──────────────────────────────────────────────────────────────
export { registerPhaseKind, phaseKinds, type PhaseContext, type PhaseKind } from './kinds'
export { addFolder, addParallel, addSpan, addStage, AO_KIND, findFolder, movePhase, remapSpans, removeFolder, removePhase, starterTypes, updateFolder } from './types'
export { flatFolders, type FolderSpec } from './model'
export { addDays, daysBetween, isLate, PHASE_ICONS, planPhases, replanPhases, slipOf } from './model'
export { shortDay } from './home'
export { PROGRAMMES_PAGE, PROJECT_PAGE, phasePageOf, projectPageOf, programmePageOf } from './home'
export type { Affaire, PhaseStatus, Programme, Project, ProjectPhase, ProjectType } from './model'

export const PROGRAMMES = 'programmes'

/** Le dossier des programmes, dans le coffre. */
const FOLDER_KEY = 'dossier'
const DEFAULT_FOLDER = 'Programmes'

const folderField: TextField = {
  kind: 'text',
  key: FOLDER_KEY,
  nameKey: 'programmes.setting.folder',
  descKey: 'programmes.setting.folder.desc',
  tooltipKey: 'programmes.setting.folder.tip',
  defaultValue: DEFAULT_FOLDER,
  normalize: (input) => input.trim().replace(/^\/+|\/+$/g, '')
}

let active: { store: ProgrammeStore } | null = null
/** Ce qui oublie les appels de documents de référence déclarés à la bibliothèque. */
let stopCallers: (() => void) | null = null

/** Les programmes, pour les autres modules ; `null` sans le module. */
export const programmesStore = (): ProgrammeStore | null => active?.store ?? null

export const programmesModule: BlackModule = {
  id: PROGRAMMES,
  nameKey: 'programmes.name',
  descriptionKey: 'programmes.description',
  version: '0.11.0',
  requires: [],
  texts: { fr: programmesFr, en: programmesEn },
  settingsFields: [folderField],
  docs: ({ folder }) => [{ path: 'Modules/Programmes.md', content: fillTemplate(page, folder) }],
  activate(context: ModuleContext) {
    const { platform, settings, i18n, views } = context
    const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars)
    const ui = platform.ui
    const notify = (message: string, ms = 6000) => platform.notifier.notify(message, ms)
    const store = new ProgrammeStore({
      fs: platform.fs,
      yaml: platform.yaml,
      root: () => (typeof settings.get()[FOLDER_KEY] === 'string' && (settings.get()[FOLDER_KEY] as string).trim()) || DEFAULT_FOLDER,
      today: localToday,
      notesHeading: () => t('programmes.notes')
    })
    active = { store }
    const show = (page: string) => context.showPage?.(page)
    const types = () => readTypes(settings.get(), t)
    const saveTypes = (next: ProjectType[]) => settings.save({ ...settings.get(), [TYPES_KEY]: next })
    const changed = () => views?.changed?.()

    const colorChoices: Choice[] = TILE_COLORS.map((color) => ({ value: color, label: t(`programmes.color.${color}`), preview: { color } }))
    // Rangées par leur nom : une soixantaine, on s'y retrouve (et la frappe au clavier y mène).
    const iconChoices: Choice[] = PHASE_ICONS.map((icon) => ({ value: icon, label: t(`programmes.icon.${icon}`), preview: { icon } })).sort((a, b) => a.label.localeCompare(b.label))
    const kindChoices = (): Choice[] => [
      { value: FREE_KIND, label: t('programmes.kind.libre'), description: t('programmes.kind.libre.desc') },
      ...phaseKinds().map((kind) => ({ value: kind.id, label: kind.label, ...(kind.description ? { description: kind.description } : {}) }))
    ]
    const nameField = (key: string, label: string, value = ''): FormField => ({ kind: 'text', key, label, required: true, value })

    // ── Programmes ──────────────────────────────────────────────────────────────
    const newProgramme = async (): Promise<string | null> => {
      const values = await ui.askForm({
        title: t('programmes.programme.new'),
        intro: t('programmes.programme.new.intro', { folder: store.root }),
        fields: [
          nameField('name', t('programmes.field.name')),
          { kind: 'text', key: 'code', label: t('programmes.field.code'), placeholder: t('programmes.field.code.placeholder') },
          { kind: 'textarea', key: 'description', label: t('programmes.field.description') },
          { kind: 'choice', key: 'color', label: t('programmes.field.color'), options: colorChoices, value: 'indigo' },
          { kind: 'choice', key: 'icon', label: t('programmes.field.icon'), options: iconChoices, value: 'folder' }
        ],
        submit: t('programmes.programme.create'),
        validate: (entered) => (safeName(entered.name ?? '') ? null : t('programmes.field.name.invalid'))
      })
      if (!values) return null
      const name = safeName(values.name ?? '')
      try {
        const programme = await store.createProgramme(name, {
          code: (values.code ?? '').trim(),
          description: (values.description ?? '').trim(),
          color: TILE_COLORS.includes(values.color as never) ? (values.color as ProjectType['color']) : 'indigo',
          icon: PHASE_ICONS.includes(values.icon as never) ? (values.icon as ProjectType['icon']) : 'folder'
        })
        // Son répertoire dans la bibliothèque des documents projet.
        await projectDocumentsFolder(programme.name)
        notify(t('programmes.programme.created', { name }))
        show(programmePageOf(programme.path))
        return programme.path
      } catch (error) {
        if (error instanceof AlreadyThere) {
          notify(t('programmes.exists', { name }), 8000)
          return null
        }
        throw error
      }
    }

    const editProgramme = async (path: string): Promise<void> => {
      const programme = await store.programme(path)
      if (!programme) return
      const values = await ui.askForm({
        title: t('programmes.programme.edit.title', { name: programme.name }),
        fields: [
          { kind: 'text', key: 'code', label: t('programmes.field.code'), value: programme.code },
          { kind: 'textarea', key: 'description', label: t('programmes.field.description'), value: programme.description },
          { kind: 'choice', key: 'color', label: t('programmes.field.color'), options: colorChoices, value: programme.color },
          { kind: 'choice', key: 'icon', label: t('programmes.field.icon'), options: iconChoices, value: programme.icon }
        ],
        submit: t('programmes.save')
      })
      if (!values) return
      await store.updateProgramme(path, {
        code: (values.code ?? '').trim(),
        description: (values.description ?? '').trim(),
        ...(TILE_COLORS.includes(values.color as never) ? { color: values.color as ProjectType['color'] } : {}),
        ...(PHASE_ICONS.includes(values.icon as never) ? { icon: values.icon as ProjectType['icon'] } : {})
      })
    }

    // ── Projets, affaires ───────────────────────────────────────────────────────
    const newProject = async (programmePath?: string, typeId?: string): Promise<void> => {
      let programmes = await store.programmes()
      // Aucun programme : le premier d'abord.
      if (!programmes.length) {
        notify(t('programmes.project.needProgramme'), 8000)
        if (!(await newProgramme())) return
        programmes = await store.programmes()
      }
      const all = types()
      if (!all.length) {
        notify(t('programmes.project.needType'), 8000)
        show(TYPES_PAGE)
        return
      }
      const values = await ui.askForm({
        title: t('programmes.project.new'),
        intro: t('programmes.project.new.intro'),
        fields: [
          nameField('name', t('programmes.field.name')),
          { kind: 'choice', key: 'programme', label: t('programmes.field.programme'), options: programmes.map((each) => ({ value: each.path, label: each.name })), value: programmePath ?? programmes[0]!.path },
          { kind: 'choice', key: 'type', label: t('programmes.field.type'), tooltip: t('programmes.field.type.tip'), options: all.map((each) => ({ value: each.id, label: each.name, ...(each.description ? { description: each.description } : {}) })), value: typeId ?? all[0]!.id },
          { kind: 'textarea', key: 'description', label: t('programmes.field.description') },
          { kind: 'toggle', key: 'affaire', label: t('programmes.field.withAffaire'), description: t('programmes.field.withAffaire.desc'), value: true },
          { kind: 'text', key: 'client', label: t('programmes.field.client') },
          { kind: 'text', key: 'reference', label: t('programmes.field.reference') }
        ],
        submit: t('programmes.project.create'),
        validate: (entered) => (safeName(entered.name ?? '') ? null : t('programmes.field.name.invalid'))
      })
      if (!values) return
      const name = safeName(values.name ?? '')
      const programme = programmes.find((each) => each.path === values.programme) ?? programmes[0]!
      const type = all.find((each) => each.id === values.type) ?? all[0]!
      try {
        const project = await store.createProject(programme, name, type, (values.description ?? '').trim())
        // Son répertoire dans la bibliothèque des documents projet, sous celui de son programme — et ceux que son type attend.
        const home = await projectDocumentsFolder(programme.name, project.name)
        if (home) for (const each of flatFolders(project.folders)) await platform.fs.ensureFolder(`${home}/${each.path}`)
        // Souvent, un projet est une affaire : la sienne, du même nom.
        if (values.affaire === 'true') await store.createAffaire(project, name, { client: (values.client ?? '').trim(), reference: (values.reference ?? '').trim() })
        notify(t('programmes.project.created', { name, type: type.name }))
        show(projectPageOf(project.path))
      } catch (error) {
        if (error instanceof AlreadyThere) return notify(t('programmes.exists', { name }), 8000)
        throw error
      }
    }

    const newAffaire = async (projectPath: string): Promise<void> => {
      const project = await store.project(projectPath)
      if (!project) return
      const values = await ui.askForm({
        title: t('programmes.affaire.new.title', { project: project.name }),
        fields: [nameField('name', t('programmes.field.name'), (await store.affaires(project)).length ? '' : project.name), { kind: 'text', key: 'client', label: t('programmes.field.client') }, { kind: 'text', key: 'reference', label: t('programmes.field.reference') }],
        submit: t('programmes.affaire.create'),
        validate: (entered) => (safeName(entered.name ?? '') ? null : t('programmes.field.name.invalid'))
      })
      if (!values) return
      const name = safeName(values.name ?? '')
      try {
        await store.createAffaire(project, name, { client: (values.client ?? '').trim(), reference: (values.reference ?? '').trim() })
        notify(t('programmes.affaire.created', { name }))
      } catch (error) {
        if (error instanceof AlreadyThere) return notify(t('programmes.exists', { name }), 8000)
        throw error
      }
    }

    const chooseAffaireStatus = async (path: string): Promise<void> => {
      const chosen = await ui.pickOption(
        AFFAIRE_STATUSES.map((status) => ({ value: status, label: t(`programmes.affaire.status.${status}`) })),
        t('programmes.affaire.setStatus')
      )
      if (chosen) await store.setAffaireStatus(path, chosen as (typeof AFFAIRE_STATUSES)[number])
    }

    // ── Phases d'un projet ──────────────────────────────────────────────────────
    const setPhaseStatus = async (projectPath: string, id: string, status: PhaseStatus): Promise<void> => {
      const project = await store.project(projectPath)
      const phase = project?.phases.find((each) => each.id === id)
      if (!project || !phase) return
      const today = localToday()
      // En cours : commencée aujourd'hui (si rien n'est dit) ; terminée : finie aujourd'hui.
      await store.setPhase(projectPath, id, {
        status,
        ...(status === 'en-cours' && !phase.start ? { start: today } : {}),
        ...(status === 'terminee' && !phase.end ? { end: today } : {})
      })
      notify(t('programmes.status.changed', { name: phase.name, status: t(`programmes.status.${status}`) }), 4000)
      changed()
    }

    /** Une durée saisie : un nombre de jours, entier, positif ou nul ; vide : aucune. */
    const durationOf = (input: string | undefined): number | undefined | null => {
      const text = (input ?? '').trim()
      if (!text) return undefined
      return /^\d{1,4}$/.test(text) ? Number(text) : null
    }
    /** Les types de pièce, pour choisir les documents attendus (plusieurs) ; `null` : renoncé. */
    const pickDocTypes = async (title: string, chosen: readonly string[]): Promise<string[] | null> => {
      const types = libraryPieceTypes()
      const known = new Set(types.map((type) => type.code))
      return ui.pickMany({
        title,
        intro: t('programmes.docs.pick.intro'),
        choices: [...types.map((type) => ({ value: type.code, label: pieceTypeText(type.code) })), ...chosen.filter((code) => !known.has(code)).map((code) => ({ value: code, label: code }))],
        selected: chosen,
        submit: t('programmes.docs.pick.submit'),
        // Un type de document qui manque : le créer d'ici (le module Typage des pièces), coché.
        ...(canCreatePieceType()
          ? {
              create: {
                label: t('programmes.docs.pick.create'),
                run: async () => {
                  const made = await createPieceType()
                  return made ? { value: made.code, label: pieceTypeText(made.code) } : null
                }
              }
            }
          : {})
      })
    }

    const editPhaseDates = async (projectPath: string, id: string): Promise<void> => {
      const project = await store.project(projectPath)
      const phase = project?.phases.find((each) => each.id === id)
      if (!project || !phase) return
      const values = await ui.askForm({
        title: t('programmes.phase.dates.title', { name: phase.name }),
        fields: [
          { kind: 'text', key: 'start', label: t('programmes.field.start'), placeholder: 'AAAA-MM-JJ', calendar: true, value: phase.start ?? '' },
          { kind: 'text', key: 'end', label: t('programmes.field.end'), placeholder: 'AAAA-MM-JJ', calendar: true, value: phase.end ?? '' },
          { kind: 'text', key: 'duration', label: t('programmes.field.duration'), description: t('programmes.field.duration.desc'), value: phase.duration !== undefined ? String(phase.duration) : '' }
        ],
        submit: t('programmes.save'),
        validate: (entered) =>
          !['start', 'end'].every((key) => !(entered[key] ?? '').trim() || /^\d{4}-\d{2}-\d{2}$/.test((entered[key] ?? '').trim())) ? t('programmes.field.date.invalid') : durationOf(entered.duration) === null ? t('programmes.field.duration.invalid') : null
      })
      if (!values) return
      // Sa durée changée : les dates prévues des phases suivantes suivent.
      await store.setPhase(projectPath, id, { start: (values.start ?? '').trim(), end: (values.end ?? '').trim(), duration: durationOf(values.duration) ?? undefined })
    }

    const startProject = async (projectPath: string): Promise<void> => {
      const project = await store.project(projectPath)
      if (!project) return
      const values = await ui.askForm({
        title: t('programmes.project.start.title', { name: project.name }),
        intro: t('programmes.project.start.intro'),
        fields: [{ kind: 'text', key: 'start', label: t('programmes.field.projectStart'), placeholder: 'AAAA-MM-JJ', calendar: true, required: true, value: project.start ?? localToday() }],
        submit: t('programmes.save'),
        validate: (entered) => (/^\d{4}-\d{2}-\d{2}$/.test((entered.start ?? '').trim()) ? null : t('programmes.field.date.invalid'))
      })
      if (!values) return
      const planned = await store.setStart(projectPath, (values.start ?? '').trim())
      const end = planned?.phases.map((phase) => phase.plannedEnd ?? '').sort().at(-1)
      notify(end ? t('programmes.project.started', { name: project.name, end }) : t('programmes.project.startedNoDuration', { name: project.name }), 8000)
    }

    const withDocs = async (projectPath: string, id: string, change: (docs: ExpectedDoc[]) => ExpectedDoc[]): Promise<void> => {
      const phase = (await store.project(projectPath))?.phases.find((each) => each.id === id)
      if (!phase) return
      await store.setPhase(projectPath, id, { documents: change([...(phase.documents ?? [])]) })
    }

    const phaseContext = (project: Project, phase: ProjectPhase): PhaseContext => ({
      project,
      phase,
      link: async (path) => {
        await store.setPhase(project.path, phase.id, { link: path ?? '' })
        changed()
      },
      setStatus: (status) => setPhaseStatus(project.path, phase.id, status)
    })

    // ── Types de projet ─────────────────────────────────────────────────────────
    /** Un type changé ; ses étapes changées (`stages`), ses phases englobantes suivent leurs phases. */
    const withType = async (id: string, change: (type: ProjectType) => ProjectType | null, stages = true): Promise<void> => {
      const all = types()
      const type = all.find((each) => each.id === id)
      if (!type) return
      const changed = change(type)
      if (!changed) return
      const next = stages ? remapSpans(type, changed) : changed
      await saveTypes(all.map((each) => (each.id === id ? next : each)))
    }

    /** La fenêtre d'une phase englobante : son nom, sa couleur, ses première et dernière étapes. */
    const spanForm = async (title: string, type: ProjectType, span?: SpanSpec): Promise<Omit<SpanSpec, 'id'> | null> => {
      const stageChoices: Choice[] = type.stages.map((stage, at) => ({ value: String(at), label: t('programmes.span.stageChoice', { number: at + 1, names: stage.map((phase) => phase.name).join(', ') }) }))
      const values = await ui.askForm({
        title,
        intro: t('programmes.span.intro'),
        fields: [
          nameField('name', t('programmes.field.name'), span?.name ?? ''),
          { kind: 'choice', key: 'from', label: t('programmes.span.from'), options: stageChoices, value: String(span?.from ?? 0) },
          { kind: 'choice', key: 'to', label: t('programmes.span.to'), options: stageChoices, value: String(span?.to ?? Math.min(1, type.stages.length - 1)) },
          { kind: 'choice', key: 'color', label: t('programmes.field.color'), options: colorChoices, value: span?.color ?? 'slate' },
          { kind: 'textarea', key: 'description', label: t('programmes.field.description'), value: span?.description ?? '' }
        ],
        submit: t('programmes.save'),
        validate: (entered) => (!(entered.name ?? '').trim() ? t('programmes.field.name.invalid') : Number(entered.to) < Number(entered.from) ? t('programmes.span.order') : null)
      })
      if (!values) return null
      return {
        name: (values.name ?? '').trim(),
        from: Number(values.from) || 0,
        to: Math.max(Number(values.from) || 0, Number(values.to) || 0),
        color: TILE_COLORS.includes(values.color as never) ? (values.color as SpanSpec['color']) : 'slate',
        ...((values.description ?? '').trim() ? { description: (values.description ?? '').trim() } : {})
      }
    }

    const phaseForm = async (title: string, phase?: PhaseSpec): Promise<Omit<PhaseSpec, 'id'> | null> => {
      const values = await ui.askForm({
        title,
        fields: [
          nameField('name', t('programmes.field.name'), phase?.name ?? ''),
          { kind: 'choice', key: 'kind', label: t('programmes.field.kind'), tooltip: t('programmes.field.kind.tip'), options: kindChoices(), value: phase?.kind ?? FREE_KIND },
          { kind: 'choice', key: 'icon', label: t('programmes.field.icon'), options: iconChoices, value: phase?.icon ?? 'flow' },
          { kind: 'choice', key: 'color', label: t('programmes.field.color'), options: colorChoices, value: phase?.color ?? 'indigo' },
          { kind: 'text', key: 'duration', label: t('programmes.field.duration'), description: t('programmes.field.duration.desc'), value: phase?.duration !== undefined ? String(phase.duration) : '' },
          { kind: 'toggle', key: 'documents', label: t('programmes.field.documents'), description: t('programmes.field.documents.desc'), value: !!phase?.documents?.length },
          { kind: 'textarea', key: 'description', label: t('programmes.field.phaseDescription'), value: phase?.description ?? '' }
        ],
        submit: t('programmes.save'),
        validate: (entered) => (!(entered.name ?? '').trim() ? t('programmes.field.name.invalid') : durationOf(entered.duration) === null ? t('programmes.field.duration.invalid') : null)
      })
      if (!values) return null
      // Des documents attendus : lesquels (plusieurs, au besoin) ; renoncer garde ceux d'avant.
      let documents = phase?.documents ?? []
      if (values.documents === 'true') {
        const types = await pickDocTypes(t('programmes.docs.pick.title', { name: (values.name ?? '').trim() }), documents.map((doc) => doc.type))
        if (types) documents = types.map((type) => documents.find((doc) => doc.type === type) ?? { type })
      } else documents = []
      const duration = durationOf(values.duration)
      // Une sorte d'un module : son icône et sa couleur d'abord, si l'on n'en a pas choisi d'autres.
      const kind = values.kind || FREE_KIND
      const declared = phaseKinds().find((each) => each.id === kind)
      const untouched = !phase && values.icon === 'flow' && values.color === 'indigo'
      return {
        name: (values.name ?? '').trim(),
        kind,
        icon: untouched && declared ? declared.icon : PHASE_ICONS.includes(values.icon as never) ? (values.icon as PhaseSpec['icon']) : 'flow',
        color: untouched && declared ? declared.color : TILE_COLORS.includes(values.color as never) ? (values.color as PhaseSpec['color']) : 'indigo',
        ...((values.description ?? '').trim() ? { description: (values.description ?? '').trim() } : {}),
        ...(typeof duration === 'number' ? { duration } : {}),
        ...(documents.length ? { documents } : {})
      }
    }

    const typeName = async (title: string, value = ''): Promise<{ name: string; description: string } | null> => {
      const values = await ui.askForm({
        title,
        fields: [nameField('name', t('programmes.field.name'), value), { kind: 'textarea', key: 'description', label: t('programmes.field.description') }],
        submit: t('programmes.save'),
        validate: (entered) => ((entered.name ?? '').trim() ? (types().some((each) => each.name === (entered.name ?? '').trim()) ? t('programmes.type.exists') : null) : t('programmes.field.name.invalid'))
      })
      return values ? { name: (values.name ?? '').trim(), description: (values.description ?? '').trim() } : null
    }

    // Les documents de référence : choisis dans la bibliothèque, écrits dans la note ; la fiche d'un document dit qui l'appelle.
    const chooseReferences = async (path: string): Promise<void> => {
      const owner = (await store.programme(path)) ?? (await store.project(path))
      if (!owner) return
      const chosen = await chooseReferenceDocuments(t('programmes.refs.choose.title', { name: owner.name }), owner.references)
      if (!chosen) return
      await store.setReferences(path, chosen)
      notify(t('programmes.refs.saved', { name: owner.name, count: chosen.length }), 5000)
      changed()
    }
    const removeReference = async (path: string, record: string): Promise<void> => {
      const owner = (await store.programme(path)) ?? (await store.project(path))
      if (!owner) return
      await store.setReferences(path, owner.references.filter((each) => each !== record))
      notify(t('programmes.refs.removed', { name: owner.name }), 5000)
      changed()
    }
    stopCallers?.()
    stopCallers = registerReferenceCallers({
      callers: async (record) =>
        (await store.callersOf(record)).map((owner) =>
          'phases' in owner
            ? { title: owner.name, detail: t('programmes.refs.caller.project', { type: owner.typeName }), page: projectPageOf(owner.path), note: owner.path }
            : { title: owner.name, detail: t('programmes.refs.caller.programme'), page: programmePageOf(owner.path), note: owner.path }
        ),
      moved: async (from, to) => void (await store.referenceMoved(from, to))
    })
    // ── Supprimer un projet, un programme ───────────────────────────────────────
    /** Supprimer un projet (après confirmation) : son dossier à la corbeille ; ses documents restent dans la bibliothèque. */
    const deleteProject = async (path: string): Promise<void> => {
      const project = await store.project(path)
      if (!project) return
      const affaires = (await store.affaires(project)).length
      const sure = await ui.confirm({
        title: t('programmes.project.delete.title', { name: project.name }),
        message: t('programmes.project.delete.message', { folder: project.folder, affaires }),
        confirm: t('programmes.project.delete'),
        cancel: t('programmes.cancel'),
        danger: true
      })
      if (!sure) return
      if (!(await store.deleteProject(path))) {
        notify(t('programmes.delete.failed'), 8000)
        return
      }
      notify(t('programmes.project.deleted', { name: project.name }), 8000)
      changed()
      show(programmePageOf(project.programme))
    }
    /** Supprimer un programme (après confirmation) : son dossier, ses projets et leurs affaires, à la corbeille. */
    const deleteProgramme = async (path: string): Promise<void> => {
      const programme = await store.programme(path)
      if (!programme) return
      const projects = await store.projects(programme)
      const affaires = (await Promise.all(projects.map((project) => store.affaires(project)))).flat().length
      const sure = await ui.confirm({
        title: t('programmes.programme.delete.title', { name: programme.name }),
        message: t('programmes.programme.delete.message', { folder: programme.folder, projects: projects.length, affaires }),
        confirm: t('programmes.programme.delete'),
        cancel: t('programmes.cancel'),
        danger: true
      })
      if (!sure) return
      if (!(await store.deleteProgramme(path))) {
        notify(t('programmes.delete.failed'), 8000)
        return
      }
      notify(t('programmes.programme.deleted', { name: programme.name, projects: projects.length }), 8000)
      changed()
      show(PROGRAMMES_PAGE)
    }

    // ── Se passer des types de projet ───────────────────────────────────────────
    /** Exporter un type (ou tous) : un fichier JSON dans `Échanges/Types de projet`, à se passer. */
    const exportTypes = async (id?: string): Promise<void> => {
      const chosen = id ? types().filter((each) => each.id === id) : types()
      if (!chosen.length) {
        notify(t('programmes.types.exchange.empty'))
        return
      }
      const day = localToday()
      await platform.fs.ensureFolder(TYPES_EXCHANGE_FOLDER)
      const base = typesFileName(day, id ? chosen[0]!.name : undefined).replace(/\.json$/, '')
      let path = `${TYPES_EXCHANGE_FOLDER}/${base}.json`
      for (let index = 2; await platform.fs.exists(path); index++) path = `${TYPES_EXCHANGE_FOLDER}/${base} (${index}).json`
      await platform.fs.writeText(path, typesFile(chosen, day))
      const hidden = platform.display?.kind('json') === 'hidden'
      notify([t('programmes.types.exchange.exported', { count: chosen.length, path }), ...(hidden ? [t('programmes.types.exchange.hidden')] : [])].join(' '), hidden ? 15000 : 10000)
    }
    /** Importer des types : un fichier (de l'ordinateur ou du coffre) ; déjà là à l'identique, pas une seconde fois. */
    const importTypes = async (): Promise<void> => {
      const source = await ui.pickOption(
        [
          { value: 'computer', label: t('programmes.types.exchange.computer'), description: t('programmes.types.exchange.computer.desc') },
          { value: 'vault', label: t('programmes.types.exchange.vault'), description: t('programmes.types.exchange.vault.desc') }
        ],
        t('programmes.types.exchange.from')
      )
      let text: string | null = null
      if (source === 'computer') {
        const file = (await ui.pickExternalFiles({ accept: ['json'], multiple: false }))[0]
        if (file) text = new TextDecoder().decode(file.bytes)
      } else if (source === 'vault') {
        const path = await ui.pickFile({ extensions: ['json'], placeholder: t('programmes.types.exchange.vault.pick') })
        if (path) text = await platform.fs.readText(path)
      }
      if (text === null) return
      const read = readTypesFile(text)
      if (read === 'unreadable' || read === 'other') {
        notify(t(read === 'unreadable' ? 'programmes.types.exchange.unreadable' : 'programmes.types.exchange.other'), 8000)
        return
      }
      const merged = mergeTypes(types(), read, t('programmes.types.exchange.suffix'))
      if (merged.added.length) await saveTypes(merged.types)
      notify(t('programmes.types.exchange.imported', { added: merged.added.length, already: merged.already.length }), 8000)
      changed()
      show(merged.added.length === 1 ? typePageOf(merged.added[0]!.id) : TYPES_PAGE)
    }

    registerProgrammesHome(views ?? { home: () => undefined, nav: () => undefined, tile: () => undefined, page: () => undefined }, {
      t,
      store,
      types,
      referencesAvailable: () => libraryActive(),
      projectDocuments: async (programme, project) => {
        const folder = await projectDocumentsFolder(programme, project)
        // Ceux du projet, où qu'ils soient sous son répertoire ; ceux du programme, à sa racine (pas ceux de ses projets).
        return folder ? { folder, docs: await documentsIn(folder, !!project), page: libraryFolderPage(folder) } : null
      },
      pourProjectDocuments: async (folder) => {
        await pourDocumentsInto(folder)
        changed()
      },
      dropProjectDocuments: async (folder, files) => {
        await dropDocumentsInto(folder, files)
        changed()
      },
      referenceDoc: (record) => libraryDocument(record),
      chooseReferences,
      removeReference,
      ...(context.showPage ? { showReference: (record: string) => context.showPage?.(libraryDocPage(record)) } : {}),
      ...(context.showPage ? { showPage: (page: string) => context.showPage?.(page) } : {}),
      openNote: (path) => (context.showNote ? context.showNote(path) : ui.openNote(path)),
      newProgramme: async () => void (await newProgramme()),
      editProgramme,
      newProject,
      newAffaire,
      chooseAffaireStatus,
      setPhaseStatus,
      editPhaseDates,
      phaseContext,
      today: localToday,
      docLabel: pieceTypeText,
      startProject,
      chooseDocuments: async (projectPath, id) => {
        const phase = (await store.project(projectPath))?.phases.find((each) => each.id === id)
        if (!phase) return
        const types = await pickDocTypes(t('programmes.docs.pick.title', { name: phase.name }), (phase.documents ?? []).map((doc) => doc.type))
        if (types) await withDocs(projectPath, id, (docs) => types.map((type) => docs.find((doc) => doc.type === type) ?? { type }))
      },
      setDocument: (projectPath, id, index, received) =>
        withDocs(projectPath, id, (docs) =>
          docs.map((doc, at) => {
            if (at !== index) return doc
            if (received) return { ...doc, received: true, on: localToday() }
            const rest: ExpectedDoc = { ...doc }
            delete rest.received
            delete rest.on
            return rest
          })
        ),
      linkDocument: async (projectPath, id, index) => {
        const path = await ui.pickFile({ placeholder: t('programmes.docs.link.placeholder') })
        if (path) await withDocs(projectPath, id, (docs) => docs.map((doc, at) => (at === index ? { ...doc, link: path, received: true, on: doc.on ?? localToday() } : doc)))
      },
      exportTypes,
      importTypes,
      ...(store.canDelete ? { deleteProject, deleteProgramme } : {}),
      newType: async () => {
        const named = await typeName(t('programmes.type.new'))
        if (!named) return
        const all = types()
        const type = { ...newType(all, named.name, t), ...(named.description ? { description: named.description } : {}) }
        await saveTypes([...all, type])
        show(typePageOf(type.id))
      },
      editType: async (id) => {
        const type = types().find((each) => each.id === id)
        if (!type) return
        const values = await ui.askForm({
          title: t('programmes.type.edit.title', { name: type.name }),
          fields: [
            nameField('name', t('programmes.field.name'), type.name),
            { kind: 'textarea', key: 'description', label: t('programmes.field.description'), value: type.description ?? '' },
            { kind: 'choice', key: 'icon', label: t('programmes.field.icon'), options: iconChoices, value: type.icon },
            { kind: 'choice', key: 'color', label: t('programmes.field.color'), options: colorChoices, value: type.color }
          ],
          submit: t('programmes.save'),
          validate: (entered) => ((entered.name ?? '').trim() ? null : t('programmes.field.name.invalid'))
        })
        if (!values) return
        await withType(id, (current) => {
          const next: ProjectType = {
            ...current,
            name: (values.name ?? '').trim(),
            icon: PHASE_ICONS.includes(values.icon as never) ? (values.icon as ProjectType['icon']) : current.icon,
            color: TILE_COLORS.includes(values.color as never) ? (values.color as ProjectType['color']) : current.color
          }
          if ((values.description ?? '').trim()) next.description = (values.description ?? '').trim()
          else delete next.description
          return next
        })
      },
      copyType: async (id) => {
        const all = types()
        const type = all.find((each) => each.id === id)
        if (!type) return
        const named = await typeName(t('programmes.type.copy'), t('programmes.type.copyName', { name: type.name }))
        if (!named) return
        const copy = { ...copyType(all, type, named.name), ...(named.description ? { description: named.description } : {}) }
        await saveTypes([...all, copy])
        show(typePageOf(copy.id))
      },
      deleteType: async (id) => {
        const type = types().find((each) => each.id === id)
        if (!type) return
        const sure = await ui.confirm({ title: t('programmes.type.delete.title', { name: type.name }), message: t('programmes.type.delete.message'), confirm: t('programmes.type.delete'), cancel: t('programmes.cancel'), danger: true })
        if (!sure) return
        await saveTypes(types().filter((each) => each.id !== id))
        show(TYPES_PAGE)
      },
      editTypePhase: async (typeId, phaseId) => {
        const phase = types()
          .find((each) => each.id === typeId)
          ?.stages.flat()
          .find((each) => each.id === phaseId)
        if (!phase) return
        const fields = await phaseForm(t('programmes.type.phase.edit.title', { name: phase.name }), phase)
        if (fields) await withType(typeId, (type) => replacePhase(type, phaseId, fields))
      },
      addTypePhase: async (typeId, stage) => {
        const fields = await phaseForm(stage === 'new' ? t('programmes.type.addStage') : t('programmes.type.addParallel'))
        if (!fields) return
        await withType(typeId, (type) => {
          const phase = newPhase(type, fields)
          return stage === 'new' ? addStage(type, phase) : addParallel(type, stage, phase)
        })
      },
      moveTypePhase: (typeId, phaseId, direction) => withType(typeId, (type) => movePhase(type, phaseId, direction)),
      addTypeSpan: async (typeId) => {
        const type = types().find((each) => each.id === typeId)
        if (!type) return
        const fields = await spanForm(t('programmes.span.add.title'), type)
        if (fields) await withType(typeId, (current) => addSpan(current, fields), false)
      },
      editTypeSpan: async (typeId, spanId) => {
        const type = types().find((each) => each.id === typeId)
        const span = type?.spans?.find((each) => each.id === spanId)
        if (!type || !span) return
        const fields = await spanForm(t('programmes.span.edit.title', { name: span.name }), type, span)
        if (fields) await withType(typeId, (current) => updateSpan(current, spanId, fields), false)
      },
      // Les répertoires des documents d'un type.
      addTypeFolder: async (typeId, parent) => {
        const type = types().find((each) => each.id === typeId)
        const inside = parent ? findFolder(type?.folders ?? [], parent) : null
        const values = await ui.askForm({
          title: inside ? t('programmes.folders.addSub', { name: inside.name }) : t('programmes.folders.add'),
          intro: t('programmes.folders.add.intro'),
          fields: [nameField('name', t('programmes.field.name'))],
          submit: t('programmes.save')
        })
        const name = safeName(values?.name ?? '')
        if (!name) return
        await withType(typeId, (each) => addFolder(each, parent, name), false)
        changed()
      },
      renameTypeFolder: async (typeId, folderId) => {
        const folder = findFolder(types().find((each) => each.id === typeId)?.folders ?? [], folderId)
        if (!folder) return
        const values = await ui.askForm({ title: t('programmes.folders.rename'), fields: [nameField('name', t('programmes.field.name'), folder.name)], submit: t('programmes.save') })
        const name = safeName(values?.name ?? '')
        if (!name) return
        await withType(typeId, (each) => updateFolder(each, folderId, { name }), false)
        changed()
      },
      chooseFolderExpects: async (typeId, folderId) => {
        const folder = findFolder(types().find((each) => each.id === typeId)?.folders ?? [], folderId)
        if (!folder) return
        const chosen = await pickDocTypes(t('programmes.folders.expects.title', { name: folder.name }), folder.expects ?? [])
        if (!chosen) return
        await withType(typeId, (each) => updateFolder(each, folderId, { expects: chosen }), false)
        changed()
      },
      removeTypeFolder: async (typeId, folderId) => {
        const folder = findFolder(types().find((each) => each.id === typeId)?.folders ?? [], folderId)
        if (!folder) return
        const sure = await ui.confirm({ title: t('programmes.folders.remove.title', { name: folder.name }), message: t('programmes.folders.remove.message'), confirm: t('programmes.folders.remove'), cancel: t('programmes.cancel'), danger: true })
        if (!sure) return
        await withType(typeId, (each) => removeFolder(each, folderId), false)
        changed()
      },
      ensureProjectFolders: async (folder, paths) => {
        for (const path of paths) await platform.fs.ensureFolder(`${folder}/${path}`)
      },
      folderPage: (folder) => libraryFolderPage(folder),
      removeTypeSpan: async (typeId, spanId) => {
        const span = types()
          .find((each) => each.id === typeId)
          ?.spans?.find((each) => each.id === spanId)
        if (!span) return
        const sure = await ui.confirm({ title: t('programmes.span.remove.title', { name: span.name }), message: t('programmes.span.remove.message'), confirm: t('programmes.span.remove'), cancel: t('programmes.cancel'), danger: true })
        if (sure) await withType(typeId, (type) => removeSpan(type, spanId), false)
      },
      removeTypePhase: async (typeId, phaseId) => {
        const phase = types()
          .find((each) => each.id === typeId)
          ?.stages.flat()
          .find((each) => each.id === phaseId)
        if (!phase) return
        const sure = await ui.confirm({ title: t('programmes.type.phase.remove.title', { name: phase.name }), message: t('programmes.type.phase.remove.message'), confirm: t('programmes.type.phase.remove'), cancel: t('programmes.cancel'), danger: true })
        if (sure) await withType(typeId, (type) => removePhase(type, phaseId))
      }
    })

    context.commands.register({ id: 'nouveau-programme', nameKey: 'programmes.command.newProgramme', run: async () => void (await newProgramme()) })
    context.commands.register({ id: 'nouveau-projet', nameKey: 'programmes.command.newProject', run: () => newProject() })
    context.commands.register({ id: 'types', nameKey: 'programmes.command.types', run: () => show(TYPES_PAGE) })
  },
  deactivate() {
    active = null
    stopCallers?.()
    stopCallers = null
  }
}
