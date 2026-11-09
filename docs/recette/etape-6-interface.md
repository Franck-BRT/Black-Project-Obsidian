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

## Les scans lus avec la vision au dépôt (v0.107.0)

- [ ] Un modèle de vision réglé, verser un PDF scanné (ou une image) : des notices disent la
      lecture avec la vision, puis « lu par l'IA avec la vision — texte 1 » ; la fiche montre le
      texte, le journal des workflows le dit
- [ ] Le workflow système « Lire avec la vision un document versé sans texte… » désactivé : rien
      au dépôt ; la fiche propose **Lire avec la vision (IA)**

## Relire avec la vision ; lire un scan ; les formules (v0.106.0)

- [ ] Page IA : un modèle de vision choisi. Sur la fiche d'un PDF avec du texte, **Relire avec
      l'IA** : la question « Modèle simple / Modèle avec la vision » ; avec la vision, les
      notices disent les pages ; une version « lu par l'IA avec la vision » (n page(s) regardée(s))
- [ ] Un document Word, PowerPoint… : pas de question, le modèle simple
- [ ] Un scan (PDF sans texte, ou une image) : *Texte extrait* ne propose que **Lire avec la
      vision (IA)** ; après, « Texte 1 — lu par l'IA avec la vision », la fiche montre le texte
- [ ] L'étape du workflow « Relire avec l'IA le texte extrait… » : champ **Modèle** (simple par
      défaut) ; réglé « avec la vision », la relecture au dépôt regarde les pages
- [ ] Un document Word avec des équations : sur la fiche et dans la note, les formules dessinées
      (fractions, puissances, sommes) ; « 10 $ et 20 $ » reste du texte

## Les listes du texte extrait ; supprimer une version du texte (v0.105.0)

- [ ] Verser un document Word avec une liste numérotée et une liste à puces à deux niveaux :
      sur la fiche et dans sa note (Obsidian), une seule liste chacune, numéros et niveaux gardés
- [ ] Un texte avec « Les revues : » puis des lignes « • … » : une vraie liste, sous la phrase
- [ ] *Versions* › *Versions du texte* › la corbeille d'une version : une confirmation, puis sa
      note est à la corbeille du coffre ; les autres versions ne changent pas
- [ ] Supprimer la version montrée sur la fiche : la dernière qui reste la remplace (la notice
      le dit) ; « Comparer » se fait avec la précédente qui reste

## Les tableaux du texte extrait (v0.104.0)

- [ ] Verser un document Word ou PDF avec un tableau (des cases fusionnées) : sur la fiche,
      *Texte extrait* le montre en tableau (en-tête, lignes), sans colonnes vides
- [ ] **Ouvrir sa note** : en lecture, Obsidian montre aussi un tableau (la note a sa ligne
      `| --- |`), et non des « | » dans un paragraphe
- [ ] Une fiche transcrite avant cette version : la fiche montre déjà le tableau ;
      **Extraire de nouveau** corrige aussi la note

## Extraire de nouveau, relire avec l'IA (v0.103.0)

- [ ] L'IA réglée, verser un document : une notice « relecture du texte par l'IA en cours… »,
      puis « texte relu par l'IA — texte 2… » (ou « rien trouvé à corriger »)
- [ ] Sur sa fiche, *Texte extrait* › **Extraire de nouveau** : « texte 3 — extrait du
      fichier », puis la relecture se lance seule : « texte 4 — relu par l'IA »
- [ ] **Relire avec l'IA** (même section) : la relecture se relance, ses notices le disent ;
      le workflow système « Relire avec l'IA le texte extrait… » désactivé : une notice le dit
- [ ] L'IA non réglée : au dépôt, une notice dit que le texte n'est pas relu

## La relecture du texte par l'IA ; les versions du texte (v0.102.0)

- [ ] L'IA réglée, verser un document au texte abîmé (mots coupés « pré- sent », puces « • ») :
      le workflow système « Relire avec l'IA le texte extrait d'un document… » (actif) le relit ;
      la fiche montre « Texte 2 — relu par l'IA » ; son édition et sa révision n'ont pas changé
- [ ] *Versions* › **Versions du texte** : « Texte 2 — relu par l'IA » (date, modèle, montré
      sur la fiche), « Texte 1 — extrait du fichier » ; leurs notes dans `Bibliothèque/_textes/…`
- [ ] **Comparer avec le texte 1** : la page des passages retirés (barrés) et ajoutés
      (surlignés), chacun suivi de son remplaçant
- [ ] **Le montrer sur la fiche** (texte 1) : la fiche montre de nouveau le texte extrait
- [ ] L'étape du workflow : choisir un persona, un skill, un prompt de la bibliothèque — ses
      consignes données à l'IA, nommées dans la version
- [ ] Une IA qui résumerait : rien n'est gardé, le journal le dit ; IA non réglée : le journal
      le dit, rien ne change

## Le texte extrait, mis en forme et en entier (v0.101.0)

- [ ] Verser un document avec des titres, une liste (imbriquée), un tableau, du gras et de
      l'italique : la section « Texte extrait » les montre mis en forme
- [ ] Un long document : le texte est montré en entier sur la fiche
- [ ] Un texte qui contient `<script>` ou `<b>` : affichés tels quels, comme du texte

## Le texte extrait (v0.100.0)

- [ ] Verser un fichier texte (ou un PDF) : sa fiche (sa note) a, après « Notes »,
      « ## Texte extrait », l'encadré « Document lu : n caractères de texte extrait. » et le
      texte (ses titres descendus de deux niveaux) ; l'en-tête, `lecture: lue` et `caracteres`
- [ ] Une image, un format non lu, un PDF scanné : l'encadré dit pourquoi il n'y a pas de texte
- [ ] La fiche : une section repliée « Texte extrait » (« Lu — n caractères ») ; dépliée,
      l'encadré, **Extraire de nouveau**, **Ouvrir sa note**, puis le texte
