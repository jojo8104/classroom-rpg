# Roadmap 6 — Préparation de classe

La préparation précède chaque leçon. Le cours démarre exclusivement avec « Lancer la leçon », après validation du plan. Les résultats permettent de préparer la leçon suivante.

## Fonctionnement

- Plan 3×3 distinct des profils élèves ; déplacements et échanges par pointeur (souris, tactile, stylet), avec alternative au clavier : sélectionner, Déplacer, destination, Entrée. Échap annule.
- Fiche compacte : personnalité, rôle, statistiques, acquis par notion, préférences, relations orientées des voisins, soutiens pédagogiques possibles et compétences RPG existantes.
- Prévisualisation d’un échange sur une copie. Score = préférence × 5 + moyenne des relations sortantes × 0,5. Les connaissances et compétences sont exposées mais ne rentrent pas dans ce score.
- Confort initial limité à −3/+3 moral. Pas de placement automatique.
- Verrouillage des sièges source et destination. Reset restaure exactement le plan initial, verrous compris.
- Sauvegarde locale versionnée : plan initial, plan actuel, réserve pour plans nommés, profils et relations. Erreur visible si le stockage est inaccessible ; aucune promesse de synchronisation entre appareils.
- Snapshot de leçon indépendant des modifications extérieures. Voisins directs via ClassroomLayoutSystem pour aide, réactions, combos, perturbations et comparaisons sociales ; diagonales disponibles sur demande.
- Absents exclus du snapshot actif et des résultats de séance, profils et relations conservés.
- Coordonnées métier limitées à lignes/colonnes et identifiants. Grilles 4×4 et 5×5 couvertes ; le prototype reste en 3×3.

## Compatibilité et connaissances

Les scénarios historiques conservent un champ optionnel `seatId`, lu uniquement pour migrer les données sans layout. Le nouveau prototype ne stocke aucune place dans les élèves. Lorsqu’un plan existe, il fait autorité même si un ancien `seatId` est présent.

La Roadmap 5 complète n’était pas implémentée dans le dossier reçu. Cette livraison ajoute un socle explicite `knowledge[conceptId]` : acquis de démonstration au premier lancement, conservation dans la sauvegarde, valeur « non évalué » si absente. Une consolidation modérée au bilan ajoute 15 % de l’écart positif entre compréhension finale et acquis antérieur, une seule fois. Ce socle ne prétend pas implémenter une Roadmap 5 non fournie.

## Vérifications

Tests automatisés dans `tests/layout.test.ts` : déplacement, échange, nouveaux voisins, diagonales, verrouillage, prévisualisation sans mutation, effets des relations et préférences, soutien compétent malgré un lien négatif, reload, reset exact, stockage défaillant, validation d’entrées incorrectes, grilles configurables, snapshot isolé, voisinage du moteur, absences et consolidation idempotente.

La compilation TypeScript et la suite complète (255 tests, dont 16 nouveaux tests) sont vérifiées. Les grilles 4×4 et 5×5 sont exercées avec 16 et 25 élèves. Le rendu et les gestes réels en navigateur restent à essayer manuellement ; aucune validation visuelle automatisée n’est revendiquée.

## Parcours manuel

1. Sélectionner Emma : faibles acquis, Louis compétent mais relation négative.
2. Glisser Emma vers une place voisine d’Alice et consulter le score et les liens avant de relâcher.
3. Vérifier l’échange puis verrouiller une des places : ni départ ni arrivée possible.
4. Recharger : retrouver le placement. Réinitialiser : retrouver le plan de départ.
5. Essayer l’alternative au clavier et le glisser-déposer tactile.
6. Lancer la leçon, terminer les rounds et interventions, puis préparer la suivante : connaissances, RPG et relations conservés.
