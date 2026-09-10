# Classroom RPG — Vision générale et Roadmap 1

## 1. Objectif du projet

Construire depuis zéro un jeu de simulation/gestion de classe inspiré des mécaniques de RPG.

Le joueur incarne un professeur responsable d'une classe d'environ 25 élèves.

Son objectif à long terme est de préparer cette classe à un examen final.

Le jeu repose sur deux niveaux complémentaires :

1. un niveau stratégique :
   - programmation des leçons ;
   - choix de la progression pédagogique ;
   - gestion du temps disponible avant l'examen ;
   - évolution des élèves ;
   - évolution du professeur ;
   - évolution des classes/archétypes RPG ;
   - acquisition progressive de concepts pédagogiques.

2. un niveau tactique :
   - déroulement d'une leçon ;
   - simulation des élèves ;
   - interactions entre élèves ;
   - interventions du professeur entre les rounds ;
   - progression individuelle de chaque élève.

La première priorité n'est PAS le rendu graphique.

La priorité est de construire un moteur de simulation propre, déterministe, testable et indépendant de l'interface.

---

# 2. Principe général d'une leçon

Une leçon n'utilise pas une progression collective unique.

Chaque élève affronte individuellement la difficulté de la leçon et possède sa propre valeur de compréhension.

À la fin d'une même leçon, on peut par exemple obtenir :

```text
Alice : 91 %
Paul  : 74 %
Léa   : 48 %
Hugo  : 23 %
```

Deux élèves assistant au même cours peuvent donc en sortir avec des niveaux de compréhension très différents.

La compréhension est propre à une leçon.

Elle ne représente PAS directement la compétence générale de l'élève dans une matière.

---

# 3. Organisation pédagogique

Le contenu pédagogique suit cette hiérarchie :

```text
Subject
└── Topic
    └── Lesson
        ├── LessonChapter
        └── Concept references
```

Exemple :

```text
Mathématiques
└── Fractions
    ├── Introduction aux fractions
    │   ├── Parts d'un tout
    │   └── Numérateur / dénominateur
    │
    ├── Comparaison des fractions
    │   ├── Même dénominateur
    │   └── Dénominateurs différents
    │
    └── Calcul avec les fractions
```

Les termes doivent rester clairement distincts :

- `Subject` : matière, par exemple Mathématiques.
- `Topic` : thème pédagogique, par exemple Fractions.
- `Lesson` : leçon particulière.
- `LessonChapter` : phase interne d'une leçon.
- `Concept` : connaissance réutilisable pouvant apparaître dans plusieurs leçons.

Ne pas utiliser `LessonTheme` car cela créerait une ambiguïté avec `Topic`.

---

# 4. Concepts pédagogiques

Une leçon référence plusieurs concepts.

Exemple :

```text
numerator
denominator
equivalent_fraction
simplification
proportion
```

Deux leçons différentes peuvent partager un même concept.

Exemple :

```text
Lesson A
└── denominator

Lesson B
└── denominator
```

Un élève peut débloquer/acquérir un concept même si sa compréhension globale de la leçon est imparfaite.

Exemple :

```text
Comparaison des fractions : 48 %

Concepts acquis :
✓ dénominateur commun
```

Lorsqu'une future leçon utilise un concept déjà acquis, l'élève pourra recevoir un avantage.

Les concepts constituent donc une forme de "loot pédagogique" persistant.

Pour les premières versions, un concept peut simplement être :

```ts
unlocked: boolean
```

Une évolution future pourra introduire plusieurs niveaux :

```text
découvert
compris
maîtrisé
```

Ne pas implémenter cette complexité maintenant.

---

# 5. Compréhension, résultats et concepts

Ces trois notions doivent rester séparées.

## Compréhension de la leçon en cours

Valeur temporaire utilisée pendant la simulation :

```ts
lessonUnderstanding: number
```

Bornée entre :

```text
0 et 100
```

---

## Résultat d'une leçon

Persistant après la séance :

```ts
interface LessonResult {
  lessonId: string;
  understanding: number;
}
```

---

## Concepts acquis

Progression persistante indépendante du résultat global :

```ts
interface UnlockedConcept {
  conceptId: string;
  unlocked: boolean;
}
```

Cette séparation doit être respectée dès la conception du domaine.

---

# 6. Structure interne d'une leçon

