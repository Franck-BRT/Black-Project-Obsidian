# Prise en main

{{link:Accueil|← Accueil}}

## Les réglages

**Paramètres → Black Projects by Black Room Technologies** :

- **Langue** : français ou anglais, appliquée au prochain chargement du plugin.
- **Documentation** : le dossier où cette documentation est créée, et le bouton qui la
  crée ou la met à jour.
- **Modules** : chaque module avec sa version et son état. L'interrupteur l'active ou le
  désactive au prochain chargement du plugin ; vos données ne sont jamais supprimées.
  Certains modules ont un bouton qui ouvre leur fenêtre : **Formats de fichiers** pour la
  lecture de fichiers, **Types de pièces** pour le typage des pièces (types, mots-clés,
  échange), **Fonctions** pour l'analyse d'appels d'offres (avec le dossier des
  analyses).
- **Licence** : vos droits d'usage.

Survolez un réglage, un bouton ou un bloc : une infobulle explique à quoi il sert.

## L'état d'un module

| État | Signification |
| --- | --- |
| Actif | le module fonctionne |
| Désactivé | vous l'avez désactivé |
| Module requis indisponible | un module dont il a besoin est désactivé ou en panne |
| Non couvert par la licence | vos droits d'usage ne l'incluent pas |
| Erreur au chargement | il n'a pas pu démarrer ; les autres fonctionnent |

## Les commandes

Palette de commandes (Ctrl/Cmd + P), en tapant « Black Projects » :

| Commande | Rôle |
| --- | --- |
| À propos de Black Projects | version, modules actifs, licence |
| Créer ou mettre à jour la documentation | écrit cette documentation dans le coffre |
| Nouvelle analyse d'appel d'offres | crée une analyse et propose d'y mettre les pièces ; voir {{link:Modules/Analyse d'appels d'offres|Analyse d'appels d'offres}} |
| Importer des pièces dans une analyse (ZIP compris) | importe des fichiers de l'ordinateur, ou le ZIP du dossier |
| Mettre à jour l'analyse (pièces déposées à la main) | lit les fichiers déposés dans `Pièces/Originaux`, réécrit le tableau des pièces |
| Changer le type de la pièce | sur la note d'une pièce : RC, CCTP, CCAP, BPU… |
| Déplacer la pièce (appel d'offres ↔ réponse) | sur la note d'une pièce : la range avec l'appel d'offres, la réponse, ou la réponse d'un candidat |
| Exporter des types de pièces | écrit un ou plusieurs types dans un fichier, pour un autre coffre ; voir {{link:Modules/Typage des pièces|Typage des pièces}} |
| Importer des types de pièces | reprend des types d'un tel fichier |
| Nouvelle exigence | crée une exigence avec son identifiant (REQ-SYS-0001) ; voir {{link:Modules/Exigences|Exigences}} |
| Exigences : liste, filtres et fiches | parcourt la bibliothèque, ouvre une fiche ou une note |
| Modifier l'exigence (note ouverte) | la fiche de l'exigence ouverte : formulation, attributs, alias |
| Importer des exigences d'un fichier (Excel, CSV, Word, PDF, ReqIF…) | aperçu, puis import dans la bibliothèque, chaque exigence avec son origine |
| Extraire les exigences de la pièce | sur la note d'une pièce (le CCTP) : aperçu, puis import dans les exigences de l'analyse, tracées jusqu'à la pièce |
| Mettre à jour les exigences de l'analyse | réécrit la liste des exigences de chaque pièce et le tableau de l'analyse |
| Vérifier les exigences du dossier (les quatre vérifications) | les quatre vérifications ci-dessous, puis le rapport `Analyse/Vérification des exigences` |
| Extraire les exigences de toutes les pièces | toutes les pièces de l'appel d'offres en un aperçu |
| Chercher les exigences oubliées | les phrases à tournure d'exigence qu'aucune exigence ne reprend, proposées à l'ajout |
| Vérifier la cohérence des exigences entre pièces | identifiants écrits différemment, absents d'une version, en double… |
| Vérifier la couverture des exigences par la réponse | pour chaque exigence : citée, traitée, à vérifier ou absente dans la réponse |
| Analyser la qualité des exigences du dossier | la note `Analyse/Qualité des exigences` : notes, défauts, doublons, non vérifiables |
| Analyser la qualité de la bibliothèque d'exigences | la même analyse pour la bibliothèque, rattachements compris |

## Vos données

Tout ce que Black Projects crée est une note Markdown ou un fichier de votre coffre. Les
pages de cette documentation sont les seules à être remplacées par le plugin ; vos notes
ne le sont jamais.
