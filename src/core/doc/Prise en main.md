# Prise en main

{{link:Accueil|← Accueil}}

## L'accueil

L'onglet **Black Projects** s'ouvre au démarrage, ou par l'icône de la barre latérale, ou
par la commande **Ouvrir l'accueil de Black Projects** : le bonjour, la date, et vos
**tuiles** — un raccourci par fonction (nouvelle analyse, analyses, importer des pièces,
calendrier, interroger le dossier, exigences, workflows, IA, paramètres…), avec des
pastilles : « J-5 » pour la prochaine date limite de remise, le nombre d'exigences
faibles, les échecs récents des workflows, « ! » si l'IA n'est pas réglée.

**Modifier l'accueil** : − retire une tuile, la liste « Tuiles à ajouter » en ajoute, on
glisse une tuile pour la déplacer (ou Alt + flèches au clavier) ; **Terminé**. Votre
agencement est gardé.

Le **Tableau de bord** (à gauche, ou sa tuile, ou la commande **Ouvrir le tableau de bord
de Black Projects**) donne les informations : une carte par analyse d'appel d'offres (sa
date limite de remise en jours restants, ses pièces, ses exigences et leur note), l'état
de l'IA, la bibliothèque d'exigences en chiffres, les dernières exécutions des workflows.
Il se met à jour quand le coffre change. La flèche à gauche du titre d'une section la
**réduit** à son titre (ou la déplie).

**Analyses** (menu de gauche ou tuile) ouvre la page de toutes vos analyses, dans
l'onglet : leurs chiffres, une carte par analyse, une recherche et des filtres (remise à
venir, pièces à lire, candidat, émetteur…). **Exigences** ouvre de même la page de la
bibliothèque : une carte par exigence, les plus faibles d'abord, avec sa formulation, et des
filtres (faibles, à revoir, criticité haute, brouillons, approuvées). **Workflows** ouvre la
page de vos workflows : une carte par workflow (Modifier, Exécuter, Activer ou Désactiver)
et les dernières exécutions. **IA** ouvre la page de l'IA : la connexion, un modèle par
usage (« Choisir le modèle »), et ce qui se sert de l'IA.

**La barre de gauche** se range aussi : **Accueil** reste toujours en premier et
**Paramètres** toujours en bas — ni l'un ni l'autre ne se déplace ni ne se masque. Entre
les deux se range votre menu : **Modifier le menu** (en bas, juste au-dessus de
Paramètres) : glissez une entrée (ou ses boutons monter, descendre),
retirez-la, ou ajoutez-en depuis « Ajouter au menu » — les entrées retirées et toutes les
fonctions des modules (calendrier, interroger le dossier, documentation…). « Rétablir le
menu par défaut » remet tout en place. Votre menu est gardé.

**Modifier le tableau de bord** : chaque section devient une fiche. Glissez-la pour la
déplacer, y compris d'une colonne à l'autre, ou utilisez ses boutons : monter, descendre,
changer de colonne, masquer. Les **sections masquées** se réaffichent d'un clic ;
« Rétablir le tableau de bord par défaut » remet tout en place. Votre rangement est gardé ;
si une seule colonne est remplie, elle prend toute la largeur.

Le bouton **Apparence** règle, au choix et ensemble :

- le **mode** : automatique (comme Obsidian), clair, sombre ;
- les **couleurs** pour les daltonismes : rouge-vert (deutéranopie, protanopie),
  bleu-jaune (tritanopie), monochrome (achromatopsie) — un état n'est jamais dit par la
  seule couleur : il a aussi son icône et son mot ;
- la **lecture facilitée** pour les troubles dys : police lisible (OpenDyslexic, Lexend ou
  Atkinson Hyperlegible, si elles sont installées sur l'ordinateur), texte plus grand et
  plus espacé, fond crème, sans italique ;
- la **taille du texte**, et le **mouvement** (animations coupées).

## Les réglages

**Paramètres → Black Projects by Black Room Technologies** :

- **Langue** : français ou anglais, appliquée au prochain chargement du plugin.
- **Accueil et apparence** : ouvrir l'accueil au démarrage, et les mêmes choix
  d'apparence que le bouton de l'accueil.
- **Documentation** : le dossier où cette documentation est créée, et le bouton qui la
  crée ou la met à jour.
- **Modules** : chaque module avec sa version et son état. L'interrupteur l'active ou le
  désactive au prochain chargement du plugin ; vos données ne sont jamais supprimées.
  Certains modules ont un bouton qui ouvre leur fenêtre : **Formats de fichiers** pour la
  lecture de fichiers, **Types de pièces** pour le typage des pièces (types, mots-clés,
  échange), **Fonctions** pour l'analyse d'appels d'offres (avec le dossier des
  analyses) et pour l'**IA** (adresse du serveur, clé, « Tester la
  connexion ») ; les **Workflows** ont aussi leur fenêtre (dossier du journal).
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
| Ouvrir l'accueil de Black Projects | l'onglet d'accueil, ses tuiles |
| Ouvrir le tableau de bord de Black Projects | les informations des modules |
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
| Calendrier de l'appel d'offres | la note `Analyse/Calendrier` : remise, validité des offres, délais, chacun avec sa phrase (sans IA) |
| Tester la connexion au serveur d'IA | liste les modèles du serveur et fait choisir le modèle de texte ; voir {{link:Modules/IA|IA}} |
| Relire l'exigence avec l'IA | avis, défauts, reformulations à choisir ou non ; la relecture dans la note |
| Traduire l'exigence avec l'IA | dans une autre langue de rédaction, marquée à relire |
| Interroger le dossier (IA) | une question aux pièces ; la réponse cite ses sources, liées aux pièces (`Analyse/Questions`) |
| Questionnaire du dossier (IA) | attribution, pénalités, garanties, propriété intellectuelle, confidentialité, contrôle export (`Analyse/Questionnaire`) |
| Relire les exigences du dossier avec l'IA | les plus faibles relues ; côté candidat, la formulation de l'acheteur reste |
| Nouveau workflow | automatiser : de zéro ou d'après un modèle prêt à l'emploi ; voir {{link:Modules/Workflows|Workflows}} |
| Workflows : liste et modification | vos workflows ; une ligne ouvre sa fiche (conditions, actions, exécuter, désactiver…) |
| Exécuter un workflow | à la main, sans attendre son déclencheur |
| Journal des workflows | chaque exécution, avec ce qu'elle a fait |
| Exporter / Importer des workflows | un fichier JSON pour un autre coffre |

## Vos données

Tout ce que Black Projects crée est une note Markdown ou un fichier de votre coffre. Les
pages de cette documentation sont les seules à être remplacées par le plugin ; vos notes
ne le sont jamais.
