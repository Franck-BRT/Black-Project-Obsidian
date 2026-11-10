# Module — Bibliothèque de documents (`bibliotheque`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `bibliotheque` |
| Version | 0.40.1 (Black Projects 0.119.1) |
| Requiert | — |
| Utilisé par | [Analyse d'appels d'offres](ao.md) (pièces importées, déposées à la main), [Exigences](exigences.md) (fichier importé), [Typage des pièces](typage-pieces.md) et [Workflows](workflows.md) (fichiers d'échange) |
| Emplacement | `src/modules/bibliotheque/` |
| Interface publique | `src/modules/bibliotheque/index.ts` |

Documentation utilisateur (écrite dans le coffre) : `src/modules/bibliotheque/doc/Bibliothèque.md`.

## La lecture en cours, sur la fiche (v0.40.1, Black Projects 0.119.1)

Pendant que l'IA lit un document, la section *Texte extrait* de sa fiche **s'ouvre** et le dit
dans son sous-titre (« L'IA lit ce document — vérification — page 3 sur 12 (25 %) ») ; en file
d'attente, sa position ; pendant **Extraire de nouveau**, « Extraction du texte en cours… »
(`extractingNow`). Le **texte lu jusqu'ici** s'y affiche au fil des pages, dit provisoire
(`aiReadingPartial(record, texte, faites, total)`, que le module IA appelle après chaque page ou
partie, et dès qu'une page est lue, avant sa vérification) ; le texte d'avant reste dessous,
titré, jusqu'à la fin. Un scan en cours de lecture n'a plus d'alerte orange.

## La qualité du texte (v0.40.0, Black Projects 0.119.0)

Une version du texte lue ou relue par l'IA garde la **qualité** de la transcription
(`TextVersion.quality`, `qualite` dans sa note, de 0 à 100) : la liste des versions la dit
(« qualité ★★★★☆ 88 % »), la section *Texte extrait* de la fiche aussi (son sous-titre et son
message), et la note du document, dans l'encadré au-dessus du texte (`qualityText`).

## Le dossier « Entreprises » (v0.39.0, Black Projects 0.118.0)

Le dossier d'origine des entreprises devient `Bibliothèque/Entreprises` (celui d'une
bibliothèque d'entreprises ajoutée : `Bibliothèques/Entreprises/…`). À l'activation
(`renameIssuersFolder`), un coffre qui a encore `Bibliothèque/Émetteurs` — sans autre dossier
réglé — le voit **renommé** (`FileSystem.rename` d'un dossier : dans Obsidian, par son
gestionnaire de fichiers, les liens suivent), et une notice le dit ; s'il a déjà les deux, ou si
le renommage échoue, le réglage garde l'ancien — rien n'est mêlé ni perdu. Les clés `emetteur…`
des notes ne changent pas.

## Le répertoire des personnes (v0.38.0, Black Projects 0.117.0)

Une sorte d'entrées de plus, `person` (`bp-type: bibliotheque-personne`, dossier
`Bibliothèque/Personnes` — réglage `dossierPersonnes` —, ses bibliothèques et répertoires comme
les autres) : `name` (nom), `company` (`entreprise` : le code d'une entreprise de la liste, ou un
nom écrit), `description` (la fonction), `email`, `phone` (`telephone`), `category`, `favorite`,
`text` (les notes). Sa fenêtre (`personForm`) propose les entreprises de la liste et « ＋ Ajouter
une entreprise… » ; une adresse mal écrite est refusée. Pages `bibliotheque.persons` et
`bibliotheque.person` (les coordonnées ; l'entreprise, de la liste, s'ouvre — `companyOf`,
`companyLabel`) ; la fiche d'une entreprise liste ses personnes. La recherche lit aussi
l'entreprise, l'adresse, le téléphone ; l'accueil de la bibliothèque, une carte et un chiffre de
plus ; une tuile ; deux commandes (« Répertoire des personnes », « Nouvelle personne »).

## « Entreprises », plus « Émetteurs » (v0.37.0, Black Projects 0.116.0)

La liste des émetteurs s'appelle **Entreprises** dans l'interface (titres, champs, messages,
filtre *Entreprise à confirmer*) ; les messages d'un champ (« … : valeur identifiée par l'IA »)
s'accordent avec tous. Rien ne change dans le coffre : le dossier par défaut reste
`Bibliothèque/Émetteurs` (un coffre qui en a un ne le perd pas ; il se change dans les
réglages), les clés `emetteur…` des notes et les variables `{emetteur}` des workflows aussi.

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

## Créer un type de pièce, pour les autres modules (v0.36.1, Black Projects 0.111.1)

`createPieceType()` : la fenêtre « Nouveau type de pièce » (code, libellé), le type ajouté par le
module Typage des pièces ; rend `{ code, label }` ou `null`. `canCreatePieceType()` : le module
Typage des pièces actif. Le module Programmes s'en sert dans la fenêtre des documents attendus.

## La lecture par l'IA en cours, la file d'attente (v0.36.0, Black Projects 0.108.0)

- La bibliothèque tient **la lecture par l'IA en cours** (le document, où elle en est) et **la
  file d'attente** (`aiReadingNow`) ; le module IA la tient à jour. À chaque changement, les
  pages ouvertes se redessinent (`views.changed()`).
- Sur la fiche, section *Texte extrait* :
  - le document en cours de lecture : **Lecture par l'IA en cours…** grisé, *Extraire de
    nouveau* grisé, et « L'IA lit ce document — page 2 sur 35 » ;
  - un autre document en cours : **Ajouter à la file d'attente** (au lieu de *Relire avec
    l'IA*) — il passera après (le moteur des workflows les enchaîne) ; puis **En file d'attente
    (n)** grisé, et « L'IA lit « … » — page 11 sur 35 ; n en file d'attente ».

## La variable `{scan}` (v0.35.0, Black Projects 0.107.0)

Le sujet d'un *document versé* a une variable `{scan}` : « oui » quand le document n'a pas de
texte (`sans-texte`, `image`) et qu'un modèle de vision peut le regarder (`setAiVision`). Le
workflow système du module IA `sys.ia.lire-scans` la prend pour condition : un scan versé est
lu avec la vision aussitôt.

## Relire avec un modèle simple ou avec la vision ; lire un scan (v0.34.0, Black Projects 0.106.0)

- **Relire avec l'IA** (section *Texte extrait*) : quand le fichier se montre en images (un PDF
  que la plateforme dessine, une image), une question — **Modèle simple** (le texte extrait)
  ou **Modèle avec la vision** (les pages en images, comparées au texte extrait). Sinon, le
  modèle simple, sans question.