- [ ] Écrire sous « Notes », changer le fichier, **Extraire de nouveau** : le texte change,
      vos notes restent
- [ ] Un document versé avant cette version : « Pas encore extrait » ; **Extraire le texte**

## La liste des étiquettes (v0.99.0)

- [ ] Bibliothèque : une carte **Étiquettes** ; **Nouvelle étiquette** : « antenne », autres
      formes « antennes »
- [ ] Verser un texte « Mots-clés : antennes, radar » : étiquettes « antenne, radar — hors de
      la liste : radar » ; le bouton **+** « Ajouter à la liste des étiquettes : radar » :
      coché, **Ajouter** — « radar » est dans la liste, la mention disparaît
- [ ] Le crayon de *Étiquettes* : une liste à cocher (antenne — « antennes » dessous —,
      radar, « ＋ Autre(s) étiquette(s)… ») ; une autre écrite est ajoutée à la liste
- [ ] Un texte sans mots-clés qui parle « des antennes » : « antenne » proposée

## Un type de pièce hors de la liste : l'y ajouter (v0.98.0)

- [ ] Un document à une ancienne catégorie (« Devis ») : « Devis — hors de la liste des types
      de pièce », et un bouton **+** « Ajouter « Devis » aux types de pièce »
- [ ] Le cliquer : code proposé « DEVIS », libellé « Devis » ; « CCTP » est refusé dans la
      fenêtre (« CCTP est déjà un type du module. ») ; **Ajouter** : « DEVIS — Devis » ; les
      autres documents « Devis » aussi ; le type est dans *Typage des pièces* › « Types de
      pièces personnalisés », et un fichier « DEVIS … » est reconnu
- [ ] Le crayon de « Type de pièce » : « ＋ Ajouter un type de pièce… » en fin de liste
- [ ] Sans le module Typage des pièces : pas de bouton

## Un émetteur hors de la liste : l'y ajouter (v0.97.0)

- [ ] Verser deux documents « Émetteur : Thales Alenia Space » : sur la fiche de l'un,
      « Thales Alenia Space — hors de la liste des émetteurs », et un bouton **+** « Ajouter
      « Thales Alenia Space » à la liste des émetteurs » (les icônes restent alignées)
- [ ] Le cliquer : la fenêtre propose le code « TAS » et le nom ; **Créer** : « TAS — Thales
      Alenia Space » ; la notification dit que l'autre document le prend aussi ; le bouton
      disparaît
- [ ] Un émetteur de la liste : pas de bouton **+** ; fermer la fenêtre : rien ne change

## Correctif : relancer un champ ne change que lui (v0.96.1)

- [ ] Un document « Réf. : PMP-01 / Édition 2 / Révision B » : changer la **référence** au
      crayon (« X-9 »), puis relancer la recherche de la **révision** : la référence reste
      « X-9 » ; l'édition, « 2 »
- [ ] L'IA réglée, sur un document dont la version n'est pas sûre : relancer la révision ne
      change que la révision
- [ ] La ligne « Référence et version » relance les trois ensemble

## La liste des émetteurs (v0.96.0)

- [ ] Bibliothèque : une carte **Émetteurs** ; **Nouvel émetteur** : Code « ESA », Nom
      « Agence spatiale européenne », Autres noms « European Space Agency » ; la carte
      « ESA — Agence spatiale européenne », une note dans `Bibliothèque/Émetteurs`
- [ ] Verser un document qui commence par « European Space Agency » : émetteur « ESA —
      Agence spatiale européenne », rien à confirmer
- [ ] Un document « Émetteur : Thales Alenia Space » : le crayon de *Émetteur* — une liste
      (« — Aucun — », ESA…, « Thales Alenia Space (hors de la liste des émetteurs) »,
      « ＋ Ajouter un émetteur à la liste… ») ; ajouter : la fenêtre propose le nom, code
      « TAS » : l'émetteur devient « TAS — Thales Alenia Space »
- [ ] L'IA réglée : sa consigne nomme les émetteurs connus ; elle répond par le code

## Le type de pièce (v0.95.0)

- [ ] Fiche d'un document : le champ « Type de pièce » (et non plus « Catégorie »), dit avec
      son libellé (« CCTP — Cahier des clauses techniques particulières »)
- [ ] Verser `Devis antenne.txt` qui commence par « Cahier des clauses techniques
      particulières… » : « Type de pièce à confirmer : le texte du document suggère
      « CCTP » » — **Prendre « CCTP »**, **Pas de type de pièce**, **Classer…**
- [ ] Le crayon de « Type de pièce » (et **Classer…**) : une liste — « — Aucun — », les types
      du module Typage des pièces (AVIS… AUTRE) ; un type ajouté dans *Typage des pièces* y
      apparaît, un type désactivé non
- [ ] Un document à une ancienne catégorie (« Devis ») : elle reste, montrée « Devis (hors
      de la liste des types) » dans la liste
- [ ] « Regrouper par › Type de pièce » ; le filtre « Type de pièce à confirmer »

## Renommer le fichier (v0.94.0)

- [ ] Fiche d'un document, *Le fichier* dépliée : un bouton crayon devant *Fichier*
      (« Renommer le fichier ») ; la fenêtre propose le nom sans l'extension
- [ ] « Devis antenne v2 », **Renommer** : le fichier s'appelle « Devis antenne v2.txt », dans
      le même dossier ; la fiche montre le nouveau chemin, **Ouvrir le fichier** l'ouvre
- [ ] Une pièce d'analyse renommée ainsi : sa note de pièce et le tableau de l'analyse
      l'ouvrent toujours ; une note qui le citait (`[[…]]`, `[[…|texte]]`) aussi —
      « Paramètres d'Obsidian › Fichiers et liens › Mettre à jour les liens internes »
      désactivé compris
- [ ] « a/b », « .cache », un nom déjà pris dans le dossier : refusés, rien ne bouge

