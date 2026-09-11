# ROADMAP 2 — Boucle tactique de la leçon et interventions du professeur

## 1. Situation actuelle

La Roadmap 1 et son extension Roadmap 1.1 sont considérées comme implémentées.

Le projet dispose actuellement :

- d'un moteur TypeScript indépendant de l'interface ;
- d'une simulation déterministe avec seed ;
- d'une classe prototype 3×3 avec 9 élèves ;
- de trois archétypes RPG ;
- d'une leçon composée de chapitres et de rounds ;
- d'une compréhension individuelle ;
- des actions WORK et SUPPORT ;
- d'une ActionQueue avec actions supplémentaires ;
- d'événements structurés ;
- d'une phase `TEACHER_INTERVENTION` entre les rounds ;
- de tests automatisés ;
- d'une interface 3×3 jouable ;
- d'une lecture progressive des actions ;
- d'une sélection des élèves ;
- d'un système de complexité et pression de la leçon ;
- du moral comme modificateur ;
- de la concentration comme ressource assimilable aux HP ;
- de ripostes de la leçon ;
- du décrochage ;
- de récupération autonome ;
- de lacunes par chapitre.

La Roadmap 2 doit prolonger cette architecture.

Ne pas reconstruire les systèmes existants s'ils peuvent être étendus proprement.

---

# 2. Objectif de la Roadmap 2

Transformer la simulation actuelle en véritable boucle tactique de "combat pédagogique".

Le principe général est :

```text
L'élève essaie de comprendre la leçon.

La leçon oppose sa complexité à cet effort.

Si l'élève progresse :
→ compréhension +
→ moral +
→ concentration consommée

La leçon exerce ensuite une pression sur l'élève.

Les soutiens et défenseurs peuvent intervenir.

L'élève tente finalement de résister.

S'il subit la pression :
→ moral -
→ concentration --

À la fin du round :
→ le joueur observe les résultats
→ le professeur intervient
→ son intervention influence le ou les rounds suivants.
```

Le but de Roadmap 2 est donc de créer une boucle :

```text
OBSERVER
↓
COMPRENDRE LA SITUATION
↓
INTERVENIR
↓
VOIR LES CONSÉQUENCES
```

Le joueur ne doit plus être uniquement spectateur de la simulation.

---

# 3. Principe fondamental : conserver le moteur déterministe

Toutes les nouvelles mécaniques doivent conserver les propriétés de Roadmap 1 :

- simulation indépendante de l'interface ;
- seed déterministe ;
- événements structurés ;
- tests automatisés ;
- ActionQueue explicite ;
- absence de dépendance graphique dans le moteur.

Avec les mêmes :

```text
données
+
seed
+
décisions du professeur
```

la simulation doit produire le même résultat.

Les décisions du professeur deviennent donc elles-mêmes des entrées déterministes de la simulation.

---

# 4. Pipeline d'un tour d'élève

Le déroulement logique d'un tour d'élève doit maintenant suivre une structure explicite.

Pipeline cible :

```text
ÉLÈVE ACTIF
│
├── 1. Soutiens préalables éventuels
│
├── 2. Attaque contre la leçon
│
├── 3. Défense de la leçon
│
├── 4. Résolution de la progression
│
├── 5. Riposte de la leçon
│
├── 6. Intervention défensive éventuelle d'un voisin
│
├── 7. Défense personnelle de l'élève
│
├── 8. Résolution des conséquences
│
├── 9. Réactions / effets / actions supplémentaires
│
└── 10. Élève suivant
```

Cette séquence doit rester identifiable dans le moteur et dans les événements produits.

Éviter une unique fonction géante résolvant toute la séquence.

---

# 5. Étape 1 — Soutiens préalables

Avant l'attaque contre la leçon, certains effets de soutien peuvent être appliqués.

Les élèves de type Support doivent progressivement acquérir un vrai rôle tactique.

Un soutien peut par exemple modifier temporairement :

```text
attaque pédagogique
défense
moral
concentration
probabilité de réussite
```

Roadmap 2 n'a pas besoin de proposer beaucoup de capacités différentes.

L'objectif est de disposer d'un système suffisamment générique pour ajouter ensuite de nouveaux soutiens.

Les effets doivent pouvoir avoir une durée :

```ts
durationInRounds: number
```

ou une représentation équivalente.

---

# 6. Étape 2 — Attaque contre la leçon

Chaque élève tente de progresser dans la leçon.

Conceptuellement :

```text
ÉLÈVE
↓
attaque pédagogique
↓
LEÇON
```

L'efficacité de cette attaque peut dépendre notamment de :

```text
intelligence
moral
concentration
archétype
bonus temporaires
lacunes éventuelles
concepts éventuellement connus plus tard
```

Les formules exactes doivent rester configurables.

Ne pas disperser les coefficients numériques dans le moteur.

---

# 7. Moral comme multiplicateur

Le moral représente la disposition générale de l'élève à exploiter ses capacités.

Il ne doit pas être une deuxième barre de concentration.

Principe :

```text
capacité théorique
×
modificateur de moral
=
capacité réellement mobilisée
```

Un élève avec une bonne intelligence mais un moral très faible doit être moins performant.