- **Un document sans texte** (un scan, une image) : la fiche ne propose que **Lire avec la
  vision (IA)** — le workflow système de relecture exécuté avec `{relecture}` = `vision` (et
  `{texteextrait}` dit « à lire avec la vision », pour sa condition). Son texte devient le
  « Texte 1 — lu par l'IA avec la vision » (aucun texte d'avant n'est gardé : il n'y en avait
  pas) ; la fiche est alors lue.
- Une version lue avec la vision le dit : « Texte n — lu par l'IA avec la vision », et dans sa
  liste « n page(s) regardée(s) » (`vision` dans sa note).
- Le texte extrait affiché rend les **formules mathématiques** (voir le bloc `markdown`).

## Supprimer une version du texte ; les listes du texte extrait (v0.33.0, Black Projects 0.105.0)

- **Supprimer cette version** (la corbeille, parmi les outils de chaque version de *Versions du
  texte*), après confirmation : sa note va à la corbeille du coffre (`FileSystem.trash`,
  nouveau dans le port — dans Obsidian `fileManager.trashFile`, selon le réglage du coffre ;
  sans lui, mise de côté dans `_retirés`). `store.deleteTextVersion` : celle que montrait la
  fiche est remplacée par la dernière qui reste (aucune : le texte reste sur la fiche, sans
  version). Les numéros ne changent pas ; **Comparer** se fait avec la précédente qui reste.
- Le texte écrit dans la fiche a ses puces tapées (« • ») changées en `- ` (`completeLists`).
  Le bloc `markdown` de la fiche : une liste aérée reste une liste, une liste coupe la phrase
  qu'elle suit (« Les revues : » puis ses puces), une numérotée garde son premier numéro.

## Les tableaux du texte extrait (v0.32.0, Black Projects 0.104.0)

- Le texte écrit dans la fiche (`transcriptBlock`) a ses tableaux complétés (`completeTables`
  de `src/core/tables.ts`) : des lignes `| … |` sans ligne de séparation — un texte relu par
  l'IA, une version remontrée — deviennent un tableau Markdown, qu'Obsidian montre.
