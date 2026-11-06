# Recette — étape 2 : dossier de consultation

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Sur un coffre de test. Le coffre de test fourni contient `A importer/DCE Station sol.zip`.

## Créer une analyse

- [ ] Commande **Nouvelle analyse d'appel d'offres** : un formulaire (nom, position,
      acheteur, référence), avec infobulles ; Entrée ou **Créer l'analyse** valide ; un
      nom vide est refusé
- [ ] Le dossier `Appels d'offres/<Nom>/` est créé, avec `Pièces/Originaux`, `Exigences`,
      `Analyse`, et la note `<Nom>.md`, qui s'ouvre : position, acheteur, référence, date,
      « Aucune pièce pour l'instant »
- [ ] Un nom avec `/` ou `:` est accepté, ces caractères remplacés par `-`
- [ ] Recréer une analyse du même nom : refusé, avec un message
- [ ] Après la création, trois choix : importer, déposer soi-même, plus tard

## Importer le dossier

- [ ] « Importer des fichiers de l'ordinateur » ouvre la fenêtre de fichiers du système ;
      choisir `DCE Station sol.zip`
- [ ] Message : « 9 pièce(s) importée(s), dont 9 lue(s). 1 archive(s) ZIP ouverte(s). »
- [ ] `Pièces/Originaux/DCE Station sol/` contient les fichiers du ZIP
- [ ] `Pièces/` contient une note par pièce : `CCTP.md`, `CCTP (pdf).md`, `CCTP (docx).md`…
- [ ] La note d'une pièce : propriétés (type, fichier, format, lecture, caractères),
      encadré « Pièce lue », liens vers le fichier et l'analyse, texte extrait avec son
      tableau d'exigences
- [ ] La note de l'analyse : tableau des pièces dans l'ordre RC, CCTP…, BPU, autres ;
      chaque lien ouvre la note de la pièce ; « 9 pièce(s), dont 9 lue(s) »
- [ ] Réimporter le même ZIP : « 9 fichier(s) déjà dans l'analyse, non importé(s) à
      nouveau »
- [ ] Importer une image ou un `.dwg` : pièce 🟧 Image / ⬜ Format non lu, fichier gardé
- [ ] Importer un ZIP abîmé (un fichier texte renommé en `.zip`) : message « Archive(s)
      illisible(s) »

## Déposer à la main

- [ ] Glisser un fichier dans `Pièces/Originaux` depuis l'explorateur du système vers
      l'explorateur de fichiers d'Obsidian
- [ ] Commande **Mettre à jour l'analyse** : la pièce est lue, sa note créée, le tableau
      réécrit ; relancer : « Aucune nouvelle pièce »

## Types

- [ ] Ouvrir la note `Presentation.md` (type AUTRE), commande **Changer le type de la
      pièce** : la liste des types, le type actuel signalé ; choisir ANNEXE : message, et
      le tableau de l'analyse suit
- [ ] Modifier la propriété `type` d'une note à la main, puis **Mettre à jour
      l'analyse** : le tableau suit
- [ ] Commande **Changer le type de la pièce** sur une autre note : message « Ouvrez
      d'abord la note d'une pièce »

## Plusieurs analyses et réglages

- [ ] Créer une deuxième analyse ; depuis une note hors analyse, **Importer des pièces**
      demande dans quelle analyse
- [ ] Réglages → ligne « Analyse d'appels d'offres » → **Fonctions** : le réglage
      « Dossier des analyses », et les fonctions (5 disponibles, 10 en développement)
- [ ] (v0.4.0) Ces réglages et la section des types sont désormais dans la fenêtre
      **Types de pièces** du module **Typage des pièces** ; l'AO « Nécessite : Lecture de
      fichiers, Typage des pièces »
- [ ] Même fenêtre, section **Types de pièces et leur détection** (v0.3.1) : une fiche
      par type (AVIS, RC… AUTRE), dans l'ordre où ils sont essayés, avec les mots-clés
      cherchés « Dans le nom du fichier » et « Dans le titre du document » ; pas de
      pastille d'état ; les compteurs restent 5 / 10
- [ ] **Types personnalisés** (v0.3.3), en tête de la fenêtre **Fonctions** : ajouter
      `paq` — « Plan d'assurance qualité » : il apparaît « PAQ — Plan d'assurance
      qualité », a sa fiche (avant AUTRE), et figure dans le menu des mots-clés ;
      importer `PAQ_v2.pdf` : type PAQ ; « Changer le type de la pièce » le propose
- [ ] Ajouter `CCTP` comme type : refusé ; un type sans libellé : refusé ; retirer PAQ :
      ses mots-clés disparaissent, et le tableau d'une analyse mise à jour montre
      « PAQ (type retiré) »
