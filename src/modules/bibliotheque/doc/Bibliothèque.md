# Bibliothèque de documents

Tout fichier déposé dans Black Projects est rangé dans la **bibliothèque**, une fois, avec
sa **fiche** : une note qui dit ce qu'il est et d'où il vient.

## 1. Ce qui y entre

- les **pièces** importées dans une analyse d'appel d'offres (y compris celles d'une
  archive ZIP, et celles déposées à la main dans ses originaux, à « Mettre à jour
  l'analyse ») ;
- le fichier d'où l'on **importe des exigences** ;
- les **échanges** de types de pièces et de workflows (fichiers JSON) ;
- ce que vous y **versez** vous-même : bouton **Verser des documents**, depuis
  l'ordinateur ou le coffre.

Un fichier venu de l'ordinateur est **copié** dans la bibliothèque (dossier
`_fichiers`) ; un fichier déjà dans le coffre — une pièce d'analyse — **reste où il est**,
la fiche le désigne.

Un **même fichier** (mêmes octets, quel que soit son nom) n'entre qu'une fois, par où qu'il
arrive (glissé, versé, importé dans une analyse, importé comme exigences, le dossier « À
verser ») et où qu'il soit déjà rangé (la bibliothèque principale, les documents de
référence, une bibliothèque ajoutée) : sa fiche note seulement qu'il revient d'ailleurs (ses
origines s'ajoutent). Une fiche sans empreinte (écrite à la main) est reconnue à son fichier.

## 2. La fiche d'un document

- son **titre** (tiré du nom du fichier), sa **famille** (PDF, textes, tableurs,
  présentations, images, messages, notes, autres), son **type de pièce** — reconnu au nom du
  fichier et au début du texte (CCTP, RC, BPU… : la liste du module *Typage des pièces*, vos
  types compris), ou donné par l'analyse —,
  sa référence, son édition, sa révision, sa date, son entreprise, ses étiquettes : **Modifier…**
  pour tout reprendre, ou le **crayon** à gauche d'un champ pour ne modifier que lui (il est
  alors confirmé ; le crayon de *Rangé* ouvre *Déplacer…*, celui de *Langue*, *Langue…*) ;
  le bouton à côté du crayon **relance la recherche** de ce champ dans le document — sans
  IA d'abord, puis avec l'IA si ce n'est pas sûr (son workflow système, pour ce document) ;
  il ne change que ce champ (la révision relancée laisse la référence ; « Référence et
  version » relance les trois) ;
  la date se choisit aussi dans un **calendrier** (le bouton à côté du champ) ;
- **le texte extrait** : comme pour une pièce d'analyse, le texte du fichier est transcrit
  dans la fiche (sa note), après vos notes, entre deux marques — « ## Texte extrait », un
  encadré qui dit la lecture (lu, scan, image, format non lu, illisible), puis le texte ; la
  section « Texte extrait » de la fiche le montre en entier, mis en forme (titres, listes,
  tableaux, citations, formules ; les cases à cocher ☐ ☒ et les symboles, les retours à la
  ligne et les tableaux qu'une lecture écrit en HTML), sur toute la largeur de la page — et, l'IA réglée, **relu par l'IA** : une nouvelle version du texte
  (sa **qualité**, vérifiée par l'IA, en étoiles et en pourcentage : « ★★★★☆ 88 % » ;
  *Versions* › « Versions du texte » : **Comparer**, **Le montrer sur la fiche**, **Supprimer
  cette version** — sa note va à la corbeille ; l'extraite
  est gardée, l'édition et la révision ne changent pas) ; des notices disent la relecture en
  cours, puis ce qu'elle a donné ; la section *Texte extrait*, ouverte, dit où elle en est (étape,
  page, pourcentage) et montre le texte lu jusqu'ici, provisoire. **Extraire de nouveau** relit le fichier (vos notes ne bougent
  pas), puis l'IA relit ce texte ; **Relire avec l'IA** relance la relecture seule — avec un
  **modèle simple** (le texte) ou un **modèle avec la vision** (les pages d'un PDF ou une image
  regardées, comparées au texte) ; un document **sans texte** (un scan, une image) est lu avec la
  vision dès son dépôt (sinon, **Lire avec la vision (IA)**) ; les formules mathématiques s'affichent mises en forme ;
  pendant que l'IA lit un document, ses boutons sont grisés et la fiche dit où elle en est
  (« page 2 sur 35 ») ; sur un autre document, **Ajouter à la file d'attente** ;
- **le fichier** : où il est, s'il a été copié ou laissé à sa place, son empreinte ; le
  crayon devant *Fichier* le **renomme** (dans son dossier, son extension gardée) — les liens
  vers lui, dans tout le coffre (la note de sa pièce, celle de l'analyse…), sont mis à jour ;
- **d'où il vient** : chaque origine — l'analyse, l'import —, un clic y mène ;
- **ses versions** : les précédentes et les suivantes, reliées.

Ces cinq parties sont **repliées** d'origine : leur en-tête en dit l'essentiel (le
type de pièce et la version, le nom du fichier, d'où il vient, combien d'autres versions) ; un
clic les déplie. Ce que vous dépliez le reste, le temps de la session.

## 3. Les versions

Un document dont le nom ne diffère d'un autre que par une marque de version (« ind B »,
« rev 2 », « v3 », « ed 1 ») et dont le contenu est autre est une **nouvelle version
probable** : sa fiche le dit, avec **Relier comme nouvelle version** ou **Ce n'en est pas
une**. **Nouvelle version de…** relie à la main. Un document remplacé le dit, et mène au
plus récent ; le filtre **Dernières versions** les cache.

## 4. La page Bibliothèque

