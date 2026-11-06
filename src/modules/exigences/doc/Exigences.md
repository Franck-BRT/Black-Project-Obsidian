# Exigences

Le module **Exigences** tient la bibliothèque d'exigences du coffre : une note par
exigence, dans le dossier `Exigences` (réglable). C'est le socle sur lequel l'analyse
d'appels d'offres viendra extraire, noter et tracer les exigences d'un dossier de
consultation.

## 1. Créer une exigence

Palette de commandes → **Nouvelle exigence** :

- **Catégorie** — elle forme l'identifiant : `SYS` donne `REQ-SYS-0001`. Les catégories
  déjà employées sont rappelées sous le champ ;
- **Titre**, **Formulation** (dans la langue source, la première des langues réglées),
  **Type**, **Statut**, **Criticité**, **Méthode de vérification**, **Source**,
  **Justification**.

L'identifiant est attribué à la création, puis **ne change plus et n'est jamais
réutilisé** : le numéro suivant part du plus haut qui ait existé dans la catégorie, même
si l'exigence qui le portait a été supprimée. Un document qui citait `REQ-SYS-0042` ne se
retrouve jamais à citer autre chose.

## 2. La note d'une exigence

La note s'appelle `REQ-SYS-0001 Titre.md`. Son en-tête est l'enregistrement (identifiant,
formulation par langue, attributs, liens, historique) ; son corps reprend le titre et
chaque formulation, pour qu'elle se lise même sans Black Projects. Ce que vous écrivez
sous ces sections est gardé à chaque enregistrement.

## 3. La page Exigences, la fiche

L'entrée **Exigences** du menu de gauche, la tuile **Exigences** de l'accueil, le lien
« Toute la bibliothèque » du tableau de bord ou la commande **Exigences : liste, filtres
et fiches** ouvrent la **page de la bibliothèque**, dans l'onglet Black Projects :

- en chiffres : le nombre d'exigences, la note moyenne, les faibles, les traductions à
  revoir ;
- les actions : nouvelle exigence, importer, analyser la qualité ;
- une **carte par exigence**, les plus faibles d'abord : identifiant et titre, catégorie,
  type, statut, criticité, sa formulation, sa note en étoiles, et ce qui reste à revoir
  (traduction absente, en retard ou à relire, lien à revoir). Son titre ouvre la note ;
  **Modifier** ouvre la fiche ; **Relire (IA)** et **Traduire (IA)** quand l'IA est réglée ;
- une **recherche** (identifiant, titre, formulation…, sans tenir compte des accents) et
  des **filtres** : faibles, à revoir, criticité haute, brouillons, approuvées.

La fiche (bouton **Modifier**) propose :

- **Modifier la fiche** — formulation, attributs, responsable, mots-clés, **alias** ;
  changer la formulation crée une **révision** (l'ancienne est gardée dans l'historique),
  et les exigences liées à celle-ci sont marquées « lien à revoir » ;
- l'IA, quand elle est réglée, pour relire ou traduire.

Sur la note d'une exigence ouverte, la commande **Modifier l'exigence** ouvre la même fiche.

Hors de l'onglet Black Projects (une plateforme sans pages), la commande ouvre la liste en
fenêtre, avec ses filtres par catégorie, type, statut et criticité.

## 4. Citer des exigences dans un document

Dans n'importe quelle note, un bloc `brt-req` **cite** des exigences au lieu de les
recopier : il montre toujours leur formulation du moment, et dit si elle a changé.

````
```brt-req
REQ-SYS-0001
REQ-SYS-0002
```
````

Ou par filtre :

````
```brt-req
category: SYS
status: approved
fields: id, title, text, status
```
````

| Clé | Rôle |
| --- | --- |
| *(ligne nue)*, `id:`, `ids:` | les exigences citées, dans cet ordre (identifiants ou alias) |
| `category:`, `type:`, `status:`, `criticality:` | un filtre (valeurs rangées : `functional`, `draft`, `high`…) |
| `tags:` | les mots-clés, tous exigés |
| `search:` | un texte cherché dans l'identifiant, le titre, la formulation |
| `lang:` | la langue à montrer (`en`…) ; à défaut, la langue source |
| `fields:` | les colonnes : `id`, `title`, `text`, `type`, `status`, `criticality`, `verification` |
| `sort:` | `id` (par défaut), `title` ou `status` |

Un identifiant introuvable, une clé inconnue ou un bloc vide sont signalés au-dessus du
tableau. Un clic sur l'identifiant ouvre la note de l'exigence. Un ancien bloc `pm-req`
est dessiné de la même façon.

## 5. Les réglages

Paramètres → Black Projects → bouton **Fonctions** de la ligne « Exigences » : le dossier,
le préfixe des identifiants (`REQ`), le nombre de chiffres (4), les langues de rédaction
(`fr, en`).

