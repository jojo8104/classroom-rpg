# Roadmap 4 — progression RPG

## Intégration

La progression est un bloc sérialisable facultatif sur `Student`. Le prototype
jouable et le CLI utilisent `createProgressionPrototype`. Les anciens scénarios
restent disponibles pour les tests de non-régression. Les mêmes résolveurs,
fenêtres de réaction, effets temporaires et ActionQueue servent aux trois versions.

La règle validée est hybride : l'altruisme peut assouplir les seuils relationnels
ordinaires, puis les traits pondèrent les choix. Il ne contourne jamais un
déblocage, une maîtrise minimale, le voisinage, un budget, ni le seuil de combo.

## Progression

- Niveaux 1–5, seuils cumulés 0 / 20 / 50 / 90 / 140 XP.
- Participation 5 XP ; contributions utiles 2 XP, combo 3 XP.
- Plafond de deux récompenses par catégorie tactique et par leçon.
- Progression personnelle et difficulté surmontée : 2 XP chacune, une fois.
- L'usage utile continue à être enregistré après le plafond d'XP.
- Aucun accroissement des statistiques permanentes.

Les seuils, récompenses, plafonds et critères se trouvent dans
`src/data/progressionRules.ts`. Le catalogue de douze compétences et les six
branches se trouvent dans `src/data/abilities.ts`.

`ABILITY_USED` distingue utilisation et effet réel. Le combo est crédité après
sa résolution, jamais à son lancement. Les événements dérivés de concentration,
moral, relations et effets temporaires ne multiplient pas les récompenses.
Un effet renouvelé sans changement de valeur effective ne donne pas d'XP ; une
simple prolongation n'est pas récompensée dans ce prototype.

La clôture émet `LESSON_ENDED`, puis `LESSON_RESULTS`, les récompenses, l'usage,
les niveaux, déblocages et propositions. Elle est exécutée une seule fois.
`getResult()` ne distribue rien et retourne des copies profondes. Aucun
déblocage n'intervient pendant un round. Les statistiques de compréhension,
chapitres et effets sont réinitialisées à la leçon suivante ; XP et usage restent.
Les concepts restent des références de leçon, sans acquisition individuelle.

## Compétences et spécialisations

| Archétype | Niveau 1 | Niveau 2 | Niveau 3 | Niveau 4 |
|---|---|---|---|---|
| Soutien | Encouragement | Soutien de concentration | Aide pédagogique | Stabilisation |
| Offensif | Attaque de complexité | Analyse | Préparation offensive | Attaque coordonnée |
| Défenseur | Protection | Interception préventive | Réduire la tension | Protection durable |

Les techniques de stabilisation utilisent les bonus temporaires de discipline
existants ; l'interception préventive prépare donc la défense personnelle, tandis
que Protection réduit directement la pression pendant la riposte.

Au niveau 5, les tendances d'usage proposent deux branches sans faire le choix :

- Motivateur : moral/concentration, puissance ×1,25 et durée +1 pour les effets temporaires.
- Pédagogue : aide pédagogique, puissance ×1,3 et durée +1.
- Analyste : préparation/complexité, puissance ×1,3.
- Coordinateur : synergie des combos ×1,5.
- Protecteur : réduction de pression ×1,3, toujours bornée.
- Stabilisateur : stabilité/moral, puissance ×1,2 et durée +1.

Le choix explicite passe par `Simulation.chooseSpecialization`, uniquement après
la leçon. Il est journalisé, persiste dans `nextLessonStudents` et ne retire
aucune compétence de l'archétype. Les exigences pédagogiques restent strictes.

## Interface

La fiche affiche XP, niveau, compétences connues/verrouillées, limites et tendances.
Le bilan individuel détaille les motifs d'XP et les nouvelles compétences. Au
niveau 5, les boutons de branche présentent leurs effets avant le choix.
Le bouton « Leçon suivante » transmet les élèves et les relations au scénario
suivant. Recommencer une leçon en cours repart de son état initial sans gain d'XP.
Il n'y a pas de sauvegarde disque : recharger la page réinitialise le prototype.

## Simulation longue

Commande : `npm run simulate:progression` (rapport JSON sur la sortie standard).
La fonction `runProgressionStudy` simule dix élèves et vingt leçons avec les
conditions normales du prototype et sans interventions du professeur. Le pilote
de test choisit explicitement la branche de tendance dominante au niveau 5.

Observation seed 12345 : les dix élèves atteignent le niveau 5. XP moyenne :
Offensifs 293 ; Défenseurs 237,67 ; Soutiens 231,5. L'écart offensif est visible
et reste à équilibrer. Le niveau maximum plafonne les déblocages, pas l'XP cumulée.
Le niveau 5 est atteint entre la dixième et la treizième leçon.

Onze compétences sur douze ont un effet utile dans ce scénario. `reassure`
(Réduire la tension) n'y est pas utilisée. Cette absence reste un point
d'équilibrage à examiner ; un test isolé vérifie son effet dans sa fenêtre.
Les branches dominantes sont Analyste, Stabilisateur et Motivateur. Les six
branches sont néanmoins testées ; cette observation n'est pas un équilibrage final.

Le rapport complet est dans `progression-study.json`. Les récompenses sont
bornées par catégorie, même si des actions supplémentaires se produisent.
La répétition de toute l'étude doit restituer exactement le même état, les mêmes
usages et choix. Aucune campagne, agenda, équipement ou sauvegarde finale n'est ajouté.

## Vérifications

Les tests couvrent la participation, les effets nuls, les plafonds, les seuils,
franchissements multiples, le maximum, les snapshots, la clôture idempotente,
la sérialisation, les compétences verrouillées, la maîtrise, les relations,
l'altruisme, les quotas, les tendances, les six spécialisations et le déterminisme.
Ils incluent aussi chaque réaction isolée dans sa fenêtre et une étude de vingt
leçons répétée. Les 205 tests des Roadmaps précédentes restent inchangés.

Validation finale : TypeScript sans erreur, build web réussi, 239 tests réussis
dans 15 fichiers (205 précédents et 34 nouveaux).

Parcours navigateur : six rounds avec interventions PASS, clôture et bilan
individuel vérifiés. Alice reçoit 11 XP détaillés, puis conserve ces 11 XP lors
du passage à la leçon suivante alors que sa maîtrise et ses chapitres repartent
à zéro, sa concentration à 100 et ses relations sont conservées.
