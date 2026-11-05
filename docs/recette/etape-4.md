# Recette — étape 4 : extraction des exigences du dossier

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Sur le coffre de test. **Jalon de démo n° 2 : les exigences du CCTP extraites et tracées
jusqu'à leur pièce.**

## Depuis une pièce

- [ ] Analyse « Station sol », import de `A importer/DCE Station sol.zip` (étape 2)
- [ ] Ouvrir la note `CCTP (docx)` → commande **Extraire les exigences de la pièce** :
      fenêtre « Exigences trouvées dans CCTP.docx (3) », « 3 nouvelle(s)… » ; EX-SOL-001
      et EX-SOL-002 « Nouvelle · Article 2 — Exigences, tableau 1, ligne 1 / 2 »,
      EX-SOL-003 « … paragraphe 1 » ; toutes cochées
- [ ] **Importer** : « CCTP.docx : 3 exigence(s) créée(s), 0 mise(s) à jour. »
- [ ] `Station sol/Exigences/` contient `EX-SOL-001.md`… : formulation, vérification
      (Inspection, Essai), propriété `origin` (lien vers la pièce, endroit), et en tête
      « *Origine : CCTP (docx) — Article 2 — Exigences, tableau 1, ligne 1* » ; le lien
      ouvre la pièce
- [ ] La note de la pièce montre « Exigences extraites (3) », avant le texte extrait,
      chaque exigence en lien
- [ ] La note de l'analyse montre « Exigences du dossier » : tableau exigence /
      formulation / pièce / où, avant la section Notes
- [ ] Recommencer sur la même pièce : « 0 nouvelle(s), 0 à mettre à jour, 3
      inchangée(s) », rien de coché, rien d'écrit
- [ ] Même chose sur `CCTP (pdf)` et `CCTP (md)` : les trois exigences sont reconnues
      (« inchangées » si celles du Word sont déjà là)
- [ ] Décocher une exigence : elle n'est pas importée
- [ ] Depuis la note de l'analyse, **Extraire les exigences de la pièce** : la liste des
      pièces d'où l'on sait extraire, puis le même aperçu
- [ ] Sur une pièce sans exigence (RC) : message « Aucune exigence trouvée… » qui dit ce
      qui est reconnu
- [ ] Supprimer une exigence de `Exigences/`, puis **Mettre à jour les exigences de
      l'analyse** : les deux listes suivent

## Dans la bibliothèque

- [ ] Commande **Importer des exigences d'un fichier** → « Dans le coffre » →
      `A importer/Exigences fournisseur.reqif` : trois exigences FOU-ANT-0001,
      FOU-ANT-0002, FOU-RF-0001, nouvelles, « objet 1, 2, 3 »
- [ ] Après import : dans `Exigences/`, avec titre, statut Approuvée, vérification ;
      FOU-RF-0001 « dérive de » FOU-ANT-0001 ; l'origine est un lien vers le fichier
- [ ] Un CSV dont l'en-tête est « Exigence;Vérification;Priorité » (sans identifiant) :
      la catégorie est demandée, les exigences reçoivent REQ-<catégorie>-0001… ; « Essai »
      et « Haute » deviennent les valeurs rangées
- [ ] Un document dont les identifiants ne sont pas au format de la bibliothèque
      (`SYS-12`) : l'exigence reçoit un identifiant, et `SYS-12` devient son alias
- [ ] Une colonne inconnue, une valeur non reconnue : dites dans l'aperçu
