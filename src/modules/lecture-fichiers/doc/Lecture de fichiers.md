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

## Essayer : « Lire un fichier du coffre (provisoire) »

1. Palette de commandes (Ctrl/Cmd + P) → **Lire un fichier du coffre (provisoire)**.
2. Choisissez un fichier : la liste ne propose que ceux qui se lisent, le fichier ouvert
   en premier, puis les plus récents.
3. Le texte extrait s'affiche, avec le format, le nombre de caractères et de lignes, et
   le temps de lecture. **Copier** le met dans le presse-papiers.

Cette commande est provisoire : elle sera remplacée par l'import du dossier de
consultation dans l'analyse d'appels d'offres.

## Quand un fichier ne se lit pas

| Message | Cause |
| --- | --- |
| « le format … n'est pas lu » | format non pris en charge (image, plan, archive…) |
| « ne contient aucun texte à lire » | un scan, ou un document vide |
| « n'a pas pu être lu » | fichier abîmé, ou protégé par un mot de passe d'ouverture |

## Les formats

Paramètres → Black Projects → **Formats de fichiers** (le bouton de la ligne « Lecture de
fichiers ») montre la même liste, un bloc par format.

🟩 lecture intégrée · 🟧 en développement (avec l'étape du plan) · ⬜ prévu

{{formats}}

## Extensions équivalentes

Certains fichiers ont une extension que Black Projects ne connaît pas, mais sont d'un
format qu'il lit : des fichiers `.tot` qui sont du XML, par exemple. Déclarez-les en tête
de la fenêtre **Formats de fichiers** : saisissez l'extension, choisissez le format
(« lu comme .xml »), **Ajouter**. Ils sont alors lus partout, par la commande comme par
les autres modules ; la corbeille retire une équivalence.

On ne peut pas redéfinir une extension déjà lue (`.pdf`, `.docx`…), ni choisir un format
qui ne se lit pas.

Vos équivalences aujourd'hui :

{{aliases}}
