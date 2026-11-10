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
début), **La terminer** (date de fin), **Sans objet**, **À venir**, et **Ses dates** (début,
fin, durée prévue).

**Démarrer le projet** : sa date de démarrage ; les **dates prévues** de toutes ses phases en
découlent (leurs durées) — les phases d'une étape commencent ensemble, l'étape suivante le
lendemain de la fin de la plus longue. Ce premier calcul est gardé : c'est le **planning
initial**.

**Le recalage automatique** : les dates prévues suivent ensuite ce qui se passe, chaque jour —

- une phase **terminée** garde ses vraies dates : finie plus tôt, la suite **avance** ;
- une phase **en cours** qui dépasse sa fin prévue s'étend jusqu'à aujourd'hui : la suite
  **recule** d'autant ;
- une phase **à venir** ne commence jamais dans le passé : au plus tôt, aujourd'hui.

Une phase dont la fin du planning initial est passée, et qui n'est pas terminée, est **en
retard**. Chaque tuile dit son décalage (« +5 j ») ; la **fin prévue** du projet dit de combien
elle a bougé (« décalée de 12 j, initialement le … »). Changer la date de démarrage, ou la durée
d'une phase, refait le planning initial.

**Documents attendus** : une phase peut attendre des documents (plusieurs) ; sa page les liste
— **Reçu**, **Relier le fichier** — et **Documents attendus** en ajoute ou en retire.

## 3. L'analyse d'un appel d'offres, une phase

Une phase technique **Analyse d'appel d'offres** est menée par le module AO :

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

- un clic sur une phase la **modifie** : son nom, sa **phase technique** (phase libre, ou
  celle d'un module — l'analyse d'un appel d'offres), son icône (une soixantaine, rangées par
  nom — taper les premières lettres dans la liste y mène), sa couleur, sa **durée prévue**, si
  des **documents sont attendus** (l'interrupteur, puis leurs types de pièce, plusieurs au besoin — un type qui
  manque se crée d'ici : **Nouveau type de document**), ce qu'on y fait ;
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