## Relancer la recherche d'un champ ; la date au calendrier (v0.93.0)

- [ ] Fiche d'un document qui dit « Titre : Plan qualité du projet », *Identification*
      dépliée : à côté du crayon, un bouton « Relancer la recherche dans le document : Titre »
      (pas pour *Rangé*) ; les icônes restent alignées
- [ ] Changer le titre au crayon, puis relancer : « Titre : trouvé dans le document — Plan
      qualité du projet. », le titre revient
- [ ] Relancer un champ que le document ne dit pas sûrement (l'émetteur) : à confirmer, avec
      ce qui a été lu ; l'IA réglée, son workflow système est exécuté pour ce document
      (« identifié par l'IA », et une ligne au journal) ; ce workflow désactivé : « L'IA n'a
      pas été demandée : son workflow système est désactivé. »
- [ ] Le crayon de *Date du document* (et *Classer…*) : un bouton calendrier à côté du champ ;
      la date choisie s'écrit 2026-04-03 ; **Enregistrer** : « 3 avril 2026 »

## Modifier un champ de la fiche (v0.92.0)

- [ ] Fiche d'un document, *Identification* dépliée : un bouton crayon à gauche de l'icône
      de chaque champ ; au survol, « Modifier : Titre », « Modifier : Émetteur »…
- [ ] Le crayon de **Émetteur** : une petite fenêtre « Émetteur — « … » », un seul champ ;
      « Agence spatiale », **Enregistrer** : le champ change, le message « Émetteur à
      confirmer » disparaît
- [ ] **Date du document** : « 3 mars 2026 » est pris (« 3 mars 2026 ») ; « bientôt » est
      refusé ; **Étiquettes** : « réunion, station sol, réunion » donne deux étiquettes
- [ ] Le crayon de **Rangé** ouvre *Déplacer…* ; celui de **Langue**, *Langue…*
- [ ] Un champ vide à confirmer se lit « À confirmer »

## La date des documents (v0.91.0)

- [ ] Verser un courrier qui commence par « Toulouse, le 1er mars 2026 » : date du document
      « 1 mars 2026 », rien à confirmer
- [ ] Verser `Réunion de suivi.txt` (« La réunion du 12/02/2026 a fixé la suite ; la date
      limite de remise est le 30/04/2026. ») : « Date à confirmer : … « 12 février 2026 » »
      (pas la date limite) — **Prendre « 12 février 2026 »**, **Pas de date**, **Classer…** ;
      le filtre *Date à confirmer*
- [ ] **Classer…** : « Date du document » accepte « 3 mars 2026 » ; « bientôt » est refusé,
      la date d'avant reste et c'est dit
- [ ] L'IA réglée : le workflow système « Identifier avec l'IA la date d'un document… »
      (actif) la donne (« identifiée par l'IA » sur la fiche)

## Les étiquettes des documents (v0.90.0)

- [ ] Verser un texte qui dit « Mots-clés : antenne, station sol » : ces étiquettes, rien à
      confirmer
- [ ] Verser `Visite antenne.txt` (« Rapport de maintenance de l'antenne de la station
      sol… », sans mots-clés) : « Étiquettes à confirmer : le texte du document suggère
      « antenne, maintenance, station » » — **Prendre ces étiquettes**, **Pas d'étiquettes**,
      **Classer…** ; le filtre *Étiquettes à confirmer*
- [ ] L'IA réglée : le workflow système « Donner avec l'IA les étiquettes d'un document… »
      (actif) les donne (« données par l'IA » sur la fiche), en reprenant celles déjà en usage

## La catégorie des documents (v0.89.0)

- [ ] Verser `CCTP station sol.txt` qui commence par « Cahier des clauses techniques
      particulières… » : catégorie CCTP, rien à confirmer (le nom et le texte d'accord)
- [ ] Verser `Devis antenne.txt` au même début : catégorie « Devis » (du nom), « Catégorie à
      confirmer » — **Prendre « CCTP »**, **Garder la catégorie actuelle**, **Classer… »
- [ ] Les pièces d'une analyse (typées) : leur catégorie est sûre, rien à confirmer
- [ ] IA réglée : l'IA choisit dans la liste (« identifiée par l'IA ») ; une catégorie hors
      de la liste n'est jamais gardée ; filtre *Catégorie à confirmer*
- [ ] Une fiche avec plusieurs choses à confirmer : une section « À confirmer (n) »,
      dépliée, son en-tête les nomme (« Langue · Titre · Catégorie… »), repliable

## L'émetteur des documents (v0.88.0)

- [ ] Verser un texte qui commence par « Émetteur : Centre national d'études spatiales » :
      émetteur donné, rien à confirmer
- [ ] Verser un texte qui commence par « Agence spatiale européenne » puis le titre :
      « Émetteur à confirmer » — **Prendre « Agence spatiale européenne »**, **Pas
      d'émetteur**, **Classer… » ; le titre probable est la ligne suivante, pas l'organisme
- [ ] Un texte sans organisme : « Pas d'émetteur » le confirme vide ; filtre *Émetteur à
      confirmer*
- [ ] IA réglée : l'IA le donne (« identifié par l'IA ») s'il figure dans le document ;
      « Classer… » enregistré : confirmé
- [ ] Workflows, filtre Système : « Identifier avec l'IA l'émetteur d'un document… »
      (actif, fond turquoise)

## Le titre des documents (v0.87.0)

- [ ] Verser `pmp_v2.txt` qui commence par « Titre : Plan de management de projet » : sa
      carte s'intitule « Plan de management de projet » ; rien à confirmer
- [ ] Verser `CCTP_v3.txt` qui commence par « Cahier des clauses techniques particulières
      de la station sol » (sans « Titre : ») : titre « CCTP v3 », « Titre à confirmer » ; sur
      la fiche, **Prendre « Cahier des clauses… »** le donne ; **Garder le titre actuel** ;
      filtre *Titre à confirmer*
- [ ] IA réglée : le même document, l'IA donne le titre (« identifié par l'IA ») ; un
      titre qui n'est pas fait des mots du document n'est jamais gardé
- [ ] « Classer… » enregistré : plus rien à confirmer
- [ ] Workflows, filtre Système : « Identifier avec l'IA le titre d'un document… » (actif),
      étape sur fond turquoise ; Prompt, Persona, Skill s'y choisissent aussi

## Les étapes d'IA : couleur, prompt, persona, skill ; la bibliothèque de skills (v0.86.0)

- [ ] Bibliothèque : quatre cartes — Documents, Prompts, Personas, **Skills** ; Skills ›
      **Ajouter les exemples** : Lire un CCTP, Repérer les pénalités, Vérifier une exigence,
      Répondre en tableau (notes dans `Bibliothèque/Skills`)
- [ ] Workflows › « Questionnaire (IA)… » : dans le logigramme, l'étape « Étape 1 · IA » a un
      **fond turquoise** ; la légende « Fond turquoise : une étape qui demande l'IA ; fond
      gris : sans IA » ; un workflow sans IA (« Relever le calendrier… ») : étapes grises,
      pas de légende
- [ ] Un clic sur l'étape d'IA : la fenêtre a **Prompt (bibliothèque)**, **Persona
      (bibliothèque)**, **Skill (bibliothèque)** — des listes, « — Aucun — » d'abord ;
      choisir un persona et un skill, enregistrer : le logigramme les affiche
      (« Persona : … · Skill : … »)
- [ ] IA réglée, exécuter : la réponse suit le rôle et la méthode choisis ; un skill retiré
      de la bibliothèque : l'étape échoue, le journal dit lequel
- [ ] Thème sombre, couleurs pour daltonismes : le fond turquoise reste distinct, « IA » est
      écrit

## La référence et la version des documents (v0.85.0)

- [ ] Verser un texte qui commence par « Réf. : CCTP-2026-118 » et « Édition 3 » : sa carte
      dit « CCTP-2026-118 · 3 » ; sa fiche : rien à confirmer ; l'IA n'est pas appelée pour
      cela
- [ ] Verser `ECSS-E-ST-10C_ed2_rev15.dwg` : référence ECSS-E-ST-10C, version 2-15, mais
      « Référence et version à confirmer » (lues dans le nom du fichier) ; **C'est juste** les
      confirme ; filtre *Référence et version à confirmer*
- [ ] IA réglée, un texte qui les dit sans leur mot (« deuxième édition du document
      DLA-NM-… ») : l'IA les identifie (« Identifiées par l'IA ») ; pas certaine : à
      confirmer, sans erreur ; une référence qui n'est pas dans le document n'est jamais
      gardée
- [ ] « Classer… » enregistré : plus rien à confirmer
- [ ] Workflows, filtre Système : « Identifier avec l'IA la référence et la version… »
      (actif) ; au *document versé*, `{reference}`, `{edition}`, `{revision}`

## « Retour » remonte au niveau supérieur ; la langue avec l'IA (v0.84.0)

- [ ] Bibliothèque › Documents › Normes › ECSS : « Retour : Normes », puis « Retour :
      Documents », puis « Retour : Bibliothèque », puis « Retour : Accueil »
- [ ] Ouvrir la fiche d'un document depuis le tableau de bord : « Retour : <son répertoire> »
      (pas « Tableau de bord ») ; **Alt + ←** ramène au tableau de bord ; **Alt + ↑** remonte
- [ ] Une analyse, la fiche d'une pièce : « Retour : L'analyse « … » » ; une fiche
      d'exigence : « Retour : Toute la bibliothèque » ; un workflow : « Retour : Tous les
      workflows »
- [ ] IA réglée, verser un texte court (« Rapport de visite du site… ») : la langue est
      identifiée par l'IA — fiche : « Français (identifiée par l'IA) », plus « à
      confirmer » ; le journal des workflows le dit
