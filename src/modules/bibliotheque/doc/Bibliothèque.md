# Bibliothèque de documents

Tout fichier déposé dans Black Projects est rangé dans la **bibliothèque**, une fois, avec
sa **fiche** : une note qui dit ce qu'il est et d'où il vient.

## 1. Ce qui y entre

- les **pièces** importées dans une analyse d'appel d'offres (y compris celles d'une
  archive ZIP, et celles déposées à la main dans ses originaux, à « Mettre à jour
  l'analyse ») ;
- le fichier d'où l'on **importe des exigences** ;
- les **échanges** de types de pièces et de workflows (fichiers JSON) ;
- ce que vous y **versez** vous-même : bouton **Verser des documents**, depuis
  l'ordinateur ou le coffre.

Un fichier venu de l'ordinateur est **copié** dans la bibliothèque (dossier
`_fichiers`) ; un fichier déjà dans le coffre — une pièce d'analyse — **reste où il est**,
la fiche le désigne.

Un **même fichier** (mêmes octets, quel que soit son nom) n'entre qu'une fois : sa fiche
note seulement qu'il revient d'ailleurs (ses origines s'ajoutent).

## 2. La fiche d'un document

- son **titre** (tiré du nom du fichier), sa **famille** (PDF, textes, tableurs,
  présentations, images, messages, notes, autres), sa **catégorie** — devinée au nom du
  fichier (CCTP, RC, Plan, Devis, Compte rendu…), ou le type de pièce donné par l'analyse —,
  sa référence, son édition, sa révision, son émetteur, ses étiquettes : **Classer…** ;
- **le fichier** : où il est, s'il a été copié ou laissé à sa place, son empreinte ;
- **d'où il vient** : chaque origine — l'analyse, l'import —, un clic y mène ;
- **ses versions** : les précédentes et les suivantes, reliées.

## 3. Les versions

Un document dont le nom ne diffère d'un autre que par une marque de version (« ind B »,
« rev 2 », « v3 », « ed 1 ») et dont le contenu est autre est une **nouvelle version
probable** : sa fiche le dit, avec **Relier comme nouvelle version** ou **Ce n'en est pas
une**. **Nouvelle version de…** relie à la main. Un document remplacé le dit, et mène au
plus récent ; le filtre **Dernières versions** les cache.

## 4. La page Bibliothèque

Menu **Bibliothèque** (ou sa tuile, ou le tableau de bord) : les chiffres (documents,
taille, ajoutés cette semaine, versions à relier), une carte par document, le plus récent
d'abord ; une recherche (titre, fichier, catégorie, référence, origine) et des filtres :
par famille, par origine, dernières versions, versions à relier, fichiers introuvables.

**Retirer de la bibliothèque** met la fiche de côté (dossier `_retirés`), avec le fichier
s'il avait été copié ; rien n'est effacé, et une pièce d'analyse n'est pas touchée.

## 5. Automatiser

Le déclencheur de workflow **Bibliothèque : document versé** (titre, famille, catégorie,
fichier, module d'origine) — voir {{link:Modules/Workflows|Workflows}}.

## 6. Réglages

**Dossier de la bibliothèque** (par défaut `Bibliothèque`). Voir {{link:Accueil|l'accueil}}.
