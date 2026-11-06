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
