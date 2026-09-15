# Roadmap 5 — Univers fantasy et Concepts persistants

## Périmètre réalisé

L’école des royaumes conserve un enseignement général primaire. Les fractions sont abordées à travers le partage des provisions de voyage. Les rôles Offensif, Défensif et Soutien et tous les systèmes existants sont conservés. Aucune orientation ou profession supplémentaire n’est implémentée.

La structure minimale réutilise les modèles existants : `Program → Subject.programId → Topic.subjectId → Lesson.topicId → Lesson.conceptPool`. `Topic` représente le chapitre scolaire ; `Lesson.chapters` conserve les phases de séance historiques. La compréhension individuelle reste de 0 à 100 %. Aucun éditeur ou programme complet n’est ajouté.

## Concepts

- Catalogue unique dans `src/data/concepts.ts`, référencé par identifiant. `conceptIds` et `knowledge` restent compatibles avec le placement existant.
- `student.concepts.acquired` contient les identifiants acquis ; `student.concepts.progress` conserve une progression entre 0 et 1, commune à toutes les leçons.
- Le service `Concepts` centralise catalogue, éligibilité, tentatives, recherches et effets. La recherche par plusieurs tags exige tous les tags ; une liste vide renvoie tous les acquis.
- Une attribution d’au moins 5 XP au bilan déclenche une tentative par Concept éligible. Le RNG déterministe existant est injecté, après la progression normale.
- Chance : taux de la relation leçon–Concept, compréhension, persévérance, pédagogie du professeur, modificateur explicite du professeur, bonus des acquis et progression partielle. Résultat borné entre 0 et 1.
- Un échec ajoute 0,05 à la progression ; un succès enregistre l’acquis et supprime sa progression. Un acquis ne consomme plus de tirage.
- `learning_boost` augmente les récompenses XP des leçons portant tous les tags de l’effet. Les bonus sont additionnés, puis les récompenses arrondies à l’entier pour conserver le format XP existant. Les nouvelles acquisitions ne bonifient pas rétroactivement leur propre récompense. Les trois autres types d’effets restent des données inertes.
- Les découvertes émettent `concept_discovered` et figurent dans le bilan à toutes les vitesses de lecture. La fiche de préparation présente les acquis.
- La sauvegarde existante transporte les acquis et la progression ; les anciens élèves sans Concepts reçoivent des valeurs sûres au chargement. Les élèves absents restent inchangés lors d’une simulation.

## Validation ciblée

Cinq tests Concepts couvrent acquisition, progression partielle et partage entre leçons, exclusion des doublons, tags et bonus XP, branchement au bilan, sauvegarde et migration. Les tests existants de progression, simulation, placement, classe complète, validation, rendu et bilan ont été exécutés ; seul le placement a nécessité une correction sur la préservation des absents, puis une relance ciblée.
