# Module — Exigences (`exigences`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `exigences` |
| Version | 0.7.0 (Black Projects 0.10.0) |
| Emplacement | `src/modules/exigences/` |
| Interface publique | `src/modules/exigences/index.ts` |
| Requiert | [Lecture de fichiers](lecture-fichiers.md) (`lecture-fichiers`) |
| Utilisé par | Analyse d'appels d'offres (`ao`) : extraction des exigences des pièces, qualité, relecture |
| S'appuie sur | [IA](ia.md) (`ia`), s'il est actif : relecture, traduction, doublons par le sens |
| Étape | 3 du [plan d'intégration](../plan-integration.md) — le socle des exigences |

Documentation utilisateur (écrite dans le coffre) : `src/modules/exigences/doc/Exigences.md`.

## Ce qu'il fait

| Commande | Rôle |
| --- | --- |
| Nouvelle exigence | Formulaire (catégorie, titre, formulation, type, statut, criticité, vérification, source, justification) ; identifiant attribué ; la note est écrite et ouverte |
| Exigences : liste, filtres et fiches | La bibliothèque : recherche, filtres par catégorie, type, statut, criticité ; une ligne → « Modifier la fiche » ou « Ouvrir la note » ; « Nouvelle exigence » ; la liste revient aux mêmes filtres |
| Modifier l'exigence (note ouverte) | La fiche de l'exigence ouverte : formulation, attributs, responsable, mots-clés, alias |

Et le bloc **`brt-req`**, dessiné dans toute note : des exigences citées plutôt que
recopiées (par identifiant ou alias, ou par filtre), avec leur formulation du moment,
une traduction en retard ou absente signalée, un identifiant introuvable ou une clé
inconnue dits au-dessus du tableau. Un clic sur l'identifiant ouvre la note.

## Organisation du code

| Fichier | Rôle | Origine |
| --- | --- | --- |
| `model/requirement.ts` | l'exigence, ses formulations par langue (révision, retard), ses liens (suspects) | repris de la version complète (Black Room Technologies) |
| `model/reqId.ts` | identifiants `REQ-SYS-0042` : lecture, format, catégories, numéro suivant | repris |
| `model/aliases.ts` | alias : normalisation, unicité des noms | repris |
| `model/record.ts` | l'exigence ↔ l'en-tête de sa note (clé `brt-requirement`) | repris |
| `model/note.ts` | la note complète ; corps généré ; ce que l'utilisateur ajoute est gardé | repris, YAML réécrit |
| `model/block.ts`, `blockFields.ts`, `fence.ts` | le bloc `brt-req` : syntaxe, sélection, colonnes, blocs d'une note | repris |
| `settings.ts` | réglages ; attribution des identifiants et compteurs | réécrit |
| `store.ts` | lire, créer, modifier, renommer les notes, marquer les liens | réécrit sur les ports (`FileSystem`, `yaml`) |
| `vocabulary.ts` | types, statuts, criticités, vérifications et leurs libellés | réécrit |
| `flows.ts` | créer, modifier, parcourir, dessiner un bloc | nouveau |

Les tests du modèle sont ceux de la version complète, repris tels quels (134 tests) ;
`store.test.ts` et `flows.test.ts` couvrent le reste, dont le jalon de l'étape.

## Extraire et importer (étape 4)

| Fichier | Rôle | Origine |
| --- | --- | --- |
| `import/csv.ts` | lignes d'import, CSV, et le **plan** (créer, mettre à jour, inchangée, refusée) | repris |
| `import/table.ts` | un tableau (feuille, ou tableau d'un document) en lignes, d'après son en-tête | repris |
| `import/document.ts` | les exigences d'un document : tableaux et paragraphes qui commencent par un identifiant ; **l'endroit** de chacune | repris, endroit ajouté |
| `import/slides.ts` | les exigences d'une présentation | repris |
| `import/reqif.ts`, `reqifWrite.ts` | lire un ReqIF / ReqIFz (et en écrire, pour les essais aller-retour) | repris |
| `import/words.ts` | les mots des documents des autres : en-têtes et valeurs, en français et en anglais | nouveau |
| `import/extract.ts` | `extractRequirements(extension, octets, langues)` : tout format, par le module Lecture de fichiers | nouveau |
| `import/apply.ts` | écrire un plan accepté, avec l'origine | réécrit (`ReqPorter`) |
| `import/preview.ts` | la fenêtre d'aperçu, puis l'écriture ; l'endroit en mots | nouveau |

Commande **Importer des exigences d'un fichier** (ordinateur ou coffre). Interface pour
les autres modules : `extractRequirements`, `previewImport`, `requirementsAt(dossier)`,
`requirementLanguages()`, `describeLocation`.

Reconnu : un tableau dont l'en-tête nomme un identifiant ou une formulation (« Identifiant
», « Réf. », « Exigence », « Énoncé », « Libellé »…, et les colonnes type, statut,
criticité/priorité, vérification, source…), dont les valeurs (« Essai », « Haute »,
« Approuvée ») sont ramenées aux valeurs rangées ; un paragraphe qui commence par un
identifiant (`EX-SOL-003 — …`, `[SYS-12] …`), un titre de section qui en commence un. Le
reste est de la prose : rien n'est deviné. Un identifiant au format `PRÉFIXE-CAT-NUM` est
gardé ; un autre devient un alias.

L'origine d'une exigence importée, dans l'en-tête de sa note :

```yaml
origin:
  piece: "[[Appels d'offres/Station sol/Pièces/Appel d'offres/CCTP|CCTP]]"
  locator: "Article 2 — Exigences, tableau 1, ligne 2"
```

et en tête de son corps (« *Origine : …* »). La version complète garde cette clé telle
quelle (clés d'en-tête étrangères conservées).

## Vérifier des exigences (`check/`, Black Projects 0.6.1)

Sans IA, des fonctions pures que l'analyse d'appels d'offres appelle :

| Fichier | Rôle |
| --- | --- |
| `check/passages.ts` | un document en **passages** (paragraphes, lignes de tableau, feuilles, diapositives), chacun avec son endroit : `documentPassages`, `blockPassages` |
| `check/text.ts` | mots porteurs de sens (sans accents, sans mots vides), recouvrement, phrases, tournures normatives (FR/EN) |
| `check/checks.ts` | `missedRequirements` (phrases normatives qu'aucune exigence ne reprend : par nom, par inclusion, ou ≥ 70 % des mots), `coherence` (formulations différentes, absente d'une version du même type, doublon, même texte, exigence rangée qui diffère), `coverage` (citée ; traitée ≥ 60 % des mots ; à vérifier ≥ 35 % ; absente) |

L'aperçu d'import (`previewImport`) accepte aussi des lignes venues de plusieurs pièces
(`pieceOf`, `labelOf`, `categoryOf`) et des propositions non cochées (`preselect: false`).

## La qualité (`quality/`, étape 5)

| Fichier | Rôle | Origine |
| --- | --- | --- |
| `quality/rules.ts` | `checkWording` : les défauts de rédaction, par langue (FR, EN) ; à définir et « et/ou » dans toute langue | repris |
| `quality/score.ts` | `assessRequirement(exigence, langues, portée)` : six axes ISO/IEC/IEEE 29148, pondérés, en étoiles ; portée `record` (bibliothèque) ou `wording` (rédaction seule, plafond à deux étoiles sans obligation) | repris, portée ajoutée |
| `quality/similar.ts` | doublons par trigrammes (Jaccard) et par le sens (cosinus d'embeddings) ; seuils strict / normal / large | repris |
| `quality/library.ts` | `coverageOf` : rattachements (citée, satisfaite, vérifiée, liens à revoir, formulation) | repris |
| `quality/report.ts` | `qualityMarkdown` : le rapport (vue d'ensemble, répartition, axes, défauts, doublons, non vérifiables, faibles, rattachements, toutes) ; `withQuality` le réécrit en gardant les Notes | nouveau |

Commande **Analyser la qualité de la bibliothèque d'exigences** ; la note est aussi dans
la liste (colonne, filtre), la fiche et la colonne `rating` d'un bloc `brt-req`.

## Avec l'IA (`ai/`, étape 6)

Le client vient du module [IA](ia.md) (`aiClient()`) ; sans lui, les commandes le disent
et ne font rien. Rien n'est écrit dans une formulation sans l'accord de l'utilisateur.

| Commande | Ce qu'elle fait |
| --- | --- |
| Relire l'exigence avec l'IA (note ouverte ; aussi dans le menu d'une ligne de la liste) | la note et les axes faibles calculés par les règles (`improvementPlan`) sont donnés au modèle (`deepReview`) ; il rend un avis, les défauts que les règles ne voient pas, et des reformulations par axe. La relecture est écrite dans la note, section « Relecture par l'IA » (`<!-- bp:relecture:debut -->` … `fin`, remplacée à chaque fois) ; une reformulation choisie devient la formulation (révision suivante, origine `machine` acceptée par l'utilisateur), « Ne rien changer » la laisse |
| Traduire l'exigence avec l'IA | dans une autre langue de rédaction (choisie s'il y en a plusieurs) ; marquée `origin: machine`, non relue ; chiffres et unités comparés à la source (`quantityDrift`) : un écart est signalé |
| Analyser la qualité… (bibliothèque et dossier) | avec un **modèle d'embeddings** réglé, les doublons par le sens s'ajoutent à ceux par les lettres (`semanticDuplicates`, seuil « normal » 0,88), marqués « par le sens » ; sans lui, ou si le serveur échoue, rien de plus |

| Fichier | Rôle | Origine |
| --- | --- | --- |
| `ai/promptTemplate.ts` | gabarits de consignes à variables | repris |
| `ai/reqQualityLlm.ts` | schémas, consignes, lecture des réponses ; `deepReview`, `reviewWording` (fonctions à la place de la classe d'origine), `mergeFindings` | repris, réécrit en fonctions |
| `ai/reqAdvice.ts` | `improvementPlan` : les axes qui rapportent le plus | repris |
| `ai/translate.ts` | requête, lecture, garde des chiffres et unités | repris (la partie utile) |
| `ai/semantic.ts` | `semanticDuplicates` : embeddings par lots de 64 | nouveau (d'après `ReqEmbeddings`) |
| `ai/actions.ts` | relire et traduire une exigence ; `withReview` | nouveau |

`sessionAt(dossier, ui, notifier)` et `reviewRequirement(…, { scope, offerRewrite, quiet })`
sont publics : l'AO relit les exigences d'une analyse avec eux (portée `wording`).

## Workflows (Black Projects 0.9.0)

`workflows.ts` déclare au module [Workflows](workflows.md) le déclencheur « exigence
créée » (signalé par « Nouvelle exigence », `Session.created`), les actions « analyser la
qualité de la bibliothèque » (`writeLibraryQuality`, partagée avec la commande) et
« relire une exigence avec l'IA » (relecture écrite, aucune reformulation appliquée), et
le workflow prêt à l'emploi « qualité chaque lundi ».

## L'accueil (Black Projects 0.10.0)

`home.ts` : la section « Bibliothèque d'exigences » (nombre, note moyenne, faibles, traductions à revoir ; nouvelle exigence, parcourir, analyser la qualité) et l'entrée de navigation « Exigences ».

## La page « Exigences » (Black Projects 0.16.0)

`home.ts` déclare la **page** `exigences.bibliotheque` (`views.page`, voir
[l'interface](../architecture/interface.md#les-pages-des-modules-v0150)) : les chiffres de la
bibliothèque (les mêmes que la section du tableau de bord, `libraryStats`), les actions
(nouvelle, importer, qualité), une carte par exigence, les plus faibles d'abord — formulation
(`Card.text`), type, statut, criticité, note, et ce qui reste à revoir (traduction absente,
`flagsOf`) ; titre → la note, **Modifier** → la fiche, **Relire (IA)** / **Traduire (IA)** —
avec une recherche et des filtres (`tags` : `faibles`/`bonnes`, `a-revoir`, `critiques`,
`brouillons`, `approuvees`). L'entrée « Exigences », la tuile « Exigences », la commande
`liste` et le lien « Toute la bibliothèque » du tableau de bord l'ouvrent par
`context.showPage` ; sans page chez la plateforme, la commande retrouve la liste en fenêtre
(`browseRequirements`). Tests : `test/exigences-page.test.ts`.

## La fiche d'une exigence (Black Projects 0.21.0)

`home.ts` déclare la page `exigences.fiche?<note encodée>` (`requirementPageOf`, exporté
pour l'AO ; `parent` : la bibliothèque). Le dossier de la note dit où l'exigence est
rangée — bibliothèque ou analyse : la page prend une session sur ce dossier
(`sessionAt`), si bien que Modifier, Relire et Traduire agissent au bon endroit. En tête
les actions ; les chiffres (qualité, type, statut, criticité) ; les formulations en
cartes par langue (`Card.wrap` : le texte en entier ; source, à jour, en retard, à relire,
absente ; Traduire (IA) quand il le faut) ; la qualité axe par axe, chaque manque dit en
mots (`describeMiss` : règle, manque, champ à renseigner, formulation absente, aucun
lien) ; la fiche, les liens, l'historique. La carte d'une exigence (bibliothèque, fiche
d'une analyse) ouvre la fiche quand la plateforme a des pages, sa note sinon.
Tests : `test/exigences-page.test.ts`.

**La relecture sur la fiche (v0.11.0, Black Projects 0.43.0)** : la dernière relecture par
l'IA, écrite dans la note entre ses marques (`reviewSection`), s'affiche sur la fiche juste
après les formulations, lue en blocs (`noteBlocks`) : l'avis, les défauts relevés, les
reformulations proposées. `lastReview(note)` (exporté) en donne la date et l'avis, pour
d'autres pages (la qualité des exigences d'une analyse marque les relues).

**Traduire dans l'interface (v0.12.0, Black Projects 0.44.0)** :

- `translateRequirement(session, client, path, { lang?, quiet?, date? })` rend
  `'translated' | 'failed' | 'none'`. Avec `lang`, la langue n'est pas redemandée (la carte
  d'une langue sur la fiche traduit vers elle) ; ce que l'IA dit de sa traduction (un
  terme, un choix) est écrit dans la note, une section par langue entre ses marques
  (`bp:traduction:<langue>:debut/fin`), remplacée à la traduction suivante, retirée si
  l'IA n'a rien dit ; `translationNote(note, lang)` la relit.
- La carte d'une traduction de machine montre les **chiffres ou unités** qui diffèrent de la
  source (`quantityDrift`, calculé à l'affichage, badge et fait) et la **note de l'IA** ;
  **Valider la traduction** (`acceptTranslation`, qui passe par `acceptText`) la marque
  relue — la seule façon de le faire, désormais aussi depuis la fiche.
- « Traduire (IA) » d'une carte de la bibliothèque mène à la fiche de l'exigence, où la
  traduction se lit ; depuis la fiche, on y reste.
- **En série** : la commande *Traduire des exigences avec l'IA* (`traduire-ia-serie`,
  `translateRequirements`), aussi en tête de la bibliothèque quand l'IA est réglée et qu'il
  y a plus d'une langue : la langue, puis les exigences (absentes ou en retard cochées,
  `translationState`), chacune traduite sans message, et un résumé (combien, combien
  dont les chiffres diffèrent). Le filtre **Traductions à relire** (`traductions`) de la
  bibliothèque les retrouve.

**Importer dans l'interface (v0.13.0, Black Projects 0.45.0)** : « Importer » en tête de
la bibliothèque et la tuile *Importer des exigences* passent par `ImportHooks.run`
(`registerExigencesHome`) : l'import fait (les mêmes fenêtres : où est le fichier,
l'aperçu, la catégorie), la page **`exigences.import`** s'ouvre (`importPageOf(origine)`,
fille de la bibliothèque). Elle liste les exigences de la bibliothèque dont l'origine est
ce fichier (`origin.piece` : son nom, ou son lien dans le coffre — `pieceName` en tire le
nom), chacune avec l'endroit du fichier d'où elle vient ; celles du dernier import
(`LastImport`, gardé tant que le module est actif) sont marquées « Créée » ou « Mise à
jour par l'import », comptées, avec ce qui n'a pas pu l'être, et deux filtres (créées,
mises à jour) s'ajoutent à « faibles » et « à revoir ». L'origine étant écrite sur chaque
exigence, la page se retrouve après coup : la ligne « Extraite de » de la fiche d'une
exigence de la bibliothèque y mène. Depuis la palette, ou sans page chez la plateforme :
le message seul, comme avant.

**La qualité en page (v0.14.0, Black Projects 0.46.0)** : la page `exigences.qualite`
(`qualityPage.ts`, `libraryQualityPage`, fille de la bibliothèque), calculée à
l'ouverture sur la rédaction et la fiche (`assessAll(…, 'record')`), comme celle d'une
analyse : chiffres, une carte par exigence (les plus faibles d'abord, tags `faibles`,
`non-verifiables`, `doublons`, `bonnes`, `relues`), défauts, doublons probables (par les
lettres ; ceux par le sens restent au rapport, qui interroge le modèle de vecteurs), axes,
répartition, rattachements (`coverageOf`). « Analyser la qualité » de la bibliothèque, de
la section du tableau de bord et la tuile *Qualité* (qui porte `page`) l'ouvrent ; rien
n'est écrit. En tête : **Écrire / Mettre à jour le rapport** (`writeLibraryQuality`, sans
quitter la page), **Ouvrir le rapport**. La note du rapport (`libraryQualityPath`) ouverte
par un autre module mène à cette page. Depuis la palette, ou sans page chez la
plateforme : le rapport écrit et ouvert, comme avant. Une note vide se lit comme absente
(une plateforme peut lire vide une note qui n'existe pas).

**Créer dans l'interface (v0.15.0, Black Projects 0.47.0)** : « Nouvelle exigence » de la
bibliothèque, de la section du tableau de bord et de la tuile passe par `create`
(`registerExigencesHome`) : `createRequirement`, puis la fiche de l'exigence créée
(`requirementPageOf`) ; un formulaire abandonné laisse la page où elle est. Depuis la
palette, ou sans page chez la plateforme : la commande `nouvelle`, qui ouvre la note.

**Modifier dans l'interface (v0.16.0, Black Projects 0.48.0)** : « Modifier la fiche »
sur la fiche passe par `editRequirement`, qui rend le chemin de la note ; renommée (un
titre modifié), la fiche suit (`requirementPageOf(nouveau chemin)`). « Modifier » d'une
carte de la bibliothèque (et des pages qui en reprennent les cartes, comme celle d'un
import) mène à la fiche modifiée. Une fiche demandée sous un ancien nom (« Retour »)
retrouve l'exigence par l'identifiant en tête du nom de la note (`renamedFrom`) plutôt
que de dire « introuvable ». Depuis la palette : la note, comme avant.

**Relire dans l'interface (v0.17.0, Black Projects 0.49.0)** : « Relire (IA) » d'une carte
de la bibliothèque mène à la fiche (relue, ou reformulation retenue ; rien si l'IA ne
répond pas) ; sur la fiche, on reste. Les cartes de la bibliothèque portent « Relue (IA)
le … » (`lastReview` de chaque note) et le filtre `relues`. La formulation source écrite
par l'IA (une reformulation retenue) se dit « Reformulée par l'IA, retenue le … » sur la
fiche, plus « traduite ». Les messages de fin disent que la relecture se lit sur la fiche.

## Le format

Celui de la version complète de Black Projects, sous des noms Black Room Technologies
(v0.5.1) : la clé d'en-tête **`brt-requirement`** et le bloc **`brt-req`**. Les anciens
noms de la version complète (`pm-requirement`, `pm-req`) sont encore **lus** : une
ancienne note d'exigence est reconnue, et prend la clé `brt-requirement` à sa prochaine
modification ; un ancien bloc est dessiné comme un bloc `brt-req`. Rien n'est plus écrit
sous les anciens noms.

```yaml
---
brt-requirement: true
id: REQ-SYS-0001
title: Maintien en température
sourceLang: fr
rev: 2
text:
  fr:
    body: Le système doit maintenir la soute entre 5 °C et 30 °C.
    fromRev: 2
    origin: human
    reviewed: true
category: SYS
type: performance
status: draft
criticality: high
verification: test
aliases:
- OMLX-SYS-0001
links:
- kind: derives-from
  to: REQ-SYS-0000
history:
- rev: 2
  lang: fr
  was: Le système doit maintenir la soute entre 0 °C et 30 °C.
---
```

Valeurs rangées : types `functional`, `performance`, `interface`, `operational`,
`constraint`, `safety` ; statuts `draft`, `proposed`, `approved`, `implemented`,
`verified`, `rejected`, `obsolete` ; criticités `high`, `medium`, `low` ; vérifications
`test`, `analysis`, `inspection`, `demonstration`, `none`. Une valeur inconnue (note
modifiée à la main) est montrée telle quelle.

## Les identifiants

`<préfixe>-<CATÉGORIE>-<numéro>` : préfixe `REQ` (réglable), catégorie en majuscules sans
accent ni séparateur (« Système » → `SYSTEME`), numéro sur 4 chiffres (réglable). Le
numéro suivant est le plus haut de la bibliothèque **et** du compteur de la catégorie
(réglage `compteurs`, retenu avant l'écriture de la note) : un identifiant n'est jamais
réutilisé. Un identifiant apporté (import) est gardé, et le compteur passe au-delà.

## Réglages

| Clé | Contenu | Défaut |
| --- | --- | --- |
| `dossier` | où les exigences sont écrites et cherchées (sous-dossiers compris) | `Exigences` |
| `prefixe` | préfixe des identifiants | `REQ` |
| `chiffres` | chiffres du numéro (2 à 8) | `4` |
| `langues` | langues de rédaction ; la première est la langue source | `fr, en` |
| `compteurs` | catégorie → plus haut numéro attribué (interne) | — |
| `colonnesBloc` | colonnes d'un bloc `brt-req` qui n'en nomme pas | `id, text, status` |

## Ce que le socle a ajouté au cœur

- `src/core/yaml.ts` : écriture YAML stable et lisible (`toYaml`), lecture d'un en-tête
  par le port `Platform.yaml` (Obsidian : `parseYaml` ; tests : la bibliothèque `yaml`,
  en dépendance de développement seulement) ;
- `ui.pickFromList` : une fenêtre de liste avec recherche, filtres et boutons ;
- le champ de formulaire `textarea` ;
- `context.blocks.register(langage, rendu)` : un module dessine un bloc de code
  (`BlockView` : colonnes, lignes, messages), mis en forme par la plateforme.