**Le parcours du document**, sur chaque fiche, dès sa création : une ligne par étape, en couleur —
**vert** fait, **bleu** en cours (l'icône tourne), **orange** en attente ou à confirmer, **rouge** en
échec, **gris** à venir ou sans objet. Le contrôle des doublons (et ses fantômes, un bouton mène à chacun), la mise dans « À
classer », l'ingestion, la **recherche dans le glossaire**, l'analyse et chacun de ses champs (type de pièce, entreprise, titre, date,
langue, référence, étiquettes, projet), l'analyse des liens, leur création, le rangement. Là où le
circuit s'est arrêté : **Continuer le circuit**.

Chaque étape a son bouton **⟳ Relancer** (devant sa ligne) : il ne refait **que cette étape** — les
doublons revérifiés, remis dans « À classer », l'ingestion (le texte relu de nouveau par l'IA), les
termes du glossaire cherchés de nouveau (sans IA, toujours possible),
l'analyse (qui donne aussi le projet et les liens), un champ cherché de nouveau, les liens réécrits,
le rangement redemandé. Sous la liste, **Relancer tout le circuit** (après une question) le reprend
depuis le début. Sans IA, ou le circuit coupé, les boutons des étapes du circuit sont grisés.

**Le document en cours de traitement** : celui que le circuit traite en ce moment est signalé
clairement — en tête de sa fiche, un bandeau bleu « En cours de traitement dans le circuit : Analyse —
L'IA l'analyse… » ; dans son parcours, l'étape en cours en bleu ; dans les listes (la bibliothèque
« Circuit », À classer…), la pastille **En cours de traitement** et une icône qui tourne. Pour lui,
à la place de « Continuer le circuit » : **Arrêter le circuit**. Il s'arrête avant l'étape suivante ;
ce que l'étape en cours trouve (la réponse de l'IA) n'est pas appliqué. Le document reste où il en
était, marqué « Arrêté à votre demande » : la relance à l'ouverture d'Obsidian le laisse, et
**Continuer le circuit** le reprend quand vous voulez. Pendant le traitement, les boutons ⟳ et
« Relancer tout le circuit » attendent.

