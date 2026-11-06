# Recette — étape 6 ter : accueil et interface

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Sur le coffre de test.

## L'accueil

- [ ] À l'ouverture du coffre, l'onglet **Black Projects** s'ouvre : « Bonjour » (ou
      « Bon après-midi », « Bonsoir ») et la date ; à gauche la navigation (Accueil,
      Tableau de bord, Analyses, Exigences, Workflows, IA, et Paramètres tout en bas)
- [ ] Fermer l'onglet ; l'icône de la barre latérale, ou la commande **Ouvrir l'accueil
      de Black Projects**, le rouvre ; Paramètres → *Accueil et apparence* → « Ouvrir
      l'accueil au démarrage » désactivé : il ne s'ouvre plus seul
- [ ] **Analyses d'appels d'offres** : les actions rapides (nouvelle analyse, importer,
      calendrier ; interroger et questionnaire si l'IA est réglée) ; une carte par analyse,
      la remise la plus proche en tête : J-n en rouge à 7 jours ou moins, en orange à 21,
      en vert au-delà, avec la date en toutes lettres ; pièces (et non lues), exigences,
      qualité en pourcentage et en étoiles ; badges (« exigences à extraire », « n exigences
      faibles »…)
- [ ] Le titre d'une carte ouvre la note de l'analyse **dans un nouvel onglet** ;
      « Calendrier » relève et ouvre le calendrier ; « Importer des pièces » importe dans
      cette analyse
- [ ] Importer des pièces : l'accueil se met à jour seul (la carte change)
- [ ] **IA** : réglée, l'adresse et chaque usage (réglé ✓, ou « non réglé : … à la place ») ;
      non réglée, un message et le bouton « Réglages »
- [ ] **Bibliothèque d'exigences** : nombre, note moyenne, faibles, traductions à revoir ;
      **Workflows** : les dernières exécutions (✓, ✕…) et les boutons
- [ ] **Rafraîchir** recharge les sections ; une section en échec le dit sans empêcher
      les autres

## Thèmes et accessibilité

- [ ] **Apparence** : le panneau s'ouvre ; chaque choix s'applique tout de suite et est
      gardé (Paramètres → *Accueil et apparence* montre la même chose) ; Échap le ferme
- [ ] Mode **Automatique** : changer le thème d'Obsidian (clair ↔ sombre) change l'accueil
- [ ] **Rouge-vert** : bleu pour ce qui va, vermillon pour l'urgent ; **Bleu-jaune** ;
      **Monochrome** : aucun état ne se lit à la seule couleur (icône, mot, trait plein /
      tirets / double)
- [ ] **Lecture facilitée (dys)** : police lisible (installer OpenDyslexic pour la voir),
      texte plus grand et plus espacé, fond crème, pas d'italique
- [ ] **Taille du texte** très grande : rien ne déborde ; fenêtre étroite : une colonne
- [ ] Au clavier seul (Tab, Entrée, flèches dans les choix) : tout se fait, le focus se voit

## L'accueil à tuiles et le tableau de bord (v0.12.0)

- [ ] **Dans Obsidian** (v0.12.1) : les tuiles sont des icônes carrées de couleur sur fond
      transparent, nom en dessous sur deux lignes au besoin — pas de pastille blanche
      ombrée ni d'icône écrasée ; la navigation de gauche est alignée à gauche, sans cadre
      blanc ; idem en thème sombre d'Obsidian et avec un thème communautaire

- [ ] L'accueil : « Bonjour » (ou « Bon après-midi », « Bonsoir ») et la date, puis les
      tuiles par défaut : Tableau de bord, Nouvelle analyse, Analyses, Importer des pièces,
      Calendrier, Interroger, Exigences, Workflows, IA, Paramètres
- [ ] Les pastilles : « J-n » sur Analyses (prochaine remise, rouge à 7 jours ou moins),
      le nombre d'exigences faibles sur Exigences, les échecs récents sur Workflows, « ! »
      sur IA et Interroger quand l'IA n'est pas réglée ; l'infobulle dit ce qu'elles
      veulent dire
- [ ] Chaque tuile lance son action (Exigences ouvre la liste, Tableau de bord change de
      page…)
- [ ] **Modifier l'accueil** : les tuiles tremblent ; − en retire une ; « Tuiles à
      ajouter » (rangées par module) en ajoute ; glisser-déposer en déplace une ; au
      clavier, Tab jusqu'à une tuile puis Alt + → ou Alt + ← (le déplacement est annoncé) ;
      **Terminé**
- [ ] Fermer et rouvrir Obsidian : l'agencement est gardé ; « Rétablir l'accueil par
      défaut » le remet
- [ ] Apparence *Mouvement réduit* : les tuiles ne tremblent plus en modification
- [ ] Désactiver le module Workflows : sa tuile disparaît de l'accueil, rien ne casse
- [ ] **Tableau de bord** (navigation, tuile, ou commande « Ouvrir le tableau de bord de
      Black Projects ») : les sections d'informations (analyses et échéances, IA,
      exigences, workflows)

## Les workflows système (v0.59.0)

- [ ] Page **Workflows**, filtre **Système** : les dix workflows système, badge
      « Système » ; actifs d'origine : note de l'analyse (pièces, exigences), calendrier,
      contrôle des exigences, rappel des remises, rappel du rangement
- [ ] Leur fiche : le message « Workflow système du module … » ; pas de **Supprimer**
- [ ] Modifier un workflow système (son nom) : « Modifié », **La version d'origine**,
      **Rétablir l'original** (confirmé) le remet
- [ ] **Dupliquer** : la copie est un workflow ordinaire (supprimable)
- [ ] Importer des pièces : le calendrier et le tableau de la note se font, le journal les
      montre (filtre Système) ; aucun message « Workflow … exécuté »
- [ ] Désactiver « Note de l'analyse : le tableau des pièces » : à l'import suivant, la note
      n'est plus mise à jour (la fiche en page reste juste)
- [ ] Rappel du rangement réglé, à l'ouverture d'Obsidian : le rappel vient du workflow
      système (journal)
