# Validation Roadmap 3

Implémentation : six traits composables, relations orientées persistantes hors Student,
choix pondérés par seed, conséquences relationnelles, journal explicable et matrice.

## Incréments

1. Modèle et helpers : `domain.ts`, `engine/social.ts`, `tests/social.test.ts`.
   Génération, bornes, asymétrie, poids et traits : 195 tests passent avec la suite existante.
2. Moteur : `actions.ts`, `reactions.ts`, `turn.ts`, `disruptions.ts`, `simulation.ts`.
   Les portes moral, maîtrise, archétype, voisinage et budgets sont conservées.
   Les scénarios historiques restent disponibles, sans activation implicite des règles sociales.
3. Présentation : `data/socialPrototype.ts`, `ui/app.ts`, `cli/formatJournal.ts` et `cli/simulate.ts`.
   Profils distincts, matrice orientée, événements détaillés et transmission interséances.
4. Validation finale : 205 tests passent (190 historiques et 15 nouveaux), typecheck et build
   passent ; simulation CLI avec seed 12345 et interventions exécutée avec succès.

## Scénarios couverts

- Altruisme : poids accru pour une cible en difficulté et seuil ordinaire assoupli.
- Sociabilité : poids social et gratitude accrus.
- Impulsivité : poids spontanés positifs/négatifs et fluctuations accrus.
- Calme : fluctuations et certains effets négatifs atténués, poids sociaux réduits.
- Persévérance : moindre perte de moral après difficulté, testée aussi sur une riposte réelle.
- Compétitivité : poids de travail et comparaison positive/négative selon le lien orienté.
- Relation forte : synergie disponible seulement si les deux maîtrises sont suffisantes.
- Déterminisme : répétition intégrale avec interventions ; ordre des collections ; plusieurs seeds.
- Persistance : transfert explicite des relations et élèves à une nouvelle séance ; snapshots isolés.
- Logs : poids décomposés, refus de maîtrise, variations et matrice finale.

## Décisions de prototype

Une réaction reste attachée à la cible de sa fenêtre ; la sélection entre plusieurs
cibles s'effectue dans les soutiens/perturbations principaux. L'altruisme ne débloque
pas les combos. Les liens évoluent entre deux actions, sans historique social séparé.
La personnalité ne change jamais les statistiques permanentes. La persistance est un
contrat d'état interséances, sans sauvegarde disque ni campagne.

L'équilibrage final, l'affinité et les conflits sociaux complexes restent hors périmètre.
Aucun test visuel automatisé de navigateur n'a été réalisé.
