# ROADMAP 6 — PRÉPARATION DE CLASSE / PLACEMENT / DRAG & DROP

## Objectif général

Créer une véritable phase de préparation avant le lancement d’une leçon.

Le joueur doit pouvoir :

- voir la classe avant le cours ;
- consulter les élèves ;
- choisir leur placement ;
- déplacer les élèves par drag & drop ;
- comprendre les conséquences potentielles du placement ;
- sauvegarder une disposition ;
- lancer ensuite la leçon avec cette configuration.

Cette roadmap doit transformer le placement des élèves en choix stratégique.

La classe reste pour le moment en grille **3×3**. Le passage à **5×5 / 25 élèves** sera traité dans la Roadmap 7.

## 1. Créer un état de préparation de classe

Ajouter un état distinct avant la leçon. Exemple :

```js
GAME_STATE = {
    CLASS_PREPARATION: "class_preparation",
    LESSON: "lesson",
    LESSON_RESULT: "lesson_result"
}
```

Le joueur doit passer par : **Préparation → Leçon → Résultats**.

La phase de préparation ne doit pas utiliser directement le moteur actif de la leçon.

## 2. Créer ClassroomLayout

Créer une structure représentant le placement physique des élèves. Exemple :

```js
classroomLayout = {
    rows: 3,
    columns: 3,
    seats: [
        { id: "seat_0_0", row: 0, column: 0, studentId: "student_12" },
        { id: "seat_0_1", row: 0, column: 1, studentId: null }
    ]
}
```

Le placement ne doit **PAS** être stocké directement comme coordonnées fixes dans l’élève.

L’élève est une entité. Le siège est une position. Le layout établit le lien entre les deux.

## 3. Créer une notion de Seat

Chaque place doit être une entité légère. Exemple :

```js
{
    id: "seat_1_2",
    row: 1,
    column: 2,
    zone: "center",
    studentId: "student_04"
}
```

Prévoir également des informations environnementales :

```js
{
    nearWindow: true,
    nearDoor: false,
    frontRow: false,
    backRow: true
}
```

Ces caractéristiques pourront influencer plus tard la concentration, la discipline, le moral, la personnalité et les événements.

## 4. Définir les zones de classe

Créer automatiquement des zones depuis les coordonnées : DEVANT, MILIEU, FOND, GAUCHE, CENTRE, DROITE.

Un siège peut appartenir simultanément à plusieurs catégories. Exemple :

```js
seat.tags = ["back", "left", "near_window"]
```

Éviter de créer un énorme système pour le moment. Ces tags suffisent.

## 5. Prévoir les préférences individuelles

Les élèves peuvent déjà avoir des préférences comme :

```js
likes: ["back"]
dislikes: ["front"]
```

Faire intervenir ces préférences dans le calcul initial de confort. Créer par exemple `getSeatPreferenceModifier(student, seat)`.

- Place appréciée → moral + léger bonus.
- Place neutre → aucun changement.
- Place détestée → moral ou concentration légèrement réduite.

Ne pas créer encore de conséquences excessives. Le placement doit influencer le jeu sans déterminer entièrement le résultat.

## 6. Implémenter le drag & drop

Le joueur doit pouvoir déplacer un élève d’un siège vers un autre : appui / clic sur élève → drag → survol d’un siège → drop.

- Si le siège est vide : déplacer simplement l’élève.
- Si le siège est occupé : échanger les deux élèves.

Exemple : Alice → siège de Bastien. Alice prend la place de Bastien ; Bastien prend l’ancienne place d’Alice.

Le système doit être fluide et compréhensible visuellement.

## 7. Séparer logique et interface

Créer un système dédié, par exemple `systems/ClassroomLayoutSystem.js`.

Responsabilités :

```js
moveStudent(...)
swapStudents(...)
getSeat(...)
getStudentSeat(...)
canMoveStudent(...)
getNeighbors(...)
validateLayout(...)
```

Le drag & drop graphique appelle ces fonctions. L’interface ne doit pas modifier elle-même directement les données.

## 8. Ajouter le calcul des voisins

Créer `getNeighbors(studentId)` pour retrouver les élèves voisins.

Pour le moment, considérer gauche, droite, devant et derrière. Prévoir éventuellement les diagonales, mais les rendre configurables.

```js
{ direct: [...], diagonal: [...] }
```

Cette fonction sera utilisée par les relations, le soutien, les interactions, les combos RPG, la discipline et la propagation d’effets.

## 9. Afficher les relations pendant le placement

Lorsqu’un élève est sélectionné, afficher ses relations avec les élèves proches. Exemple : Alice sélectionnée → Bastien +63, Chloé −25, David +18.

Éviter d’afficher tous les scores en permanence : cela rendrait l’interface illisible. Les afficher plutôt lorsque l’élève est sélectionné, déplacé ou qu’une place est survolée.

## 10. Prévisualisation du placement

Lorsqu’un élève est déplacé au-dessus d’un siège, calculer ce que ce placement produirait.

