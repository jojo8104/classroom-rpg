# R13 — Types de séances et observation pédagogique

## Parcours

La leçon reste un élément du programme. L'agenda existant choisit la leçon, le type de séance et, pour les exercices/devoirs, une complexité de 0 à 100. Il n'y a ni nouvel agenda ni écran de préparation supplémentaire.

| Approche | Résolution | Effet principal |
| --- | --- | --- |
| Magistral | Tours habituels, relations, soutiens et combos conservés | Acquisition rapide ; observation faible |
| Exercice | Même moteur, difficulté individuelle comparée aux acquis | Acquisition et diagnostic ; Moral affecté par la difficulté |
| Révision | Pression réduite, faible acquisition nouvelle | Récupération prioritaire de l'érosion, protection, concepts liés par tags |
| Évaluation | Deux tours automatiques individuels, lecture visuelle compacte | Consomme 8 Autorité, baisse initiale de 5 Moral ; aucune acquisition de maîtrise, aucune aide ni intervention |
| Devoir | Deux tours automatiques individuels | Préparation de 30 minutes hors classe et 6 Patience ; rendement très dépendant de la Discipline |

Les devoirs sont attachés à un créneau existant pour leur date, mais n'occupent pas ce créneau d'enseignement. Ils sont résolus avant le cours ancré au même créneau. Le budget de préparation est de 60 minutes par journée ; un devoir terminé ne peut pas être supprimé pour récupérer ce budget. Cette première version résout immédiatement le travail autonome, sans gestion de copies non rendues ou de délai de correction.

## Données et compatibilité

- `lessonMastery[lessonId]` reste la source de vérité de la maîtrise actuellement mobilisable, utilisée par les systèmes existants.
- `learningMemory[lessonId]` conserve `masteryAcquired`, `lastUsedAt`, `erosionUpdatedAt`, `lastRevisionAt`, `revisionProtection` et l'observation du professeur.
- La réserve récupérable est calculée par `masteryAcquired - lessonMastery[lessonId]` ; elle n'est pas stockée en double.
- L'observation contient une estimation quantifiée, une confiance durable et un bonus temporaire qui décroît avec le temps. La Pédagogie réduit l'incertitude. Même une évaluation ne révèle pas la valeur exacte.
- `recentSessionTypes` conserve cinq approches au plus par élève participant. Dès la troisième répétition consécutive, le Moral baisse selon la personnalité ; aucune statistique de saturation n'est ajoutée.
- L'agenda conserve `type` pour les sauvegardes précédentes et ajoute `sessionType` et `difficulty`. Les anciennes séances sans ces champs restent lisibles.
- Les sauvegardes de préparation conservent maintenant le professeur, afin de persister les dépenses de Patience et d'Autorité.

Les données absentes sont initialisées sans effacer les acquis. Les dates reposent sur les semaines de l'agenda, y compris vacances et jours non affichés du week-end. Les appels répétés au même instant ne cumulent pas l'érosion ; une avance en bloc donne le même résultat que des avances quotidiennes.

## Moteur et présentation

`ReactionSetup` accepte un contexte individuel et une adaptation du tour par élève. La file d'actions, les calculs de travail, la RNG seedée, les événements et le rendu 2.5D restent les mêmes. L'évaluation et le devoir interdisent explicitement soutiens, combos, perturbations entre élèves et interventions du professeur.

La performance d'évaluation utilise la maîtrise, la Discipline, le Moral et la Concentration. Elle est distincte de la maîtrise persistante et sert à produire une observation interprétée. Les pupitres, fiches, bilans, aperçu de placement et agenda ne présentent plus les nombres exacts de maîtrise/progression. Les événements et les outils CLI de diagnostic conservent leurs données numériques internes.

La révision étend temporairement le pool de concepts avec les concepts partageant les tags de la leçon ; elle ne modifie pas le programme. Les découvertes utilisent le service existant, et les réactivations sont signalées par des événements. Une contribution spécifique des concepts à l'érosion reste une extension future.

## Réglages et limites assumées

Les paramètres temporels, coûts, observation et répétition sont regroupés dans `src/data/sessionRules.ts`. Les zones de difficulté et rendements sont dans `src/engine/session.ts`, les gains persistants dans `src/data/teachingModes.ts`. Il s'agit de valeurs exploratoires, sans campagne lourde d'équilibrage.

La restauration de concentration entre deux séances en classe reste celle du moteur antérieur. Les devoirs transmettent leur fatigue au cours suivant. La confiance d'observation s'améliore au bilan de la séance ; pendant les tours, les animations donnent des indices qualitatifs.

## Validation

La suite existante de 302 cas est conservée, avec mise à jour des assertions R10 qui interdisaient les devoirs ou imposaient les anciens champs de séance. Vingt cas R13 ciblés couvrent les cinq approches, le déterminisme, l'isolement, la difficulté, l'interprétation, l'érosion, la récupération/protection, les concepts liés, le devoir, la répétition, l'agenda et la persistance. Aucun test lourd d'équilibrage n'est ajouté.

Résultat final : **322 tests réussis sur 322**, vérification TypeScript réussie et build web/Pages réussi. Aucun test navigateur interactif n'a été effectué.
