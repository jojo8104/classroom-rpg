# Classroom RPG — Roadmap 2 en cours

Jouer : https://jojo8104.github.io/classroom-rpg/

Moteur TypeScript déterministe, console et interface 3×3 indépendante.

## Commandes (Node.js 22)

```sh
npm install
npm run typecheck
npm test
npm run simulate
npm run simulate -- 54321
npm run dev
```

L'aperçu local est sur http://127.0.0.1:4173. Un pupitre affiche la compréhension et
les HP ; sa fiche détaille le moral et les acquis par chapitre. Recommencer rejoue
le scénario initial, sans conserver le moral de la séance précédente.

## Combat et décrochage

- Leçon : complexité 50, pression 70 et progression requise 100 dans le prototype.
- Chaque chapitre réserve une part égale de la progression (50 points chacun).
- Moral : multiplicateur = 0,1 + 1,8 × moral / 100.
- Attaque = intelligence × multiplicateur ; défense = discipline × multiplicateur.
- Gain = 0,65 × attaque × 50 / (50 + complexité) × variation entre 0,9 et 1,1.
- Dégâts = 0,65 × pression × 50 / (50 + défense).
- Critique : 10 %, gain ×1,5 et aucune riposte. Compléter le chapitre évite aussi sa riposte.
- Statistiques sur 0–100 et calculs arrondis à deux décimales.

La concentration est uniquement une réserve de HP : à 1 HP on peut apprendre,
à zéro on ne travaille plus. Passer de HP positifs à zéro retire 8 points de moral,
une fois par décrochage. À zéro lors de l'action principale, l'élève se repose :
+30 HP, aucune progression et une étape manquée. Il n'apprend pas via un bonus ce
round et reprend au suivant. SUPPORT restaure 10 HP (maximum 100), remplaçant
l'ancien bonus temporaire ; il peut réveiller un élève avant son action principale
et créer un WORK supplémentaire.

La compréhension globale vient de la somme des progressions par chapitre.
Un chapitre suivant ne comble pas les lacunes du précédent. Les acquis ne sont
jamais retirés. Le compteur d'étapes manquées est informatif, sans deuxième pénalité.
Les concepts restent référencés, sans validation individuelle.

SimulationResult.nextLessonStudents prépare une nouvelle séance : 100 HP et moral
final conservé. L'appelant transmet ces élèves au prochain scénario. Les résultats
par chapitre restent dans l'historique retourné. Un nouveau scénario initialise une
nouvelle progression ; le rattrapage lors d'une séance ultérieure reste à concevoir.
Il n'y a ni sauvegarde disque ni campagne automatique.

## Architecture

Premier incrément de Roadmap 2 : `src/engine/turn.ts` isole le travail en un
pipeline suspendable. Les fenêtres BEFORE/DURING_STUDENT_ATTACK précèdent le
calcul du gain ; AFTER_STUDENT_ATTACK suit la progression. Si une riposte est
autorisée, BEFORE/DURING_LESSON_ATTACK précèdent la défense personnelle et les
dégâts ; AFTER_LESSON_ATTACK suit leurs conséquences, décrochage compris.
Chaque fenêtre produit REACTION_WINDOW_OPENED dans le journal moteur, sans
ajouter de délai au rendu lorsqu'aucune réaction n'a lieu.
SUPPORT et RECOVER conservent leurs règles et n'ouvrent pas ces fenêtres.
Les actions supplémentaires WORK suivent le même pipeline que le travail normal.

La première réaction active, `protect_neighbor`, réduit la pression avant la
défense personnelle. Elle est déclarée dans les données et associée à l'archétype
Défensif. Les relations sont fixes, réciproques et propres à chaque paire (0–100,
absence = 0). Seuls les voisins directs peuvent intervenir, avec au moins 40 de
relation et une concentration positive ; un élève au repos reste indisponible
pour le round. Le protecteur conserve son action principale.

Réduction = min(0,8 ; 0,6 × discipline / 50 × multiplicateur de moral × relation / 100).
La pression effective est arrondie à deux décimales et ne concerne que la riposte
en cours. Un seul protecteur est retenu par riposte, par relation décroissante puis
par siège. La file possède une voie de réactions, résolue avant de reprendre le
tour suspendu, avec le même budget global et la même limite de profondeur.
Chaque élève peut réagir une fois par round, indépendamment de ses actions bonus.
Ces valeurs sont configurables ; aucun tirage aléatoire supplémentaire n'est utilisé.
Le journal et la vue 3×3 montrent le protecteur, la cible et la pression avant/après.
La fiche élève affiche les relations voisines et les réactions utilisées.

Les Soutiens ont désormais des spécialités définies par leurs capacités : Léa
donne un bonus d'intelligence avant l'attaque, Louis un bonus de discipline pendant
l'attaque, Chloé un bonus de moral après une progression réussie. Les capacités
individuelles remplacent celles de l'archétype quand `student.reactionIds` est
renseigné (une liste vide désactive les réactions de cet élève).
Le soutien réactif ne remplace pas l'action principale SUPPORT de Roadmap 1.1.
Un soutien et une protection peuvent intervenir pendant le même tour ; chaque
fenêtre retient une réaction, avec au plus un soutien par statistique sur le tour.

