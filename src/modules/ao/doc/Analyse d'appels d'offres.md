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
lire les pièces.

## 1. Créer une analyse

Palette de commandes (Ctrl/Cmd + P) → **Nouvelle analyse d'appel d'offres** :

- **Nom** : celui du dossier et de la note de l'analyse ;
- **Position** : candidat ou émetteur ;
- **Acheteur** et **référence de la consultation**, si vous les connaissez.

L'analyse est créée dans le dossier des analyses (par défaut `Appels d'offres`,
modifiable dans Paramètres → Black Projects → **Fonctions**, sur la ligne du module) :

```
Appels d'offres/<Nom>/
├── <Nom>.md          la note de l'analyse
├── Pièces/
│   ├── Originaux/    les fichiers du dossier, tels que reçus
│   └── <pièce>.md    une note par pièce
├── Exigences/        (à venir)
└── Analyse/          (à venir)
```

Black Projects propose ensuite de mettre les pièces dans l'analyse.

## 2. Mettre les pièces du dossier

Deux façons, au choix :

- **Importer** : commande **Importer des pièces dans une analyse (ZIP compris)**, puis
  choisissez les fichiers sur votre ordinateur — les pièces une à une, ou le ZIP du
  dossier tel que l'acheteur l'a publié : il est ouvert, et chaque fichier importé, en
  gardant ses sous-dossiers. Une archive dans l'archive est ouverte aussi.
- **Déposer** : glissez les fichiers dans le dossier `Pièces/Originaux` de l'analyse,
  dans l'explorateur de fichiers d'Obsidian, puis lancez **Mettre à jour l'analyse**.

Un fichier déjà importé à l'identique n'est pas importé une seconde fois ; un fichier
différent du même nom est gardé à côté (« RC (2).pdf »).

Les commandes travaillent sur l'analyse de la note ouverte ; sinon, elles demandent
laquelle.

## 3. Ce que devient chaque pièce

Chaque pièce est **lue**, **typée** et **décrite par une note** dans `Pièces/` :

- son **type**, deviné d'abord d'après le nom du fichier, puis, si le nom ne dit rien,
  d'après le titre en tête de son texte. Les types sont essayés dans l'ordre du tableau ;
  le premier qui correspond l'emporte. Un mot-clé est cherché comme mot entier, sans
  tenir compte des accents, de la casse ni de la ponctuation (« CCTP_v3 » et « cctp v3 »
  se valent) ; terminé par « … », il vaut aussi pour les mots qui le prolongent
  (« annexe… » trouve « Annexes »). La même liste est dans Paramètres → Black Projects →
  **Fonctions**. Les mots-clés marqués *(ajouté)* sont les vôtres (voir plus bas).

{{types}}

  **Vos propres mots-clés** : en tête de la fenêtre **Fonctions**, deux listes —
  « nom du fichier » et « titre du document » — où ajouter un mot ou une expression vers
  un type (« SPEC » → CCTP, « grille de prix » → BPU). Ils sont cherchés **avant** ceux
  du module, et valent pour les prochains imports ; pour une pièce déjà importée,
  utilisez **Changer le type de la pièce**. Un mot-clé déjà déclaré, ou déjà connu du
  module pour ce type, est refusé avec un message.

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

## 4. La note de l'analyse

Elle donne la position, l'acheteur, la référence, et le **tableau des pièces du
dossier**, tenu à jour par Black Projects à chaque import, mise à jour ou changement de
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
