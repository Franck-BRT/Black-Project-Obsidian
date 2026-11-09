# Guide utilisateur

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Le guide s'écrit au fil des étapes du [plan d'intégration](../plan-integration.md) :

| Chapitre | Étape |
| --- | --- |
| 01 — Importer un dossier de consultation | 2 ✅ (page *Analyse d'appels d'offres* dans le coffre) |
| 02 — Extraire les exigences | 3-4 |
| 03 — Analyser la qualité | 5 |
| 04 — Interroger le dossier avec l'IA | 6 ✅ (pages *IA* et *Analyse d'appels d'offres* dans le coffre) |
| 05 — Produire les livrables | 7 |

## Aujourd'hui (version 0.97.0)

- **L'accueil** : l'onglet « Black Projects » s'ouvre au démarrage (ou par l'icône de la
  barre latérale, ou la commande « Ouvrir l'accueil de Black Projects ») : le bonjour, la
  date, et vos **tuiles** — des raccourcis vers les modules, avec des pastilles (« J-5 »
  pour la prochaine remise, exigences faibles, échecs de workflows, IA pas réglée).
  **Analyses**, **Exigences**, **Workflows** et **IA** (menu ou tuile) ouvrent chacune
  leur page — toutes les analyses, toute la bibliothèque d'exigences, tous les workflows, la
  connexion à l'IA (le dernier test, les modèles du serveur — « Tester la connexion » y
  mène) et un modèle par usage — avec une recherche et des filtres ; un clic sur
  un élément ouvre sa fiche — jusqu'au calendrier d'une analyse (relevé à l'ouverture, la
  remise et ses jours restants, les dates et délais, « Écrire le calendrier »), aux
  questions posées au dossier (la réponse, ses sources citées ou
  non, « Reposer la question »), et au questionnaire (une carte par thème, « Remplir le
  questionnaire », « Reposer » un thème), et à la qualité des exigences (calculée à
  l'ouverture, une carte par exigence, « Écrire le rapport »), et à leur vérification
  (extraction, oubliées, cohérence, couverture, « Tout vérifier ») —, et **« ← Retour »** (ou Alt + ↑) remonte au niveau
  supérieur (la page d'où l'on vient : Alt + ←). **Modifier l'accueil** pour en ajouter, en retirer ou les déplacer. Le **Tableau de
  bord** (navigation, tuile, ou commande) donne les informations : une carte par analyse
  avec sa date limite de remise, l'état de l'IA, la bibliothèque d'exigences, les derniers
  workflows. **Modifier le tableau de bord** pour masquer une section, la déplacer
  (glisser, ou boutons monter, descendre, changer de colonne) ; la flèche d'une section la
  réduit à son titre. **Paramètres** (en bas de la barre de gauche) ouvre la page des
  paramètres dans l'onglet : la langue, l'accueil au démarrage, la documentation,
  l'apparence, et une carte par module (son état, ses « Fonctions » — ses réglages et ce
  qu'il sait faire, en page dans l'onglet —, Activer ou
  Désactiver). La **documentation** se lit dans l'onglet (Paramètres → « Lire la
  documentation », ou la tuile Documentation) : un sommaire, puis chaque page, avec page
  précédente et suivante ; « Écrire dans le coffre » la garde en notes. Depuis le **journal
  des workflows**, le sujet d'une exécution et les notes qu'elle a écrites s'ouvrent en page
  (la fiche de l'analyse, le calendrier, une exigence). Sur le **tableau de bord**, les
  raccourcis Calendrier, Interroger et Questionnaire ouvrent eux aussi ces pages ; importer
  des pièces (ou créer une analyse, ou la mettre à jour) depuis l'interface se termine sur
  la fiche de l'analyse ; extraire les exigences d'une pièce reste sur sa fiche, et la
  déplacer (appel d'offres ↔ réponse) y mène à sa nouvelle place ; changer son type
  propose de la déplacer si le routage du nouveau type la range ailleurs. Relire les
  exigences avec l'IA mène à la page Qualité (les relues marquées) ; la relecture se lit
  sur la fiche de chaque exigence. Traduire une exigence mène à sa fiche : la traduction,
  ce que l'IA en dit, les chiffres qui diffèrent, et **Valider la traduction** ; la page
  Exigences traduit aussi plusieurs exigences d'un coup.
  **Modifier le menu** (en bas de la barre de gauche, au-dessus de Paramètres) pour déplacer, retirer ou
  ajouter des entrées — toute fonction des modules peut y figurer ; Accueil reste en
  haut et Paramètres en bas. Le bouton
  **Apparence** règle le mode (clair, sombre, automatique), les couleurs pour les
  daltonismes (rouge-vert, bleu-jaune, monochrome), la lecture facilitée pour les
  troubles dys, la taille du texte et le mouvement — aussi dans Paramètres → *Accueil et
  apparence*. Toutes les fenêtres (formulaires, choix, listes, la fenêtre « Fonctions »
  des modules) suivent la même apparence et se manient au clavier : Tab pour avancer, ↑ ↓
  dans un choix, Entrée pour valider, Échap pour fermer.

- **Analyse d'appels d'offres** : « Nouvelle analyse d'appel d'offres », puis importer
  les pièces (ou le ZIP du dossier), ou les déposer dans `Pièces/Originaux` et « Mettre à
  jour l'analyse » ; chaque pièce est lue, typée et décrite par une note ; la note de
  l'analyse tient le tableau des pièces. Voir la page *Analyse d'appels d'offres* de la
  documentation écrite dans le coffre. Les types de pièces et les mots-clés qui les font
  reconnaître sont dans Paramètres → Black Projects → **Types de pièces** (module
  *Typage des pièces*), où vous pouvez ajouter, modifier et supprimer vos propres types
  et mots-clés, désactiver n'importe quel type, et exporter ou importer des types pour
  les échanger avec d'autres coffres ; un **workflow système**, *Signaler les pièces sans
  type reconnu, à l'import* (activé), nomme celles classées « Autre » et dit comment les
  typer. Chaque pièce est rangée avec l'appel d'offres ou
  avec la réponse (une par candidat pour l'émetteur), d'après le réglage « Où vont les
  types de pièces » du module *Analyse d'appels d'offres* (un bouton pour ajouter un
  type, une liste dépliable, un type par ligne avec ses interrupteurs « AO » et « Réponse AO ») ; quand le type va dans les
  deux, la question est posée à l'import. La liste est vide au départ : à vous de
  choisir ; un message l'explique à l'activation du module, puis un rappel s'affiche à
  l'ouverture tant qu'elle est vide (il se coupe d'une case). Les fiches de **Types de
  pièces** rappellent où va chaque type, et l'export / import de types fait voyager ce
  rangement.


- **Exigences** : « Nouvelle exigence » (catégorie, titre, formulation, attributs ;
  l'identifiant REQ-SYS-0001 est attribué et ne sera jamais réutilisé ; depuis l'onglet,
  la fiche de l'exigence créée s'ouvre ; ses liens mènent de fiche en fiche, dans les deux
  sens ; « Relire (IA) » d'une carte mène aussi à sa fiche,
  où la relecture se lit), « Exigences :
  liste, filtres et fiches » — en cartes, en liste ou en tableau, regroupée par catégorie,
  statut, type, criticité ou qualité — pour parcourir la bibliothèque et modifier une fiche (en
  page, la fiche suit l'exigence même quand son titre change), et le
  bloc `brt-req` pour citer des exigences dans un document ; voir la page *Exigences* de
  la documentation écrite dans le coffre.

- **Extraire les exigences** : sur la note d'une pièce (le CCTP), « Extraire les exigences
  de la pièce » ; un aperçu montre chaque exigence trouvée et où, puis elles sont rangées
  dans le dossier `Exigences` de l'analyse, chacune liée à sa pièce ; la pièce et
  l'analyse les listent. « Importer des exigences d'un fichier » fait de même pour la
  bibliothèque (ReqIF de DOORS compris) ; depuis la page Exigences ou la tuile, il finit
  sur la page « Importées de … » (créées, mises à jour, d'où chacune vient).

- **Vérifier les exigences du dossier** : « Vérifier les exigences du dossier (les quatre
  vérifications) », ou chacune seule — tout extraire, chercher les exigences oubliées
  (phrases en « doit », « devra », « shall »… non reprises), la cohérence entre pièces,
  la couverture par la réponse ; le rapport `Analyse/Vérification des exigences` de
  l'analyse en garde le résultat (depuis la fiche d'un candidat, « Écrire le rapport de
  couverture » l'écrit sans quitter la fiche).

- **Qualité des exigences** : « Analyser la qualité des exigences du dossier » écrit la note
  `Analyse/Qualité des exigences` (répartition des notes, défauts, doublons, exigences non
  vérifiables), hors ligne ; la note de chaque exigence est aussi dans la liste et la
  fiche de la bibliothèque. Pour la bibliothèque, « Analyser la qualité » (page
  Exigences, tableau de bord, tuile) ouvre la page **Qualité des exigences**, calculée à
  l'ouverture ; « Écrire le rapport » la garde dans une note.

- **Calendrier de l'appel d'offres** (sans IA) : la note `Analyse/Calendrier` — date
  limite de remise, validité des offres, délais et livraisons, chacun avec sa phrase et
  sa pièce.

- **IA** : Paramètres → Black Projects → **IA** — adresse du
  serveur, clé (rangée dans le trousseau, jamais dans le coffre), **Tester la
  connexion**, puis un modèle par usage — analyse, traduction, vecteurs, reranking,
  lecture OCR, lecture par vision —, chacun dans le menu de sa ligne (ou « Saisir un autre nom… »). Ensuite : **Relire l'exigence avec l'IA** (un avis,
  des reformulations à choisir ou non), **Traduire l'exigence avec l'IA** (marquée à
  relire, à valider sur sa fiche ; une traduction à jour n'est remplacée qu'après une
  question), **Traduire des exigences avec l'IA** (plusieurs d'un coup ; depuis la page
  Exigences, la page « Traductions à relire » ensuite, pour les valider), les doublons par le sens dans la qualité (avec un modèle d'embeddings) ;
  pour un appel d'offres, **Interroger le dossier** (la réponse cite ses sources, liées
  aux pièces ; rien trouvé, l'IA n'est pas appelée), le **Questionnaire du dossier**
  (six questions prêtes) et **Relire les exigences du dossier avec l'IA**.

- **Bibliothèque** : quatre bibliothèques séparées, depuis le menu **Bibliothèque** — vos
  documents, vos **prompts** (des questions pour l'IA, écrites une fois), vos
  **personas** (le rôle dans lequel l'IA répond : juriste marchés publics, contrôleur
  technique…) et vos **skills** (un savoir-faire donné à l'IA : lire un CCTP, répondre en
  tableau…) — toute étape de workflow qui demande l'IA les prend (champs Prompt, Persona,
  Skill), et le logigramme la montre sur fond turquoise —, avec **Ajouter les exemples** pour démarrer. « Interroger le dossier »
  propose vos prompts et un persona ; « Relire l'exigence » aussi un persona ; l'action de
  workflow « Demander à l'IA » les prend par leur nom. Chaque bibliothèque se regroupe en
  sections repliables (documents : par origine, famille, type de pièce, mois d'ajout ; prompts
  et personas : par catégorie ou favoris), en cartes, en liste ou en tableau. **Nouvelle
  bibliothèque** en ajoute une autre de la même sorte (des normes, des modèles, un
  client…), dans son propre dossier ; l'une est **par défaut** : ce qui arrive sans lieu
  précis (les pièces d'une analyse, un import, « À verser ») y entre, à sa racine.
  **Nouveau répertoire** crée un répertoire (et des sous-répertoires) : un fil d'Ariane,
  tout en haut de la page (« Bibliothèque › Documents › Normes › ECSS »), dit où vous êtes
  et y ramène ; on verse
  ou crée là où l'on est ; **Déplacer…**, sur une fiche, range ailleurs ; **Regrouper par
  › Répertoire** montre tout ce qui est dessous. Des fichiers de l'ordinateur
  **glissés-déposés** sur la page y sont versés, là où vous êtes ; sur la carte d'un
  répertoire, dans ce répertoire. Dans vos **workflows**, un fichier ajouté (par n'importe
  quel moyen) donne son **extension** et s'il est **lisible** par l'application
  (déclencheur *Bibliothèque : document versé* : `{extension}`, `{lisible}`, `{lecture}`).
  Déposé dans un répertoire, un document **déjà dans la bibliothèque**, rangé ailleurs,
  n'est pas copié : une fenêtre propose **Ne rien faire** ou **Placer un fantôme ici** — une
  petite note qui le montre et l'ouvre d'ici (« Aussi ici, rangés ailleurs »). La
  **langue** de chaque document est détectée à son entrée ; quand la détection n'est pas
  assez sûre, il n'y a pas de langue et elle est **à confirmer** (sur sa fiche :
  « Confirmer : Français », ou « Langue… »). Sur la fiche d'un document, Identification,
  Le fichier, D'où il vient et Versions sont repliées d'origine (leur en-tête en dit
  l'essentiel) : un clic les déplie. Quand la détection de la langue n'est pas sûre et que
  l'IA est réglée, l'IA l'identifie (« identifiée par l'IA ») ; sinon elle reste à confirmer.
  De même pour le **titre** (« Titre : … » au début du document ; sinon celui du nom du
  fichier, à confirmer — « Prendre « … » » sur la fiche), pour le **type de pièce** (l'ancienne
  catégorie, choisi dans la liste du module *Typage des pièces*, vos types compris : donné
  par l'analyse, ou le nom du fichier et le texte d'accord ; sinon à confirmer, l'IA
  choisissant dans la liste), pour l'**émetteur** — choisi dans la liste des **émetteurs**
  (Bibliothèque › Émetteurs : un code, un nom, d'autres noms ; « ＋ Ajouter un émetteur à la
  liste… » depuis la fiche ; un émetteur hors de la liste a son bouton **+** pour l'y
  ajouter, un code proposé, et les autres documents de ce nom suivent) et reconnu dans le
  document, pour les **étiquettes** (« Mots-clés : … » ; sinon les mots qui reviennent
  le plus, proposés — l'IA en donne de 3 à 6, celles déjà en usage d'abord), pour la **date** du document (« Date : … », « Toulouse, le … » ;
  sinon la première date du texte, hors dates limites, proposée), pour l'**émetteur** (« Émetteur :
  … », « Émis par… » ; sinon l'organisme lu en tête, à confirmer) et pour la **référence** et la
  **version** (édition, révision) : lues au début du
  document ou dans le nom du fichier ; pas sûres, l'IA les cherche ; sinon « C'est juste »
  ou « Classer… » sur la fiche. Chaque champ de la fiche se modifie aussi seul : le crayon
  à gauche de son icône ouvre une petite fenêtre (le champ est alors confirmé) ; le bouton à
  côté **relance la recherche** du champ dans le document (sans IA, puis avec l'IA si ce
  n'est pas sûr). Les dates se choisissent aussi dans un **calendrier**. Le crayon devant
  *Fichier* **renomme le fichier** ; les liens vers lui, dans le coffre, suivent.
- **Bibliothèque de documents** : tout fichier déposé dans l'application y est rangé, une
  fois, avec sa fiche — les pièces importées dans une analyse (laissées à leur place), le
  fichier d'un import d'exigences, les échanges de types et de workflows, et ce que vous
  versez vous-même (« Verser des documents », depuis l'ordinateur ou le coffre). Menu
  **Bibliothèque** : une carte par document (famille, catégorie, d'où il vient), une
  recherche et des filtres ; la fiche d'un document : Classer…, ses origines (un clic y
  mène), ses versions — une nouvelle version est reconnue à son nom (« ind B », « v2 ») et
  se relie d'un clic ; « Retirer » met de côté, sans rien effacer. Ce que vous posez dans
  le dossier `Bibliothèque/À verser` (explorateur, synchronisation) y entre seul, à
  l'ouverture et chaque jour. Ce rangement est fait par
  des **workflows système** que vous pouvez modifier ou couper : ranger les pièces
  importées, ranger les fichiers importés, repérer les nouvelles versions probables, et,
  désactivé d'origine, signaler chaque lundi les fichiers introuvables.
- **Workflows** : les **workflows système** — ce que l'application fait d'elle-même (la
  note de l'analyse, le calendrier à l'import, le contrôle des exigences extraites, les
  rappels des remises, des questions et de la visite, et du rangement, et, désactivés
  d'origine, le rappel de la fin de validité des offres, l'extraction des exigences du
  CCTP à l'import, le questionnaire avec
  l'IA, la couverture d'une réponse, la qualité de la bibliothèque chaque lundi, la
  traduction des nouvelles exigences, les traductions à revoir chaque lundi, la relecture
  IA des nouvelles exigences, et, actif, le contrôle de la qualité des exigences
  importées ; pour l'IA, la vérification de la connexion à
  chaque ouverture, les nouveaux modèles du serveur, et, désactivé, un serveur lent ; pour la bibliothèque de documents, le rangement des pièces et des
  fichiers importés, les nouvelles versions probables, et, désactivés, les fichiers
  introuvables chaque lundi ; pour la lecture de fichiers, les formats non lus au dépôt ; pour le typage, les pièces
  sans type reconnu à l'import ; pour les workflows eux-mêmes, les workflows cassés à
  l'ouverture, et, désactivés, le bilan du lundi et l'archive mensuelle du journal) : modifiables, désactivables, pas supprimables,
  « Rétablir l'original » ; sur la page Workflows, ils sont rangés en **sections
  repliables** — *Workflows système*, une sous-section par module, puis *Mes workflows* —,
  en cartes, en liste ou en tableau, regroupés par module, déclencheur ou état ; la fiche
  d'un workflow le montre en **logigramme** (déclencheur, conditions, étapes, fin ; un clic
  sur une forme la modifie) ; « Nouveau workflow » (depuis l'onglet, sa fiche s'ouvre en
  page, et « Exécuter » mène à la fiche de l'exécution) ; un déclencheur, des conditions,
  des actions à la suite qui reprennent `{analyse}`, `{today}` ou le résultat d'une étape
  d'avant `{step1.link}` ; seul ou « demander d'abord » ; « Journal des workflows » ;
  export et import. Voir la page *Workflows* dans le coffre.

- **Documentation dans le coffre** : Réglages → Documentation → **Créer / mettre à jour**
  (ou la commande « Créer ou mettre à jour la documentation ») écrit l'accueil, la prise
  en main et une page par module dans `Black Projects/Documentation` (dossier
  modifiable), puis ouvre l'accueil. Vos propres notes ne sont jamais remplacées.
- **Infobulles** : survoler un réglage, un bouton, un état ou un bloc explique à quoi il
  sert.

- **Réglages → Général → Langue** : français ou anglais, appliqué au prochain chargement.
- **Réglages → Modules** : l'état de chaque module ; l'interrupteur l'active ou le
  désactive au prochain chargement. Vos données ne sont jamais supprimées.
- **Cliquer sur « Lecture de fichiers »** (ou sur son bouton **Formats de fichiers**) :
  une fenêtre montre les formats lus (en vert), en développement (en orange, avec
  une fiche par extension, trois par ligne, qui dit si le format est **lu**, **écrit**
  (« Export uniquement » quand il n'est créé que par export, comme le PDF) et **affiché**
  (« Oui nativement » quand Obsidian l'ouvre lui-même) (verte : les trois ; rouge : ni lu ni
  écrit, avec ce qui est à venir ; orange : le reste). Obsidian masque les fichiers qu'il
  n'ouvre pas, comme les `.json` d'export de types : l'**interrupteur** de leur fiche les
  affiche dans l'explorateur, ouverts en lecture seule par Black Projects.
- **Extensions équivalentes** (en tête de la fenêtre Formats de fichiers) : lire par exemple les
  fichiers `.tot` comme du XML ; voir [Lecture de fichiers](../modules/lecture-fichiers.md).
  Un **workflow système**, *Signaler les formats non lus, au dépôt de fichiers* (activé),
  prévient quand une pièce ou un fichier importé est d'un format non lu, et dit où
  déclarer l'équivalence ; un autre nomme les pièces illisibles (abîmées, protégées), et,
  désactivés d'origine, les pièces sans texte (scans) et le bilan des formats du lundi ; désactivable, et des extensions à taire se règlent dans son
  action.
- **Réglages → Licence** : les droits d'usage.
- Commande **À propos de Black Projects** : version, modules actifs, licence.
