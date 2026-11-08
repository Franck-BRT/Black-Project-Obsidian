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

- **Nouveau workflow** — un nom, un mode, un déclencheur, puis ses conditions et ses
  actions ; pour partir d'un workflow système, **Dupliquez-le** (voir plus bas) ;
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
  coffre ; un workflow importé arrive **désactivé**, à relire avant de l'activer. Depuis la
  page Workflows, **Importer** finit sur la fiche du workflow importé (s'il n'y en a qu'un)
  ou sur la liste : les importés en tête, marqués « Importé — désactivé, à relire », un
  filtre « Importés », et un message tant qu'il en reste à activer.

## Les workflows système

Ce que l'application fait d'elle-même est écrit en **workflows système** : vous les
voyez, vous les réglez, vous les coupez — badge **Système**, filtre « Système » sur la page
Workflows et dans le journal.

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Note de l'analyse : le tableau des pièces, à l'import | pièces importées | réécrit le tableau des pièces de la note de l'analyse | actif |
| Note de l'analyse : la liste des exigences, à l'extraction | exigences extraites | réécrit la liste des exigences (analyse, pièces) | actif |
| Relever le calendrier à l'import des pièces | pièces de l'appel d'offres importées | écrit la note Calendrier | actif |
| Contrôler les exigences extraites (qualité et cohérence) | exigences extraites | qualité, puis cohérence entre pièces | actif |
| Rappel des dates limites de remise | chaque jour à 8 h (à l'ouverture si elle est plus tard) | prévient à J-7, J-3, J-1 et le jour même | actif |
| Rappel du réglage du rangement, à l'ouverture | à l'ouverture d'Obsidian | tant qu'aucun type n'est rangé, explique où le régler | actif |
| Questionnaire (IA) à l'import du CCAP, du RC ou du CCTP | ces pièces importées | lance le questionnaire (demande d'abord) | désactivé |
| Vérifier la couverture d'une réponse importée | pièces de réponse importées | couverture de la réponse | désactivé |
| Qualité de la bibliothèque d'exigences, chaque lundi | lundi à 8 h | rapport de qualité de la bibliothèque | désactivé |
| Traduire les nouvelles exigences (IA) | exigence créée | traduit dans les autres langues, « à relire » | désactivé |
| Contrôler la qualité des exigences importées | exigences importées | nomme les faibles (moins de 3 étoiles) | actif |
| Traductions à revoir, chaque lundi | lundi à 8 h | compte les traductions absentes, en retard ou à relire | désactivé |
| Relire les nouvelles exigences (IA) | exigence créée | relecture par l'IA, écrite dans la note | désactivé |
| Vérifier la connexion à l'IA, à l'ouverture | à l'ouverture d'Obsidian | met à jour la liste des modèles ; dit si le serveur ne répond pas ou si un modèle choisi n'y est plus | actif |
| Ranger les pièces importées dans la bibliothèque | des pièces importées dans une analyse | les range dans la bibliothèque de documents | actif |
| Ranger les fichiers importés dans la bibliothèque | un import d'exigences, de types ou de workflows | range le fichier importé | actif |
| Repérer les nouvelles versions probables | des documents versés dans la bibliothèque | marque la version précédente probable | actif |
| Signaler les fichiers introuvables, chaque lundi | lundi à 8 h | dit les documents dont le fichier n'est plus dans le coffre | désactivé |
| Signaler les formats non lus, au dépôt de fichiers | des fichiers déposés dans l'application | dit ceux dont le format n'est pas lu, et où déclarer une extension équivalente | actif |
| Signaler les pièces sans type reconnu, à l'import | des pièces importées, quand certaines sont classées « Autre » | les nomme, et dit comment les typer | actif |

- **Modifiables** : nom, mode, déclencheur, conditions, actions, comme les autres.
- **Désactivables** : désactivé, l'automatisme ne se fait plus (la note de l'analyse, par
  exemple, n'est plus mise à jour à l'import).
- **Pas supprimables** : pas de bouton **Supprimer** ; **Dupliquer** en fait un workflow
  ordinaire, que l'on supprime à volonté.
- **Rétablir l'original** : un workflow système modifié porte « Modifié » ; sa fiche
  montre **la version d'origine** et le bouton qui la remet (après confirmation ; actif ou
  non, il le reste).
- **Mises à jour du plugin** : un workflow système que vous n'avez pas modifié suit la
  nouvelle version ; modifié, il est gardé tel quel, et sa fiche dit qu'une version
  d'origine plus récente existe.
- Un workflow système réussi ne prévient pas à chaque fois (le journal le garde) ; un échec
  est dit. Celui d'un module désactivé est masqué, et ne s'exécute pas.
- Un nouveau déclencheur : **À l'ouverture d'Obsidian** (une fois par session).

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
