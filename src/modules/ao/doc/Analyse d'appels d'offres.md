# Analyse d'appels d'offres

{{link:Accueil|← Accueil}}

Le module **Analyse d'appels d'offres** aide à lire, comprendre et évaluer un dossier de
consultation, dans les deux sens :

- **candidat ou évaluateur** : analyser un dossier reçu (go / no go, risques, exigences à
  satisfaire), et une offre face au dossier (matrice de conformité, avis motivé) ;
- **émetteur** : relire votre propre dossier avant publication — qualité des exigences,
  cohérence entre les pièces, clauses manquantes, ambiguïtés qui feraient poser des
  questions aux candidats.

Il s'appuie sur le module {{link:Modules/Lecture de fichiers|Lecture de fichiers}} pour
lire les pièces, et sur {{link:Modules/Typage des pièces|Typage des pièces}} pour
reconnaître leur type.

## La page « Analyses »

L'entrée **Analyses** du menu de gauche, la tuile **Analyses** de l'accueil, le lien
« Toutes les analyses » du tableau de bord et la commande **Ouvrir les analyses d'appels
d'offres** ouvrent la **page des analyses**, dans l'onglet Black Projects :

- en chiffres : le nombre d'analyses, les remises dans les 30 jours, les pièces à lire,
  les exigences faibles ;
- les actions rapides (nouvelle analyse, importer des pièces, calendrier, interroger…) ;
- une **carte par analyse**, la date limite de remise la plus proche en tête ; un clic sur
  son nom ouvre sa **fiche** ;
- une **recherche** (nom, acheteur, référence…) et des **filtres** : remise à venir, remise
  sous 30 jours, pièces à lire, exigences faibles, candidat, émetteur.

## La fiche d'une analyse

Un clic sur une analyse (page Analyses ou tableau de bord) ouvre sa **fiche**, en page,
où tout se voit et où chaque bouton agit sur **cette** analyse — plus de « Dans quelle
analyse ? » :

- en tête : **Importer des pièces**, **Mettre à jour**, **Calendrier**, **Vérifier**,
  **Qualité du dossier**, et avec l'IA **Interroger**, **Questionnaire**, **Relire (IA)** ;
  **Ouvrir la note de l'analyse** ;
- ses chiffres : la date limite de remise (jours restants), les pièces (lues ou non), les
  exigences, leur qualité ;