**La fiche d'un document** : sous son titre, une ligne dit ce qu'il est (famille, type de pièce,
version, taille, date d'ajout). Ce qui reste à confirmer est en tête, **une ligne chacun** — le nom,
la raison, les boutons (« Confirmer : Français », « Pas de date », « Modifier… »). **Identification**
est dépliée : chaque champ sur une ligne, ses boutons (modifier, relancer la recherche) au bout.

**Les lignes de la liste** (en explorateur) : le nom du document, puis à droite son type de pièce, sa
date d'ajout et sa taille ; une pastille seulement s'il y a quelque chose à faire (« À confirmer (n) »,
une version à relier, un fichier introuvable). Un clic sur la ligne ouvre la fiche. La recherche
trouve aussi le nom du fichier et son origine.

**Le menu « … »**, à côté de « Verser des documents » : les actions moins courantes — nouveau
répertoire, nouvelle bibliothèque, exporter, importer, retirer… Sur la fiche d'un document, « Ouvrir
le fichier », « Modifier… » et « Déplacer… » restent visibles ; Langue…, Nouvelle version de…, Ranger
dans les références, Ouvrir sa note, Retirer et Supprimer sont dans « … ».

**En explorateur de fichiers** (d'origine) : une colonne à gauche montre toutes les bibliothèques —
l'accueil, puis les groupes (documents, système IA, système, annuaire), chacune avec ses
répertoires et combien chacun contient. Un clic ouvre un lieu, le chevron le déplie ou le replie
(c'est retenu) ; le lieu montré est marqué, le chemin qui y mène déplié. Les documents sont en
**liste** (les vues **Cartes** et **Tableau** restent au choix), sans les chiffres en tête : la
colonne les dit. Des fichiers lâchés sur un répertoire de la colonne y sont versés. La fiche d'un
document, les prompts, les personas… gardent la colonne. Pour revenir à l'affichage en cartes :
Paramètres › Bibliothèque › **Les bibliothèques en explorateur de fichiers**, désactivé.

L'**accueil de la bibliothèque** range ses bibliothèques **par groupe**, chacun une section
qu'un clic déplie ou replie (l'état est gardé d'une ouverture à l'autre) :

| Groupe | Ses bibliothèques |
| --- | --- |
| **Bibliothèques de documents** | les documents, les documents de référence, les documents projet, les vôtres |
| **Bibliothèques système IA** | les prompts, les personas, les skills |
| **Bibliothèques système** | les étiquettes, le glossaire, et les **types de document** (un accès rapide à leur page : les voir, en ajouter, les modifier) |
| **Annuaire** | les entreprises, les personnes |

Les groupes des documents et de l'annuaire ont leurs boutons **Nouvelle bibliothèque de…** (la
bibliothèque créée s'ouvre aussitôt) ; les prompts, personas, skills et étiquettes ont chacun
une seule bibliothèque, où l'on ajoute ses entrées.

**Se passer une bibliothèque** : sur la page d'une bibliothèque (ou de l'un de ses
répertoires), **Exporter** écrit une archive ZIP — une fenêtre **« Où enregistrer l'export ? »** propose le dossier et le nom du fichier, ceux d'habitude : changez-les ou validez tels quels (un fichier déjà là n'est jamais écrasé : « (2) » est ajouté), d'office `Échanges/Bibliothèques` — ses notes, ou
ses documents avec leur fiche. Passez ce fichier ; chez l'autre, **Importer…**, sur la page de
la même sorte de bibliothèque, le reprend (de l'ordinateur ou du coffre) : une note déjà là à
l'identique n'est pas réécrite (différente, la nouvelle est gardée à côté) ; un document déjà
dans la bibliothèque n'est pas copié une seconde fois, un nouveau garde ce que disait sa fiche
(titre, type, référence, édition…).

**Toute la bibliothèque d'un coup** : sur l'accueil de la bibliothèque, **Tout exporter** met
chaque bibliothèque de chaque sorte (documents, références, documents projet, les vôtres ;
prompts, personas, skills ; étiquettes ; entreprises, personnes) dans une seule archive ;
**Tout importer…** la reprend : chaque partie dans la bibliothèque du même nom (une bibliothèque
de documents ou de l'annuaire qui manque est créée), sans rien en double. Les **documents projet** sont une bibliothèque à part, toujours là (dossier
`Bibliothèque/Projets`, réglable), un répertoire par programme puis par projet, créés tout seuls ;
la page d'un programme ou d'un projet montre ses documents et les reçoit glissés-déposés.
**Déplacer vers une bibliothèque…**, sur la fiche d'un document, propose toutes les
bibliothèques de documents — celles que vous avez créées comprises — et leurs répertoires.

Menu **Bibliothèque** (ou sa tuile, ou le tableau de bord) : les chiffres (documents,
taille, ajoutés cette semaine, versions à relier), une carte par document, le plus récent
d'abord ; une recherche (titre, fichier, type de pièce, référence, origine) et des filtres :
par famille, par origine, dernières versions, versions à relier, fichiers introuvables.

**Retirer de la bibliothèque** met la fiche de côté (dossier `_retirés`), avec le fichier
s'il avait été copié ; rien n'est effacé, et une pièce d'analyse n'est pas touchée.

**Supprimer** (sur la fiche, ou sur la carte d'un document) l'efface vraiment : après une
question, sa fiche et son fichier (s'il a été copié dans la bibliothèque) partent à la corbeille
du coffre, avec ses fantômes et les versions de son texte. La question dit s'il sert ailleurs (une
analyse d'appel d'offres, un projet qui l'appelle) : eux ne le trouveront plus. Un fichier resté
à sa place (une pièce d'analyse) n'est pas touché.

**Affichage et regroupement** : sur la page des documents, en **cartes**, en **liste**
ou en **tableau** (taille, date d'ajout, version), regroupés par **origine** (l'analyse,
l'import), **famille**, **type de pièce** ou **mois d'ajout** — chaque groupe est une section
qu'un clic replie. Les prompts et les personas se regroupent par catégorie ou par
favoris, en cartes ou en liste.

## 5. Automatiser

Ce que la bibliothèque fait d'elle-même est écrit en **workflows système** : page
**Workflows**, filtre *Système*. Vous pouvez les modifier, les désactiver, et revenir à
l'original (« Rétablir l'original ») ; pas les supprimer. D'origine, seuls les **essentiels**
sont actifs (réglage du module {{link:Modules/Workflows|Workflows}}) : ceux marqués « essentiel »
ci-dessous ; les autres sont désactivés tant que vous ne les activez pas.

| Workflow système | Quand | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Ranger les fichiers et pièces importés dans la bibliothèque | des pièces importées dans une analyse, un import d'exigences, de types de pièces ou de workflows | les range dans la bibliothèque | activé (essentiel) |
| Repérer les nouvelles versions probables | des documents entrent dans la bibliothèque | marque la version précédente probable, à confirmer sur la fiche | activé |
| Rappels de la bibliothèque, chaque lundi | le lundi à 8 h | une étape par rappel : documents **à contrôler**, **versions** et **langues à confirmer**, documents **sans type de pièce**, fichiers **introuvables** (plus dans le coffre), et l'**entretien des liens** — chacune muette s'il n'y a rien à dire ; retirez une étape pour ne plus avoir ce rappel | activé (essentiel) |

**Le dossier de dépôt** : posez des fichiers dans le dossier `À classer` de la bibliothèque « Circuit » (par défaut `Bibliothèque/Circuit/À classer`)
— par l'explorateur de fichiers, une synchronisation —, ils entrent dans la bibliothèque à
l'ouverture d'Obsidian et chaque jour à 8 h, rangés dans `_fichiers` ; un fichier déjà
dans la bibliothèque est mis de côté dans `_retirés`. Les **versions à confirmer**, les
**langues à confirmer** et les **documents sans type de pièce** sont rappelés le lundi, par les
**Rappels de la bibliothèque** (ci-dessus).

| Workflow système | Quand | D'origine |
| --- | --- | --- |
| Verser le dossier « À classer », à l'ouverture et chaque jour | à l'ouverture d'Obsidian, et chaque jour à 8 h | activé (essentiel) |
| Proposer un fantôme d'un document déjà dans la bibliothèque | vous déposez un document déjà là, rangé ailleurs | activé |

Le désactiver, c'est ne plus ranger ce que les modules déposent (pour écarter les seules pièces
d'analyse : ajoutez-lui la condition *origine n'est pas ao*) ; ce que vous versez
vous-même (« Verser des documents ») y entre toujours.

Les déclencheurs, pour vos propres workflows :

- **Fichiers déposés dans l'application** : un module reçoit des fichiers, avant qu'ils
  n'entrent dans la bibliothèque (module d'origine — `ao`, `exigences`, `typage-pieces`,
  `workflows` —, ce qu'il en dit, les fichiers, combien, leurs **extensions** et les
  fichiers **non lisibles** par l'application) ;
- **Bibliothèque : documents versés** : une fois par versement (combien, les titres) ;
- **Bibliothèque : document versé** : un par document (titre, famille, type de pièce
  — `{categorie}` —, fichier, module d'origine, son **extension** — `pdf` —, **lisible** — `oui` ou `non` — et
  comment l'application le lit — « texte lu », « image : montrée, son texte n'est pas lu »,
  « format non lu »…). Par exemple : Si *Lisible par l'application* est `non`, Prévenir
  « {fichier} (.{extension}) n'est pas lu : {lecture} ».

Voir {{link:Modules/Workflows|Workflows}}.

## 6. Les prompts, les personas et les skills

La bibliothèque en tient quatre : vos **documents**, vos **prompts**, vos **personas** et vos
**skills** — séparées, chacune sa page, depuis le menu **Bibliothèque**.

- Un **prompt** : une question ou une consigne pour l'IA, écrite une fois (« Quelles
  pénalités le dossier prévoit-il ? »). « Interroger le dossier » d'une analyse vous le
  propose avant d'écrire la question ; vous pouvez la reprendre avant de l'envoyer.
- Un **persona** : le rôle dans lequel l'IA répond — un juriste des marchés publics, un
  contrôleur technique, un responsable qualité. Vous le choisissez pour interroger le
  dossier et pour relire une exigence (ou toutes celles du dossier) ; la note de la
  réponse dit en tant que qui l'IA a répondu.
- Un **skill** : un savoir-faire donné à l'IA — une méthode, des points à vérifier, la forme
  de la réponse (« Lire un CCTP », « Répondre en tableau »).
- Dans les **workflows** : toute étape qui demande l'IA a trois champs, **Prompt**,
  **Persona** et **Skill**, à choisir dans ces bibliothèques ; l'IA reçoit le rôle, la
  méthode et la consigne avec la demande de l'étape.

Chaque entrée est une note (dans `Bibliothèque/Prompts`, `Bibliothèque/Personas`,
`Bibliothèque/Skills`) : **Nouveau prompt**, **Nouveau persona**, **Nouveau skill**, ou
**Ajouter les exemples** — prêts pour les appels d'offres, à modifier. Leur texte s'écrit en
Markdown (titres, listes, **gras**) : la fiche le montre mis en forme. Sur la fiche : **Modifier**,
**Mettre en favori** (les favoris viennent en tête des listes), **Retirer** (mis de côté,
rien n'est effacé), **Supprimer** (aussi sur sa carte : après une question, sa note part à la
corbeille du coffre ; les étapes de workflow qui l'utilisent par son nom ne le trouvent plus).

**Sa fiche** : ses chiffres en tête (les workflows qui s'en servent, son nombre de mots ; un skill
exécutable, son seuil) ; sa description (« En bref ») ; son **texte**, mis en forme ; un skill
exécutable, ce qu'il reçoit, ce qu'il rend et son seuil, en lignes ; l'entrée en lignes (nom,
catégorie, description, rangé), chacune avec son bouton ; **Workflows qui s'en servent** — ceux dont
une étape le nomme (champ « Prompt », « Persona » ou « Skill »), avec le numéro de l'étape, actif ou
non ; un clic ouvre le workflow.

**Un skill exécutable** (le circuit des documents) : dans sa fenêtre, cochez ce qu'il **reçoit**
avec un document (sa fiche, son texte, les types de pièce, les entreprises connues, les dossiers où
ranger, les règles de rangement ; avec le module Programmes, les projets en cours et leurs
répertoires attendus), ce qu'il **rend** (une réponse libre, l'**ingestion**, une **analyse** ou une
**décision de rangement**) et son **seuil de confiance** (70 % par défaut). Sa fiche le dit
(« Exécutable »). Les skills livrés **Ingérer**, **Analyser** et **Ranger un document** en sont. L'étape de workflow **Exécuter un skill** (module
IA) le lance sur un document : l'IA décide, l'application exécute.

### Le circuit des documents

Dans les **Paramètres** du module, **Le circuit des documents (IA)** : activé d'origine, il ne
prend les documents que si une IA est réglée (page {{link:Modules/IA|IA}}) — sans IA, ils sont versés
directement. Désactivez-le pour ne pas envoyer le texte des documents à l'IA. Activé, chaque document que vous versez **sans lieu précis** (ou à la racine de la bibliothèque) — par
**Verser**, en le glissant sur la page, ou en le posant dans `Bibliothèque/Circuit/À classer` — entre dans
**À classer** ; puis le workflow système **Circuit des documents** (module IA) enchaîne trois skills
livrés, à modifier à votre goût — ils sont dans **Bibliothèque › Skills** dès le départ (recréés
s'ils manquent, puisque le workflow les appelle par leur nom) —, avec entre l'ingestion et l'analyse
une recherche sans IA :

1. **Ingérer un document** : son texte relu par l'IA (s'il ne l'a pas déjà été à l'entrée) ;
2. **Rechercher dans le glossaire** (sans IA) : les termes du glossaire que le document emploie
   (le terme, son sigle ou une autre forme) sont reliés à sa fiche (section Liens), avec un rétrolien
   dans la note du terme ; l'analyse reçoit leur définition (le contexte « Les termes du glossaire
   qu'il emploie », à cocher dans un skill à vous) ;
3. **Analyser un document** : son type de pièce, son entreprise (donnés s'ils manquaient ou étaient
   à confirmer, et si l'IA est assez sûre), le **projet** qu'il concerne ;
4. **Ranger un document** : son dossier — le répertoire du projet reconnu qui attend ce type de
   pièce est proposé d'office ; sinon les règles de rangement, sinon le sujet principal.

Assez sûr : rangé. Sinon : **À contrôler** (ci-dessous). Ce qui est versé dans un répertoire choisi,
et les pièces des autres modules (analyses d'appel d'offres, imports d'exigences), n'y entrent
pas. Le texte des documents est envoyé à l'IA réglée dans le module IA. Arrêté en route (l'IA
coupée, Obsidian fermé), un document reprend **à l'ouverture** (workflow **Relancer le circuit des
documents**) ; en attendant, la page **À contrôler** le montre dans **En cours dans le circuit**,
avec **Ranger moi-même…**. Chaque lundi, un rappel dit s'il reste des documents à contrôler. La
fiche d'un document du circuit montre, dans **Le parcours du document**, où il en est (ses étapes)
et, dessous, l'**historique du circuit** : ce qui a été fait, décision par décision.

L'ancien dossier `À verser` est repris : il devient `À classer`.

**La bibliothèque « Circuit »** : sur l'accueil de la bibliothèque, sa carte compte les documents
dans le circuit ; sa page a deux répertoires, **À classer** (déposés, en attente) et **À contrôler**
(ce que l'IA n'a pas su ranger) — dossier `Bibliothèque/Circuit`. On y verse comme ailleurs, mais on
n'y crée rien et on n'y range rien : « Déplacer… » et le rangement par l'IA ne la proposent jamais.
Un document écarté part dans les retirés de la bibliothèque principale (`Bibliothèque/_retirés`).
Les anciens dossiers `Bibliothèque/À classer` et `Bibliothèque/À contrôler` sont repris à l'ouverture :
leurs documents passent dans `Bibliothèque/Circuit`, leurs liens suivent.

### Les liens

À l'**analyse**, le circuit cherche d'abord, **sans IA**, les entités connues que le document cite :
les **entreprises** (leur code, leur nom, leurs autres noms), les **personnes**, les **projets**, les
**autres documents** (par leur référence, « ECSS-E-ST-10C »). L'IA choisit parmi elles celles qui
comptent — elle n'en invente pas — et dit pourquoi. Si elle est assez sûre :

- la fiche du document a une section **Liens** (chaque note citée, et pourquoi), et sur sa page la
  section **Liens**, d'où on les ouvre ;
- chaque note citée (l'entreprise, la personne, le projet, l'autre document) reçoit une ligne dans
  sa section **Liens (Black Projects)** : le document qui la cite, et pourquoi. Black Projects
  n'écrit que dans cette section ; le reste de la note n'est jamais touché ;
- entre deux documents, l'IA dit aussi la **relation** quand le texte la dit clairement : ce
  document **a pour source** l'autre (il y répond, le reprend, le traduit, en est tiré) ou en
  **est la source** (l'autre en découle). Elle s'écrit dans l'en-tête de la fiche (`a-pour-source`,
  `est-la-source-de`) et l'inverse sur l'autre document ; sur la fiche, elle se lit au bout du lien.

**À la main** : sur la fiche d'un document, « … » › **Lier un document…** — choisir l'autre
document, puis « … est la source de … », « … a pour source … » ou un simple lien ; sur un lien vers
un document, **Relation…** la change (l'inverse suit sur l'autre document). Déplacé, un document
reste lié : les documents qui le citent suivent.

Quand le document est rangé ailleurs, ses rétroliens le suivent ; supprimé, ils partent. Chaque
lundi, l'**entretien des liens** (une étape des rappels de la bibliothèque) retire les liens vers
des notes disparues et rétablit les rétroliens effacés à la main.

**Une entreprise ou une personne inconnue** que le document cite clairement (son émetteur, son
client, un signataire, un contact) n'est **jamais créée seule** : l'IA la **propose**. La fiche du
document le dit (« L'IA propose de créer : Entreprise « ESA » — … »), et la page **À contrôler** les
rassemble dans **Entreprises et personnes à créer**. **Créer** fait sa note (dans Entreprises ou
Personnes, avec son code ou son entreprise) et la lie au document ; **Écarter** ôte la proposition.
Le rappel du lundi les compte avec les documents à contrôler.

Pour un document du circuit, les workflows « Relire avec l'IA le texte… » (la vision pour un scan),
« Identifier avec l'IA le type de pièce… » et « … l'entreprise qui émet… » ne passent pas : ses
étapes **Ingérer** et **Analyser** s'en chargent (une seule relecture, une seule analyse). Les
autres (langue, titre, date, référence, étiquettes) passent comme pour tout document.

### À contrôler

Quand l'IA n'est **pas assez sûre** (confiance sous le seuil), qu'elle propose un dossier qui
n'existe pas, ou que sa réponse est illisible, le document n'est pas rangé au hasard : il va
dans `Bibliothèque/Circuit/À contrôler`, avec la **proposition** de l'IA, sa **raison** et sa
**confiance**. L'entrée de la bibliothèque et le Circuit le signalent (« 1 document(s) à
contrôler », **Contrôler**) — une autre bibliothèque n'annonce que les siens ;
la page **À contrôler** les montre, et sa fiche aussi. Pour chacun :

- **Accepter** : il est rangé dans le dossier proposé ;
- **Choisir ailleurs…** : les autres propositions de l'IA d'abord, puis tous les dossiers ;
- **Écarter** : mis de côté dans les retirés (rien n'est effacé) ;
- **Continuer le circuit** : redemander le rangement à l'IA — après avoir complété la fiche
  (**Modifier…** : type de pièce, entreprise…), par exemple ;
- ou le laisser là, pour plus tard.

**Les étapes du circuit**, en couleur : pour chaque document encore dans **À classer** ou **À
contrôler** — sur sa fiche, sur la page de la bibliothèque **Circuit** (« Les étapes du circuit,
document par document ») et dans **En cours dans le circuit** —, ses quatre étapes : **Versé**,
**Ingérer**, **Analyser**, **Ranger**. **Vert** : faite ; **orange** : en attente, ou à votre
décision (la proposition de l'IA est dite) ; **rouge** : en échec (l'IA injoignable, une erreur du
serveur : l'erreur est dite), ou à contrôler sans proposition ; **gris** : à venir. Le bouton
**Continuer le circuit** reprend là où il s'est arrêté (les étapes faites ne sont pas refaites) ;
**Tout continuer** le fait pour tous ceux qui attendent (pas ceux à contrôler). Grisé, il dit
pourquoi : pas d'IA réglée, ou le circuit désactivé.

**Ranger** : un document resté dans « À classer » dont **tout est confirmé** (plus rien « à
confirmer » sur sa fiche) a un bouton **Ranger** — sur sa fiche (« Tout est confirmé : il attend
d'être rangé. ») et à côté de son parcours. Il propose : **Choisir l'emplacement…** (une
bibliothèque ou un répertoire), **Laisser l'IA regarder de nouveau** (l'étape de rangement
relancée : rangé si elle est sûre, sinon à contrôler ; absent sans IA) ou **Dans « Documents »**
(la bibliothèque par défaut, à sa racine). Plus besoin de le déplacer à la main.
Chaque ligne « À confirmer » se valide telle quelle — « Pas de date », « Pas d'entreprise »,
« Pas de référence »… ; « Modifier… » depuis une ligne la valide aussi à l'enregistrement.

Chaque décision s'écrit sur la fiche, dans l'**historique du circuit** (« rangé dans Normes
(confiance 93 %) », « Contrôlé — proposition acceptée »). Une note `Bibliothèque/Règles de
rangement.md`, si vous l'écrivez, est lue par le skill de rangement (« les normes vont dans
Normes »…). `À contrôler` n'est pas un répertoire où l'on range : il n'a pas de carte, et
n'est pas proposé comme destination.

## 7. La langue des documents

À son entrée, la langue d'un document est **détectée** d'après son texte (français,
anglais, allemand, espagnol, italien, portugais, néerlandais). Si la détection est sûre,
elle est donnée — un badge *Français* sur sa carte. Sinon — texte trop court, document
bilingue, fichier dont le texte n'est pas lu —, il n'y a **pas de langue** : elle est **à
confirmer** (badge orange). Sur sa fiche, **Confirmer : …** donne d'un clic la langue la
plus probable ; **Langue…** en choisit une, la détecte de nouveau, ou dit « sans langue ».
« Modifier… » permet aussi de la choisir. Filtres par langue, et « Regrouper par ›
Langue ». Une image n'a pas de langue à confirmer.

Quand la détection sans IA n'est pas sûre et que l'{{link:Modules/IA|IA}} est réglée, une
**étape avec l'IA** l'identifie (workflow système « Identifier avec l'IA la langue d'un
document… ») : une réponse nette donne la langue, notée « identifiée par l'IA » ; sinon elle
reste à confirmer.

**Le titre** est lu à l'entrée lui aussi : dit par le document (« Titre : … », « Objet :
… », un titre de note « # … »), il remplace celui tiré du nom du fichier. Sinon il reste
celui du nom du fichier, **à confirmer** : la fiche propose le titre lu au début du
document (**Prendre « … »**), **Garder le titre actuel**, ou **Modifier…** ; l'IA, si elle
est réglée, le cherche d'abord. Filtre *Titre à confirmer*.

**Le type de pièce** aussi (l'ancienne « catégorie ») — dans la liste du module *Typage des
pièces*, vos types compris : donné par l'analyse (le type d'une pièce), dit par le document
(« Type de document : »), ou le nom du fichier et le texte d'accord : il est sûr. Sinon
celui du nom du fichier reste, **à confirmer** : la fiche propose celui que le texte suggère
(**Prendre « CCTP »**), **Garder le type actuel**, ou **Modifier…** ; l'IA, si elle
est réglée, choisit d'abord dans la liste des types. Le crayon du champ ouvre la liste. Un
type **hors de la liste** (une ancienne catégorie) est dit tel ; le bouton **+** de sa ligne
l'ajoute aux types de pièce du module *Typage des pièces* (un code proposé) : il devient le
type du document, et des autres documents qui l'avaient. Dans la fenêtre **Modifier…** (et celle
du seul type), à côté de la liste des types : **Nouveau type…** — sa fenêtre s'ouvre par-dessus (un
code, un libellé), le type est ajouté au module *Typage des pièces* et aussitôt choisi. Plusieurs
choses à confirmer : un seul encadré « À confirmer (n) » les rassemble sur la fiche.

**La liste des étiquettes** (Bibliothèque › **Étiquettes**) : un vocabulaire commun — une
note par étiquette, son nom (« antenne ») et ses autres formes, une par ligne (« antennes »).
Les étiquettes d'un document y sont ramenées (« antennes » → « antenne »), y sont reconnues
dans le texte, **se cochent** (le crayon du champ ; « ＋ Autre(s) étiquette(s)… » pour en
écrire, ajoutées à la liste) ; celles **hors de la liste** sont dites, et le bouton **+** les
y ajoute.

**La fiche d'une étiquette** : ses chiffres en tête (documents étiquetés, documents où elle est
suggérée) ; **L'étiquette** en lignes — nom, autres formes, catégorie, description, rangée —, chacune
avec son bouton ; **Documents qui la portent** ; **Suggérée sur** — les documents dont les étiquettes
sont à confirmer et qui la suggèrent (elle ou une autre forme) : **Ajouter** la leur donne (**Ajouter à
tous** s'ils sont plusieurs), leurs autres suggestions restant à confirmer ; **Dans la même
catégorie** — les autres étiquettes, un clic ouvre la leur.

**Ne confirmer que ce qu'on change** : dans **Modifier…**, seuls les champs que vous changez sont
confirmés — ceux que vous laissez tels quels, s'ils étaient à confirmer, le restent. Dans **À
confirmer (n)**, le **Modifier…** d'une ligne n'ouvre que ce champ.

**Les étiquettes** aussi : dites par le document (« Mots-clés : », « Étiquettes : »), elles
sont données. Sinon elles sont **à confirmer** : la fiche propose les mots qui reviennent le
plus au début du texte (**Prendre ces étiquettes**), **Pas d'étiquettes**, ou **Modifier…** ;
l'IA, si elle est réglée, en donne d'abord de 3 à 6, en reprenant celles déjà employées dans
la bibliothèque. Filtre *Étiquettes à confirmer*.

**La date du document** aussi (celle de son édition, de sa publication ou de sa signature) :
dite par le document (« Date : », « Émis le », « Toulouse, le 1er mars 2026 »), ou le nom du
fichier et le texte d'accord, elle est donnée. Sinon elle est **à confirmer** : la fiche
propose la première date du texte — jamais une date limite ou une échéance — (**Prendre
« 12 février 2026 »**), **Pas de date**, ou **Modifier…**, où on l'écrit comme on veut
(« 12/02/2026 », « 12 février 2026 ») ; l'IA, si elle est réglée, la cherche d'abord.
Filtre *Date à confirmer*.

**La liste des entreprises** (Bibliothèque › **Entreprises**) — celles qui émettent les
documents : comme les types de pièce, un **code** (« ESA ») et un **nom** (« Agence spatiale
européenne ») — et, s'il le faut, les autres noms sous lesquels elle signe, un par ligne
(« European Space Agency »). Une note par entreprise, dans le dossier
`Bibliothèque/Entreprises` (un coffre qui avait encore `Bibliothèque/Émetteurs` le voit renommé
à l'ouverture, ses notes avec). L'entreprise
d'un document y est **reconnue** (son nom, un autre nom, ou son code en tête du document),
**s'y choisit** (le crayon du champ, *Modifier…* : une liste, et « ＋ Ajouter une entreprise à
la liste… », son nom proposé ; ou, à côté de la liste, **Nouvelle entreprise…** : sa fenêtre
s'ouvre par-dessus, l'entreprise créée est aussitôt choisie — dans la fenêtre d'une personne aussi)
et se lit « ESA — Agence spatiale européenne ». Une entreprise
**hors de la liste** est dite telle sur la fiche ; le bouton **+** de sa ligne l'y ajoute (son
nom et un code proposés — « TAS » pour Thales Alenia Space) : elle devient l'entreprise du
document, et des autres documents qui portaient ce nom.

**La fiche d'une entreprise** : ses chiffres en tête (documents émis, documents qui la citent,
personnes) ; **L'entreprise** en lignes — code, nom, rôle, catégorie, autres noms, où elle est
rangée —, chacune avec son bouton (modifier, déplacer) ; **Documents qu'elle émet** (ceux dont elle
est l'entreprise ; « Entreprise à confirmer » en orange quand elle n'est pas sûre) ; **Documents qui la
citent** (reliés à sa note par le circuit sans être émis par elle) ; **Ses personnes**. Un clic ouvre
chaque document ou personne. Les lignes que Black Projects écrit en bas de sa note (« Liens (Black
Projects) », ses rétroliens) ne sont pas de ses autres noms : sa fenêtre ne les montre pas, et elles
sont gardées quand vous la modifiez.

