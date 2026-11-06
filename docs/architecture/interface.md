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
  du **texte** en paragraphes, `{ kind: 'text', title?, paragraphs }`, pour une note lue
  dans l'interface ; la recherche n'en garde que les paragraphes qui contiennent les mots) ;
- une **recherche** facultative : elle garde les cartes et les éléments de liste qui
  contiennent tous les mots tapés (titre, sous-titre, badges, faits), sans tenir compte
  des accents ni des majuscules ;
- des **filtres** facultatifs, à bascule (« Tout » en plus) : une carte répond à ceux de ses
  `tags`. Le nombre affiché est annoncé (« 1 sur 2 affiché(s) ») ; il ne compte que ce que
  la recherche ou le filtre trie (un filtre ne vise que les cartes : une liste — un journal
  — ne compte pas avec lui). Un bloc vidé dit, à sa place, que rien ne correspond.

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

Une liste peut porter un intitulé (`title` : « Dernières exécutions ») ; ses éléments
peuvent porter des filtres (`ListItem.tags`, le journal) : elle se filtre et compte alors
comme des cartes. Les boutons sans
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
