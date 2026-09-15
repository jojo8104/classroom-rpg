# Roadmap 8 — Scène 2.5D

## Livré

- `src/rendering/ClassroomProjection.ts` : projection pure, résolution virtuelle 1600×900, convergence des colonnes et échelle 0,72–1. Le plan `ClassroomLayout` reste la source de vérité ; aucun pixel n'est enregistré dans les élèves ou les sauvegardes.
- `DepthManager.ts` : cinq sous-couches de rangées, puis effets ; ordre local ombre, personnage, chaise, surface, informations et retour visuel.
- `StudentDesk.ts` : personnage témoin, nom, progression, cinq paliers, repos et nombre d'effets actifs. La fiche compacte présente les statistiques, la personnalité, les principales relations et les effets. Les compétences et explications détaillées sont repliables.
- `SpriteController.ts` : onze animations, six orientations, durée bornée, remplacement d'une action, pause/reprise et retour au repos. Aucun rafraîchissement permanent à l'arrêt ; une seule minuterie existe pendant les actions.
- `ClassroomRenderer.ts` : montage, démontage, projection des places vides ou occupées, écoute des préférences de mouvement, suspension lors du masquage de l'onglet et liens orientés source → cible. Aide, perturbation et combo ont des signes et styles différents.
- Qualités élevées/moyennes/réduites : au plus 8/4/1 liens simultanés. Le mode réduit et `prefers-reduced-motion` désactivent les mouvements. Les indications restent visibles brièvement.
- Toute la classe reste visible par défaut. Un zoom manuel limité à ×2,5 permet de parcourir la scène sur mobile. La sélection ne modifie pas le zoom et n'effectue aucun déplacement de caméra.
- Le placement de préparation conserve son interface de déplacement et de sauvegarde. À chaque lancement, la scène est reconstruite depuis le plan validé, y compris les places vides et les absents.

## Ressources

`web/assets/students/base-01/idle_atlas.png` contient six colonnes transparentes : face, dos, gauche, droite, trois-quarts gauche, trois-quarts droit. Chaque cellule mesure 362×724. Le manifeste porte le nombre de frames et les orientations. Les onze animations utilisent actuellement une pose par direction et des mouvements CSS finis. Un futur atlas peut ajouter des frames verticales et des fichiers par animation via `files`, sans changer la simulation.

Les 25 élèves partagent volontairement ce personnage témoin. Le professeur utilise sa vue de face. Les tenues individualisées et les animations dessinées frame par frame constituent un enrichissement graphique ultérieur.

## Événements et synchronisation

Les événements métier existants sont conservés tels quels. Aucune modification de `src/engine`, des formules, du RNG ou du domaine n'est nécessaire. Les appels graphiques sont uniquement dans l'interface. Les scènes, jauges et fiches consomment les snapshots affichés.

Le mode détaillé traduit les actions et leurs conséquences. Synthèse sélectionne jusqu'à quatre événements saillants, dont les aides et perturbations, puis applique le snapshot complet. Instantanée réinitialise les animations et affiche directement le résultat. Le bilan final est toujours conservé même après de nombreux gains de niveaux. La synthèse n'est pas une reconstitution exhaustive de chaque action.

## Vérifications

- Tests automatisés de projection : 25 places uniques, limites de la scène, convergence et profondeur régulière.
- Orientations gauche/droite aux extrémités, interactions dans une colonne, encouragement face, maîtrise en trois-quarts.
- Déplacement logique reprojeté sans mutation de la sauvegarde ; préparation et absences restent couverts par les tests de placement existants.
- Interruption, pause, reprise, progression des frames et absence de minuterie après repos.
- Leçon complète à 25 élèves : résultat déterministe identique, données et événements inchangés après lecture aux trois vitesses.
- Navigateur : ouverture/fermeture de fiche, affichage des 25 élèves, zoom ×2,5, qualité réduite et vue de 390×844 sans débordement horizontal. Un parcours complet de six rounds atteint le bilan final avec 25 pupitres et zéro animation active ; aucune erreur console observée.

Les tests géométriques et de cycle de vie ne remplacent pas une mesure de FPS ou de consommation sur un téléphone physique. La vue d'ensemble mobile réduit les libellés ; le zoom et la fiche permettent de consulter les détails.