Une leçon contient plusieurs chapitres.

Exemple :

```text
Lesson
├── Chapter 1
├── Chapter 2
└── Chapter 3
```

Chaque chapitre peut contenir plusieurs rounds.

Exemple :

```text
LESSON
│
├── CHAPTER 1
│   ├── round 1
│   ├── round 2
│   └── round 3
│
├── CHAPTER 2
│   ├── round 4
│   ├── round 5
│   └── round 6
│
└── CHAPTER 3
```

Les rounds sont une mécanique interne.

Le joueur ne doit pas nécessairement voir explicitement :

```text
ROUND 4
```

Le rendu final devra plutôt montrer le chapitre ou l'étape pédagogique en cours.

---

# 7. Les élèves

Chaque élève est une entité individuelle persistante.

Prévoir au minimum :

```ts
interface Student {
  id: string;
  name: string;

  intelligence: number;
  discipline: number;
  concentration: number;
  morale: number;

  archetypeId: string;

  seatId: string;
}
```

Le modèle devra ultérieurement accueillir :

- personnalité ;
- affinités ;
- compétences ;
- états temporaires ;
- progression de classe RPG ;
- concepts acquis ;
- historique des leçons ;
- autres caractéristiques.

Ne pas tout implémenter pendant Roadmap 1.

---

# 8. Statistiques principales des élèves

Les statistiques actuellement prévues sont :

## Intelligence

Capacité générale à comprendre et produire des progrès pédagogiques.

## Discipline

Résistance aux perturbations et à certains effets négatifs.

## Concentration

Capacité à rester efficace pendant la leçon.

## Moral

Modificateur du comportement et de l'efficacité.

## Compréhension

Progression temporaire propre à la leçon en cours.

Les formules exactes ne sont pas encore définitives.

Les valeurs et calculs doivent donc rester facilement configurables.

Éviter de disperser des constantes numériques dans le code.

---

# 9. Classes / archétypes RPG

Chaque élève possède un archétype RPG.

Exemples envisagés :

```text
Offensif
Défensif
Support
Healer
Distance
etc.
```

Ces archétypes influencent :

- les actions disponibles ;
- leur comportement ;
- les probabilités de certaines actions ;
- les interactions avec les voisins ;
- les bonus/malus ;
- les combos.

Les archétypes pourront évoluer au cours du jeu.

Ils doivent donc être modélisés comme des données/compositions et PAS par héritage.

NE PAS faire :

```ts
class OffensiveStudent extends Student
```

Préférer :

```ts
interface Student {
  archetypeId: string;
}
```

L'évolution pourra ultérieurement utiliser :

```ts
interface StudentArchetypeProgress {
  archetypeId: string;
  level: number;
  experience: number;
}
```

Pour Roadmap 1, utiliser uniquement trois archétypes simples :

```text
Offensif
Défensif
Support
```

Leur équilibrage n'est pas définitif.

---

# 10. Personnalités

La personnalité est indépendante de l'archétype RPG.

Exemple :

```text
archétype : Support
personnalité : Bavard
```

ou :

```text
archétype : Offensif
personnalité : Studieux
```

Les personnalités pourront influencer :

- choix des actions ;
- réactions ;
- concentration ;
- relations ;
- comportement pendant une leçon.

Cette mécanique n'est PAS à implémenter dans Roadmap 1.

L'architecture doit simplement permettre son ajout futur.

---

# 11. Affinités entre élèves

Les élèves pourront avoir des relations entre eux :

```text
amitié
camaraderie
antipathie
indifférence
etc.
```

Les affinités pourront modifier :

- efficacité d'un soutien ;
- risque de perturbation ;
- chance de combo ;
- réactions à certaines actions.

Cette mécanique sera développée ultérieurement.

---

# 12. Salle de classe et placement

La version finale comportera environ 25 élèves.

La disposition principale envisagée est une grille 5 × 5.

Chaque siège possède une position logique :

```ts
interface Seat {
  id: string;
  row: number;
  column: number;
}
```

À partir de cette position, le moteur devra pouvoir déterminer :

```text
gauche
droite
devant
derrière
diagonales éventuelles
```

Ces relations serviront aux interactions.

Deux élèves ne peuvent pas occuper simultanément le même siège.

Pour Roadmap 1 :

```text
3 × 3
9 élèves
```

---