**Le répertoire des personnes** (Bibliothèque › **Personnes**) : les personnes avec qui vous
travaillez, une note par personne (dans `Bibliothèque/Personnes`). **Nouvelle personne** : son
nom et prénom, son **entreprise** (choisie dans la liste des entreprises — ou « ＋ Ajouter une
entreprise à la liste… », sa fenêtre s'ouvre), sa **fonction**, son **adresse électronique**
(vérifiée), son **téléphone**, une catégorie (client, fournisseur, interne…), des notes ;
favorite ou non. Sa carte dit sa fonction, son entreprise et ses coordonnées ; la recherche la
trouve par chacun. **Sa fiche** : ses chiffres en tête (documents qui la citent, collègues) ; **La
personne** en lignes — nom, fonction, entreprise (un clic l'ouvre), adresse, téléphone, catégorie,
rangée —, chacune avec son bouton ; **Documents qui la citent** — reliés (lien et rétrolien) en vert,
puis ceux qui la nomment sans y être reliés, avec **Relier** (ou **Tout relier**) ; **Ses collègues**
(la même entreprise) ; ses **Notes**. La fiche d'une entreprise montre **ses personnes**. Comme les autres listes : des répertoires, d'autres
bibliothèques, **Déplacer…**, **Retirer**, **Supprimer**.

**L'entreprise** aussi : dite par le document (« Émetteur : », « Émis par », « Pouvoir
adjudicateur : »…), elle est donnée. Sinon elle est **à confirmer** : la fiche propose
l'organisme lu au début du document (**Prendre « … »**), **Pas d'entreprise**, ou
**Modifier…** ; l'IA, si elle est réglée, la cherche d'abord. Filtre *Entreprise à confirmer*.

**La référence et la version** (édition, révision) sont aussi lues à l'entrée : au début du
document (« Réf. : … », « Édition 2 », « Indice B », « Version 2.1 »), sinon dans le nom du
fichier. Lues clairement dans le document : données. Sinon, elles sont **à confirmer** —
l'IA, si elle est réglée, les cherche ; sur la fiche, **C'est juste** les confirme telles
quelles, ou **Modifier…** les corrige. Filtre *Référence et version à confirmer*.

## 8. Les fantômes

Un document n'est gardé qu'une fois. Si vous déposez dans un répertoire (en le versant ou
en le glissant-déposant) un document qui est déjà dans la bibliothèque, rangé ailleurs, il
n'est pas copié une seconde fois : une fenêtre vous propose **Ne rien faire**, ou **Placer
un fantôme ici**. Un fantôme est une petite note qui montre le document dans ce répertoire
aussi, et l'ouvre d'ici — sans le dupliquer.

Dans la page du répertoire, les fantômes sont **parmi les documents**, dans leurs groupes,
avec l'**icône fantôme** devant et « Rangé dans … » (les chiffres en haut les comptent) : un clic
ouvre le document ; **Aller à l'original** mène là où il est rangé ; **Retirer le fantôme**
l'enlève (le document reste). Le fantôme suit son document s'il est déplacé, et part s'il
est retiré. La fiche du document dit où il est montré aussi : le chiffre **Fantômes** et la
section **Montré aussi ailleurs**, avec l'icône fantôme.

C'est le workflow système « Proposer un fantôme d'un document déjà dans la
bibliothèque » : vous pouvez le régler pour placer le fantôme sans demander (*Comment* :
*Placer un fantôme sans demander*), ou le désactiver. Déclencheur : *Bibliothèque :
document déjà là* (où il est rangé, où vous l'avez déposé…).

## 9. Plusieurs bibliothèques, des répertoires

Chaque sorte — documents, prompts, personas — peut avoir **plusieurs bibliothèques** :
**Nouvelle bibliothèque** (sur sa page, ou sur l'accueil de la bibliothèque) lui donne un
nom et un dossier (vide : `Bibliothèques/Documents/<nom>`, `Bibliothèques/Prompts/<nom>`…).
L'une est **par défaut** : ce qui arrive sans lieu précis — les pièces d'une analyse, un
import, le dossier « À classer », un exemple — y entre, à sa racine ; **Définir par
défaut** la change. **Retirer la bibliothèque** l'ôte de la liste : son dossier et ses
notes restent dans le coffre.

Dans une bibliothèque, **Nouveau répertoire** crée un répertoire (un dossier), et dans
celui-ci des sous-répertoires. Le **fil d'Ariane**, tout en haut de la page, (« Bibliothèque ›
Documents › Normes › ECSS ») dit où vous êtes ; un clic y remonte. Chaque répertoire a sa
carte (combien il contient). On **verse** et on **crée** là où l'on est ; **Déplacer…**,
sur une fiche, range ailleurs (le fichier d'un document ne bouge pas ; ses versions
restent reliées). **Regrouper par › Répertoire** montre tout ce qui est dessous, un
répertoire par section.

**Supprimer le répertoire** (sur sa carte, ou sur sa page) : vide, il part à la corbeille du
coffre après une question. S'il contient des documents (ou des prompts, des personas…), on
choisit : **les remonter** dans le répertoire du dessus (ceux de ses sous-répertoires aussi,
avec les autres fichiers), ou **les retirer** — mis de côté dans les retirés de la
bibliothèque, rien n'est effacé. Une bibliothèque ne se supprime pas ainsi (**Retirer la
bibliothèque**, sur sa page).

**Glisser-déposer** : des fichiers glissés depuis l'explorateur de l'ordinateur et lâchés
sur la page des documents y sont versés, là où vous êtes ; lâchés sur la carte d'un
répertoire, dans ce répertoire. Comme « Verser des documents » : copiés dans la
bibliothèque, une seule fois chacun. Un prompt ou un persona se retrouve par son nom où qu'il soit
rangé.

## 10. Les documents de référence

Une bibliothèque à part, toujours là, garde les **documents de référence** : les normes, les
procédures, les guides communs à plusieurs programmes et projets. Sa carte, **Documents de
référence**, est sur l'accueil de la bibliothèque ; on y verse comme ailleurs (glisser-déposer,
**Verser des documents**), on y crée des répertoires (Normes, Procédures…). Elle ne se retire
pas ; son dossier se règle (`Bibliothèque/Références` d'origine).

- La fiche d'un document de référence porte l'étoile **★ Document de référence**, et une
  section **Appelé par** : les programmes et les projets qui l'appellent (un clic y mène).
- **Ranger dans les références**, sur la fiche d'un autre document, l'y range — comme
  **Déplacer…** vers les documents de référence, ou en glissant sa fiche dans leur dossier
  depuis l'explorateur de fichiers d'Obsidian : une fenêtre propose de **laisser un
  fantôme** à son ancienne place (ou pas).
- Un document **déjà rangé**, déposé de nouveau ailleurs : après le fantôme, une fenêtre propose
  de le **ranger dans les documents de référence** (un fantôme restera à son ancienne place) ou
  de le **laisser où il est**. Déposé dans les documents de référence même, c'est ce qui est
  proposé d'abord.
- Les programmes et les projets **appellent** ces documents : voir {{link:Programmes|Programmes}}.
  Une fiche déplacée, ses appels suivent.

## 10 bis. Le glossaire

Une bibliothèque de **termes** : chacun son nom, son **sigle** s'il en a un (« CCTP »), sa
**définition**, un domaine (catégorie) et des notes. Menu **Bibliothèque › Glossaire** (dans les
bibliothèques système) : **Nouveau terme**, ou **Ajouter les exemples** (des termes courants des appels
d'offres et des projets : CCTP, CCAP, RC, BPU, DPGF, DCE, AE, mémoire technique, exigence, recette).
Une note par terme, dans `Bibliothèque/Glossaire`.

**Les autres formes** (comme pour les étiquettes) : un pluriel, une variante, une autre formulation
(« exigences » pour « Exigence »), une par ligne dans le champ **Autres formes** du terme. Elles sont
cherchées comme lui ; sa carte et sa page les disent (« Autres formes : … »).

**Les liens avec les documents** :

- la fiche d'un document a une section **Glossaire (n)** : les termes qu'il emploie (dans son titre ou
  son texte, le terme, son sigle ou une autre forme, en mot entier), chacun avec sa définition ; un clic ouvre le terme ;
- la page d'un terme dit **Documents qui l'emploient (n)** ; un clic ouvre leur fiche (voir sa fiche ci-dessous) ;
  ce que chaque document cite est gardé en mémoire (un index) : il n'est relu que s'il change, ou si le
  glossaire change — la fiche s'ouvre vite, même avec beaucoup de documents ;
- le circuit des documents les **relie lui-même**, sans IA, à l'étape **Recherche dans le glossaire**
  (après l'ingestion) : le lien dans la fiche, un rétrolien dans la note du terme ; pour un document
  versé hors du circuit, le bouton ⟳ de cette étape, dans son parcours, le fait.

**La fiche d'un terme** : sa **définition** en tête ; **Le terme** — son nom, son sigle, son domaine,
ses autres formes et où il est rangé, chaque ligne avec son bouton (modifier, déplacer) ; **Documents
qui l'emploient (n)** — ceux qui y sont **reliés** (lien dans leur fiche, rétrolien dans la note du
terme) en vert, puis ceux qui le **citent** sans y être reliés, avec la forme qu'ils emploient et un
bouton **Relier** (ou **Tout relier** s'ils sont plusieurs ; sans IA) ; **Dans le même domaine** — les
autres termes de son domaine, un clic les ouvre ; ses **Notes** (les rétroliens n'y sont plus
répétés : ils sont dans la liste des documents).

## 11. Réglages

**Dossier du glossaire** (par défaut `Bibliothèque/Glossaire`).

**Les bibliothèques en explorateur de fichiers** (activé d'origine) : la colonne de gauche et les
documents en liste ; désactivé, l'affichage en cartes (voir la section 4).

**Dossier de la bibliothèque** (par défaut `Bibliothèque`), **dossier des documents de
référence** (par défaut `Bibliothèque/Références`), **dossier des prompts** (par
défaut `Bibliothèque/Prompts`) et **dossier des personas** (par défaut
`Bibliothèque/Personas`). Voir {{link:Accueil|l'accueil}}.