- [ ] L'IA répond « ? » (texte ambigu) ou n'est pas réglée : la langue reste à confirmer,
      sans erreur ; une détection sûre (un long texte) ne demande rien à l'IA
- [ ] Workflows, filtre Système : « Identifier avec l'IA la langue d'un document… »
      (actif), désactivable ; Bibliothèque désactivée : « workflows cassés » ne le cite pas

## La fiche d'un document : des sections repliées (v0.83.0)

- [ ] Ouvrir la fiche d'un document : sous les chiffres, **Identification**, **Le
      fichier**, **D'où il vient**, **Versions** (et « Montré aussi ailleurs » s'il a des
      fantômes) sont repliées ; à droite de chaque en-tête, l'essentiel (la catégorie, le
      nom du fichier, la première origine, « Aucune autre version reliée. »)
- [ ] Un clic (ou Entrée) déplie une section, un autre la replie ; ouvrir une autre fiche :
      ce qui a été déplié l'est encore (le temps de la session)
- [ ] Un fichier introuvable : l'en-tête *Le fichier* le dit

## La langue des documents (v0.82.0)

- [ ] Verser (ou glisser-déposer) un long texte en français : badge *Français* ; un en
      anglais : *Anglais* ; « Regrouper par › Langue » : une section par langue
- [ ] Verser un texte très court (« Bonjour ») : pas de langue, badge orange *Langue à
      confirmer* ; sa fiche : « Langue à confirmer : la détection n'a pas été assez sûre »
      — **Confirmer : Français** (quand une langue est probable) ou **Langue…**
- [ ] Un document moitié français, moitié anglais : à confirmer
- [ ] Un `.dwg` (non lu) : à confirmer, sans langue probable ; **Langue…** : choisir
      *Anglais* ; *Détecter de nouveau* ; *Sans langue* (plus rien à confirmer)
