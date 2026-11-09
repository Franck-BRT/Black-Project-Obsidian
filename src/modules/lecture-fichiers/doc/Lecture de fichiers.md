# Lecture de fichiers

{{link:Accueil|← Accueil}}

Le module **Lecture de fichiers** lit le texte des documents de votre coffre — PDF, Word,
Excel, PowerPoint, RTF, pages web, Markdown, texte — pour les autres modules de Black
Projects, à commencer par l'analyse d'appels d'offres. Il ne dépend d'aucun service
extérieur et n'utilise pas le réseau.

## Ce qu'il en tire

Du texte structuré : les titres avec leur niveau, les paragraphes, les listes, et **les
tableaux gardés en lignes et en colonnes** — c'est souvent là que sont les exigences et
les prix. Les tableaux s'écrivent en vrais tableaux Markdown (une ligne d'en-tête, sa ligne
de séparation), qu'Obsidian montre en tableaux ; les colonnes vides (cases fusionnées) en
sont retirées.

## Où il sert

Quand vous importez les pièces d'un dossier de consultation dans une analyse d'appel
d'offres, chaque pièce est lue par ce module, et son texte rangé dans une note. Une
archive ZIP est ouverte, et chacun de ses fichiers lu à son tour.

## Quand un fichier ne se lit pas

| Message | Cause |
| --- | --- |
| « le format … n'est pas lu » | format non pris en charge (image, plan…) |
| « ne contient aucun texte à lire » | un scan, ou un document vide |
| « n'a pas pu être lu » | fichier abîmé, ou protégé par un mot de passe d'ouverture |

### Être prévenu d'un format non lu

Le workflow système **Signaler les formats non lus, au dépôt de fichiers** (activé
d'origine) regarde chaque dépôt de fichiers — les pièces importées dans une analyse, le
fichier d'un import — et prévient quand un format n'est pas lu, par exemple : « Station
sol — 1 fichier(s) dans un format non lu (.tot) : Releve.tot. » Si c'est du texte,
déclarez une extension équivalente (ci-dessous). Les images et les archives ne sont pas
signalées.

Dans la page **Workflows** (filtre *Système*), vous pouvez le désactiver, ou modifier son
action pour taire des extensions que vous savez non lues (« dwg, exe »). Il suit le dépôt
de la bibliothèque de documents : sans elle, il ne se déclenche pas. Voir
{{link:Modules/Workflows|Workflows}}.

### Être prévenu d'une pièce illisible ou sans texte

À l'import des pièces d'une analyse, le workflow système **Signaler les pièces
illisibles** (activé d'origine) nomme celles qui n'ont pas pu être lues — fichier abîmé,
ou protégé par un mot de passe d'ouverture — et dit que faire. **Signaler les pièces sans
texte (scans)** (désactivé d'origine) nomme celles sans texte lisible, que l'extraction des
exigences et l'IA ne voient pas. **Bilan des formats du coffre, chaque lundi** (désactivé)
compte les fichiers du coffre par format et nomme les extensions non lues. Voir la page
{{link:Modules/Workflows|Workflows}}, filtre *Système*.

## Les formats

Paramètres → Black Projects → **Formats de fichiers** (le bouton de la ligne « Lecture de
fichiers ») montre la même liste : une fiche par extension, trois par ligne — plusieurs
fiches pour le PDF, une par cas. Dans l'onglet de Black Projects, la tuile **Formats de
fichiers** (à ajouter à l'accueil par « Modifier l'accueil ») ouvre la même chose en page.

Chaque fiche dit si le format est **lu** par Black Projects, **écrit** — les notes `.md`
par Black Projects, ou par export (« Export uniquement » : les types de pièces en
`.json`, les notes exportées en PDF par Obsidian) — et **affiché** dans Obsidian
(« Oui nativement » pour ce qu'Obsidian ouvre lui-même). 🟩 verte : les trois ; 🟥 rouge : ni lu ni écrit, avec ce qui est à
venir ; 🟧 orange : le reste.

Obsidian ne montre dans son explorateur que les fichiers qu'il sait ouvrir : un `.json`
exporté, par exemple, est bien dans le coffre mais n'apparaît pas à gauche.
**L'interrupteur de la fiche** l'affiche : ces fichiers apparaissent alors dans
l'explorateur et s'ouvrent dans la visionneuse de Black Projects, en lecture seule, avec
un bouton pour les ouvrir avec l'application de l'ordinateur. Éteint, ils sont de
nouveau masqués.

{{formats}}

## Extensions équivalentes

Certains fichiers ont une extension que Black Projects ne connaît pas, mais sont d'un
format qu'il lit : des fichiers `.tot` qui sont du XML, par exemple. Déclarez-les en tête
de la fenêtre **Formats de fichiers** : saisissez l'extension, choisissez le format
(« lu comme .xml »), **Ajouter**. Ils sont alors lus partout, à l'import d'un dossier
comme par les autres modules ; la corbeille retire une équivalence.

On ne peut pas redéfinir une extension déjà lue (`.pdf`, `.docx`…), ni choisir un format
qui ne se lit pas.

Vos équivalences aujourd'hui :

{{aliases}}