À l'inverse, un bon moral améliore l'exploitation de ses capacités sans remplacer l'intelligence.

Le système déjà introduit dans Roadmap 1.1 doit être conservé et éventuellement clarifié plutôt que remplacé arbitrairement.

---

# 8. Concentration comme HP cognitif

La concentration représente l'endurance cognitive de l'élève pendant la leçon.

Elle fonctionne conceptuellement comme des HP.

Une attaque contre la leçon demande un effort et peut donc consommer une petite quantité de concentration.

Une riposte réussie de la leçon doit généralement en retirer davantage.

Exemple conceptuel :

```text
L'élève travaille efficacement
→ concentration -

La leçon exerce une forte pression
→ concentration --
```

La concentration ne doit cependant pas être réduite mécaniquement de la même quantité à chaque action.

Les règles doivent rester configurables.

---

# 9. Étape 3 — Défense de la leçon

La leçon ne reçoit pas passivement toutes les attaques.

Sa complexité constitue sa principale défense.

Conceptuellement :

```text
attaque pédagogique de l'élève
VS
complexité de la leçon / du chapitre
```

La complexité peut :

- réduire la progression ;
- empêcher une progression ;
- éventuellement provoquer des résultats particuliers.

Le résultat doit être suffisamment explicite pour être représenté visuellement plus tard :

```text
réussite importante
réussite
réussite partielle
échec
```

Il n'est pas nécessaire d'utiliser exactement ces quatre catégories si l'architecture actuelle utilise une meilleure représentation.

---

# 10. Étape 4 — Progression de l'élève

En cas de réussite :

```text
compréhension +
moral +
concentration -
```

L'augmentation du moral récompense le sentiment de réussite.

La perte modérée de concentration représente l'effort fourni.

En cas d'échec :

```text
compréhension faible ou nulle
concentration éventuellement -
moral éventuellement -
```

Un échec ne doit pas nécessairement produire systématiquement une punition maximale.

Les valeurs doivent être équilibrables.

---

# 11. Étape 5 — Riposte de la leçon

Après la tentative de progression, la leçon peut exercer une pression sur l'élève.

Conceptuellement :

```text
LEÇON
↓
pression
↓
ÉLÈVE
```

La pression représente :

- difficulté ressentie ;
- fatigue ;
- surcharge ;
- stress pédagogique ;
- risque de perte d'attention.

La pression constitue donc l'équivalent de l'attaque de la leçon.

---

# 12. Étape 6 — Défense par un voisin

L'archétype Défensif doit acquérir une fonction claire.

Lorsqu'un élève voisin subit une riposte, un Défenseur éligible peut intervenir.

Conceptuellement :

```text
LEÇON riposte
      ↓
élève ciblé

Défenseur voisin
      ↓
interception / réduction
      ↓
riposte restante
```

Le Défenseur ne doit pas nécessairement annuler toute la pression.

Il peut :

- absorber une partie ;
- réduire la puissance ;
- donner un bonus de défense ;
- protéger contre certaines conséquences.

Le voisinage doit utiliser le système spatial existant ou être conçu pour s'y intégrer proprement.

Pour Roadmap 2, privilégier les voisins directs.

Ne pas ajouter immédiatement des règles complexes de diagonales, portée, zones ou chaînes défensives.

---

# 13. Étape 7 — Défense personnelle

Après les éventuelles protections extérieures, l'élève tente de résister personnellement à la pression restante.

La statistique principale envisagée est :

```text
discipline
```

Elle peut être modifiée par :

```text
moral
archétype
buffs
debuffs
soutiens
intervention du professeur
```

Conceptuellement :

```text
pression restante
VS
défense personnelle
```

---

# 14. Étape 8 — Conséquences de la riposte

Si l'élève ne parvient pas suffisamment à résister :

```text
concentration --
moral -
```

Des conséquences plus importantes peuvent ultérieurement apparaître :

```text
décrochage
debuff
perte d'action
besoin de récupération
```

Roadmap 1.1 possède déjà un système de décrochage et récupération.

Roadmap 2 doit l'intégrer au pipeline plutôt que créer un deuxième système concurrent.

---

# 15. Décrochage

Le décrochage est principalement lié à une concentration trop faible.

Lorsqu'un élève décroche :

- son efficacité doit fortement diminuer ;
- certaines actions peuvent devenir indisponibles ;
- il peut avoir besoin de récupérer ;
- le professeur doit pouvoir identifier clairement cet état.

Le décrochage doit devenir une situation tactique que le joueur peut tenter de corriger.

Il ne doit pas simplement signifier :

```text
élève éliminé jusqu'à la fin de la leçon
```

La récupération doit rester possible.

---

# 16. Réactions et actions supplémentaires

Après la résolution principale peuvent apparaître :

```text
buff
debuff
extra action
combo
récupération
réaction
interaction avec voisin
```

Toutes les actions supplémentaires doivent continuer à passer par l'ActionQueue.

Ne pas introduire de résolution récursive parallèle.

Les protections contre les chaînes infinies doivent être conservées.

---

# 17. Fin du round

Tous les élèves effectuent leur séquence normale.

