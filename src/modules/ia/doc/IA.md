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
- **Tester la connexion** — interroge le serveur et retient la liste de ses modèles ; si
  aucun modèle d'analyse n'est choisi, il le fait choisir tout de suite ;
- **un modèle par usage** — chaque ligne a un menu qui propose les modèles du serveur qui
  conviennent à cet usage (d'après leur nom ; tous s'il n'y en a aucun), plus « — aucun — »
  et « Saisir un autre nom… » pour taper un nom à la main (le bouton liste ramène au menu).
  Avant le premier test de connexion, la ligne est un simple champ texte :

| Usage | À quoi il sert | Laissé vide |
| --- | --- | --- |
| **Analyse** | relecture et conseils, questions au dossier, questionnaire ; un modèle qui raisonne | obligatoire |
| **Traduction** | traduire les exigences ; un modèle rapide suffit | le modèle d'analyse |
| **Vecteurs (embeddings)** | les doublons par le sens, même entre deux langues | doublons par les lettres seulement |
| **Reranking** | remettre dans l'ordre de pertinence les passages trouvés pour une question, avant la réponse | l'ordre de la recherche |
| **Lecture OCR** | lire le texte des PDF scannés et des images, page par page (étape 7) | le modèle de vision |
| **Lecture par vision** | comprendre ce qu'une image montre — schéma, plan, photo (étape 7) | le modèle d'analyse |

- **Longueur maximale d'une réponse** — vide : celle du serveur.

Un échec est dit en clair : serveur injoignable (êtes-vous sur le bon réseau ?), adresse
qui ne se termine pas par `/v1`, clé refusée, modèle introuvable.

## La page IA

L'entrée **IA** du menu de gauche, la tuile **IA** de l'accueil ou le lien « Toute l'IA »
du tableau de bord ouvrent la **page IA**, dans l'onglet Black Projects :

- en chiffres : la connexion (prête ou à régler), les modèles du serveur retenus au dernier
  « Tester la connexion », les usages couverts, la longueur des réponses ;
- **Tester la connexion** et **Régler la connexion** (adresse, clé, longueur des réponses :
  la fenêtre du module) ;
- une **carte par usage** — analyse, traduction, vecteurs, reranking, OCR, vision : le
  modèle choisi, ou celui pris à la place, et à quoi il sert. **Choisir le modèle** propose
  les modèles du serveur qui conviennent à cet usage, et « Aucun (par défaut) » ;
- **Ce qui se sert de l'IA** : relire et traduire les exigences, interroger le dossier, le
  questionnaire, les doublons par le sens…, et ce qui arrive à l'étape 7 ;
- une recherche (usage, nom de modèle) et des filtres : modèle choisi, pris à la place,
  pas utilisé ;
- en tête, le **dernier test** : quand, réussi (combien de modèles, le modèle d'analyse) ou
  pourquoi pas (la raison) ;
- les **modèles du serveur**, chacun avec ce pour quoi il est choisi et ce à quoi il
  conviendrait.

**Tester la connexion** depuis la tuile ou le tableau de bord mène à la page IA, où le
résultat se lit ; depuis la page, on y reste. Depuis la palette, le message, comme avant.

**À chaque ouverture d'Obsidian**, le workflow système *Vérifier la connexion à l'IA, à
l'ouverture* (actif d'origine) interroge le serveur sans rien vous demander : la liste de
ses modèles est mise à jour, et rien n'est dit si tout va bien (le journal des workflows le
garde, la page IA montre le dernier test). Il vous prévient si le serveur ne répond pas, ou
si un modèle que vous avez choisi n'y est plus. Sans adresse réglée, il ne fait rien. Vous
le désactivez ou le modifiez sur la page {{link:Modules/Workflows|Workflows}} (filtre
« Système »).

