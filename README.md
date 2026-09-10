# Classroom RPG

Jouer : https://jojo8104.github.io/classroom-rpg/

## Publication GitHub Pages

GitHub Pages sert les fichiers compilés du dossier `docs/` sur la branche `master`.
Pour publier une modification, exécuter `npm run build:pages`, puis inclure `docs/`
dans le commit et envoyer celui-ci sur GitHub. Le fichier `.nojekyll` désactive le
traitement Jekyll. Les chemins relatifs permettent de servir le jeu sous `/classroom-rpg/`.

Moteur de simulation de classe en TypeScript, sans interface graphique.
Le périmètre est décrit dans [roadmapglobal.md](./roadmapglobal.md).

## Installation et vérification

Node.js 22 et npm sont utilisés pour cette base.

```sh
npm install
npm run typecheck
npm test
npm run simulate
# Autre seed :
npm run simulate -- 54321
```

## Premier incrément

- `src/domain.ts` : types simples du domaine, état temporaire et résultats séparés.
- `src/data/prototype.ts` : fabrique d'un scénario indépendant avec neuf élèves,
  une grille 3×3, trois archétypes et deux chapitres de trois rounds.
- `src/data/rules.ts` : bornes configurables des statistiques.
- `src/engine/validation.ts` : contrôle des positions, occupations, références,
  statistiques et chapitres ; retourne toutes les erreurs sans modifier le scénario.
- `tests/validation.test.ts` : tests des invariants et de l'isolation des données.

Les coordonnées de siège commencent à zéro. Les statistiques utilisent l'échelle
0–100 ; leurs valeurs sont provisoires. La compréhension reste propre à la séance.
Les concepts sont référencés, sans mécanique de déblocage à ce stade.

## Deuxième incrément

- `src/engine/random.ts` : générateur Mulberry32, seed entière non signée sur 32 bits.
- `src/engine/actions.ts` : file FIFO et résolution des actions d'un round,
  sans mutation des élèves ni des états fournis.
- `src/events.ts` : événements typés décrivant les actions, effets et limites atteintes.
- `src/data/rules.ts` : formules, probabilités par archétype et limites configurables.
- `tests/actions.test.ts` : déterminisme, effets, ordre de la file et arrêt des chaînes.

WORK utilise l'intelligence, la concentration effective et une variation à seed.
SUPPORT choisit un autre élève et augmente sa concentration jusqu'à la fin du round.
Il peut ajouter un WORK supplémentaire en fin de file. Un élève isolé utilise WORK.
Discipline et moral n'ont pas encore d'effet sur ces calculs provisoires.
Le budget global réserve les actions principales avant d'accepter des actions
supplémentaires ; un budget inférieur au nombre d'élèves est rejeté.
La profondeur et le nombre d'actions supplémentaires par élève sont aussi bornés.
Les actions supplémentaires WORK ne déclenchent pas d'autres réactions à ce stade.

La résolution utilise l'ordre fourni par l'appelant et retourne les états de fin de
round et les événements. La boucle fournit l'ordre stable des sièges.

## Troisième incrément : Roadmap 1

- `src/engine/simulation.ts` : machine d'état, chapitres, rounds, phase du professeur
  et résultats individuels. Les données et règles sont copiées à la construction.
- `src/events.ts` : chaque événement de leçon porte une séquence, la leçon,
  le chapitre et le numéro du round (0 avant le premier round).
- `src/cli/formatJournal.ts` : traduction des événements en journal lisible.
- `src/cli/simulate.ts` : exécution console avec seed 12345 par défaut.
- `tests/simulation.test.ts` : boucle complète, déterminisme, transitions et isolation.

`npm run simulate` compile TypeScript vers `dist/` puis exécute le journal.
Cette compilation remplace le besoin d'un exécuteur TypeScript supplémentaire.

La simulation expose `resolveRound()`, qui retourne les événements du round et
s'arrête à `ROUND_RESULT`. Après leur affichage, `acknowledgeRoundResult()` ouvre
`TEACHER_INTERVENTION`. `skipTeacherIntervention()` poursuit la leçon. Le professeur
ne possède encore aucune action. La même phase existe après le dernier round, avant
la fin de leçon. Les transitions hors séquence lèvent une erreur.
`runToCompletion()` effectue automatiquement ces étapes pour la console et les tests.

Les événements, états exposés et résultats sont des copies : un futur rendu ne peut
pas modifier rétroactivement la simulation. Aucune horloge ni interface n'intervient
dans les résultats. Les concepts restent distincts des résultats individuels.

## Limites et suite

Les valeurs d'équilibrage et les formules restent provisoires. Les deux actions
ont des résolveurs directs ; un catalogue d'effets génériques n'est pas nécessaire
pour ce petit ensemble. Le journal reste intégralement en mémoire pour six rounds.
Le moteur n'enregistre pas de sauvegarde et n'acquiert pas encore de concepts.
## Première interface 3×3

`npm run dev` compile et sert la classe sur http://127.0.0.1:4173.
`web/` contient la page et les styles ; `src/ui/app.ts` consomme les événements
sans recalculer les règles du moteur. `scripts/build-web.mjs` prépare la version
statique dans `dist/client` ; la commande console reste disponible.

Sélectionnez un pupitre pour afficher une fiche. Commencez la leçon puis continuez
sans intervention après chaque étape. Les contrôles de progression et de redémarrage
sont bloqués pendant la lecture des événements. La seed permet de rejouer la même
leçon. Le bonus de soutien reste limité au round et n'altère pas les statistiques
permanentes de la fiche. La vue respecte la préférence de réduction des mouvements.

Les pupitres sont des contrôles schématiques, sans sprites ni rendu 2.5D.
Le registre WebMCP facultatif expose `read_classroom` et `advance_lesson` lorsqu'il
est disponible. Sa validation dans un navigateur compatible reste à effectuer.