# 13. Fonctionnement par rounds

Le moteur d'une leçon fonctionne par rounds.

Au début d'un round, chaque élève reçoit normalement une action principale.

Le moteur résout les actions selon un ordre déterminé.

Une action peut :

- augmenter la compréhension personnelle ;
- soutenir un autre élève ;
- perturber un autre élève ;
- appliquer un buff ;
- appliquer un debuff ;
- provoquer une action supplémentaire.

Certaines réactions peuvent créer une chaîne.

Exemple :

```text
Alice agit
↓
Alice soutient Paul
↓
Paul reçoit un bonus
↓
Paul obtient une action supplémentaire
↓
Paul agit
↓
son action affecte Léa
↓
Léa réagit
```

Ces chaînes doivent être explicitement protégées contre les boucles infinies.

---

# 14. Action Queue

Ne pas résoudre les réactions par récursion incontrôlée.

Utiliser une file explicite d'actions.

Conceptuellement :

```text
Action normale
      ↓
ActionQueue
      ↓
ActionResolver
      ↓
résultat
      ↓
nouvelle action éventuelle
      ↓
ActionQueue
```

Prévoir des protections telles que :

```text
maxExtraActionsPerStudent
maxActionsPerRound
maxChainDepth
```

ou un mécanisme équivalent.

Le moteur doit pouvoir expliquer pourquoi une chaîne s'est arrêtée.

---

# 15. Actions configurables

Les actions doivent autant que possible être décrites par des données et exécutées par des résolveurs génériques.

Exemple conceptuel :

```ts
{
  id: "encourage_neighbor",
  type: "support",
  target: "adjacent_student",
  effects: [
    {
      stat: "concentration",
      value: 2
    }
  ]
}
```

Éviter un énorme ensemble de :

```ts
if (...)
else if (...)
else if (...)
```

spécifiques à chaque capacité.

Ne pas construire non plus un DSL complexe prématurément.

Roadmap 1 doit rester simple.

---

# 16. Le professeur

Le professeur est une véritable entité du domaine.

Il possédera notamment :

```ts
interface Teacher {
  id: string;

  pedagogy: number;
  authority: number;
  patience: number;
}
```

Ses statistiques pourront évoluer au cours du jeu.

Des capacités seront ajoutées ultérieurement.

Exemples possibles :

```text
Encourager
Recadrer
Réexpliquer
Changer de méthode
Interroger
Faire une pause
```

La patience pourra éventuellement devenir une ressource utilisée par certaines interventions.

Ces mécaniques ne sont pas à finaliser maintenant.

---

# 17. Intervention du professeur entre les rounds

Principe fondamental :

**Le professeur n'intervient jamais pendant la résolution d'un round.**

La boucle doit être :

```text
ROUND N
   ↓
simulation complète
   ↓
résultat logique
   ↓
rendu / animations
   ↓
TEACHER_INTERVENTION
   ↓
choix du professeur
   ↓
application de l'effet
   ↓
ROUND N+1
```

Cela permet de maintenir la synchronisation entre moteur et affichage.

Le gameplay recherché est :

```text
observer un résultat
↓
identifier un problème
↓
prendre une décision
↓
observer ses conséquences au round suivant
```

Une intervention du professeur ne doit jamais modifier rétroactivement le round précédent.

Elle influence :

- l'état entre les rounds ;
- le round suivant ;
- éventuellement plusieurs rounds futurs.

Prévoir une machine d'état explicite.

Exemple :

```ts
type LessonState =
  | "ROUND_READY"
  | "ROUND_RESOLVING"
  | "ROUND_RESULT"
  | "TEACHER_INTERVENTION"
  | "LESSON_FINISHED";
```

Roadmap 1 doit intégrer cette phase même si aucune véritable action de professeur n'est encore disponible.

Exemple :

```text
ROUND 1
↓
TEACHER_INTERVENTION
→ aucune intervention
↓
ROUND 2
```

---

# 18. Déterminisme

Le moteur doit être déterministe.

Toute mécanique aléatoire doit passer par un générateur contrôlé par une seed.

Exemple :

```ts
const simulation = new Simulation({
  seed: 12345
});
```

NE PAS utiliser directement `Math.random()` dans la logique métier.

Les mêmes :

```text
données initiales
+
règles
+
seed
```

doivent produire exactement les mêmes résultats.

