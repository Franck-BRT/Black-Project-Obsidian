# Typage des pièces

{{link:Accueil|← Accueil}}

Le module **Typage des pièces** reconnaît le type d'un document de dossier de
consultation — RC, CCTP, CCAP, BPU… — d'après le nom de son fichier et le titre de son
texte. L'{{link:Modules/Analyse d'appels d'offres|analyse d'appels d'offres}} s'en sert
à l'import de chaque pièce.

Tout se règle dans Paramètres → Black Projects → bouton **Types de pièces** de la ligne
« Typage des pièces ». Dans l'onglet de Black Projects, la tuile **Types de pièces** (à
ajouter à l'accueil par « Modifier l'accueil ») ouvre la même chose en page ; **Importer…**
et **Exporter…** s'y lancent sans la quitter.

## La reconnaissance

Le type est deviné d'abord d'après le **nom du fichier**, puis, si le nom ne dit rien,
d'après le **titre** en tête du texte. Les types sont essayés dans l'ordre du tableau ;
le premier qui correspond l'emporte. Un mot-clé est cherché comme mot entier, sans tenir
compte des accents, de la casse ni de la ponctuation (« CCTP_v3 » et « cctp v3 » se
valent) ; terminé par « … », il vaut aussi pour les mots qui le prolongent (« annexe… »
trouve « Annexes »). Vos mots-clés passent avant ceux du module.

{{types}}

*(ajouté)* : un type ou un mot-clé à vous ; *(désactivé)* : un type désactivé.

## Vos types

« Types de pièces personnalisés » ajoute un type avec un code court et un libellé
(« PAQ » — « Plan d'assurance qualité »). Il prend place après les types du module,
avant « autre pièce » ; son code sert aussi de mot-clé dans le nom des fichiers
(« PAQ_v2.pdf »).

- Le **crayon** modifie son code ou son libellé : un nouveau code est repris par ses
  mots-clés et par les pièces déjà importées, dans toutes les analyses.
- La **corbeille** le supprime, après une confirmation qui dit ce qu'elle emporte : ses
  mots-clés partent avec lui ; les pièces qui l'avaient le gardent, signalé « type
  retiré ».

Les types du module ne se modifient pas ; on leur ajoute des mots-clés, ou on les
désactive.

## Vos mots-clés

Deux listes — « nom du fichier » et « titre du document » — où ajouter un mot ou une
expression vers un type (« SPEC » → CCTP, « grille de prix » → BPU). Ils valent pour les
prochains imports ; pour une pièce déjà importée, utilisez la commande **Changer le type
de la pièce**. Un mot-clé déjà déclaré, ou déjà connu du module pour ce type, est refusé
avec un message. Chacun a son crayon et sa corbeille.

## Désactiver un type

Chaque fiche de type a un interrupteur. Un type désactivé — du module ou à vous — n'est
plus reconnu (le type suivant qui correspond prend la place) ni proposé. Les pièces qui
l'ont déjà le gardent, marqué « (désactivé) » dans le tableau de leur analyse.
« Autre pièce » ne se désactive pas.

## Échanger des types

En tête de la fenêtre, **Exporter** et **Importer** (aussi en commandes : « Exporter des
types de pièces », « Importer des types de pièces ») :

- **Exporter** : cochez un ou plusieurs types — vos types, et ceux du module que vous
  avez modifiés (mots-clés, désactivation), ou que l'analyse d'appels d'offres range
  (où va le type : AO, Réponse AO, ou les deux — il voyage avec). Ils sont écrits dans un fichier
  `types-de-pieces-AAAA-MM-JJ.json` du dossier des échanges (par défaut `Black
  Projects/Échanges`, réglable).
- **Importer** : choisissez un tel fichier, sur l'ordinateur ou dans le coffre. La liste
  dit ce que deviendra chaque type — nouveau, mise à jour, mots-clés d'un type du module —
  et ceux qui ne peuvent pas être importés (un code qui est déjà un type du module).
  Cochez ceux à prendre. Les mots-clés s'ajoutent aux vôtres ; ceux qui feraient doublon
  sont écartés et comptés. Si le fichier dit où va un type (« va dans : Réponse AO »),
  l'analyse d'appels d'offres le reprend dans sa liste « Types rangés ».
