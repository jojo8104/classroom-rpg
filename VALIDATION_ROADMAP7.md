# Roadmap 7 — réalisation et état de validation

## Réalisation

- Configuration centrale 5×5, génération déterministe des sièges et profils variés ; dimensions génériques, zones proportionnelles et bords fenêtre/porte configurables.
- Trois rôles RPG existants conservés : offensif, défensif et support. Aucun rôle ou pouvoir supplémentaire inventé.
- Index des sièges et occupants, voisinage précalculé ; un déplacement actualise les occupants sans reconstruire la topologie.
- Relations orientées creuses : une relation absente vaut zéro. Le moteur indexe les relations pertinentes et cible principalement le voisinage local.
- Ciblage SELF, ADJACENT, DIAGONAL, ROW, COLUMN, RADIUS et GLOBAL ; rayon de Manhattan, source exclue par défaut sauf SELF, sièges vides ignorés.
- Files d’actions et réactions bornées, trois actions supplémentaires au maximum par élève et budget global proportionnel à l’effectif. Ordre séquentiel ou mélangé avec le générateur déterministe existant.
- Résolution des ticks indépendante de la lecture visuelle ; priorités et agrégation dans l’interface, mode instantané et statistiques de simulation.
- Moyennes collectives et répartition de compréhension calculées depuis les états individuels.
- Préparation compacte avec détails à la sélection, aperçu local et recalcul des seuls placements affectés. Migration des anciens plans 3×3 en conservant positions, verrous et données des élèves.
- Coordonnées métier logiques uniquement ; profondeur exposée au renderer égale à la ligne.

## Vérifications réalisées avant la demande d’arrêt des tests

La suite existante de 255 tests a réussi, puis les 17 nouveaux cas ont réussi séparément. Ces nouveaux cas couvrent notamment les tailles 3×3, 4×4, 5×5 et 5×6, les sièges vides, les portées, les caches, la migration, les limites de file et la simulation de 100 ticks. La vérification TypeScript et la construction GitHub Pages avaient également réussi.

Un chargement initial de la préparation et une capture sur ordinateur ont montré les 25 élèves et leur fiche. Les gestes de drag & drop, le parcours complet et l’affichage mobile n’ont pas été vérifiés dans le navigateur pour cette livraison.

À la demande explicite de l’utilisateur, aucun test supplémentaire n’est exécuté après la reprise finale. Les derniers ajustements CSS et documentaires font uniquement l’objet d’une reconstruction des fichiers à publier.

## Mesure enregistrée

Source : `benchmark-roadmap7.json`, une classe de 25 élèves, 100 ticks, une leçon.

| Indicateur | Mesure |
| --- | ---: |
| Actions principales | 2 500 |
| Interactions secondaires | 163 |
| Événements de ticks | 21 662 |
| Taille maximale de file | 25 |
| Budget de file | 125 |
| Profondeur maximale de chaîne | 1 |
| Limite de profondeur | 3 |
| Temps moyen par tick | 21,59 ms |
| 95e percentile | 78,41 ms |
| Tick maximal | 250,93 ms |
| Durée totale | 3 118,60 ms |

Mesure ponctuelle dépendante de la machine et de l’échauffement du moteur JavaScript ; elle ne garantit pas une cadence graphique constante. Les événements comptés sont les événements d’action des ticks, pas tous les événements du cycle de leçon. Les effets positifs/négatifs comptent des variations de ressources ou de progression, pas des compétences uniques. Le rapport conserve également les comportements individuels pour examiner leur diversité.

## Livraison

Les sources et les fichiers statiques `docs/` sont destinés au dépôt GitHub existant. Aucune publication Sites n’est effectuée. Le déploiement effectif de GitHub Pages n’est pas vérifié ici.