- [ ] Activer « Traduire les nouvelles exigences (IA) » : une exigence créée est traduite,
      « à relire »

## Le module Workflows : importer, en page (v0.58.0)

- [ ] Page **Workflows** → **Importer** un fichier d'un seul workflow : sa **fiche**, qui
      dit « Importé, et donc désactivé… » ; aucune note ouverte
- [ ] Un fichier de plusieurs workflows : la **liste**, eux en tête, « Importé — désactivé,
      à relire », filtre **Importés**, et le message « n workflow(s) importé(s) attendent… »
- [ ] **Activer** chacun : le message disparaît quand tous le sont ; la carte reste
      « Importé »
- [ ] Depuis la palette, *Importer des workflows* : le message seul

## Le module Typage des pièces : la tuile des types (v0.57.0)

- [ ] **Modifier l'accueil** → ajouter **Types de pièces** → **Terminé** ; la tuile ouvre
      la page « Typage des pièces — Types de pièces » ; aucune fenêtre
- [ ] Sur la page, **Exporter…** puis **Importer…** : leurs fenêtres, puis on reste sur la
      page (le message dit le résultat)

## Le module Lecture de fichiers : la tuile des formats (v0.56.0)

- [ ] **Modifier l'accueil** → ajouter **Formats de fichiers** → **Terminé** ; la tuile
      ouvre la page « Lecture de fichiers — Formats de fichiers » ; aucune fenêtre
- [ ] La page : les formats, une fiche par extension (lu, écrit, affiché), les extensions
      équivalentes

## Le module Exigences : les liens, de fiche en fiche (v0.55.0)

- [ ] Une exigence liée à une autre (« Découle de ») : sur sa fiche, le lien montre le nom
      et la formulation de l'autre ; un clic ouvre sa fiche
- [ ] Sur la fiche de l'autre : « En découle … », un clic ramène à la première
- [ ] Un lien « Satisfaite par » un ticket : « hors de la bibliothèque », pas de clic ; un
      identifiant inconnu : « introuvable dans ce dossier d'exigences »

## Le module Analyse d'appels d'offres : le rapport de couverture, en page (v0.54.0)

- [ ] Analyse côté émetteur, une réponse importée pour un candidat ; sa fiche →
      **Écrire le rapport de couverture** : on reste sur la fiche, aucune note ouverte ;
      le message dit « Le rapport de vérification de l'analyse est à jour »
- [ ] Le bouton devient **Mettre à jour le rapport de couverture**
- [ ] **Ouvrir la vérification** : la page de la vérification (la couverture par chaque
      réponse)

## Le module Workflows : créer et exécuter, en page (v0.53.0)