Les actions supplémentaires et réactions autorisées sont résolues selon les règles de l'ActionQueue.

Puis :

```text
ROUND_ENDED
↓
résultats disponibles
↓
lecture / animations
↓
TEACHER_INTERVENTION
```

Le moteur ne commence PAS automatiquement le round suivant tant que la décision du professeur n'est pas fournie.

---

# 18. Le professeur

Le professeur possède trois statistiques principales :

```text
Pédagogie
Autorité
Patience
```

Elles ont des fonctions clairement différentes.

---

# 19. Pédagogie = puissance d'intervention

La pédagogie correspond à l'équivalent de l'attaque du professeur.

Elle détermine principalement l'efficacité de ses interventions pédagogiques.

Conceptuellement :

```text
effet de base de l'intervention
×
pédagogie
=
effet réel
```

Elle peut notamment influencer :

```text
encouragement
réexplication
aide à la compréhension
récupération
buff pédagogique
```

Les formules doivent rester configurables.

---

# 20. Autorité = défense passive de la classe

L'autorité agit principalement comme une défense contre les perturbations.

Elle doit avoir une utilité passive même lorsque le professeur choisit une autre intervention.

Exemple :

```text
élève tente une perturbation
↓
test / réduction par l'autorité du professeur
↓
perturbation :
- annulée
- réduite
- appliquée
```

L'autorité peut donc :

- empêcher certaines perturbations ;
- diminuer leur puissance ;
- réduire leur durée ;
- améliorer certaines interventions de type recadrage.

Ne pas transformer l'autorité en simple coût ou deuxième statistique de pédagogie.

---

# 21. Patience = HP / ressource du professeur

Chaque intervention active du professeur coûte de la patience.

La patience représente donc à la fois :

```text
endurance du professeur
+
ressource tactique
```

Principe :

```text
Intervention
↓
coût en Patience
↓
effet dépendant de l'intervention
```

Le joueur ne doit pas pouvoir utiliser gratuitement la meilleure intervention après chaque round.

La patience crée une décision :

```text
Dois-je intervenir maintenant ?

Sur qui ?

Avec quelle action ?

Dois-je conserver ma patience pour plus tard ?
```

---

# 22. Patience à zéro

Prévoir explicitement le comportement lorsque :

```text
patience <= 0
```

Pour Roadmap 2 :

- le professeur ne peut plus utiliser d'intervention ayant un coût supérieur à sa patience restante ;
- la simulation doit continuer ;
- le professeur n'est pas "mort" ;
- les effets passifs comme l'autorité continuent d'exister.

Ne pas introduire pour le moment de game over automatique du professeur.

---

# 23. Phase d'intervention du professeur

Après chaque round :

```text
ROUND_RESULT
↓
TEACHER_INTERVENTION
```

Le joueur peut sélectionner une intervention et éventuellement une cible.

Une intervention peut être :

```text
ciblée
collective
temporaire
instantanée
```

Certaines peuvent durer plusieurs rounds.

Une intervention ne modifie jamais rétroactivement le round terminé.

Elle agit :

```text
immédiatement entre les rounds

et/ou

pendant le ou les rounds suivants
```

---

# 24. Actions professeur minimales

Implémenter un petit ensemble d'actions permettant de tester le système.

Les valeurs numériques suivantes ne sont PAS imposées.

Elles doivent être définies dans les données/configurations et équilibrées par la suite.

---

## ENCOURAGE

```text
Cible :
1 élève

Coût :
Patience

Stat principale :
Pédagogie

Effet :
Moral +

Durée :
instantanée ou courte
```

But :

remonter un élève en difficulté et améliorer son efficacité future.

---

## REEXPLAIN

```text
Cible :
1 élève

Coût :
Patience plus important

Stat principale :
Pédagogie

Effet :
bonus contre la complexité de la leçon

Durée :
prochain round ou quelques rounds
```

But :

aider directement un élève qui comprend mal le chapitre.

---

## REFRAME / RECADRER

```text
Cible :
1 élève perturbateur

Coût :
Patience

Stat principale :
Autorité

Effet :
réduction des perturbations

Durée :
plusieurs rounds possible
```

But :

contrôler un élève dont le comportement nuit aux autres.

---

## BREAK / PAUSE

```text
Cible :
classe entière

Coût :
Patience faible ou particulier

Effet :
Concentration +

Contrepartie :
à préparer pour une future gestion du temps
```

Roadmap 2 peut implémenter une version simple.

Le coût temporel réel pourra être introduit lorsque le temps de leçon sera davantage développé.

---

# 25. PASS / Ne pas intervenir

Le joueur doit toujours pouvoir choisir :

```text
PASS
```

Cette décision :

- ne coûte aucune patience ;
- n'applique aucun effet ;
- permet de conserver ses ressources.

Le moteur doit considérer `PASS` comme une décision valide et déterministe.

---

# 26. Effets temporaires

Roadmap 2 doit disposer d'un système propre d'effets temporaires.

Un effet doit pouvoir contenir au minimum l'équivalent de :

```ts
interface TemporaryEffect {
  id: string;
  sourceId: string;
  targetId: string;

  effectType: string;
  value: number;

  remainingRounds: number;
}
```

