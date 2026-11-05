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

## 3. La liste, les filtres, la fiche

Palette de commandes → **Exigences : liste, filtres et fiches** : toutes les exigences du
dossier, avec une recherche (identifiant, titre, texte) et des filtres par catégorie,
type, statut et criticité. Une ligne choisie propose :

- **Modifier la fiche** — formulation, attributs, responsable, mots-clés, **alias** ;
  changer la formulation crée une **révision** (l'ancienne est gardée dans l'historique),
  et les exigences liées à celle-ci sont marquées « lien à revoir » ;
- **Ouvrir la note** — pour la relire dans le coffre.

Sur la note d'une exigence ouverte, la commande **Modifier l'exigence** ouvre la même fiche.

La liste signale aussi une traduction en retard sur la source, une traduction automatique
à relire, ou un lien à revoir.

## 4. Citer des exigences dans un document

Dans n'importe quelle note, un bloc `pm-req` **cite** des exigences au lieu de les
recopier : il montre toujours leur formulation du moment, et dit si elle a changé.

````
```pm-req
REQ-SYS-0001
REQ-SYS-0002
```
````

Ou par filtre :

````
```pm-req
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
tableau. Un clic sur l'identifiant ouvre la note de l'exigence.

## 5. Les réglages

Paramètres → Black Projects → bouton **Fonctions** de la ligne « Exigences » : le dossier,
le préfixe des identifiants (`REQ`), le nombre de chiffres (4), les langues de rédaction
(`fr, en`).

## 6. Ce qui arrive

Extraction des exigences d'une pièce du dossier et import ReqIF (étape 4), qualité de
rédaction selon l'ISO/IEC/IEEE 29148 (étape 5), traductions assistées par l'IA de Sidonie
(étape 6), matrice de conformité (étape 7). Voir {{link:Accueil|l'accueil}}.