Cela permettra :

- reproduction des bugs ;
- tests ;
- équilibrage ;
- comparaison de variantes ;
- simulations massives.

---

# 19. Séparation simulation / rendu

C'est une contrainte architecturale majeure.

Le moteur de simulation ne doit dépendre :

- ni du DOM ;
- ni de CSS ;
- ni d'un moteur graphique ;
- ni des animations.

Une leçon complète doit pouvoir être simulée sans interface graphique.

Le moteur produit des événements structurés.

Exemple :

```ts
{
  type: "STUDENT_ACTION",
  actorId: "lea",
  actionId: "support",
  targetId: "paul"
}
```

Puis :

```ts
{
  type: "EFFECT_APPLIED",
  sourceId: "lea",
  targetId: "paul",
  effectId: "concentration_bonus",
  amount: 2
}
```

Puis éventuellement :

```ts
{
  type: "EXTRA_ACTION_CREATED",
  studentId: "paul"
}
```

L'interface graphique consommera ultérieurement ces événements.

---

# 20. Event Queue et futur rendu continu

Le moteur fonctionne par rounds.

L'interface finale doit cependant donner l'impression d'une classe qui fonctionne de manière continue.

Architecture envisagée :

```text
Simulation
    ↓
Game Events
    ↓
Animation Queue
    ↓
Rendu
```

Le moteur peut résoudre rapidement un round complet.

Le rendu pourra ensuite jouer les événements progressivement.

Le professeur ne récupère le contrôle qu'une fois le rendu du round terminé.

Cette séparation doit être anticipée mais l'Animation Queue n'est PAS à développer pendant Roadmap 1.

---

# 21. Direction graphique finale

Le rendu final sera probablement construit en TypeScript avec :

```text
HTML/CSS
+
moteur graphique 2D éventuellement PixiJS
```

PixiJS est envisagé mais PAS imposé à ce stade.

Ne pas introduire de dépendance graphique dans Roadmap 1.

---

# 22. Vue finale de la classe

La salle devra conserver l'apparence d'une vraie salle de classe stylisée.

Elle comportera :

- tableau noir ;
- professeur ;
- environ 25 pupitres ;
- élèves ;
- décor scolaire.

Le tableau noir deviendra une partie importante de l'interface de la leçon.

Il pourra afficher :

- matière ;
- leçon ;
- chapitre actuel ;
- concepts ;
- progression ;
- informations pédagogiques ;
- temps restant éventuellement.

Éviter de dupliquer ces informations dans de nombreux panneaux HUD.

Le décor doit autant que possible participer à l'interface.

---

# 23. Pupitres

Le pupitre reste graphiquement un vrai pupitre.

Il sert également d'unité d'interface discrète pour l'élève.

Il pourra afficher notamment :

- compréhension ;
- sélection ;
- certains états.

Éviter une accumulation permanente de jauges et d'icônes flottantes.

---

# 24. Représentation graphique des archétypes

La classe RPG d'un élève sera principalement identifiable par la couleur de ses vêtements.

Cela permet de lire rapidement la composition de la classe sans ajouter une icône permanente au-dessus de chaque personnage.

Les icônes flottantes doivent plutôt être réservées aux événements temporaires :

```text
buff
debuff
combo
inspiration
perturbation
etc.
```

---

# 25. Orientations des élèves

Les personnages devront pouvoir être représentés selon six orientations :

```text
front
back

left
right

threeQuarterLeft
threeQuarterRight
```

Dans la vue normale :

- les élèves des colonnes centrales seront principalement vus de dos ;
- les élèves des colonnes latérales seront plutôt vus de trois-quarts.

Les autres directions servent aux actions et réactions.

Exemple :

```text
idle_back
↓
turn_right
↓
help_right
↓
idle_back
```

Direction, action et humeur doivent rester des notions distinctes.

Exemple futur :

```ts
interface StudentVisualState {
  direction:
    | "front"
    | "back"
    | "left"
    | "right"
    | "threeQuarterLeft"
    | "threeQuarterRight";

  action: string;
  mood: string;
}
```

Il n'est PAS nécessaire de créer toutes les animations dans les six orientations.

---

# 26. Animations spatiales

Deux grandes familles d'animations sont prévues.

## Interaction entre élèves

```text
Élève A
   ↓
animation / projectile / effet
   ↓
Élève B
```