Un autre, **« Identifier avec l'IA la langue d'un document, quand la détection n'est pas
sûre »** (activé) : quand un document entre dans la {{link:Modules/Bibliothèque|bibliothèque}}
et que sa langue n'a pas pu être détectée sûrement, le début de son texte est donné à l'IA ;
une réponse nette donne la langue (« identifiée par l'IA ») ; sinon elle reste à confirmer.

De même pour le **titre** (« Identifier avec l'IA le titre d'un document… », activé) : le
titre de la page de garde, fait des mots du document ; pour la **catégorie** (« Identifier avec l'IA la catégorie d'un document… », activé) :
choisie dans la liste des catégories ; pour la **date** (« Identifier avec l'IA la date d'un document… », activé) :
celle de son édition ou de sa signature, qui doit y figurer ; pour les **étiquettes** (« Donner avec l'IA les étiquettes d'un document… », activé) :
de 3 à 6, celles déjà en usage dans la bibliothèque d'abord, dites par le document sinon ; et pour l'**entreprise**
(« Identifier avec l'IA l'entreprise qui émet un document… », activé) : l'organisme qui a écrit le
document, qui doit y figurer — choisie, si elle y est, dans la liste des entreprises de la
bibliothèque (par son code). Et **« Identifier avec l'IA la
référence et la version d'un document, quand la première passe n'est pas sûre »** (activé) : quand le document ne les dit pas clairement
(référence lue seulement dans le nom du fichier, version absente…), l'IA les cherche au
début de son texte ; ce qu'elle trouve doit y figurer — elle n'invente rien.

**« Relire avec l'IA le texte extrait d'un document… »** (activé) : le texte extrait d'un
document versé est relu — sa cohérence, sa mise en forme, ce que l'extraction a abîmé —, sans
en changer le sens ; avec le prompt, le persona, le skill choisis dans son étape. Le texte relu
est une nouvelle version du texte du document : l'extraite est gardée, on les compare.
Des notices disent la relecture en cours (et ses morceaux), puis ce qu'elle a donné. Elle se
relance quand on **extrait de nouveau** le texte d'un document, ou par **Relire avec l'IA**
(section *Texte extrait* de sa fiche).

**La lecture complète d'un document**, d'origine dès que le document se montre en images (un
PDF, une image) — sinon le texte extrait —, page par page :

1. **le texte du fichier** (« copier-coller ») : ce que la page porte déjà ;
2. **l'OCR**, si la page n'en porte presque pas (un scan) et qu'un modèle d'OCR est réglé à
   part : son texte brut ;
3. **la vision** : la page en image (deux mille pixels sur son grand côté), et ce texte à
   vérifier, transcrite fidèlement — sa mise en forme (titres, listes, tableaux), **chaque image
   décrite à sa place** (« [Image : …] ») ; une page coupée par la limite de longueur est
   **continuée** là où elle s'arrête ;
4. **le contrôle** : une lecture qui a perdu plus de 30 % du texte du fichier est relue avec
   insistance ; encore courte, le texte du fichier la complète, dit tel ;
5. **la vérification par l'IA** : la page et sa transcription comparées — une note sur 100 et
   ce qui ne va pas ; sous 85, la transcription est **corrigée** d'après l'image, puis
   revérifiée, la meilleure gardée.

Puis le **nettoyage** — en-têtes et pieds de page répétés de page en page (même quand leur numéro
change, ou leur ordre une page sur deux ; repérés d'abord dans le texte du fichier, puis leurs
variantes et les lignes qui en sont faites), numéros de page (« AG 1 100v2 – 5 » aussi), sommaire
remis en liste à puces, ses sous-parties en retrait,
lignes coupées au milieu d'une phrase recollées, lignes vides en trop — et la **qualité** de la
transcription : **en étoiles sur cinq et en pourcentage** (« ★★★★☆ 88 % »), sur la version du
texte, la fiche (section *Texte extrait*) et la note du document. Sans images, le texte extrait
est nettoyé, remis en forme par l'IA partie par partie, et chaque partie vérifiée contre
l'original (relue une seconde fois sous 70).

**Une lecture qui boucle** — le modèle répète le même passage encore et encore, jusqu'à sa limite
de longueur — est repérée : la page (ou la partie) est **relue une deuxième fois**, autrement.
Bouclée encore : ce qui précède la boucle est gardé, et la page est marquée dans le texte
(« la lecture par l'IA a bouclé deux fois… ») ; une notice le dit. Rien que des boucles : un
message d'erreur, et le texte de la fiche ne change pas — essayez un autre modèle de vision.
Sur la fiche, **Relire avec l'IA** fait choisir le modèle : **simple** (le texte extrait) ou **avec
la vision** (la lecture complète ci-dessus — plus sûr, plus lent) ; l'étape du workflow a le même
choix (champ *Modèle* : **Automatique** d'origine, la vision quand le document se montre en
images). Un document sans texte (un
scan, une image) est **lu avec la vision dès son dépôt** — le workflow système « Lire avec la
vision un document versé sans texte… » (activé), par le modèle d'OCR, sinon celui de vision ;
désactivé, la fiche propose **Lire avec la vision (IA)**. Le modèle : celui d'OCR, sinon de vision, sinon celui d'analyse
(beaucoup de modèles récents voient). Si le serveur refuse les images pour ce modèle, une notice
le dit une fois ; choisissez alors un modèle qui voit sur la page IA. Toutes les
pages sont lues, une à une. Les formules mathématiques sont écrites en LaTeX.

Ces workflows servent aussi au bouton **Relancer la recherche** d'un champ, sur la fiche
d'un document de la bibliothèque : quand la recherche sans IA n'est pas sûre, celui du champ
est exécuté pour ce document (désactivé, l'IA n'est pas demandée, et c'est dit).

Deux autres workflows système le suivent :

| Workflow système | Ce qu'il fait | D'origine |
| --- | --- | --- |
| Signaler les nouveaux modèles du serveur, à l'ouverture | nomme les modèles apparus sur le serveur depuis la dernière fois, avec l'usage qui leur conviendrait (à choisir sur la page IA) ; rien de nouveau : rien n'est dit | activé |
| Signaler un serveur d'IA lent, à l'ouverture | chronomètre une demande minuscule au modèle d'analyse et prévient au-delà du seuil (5 s, réglable dans son action) | désactivé |

## 2. Ce que l'IA fait

| Où | Commande | Ce qu'elle fait |
| --- | --- | --- |
| Exigences | Relire l'exigence avec l'IA | les défauts que les règles ne voient pas, et des reformulations à choisir |
| Exigences | Traduire l'exigence avec l'IA | une traduction « automatique, à relire », chiffres et unités vérifiés |
| Analyse d'appels d'offres | Interroger le dossier | une réponse qui **cite ses sources** : la pièce et l'endroit |
| Analyse d'appels d'offres | Questionnaire du dossier | les questions prêtes à l'emploi, une réponse chacune, sources citées |
| Analyse d'appels d'offres | Relire les exigences du dossier avec l'IA | les plus faibles relues ; côté candidat, la formulation de l'acheteur n'est jamais changée |
| Exigences et Analyse d'appels d'offres | Analyser la qualité… (avec un modèle d'embeddings) | les doublons par le sens, en plus de ceux par les lettres |

Dans les {{link:Modules/Workflows|workflows}}, l'action **Demander à l'IA** envoie une
consigne et un contexte (souvent le résultat d'une étape d'avant, `{step1.text}`) ; sa
réponse passe aux étapes suivantes, ou s'écrit dans une note.

Ce que l'IA propose n'est jamais écrit sans vous : une reformulation se choisit, une
traduction est marquée « automatique, à relire », une réponse cite où elle a lu.

Voir {{link:Accueil|l'accueil}}.