Exemple : Alice → siège 2B ; relations voisines : Bastien +62, Chloé −31 ; préférence : fond de classe apprécié ; synergie : bonne.

Créer `previewPlacement(studentId, seatId)`. Elle ne doit pas modifier l’état réel et renvoie simplement les conséquences potentielles.

## 11. Créer un score de compatibilité de placement

Pour aider l’interface, calculer un score simple avec `getPlacementScore(student, seat)`.

Ce score peut utiliser la préférence de siège, les relations avec les voisins, la compatibilité RPG et d’éventuels besoins pédagogiques.

**Pour cette roadmap, limiter le calcul à : préférence + relations.**

Exemples : +40 très bon placement ; +10 correct ; 0 neutre ; −20 risqué ; −50 mauvais.

Ce score n’est **PAS** un résultat absolu. Il sert uniquement d’aide au joueur.

## 12. Ne pas automatiser le choix du joueur

Le système peut signaler une bonne position, une position neutre ou une position risquée. Mais il ne doit pas déplacer automatiquement les élèves.

Le placement doit rester une décision stratégique. Une future fonctionnalité pourra proposer une organisation automatique. Pas maintenant.

## 13. Ajouter une vue fiche élève

Pendant la préparation, cliquer sur un élève doit ouvrir une fiche compacte affichant :

- nom ;
- personnalité ;
- classe RPG ;
- moral ;
- concentration ;
- discipline ;
- connaissances principales ;
- relations importantes ;
- préférences de placement.

Ne pas transformer cette fiche en écran complet. Elle doit permettre de prendre rapidement une décision.

## 14. Intégrer les connaissances de la Roadmap 5

La préparation doit pouvoir afficher les connaissances utiles pour la prochaine leçon.

Si la leçon travaille la multiplication, la fiche peut montrer : Multiplication 35 %, Addition 72 %, Nombres entiers 91 %.

Le joueur peut ainsi décider de placer un élève en difficulté près d’un élève pouvant l’aider. Cela donne immédiatement une utilité stratégique aux connaissances persistantes.

## 15. Afficher les élèves pouvant aider

Lorsqu’un élève faible sur le concept principal est sélectionné, identifier éventuellement les voisins potentiellement utiles.

Exemple : Léa, Multiplication 28 %. Élèves utiles possibles : Thomas, maîtrise 82 %, relation +47 ; Sarah, maîtrise 91 %, relation −36.

On obtient un vrai dilemme : bon élève mais mauvaise relation, contre élève un peu moins fort mais excellente relation. Ne pas calculer automatiquement la meilleure réponse.

## 16. Préparer les synergies RPG

Le placement doit tenir compte des classes RPG créées auparavant. Exemples : Support, Healer, Défensif, Offensif, Distance.

Créer une fonction générique `getClassSynergy(studentA, studentB)`.

Pour cette roadmap, elle peut simplement exposer les synergies existantes au système de préparation. Ne pas ajouter de nouvelles classes ou compétences.

## 17. Visualisation des synergies

Lorsqu’un élève est sélectionné, afficher éventuellement les sièges avec une indication légère : vert → bon voisinage potentiel ; orange → neutre ; rouge → risque relationnel.

Ne pas coder les couleurs directement dans la logique métier. Le moteur doit renvoyer les états `"positive"`, `"neutral"`, `"negative"` et l’interface décide de leur représentation.

## 18. Ajouter la possibilité de verrouiller une place

Permettre au joueur de verrouiller certains élèves, par exemple avec `seat.locked = true`.

Un élève verrouillé ne peut pas être déplacé accidentellement. Cela sera surtout utile lorsque la classe comportera 25 élèves. Un clic sur une petite icône peut activer ou désactiver le verrouillage.

## 19. Ajouter Reset

Prévoir « Réinitialiser le placement », qui restaure la disposition initiale.

Sauvegarder donc `initialLayout` et `currentLayout`. Ne pas reconstruire l’état initial de manière approximative.

## 20. Sauvegarder les placements

Le jeu doit pouvoir retenir le placement actuel d’une classe, par exemple dans `classroom.layout` ou `classroom.savedLayouts`.

Pour cette roadmap, conserver au minimum `defaultLayout` et `currentLayout`. Après rechargement du jeu, le placement doit être retrouvé.

## 21. Préparer plusieurs configurations

Prévoir architecturalement la possibilité de sauvegarder plusieurs plans de classe : Plan habituel, Travail de groupe, Contrôle, Classe difficile, Révisions.

Ne pas encore construire l’interface complète de gestion de ces plans. Mais éviter une structure qui empêcherait cette évolution.

## 22. Bouton « Lancer la leçon »

La préparation se termine par « Lancer la leçon ».

Avant le lancement, `validateLayout()` doit vérifier :

- aucun élève dupliqué ;
- aucun siège contenant plusieurs élèves ;
- tous les élèves nécessaires placés ;
- structure du layout valide.

