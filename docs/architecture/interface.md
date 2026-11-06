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

- des **sections d'accueil** (`HomeSection`) : un titre, et des blocs — actions, cartes,
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
| `home.tsx` | l'accueil : les sections des modules, en deux colonnes |
| `components.tsx` | boutons, badges, échéances, cartes, indicateurs, listes, messages |
| `appearance.tsx` | le panneau d'apparence |
| `theme.ts`, `styles.ts` | les thèmes (variables CSS) et les styles, posés une fois dans le document |
| `icons.tsx` | les icônes, dessinées pour Black Projects |
| `logic.ts` | ce qui se calcule sans dessiner (jours restants, urgence) : testé seul |

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

## La suite

1. Redessiner les fenêtres actuelles (listes, formulaires, choix — `src/obsidian/ui.ts`)
   avec les composants de `src/ui`, pour la même apparence partout et pour l'application.
2. Des pages au-delà de l'accueil (une analyse, la bibliothèque), décrites de la même façon.
3. `desktop/` : Tauri, les ports en Rust, un lecteur Markdown.
