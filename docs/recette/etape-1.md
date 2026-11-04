# Recette — étape 1 : lecteurs de documents

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

## Contrôles automatiques

- [ ] `pnpm run check` passe, dont `test/dce.test.ts`
- [ ] `pnpm run build` produit `main.js`

## Sur un vrai dossier (à faire avec le CNES)

Pas encore d'interface : l'essai se fait par les tests. Pour chaque pièce d'un dossier
réel anonymisé, déposée dans `test/fixtures/` :

- [ ] Le texte est complet : rien ne manque par rapport au document ouvert dans son
      application
- [ ] Les titres gardent leur niveau
- [ ] Les tableaux d'exigences et de prix sortent en lignes et colonnes
- [ ] Les accents sont justes
- [ ] Un PDF scanné est signalé « aucun texte », pas lu à moitié
- [ ] Un document protégé par mot de passe est signalé « illisible »
