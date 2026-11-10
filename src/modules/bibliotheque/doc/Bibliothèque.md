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

Un **même fichier** (mêmes octets, quel que soit son nom) n'entre qu'une fois : sa fiche
note seulement qu'il revient d'ailleurs (ses origines s'ajoutent).

## 2. La fiche d'un document

- son **titre** (tiré du nom du fichier), sa **famille** (PDF, textes, tableurs,
  présentations, images, messages, notes, autres), son **type de pièce** — reconnu au nom du
  fichier et au début du texte (CCTP, RC, BPU… : la liste du module *Typage des pièces*, vos
  types compris), ou donné par l'analyse —,
  sa référence, son édition, sa révision, sa date, son entreprise, ses étiquettes : **Classer…**
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

Menu **Bibliothèque** (ou sa tuile, ou le tableau de bord) : les chiffres (documents,
taille, ajoutés cette semaine, versions à relier), une carte par document, le plus récent
d'abord ; une recherche (titre, fichier, type de pièce, référence, origine) et des filtres :
par famille, par origine, dernières versions, versions à relier, fichiers introuvables.

**Retirer de la bibliothèque** met la fiche de côté (dossier `_retirés`), avec le fichier
s'il avait été copié ; rien n'est effacé, et une pièce d'analyse n'est pas touchée.

**Affichage et regroupement** : sur la page des documents, en **cartes**, en **liste**
ou en **tableau** (taille, date d'ajout, version), regroupés par **origine** (l'analyse,
l'import), **famille**, **type de pièce** ou **mois d'ajout** — chaque groupe est une section
qu'un clic replie. Les prompts et les personas se regroupent par catégorie ou par
favoris, en cartes ou en liste.

## 5. Automatiser

Ce que la bibliothèque fait d'elle-même est écrit en **workflows système** : page
**Workflows**, filtre *Système*. Vous pouvez les modifier, les désactiver, et revenir à
l'original (« Rétablir l'original ») ; pas les supprimer.

| Workflow système | Quand | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Ranger les pièces importées dans la bibliothèque | des pièces sont importées dans une analyse | les range dans la bibliothèque | activé |
| Ranger les fichiers importés dans la bibliothèque | un import d'exigences, de types de pièces ou de workflows | range le fichier importé | activé |
| Repérer les nouvelles versions probables | des documents entrent dans la bibliothèque | marque la version précédente probable, à confirmer sur la fiche | activé |
| Signaler les fichiers introuvables, chaque lundi | le lundi à 8 h | dit les documents dont le fichier n'est plus dans le coffre | désactivé |

**Le dossier de dépôt** : posez des fichiers dans le dossier `À verser` de la bibliothèque (par défaut `Bibliothèque/À verser`)
— par l'explorateur de fichiers, une synchronisation —, ils entrent dans la bibliothèque à
l'ouverture d'Obsidian et chaque jour à 8 h, rangés dans `_fichiers` ; un fichier déjà
dans la bibliothèque est mis de côté dans `_retirés`. Deux rappels, désactivés d'origine,
chaque lundi : les **versions à confirmer** et les **documents à classer** (sans
type de pièce).

| Workflow système | Quand | D'origine |
| --- | --- | --- |
| Verser le dossier « À verser », à l'ouverture | à l'ouverture d'Obsidian | activé |
| Verser le dossier « À verser », chaque jour | chaque jour à 8 h | activé |
| Versions à confirmer, chaque lundi | le lundi à 8 h | désactivé |
| Documents à classer, chaque lundi | le lundi à 8 h | désactivé |
| Langues à confirmer, chaque lundi | le lundi à 8 h | désactivé |
| Proposer un fantôme d'un document déjà dans la bibliothèque | vous déposez un document déjà là, rangé ailleurs | activé |

Désactiver un « Ranger… », c'est ne plus ranger ces fichiers-là ; ce que vous versez
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
**Ajouter les exemples** — prêts pour les appels d'offres, à modifier. Sur la fiche : **Modifier**,
**Mettre en favori** (les favoris viennent en tête des listes), **Retirer** (mis de côté,
rien n'est effacé).

## 7. La langue des documents

À son entrée, la langue d'un document est **détectée** d'après son texte (français,
anglais, allemand, espagnol, italien, portugais, néerlandais). Si la détection est sûre,
elle est donnée — un badge *Français* sur sa carte. Sinon — texte trop court, document
bilingue, fichier dont le texte n'est pas lu —, il n'y a **pas de langue** : elle est **à
confirmer** (badge orange). Sur sa fiche, **Confirmer : …** donne d'un clic la langue la
plus probable ; **Langue…** en choisit une, la détecte de nouveau, ou dit « sans langue ».
« Classer… » permet aussi de la choisir. Filtres par langue, et « Regrouper par ›
Langue ». Une image n'a pas de langue à confirmer.

Quand la détection sans IA n'est pas sûre et que l'{{link:Modules/IA|IA}} est réglée, une
**étape avec l'IA** l'identifie (workflow système « Identifier avec l'IA la langue d'un
document… ») : une réponse nette donne la langue, notée « identifiée par l'IA » ; sinon elle
reste à confirmer.

**Le titre** est lu à l'entrée lui aussi : dit par le document (« Titre : … », « Objet :
… », un titre de note « # … »), il remplace celui tiré du nom du fichier. Sinon il reste
celui du nom du fichier, **à confirmer** : la fiche propose le titre lu au début du
document (**Prendre « … »**), **Garder le titre actuel**, ou **Classer…** ; l'IA, si elle
est réglée, le cherche d'abord. Filtre *Titre à confirmer*.

**Le type de pièce** aussi (l'ancienne « catégorie ») — dans la liste du module *Typage des
pièces*, vos types compris : donné par l'analyse (le type d'une pièce), dit par le document
(« Type de document : »), ou le nom du fichier et le texte d'accord : il est sûr. Sinon
celui du nom du fichier reste, **à confirmer** : la fiche propose celui que le texte suggère
(**Prendre « CCTP »**), **Garder le type actuel**, ou **Classer…** ; l'IA, si elle
est réglée, choisit d'abord dans la liste des types. Le crayon du champ ouvre la liste. Un
type **hors de la liste** (une ancienne catégorie) est dit tel ; le bouton **+** de sa ligne
l'ajoute aux types de pièce du module *Typage des pièces* (un code proposé) : il devient le
type du document, et des autres documents qui l'avaient. Plusieurs choses à confirmer : un
seul encadré « À confirmer (n) » les rassemble sur la fiche.

**La liste des étiquettes** (Bibliothèque › **Étiquettes**) : un vocabulaire commun — une
note par étiquette, son nom (« antenne ») et ses autres formes, une par ligne (« antennes »).
Les étiquettes d'un document y sont ramenées (« antennes » → « antenne »), y sont reconnues
dans le texte, **se cochent** (le crayon du champ ; « ＋ Autre(s) étiquette(s)… » pour en
écrire, ajoutées à la liste) ; celles **hors de la liste** sont dites, et le bouton **+** les
y ajoute.

**Les étiquettes** aussi : dites par le document (« Mots-clés : », « Étiquettes : »), elles
sont données. Sinon elles sont **à confirmer** : la fiche propose les mots qui reviennent le
plus au début du texte (**Prendre ces étiquettes**), **Pas d'étiquettes**, ou **Classer…** ;
l'IA, si elle est réglée, en donne d'abord de 3 à 6, en reprenant celles déjà employées dans
la bibliothèque. Filtre *Étiquettes à confirmer*.

**La date du document** aussi (celle de son édition, de sa publication ou de sa signature) :
dite par le document (« Date : », « Émis le », « Toulouse, le 1er mars 2026 »), ou le nom du
fichier et le texte d'accord, elle est donnée. Sinon elle est **à confirmer** : la fiche
propose la première date du texte — jamais une date limite ou une échéance — (**Prendre
« 12 février 2026 »**), **Pas de date**, ou **Classer…**, où on l'écrit comme on veut
(« 12/02/2026 », « 12 février 2026 ») ; l'IA, si elle est réglée, la cherche d'abord.
Filtre *Date à confirmer*.

**La liste des entreprises** (Bibliothèque › **Entreprises**) — celles qui émettent les
documents : comme les types de pièce, un **code** (« ESA ») et un **nom** (« Agence spatiale
européenne ») — et, s'il le faut, les autres noms sous lesquels elle signe, un par ligne
(« European Space Agency »). Une note par entreprise, dans le dossier
`Bibliothèque/Entreprises` (un coffre qui avait encore `Bibliothèque/Émetteurs` le voit renommé
à l'ouverture, ses notes avec). L'entreprise
d'un document y est **reconnue** (son nom, un autre nom, ou son code en tête du document),
**s'y choisit** (le crayon du champ, *Classer…* : une liste, et « ＋ Ajouter une entreprise à
la liste… », son nom proposé) et se lit « ESA — Agence spatiale européenne ». Une entreprise
**hors de la liste** est dite telle sur la fiche ; le bouton **+** de sa ligne l'y ajoute (son
nom et un code proposés — « TAS » pour Thales Alenia Space) : elle devient l'entreprise du
document, et des autres documents qui portaient ce nom.

**Le répertoire des personnes** (Bibliothèque › **Personnes**) : les personnes avec qui vous
travaillez, une note par personne (dans `Bibliothèque/Personnes`). **Nouvelle personne** : son
nom et prénom, son **entreprise** (choisie dans la liste des entreprises — ou « ＋ Ajouter une
entreprise à la liste… », sa fenêtre s'ouvre), sa **fonction**, son **adresse électronique**
(vérifiée), son **téléphone**, une catégorie (client, fournisseur, interne…), des notes ;
favorite ou non. Sa carte dit sa fonction, son entreprise et ses coordonnées ; la recherche la
trouve par chacun. Sur sa fiche, un clic sur son entreprise ouvre celle-ci ; la fiche d'une
entreprise montre **ses personnes**. Comme les autres listes : des répertoires, d'autres
bibliothèques, **Déplacer…**, **Retirer**.

**L'entreprise** aussi : dite par le document (« Émetteur : », « Émis par », « Pouvoir
adjudicateur : »…), elle est donnée. Sinon elle est **à confirmer** : la fiche propose
l'organisme lu au début du document (**Prendre « … »**), **Pas d'entreprise**, ou
**Classer…** ; l'IA, si elle est réglée, la cherche d'abord. Filtre *Entreprise à confirmer*.

**La référence et la version** (édition, révision) sont aussi lues à l'entrée : au début du
document (« Réf. : … », « Édition 2 », « Indice B », « Version 2.1 »), sinon dans le nom du
fichier. Lues clairement dans le document : données. Sinon, elles sont **à confirmer** —
l'IA, si elle est réglée, les cherche ; sur la fiche, **C'est juste** les confirme telles
quelles, ou **Classer…** les corrige. Filtre *Référence et version à confirmer*.

## 8. Les fantômes

Un document n'est gardé qu'une fois. Si vous déposez dans un répertoire (en le versant ou
en le glissant-déposant) un document qui est déjà dans la bibliothèque, rangé ailleurs, il
n'est pas copié une seconde fois : une fenêtre vous propose **Ne rien faire**, ou **Placer
un fantôme ici**. Un fantôme est une petite note qui montre le document dans ce répertoire
aussi, et l'ouvre d'ici — sans le dupliquer.

Dans la page du répertoire, les fantômes sont sous « Aussi ici, rangés ailleurs » : un clic
ouvre le document ; **Aller à l'original** mène là où il est rangé ; **Retirer le fantôme**
l'enlève (le document reste). Le fantôme suit son document s'il est déplacé, et part s'il
est retiré. La fiche du document dit où il est montré aussi.

C'est le workflow système « Proposer un fantôme d'un document déjà dans la
bibliothèque » : vous pouvez le régler pour placer le fantôme sans demander (*Comment* :
*Placer un fantôme sans demander*), ou le désactiver. Déclencheur : *Bibliothèque :
document déjà là* (où il est rangé, où vous l'avez déposé…).

## 9. Plusieurs bibliothèques, des répertoires

Chaque sorte — documents, prompts, personas — peut avoir **plusieurs bibliothèques** :
**Nouvelle bibliothèque** (sur sa page, ou sur l'accueil de la bibliothèque) lui donne un
nom et un dossier (vide : `Bibliothèques/Documents/<nom>`, `Bibliothèques/Prompts/<nom>`…).
L'une est **par défaut** : ce qui arrive sans lieu précis — les pièces d'une analyse, un
import, le dossier « À verser », un exemple — y entre, à sa racine ; **Définir par
défaut** la change. **Retirer la bibliothèque** l'ôte de la liste : son dossier et ses
notes restent dans le coffre.

Dans une bibliothèque, **Nouveau répertoire** crée un répertoire (un dossier), et dans
celui-ci des sous-répertoires. Le **fil d'Ariane**, tout en haut de la page, (« Bibliothèque ›
Documents › Normes › ECSS ») dit où vous êtes ; un clic y remonte. Chaque répertoire a sa
carte (combien il contient). On **verse** et on **crée** là où l'on est ; **Déplacer…**,
sur une fiche, range ailleurs (le fichier d'un document ne bouge pas ; ses versions
restent reliées). **Regrouper par › Répertoire** montre tout ce qui est dessous, un
répertoire par section.

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
- **Ranger dans les références**, sur la fiche d'un autre document, l'y range : un fantôme
  reste à son ancienne place.
- Un document **déjà rangé**, déposé de nouveau ailleurs : après le fantôme, une fenêtre propose
  de le **ranger dans les documents de référence** (un fantôme restera à son ancienne place) ou
  de le **laisser où il est**. Déposé dans les documents de référence même, c'est ce qui est
  proposé d'abord.
- Les programmes et les projets **appellent** ces documents : voir {{link:Programmes|Programmes}}.
  Une fiche déplacée, ses appels suivent.

## 11. Réglages

**Dossier de la bibliothèque** (par défaut `Bibliothèque`), **dossier des documents de
référence** (par défaut `Bibliothèque/Références`), **dossier des prompts** (par
défaut `Bibliothèque/Prompts`) et **dossier des personas** (par défaut
`Bibliothèque/Personas`). Voir {{link:Accueil|l'accueil}}.
