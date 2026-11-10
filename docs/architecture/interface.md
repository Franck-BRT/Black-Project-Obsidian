# Architecture — l'interface

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

**Décision (v0.10.0)** : l'interface de Black Projects s'écrit **une fois, en web, sans
Obsidian**, dans `src/ui/` ; Obsidian aujourd'hui et l'application de bureau (Tauri)
demain ne font que l'**accueillir**. Rien n'est à redévelopper pour l'application Rust.

## Pourquoi c'est possible

Tauri affiche une page web dans une fenêtre ; Obsidian aussi (il tourne dans Electron).
Une interface en HTML, CSS et TypeScript qui ne parle qu'au DOM tourne donc à l'identique
dans les deux.

## Les couches

```
┌──────────────────────────────────────────────────────────────────┐
│ Hôtes (minces)                                                   │
│  src/obsidian/  onglet « Black Projects » (homeView.ts) ; ports   │
│                 branchés sur l'API d'Obsidian                     │
│  demo/          page web autonome, ports en mémoire (préfigure    │
│                 desktop/)                                         │
│  desktop/       plus tard : la fenêtre Tauri ; ports en Rust      │
└───────────────┬──────────────────────────────────────────────────┘
                │ un élément HTML + un AppHost (src/ui/host.ts)
┌───────────────▼──────────────────────────────────────────────────┐
│ src/ui/   l'interface, en Preact (JSX)                           │
│  coquille (navigation, en-tête), accueil, composants, thèmes     │
└───────────────┬──────────────────────────────────────────────────┘
                │ lit des descriptions (des données) : src/core/views.ts
┌───────────────▼──────────────────────────────────────────────────┐
│ src/modules/  décrivent ce qu'ils montrent ; jamais de DOM ni de │
│               framework                                          │
├──────────────────────────────────────────────────────────────────┤
│ src/core/     ports, registre, réglages (dont l'apparence), vues │
└──────────────────────────────────────────────────────────────────┘
```

### Les modules décrivent, l'interface dessine

`src/core/views.ts` définit ce qu'un module peut montrer, **en données** :

- des **tuiles** pour l'accueil (`TileSpec`) : un libellé, une icône, une couleur
  (décorative), le module qui la propose, présente ou non par défaut, une action, et une
  **pastille** facultative calculée à l'affichage (« J-5 », un nombre, « ! ») ;
- des **sections du tableau de bord** (`HomeSection`) : un titre, et des blocs — actions, cartes,
  indicateurs, listes, messages ; une carte porte des badges, des faits, une échéance, une
  note en étoiles, des actions ;
- des **entrées de navigation** (`NavEntry`).

Un module les déclare à son activation par `context.views` ; chaque section est chargée
à part (`load`), à chaque affichage : un module lent ou en panne n'empêche pas les autres
de s'afficher. Les actions sont des fonctions (`run`) : l'interface n'a pas à savoir ce
qu'elles font. Aujourd'hui : l'AO (actions rapides, une carte par analyse avec sa date
limite de remise), les Exigences (la bibliothèque en chiffres), les Workflows (dernières
exécutions), l'IA (la connexion et un modèle par usage).

### L'interface (`src/ui/`)

