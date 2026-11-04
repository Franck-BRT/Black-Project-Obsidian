// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les textes du module Lecture de fichiers. Toutes les clés commencent par `lecture-fichiers.`. */
export const lectureFr: Record<string, string> = {
  'lecture-fichiers.name': 'Lecture de fichiers',
  'lecture-fichiers.description':
    'Lit le texte des documents — PDF, Word, Excel, PowerPoint, RTF, HTML, Markdown, texte — pour les autres modules. Sans dépendance externe, sans réseau.',
  'lecture-fichiers.command.read': 'Lire un fichier du coffre (provisoire)',
  'lecture-fichiers.pick.placeholder': 'Choisis un fichier à lire…',
  'lecture-fichiers.reading': 'Lecture de « {name} »…',
  'lecture-fichiers.result.subtitle': '{format} · {characters} caractères · {lines} lignes · lu en {ms} ms',
  'lecture-fichiers.problem.unsupported': '« {name} » : le format {format} n’est pas lu.',
  'lecture-fichiers.problem.empty': '« {name} » ne contient aucun texte à lire : un scan, ou un document vide.',
  'lecture-fichiers.problem.unreadable':
    '« {name} » n’a pas pu être lu : fichier abîmé, ou protégé par un mot de passe.'
}

export const lectureEn: Record<string, string> = {
  'lecture-fichiers.name': 'File reading',
  'lecture-fichiers.description':
    'Reads the text of documents — PDF, Word, Excel, PowerPoint, RTF, HTML, Markdown, text — for the other modules. No external dependency, no network.',
  'lecture-fichiers.command.read': 'Read a file from the vault (preview)',
  'lecture-fichiers.pick.placeholder': 'Pick a file to read…',
  'lecture-fichiers.reading': 'Reading “{name}”…',
  'lecture-fichiers.result.subtitle': '{format} · {characters} characters · {lines} lines · read in {ms} ms',
  'lecture-fichiers.problem.unsupported': '“{name}”: the {format} format is not read.',
  'lecture-fichiers.problem.empty': '“{name}” holds no text to read: a scan, or an empty document.',
  'lecture-fichiers.problem.unreadable': '“{name}” could not be read: damaged, or protected by a password.'
}
