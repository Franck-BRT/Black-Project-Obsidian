# Recette — étape 3 : socle des exigences

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Sur un coffre de test. **Jalon : créer, modifier et relire une exigence.**

## Le module

- [ ] Paramètres → Black Projects → Modules : une ligne **Exigences**, active ; bouton
      **Fonctions** : réglages (dossier, préfixe, chiffres, langues) et fonctions
      (bibliothèque disponible ; extraction, ReqIF, qualité, traductions, matrice à venir)

## Créer

- [ ] Commande **Nouvelle exigence** : catégorie, titre, formulation (FR, sur plusieurs
      lignes), type, statut (Brouillon), criticité, vérification, source, justification ;
      sans titre ou sans formulation : refusé
- [ ] Catégorie `sys` : message « Exigence REQ-SYS-0001 créée. » ; la note
      `Exigences/REQ-SYS-0001 <Titre>.md` s'ouvre : propriétés (id, formulation,
      catégorie SYS, type, statut…), puis le titre et la section « FR »
- [ ] Deuxième exigence `SYS` : `REQ-SYS-0002` ; supprimer la note de `REQ-SYS-0002`,
      en créer une autre : `REQ-SYS-0003` (jamais de numéro réutilisé)
- [ ] La catégorie suivante propose « Catégories déjà employées : SYS »

## Modifier, relire

- [ ] Sur la note d'une exigence, commande **Modifier l'exigence** : la fiche préremplie ;
      changer la formulation et le titre : « … enregistrée (révision 2) », la note est
      renommée et s'ouvre ; l'ancienne formulation est dans l'historique (`history`)
- [ ] Écrire un paragraphe sous les sections de la note, puis modifier la fiche : le
      paragraphe est toujours là
- [ ] Alias `omlx-sys-0001` : rangé `OMLX-SYS-0001` ; le même alias sur une autre
      exigence : refusé avec un message
- [ ] Sur une note qui n'est pas une exigence : « La note ouverte n'est pas une exigence. »

## La liste

- [ ] Commande **Exigences : liste, filtres et fiches** : « Exigences (n) », une ligne par
      exigence (identifiant, titre, formulation, type, statut, criticité)
- [ ] La recherche et les filtres (catégorie, type, statut, criticité) réduisent la
      liste ; le compte « x / n » suit
- [ ] Cliquer une ligne : **Modifier la fiche**, **Ouvrir la note**, **Retour à la
      liste** ; après la fiche, la liste revient avec les mêmes filtres
- [ ] **Nouvelle exigence** depuis la liste : la liste revient avec la nouvelle

## Citer dans un document

- [ ] Dans une note, un bloc `brt-req` avec `REQ-SYS-0001` et `OMLX-SYS-0001` : un tableau
      (identifiant, formulation, statut) ; l'alias est montré « OMLX-SYS-0001
      (REQ-SYS-0001) » ; un clic sur l'identifiant ouvre la note
- [ ] Un identifiant inconnu : « Introuvable(s) dans la bibliothèque : … » ; une clé
      `statut:` : « Clé(s) inconnue(s), ignorée(s) : statut. » ; un bloc vide : « Bloc vide… »
- [ ] `status: approved` + `fields: id, title, criticality` : les exigences approuvées,
      ces colonnes ; `lang: en` sans formulation anglaise : « pas de formulation EN : FR
      affichée »
- [ ] Modifier la formulation citée, puis rouvrir la note qui la cite : la nouvelle
      formulation s'affiche
- [ ] (v0.5.1) Les nouvelles notes portent `brt-requirement: true` ; un ancien bloc
      `pm-req` est dessiné comme un `brt-req` ; une note `pm-requirement: true` est
      dans la liste, et prend `brt-requirement` quand on modifie sa fiche

## Documentation

- [ ] **Créer / mettre à jour la documentation** : une page *Exigences* ; la *Prise en
      main* liste les trois commandes