| Fichier | Rôle |
| --- | --- |
| `index.tsx` | `mountApp(élément, hôte)` : monte l'interface ; `refresh()`, `destroy()` |
| `host.ts` | `AppHost` : tout ce que l'hôte donne (textes, langue, sections, navigation, apparence, thème de l'hôte, heure) |
| `shell.tsx` | la coquille : marque, navigation, en-tête (bonjour, date, rafraîchir, apparence), page ; les attributs du thème sur la racine |
| `springboard.tsx` | l'**accueil** à tuiles, modifiable par l'utilisateur |
| `tiles.ts` | l'agencement des tuiles (choisies, par défaut, à ajouter, déplacer) : testé seul |
| `home.tsx` | le **tableau de bord** : les sections des modules, en deux colonnes, rangées par l'utilisateur |
| `history.ts` | l'historique de navigation : la page précédente et son titre, pour « Retour » |
| `page.tsx` | la page d'un module (les analyses…) : chiffres, actions, cartes, recherche et filtres |
| `sidemenu.tsx`, `menu.ts` | la barre de gauche rangée par l'utilisateur (Accueil en haut, Paramètres en bas) ; son rangement, sans rien dessiner |
| `dashboard.ts` | le rangement du tableau de bord (monter, changer de colonne, masquer, réduire), sans rien dessiner |
| `components.tsx` | boutons, badges, échéances, cartes, indicateurs, listes, messages |
| `appearance.tsx` | le panneau d'apparence |
| `theme.ts`, `styles.ts` | les thèmes (variables CSS) et les styles, posés une fois dans le document |
| `icons.tsx` | les icônes, dessinées pour Black Projects |
| `logic.ts` | ce qui se calcule sans dessiner (jours restants, urgence) : testé seul |
| `dialogs/frame.tsx` | le cadre de toute fenêtre (`openDialog`) : fond, titre, fermer, Échap, focus gardé dans la fenêtre et rendu à la fermeture, thème appliqué |
| `dialogs/windows.tsx` | les fenêtres du port `Ui` : choix (et fichier du coffre), formulaire, confirmation, cases à cocher, message, liste filtrable, texte à copier |
| `dialogs/moduleWindow.tsx` | la fenêtre « Fonctions » d'un module : ses réglages et ses fiches ; le même contenu en page de l'onglet (`ModuleFunctionsPage`) |

**Preact** (licence MIT, environ 4 Ko) : des composants avec état, en JSX, compilés par
esbuild ; il n'est utilisé que dans `src/ui/`. Les modules ne le voient jamais : changer de
technique de dessin ne toucherait aucun module.

### Ce qui reste propre à chaque hôte

