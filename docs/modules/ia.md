# Module — IA (`ia`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `ia` |
| Version | 0.14.0 (Black Projects 0.88.0) |
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
| Modèle — analyse | `modele` | relecture, questions au dossier, questionnaire ; le modèle par défaut (obligatoire) |
| Modèle — traduction | `modeleTraduction` | vide : celui d'analyse |
| Modèle — vecteurs (embeddings) | `modeleEmbeddings` | vide : pas de doublons par le sens |
| Modèle — reranking | `modeleReranking` | vide : l'ordre de la recherche ; sinon `/rerank` classe les pièces trouvées avant la réponse |
| Modèle — lecture OCR | `modeleOcr` | le texte des scans (étape 7) ; vide : celui de vision |
| Modèle — lecture par vision | `modeleVision` | comprendre une image (étape 7) ; vide : celui d'analyse |
| Liste des modèles du serveur | `modelesServeur` | retenue par « Tester la connexion » ; chaque usage en propose ceux qui lui conviennent |
| Longueur maximale d'une réponse | `jetons` | vide : celle du serveur |
| Clé d'accès | — | dans le **trousseau d'Obsidian** (`app.secretStorage`, identifiant `black-projects-ia-cle`), jamais dans le coffre ni dans `data.json` |

**Un modèle par usage**, comme dans la version complète : chaque champ de modèle a un menu
(`TextField.choices`, nouveau dans le cœur : le menu remplace le champ texte, avec « — aucun — »
et « Saisir un autre nom… » ; un nom saisi hors liste reste affiché « (saisi) ») qui propose les modèles du serveur
convenant à l'usage, triés (`modelsFor` dans `models.ts`, d'après leur nom : `embed`,
`bge`, `e5`… pour les vecteurs, `rerank` pour le reranking, `ocr`, `nougat`, `dots.ocr`…
pour l'OCR, `vl`, `pixtral`, `llava`… pour la vision ; tous si aucun ne convient). Le
client donne le modèle d'un usage par `modelFor(usage)`, avec les remplacements ci-dessus.

Bouton **Tester la connexion** (commande `tester`) : interroge `/models`, retient la liste,
fait choisir le modèle d'analyse s'il n'y en a pas, et dit en clair ce qui ne va pas (serveur injoignable, adresse sans
`/v1`, clé refusée, aucun modèle).

## Workflows (Black Projects 0.9.0)

`workflows.ts` déclare l'action « Demander à l'IA » au module [Workflows](workflows.md) :
une consigne, un contexte (souvent `{step1.text}`), une note facultative ; la réponse
passe aux étapes suivantes (`{stepN.text}`).

## L'accueil (Black Projects 0.10.0)

La section « IA » : l'adresse et chaque usage (réglé, ou le modèle qui le remplace, ou non utilisé) ; non réglée, un message et le bouton « Réglages ». Entrée de navigation « IA ».

## La page « IA » (v0.5.0, Black Projects 0.18.0)

