# Workflows

Le module **Workflows** automatise : *quand ceci arrive, si cela tient, faire ceci*. Un
workflow s'écrit une fois ; Black Projects le suit ensuite, seul ou après vous avoir
demandé, et écrit chaque exécution dans un journal.

## 1. Un workflow

| Partie | Ce que c'est | Exemples |
| --- | --- | --- |
| **Déclencheur** | quand il s'exécute | à la main ; à heure fixe (chaque jour, les jours ouvrés, chaque semaine, chaque mois) ; *AO : pièces importées* ; *AO : exigences extraites* ; *AO : analyse créée* ; *Exigences : exigence créée* |
| **Conditions** | sur ce qui est arrivé (facultatives) | *Types des pièces* **est** « CCAP, CCTP » ; *Places* **contient** « Appel d'offres » ; *Nombre* **est au moins** « 3 » |
| **Actions** | ce qu'il fait, à la suite | relever le calendrier ; analyser la qualité ; vérifier la cohérence ou la couverture ; interroger le dossier ou remplir le questionnaire (IA) ; relire une exigence (IA) ; demander à l'IA ; écrire une note ; ajouter à une note ; prévenir |
| **Mode** | seul ou après accord | **Demander d'abord** : il dit ce qu'il va faire et attend « Exécuter » ; **Tout seul** : il agit dès que le déclencheur arrive |

Les conditions se lient par **et** (toutes) ou **ou** (l'un ou l'autre groupe) ; plusieurs
valeurs séparées par des virgules veulent dire « l'une ou l'autre » ; majuscules et
accents ne comptent pas.

## 2. Les variables

Les textes des actions peuvent reprendre ce qui est arrivé, entre accolades :

- les champs du déclencheur : `{analyse}`, `{acheteur}`, `{types}`, `{nombre}`, `{id}`… ;
- le jour : `{today}`, `{today+7}` (dans sept jours), `{now}`, et le nom du workflow `{workflow}` ;
- les **résultats des étapes d'avant** : `{step1.link}` (un lien vers la note écrite à
  l'étape 1), `{step1.path}`, `{step2.text}`…

La fenêtre de chaque action rappelle les variables utilisables à sa place.

## 3. Créer, modifier, exécuter

Palette de commandes :

- **Nouveau workflow** — de zéro, ou d'après un **workflow prêt à l'emploi** :
  - *À l'import des pièces : relever le calendrier* ;
  - *À l'extraction des exigences : qualité et cohérence* ;
  - *À l'import du CCAP, du RC ou du CCTP : questionnaire (IA)* ;
  - *Chaque lundi : qualité de la bibliothèque d'exigences* ;
- **Workflows : liste et modification** — la **page Workflows**, dans l'onglet Black
  Projects (aussi par l'entrée **Workflows** du menu de gauche, sa tuile, ou le lien « Tous
  les workflows » du tableau de bord) : les chiffres (workflows, actifs, exécutions et
  échecs récents), une **carte par workflow** — déclencheur, actions, mode, état, nombre
  d'exécutions, la dernière, « Dernière exécution en échec » s'il le faut — avec
  **Modifier**, **Exécuter**, **Activer** ou **Désactiver** ; puis les dernières lignes du
  journal. Une recherche (nom, déclencheur, action) et des filtres : actifs, désactivés, en
  échec, planifiés, sur événement, manuels, tout seul, demander d'abord. **Modifier** ouvre
  la fiche : nom, mode et déclencheur, conditions, actions (ajouter, modifier, monter,
  descendre, retirer), exécuter maintenant, activer ou désactiver, dupliquer, supprimer ;
- **Exécuter un workflow** — à la main, sans attendre son déclencheur ; l'analyse est
  demandée quand il en faut une ;
- **Journal des workflows** — chaque exécution, la plus récente en tête : ✅ fait,
  ❌ échec (et pourquoi), ⏭️ refusé, ⛔ arrêté ; avec des liens vers ce qu'elle a écrit ;
- **Exporter des workflows** / **Importer des workflows** — un fichier JSON pour un autre
  coffre ; un workflow importé arrive **désactivé**, à relire avant de l'activer.

## 4. Les garde-fous

- Une étape qui échoue arrête le workflow ; le message et le journal disent laquelle et
  pourquoi.
- Un workflow qui s'exécute plus de 30 fois en une heure boucle : il est arrêté.
- Une heure fixe manquée Obsidian fermé est rattrapée **une fois** à l'ouverture.
- Les actions avec l'IA demandent le module {{link:Modules/IA|IA}} réglé ; sans lui, elles
  échouent proprement, le reste continue de fonctionner.

## 5. Réglages

Paramètres → Black Projects → bouton **Fonctions** de la ligne « Workflows » : le dossier
du journal (`Black Projects/Workflows` par défaut). Les workflows eux-mêmes sont gardés
dans les réglages du plugin.

Voir {{link:Accueil|l'accueil}}.
