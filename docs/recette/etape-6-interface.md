# Recette — étape 6 ter : accueil et interface

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Sur le coffre de test.

## L'accueil

- [ ] À l'ouverture du coffre, l'onglet **Black Projects** s'ouvre : « Bonjour » (ou
      « Bon après-midi », « Bonsoir ») et la date ; à gauche la navigation (Accueil,
      Analyses, Exigences, Workflows, IA, Réglages)
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
      Calendrier, Interroger, Exigences, Workflows, IA, Réglages
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

## Le tableau de bord rangé par l'utilisateur (v0.13.0)

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
