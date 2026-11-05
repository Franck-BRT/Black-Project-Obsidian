# Lecture de fichiers

{{link:Accueil|← Accueil}}

Le module **Lecture de fichiers** lit le texte des documents de votre coffre — PDF, Word,
Excel, PowerPoint, RTF, pages web, Markdown, texte — pour les autres modules de Black
Projects, à commencer par l'analyse d'appels d'offres. Il ne dépend d'aucun service
extérieur et n'utilise pas le réseau.

## Ce qu'il en tire

Du texte structuré : les titres avec leur niveau, les paragraphes, les listes, et **les
tableaux gardés en lignes et en colonnes** — c'est souvent là que sont les exigences et
les prix.

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

## Les formats

Paramètres → Black Projects → **Formats de fichiers** (le bouton de la ligne « Lecture de
fichiers ») montre la même liste, un bloc par format.

🟩 lecture intégrée · 🟧 en développement (avec l'étape du plan) · ⬜ prévu

Chaque format dit aussi s'il est **écrit par Black Projects** (aujourd'hui : les notes
`.md` et les exports de types `.json`) et s'il est **affiché dans Obsidian**. Obsidian ne
montre dans son explorateur que les fichiers qu'il sait ouvrir : un `.json` exporté, par
exemple, est bien dans le coffre mais n'apparaît pas à gauche. Pour tout voir :
Paramètres d'Obsidian → Fichiers et liens → **Détecter toutes les extensions de
fichier** (ces fichiers s'ouvrent alors avec une autre application).

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