- La section *Texte extrait* (le bloc `markdown`, `src/ui/markdown.tsx`) montre aussi en
  tableau des lignes `| … |` sans séparation (les fiches transcrites avant), la première en
  en-tête, sans les colonnes vides de bout en bout. Dans la note, « Extraire de nouveau » les
  réécrit.

## Extraire de nouveau, relire avec l'IA (v0.31.0, Black Projects 0.103.0)

- **Extraire de nouveau** le texte d'un document (lu) exécute ensuite le workflow système de
  relecture par l'IA (`runSystemWorkflow`, comme au dépôt) : le texte extrait de nouveau est une
  version de plus, aussitôt relue — s'il est actif. Le module IA dit ce workflow à la
  bibliothèque à son activation (`setAiProofread`) : elle ne connaît pas ses identifiants.
- **Relire avec l'IA** : un bouton de la section *Texte extrait* (le texte lu, le module IA
  actif), qui relance cette relecture ; le workflow désactivé (ou le module Workflows
  inactif), une notice le dit.
- La relecture **se dit** (notices) : son début (« relecture du texte par l'IA en cours (n
  morceau(x))… »), ses morceaux, puis ce qu'elle a donné — son workflow système, comme tous,
  ne disait rien quand il réussissait : au dépôt, on ne voyait pas qu'elle avait eu lieu. L'IA
  non réglée, elle le dit aussi.

## Les versions du texte ; la relecture par l'IA (v0.30.0, Black Projects 0.102.0)

Le texte d'un document a des **versions** — distinctes de ses versions de document : son
**édition** et sa **révision** n'y changent pas.

- **Une note par version** (`bp-type: bibliotheque-texte` : `document`, `version`,
  `origine` — `extraction` ou `ia` —, `date`, et pour l'IA `modele`, `prompt`, `persona`,
  `skill`, `gardes`), rangées dans `<bibliothèque>/_textes/<empreinte du fichier>/Texte n.md`
  (elles suivent la fiche, déplacée ou renommée).
- **La première** est gardée au premier changement (`addTextVersion`) : « Texte 1 — extrait
  du fichier ». La fiche montre la dernière (`texteVersion` dans son en-tête ; l'encadré du
  texte la nomme : « Texte 2, relu par l'IA… les versions d'avant sont gardées »).
  **Extraire de nouveau**, quand il y a des versions : une de plus.
