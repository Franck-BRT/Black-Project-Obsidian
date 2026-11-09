# Programmes

Le module **Programmes** organise votre activité en **programmes**, **projets** et
**affaires**, et suit chaque projet **phase par phase**. L'analyse d'un appel d'offres est
une de ces phases.

## 1. Programmes, projets, affaires

| | Ce que c'est | Où |
| --- | --- | --- |
| **Programme** | un ensemble de projets (un domaine, un client, une ligne de produits) | `Programmes/<Programme>/<Programme>.md` |
| **Projet** | ce qu'on mène, phase par phase ; il suit les phases de son **type** | `Programmes/<Programme>/<Projet>/<Projet>.md` |
| **Affaire** | une affaire du projet (un marché, un contrat) ; souvent, un projet est une affaire — mais il peut en avoir plusieurs | `Programmes/<Programme>/<Projet>/Affaires/<Affaire>.md` |

Le dossier `Programmes` se règle dans les paramètres du module. Chaque note garde une partie
**Notes** à vous : Black Projects n'écrit que son en-tête.

## 2. Les phases d'un projet

Un projet suit des **étapes**, de gauche à droite ; une étape a une ou plusieurs **phases**,
menées en même temps. Sur la page d'un projet, ses phases sont dessinées en tuiles reliées par
des flèches :

- **coche verte** : terminée ; **anneau** : en cours ; **pâle** : à venir ; **grisée** : sans objet.

Un clic sur une phase ouvre sa page : **La commencer** (elle prend la date du jour pour
début), **La terminer** (date de fin), **Sans objet**, **À venir**, et **Ses dates**.

## 3. L'analyse d'un appel d'offres, une phase

Une phase de la sorte **Analyse d'appel d'offres** est menée par le module AO :

- **Créer l'analyse** : la fenêtre de l'analyse s'ouvre, le nom du projet proposé ; l'analyse
  est reliée à la phase, qui commence ;
- **Relier une analyse existante** : une analyse déjà commencée ;
- **Ouvrir l'analyse**, **Délier**.

La tuile de la phase dit l'analyse qu'elle porte. Les analyses restent rangées dans le dossier
des appels d'offres.

## 4. Les types de projet

Un **type de projet** donne ses phases à un projet. Deux types sont fournis pour commencer :
**Réponse à un appel d'offres** (veille, analyse de l'appel d'offres, décision, rédaction et
chiffrage en parallèle, remise, négociation, exécution, clôture) et **Projet simple**.

Sur **Types de projet**, chaque type est dessiné ; un clic sur son titre ouvre son **éditeur** :

- un clic sur une phase la **modifie** : son nom, sa **sorte** (libre, ou celle d'un module —
  l'analyse d'un appel d'offres), son icône, sa couleur, ce qu'on y fait ;
- ses boutons la **déplacent** (vers l'étape d'avant ou d'après, plus haut ou plus bas dans son
  étape) ou la **retirent** ;
- **+ Phase en parallèle** ajoute une phase à une étape ; **+ Étape**, une étape à la fin ;
- **Phase englobante** : une phase qui couvre des étapes qui se suivent (« Avant-vente », de la
  veille à la remise de l'offre), dessinée en bandeau au-dessus d'elles ; un clic sur son nom la
  modifie (son nom, ses première et dernière étapes, sa couleur), sa corbeille la retire ;
- **Nouveau type**, **Modifier**, **Dupliquer**, **Supprimer**, **Nouveau projet de ce type**.

Sur un projet, chaque phase englobante dit où elle en est (« 1/6 phases ») : terminée quand
toutes ses phases le sont, en cours dès que l'une est commencée.

Les projets déjà créés **gardent leurs phases** : changer un type ne les change pas.
