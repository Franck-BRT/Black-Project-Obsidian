# Module — Bibliothèque de documents (`bibliotheque`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `bibliotheque` |
| Version | 0.14.0 (Black Projects 0.86.0) |
| Requiert | — |
| Utilisé par | [Analyse d'appels d'offres](ao.md) (pièces importées, déposées à la main), [Exigences](exigences.md) (fichier importé), [Typage des pièces](typage-pieces.md) et [Workflows](workflows.md) (fichiers d'échange) |
| Emplacement | `src/modules/bibliotheque/` |
| Interface publique | `src/modules/bibliotheque/index.ts` |

Documentation utilisateur (écrite dans le coffre) : `src/modules/bibliotheque/doc/Bibliothèque.md`.

## Ce qu'il fait

**Tout fichier déposé dans l'application** y est rangé, une fois, avec sa **fiche** —
une note (`bp-type: bibliotheque-document`) — : titre (tiré du nom), famille (extension :
pdf, word, sheet, slides, image, mail, note, other), catégorie (donnée par le module qui
verse — le type d'une pièce —, sinon devinée au nom : `CATEGORIES`), référence, édition,
révision, émetteur, étiquettes, **origines** (module, libellé, lien), empreinte
SHA-256, version précédente (`precedent`) ou probable (`precedentProbable`).

Adapté de la bibliothèque de documents d'un module de gestion de projet existant (sa
« bibliothèque » à l'échelle du coffre : fiche par fichier, empreinte, doublons, versions
détectées au nom, versement) ; le registre de livrables d'un projet (états, visas,
bordereaux) n'est pas repris.

## Verser (`store.ts`, `LibraryStore.pour`)

1. L'empreinte de chaque fichier (`hash.ts`, `crypto.subtle`).
2. **Déjà là** (même chemin, ou même empreinte) : rien n'est copié ; son origine s'ajoute
   (et sa catégorie, si elle était vide). `report.already`.
3. **Nouveau** : venu de l'ordinateur (`bytes`), copié dans `<dossier>/_fichiers/` (nom
   libre : « nom (2).ext ») ; déjà dans le coffre (`path`), laissé à sa place (`copie:
   false`). La fiche : `<dossier>/<titre>.md`.
