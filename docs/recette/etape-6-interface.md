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
- [ ] Paramètres → **Fonctions** de l'AO : « Ajouter un type » ouvre une petite fenêtre
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
