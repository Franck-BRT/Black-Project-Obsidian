# Module — Analyse d'appels d'offres (`ao`)

> Copyright © 2026 Black Room Technologies. Tous droits réservés.

| | |
| --- | --- |
| Identifiant | `ao` |
| Version | 0.1.0 |
| Requiert | — |
| État | Déclaré ; fonctions à partir de l'étape 1 |

## Ce que le module fera

| Fonction | Étape |
| --- | --- |
| Lire toutes les pièces du dossier (PDF, Word, Excel, PowerPoint, HTML, RTF, ZIP…) | 1-2 |
| Typer les pièces (RC, CCTP, CCAP, AE, BPU, DPGF, annexes) | 2 |
| Extraire les exigences (Word, Excel, PDF, ReqIF/DOORS), tracées à leur pièce | 3-4 |
| Mesurer la qualité des exigences (règles, score ISO/IEC/IEEE 29148, doublons) | 5 |
| Relecture et conseils par l'IA locale, doublons de sens | 6 |
| Calendrier de l'AO : dates limites, délais, avec la phrase source | 6 |
| Interroger tout le dossier, réponses sourcées | 6 |
| Matrice de conformité (Excel), rapport (Word), fiche de synthèse, risques | 7 |
| Comparer deux versions du dossier (avis rectificatif) | 7 |

## Organisation du code

- `src/modules/ao/` : la logique, en TypeScript pur.
- `src/obsidian/` : ses vues et commandes dans Obsidian (à partir de l'étape 2).
