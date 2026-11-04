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
  lecture de fichiers, **Fonctions** pour l'analyse d'appels d'offres (avec le dossier
  des analyses).
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

## Vos données

Tout ce que Black Projects crée est une note Markdown ou un fichier de votre coffre. Les
pages de cette documentation sont les seules à être remplacées par le plugin ; vos notes
ne le sont jamais.
