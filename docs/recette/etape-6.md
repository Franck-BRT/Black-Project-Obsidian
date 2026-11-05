# Recette — étape 6 : IA locale

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Sur le coffre de test, **sur le réseau de Sidonie** (ou avec tout serveur compatible
OpenAI joignable). **Jalon de démo n° 4 : l'IA relit, conseille et répond en citant ses
sources.**

## Sans IA d'abord

- [ ] Module **IA (Sidonie)** désactivé ou non réglé : « Relire l'exigence avec l'IA »
      répond « L'IA n'est pas réglée : … » et ne fait rien
- [ ] Commande **Calendrier de l'appel d'offres** sur l'analyse « Station sol » : la note
      `Analyse/Calendrier` s'ouvre ; « À retenir » donne la **date limite de remise des
      offres** et la **validité des offres** avec leur phrase et leur pièce ; les dates par
      ordre chronologique, les délais (« sous 15 jours après la notification »…), chacun
      avec sa phrase source ; aucun appel réseau
- [ ] Écrire sous « Notes », relancer : la note est gardée

## La connexion

- [ ] Paramètres → Black Projects → **IA (Sidonie)** → bouton **Fonctions** : adresse du
      serveur (jusqu'à `/v1`)
- [ ] **Clé d'accès** : saisie, « Une clé est enregistrée dans le trousseau de
      l'ordinateur » ; la clé n'apparaît
      ni dans `.obsidian/plugins/black-projects/data.json` ni dans le coffre
- [ ] **Tester la connexion** : la liste des modèles du serveur ; en choisir un ; message
      « Connexion réussie … »
- [ ] Mauvaise adresse : le message dit en clair « serveur injoignable … Êtes-vous sur le
      bon réseau ? » ou « Introuvable (404). Vérifiez que l'adresse se termine par /v1 » ;
      mauvaise clé : « Refusé (401). Le serveur demande une clé … »

## Exigences

- [ ] Ouvrir une exigence de la bibliothèque, **Relire l'exigence avec l'IA** : un avis,
      les défauts (ceux vus par l'IA marqués), des reformulations proposées ; la section
      « Relecture par l'IA » est écrite dans la note
- [ ] Choisir une reformulation : la formulation change, révision suivante ; « Ne rien
      changer » : la formulation reste, la relecture aussi
- [ ] **Traduire l'exigence avec l'IA** : la formulation anglaise apparaît, marquée
      « automatique, à relire » ; si un chiffre ou une unité diffère, le message le dit
- [ ] Liste des exigences, une ligne : « Relire avec l'IA » et « Traduire avec l'IA »
- [ ] Avec un **modèle d'embeddings** réglé : « Analyser la qualité… » ajoute les
      doublons « par le sens »

## Le dossier

- [ ] **Interroger le dossier (IA)** : « Quelles sont les pénalités de retard ? »,
      Recherche dans les pièces ; la note `Analyse/Questions/<date> Quelles sont les
      pénalités de retard` s'ouvre : la réponse avec ses renvois [1], [2] **cliquables**
      vers les pièces ; les sources « citée » / « transmise, non citée » ; les extraits
      transmis (dépliables)
- [ ] Une question sans rapport (« Quelle est la couleur du logo ? ») : « Rien dans les
      pièces ne parle de cette question : l'IA n'a pas été interrogée »
- [ ] Même question en **Lecture de chaque pièce** : la progression pièce par pièce ;
      « Ce que l'IA y a relevé » sous chaque source
- [ ] « Quelle est la date limite de remise des offres ? » : la réponse donne la date du
      calendrier
- [ ] **Questionnaire du dossier (IA)** : les six questions cochées ; la note
      `Analyse/Questionnaire` : une section par question, chacune avec ses sources ;
      « Rien dans les pièces… » pour celles sans réponse (contrôle export, souvent)
- [ ] **Relire les exigences du dossier avec l'IA** : les exigences, les plus faibles
      cochées ; candidat : la relecture dans chaque note, formulation intacte ; émetteur :
      une reformulation peut être retenue
- [ ] Couper le réseau pendant une relecture en série : « Relecture arrêtée : l'IA ne
      répond plus », ce qui est fait est gardé