Les bonus valent leur puissance de base (16, 20 ou 12) × relation / 100 ; leurs valeurs et
leurs durées sont configurées dans le prototype. Les statistiques effectives
sont plafonnées à 100 et les valeurs de base restent intactes. Le plus fort bonus
de chaque statistique s'applique, sans addition des sources. Un même effet reçu
à nouveau conserve la meilleure puissance et la plus longue durée restante.

La durée de deux rounds inclut le round d'application. La décrémentation intervient
une seule fois en fin de round, après toutes les actions bonus ; un effet appliqué
entre deux rounds couvre donc entièrement le prochain round. Les effets survivent
aux changements de chapitre de la même séance mais ne passent pas dans une nouvelle
leçon. Application, renouvellement, décrémentation et expiration sont journalisés.
Le soutien après progression n'augmente pas rétroactivement le gain ; son bonus
de moral influence la riposte puis les attaques suivantes tant qu'il est actif.
La fiche affiche l'auteur, le bonus, la durée restante et la statistique effective.

Les Offensifs peuvent réduire la complexité pour l'attaque d'un voisin à partir
de 40 de relation. Réduction = min(0,6 ; 0,4 × intelligence effective / 50 ×
multiplicateur de moral × relation / 100). La complexité de base de la leçon ne
change jamais ; la réduction est abandonnée dès la fin de cette attaque.

À 90 de relation, le combo remplace l'affaiblissement simple du même partenaire.
Une seule réaction offensive est autorisée par tour, avec le budget commun
d'une réaction par élève et par round. Le combo calcule la contribution de chacun
contre la même complexité, avec le même tirage de variation et de critique, puis
ajoute une synergie : (contribution A + contribution B) × 0,25 × relation / 100.
Les contributions utilisent les statistiques effectives, bonus temporaires compris.
La synergie est arrondie à deux décimales, avec un minimum de 0,01 pour une somme
positive. Aucun tirage aléatoire supplémentaire n'est consommé.

La progression va uniquement à l'élève actif. Le partenaire garde son tour principal.
Le journal et l'interface distinguent les deux contributions, la synergie, le gain
potentiel et les points effectivement acquis : le plafond du chapitre peut limiter
le gain appliqué. Les critiques et la complétion du chapitre évitent toujours la
riposte. Dans le prototype, Inès et Adam possèdent la relation de 90 nécessaire.
Les seuils et coefficients restent provisoires et configurables dans les données.

- src/domain.ts : élèves, leçons, états de séance et résultats.
- src/data/ : scénario 3×3 et paramètres configurables.
- src/engine/combat.ts : formules et initialisation des acquis.
- src/engine/actions.ts : file FIFO bornée, travail, soutien, repos et ripostes.
- src/engine/reactions.ts : éligibilité, relations, voisinage et réactions des trois archétypes.
- src/engine/effects.ts : bonus temporaires, statistiques effectives et expiration.
- src/engine/simulation.ts : rounds, chapitres, phase du professeur et résultats.
- src/engine/random.ts : Mulberry32 avec seed entière 32 bits.
- src/engine/validation.ts : validation du scénario.
- src/events.ts : événements typés avec séquence, leçon, chapitre et round.
- src/ui/app.ts et web/ : lecture des événements et interface.
- src/cli/ : journal console.

Le moteur ne dépend ni du DOM ni de l'horloge. Les entrées et sorties sont copiées.
Les limites de file protègent les actions par round, extras par élève et profondeur.
Le rendu finit la lecture des événements avant de rendre la main au professeur.

## Équilibrage exploratoire

Après npm run build, lancer node scripts/check-balance.mjs.
Mesures historiques de Roadmap 1.1, avant les protections voisines, sur 200 seeds
par profil (même moral initial pour tous les élèves) :

| Moral initial | Compréhension moyenne | Décrochages par leçon de 9 élèves |
|---|---:|---:|
| 10 | 17,74 % | 14,79 |
| 50 | 73,38 % | 3,86 |
| 90 | 87,67 % | 0,06 |

Un élève peut décrocher plusieurs fois. Ces mesures ne constituent pas un équilibrage
final ; le profil démotivé est volontairement difficile.

## GitHub Pages

Pages sert docs/ sur master. Lancer npm run build:pages, inclure docs/ dans le commit,
puis pousser sur GitHub. Ne pas modifier les fichiers compilés à la main.
Les chemins relatifs supportent /classroom-rpg/ ; .nojekyll désactive Jekyll.
L'hébergement utilisé est GitHub Pages, pas Sites.

## Hors périmètre

Personnalités, évolution des relations, softskills, environnement, interventions du professeur,
validation des concepts, sauvegarde, agenda et sprites restent à développer.
WebMCP facultatif : read_classroom et advance_lesson, vérifiés dans l'aperçu local.
