# Module — IA (`ia`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `ia` |
| Version | 0.1.0 (Black Projects 0.8.0) |
| Requiert | — |
| Utilisé par | [Exigences](exigences.md) (relecture, traduction, doublons par le sens), [Analyse d'appels d'offres](ao.md) (questions au dossier, questionnaire, relecture des exigences du dossier) |
| Emplacement | `src/modules/ia/` |
| Interface publique | `src/modules/ia/index.ts` |
| Étape | 6 du [plan d'intégration](../plan-integration.md) — IA locale |

Documentation utilisateur (écrite dans le coffre) : `src/modules/ia/doc/IA.md`.

## Ce qu'il fait

Il relie Black Projects à un serveur d'IA **compatible OpenAI** — le **serveur d'IA de
l'entreprise**, quel qu'il soit, s'il parle le même protocole (`/v1/models`, `/v1/chat/completions`,
`/v1/embeddings`). Il ne fait rien de lui-même : il tient la connexion et la donne aux
autres modules, qui l'utilisent **s'il est là**. Sans lui, ou sans connexion réglée, tout
Black Projects fonctionne ; une commande qui demande l'IA le dit en clair (« l'IA n'est
pas réglée : Réglages → Black Projects → IA »).

| Réglage | Clé | Rôle |
| --- | --- | --- |
| Adresse du serveur | `adresse` | jusqu'à `/v1` |
| Modèle de texte | `modele` | choisi par « Tester la connexion » parmi ceux du serveur |
| Modèle d'embeddings | `modeleEmbeddings` | facultatif : les doublons par le sens dans l'analyse de qualité |
| Longueur maximale d'une réponse | `jetons` | vide : celle du serveur |
| Clé d'accès | — | dans le **trousseau d'Obsidian** (`app.secretStorage`, identifiant `black-projects-ia-cle`), jamais dans le coffre ni dans `data.json` |

Bouton **Tester la connexion** (commande `tester`) : interroge `/models`, fait choisir le
modèle de texte, et dit en clair ce qui ne va pas (serveur injoignable, adresse sans
`/v1`, clé refusée, aucun modèle).

## Interface publique

| Nom | Rôle |
| --- | --- |
| `aiClient()` | le client réglé, ou `null` (module inactif, adresse ou modèle manquant) |
| `AiClient` | `models()`, `chat(requête)`, `chatJson(requête + schéma)` (réessaie sans schéma si le serveur ne sait pas les suivre), `embed(textes)` |
| `describeAiError(erreur, t)` | une phrase sur laquelle l'utilisateur peut agir (`ia.error.<kind>`) |
| `LlmError` | `unreachable`, `timeout`, `http`, `shape`, `disabled` |
| `buildChatBody`, `parseJsonContent`, `cosine` | du protocole, pour les modules qui composent leurs requêtes |

Le client passe par le port `Http` de la plateforme (`requestUrl` dans Obsidian : pas de
CORS, pas de proxy à régler dans le navigateur) ; les tests le simulent
(`memoryPlatform().httpAnswers`).

## Organisation du code

| Fichier | Rôle | Origine |
| --- | --- | --- |
| `protocol.ts` | corps des requêtes, lecture des réponses (texte, JSON, flux SSE, embeddings, modèles), erreurs | repris de la version complète (`llm/protocol`) |
| `client.ts` | `AiClient` sur le port `Http` ; messages d'erreur HTTP en français | réécrit (types de la version complète) |
| `index.ts` | réglages, clé, test de connexion, `aiClient()` | nouveau |
| `i18n.ts`, `doc/IA.md` | textes et page du coffre | nouveau |

Ce que les autres modules ont repris pour s'en servir est chez eux :
`exigences/ai/` (`promptTemplate`, `reqQualityLlm`, `reqAdvice`, `translate`,
embeddings) et `ao/ask/` (`libraryRetrieval`, `eachDocument`), `ao/deadlines.ts`.

## Ce que l'étape a ajouté au cœur

- Port `SecretStore` (`platform.secrets`) : `get(id)`, `set(id, valeur)` ; dans
  Obsidian, le trousseau (`app.secretStorage`) ; en mémoire pour les tests.
- Champ de réglage `secret` (`SecretField`) : un mot de passe, enregistré dans le
  trousseau ; la fenêtre dit seulement si une clé est enregistrée.

## Tests

- `protocol.test.ts` : le protocole (repris).
- `ia.test.ts` : sans réglage pas de client ; le test de connexion liste et fait choisir
  le modèle, envoie la clé du trousseau, ne la met jamais dans les réglages ; un échec
  dit en clair.
