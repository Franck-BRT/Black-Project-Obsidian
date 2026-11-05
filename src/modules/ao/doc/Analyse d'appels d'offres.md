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
  « Appel d'offres », « Réponse », ou les deux ;
- **Types rangés** : la liste se déplie ; chaque type a ses deux interrupteurs, et une
  corbeille pour le retirer de la liste.

Les deux interrupteurs allumés, ou un type absent de la liste (vos types ajoutés, AUTRE),
la question est posée à l'import. Dans **Types de pièces**, chaque fiche rappelle où
l'analyse range ce type.

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
| 🟧 Sans texte (scan) | à lire par le modèle de vision de Sidonie (à venir) |
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

## Ce qui arrive ensuite

Paramètres → Black Projects → **Fonctions** montre où en est le module :

| Fonction | Étape |
| --- | --- |
| Extraire les exigences (Word, Excel, PDF, ReqIF/DOORS), chacune reliée à sa pièce | 3-4 |
| Mesurer la qualité des exigences (règles, score ISO/IEC/IEEE 29148, doublons) | 5 |
| Relecture et conseils par l'IA (Sidonie), calendrier de l'appel d'offres, questions posées à tout le dossier | 6 |
| Matrice de conformité (Excel), rapport (Word), fiche de synthèse, comparaison de deux versions du dossier | 7 |

Cette page s'enrichit à chaque étape : mettez la documentation à jour après chaque
nouvelle version du plugin.