- [ ] Page **Workflows** → **Nouveau workflow** (de zéro ou d'après un modèle) : la
      **fiche** du workflow créé, en page, pas la fenêtre
- [ ] Même chose depuis le tableau de bord et la tuile *Nouveau workflow*
- [ ] **Exécuter** sur une carte ou la fiche : (le sujet, s'il en faut un) puis la
      **fiche de l'exécution** — issue, étapes, notes écrites ; **Exécuter de nouveau**
      mène à la fiche de la nouvelle
- [ ] Un workflow sans action : le message, on reste sur la fiche
- [ ] Depuis la palette, *Nouveau workflow* : la fiche en fenêtre, comme avant

## Le module IA : tester la connexion, en page (v0.52.0)

- [ ] Tableau de bord, section IA, **Tester la connexion** (ou la tuile) : puis la page
      **IA** ; en tête « Dernier test (date heure) : connexion réussie — n modèle(s)… »
- [ ] Adresse fausse ou clé refusée : « connexion impossible — raison », en rouge
- [ ] La liste **Modèles du serveur (n)** : pour chacun, « choisi pour : … » et
      « convient pour / conviendrait aussi pour : … »
- [ ] Sur la page, **Tester la connexion** : on y reste, le résultat en tête
- [ ] Depuis la palette, *Tester la connexion au serveur d'IA* : le message, qui renvoie
      à la page IA

## Traduire des exigences, puis les relire en page (v0.51.0)

- [ ] IA réglée ; page **Exigences** → **Traduire (IA)** : la langue (s'il y en a
      plusieurs), les exigences ; puis la page **Traductions à relire — EN** ; aucune note
      ouverte
- [ ] Ses chiffres (à relire, chiffres qui diffèrent, traduites par la série) ; chaque
      carte : la traduction, la source, les chiffres qui diffèrent, la note de l'IA
- [ ] **Valider la traduction** : la carte reste, « Validée », passe en bas ; le chiffre
      « À relire » baisse
- [ ] **Traduire de nouveau** sur une carte ; un clic ouvre la fiche
- [ ] La page Exigences : « Traductions à relire (n) » y mène, tant qu'il en reste
- [ ] Depuis la palette, *Traduire des exigences avec l'IA* : le message seul

## Traduire l'exigence, sans écraser (v0.50.0)

- [ ] Fiche d'une exigence dont la traduction EN est validée : **Traduire (IA)** → la
      question « remplacer la traduction EN ? » ; **Garder la traduction** : rien ne change
- [ ] **Remplacer** : traduite de nouveau, « à relire » ; le message dit de la valider
      sur sa fiche
- [ ] Trois langues (fr, en, de) : la fenêtre propose DE (absente) avant EN (à jour)
- [ ] Depuis une carte de la page Exigences : la fiche ensuite (comme en 0.44.0)

## Relire l'exigence, en page (v0.49.0)

- [ ] IA réglée ; page **Exigences**, **Relire (IA)** d'une carte : (choisir une
      reformulation ou « Ne rien changer ») puis la **fiche** s'ouvre, la relecture après
      les formulations ; aucune note ouverte
- [ ] Une reformulation retenue : la carte FR dit « Reformulée par l'IA, retenue le … »
- [ ] Retour à la bibliothèque : la carte porte « Relue (IA) le … » ; filtre **Relues (IA)**
- [ ] Sur la fiche, **Relire (IA)** : on reste sur la fiche, la relecture y apparaît
- [ ] L'IA sans réponse : on reste où l'on est, le message le dit

## Modifier la fiche, en page (v0.48.0)

- [ ] Sur la fiche d'une exigence, **Modifier la fiche** : changer la formulation ; la
      fiche redessinée (nouvelle formulation, révision dans l'historique) ; aucune note
      ouverte
- [ ] Changer le titre : la fiche suit l'exigence sous son nouveau nom (pas
      « Exigence introuvable ») ; « Retour » retrouve aussi l'exigence
- [ ] Page **Exigences**, **Modifier** sur une carte : la fiche modifiée s'ouvre
- [ ] Depuis la palette, *Modifier l'exigence* sur sa note : la note (renommée) s'ouvre

## Nouvelle exigence, en page (v0.47.0)

- [ ] Page **Exigences** → **Nouvelle exigence** : le formulaire, puis la **fiche** de
      l'exigence créée ; le message « Exigence … créée » ; aucune note ouverte
- [ ] Même chose depuis le tableau de bord et la tuile *Nouvelle exigence*
- [ ] Formulaire abandonné : on reste sur la page
- [ ] Depuis la palette, *Nouvelle exigence* : la note s'ouvre, comme avant

## Analyser la qualité de la bibliothèque, en page (v0.46.0)

- [ ] Page **Exigences** → **Analyser la qualité** : la page **Qualité des exigences** ;
      aucune note écrite ni ouverte ; même chose depuis le tableau de bord et la tuile
      *Qualité*
- [ ] Ses chiffres (exigences, note moyenne, faibles, non vérifiables, doublons) ; une
      carte par exigence, les plus faibles d'abord ; un clic ouvre sa fiche
- [ ] Les listes : défauts, doublons probables, axes, répartition, rattachements ; les
      filtres Faibles, Non vérifiables, Doublons, Bonnes, Relues (IA)
- [ ] **Écrire le rapport** : un message, on reste sur la page ; le bouton devient
      **Mettre à jour le rapport**, et **Ouvrir le rapport** apparaît
- [ ] Depuis la palette, *Analyser la qualité de la bibliothèque* : le rapport écrit et
      ouvert, comme avant

## Importer des exigences, en page (v0.45.0)

- [ ] Page **Exigences** → **Importer** : où est le fichier, l'aperçu, la catégorie si
      besoin ; puis la page **Importées de …** s'ouvre ; aucune note ouverte
- [ ] Ses chiffres : venues de ce fichier, créées, mises à jour (et non importées s'il y
      en a, avec un message) ; chaque carte « Créée par l'import » ou « Mise à jour… » et
      l'endroit du fichier (« ligne 2 », « § 4.2 ») ; filtres Créées, Mises à jour
- [ ] Réimporter le fichier modifié : les exigences mises à jour marquées
- [ ] Un clic sur une carte : sa fiche ; la ligne « Extraite de » ramène à la page
- [ ] La tuile **Importer des exigences** : pareil ; depuis la palette, le message seul

## Traduire les exigences, et valider la traduction (v0.44.0)

- [ ] IA réglée, deux langues de rédaction ; page **Exigences** : **Traduire (IA)** d'une
      carte → la traduction faite, la **fiche** de l'exigence s'ouvre ; aucune note ouverte
- [ ] Sur la fiche, la carte de la langue traduite : « traduction automatique à relire »,
      la note de l'IA, et « Chiffres ou unités différents » si un chiffre a changé
- [ ] **Traduire (IA)** sur la carte d'une langue : pas de question sur la langue
- [ ] **Valider la traduction** : la carte passe « À jour », « validée le … »
- [ ] En tête de la bibliothèque, **Traduire (IA)** : la langue (s'il y en a plusieurs),
      les exigences (absentes ou en retard cochées), un message qui résume ; le filtre
      **Traductions à relire** les retrouve
- [ ] Depuis la palette, *Traduire l'exigence avec l'IA* sur une note ouverte : le
      message, comme avant (avec la note de l'IA)

## Relire les exigences, et lire la relecture (v0.43.0)

- [ ] IA réglée ; fiche d'une analyse avec des exigences → **Relire (IA)** : la fenêtre des
      exigences à relire (les plus faibles cochées) ; après la relecture, la page **Qualité**
      s'ouvre ; aucune note ouverte
- [ ] Les exigences relues portent « Relue (IA) le … » ; filtre **Relues (IA)**
- [ ] Un clic sur une exigence relue : sa fiche montre, après les formulations, « Relecture
      par l'IA — date » : l'avis, les défauts relevés, les reformulations proposées
- [ ] Sur la fiche d'une exigence, **Relire (IA)** : la relecture apparaît sur la fiche

## Changer le type, puis le routage (v0.42.0)

- [ ] Routage : CCTP → Réponse AO seulement. Fiche d'une pièce de l'appel d'offres →
      **Changer le type** → CCTP : « Le type CCTP — … est routé avec Réponse : déplacer la
      pièce ? » ; **Déplacer avec Réponse** : la fiche suit la pièce (« · Réponse · »)
- [ ] **La laisser avec Appel d'offres** : le type change, la pièce reste
- [ ] Un type routé là où est déjà la pièce, ou routé « les deux » : aucune question
- [ ] Émetteur, vers la réponse : un choix par candidat (« Déplacer avec la réponse de
      Acme »), « La réponse d'un nouveau candidat… », « La laisser… »

## Déplacer une pièce depuis l'interface (v0.41.0)

- [ ] Fiche d'une pièce → **Déplacer** → « Réponse » : la fiche de la pièce, à sa nouvelle
      place (« · Réponse · ») ; aucune note ouverte
- [ ] « Retour » : la même pièce, là où elle est maintenant (pas « Pièce introuvable »)
- [ ] Sur la fiche de l'analyse, **Déplacer** sur la carte d'une pièce : la fiche reste et
      se redessine, la pièce dans son nouveau groupe
- [ ] La palette de commandes (« Déplacer la pièce ») ouvre toujours la note déplacée

## Extraire les exigences depuis l'interface (v0.40.0)

- [ ] Fiche d'une pièce lue (CCTP.docx) → **Extraire les exigences** : l'aperçu « Exigences
      trouvées dans… » ; une fois accepté, la fiche montre le nombre d'exigences extraites
      et leur liste ; la note de la pièce ne s'ouvre pas
- [ ] Sur la fiche de l'analyse, le bouton **Extraire les exigences** d'une carte de pièce :
      de même, la liste des exigences de l'analyse se met à jour
- [ ] La palette de commandes (« Extraire les exigences de la pièce ») ouvre toujours la
      note de la pièce

## Mettre à jour l'analyse depuis sa fiche (v0.39.0)

- [ ] Déposer un fichier dans `Pièces/Appel d'offres/Originaux` d'une analyse (explorateur
      d'Obsidian), puis, sur sa fiche, **Mettre à jour** : « 1 pièce(s) importée(s)… », la
      fiche se redessine avec la nouvelle pièce ; aucune note ouverte
- [ ] Rien de nouveau : « Aucune nouvelle pièce : le tableau des pièces est à jour. », la fiche
      reste
- [ ] La palette de commandes (« Mettre à jour l'analyse ») ouvre toujours la note

## Importer des pièces depuis l'interface (v0.38.0)

- [ ] Fiche d'une analyse → **Importer des pièces** : les fichiers, « Où ranger ces pièces ? »
      s'il le faut, puis la fiche se redessine avec les nouvelles pièces ; aucune note ouverte
- [ ] Tableau de bord → **Importer des pièces** (et la tuile) : « Dans quelle analyse ? » s'il
      y en a plusieurs, puis la fiche de l'analyse
- [ ] Tuile **Nouvelle analyse** : la fiche de l'analyse créée s'ouvre aussitôt ; « Importer
      des fichiers de l'ordinateur » : l'import revient sur cette fiche
- [ ] La palette de commandes (Importer des pièces, Nouvelle analyse) ouvre toujours la note

## Les raccourcis du tableau de bord en page (v0.37.0)

- [ ] Tableau de bord → section Analyses → **Calendrier** : « Dans quelle analyse ? » (s'il
      y en a plusieurs), puis la page du calendrier dans l'onglet ; aucune note ouverte
- [ ] **Interroger** : l'analyse, la question, puis la réponse sur sa page ;
      **Questionnaire** : la page du questionnaire
- [ ] Le bouton **Calendrier** d'une carte d'analyse : la page de son calendrier, sans rien
      demander
- [ ] Accueil : tuiles **Calendrier**, **Vérifier**, **Qualité**, **Questionnaire** : la page
      de l'analyse choisie
- [ ] Paramètres → Analyse d'appels d'offres : « Où vont les types de pièces » → **Ajouter un
      routage…** ; la petite fenêtre se valide par **Ajouter un routage**

## Le journal des workflows : sujet et notes en page (v0.36.0)

- [ ] Workflows → **Journal** → une exécution (« À l'import des pièces : relever le
      calendrier ») : **Ouvrir le sujet** ouvre la fiche de l'analyse dans l'onglet, pas la
      note
- [ ] Dans « Notes écrites », **Calendrier** ouvre la page du calendrier ; une exigence, sa
      fiche ; une note sans page (un rappel) s'ouvre dans le coffre
- [ ] « Retour » ramène à l'exécution, puis au journal ; « Ouvrir la note du journal » ouvre
      toujours la note du journal

## La documentation, en page (v0.35.0)

- [ ] Paramètres → **Lire la documentation** (ou la tuile Documentation) : le sommaire
      dans l'onglet — l'accueil de la documentation, puis « Toutes les pages » (l'accueil,
      la prise en main, une page par module) ; rien n'est écrit dans le coffre
- [ ] Une page (Exigences) : son titre, « Toute la documentation », « ← page précédente »,
      « page suivante → » ; les exemples de code tels quels (` ```brt-req `), sans `**`,
      `[[` ni `{{` ; une phrase suivie de sa liste dans un seul cadre
- [ ] Un lien vers une autre page de la documentation l'ouvre dans l'onglet ; « Retour »
      ramène à la page d'avant
- [ ] **Écrire dans le coffre** : les notes sont écrites, Obsidian ne les ouvre pas ;
      « Ouvrir dans le coffre » apparaît, et ouvre la note de la page
- [ ] La recherche (« apparence ») ne garde que ce qui en parle

## Les fonctions d'un module, en page (v0.34.0)

- [ ] Paramètres → un clic sur le nom d'un module (ou son bouton « Formats de fichiers »,
      « Types de pièces », « Fonctions ») : sa page dans l'onglet, titrée « Module —
      Fonctions », ce qu'il fait en tête ; pas de fenêtre ; Paramètres est « page en
      cours », « Retour » ramène aux paramètres
- [ ] Ses réglages fonctionnent comme dans la fenêtre : un interrupteur (`.json` dans
      Lecture de fichiers), un texte (l'adresse de l'IA), un menu, une paire ; un réglage
      changé est enregistré (le retrouver après un aller-retour)
- [ ] Page IA → **Régler la connexion** : la page du module IA ; tuile **Formats de
      fichiers** : la page de Lecture de fichiers
- [ ] Paramètres d'Obsidian → Black Projects → le bouton d'un module : la fenêtre, comme
      avant (la page serait cachée derrière les réglages d'Obsidian)

## Les paramètres, en page (v0.33.0)

- [ ] **Paramètres** (en bas de la barre de gauche) : la page s'ouvre dans l'onglet de
      Black Projects, l'entrée est « page en cours » ; la tuile Paramètres de l'accueil y
      mène aussi ; la fenêtre de réglages d'Obsidian ne s'ouvre pas
- [ ] Les chiffres (modules actifs, langue, version) ; Général : **Changer la langue**
      (un choix, l'actuelle marquée ; au prochain chargement), **Ne plus l'ouvrir au
      démarrage**, la documentation (**Créer / mettre à jour**, **Changer le dossier**), la
      licence
- [ ] Apparence : une carte par choix, **Changer** → la fenêtre de choix ; l'interface
      change tout de suite
- [ ] Modules : chaque module, sa version et son état (vert, gris, orange, rouge), ce dont
      il a besoin ; un clic sur son nom ouvre sa fenêtre **Fonctions** ; **Désactiver** :
      « Au prochain chargement » sur la carte ; filtres **Modules actifs**, **Désactivés**,
      **En difficulté**
- [ ] **Réglages dans Obsidian** ouvre l'onglet de réglages d'Obsidian sur Black Projects ;
      un réglage changé d'un côté se retrouve de l'autre

## Le calendrier, en page (v0.32.0)

- [ ] Fiche d'une analyse → **Calendrier** : sa page, sans fenêtre ni note ouverte ;
      « Relevé à l'ouverture de la page »
- [ ] Les chiffres : la date limite de remise (« J-n », rouge à une semaine, orange à trois,
      verte au-delà ; la même couleur dans « À retenir » et dans les dates), la validité
      des offres, les dates à venir, les délais
- [ ] « À retenir », les dates dans l'ordre (« J-n », la phrase, la pièce), les délais ;
      filtres **À venir**, **Passées**, **Délais**
- [ ] Un clic sur une date ou un délai ouvre la fiche de la pièce ; « Retour » ramène au
      calendrier
- [ ] **Écrire le calendrier** : la note est écrite, Obsidian ne l'ouvre pas ; le bouton
      devient « Mettre à jour la note », « Ouvrir la note » apparaît
- [ ] « Ce que l'analyse a produit » → Calendrier : la même page ; une autre note du
      dossier Analyse (une synthèse à soi) s'ouvre toujours lisible, en page

## La vérification des exigences, en page (v0.31.0)

- [ ] Fiche d'une analyse → **Vérifier** : sa page, sans fenêtre ni note ouverte ;
      « Calculée à l'ouverture de la page, sans rien écrire »
- [ ] Les chiffres (exigences dans les pièces, oubliées, incohérences, couverture) ; les
      quatre listes numérotées : extraction par pièce, phrases oubliées, constats de
      cohérence, couverture
- [ ] Émetteur avec deux candidats : une couverture par candidat, les absentes d'abord
      (rouge), la couverture « 0–100 % » dans les chiffres
- [ ] Filtres **Extraction**, **Exigences oubliées**, **Cohérence**, **Couverture** ; un
      clic ouvre la fiche de la pièce ou de l'exigence, « Retour » ramène à la vérification
- [ ] **Tout vérifier** : les aperçus d'ajout s'ouvrent, le rapport est écrit, Obsidian
      ne l'ouvre pas ; « Ouvrir le rapport » apparaît
- [ ] **Tout extraire** / **Ajouter des oubliées** : l'aperçu, puis la page se redessine

## La qualité des exigences, en page (v0.30.0)

- [ ] Fiche d'une analyse avec des exigences → **Qualité du dossier** : sa page, sans
      fenêtre ni note ouverte ; « Calculée à l'ouverture de la page »
- [ ] Les chiffres (exigences, note moyenne avec ses étoiles, faibles, non vérifiables,
      doublons probables) ; une carte par exigence, la plus faible en tête, avec ses
      défauts, ses étoiles, les axes qui lui coûtent
- [ ] Filtres **Faibles**, **Non vérifiables**, **Doublons probables**, **Bonnes** ; un clic
      sur une exigence ouvre sa fiche, « Retour » ramène à la qualité
- [ ] Défauts les plus fréquents, doublons probables, axes de la norme, répartition des
      notes (sans les lignes à zéro)
- [ ] **Écrire le rapport** : la note est écrite, Obsidian ne l'ouvre pas ; le bouton
      devient « Mettre à jour le rapport », « Ouvrir le rapport » apparaît
- [ ] Une analyse sans exigence : un message dit comment en avoir

## Le questionnaire, en page (v0.29.0)

- [ ] IA réglée ; fiche d'une analyse → **Questionnaire** : sa page, les six thèmes « Pas
      encore posée », avec leur question ; « Remplir le questionnaire » mis en avant
- [ ] **Remplir le questionnaire** : la fenêtre de choix des thèmes ; après, la page se
      redessine (Obsidian n'ouvre pas la note) : chaque thème Répondue (vert), Sans source
      citée (orange), Rien dans les pièces (bleu)
- [ ] Les chiffres (thèmes posés, citées, sans source, rien dans les pièces, pas encore
      posés) ; les filtres par état
- [ ] Un clic sur un thème : la question posée, la réponse, une carte par source (les
      extraits sans « ### ») ; un clic sur une source ouvre la fiche de la pièce
- [ ] **Reposer cette question** (ou « Reposer » sur sa carte) : sans fenêtre de choix,
      ce thème seul ; les autres ne bougent pas
- [ ] Sans IA : un message le dit, pas de bouton pour remplir

## Une question au dossier, en page (v0.28.0)

- [ ] IA réglée ; fiche d'une analyse → **Interroger** : la question, puis la réponse
      s'ouvre **sur sa page** (pas dans une note Obsidian)
- [ ] La page : la question en titre, « analyse · date · mode », les chiffres (sources
      transmises, citées, non citées, extraits), la réponse avec ses « [1] », une carte par
      source (Citée en vert, Non citée en gris, les extraits) ; filtre **Non citées**
- [ ] Un clic sur une source ouvre la fiche de la pièce ; « Retour » ramène à la question
- [ ] **Reposer la question** : la fenêtre, la question déjà écrite ; la nouvelle réponse
      s'ouvre sur sa page, une nouvelle note est écrite
- [ ] La fiche de l'analyse liste « Questions au dossier (n) », la plus récente d'abord
- [ ] La commande « Interroger le dossier » (palette) ouvre toujours la note
- [ ] Démonstration : Station sol → « Quelles pénalités en cas de retard de livraison ? »

## Une note produite, en page (v0.27.0)

- [ ] Fiche d'une analyse → **Calendrier**, puis dans « Ce que l'analyse a produit » un clic
      sur **Calendrier** : sa page — « Calendrier — <analyse> », « À retenir », « Dates »,
      « Délais » en listes, sans `|`, `**`, `[[` ni marques `<!-- -->`
- [ ] Un clic sur une date ouvre la fiche de la pièce ; « Retour » ramène à la note
- [ ] **Vérification des exigences** (après « Vérifier ») : le résumé, une section par
      vérification ; la couverture d'un candidat en vert / rouge ; un clic sur une exigence
      ouvre sa fiche
- [ ] **Mettre à jour** refait la note sans quitter la page (Obsidian n'ouvre pas la note) ;
      **Ouvrir la note** l'ouvre dans le coffre ; **Ouvrir l'analyse**
- [ ] La recherche (« pénalité », « RC ») ne garde que les lignes et paragraphes qui
      répondent ; « n sur N affiché(s) »
- [ ] Une question (Analyse/Questions) : la réponse en paragraphes, l'avertissement en
      encadré, les sources avec leurs passages

## La fiche d'une exécution, en page (v0.26.0)

- [ ] Dans le journal (ou « Dernières exécutions », ou l'historique d'un workflow, ou le
      tableau de bord), un clic sur une exécution : sa fiche — « nom — date heure », son
      sujet, son issue, ce que chaque étape a fait, les notes écrites, les autres exécutions
- [ ] Une exécution en échec : l'étape en rouge avec la raison ; **Exécuter de nouveau** mis
      en avant
- [ ] **Ouvrir la fiche du workflow** ; **Ouvrir la note du sujet** (l'analyse visée) ; un
      clic sur une note écrite l'ouvre
- [ ] Un workflow supprimé depuis : un message le dit, la fiche de l'exécution reste

## Le journal des workflows, en page (v0.25.0)

- [ ] Page Workflows → **Journal** (ou la tuile Journal, ou la commande « Journal des
      workflows ») : la page du journal — exécutions, réussies, échecs, refusées ou
      arrêtées ; une liste par jour, l'heure en face de chaque exécution
- [ ] **Un clic sur une exécution ouvre la fiche du workflow** ; « Retour » revient au
      journal ; de même depuis « Dernières exécutions » (page Workflows) et la section
      Workflows du tableau de bord
- [ ] Filtre « Échecs » : seules les exécutions en échec, « 1 sur 2 affiché(s) »
- [ ] Une exécution d'un workflow supprimé depuis : la note du journal s'ouvre

## La fiche d'un candidat, en page (v0.24.0)

- [ ] Analyse en position **émetteur**, avec la réponse de deux candidats : la fiche de
      l'analyse montre « Candidats (2) », chaque carte avec sa couverture (« Couverture
      100 % » en vert, « 0 % » en rouge)
- [ ] Un clic sur un candidat : sa fiche — sa réponse (ses pièces), les chiffres (exigences
      couvertes, à vérifier, absentes, pièces), la couverture des exigences, les absentes
      d'abord, avec l'endroit de la réponse et l'extrait
- [ ] Un clic sur une exigence ouvre sa fiche ; « Retour » ramène au candidat
- [ ] **Écrire le rapport de couverture** écrit la section du rapport de vérification

## La fiche d'une pièce, en page (v0.23.0)

- [ ] Sur la fiche d'une analyse, un clic sur le nom d'une pièce : sa fiche s'ouvre,
      titrée du nom du fichier ; l'entrée Analyses reste marquée
- [ ] Les chiffres (lecture, type, caractères lus, exigences extraites) ; le texte lisible
      (pas de « ### » ni de « |---| ») ; les dates **et délais** relevés dans la pièce
- [ ] **Extraire les exigences** : après l'import, elles apparaissent dans la fiche ; un clic
      ouvre la fiche de l'exigence, « Retour » ramène à la pièce
- [ ] **Changer le type** : la fiche change aussitôt ; **Déplacer** : retour à l'analyse
- [ ] Une image ou un scan : un message dit qu'elle sera lue par la vision (étape 7)

## Le retour à la page précédente (v0.22.0)

- [ ] Accueil → tuile Analyses → une analyse → une de ses exigences : à chaque page,
      « ← Retour : <la page d'avant> » sous l'en-tête
- [ ] **Retour** depuis l'exigence ramène à la fiche de l'analyse (pas à la bibliothèque),
      puis aux Analyses, puis à l'Accueil ; sur l'Accueil d'origine, plus de bouton
- [ ] **Alt + ←** (après un clic dans la page) et le bouton « précédent » de la souris font
      de même
- [ ] Menu Workflows puis IA, **Retour** : Workflows ; une page ouverte par une commande
      (palette) entre aussi dans l'historique

## La fiche d'une exigence, en page (v0.21.0)

- [ ] Sur la page Exigences, un clic sur le nom d'une exigence : sa fiche s'ouvre en page,
      titrée « identifiant — titre », l'entrée Exigences marquée ; « ← Toute la
      bibliothèque » ramène à la liste
- [ ] Depuis la fiche d'une analyse, un clic sur une de ses exigences ouvre aussi sa fiche
      (le sous-titre dit le dossier de l'analyse) ; **Modifier la fiche** agit sur elle
- [ ] Les formulations : la source, puis chaque langue — à jour, en retard, à relire ou
      absente ; **Traduire (IA)** sur celles qui en ont besoin
- [ ] La qualité axe par axe, en mots (« aucune obligation », « responsable à renseigner »,
      « formulation EN absente… », « aucun lien… ») — jamais de code
- [ ] La fiche, les liens, l'historique ; en lecture dys, « Brouillon » et « Performance »
      tiennent sur une ligne dans les cases du haut

## La fiche d'une analyse, en page (v0.20.0)

- [ ] Sur la page Analyses (ou le tableau de bord), un clic sur le nom d'une analyse : sa
      fiche s'ouvre en page, titrée de son nom, l'entrée Analyses marquée ; « ← Toutes
      les analyses » ramène à la liste
- [ ] Les chiffres : la date limite de remise en jours restants (et en toutes lettres),
      les pièces, les exigences, la qualité
- [ ] **Calendrier**, **Vérifier**, **Qualité du dossier**, **Mettre à jour** (et avec l'IA
      Interroger, Questionnaire, Relire) : aucune fenêtre « Dans quelle analyse ? », ils
      agissent sur celle-ci ; ce qu'ils écrivent apparaît dans « Ce que l'analyse a produit »
- [ ] Les pièces par destination : **Changer le type** (la carte change), **Déplacer**,
      **Extraire les exigences** (pièce lue) ; le nom ouvre la note de la pièce
- [ ] Le calendrier (date, phrase, pièce), les exigences les plus faibles d'abord (le nom
      ouvre la note), filtre « Pièces à lire »
- [ ] Survoler le titre d'une carte, en thème sombre : pas de fond clair, le texte reste lisible

## La fiche d'un workflow, en page (v0.19.0)

- [ ] Sur la page Workflows, un clic sur le nom d'un workflow (ou **Modifier**) : sa fiche
      s'ouvre en page, titrée de son nom ; l'entrée Workflows du menu reste marquée ;
      « ← Tous les workflows » ramène à la liste
- [ ] En tête : Exécuter, Activer/Désactiver, Nom, mode et déclencheur, Dupliquer,
      Supprimer ; les chiffres (état, mode, exécutions, dernière exécution)
- [ ] « Ajouter une action » : choisir l'action, remplir, enregistrer — la carte apparaît ;
      **Monter**, **Descendre**, **Modifier**, **Retirer** sur une action ; l'ordre change
      aussitôt
- [ ] « Ajouter une condition » (déclencheur sur événement) puis **Retirer** ; à la main ou
      à heure fixe : la page dit qu'aucune condition n'est possible
- [ ] **Dupliquer** ouvre la copie ; **Supprimer** demande confirmation puis revient à la
      liste ; « Ses dernières exécutions » ne montre que ce workflow

## La page « IA » (v0.18.0)

- [ ] L'entrée **IA** du menu : la page **IA** s'ouvre dans l'onglet (plus la fenêtre de
      réglages d'emblée), l'entrée est marquée en cours
- [ ] IA pas réglée : un message le dit, « Connexion : À régler », « Régler la connexion »
      mis en avant ; il ouvre la fenêtre du module (adresse, clé)
- [ ] IA réglée puis « Tester la connexion » : « Modèles du serveur » donne leur nombre ;
      une carte par usage dit le modèle choisi, ou celui pris à la place, ou « Pas utilisé »
- [ ] **Choisir le modèle** sur « reranking » : seuls les modèles de reranking du serveur, et
      « Aucun (par défaut) » ; le choix est enregistré et la carte change aussitôt
- [ ] « Choisir le modèle » sans liste retenue : un message dit de tester d'abord
- [ ] « Ce qui se sert de l'IA » liste les fonctions (étape 7 marquée pour OCR et vision)
- [ ] La tuile **IA** et le lien « Toute l'IA » du tableau de bord mènent à la même page

## La page « Workflows » (v0.17.0)

- [ ] L'entrée **Workflows** du menu : plus de liste en fenêtre ; la page **Workflows**
      s'ouvre dans l'onglet, l'entrée est marquée en cours
- [ ] Les chiffres (workflows, actifs, exécutions récentes, échecs récents), les actions
      (nouveau, importer, exporter, journal), une carte par workflow, puis « Dernières
      exécutions »
- [ ] Une carte : déclencheur, actions, mode, état, exécutions, dernière exécution (celle du
      journal si le compteur n'est pas à jour), « Dernière exécution en échec » s'il le faut
- [ ] **Désactiver** : la carte passe à « Désactivé » aussitôt ; **Activer** la remet ;
      **Exécuter** lance le workflow ; **Modifier** ouvre sa fiche
- [ ] Filtre « Désactivés » : « 1 sur 1 affiché(s) » (le journal ne compte pas) ; plus
      aucune carte : « Rien ne correspond… » à la place des cartes, le journal reste
- [ ] La tuile **Workflows**, le lien « Tous les workflows » du tableau de bord et la
      commande **Workflows : liste et modification** mènent à la même page

## La page « Exigences » (v0.16.0)

- [ ] L'entrée **Exigences** du menu : plus de liste en fenêtre ; la page **Bibliothèque
      d'exigences** s'ouvre dans l'onglet, l'entrée est marquée en cours
- [ ] Les chiffres (exigences, note moyenne, faibles, traductions à revoir), les actions
      (nouvelle, importer, analyser la qualité), une carte par exigence, les plus faibles
      d'abord, avec sa formulation, ses badges et sa note en étoiles
- [ ] Le titre d'une carte ouvre la note ; **Modifier** ouvre la fiche ; **Relire (IA)** et
      **Traduire (IA)** quand l'IA est réglée
- [ ] La recherche trouve un mot de la formulation (« journalises », sans accent)
- [ ] Les filtres Faibles, À revoir (dont les traductions absentes), Criticité haute,
      Brouillons, Approuvées ; « À revoir » donne autant d'exigences que le chiffre
      « Traductions à revoir » quand seules les traductions manquent
- [ ] La tuile **Exigences**, le lien « Toute la bibliothèque » du tableau de bord et la
      commande **Exigences : liste, filtres et fiches** mènent à la même page

## La page « Analyses » (v0.15.0)

- [ ] L'entrée **Analyses** du menu : plus de fenêtre « Dans quelle analyse ? » ; la page
      **Analyses d'appels d'offres** s'ouvre dans l'onglet, l'entrée est marquée en cours
- [ ] Les chiffres (analyses, remises sous 30 jours, pièces à lire, exigences faibles), les
      actions rapides, une carte par analyse, la remise la plus proche en tête
- [ ] Le titre d'une carte ouvre la note de l'analyse ; « Importer des pièces »,
      « Calendrier », « Interroger » agissent sur cette analyse
- [ ] Taper « agence » dans la recherche : seules les analyses qui le contiennent restent,
      « 1 sur 2 affiché(s) » ; sans accents (« telemesure ») ça marche aussi
- [ ] Les filtres Remise à venir, Remise sous 30 jours, Pièces à lire, Exigences faibles,
      Candidat, Émetteur ; « Tout » les retire
- [ ] La tuile **Analyses** de l'accueil, le lien « Toutes les analyses » du tableau de bord
      et la commande **Ouvrir les analyses d'appels d'offres** mènent à la même page
- [ ] Sans analyse : un message dit comment en créer une

## La barre de gauche rangée par l'utilisateur (v0.14.0)

- [ ] (v0.14.1) En bas de la barre, sous la ligne de séparation : « Modifier le menu »,
      puis Paramètres en dernier ; en modification, « Terminé » et Paramètres restent
      visibles pendant qu'on fait défiler la liste

- [ ] Accueil en premier, Paramètres tout en bas (au-dessus de la version) ; Paramètres
      ouvre Paramètres → Black Projects
- [ ] **Modifier le menu** (en bas, sous la séparation, juste au-dessus de Paramètres) : Accueil et Paramètres sont marqués d'un
      cadenas, sans bouton — ni déplacés ni masqués
- [ ] Monter, descendre (boutons ou glisser-déposer) ; retirer « IA » ; dans « Ajouter au
      menu », ajouter « Calendrier » (une fonction d'un module) et « IA » de nouveau
- [ ] Au clavier : le focus suit l'entrée déplacée ; après « Retirer », il passe à l'entrée
      voisine ; le lecteur d'écran annonce chaque changement
- [ ] **Terminé** ; l'entrée « Calendrier » lance bien le calendrier ; fermer et rouvrir
      Obsidian : le menu est gardé ; « Rétablir le menu par défaut » le remet
- [ ] Désactiver puis réactiver le module Workflows : son entrée disparaît puis revient ;
      si on l'avait retirée, elle ne revient pas d'elle-même
- [ ] Onglet étroit : le menu passe en haut, en rangée ; Paramètres reste le dernier

## Le tableau de bord rangé par l'utilisateur (v0.13.0)

- [ ] (v0.13.2) Dans chaque section, le même écart entre les boutons d'en haut, les cartes
      ou indicateurs et les boutons d'en bas (pas de bloc collé à un autre)

- [ ] (v0.13.1) Faire défiler l'accueil en modification ou le tableau de bord : la barre de
      gauche (marque, menus, version) ne bouge pas ; passer d'une page à l'autre repart du
      haut ; onglet étroit : la navigation passe en haut et défile avec la page

- [ ] La flèche à gauche du titre d'une section la réduit à son titre, puis la déplie ;
      l'état est gardé après fermeture d'Obsidian
- [ ] **Modifier le tableau de bord** : les sections deviennent des fiches, dans « Colonne
      principale » et « Colonne de côté »
- [ ] Glisser une fiche sur une autre (même colonne, puis l'autre colonne) ; sur
      « Déposer ici » d'une colonne vide
- [ ] Au clavier : Tab jusqu'à Monter / Descendre / Changer de colonne ; Entrée ; le focus
      reste sur la section déplacée, le lecteur d'écran annonce sa colonne et sa place
- [ ] Masquer « Workflows » : elle passe dans « Sections masquées » ; « Afficher » la remet
- [ ] **Terminé** : le tableau suit le rangement ; une seule colonne remplie prend toute
      la largeur ; tout masqué : un message dit comment réafficher
- [ ] Fermer et rouvrir Obsidian : le rangement est gardé ; « Rétablir le tableau de bord
      par défaut » le remet
- [ ] Désactiver puis réactiver le module Workflows : sa section disparaît, puis revient
      à la fin de la colonne de côté
- [ ] En thème sombre, en couleurs monochromes et en lecture dys : fiches et boutons
      lisibles

## Les fenêtres (v0.11.0)

- [ ] **Nouvelle analyse** : le formulaire s'ouvre, le focus sur « Nom » ; « Créer » sans
      nom : « Des champs obligatoires sont vides », le champ en rouge avec « Obligatoire. » ;
      Entrée dans un champ valide le formulaire
- [ ] Le choix suivant (importer, déposer, plus tard) : ↑ ↓ puis Entrée ; taper filtre la
      liste ; Échap renonce
- [ ] **Exigences : liste** : recherche, filtres, compte « n sur N », une ligne s'ouvre au
      clic ou par Tab puis Entrée
- [ ] Une confirmation de suppression (un workflow) : bouton rouge, focus sur « Annuler »
- [ ] Paramètres → **Formats de fichiers** : les fiches (Lu, Écrit, Affiché avec icône et
      mot) ; allumer l'interrupteur `.json` ne fait pas remonter la fenêtre
- [ ] Paramètres → **Fonctions** de l'AO : « Ajouter un routage » ouvre une petite fenêtre
      par-dessus ; la liste des types rangés reste dépliée ; interrupteurs « AO » et
      « Réponse AO », corbeille
- [ ] Paramètres → **Types de pièces** : ajouter, modifier (crayon), supprimer (avec
      confirmation) un type personnalisé
- [ ] Paramètres → **Fonctions** de l'IA : menus des modèles, clé masquée, « Tester la
      connexion »
- [ ] Dans chaque fenêtre, Tab ne sort jamais de la fenêtre ; Échap la ferme ; le focus
      revient où il était ; en mode sombre et en monochrome, tout reste lisible

## Hors d'Obsidian

- [ ] `pnpm run demo`, puis ouvrir `demo/dist/index.html` dans un navigateur : la même
      interface, deux analyses fictives (l'une à J-5), sans Obsidian
- [ ] `demo/dist/index.html?mode=dark&vision=red-green&reading=dys` : l'apparence forcée