- ses **pièces**, par destination (appel d'offres, réponse ou chaque candidat) : type,
  état de lecture, caractères lus ; **Changer le type**, **Déplacer**, **Extraire les
  exigences** ; le nom ouvre la **fiche de la pièce** : ce qui empêche de la lire s'il le
  faut, ses chiffres (lecture, type, caractères lus, exigences extraites), le début de son
  texte (lisible, sans la syntaxe Markdown), les dates et délais relevés dans elle, les
  exigences qui en viennent (un clic ouvre leur fiche), et les boutons Changer le type,
  Déplacer, Extraire les exigences, ouvrir sa note, son fichier d'origine, son analyse ;
- pour l'**émetteur**, ses **candidats** : une carte par candidat, avec sa couverture des
  exigences (« Couverture 100 % », citées ou traitées, absentes) ; un clic ouvre la **fiche
  du candidat** : sa réponse (ses pièces, chacune avec ses boutons), et la couverture des
  exigences par elle, maintenant — les absentes d'abord, puis à vérifier, traitées,
  citées, chacune avec l'endroit de la réponse et l'extrait ; un clic ouvre la fiche de
  l'exigence ; **Importer des pièces de sa réponse**, **Écrire le rapport de couverture** ;
- son **calendrier** (les dates relevées et leur pièce), ses **exigences** (les plus faibles
  d'abord), et **ce qu'elle a produit** (calendrier, vérification, qualité, questionnaire,
  questions…) : un clic ouvre la note **en page**, lisible sans la syntaxe — une section
  par titre, chaque tableau en liste avec la couleur de ses lignes (vert, orange, rouge) ;
  un clic sur une ligne ouvre la fiche de la pièce ou de l'exigence qu'elle cite ;
  **Mettre à jour** refait la note (sans quitter la page), **Ouvrir la note** l'ouvre dans
  le coffre, une recherche porte sur toute la note ;
- ses **questions au dossier** (« Interroger ») : la question, sa date, combien de sources
  sont citées ; un clic ouvre la **page de la question** — la réponse, le rappel de la
  vérifier, une carte par source (citée ou non, les extraits donnés à l'IA ; un clic ouvre
  la fiche de la pièce), vos notes ; **Reposer la question** rouvre la fenêtre avec la
  question déjà écrite (la nouvelle réponse va dans une nouvelle note), **Nouvelle
  question**. « Interroger », depuis la fiche, ouvre la réponse sur sa page ;
- son **questionnaire** : **Questionnaire** ouvre sa page — les six thèmes (critères
  d'attribution, pénalités, garanties, propriété intellectuelle, confidentialité, contrôle
  export), chacun répondu, sans source citée (à vérifier), rien dans les pièces, ou pas
  encore posé ; **Remplir le questionnaire** (choisir les thèmes), **Reposer** un thème
  seul ; un clic sur un thème montre la question posée, la réponse et ses sources ;
- la **qualité de ses exigences** : **Qualité du dossier** ouvre sa page, calculée à
  l'ouverture — la note moyenne, les faibles, les non vérifiables, les doublons probables ;
  une carte par exigence, la plus faible d'abord, avec ses étoiles et ce qui lui coûte (un
  clic ouvre sa fiche) ; les défauts les plus fréquents, chaque axe de la norme ;
  **Écrire le rapport** la garde dans la note « Qualité des exigences » ;
- une recherche et des filtres (pièces à lire, appel d'offres, réponse) ; « ← Toutes les
  analyses » ramène à la liste.

## 1. Créer une analyse

Palette de commandes (Ctrl/Cmd + P) → **Nouvelle analyse d'appel d'offres** :

- **Nom** : celui du dossier et de la note de l'analyse ;
- **Position** : candidat ou émetteur ;
- **Acheteur** et **référence de la consultation**, si vous les connaissez.

L'analyse est créée dans le dossier des analyses (par défaut `Appels d'offres`,
modifiable dans Paramètres → Black Projects → **Fonctions**, sur la ligne du module) :

```
Appels d'offres/<Nom>/
├── <Nom>.md                    la note de l'analyse
├── Pièces/
│   ├── Appel d'offres/         le dossier de consultation
│   │   ├── Originaux/          les fichiers, tels que reçus
│   │   └── <pièce>.md          une note par pièce
│   ├── Réponse/                candidat : votre réponse (même forme)
│   └── Réponses/<candidat>/    émetteur : la réponse de chaque candidat
├── Exigences/                  (à venir)
└── Analyse/                    (à venir)
```

Black Projects propose ensuite de mettre les pièces dans l'analyse.

## 2. Mettre les pièces du dossier

Deux façons, au choix :

- **Importer** : commande **Importer des pièces dans une analyse (ZIP compris)**, puis
  choisissez les fichiers sur votre ordinateur — les pièces une à une, ou le ZIP du
  dossier tel que l'acheteur l'a publié : il est ouvert, et chaque fichier importé, en
  gardant ses sous-dossiers. Une archive dans l'archive est ouverte aussi.
- **Déposer** : glissez les fichiers dans le dossier `Pièces/Appel d'offres/Originaux`
  de l'analyse (ou dans les `Originaux` de la réponse),
  dans l'explorateur de fichiers d'Obsidian, puis lancez **Mettre à jour l'analyse**.

Un fichier déjà importé à l'identique n'est pas importé une seconde fois ; un fichier
différent du même nom est gardé à côté (« RC (2).pdf »).

Les commandes travaillent sur l'analyse de la note ouverte ; sinon, elles demandent
laquelle.

## 3. Appel d'offres ou réponse

Chaque type de pièce va avec l'**appel d'offres** (RC, CCTP, CCAP…), avec la
**réponse**, ou **les deux** (AE, BPU, DPGF, DQE, mémoire, formulaires, planning,
annexes… : vierges dans le dossier, remplis dans l'offre).

Cela se règle dans la fenêtre de ce module (Paramètres → Black Projects → *Analyse
d'appels d'offres*), rubrique **Où vont les types de pièces** :

- **Ajouter un type…** : une petite fenêtre pour choisir le type et allumer
  « AO » (avec l'appel d'offres), « Réponse AO » (avec la réponse), ou les deux ;
- **Types rangés** : la liste se déplie ; l'explication des colonnes est en haut, puis
  chaque type tient sur une ligne, avec ses deux interrupteurs et une corbeille pour le
  retirer de la liste.

**Au départ, la liste est vide** : c'est à vous de choisir. Tant qu'un type n'y est pas
(et pour AUTRE), ou si ses deux interrupteurs sont allumés, la question est posée à
l'import. Dans **Types de pièces**, chaque fiche rappelle où l'analyse range ce type.

À l'activation du module, un message explique cela, avec un bouton **Régler
maintenant** qui ouvre la fenêtre du module. Ensuite, tant que la liste est vide, un
rappel s'affiche à chaque ouverture d'Obsidian : cochez **Ne plus me le rappeler à
l'ouverture** pour ne plus le voir ; l'interrupteur **Rappel à l'ouverture**, dans la
fenêtre du module, le rétablit.

À l'import, les pièces dont le type va « dans les deux » font l'objet d'**une question,
en une fois** : la fenêtre « Où ranger ces pièces ? » propose pour chacune « Appel
d'offres » ou « Réponse », avec un raccourci **Tout mettre dans** pour tout un ZIP.
Annuler n'ajoute rien à l'analyse.

- **Candidat** : une réponse, la vôtre, dans `Pièces/Réponse`.
- **Émetteur** : une réponse par candidat, dans `Pièces/Réponses/<candidat>`. La même
  fenêtre demande de quel candidat est la réponse — un candidat déjà connu, ou un
  nouveau.

Une pièce mal rangée se déplace : ouvrez sa note, puis commande **Déplacer la pièce
(appel d'offres ↔ réponse)** — son fichier et sa note changent de dossier, le tableau
suit.

Les fichiers déposés à la main sont rangés là où ils ont été déposés : dans les
`Originaux` de l'appel d'offres, de la réponse, ou d'un candidat.

## 4. Ce que devient chaque pièce

Chaque pièce est **lue**, **typée** et **décrite par une note** dans `Pièces/` :

- son **type** (RC, CCTP, CCAP, BPU…), reconnu par le module
  {{link:Modules/Typage des pièces|Typage des pièces}} d'après le nom du fichier, puis le
  titre de son texte. Les types, ce qui les fait reconnaître, vos propres types et
  mots-clés, les types désactivés et leur échange avec d'autres coffres se règlent dans
  Paramètres → Black Projects → **Types de pièces**.

- son **état de lecture** :

| État | Signification |
| --- | --- |
| 🟩 Lue | le texte est extrait dans la note |
| 🟧 Sans texte (scan) | à lire par le modèle de vision du serveur d’IA (à venir) |
| 🟧 Image | idem |
| ⬜ Format non lu | le fichier est gardé ; déclarez une extension équivalente s'il s'agit d'un format lu |
| 🟥 Illisible | fichier abîmé, ou protégé par un mot de passe d'ouverture |

- le **texte extrait**, sous le titre « Texte extrait », avec ses titres, ses listes et
  ses tableaux.

**Le type est mal deviné ?** Ouvrez la note de la pièce, puis commande **Changer le type
de la pièce** ; ou modifiez la propriété `type` de la note, puis **Mettre à jour
l'analyse**.

## 5. La note de l'analyse

Elle donne la position, l'acheteur, la référence, et le **tableau des pièces** — une
partie pour l'appel d'offres, une pour la réponse (ou une par candidat) —, tenu à jour par Black Projects à chaque import, mise à jour ou changement de
type : chaque pièce avec son lien, son type, son état de lecture et la taille de son
texte. Ne modifiez pas ce tableau ; écrivez vos remarques dans la section **Notes**, que
Black Projects ne touche jamais.

## 6. Extraire les exigences d'une pièce

Ouvrez la note d'une pièce — le CCTP, surtout —, puis commande **Extraire les exigences
de la pièce** (depuis la note de l'analyse, la commande demande de quelle pièce). Les
exigences sont reconnues :

- dans un **tableau** dont l'en-tête nomme un identifiant ou une exigence :
  « Identifiant | Exigence | Vérification », « Réf. | Énoncé | Priorité »… ;
- dans un **paragraphe** qui commence par un identifiant : « EX-SOL-003 — Le système
  doit… ».

Formats : Word, PDF (avec texte), HTML, Markdown, Excel, CSV, PowerPoint, ReqIF (DOORS).
Le reste du texte est laissé tranquille : rien n'est deviné.

Une fenêtre montre d'abord ce que l'extraction ferait — chaque exigence, **nouvelle**,
**mise à jour**, **inchangée** ou **refusée**, et **où** elle a été trouvée (« Article 2
— Exigences, tableau 1, ligne 2 ») ; cochez ce que vous prenez, puis **Importer**.

- Les exigences vont dans le dossier `Exigences` de l'analyse, une note chacune ;
  l'identifiant du dossier est gardé (`EX-SOL-001`). Une exigence sans identifiant en
  reçoit un sous le type de la pièce (`REQ-CCTP-0001`).
- Chacune garde sa **pièce** (un lien) et **l'endroit** où elle a été trouvée.
- La note de la pièce liste ses **exigences extraites**, avant son texte.
- La note de l'analyse tient le tableau **Exigences du dossier** : chaque exigence, sa
  formulation, sa pièce, l'endroit.
- Extraire de nouveau la même pièce ne crée rien en double : ce qui n'a pas changé est
  « inchangé », ce qui a changé est mis à jour (avec une révision).

Commande **Mettre à jour les exigences de l'analyse** : réécrit ces deux listes, après
avoir modifié ou supprimé des exigences à la main.

## 7. Vérifier les exigences du dossier

Quatre vérifications, chacune sa commande, et une commande qui les enchaîne : **Vérifier
les exigences du dossier (les quatre vérifications)**. Elles visent l'analyse de la note
ouverte. Les résultats vont dans la note `Analyse/Vérification des exigences` de
l'analyse : un **résumé** en tête (la date et le résultat de chaque vérification), puis
une section par vérification, réécrite quand on la relance. Vos remarques vont dans la
section Notes, jamais touchée.

| Commande | Ce qu'elle vérifie |
| --- | --- |
| **Extraire les exigences de toutes les pièces** | Toutes les pièces de l'appel d'offres en un seul aperçu (chaque exigence avec sa pièce entre crochets) ; un identifiant déjà trouvé dans une autre pièce est refusé, la première pièce fait foi. Le rapport donne le nombre d'exigences par pièce, et les pièces sans exigence |
| **Chercher les exigences oubliées** | Les phrases qui ont la tournure d'une exigence (« doit », « devra », « est tenu de », « s'engage à », « obligatoirement », « shall », « must »…) mais qu'aucune exigence ne reprend — ni par son identifiant, ni par ses mots. Elles sont proposées à l'ajout (rien n'est coché d'avance) ; celles ajoutées reçoivent un identifiant sous le type de leur pièce |
| **Vérifier la cohérence des exigences entre pièces** | Un même identifiant écrit différemment d'une pièce à l'autre ; présent dans une version d'un document (deux pièces du même type, CCTP en Word et en PDF par exemple) et absent de l'autre ; en double dans une pièce ; un même texte sous deux identifiants ; une exigence rangée qui ne dit plus ce que dit sa pièce |
| **Vérifier la couverture des exigences par la réponse** | Pour chaque exigence de l'analyse, l'endroit des pièces de **réponse** qui la **cite** (identifiant ou alias), la **traite** (au moins 60 % de ses mots), est **à vérifier** (35 à 60 %), ou son **absence**. Pour l'émetteur, un tableau par candidat. Une estimation sans IA, à relire : l'IA l'affinera avec la matrice de conformité (étape 7) |

## 8. La qualité des exigences du dossier

Commande **Analyser la qualité des exigences du dossier** : la note `Analyse/Qualité des
exigences` de l'analyse — combien d'exigences, la **répartition des notes**, la moyenne
par axe, les **défauts les plus fréquents** (avec des exemples), les **doublons
probables**, les exigences **non vérifiables**, les **plus faibles**, puis chacune avec
sa note et ses défauts. Hors ligne, sans serveur d'IA.

Les exigences d'un dossier sont notées sur leur **seule rédaction** (une obligation, sans
ambiguïté, vérifiable, avec un acteur) : elles sont de l'acheteur, et n'ont chez nous ni
responsable ni liens. Une phrase qui n'oblige personne a deux étoiles au plus. Le détail
des règles est dans la page {{link:Modules/Exigences|Exigences}}.

## 9. Le calendrier de l'appel d'offres

Commande **Calendrier de l'appel d'offres** : la note `Analyse/Calendrier` de l'analyse,
relevée dans les pièces de l'appel d'offres, **sans IA** :

- **À retenir** : la **date limite de remise des offres** et la **validité des offres** ;
- les **dates**, par ordre chronologique, chacune avec sa nature (remise, questions,
  visite, notification, démarrage, livraison, pénalités…), la **phrase d'où elle vient** et
  sa pièce ;
- les **délais** (« sous 15 jours après la notification », « fixé à 120 jours »…), de même.

Une date écrite sans année prend l'année la plus présente dans le document, et le dit.
Vérifiez toujours dans la pièce avant de vous engager. La section Notes est gardée.

## 10. Interroger le dossier avec l'IA

Avec le module **IA** réglé (voir {{link:Modules/IA|IA}}) :

- **Interroger le dossier (IA)** : posez une question (« Quelles sont les pénalités de
  retard ? », « Que dit l'article 7.2 ? »). **Recherche dans les pièces** (par défaut) :
  Black Projects trouve les passages des pièces qui y répondent le mieux, les numérote et
  ne donne qu'eux à l'IA, qui répond en citant leurs numéros. **Lecture de chaque pièce** :
  chaque pièce est lue en entière par l'IA — plus long, rien n'échappe. La réponse va dans
  `Analyse/Questions/<date> <question>` : chaque renvoi **[1]** mène à la pièce ; sous la
  réponse, les sources (citées ou non) et les extraits transmis. Si rien dans les pièces
  ne parle de la question, l'IA n'est **pas** interrogée : elle n'a rien à inventer.
- **Questionnaire du dossier (IA)** : six questions prêtes — **critères d'attribution**,
  **pénalités**, **garanties**, **propriété intellectuelle**, **confidentialité**,
  **contrôle export** — posées en une fois ; les réponses, avec leurs sources, dans
  `Analyse/Questionnaire`. Relancer remplace les réponses, vos notes restent.
- **Relire les exigences du dossier avec l'IA** : les plus faibles sont cochées ; la
  relecture de l'IA est écrite dans la note de chaque exigence. Côté **candidat**, la
  formulation de l'acheteur n'est jamais changée (de quoi préparer vos questions) ; côté
  **émetteur**, vous pouvez retenir une reformulation.

Rien ne quitte votre réseau : les questions vont au serveur que vous avez réglé.

## 11. Automatiser avec les workflows

Avec le module {{link:Modules/Workflows|Workflows}}, l'analyse se traite seule : « Nouveau
workflow » propose *À l'import des pièces : relever le calendrier*, *À l'extraction des
exigences : qualité et cohérence* et *À l'import du CCAP, du RC ou du CCTP : questionnaire
(IA)*. Vous pouvez aussi écrire les vôtres : déclencheurs *analyse créée*, *pièces
importées*, *exigences extraites* ; actions calendrier, qualité, cohérence, couverture,
interroger le dossier, questionnaire.

## Ce qui arrive ensuite

Paramètres → Black Projects → **Fonctions** montre où en est le module :

| Fonction | Étape |
| --- | --- |
| Matrice de conformité (Excel), rapport (Word), fiche de synthèse, comparaison de deux versions du dossier | 7 |

Cette page s'enrichit à chaque étape : mettez la documentation à jour après chaque
nouvelle version du plugin.