La structure exacte peut être adaptée à l'architecture existante.

Il faut pouvoir déterminer :

```text
qui a créé l'effet ;
qui le reçoit ;
ce qu'il modifie ;
sa valeur ;
sa durée ;
quand il expire.
```

Les effets doivent produire des événements lorsqu'ils sont :

```text
appliqués
utilisés si nécessaire
décrémentés
expirés
```

---

# 27. Ordre des effets

L'ordre de résolution doit être explicite.

Exemple conceptuel :

```text
effets persistants existants
↓
soutiens
↓
attaque
↓
défense de la leçon
↓
progression
↓
riposte
↓
défense voisine
↓
défense personnelle
↓
conséquences
↓
réactions
```

Si l'architecture actuelle propose un ordre légèrement différent, le conserver lorsqu'il est cohérent.

L'important est que cet ordre soit :

- déterministe ;
- documenté ;
- testable.

---

# 28. Événements à ajouter ou enrichir

Prévoir des événements structurés pour rendre le combat pédagogique lisible.

Exemples :

```text
STUDENT_TURN_STARTED

SUPPORT_APPLIED

LESSON_ATTACK_STARTED
LESSON_DEFENDED
UNDERSTANDING_GAINED

LESSON_COUNTERATTACK

NEIGHBOR_DEFENSE_TRIGGERED
STUDENT_DEFENSE_RESOLVED

CONCENTRATION_CHANGED
MORALE_CHANGED

STUDENT_DISENGAGED
STUDENT_RECOVERED

TEMPORARY_EFFECT_APPLIED
TEMPORARY_EFFECT_EXPIRED

ROUND_RESULT_READY

TEACHER_INTERVENTION_STARTED
TEACHER_ACTION_SELECTED
TEACHER_ACTION_APPLIED
TEACHER_PATIENCE_CHANGED
TEACHER_INTERVENTION_ENDED
```

Ne pas créer inutilement un événement différent pour chaque micro-calcul si cela rend le système illisible.

Le but est de fournir suffisamment d'information pour :

```text
debug
tests
journal
animations
interface
```

---

# 29. Interface 3×3

Contrairement à Roadmap 1, Roadmap 2 doit intégrer les nouvelles mécaniques à l'interface existante.

Ne pas refaire l'interface depuis zéro.

Pendant le round, l'interface doit pouvoir montrer progressivement :

```text
soutien
↓
attaque contre la leçon
↓
résultat
↓
riposte
↓
défense éventuelle
↓
conséquences
```

La représentation peut rester simple.

La priorité est la LISIBILITÉ, pas le polish graphique.

---

# 30. Résultat du round

Avant l'intervention du professeur, le joueur doit pouvoir comprendre ce qui vient de se passer.

Éviter de lui présenter seulement un journal technique.

L'interface doit permettre d'identifier notamment :

```text
élèves ayant beaucoup progressé
élèves ayant peu progressé
pertes importantes de concentration
moral faible
élèves en décrochage
soutiens réussis
défenses déclenchées
perturbations importantes
```

Le joueur doit disposer des informations nécessaires pour prendre sa décision de professeur.

---

# 31. Interface d'intervention du professeur

Lorsque le rendu du round est terminé :

```text
TEACHER_INTERVENTION
```

doit devenir clairement visible.

Le joueur doit pouvoir :

```text
1. choisir une intervention ;
2. voir son coût en patience ;
3. sélectionner une cible si nécessaire ;
4. voir une description courte de l'effet ;
5. confirmer ;
6. ou choisir PASS.
```

Après confirmation :

```text
effet appliqué
↓
patience mise à jour
↓
interface mise à jour
↓
round suivant disponible
```

Ne pas commencer le round suivant avant cette validation.

---

# 32. Fiche professeur

Ajouter ou compléter une représentation simple du professeur permettant de voir :

```text
Pédagogie
Autorité
Patience actuelle / maximale
```

La patience doit être particulièrement lisible puisqu'elle constitue la ressource d'intervention.

Pas besoin d'une interface RPG sophistiquée à ce stade.

---

# 33. Ciblage

Les interventions doivent utiliser un système générique de ciblage.

Prévoir au minimum :

```text
SELF
ONE_STUDENT
ALL_STUDENTS
```

Éventuellement :

```text
ADJACENT_STUDENTS
```

si cela s'intègre naturellement au système existant.

Éviter de coder la sélection de cible indépendamment dans chaque bouton d'intervention.

---

# 34. Actions automatiques des élèves

Les actions des élèves restent contrôlées par le moteur.

Le joueur ne choisit pas directement l'action de chaque élève.

Les choix automatiques peuvent dépendre de :

```text
archétype
état
moral
concentration
voisinage
effets temporaires
```

Roadmap 2 ne doit pas encore construire une IA comportementale sophistiquée.

L'objectif est surtout que les trois archétypes commencent à être visiblement différents.

---

# 35. Rôle des trois archétypes dans Roadmap 2

# 35 bis — Réactions de classe, synergies et relations entre élèves

Les archétypes ne doivent pas être définis uniquement par des bonus statistiques permanents.