- [ ] **Désactiver un type** (v0.3.5) : dans « Types de pièces et leur détection »,
      chaque fiche a un interrupteur, sauf AUTRE ; désactiver PLANNING : la fiche est
      grisée et barrée, avec « Désactivé : ni reconnu à l'import, ni proposé » ; il
      disparaît du menu des mots-clés
- [ ] Importer `Planning prévisionnel.xlsx` : type AUTRE ; une pièce importée avant la
      désactivation garde PLANNING, marqué « (désactivé) » dans le tableau après
      « Mettre à jour l'analyse » ; « Changer le type de la pièce » ne propose plus
      PLANNING, sauf sur une pièce qui l'a
- [ ] Réactiver PLANNING : tout revient ; fermer et rouvrir le coffre : l'état est
      conservé
- [ ] **Modifier un type** (v0.3.4) : crayon de PAQ → « Modifier le type PAQ », champs
      Code et Libellé ; un code du module est refusé ; passer à `PQA` et changer le
      libellé : le mot-clé qui visait PAQ vise PQA, et un message dit combien de pièces
      déjà importées ont pris le nouveau code ; leurs tableaux suivent
- [ ] **Supprimer un type** : corbeille → confirmation « Supprimer « PQA » ? » qui dit
      combien de mots-clés partent et ce que deviennent les pièces ; **Annuler** ne change
      rien ; **Supprimer** retire le type et ses mots-clés
- [ ] Crayon d'un mot-clé personnalisé et d'une extension équivalente : modification
      contrôlée comme l'ajout
- [ ] **Mots-clés personnalisés** (v0.3.2), en tête de la fenêtre **Fonctions** :
      ajouter `SPEC` → CCTP dans « nom du fichier » ; il apparaît dans la liste et dans la
      fiche CCTP (« Ajoutés par vous — nom du fichier ») ; importer un fichier
      `SPEC_essai.pdf` : type CCTP
- [ ] Ajouter `cctp` → CCTP : refusé (déjà un mot-clé du module) ; ajouter `spec` → BPU :
      refusé (déjà déclaré) ; la corbeille retire un mot-clé ; fermer et rouvrir le
      coffre : les mots-clés sont conservés
- [ ] Ajouter `dossier technique de référence` → CCTP dans « titre du document »,
      importer un fichier au nom quelconque dont le texte commence par ce titre : CCTP
- [ ] **Créer / mettre à jour la documentation** : vos mots-clés apparaissent dans le
      tableau des types, marqués *(ajouté)*
- [ ] Renommer un fichier avec un mot-clé affiché (par exemple `Spécifications
      techniques.pdf`) et l'importer : le type correspond à la fiche (CCTP)
- [ ] Changer le dossier des analyses : la prochaine analyse y est créée
- [ ] Extensions équivalentes : déclarer `.tot` lu comme `.xml`, puis importer
      `A importer/Essais/banc.tot` : pièce lue
- [ ] Ajouter une note à soi dans la section **Notes** de l'analyse, réimporter : la note
      est intacte
- [ ] **Créer / mettre à jour la documentation** : la page *Analyse d'appels d'offres*
      décrit tout ce qui précède

## Typage des pièces en module, échange de types (v0.4.0)

- [ ] Un coffre où des types, mots-clés ou désactivations avaient été réglés en v0.3.5 :
      après mise à jour, ils sont dans la fenêtre **Types de pièces** (rien de perdu)
- [ ] Réglages : trois modules — Lecture de fichiers, Typage des pièces, Analyse
      d'appels d'offres ; désactiver Typage des pièces met l'AO à l'état « Module requis
      indisponible »
- [ ] Fenêtre **Types de pièces** : Échanger des types (Importer…, Exporter…), Dossier des
      échanges, types et mots-clés personnalisés, fiches des types
- [ ] **Exporter…** : une liste à cocher des types ajoutés et des types du module modifiés,
      avec Tout / Rien ; un fichier `Black Projects/Échanges/types-de-pieces-AAAA-MM-JJ.json`
      est créé ; sans rien à exporter, un message le dit
- [ ] **Importer…** depuis l'ordinateur ou le coffre : la liste dit ce que deviendra
      chaque type (nouveau, mise à jour, type du module, non importable) ; les non
      importables sont décochés ; après import, la fenêtre montre les nouveaux types et
      un message fait le compte
- [ ] Importer un fichier qui n'est pas un fichier de types : message clair, rien de
      changé
- [ ] (v0.4.5) Ranger BPU en « Réponse AO » dans le module AO, puis **Exporter…** : BPU
      est proposé même sans mot-clé, avec « va dans : Réponse AO » ; le fichier porte
      `"modules": { "ao": { "rangement": "reponse" } }` pour BPU
- [ ] Importer `A importer/types-exemple.json` du coffre de test : CCTP et PAQ
      affichent « va dans : … » ; après import, le message dit « Repris aussi : le
      rangement (Analyse d'appels d'offres) pour 2 type(s) », et la liste « Types
      rangés » du module AO les contient