- **Sur la fiche**, la section *Versions* a une liste **Versions du texte** (la dernière
  d'abord : date, modèle, persona, skill, prompt ; « montré sur la fiche ») : chacune ouvre sa
  note, **Comparer avec le texte n-1** (la page `bibliotheque.comparer` : passages retirés,
  ajoutés, gardés — un bloc `diff`, `diffParagraphs` de `src/core/diff.ts`), **Le montrer sur
  la fiche** (`showTextVersion` : rien n'est effacé). L'en-tête de *Texte extrait* dit la
  version montrée.
- **La relecture par l'IA** : l'étape `ia.relire-texte` du [module IA](ia.md) et son
  workflow système (actif, au *document versé* dont `{texteextrait}` n'est pas vide) en font
  une nouvelle version (`addTextVersionByAi`).

## Le texte extrait, mis en forme et en entier (v0.29.0, Black Projects 0.101.0)

Sur la fiche, le texte extrait est **mis en forme** — c'est du Markdown (celui de la lecture
de fichiers) : titres, paragraphes, listes à puces et numérotées (imbriquées), tableaux,
citations, blocs de code, filets ; en ligne, gras, italique, code, et le texte des liens. Un
nouveau bloc du contrat des pages, `{ kind: 'markdown', text }`, et son rendu
(`src/ui/markdown.tsx`) : des éléments, jamais du HTML injecté. Il est montré **en entier**
(plus de limite à 20 000 caractères).

## Le texte extrait, dans la fiche (v0.28.0, Black Projects 0.100.0)

Exactement comme pour une **pièce d'analyse** : à son entrée, le texte du fichier est
**transcrit dans sa fiche** (sa note).

- **La transcription** vient de la [lecture de fichiers](lecture-fichiers.md)
  (`setTranscriber` : le texte, ou pourquoi il n'y en a pas — `lue`, `sans-texte` (un scan),
  `image`, `non-lue`, `illisible`, les mêmes états que les pièces). Le fichier est lu **une
  fois** : ce texte sert aussi aux premières passes (langue, titre, type de pièce…).
- **Dans la note**, après la section des notes de l'utilisateur, entre deux marques
  (`<!-- bp:texte:debut … -->`, `<!-- bp:texte:fin -->`) : « ## Texte extrait », un encadré
  (`> [!info] Document lu : n caractères de texte extrait.`, ou `> [!warning]` et pourquoi),
  puis le texte, ses titres descendus de deux niveaux (`nestHeadings`). Ce qui est hors des
  marques n'est jamais touché. L'en-tête garde `lecture` et `caracteres`.
- **Sur la fiche**, une section repliable de plus, **« Texte extrait »** (après *Versions*) :
  en en-tête l'état (« Lu — 227 caractères », « Image », « Pas encore extrait »…) ; l'encadré,
  **Extraire de nouveau** (ou **Extraire le texte**, pour un document versé avant) et **Ouvrir
  sa note** ; puis le texte, en entier et **mis en forme** (v0.29.0 : voir plus bas).
- Sans la lecture de fichiers, rien n'est transcrit.

## La liste des étiquettes (v0.27.0, Black Projects 0.99.0)

Une **cinquième bibliothèque** : les **étiquettes** (`EntryKind` `tag`, `bp-type:
bibliotheque-etiquette`, dossier `Bibliothèque/Étiquettes`, réglage `dossierEtiquettes`,
icône `tag`) — un vocabulaire commun. Une note par étiquette : son **nom** (`nom`, « antenne »)
et, dans le corps, ses **autres formes**, une par ligne (« antennes », « antenna »). Pas de
code ; pas d'exemples.

Les **étiquettes d'un document** s'y rattachent :

- **ramenées** à celles de la liste (`canonicalTag`, `canonicalTags` : une autre forme, sans
  accents ni casse → l'étiquette) — dites par le document, données par l'IA, écrites ;
- **reconnues** : sans « Mots-clés : », celles de la liste que le texte nomme (nom ou autre
  forme, en mots entiers) sont proposées d'abord (`guessTags(text, known)`), à confirmer ;
- **cochées** : le crayon ouvre une liste à cocher (`pickMany`) — celles de la liste (leurs
  autres formes en dessous), les siennes qui n'y sont pas (« … (hors de la liste des
  étiquettes) »), et « ＋ Autre(s) étiquette(s)… » : à écrire, ajoutées à la liste d'un même
  geste (case cochée d'origine) ;
- **hors de la liste** : la fiche le dit (« antenne, radar — hors de la liste : radar ») et
  un bouton **+** « Ajouter à la liste des étiquettes : radar » les y ajoute (cochées ; on en
  décoche), une note chacune.

L'IA reçoit la liste d'abord (`libraryTags` : celles de la liste, puis celles en usage).

## Un type de pièce hors de la liste : l'y ajouter (v0.26.0, Black Projects 0.98.0)

Comme pour l'émetteur : un type de pièce hors de la liste (une ancienne catégorie,
« Devis ») est dit sur la fiche (« Devis — hors de la liste des types de pièce » ; l'est aussi
un émetteur hors de sa liste, même à confirmer), et — le module Typage des pièces actif — sa
ligne a un bouton **+** « Ajouter « Devis » aux types de pièce ». Sa fenêtre : un **code
proposé** (`suggestTypeCode` : un mot, en capitales — « DEVIS » ; plusieurs, leurs initiales —
« Plan d'assurance qualité » → « PAQ ») et le **libellé** ; elle refuse ce que refusent les
réglages du module (`PieceTyper.check` : un code invalide, un type du module, un type déjà
ajouté). Ajouté (`PieceTyper.add` : un type personnalisé du module, comme dans « Types de
pièces personnalisés » ; son code est aussi reconnu dans le nom des fichiers), il devient le
type du document, et des autres documents qui avaient cette valeur (`adoptCategory`). Dans la
liste du crayon et de *Classer…* : « ＋ Ajouter un type de pièce… ».

## Un émetteur hors de la liste : l'y ajouter (v0.25.0, Black Projects 0.97.0)

Quand l'émetteur d'un document n'est pas dans la liste des émetteurs, la fiche le dit
(« Thales Alenia Space — hors de la liste des émetteurs ») et la ligne *Émetteur* a un
troisième bouton (icône `plus`) : **« Ajouter « Thales Alenia Space » à la liste des
émetteurs »**. La fenêtre d'un nouvel émetteur s'ouvre, son **nom** et un **code proposés**
(`suggestIssuerCode` : les initiales — « TAS » —, un sigle déjà écrit — « SNCF » —, ou les
quatre premières lettres d'un seul mot). Créé, il devient l'émetteur du document, **et des
autres documents qui portaient ce nom** (`adoptIssuer`, sans accents ni casse ; comme
émetteur ou comme émetteur proposé) ; la notification le dit. « ＋ Ajouter un émetteur à la
liste… » (le crayon, *Classer…*) fait de même.

## Correctif : relancer un champ ne change que lui (v0.24.1, Black Projects 0.96.1)

Relancer la recherche de la **révision** (ou de l'édition, de la référence) refaisait la
référence et la version ensemble : une référence changée à la main revenait à celle du
document. Désormais chacun de ces trois boutons ne touche que son champ (`ResearchField`
`reference`, `edition`, `revision`) ; la ligne « Référence et version » relance les trois.
Et quel que soit le champ, ce que l'IA dit de plus (son étape « référence et version » rend
les trois) est écarté : seul le champ relancé change (`RESEARCH_KEYS`).

## La liste des émetteurs (v0.24.0, Black Projects 0.96.0)

Une **quatrième bibliothèque** à côté des prompts, des personas et des skills : les
**émetteurs** (`EntryKind` `issuer`, `bp-type: bibliotheque-emetteur`, dossier
`Bibliothèque/Émetteurs`, réglage `dossierEmetteurs`). Comme les types de pièce : un **code**
(`code`, « ESA ») et un **nom** (`nom`, « Agence spatiale européenne ») ; le corps de la note :
ses **autres noms**, un par ligne (« European Space Agency »). Ses pages, ses répertoires et
ses bibliothèques comme les autres ; carte « ESA — Agence spatiale européenne » ; pas
d'exemples (chacun a les siens) ; icône `building`.

L'**émetteur d'un document** s'y rattache :

- **Reconnu** (`guessIssuer(text, known)`) : dit avec son mot (« Émetteur : European Space
  Agency ») → son code ; sinon, un seul émetteur de la liste en tête du document (ses 15
  premières lignes : son nom ou un autre nom, sans accents ni casse ; son code tel quel, en
  mot entier) → sûr ; plusieurs → le premier, à confirmer. Hors de la liste : comme avant (le
  nom lu, gardé tel quel).
- **Enregistré par son code** (`emetteur: ESA`) ; dit sur la fiche « ESA — Agence spatiale
  européenne » (`issuerLabelIn`) ; `{emetteur}` donne le code, `{emetteurnom}` (nouveau) le nom.
- **Choisi dans une liste** (le crayon, *Classer…*) : « — Aucun — », les émetteurs (par code),
  celui qu'il a s'il n'y est pas (« … (hors de la liste des émetteurs) »), et **« ＋ Ajouter un
  émetteur à la liste… »** : la fenêtre d'un nouvel émetteur, son nom proposé (celui lu dans
  le document) ; créé, il devient celui du document.
- **L'IA** reçoit la liste (`libraryIssuers`) et répond par le code ; voir le [module IA](ia.md).

Les champs Prompt, Persona, Skill des étapes de workflow ne listent pas les émetteurs
(`AI_ENTRY_KINDS`).

## Le type de pièce, à la place de la catégorie (v0.23.0, Black Projects 0.95.0)

La **catégorie** d'un document devient son **type de pièce**, et sa liste celle du [module
Typage des pièces](typage-pieces.md) : ses types (AVIS, RC, AE, CCAP, CCAG, CCTP, CCTG, BPU,
DPGF, DQE, MEMOIRE, FORMULAIRE, QR, PLANNING, ANNEXE, AUTRE), ceux que l'utilisateur a
ajoutés, sans ceux qu'il a désactivés — la même que pour les pièces d'une analyse.

- **La liste et ce qui la reconnaît** (`PieceTyper` : `types()`, `ofName`, `ofText`) : le
  module Typage des pièces la donne à son activation (`setPieceTyper`) — ses mots-clés du nom
  du fichier, puis ceux du titre, les siens et ceux de l'utilisateur ; sans lui, les
  anciennes catégories de la bibliothèque en tiennent lieu (`CATEGORY_TYPER`).
- **Les deux passes** ne changent pas : donné par celui qui dépose (le type d'une pièce
  d'analyse), dit par le document (« Type de document : CCTP » ou son libellé), ou le nom du
  fichier et le texte d'accord : sûr ; sinon à confirmer, celui que le texte suggère proposé ;
  l'IA choisit dans la liste — par son code ou son libellé, rendu par son code.
- **Sur la fiche** : « Type de pièce », dit avec son libellé (« CCTP — Cahier des clauses
  techniques particulières ») ; le crayon et **Classer…** ouvrent une **liste** : « — Aucun — »,
  les types, et celui qu'il a s'il n'y est pas (« Devis (hors de la liste des types) »,
  gardé tel quel).
- **Rien ne change dans les notes** : la clé `categorie` garde le code du type (une ancienne
  catégorie y reste) ; les variables de workflow `{categorie}`, `{categorieaconfirmer}` aussi.

## Renommer le fichier (v0.22.0, Black Projects 0.94.0)

Dans la section *Le fichier* de la fiche, un bouton crayon devant le champ *Fichier*
(« Renommer le fichier ») : une petite fenêtre, le nom **sans l'extension** (gardée ; tapée
quand même, elle n'est pas doublée). Le fichier reste dans son dossier
(`LibraryStore.renameFile`, par `fs.rename` : dans Obsidian, son gestionnaire de fichiers).

**Rien ne casse derrière** : la fiche prend le nouveau chemin, puis les liens vers le fichier
sont réécrits dans toutes les notes du coffre (hors dossiers cachés) — la note de sa pièce
d'analyse (`fichier: "[[…]]"`, le lien de son encadré), celle de l'analyse, toute autre note :
`[[chemin]]`, `[[chemin|texte]]`, `[[chemin#…]]`, `![[chemin]]`, `[texte](chemin)`, et
`[[nom]]` quand ce nom ne désignait que lui (un autre fichier du même nom ailleurs : non).
Obsidian le fait déjà selon son réglage « mettre à jour les liens » ; ce qu'il a fait n'est plus
à faire, et ce qu'il n'a pas fait (réglage désactivé) l'est quand même. Les notes passent par
l'index du coffre (`FileSystem.allFiles`, nouveau dans le port ; sans lui, ses dossiers sont
parcourus).

