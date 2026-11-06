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

## Aujourd'hui (version 0.17.0)

- **L'accueil** : l'onglet « Black Projects » s'ouvre au démarrage (ou par l'icône de la
  barre latérale, ou la commande « Ouvrir l'accueil de Black Projects ») : le bonjour, la
  date, et vos **tuiles** — des raccourcis vers les modules, avec des pastilles (« J-5 »
  pour la prochaine remise, exigences faibles, échecs de workflows, IA pas réglée).
  **Analyses**, **Exigences** et **Workflows** (menu ou tuile) ouvrent chacune leur page —
  toutes les analyses, toute la bibliothèque d'exigences, tous les workflows — avec une
  recherche et des filtres. **Modifier l'accueil** pour en ajouter, en retirer ou les déplacer. Le **Tableau de
  bord** (navigation, tuile, ou commande) donne les informations : une carte par analyse
  avec sa date limite de remise, l'état de l'IA, la bibliothèque d'exigences, les derniers
  workflows. **Modifier le tableau de bord** pour masquer une section, la déplacer
  (glisser, ou boutons monter, descendre, changer de colonne) ; la flèche d'une section la
  réduit à son titre. **Modifier le menu** (en bas de la barre de gauche, au-dessus de Paramètres) pour déplacer, retirer ou
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
  les échanger avec d'autres coffres. Chaque pièce est rangée avec l'appel d'offres ou
  avec la réponse (une par candidat pour l'émetteur), d'après le réglage « Où vont les
  types de pièces » du module *Analyse d'appels d'offres* (un bouton pour ajouter un
  type, une liste dépliable, un type par ligne avec ses interrupteurs « AO » et « Réponse AO ») ; quand le type va dans les
  deux, la question est posée à l'import. La liste est vide au départ : à vous de
  choisir ; un message l'explique à l'activation du module, puis un rappel s'affiche à
  l'ouverture tant qu'elle est vide (il se coupe d'une case). Les fiches de **Types de
  pièces** rappellent où va chaque type, et l'export / import de types fait voyager ce
  rangement.


- **Exigences** : « Nouvelle exigence » (catégorie, titre, formulation, attributs ;
  l'identifiant REQ-SYS-0001 est attribué et ne sera jamais réutilisé), « Exigences :
  liste, filtres et fiches » pour parcourir la bibliothèque et modifier une fiche, et le
  bloc `brt-req` pour citer des exigences dans un document ; voir la page *Exigences* de
  la documentation écrite dans le coffre.

- **Extraire les exigences** : sur la note d'une pièce (le CCTP), « Extraire les exigences
  de la pièce » ; un aperçu montre chaque exigence trouvée et où, puis elles sont rangées
  dans le dossier `Exigences` de l'analyse, chacune liée à sa pièce ; la pièce et
  l'analyse les listent. « Importer des exigences d'un fichier » fait de même pour la
  bibliothèque (ReqIF de DOORS compris).

- **Vérifier les exigences du dossier** : « Vérifier les exigences du dossier (les quatre
  vérifications) », ou chacune seule — tout extraire, chercher les exigences oubliées
  (phrases en « doit », « devra », « shall »… non reprises), la cohérence entre pièces,
  la couverture par la réponse ; le rapport `Analyse/Vérification des exigences` de
  l'analyse en garde le résultat.

- **Qualité des exigences** : « Analyser la qualité des exigences du dossier » écrit la note
  `Analyse/Qualité des exigences` (répartition des notes, défauts, doublons, exigences non
  vérifiables), hors ligne ; la note de chaque exigence est aussi dans la liste et la
  fiche de la bibliothèque.

- **Calendrier de l'appel d'offres** (sans IA) : la note `Analyse/Calendrier` — date
  limite de remise, validité des offres, délais et livraisons, chacun avec sa phrase et
  sa pièce.

- **IA** : Paramètres → Black Projects → **IA** — adresse du
  serveur, clé (rangée dans le trousseau, jamais dans le coffre), **Tester la
  connexion**, puis un modèle par usage — analyse, traduction, vecteurs, reranking,
  lecture OCR, lecture par vision —, chacun dans le menu de sa ligne (ou « Saisir un autre nom… »). Ensuite : **Relire l'exigence avec l'IA** (un avis,
  des reformulations à choisir ou non), **Traduire l'exigence avec l'IA** (marquée à
  relire), les doublons par le sens dans la qualité (avec un modèle d'embeddings) ;
  pour un appel d'offres, **Interroger le dossier** (la réponse cite ses sources, liées
  aux pièces ; rien trouvé, l'IA n'est pas appelée), le **Questionnaire du dossier**
  (six questions prêtes) et **Relire les exigences du dossier avec l'IA**.

- **Workflows** : « Nouveau workflow » — de zéro ou d'après un modèle prêt à l'emploi
  (calendrier à l'import des pièces, qualité à l'extraction des exigences, questionnaire
  avec l'IA, qualité de la bibliothèque chaque lundi) ; un déclencheur, des conditions,
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
- **Réglages → Licence** : les droits d'usage.
- Commande **À propos de Black Projects** : version, modules actifs, licence.
