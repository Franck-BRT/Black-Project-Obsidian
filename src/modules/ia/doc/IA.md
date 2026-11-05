# IA

Le module **IA** relie Black Projects au serveur d'IA de votre entreprise, s'il est
compatible OpenAI (c'est le cas de la plupart : vLLM, Ollama, LiteLLM…). Sans lui, tout Black Projects
fonctionne : seules la relecture et la traduction des exigences et les questions posées au
dossier le demandent.

## 1. Régler la connexion

Paramètres → Black Projects → bouton **Fonctions** de la ligne « IA » :

- **Adresse du serveur** — jusqu'à `/v1` ; demandez celle du serveur d'IA à votre service
  informatique ;
- **Clé d'accès** — si le serveur en demande une. Elle est rangée dans le **trousseau de
  l'ordinateur**, jamais dans le coffre ni dans les réglages synchronisés ; la fenêtre dit
  seulement si une clé est enregistrée ;
- **Tester la connexion** — interroge le serveur, liste ses modèles et fait choisir le
  **modèle de texte** ;
- **Modèle d'embeddings** (facultatif) — pour trouver les exigences qui disent la même
  chose en d'autres mots ;
- **Longueur maximale d'une réponse** — vide : celle du serveur.

Un échec est dit en clair : serveur injoignable (êtes-vous sur le bon réseau ?), adresse
qui ne se termine pas par `/v1`, clé refusée, modèle introuvable.

## 2. Ce que l'IA fait

| Où | Commande | Ce qu'elle fait |
| --- | --- | --- |
| Exigences | Relire l'exigence avec l'IA | les défauts que les règles ne voient pas, et des reformulations à choisir |
| Exigences | Traduire l'exigence avec l'IA | une traduction « automatique, à relire », chiffres et unités vérifiés |
| Analyse d'appels d'offres | Interroger le dossier | une réponse qui **cite ses sources** : la pièce et l'endroit |
| Analyse d'appels d'offres | Questionnaire du dossier | les questions prêtes à l'emploi, une réponse chacune, sources citées |
| Analyse d'appels d'offres | Relire les exigences du dossier avec l'IA | les plus faibles relues ; côté candidat, la formulation de l'acheteur n'est jamais changée |
| Exigences et Analyse d'appels d'offres | Analyser la qualité… (avec un modèle d'embeddings) | les doublons par le sens, en plus de ceux par les lettres |

Ce que l'IA propose n'est jamais écrit sans vous : une reformulation se choisit, une
traduction est marquée « automatique, à relire », une réponse cite où elle a lu.

Voir {{link:Accueil|l'accueil}}.