4. **Version probable** : même famille, autre empreinte, même clé de nom
   (`versionKey` : les marques « ind B », « rev 2 », « v3 », « ed 1 », « issue 02 »
   ôtées) — le plus récent ; pas parmi ceux du même versement (deux formats d'un
   document). Noté `precedentProbable`, à confirmer depuis la fiche (« Relier comme
   nouvelle version » / « Ce n'en est pas une »).

`pourIntoLibrary(items, origine, options)` (interface publique) : sans le module actif,
`null` ; ne lève pas. Chaque versement qui fait entrer des documents émet
`bibliotheque.versement` (une fois, pour tous), puis chaque document ajouté
`bibliotheque.document-verse` (titre, famille, catégorie, fichier, origine ; depuis la
v0.8.0, `extension`, `lisible`, `lecture` — voir plus bas).

Une copie faite sous un nom déjà pris (« CCTP (2).pdf ») garde la clé de version de son
nom (le « (2) » ôté) : elle reste reconnue comme nouvelle version (v0.2.0).

**Qui verse** :

| Module | Quand | Fichiers | Origine |
| --- | --- | --- | --- |
| Analyse d'appels d'offres | `importFiles` (pièces, archives ouvertes) ; `updateAnalysis` (déposées à la main) | en place (les originaux de l'analyse), catégorie = type de pièce | l'analyse (lien : sa note) |
| Exigences | import réussi d'un fichier | copié (ordinateur) ou en place (coffre) | « Import d'exigences (nom) » |
| Typage des pièces | import de types réussi | idem, catégorie « Échange » | « Import de types de pièces » |
| Workflows | import de workflows réussi | idem, catégorie « Échange » | « Import de workflows » |
| Bibliothèque | « Verser des documents » | ordinateur (plusieurs, copiés) ou coffre (en place) | « Versé à la main » |

## Les workflows système (v0.2.0, Black Projects 0.62.0)

Les automatismes de la bibliothèque sont des [workflows système](workflows.md)
(`workflows.ts`) — modifiables, désactivables, pas supprimables :

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Ranger les pièces importées dans la bibliothèque (`sys.bibliotheque.ranger-pieces`) | fichiers déposés dans l'application, `origine` est `ao` | `bibliotheque.verser` : verse le dépôt | actif |
| Ranger les fichiers importés dans la bibliothèque (`sys.bibliotheque.ranger-fichiers`) | fichiers déposés, `origine` n'est pas `ao` (exigences, typage-pieces, workflows) | `bibliotheque.verser` | actif |
| Repérer les nouvelles versions probables (`sys.bibliotheque.nouvelles-versions`) | documents versés (une fois par versement) | `bibliotheque.versions` : `markLikelyVersions` sur les fiches du versement | actif |
| Signaler les fichiers introuvables, chaque lundi (`sys.bibliotheque.fichiers-introuvables`) | chaque lundi à 8 h | `bibliotheque.introuvables` : `missingFiles`, prévient s'il en manque, le journal garde les fiches | désactivé |

**Le dépôt** : le module Workflows actif (`systemWorkflowManages` d'un des deux « Ranger »),
`pourIntoLibrary` d'un autre module que la bibliothèque ne verse pas lui-même : il garde
les fichiers sous un identifiant (`holdDeposit` ; leurs octets ne voyagent pas dans les
variables ; vingt dépôts en attente au plus) et émet `bibliotheque.fichiers-deposes`
(variables `origine` — le module —, `libelle`, `fichiers`, `nombre`, `extensions`,
`nonlisibles`, `depot`). L'action
`bibliotheque.verser` (champ `depot`, `{depot}` d'origine) prend le dépôt, une fois, et le
verse. Le déposant attend la fin du workflow, puis annonce les documents versés ; déposé
pendant qu'un workflow s'exécute (`workflowRunning`), le dépôt passe après lui, sans être
attendu, et c'est l'action qui les annonce. Workflow désactivé : les fichiers ne sont pas
rangés (`null`). « Verser des documents », depuis la bibliothèque, y entre toujours.

**Les versions** : `systemWorkflowManages(SYS_VERSIONS)`, `pour` ne repère plus les
versions à l'entrée (`detectVersions: false`) ; le workflow le fait au versement annoncé,
et les fiches du rapport sont relues (« Verser des documents » dit toujours qu'une nouvelle
version est probable). Désactivé : plus de suggestion.

Sans le module Workflows, la bibliothèque range et repère elle-même, comme en 0.1.0.

**Le dossier de dépôt et deux rappels (v0.3.0, Black Projects 0.69.0)** :

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Verser le dossier « À verser », à l'ouverture (`sys.bibliotheque.depot-ouverture`) | à l'ouverture | `bibliotheque.depot` : `LibraryStore.pourInbox` | actif |
| Verser le dossier « À verser », chaque jour (`sys.bibliotheque.depot-quotidien`) | chaque jour à 8 h | `bibliotheque.depot` | actif |
| Versions à confirmer, chaque lundi (`sys.bibliotheque.versions-a-confirmer`) | lundi à 8 h | `bibliotheque.versions-a-confirmer` : les documents à `precedentProbable`, comptés et nommés | désactivé |
| Documents à classer, chaque lundi (`sys.bibliotheque.a-classer`) | lundi à 8 h | `bibliotheque.a-classer` : les documents sans catégorie, comptés et nommés | désactivé |
| Langues à confirmer, chaque lundi (`sys.bibliotheque.langues-a-confirmer`, v0.10.0) | lundi à 8 h | `bibliotheque.langues-a-confirmer` : les documents dont la langue est à confirmer, comptés et nommés | désactivé |
| Proposer un fantôme d'un document déjà dans la bibliothèque (`sys.bibliotheque.fantome`, v0.9.0) | *Bibliothèque : document déjà là* | `bibliotheque.fantome` (*Demander*) : une fenêtre — « Ne rien faire » ou « Placer un fantôme ici » | actif |

`pourInbox` : le dossier `<dossier>/À verser` (`INBOX_FOLDER`, jamais parcouru comme des
fiches) est créé s'il manque ; ses fichiers, sous-dossiers compris : un fichier nouveau
(empreinte inconnue) est déplacé dans `_fichiers` (nom libre) puis versé en une fois
(`PourItem.owned` : la fiche dit `copie: true`, le repérage des versions exclut le même
versement) ; un fichier déjà là (mêmes octets) ajoute son origine (« Déposé dans « À
verser » ») et part dans `_retirés` — rien n'est effacé. Puis le versement est annoncé
(déclencheurs « documents versés » et « document versé »). Dossier vide : rien n'est dit.

## Les bibliothèques de prompts et de personas (v0.4.0, Black Projects 0.70.0)

Le module tient **trois bibliothèques séparées** : les documents, les **prompts** et les
**personas**. Chacune a son dossier (réglages `dossierPrompts`, par défaut
`Bibliothèque/Prompts` ; `dossierPersonas`, par défaut `Bibliothèque/Personas` — jamais
parcourus comme des documents, `StoreDeps.skip`) et ses pages.

- **Le modèle** (`entries.ts`) : une note par entrée, `bp-type: bibliotheque-prompt` ou
  `bibliotheque-persona`, `nom`, `categorie`, `description`, `favori` ; le corps : la
  question (prompt) ou qui l'IA est et comment elle répond (persona), sans les
  commentaires `%% … %%`. `EntryStore` : `all` (favoris d'abord, puis catégorie, puis
  nom), `create`, `update` (renommée si le nom change), `toggleFavorite`, `setAside`
  (`_retirés` du dossier, rien n'est effacé), `addStarters` (ceux dont le nom n'est pas
  pris). `findIn` : par nom (sans accents ni casse) ou chemin.
- **Les exemples** (`starters.ts`), écrits seulement à la demande (« Ajouter les
  exemples ») : 7 prompts (pénalités, critères d'attribution, risques du marché,
  propriété intellectuelle, délais et jalons, garanties et assurances, questions à poser
  à l'acheteur) et 6 personas (juriste marchés publics, contrôleur technique, responsable
  qualité, ingénieur d'affaires, ingénieur exigences, traducteur technique), en français
  ou en anglais.
- **L'interface** (`entriesHome.ts`) : le menu « Bibliothèque » mène à la page
  `bibliotheque.accueil` (chiffres, une carte par bibliothèque) ; `bibliotheque.prompts` et
  `bibliotheque.personas` (Nouveau, Ajouter les exemples, recherche, filtres Favoris et
  par catégorie, une carte par entrée avec « Mettre en favori ») ; les fiches
  `bibliotheque.prompt?…` et `bibliotheque.persona?…` (le texte, où il sert ; Modifier,
  Favori, Ouvrir sa note, Retirer). Tuiles, commandes *Bibliothèque de prompts*,
  *Bibliothèque de personas*, *Nouveau prompt*, *Nouveau persona*.
- **L'interface publique** : `libraryEntries(kind)`, `findLibraryEntry(kind, nom)`,
  `namedEntry(kind, nom)` (pour un champ d'action de workflow : absent → une erreur qui le
  dit), `choosePersona(ui)` (« Sans persona » d'abord ; rien n'est demandé sans persona ;
  `undefined` : abandonné), `personaInstructions(persona)` (« Tu réponds en tant que
  « … ». » puis son texte), `addStarterEntries(kind, langue)`.

**Ce qu'ils apportent à l'IA** (le persona : `AiClient.withPersona`, ses consignes en
tête du message système de chaque demande) :

| Où | Prompt | Persona |
| --- | --- | --- |
| Interroger le dossier (analyse) | choisi avant la question, qu'il remplit (à reprendre) | un choix du formulaire ; la note de la réponse le dit (`persona:`) |
| Relire l'exigence avec l'IA | — | choisi avant la relecture (`ReviewOptions.persona`) |
| Relire les exigences du dossier | — | choisi une fois pour la série |
| Action « Demander à l'IA » | champ *Prompt de la bibliothèque* (la consigne peut rester vide) | champ *Persona de la bibliothèque* |
| Action « Interroger le dossier » | champ *Prompt de la bibliothèque* (la question peut rester vide) | champ *Persona de la bibliothèque* |
| Action « Relire l'exigence » | — | champ *Persona de la bibliothèque* |

## Vues et regroupements (v0.5.0, Black Projects 0.74.0)

Les pages de la bibliothèque, comme celle des workflows : des vues
([l'interface](../architecture/interface.md) : `layouts`) et « Regrouper par »
(`grouping.ts` : `grouped` range les cartes en sections repliables, une par groupe,
repliées d'origine au-delà de quatre groupes et douze cartes ; le choix vaut, page par
page, le temps de la session).

- **Documents** : Cartes, Liste, Tableau — la carte d'un document a désormais ses faits
  (*Taille*, *Ajouté le*, *Version* : les colonnes du tableau) et son fichier en
  sous-titre. Regrouper par **Origine** (d'origine : la première origine — « Analyse
  d'appels d'offres — Station sol »), **Famille**, **Catégorie** (« Sans catégorie » en
  dernier), **Mois d'ajout** (le plus récent d'abord), ou **Aucun**.
- **Prompts** et **Personas** : Cartes, Liste. Regrouper par **Catégorie** (d'origine),
  **Favoris** (« Favoris », « Les autres »), **Répertoire** (v0.6.0), ou **Aucun**.

## Plusieurs bibliothèques, des répertoires (v0.6.0, Black Projects 0.77.0)

`shelves.ts` : une **bibliothèque** (`Shelf` : `id`, `name`, `folder`, `main`) par sorte
(`document`, `prompt`, `persona`). La **principale** est celle des réglages d'origine
(`dossier`, `dossierPrompts`, `dossierPersonas`) ; les autres sont dans
`bibliotheques.<sorte>` (`{ id, name, folder }`, l'`id` tiré du nom). La **par défaut**
(`bibliothequesParDefaut.<sorte>`, sinon la principale) reçoit ce qui arrive sans lieu
précis : `LibraryStore.target` (les dépôts des autres modules, le dossier « À verser »,
« Verser » sans lieu), `EntryStore.target` (un prompt créé par la commande, les
exemples). Deux bibliothèques ne s'emboîtent pas (`withShelf` refuse un dossier égal,
dans ou autour d'un autre, de quelque sorte qu'il soit). Retirer une bibliothèque
(`withoutShelf`) l'ôte de la liste : son dossier et ses notes restent.

Les **répertoires** sont de vrais dossiers sous celui d'une bibliothèque (ni `_…`, ni
`.…`, ni « À verser », ni le dossier d'une autre bibliothèque). `all()` parcourt toutes les
bibliothèques de la sorte et annote chaque fiche de `shelf` et `directory` (calculés,
pas écrits). `subdirectories(dossier)`, `move(fiche, dossier)` (les documents qui la
donnaient pour précédente, ou précédente probable, suivent ; le fichier ne bouge pas),
`pour(…, { folder })`, `EntryStore.create(draft, dossier)`, `EntryStore.move`. Les retirés
vont dans le `_retirés` de leur bibliothèque.

`places.ts` : un **lieu** (`placeParam` : `<bibliothèque>:<répertoire>`) en paramètre des
pages `bibliotheque.documents`, `bibliotheque.prompts`, `bibliotheque.personas` (sans
paramètre : la racine de la bibliothèque par défaut). `placeView` : le **fil d'Ariane**
(`PageView.breadcrumb`, tout en haut de la page depuis la v0.6.1), une carte par répertoire (combien dessous), et les
actions *Nouveau répertoire*, *Nouvelle bibliothèque*, *Définir par défaut* (plusieurs
bibliothèques, pas celle par défaut), *Retirer la bibliothèque* (pas la principale). On
verse, on crée, là où l'on est. Les éléments montrés : ceux du lieu même ; « Regrouper
par › **Répertoire** » : tout ce qui est dessous, une section par répertoire. Les fiches
ont **Déplacer…** (chaque bibliothèque et répertoire de la sorte, sauf là où c'est) et
disent où c'est rangé. L'accueil, dès qu'une sorte a plusieurs bibliothèques : une
section par sorte, une carte par bibliothèque (combien, « Par défaut »).

## La bibliothèque de skills (v0.14.0, Black Projects 0.86.0)

Une troisième sorte d'entrées, à côté des prompts et des personas : le **skill**, un
savoir-faire donné à l'IA — une méthode, des points à vérifier, la forme d'une réponse
(`bp-type: bibliotheque-skill`, réglage `dossierSkills`, par défaut `Bibliothèque/Skills`).
Comme les autres : plusieurs bibliothèques, des répertoires, ses pages et fiches, quatre
exemples (*Lire un CCTP*, *Repérer les pénalités*, *Vérifier une exigence*, *Répondre en
tableau*), une carte et un chiffre sur l'accueil de la bibliothèque. Les listes des champs
Prompt, Persona, Skill des étapes d'IA des workflows viennent des trois bibliothèques
(`registerFieldSource`).

## La référence et la version des documents (v0.13.0, Black Projects 0.85.0)

En deux passes, comme la langue.

1. **Sans IA**, à l'entrée (`identity.ts`, `guessIdentity`, d'après la version complète) :
   le début du texte (6 000 caractères) — « Réf. : DLA-NM-0000000-01-PSP », « Document No. »,
   « Édition 2 », « Issue 3 », « Révision 15 », « Rév. B », « Indice C », « Version 2.1 »
   (édition 2, révision 1) —, puis, pour ce qu'il n'a pas dit, le nom du fichier
   (« ECSS-E-ST-10C_ed2_rev15 », « indB », « v2.1 »). Une référence plausible : lettres et
   chiffres, séparés, ni un mot ni une date. **Sûres** quand le texte dit la référence ET la
   version, avec leur mot ; sinon les valeurs trouvées sont données mais `identiteAConfirmer:
   true`. Une image : rien.
2. **Avec l'IA**, quand ce n'est pas sûr : le workflow système du [module IA](ia.md)
   « Identifier avec l'IA la référence et la version d'un document… » (actif, *document
   versé* dont `{identiteaconfirmer}` n'est pas vide) ; certaine, ce qu'elle dit est donné
   (`setIdentityByAi`, `identiteIdentifieePar: ia`), ce qu'elle ne dit pas gardé de la
   première passe ; une référence qu'on ne retrouve ni dans le texte ni dans le nom du
   fichier est écartée (`referenceFoundIn`).

À l'écran : sur la fiche, à confirmer, un message — **C'est juste** (les valeurs telles
quelles) ou **Classer…** ; Identification : *Référence et version* (« à confirmer »,
« Identifiées par l'IA ») ; le filtre *Référence et version à confirmer*. « Classer… »
enregistré : confirmées. Les workflows : `{reference}`, `{edition}`, `{revision}`,
`{identiteaconfirmer}` (vide quand elles sont sûres) au *document versé*.

## La langue des documents (v0.10.0, Black Projects 0.82.0)

À l'entrée (`pour`), le texte du fichier est lu — par la [lecture de
fichiers](lecture-fichiers.md), qui le donne à la bibliothèque (`setTextReader`) — et sa
langue devinée (`language.ts`, `detectLanguage`, d'après la version complète) : les petits
mots dont chaque langue est pleine (articles, prépositions, auxiliaires), pour le français,
l'anglais, l'allemand, l'espagnol, l'italien, le portugais et le néerlandais, sur les
20 000 premiers caractères.

- **Sûre** — au moins 8 de ces mots, et trois fois plus que la langue suivante (un texte
  d'une seule langue n'a presque rien d'une autre) : la fiche a `langue: fr`.
- **Pas assez sûre** — texte trop court, document bilingue, format non lu, fichier
  illisible, ou lecture de fichiers désactivée : **pas de langue**, `langueAConfirmer:
  true`, et `langueProbable` quand une langue mène (au moins 3 mots, devant la suivante).
- **Une image** : ni langue, ni rien à confirmer.

À l'écran : un badge (*Français*, ou *Langue à confirmer* en orange), des filtres par
langue et *Langue à confirmer*, « Regrouper par › **Langue** ». La fiche : *Langue* dans
l'identification ; à confirmer, un message — **Confirmer : Français** (la probable) ou
**Langue…** ; l'action **Langue…** (une langue, *Détecter de nouveau*, *Sans langue*) ;
« Classer… » a un choix *Langue* (choisie : confirmée). `LibraryStore.setLanguage`,
`detectLanguageOf`. Les workflows : `{langue}` et `{langueaconfirmer}` au *document
versé* ; le workflow système « Langues à confirmer, chaque lundi » (désactivé). Les
documents entrés avant la v0.10.0 n'ont pas de langue (*Détecter de nouveau*).

**L'étape avec l'IA** (v0.12.0, Black Projects 0.84.0) : pas sûre sans IA, la langue est
demandée à l'IA par un workflow système du [module IA](ia.md) (« Identifier avec l'IA la
langue d'un document… », actif) ; une réponse nette la donne, avec `langueIdentifieePar:
ia` (la fiche : « Français (identifiée par l'IA) »). Pour lui, l'interface publique :
`libraryDoc`, `libraryDocText`, `setLanguageByAi` ; le déclencheur *document versé* donne
aussi `{fiche}`. Les fiches : le « Retour » nomme le lieu où le document est rangé.

## Les fantômes (v0.9.0, Black Projects 0.81.0)

Repris de la version complète de Black Projects. Un document n'est gardé qu'une fois.
Déposé **soi-même dans un lieu** (« Verser des documents » sur la page d'un lieu, ou
glissé-déposé — `PourOptions.ghosts`), un document déjà là, **rangé ailleurs**, n'est pas
copié : un fantôme est proposé. Les dépôts des autres modules (pièces d'une analyse,
imports) et le dossier « À verser » ne proposent rien.

- **Le fantôme** (`ghosts.ts`) : une note `bp-type: bibliotheque-fantome` — `de`
  (`[[fiche]]`), `titre`, `empreinte` — et une ligne : « Fantôme : le document [[…]] est
  rangé dans « Normes » de la bibliothèque. » Il retrouve son document par le lien, sinon
  par l'empreinte (`ghostTarget`).
- **Le déclencheur** `bibliotheque.document-deja-la` (*Bibliothèque : document déjà là*),
  un par document : `titre`, `fichier`, `range` (où il est rangé), `ici` (où on l'a
  déposé), `origine`, `extension`, `lisible`, `lecture`, `fiche`, `dossier`. Rien quand on
  le dépose là où il est rangé, ni quand un fantôme y est déjà.
- **L'action** `bibliotheque.fantome` : *Comment* — **Demander** (une fenêtre : « Ne rien
  faire » / « Placer un fantôme ici ») ou **Placer un fantôme sans demander** — ; `fiche`,
  `dossier`. Le workflow système l'appelle en *Demander* ; désactivé, rien n'est proposé.
  Sans le module Workflows, la bibliothèque propose elle-même (la même fenêtre).
- **Il suit son document** (`LibraryStore`) : déplacé (`move`), son lien suit ; arrivé là où
  est un fantôme, ce fantôme part ; retiré (`setAside`), ses fantômes partent aussi.
  `removeGhost` : la note mise dans `_retirés` (rien n'est effacé ; le document reste).
- **À l'écran** : dans un lieu, « Aussi ici, rangés ailleurs » — une carte par fantôme
  (*Fantôme*, « rangé dans « Normes » ») : l'ouvrir ouvre le document ; *Aller à
  l'original*, *Retirer le fantôme* ; filtre *Fantômes*. La fiche du document : « Montré
  aussi ailleurs ».

## L'extension d'un fichier, et s'il est lisible (v0.8.0, Black Projects 0.80.0)

Quel que soit le moyen par lequel un fichier entre (versé à la main, glissé-déposé, le
dossier « À verser », les pièces d'une analyse, un import d'exigences, un échange), les
workflows le savent :

| Déclencheur | Variable | Valeur |
| --- | --- | --- |
| *Bibliothèque : document versé* | `extension` | l'extension, en minuscules, sans le point (`pdf`) ; vide sans extension |
| | `lisible` | `oui` si l'application en lit le texte, sinon `non` |
| | `lecture` | comment : « texte lu », « image : montrée, son texte n'est pas lu », « archive : ouverte, ses fichiers lus un à un », « format non lu », ou « non lu : la lecture de fichiers est désactivée » |
| *Fichiers déposés dans l'application* | `extensions` | les extensions, une fois chacune (`xlsx, dwg`) ; aussi une liste, pour les conditions |
| | `nonlisibles` | les fichiers dont le texte n'est pas lu ; aussi une liste |

C'est la [lecture de fichiers](lecture-fichiers.md) qui sait lire : à son activation, elle
donne à la bibliothèque `setReadability(extension → 'texte' | 'image' | 'archive' |
'non-lu')` (les extensions équivalentes comprises) ; désactivée, rien n'est lu
(`readingOf`). Un document déjà dans la bibliothèque (même empreinte) n'entre pas : pas de
« document versé ».

## Glisser-déposer (v0.7.0, Black Projects 0.79.0)

Des fichiers de l'ordinateur glissés-déposés sur la page des documents sont versés là où
l'on est (la bibliothèque, le répertoire) ; sur la carte d'un répertoire, dans ce
répertoire. `ShelfPlacesDeps.dropInto(dossier, nom)` rend le `FileDrop` (son libellé :
« Déposer pour verser dans « Normes » ») ; `pourItems` verse comme « Verser des
documents » (copiés, une seule fois par empreinte) et dit ce qui est entré. Les prompts et
les personas n'en prennent pas. Le bouton « Verser des documents » reste (clavier).

## Retirer

`setAside` : la fiche (et le fichier, s'il avait été copié) déplacée dans
`<dossier>/_retirés/` — rien n'est effacé (le port `FileSystem` n'efface pas) ; un
fichier resté à sa place n'est pas touché ; les liens de version vers elle sont défaits.

## Interface (`home.ts`)

- **Tableau de bord** : section « Bibliothèque » — combien, les cinq derniers, les versions
  à relier, « Verser des documents ».
- **Page** `bibliotheque.documents` (menu « Bibliothèque », tuile) : chiffres (documents,
  taille, ajoutés cette semaine, versions à relier), une carte par document (le plus
  récent d'abord : famille, catégorie, référence et version, « Nouvelle version
  probable », « Remplacé… », « Fichier introuvable » ; ses origines), recherche, filtres
  (famille, origine, dernières versions, versions à relier, introuvables).
- **Fiche** `bibliotheque.document?<fiche>` : Ouvrir le fichier, Classer… (formulaire),
  Nouvelle version de…, Ouvrir sa note, Retirer de la bibliothèque (confirmé) ; les
  messages (version probable, remplacé, fichier introuvable) ; chiffres ; Identification,
  Le fichier, D'où il vient (un clic : `showNote`, la page du module quand il en a une),
  Versions (précédentes, suivantes). Depuis la v0.11.0, ces quatre-là (et « Montré aussi
  ailleurs ») sont des **sections repliables, repliées d'origine** (`fold` :
  `bibliotheque.document.identite`, `.fichier`, `.origines`, `.fantomes`, `.versions`) ;
  leur en-tête en dit l'essentiel — catégorie, référence, version et langue ; le nom du
  fichier (ou « introuvable ») ; la première origine ; combien d'autres versions.
  L'interface se souvient de ce qu'on en déplie, le temps de la session.
- Commandes : *Bibliothèque de documents*, *Verser des documents dans la bibliothèque*.

## Réglages

`dossier` (par défaut `Bibliothèque`), `dossierPrompts` (par défaut
`Bibliothèque/Prompts`), `dossierPersonas` (par défaut `Bibliothèque/Personas`) : les
bibliothèques principales. `bibliotheques` (les autres, par sorte) et
`bibliothequesParDefaut` sont écrits par les pages.

## Tests

`test/bibliotheque-identite.test.ts` : la première passe (le texte avec leur mot : sûres ; le
nom du fichier, en partie, rien, une date : à confirmer), à l'entrée (sûres : rien demandé à
l'IA ; à confirmer : message, « C'est juste », « Classer… », filtre), la seconde passe (lire
la réponse, référence inventée écartée ; le workflow système ; certaine ; pas certaine).

`test/bibliotheque-langue.test.ts` : détecter (sûre ; trop courte, avec la probable ; bilingue),
à l'entrée (badge, filtre, regroupement, fiche), à confirmer (la probable d'un clic), non lu
(« Langue… », sans langue, détecter de nouveau), « Classer… », une image, sans la lecture
de fichiers, les workflows.

`test/bibliotheque-fantomes.test.ts` : le workflow système, la fenêtre (ne rien faire, placer
un fantôme ici ; déjà un fantôme ou déjà rangé là : plus de question), la carte du
fantôme (ouvrir, aller à l'original, retirer), le fantôme suit son document (déplacé,
ramené, retiré), le workflow sans demander ou désactivé, sans le module Workflows, les
dépôts des autres modules.

`test/bibliotheque-shelves.test.ts` : créer une bibliothèque (par défaut : les dépôts y
entrent ; dossier emboîté refusé), répertoires et sous-répertoires (fil d'Ariane, cartes,
verser ici, remonter), regrouper par répertoire, déplacer (les versions suivent),
prompts et personas, l'accueil, définir par défaut, retirer.

`test/bibliotheque-prompts-personas.test.ts` : l'accueil de la bibliothèque, les pages
vides, les exemples (une seule fois), favoris et filtres, la fiche (Modifier renomme,
Retirer), Nouveau persona par la commande ; interroger le dossier avec un prompt et un
persona, « Demander à l'IA » par leurs noms (et un nom inconnu), relire les exigences du
dossier avec ou sans persona.

`test/bibliotheque.test.ts` : verser (copié, en place, doublons, module inactif), versions
(probable, relier, remplacé, même versement), page et fiche (menu, chiffres, filtres,
verser, classer, origines, retirer), ce que versent l'analyse et l'import d'exigences.
`test/bibliotheque-workflows.test.ts` : les quatre workflows système (créés, actifs ou
non), les pièces et les imports rangés par leur workflow, chacun désactivé, les versions
repérées une fois par versement, la copie « (2) », les fichiers introuvables, sans le
module Workflows, un dépôt fait pendant qu'un workflow s'exécute.
