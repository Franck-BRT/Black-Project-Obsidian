# Recette — étape 6 bis : workflows

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

Sur le coffre de test. Les actions avec l'IA demandent le module IA réglé (voir
[étape 6](etape-6.md)) ; le reste fonctionne sans réseau.

## Prêts à l'emploi

- [ ] Commande **Nouveau workflow** : « De zéro » et les modèles des modules — calendrier à
      l'import des pièces ; qualité et cohérence à l'extraction ; questionnaire (IA) ;
      qualité de la bibliothèque chaque lundi
- [ ] Choisir *À l'import des pièces : relever le calendrier* ; sa fiche s'ouvre : déclencheur
      « AO : pièces importées », condition *Places contient « Appel d'offres »*, deux
      actions ; **Fermer**
- [ ] Dans une analyse, importer `A importer/CCAP Station sol.md` avec l'appel d'offres :
      le calendrier est relevé seul (`Analyse/Calendrier`) et un message le dit
- [ ] Créer *À l'extraction des exigences : qualité et cohérence*, puis **Extraire les
      exigences de la pièce** sur le CCTP : `Analyse/Qualité des exigences` et la section
      Cohérence de `Analyse/Vérification des exigences` sont écrites seules
- [ ] **Journal des workflows** : ✅ pour chacun, avec les liens vers les notes écrites

## Écrire un workflow

- [ ] **Nouveau workflow** → De zéro : nom « Critères », déclencheur *AO : pièces
      importées*, mode *Demander d'abord*
- [ ] Fiche → Conditions → Ajouter : *Types des pièces* **est** « RC, CCAP »
- [ ] Fiche → Actions → Ajouter : *Interroger le dossier (IA)*, question « Quels sont les
      critères d'attribution ? » ; puis *Ajouter à une note*, chemin `Suivi/{analyse}`,
      texte `- {today} : {step1.text} ({step1.link})` — la fenêtre rappelle les variables
      utilisables
- [ ] Monter / descendre / retirer une action ; la fiche résume conditions et actions
- [ ] Importer un RC : une confirmation dit ce que le workflow va faire ; « Pas
      maintenant » : rien n'est fait, le journal dit « refusé » ; à l'import suivant,
      « Exécuter » : la note `Suivi/<analyse>` reçoit la réponse et le lien
- [ ] **Exécuter un workflow** : choisir « Critères », puis l'analyse

## Planification, garde-fous, échange

- [ ] Un workflow *À heure fixe*, chaque jour à l'heure qui vient de passer : il
      s'exécute dans la minute, une seule fois
- [ ] Une action d'un module désactivé : le journal dit « action inconnue … son module
      est-il actif ? »
- [ ] Une action avec l'IA sans IA réglée : échec clair, « L'IA n'est pas réglée… »
- [ ] **Exporter des workflows** : un fichier dans `Black Projects/Échanges` ; **Importer
      des workflows** dans un autre coffre : repris **désactivés**
- [ ] Désactiver le module Workflows : importer des pièces ne déclenche plus rien, le
      reste fonctionne
