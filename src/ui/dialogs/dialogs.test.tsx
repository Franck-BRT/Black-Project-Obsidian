// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les fenêtres rendues en texte : structure, libellés, rôles pour les lecteurs d'écran. */

import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE } from '../../core/appearance'
import { createI18n } from '../../core/i18n'
import type { ModuleDescriptor } from '../../core/modules/module'
import { ModuleFunctionsPage, ModuleWindow, type ModuleWindowHost } from './moduleWindow'
import { ChoicePicker, ConfirmDialog, FormDialog, ListDialog, PickManyDialog } from './windows'
import { MODULE_PAGE } from '../../core/settingsPage'
import { App } from '../shell'

const i18n = createI18n('fr')
const t = i18n.t.bind(i18n)
const noop = () => undefined

describe('les fenêtres du port Ui', () => {
  it('un choix : une liste d’options, la première active, l’aide au clavier', () => {
    const html = renderToString(<ChoicePicker choices={[{ value: 'a', label: 'Alpha', description: 'premier' }, { value: 'b', label: 'Bêta' }]} title="Choisir une analyse" t={t} onPick={noop} />)
    expect(html).toContain('role="dialog" aria-modal="true"')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('role="listbox"')
    expect(html).toMatch(/id="bp-option-0" role="option" aria-selected="true"[^>]*><span>Alpha<\/span><small>premier<\/small>/)
    expect(html).toContain('↑ ↓ pour parcourir')
  })

  it('un formulaire : chaque champ a son libellé lié, l’obligatoire est marqué, interrupteur et liste', () => {
    const html = renderToString(
      <FormDialog
        form={{
          title: 'Nouvelle exigence',
          intro: 'Une exigence par note.',
          fields: [
            { kind: 'text', key: 'title', label: 'Titre', required: true, placeholder: 'Maintien' },
            { kind: 'textarea', key: 'text', label: 'Formulation', description: 'Une obligation.' },
            { kind: 'choice', key: 'type', label: 'Type', options: [{ value: 'perf', label: 'Performance' }] },
            { kind: 'toggle', key: 'on', label: 'Active', value: true }
          ],
          submit: 'Créer'
        }}
        t={t}
        onDone={noop}
      />
    )
    expect(html).toContain('<label class="bp-field-label" for="bp-field-title">Titre<span aria-hidden="true"> *</span></label>')
    expect(html).toContain('id="bp-field-title"')
    expect(html).toContain('aria-required="true"')
    expect(html).toContain('aria-describedby="bp-field-text-desc"')
    expect(html).toMatch(/<select class="bp-select" id="bp-field-type"/)
    expect(html).toMatch(/type="checkbox" role="switch" id="bp-field-on"[^>]*checked/)
    expect(html).toContain('>Annuler</button>')
    expect(html).toContain('>Créer</button>')
  })

  it('une liste de couleurs ou d’icônes : celle choisie montrée à côté ; une liste sans aperçu, seule', () => {
    const html = renderToString(
      <FormDialog
        form={{
          title: 'Programme',
          fields: [
            { kind: 'choice', key: 'color', label: 'Couleur', value: 'violet', options: [{ value: 'indigo', label: 'Indigo', preview: { color: 'indigo' } }, { value: 'violet', label: 'Violet', preview: { color: 'violet' } }] },
            { kind: 'choice', key: 'icon', label: 'Icône', value: 'star', options: [{ value: 'folder', label: 'Dossier', preview: { icon: 'folder' } }, { value: 'star', label: 'Étoile', preview: { icon: 'star' } }] },
            { kind: 'choice', key: 'plain', label: 'Sorte', options: [{ value: 'a', label: 'A' }] }
          ],
          submit: 'Créer'
        }}
        t={t}
        onDone={noop}
      />
    )
    expect(html).toMatch(/<div class="bp-input-row"><select class="bp-select" id="bp-field-color"[\s\S]*?<\/select><span class="bp-choice-preview bp-tile-violet" aria-hidden="true" data-preview="color"><\/span><\/div>/)
    expect(html).toMatch(/<span class="bp-choice-preview" aria-hidden="true" data-preview="icon"><svg[^>]*class="bp-icon/)
    expect(html).not.toContain('data-preview="plain"')
  })

  it('un champ de date : le calendrier à côté (la date écrite AAAA-MM-JJ y est montrée) ; sans calendrier, le champ seul', () => {
    const html = renderToString(
      <FormDialog
        form={{
          title: 'Date',
          fields: [
            { kind: 'text', key: 'date', label: 'Date du document', value: '2026-03-12', calendar: true },
            { kind: 'text', key: 'other', label: 'Autre', value: '12 mars 2026', calendar: true },
            { kind: 'text', key: 'plain', label: 'Titre' }
          ],
          submit: 'Enregistrer'
        }}
        t={t}
        onDone={noop}
      />
    )
    expect(html).toMatch(/<div class="bp-input-row"><input class="bp-input" type="text" id="bp-field-date"[^>]*><span class="bp-calendar"><button type="button" class="bp-button bp-button-icon" title="Choisir dans le calendrier" aria-label="Choisir dans le calendrier">/)
    expect(html).toMatch(/class="bp-calendar-picker" type="date" tabindex="-1" aria-hidden="true" value="2026-03-12"/)
    // Écrite autrement : le calendrier s'ouvre sans date choisie.
    expect(html).toMatch(/id="bp-field-other"[^]*?type="date" tabindex="-1" aria-hidden="true" value\/>/)
    expect(html.match(/bp-input-row/g)).toHaveLength(2)
    expect(html).toMatch(/<input class="bp-input" type="text" id="bp-field-plain"/)
  })

  it('une confirmation qui détruit : le bouton rouge, le focus sur « Annuler »', () => {
    const html = renderToString(<ConfirmDialog view={{ title: 'Supprimer', message: 'Sûr ?', confirm: 'Supprimer', cancel: 'Annuler', danger: true }} t={t} onDone={noop} />)
    expect(html).toContain('data-autofocus="true">Annuler</button>')
    expect(html).toContain('class="bp-button bp-button-danger"')
  })

  it('une liste : recherche, filtres nommés, compte, en-têtes de colonnes, lignes atteignables au clavier', () => {
    const html = renderToString(
      <ListDialog
        view={{
          title: 'Exigences (2)',
          columns: [
            { key: 'id', label: 'Identifiant', width: 'narrow' },
            { key: 'text', label: 'Formulation', width: 'wide' }
          ],
          rows: [
            { id: '1', cells: { id: 'REQ-1', text: 'Le système doit…' }, values: { status: 'draft' }, flags: ['traduction en retard'] },
            { id: '2', cells: { id: 'REQ-2', text: 'La station doit…' }, values: { status: 'approved' } }
          ],
          filters: [{ key: 'status', label: 'Tous statuts', options: [{ value: 'draft', label: 'Brouillon' }] }],
          empty: 'Aucune.',
          actions: [{ value: 'new', label: 'Nouvelle exigence', cta: true }],
          state: { search: '', filters: { status: 'draft' } }
        }}
        t={t}
        onDone={noop}
      />
    )
    expect(html).toContain('<select class="bp-select" aria-label="Tous statuts"')
    expect(html).toContain('1 sur 2')
    expect(html).toContain('<th scope="col" class="is-narrow">Identifiant</th>')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('<span class="bp-flag">traduction en retard</span>')
    expect(html).not.toContain('REQ-2')
  })

  it('des cases à cocher : un groupe nommé, le compte, Tout et Rien', () => {
    const html = renderToString(<PickManyDialog view={{ title: 'Exigences à importer', choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], selected: ['a'], submit: 'Importer' }} t={t} onDone={noop} />)
    expect(html).toContain('<legend class="bp-sr">Exigences à importer</legend>')
    expect(html).toContain('1 coché(s) sur 2')
    expect(html).toContain('>Tout</button>')
  })
})

