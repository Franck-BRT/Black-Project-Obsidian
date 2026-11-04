// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les textes du cœur, en français : la langue de référence. */
export const fr: Record<string, string> = {
  'app.name': 'Black Projects',
  'app.byline': 'by Black Room Technologies',

  'command.about': 'À propos de Black Projects',
  'about.notice': 'Black Projects {version} — {active} module(s) actif(s) sur {total}. {licence}',

  'ui.copy': 'Copier',
  'ui.copied': 'Texte copié.',

  'settings.general': 'Général',
  'settings.language': 'Langue',
  'settings.language.desc': "Langue de l'interface de Black Projects.",
  'settings.language.fr': 'Français',
  'settings.language.en': 'English',
  'settings.languageReload': 'La nouvelle langue sera appliquée au prochain chargement du plugin.',

  'settings.modules': 'Modules',
  'settings.modules.desc':
    "Les fonctions de Black Projects sont rangées en modules. Un module désactivé n'est plus chargé ; vos données restent dans le coffre.",
  'settings.modules.reload': 'Le changement sera appliqué au prochain chargement du plugin.',
  'settings.modules.requires': 'Nécessite : {modules}',

  'settings.licence': 'Licence',
  'settings.licence.evaluation': 'Version d’évaluation : tous les modules sont ouverts.',
  'settings.licence.licensed': 'Licence accordée à {holder}.',
  'settings.licence.expires': 'Échéance : {date}.',
  'settings.licence.noExpiry': 'Sans échéance.',
  'settings.licence.owner': 'Logiciel propriétaire © 2026 Black Room Technologies. Tous droits réservés.',

  'module.state.active': 'Actif',
  'module.state.disabled': 'Désactivé',
  'module.state.not-licensed': 'Non couvert par la licence',
  'module.state.missing-dependency': 'Module requis indisponible',
  'module.state.failed': 'Erreur au chargement',
  'module.state.pending': 'En attente',
  'module.failed.notice': 'Black Projects : le module « {name} » n’a pas pu se charger. Les autres fonctionnent.'
}