Exemples :

```text
soutien
perturbation
bonus
malus
combo
```

## Interaction avec la leçon

```text
Élève
   ↓
animation
   ↓
TABLEAU
```

Le tableau sert ainsi visuellement de représentation de la leçon.

---

# 27. Agenda du professeur

À terme, le joueur disposera d'un pseudo-agenda permettant de programmer ses leçons avant l'examen final.

Il faut distinguer :

## Définition d'une leçon

```ts
Lesson
```

et :

## Occurrence planifiée

```ts
interface ScheduledLesson {
  id: string;
  lessonId: string;
  scheduledAt: string;
  status: string;
}
```

Une même leçon pourra donc être programmée plusieurs fois.

L'agenda constituera potentiellement le niveau stratégique du jeu.

Exemples de décisions futures :

```text
retravailler une leçon mal comprise ;
passer au sujet suivant ;
réviser un concept ;
faire une séance plus facile ;
préparer spécifiquement l'examen ;
consacrer du temps à certaines lacunes.
```

L'agenda n'est PAS à développer pendant Roadmap 1.

---

# 28. Boucle générale de campagne

Le jeu initial peut se concentrer sur une seule classe.

Objectif :

```text
DÉBUT
│
├── programmation des cours
├── leçons
├── acquisition de concepts
├── évolution des élèves
├── évolution des archétypes
├── évolution du professeur
│
└── EXAMEN FINAL
```

L'examen final donne un objectif temporel et stratégique à la campagne.

La gestion de plusieurs classes pourra être envisagée beaucoup plus tard.

Ne pas la développer actuellement.

---

# 29. Architecture générale envisagée

Les concepts suivants seront probablement nécessaires :

```text
Student
StudentArchetype
StudentProgress
Personality

Teacher

Classroom
Seat

Subject
Topic
Lesson
LessonChapter
Concept
ScheduledLesson
LessonResult

RoundEngine

Action
ActionQueue
ActionResolver

Effect
EffectResolver

GameEvent
EventQueue

SeededRandom

Simulation
SimulationResult
```

Cette liste ne constitue pas une obligation de créer immédiatement une classe/fichier pour chaque nom.

Éviter l'architecture artificiellement fragmentée.

Créer uniquement les abstractions réellement nécessaires à chaque étape.

---

# 30. TypeScript

Le moteur doit être développé en TypeScript.

Le propriétaire du projet connaît principalement JavaScript et ne maîtrise pas encore TypeScript.

Par conséquent :

- utiliser TypeScript de manière simple et lisible ;
- privilégier interfaces et types explicites ;
- documenter les choix non évidents ;
- éviter les génériques complexes sans nécessité ;
- éviter les abstractions difficiles à comprendre ;
- éviter la sophistication purement technique.

La maintenabilité est plus importante que la démonstration de virtuosité TypeScript.

---

# 31. Données et configuration

Les données de jeu susceptibles d'être modifiées pour l'équilibrage doivent autant que possible être séparées du moteur.

Exemples :

```text
archétypes
actions
effets
leçons
chapitres
concepts
paramètres d'équilibrage
```

JSON ou objets TypeScript simples peuvent être utilisés selon ce qui est le plus approprié.

Ne pas construire prématurément un système de données complexe.

---

# 32. Observabilité et journal de simulation

Chaque simulation doit pouvoir produire un journal lisible.

Exemple :

```text
LESSON: Introduction aux fractions
SEED: 12345

CHAPTER: Découvrir

ROUND 1

Alice
→ WORK
→ compréhension +6
→ 18 → 24

Paul
→ SUPPORT
→ cible: Alice
→ concentration +2

Léa
→ WORK
→ compréhension +4

EXTRA ACTION
Paul
→ WORK
→ compréhension +7

ROUND RESULT

Alice : 24
Paul  : 31
Léa   : 19
...

TEACHER INTERVENTION
→ none

END ROUND 1
```

Ce journal est une fonctionnalité de développement importante, pas un simple `console.log` temporaire.

---

# 33. Principes de qualité du code

Priorités :

```text
lisibilité
responsabilités limitées
faible couplage
déterminisme
testabilité
configurabilité
facilité d'évolution
```

Éviter :

```text
god objects
variables globales
logique métier dans l'UI
Math.random() dispersé
énormes if/else
héritage complexe
abstraction prématurée
duplication des règles
```