- [ ] « Classer… » : le choix *Langue* ; choisie, elle n'est plus à confirmer
- [ ] Une image : ni langue, ni « à confirmer »
- [ ] Filtres *Français*, *Langue à confirmer* ; Workflows : *Langues à confirmer, chaque
      lundi* (désactivé) ; au *document versé*, `{langue}` et `{langueaconfirmer}`

## Les fantômes de la bibliothèque (v0.81.0)

- [ ] Bibliothèque › Documents : un répertoire « Normes », y glisser-déposer un PDF
- [ ] Remonter à « Documents », y glisser-déposer le même PDF : une fenêtre « Déjà dans la
      bibliothèque » (« rangé dans « Normes » »), boutons **Ne rien faire** et **Placer un
      fantôme ici** ; « Ne rien faire » : rien n'est ajouté
- [ ] Recommencer, **Placer un fantôme ici** : « Aussi ici, rangés ailleurs (1 fantôme(s)) »,
      la carte *Fantôme* « rangé dans « Normes » » ; un clic ouvre le document ; **Aller à
      l'original** mène à « Normes » ; le PDF n'est pas copié une seconde fois
- [ ] La note du fantôme, ouverte dans Obsidian : « Fantôme : le document [[…]] est rangé
      dans « Normes » de la bibliothèque » ; le lien ouvre la fiche
- [ ] Le redéposer au même endroit, ou dans « Normes » : plus de fenêtre
- [ ] Déplacer le document (« Déplacer… ») : le fantôme le suit ; le retirer : le fantôme
      part aussi ; **Retirer le fantôme** : le document reste
- [ ] Workflows › *Proposer un fantôme…* : *Comment* = *Placer un fantôme sans demander* :
      plus de fenêtre ; désactivé : rien n'est proposé
- [ ] Les pièces d'une analyse déjà dans la bibliothèque : pas de fenêtre

## Workflows : l'extension d'un fichier ajouté, et s'il est lisible (v0.80.0)

- [ ] Workflows › Nouveau : déclencheur *Bibliothèque : document versé* ; les variables
      proposées comprennent *Extension du fichier*, *Lisible par l'application (oui / non)*,
      *Comment l'application le lit*
- [ ] Condition *Lisible par l'application* est `non`, action Prévenir
      « {fichier} (.{extension}) : {lecture} » ; verser un `.dwg` : le message dit
      « format non lu » ; une image : « image : montrée, son texte n'est pas lu » ; un
      `.pdf` : rien
- [ ] Par glisser-déposer, par « À verser », par les pièces d'une analyse : de même
- [ ] Une extension déclarée équivalente (`.tot` lu comme du XML) : `lisible` vaut `oui`
- [ ] *Fichiers déposés dans l'application* : `{extensions}` (une fois chacune) et
      `{nonlisibles}`
- [ ] Lecture de fichiers désactivée : `non`, « non lu : la lecture de fichiers est
      désactivée »

## Glisser-déposer des fichiers dans la bibliothèque (v0.79.0)

- [ ] Bibliothèque › Documents : sous les boutons, « Ou glissez-déposez des fichiers… »
- [ ] Glisser des fichiers de l'explorateur de l'ordinateur sur la page : elle s'entoure
      de pointillés, un bandeau dit « Déposer pour verser dans « Documents » » ; les
      lâcher : ils sont versés (le message le dit), leurs cartes apparaissent
- [ ] Les glisser sur la carte d'un répertoire : elle se surligne, le bandeau dit son nom ;
      les lâcher : ils entrent dans ce répertoire (sa carte compte un de plus)
- [ ] Dans un répertoire, les déposer sur la page : ils y entrent
- [ ] Un fichier déjà dans la bibliothèque : « y étai(en)t déjà », pas de doublon ; un
      dossier glissé : laissé de côté
- [ ] Obsidian n'ouvre pas, ni ne copie, les fichiers lâchés sur la page ; ailleurs dans
      Obsidian, le glisser-déposer reste le sien
- [ ] En cartes, en liste et en tableau

## Le fil d'Ariane tout en haut (v0.78.0)

- [ ] Bibliothèque › Documents, un répertoire, une autre bibliothèque, les prompts, les
      personas : le fil d'Ariane est la première ligne de la page, au-dessus du titre, du
      retour, du sous-titre et des boutons ; un clic sur une étape y mène ; une autre page
      (Analyses, Workflows) n'en a pas
- [ ] Une fenêtre étroite : il passe à la ligne, rien ne déborde

## Plusieurs bibliothèques, des répertoires (v0.77.0)

- [ ] Menu **Bibliothèque** › **Documents** : le fil d'Ariane « Bibliothèque › Documents »
      en haut de la page ; les boutons **Nouveau répertoire**, **Nouvelle
      bibliothèque**
- [ ] **Nouveau répertoire** « Normes » : on y entre (« … › Normes ») ; un sous-répertoire
      « ECSS » de même ; le dossier existe dans le coffre (`Bibliothèque/Normes/ECSS`)
- [ ] Dans « ECSS », **Verser des documents** : la fiche y est rangée ; à la racine, la
      carte « Normes » dit « 1 document(s) » ; un clic sur « Documents » dans le fil
      d'Ariane, ou **Remonter**, y ramène
- [ ] **Regrouper par › Répertoire** : tout ce qui est dessous, une section par
      répertoire (« Ici », « Normes », « Normes › ECSS »)
- [ ] La fiche d'un document : *Rangé* (Identification) ; **Déplacer…** propose chaque
      bibliothèque et chaque répertoire ; le fichier ne bouge pas ; une version reliée
      suit