- [ ] Le même import avec le module AO désactivé : les types sont importés, le message
      dit que les réglages du module « ao » sont ignorés
- [ ] Commandes « Exporter des types de pièces » et « Importer des types de pièces » dans
      la palette
- [ ] **Créer / mettre à jour la documentation** : une page *Typage des pièces* ; la page
      *Analyse d'appels d'offres* y renvoie

## Appel d'offres et réponse (v0.4.1)

- [ ] (v0.4.4) Coffre neuf, à l'ouverture : la fenêtre « Analyse d'appels d'offres : où
      ranger les pièces ? » explique quoi faire, sans case à cocher ; **Régler
      maintenant** ouvre la fenêtre du module
- [ ] Fermer et rouvrir le coffre, liste toujours vide : « Rappel : aucun type de pièce
      rangé », avec la case **Ne plus me le rappeler à l'ouverture** ; **Plus tard** sans
      cocher : le rappel revient à l'ouverture suivante ; cochée : il ne revient plus
- [ ] Fenêtre du module : interrupteur **Rappel à l'ouverture** éteint après la case
      cochée ; le rallumer : le rappel revient à l'ouverture suivante
- [ ] Un type rangé : plus aucun message à l'ouverture
- [ ] (v0.4.2) Fenêtre du module **Analyse d'appels d'offres** : rubrique « Où vont les
      types de pièces », bouton **Ajouter un routage…** et liste dépliable **Types rangés
      (0)** au départ (v0.4.4) ; dépliée : l'explication des colonnes **AO** et
      **Réponse AO** en haut (v0.4.3), puis « Aucun type rangé » ; ajouter RC avec « AO »
      et BPU avec les deux : **Types rangés (2)**
- [ ] (v0.4.3) Chaque type tient sur **une seule ligne**, même FORMULAIRE (libellé coupé
      par « … », entier en infobulle) ; fenêtre étroite : les interrupteurs restent sur
      la ligne
- [ ] Éteindre « AO » sur BPU : il ne reste que « Réponse AO » ; la liste reste
      dépliée ; éteindre aussi « Réponse AO » : refusé avec un message, l'interrupteur se
      rallume
- [ ] Corbeille sur BPU : il quitte la liste (1) ; **Ajouter un routage…** : la petite
      fenêtre propose BPU (pas RC, déjà rangé), « AO » allumé ; tout éteindre puis
      valider : refusé ; valider avec « Réponse AO » : BPU revient dans la liste
- [ ] Un type ajouté dans **Types de pièces** (PAQ) : proposé dans **Ajouter un routage…** ;
      renommé dans le typage, il garde son rangement
- [ ] **Types de pièces** : chaque fiche affiche « Analyse d'appels d'offres — va dans »
      (RC : Appel d'offres ; BPU : ce que vous avez réglé ; un type pas rangé : « pas
      encore rangé — demandé à l'import » ; AUTRE : demandé à l'import) ; plus aucun menu « Va dans » ; désactiver le module AO fait disparaître
      cette ligne
- [ ] Un coffre où la v0.4.1 avait réglé « Va dans » : le réglage se retrouve dans la
      liste du module AO
- [ ] Nouvelle analyse **candidat** : `Pièces/Appel d'offres/Originaux` et
      `Pièces/Réponse/Originaux` sont créés ; **émetteur** : `Pièces/Appel d'offres` et
      `Pièces/Réponses`
- [ ] Importer le ZIP d'exemple : la fenêtre « Où ranger ces pièces ? » liste les pièces
      dont le type va dans les deux (BPU, présentation…), avec « Tout mettre dans » ;
      les pièces dont le type a une place fixe (CCTP, RC) ne sont pas demandées
- [ ] Choisir « Réponse » pour un BPU : il est rangé dans `Pièces/Réponse` ; le message
      dit combien vont avec l'appel d'offres et avec la réponse ; le tableau a une partie
      « Appel d'offres » et une partie « Réponse »
- [ ] Annuler la fenêtre : message « Import annulé », rien n'est ajouté
- [ ] Émetteur : la fenêtre demande aussi « Réponse de quel candidat ? » (connu, ou
      nouveau avec son nom) ; les pièces vont dans `Pièces/Réponses/<candidat>` ; le
      tableau a une partie par candidat ; sans nom pour un nouveau candidat, refusé
- [ ] **Déplacer la pièce** sur une note de pièce : la liste des destinations (place
      actuelle signalée ; émetteur : chaque candidat, et « un nouveau candidat… ») ; la
      pièce, son fichier et sa note changent de dossier, et le tableau suit
- [ ] Déposer un fichier dans `Pièces/Réponse/Originaux` puis **Mettre à jour
      l'analyse** : il est rangé avec la réponse
- [ ] Une analyse créée avant la v0.4.1 : ses pièces restent visibles, avec l'appel
      d'offres