Leur identité repose principalement sur leur capacité à **intervenir dans l'action d'un autre élève**.

Les trois archétypes ont des fonctions différentes :

```text
SOUTIEN
→ modifie les conditions du combat

OFFENSIF
→ affaiblit activement la leçon et peut combiner son attaque

DÉFENSEUR
→ réduit activement la riposte de la leçon
```

Ces interventions sont des **réactions** : elles peuvent se produire pendant le tour principal d'un autre élève sans nécessairement consommer le tour principal de l'élève qui réagit.

Leur disponibilité et leur puissance dépendent notamment :

- des capacités propres de l'élève qui intervient ;
- de l'archétype ;
- de la relation entre les deux élèves ;
- de leur position dans la classe ;
- des effets temporaires éventuels ;
- de l'état actuel des deux élèves.

---

## 35.1 — Principe des fenêtres de réaction

Le moteur doit permettre à certaines capacités de se déclencher à différents moments de la séquence.

Prévoir conceptuellement des fenêtres telles que :

```text
BEFORE_STUDENT_ATTACK
DURING_STUDENT_ATTACK
AFTER_STUDENT_ATTACK

BEFORE_LESSON_ATTACK
DURING_LESSON_ATTACK
AFTER_LESSON_ATTACK
```

Toutes ces fenêtres n'ont pas besoin d'être utilisées immédiatement.

Elles doivent cependant permettre au moteur d'éviter de coder les réactions des archétypes directement à de multiples endroits du `RoundEngine`.

Une capacité de réaction doit pouvoir déclarer dans quelle fenêtre elle peut intervenir.

Exemple conceptuel :

```ts
type ReactionWindow =
  | "BEFORE_STUDENT_ATTACK"
  | "DURING_STUDENT_ATTACK"
  | "AFTER_STUDENT_ATTACK"
  | "BEFORE_LESSON_ATTACK"
  | "DURING_LESSON_ATTACK"
  | "AFTER_LESSON_ATTACK";
```

La structure exacte doit être adaptée à l'architecture existante.

Ne pas refondre inutilement le moteur si Roadmap 1.1 possède déjà un mécanisme permettant d'obtenir ce comportement.

---

# 35.2 — Soutien

Le Soutien n'agit PAS uniquement avant l'attaque.

Selon ses capacités, sa personnalité, ses spécificités et sa relation avec l'élève concerné, il peut intervenir :

```text
AVANT l'attaque
PENDANT l'attaque
APRÈS l'attaque
```

Son rôle général est de **modifier les conditions dans lesquelles le camarade affronte la leçon**.

Un Soutien peut potentiellement agir sur :

```text
INTELLIGENCE
DISCIPLINE
MORAL
CONCENTRATION

PROGRESSION / COMPRÉHENSION

COMPLEXITÉ de la leçon
PRESSION de la leçon
```

Tous les Soutiens ne doivent PAS posséder tous ces effets.

Chaque élève de type Soutien pourra progressivement avoir ses propres spécialités.

Exemples conceptuels :

```text
Soutien motivateur
→ moral +
→ éventuellement concentration +

Soutien méthodique
→ intelligence effective +
→ discipline +

Soutien explicateur
→ complexité temporairement -

Soutien rassurant
→ pression temporairement -

Soutien facilitateur
→ progression finale +
```

Ces exemples ne constituent pas une liste obligatoire de compétences à implémenter immédiatement.

Roadmap 2 doit surtout créer une architecture permettant ces variations.

---

# 35.3 — Moment du soutien

Le moment où intervient le Soutien dépend de la nature de sa capacité.

Exemple :

```text
AVANT L'ATTAQUE

Soutien explicateur
↓
complexité temporairement réduite
↓
camarade attaque
```

Autre exemple :

```text
PENDANT L'ATTAQUE

camarade attaque
↓
Soutien méthodique intervient
↓
intelligence effective augmentée
↓
résolution de l'attaque
```

Autre exemple :

```text
APRÈS L'ATTAQUE

camarade réussit
↓
Soutien motivateur intervient
↓
moral supplémentaire
```

Le système de réactions doit donc permettre plusieurs timings sans créer une logique spécifique codée en dur pour chaque élève.

---

# 35.4 — Défenseur

Le Défenseur possède un rôle volontairement plus spécialisé.

Il intervient principalement lorsque la leçon attaque un camarade.

Pipeline :

```text
LEÇON RIPOSTE
↓
pression / attaque calculée
↓
DÉFENSEUR VOISIN peut réagir
↓
réduction importante de l'attaque
↓
attaque restante
↓
défense personnelle de l'élève ciblé
↓
conséquences éventuelles
```

Le Défenseur protège donc directement un camarade contre la leçon.

Son intervention doit être suffisamment puissante pour que son rôle soit immédiatement perceptible.

Il peut notamment :

```text
réduire fortement l'attaque ;
absorber une partie de la pression ;
améliorer ponctuellement la défense du camarade.
```

Il ne doit pas devenir un deuxième Soutien polyvalent.

Son identité principale reste :

```text
PROTÉGER
```

---

# 35.5 — Offensif

L'Offensif intervient principalement :