Puis créer l’état de leçon à partir du placement.

## 23. Le placement devient immuable pendant la leçon

Une fois la leçon commencée, copier ou figer le layout actif, par exemple `lessonState.layoutSnapshot`.

Cela garantit que le placement utilisé pendant la leçon reste celui choisi au départ. La phase de préparation ne doit pas modifier rétroactivement une leçon déjà commencée.

## 24. Utiliser le placement dans le moteur de leçon

Les systèmes existants doivent désormais utiliser `ClassroomLayoutSystem.getNeighbors(...)` au lieu de supposer directement qui est voisin de qui.

Les interactions deviennent ainsi dépendantes du placement réel. Cela concerne notamment l’encouragement, l’aide pédagogique, les effets de classe RPG, les bonus/malus, les relations, la propagation et les combos.

## 25. Prévoir les élèves absents

Le layout doit accepter `studentId: null`. Un siège vide est valide.

Prévoir également qu’un élève de la classe puisse être marqué `present: false`. Il n’est alors pas ajouté au layout actif de la leçon.

Pas besoin de développer maintenant tout un système d’appel ou d’absences.

## 26. Préparer le passage 5×5

Toute la logique doit fonctionner avec `rows` et `columns`, et jamais avec exactement 9 sièges.

Interdit, par exemple : `for (let i = 0; i < 9; i++)`. Préférer : `for (let i = 0; i < rows * columns; i++)`.

La Roadmap 7 changera simplement 3×3 en 5×5 sans réécrire le moteur.

## 27. Ne pas dépendre du rendu 2.5D

La Roadmap 8 ajoutera les orientations et sprites.

Le système de placement doit donc travailler uniquement avec `row`, `column`, `seatId`, `studentId`, pas avec `pixelX`, `pixelY`, `spriteDirection`.

La conversion coordonnées logiques → écran appartient au renderer.

## 28. Architecture recommandée

Structure possible :

```text
models/
    Classroom.js
    Seat.js
    ClassroomLayout.js
systems/
    ClassroomLayoutSystem.js
    PlacementEvaluationSystem.js
ui/
    ClassroomPreparationView.js
    StudentCard.js
```

Éviter de créer un seul énorme fichier `classroom.js`.

## 29. Tests indispensables

Tester au minimum :

- **Déplacement vers siège vide** : A → vide.
- **Échange** : A ↔ B.
- **Changement de voisins** : après échange, `getNeighbors(A)` doit être mis à jour.
- **Relations** : le score de placement doit changer selon les voisins.
- **Connaissances** : un élève fort dans la notion doit apparaître comme voisin pédagogiquement intéressant.
- **Préférences** : un élève aimant le fond doit recevoir le bonus correspondant.
- **Reload** : le placement doit survivre à un rechargement.
- **Grille configurable** : tester temporairement 4×4 pour vérifier qu’aucune logique n’est codée spécifiquement pour 3×3.

## 30. Critères de validation

La Roadmap 6 est terminée lorsque :

1. une phase de préparation existe avant chaque leçon ;
2. les élèves apparaissent sur une grille 3×3 ;
3. ils peuvent être déplacés par drag & drop ;
4. déposer sur un élève provoque un échange ;
5. les voisins sont recalculés automatiquement ;
6. les relations influencent l’évaluation du placement ;
7. les préférences individuelles influencent cette évaluation ;
8. les connaissances de la Roadmap 5 sont visibles pour préparer la leçon ;
9. un élève compétent peut être identifié comme soutien potentiel d’un voisin faible ;
10. les classes RPG peuvent intervenir dans les synergies ;
11. le placement est sauvegardé ;
12. le placement utilisé est figé au lancement de la leçon ;
13. le moteur de leçon utilise le layout pour déterminer les voisins ;
14. aucune logique métier ne dépend de coordonnées graphiques ;
15. le système fonctionne avec une taille de grille configurable.

## Résultat attendu

Avant une leçon, le joueur peut observer :

```text
Sujet : Multiplication
┌───────────┬───────────┬───────────┐
│ Alice     │ Bastien   │ Chloé     │
│ 82 %      │ 34 %      │ 67 %      │
├───────────┼───────────┼───────────┤
│ David     │ Emma      │ Farid     │
│ 51 %      │ 23 %      │ 91 %      │
├───────────┼───────────┼───────────┤
│ Gabriel   │ Hana      │ Inès      │
│ 73 %      │ 45 %      │ 62 %      │
└───────────┴───────────┴───────────┘
```

Le joueur remarque par exemple : Emma maîtrise mal la multiplication. Farid la maîtrise très bien. Mais Emma et Farid ont une mauvaise relation. Alice maîtrise également bien la notion et s’entend très bien avec Emma.

Le joueur peut alors réorganiser la classe. Cette décision modifie réellement les interactions lorsque la leçon commence.

La préparation de classe devient ainsi une phase stratégique à part entière, et non simplement un écran décoratif.