Un nom vide, qui commence par un point, ou qui contient `\ / : * ? " < > | # ^ [ ]` est
refusé ; un nom déjà pris dans le dossier aussi — rien ne bouge, et c'est dit. Sinon :
« Fichier renommé : « … » ; les liens de n note(s) mis à jour. » La fiche (sa note) garde son
nom.

## Relancer la recherche d'un champ ; la date au calendrier (v0.21.0, Black Projects 0.93.0)

À côté du crayon de chaque champ de la fiche (sauf *Rangé*), un bouton **Relancer la
recherche dans le document** (`ListItem.tools`, icône `refresh`) :

1. **Sans IA** (`LibraryStore.researchField`) : le texte du document relu, la première passe
   de ce champ refaite — la référence, l'édition, la révision ensemble. Trouvé sûrement : il
   est donné et confirmé (même s'il avait été changé à la main). Sinon il est **à
   confirmer**, avec ce qui a été lu (probable) ; la valeur qu'il a reste.
2. **Avec l'IA**, si ce n'est pas sûr : le workflow système du [module IA](ia.md) qui
   cherche ce champ (`setAiResearch`, que le module IA renseigne) est exécuté pour ce
   document (`runSystemWorkflow` du [module Workflows](workflows.md)) — avec le prompt, le
   persona, le skill choisis dans son étape ; le journal le garde.

Ce qui en sort est dit : « Titre : trouvé dans le document — … », « Émetteur : identifié
par l'IA — … », « Date du document : pas trouvé sûrement ; « 12 février 2026 » proposé, à
confirmer. » — et pourquoi l'IA n'a pas été demandée (son workflow désactivé, le module
absent).

**La date au calendrier** : dans *Classer…* et la fenêtre du crayon, le champ *Date du
document* a un bouton calendrier (`FormField.calendar`) qui ouvre celui du système ; la
date choisie est écrite `AAAA-MM-JJ`. La saisie reste libre (« 12 mars 2026 »,
« mars 2026 »).

Les petits boutons d'une liste gardent leur place sur chaque ligne (celle de *Rangé* n'en a
qu'un) : les icônes restent alignées.

## Modifier un champ de la fiche (v0.20.0, Black Projects 0.92.0)

Dans la section *Identification* de la fiche, chaque champ a un bouton crayon à gauche de son
icône (`ListItem.edit`, « Modifier : Titre ») :

- **Titre, Référence, Édition, Révision, Date du document, Catégorie, Émetteur,
  Étiquettes** : une petite fenêtre, ce seul champ, sa valeur (`editField`). Enregistré, il
  est **confirmé** : plus « à confirmer », plus « identifié par l'IA » (les mêmes
  `setTitle`, `setIdentity`, `setDate`, `setCategory`, `setIssuer`, `setTags` que les
  boutons de confirmation). Un titre vide n'est pas pris ; une date illisible est refusée
  (celle d'avant reste) ; les étiquettes, séparées par des virgules, sans doublon. Une
  notification le dit (« Émetteur : Agence spatiale. », « Édition : vide. »).
- **Rangé** ouvre *Déplacer…* ; **Langue**, *Langue…* ; **Référence et version** (à
  confirmer), *Classer…*.

Un champ vide à confirmer se lit « À confirmer » (et non plus « — — à confirmer »).

## La date des documents (v0.19.0, Black Projects 0.91.0)

Un nouveau champ : la **date du document** (celle de son édition, de sa publication, de sa
signature — pas celle de son entrée dans la bibliothèque), `dateDocument` en `AAAA-MM-JJ`, ou
`AAAA-MM` quand seul le mois est dit. Sur la fiche, en mots (« 12 février 2026 ») ;
**Classer…** l'accepte écrite comme on veut (« 12/02/2026 », « 12 février 2026 »,
« 2026-02-12 », « février 2026 ») — illisible, celle d'avant reste et c'est dit. En deux
passes, comme l'émetteur.

