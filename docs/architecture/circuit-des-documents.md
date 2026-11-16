# Architecture — le circuit des documents

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

**Statut : conception validée ; versions A (0.134.0) et B (0.135.0) livrées.** Les décisions prises sont à la fin.

## Le besoin

Un document posé dans l'application, par n'importe quel chemin (glissé sur une page, versé,
importé dans une analyse d'appel d'offres, déposé dans le coffre depuis l'explorateur), doit
être traité **sans que l'utilisateur ait à y penser** :

1. il arrive d'abord, systématiquement, dans un répertoire **À classer** ;
2. il est **ingéré** : transcrit en markdown, relu et corrigé ;
3. il est **analysé** : ce qu'il est, de qui il vient, à quoi il se rattache (un projet, une
   entreprise, une personne, d'autres documents, des notes) ;
4. il est **rangé** au bon endroit, avec ses liens ;
5. quand l'IA **n'est pas sûre**, elle ne range pas : le document va dans **À contrôler**,
   avec sa proposition et sa raison, et l'utilisateur tranche d'un clic.

Le but est d'automatiser au maximum, sans jamais ranger au hasard.

## L'inspiration : gbrain

[gbrain](https://github.com/garrytan/gbrain) (Garry Tan, licence MIT) fait cela pour une
mémoire d'entreprise. On en reprend les **principes**, pas le code ni l'outillage (pas de base
de données, pas de démon, pas d'agent externe : tout reste des notes du coffre, et le moteur
de workflows de l'application orchestre).

| Principe de gbrain | Ce qu'on en fait |
|---|---|
| **Thin harness, fat skills** : un skill est une procédure en markdown (le *comment*), appelée avec des paramètres (le *quoi*) | Les skills de la bibliothèque deviennent **exécutables** par une étape de workflow ; on les modifie sans coder |
| **Latent / déterministe** : le jugement à l'IA, ce qui doit être sûr au code | L'IA **décide** (une réponse structurée), l'application **exécute** (déplacer, lier, journaliser) |
| **Resolver** : pour telle tâche, charger tel contexte | Chaque skill déclare le contexte qu'il reçoit (la fiche, le texte, les projets, les règles de rangement…) |
| **Ingest gate** : rien n'entre sans vérifier « déjà connu ? » (entités) et « déjà dit ? » (doublons) | Doublons par empreinte (existe) ; entités connues (entreprises, personnes, projets) cherchées **par nom et alias** avant d'en créer |
| **Filing rules** : le **sujet principal** décide du rangement, pas le format ni l'origine | Règle de base du skill Rangement ; les répertoires attendus d'un projet, par type de pièce, donnent une règle sûre |
| **Iron law du back-linking** : toute mention liée dans les deux sens | Les liens s'écrivent dans la fiche, et un rétrolien dans la note citée |
| **Fail closed** : en dessous d'un seuil de confiance, on n'applique pas, on soumet à l'humain | **À contrôler** |
| **Cycle d'entretien** périodique | Un workflow planifié qui relance, revérifie, signale |

**Mis de côté pour plus tard** (pas écarté : on y reviendra une fois le circuit en place) :

- la recherche vectorielle et les embeddings (trouver des liens par le sens, pas seulement
  par les noms) ;
- le graphe en base (parcourir les relations entre pages plutôt que relire les notes) ;
- les connecteurs externes (courriel, calendrier, réunions) comme sources d'entrée ;
- l'exécution d'outils libres par l'IA (l'IA qui appelle elle-même les actions, au lieu de
  rendre une décision que l'application applique).

## Le principe : l'IA décide, le code exécute

Chaque étape du circuit est soit **déterministe** (même entrée, même résultat, toujours),
soit **du jugement** (l'IA lit et décide). L'IA ne touche jamais au coffre directement :
elle rend une **décision structurée** (JSON), que l'application **valide** puis **applique**.
C'est plus sûr, cela marche avec les modèles locaux (qui appellent mal des outils), et tout
se journalise.

| Étape | Nature | Pourquoi |
|---|---|---|
| Dépôt dans À classer, contrôle des doublons | déterministe | systématique, sans IA |
| Déclenchement du circuit | déterministe | un workflow système, jamais oublié |
| Extraction du texte | déterministe (puis IA pour la vision) | la lecture IA existe déjà |
| Relecture, correction du texte | jugement | IA |
| Type de pièce, émetteur, personnes, projet, liens | jugement, avec pré-calcul déterministe | l'IA choisit parmi des candidats trouvés par le code |
| Choix du dossier | jugement **borné par des règles** | l'IA ne propose que des dossiers qui existent |
| Seuil de confiance, À contrôler | déterministe | le code tranche, pas l'IA |
| Déplacer, écrire les liens, journaliser | déterministe | le code |

## Le circuit

```
 fichier déposé (glissé, versé, importé, explorateur)
        │
        ▼
 [déterministe] doublon ?  ── oui ──▶ déjà là : fantôme proposé (existe)
        │ non
        ▼
 Bibliothèque/À classer            état : a-classer
        │  workflow système « Circuit des documents » (déclencheur : document versé)
        ▼
 skill Ingestion                   état : ingere      (texte, qualité ★ %)
        │
        ▼
 skill Analyse et liens            état : analyse     (type, émetteur, projet, liens)
        │
        ▼
 skill Rangement                   proposition de dossier + confiance
        │
   confiance ≥ seuil et dossier valide ?
        ├── oui ──▶ [déterministe] rangé, liens écrits     état : range
        └── non ──▶ Bibliothèque/À contrôler                état : a-controler
                        │  l'utilisateur : Accepter · Choisir ailleurs · Laisser
                        ▼
                     rangé (sa décision est journalisée)
```

Chaque étape peut s'arrêter (IA coupée, Obsidian fermé) : l'état sur la fiche dit où reprendre,
et le workflow d'entretien relance ce qui attend.

## Les dossiers

| Dossier | Rôle |
|---|---|
| `Bibliothèque/À classer` | l'entrée unique ; remplace le dossier de dépôt actuel « À verser » (voir question 4) |
| `Bibliothèque/À contrôler` | ce que l'IA n'a pas su ranger avec assez de confiance ; chaque fiche dit pourquoi |
| les bibliothèques et leurs répertoires | la destination : documents, références, documents projet (`Bibliothèque/Projets/<Programme>/<Projet>/…`) |

Les fichiers eux-mêmes ne bougent pas : seules les fiches se déplacent (comme aujourd'hui,
le fichier reste dans `_fichiers`).

## L'état d'une fiche

Dans l'en-tête de la fiche :

```yaml
circuit: a-classer | ingere | analyse | range | a-controler | ecarte
circuit-raison: "Deux projets possibles : Station sol 2027, Antenne Kourou"
circuit-proposition: "Bibliothèque/Projets/Spatial/Station sol 2027/Offre/Technique"
circuit-confiance: 0.55
```

et, dans le corps de la fiche, une section **Circuit** qui garde l'historique lisible :

```
## Circuit
- 2026-11-16 10:42 · Ingestion — texte relu, qualité ★★★★ (86 %)
- 2026-11-16 10:43 · Analyse — CCTP, émetteur CNES, projet Station sol 2027 (0,82)
- 2026-11-16 10:43 · Rangement — Offre › Technique (0,91) : rangé
```

Une fiche sans `circuit` (tous les documents d'avant) n'entre pas dans le circuit : rien ne
change pour l'existant tant que l'utilisateur ne le demande pas.

## L'étape « Exécuter un skill »

Une nouvelle action de workflow, déclarée par le module IA comme `ia.demander` aujourd'hui :
**`ia.executer-skill`**.

**Ses champs** : le skill (de la bibliothèque des skills), le persona (facultatif), le sujet
(le document du déclencheur).

**Ce que le skill reçoit** (le *resolver*) : le skill déclare dans son en-tête le contexte dont
il a besoin ; l'application le rassemble, de façon déterministe, avant l'appel :

```yaml
---
bp-type: bibliotheque-skill
nom: Rangement d'un document
contexte: [fiche, texte, projets, repertoires-attendus, regles-de-rangement]
sortie: rangement
---
```

| Contexte | Ce que c'est |
|---|---|
| `fiche` | les champs de la fiche (titre, type de pièce, émetteur, dates…) |
| `texte` | le texte du document (tronqué au besoin, le début et la table des matières d'abord) |
| `projets` | les programmes et projets en cours, leurs types, leurs phases en cours |
| `repertoires-attendus` | pour chaque projet, ses répertoires et les types de pièce qu'ils attendent |
| `entites` | les entreprises et personnes connues (noms et alias) |
| `candidats-liens` | les documents et notes que le code a trouvés proches (même référence, même émetteur, mêmes mots du titre) |
| `regles-de-rangement` | une note de règles, modifiable par l'utilisateur (`Bibliothèque/Règles de rangement.md`) |

**Ce que le skill rend** : du JSON, d'une forme déclarée (`sortie`), que l'application **valide**
avant d'en faire quoi que ce soit. Toujours avec une **confiance** (0 à 1) et une **raison** en
une phrase. Une réponse illisible, hors forme, ou qui propose un dossier qui n'existe pas
vaut confiance 0 : À contrôler.

**Le seuil** : en dessous du seuil (0,7 par défaut, réglable par skill), la décision n'est pas
appliquée ; elle est proposée dans À contrôler. Le mode du workflow « demander d'abord » reste
possible : tout est alors proposé, rien n'est appliqué seul.

## Les trois skills livrés

Ce sont des skills markdown ordinaires de la bibliothèque, livrés comme les exemples actuels,
**modifiables** par chaque entreprise. Ils sont écrits dans la bibliothèque des skills **dès
l'activation** *(0.136.1)* — le workflow système les nomme — et recréés s'ils manquent (par leur
nom : un skill modifié est gardé tel quel). Leur procédure est en français ; leur sortie, fixée.

### Ingestion

- **Déterministe avant** : l'extraction du texte (lecture des fichiers), la détection d'un
  scan (sans texte : lecture par la vision).
- **IA** : la chaîne de lecture IA actuelle — relecture, correction, contrôles, qualité.
- **Sortie** (`ingestion`) : `{ qualite, langue, confiance, raison }`.
- **Échec** (illisible, IA indisponible) : la fiche reste `a-classer`, l'entretien la relancera.

### Analyse et liens

- **Déterministe avant** : les candidats — entités connues trouvées dans le texte par leur nom
  ou un alias, documents de même référence ou de même émetteur, projets dont le nom apparaît.
- **IA** : choisir parmi les candidats, en ajouter seulement s'ils sont dans le contexte ;
  dire le type de pièce, l'émetteur, les personnes, le projet concerné, et les liens utiles
  avec une phrase d'explication chacun.
- **Sortie** (`analyse`) :

```json
{
  "typePiece": "CCTP",
  "emetteur": "CNES",
  "personnes": ["Marie Durand"],
  "projet": "Programmes/Spatial/Station sol 2027/Station sol 2027.md",
  "liens": [
    { "vers": "Bibliothèque/Références/ECSS-E-ST-10C.md", "pourquoi": "Norme citée au § 4.2" }
  ],
  "confiance": 0.82,
  "raison": "Le titre et l'en-tête citent la Station sol 2027 et le CNES."
}
```

- Une entreprise ou une personne **inconnue** n'est pas créée seule : elle est proposée
  (notabilité de gbrain : dans le doute, ne pas créer).

### Rangement

- **Déterministe avant** : la liste des dossiers possibles ; si un projet est identifié et que
  l'un de ses répertoires attendus attend ce type de pièce, ce répertoire est proposé d'office.
- **IA** : appliquer les règles de rangement (le sujet principal d'abord), choisir **un**
  dossier de la liste.
- **Sortie** (`rangement`) : `{ dossier, confiance, raison, alternatives: [dossier…] }`.
- Les **alternatives** alimentent le bouton « Choisir ailleurs » d'À contrôler.

## Les liens

- **Dans la fiche** : un champ `liens:` (chemins) et une section **Liens** lisible
  (« ECSS-E-ST-10C — norme citée au § 4.2 »).
- **Rétroliens** : dans la note citée (projet, entreprise, personne, autre document), une
  ligne ajoutée à une section **Liens (Black Projects)**, que l'application seule écrit :
  `- 2026-11-16 · [[Bibliothèque/…/CCTP]] — CCTP reçu du CNES`. Le reste de la note n'est
  jamais touché (voir question 3).
- Un lien vers une note qui n'existe pas n'est jamais écrit.

## À contrôler

Une page de la bibliothèque, **À contrôler**, et une tuile avec le nombre en attente.
Pour chaque document : son titre, la proposition de l'IA, sa raison, sa confiance, et :

- **Accepter** : la proposition est appliquée (rangé, liens écrits) ;
- **Choisir ailleurs** : les alternatives de l'IA, puis tous les dossiers ;
- **Laisser** : reste à contrôler ; **Écarter** : la fiche est retirée (`_retirés`).

Chaque décision de l'utilisateur est journalisée sur la fiche. Plus tard, ces décisions
pourront servir d'exemples aux skills (on garde la trace dès maintenant ; on ne s'en sert pas
encore).

## Les workflows système

| Workflow | Déclencheur | Ce qu'il fait |
|---|---|---|
| **Circuit des documents** | un document entre dans À classer (`bibliotheque.document-verse`) | Ingestion → Analyse et liens → Rangement, chacun par `ia.executer-skill` ; le seuil décide |
| **Relancer le circuit** | à l'ouverture, puis chaque jour | les fiches restées `a-classer` ou `ingere` (IA coupée) reprennent là où elles étaient |
| **À contrôler en attente** | chaque lundi | prévient s'il y a des documents à contrôler, avec le lien vers la page |
| **Entretien des liens** (plus tard) | chaque semaine | liens vers des notes disparues, doublons probables, rétroliens manquants : signalés |

Comme les autres workflows système : désactivables, modifiables, rétablissables ; non
supprimables.

**Les essentiels** *(0.136.0)* : d'origine, seuls ces workflows du circuit, ceux qui font
entrer les fichiers dans la bibliothèque (ranger les pièces et fichiers importés, verser
« À classer ») et « Signaler les workflows cassés » sont actifs (`essential: true` ; réglage
« D'origine, seuls les workflows essentiels sont actifs » du module Workflows, oui par défaut).
Les anciennes passes de l'IA sur les documents (relecture, vision, type de pièce, entreprise…)
et les autres automatismes sont désactivés : le circuit les remplace, et on réactive au fur et à
mesure ce qui manque.

## Sans IA, IA indisponible, confidentialité

- **Sans IA configurée** : le circuit s'arrête après le dépôt et l'extraction ; les documents
  restent dans À classer, et l'utilisateur range lui-même (comme aujourd'hui).
- **IA indisponible** pendant le circuit : la fiche garde son état, le workflow de relance
  reprend plus tard ; rien n'est rangé au hasard.
- **Confidentialité** : le circuit envoie le texte des documents à l'IA. Il n'utilise que l'IA
  autorisée pour ce circuit (voir question 5), et le dit dans la description du workflow.
- **Coût** : l'analyse et le rangement reçoivent un texte **tronqué** (début, sommaire) ; un
  modèle léger peut être choisi pour ces deux étapes, le modèle lourd gardé pour la relecture
  (idée du « two-tier » de gbrain).

## Les modules

On respecte les frontières actuelles (un module n'appelle un autre que par son `index.ts`) :

| Module | Ce qu'il apporte |
|---|---|
| **Bibliothèque** | les dossiers À classer et À contrôler, l'état `circuit` des fiches, le rassemblement du contexte (fiche, entités, candidats, répertoires), l'application des décisions (déplacer, liens, rétroliens), la page À contrôler, les trois skills livrés, les workflows système |
| **IA** | l'action `ia.executer-skill` : construire l'appel (skill + persona + contexte), valider la sortie JSON, rendre la décision et sa confiance |
| **Workflows** | rien de neuf dans le moteur ; un champ « seuil » dans l'étape |
| **Programmes** | les projets et leurs répertoires attendus, fournis au contexte : Programmes dépend de la Bibliothèque, pas l'inverse, donc il **s'inscrit** auprès d'elle (comme il le fait déjà pour les appels de documents de référence, `registerReferenceCallers`) |
| **Typage des pièces** | la liste des types de pièce (déjà exposée) |

## Ce qui existe, ce qui est à faire

| Brique | État |
|---|---|
| Dépôt unique, contrôle des doublons par empreinte, fantômes | existe |
| Déclencheur « document versé » | existe |
| Lecture IA (vision et texte), relecture, qualité ★ % | existe |
| Passes IA isolées (titre, date, émetteur, catégorie, étiquettes, identité, langue) | existent (actions `ia.*-document`) |
| Skills en bibliothèque, champs prompt/persona/skill des étapes IA | existent |
| Répertoires attendus d'un projet par type de pièce | existe |
| `ia.executer-skill` (contexte déclaré, sortie JSON validée, confiance, seuil) | **à faire** |
| État `circuit` des fiches, section Circuit | **à faire** |
| À classer (unifié avec « À verser »), À contrôler et sa page | **à faire** |
| Trois skills livrés : Ingestion, Analyse et liens, Rangement | **à faire** |
| Candidats de liens et entités (recherche déterministe) | **à faire** |
| Liens, rétroliens | **à faire** |
| Workflows système du circuit, relance, rappel À contrôler, entretien | **à faire** |

## Le découpage proposé

1. **Version A — l'étape et le contrôle** ✅ *(0.134.0)* : `ia.executer-skill` (contexte, sortie
   validée, confiance, seuil), l'état `circuit`, À contrôler et sa page ; le skill livré « Ranger un
   document » (contextes fiche, texte, dossiers, règles de rangement).
2. **Version B — le circuit** ✅ *(0.135.0)* : À classer comme entrée unique (réglage « Le
   circuit des documents (IA) », désactivé d'origine ; seuls les versements de la bibliothèque
   sans lieu précis y entrent), les trois skills livrés, le workflow système « Circuit des
   documents » (déclaré par le module IA après ses passes sur les documents), la relance à
   l'ouverture, le rappel du lundi, « En cours dans le circuit » et la section Circuit de la fiche.
3. **Version C — les liens** : candidats et entités, liens dans la fiche, rétroliens, entretien.

Chaque version : tests (avec une IA simulée qui rend des réponses sûres, peu sûres,
illisibles), démo, banc Obsidian, docs, comme d'habitude.

## Décisions (validées)

1. **Seuil de confiance** : 0,7 par défaut, réglable par skill. **Décidé : oui.**
2. **Où chercher les liens** : documents de la bibliothèque, programmes et projets,
   entreprises et personnes, exigences ; les notes libres du coffre ? **Décidé : tout sauf les
   notes libres dans un premier temps (trop de bruit), à ajouter ensuite.**
3. **Rétroliens** : écrits automatiquement dans les notes existantes, ou seulement proposés ?
   **Décidé : écrits automatiquement, mais uniquement dans une section réservée, jamais
   ailleurs dans la note.**
4. **Un seul dossier d'entrée** : « À verser » devient « À classer » ? **Décidé : oui, avec
   reprise de ce qui est déjà dans « À verser ».**
5. **IA autorisée pour le circuit** : toute IA configurée, ou une IA choisie (locale, ou celle
   que l'entreprise autorise) ? **Décidé : un réglage « IA du circuit », vide par défaut — le
   circuit ne démarre pas tant qu'il n'est pas choisi** (version B).