`home.ts` (la section du tableau de bord y est passée aussi) déclare la **page**
`ia.connexion` (`views.page`, voir
[l'interface](../architecture/interface.md#les-pages-des-modules-v0150)) : les chiffres
(connexion, modèles retenus — `LISTED_KEY` —, usages couverts, jetons), **Tester la
connexion** (commande `tester`) et **Régler la connexion** (`openWindow`, la fenêtre du
module), une carte par usage (`MODEL_USES`) — modèle choisi, pris à la place
(`AiClient.modelFor`) ou pas utilisé, sa description, le nombre de modèles possibles
(`modelsFor`) — avec **Choisir le modèle** (`pickOption` sur les modèles qui conviennent,
« Aucun » le retire ; enregistré dans `MODEL_KEYS[usage]`), puis « Ce qui se sert de l'IA »
(la section des usages d'`iaFeatures`). Filtres (`tags`) : `choisis`, `par-defaut`,
`inutilises`. L'entrée, la tuile et le lien « Toute l'IA » l'ouvrent par
`context.showPage` ; sans page chez la plateforme, ils ouvrent la fenêtre du module, comme
avant. Tests : `test/ia-page.test.ts`.

**Tester en page (v0.6.0, Black Projects 0.52.0)** : la commande `tester` passe par
`testConnection`, qui garde son résultat (`ConnectionTest` : quand, `ok` / `failed` /
`noUrl` / `noModel`, combien de modèles, le modèle d'analyse, la raison) tant que le
module est actif ; la page IA le montre en tête (`IaHomeDeps.lastTest`). La liste des
**modèles du serveur** (`LISTED_KEY`) s'y ajoute : pour quoi chacun est choisi, à quoi il
conviendrait encore (`modelsFor`, noms courts `ia.use.*`). « Tester la connexion » de la
tuile et du tableau de bord teste puis ouvre la page ; celui de la page y reste. Le
message de réussite renvoie à la page IA (plus à la fenêtre du module). La démonstration
répond à la liste des modèles.

**Le workflow système (v0.7.0, Black Projects 0.60.0)** : `sys.ia.verifier-connexion`,
actif d'origine, déclencheur « À l'ouverture d'Obsidian », action `ia.verifier`
(`checkConnection`) : sans adresse, rien (« rien à vérifier ») ; sinon la liste des
modèles (`LISTED_KEY`) mise à jour et le dernier test (`lastTest`) gardé pour la page,
sans rien dire ; un serveur qui ne répond pas lève (le workflow échoue et le dit, ❌ au
journal) ; un modèle réglé pour un usage (`USE_FIELD`) absent du serveur est dit.
Tests : `test/ia-workflows.test.ts`.

**Deux nouveaux workflows système (v0.8.0, Black Projects 0.68.0)** :

| Workflow système | Déclencheur | Ce qu'il fait | D'origine |
| --- | --- | --- | --- |
| Signaler les nouveaux modèles du serveur, à l'ouverture (`sys.ia.nouveaux-modeles`) | à l'ouverture (après la vérification, qui met la liste à jour) | `ia.nouveaux-modeles` (`newModels`) : la liste du serveur (`LISTED_KEY`) comparée aux modèles déjà vus (`KNOWN_KEY`, `modelesConnus`) ; les nouveaux nommés avec les usages qui leur conviendraient (`usesOf`) ; la première fois, la liste est seulement retenue | actif |
| Signaler un serveur d'IA lent, à l'ouverture (`sys.ia.temps-reponse`) | à l'ouverture | `ia.temps-reponse` (champ « seuil », 5 s) : une demande minuscule au modèle d'analyse (`max_tokens` 1), chronométrée ; au-delà du seuil, un message | désactivé |

**Les personas (v0.9.0, Black Projects 0.70.0)** : `AiClient.withPersona(consignes)` rend
le même client, qui met les consignes d'un persona de la [bibliothèque](bibliotheque.md) en
tête du message système de chaque demande (`chat`, et donc `chatJson`). L'action
« Demander à l'IA » (`ia.demander`) prend aussi un *Prompt de la bibliothèque* (sa
question, quand la consigne est vide) et un *Persona de la bibliothèque*, par leur nom.

## La langue d'un document, avec l'IA (v0.10.0, Black Projects 0.84.0)

Quand la détection **sans IA** de la [bibliothèque](bibliotheque.md) n'a pas été sûre, une
étape avec l'IA : le workflow système **« Identifier avec l'IA la langue d'un document,
quand la détection n'est pas sûre »** (`sys.ia.langue-documents`, actif) — au déclencheur
*Bibliothèque : document versé*, si `{langue}` est vide —, action `ia.langue-document`
(champ `fiche`, `{fiche}` d'origine) : le début du texte du document (4 000 caractères,
`libraryDocText`) est donné au modèle d'analyse, température 0, avec la consigne de ne
répondre qu'un code (fr, en, de, es, it, pt, nl) ou « ? » s'il n'est pas sûr
(`readLanguageAnswer` : le premier mot, exactement un des codes). Un code : la langue est
donnée (`setLanguageByAi` : `langue`, `langueIdentifieePar: ia` ; plus à confirmer). Sinon
— « ? », une phrase, l'IA pas réglée, pas de texte lu, une image —, la langue reste à
confirmer, sans erreur ; le journal le dit. Une détection sûre ne demande rien à l'IA.

## La référence et la version d'un document, avec l'IA (v0.11.0, Black Projects 0.85.0)

Le même principe pour la référence, l'édition et la révision : quand la première passe sans
IA de la [bibliothèque](bibliotheque.md) n'est pas sûre, le workflow système **« Identifier
avec l'IA la référence et la version d'un document, quand la première passe n'est pas
sûre »** (`sys.ia.identite-documents`, actif ; *document versé*, si `{identiteaconfirmer}`
n'est pas vide), action `ia.identite-document` : le nom du fichier et le début du texte
(6 000 caractères) au modèle d'analyse, température 0, une réponse JSON imposée
(`reference`, `edition`, `revision`, `certain`). `readIdentityAnswer` : pas certaine, rien ;
une référence absente du document, écartée ; « Édition 02 » → « 2 », « rev. b » → « B ». Pas
certaine, pas réglée, pas de texte : à confirmer, sans erreur ; le journal le dit.

## L'émetteur d'un document, avec l'IA (v0.14.0, Black Projects 0.88.0)

`sys.ia.emetteur-documents` (actif ; *document versé*, si `{emetteuraconfirmer}` n'est pas
vide), action `ia.emetteur-document` : réponse JSON imposée (`issuer`, `certain`) —
l'entreprise, l'organisme ou l'acheteur qui a écrit le document, pas un destinataire ni un
fournisseur cité. `readIssuerAnswer` : pas certaine, rien ; certaine et vide : aucun
émetteur ; sinon gardé s'il figure dans le document (elle n'invente pas).

## Le titre d'un document, avec l'IA (v0.13.0, Black Projects 0.87.0)

Le workflow système **« Identifier avec l'IA le titre d'un document, quand la première
passe n'est pas sûre »** (`sys.ia.titre-documents`, actif ; *document versé*, si
`{titreaconfirmer}` n'est pas vide), action `ia.titre-document` : le nom du fichier et le
début du texte au modèle d'analyse, température 0, réponse JSON imposée (`title`,
`certain`) — le titre de la page de garde, pas le nom de l'entreprise, une référence ou un
chapitre. `readTitleAnswer` : pas certaine, rien ; guillemets ôtés ; 3 à 150 caractères ;
au moins 70 % de ses mots (4 lettres ou plus) dans le document ou le nom du fichier — elle
n'invente pas. Sinon, à confirmer, sans erreur.

## Les consignes de la bibliothèque, à chaque étape d'IA (v0.12.0, Black Projects 0.86.0)

`libraryGuidance` (déclaré au module Workflows par `registerAiGuidance`) : les noms choisis
dans une étape — persona, skill, prompt — deviennent des consignes (`personaInstructions`,
« Applique ce savoir-faire (« … ») : », « Consigne supplémentaire (« … ») : ») ;
`AiClient.withInstructions` les ajoute après le rôle, dans le message système
(`withPersona` les garde). Les sept actions d'IA (Demander à l'IA, la langue, la référence
et la version, Interroger le dossier, Questionnaire, Relire, Traduire l'exigence) les
appliquent.

## Interface publique

| Nom | Rôle |
| --- | --- |
| `aiClient()` | le client réglé, ou `null` (module inactif, adresse ou modèle manquant) |
| `AiClient` | `models()`, `chat(requête)`, `chatJson(requête + schéma)` (réessaie sans schéma si le serveur ne sait pas les suivre), `embed(textes)`, `rerank(question, textes)`, `modelFor(usage)` |
| `modelsFor(usage, liste)`, `MODEL_USES`, `MODEL_KEYS` | les usages et le tri des modèles du serveur |
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
| `models.ts` | un modèle par usage : clés, tri des modèles du serveur | d'après la version complète (`llmModelRows`, `chatModels`) |
| `index.ts` | réglages, clé, test de connexion, `aiClient()` | nouveau |
| `home.ts` | la section du tableau de bord et la page IA | nouveau |
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
