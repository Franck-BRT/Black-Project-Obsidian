# Recette — étape 1 : lecteurs de documents

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

## Contrôles automatiques

- [ ] `pnpm run check` passe, dont `test/dce.test.ts`
- [ ] `pnpm run build` produit `main.js`

## Dans Obsidian

Déposer dans un coffre de test les pièces de `test/fixtures/dce-exemple/`, puis :

- [ ] **Réglages → Modules** : « Lecture de fichiers · 0.2.0 » et « Analyse d'appels
      d'offres · 0.1.0 » (Nécessite : Lecture de fichiers), tous deux **Actif**
- [ ] Cliquer sur **Lecture de fichiers**, puis sur le bouton **Formats de fichiers** :
      chaque fois une fenêtre « Lecture de fichiers — Formats de fichiers » s'ouvre ; un
      résumé « Lecture intégrée : 13 · En développement : 4 · Prévu : 6 » ; une ligne par
      famille ; « PDF avec texte natif » en vert, « PDF sans texte (scan) » en orange
      « En développement · Étape 6 » ; Échap ou la croix la ferment
- [ ] Commande **Lire un fichier du coffre (provisoire)** : la liste ne propose que des
      fichiers lisibles (pas les images) ; le fichier ouvert vient en premier
- [ ] `CCTP.pdf`, `CCTP.docx`, `CCTP.doc`, `CCTP.rtf` : le texte, les titres et le
      tableau des exigences EX-SOL-001 / EX-SOL-002 s'affichent ; la ligne du haut donne
      le format, les caractères, les lignes et le temps de lecture
- [ ] `BPU.xlsx`, `BPU.xls` : le tableau des prix ; `Presentation.pptx` : les
      diapositives ; `RC.html` : la date limite de remise
- [ ] **Copier** copie le texte
- [ ] **Extensions équivalentes**, en tête de la fenêtre Formats de fichiers : ajouter
      `.tot` lu comme `.xml` ; il apparaît dans la liste et, aussitôt, dans la ligne
      « Extensions ajoutées » de la même fenêtre ; la
      commande propose `Essais/banc.tot` et l'affiche « TOT lu comme XML »
- [ ] Ajouter `.pdf` : refusé (« déjà lus par un lecteur intégré ») ; ajouter `.tot` une
      seconde fois : refusé ; la corbeille retire l'équivalence ; fermer et rouvrir le
      coffre : les équivalences sont conservées
- [ ] Une image ou un fichier vide : un message dit pourquoi il ne se lit pas
- [ ] Désactiver « Lecture de fichiers », recharger le plugin : la commande disparaît et
      l'analyse d'appels d'offres passe à « Module requis indisponible : Lecture de
      fichiers » ; réactiver, recharger : tout revient

## Sur un vrai dossier (à faire avec le CNES)

Avec la commande, ou par les tests en déposant les pièces dans `test/fixtures/`, pour
chaque pièce d'un dossier réel anonymisé :

- [ ] Le texte est complet : rien ne manque par rapport au document ouvert dans son
      application
- [ ] Les titres gardent leur niveau
- [ ] Les tableaux d'exigences et de prix sortent en lignes et colonnes
- [ ] Les accents sont justes
- [ ] Un PDF scanné est signalé « aucun texte », pas lu à moitié
- [ ] Un document protégé par mot de passe est signalé « illisible »
