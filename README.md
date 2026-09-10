# Classroom RPG — Roadmap 1.1

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

- src/domain.ts : élèves, leçons, états de séance et résultats.
- src/data/ : scénario 3×3 et paramètres configurables.
- src/engine/combat.ts : formules et initialisation des acquis.
- src/engine/actions.ts : file FIFO bornée, travail, soutien, repos et ripostes.
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
Sur 200 seeds par profil (même moral initial pour tous les élèves) :

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

Personnalités, affinités, softskills, environnement, interventions du professeur,
validation des concepts, sauvegarde, agenda et sprites restent à développer.
WebMCP facultatif : read_classroom et advance_lesson, non vérifiés en navigateur compatible.