| Besoin | Obsidian | Application de bureau |
| --- | --- | --- |
| Où dessiner | un onglet (icône de la barre, commande « Ouvrir l'accueil », ouverture au démarrage réglable) | la fenêtre |
| Fichiers, réseau, clé, messages | API d'Obsidian | commandes Rust (`invoke`) |
| Ouvrir une note | l'éditeur d'Obsidian (dans un nouvel onglet depuis l'accueil) | un lecteur Markdown de `src/ui` (à écrire) |
| Thème de l'hôte | `body.theme-dark`, évènement `css-change` | `prefers-color-scheme` |

L'interface n'appelle jamais Obsidian ni Tauri : elle passe par l'`AppHost`, et les
modules par les ports.

### Les règles, vérifiées

- `src/ui` n'importe ni `obsidian`, ni `electron`, ni un module Node, ni un module de
  `src/modules`, ni l'adaptateur ; le cœur et les modules n'importent pas `src/ui`
  (`pnpm check:modules`, règle ESLint `no-restricted-imports`).
- Tous les styles sont sous `.bp-ui` : l'interface ne change rien à l'apparence de l'hôte
  (vérifié par un test).
- Et l'hôte ne change rien à l'interface : Obsidian habille tous les `<button>`
  (`button:not(.clickable-icon)` : hauteur fixe de 30 px, fond, ombre, texte sur une
  ligne) avec une priorité plus forte qu'une classe seule. Chaque règle des composants est
  donc écrite sous la racine (`.bp-ui .bp-tile`, préfixe posé par `scopeCss` dans
  `styles.ts`) : deux classes l'emportent sur tout sélecteur d'élément de l'hôte ; et
  `.bp-ui button` remet à zéro hauteur, ombre, alignement et retour à la ligne (v0.12.1,
  après des tuiles écrasées sur une pastille blanche dans Obsidian).
- La navigation de gauche reste en place : seule la page (`.bp-main`) défile, la barre
  (`.bp-side`) a son propre défilement si elle dépasse ; changer de page repart du haut.
  Dans Obsidian, la zone de contenu de l'onglet perd sa marge et son défilement
  (`styles.css`, `.bp-home-host`) pour ne pas tout faire défiler autour. Sur un écran
  étroit (moins de 700 px), la navigation passe en haut et tout défile ensemble (v0.13.1).

## Thèmes et accessibilité

L'apparence se règle dans l'accueil (bouton **Apparence**) ou dans les réglages ; elle est
gardée dans les réglages communs (`appearance`), la même partout. Quatre réglages qui se
combinent :

| Réglage | Choix |
| --- | --- |
| Mode | automatique (suit l'hôte), clair, sombre |
| Couleurs | standard ; **rouge-vert** (deutéranopie, protanopie : bleu = va, jaune = attention, vermillon = ne va pas) ; **bleu-jaune** (tritanopie : sarcelle, magenta, rouge) ; **monochrome** (achromatopsie : l'état par le trait — plein, tirets, double) |
| Lecture | standard ; **facilitée (dys)** : police lisible (OpenDyslexic, Lexend, Atkinson Hyperlegible si installées, sinon Verdana), texte +12 %, interlettrage 0,05 em, espacement des mots 0,16 em, interligne 1,8, fond crème (pas de blanc pur), texte non noir, pas d'italique, lignes de 68 caractères au plus, liens soulignés |
| Taille | normale (15 pt), grande (17 pt), très grande (19,5 pt) |
| Mouvement | comme le système (coupé si le système demande moins d'animations), réduit |

Et partout :

- **une couleur ne dit jamais rien seule** : chaque état a son icône (✓, triangle, croix,
  i, horloge) et son mot ;
- contraste d'au moins **4,5:1** pour le texte et les états, dans chaque palette, claire et
  sombre (vérifié : le plus faible est 5,1:1) ;
- de vrais boutons, des titres, des listes, des régions nommées ; le panneau d'apparence se
  manie au clavier (boutons radio groupés, Échap pour fermer) ; un contour de focus épais ;
- pas de majuscules forcées ; des cibles d'au moins 36 px ; la mise en page passe à une
  colonne sur un écran étroit.

## La démonstration hors d'Obsidian

`pnpm run demo` construit `demo/dist/index.html` : les vrais modules, un coffre en mémoire
garni d'un dossier fictif, et la même interface — la preuve qu'elle tourne sans Obsidian,
et le point de départ de `desktop/`. L'adresse accepte `?mode=dark&vision=red-green&reading=dys&size=large`
pour forcer une apparence (captures, recette).

## Les pages des modules (v0.15.0)

Un module peut ouvrir une **page** dans l'onglet de Black Projects, comme le tableau de
bord, plutôt qu'une fenêtre : la liste des analyses (v0.15.0), la bibliothèque d'exigences
(v0.16.0), les workflows (v0.17.0), l'IA (v0.18.0). Une carte peut porter un extrait de texte (`Card.text`, trois lignes au plus),
que la recherche lit aussi. Il la déclare par
`views.page({ id, title, icon, load })` ; `load` rend une `PageView` en données :

- un sous-titre, des boutons en tête ;
- des blocs (indicateurs, cartes, listes, messages — les mêmes que le tableau de bord — et
  du **texte** en paragraphes, `{ kind: 'text', title?, paragraphs, preformatted? }`, pour
  une note lue dans l'interface — `preformatted` : tel quel, un bloc de code ; la recherche
  n'en garde que les paragraphes qui contiennent les mots ; une liste peut porter son
  `intro`, du texte dans le même cadre) ;
- des **sections repliables** (Black Projects 0.72.0) : `{ kind: 'section', id, title,
  subtitle?, icon?, collapsed?, blocks }` — un intitulé-bouton (`aria-expanded`) et ses
  blocs, d'autres sections comprises (des sous-sections, en retrait). `collapsed` : repliée
  d'origine ; ce que l'utilisateur en fait est retenu le temps de la session (par `id`,
  même après « Rafraîchir »). La recherche et les filtres trient dedans (`filterBlocks`
  pose `found`) : les sections sans résultat disparaissent, les autres s'ouvrent ;
- des **vues** facultatives pour les cartes (Black Projects 0.73.0) : `layouts` — `cards`
  (la grille, d'origine), `list` (une ligne par carte : icône, titre et sous-titre, badges,
  faits, boutons en icônes), `table` (nom, état — les badges —, une colonne par fait, les
  boutons ; le titre seul est le lien). Un sélecteur « Affichage » ; la vue choisie est
  retenue par page sur l'appareil (`localStorage`, `bp.page.layout.<page>`, sans erreur
  s'il manque). `LayoutContext` la donne aux blocs de cartes, sections comprises ;
- un **regroupement** facultatif : `grouping` — `{ label, current, options }`, des boutons à
  bascule (« Regrouper par ») que la page interprète (elle se redessine ensuite) ;
  `src/core/grouping.ts` (`grouped`, `groupingOf`, `groupingSelector`) range des cartes en
  sections, une par groupe, et retient le choix de chaque page le temps de la session ;
- un **logigramme** (Black Projects 0.76.0) : `{ kind: 'flowchart', label, nodes }` — des
  formes de haut en bas (`FlowNode` : `start` en pilule, `decision` en hexagone avec sa
  branche « non » à droite et « oui » sur la flèche, `step` en rectangle, `end` en pilule
  pointillée), reliées par des flèches ; une forme qui a `open` est un bouton ; `tone`
  (`data-tone`) colore son bord. HTML et CSS (pas de SVG) : le texte se coupe, les thèmes
  s'appliquent, et c'est une liste ordonnée pour les lecteurs d'écran (`label` la résume) ;
  Une forme `ai` (0.86.0) — une étape qui demande l'IA — a un fond turquoise
  (`data-ai`) ; `legend` dit les couleurs sous le logigramme ;
- un **fil d'Ariane** facultatif (Black Projects 0.77.0 ; 0.78.0 : un champ de la page,
  plus un bloc) : `breadcrumb` — `{ label, items }`, où l'on est (« Bibliothèque ›
  Documents › Normes »), dessiné **tout en haut de la page**, au-dessus du titre (la coquille
  le reçoit par `onCrumbs`), avant le retour, le sous-titre et les boutons ; chaque étape un bouton (`run`), la dernière sans lien
  (`aria-current="location"`) ; un `nav` qui passe à la ligne ;
- un **glisser-déposer** de fichiers facultatif (Black Projects 0.79.0) : `drop` — un
  `FileDrop` (`label`, `run(fichiers)`) et une `hint`, dite sous les boutons ; une carte
  peut avoir le sien (`Card.drop`, en cartes, liste ou tableau). `src/ui/drop.tsx`
  (`useFileDrop`) : pendant le survol, la page s'entoure de pointillés et un bandeau dit
  le libellé de la cible la plus proche (une carte survolée le remplace : `DropLabel`) ;
  au dépôt, les fichiers sont lus (un dossier est laissé de côté), remis à `run`, puis la
  page se redessine. Le dépôt est pris avant le navigateur ou Obsidian (`preventDefault`).
  Toujours en plus d'un bouton qui fait la même chose ;
- une **recherche** facultative : elle garde les cartes et les éléments de liste qui
  contiennent tous les mots tapés (titre, sous-titre, badges, faits), sans tenir compte
  des accents ni des majuscules ;
- des **filtres** facultatifs, à bascule (« Tout » en plus) : une carte répond à ceux de ses
  `tags`. Le nombre affiché est annoncé (« 1 sur 2 affiché(s) ») ; il ne compte que ce que
  la recherche ou le filtre trie (un filtre ne vise que les cartes : une liste — un journal
  — ne compte pas avec lui). Un bloc vidé dit, à sa place, que rien ne correspond.

**Une note Markdown en blocs** : `noteBlocks` (`src/core/markdown.ts`) lit une note — une
note produite par l'analyse, une page de la documentation — en blocs : un titre `##` par
cadre ; un tableau en liste ; des puces avec lien ou intitulé (« **Libellé** : … ») en liste,
les autres en texte (« • ») ; une phrase suivie de sa liste dans le même cadre ; un bloc de
code tel quel (fermé par la même clôture : « ```` » autour d'un exemple qui contient
« ``` ») ; une puce qui continue à la ligne suivante, rejointe.

**Les notes qui ont une page** (0.36.0) : un module déclare, par `views.notePage(résolveur)`,
lesquelles de ses notes il sait montrer en page (une analyse, une pièce, une exigence, le
calendrier…) ; `ViewsRegistry.pageForNote(chemin)` interroge les modules dans l'ordre (le
premier qui la connaît ; une erreur n'arrête pas les autres). L'hôte en fait
`ModuleContext.showNote(chemin)` : la page dans l'onglet, sinon la note. Ainsi un module
ouvre la note d'un autre (un workflow, le calendrier qu'il a écrit) sans le connaître.

**La documentation en page** (0.35.0) : `DOCS_PAGE` (`core.documentation`, `docsPage`,
`src/core/docsPage.ts`) — sans paramètre, le sommaire (l'accueil de la documentation, une
carte par page) ; `docPageOf(chemin)`, une page, lue par `noteBlocks` sans son en-tête ni
l'encadré « écrite dans le coffre », ses liens vers d'autres pages ouverts dans l'onglet,
les pages précédente et suivante. Les pages sont celles que `documentationPages` écrit dans
le coffre : rien à écrire pour les lire. « Écrire dans le coffre » (sans quitter la page),
« Ouvrir dans le coffre » quand la note y est.

Une page peut prendre un **paramètre** : `showPage('workflows.fiche?wf-1')` (`pageWith`)
appelle `load('wf-1')` — la fiche d'un workflow ; la fiche d'une analyse ou d'une exigence prend
le chemin de sa note, encodé (`ao.fiche?Appels%20d'offres%2F…`). Une carte peut montrer
son texte en entier (`Card.wrap` : la formulation d'une exigence). En lecture dys, les
cases de chiffres s'élargissent et leurs valeurs rapetissent un peu : un mot n'y est
jamais coupé. Elle peut donner son propre titre
(`PageView.title` : le nom du workflow), un lien de retour (`back` : « ← Tous les
workflows »), et dépendre d'une autre page (`PageSpec.parent`) : l'entrée du menu de la
liste reste marquée. Des cartes peuvent former un groupe titré avec ses boutons
(`title`, `actions` : « Actions (2) » et « Ajouter une action »).

Un bloc `diff` (`{ kind: 'diff', parts, labels }`) compare deux textes, paragraphe par
paragraphe (`diffParagraphs`, `src/core/diff.ts`) : les gardés en retrait, les retirés barrés
(`<del>`), les ajoutés surlignés (`<ins>`), chaque retiré suivi de celui qui le remplace ; les
lecteurs d'écran entendent « Retiré : … », « Ajouté : … ».

Un bloc `journey` (un **parcours**) dessine des **étapes** de gauche à droite, reliées par des
flèches, et dans chacune ses **phases** en tuiles (`JourneyPhase` : icône sur sa couleur
`TileColor`, comme les tuiles de l'accueil ; `caption`, `detail`, `status` en pastille,
`progress` — `done` (coche), `current` (anneau), `todo` (pâle), `skipped` (grisée) —, `open`,
`tools`). Une étape peut avoir une tuile « + » (`add`), le parcours aussi (après la dernière
étape) ; son titre peut ouvrir ce qu'il dessine (`open`) ; `compact` : en miniature. Des **phases englobantes** (`spans` : `JourneySpan`, `from`, `to`, le rang
de leurs première et dernière étapes) sont des bandeaux au-dessus des étapes qu'elles couvrent ;
le parcours est une grille dont les colonnes sont ses étapes et ses flèches. Une carte
peut porter une couleur (`Card.color`) : son icône sur cette couleur. Un choix d'une liste
(`Choice.preview`) peut montrer une couleur de tuile ou une icône : les fenêtres de formulaire
montrent, à la place de la liste du navigateur, un bouton qui ouvre une liste où chaque choix a
son aperçu à gauche (flèches, Entrée, Échap). Un choix multiple (`PickManyView.create`) peut avoir
un bouton pour créer un choix : sa fenêtre s'ouvre par-dessus, le choix créé s'ajoute en tête,
coché.

Un bloc `markdown` (`{ kind: 'markdown', text, title?, empty? }`) montre du Markdown **mis en
forme** — titres, listes, tableaux, citations, code ; gras, italique — par `src/ui/markdown.tsx` :
réduit et sûr (le texte devient des éléments, jamais du HTML injecté ; un lien, son texte). Le
texte extrait d'un document s'y lit. Un bouton (`ViewAction`) peut être **grisé** (`disabled`, son infobulle dit pourquoi). Un module
dont les pages changent sans que le coffre bouge (une lecture par l'IA qui avance) le dit par
`views.changed()` : les pages ouvertes se redessinent (`ViewsRegistry.onChanged`, écouté par
l'hôte).

Les **formules mathématiques** en LaTeX — `$…$` (ou `\(…\)`) dans une phrase, `$$…$$` (ou `\[…\]`)
seules — sont dessinées par la plateforme (`setMathRenderer` : dans Obsidian, `renderMath`, son
MathJax, chargé au démarrage — `loadMathJax`) ; sans elle, leur LaTeX est montré à part. « 10 $
et 20 $ » reste du texte. Une formule qui n'est qu'un symbole (`$\square$`), et les symboles
LaTeX écrits hors formule (`\boxtimes`, `\leq`, `\alpha`…), deviennent leur caractère (☒, ≤, α) ;
`\text{…}`, son texte. Le **HTML** qu'une lecture (l'IA, la vision) écrit est compris, en
éléments créés — jamais injecté : `<br>` (retour à la ligne, aussi dans une cellule), `<sup>`,
`<sub>`, `<b>`, `<i>`, `<u>`, `<s>`, `<mark>`, les tableaux `<table>` (une cellule fusionnée :
suivie de cellules vides), les entités (`&nbsp;`, `&amp;`, `&#9744;`) ; les balises de mise en
page (`<span>`, `<div>`, `<p>`…) et les commentaires sont retirés, leur texte gardé ; une balise
inconnue (`<script>`) reste du texte. Les échappements Markdown (`\*`, `\%`) donnent leur
caractère ; les cases d'une liste (`- [ ]`, `- [x]`), ☐ / ☒. Une liste « aérée » (des lignes vides entre ses éléments) reste une liste ; une liste coupe la
phrase qu'elle suit (comme dans Obsidian) ; une liste numérotée garde son premier numéro. Des
lignes `| … |` sans ligne de séparation y sont aussi un tableau
(la première en en-tête) ; les colonnes vides de bout en bout en sont retirées (`src/core/tables.ts`).

Une liste peut porter un intitulé (`title` : « Dernières exécutions ») ; ses éléments
peuvent porter des filtres (`ListItem.tags`, le journal) : elle se filtre et compte alors
comme des cartes. Un élément peut porter de petits boutons (`ListItem.tools`), avant sa
marque, dont l'intitulé (« Modifier : Titre », « Relancer la recherche… ») est dit au survol
et aux lecteurs d'écran — les champs d'une fiche ; leur place est gardée sur chaque ligne de
la liste, les marques restent alignées. Un champ de texte d'une fenêtre peut avoir un
calendrier (`FormField.calendar`) : un bouton à côté ouvre celui du système, la date
choisie est écrite `AAAA-MM-JJ`, la saisie reste libre. Les boutons sans
fond propre (titre d'une carte, d'un élément de liste, « − » d'une tuile) ont aussi leur
style au survol : sans lui, Obsidian leur pose un fond clair. Après chaque bouton
d'action, l'interface redessine pages, tableau de bord et pastilles (`AfterAction`) : une
action peut changer ce qui est montré sans toucher au coffre (activer un workflow).

On ouvre une page par `context.showPage(id)` : l'hôte Obsidian ouvre (ou montre) l'onglet
de Black Projects sur cette page ; la démonstration change de page. Une entrée du menu ou
une tuile qui ouvre une page le dit (`page`) : elle est marquée « page en cours » quand on
y est. Le titre de la page et son icône sont en tête ; une page inconnue (module
désactivé) ramène à l'accueil. Le dessin est dans `page.tsx` (`ModulePage`, `filterBlocks`,
testés seuls). Chaque demande d'affichage compte, même pour la page déjà demandée : on
a pu aller ailleurs entre-temps.

Les **faits** d'une carte (`Card.facts`) sont des cases courtes (un chiffre et ce qu'il
compte) ; une valeur longue — une phrase, comme la note de l'IA sur une traduction —
prend toute la largeur de la carte, en texte courant (`bp-fact is-long`, v0.44.0).

## « Retour » : le niveau supérieur (Black Projects 0.84.0)

**« ← Retour : … »** mène au **niveau supérieur**, plus à la page vue juste avant : l'étape
d'avant du fil d'Ariane (`PageView.breadcrumb`), sinon le lien que la page donne
(`PageView.back`, « Toutes les analyses » — la page le remet à la coquille par `onBack`
et ne le dessine plus), sinon sa page parente (`PageSpec.parent`), sinon l'accueil ; les
fonctions d'un module ramènent aux paramètres. Aussi **Alt + ↑**. L'historique (ci-dessous)
reste à **Alt + ←** et au bouton « précédent » de la souris : la page d'avant, comme dans
un navigateur.

## Le retour à la page précédente (v0.22.0)

L'onglet garde un **historique** (`history.ts`, testé seul) : chaque page quittée y entre
avec son titre, d'où qu'on soit venu — menu, tuile, carte, lien, commande de l'hôte
(`showPage`). **« ← Retour : <page précédente> »** s'affiche sous l'en-tête dès qu'il y a
une page avant, et y ramène ; aussi **Alt + ←** et le bouton « précédent » de la souris.
La zone de page est focalisable (sans contour) pour qu'un clic y garde le clavier. Trente
pages au plus sont retenues. Quand il y a un historique, le lien propre à une page
(« ← Toutes les analyses », `PageView.back`) s'efface : il ne reste que quand on arrive
tout droit sur la page (une commande à l'ouverture de l'onglet).

## La barre de gauche (v0.14.0)

**Accueil** est toujours en haut, **Paramètres** toujours en bas (l'hôte le fournit par
`openSettings` ; sans lui, pas d'entrée du bas) : ils ne se déplacent ni ne se masquent.
Depuis la 0.33.0, `openSettings` ouvre la page des paramètres dans l'onglet
(`SETTINGS_PAGE`, `src/core/settingsPage.ts`, décrite en données comme les pages des
modules et déclarée par l'hôte) ; `AppHost.settingsPage` la nomme, pour que l'entrée soit
« page en cours » sur elle. L'onglet de réglages de la plateforme reste, ouvert par le
bouton « Réglages dans Obsidian » de la page (`openHostSettings`).
Entre les deux, le menu que l'utilisateur range (`sidemenu.tsx`, logique dans `menu.ts`,
testée seule) :

- le **catalogue** : le tableau de bord et les entrées de navigation des modules (montrées
  par défaut), puis toutes les tuiles des modules (à ajouter), sans double emploi avec une
  entrée ni avec Accueil ou Paramètres ; une entrée tirée d'une tuile a l'identifiant
  `tuile:<id de la tuile>` ;
- **Modifier le menu** (en bas, sous la séparation, juste au-dessus de Paramètres ; en
  modification, ce bas de barre reste visible pendant qu'on fait défiler) : glisser-déposer, boutons Monter, Descendre, Retirer ; « Ajouter au
  menu », rangé par module ; « Rétablir le menu par défaut ». Le focus suit l'entrée
  déplacée (après un retrait, l'entrée voisine), chaque changement est annoncé ; Accueil
  et Paramètres sont marqués d'un cadenas ; la barre s'élargit à 300 px le temps de ranger ;
- le rangement (`NavLayout` : `shown`, `hidden`) est gardé dans les réglages communs
  (`navMenu`, `null` : celui des modules). `hidden` retient les entrées par défaut
  retirées, même celles d'un module désactivé pour l'instant ; l'entrée d'un module
  activé depuis se place d'elle-même à la fin.

Les trois zones (haut, menu, bas) sont des conteneurs distincts : Preact ne mêle pas leurs
éléments au passage en modification. Sur écran étroit, le menu passe en haut, en rangée.

## L'accueil et le tableau de bord (v0.12.0)

Deux pages, dans la navigation de gauche :

- **Accueil** — le bonjour (bonjour, bon après-midi, bonsoir) et la date, puis une grille
  de **tuiles**, à la manière d'un écran de téléphone. Chaque tuile lance ce que fait un
  module (nouvelle analyse, analyses, importer des pièces, calendrier, interroger le
  dossier, exigences, workflows, IA, paramètres…) et peut porter une **pastille** : la
  prochaine date limite de remise (« J-5 », rouge à 7 jours ou moins), le nombre
  d'exigences faibles, les échecs récents des workflows, une IA pas réglée (« ! »). La
  pastille est aussi dite aux lecteurs d'écran, dans le nom de la tuile.
  **Modifier l'accueil** : les tuiles tremblent (pas si le mouvement est réduit) ; le bouton
  − retire, on glisse pour déplacer (ou Alt + flèches au clavier, chaque déplacement
  annoncé), et la liste **Tuiles à ajouter**, rangée par module, ajoute d'un clic ;
  « Rétablir l'accueil par défaut ». L'agencement est gardé dans les réglages communs
  (`homeTiles`) ; une tuile dont le module est désactivé disparaît sans casser le reste.
- **Tableau de bord** — les informations des modules (les sections décrites plus haut).
  Une tuile y mène, présente par défaut ; aussi la commande « Ouvrir le tableau de bord de
  Black Projects ».
  **Rangé par l'utilisateur (v0.13.0)** : chaque section se **réduit** à son titre (bouton
  à flèche, `aria-expanded`) — elle n'est alors plus chargée. **Modifier le tableau de
  bord** montre les sections en fiches, dans leurs deux colonnes : glisser-déposer (sur une
  autre fiche ou sur « Déposer ici », y compris d'une colonne à l'autre), ou les boutons
  Monter, Descendre, Changer de colonne, Masquer ; chaque changement est annoncé, et le
  focus suit la section déplacée. **Sections masquées** : « Afficher » la remet à la fin de
  sa colonne par défaut. Le rangement (`DashboardLayout` : `main`, `side`, `hidden`,
  `collapsed`) est gardé dans les réglages communs (`dashboard`, `null` : celui des
  modules) ; une section d'un module activé depuis se place d'elle-même dans sa colonne
  par défaut, celle d'un module désactivé disparaît. La logique est dans `dashboard.ts`,
  testée seule. Pour la nommer sans la charger, chaque `HomeSection` porte un `title`
  (et une `icon`).

## Les fenêtres (v0.11.0)

Toutes les fenêtres de Black Projects sont celles de `src/ui` — plus aucune `Modal`
d'Obsidian. Le port `Ui` des modules est implémenté par `dialogWindows(hôte)` ; l'hôte
n'ajoute que ce qui lui est propre :

| Ce que fait le port `Ui` | Qui le fait |
| --- | --- |
| choisir une option, remplir un formulaire, confirmer, cocher, lire un message, parcourir une liste, copier un texte | `src/ui` (les mêmes fenêtres partout) |
| choisir un fichier du coffre | `src/ui` dessine ; l'hôte donne la liste des fichiers (Obsidian : le coffre, le fichier ouvert d'abord) |
| ouvrir une note, connaître la note ouverte, prendre des fichiers sur l'ordinateur | l'hôte |

La fenêtre « Fonctions » de chaque module (`openModuleWindow`) dessine ses réglages —
paires (« .tot lu comme .xml »), texte avec ou sans menu de choix, boutons de commande,
interrupteurs par colonnes (le rangement des types), oui / non, secret (rangé dans le
trousseau) — puis ses fiches (résumé, familles, faits colorés avec icône et mot,
étiquettes, interrupteur d'affichage). Elle se redessine sur place : le défilement ne
bouge pas quand on bascule un interrupteur.

Depuis la 0.34.0, ce contenu (`ModuleFunctions`) est aussi une **page** de l'onglet :
`MODULE_PAGE` (`core.fonctions?<id du module>`, `modulePageOf`, `src/core/settingsPage.ts`)
— le shell la dessine lui-même (`ModuleFunctionsPage`, sans cadre de fenêtre, ce que fait
le module en tête, le titre « Module — Fonctions »), avec ce que l'hôte lui donne
(`AppHost.moduleWindow(id)`, ce que reçoit la fenêtre ; `null` : un module inconnu, et
c'est l'accueil) ; l'entrée Paramètres est « page en cours ». Les cartes des modules de
la page Paramètres et les liens des modules (`ModuleContext.openWindow` : « Régler la
connexion », « Formats de fichiers », « Régler maintenant ») y mènent. L'onglet de
réglages d'Obsidian garde la fenêtre : une page de l'onglet serait cachée derrière lui.

Accessibilité des fenêtres : `role="dialog"` et `aria-modal`, titre qui nomme la fenêtre ;
le focus va au premier champ, reste dans la fenêtre (Tab, Maj+Tab) et revient où il était
à la fermeture ; Échap ou un clic sur le fond ferment ; chaque champ a son libellé lié,
l'obligatoire est marqué et annoncé (`aria-required`, `aria-invalid`, message sous le
champ, alerte en tête) ; un choix se parcourt aux flèches (`listbox`, option active
annoncée) ; les lignes d'une liste s'atteignent au clavier (Entrée) ; une confirmation qui
détruit met le focus sur « Annuler ».

La démonstration (`pnpm run demo`) utilise ces mêmes fenêtres : ses commandes s'exécutent
pour de vrai (créer une analyse, parcourir les exigences, régler l'IA…), une note s'y lit
dans une fenêtre de texte.

## La suite

1. Des pages au-delà de l'accueil (une analyse, la bibliothèque), décrites de la même façon.
2. `desktop/` : Tauri, les ports en Rust, un lecteur Markdown.
3. Les réglages généraux (aujourd'hui la page de réglages d'Obsidian) en page de `src/ui`,
   pour l'application de bureau.