Préférer la composition à l'héritage lorsque cela est pertinent.

---

# 34. Roadmap générale

La direction globale du développement est :

```text
1. moteur minimal de simulation
2. tests et déterminisme
3. première représentation graphique 3×3
4. EventQueue → AnimationQueue
5. interventions du professeur
6. chapitres et concepts
7. voisinage
8. personnalités et affinités
9. approfondissement des archétypes RPG
10. progression des archétypes
11. passage 3×3 → 4×4 → 5×5
12. sprites orientables
13. vue finale 2.5D
14. préparation de la classe / drag & drop
15. création et édition des leçons
16. agenda
17. progression de campagne
18. examen final
19. sauvegarde
20. équilibrage et simulations massives
21. polish graphique et sonore
```

Cette liste décrit la destination.

NE PAS essayer de tout implémenter maintenant.

---

# ROADMAP 1 — PREMIER OBJECTIF DE DÉVELOPPEMENT

## 35. But

Créer un vertical slice du moteur entièrement fonctionnel SANS interface graphique.

Le prototype doit prouver que la boucle fondamentale fonctionne.

---

# 36. Contenu du prototype

Créer :

```text
1 professeur

1 salle

9 élèves

grille 3 × 3

3 archétypes :
- Offensif
- Défensif
- Support

1 matière :
Mathématiques

1 topic :
Fractions

1 leçon :
Introduction aux fractions

2 chapitres :
- Découvrir
- Comprendre

3 rounds par chapitre
```

Soit :

```text
6 rounds au total
```

---

# 37. Élèves du prototype

Chaque élève possède :

```text
id
name

intelligence
discipline
concentration
morale

archetypeId
seatId
```

Pendant la simulation :

```text
lessonUnderstanding
```

doit être suivi séparément.

---

# 38. Actions minimales

Implémenter uniquement les actions nécessaires à la validation du moteur.

## WORK

L'élève travaille directement sur la leçon.

Effet :

```text
augmentation de lessonUnderstanding
```

---

## SUPPORT

L'élève aide un autre élève valide.

Pour Roadmap 1, la sélection de cible peut rester simple.

Effet possible :

```text
augmentation temporaire de concentration
```

---

## EXTRA_ACTION

Certains effets peuvent créer une action supplémentaire.

Cette action est ajoutée explicitement à l'ActionQueue.

Elle ne doit pas être exécutée récursivement immédiatement.

---

# 39. Intervention du professeur dans Roadmap 1

La phase doit exister dans la machine d'état mais aucune mécanique avancée n'est nécessaire.

Après chaque round :

```text
ROUND_RESULT
↓
TEACHER_INTERVENTION
↓
aucune intervention
↓
ROUND_READY
```

Cela permettra d'ajouter les actions du professeur ultérieurement sans modifier la structure fondamentale du moteur.

---

# 40. Concepts dans Roadmap 1

Créer quelques concepts de démonstration, par exemple :

```text
fraction
numerator
denominator
```

La leçon doit pouvoir référencer ces concepts.

Le système complet de déblocage n'a pas besoin d'être équilibré ni finalisé.

L'objectif est seulement de valider que `Lesson` et `Concept` sont des entités distinctes.

---

# 41. Événements minimums

Le moteur doit émettre des événements structurés tels que :

```text
LESSON_STARTED

CHAPTER_STARTED

ROUND_STARTED

STUDENT_ACTION

EFFECT_APPLIED

UNDERSTANDING_CHANGED

EXTRA_ACTION_CREATED

ROUND_ENDED

TEACHER_INTERVENTION_STARTED

TEACHER_INTERVENTION_ENDED

CHAPTER_ENDED

LESSON_ENDED
```

Les payloads doivent être typés.

---

# 42. Tests minimums

Créer des tests automatisés vérifiant au minimum :

```text
Un élève possède un siège valide.

Deux élèves ne peuvent pas occuper le même siège.

Une classe 3×3 contient au maximum 9 sièges.

Chaque élève reçoit normalement une action principale par round.

WORK modifie la compréhension.

La compréhension reste entre 0 et 100.

SUPPORT cible un élève valide.

Une action supplémentaire est ajoutée à la queue.

Une chaîne ne peut pas être infinie.

La phase TEACHER_INTERVENTION apparaît entre deux rounds.

Une même seed produit exactement la même simulation.

Deux seeds différentes peuvent produire des résultats différents.

Une leçon peut référencer plusieurs concepts.

Un résultat individuel est produit pour chaque élève.
```

