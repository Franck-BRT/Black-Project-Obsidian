// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** The core's texts, in English. Every key must exist in `fr.ts`. */
export const en: Record<string, string> = {
  'app.name': 'Black Projects',
  'app.byline': 'by Black Room Technologies',

  'command.about': 'About Black Projects',
  'about.notice': 'Black Projects {version} — {active} of {total} module(s) active. {licence}',

  'ui.copy': 'Copy',
  'ui.copied': 'Text copied.',

  'settings.general': 'General',
  'settings.language': 'Language',
  'settings.language.desc': 'Language of the Black Projects interface.',
  'settings.language.fr': 'Français',
  'settings.language.en': 'English',
  'settings.languageReload': 'The new language applies the next time the plugin loads.',

  'settings.modules': 'Modules',
  'settings.modules.desc':
    'Black Projects features come as modules. A disabled module is no longer loaded; your data stays in the vault.',
  'settings.modules.reload': 'The change applies the next time the plugin loads.',
  'settings.modules.requires': 'Requires: {modules}',

  'settings.licence': 'Licence',
  'settings.licence.evaluation': 'Evaluation version: every module is available.',
  'settings.licence.licensed': 'Licensed to {holder}.',
  'settings.licence.expires': 'Expires: {date}.',
  'settings.licence.noExpiry': 'No expiry.',
  'settings.licence.owner': 'Proprietary software © 2026 Black Room Technologies. All rights reserved.',

  'module.state.active': 'Active',
  'module.state.disabled': 'Disabled',
  'module.state.not-licensed': 'Not covered by the licence',
  'module.state.missing-dependency': 'Required module unavailable',
  'module.state.failed': 'Failed to load',
  'module.state.pending': 'Pending',
  'module.failed.notice': 'Black Projects: the “{name}” module could not load. Everything else works.'
}