- [ ] **Nouvelle bibliothèque** « Normes » (dossier vide : `Bibliothèques/Documents/Normes`),
      **Bibliothèque par défaut** coché : les pièces importées dans une analyse y entrent,
      à sa racine ; un dossier dans (ou autour d') une autre bibliothèque est refusé
- [ ] Même chose pour les **prompts** et les **personas** ; « Interroger le dossier » et
      « Demander à l'IA » trouvent toujours un prompt, où qu'il soit rangé
- [ ] L'accueil **Bibliothèque** : une section par sorte, une carte par bibliothèque
      (combien, « Par défaut ») ; **Définir par défaut** ; **Retirer la bibliothèque** :
      confirmé, son dossier reste dans le coffre
- [ ] Une fenêtre étroite : le fil d'Ariane passe à la ligne, rien ne déborde

## Le logigramme d'un workflow (v0.76.0)

- [ ] La fiche d'un workflow : la section **Logigramme**, ouverte, en tête — Quand
      (déclencheur), Si (conditions, « Non : rien ne se passe » à droite), Étape 1, 2…,
      Fin ; « Oui » sur la flèche après une question
- [ ] Un workflow « Demander d'abord » : la question « Vous acceptez de l'exécuter ? »
      (« Non : refusé, noté au journal ») ; désactivé : le début le dit, estompé
- [ ] Un clic sur le début ouvre « Nom, mode et déclencheur » ; sur une étape, sa
      modification ; au clavier aussi
- [ ] Thème sombre et couleurs pour daltonismes : les formes restent lisibles ; une
      fenêtre étroite : la branche « non » passe sous la question
- [ ] La section se replie d'un clic

## La page Exigences : sections, vues, regroupements (v0.75.0)

- [ ] **Exigences** : « Regrouper par » Catégorie (d'origine) / Statut / Type / Criticité /
      Qualité / Aucun ; une section repliable par groupe (« SOL (2 exigence(s)) »)
- [ ] **Qualité** : *Faibles (moins de 3 étoiles)*, *Moyennes*, *Bonnes* ; dans chaque
      section, les plus faibles d'abord
- [ ] **Tableau** : colonnes Nom, État, Qualité (étoiles et %), Méthode de vérification ;
      **Liste** : une ligne par exigence
- [ ] Les filtres (Faibles, À revoir…) et la recherche marchent dans chaque regroupement

## La bibliothèque : sections, vues, regroupements (v0.74.0)

- [ ] **Bibliothèque → Documents** : « Regrouper par » Origine (d'origine) / Famille /
      Catégorie / Mois d'ajout / Aucun ; une section repliable par groupe, l'intitulé dit
      combien de documents
- [ ] Vue **Tableau** : colonnes Nom, État, Taille, Ajouté le, Version ; **Liste** : une
      ligne par document
- [ ] **Prompts** et **Personas** : Regrouper par Catégorie / Favoris / Aucun ; Cartes ou
      Liste ; mettre un prompt en favori, regrouper par Favoris : « Favoris », « Les autres »
- [ ] La recherche ouvre les sections qui ont un résultat

## Les vues : cartes, liste, tableau ; regrouper (v0.73.0)

- [ ] Page **Workflows** : « Affichage » Cartes / Liste / Tableau ; « Regrouper par »
      Module / Déclencheur / État / Aucun
- [ ] **Liste** : une ligne par workflow (titre, déclencheur, badges, exécutions, boutons
      en icônes, avec leur infobulle) ; un clic sur le titre ouvre la fiche
- [ ] **Tableau** : colonnes Nom, État, Exécutions, Dernière exécution, et les boutons ; le
      titre ouvre la fiche
- [ ] **État** : sections En échec (s'il y en a), Actifs, Désactivés ; **Déclencheur** : une
      section par déclencheur, Planifiés, À la main ; **Aucun** : toutes les cartes
- [ ] La vue choisie est retenue : changer de page puis revenir (et rouvrir Obsidian) ;
      chaque page garde la sienne
- [ ] Pages **Analyses**, **Exigences**, **Bibliothèque** (documents) : Cartes / Liste /
      Tableau ; **Prompts** et **Personas** : Cartes / Liste
- [ ] La recherche et les filtres marchent dans chaque vue

## La page Workflows en sections repliables (v0.72.0)

- [ ] Page **Workflows** : une section **Workflows système** (ouverte), puis une
      sous-section par module (Analyse d'appels d'offres, Bibliothèque de documents,
      Exigences, IA, Lecture de fichiers, Typage des pièces, Workflows), repliées ; puis
      **Mes workflows** (ouverte). Chaque intitulé dit combien, combien d'actifs (et en
      échec)
- [ ] Un clic sur une sous-section l'ouvre (ses cartes), un second la replie ; au clavier
      (Tab, Entrée) aussi ; **Rafraîchir** : elle reste comme on l'a laissée
- [ ] Rechercher « remise » : seules « Workflows système » et « Analyse d'appels
      d'offres » restent, ouvertes, avec « Rappel des dates limites de remise » ; vider la
      recherche : les sections reviennent comme avant
- [ ] Filtre **En échec** : seules les sections qui en ont

## La lecture de fichiers : pièces illisibles, sans texte, bilan des formats (v0.71.0)

- [ ] Page **Workflows**, filtre Système, module Lecture de fichiers : « Signaler les
      pièces illisibles, à l'import » actif ; « Signaler les pièces sans texte (scans) » et
      « Bilan des formats du coffre, chaque lundi » désactivés
- [ ] Importer un Word abîmé (un fichier texte renommé en `.docx`) : « <analyse> — 1
      pièce(s) illisible(s) : … Le fichier est peut-être abîmé… »
- [ ] Activer « sans texte », importer un PDF scanné : « … sans texte lisible : … »
- [ ] Activer le bilan, **Exécuter** : « Coffre : n fichier(s) — … non lu(s). Non lus :
      .dwg (…) » ; les fichiers de `.obsidian` ne sont pas comptés

## La bibliothèque : prompts et personas (v0.70.0)

- [ ] Menu **Bibliothèque** : une page d'accueil — Documents, Prompts, Personas (chiffres,
      une carte chacune) ; chaque carte ouvre sa bibliothèque
- [ ] **Prompts** vide : un message, **Nouveau prompt**, **Ajouter les exemples** → 7
      prompts (Pénalités, Critères d'attribution…) dans `Bibliothèque/Prompts` ; une
      seconde fois : « Les exemples sont déjà tous là. » ; de même pour les **Personas** (6)
- [ ] **Mettre en favori** : la carte passe en tête, filtre « Favoris » ; filtres par
      catégorie ; recherche
- [ ] La fiche : le texte, **Modifier** (changer le nom : la note est renommée),
      **Ouvrir sa note**, **Retirer** (confirmé, dans `_retirés`)
- [ ] IA réglée : **Interroger le dossier** d'une analyse → la liste des prompts (« Écrire
      ma question » en tête) ; un prompt choisi remplit la question ; choisir un persona :
      la réponse est faite dans son rôle, la note dit « en tant que « … » »
- [ ] **Relire l'exigence avec l'IA** : le choix d'un persona (« Sans persona » en tête)
      avant la relecture ; **Relire les exigences du dossier** : une fois pour la série
- [ ] Un workflow « Demander à l'IA » avec *Prompt de la bibliothèque* = `Pénalités` et
      *Persona de la bibliothèque* = `Juriste marchés publics` ; un nom inconnu : le
      workflow échoue et le dit

## La bibliothèque : le dossier de dépôt et deux rappels (v0.69.0)

- [ ] Page **Workflows**, filtre Système, module Bibliothèque : « Verser le dossier « À
      verser », à l'ouverture » et « …, chaque jour » actifs ; « Versions à confirmer,
      chaque lundi » et « Documents à classer, chaque lundi » désactivés
- [ ] À l'ouverture, le dossier `Bibliothèque/À verser` existe (créé s'il manquait)
- [ ] Y poser deux fichiers (dont un déjà dans la bibliothèque), rouvrir le coffre :
      « Bibliothèque : 1 document(s) versé(s) depuis Bibliothèque/À verser. 1 y étai(en)t
      déjà : mis de côté dans _retirés. » ; le nouveau est dans `_fichiers`, l'autre dans `_retirés` ; le dossier est vide
- [ ] Activer « Versions à confirmer », **Exécuter** : le nombre et les titres des
      nouvelles versions probables ; de même « Documents à classer » (sans catégorie)

## L'IA : deux nouveaux workflows système (v0.68.0)

- [ ] Page **Workflows**, filtre Système, module IA : « Signaler les nouveaux modèles du
      serveur, à l'ouverture » actif ; « Signaler un serveur d'IA lent, à l'ouverture »
      désactivé (avec « Vérifier la connexion » d'avant)
- [ ] Première ouverture avec l'IA réglée : rien n'est dit ; le journal : « Modèles du
      serveur retenus (n) »
- [ ] Ajouter un modèle sur le serveur, rouvrir : « IA : 1 nouveau(x) modèle(s) sur le
      serveur — … (usage). À choisir pour un usage sur la page IA. »
- [ ] Activer le serveur lent, régler son seuil à 0,1 s, **Exécuter** : « IA lente : … s
      pour répondre (seuil : 0.1 s) »

## Les workflows : leur entretien en workflows système (v0.67.0)

- [ ] Page **Workflows**, filtre Système, module Workflows : « Signaler les workflows
      cassés, à l'ouverture » actif ; « Bilan des workflows, chaque lundi » et « Archiver
      le journal des workflows, chaque mois » désactivés
- [ ] Un workflow à vous déclenché par « AO : pièces importées » ; désactiver le module
      Analyse d'appels d'offres, rouvrir Obsidian : « 1 workflow(s) cassé(s) : « … »
      (déclencheur inconnu : ao.pieces-importees) » ; réactiver le module : plus rien
- [ ] **Exécuter** le bilan : « Workflows, les 7 derniers jours : n exécution(s), … »
- [ ] **Exécuter** l'archive (régler ses jours à 0 pour l'essai) : le journal se vide de
      ses anciennes lignes, la note « Journal des workflows — archive AAAA-MM » les garde

## L'analyse d'appels d'offres : trois nouveaux workflows système (v0.66.0)

- [ ] Page **Workflows**, filtre Système, module Analyse d'appels d'offres : « Rappel des
      questions et de la visite » actif ; « Rappel de la fin de validité des offres » et
      « Extraire les exigences du CCTP à l'import » désactivés
- [ ] Un RC dont la date limite des questions tombe dans 3 jours et la visite demain :
      **Exécuter** le rappel → « Station sol : Questions des candidats dans 3 jour(s), le … »
      et « Visite dans 1 jour(s) » ; rien dans les jours dits : le journal dit « Aucune »
- [ ] Une remise passée et « validité de 120 jours » : activer le rappel de validité,
      régler ses jours pour tomber aujourd'hui, **Exécuter** → « les offres ne sont plus
      valables dans … jour(s) »
- [ ] Activer « Extraire les exigences du CCTP à l'import », importer un CCTP : l'aperçu
      d'extraction s'ouvre ; importer → les exigences, puis le contrôle des exigences
      extraites au journal
- [ ] Le message d'accueil, à la première activation, est toujours là (non converti)

## Les exigences : trois nouveaux workflows système (v0.65.0)

- [ ] Page **Workflows**, filtre Système, module Exigences : « Contrôler la qualité des
      exigences importées » actif ; « Traductions à revoir, chaque lundi » et « Relire les
      nouvelles exigences (IA) » désactivés (avec les deux d'avant)
- [ ] Importer un CSV avec une exigence vague (« Le système sera disponible le cas
      échéant. ») : un message « Import d'exigences (…) — 1 exigence(s) faible(s) sur … :
      REQ-…-… (★★) (moyenne … %). » ; le **Journal des workflows** le garde et mène à sa fiche
- [ ] Un import sans exigence faible : pas de message ; le journal dit « aucune faible »
- [ ] Activer « Traductions à revoir, chaque lundi », **Exécuter** : « Traductions à revoir
      sur n exigence(s) : … absente(s), … en retard, … à relire. »
- [ ] IA réglée : activer « Relire les nouvelles exigences (IA) », **Nouvelle exigence** :
      la relecture est écrite dans sa note
- [ ] Désactiver le contrôle des importées : plus de message ; **Rétablir l'original**

## Le typage des pièces : signaler les pièces sans type reconnu (v0.64.0)

- [ ] Page **Workflows**, filtre Système : « Signaler les pièces sans type reconnu, à
      l'import » (Typage des pièces), actif ; sa condition « Pièces sans type reconnu
      n'est pas vide »
- [ ] Importer dans une analyse une pièce que rien ne reconnaît (`SPEC_sol_v2.pdf`) : un
      message « <analyse> — 1 pièce(s) sans type reconnu : SPEC_sol_v2. Pour celles-ci :
      « Changer le type de la pièce »… » ; le **Journal des workflows** le garde
- [ ] Un import où toutes les pièces sont typées : pas de message, rien au journal pour
      ce workflow
- [ ] Ajouter le mot-clé `spec` → CCTP (Types de pièces), réimporter : plus de message
- [ ] Désactiver le workflow : plus de message ; **Rétablir l'original** le remet

## La lecture de fichiers : signaler les formats non lus (v0.63.0)

- [ ] Page **Workflows**, filtre Système : « Signaler les formats non lus, au dépôt de
      fichiers » (Lecture de fichiers), actif
- [ ] Importer dans une analyse une pièce `.tot` (avec un `.md` et une image) : un
      message « <analyse> — 1 fichier(s) dans un format non lu (.tot) : … Si c'est du
      texte, déclarez une extension équivalente… » ; l'image n'est pas signalée ; le
      **Journal des workflows** le garde
- [ ] Déclarer `.tot` lu comme `.xml` (Formats de fichiers → Extensions équivalentes),
      réimporter : plus de message
- [ ] Modifier l'action du workflow : « Extensions à ne pas signaler » = `dwg` ; une
      pièce `.dwg` : plus de message
- [ ] Désactiver le workflow : plus de message ; **Rétablir l'original** le remet

## La bibliothèque de documents : ses workflows système (v0.62.0)

- [ ] Page **Workflows**, filtre Système : quatre workflows de la Bibliothèque de
      documents — « Ranger les pièces importées dans la bibliothèque », « Ranger les
      fichiers importés dans la bibliothèque », « Repérer les nouvelles versions
      probables » actifs ; « Signaler les fichiers introuvables, chaque lundi » désactivé
- [ ] Importer des pièces dans une analyse : elles sont dans la bibliothèque, rien n'est
      dit ; le **Journal des workflows** garde « Ranger les pièces importées… » (et
      « Repérer les nouvelles versions probables »)
- [ ] Désactiver « Ranger les pièces importées » : de nouvelles pièces n'entrent plus dans
      la bibliothèque ; un import d'exigences, si ; le réactiver
- [ ] Désactiver « Ranger les fichiers importés » : un import d'exigences (ou de types, de
      workflows) n'y entre plus ; **Verser des documents**, toujours
- [ ] Verser « CCTP ind A.pdf » puis « CCTP ind B.pdf » : la seconde « Nouvelle version
      probable » ; « Repérer les nouvelles versions probables » désactivé, plus de
      suggestion
- [ ] Verser deux fois « CCTP.pdf » (contenus différents) : la copie « CCTP (2).pdf » est
      une nouvelle version probable
- [ ] Activer « Signaler les fichiers introuvables », déplacer hors du coffre un fichier
      de `Bibliothèque/_fichiers`, **Exécuter** : « 1 document(s) de la bibliothèque
      n'ont plus leur fichier : … » ; le journal mène à sa fiche
- [ ] Modifier un de ces workflows : badge « Modifié » ; **Rétablir l'original** ; pas de
      « Supprimer »

## La bibliothèque de documents (v0.61.0)

- [ ] Importer un DCE (ZIP) dans une analyse : menu **Bibliothèque**, une carte par pièce,
      « Analyse d'appels d'offres — <analyse> », le type de pièce pour catégorie ; les
      fichiers restent dans l'analyse (rien dans `_fichiers`)
- [ ] Le même fichier importé de nouveau (autre analyse) : pas de nouvelle carte, une
      origine de plus sur sa fiche
- [ ] **Verser des documents** → Sur l'ordinateur : copié dans `Bibliothèque/_fichiers`,
      sa fiche s'ouvre
- [ ] « CCTP ind A.pdf » puis « CCTP ind B.pdf » : la seconde « Nouvelle version
      probable » ; **Relier comme nouvelle version** ; la première « Remplacé… » ; filtre
      **Dernières versions**
- [ ] **Classer…** : titre, catégorie, référence, édition, révision, émetteur, étiquettes
- [ ] Une origine : un clic mène à l'analyse (sa fiche en page)
- [ ] Importer des exigences d'un fichier, des types de pièces, des workflows : le fichier
      est dans la bibliothèque
- [ ] **Retirer de la bibliothèque** (confirmé) : dans `Bibliothèque/_retirés`, rien
      d'effacé ; une pièce d'analyse reste en place

## Le module IA : vérifier la connexion à l'ouverture (v0.60.0)

- [ ] Page **Workflows**, filtre **Système** : « Vérifier la connexion à l'IA, à
      l'ouverture », actif
- [ ] Serveur réglé et en marche, rouvrir Obsidian : aucun message ; le journal dit
      « Connexion vérifiée : n modèle(s) » ; la page IA montre le dernier test
- [ ] Un modèle choisi retiré du serveur : le message le dit, à l'ouverture
- [ ] Serveur arrêté : « Workflow … en échec : … le serveur d'IA ne répond pas », ❌ au
      journal
- [ ] Sans adresse réglée : rien

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