---

# 43. Commandes attendues

À la fin de Roadmap 1, je veux pouvoir exécuter quelque chose d'équivalent à :

```bash
npm test
```

et :

```bash
npm run simulate
```

`simulate` doit exécuter une leçon complète et afficher un journal lisible.

---

# 44. Résultat attendu

Exemple :

```text
LESSON COMPLETE

Introduction aux fractions

Alice     81 %
Paul      74 %
Léa       63 %
Hugo      47 %
...

Concepts referenced:
- fraction
- numerator
- denominator

Seed: 12345
```

---

# 45. Ne PAS développer pendant Roadmap 1

Ne pas développer :

```text
interface graphique
PixiJS
sprites
animations
sons
vue 2.5D
25 élèves
drag & drop
agenda
éditeur de leçons
examen final
sauvegarde
personnalités complètes
affinités
progression avancée des archétypes
équilibrage définitif
IA sophistiquée
```

Ces fonctionnalités sont décrites uniquement pour fournir le contexte nécessaire aux décisions d'architecture.

---

# 46. Méthode de travail demandée

Ne pas commencer par implémenter toute la Roadmap 1 en une seule fois.

Procéder ainsi :

## Étape A — Inspection

Si un dépôt existe :

1. inspecter son contenu ;
2. identifier le stack existant ;
3. identifier ce qui peut être conservé ;
4. ne supprimer ou remplacer aucun élément important sans justification.

Si le dépôt est vide, le signaler simplement.

---

## Étape B — Proposition d'architecture

Avant l'implémentation :

1. proposer une arborescence minimale ;
2. définir les objets réellement nécessaires ;
3. expliquer leurs responsabilités ;
4. expliquer le flux complet d'un round ;
5. expliquer le rôle de l'ActionQueue ;
6. expliquer le rôle des événements ;
7. expliquer comment le futur rendu pourra consommer ces événements ;
8. signaler les hypothèses ou décisions nécessaires.

Ne pas sur-architecturer.

---

## Étape C — Implémentation incrémentale

Implémenter Roadmap 1 par petits incréments testables.

Après chaque incrément :

1. lancer les tests pertinents ;
2. corriger les erreurs ;
3. résumer les modifications ;
4. indiquer les fichiers principaux concernés ;
5. signaler les hypothèses prises.

---

## Étape D — Validation finale

À la fin :

1. lancer tous les tests ;
2. lancer une simulation complète ;
3. vérifier le déterminisme avec une seed connue ;
4. fournir un résumé de l'architecture obtenue ;
5. signaler les éventuelles dettes techniques ;
6. proposer les prochaines étapes sans les implémenter.

---

# 47. Règle finale

Le contexte de ce document décrit le jeu que nous voulons construire à terme.

La mission actuelle reste volontairement beaucoup plus petite :

> Construire un moteur de simulation 3×3 déterministe, testable et indépendant de toute interface, avec élèves, professeur, leçon, chapitres, concepts, rounds, ActionQueue, événements et phase d'intervention du professeur.

La qualité de cette fondation est plus importante que la quantité de fonctionnalités produites.

 pose moi des questions si et seulement si il y a des précisions à apporter pour un meilleur résultat à chaque etape.
---

# Extension Roadmap 1.1 — Combat et décrochage

Implémentée après validation de la Roadmap 1 initiale.

- Leçon : complexité, pression et progression requise individuelle.
- Intelligence × moral contre complexité ; riposte contre discipline × moral.
- Moral : multiplicateur de 0,1 à 1,9.
- Concentration = HP ; aucun apprentissage à zéro, perte de moral au décrochage.
- Repos autonome, reprise, soutien restaurant les HP.
- Progression réservée par chapitre ; lacunes conservées sans perte des acquis.
- Résultats par chapitre et moral conservé pour une prochaine séance.
- Événements, journal, interface HP/moral, tests et étude multi-seeds.

Les décisions et formules sont détaillées dans README.md et remplacent les anciennes
formules WORK/SUPPORT. Les comportements hors leçon, affinités, softskills et concepts
validés individuellement restent hors de cette extension.
