# Module Bibliothèque de documents

Tout fichier déposé dans l'application est rangé ici, une fois, avec sa fiche (une note).

- `model.ts` — un document (`LibraryDoc`), sa famille (extension), son titre, sa catégorie
  devinée, la clé de version d'un nom, l'écriture et la lecture de sa fiche.
- `store.ts` — `LibraryStore` : parcourir la bibliothèque, **verser** (empreinte, doublons,
  copie ou en place, version probable), relier les versions, retirer (mis de côté).
- `hash.ts` — l'empreinte SHA-256.
- `home.ts` — le tableau de bord, la page Bibliothèque, la fiche d'un document.
- `index.ts` — le module et son interface publique : `pourIntoLibrary(items, origine)`,
  que les autres modules appellent ; sans ce module actif, l'appel ne fait rien.

Les fiches portent `bp-type: bibliotheque-document`. Les fichiers venus de l'ordinateur
sont dans `_fichiers` ; les documents retirés, dans `_retirés` (rien n'est effacé).