```text
JUSTE AVANT
ou
PENDANT

l'attaque d'un camarade.
```

Contrairement au Soutien, il ne cherche pas principalement à améliorer les statistiques de son camarade.

Il **attaque directement une caractéristique de la leçon**.

Sa cible privilégiée dans Roadmap 2 est :

```text
COMPLEXITÉ
```

Exemple :

```text
camarade prépare son attaque
↓
OFFENSIF voisin intervient
↓
attaque la COMPLEXITÉ
↓
complexité temporairement réduite
↓
camarade attaque la leçon affaiblie
```

À terme, certains Offensifs pourront éventuellement cibler d'autres caractéristiques de la leçon.

Roadmap 2 doit cependant privilégier la complexité afin de conserver une mécanique lisible.

---

# 35.6 — Attaque combinée

Un Offensif possédant une relation suffisamment forte avec le camarade actif peut éventuellement déclencher une :

```text
ATTAQUE COMBINÉE
```

Une attaque combinée n'est PAS simplement :

```text
attaque A + attaque B
```

Elle doit produire une synergie supérieure aux deux attaques indépendantes.

Conceptuellement :

```text
attaque combinée
=
attaque A
+
attaque B
+
BONUS DE SYNERGIE
```

Le bonus de synergie peut dépendre notamment :

```text
relation entre A et B
capacité de l'Offensif
état des deux élèves
moral
effets temporaires
```

Exemple :

```text
Alice attaque la leçon.

Paul, Offensif et très proche d'Alice, déclenche une réaction.

Alice + Paul
↓
ATTAQUE COMBINÉE
↓
bonus de synergie
↓
attaque supérieure à leurs deux attaques simplement additionnées
```

Cette mécanique doit rester exceptionnelle par rapport à une attaque normale.

Elle doit constituer une récompense visible d'une bonne relation entre élèves.

---

# 35.7 — Relations entre élèves

La proximité physique ne suffit pas à garantir une réaction.

Il faut distinguer :

```text
PROXIMITÉ
=
peut potentiellement intervenir

RELATION
=
détermine si l'intervention se déclenche et/ou sa puissance
```

Un voisin avec lequel l'élève possède une mauvaise relation ne doit pas automatiquement produire un excellent soutien simplement parce que leurs pupitres sont côte à côte.

Le résultat d'une réaction peut conceptuellement dépendre de :

```text
capacité de base
×
relation
×
spécialité
×
modificateurs éventuels
```

La formule exacte doit rester configurable.

---

# 35.8 — Déblocage par relation

La relation ne doit pas seulement augmenter numériquement la puissance.

Elle peut également **débloquer progressivement de nouveaux comportements**.

Exemple conceptuel :

```text
relation insuffisante
→ aucune réaction

relation faible
→ réaction simple possible

relation moyenne
→ réaction plus efficace

bonne relation
→ capacité avancée possible

relation très forte
→ combo / synergie spéciale possible
```

Ne pas considérer ces niveaux comme des valeurs définitives.

Ils illustrent le principe :

```text
RELATION
→ DÉBLOCAGE
+
INTENSITÉ
```

---

# 35.9 — Relation spécifique au couple d'élèves

L'efficacité ne dépend pas seulement du niveau individuel du Soutien, Défenseur ou Offensif.

Elle dépend du couple :

```text
ÉLÈVE QUI RÉAGIT
+
ÉLÈVE CIBLÉ
```

Un excellent Soutien peut donc :

```text
être très efficace avec Alice ;
moyennement efficace avec Paul ;
ne presque jamais intervenir pour Léa.
```

Cela doit permettre au placement des élèves de devenir progressivement un véritable choix tactique.

---

# 35.10 — Intensité et évolution

Les capacités de réaction pourront évoluer ultérieurement avec :

```text
niveau de l'archétype
expérience
compétences débloquées
personnalité
relations
concepts maîtrisés
état émotionnel
```

Roadmap 2 ne doit PAS implémenter tout ce système de progression.

Elle doit seulement éviter une architecture qui empêcherait ces évolutions futures.

Ne pas utiliser une hiérarchie rigide de classes TypeScript du type :

```ts
class SupportStudent extends Student
class OffensiveStudent extends Student
class DefensiveStudent extends Student
```

Les capacités doivent rester des données/compositions associées aux élèves et archétypes.

---

# 35.11 — Consommation du tour

Une réaction de classe ne consomme pas nécessairement le tour principal de l'élève qui intervient.

Exemple :

```text
Tour principal d'Alice

Alice attaque
↓
Paul réagit en tant qu'Offensif
↓
attaque combinée
↓
leçon riposte
↓
Léa réagit en tant que Défenseur
↓
Léa réduit la riposte
↓
Alice termine son action
```

Paul et Léa pourront toujours effectuer leur propre tour principal lorsque leur tour arrivera, sauf si une capacité particulière indique explicitement le contraire.

Les réactions doivent cependant être limitées afin d'éviter :

```text
boucles infinies ;
réactions en cascade incontrôlées ;
un même élève intervenant indéfiniment pendant un round.
```

Réutiliser autant que possible les protections déjà présentes dans l'ActionQueue.

---

