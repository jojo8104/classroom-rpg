# ROADMAP 7 — PASSAGE DE 3×3 À 5×5 / 25 ÉLÈVES

## Objectif général

Faire évoluer la classe de neuf élèves vers une classe complète de 25 élèves sur une grille logique 5×5, sans casser le moteur, rendre l’interface illisible, multiplier inutilement les calculs ou créer des dépendances à cette taille. Le système doit accepter d’autres dimensions.

## 1. Configuration de taille

Centraliser `rows`, `columns` et `maxStudents` dans `CLASSROOM_CONFIG`. Les capacités se calculent avec `rows * columns`, sans tailles implicites dans les règles métier.

## 2. ClassroomLayout

Utiliser le layout de la Roadmap 6 avec les dimensions configurées. Chaque siège conserve son identifiant, ses coordonnées, son occupant et ses tags.

## 3. Génération des sièges

Fournir `generateSeats(rows, columns)`. Les identifiants `seat_${row}_${column}` sont déterministes ; ne pas écrire manuellement les sièges.

## 4. Zones proportionnelles

Calculer `front`, `middle`, `back`, `left`, `center`, `right` depuis les dimensions. Sur 5×5, les deux premières lignes sont devant, la ligne centrale au milieu et les deux dernières au fond ; même principe pour les colonnes.

## 5. Environnement configurable

Le prototype place les fenêtres sur le bord gauche et la porte sur le bord droit. Les règles environnementales restent configurables.

## 6. Profils variés

Générer 25 élèves aux personnalités, rôles RPG, statistiques, connaissances, relations et préférences variés, pour obtenir des comportements différents.

## 7. Distribution RPG

Répartir les rôles pour tester les interactions. La répartition proposée (Offensif, Défensif, Support, Healer, Distance) est indicative et doit s’adapter aux classes déjà disponibles.

## 8. Relations pertinentes

Distinguer les relations enregistrées des relations utiles à l’action courante. Ne pas recalculer toutes les paires à chaque tick ; privilégier voisins et cibles d’interaction.

## 9. Relations absentes

Un lien non enregistré retourne une valeur neutre, `0`. Autoriser un stockage sparse.

## 10. Voisins rapides

Calculer les voisins depuis les coordonnées, sans parcourir tous les sièges à chaque appel.

## 11. Cache de topologie

Pré-calculer les voisins des sièges. Reconstruire ce cache uniquement quand la structure change ; un échange ne change que l’occupation.

## 12. Portées explicites

Formaliser `SELF`, `ADJACENT`, `DIAGONAL`, `ROW`, `COLUMN`, `RADIUS`, `GLOBAL`. Une interaction locale ne cible pas implicitement toute la classe.

## 13. Lignes, colonnes, rayons

Ajouter `getStudentsInRow`, `getStudentsInColumn`, `getStudentsInRadius`, exclusivement sur les coordonnées logiques.

## 14. Système de ciblage

Fournir `TargetingSystem.getTargets({ sourceStudentId, rangeType, rangeValue, filters })`, réutilisable par soutiens, effets RPG, perturbations et événements.

## 15. Chaînes bornées

Chaque élève dispose d’une première action potentielle. Borner ensuite les actions supplémentaires par élève, la profondeur et le nombre total d’actions/interactions.

## 16. File d’événements

Résoudre les actions et réactions depuis une file explicite, sans appels récursifs d’interactions. L’ordre doit rester contrôlable et observable.

## 17. Simulation indépendante des animations

Le moteur résout un tick et renvoie `events[]`. L’interface décide comment les présenter ; le calcul métier ne dépend jamais de leur durée d’animation.

## 18. Tick pédagogique

Un tick comprend une action principale potentielle par élève, les interactions secondaires bornées et les états finaux. Préserver un ordre de traitement clair.

## 19. Ordre configurable

Prévoir un ordre séquentiel ou mélangé. Garder les tests déterministes, avec une seed pour un mélange reproductible.

## 20. Importance des événements

Classer les événements `minor`, `normal`, `major`. L’interface peut regrouper les petits effets sans supprimer les événements métier.

## 21. Bruit visuel limité

Afficher un minimum d’informations sur l’ensemble de la classe et révéler les détails à la sélection. Ne pas afficher toutes les relations et statistiques en permanence.

## 22. Pupitres compacts

Pendant la leçon, montrer le nom, la progression, la concentration et l’état principal. Reporter les détails dans la fiche. La finition graphique relève de la Roadmap 8.

## 23. Indicateurs collectifs

Ajouter `getClassMetrics()` avec progression, moral, concentration et discipline moyens. Ces indicateurs ne remplacent pas les états individuels.

## 24. Répartition de compréhension

Calculer les effectifs `struggling`, `partial`, `acquired`, `mastered` depuis les résultats individuels.

## 25. Préparation à 25 élèves

Maintenir sélection, drag & drop, connaissances, aperçu relationnel, échange, verrous, reset et sauvegarde. Éviter des centaines de calculs par déplacement.

## 26. Recalcul des placements affectés

Après un changement, recalculer uniquement les élèves déplacés/échangés et leurs voisins directs via `recalculateAffectedPlacements(changedSeatIds)`.

## 27. Sièges vides

Tester une classe incomplète, notamment 23 présents et deux absents. Les requêtes de voisinage et de ciblage ignorent les sièges vides.

## 28. Autres dimensions

Tester au minimum 3×3, 4×4, 5×5 et 5×6 au niveau logique.

## 29. Performance

Mesurer 25 élèves sur 100 ticks, avec interactions, relations et connaissances actives : durée moyenne par tick, nombre d’événements et d’interactions, taille maximale de file. Détecter une explosion combinatoire.

## 30. Simulation accélérée

Ajouter un mode `instant` sans animation, avec résultats en console. Prévoir l’exécution de séries de leçons pour l’équilibrage futur.

## 31. Diagnostic de leçon

Exposer les ticks, actions principales, interactions secondaires, effets positifs/négatifs, profondeur maximale et durée de simulation.

## 32. Préparation du rendu 2.5D

Transmettre lignes et colonnes au renderer sans ajouter sprites, orientations ou perspective dans cette roadmap.

## 33. Profondeur logique

Prévoir `depth = row` pour le futur renderer, sans conversion graphique dans le moteur.

## 34. Dynamiques différentes

Vérifier des groupes favorables, zones perturbées, élèves moteurs et élèves dépendants du soutien, avec bonnes et mauvaises associations. Le dataset ne doit pas produire 25 comportements équivalents.

## 35. Critères de validation

1. Classe 5×5 fonctionnelle.
2. 25 élèves présents simultanément.
3. Aucune dépendance métier implicite au nombre 25.
4. Voisins corrects.
5. Relations performantes.
6. Interactions locales fonctionnelles.
7. Ciblage des lignes, colonnes et rayons.
8. Effets secondaires traités par une file.
9. Chaînes bornées.
10. Tick de classe complète fluide.
11. Préparation et drag & drop utilisables.
12. Sièges vides supportés.
13. Indicateurs collectifs calculés.
14. Simulation indépendante des animations.
15. Mesures excluant une explosion combinatoire dans le scénario testé.
16. Fonctionnement avec d’autres dimensions.

## Résultat attendu

Une classe complète composée de groupes, d’affinités et de tensions locales, où chaque élève conserve personnalité, connaissances, progression et statistiques individuelles.