describe('la fenêtre « Fonctions » d’un module', () => {
  const module: ModuleDescriptor = {
    id: 'essai',
    nameKey: 'Essai',
    descriptionKey: 'Un module d’essai.',
    version: '1.0.0',
    requires: [],
    texts: { fr: {}, en: {} },
    settingsFields: [
      { kind: 'text', key: 'adresse', nameKey: 'Adresse', defaultValue: '', normalize: (value) => value.trim() },
      { kind: 'text', key: 'modele', nameKey: 'Modèle', defaultValue: '', normalize: (value) => value.trim(), choices: () => ['m1', 'm2'] },
      { kind: 'boolean', key: 'rappel', nameKey: 'Rappel', defaultValue: true },
      { kind: 'secret', secretId: 'cle', nameKey: 'Clé' },
      { kind: 'actions', nameKey: 'Connexion', actions: [{ commandId: 'tester', labelKey: 'Tester' }] },
      {
        kind: 'mapping',
        key: 'paires',
        nameKey: 'Extensions équivalentes',
        connectorKey: 'lu comme',
        prefix: '.',
        options: () => ['xml', 'txt'],
        normalize: (value) => value.trim(),
        validate: () => null,
        read: () => ({ tot: 'xml' }),
        editable: true
      }
    ],
    details: () => ({
      titleKey: 'Fonctions',
      sections: [
        {
          titleKey: 'Lecture',
          features: [
            { labelKey: 'PDF', status: 'available', facts: [{ labelKey: 'Lu', values: [{ textKey: 'Oui', tone: 'yes' }] }], switch: { settingsKey: 'montres', id: 'pdf', listed: 'on' } },
            { labelKey: 'Scans', status: 'in-progress', step: 7 }
          ]
        }
      ]
    })
  }
  const host: ModuleWindowHost = {
    t: (key) => key,
    appearance: () => DEFAULT_APPEARANCE,
    hostIsDark: () => false,
    notify: noop,
    document: undefined as unknown as Document,
    module,
    settings: () => ({ modele: 'm2', montres: ['pdf'] }),
    save: async () => undefined,
    runCommand: async () => undefined,
    secrets: { get: () => null, set: noop },
    dialogs: {} as ModuleWindowHost['dialogs']
  }

  it('chaque réglage et chaque fiche, avec leurs contrôles nommés', () => {
    const html = renderToString(<ModuleWindow host={host} onClose={noop} />)
    expect(html).toContain('Essai — Fonctions')
    expect(html).toContain('<label class="bp-block-title" for="bp-text-adresse">Adresse</label>')
    expect(html).toMatch(/<select id="bp-text-modele"[^>]*>.*<option selected value="m2">m2<\/option>.*settings.choices.type/)
    expect(html).toMatch(/role="switch" aria-label="Rappel"[^>]*checked/)
    expect(html).toContain('type="password"')
    expect(html).toContain('>Tester</button>')
    expect(html).toContain('<strong>.tot</strong> lu comme .xml')
    expect(html).toContain('aria-label="tip.mapping.edit .tot"')
    expect(html).toMatch(/bp-feature-card bp-tone-success.*role="switch" aria-label="PDF"[^>]*checked/)
    expect(html).toContain('module.feature.in-progress · module.feature.step')
  })
  it('en page dans l’onglet : le même contenu, sans cadre de fenêtre ; ce que fait le module en tête', () => {
    const html = renderToString(<ModuleFunctionsPage host={host} />)
    expect(html).not.toContain('role="dialog"')
    expect(html).toMatch(/^<div class="bp-page bp-module-page" data-page="module-essai"><p class="bp-page-sub">Un module d’essai\.<\/p><div class="bp-page-body">/)
    expect(html).toContain('<label class="bp-block-title" for="bp-text-adresse">Adresse</label>')
    expect(html).toMatch(/role="switch" aria-label="Rappel"[^>]*checked/)
    expect(html).toContain('>Tester</button>')
    expect(html).toMatch(/bp-feature-card bp-tone-success.*role="switch" aria-label="PDF"[^>]*checked/)
  })

  it('dans l’interface : « core.fonctions?essai » montre la page, titrée comme la fenêtre ; les paramètres sont « page en cours »', () => {
    const app = (page: string) =>
      renderToString(
        <App
          host={{
            t: (key) => key,
            locale: 'fr-FR',
            version: '0.34.0',
            sections: () => [],
            pages: () => [],
            tiles: () => [],
            homeTiles: () => null,
            saveHomeTiles: async () => undefined,
            dashboard: () => null,
            saveDashboard: async () => undefined,
            nav: () => [],
            navMenu: () => null,
            saveNavMenu: async () => undefined,
            openSettings: noop,
            settingsPage: 'core.parametres',
            moduleWindow: (id) => (id === 'essai' ? host : null),
            appearance: () => DEFAULT_APPEARANCE,
            saveAppearance: async () => undefined,
            hostIsDark: () => false,
            now: () => new Date('2026-11-06T09:30:00')
          }}
          generation={0}
          page={page}
        />
      )
    const html = app(`${MODULE_PAGE}?essai`)
    expect(MODULE_PAGE).toBe('core.fonctions')
    expect(html).toMatch(/<h1 class="bp-hello"><svg[^>]*>.*?<\/svg>Essai — Fonctions<\/h1>/)
    expect(html).toContain('data-page="module-essai"')
    expect(html).toMatch(/<button type="button" class="bp-nav-item" aria-current="page">.*?home\.nav\.settings<\/button>/)
    // Un module inconnu (désactivé, retiré) : l'accueil.
    expect(app(`${MODULE_PAGE}?inconnu`)).not.toContain('bp-module-page')
  })
})