# 35.12 — Événements

Les réactions doivent produire des événements structurés exploitables par l'interface.

Prévoir l'équivalent de :

```text
REACTION_AVAILABLE
REACTION_TRIGGERED

SUPPORT_REACTION
OFFENSIVE_REACTION
DEFENSIVE_REACTION

LESSON_STAT_CHANGED

COMBINED_ATTACK_STARTED
COMBINED_ATTACK_RESOLVED
```

Éviter cependant de multiplier les événements lorsqu'un événement générique avec des données suffisamment précises peut remplir le même rôle.

L'interface devra ultérieurement pouvoir montrer clairement :

```text
Alice attaque
↓
Paul intervient
↓
attaque combinée
↓
Léa protège Alice lors de la riposte
```

sans devoir reconstruire cette logique à partir des variations brutes de statistiques.

---

# 35.13 — Tests spécifiques

Ajouter progressivement des tests vérifiant au minimum :

```text
Un Soutien peut intervenir avant une attaque.

Un Soutien peut disposer d'une capacité intervenant pendant une attaque.

Un Soutien peut disposer d'une capacité intervenant après une attaque.

Deux Soutiens différents peuvent modifier des statistiques différentes.

Un Défenseur peut réduire fortement une riposte destinée à un voisin.

Un Défenseur non éligible ne doit pas intervenir.

Un Offensif peut réduire la complexité avant ou pendant l'attaque d'un camarade.

Une réduction temporaire de complexité est correctement restaurée lorsqu'elle expire.

Une relation insuffisante peut empêcher une réaction.

Une meilleure relation peut augmenter l'intensité d'une réaction.

Une relation peut débloquer une capacité supplémentaire.

Une attaque combinée produit un résultat supérieur aux deux attaques simplement additionnées selon les règles prévues.

Une réaction ne consomme pas automatiquement le tour principal de son auteur.

Les limites de réactions empêchent les cascades infinies.

Les mêmes données + seed + relations produisent les mêmes réactions.
```

---

# 35.14 — Objectif de game design

À terme, deux élèves possédant le même archétype ne doivent pas nécessairement jouer de la même manière.

L'archétype définit une orientation générale :

```text
SOUTIEN
→ transforme les conditions

OFFENSIF
→ affaiblit la leçon et crée des synergies offensives

DÉFENSEUR
→ protège contre la riposte
```

Mais ce sont ensuite :

```text
les capacités propres
+
les relations
+
le placement
+
l'évolution
```

qui déterminent la manière exacte dont l'élève remplit ce rôle.

Le système doit donc préparer une classe où le joueur ne cherche pas seulement :

"où placer mes Supports ?"

mais plutôt :

"qui fonctionne bien avec qui, et pourquoi ?"

# 36. Lacunes par chapitre

Le système de lacunes introduit en Roadmap 1.1 doit continuer à fonctionner.

Une mauvaise performance dans un chapitre peut créer ou renforcer une lacune.

Cette lacune pourra ultérieurement influencer :

```text
leçons suivantes
concepts
révisions
agenda
examen final
```

Roadmap 2 ne doit pas développer toute cette progression à long terme.

Il faut surtout vérifier que les nouvelles interventions et le pipeline de combat ne cassent pas ce système.

---

# 37. Concepts

Les concepts pédagogiques restent présents dans le modèle.

Roadmap 2 n'a pas pour objectif principal de développer leur système complet d'acquisition.

Ne pas détourner cette roadmap vers un système complexe de loot de concepts.

Ce sera traité dans une étape ultérieure.

---

# 38. Tests automatisés

Conserver tous les tests existants.

Ajouter des tests couvrant au minimum :

```text
L'attaque d'un élève est confrontée à la complexité.

Une progression réussie augmente la compréhension.

Une progression réussie peut augmenter le moral.

Une action consomme la concentration selon les règles prévues.

La leçon peut riposter.

La pression est confrontée à une défense.

Un Défenseur peut protéger un voisin valide.

Un Défenseur ne protège pas une cible invalide ou hors voisinage.

Une riposte réussie peut diminuer concentration et moral.

Le décrochage continue à fonctionner.

La récupération continue à fonctionner.

Une intervention professeur coûte de la patience.

Une intervention impossible par manque de patience est refusée.

PASS ne coûte aucune patience.

Pédagogie influence correctement les actions concernées.

Autorité influence les perturbations.

Une intervention ciblée ne touche que la cible prévue.

Une intervention collective touche les cibles prévues.

Un effet temporaire reste actif pendant sa durée.

Un effet temporaire expire correctement.

Une intervention du professeur ne modifie jamais rétroactivement le round terminé.

Le round suivant utilise correctement les effets de l'intervention.

Une même seed + mêmes décisions professeur produit le même résultat.
```

---

# 39. Tests de déterminisme avec décisions professeur

Ajouter au moins un scénario de test complet.

Exemple :

```text
seed = 12345

Round 1
→ PASS

Round 2
→ ENCOURAGE Alice

Round 3
→ REEXPLAIN Paul

Round 4
→ PASS
```

Exécuter ce scénario plusieurs fois.

Les résultats doivent être strictement identiques.