1. **Sans IA**, à l'entrée (`guessDocDate`) : **sûre** quand le document la dit avec son mot
   (« Date : », « Date d'édition : », « Émis le », « Issue date: », « Toulouse, le 1er mars
   2026 »), ou quand le nom du fichier (« CCTP_2026-02-14 », « PV_20260312 ») et le texte
   disent la même. Sinon `dateAConfirmer: true`, et `dateProbable` : la première date du
   début du texte — sauf celles qui suivent, sur leur ligne, une date limite, une remise,
   une échéance — ou celle du nom du fichier. Écrites en chiffres (jour/mois/année ; à
   l'anglaise quand le jour dépasse 12) ou en mots (français, anglais).
2. **Avec l'IA** : le workflow système du [module IA](ia.md) « Identifier avec l'IA la date
   d'un document… » (actif, `{dateaconfirmer}` pas vide) ; `dateFoundIn` ne la garde que si
   le document la dit (`setDateByAi`, `dateIdentifieePar: ia`).

Sur la fiche : **Prendre « … »**, **Pas de date** (ou **C'est juste**), **Classer…** ; le
filtre *Date à confirmer* ; `{date}` et `{dateaconfirmer}` au *document versé*.

## Les étiquettes des documents (v0.18.0, Black Projects 0.90.0)

En deux passes, comme la catégorie.

1. **Sans IA**, à l'entrée (`guessTags`) : **sûres** quand le document les dit avec leur
   mot (« Mots-clés : », « Keywords: », « Étiquettes : », « Tags : », séparées par des
   virgules ou des points-virgules ; au plus douze). Sinon `etiquettesAConfirmer: true`, et
   `etiquettesProbables` : les mots d'au moins six lettres qui reviennent au moins trois fois
   au début du texte (les cinq plus fréquents, sans les mots courants des marchés —
   « document », « titulaire », « prestations »…).
2. **Avec l'IA** : le workflow système du [module IA](ia.md) « Donner avec l'IA les
   étiquettes d'un document… » (actif, `{etiquettesaconfirmer}` pas vide) ; elle reçoit les
   étiquettes déjà en usage (`libraryTags`, les plus employées d'abord) pour garder un
   vocabulaire commun ; `tagsFoundIn` ne garde que celles que le document dit ou que la
   bibliothèque emploie déjà (`setTagsByAi`, `etiquettesIdentifieesPar: ia`).

Sur la fiche : **Prendre ces étiquettes** (ou **Ajouter ces étiquettes**, s'il en a déjà),
**Pas d'étiquettes** (ou **C'est juste**), **Classer…** ; dans la section « À confirmer
(n) » quand il y a autre chose ; le filtre *Étiquettes à confirmer* ; `{etiquettes}` et
`{etiquettesaconfirmer}` au *document versé*.

## La catégorie des documents (v0.17.0, Black Projects 0.89.0)

En deux passes, comme l'émetteur.

1. **Sans IA**, à l'entrée (`guessDocCategory`) : **sûre** quand celui qui dépose la donne
   (le type d'une pièce d'analyse, `PourItem.category`), quand le document la dit avec son
   mot (« Type de document : », « Nature du document : »), ou quand le nom du fichier et le
   texte disent la même (`categoryFromText` : les mots-clés longs des catégories —
   « clauses techniques », « bordereau des prix » — au début du texte ; pas les sigles
   courts, trop fréquents). Sinon : la catégorie du nom du fichier reste (comme avant),
   `categorieAConfirmer: true`, et `categorieProbable` : celle que le texte suggère.
2. **Avec l'IA** : le workflow système du [module IA](ia.md) « Identifier avec l'IA la
   catégorie d'un document… » (actif, `{categorieaconfirmer}` pas vide) ; elle choisit dans
   la liste des catégories (`libraryCategories` : celles de la bibliothèque, et celles en
   usage) ; une catégorie hors de la liste n'est pas gardée (`setCategoryByAi`,
   `categorieIdentifieePar: ia`).

Sur la fiche : **Prendre « … »**, **Garder la catégorie actuelle** (ou **C'est juste**, ou
**Pas de catégorie**), **Classer…** ; le filtre *Catégorie à confirmer* ;
`{categorieaconfirmer}` au *document versé*.

**Ce qui reste à confirmer, ensemble** : la langue, le titre, la catégorie, l'émetteur, la
référence — plusieurs, leurs messages sont regroupés dans une section « À confirmer (n) »
(`bibliotheque.document.a-confirmer`), dépliée, dont l'en-tête les nomme.

## L'émetteur des documents (v0.16.0, Black Projects 0.88.0)

En deux passes, comme le titre.

1. **Sans IA**, à l'entrée (`guessIssuer`, 3 000 caractères) : dit avec son mot —
   « Émetteur : », « Émis par », « Rédigé par », « Établi par », « Auteur : », « Société : »,
   « Organisme : », « Acheteur : », « Pouvoir adjudicateur : », « Maître d'ouvrage : »,
   « Issued by », « Prepared by », « Author: » — : **sûr**, il est donné. Sinon : pas
   d'émetteur, `emetteurAConfirmer: true`, et `emetteurProbable` : la première ligne qui a
   l'air d'un nom d'organisme (« … SAS », « … GmbH », « Agence … », « Centre … »,
   « Ministère … »). Une telle ligne n'est plus prise pour un **titre** probable.
2. **Avec l'IA** : le workflow système du [module IA](ia.md) « Identifier avec l'IA
   l'émetteur d'un document… » (actif, `{emetteuraconfirmer}` pas vide) ; certaine : donné
   s'il figure dans le document (`issuerFoundIn` : tel quel, ou 70 % de ses mots), vide
   s'il n'y en a pas (`setIssuerByAi`, `emetteurIdentifiePar: ia`).

Sur la fiche : **Prendre « … »**, **Pas d'émetteur** (ou **C'est juste** s'il en a un),
**Classer…** ; Identification : « … — à confirmer », « … — identifié par l'IA » ; le filtre
*Émetteur à confirmer* ; `{emetteur}`, `{emetteuraconfirmer}` au *document versé*.

## Le titre des documents (v0.15.0, Black Projects 0.87.0)

En deux passes, comme la référence et la langue.

1. **Sans IA**, à l'entrée (`guessTitle`, au début du texte, 3 000 caractères) : dit avec
   son mot — « Titre : », « Objet : », « Intitulé : », « Title: » — ou en titre de note
   (« # … ») : **sûr**, il remplace le titre tiré du nom du fichier (la fiche, elle, garde le
   nom du fichier). Sinon, le titre reste celui du nom du fichier, `titreAConfirmer: true`,
   et `titreProbable` : la première ligne qui a l'air d'un titre (des mots, ni une page, ni
   une date, ni une référence, ni une mention de confidentialité). Une image : rien.
2. **Avec l'IA**, quand ce n'est pas sûr : le workflow système du [module IA](ia.md)
   « Identifier avec l'IA le titre d'un document… » (actif, *document versé* dont
   `{titreaconfirmer}` n'est pas vide) ; certaine, et ses mots sont ceux du document
   (`titleFoundIn`, 70 %) : le titre est donné (`setTitleByAi`, `titreIdentifiePar: ia`).

Sur la fiche, à confirmer : un message — **Prendre « … »** (le probable), **Garder le titre
actuel** (ou **C'est juste** sans probable), **Classer…** ; Identification : « … — à
confirmer », « … — identifié par l'IA » ; le filtre *Titre à confirmer*. « Classer… »
enregistré : confirmé. Les workflows : `{titreaconfirmer}` au *document versé*.

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
