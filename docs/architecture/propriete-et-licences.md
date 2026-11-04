# Propriété et licences

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

## Propriété du code

- Le code est la propriété exclusive de Black Room Technologies, sous [licence
  propriétaire](../../LICENSE).
- Chaque fichier source porte la mention de propriété ; `pnpm check:headers` le vérifie.
- Le dépôt est privé ; seul le plugin compilé est livré.
- Black Projects est un projet à part entière, sans code d'origine tierce ;
  `pnpm check:mentions` vérifie qu'aucune référence à un projet tiers n'y entre. Seul du
  code écrit par Black Room est repris de `module-obsidian` ; le reste est réécrit.

**Points à faire valider par un juriste :**

- le texte de la licence et de la licence d'évaluation accordée au CNES ;
- pour le code écrit par des salariés, les droits patrimoniaux reviennent à l'employeur
  (art. L113-9 du Code de la propriété intellectuelle) ;
- pour un freelance ou un sous-traitant, une **cession de droits écrite** est
  indispensable ;
- un dépôt à l'APP (Agence pour la protection des programmes) date la paternité du code.

## Licences d'usage

Aujourd'hui : **version d'évaluation**, tous les modules ouverts (`EVALUATION` dans
`src/core/licence.ts`).

Le jour où Black Projects devient payant, rien d'autre que les droits passés au registre
ne change :

- un fichier de licence signé par Black Room (client, modules, échéance) ;
- vérifié **hors ligne** avec une clé publique embarquée, sans serveur d'activation —
  adapté aux réseaux restreints ;
- la clé privée reste chez Black Room, dans un outil séparé ;
- à l'échéance, le module passe en lecture seule : **les données ne sont jamais
  bloquées**.

Limite à garder en tête : toute vérification faite dans un plugin JavaScript peut être
contournée. La protection réelle tient au contrat, à la livraison du seul code compilé,
et aux sources privées.

## Diffusion

Les règles de l'annuaire officiel d'Obsidian autorisent un plugin payant (à indiquer
dans le README) mais interdisent qu'un plugin s'installe ou se mette à jour lui-même et
qu'il obscurcisse son code. Elles ne s'appliquent pas à une livraison directe au client.