## 6. Importer des exigences d'un fichier

Commande **Importer des exigences d'un fichier (Excel, CSV, Word, PDF, ReqIF…)** : un
fichier de l'ordinateur ou du coffre. Les exigences sont reconnues dans les tableaux dont
l'en-tête nomme un identifiant ou une exigence, et dans les paragraphes qui commencent par
un identifiant ; un **ReqIF** (ou ReqIFz) venu de DOORS, Polarion ou Jama est lu avec ses
attributs et ses liens.

Une fenêtre montre ce que l'import ferait (nouvelle, mise à jour, inchangée, refusée) et
où chaque exigence a été trouvée ; on coche, puis **Importer**. Rien n'est écrit avant.

- Un identifiant au format de la bibliothèque (`FOU-ANT-0001`) est gardé ; un autre
  (`SYS-12`) devient un **alias**, et l'exigence reçoit un identifiant — la catégorie
  est demandée quand il en faut une.
- Chaque exigence garde son **origine** : le fichier (un lien s'il est dans le coffre) et
  l'endroit.
- Les colonnes, attributs ou valeurs non reconnus sont dits, jamais perdus en silence.

Dans une analyse d'appel d'offres, la même extraction se fait sur une pièce : voir
{{link:Modules/Analyse d'appels d'offres|Analyse d'appels d'offres}}.

## 7. La qualité des exigences

L'analyse note chaque exigence en **étoiles** (0 à 5), selon les caractéristiques de
l'ISO/IEC/IEEE 29148, et relève ce qui ne va pas — chaque constat vient d'une règle
lisible, sans IA :

| Défaut | Exemple |
| --- | --- |
| aucune obligation | « Le centre sera installé… » (ni « doit », ni « devra », ni « shall ») |
| plusieurs obligations | « doit fournir… et doit maintenir… » : deux exigences sous un identifiant |
| terme vague | « convivial », « rapide », « le cas échéant », « si possible », « environ »… |
| « et/ou » | une alternative qu'on ne sait pas trancher |
| à définir | TBD, TBC, « à définir », « à préciser » |
| tournure passive sans acteur | « Les alarmes doivent être acquittées » : par qui ? |
| comparatif non chiffré | « doit être réduit », « plus rapide » sans valeur |
| trop longue | plus de 50 mots |

Les axes : **unique** (une seule obligation), **non ambiguë**, **vérifiable** (une méthode
de vérification, rien de non chiffré), **attribuable** (un acteur), et, pour la
bibliothèque, **complète** (catégorie, type, statut, criticité, source, justification,
traductions à jour) et **traçable** (liens).

- **Dans la liste**, une colonne **Note** et un filtre (faibles : moins de 3 étoiles) ;
  **dans la fiche**, la note et les défauts en tête ; **dans un bloc `brt-req`**, la
  colonne `rating`.
- Commande **Analyser la qualité de la bibliothèque d'exigences** : la note `Qualité des
  exigences` du dossier des exigences — vue d'ensemble et répartition des notes, moyenne
  par axe, défauts les plus fréquents, **doublons probables** (au moins 60 % de lettres en
  commun), exigences **non vérifiables**, les plus faibles, les **rattachements**
  (satisfaite par rien, sans méthode de vérification, liens à revoir, sans formulation),
  puis chaque exigence. Réécrite à chaque analyse ; la section Notes est gardée.

## 8. Avec l'IA

Quand le module **IA** est réglé (voir {{link:Modules/IA|IA}}) :

- **Relire l'exigence avec l'IA** (note ouverte, ou une ligne de la liste) : un avis, les
  défauts que les règles ne voient pas, et des **reformulations** qui visent les axes
  faibles. La relecture est écrite dans la note (section « Relecture par l'IA », remplacée
  à la relecture suivante). Choisissez une reformulation : elle devient la formulation
  (révision suivante) ; « Ne rien changer » : rien ne bouge.
- **Traduire l'exigence avec l'IA** : dans une autre langue de rédaction ; la traduction
  est marquée « automatique, à relire ». Si un chiffre ou une unité diffère de la source,
  le message le dit.
- **Doublons par le sens** : avec un modèle d'embeddings réglé, l'analyse de qualité
  ajoute les exigences qui disent la même chose en d'autres mots, marquées « par le sens ».

Rien n'est écrit dans une formulation sans votre accord.

## 9. Automatiser

Avec le module {{link:Modules/Workflows|Workflows}} : le déclencheur *Exigences : exigence
créée*, les actions *Analyser la qualité de la bibliothèque* et *Relire l'exigence avec
l'IA* (la relecture est écrite dans la note, la formulation ne change pas), et le modèle
*Chaque lundi : qualité de la bibliothèque d'exigences*.

## 10. Ce qui arrive

Matrice de conformité (étape 7). Voir {{link:Accueil|l'accueil}}.
