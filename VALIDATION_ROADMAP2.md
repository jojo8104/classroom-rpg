# Validation de Roadmap 2 — 12 septembre 2026

## Périmètre

Boucle tactique du prototype 3×3, avec les ajouts 35 bis et 35 ter.
Les valeurs sont provisoires ; cette validation ne constitue pas un équilibrage final.

## Correspondance avec les critères du point 43

| Critères | Couverture |
|---|---|
| 1–3 : pipeline, complexité, pression | Résolution par fenêtres ; tests turn, combat-validation, actions. |
| 4 : concentration, moral, compréhension | Réussite, effort, riposte, décrochage et récupération ; tests learning et simulation. |
| 5–6 : archétypes et protection | Soutiens spécialisés, réduction de complexité, protection voisine et combos ; tests support-effects, reactions, offensive. |
| 7–9 : interventions, patience, pédagogie | Quatre actions payantes, validation atomique des coûts et cibles ; tests teacher. PASS demeure gratuit. |
| 10 : autorité | Réduction passive des dégâts, y compris sans patience ; recadrage temporaire ; tests teacher. |
| 11 : effets persistants | Durées, renouvellement, expiration et absence de mutation des bases ; tests support-effects et teacher. |
| 12–13 : ciblage et PASS | Formulaire et sélection depuis le bilan ; aucune dépense pour PASS. |
| 14–15 : bilan et effets visibles | Bilan figé, interactions reçues, points d’attention ; tests round-summary et parcours navigateur. |
| 16–18 : déterminisme et tests | 190 tests passent, dont répétitions sur 100 seeds et permutations des données. |
| 19 : journal console | Scénario `node dist/cli/simulate.js 12345 --teacher-demo` terminé ; checks, effets, coûts et résultats détaillés. |
| 20 : leçon jouable | Parcours navigateur de six rounds avec les quatre interventions puis PASS ; voir contrôle ci-dessous. |

## Ajouts du point 35 ter

Les 34 tests interactions couvrent probabilités exactes, indépendance des checks,
maîtrise locale, séparation des aides sociales et pédagogiques, exigences des deux
participants au combo, priorité et budgets de réactions, relation, voisinage et
reproductibilité. La conversion de moral 0–100 vers son multiplicateur historique
est conservée et documentée dans README.md.

## Lecture des alertes

La forte perte passe de 15 à 25 points nets par round. Une alerte séparée signale
une réserve restante de concentration entre 0 exclu et 25 inclus. Le décrochage
reste distinct. Un test vérifie les frontières et évite de confondre perte et réserve.
Ces seuils ne modifient pas la simulation.

## Limites assumées

Personnalités avancées, progression des relations, sauvegarde et campagne restent
hors périmètre. Les paramètres de moral, maîtrise et effort doivent être éprouvés
par davantage de parties. La validation ne suppose pas que toutes les réactions
se produisent dans une seule seed : leurs cas limites sont couverts séparément.

## Parcours navigateur contrôlé

Seed 12345 : REEXPLAIN Léa, REFRAME Hugo, ENCOURAGE Alice, BREAK, PASS,
puis clôture gratuite. Passage au second chapitre et lancement explicite des rounds
vérifiés. Patience successive : 56, 46, 38, 32, 32, 32. Le sélecteur d'intervention
est désactivé au dernier bilan ; la clôture aboutit à « Leçon terminée ».

Les compréhensions finales de l'interface correspondent au moteur console :
Alice 96,34 ; Paul 100 ; Léa 94,39 ; Hugo 100 ; Emma 100 ; Louis 100 ; Inès 100 ;
Adam 100 ; Chloé 84,28 %. Les résultats et la patience sont identiques.

Commandes validées : `npm test`, `npm run typecheck`, `npm run build:pages`,
`node dist/cli/simulate.js 12345 --teacher-demo`.
