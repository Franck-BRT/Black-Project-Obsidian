# Guide utilisateur

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Le guide s'écrit au fil des étapes du [plan d'intégration](../plan-integration.md) :

| Chapitre | Étape |
| --- | --- |
| 01 — Importer un dossier de consultation | 2 ✅ (page *Analyse d'appels d'offres* dans le coffre) |
| 02 — Extraire les exigences | 3-4 |
| 03 — Analyser la qualité | 5 |
| 04 — Interroger le dossier avec l'IA | 6 |
| 05 — Produire les livrables | 7 |

## Aujourd'hui (version 0.6.0)

- **Analyse d'appels d'offres** : « Nouvelle analyse d'appel d'offres », puis importer
  les pièces (ou le ZIP du dossier), ou les déposer dans `Pièces/Originaux` et « Mettre à
  jour l'analyse » ; chaque pièce est lue, typée et décrite par une note ; la note de
  l'analyse tient le tableau des pièces. Voir la page *Analyse d'appels d'offres* de la
  documentation écrite dans le coffre. Les types de pièces et les mots-clés qui les font
  reconnaître sont dans Paramètres → Black Projects → **Types de pièces** (module
  *Typage des pièces*), où vous pouvez ajouter, modifier et supprimer vos propres types
  et mots-clés, désactiver n'importe quel type, et exporter ou importer des types pour
  les échanger avec d'autres coffres. Chaque pièce est rangée avec l'appel d'offres ou
  avec la réponse (une par candidat pour l'émetteur), d'après le réglage « Où vont les
  types de pièces » du module *Analyse d'appels d'offres* (un bouton pour ajouter un
  type, une liste dépliable, un type par ligne avec ses interrupteurs « AO » et « Réponse AO ») ; quand le type va dans les
  deux, la question est posée à l'import. La liste est vide au départ : à vous de
  choisir ; un message l'explique à l'activation du module, puis un rappel s'affiche à
  l'ouverture tant qu'elle est vide (il se coupe d'une case). Les fiches de **Types de
  pièces** rappellent où va chaque type, et l'export / import de types fait voyager ce
  rangement.


- **Exigences** : « Nouvelle exigence » (catégorie, titre, formulation, attributs ;
  l'identifiant REQ-SYS-0001 est attribué et ne sera jamais réutilisé), « Exigences :
  liste, filtres et fiches » pour parcourir la bibliothèque et modifier une fiche, et le
  bloc `brt-req` pour citer des exigences dans un document ; voir la page *Exigences* de
  la documentation écrite dans le coffre.

- **Extraire les exigences** : sur la note d'une pièce (le CCTP), « Extraire les exigences
  de la pièce » ; un aperçu montre chaque exigence trouvée et où, puis elles sont rangées
  dans le dossier `Exigences` de l'analyse, chacune liée à sa pièce ; la pièce et
  l'analyse les listent. « Importer des exigences d'un fichier » fait de même pour la
  bibliothèque (ReqIF de DOORS compris).

- **Documentation dans le coffre** : Réglages → Documentation → **Créer / mettre à jour**
  (ou la commande « Créer ou mettre à jour la documentation ») écrit l'accueil, la prise
  en main et une page par module dans `Black Projects/Documentation` (dossier
  modifiable), puis ouvre l'accueil. Vos propres notes ne sont jamais remplacées.
- **Infobulles** : survoler un réglage, un bouton, un état ou un bloc explique à quoi il
  sert.

- **Réglages → Général → Langue** : français ou anglais, appliqué au prochain chargement.
- **Réglages → Modules** : l'état de chaque module ; l'interrupteur l'active ou le
  désactive au prochain chargement. Vos données ne sont jamais supprimées.
- **Cliquer sur « Lecture de fichiers »** (ou sur son bouton **Formats de fichiers**) :
  une fenêtre montre les formats lus (en vert), en développement (en orange, avec
  une fiche par extension, trois par ligne, qui dit si le format est **lu**, **écrit**
  (« Export uniquement » quand il n'est créé que par export, comme le PDF) et **affiché**
  (« Oui nativement » quand Obsidian l'ouvre lui-même) (verte : les trois ; rouge : ni lu ni
  écrit, avec ce qui est à venir ; orange : le reste). Obsidian masque les fichiers qu'il
  n'ouvre pas, comme les `.json` d'export de types : l'**interrupteur** de leur fiche les
  affiche dans l'explorateur, ouverts en lecture seule par Black Projects.
- **Extensions équivalentes** (en tête de la fenêtre Formats de fichiers) : lire par exemple les
  fichiers `.tot` comme du XML ; voir [Lecture de fichiers](../modules/lecture-fichiers.md).
- **Réglages → Licence** : les droits d'usage.
- Commande **À propos de Black Projects** : version, modules actifs, licence.