Puis modifier une décision du professeur et vérifier que la simulation peut diverger de manière déterministe.

---

# 40. Journal de simulation

Enrichir `npm run simulate` afin que le nouveau pipeline soit lisible.

Exemple :

```text
ROUND 2

ALICE — OFFENSIVE

ATTACK LESSON
power: 14
complexity: 9

SUCCESS
understanding: 31 → 38
morale: 1.00 → 1.05
concentration: 17 → 16

LESSON COUNTERATTACK
pressure: 8

PAUL — DEFENSIVE
protects Alice
pressure: 8 → 5

ALICE DEFENSE
discipline: 4

DAMAGE
concentration: 16 → 14
morale: 1.05 → 1.01

[...]

ROUND RESULT

TEACHER
patience: 18 / 25

AVAILABLE:
ENCOURAGE
REEXPLAIN
REFRAME
BREAK
PASS
```

Le format exact peut être adapté.

Le journal doit rester destiné au debug et à la compréhension du moteur.

---

# 41. Configuration

Les valeurs d'équilibrage doivent être centralisées autant que raisonnablement possible.

Exemples :

```text
coûts en patience
puissance des interventions
durée des buffs
bonus de moral
coût de concentration
force de pression
coefficients de défense
probabilités
seuil de décrochage
```

Ne pas disperser ces nombres dans plusieurs résolveurs.

Ne pas créer non plus un gigantesque système de configuration abstrait.

---

# 42. Hors périmètre de Roadmap 2

Ne PAS développer maintenant :

```text
agenda complet
campagne annuelle
examen final
plusieurs classes
25 élèves
personnalités avancées
affinités avancées
éditeur de leçons
progression complète des concepts
arbres d'évolution RPG
sprites définitifs
six directions définitives
animations complexes
effets sonores
sauvegarde complète
équilibrage définitif
```

La vue 3×3 existante suffit pour tester la boucle.

---

# 43. Critères de réussite

Roadmap 2 est terminée lorsque :

1. chaque élève suit un pipeline de combat pédagogique compréhensible ;
2. la leçon possède une défense via la complexité ;
3. la leçon riposte via la pression ;
4. concentration, moral et compréhension ont des rôles distincts ;
5. Support, Offensif et Défensif commencent à avoir des comportements réellement différents ;
6. un Défensif peut protéger un voisin ;
7. le professeur peut intervenir après chaque round ;
8. chaque intervention coûte de la patience ;
9. pédagogie influence l'efficacité des interventions appropriées ;
10. autorité réduit ou bloque les perturbations ;
11. des effets peuvent persister plusieurs rounds ;
12. le joueur peut cibler un élève lorsque nécessaire ;
13. PASS est disponible ;
14. le résultat du round est lisible avant de décider ;
15. les conséquences d'une intervention sont observables au round suivant ;
16. la simulation reste déterministe ;
17. tous les anciens tests continuent à passer ;
18. les nouveaux tests passent ;
19. `npm run simulate` permet de comprendre le nouveau pipeline ;
20. l'interface 3×3 permet de jouer cette boucle de bout en bout.

---

# 44. Méthode de travail demandée à Codex

Avant toute modification :

1. lire la Roadmap générale et Roadmap 1 ;
2. inspecter l'implémentation actuelle ;
3. identifier précisément les éléments de Roadmap 2 déjà présents grâce à Roadmap 1.1 ;
4. ne pas dupliquer les systèmes existants ;
5. proposer un plan d'intégration court.

Ensuite travailler par incréments.

Ordre recommandé :

```text
A. Formaliser le pipeline actuel
B. Stabiliser attaque / complexité
C. Stabiliser riposte / pression
D. Intégrer la défense voisine
E. Stabiliser moral / concentration / décrochage
F. Introduire les effets temporaires
G. Implémenter TeacherAction
H. Implémenter patience / pédagogie / autorité
I. Implémenter ciblage
J. Intégrer la phase professeur à l'interface
K. Améliorer le résultat de round
L. Compléter tests et déterminisme
```

Après chaque incrément :

- exécuter les tests concernés ;
- conserver la compatibilité avec les tests précédents ;
- résumer les changements ;
- indiquer les principaux fichiers modifiés ;
- signaler toute hypothèse de game design nécessaire.

---

# 45. Règle importante

Ne pas modifier une mécanique de Roadmap 1.1 uniquement parce qu'une autre implémentation semble plus élégante.

Si l'existant répond déjà au besoin :

```text
l'étendre
```

plutôt que :

```text
le remplacer.
```

En cas de contradiction entre cette Roadmap et l'implémentation actuelle, identifier explicitement le conflit avant d'effectuer une refonte importante.

---

# 46. Première mission

Commence par inspecter le projet actuel.

Avant d'écrire du code, fournis :

1. un état des lieux du pipeline actuel d'un round ;
2. les éléments de cette Roadmap déjà implémentés ;
3. les éléments manquants ;
4. les fichiers/classes qui devront probablement évoluer ;
5. les éventuels conflits avec Roadmap 1.1 ;
6. un plan d'implémentation incrémental.

Ensuite seulement, commence l'implémentation de Roadmap 2.