# Module — Exigences (`exigences`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `exigences` |
| Version | 0.1.0 (Black Projects 0.5.0) |
| Emplacement | `src/modules/exigences/` |
| Interface publique | `src/modules/exigences/index.ts` |
| Requiert | — |
| Utilisé par | à l'étape 4 : l'analyse d'appels d'offres (extraction des exigences) |
| Étape | 3 du [plan d'intégration](../plan-integration.md) — le socle des exigences |

Documentation utilisateur (écrite dans le coffre) : `src/modules/exigences/doc/Exigences.md`.

## Ce qu'il fait

| Commande | Rôle |
| --- | --- |
| Nouvelle exigence | Formulaire (catégorie, titre, formulation, type, statut, criticité, vérification, source, justification) ; identifiant attribué ; la note est écrite et ouverte |
| Exigences : liste, filtres et fiches | La bibliothèque : recherche, filtres par catégorie, type, statut, criticité ; une ligne → « Modifier la fiche » ou « Ouvrir la note » ; « Nouvelle exigence » ; la liste revient aux mêmes filtres |
| Modifier l'exigence (note ouverte) | La fiche de l'exigence ouverte : formulation, attributs, responsable, mots-clés, alias |

Et le bloc **`pm-req`**, dessiné dans toute note : des exigences citées plutôt que
recopiées (par identifiant ou alias, ou par filtre), avec leur formulation du moment,
une traduction en retard ou absente signalée, un identifiant introuvable ou une clé
inconnue dits au-dessus du tableau. Un clic sur l'identifiant ouvre la note.

## Organisation du code

| Fichier | Rôle | Origine |
| --- | --- | --- |
| `model/requirement.ts` | l'exigence, ses formulations par langue (révision, retard), ses liens (suspects) | repris de la version complète (Black Room Technologies) |
| `model/reqId.ts` | identifiants `REQ-SYS-0042` : lecture, format, catégories, numéro suivant | repris |
| `model/aliases.ts` | alias : normalisation, unicité des noms | repris |
| `model/record.ts` | l'exigence ↔ l'en-tête de sa note (clé `pm-requirement`) | repris |
| `model/note.ts` | la note complète ; corps généré ; ce que l'utilisateur ajoute est gardé | repris, YAML réécrit |
| `model/block.ts`, `blockFields.ts`, `fence.ts` | le bloc `pm-req` : syntaxe, sélection, colonnes, blocs d'une note | repris |
| `settings.ts` | réglages ; attribution des identifiants et compteurs | réécrit |
| `store.ts` | lire, créer, modifier, renommer les notes, marquer les liens | réécrit sur les ports (`FileSystem`, `yaml`) |
| `vocabulary.ts` | types, statuts, criticités, vérifications et leurs libellés | réécrit |
| `flows.ts` | créer, modifier, parcourir, dessiner un bloc | nouveau |

Les tests du modèle sont ceux de la version complète, repris tels quels (134 tests) ;
`store.test.ts` et `flows.test.ts` couvrent le reste, dont le jalon de l'étape.

## Le format

Identique à la version complète de Black Projects : une note écrite par l'une se relit
dans l'autre.

```yaml
---
pm-requirement: true
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
| `colonnesBloc` | colonnes d'un bloc `pm-req` qui n'en nomme pas | `id, text, status` |

## Ce que le socle a ajouté au cœur

- `src/core/yaml.ts` : écriture YAML stable et lisible (`toYaml`), lecture d'un en-tête
  par le port `Platform.yaml` (Obsidian : `parseYaml` ; tests : la bibliothèque `yaml`,
  en dépendance de développement seulement) ;
- `ui.pickFromList` : une fenêtre de liste avec recherche, filtres et boutons ;
- le champ de formulaire `textarea` ;
- `context.blocks.register(langage, rendu)` : un module dessine un bloc de code
  (`BlockView` : colonnes, lignes, messages), mis en forme par la plateforme.
