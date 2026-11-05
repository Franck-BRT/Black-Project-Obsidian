# Recette — étape 5 : analyse qualité sans IA

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Sur le coffre de test, **sans connexion réseau**. **Jalon de démo n° 3 : analyse complète
hors ligne, sans serveur d'IA.**

## Le dossier

- [ ] Dans l'analyse « Station sol », importer `A importer/CCTP lot 2.md` (avec l'appel
      d'offres), puis **Extraire les exigences de la pièce** sur sa note : 8 exigences
      EX-CC-001 à EX-CC-008
- [ ] Commande **Analyser la qualité des exigences du dossier** : message « Qualité des
      exigences : n exigence(s), note moyenne … % » ; la note `Analyse/Qualité des
      exigences` s'ouvre
- [ ] Vue d'ensemble : nombre d'exigences, note moyenne en étoiles, faibles ; répartition
      des notes avec barres ; moyenne par axe (unique, non ambiguë, vérifiable,
      attribuable — pas de complète ni traçable pour un dossier)
- [ ] Défauts les plus fréquents : aucune obligation (EX-CC-008), plusieurs obligations
      (EX-CC-006), terme vague « convivial » (EX-CC-003), « et/ou » et « TBD » (EX-CC-004),
      tournure passive sans acteur (EX-CC-005), comparatif non chiffré « réduit »
      (EX-CC-007)
- [ ] Doublons probables : EX-CC-001 et EX-CC-002 (« 2 s » / « 2 secondes »), environ 90 %
- [ ] Non vérifiables : EX-CC-003 (pas de méthode), EX-CC-007 (comparatif non chiffré)
- [ ] Les plus faibles : EX-CC-008 (deux étoiles au plus : n'oblige personne)
- [ ] Les liens du rapport ouvrent les exigences
- [ ] Écrire dans la section Notes, relancer : la note est gardée, le reste réécrit

## La bibliothèque

- [ ] Commande **Exigences : liste, filtres et fiches** : une colonne **Note** en étoiles ;
      le filtre « Faibles (moins de 3 étoiles) »
- [ ] **Modifier la fiche** : en tête, « Note : ★★★☆☆ … % » et les défauts
- [ ] Un bloc `brt-req` avec `fields: id, text, rating` : la colonne Note en étoiles
- [ ] Commande **Analyser la qualité de la bibliothèque d'exigences** : la note `Qualité
      des exigences` du dossier `Exigences`, avec en plus les **rattachements**
