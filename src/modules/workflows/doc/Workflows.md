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
  échec, planifiés, sur événement, manuels, tout seul, demander d'abord. Un clic sur un
  workflow (son nom, ou **Modifier**) ouvre sa **fiche**, en page aussi, où tout se voit :
  en tête **Exécuter**, **Activer** ou **Désactiver**, **Nom, mode et déclencheur**,
  **Dupliquer** (la copie s'ouvre), **Supprimer** ; ses chiffres (état, mode, exécutions,
  dernière exécution) ; ses **conditions**, chacune avec **Retirer**, et « Ajouter une
  condition » ; ses **actions**, dans l'ordre, chacune avec **Modifier**, **Monter**,
  **Descendre**, **Retirer**, et « Ajouter une action » ; ses dernières exécutions.
  « ← Tous les workflows » ramène à la liste. Dans l'onglet, **Nouveau workflow** (la
  page, le tableau de bord, la tuile) ouvre la fiche du workflow créé, en page ; et
  **Exécuter** (la carte, la fiche, « Exécuter de nouveau ») mène à la **fiche de
  l'exécution** qu'il vient de faire : son issue, ses étapes, les notes écrites ;
- **Exécuter un workflow** — à la main, sans attendre son déclencheur ; l'analyse est
  demandée quand il en faut une ;
- **Journal des workflows** — en page : combien d'exécutions, réussies, en échec,
  refusées ou arrêtées ; puis chaque exécution, jour par jour, la plus récente en tête —
  ✅ fait, ❌ échec (et pourquoi), ⏭️ refusé, ⛔ arrêté. **Un clic sur une exécution ouvre
  sa fiche** (aussi depuis la page Workflows, l'historique d'un workflow et le tableau de
  bord) : son issue et son heure, son sujet, ce que chaque étape a fait (une étape en échec
  en rouge, avec la raison), les notes qu'elle a écrites, les autres exécutions du même
  workflow ; et les boutons Ouvrir la fiche du workflow, Exécuter de nouveau, Ouvrir le
  sujet. Le sujet et les notes écrites s'ouvrent **en page** dans l'onglet quand un module
  en a une — l'analyse visée ouvre sa fiche, « Calendrier » la page du calendrier, une
  exigence sa fiche — et sinon dans le coffre ; une
  recherche et des filtres par issue ; « Ouvrir la note du journal » montre la note, avec
  ses liens vers ce que chaque exécution a écrit ;
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
